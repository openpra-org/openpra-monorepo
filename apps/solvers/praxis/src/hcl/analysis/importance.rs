use std::time::Duration;

use tensorbayes::{CompileHeuristic, CompiledJunctionTree};

use crate::algorithms::build::{build_bdd_with_order, BuildOptions};
use crate::algorithms::pdag::PdagNode;
use crate::hcl::importance::target_conditionals;
use crate::hcl::{
    conditional_evidence_probabilities_for_network, prepare_hazard_evidence, resolve_evidence,
    source_fault_tree_order, HclAnalysisSettings, HclEventBinding, HclEventBindings,
    HclEvidenceSpec, HclModel, HclQuantifier, PreparedHclUncertainty, SampledConditional,
    SampledTarget, TargetConditionals,
};
use crate::{PraxisError, Result};

use super::resolve_states;

#[derive(Clone, Debug, PartialEq)]
pub struct HclImportance {
    pub scenarios: Vec<TargetConditionals>,
    pub scenario_indices: Vec<usize>,
    pub raw_weights: Option<Vec<f64>>,
    pub weighted: Option<TargetConditionals>,
}

pub fn hcl_importance(model: &HclModel, settings: &HclAnalysisSettings) -> Result<HclImportance> {
    let rows = [model.base_evidence().to_vec()];
    hcl_importance_batch(model, &rows, None, settings)
}

pub fn hcl_importance_batch(
    model: &HclModel,
    evidence_rows: &[Vec<HclEvidenceSpec>],
    hazard_assignment_rows: Option<&[Vec<HclEvidenceSpec>]>,
    settings: &HclAnalysisSettings,
) -> Result<HclImportance> {
    if evidence_rows.is_empty() {
        return Err(PraxisError::Hcl(
            "a dependency importance run requires at least one evidence row".to_string(),
        ));
    }
    if hazard_assignment_rows.is_some_and(|rows| rows.len() != evidence_rows.len()) {
        return Err(PraxisError::Hcl(
            "a hazard grid requires one hazard assignment for every evidence row".to_string(),
        ));
    }
    let network = model.network();
    network.validate()?;
    let tree = CompiledJunctionTree::compile(network.clone(), CompileHeuristic::MinFill)?;
    let hazard_evidence = hazard_assignment_rows
        .map(|rows| prepare_hazard_evidence(network, model.base_evidence(), evidence_rows, rows))
        .transpose()?;
    let evidence_rows = hazard_evidence.as_deref().unwrap_or(evidence_rows);
    let raw_weights = hazard_assignment_rows
        .map(|_| {
            conditional_evidence_probabilities_for_network(
                network,
                model.base_evidence(),
                &tree,
                evidence_rows,
            )
        })
        .transpose()?;
    let scenario_indices: Vec<usize> = (0..evidence_rows.len())
        .filter(|&index| {
            raw_weights
                .as_ref()
                .is_none_or(|weights| weights[index] > 0.0)
        })
        .collect();
    if scenario_indices.is_empty() {
        return Ok(HclImportance {
            scenarios: Vec::new(),
            scenario_indices,
            raw_weights,
            weighted: None,
        });
    }
    let build_options = BuildOptions {
        fold_constants: settings.fold_constants,
        splice_null_gates: settings.splice_null_gates,
        reorder: None,
        reorder_budget: Duration::from_secs(10),
    };
    let variable_order = match &settings.variable_order {
        Some(order) => order.clone(),
        None => source_fault_tree_order(model)?,
    };
    let built = build_bdd_with_order(model.fault_tree(), build_options, &variable_order)?;
    let mut inside = Vec::with_capacity(built.bdd.variable_count());
    for variable in 0..built.bdd.variable_count() {
        if let Some(PdagNode::BasicEvent { id, .. }) = built
            .order
            .get(variable)
            .and_then(|index| built.pdag.get_node(*index))
        {
            inside.push((id.clone(), variable));
        }
    }
    let mut bindings = HclEventBindings::new();
    for spec in model.bindings() {
        let node = network.node_id(&spec.node)?;
        let states = resolve_states(
            network.variable(node)?.states(),
            &spec.true_states,
            &spec.node,
        )?;
        bindings.insert(HclEventBinding::for_event(
            &built,
            &spec.event,
            node,
            states,
        )?)?;
    }
    let first = resolve_evidence(network, &evidence_rows[scenario_indices[0]])?;
    let mut quantifier = HclQuantifier::new(&built.bdd, tree, bindings, first)?;
    let mut scenarios = Vec::with_capacity(scenario_indices.len());
    for (position, &scenario) in scenario_indices.iter().enumerate() {
        if position > 0 {
            quantifier.set_base_evidence(resolve_evidence(network, &evidence_rows[scenario])?)?;
        }
        scenarios.push(target_conditionals(
            &mut quantifier,
            built.root,
            &inside,
            &[],
        )?);
    }
    let weighted = raw_weights.as_ref().and_then(|weights| {
        let parts: Vec<(f64, &TargetConditionals)> = scenario_indices
            .iter()
            .zip(&scenarios)
            .map(|(&scenario, part)| (weights[scenario], part))
            .collect();
        TargetConditionals::mix(&parts)
    });
    Ok(HclImportance {
        scenarios,
        scenario_indices,
        raw_weights,
        weighted,
    })
}

#[derive(Clone, Debug, PartialEq)]
pub struct SampledScenarioImportance {
    pub point: TargetConditionals,
    pub leading: Vec<String>,
    pub sampled: SampledTarget,
}

#[derive(Clone, Debug, PartialEq)]
pub struct HclSampledImportance {
    pub scenarios: Vec<SampledScenarioImportance>,
    pub scenario_indices: Vec<usize>,
}

pub fn hcl_sampled_importance_batch(
    model: &HclModel,
    evidence_rows: &[Vec<HclEvidenceSpec>],
    settings: &HclAnalysisSettings,
    keep: usize,
) -> Result<HclSampledImportance> {
    let uncertainty = settings.uncertainty.as_ref().ok_or_else(|| {
        PraxisError::Hcl("sampled importance needs uncertainty settings".to_string())
    })?;
    if keep == 0 {
        return Err(PraxisError::Settings(
            "the number of events sampled for importance must be at least 1".to_string(),
        ));
    }
    let point = hcl_importance_batch(model, evidence_rows, None, settings)?;
    let network = model.network();
    let build_options = BuildOptions {
        fold_constants: settings.fold_constants,
        splice_null_gates: settings.splice_null_gates,
        reorder: None,
        reorder_budget: Duration::from_secs(10),
    };
    let variable_order = match &settings.variable_order {
        Some(order) => order.clone(),
        None => source_fault_tree_order(model)?,
    };
    let built = build_bdd_with_order(model.fault_tree(), build_options, &variable_order)?;
    let event_by_variable: Vec<Option<String>> = (0..built.bdd.variable_count())
        .map(|variable| {
            built
                .order
                .get(variable)
                .and_then(|index| match built.pdag.get_node(*index) {
                    Some(PdagNode::BasicEvent { id, .. }) => Some(id.clone()),
                    _ => None,
                })
        })
        .collect();
    let mut bindings = HclEventBindings::new();
    for spec in model.bindings() {
        let node = network.node_id(&spec.node)?;
        let states = resolve_states(
            network.variable(node)?.states(),
            &spec.true_states,
            &spec.node,
        )?;
        bindings.insert(HclEventBinding::for_event(
            &built,
            &spec.event,
            node,
            states,
        )?)?;
    }
    let prepared = PreparedHclUncertainty::new(network, uncertainty, &[model.fault_tree()])?;
    let mut scenarios = Vec::with_capacity(point.scenarios.len());
    for (conditionals, &scenario) in point.scenarios.into_iter().zip(&point.scenario_indices) {
        let leading = conditionals.leading(keep);
        let mut inside = Vec::with_capacity(leading.len());
        for name in &leading {
            let variable = event_by_variable
                .iter()
                .position(|event| event.as_deref() == Some(name.as_str()))
                .ok_or_else(|| {
                    PraxisError::Logic(format!("importance event '{name}' has no BDD variable"))
                })?;
            inside.push(variable);
        }
        let samples = prepared.conditionals(
            &built.bdd,
            built.root,
            bindings.clone(),
            resolve_evidence(network, &evidence_rows[scenario])?,
            &event_by_variable,
            &inside,
            &[],
        )?;
        let events = leading
            .iter()
            .zip(&inside)
            .zip(samples.inside)
            .map(|((name, &variable), values)| SampledConditional {
                event: name.clone(),
                bound: bindings.get(variable).is_some(),
                in_target: true,
                probability: values.probability,
                occurred: values.occurred,
                not_occurred: values.not_occurred,
            })
            .collect();
        scenarios.push(SampledScenarioImportance {
            point: conditionals,
            leading,
            sampled: SampledTarget {
                total: samples.total,
                events,
            },
        });
    }
    Ok(HclSampledImportance {
        scenarios,
        scenario_indices: point.scenario_indices,
    })
}
