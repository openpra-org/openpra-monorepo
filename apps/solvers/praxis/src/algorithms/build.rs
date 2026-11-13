use std::collections::{HashMap, HashSet};
use std::time::{Duration, Instant};

use tracing::info;

use crate::algorithms::bdd_engine::{Bdd, BddRef};
use crate::algorithms::ordering;
use crate::algorithms::pdag::{Connective, NodeIndex, Pdag, PdagNode};
use crate::algorithms::reorder::{best_order, ReorderMethod};
use crate::algorithms::role_groups::{merge_same_role_events, merging_enabled};
use crate::algorithms::simplify;
use crate::algorithms::zbdd_engine::{ZbddEngine, ZbddRef};
use crate::analysis::width::compute_dfs_metadata_pdag;
use crate::core::fault_tree::FaultTree;
use crate::{PraxisError, Result};

#[derive(clap::ValueEnum, Debug, Clone, Copy, PartialEq, Eq)]
pub enum VariableOrder {
    Dfs,
    Force,
    Sloan,
    DfsScram,
    DfsPlain,
    Reverse,
    Sift,
    Gsift,
    Ils,
}

impl VariableOrder {
    pub fn uses_reordering(self) -> bool {
        matches!(self, Self::Sift | Self::Gsift | Self::Ils)
    }
}

pub fn select_variable_order(
    pdag: &Pdag,
    method: VariableOrder,
    reorder_budget: Duration,
) -> Result<Vec<NodeIndex>> {
    let from_map = |map: HashMap<NodeIndex, usize>| -> Vec<NodeIndex> {
        let mut ordered: Vec<(usize, NodeIndex)> = map
            .into_iter()
            .map(|(event, position)| (position, event))
            .collect();
        ordered.sort();
        ordered.into_iter().map(|(_, event)| event).collect()
    };

    match method {
        VariableOrder::Dfs => Ok(compute_dfs_metadata_pdag(pdag)?.variable_order),
        VariableOrder::Force => Ok(from_map(ordering::force_order(pdag))),
        VariableOrder::Sloan => Ok(from_map(ordering::sloan_fac_order(pdag))),
        VariableOrder::DfsScram => Ok(from_map(ordering::dfs_order(pdag, true))),
        VariableOrder::DfsPlain => Ok(from_map(ordering::dfs_order(pdag, false))),
        VariableOrder::Reverse => {
            let mut order = compute_dfs_metadata_pdag(pdag)?.variable_order;
            order.reverse();
            Ok(order)
        }
        VariableOrder::Sift => Ok(best_order(pdag, ReorderMethod::Sift, reorder_budget)),
        VariableOrder::Gsift => Ok(best_order(pdag, ReorderMethod::Gsift, reorder_budget)),
        VariableOrder::Ils => Ok(best_order(pdag, ReorderMethod::Ils, reorder_budget)),
    }
}

#[derive(Debug, Clone, Copy)]
pub struct BuildOptions {
    pub fold_constants: bool,

    pub splice_null_gates: bool,

    pub reorder: Option<ReorderMethod>,

    pub reorder_budget: Duration,
}

impl Default for BuildOptions {
    fn default() -> Self {
        BuildOptions {
            fold_constants: false,
            splice_null_gates: false,
            reorder: None,
            reorder_budget: Duration::from_secs(10),
        }
    }
}

pub struct BddBuild {
    pub pdag: Pdag,
    pub var_of: HashMap<NodeIndex, usize>,
    pub order: Vec<NodeIndex>,
    pub bdd: Bdd,
    pub root: BddRef,
}

pub fn build_bdd(fault_tree: &FaultTree, opts: BuildOptions) -> Result<BddBuild> {
    build_bdd_internal(fault_tree, opts, None, None, false)
}

pub fn build_bdd_with_variable_order(
    fault_tree: &FaultTree,
    opts: BuildOptions,
    variable_order: VariableOrder,
) -> Result<BddBuild> {
    build_bdd_internal(fault_tree, opts, None, Some(variable_order), false)
}

pub fn build_merged_bdd_with_variable_order(
    fault_tree: &FaultTree,
    opts: BuildOptions,
    variable_order: VariableOrder,
) -> Result<BddBuild> {
    build_bdd_internal(
        fault_tree,
        opts,
        None,
        Some(variable_order),
        merging_enabled(),
    )
}

/// Builds a BDD with an exact caller-provided basic-event order.
///
/// The order must name every basic event exactly once. This entry point is used
/// by HCL callers to align BDD traversal with Bayesian-network causal order.
pub fn build_bdd_with_order(
    fault_tree: &FaultTree,
    opts: BuildOptions,
    variable_order: &[String],
) -> Result<BddBuild> {
    build_bdd_internal(fault_tree, opts, Some(variable_order), None, false)
}

fn merge_same_role_variables(
    pdag: &mut Pdag,
    fault_tree: &FaultTree,
) -> Result<HashMap<String, f64>> {
    let mut values: HashMap<String, f64> = HashMap::new();
    let mut value_of: HashMap<NodeIndex, f64> = HashMap::new();
    let mut mergeable: HashSet<NodeIndex> = HashSet::new();
    for node in pdag.nodes().values() {
        let PdagNode::BasicEvent { id, index } = node else {
            continue;
        };
        let Some(event) = fault_tree.get_basic_event(id) else {
            continue;
        };
        let probability = event.probability();
        values.insert(id.clone(), probability);
        value_of.insert(*index, probability);
        if !event.is_initiator() && probability > 0.0 && probability < 1.0 {
            mergeable.insert(*index);
        }
    }
    let groups = merge_same_role_events(pdag, |event| mergeable.contains(&event))?;
    let mut members = 0usize;
    for group in &groups {
        members += group.members.len();
        let probability = group.role.probability(
            group
                .members
                .iter()
                .filter_map(|member| value_of.get(member).copied()),
        );
        if let Some(name) = pdag.get_node(group.merged).and_then(PdagNode::id) {
            values.insert(name.to_string(), probability);
        }
    }
    info!(
        groups = groups.len(),
        members, "build_bdd: same-role events merged"
    );
    Ok(values)
}

fn build_bdd_internal(
    fault_tree: &FaultTree,
    opts: BuildOptions,
    variable_order: Option<&[String]>,
    variable_order_method: Option<VariableOrder>,
    merge: bool,
) -> Result<BddBuild> {
    let started = Instant::now();
    let mut pdag = Pdag::from_fault_tree(fault_tree)?;
    info!(pdag_nodes = pdag.node_count(), "build_bdd: PDAG built");
    if opts.fold_constants {
        simplify::fold_constants(&mut pdag)?;
    }
    if opts.splice_null_gates {
        simplify::splice_null_and_not(&mut pdag)?;
    }
    let merged_values = if merge {
        Some(merge_same_role_variables(&mut pdag, fault_tree)?)
    } else {
        None
    };

    let ordering = Instant::now();
    let order = if let Some(explicit) = variable_order {
        resolve_variable_order(&pdag, explicit)?
    } else if let Some(method) = variable_order_method {
        select_variable_order(&pdag, method, opts.reorder_budget)?
    } else if let Some(method) = opts.reorder {
        best_order(&pdag, method, opts.reorder_budget)
    } else {
        compute_dfs_metadata_pdag(&pdag)?.variable_order
    };
    info!(
        method = ?variable_order_method,
        legacy_reorder = ?opts.reorder,
        variables = order.len(),
        elapsed_s = ordering.elapsed().as_secs_f64(),
        "build_bdd: variable order ready"
    );

    let mut var_of: HashMap<NodeIndex, usize> = HashMap::new();
    for (pos, &idx) in order.iter().enumerate() {
        var_of.insert(idx.abs(), pos);
    }

    let var_probs = match &merged_values {
        Some(values) => pdag.level_var_probs_from_map(values, &var_of),
        None => pdag.level_var_probs(fault_tree, &var_of)?,
    };
    let constructing = Instant::now();
    let (bdd, root) = Bdd::from_pdag_with_order_and_probs(&pdag, &var_of, var_probs)?;
    info!(
        bdd_nodes = bdd.node_count(),
        construct_s = constructing.elapsed().as_secs_f64(),
        total_s = started.elapsed().as_secs_f64(),
        "build_bdd: BDD constructed"
    );

    Ok(BddBuild {
        pdag,
        var_of,
        order,
        bdd,
        root,
    })
}

fn resolve_variable_order(pdag: &Pdag, names: &[String]) -> Result<Vec<NodeIndex>> {
    let event_count = pdag
        .nodes()
        .values()
        .filter(|node| node.is_basic_event())
        .count();
    if names.len() != event_count {
        return Err(PraxisError::Logic(format!(
            "explicit BDD order has {} entries, but the fault tree has {event_count} basic events",
            names.len()
        )));
    }

    let mut seen = HashSet::with_capacity(names.len());
    let mut order = Vec::with_capacity(names.len());
    for name in names {
        let index = pdag.get_index(name).ok_or_else(|| {
            PraxisError::Logic(format!(
                "explicit BDD order references unknown event '{name}'"
            ))
        })?;
        let node = pdag.get_node(index).ok_or_else(|| {
            PraxisError::Logic(format!(
                "explicit BDD order references missing node '{name}'"
            ))
        })?;
        if !node.is_basic_event() {
            return Err(PraxisError::Logic(format!(
                "explicit BDD order entry '{name}' is not a basic event"
            )));
        }
        if !seen.insert(index) {
            return Err(PraxisError::Logic(format!(
                "explicit BDD order contains duplicate event '{name}'"
            )));
        }
        order.push(index);
    }
    Ok(order)
}

pub fn build_sequence_bdd(
    pdag: &Pdag,
    event_probs: &HashMap<String, f64>,
) -> Result<(Vec<NodeIndex>, Bdd, BddRef)> {
    let meta = compute_dfs_metadata_pdag(pdag)?;
    let var_probs = pdag.level_var_probs_from_map(event_probs, &meta.var_of);
    let (bdd, root) = Bdd::from_pdag_with_order_and_probs(pdag, &meta.var_of, var_probs)?;
    Ok((meta.variable_order, bdd, root))
}

/// Build a sequence and the systems it succeeded into one BDD manager. Delete-term
/// needs the succeeded systems' cut sets to subtract from the sequence's, and set
/// operations only compose when both sides share a variable order, so the order is
/// taken over the union of their cones and every root is built into the same manager.
pub fn build_sequence_bdd_with_successes(
    pdag: &mut Pdag,
    event_probs: &HashMap<String, f64>,
    sequence_root: NodeIndex,
    success_roots: &[NodeIndex],
    scope_id: &str,
) -> Result<(Vec<NodeIndex>, Bdd, BddRef, Vec<BddRef>)> {
    if success_roots.is_empty() {
        pdag.set_root(sequence_root)?;
        let (order, bdd, root) = build_sequence_bdd(pdag, event_probs)?;
        return Ok((order, bdd, root, Vec::new()));
    }

    let mut scope_operands = Vec::with_capacity(success_roots.len() + 1);
    scope_operands.push(sequence_root);
    scope_operands.extend_from_slice(success_roots);
    let scope = pdag.add_gate(
        format!("__DELTERM_SCOPE__{}", scope_id),
        Connective::Or,
        scope_operands,
        None,
    )?;
    pdag.set_root(scope)?;

    let meta = compute_dfs_metadata_pdag(pdag)?;
    let var_probs = pdag.level_var_probs_from_map(event_probs, &meta.var_of);
    let mut bdd = Bdd::new();
    bdd.set_var_probs(var_probs);
    let root = bdd.build_pdag_index(pdag, sequence_root, &meta.var_of)?;
    let mut success = Vec::with_capacity(success_roots.len());
    for &idx in success_roots {
        success.push(bdd.build_pdag_index(pdag, idx, &meta.var_of)?);
    }
    Ok((meta.variable_order, bdd, root, success))
}

pub fn enumerate_event_names(
    zbdd: &ZbddEngine,
    root: ZbddRef,
    pdag: &Pdag,
    order: &[NodeIndex],
) -> Vec<Vec<String>> {
    let mut event_sets = Vec::new();
    zbdd.for_each_set(root, |set| {
        let mut events: Vec<String> = set
            .iter()
            .filter_map(|&pos| {
                order
                    .get(pos)
                    .and_then(|&idx| pdag.get_node(idx))
                    .and_then(|node| node.id().map(|id| id.to_string()))
            })
            .collect();
        events.sort();
        event_sets.push(events);
    });
    event_sets
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::io::parser::parse_fault_tree;
    use std::collections::BTreeSet;

    const SAME_ROLE_MODEL: &str = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="PLANT">
    <define-gate name="TOP"><or><gate name="SEQ1"/><gate name="SEQ2"/></or></define-gate>
    <define-gate name="SEQ1"><and><basic-event name="IE1"/><gate name="TRAIN-A"/><gate name="TRAIN-B"/></and></define-gate>
    <define-gate name="SEQ2"><and><basic-event name="IE2"/><basic-event name="IE3"/><gate name="PAIR"/><not><gate name="TRAIN-B"/></not></and></define-gate>
    <define-gate name="TRAIN-A"><or><basic-event name="A1"/><gate name="A-MORE"/><basic-event name="SUP"/></or></define-gate>
    <define-gate name="A-MORE"><or><basic-event name="A2"/><basic-event name="A3"/></or></define-gate>
    <define-gate name="TRAIN-B"><or><basic-event name="B1"/><basic-event name="B2"/><basic-event name="SUP"/></or></define-gate>
    <define-gate name="PAIR"><and><basic-event name="P"/><basic-event name="Q"/><basic-event name="FLAG"/></and></define-gate>
  </define-fault-tree>
  <model-data>
    <define-basic-event name="IE1"><attributes><attribute name="initiator" value="true"/></attributes><float value="0.1"/></define-basic-event>
    <define-basic-event name="IE2"><attributes><attribute name="initiator" value="true"/></attributes><float value="0.5"/></define-basic-event>
    <define-basic-event name="IE3"><attributes><attribute name="initiator" value="true"/></attributes><float value="0.25"/></define-basic-event>
    <define-basic-event name="A1"><float value="1e-2"/></define-basic-event>
    <define-basic-event name="A2"><float value="2e-3"/></define-basic-event>
    <define-basic-event name="A3"><float value="3e-5"/></define-basic-event>
    <define-basic-event name="B1"><float value="2e-2"/></define-basic-event>
    <define-basic-event name="B2"><float value="3e-4"/></define-basic-event>
    <define-basic-event name="SUP"><float value="1e-3"/></define-basic-event>
    <define-basic-event name="P"><float value="0.2"/></define-basic-event>
    <define-basic-event name="Q"><float value="0.3"/></define-basic-event>
    <define-basic-event name="FLAG"><float value="1.0"/></define-basic-event>
  </model-data>
</opsa-mef>"#;

    const NO_GROUP_MODEL: &str = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="PLANT">
    <define-gate name="TOP"><or><gate name="VOTE"/><gate name="BLOCK"/></or></define-gate>
    <define-gate name="VOTE"><atleast min="2"><basic-event name="X"/><basic-event name="Y"/><basic-event name="Z"/></atleast></define-gate>
    <define-gate name="BLOCK"><and><basic-event name="U"/><not><basic-event name="V"/></not></and></define-gate>
  </define-fault-tree>
  <model-data>
    <define-basic-event name="X"><float value="0.1"/></define-basic-event>
    <define-basic-event name="Y"><float value="0.2"/></define-basic-event>
    <define-basic-event name="Z"><float value="0.3"/></define-basic-event>
    <define-basic-event name="U"><float value="0.4"/></define-basic-event>
    <define-basic-event name="V"><float value="0.05"/></define-basic-event>
  </model-data>
</opsa-mef>"#;

    fn same_role_model_probability() -> f64 {
        let train_a = 1.0 - (1.0 - 1e-2) * (1.0 - 2e-3) * (1.0 - 3e-5);
        let train_b = 1.0 - (1.0 - 2e-2) * (1.0 - 3e-4);
        let support = 1e-3;
        let first = 0.1;
        let second = 0.5 * 0.25 * 0.2 * 0.3;
        support * first + (1.0 - support) * (train_b * first * train_a + (1.0 - train_b) * second)
    }

    fn variable_names(built: &BddBuild) -> BTreeSet<String> {
        built
            .order
            .iter()
            .filter_map(|&variable| built.pdag.get_node(variable))
            .filter_map(PdagNode::id)
            .map(str::to_string)
            .collect()
    }

    fn close(left: f64, right: f64) -> bool {
        (left - right).abs() <= 1e-13 * right.abs()
    }

    #[test]
    fn same_role_events_share_one_variable_and_keep_the_probability() {
        let fault_tree = parse_fault_tree(SAME_ROLE_MODEL).unwrap();
        let options = BuildOptions::default();
        let plain =
            build_bdd_with_variable_order(&fault_tree, options, VariableOrder::Dfs).unwrap();
        let merged =
            build_bdd_internal(&fault_tree, options, None, Some(VariableOrder::Dfs), true).unwrap();

        let expected = same_role_model_probability();
        assert!(close(plain.bdd.probability(plain.root), expected));
        assert!(close(merged.bdd.probability(merged.root), expected));

        assert_eq!(plain.order.len(), 12);
        let names: BTreeSet<String> = [
            "FLAG",
            "IE1",
            "IE2",
            "IE3",
            "SUP",
            "merged-events-0",
            "merged-events-1",
            "merged-events-2",
        ]
        .iter()
        .map(|name| name.to_string())
        .collect();
        assert_eq!(variable_names(&merged), names);
        assert!(merged.bdd.node_count() < plain.bdd.node_count());
    }

    #[test]
    fn merged_events_keep_the_probability_under_every_variable_order() {
        let fault_tree = parse_fault_tree(SAME_ROLE_MODEL).unwrap();
        let expected = same_role_model_probability();
        for order in [
            VariableOrder::Dfs,
            VariableOrder::Force,
            VariableOrder::Sloan,
            VariableOrder::DfsScram,
            VariableOrder::DfsPlain,
            VariableOrder::Reverse,
            VariableOrder::Sift,
            VariableOrder::Gsift,
            VariableOrder::Ils,
        ] {
            let merged = build_bdd_internal(
                &fault_tree,
                BuildOptions::default(),
                None,
                Some(order),
                true,
            )
            .unwrap();
            assert!(
                close(merged.bdd.probability(merged.root), expected),
                "{order:?}"
            );
        }
    }

    #[test]
    fn negated_and_counted_events_stay_separate_variables() {
        let fault_tree = parse_fault_tree(NO_GROUP_MODEL).unwrap();
        let merged = build_bdd_internal(
            &fault_tree,
            BuildOptions::default(),
            None,
            Some(VariableOrder::Dfs),
            true,
        )
        .unwrap();

        let vote = 0.1 * 0.2 + 0.1 * 0.3 + 0.2 * 0.3 - 2.0 * 0.1 * 0.2 * 0.3;
        let block = 0.4 * (1.0 - 0.05);
        let expected = 1.0 - (1.0 - vote) * (1.0 - block);
        assert_eq!(merged.order.len(), 5);
        assert!(close(merged.bdd.probability(merged.root), expected));
    }

    #[test]
    fn a_plain_build_keeps_every_event_as_its_own_variable() {
        let fault_tree = parse_fault_tree(SAME_ROLE_MODEL).unwrap();
        let plain = build_bdd(&fault_tree, BuildOptions::default()).unwrap();
        assert_eq!(plain.order.len(), 12);
        assert!(plain.pdag.get_index("merged-events-0").is_none());
    }
}
