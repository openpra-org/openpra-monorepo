use std::collections::HashSet;
use std::time::Duration;

use tensorbayes::{CompileHeuristic, CompiledJunctionTree, StateIndex};

use crate::algorithms::build::{build_bdd, build_bdd_with_order, BuildOptions};
use crate::algorithms::pdag::PdagNode;
use crate::hcl::{
    HclBaseEvidence, HclEventBinding, HclEventBindings, HclJunctionTreeStats, HclModel,
    HclQuantifier, HclResult, HclSettings,
};
use crate::{PraxisError, Result};

/// Quantifies one fault-tree top event using its HCL/BN bindings.
pub fn quantify_hcl(model: &HclModel, settings: &HclSettings) -> Result<HclResult> {
    model.network().validate()?;
    let build_options = BuildOptions {
        fold_constants: settings.fold_constants,
        splice_null_gates: settings.splice_null_gates,
        reorder: None,
        reorder_budget: Duration::from_secs(10),
    };
    let built = if let Some(order) = &settings.variable_order {
        build_bdd_with_order(model.fault_tree(), build_options, order)?
    } else {
        build_bdd(model.fault_tree(), build_options)?
    };

    let mut bindings = HclEventBindings::new();
    for spec in model.bindings() {
        let node = model.network().node_id(&spec.node)?;
        let variable = model.network().variable(node)?;
        let true_states = resolve_states(variable.states(), &spec.true_states, &spec.node)?;
        bindings.insert(HclEventBinding::for_event(
            &built,
            &spec.event,
            node,
            true_states,
        )?)?;
    }

    let mut base_evidence = HclBaseEvidence::unobserved(model.network().num_variables());
    let mut observed_nodes = HashSet::new();
    for spec in model.base_evidence() {
        let node = model.network().node_id(&spec.node)?;
        if !observed_nodes.insert(node) {
            return Err(PraxisError::Hcl(format!(
                "base evidence observes BN node '{}' more than once",
                spec.node
            )));
        }
        let variable = model.network().variable(node)?;
        let state = variable
            .states()
            .iter()
            .position(|candidate| candidate == &spec.state)
            .ok_or_else(|| {
                PraxisError::Hcl(format!(
                    "base evidence state '{}' does not exist on BN node '{}'",
                    spec.state, spec.node
                ))
            })?;
        base_evidence.observe(node, StateIndex::new(state))?;
    }

    let tree = CompiledJunctionTree::compile(model.network().clone(), CompileHeuristic::MinFill)?;
    let tree_stats = tree.stats();
    let mut quantifier = HclQuantifier::new(&built.bdd, tree, bindings, base_evidence)?;
    let probability = quantifier.quantify(built.root)?;
    let variable_order = built
        .order
        .iter()
        .filter_map(|index| match built.pdag.get_node(*index) {
            Some(PdagNode::BasicEvent { id, .. }) => Some(id.clone()),
            _ => None,
        })
        .collect();

    Ok(HclResult {
        probability,
        bdd_nodes: built.bdd.node_count(),
        bdd_variables: built.bdd.variable_count(),
        variable_order,
        bridge: quantifier.stats(),
        junction_tree: HclJunctionTreeStats {
            num_cliques: tree_stats.num_cliques,
            max_clique_size: tree_stats.max_clique_size,
            treewidth: tree_stats.treewidth,
            total_table_entries: tree_stats.total_table_entries,
        },
    })
}

fn resolve_states(
    available: &[String],
    requested: &[String],
    node_name: &str,
) -> Result<Vec<StateIndex>> {
    if requested.is_empty() {
        return Err(PraxisError::Hcl(format!(
            "binding for BN node '{node_name}' has no true states"
        )));
    }
    requested
        .iter()
        .map(|state| {
            available
                .iter()
                .position(|candidate| candidate == state)
                .map(StateIndex::new)
                .ok_or_else(|| {
                    PraxisError::Hcl(format!(
                        "binding state '{state}' does not exist on BN node '{node_name}'"
                    ))
                })
        })
        .collect()
}
