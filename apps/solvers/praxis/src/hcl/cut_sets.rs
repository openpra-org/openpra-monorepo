use std::cmp::Ordering;
use std::collections::{HashMap, HashSet, VecDeque};

use tensorbayes::{BayesianGraph, NodeId};

use crate::algorithms::noncoherent_mocus::SignedCutSet;
use crate::algorithms::pdag::{NodeIndex, Pdag, PdagNode};
use crate::hcl::{
    HclBindingSpec, HclCutSet, HclCutSetAnalysis, HclCutSetBindingTrace, HclCutSetLiteral,
    HclQuantifier,
};
use crate::{PraxisError, Result};

#[derive(Clone, Debug)]
pub(crate) struct HclCutSetTemplate {
    assignments: Vec<(usize, bool)>,
    literals: Vec<HclCutSetLiteral>,
    bn_ancestor_node_ids: Vec<String>,
    bn_root_cause_node_ids: Vec<String>,
}

pub(crate) fn prepare_cut_sets(
    pdag: &Pdag,
    variable_by_node: &HashMap<NodeIndex, usize>,
    cut_sets: &[SignedCutSet],
    network: &BayesianGraph,
    bindings: &[HclBindingSpec],
) -> Result<Vec<HclCutSetTemplate>> {
    let binding_by_event: HashMap<&str, &HclBindingSpec> = bindings
        .iter()
        .map(|binding| (binding.event.as_str(), binding))
        .collect();

    cut_sets
        .iter()
        .map(|cut_set| {
            let mut assignments = Vec::with_capacity(cut_set.literals.len());
            let mut literals = Vec::with_capacity(cut_set.literals.len());
            let mut ancestors = HashSet::new();

            for &signed_node in &cut_set.literals {
                let node = signed_node.abs();
                let event = match pdag.get_node(node) {
                    Some(PdagNode::BasicEvent { id, .. }) => id.clone(),
                    _ => {
                        return Err(PraxisError::Hcl(format!(
                            "cut-set literal {signed_node} is not a basic event"
                        )))
                    }
                };
                let variable = variable_by_node.get(&node).copied().ok_or_else(|| {
                    PraxisError::Hcl(format!(
                        "cut-set event '{event}' is missing from the HCL BDD order"
                    ))
                })?;
                let complemented = signed_node < 0;
                assignments.push((variable, !complemented));

                let binding = binding_by_event
                    .get(event.as_str())
                    .map(|binding| binding_trace(network, binding, complemented, &mut ancestors))
                    .transpose()?;
                literals.push(HclCutSetLiteral {
                    basic_event_id: event,
                    complemented,
                    binding,
                });
            }

            assignments.sort_unstable_by_key(|(variable, _)| *variable);
            literals.sort_by(|left, right| {
                left.basic_event_id
                    .cmp(&right.basic_event_id)
                    .then_with(|| left.complemented.cmp(&right.complemented))
            });
            let mut bn_ancestor_node_ids: Vec<String> = ancestors
                .iter()
                .map(|node| {
                    network
                        .variable(*node)
                        .map(|variable| variable.name().to_string())
                })
                .collect::<std::result::Result<_, _>>()?;
            bn_ancestor_node_ids.sort();
            let mut bn_root_cause_node_ids: Vec<String> = ancestors
                .into_iter()
                .filter_map(|node| match network.parents(node) {
                    Ok([]) => network
                        .variable(node)
                        .ok()
                        .map(|variable| variable.name().to_string()),
                    _ => None,
                })
                .collect();
            bn_root_cause_node_ids.sort();

            Ok(HclCutSetTemplate {
                assignments,
                literals,
                bn_ancestor_node_ids,
                bn_root_cause_node_ids,
            })
        })
        .collect()
}

fn binding_trace(
    network: &BayesianGraph,
    binding: &HclBindingSpec,
    complemented: bool,
    ancestors: &mut HashSet<NodeId>,
) -> Result<HclCutSetBindingTrace> {
    let node = network.node_id(&binding.node)?;
    let variable = network.variable(node)?;
    let requested: HashSet<&str> = binding.true_states.iter().map(String::as_str).collect();
    let mut states: Vec<String> = variable
        .states()
        .iter()
        .filter(|state| requested.contains(state.as_str()) != complemented)
        .cloned()
        .collect();
    states.sort();

    let mut parents: Vec<String> = network
        .parents(node)?
        .iter()
        .map(|parent| {
            network
                .variable(*parent)
                .map(|variable| variable.name().to_string())
        })
        .collect::<std::result::Result<_, _>>()?;
    parents.sort();
    collect_ancestors(network, node, ancestors)?;

    Ok(HclCutSetBindingTrace {
        bayesian_network_node_id: binding.node.clone(),
        state_ids: states,
        parent_node_ids: parents,
    })
}

fn collect_ancestors(
    network: &BayesianGraph,
    node: NodeId,
    ancestors: &mut HashSet<NodeId>,
) -> Result<()> {
    let mut pending: VecDeque<NodeId> = network.parents(node)?.iter().copied().collect();
    while let Some(parent) = pending.pop_front() {
        if !ancestors.insert(parent) {
            continue;
        }
        pending.extend(network.parents(parent)?.iter().copied());
    }
    Ok(())
}

pub(crate) fn evaluate_cut_sets(
    templates: &[HclCutSetTemplate],
    quantifier: &mut HclQuantifier<'_>,
    target_probability: f64,
) -> Result<HclCutSetAnalysis> {
    let mut cut_sets: Vec<HclCutSet> = templates
        .iter()
        .map(|template| {
            let probability = quantifier.quantify_literals(&template.assignments)?;
            Ok(HclCutSet {
                rank: 0,
                order: template.literals.len(),
                probability,
                coverage: (target_probability > 0.0)
                    .then(|| (probability / target_probability).clamp(0.0, 1.0)),
                literals: template.literals.clone(),
                bn_ancestor_node_ids: template.bn_ancestor_node_ids.clone(),
                bn_root_cause_node_ids: template.bn_root_cause_node_ids.clone(),
            })
        })
        .collect::<Result<_>>()?;

    cut_sets.sort_by(|left, right| {
        right
            .probability
            .partial_cmp(&left.probability)
            .unwrap_or(Ordering::Equal)
            .then_with(|| left.order.cmp(&right.order))
            .then_with(|| {
                let left_key: Vec<_> = left
                    .literals
                    .iter()
                    .map(|literal| (&literal.basic_event_id, literal.complemented))
                    .collect();
                let right_key: Vec<_> = right
                    .literals
                    .iter()
                    .map(|literal| (&literal.basic_event_id, literal.complemented))
                    .collect();
                left_key.cmp(&right_key)
            })
    });
    for (index, cut_set) in cut_sets.iter_mut().enumerate() {
        cut_set.rank = index + 1;
    }

    Ok(HclCutSetAnalysis {
        total_count: cut_sets.len(),
        cut_sets,
    })
}
