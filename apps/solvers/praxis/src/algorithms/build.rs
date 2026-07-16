use std::collections::HashMap;
use std::time::{Duration, Instant};

use tracing::info;

use crate::algorithms::bdd_engine::{Bdd, BddRef};
use crate::algorithms::pdag::{Connective, NodeIndex, Pdag};
use crate::algorithms::reorder::{best_order, ReorderMethod};
use crate::algorithms::simplify;
use crate::algorithms::zbdd_engine::{ZbddEngine, ZbddRef};
use crate::analysis::width::compute_dfs_metadata_pdag;
use crate::core::fault_tree::FaultTree;
use crate::Result;

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
    let started = Instant::now();
    let mut pdag = Pdag::from_fault_tree(fault_tree)?;
    info!(pdag_nodes = pdag.node_count(), "build_bdd: PDAG built");
    if opts.fold_constants {
        simplify::fold_constants(&mut pdag)?;
    }
    if opts.splice_null_gates {
        simplify::splice_null_and_not(&mut pdag)?;
    }

    let ordering = Instant::now();
    let order = if let Some(method) = opts.reorder {
        best_order(&pdag, method, opts.reorder_budget)
    } else {
        compute_dfs_metadata_pdag(&pdag)?.variable_order
    };
    info!(
        method = ?opts.reorder,
        variables = order.len(),
        elapsed_s = ordering.elapsed().as_secs_f64(),
        "build_bdd: variable order ready"
    );

    let mut var_of: HashMap<NodeIndex, usize> = HashMap::new();
    for (pos, &idx) in order.iter().enumerate() {
        var_of.insert(idx.abs(), pos);
    }

    let var_probs = pdag.level_var_probs(fault_tree, &var_of)?;
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
    zbdd.enumerate(root)
        .iter()
        .map(|set| {
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
            events
        })
        .collect()
}
