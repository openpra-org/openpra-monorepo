//! HCL_MH hazard_sweep.py::_joint_probability_for_assignment.
//! Queries use main's unchanged TensorBayes ExecutionEngine.

use std::collections::HashSet;
use tensorbayes::{BayesianGraph, CompiledJunctionTree, ExecutionEngine, NodeId, StateIndex};

use super::{HclBaseEvidence, HclEvidenceSpec, HclUncertaintySettings};
use crate::{PraxisError, Result};

/// HCL_MH hazard_convolution.py::ensure_hazard_convolution_supported.
/// Application UQ populations contain at least ten samples, so only point
/// requests pass this source guard through the supported settings schema.
pub fn ensure_hazard_convolution_supported(
    uncertainty: Option<&HclUncertaintySettings>,
) -> Result<()> {
    if uncertainty.is_some_and(|settings| settings.sample_count > 1) {
        return Err(PraxisError::Hcl(
            "Hazard convolution supports point runs only. Disable uncertainty or use evidence scenarios.".into(),
        ));
    }
    Ok(())
}

/// Convolves one sampled quantity over a hazard grid, sample by sample.
/// `sampled_weights` holds every grid row, `values` the evaluated rows only.
pub fn sampled_hazard_convolution(
    sampled_weights: &[Vec<f64>],
    scenario_indices: &[usize],
    values: &[&[f64]],
    normalize: bool,
) -> Result<Vec<f64>> {
    if scenario_indices.len() != values.len() {
        return Err(PraxisError::Hcl(
            "a sampled hazard convolution needs one sample vector for every evaluated row".into(),
        ));
    }
    let count = sampled_weights.first().map_or(0, Vec::len);
    if count == 0
        || sampled_weights.iter().any(|row| row.len() != count)
        || values.iter().any(|row| row.len() != count)
    {
        return Err(PraxisError::Hcl(
            "a sampled hazard convolution needs the same samples in every row".into(),
        ));
    }
    for (index, row) in sampled_weights.iter().enumerate() {
        if !scenario_indices.contains(&index) && row.iter().any(|weight| *weight > 0.0) {
            return Err(PraxisError::Hcl(format!(
                "hazard grid row {} has zero point weight but a positive sampled weight; give its hazard states a point probability above zero",
                index + 1
            )));
        }
    }
    let mut convolved = vec![0.0; count];
    for (&index, row) in scenario_indices.iter().zip(values) {
        let weights = sampled_weights
            .get(index)
            .ok_or_else(|| PraxisError::Hcl("a hazard grid row has no sampled weights".into()))?;
        for (sum, (weight, value)) in convolved.iter_mut().zip(weights.iter().zip(row.iter())) {
            *sum += weight * value;
        }
    }
    if normalize {
        for (sample, sum) in convolved.iter_mut().enumerate() {
            let total: f64 = sampled_weights.iter().map(|row| row[sample]).sum();
            *sum = if total > 0.0 { *sum / total } else { 0.0 };
        }
    }
    Ok(convolved)
}

pub(crate) fn resolve_evidence(
    network: &BayesianGraph,
    specs: &[HclEvidenceSpec],
) -> Result<HclBaseEvidence> {
    let mut result = HclBaseEvidence::unobserved(network.num_variables());
    let mut seen = HashSet::new();
    for spec in specs {
        let node = network.node_id(&spec.node)?;
        if !seen.insert(node) {
            return Err(PraxisError::Hcl(format!(
                "evidence observes BN node '{}' more than once",
                spec.node
            )));
        }
        let state = network
            .variable(node)?
            .states()
            .iter()
            .position(|s| s == &spec.state)
            .ok_or_else(|| {
                PraxisError::Hcl(format!(
                    "evidence state '{}' does not exist on BN node '{}'",
                    spec.state, spec.node
                ))
            })?;
        result.observe(node, StateIndex::new(state))?;
    }
    Ok(result)
}

// HCL_MH's pgmpy adapter delegates to networkx.topological_sort. Preserve
// generation order and insertion-order ties, including unselected ancestors.
pub(crate) fn topological_order(network: &BayesianGraph) -> Result<Vec<NodeId>> {
    let mut indegrees = network
        .variables()
        .iter()
        .map(|v| network.parents(v.id()).map(|p| p.len()))
        .collect::<tensorbayes::Result<Vec<_>>>()?;
    let mut generation: Vec<_> = network
        .variables()
        .iter()
        .filter(|v| indegrees[v.id().index()] == 0)
        .map(|v| v.id())
        .collect();
    let mut order = Vec::with_capacity(network.num_variables());
    while !generation.is_empty() {
        let mut next = Vec::new();
        for node in generation {
            for &child in network.children(node)? {
                indegrees[child.index()] -= 1;
                if indegrees[child.index()] == 0 {
                    next.push(child);
                }
            }
            order.push(node);
        }
        generation = next;
    }
    if order.len() != network.num_variables() {
        return Err(PraxisError::Hcl("hazard network contains a cycle".into()));
    }
    Ok(order)
}

pub(crate) fn conditional_evidence_probabilities_for_network(
    network: &BayesianGraph,
    base_evidence: &[HclEvidenceSpec],
    tree: &CompiledJunctionTree,
    assignment_rows: &[Vec<HclEvidenceSpec>],
) -> Result<Vec<f64>> {
    let base = resolve_evidence(network, base_evidence)?;
    let order = topological_order(network)?;
    let mut engine = ExecutionEngine::new(tree.clone());
    assignment_rows
        .iter()
        .map(|assignments| {
            let assigned = resolve_evidence(network, assignments)?;
            let mut evidence = base.clone();
            let mut weight = 1.0;
            for &node in &order {
                let target = assigned.states()[node.index()];
                if target < 0 {
                    continue;
                }
                let fixed = evidence.states()[node.index()];
                if fixed >= 0 {
                    if fixed != target {
                        return Ok(0.0);
                    }
                    continue;
                }
                let marginal = engine.evaluate(&evidence.to_batch()?, node)?;
                let term = marginal.values()[target as usize].clamp(0.0, 1.0);
                weight *= term;
                evidence.observe(node, StateIndex::new(target as usize))?;
                if weight <= 0.0 {
                    break;
                }
            }
            Ok(weight)
        })
        .collect()
}

/// Native grid metadata must describe the same states as the scenario sent to
/// the BDD. All scenario observations participate in the source weight query.
pub(crate) fn prepare_hazard_evidence(
    network: &BayesianGraph,
    base: &[HclEvidenceSpec],
    evidence_rows: &[Vec<HclEvidenceSpec>],
    hazard_rows: &[Vec<HclEvidenceSpec>],
) -> Result<Vec<Vec<HclEvidenceSpec>>> {
    if evidence_rows.len() != hazard_rows.len() || evidence_rows.is_empty() {
        return Err(PraxisError::Hcl(
            "hazard grid requires matching non-empty evidence rows".into(),
        ));
    }
    resolve_evidence(network, base)?;
    let mut dimensions = None;
    let mut cells = HashSet::new();
    evidence_rows
        .iter()
        .zip(hazard_rows)
        .map(|(scenario, hazards)| {
            resolve_evidence(network, scenario)?;
            resolve_evidence(network, hazards)?;
            let mut nodes: Vec<_> = hazards.iter().map(|s| s.node.as_str()).collect();
            nodes.sort();
            if nodes.is_empty() || dimensions.as_ref().is_some_and(|d| d != &nodes) {
                return Err(PraxisError::Hcl(
                    "hazard rows must define the same non-empty dimensions".into(),
                ));
            }
            dimensions.get_or_insert(nodes);
            let mut cell: Vec<_> = hazards.iter().map(|s| (&s.node, &s.state)).collect();
            cell.sort();
            if !cells.insert(cell) {
                return Err(PraxisError::Hcl("duplicate hazard grid cell".into()));
            }
            for hazard in hazards {
                if !scenario
                    .iter()
                    .any(|s| s.node == hazard.node && s.state == hazard.state)
                {
                    return Err(PraxisError::Hcl(
                        "hazard assignment must match scenario evidence".into(),
                    ));
                }
            }
            let mut merged = base.to_vec();
            for spec in scenario {
                if let Some(existing) = merged.iter_mut().find(|e| e.node == spec.node) {
                    *existing = spec.clone();
                } else {
                    merged.push(spec.clone());
                }
            }
            Ok(merged)
        })
        .collect()
}
