use std::collections::HashMap;

use tensorbayes::{BayesianGraph, CompiledJunctionTree, NodeId};

use crate::hcl::{
    conditional_evidence_probabilities_for_network, resolve_evidence, HclBindingSpec,
    HclEvidenceSpec,
};
use crate::{PraxisError, Result};

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct OccurrenceBounds {
    pub(crate) events: HashMap<String, f64>,
    pub(crate) evidence_factor: f64,
}

impl OccurrenceBounds {
    pub(crate) fn structure_cut_off(&self, cut_off: f64) -> Option<f64> {
        let value = cut_off / self.evidence_factor;
        (value.is_finite() && value > 0.0).then_some(value)
    }
}

fn largest_table_share(
    network: &BayesianGraph,
    node: NodeId,
    observed: &[i32],
    states: &[bool],
) -> Result<f64> {
    let variable = network.variable(node)?;
    let cardinality = variable.cardinality();
    let parents = network.parents(node)?;
    let mut cardinalities = Vec::with_capacity(parents.len());
    for parent in parents {
        cardinalities.push(network.variable(*parent)?.cardinality());
    }
    let batch = network.cpt_batch_size(node)?;
    let configurations = network.family_size(node)? / cardinality;
    let table = variable.cpt();
    let mut largest: f64 = 0.0;
    for configuration in 0..configurations {
        let mut rest = configuration;
        let mut consistent = true;
        for (parent, &size) in parents.iter().zip(&cardinalities).rev() {
            let state = rest % size;
            rest /= size;
            let fixed = observed[parent.index()];
            if fixed >= 0 && fixed as usize != state {
                consistent = false;
                break;
            }
        }
        if !consistent {
            continue;
        }
        for sample in 0..batch {
            let mut share = 0.0;
            for (state, &wanted) in states.iter().enumerate() {
                if wanted {
                    share += table[(configuration * cardinality + state) * batch + sample];
                }
            }
            largest = largest.max(share);
        }
    }
    Ok(largest.min(1.0))
}

fn wanted_states(network: &BayesianGraph, spec: &HclBindingSpec) -> Result<(NodeId, Vec<bool>)> {
    let node = network.node_id(&spec.node)?;
    let names = network.variable(node)?.states();
    let mut wanted = vec![false; names.len()];
    for state in &spec.true_states {
        let position = names.iter().position(|name| name == state).ok_or_else(|| {
            PraxisError::Hcl(format!(
                "binding state '{state}' does not exist on BN node '{}'",
                spec.node
            ))
        })?;
        wanted[position] = true;
    }
    Ok((node, wanted))
}

pub(crate) fn occurrence_bounds(
    network: &BayesianGraph,
    tree: &CompiledJunctionTree,
    bindings: &[HclBindingSpec],
    evidence_rows: &[&[HclEvidenceSpec]],
) -> Result<OccurrenceBounds> {
    let mut events: HashMap<String, f64> = HashMap::with_capacity(bindings.len());
    let mut shared: HashMap<NodeId, i32> = HashMap::new();
    let mut resolved = Vec::with_capacity(bindings.len());
    for spec in bindings {
        let (node, wanted) = wanted_states(network, spec)?;
        *shared.entry(node).or_insert(0) += 1;
        resolved.push((spec.event.as_str(), node, wanted));
    }
    let owned: Vec<Vec<HclEvidenceSpec>> = evidence_rows.iter().map(|row| row.to_vec()).collect();
    let row_probabilities =
        conditional_evidence_probabilities_for_network(network, &[], tree, &owned)?;
    let mut evidence_factor: f64 = 1.0;
    for (row, probability) in evidence_rows.iter().zip(row_probabilities) {
        let evidence = resolve_evidence(network, row)?;
        let observed = evidence.states();
        let mut factor = 1.0 / probability;
        for (index, &state) in observed.iter().enumerate() {
            if state < 0 {
                continue;
            }
            let node = NodeId::new(index as u32);
            let mut only = vec![false; network.variable(node)?.cardinality()];
            only[state as usize] = true;
            factor *= largest_table_share(network, node, observed, &only)?;
        }
        evidence_factor = evidence_factor.max(factor);
        for (event, node, wanted) in &resolved {
            let fixed = observed[node.index()];
            let bound = if fixed >= 0 {
                if wanted[fixed as usize] {
                    1.0
                } else {
                    0.0
                }
            } else {
                largest_table_share(network, *node, observed, wanted)?
            };
            let entry = events.entry((*event).to_string()).or_insert(0.0);
            *entry = entry.max(bound);
        }
    }
    for (event, node, _) in &resolved {
        let count = shared[node];
        if count > 1 {
            if let Some(bound) = events.get_mut(*event) {
                *bound = bound.powf(1.0 / f64::from(count));
            }
        }
    }
    Ok(OccurrenceBounds {
        events,
        evidence_factor,
    })
}
