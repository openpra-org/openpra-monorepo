use crate::openpra_mef::contracts::{
    Diagnostic, EngineInputs, EngineOutputs, OpenPraJsonBundle, ResolveMode, Severity,
};
use crate::openpra_mef::json_model::data_analysis::{
    ConsistencyCheck, DataAnalysisJsonModel, DataParameter, ExternalDataSource, IdGroup, IdRef,
};
use crate::openpra_mef::json_model::event_sequence_analysis::{
    EventSequence, EventSequenceAnalysisJsonModel, EventSequenceFamily, FunctionalEventBinding,
    ReleaseCategoryMapping, ScopeDefinition,
};
use crate::openpra_mef::json_model::event_sequence_quantification::{
    EventSequenceQuantificationJsonModel, QuantificationFamily, QuantificationMethod,
    QuantificationResult,
};
use crate::openpra_mef::json_model::initiating_event_analysis::{
    InitiatingEventAnalysisJsonModel, Initiator, InitiatorGroup,
};
use crate::openpra_mef::json_model::risk_integration::{
    NamedValue, RiskIntegrationJsonModel, RiskMapping,
};
use crate::openpra_mef::json_model::systems_analysis::{
    CcfGroup, SystemDefinition, SystemDependency, SystemLogicModel, SystemsAnalysisJsonModel,
};
use crate::openpra_mef::json_model::{OpenPraJsonModel, TechnicalElements};
use crate::openpra_mef::resolve::resolve_model_refs;
use crate::openpra_mef::serialize::json_out::to_json;
use crate::openpra_mef::serialize::praxis_event_tree_graph::deserialize_event_tree_library;
use crate::openpra_mef::validate::schema::{parse_json_value, validate_schema};
use crate::openpra_mef::validate::semantic::validate_semantic;
use crate::{
    core::event::{BasicEvent, HouseEvent},
    core::event_tree::{Branch, BranchTarget, EventTree as PraxisEventTree, Fork, FunctionalEvent, InitiatingEvent, Path, Sequence},
    core::fault_tree::FaultTree,
    core::gate::{Formula, Gate},
    core::model::Model,
};
use crate::{PraxisError, Result};
use serde_json::{Map, Value};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone)]
struct PathSignatureStep {
    functional_event_id: String,
    state: String,
    path_probability: Option<f64>,
    collect_formula_negated: Option<bool>,
    house_event_assignments: HashMap<String, bool>,
}

#[derive(Debug, Clone)]
struct SequencePathSignature {
    sequence_id: String,
    steps: Vec<PathSignatureStep>,
}

type PraxisEngineObjects = (
    Model,
    Vec<InitiatingEvent>,
    Vec<PraxisEventTree>,
    HashMap<String, PraxisEventTree>,
);

pub fn parse_openpra_json(input: &str) -> Result<OpenPraJsonBundle> {
    let mut diagnostics = validate_openpra_json(input)?;

    let has_errors = diagnostics.iter().any(|d| d.severity == Severity::Error);
    if has_errors {
        return Ok(OpenPraJsonBundle {
            model_id: None,
            model: None,
            raw_json: None,
            placeholders: Vec::new(),
            diagnostics,
        });
    }

    let value = parse_json_value(input).map_err(|err| {
        PraxisError::Settings(format!("Failed to parse validated OpenPRA JSON input: {err}"))
    })?;

    let model = map_to_model(&value, &mut diagnostics)?;
    diagnostics.extend(validate_semantic(&model));

    let model_id = model.id.clone();

    Ok(OpenPraJsonBundle {
        model_id,
        model: Some(model),
        raw_json: Some(value),
        placeholders: Vec::new(),
        diagnostics,
    })
}

pub fn validate_openpra_json(input: &str) -> Result<Vec<Diagnostic>> {
    Ok(validate_schema(input))
}

pub fn resolve_openpra_refs(
    bundle: &mut OpenPraJsonBundle,
    mode: ResolveMode,
) -> Result<Vec<Diagnostic>> {
    let mut diagnostics = std::mem::take(&mut bundle.diagnostics);
    if let Some(model) = &bundle.model {
        let (_registry, placeholders, resolve_diags) = resolve_model_refs(model, mode);
        bundle.placeholders = placeholders;
        diagnostics.extend(resolve_diags);
    }
    bundle.diagnostics = diagnostics.clone();
    Ok(diagnostics)
}

pub fn to_engine_inputs(bundle: &OpenPraJsonBundle) -> Result<EngineInputs> {
    let (
        praxis_model,
        praxis_initiating_events,
        praxis_event_trees,
        praxis_event_tree_library,
    ) = if let Some(model) = &bundle.model {
        let (m, ies, ets, lib) = build_praxis_engine_objects(model, bundle.model_id.as_deref())?;
        (Some(m), ies, ets, lib)
    } else {
        (None, Vec::new(), Vec::new(), HashMap::new())
    };

    Ok(EngineInputs {
        model_id: bundle.model_id.clone(),
        model: bundle.model.clone(),
        placeholders: bundle.placeholders.clone(),
        praxis_model,
        praxis_initiating_events,
        praxis_event_trees,
        praxis_event_tree_library,
    })
}

pub fn from_engine_outputs(
    engine: &EngineOutputs,
    bundle: &OpenPraJsonBundle,
) -> Result<String> {
    to_json(engine, bundle, ResolveMode::Compatible)
}

fn build_praxis_engine_objects(
    model: &OpenPraJsonModel,
    model_id_hint: Option<&str>,
) -> Result<PraxisEngineObjects> {
    let model_id = model
        .id
        .as_deref()
        .or(model_id_hint)
        .unwrap_or("openpra-json-model");

    let mut praxis_model = Model::new(model_id)?;
    let mut data_parameter_probability: HashMap<String, f64> = HashMap::new();

    if let Some(da) = &model.technical_elements.data_analysis {
        for parameter in &da.data_parameters {
            if parameter.id.is_empty() {
                continue;
            }
            let probability = parameter.probability.unwrap_or(0.0);
            if praxis_model.get_basic_event(&parameter.id).is_none() {
                let basic_event = BasicEvent::new(parameter.id.clone(), probability)?;
                praxis_model.add_basic_event(basic_event)?;
            }
            data_parameter_probability.insert(parameter.id.clone(), probability);
        }
    }

    let mut system_to_fault_tree: HashMap<String, String> = HashMap::new();

    if let Some(sa) = &model.technical_elements.systems_analysis {
        for definition in &sa.system_definitions {
            if let Some(ft_id) = &definition.fault_tree_id {
                system_to_fault_tree.insert(definition.id.clone(), ft_id.clone());
            }
        }

        for logic_model in &sa.system_logic_models {
            let fault_tree_id = logic_model.id.clone();
            if fault_tree_id.is_empty() || praxis_model.get_fault_tree(&fault_tree_id).is_some() {
                continue;
            }

            let top_gate_id = logic_model
                .root_ref
                .clone()
                .unwrap_or_else(|| format!("{fault_tree_id}__TOP"));

            let mut fault_tree = FaultTree::new(fault_tree_id.clone(), top_gate_id.clone())?;
            let mut loaded_gate_catalog = false;
            if let Some(Value::Array(gate_rows)) = logic_model.additional_fields.get("gateCatalog") {
                for gate_row in gate_rows {
                    let Some(gate_obj) = gate_row.as_object() else {
                        continue;
                    };

                    let Some(gate_id) = gate_obj.get("id").and_then(Value::as_str) else {
                        continue;
                    };
                    if gate_id.is_empty() || fault_tree.get_gate(gate_id).is_some() {
                        continue;
                    }

                    let mut gate = Gate::new(
                        gate_id.to_string(),
                        formula_from_model_type(gate_obj.get("formula").and_then(Value::as_str)),
                    )?;

                    if let Some(operands) = gate_obj.get("operands").and_then(Value::as_array) {
                        for operand in operands {
                            if let Some(operand_id) = operand.as_str() {
                                if operand_id == gate_id {
                                    continue;
                                }
                                gate.add_operand(operand_id.to_string());
                            }
                        }
                    }

                    fault_tree.add_gate(gate)?;
                    loaded_gate_catalog = true;
                }
            }

            if !loaded_gate_catalog || fault_tree.get_gate(&top_gate_id).is_none() {
                let formula = formula_from_model_type(logic_model.model_type.as_deref());
                let mut top_gate = Gate::new(top_gate_id.clone(), formula)?;

                let mut operands: Vec<String> = Vec::new();
                operands.extend(logic_model.gate_refs.iter().cloned());
                operands.extend(logic_model.basic_event_refs.iter().cloned());

                if operands.is_empty() {
                    operands.extend(data_parameter_probability.keys().cloned());
                }

                for operand in &operands {
                    if operand == &top_gate_id {
                        continue;
                    }
                    top_gate.add_operand(operand.clone());
                }

                if fault_tree.get_gate(&top_gate_id).is_none() {
                    fault_tree.add_gate(top_gate)?;
                }
            }

            let mut house_event_states: HashMap<String, bool> = HashMap::new();
            if let Some(Value::Array(house_event_rows)) =
                logic_model.additional_fields.get("houseEventCatalog")
            {
                for house_event_row in house_event_rows {
                    let Some(house_event_obj) = house_event_row.as_object() else {
                        continue;
                    };
                    let Some(house_event_id) =
                        house_event_obj.get("id").and_then(Value::as_str)
                    else {
                        continue;
                    };
                    let state = house_event_obj
                        .get("state")
                        .and_then(Value::as_bool)
                        .unwrap_or(false);
                    house_event_states.insert(house_event_id.to_string(), state);
                }
            }

            if let Some(Value::Array(house_event_refs)) =
                logic_model.additional_fields.get("houseEventRefs")
            {
                for house_event_ref in house_event_refs {
                    if let Some(house_event_id) = house_event_ref.as_str() {
                        house_event_states
                            .entry(house_event_id.to_string())
                            .or_insert(false);
                    }
                }
            }

            for (house_event_id, state) in &house_event_states {
                if fault_tree.house_events().contains_key(house_event_id) {
                    continue;
                }
                let house_event = HouseEvent::new(house_event_id.clone(), *state)?;
                fault_tree.add_house_event(house_event)?;
            }

            let gate_ids: HashSet<String> = fault_tree.gates().keys().cloned().collect();
            let house_event_ids: HashSet<String> =
                fault_tree.house_events().keys().cloned().collect();
            let mut referenced_basic_event_ids: Vec<String> = logic_model.basic_event_refs.clone();
            for gate in fault_tree.gates().values() {
                for operand in gate.operands() {
                    if !gate_ids.contains(operand)
                        && !house_event_ids.contains(operand)
                        && !operand.contains('.')
                    {
                        referenced_basic_event_ids.push(operand.clone());
                    }
                }
            }
            referenced_basic_event_ids.sort();
            referenced_basic_event_ids.dedup();

            for basic_event_id in &referenced_basic_event_ids {
                if fault_tree.get_basic_event(basic_event_id).is_none() {
                    let p = *data_parameter_probability.get(basic_event_id).unwrap_or(&0.0);
                    let basic_event = BasicEvent::new(basic_event_id.clone(), p)?;
                    fault_tree.add_basic_event(basic_event)?;
                }
            }

            praxis_model.add_fault_tree(fault_tree)?;
        }
    }

    let mut initiating_events = Vec::new();
    let mut event_tree_library: HashMap<String, PraxisEventTree> = HashMap::new();

    if let Some(esa) = &model.technical_elements.event_sequence_analysis {
        if let Some(encoded) = esa.additional_fields.get("praxisEventTreeLibrary") {
            event_tree_library = deserialize_event_tree_library(encoded)?;
        }
    }

    if let Some(iea) = &model.technical_elements.initiating_event_analysis {
        let esa = model.technical_elements.event_sequence_analysis.as_ref();
        let esa_id = esa
            .and_then(|x| x.id.as_deref())
            .unwrap_or("event-sequence-analysis");

        for initiator in &iea.initiators {
            if initiator.id.is_empty() {
                continue;
            }

            let event_tree_id = initiator
                .additional_fields
                .get("sourceEventTreeId")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
                .unwrap_or_else(|| format!("{esa_id}::{}", initiator.id));
            let mut ie = InitiatingEvent::new(initiator.id.clone())
                .with_event_tree(event_tree_id.clone());

            if let Some(name) = &initiator.name {
                ie = ie.with_name(name.clone());
            }
            if let Some(probability) = initiator.probability {
                ie = ie.with_probability(probability);
            }
            if let Some(frequency) = initiator.frequency {
                ie = ie.with_frequency(frequency);
            }
            if let Some(system_ref) = initiator.system_refs.first() {
                let ft_id = system_to_fault_tree
                    .get(system_ref)
                    .cloned()
                    .unwrap_or_else(|| system_ref.clone());
                ie = ie.with_fault_tree(ft_id);
            }

            let mut sequences_for_ie: Vec<crate::openpra_mef::json_model::event_sequence_analysis::EventSequence> =
                Vec::new();
            if let Some(esa_model) = esa {
                for sequence in &esa_model.event_sequences {
                    if sequence.initiating_event_id.as_deref() == Some(&initiator.id) {
                        sequences_for_ie.push(sequence.clone());
                    }
                }
                if sequences_for_ie.is_empty() {
                    sequences_for_ie.extend(esa_model.event_sequences.clone());
                }
            }

            let sequence_groups = group_sequences_by_source_event_tree(&event_tree_id, &sequences_for_ie);
            for (group_event_tree_id, group_sequences) in sequence_groups {
                if !event_tree_library.contains_key(&group_event_tree_id) {
                    let praxis_event_tree =
                        build_event_tree_for_initiator(&group_event_tree_id, &group_sequences)?;
                    praxis_event_tree.validate()?;
                    event_tree_library.insert(group_event_tree_id, praxis_event_tree);
                }
            }
            initiating_events.push(ie);
        }
    }

    let mut event_trees: Vec<PraxisEventTree> = event_tree_library.values().cloned().collect();
    event_trees.sort_by(|a, b| a.id.cmp(&b.id));

    Ok((
        praxis_model,
        initiating_events,
        event_trees,
        event_tree_library,
    ))
}

fn group_sequences_by_source_event_tree(
    default_event_tree_id: &str,
    sequences: &[crate::openpra_mef::json_model::event_sequence_analysis::EventSequence],
) -> Vec<(String, Vec<crate::openpra_mef::json_model::event_sequence_analysis::EventSequence>)> {
    let mut grouped: HashMap<String, Vec<crate::openpra_mef::json_model::event_sequence_analysis::EventSequence>> =
        HashMap::new();

    for sequence in sequences {
        let source_event_tree_id = sequence
            .additional_fields
            .get("sourceEventTreeId")
            .and_then(Value::as_str)
            .unwrap_or(default_event_tree_id)
            .to_string();

        grouped
            .entry(source_event_tree_id)
            .or_default()
            .push(sequence.clone());
    }

    let mut out: Vec<(String, Vec<crate::openpra_mef::json_model::event_sequence_analysis::EventSequence>)> =
        grouped.into_iter().collect();
    out.sort_by(|a, b| a.0.cmp(&b.0));
    out
}

fn formula_from_model_type(model_type: Option<&str>) -> Formula {
    match model_type
        .unwrap_or("or")
        .to_ascii_lowercase()
        .replace('_', "-")
        .as_str()
    {
        "and" => Formula::And,
        "or" => Formula::Or,
        "not" => Formula::Not,
        "xor" => Formula::Xor,
        "nand" => Formula::Nand,
        "nor" => Formula::Nor,
        "iff" => Formula::Iff,
        value if value.starts_with("atleast") || value.starts_with("at-least") => {
            let min = value
                .split(['-', ':'])
                .find_map(|part| part.parse::<usize>().ok())
                .unwrap_or(1);
            Formula::AtLeast { min }
        }
        _ => Formula::Or,
    }
}

fn canonicalize_path_state_for_mc(raw_state: &str) -> String {
    let normalized = raw_state.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "s" | "succ" | "success" | "yes" | "true" | "1" => "success".to_string(),
        "f" | "fail" | "failure" | "no" | "false" | "0" => "failure".to_string(),
        "b" | "bypass" => "bypass".to_string(),
        _ => raw_state.to_string(),
    }
}

fn scoped_functional_event_id(functional_event_tree_id: Option<&str>, functional_event_id: &str) -> String {
    let Some(tree_id) = functional_event_tree_id.filter(|value| !value.is_empty()) else {
        return functional_event_id.to_string();
    };

    if functional_event_id.starts_with(&format!("{tree_id}::")) {
        functional_event_id.to_string()
    } else {
        format!("{tree_id}::{functional_event_id}")
    }
}

fn build_event_tree_for_initiator(
    event_tree_id: &str,
    sequences_for_ie: &[crate::openpra_mef::json_model::event_sequence_analysis::EventSequence],
) -> Result<PraxisEventTree> {
    let mut sequence_ids: Vec<String> = sequences_for_ie
        .iter()
        .map(|sequence| sequence.id.clone())
        .filter(|id| !id.is_empty())
        .collect();

    if sequence_ids.is_empty() {
        sequence_ids.push(format!("{event_tree_id}::default-sequence"));
    }

    let mut fe_props: HashMap<String, (Option<String>, Option<f64>)> = HashMap::new();
    for sequence in sequences_for_ie {
        for binding in &sequence.functional_event_bindings {
            let raw_fe_id = binding
                .functional_event_id
                .clone()
                .unwrap_or_else(|| binding.id.clone());
            let fe_tree_id = binding
                .additional_fields
                .get("functionalEventTreeId")
                .and_then(Value::as_str)
                .or_else(|| {
                    sequence
                        .additional_fields
                        .get("sourceEventTreeId")
                        .and_then(Value::as_str)
                });
            let fe_id = scoped_functional_event_id(fe_tree_id, &raw_fe_id);
            if fe_id.is_empty() {
                continue;
            }
            let entry = fe_props.entry(fe_id).or_insert((None, None));
            if entry.0.is_none() {
                entry.0 = binding.fault_tree_id.clone();
            }
            if entry.1.is_none() {
                entry.1 = binding.success_probability;
            }
        }
    }

    let mut fe_ids: Vec<String> = fe_props.keys().cloned().collect();
    fe_ids.sort();

    let required_depth = required_binary_depth(sequence_ids.len());
    while fe_ids.len() < required_depth {
        let synthetic_id = format!("{event_tree_id}::__openpra_auto_fe_{}", fe_ids.len() + 1);
        fe_props.entry(synthetic_id.clone()).or_insert((None, None));
        fe_ids.push(synthetic_id);
    }

    let signatures = extract_path_signatures(sequences_for_ie);
    let initial_state = if let Some(branch) = build_branch_tree_from_signatures(&signatures, 0)? {
        branch
    } else {
        build_branch_tree(&fe_ids, &sequence_ids, 0)?
    };
    let mut event_tree = PraxisEventTree::new(event_tree_id.to_string(), initial_state);

    for sequence_id in &sequence_ids {
        if event_tree.sequences.contains_key(sequence_id) {
            continue;
        }

        let mut seq = Sequence::new(sequence_id.clone());
        if let Some(source) = sequences_for_ie.iter().find(|x| x.id == *sequence_id) {
            if let Some(name) = &source.name {
                seq = seq.with_name(name.clone());
            }
            if let Some(linked) = source.linked_sequence_ids.first() {
                seq = seq.with_linked_event_tree(linked.clone());
            }
        }

        event_tree.add_sequence(seq)?;
    }

    for fe_id in fe_ids {
        let (fault_tree_id, success_probability) = fe_props.remove(&fe_id).unwrap_or((None, None));
        let mut fe = FunctionalEvent::new(fe_id);
        if let Some(ft_id) = fault_tree_id {
            fe = fe.with_fault_tree(ft_id);
        }
        if let Some(p) = success_probability {
            fe = fe.with_success_probability(p);
        }
        event_tree.add_functional_event(fe)?;
    }

    Ok(event_tree)
}

fn extract_path_signatures(
    sequences_for_ie: &[crate::openpra_mef::json_model::event_sequence_analysis::EventSequence],
) -> Vec<SequencePathSignature> {
    let mut out = Vec::new();

    for sequence in sequences_for_ie {
        if sequence.id.is_empty() {
            continue;
        }

        let Some(signature_value) = sequence.additional_fields.get("pathSignature") else {
            continue;
        };

        let Some(signature_array) = signature_value.as_array() else {
            continue;
        };

        let mut steps = Vec::new();
        for entry in signature_array {
            let Some(obj) = entry.as_object() else {
                continue;
            };

            let Some(functional_event_id_raw) = obj
                .get("functionalEventId")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
            else {
                continue;
            };

            let functional_event_tree_id = obj
                .get("functionalEventTreeId")
                .and_then(Value::as_str)
                .or_else(|| {
                    sequence
                        .additional_fields
                        .get("sourceEventTreeId")
                        .and_then(Value::as_str)
                });
            let functional_event_id = scoped_functional_event_id(
                functional_event_tree_id,
                &functional_event_id_raw,
            );

            let Some(state) = obj
                .get("state")
                .and_then(Value::as_str)
                .map(canonicalize_path_state_for_mc)
            else {
                continue;
            };

            let collect_formula_negated = obj
                .get("collectFormulaNegated")
                .and_then(Value::as_bool);

            let path_probability = obj
                .get("pathProbability")
                .and_then(Value::as_f64);

            let mut house_event_assignments: HashMap<String, bool> = HashMap::new();
            if let Some(assignments_obj) = obj
                .get("houseEventAssignments")
                .and_then(Value::as_object)
            {
                for (house_event_id, state_value) in assignments_obj {
                    if let Some(state) = state_value.as_bool() {
                        house_event_assignments.insert(house_event_id.clone(), state);
                    }
                }
            }

            steps.push(PathSignatureStep {
                functional_event_id,
                state,
                path_probability,
                collect_formula_negated,
                house_event_assignments,
            });
        }

        if !steps.is_empty() {
            out.push(SequencePathSignature {
                sequence_id: sequence.id.clone(),
                steps,
            });
        }
    }

    out
}

fn approx_opt_f64_eq(a: Option<f64>, b: Option<f64>) -> bool {
    match (a, b) {
        (None, None) => true,
        (Some(_), None) | (None, Some(_)) => false,
        (Some(left), Some(right)) => (left - right).abs() <= 1e-12,
    }
}

fn build_branch_tree_from_signatures(
    signatures: &[SequencePathSignature],
    depth: usize,
) -> Result<Option<Branch>> {
    if signatures.is_empty() {
        return Ok(None);
    }

    if signatures.iter().all(|sig| sig.steps.len() <= depth) {
        return Ok(Some(Branch::new(BranchTarget::Sequence(
            signatures[0].sequence_id.clone(),
        ))));
    }

    let mut fe_id_at_depth: Option<&str> = None;
    for sig in signatures {
        let Some(step) = sig.steps.get(depth) else {
            return Ok(None);
        };
        match fe_id_at_depth {
            None => fe_id_at_depth = Some(step.functional_event_id.as_str()),
            Some(existing) if existing == step.functional_event_id => {}
            Some(_) => return Ok(None),
        }
    }

    let fe_id = fe_id_at_depth.unwrap_or_default();
    if fe_id.is_empty() {
        return Ok(None);
    }

    let mut groups: HashMap<String, Vec<SequencePathSignature>> = HashMap::new();
    let mut branch_house_assignments: Option<HashMap<String, bool>> = None;

    for sig in signatures {
        let step = &sig.steps[depth];
        groups
            .entry(step.state.clone())
            .or_default()
            .push(sig.clone());

        if let Some(existing) = &mut branch_house_assignments {
            existing.retain(|house_event_id, state| {
                step.house_event_assignments
                    .get(house_event_id)
                    .map(|other_state| other_state == state)
                    .unwrap_or(false)
            });
        } else {
            branch_house_assignments = Some(step.house_event_assignments.clone());
        }
    }

    if groups.is_empty() {
        return Ok(None);
    }

    let mut state_keys: Vec<String> = groups.keys().cloned().collect();
    state_keys.sort();

    let mut paths = Vec::new();
    for state in state_keys {
        let group = groups.get(&state).cloned().unwrap_or_default();
        let mut child = build_branch_tree_from_signatures(&group, depth + 1)?
            .unwrap_or_else(|| Branch::new(BranchTarget::Sequence(group[0].sequence_id.clone())));

        let mut child_house_assignments: Option<HashMap<String, bool>> = None;
        for sig in &group {
            let step = &sig.steps[depth];
            if let Some(existing) = &mut child_house_assignments {
                existing.retain(|house_event_id, state| {
                    step.house_event_assignments
                        .get(house_event_id)
                        .map(|other_state| other_state == state)
                        .unwrap_or(false)
                });
            } else {
                child_house_assignments = Some(step.house_event_assignments.clone());
            }
        }

        if let Some(assignments) = child_house_assignments {
            for (house_event_id, assignment) in assignments {
                child = child.with_house_event_assignment(house_event_id, assignment);
            }
        }

        let mut consensus_negated = group[0].steps[depth].collect_formula_negated;
        for sig in &group[1..] {
            let value = sig.steps[depth].collect_formula_negated;
            if value != consensus_negated {
                consensus_negated = None;
                break;
            }
        }

        let mut consensus_path_probability = group[0].steps[depth].path_probability;
        for sig in &group[1..] {
            let value = sig.steps[depth].path_probability;
            if !approx_opt_f64_eq(value, consensus_path_probability) {
                consensus_path_probability = None;
                break;
            }
        }

        let mut path = Path::new(state.clone(), child)?;
        if let Some(negated) = consensus_negated {
            path = path.with_collect_formula_negated(negated);
        }
        if let Some(p) = consensus_path_probability {
            path = path.with_probability(p);
        }
        paths.push(path);
    }

    let fork = Fork::new(fe_id.to_string(), paths)?;
    let mut branch = Branch::new(BranchTarget::Fork(fork));
    if let Some(assignments) = branch_house_assignments {
        for (house_event_id, assignment) in assignments {
            branch = branch.with_house_event_assignment(house_event_id, assignment);
        }
    }
    Ok(Some(branch))
}

fn build_branch_tree(
    fe_ids: &[String],
    sequence_ids: &[String],
    depth: usize,
) -> Result<Branch> {
    if sequence_ids.is_empty() {
        return Err(PraxisError::Settings(
            "Cannot build event tree branch with zero sequences".to_string(),
        ));
    }

    if sequence_ids.len() == 1 || depth >= fe_ids.len() {
        return Ok(Branch::new(BranchTarget::Sequence(sequence_ids[0].clone())));
    }

    let split = sequence_ids.len().div_ceil(2);
    let success_branch = build_branch_tree(fe_ids, &sequence_ids[..split], depth + 1)?;
    let failure_branch = build_branch_tree(fe_ids, &sequence_ids[split..], depth + 1)?;

    let success_path = Path::new("success".to_string(), success_branch)?;
    let failure_path = Path::new("failure".to_string(), failure_branch)?;
    let fork = Fork::new(fe_ids[depth].clone(), vec![success_path, failure_path])?;
    Ok(Branch::new(BranchTarget::Fork(fork)))
}

fn required_binary_depth(sequence_count: usize) -> usize {
    if sequence_count <= 1 {
        return 0;
    }

    let mut depth = 0usize;
    let mut leaves = 1usize;
    while leaves < sequence_count {
        leaves *= 2;
        depth += 1;
    }
    depth
}

fn map_to_model(value: &Value, diagnostics: &mut Vec<Diagnostic>) -> Result<OpenPraJsonModel> {
    let root = value
        .as_object()
        .ok_or_else(|| PraxisError::Settings("OpenPRA root JSON must be an object".to_string()))?;

    let technical_elements_obj = root
        .get("technicalElements")
        .and_then(Value::as_object)
        .ok_or_else(|| {
            PraxisError::Settings("Missing required 'technicalElements' object".to_string())
        })?;

    let mut technical_elements = TechnicalElements::default();
    let mut additional_elements = HashMap::new();

    for (name, element_value) in technical_elements_obj {
        match name.as_str() {
            "data-analysis" => {
                technical_elements.data_analysis = Some(parse_data_analysis(element_value));
            }
            "systems-analysis" => {
                technical_elements.systems_analysis = Some(parse_systems_analysis(element_value));
            }
            "initiating-event-analysis" => {
                technical_elements.initiating_event_analysis =
                    Some(parse_initiating_event_analysis(element_value));
            }
            "event-sequence-analysis" => {
                technical_elements.event_sequence_analysis =
                    Some(parse_event_sequence_analysis(element_value));
            }
            "event-sequence-quantification" => {
                technical_elements.event_sequence_quantification =
                    Some(parse_event_sequence_quantification(element_value));
            }
            "risk-integration" => {
                technical_elements.risk_integration = Some(parse_risk_integration(element_value));
            }
            other => {
                additional_elements.insert(other.to_string(), element_value.clone());
                diagnostics.push(
                    Diagnostic::new(
                        "SCHEMA_UNKNOWN_ELEMENT_TYPE",
                        Severity::Warning,
                        format!(
                            "Out-of-scope technical element '{other}' preserved as placeholder"
                        ),
                        format!("$.technicalElements.{other}"),
                    )
                    .with_hint(
                        "Element is retained under additionalElements for v1 placeholder handling",
                    ),
                );
            }
        }
    }
    technical_elements.additional_elements = additional_elements;

    let model = OpenPraJsonModel {
        id: get_str(root, &["id"]),
        technical_elements,
        metadata: root.get("metadata").cloned(),
        additional_fields: collect_additional(root, &["id", "technicalElements", "metadata"]),
    };

    Ok(model)
}

fn parse_data_analysis(value: &Value) -> DataAnalysisJsonModel {
    let obj = value.as_object().cloned().unwrap_or_default();
    DataAnalysisJsonModel {
        id: get_str(&obj, &["id"]),
        data_parameters: get_object_array(&obj, &["dataParameters", "data_parameters"])
            .into_iter()
            .map(|item| {
                let item = &item;
                DataParameter {
                id: get_str(item, &["id"]).unwrap_or_default(),
                probability: get_f64(item, &["probability"]),
                frequency: get_f64(item, &["frequency"]),
                distribution: item.get("distribution").cloned(),
                system_ref: get_str(item, &["systemRef", "system_ref"]),
                component_ref: get_str(item, &["componentRef", "component_ref"]),
                metadata_refs: get_object_array(item, &["metadataRefs", "metadata_refs"])
                    .into_iter()
                    .map(|v| IdRef {
                        id: get_str(&v, &["id", "ref", "targetId"]).unwrap_or_default(),
                        ref_type: get_str(&v, &["type", "refType"]),
                    })
                    .collect(),
                additional_fields: collect_additional(
                    item,
                    &[
                        "id",
                        "probability",
                        "frequency",
                        "distribution",
                        "systemRef",
                        "system_ref",
                        "componentRef",
                        "component_ref",
                        "metadataRefs",
                        "metadata_refs",
                    ],
                ),
            }
            })
            .collect(),
        component_groupings: get_object_array(&obj, &["componentGroupings", "component_groupings"])
            .into_iter()
            .map(|item| {
                let item = &item;
                IdGroup {
                id: get_str(item, &["id"]).unwrap_or_default(),
                members: get_string_array(item, &["members"]),
            }
            })
            .collect(),
        outlier_components: get_object_array(&obj, &["outlierComponents", "outlier_components"])
            .into_iter()
            .map(|item| {
                let item = &item;
                IdRef {
                id: get_str(item, &["id", "ref"]).unwrap_or_default(),
                ref_type: get_str(item, &["type", "refType"]),
            }
            })
            .collect(),
        external_data_sources: get_object_array(&obj, &["externalDataSources", "external_data_sources"])
            .into_iter()
            .map(|item| {
                let item = &item;
                ExternalDataSource {
                id: get_str(item, &["id"]).unwrap_or_default(),
                source_type: get_str(item, &["sourceType", "type"]),
                uri: get_str(item, &["uri", "url"]),
                additional_fields: collect_additional(item, &["id", "sourceType", "type", "uri", "url"]),
            }
            })
            .collect(),
        data_consistency_checks: get_object_array(&obj, &["dataConsistencyChecks", "data_consistency_checks"])
            .into_iter()
            .map(|item| {
                let item = &item;
                ConsistencyCheck {
                id: get_str(item, &["id"]).unwrap_or_default(),
                check_type: get_str(item, &["checkType", "type"]),
                status: get_str(item, &["status"]),
                details: get_str(item, &["details", "message"]),
                additional_fields: collect_additional(item, &["id", "checkType", "type", "status", "details", "message"]),
            }
            })
            .collect(),
        documentation: obj.get("documentation").cloned(),
        sensitivity_studies: get_array(&obj, &["sensitivityStudies", "sensitivity_studies"]),
        additional_fields: collect_additional(
            &obj,
            &[
                "id",
                "dataParameters",
                "data_parameters",
                "componentGroupings",
                "component_groupings",
                "outlierComponents",
                "outlier_components",
                "externalDataSources",
                "external_data_sources",
                "dataConsistencyChecks",
                "data_consistency_checks",
                "documentation",
                "sensitivityStudies",
                "sensitivity_studies",
            ],
        ),
    }
}

fn parse_systems_analysis(value: &Value) -> SystemsAnalysisJsonModel {
    let obj = value.as_object().cloned().unwrap_or_default();
    SystemsAnalysisJsonModel {
        id: get_str(&obj, &["id"]),
        system_definitions: get_object_array(&obj, &["systemDefinitions", "system_definitions"])
            .into_iter()
            .map(|item| {
                let item = &item;
                SystemDefinition {
                id: get_str(item, &["id"]).unwrap_or_default(),
                name: get_str(item, &["name"]),
                fault_tree_id: get_str(item, &["faultTreeId", "fault_tree_id"]),
                component_refs: get_string_array(item, &["componentRefs", "component_refs"]),
                additional_fields: collect_additional(item, &["id", "name", "faultTreeId", "fault_tree_id", "componentRefs", "component_refs"]),
            }
            })
            .collect(),
        system_logic_models: get_object_array(&obj, &["systemLogicModels", "system_logic_models"])
            .into_iter()
            .map(|item| {
                let item = &item;
                SystemLogicModel {
                id: get_str(item, &["id"]).unwrap_or_default(),
                name: get_str(item, &["name"]),
                model_type: get_str(item, &["modelType", "type"]),
                root_ref: get_str(item, &["rootRef", "root_ref"]),
                basic_event_refs: get_string_array(item, &["basicEventRefs", "basic_event_refs"]),
                gate_refs: get_string_array(item, &["gateRefs", "gate_refs"]),
                additional_fields: collect_additional(item, &["id", "name", "modelType", "type", "rootRef", "root_ref", "basicEventRefs", "basic_event_refs", "gateRefs", "gate_refs"]),
            }
            })
            .collect(),
        common_cause_failure_groups: get_object_array(&obj, &["commonCauseFailureGroups", "common_cause_failure_groups"])
            .into_iter()
            .map(|item| {
                let item = &item;
                CcfGroup {
                id: get_str(item, &["id"]).unwrap_or_default(),
                members: get_string_array(item, &["members"]),
                model: get_str(item, &["model", "ccfModel"]),
                additional_fields: collect_additional(item, &["id", "members", "model", "ccfModel"]),
            }
            })
            .collect(),
        system_dependencies: get_object_array(&obj, &["systemDependencies", "system_dependencies"])
            .into_iter()
            .map(|item| {
                let item = &item;
                SystemDependency {
                id: get_str(item, &["id"]).unwrap_or_default(),
                source_ref: get_str(item, &["sourceRef", "source"]),
                target_ref: get_str(item, &["targetRef", "target"]),
                dependency_type: get_str(item, &["dependencyType", "type"]),
                additional_fields: collect_additional(item, &["id", "sourceRef", "source", "targetRef", "target", "dependencyType", "type"]),
            }
            })
            .collect(),
        documentation: obj.get("documentation").cloned(),
        additional_fields: collect_additional(
            &obj,
            &[
                "id",
                "systemDefinitions",
                "system_definitions",
                "systemLogicModels",
                "system_logic_models",
                "commonCauseFailureGroups",
                "common_cause_failure_groups",
                "systemDependencies",
                "system_dependencies",
                "documentation",
            ],
        ),
    }
}

fn parse_initiating_event_analysis(value: &Value) -> InitiatingEventAnalysisJsonModel {
    let obj = value.as_object().cloned().unwrap_or_default();
    InitiatingEventAnalysisJsonModel {
        id: get_str(&obj, &["id"]),
        initiators: get_object_array(&obj, &["initiators"])
            .into_iter()
            .map(|item| {
                let item = &item;
                Initiator {
                id: get_str(item, &["id"]).unwrap_or_default(),
                name: get_str(item, &["name"]),
                frequency: get_f64(item, &["frequency"]),
                probability: get_f64(item, &["probability"]),
                system_refs: get_string_array(item, &["systemRefs", "system_refs"]),
                data_parameter_refs: get_string_array(item, &["dataParameterRefs", "data_parameter_refs"]),
                additional_fields: collect_additional(item, &["id", "name", "frequency", "probability", "systemRefs", "system_refs", "dataParameterRefs", "data_parameter_refs"]),
            }
            })
            .collect(),
        initiating_event_groups: get_object_array(&obj, &["initiatingEventGroups", "initiating_event_groups"])
            .into_iter()
            .map(|item| {
                let item = &item;
                InitiatorGroup {
                id: get_str(item, &["id"]).unwrap_or_default(),
                members: get_string_array(item, &["members"]),
                additional_fields: collect_additional(item, &["id", "members"]),
            }
            })
            .collect(),
        quantification: obj.get("quantification").cloned(),
        screening_criteria: obj
            .get("screeningCriteria")
            .cloned()
            .or_else(|| obj.get("screening_criteria").cloned()),
        insights: obj.get("insights").cloned(),
        documentation: obj.get("documentation").cloned(),
        additional_fields: collect_additional(
            &obj,
            &[
                "id",
                "initiators",
                "initiatingEventGroups",
                "initiating_event_groups",
                "quantification",
                "screeningCriteria",
                "screening_criteria",
                "insights",
                "documentation",
            ],
        ),
    }
}

fn parse_event_sequence_analysis(value: &Value) -> EventSequenceAnalysisJsonModel {
    let obj = value.as_object().cloned().unwrap_or_default();

    let scope_definition = obj
        .get("scopeDefinition")
        .or_else(|| obj.get("scope_definition"))
        .and_then(Value::as_object)
        .map(|scope| ScopeDefinition {
            initiating_event_ids: get_string_array(scope, &["initiatingEventIds", "initiating_event_ids"]),
            event_sequence_ids: get_string_array(scope, &["eventSequenceIds", "event_sequence_ids"]),
        });

    EventSequenceAnalysisJsonModel {
        id: get_str(&obj, &["id"]),
        event_sequences: get_object_array(&obj, &["eventSequences", "event_sequences"])
            .into_iter()
            .map(|item| {
                let item = &item;
                EventSequence {
                id: get_str(item, &["id"]).unwrap_or_default(),
                name: get_str(item, &["name"]),
                initiating_event_id: get_str(item, &["initiatingEventId", "initiating_event_id"]),
                functional_event_bindings: get_object_array(item, &["functionalEventBindings", "functional_event_bindings"])
                    .into_iter()
                    .map(|binding| {
                        let binding = &binding;
                        FunctionalEventBinding {
                        id: get_str(binding, &["id"]).unwrap_or_default(),
                        functional_event_id: get_str(binding, &["functionalEventId", "functional_event_id"]),
                        fault_tree_id: get_str(binding, &["faultTreeId", "fault_tree_id"]),
                        data_parameter_id: get_str(binding, &["dataParameterId", "data_parameter_id"]),
                        success_probability: get_f64(binding, &["successProbability", "success_probability"]),
                        additional_fields: collect_additional(binding, &["id", "functionalEventId", "functional_event_id", "faultTreeId", "fault_tree_id", "dataParameterId", "data_parameter_id", "successProbability", "success_probability"]),
                    }
                    })
                    .collect(),
                family_ids: get_string_array(item, &["familyIds", "family_ids"]),
                linked_sequence_ids: get_string_array(item, &["linkedSequenceIds", "linked_sequence_ids"]),
                additional_fields: collect_additional(item, &["id", "name", "initiatingEventId", "initiating_event_id", "functionalEventBindings", "functional_event_bindings", "familyIds", "family_ids", "linkedSequenceIds", "linked_sequence_ids"]),
            }
            })
            .collect(),
        scope_definition,
        event_sequence_families: get_object_array(&obj, &["eventSequenceFamilies", "event_sequence_families"])
            .into_iter()
            .map(|item| {
                let item = &item;
                EventSequenceFamily {
                id: get_str(item, &["id"]).unwrap_or_default(),
                sequence_ids: get_string_array(item, &["sequenceIds", "sequence_ids"]),
                representative_initiating_event_id: get_str(item, &["representativeInitiatingEventId", "representative_initiating_event_id"]),
                additional_fields: collect_additional(item, &["id", "sequenceIds", "sequence_ids", "representativeInitiatingEventId", "representative_initiating_event_id"]),
            }
            })
            .collect(),
        release_category_mappings: get_object_array(&obj, &["releaseCategoryMappings", "release_category_mappings"])
            .into_iter()
            .map(|item| {
                let item = &item;
                ReleaseCategoryMapping {
                id: get_str(item, &["id"]).unwrap_or_default(),
                sequence_id: get_str(item, &["sequenceId", "sequence_id"]),
                release_category_id: get_str(item, &["releaseCategoryId", "release_category_id"]),
                additional_fields: collect_additional(item, &["id", "sequenceId", "sequence_id", "releaseCategoryId", "release_category_id"]),
            }
            })
            .collect(),
        dependencies: obj.get("dependencies").cloned(),
        uncertainty: obj.get("uncertainty").cloned(),
        documentation: obj.get("documentation").cloned(),
        additional_fields: collect_additional(
            &obj,
            &[
                "id",
                "eventSequences",
                "event_sequences",
                "scopeDefinition",
                "scope_definition",
                "eventSequenceFamilies",
                "event_sequence_families",
                "releaseCategoryMappings",
                "release_category_mappings",
                "dependencies",
                "uncertainty",
                "documentation",
            ],
        ),
    }
}

fn parse_event_sequence_quantification(value: &Value) -> EventSequenceQuantificationJsonModel {
    let obj = value.as_object().cloned().unwrap_or_default();
    EventSequenceQuantificationJsonModel {
        id: get_str(&obj, &["id"]),
        quantification_results: get_object_array(&obj, &["quantificationResults", "quantification_results"])
            .into_iter()
            .map(|item| {
                let item = &item;
                QuantificationResult {
                id: get_str(item, &["id"]).unwrap_or_default(),
                event_sequence_id: get_str(item, &["eventSequenceId", "event_sequence_id"]),
                family_id: get_str(item, &["familyId", "family_id"]),
                initiating_event_id: get_str(item, &["initiatingEventId", "initiating_event_id"]),
                frequency: get_f64(item, &["frequency"]),
                probability: get_f64(item, &["probability"]),
                additional_fields: collect_additional(item, &["id", "eventSequenceId", "event_sequence_id", "familyId", "family_id", "initiatingEventId", "initiating_event_id", "frequency", "probability"]),
            }
            })
            .collect(),
        event_sequence_families: get_object_array(&obj, &["eventSequenceFamilies", "event_sequence_families"])
            .into_iter()
            .map(|item| {
                let item = &item;
                QuantificationFamily {
                id: get_str(item, &["id"]).unwrap_or_default(),
                sequence_ids: get_string_array(item, &["sequenceIds", "sequence_ids"]),
                representative_initiating_event_id: get_str(item, &["representativeInitiatingEventId", "representative_initiating_event_id"]),
                additional_fields: collect_additional(item, &["id", "sequenceIds", "sequence_ids", "representativeInitiatingEventId", "representative_initiating_event_id"]),
            }
            })
            .collect(),
        quantification_methods: get_object_array(&obj, &["quantificationMethods", "quantification_methods"])
            .into_iter()
            .map(|item| {
                let item = &item;
                QuantificationMethod {
                id: get_str(item, &["id"]).unwrap_or_default(),
                method_type: get_str(item, &["methodType", "type"]),
                backend: get_str(item, &["backend"]),
                parameters: item.get("parameters").cloned(),
            }
            })
            .collect(),
        uncertainty_treatment: obj
            .get("uncertaintyTreatment")
            .cloned()
            .or_else(|| obj.get("uncertainty_treatment").cloned()),
        dependency_treatment: obj
            .get("dependencyTreatment")
            .cloned()
            .or_else(|| obj.get("dependency_treatment").cloned()),
        additional_fields: collect_additional(
            &obj,
            &[
                "id",
                "quantificationResults",
                "quantification_results",
                "eventSequenceFamilies",
                "event_sequence_families",
                "quantificationMethods",
                "quantification_methods",
                "uncertaintyTreatment",
                "uncertainty_treatment",
                "dependencyTreatment",
                "dependency_treatment",
            ],
        ),
    }
}

fn parse_risk_integration(value: &Value) -> RiskIntegrationJsonModel {
    let obj = value.as_object().cloned().unwrap_or_default();

    let placeholder_reason = Some(
        "Risk Integration fields are preserved, but advanced RI computation remains placeholder where Praxis does not yet implement RI solvers"
            .to_string(),
    );

    RiskIntegrationJsonModel {
        id: get_str(&obj, &["id"]),
        risk_significance_criteria: parse_named_values(
            &obj,
            &["riskSignificanceCriteria", "risk_significance_criteria"],
        ),
        event_sequence_to_release_category_mappings: get_object_array(
            &obj,
            &[
                "eventSequenceToReleaseCategoryMappings",
                "event_sequence_to_release_category_mappings",
            ],
        )
        .into_iter()
        .map(|item| {
            let item = &item;
            RiskMapping {
            id: get_str(item, &["id"]).unwrap_or_default(),
            sequence_id: get_str(item, &["sequenceId", "sequence_id"]),
            release_category_id: get_str(item, &["releaseCategoryId", "release_category_id"]),
            payload: item.get("payload").cloned(),
        }
        })
        .collect(),
        integrated_risk_results: parse_named_values(
            &obj,
            &["integratedRiskResults", "integrated_risk_results"],
        ),
        significant_contributors: parse_named_values(
            &obj,
            &["significantContributors", "significant_contributors"],
        ),
        integration_methods: parse_named_values(&obj, &["integrationMethods", "integration_methods"]),
        placeholder_used: true,
        placeholder_reason,
        additional_fields: collect_additional(
            &obj,
            &[
                "id",
                "riskSignificanceCriteria",
                "risk_significance_criteria",
                "eventSequenceToReleaseCategoryMappings",
                "event_sequence_to_release_category_mappings",
                "integratedRiskResults",
                "integrated_risk_results",
                "significantContributors",
                "significant_contributors",
                "integrationMethods",
                "integration_methods",
            ],
        ),
    }
}

fn parse_named_values(obj: &Map<String, Value>, keys: &[&str]) -> Vec<NamedValue> {
    get_object_array(obj, keys)
        .into_iter()
        .map(|item| {
            let item = &item;
            NamedValue {
            id: get_str(item, &["id"]).unwrap_or_default(),
            payload: item.get("payload").cloned().unwrap_or_else(|| Value::Object(item.clone())),
        }
        })
        .collect()
}

fn get_str(obj: &Map<String, Value>, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|k| obj.get(*k))
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

fn get_f64(obj: &Map<String, Value>, keys: &[&str]) -> Option<f64> {
    keys.iter().find_map(|k| obj.get(*k)).and_then(|v| {
        if let Some(n) = v.as_f64() {
            Some(n)
        } else if let Some(s) = v.as_str() {
            s.parse::<f64>().ok()
        } else {
            None
        }
    })
}

fn get_array(obj: &Map<String, Value>, keys: &[&str]) -> Vec<Value> {
    keys.iter()
        .find_map(|k| obj.get(*k))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

fn get_object_array(obj: &Map<String, Value>, keys: &[&str]) -> Vec<Map<String, Value>> {
    get_array(obj, keys)
        .into_iter()
        .filter_map(|value| value.as_object().cloned())
        .collect()
}

fn get_string_array(obj: &Map<String, Value>, keys: &[&str]) -> Vec<String> {
    get_array(obj, keys)
        .into_iter()
        .filter_map(|v| v.as_str().map(ToString::to_string))
        .collect()
}

fn collect_additional(obj: &Map<String, Value>, known_keys: &[&str]) -> HashMap<String, Value> {
    obj.iter()
        .filter_map(|(k, v)| {
            if known_keys.contains(&k.as_str()) {
                None
            } else {
                Some((k.clone(), v.clone()))
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_payload() -> &'static str {
        r#"{
            "id": "MODEL-1",
            "technicalElements": {
                "data-analysis": {
                    "id": "DA-1",
                    "dataParameters": [
                        {"id": "DP-1", "probability": 0.01, "frequency": 1.0e-4}
                    ]
                },
                "systems-analysis": {
                    "id": "SA-1",
                    "systemDefinitions": [
                        {"id": "SYS-1", "faultTreeId": "FT-1"}
                    ],
                    "systemLogicModels": [
                        {"id": "FT-1", "modelType": "fault-tree"}
                    ]
                },
                "initiating-event-analysis": {
                    "id": "IEA-1",
                    "initiators": [
                        {
                            "id": "IE-1",
                            "frequency": 1.2e-3,
                            "dataParameterRefs": ["DP-1"],
                            "systemRefs": ["SYS-1"]
                        }
                    ]
                },
                "event-sequence-analysis": {
                    "id": "ESA-1",
                    "scopeDefinition": {"initiatingEventIds": ["IE-1"]},
                    "eventSequences": [
                        {
                            "id": "SEQ-1",
                            "initiatingEventId": "IE-1",
                            "functionalEventBindings": [
                                {"id": "FEB-1", "faultTreeId": "FT-1", "dataParameterId": "DP-1"}
                            ]
                        }
                    ]
                },
                "event-sequence-quantification": {
                    "id": "ESQ-1",
                    "quantificationResults": [
                        {
                            "id": "QR-1",
                            "eventSequenceId": "SEQ-1",
                            "initiatingEventId": "IE-1",
                            "frequency": 1.0e-6
                        }
                    ]
                },
                "risk-integration": {
                    "id": "RI-1",
                    "eventSequenceToReleaseCategoryMappings": [
                        {"id": "RM-1", "sequenceId": "SEQ-1", "releaseCategoryId": "REL-1"}
                    ]
                }
            }
        }"#
    }

    #[test]
    fn validate_empty_input_returns_schema_invalid_json() {
        let diagnostics = validate_openpra_json("").unwrap();
        assert_eq!(diagnostics.len(), 1);
        assert_eq!(diagnostics[0].code, "SCHEMA_INVALID_JSON");
        assert_eq!(diagnostics[0].json_path, "$.input");
    }

    #[test]
    fn validate_malformed_json_returns_schema_invalid_json() {
        let diagnostics = validate_openpra_json("{ this is not json }").unwrap();
        assert_eq!(diagnostics.len(), 1);
        assert_eq!(diagnostics[0].code, "SCHEMA_INVALID_JSON");
        assert_eq!(diagnostics[0].severity, Severity::Error);
    }

    #[test]
    fn validate_missing_technical_elements_returns_required_field_error() {
        let diagnostics = validate_openpra_json(r#"{"id":"M1"}"#).unwrap();
        assert_eq!(diagnostics.len(), 1);
        assert_eq!(diagnostics[0].code, "SCHEMA_MISSING_REQUIRED_FIELD");
        assert_eq!(diagnostics[0].json_path, "$.technicalElements");
    }

    #[test]
    fn validate_unknown_technical_element_returns_placeholder_warning() {
        let diagnostics = validate_openpra_json(
            r#"{
                "technicalElements": {
                    "unknown-element": {}
                }
            }"#,
        )
        .unwrap();

        assert_eq!(diagnostics.len(), 1);
        assert_eq!(diagnostics[0].code, "SCHEMA_UNKNOWN_ELEMENT_TYPE");
        assert_eq!(diagnostics[0].severity, Severity::Warning);
        assert_eq!(
            diagnostics[0].json_path,
            "$.technicalElements.unknown-element"
        );
    }

    #[test]
    fn resolve_unknown_technical_element_uses_placeholder_policy() {
        let payload = r#"{
            "id": "MODEL-UNKNOWN-TE",
            "technicalElements": {
                "data-analysis": {
                    "id": "DA",
                    "dataParameters": [{"id": "DP", "probability": 0.01}]
                },
                "systems-analysis": {
                    "id": "SA",
                    "systemDefinitions": [{"id": "SYS", "faultTreeId": "FT"}],
                    "systemLogicModels": [{"id": "FT", "modelType": "or", "basicEventRefs": ["DP"]}]
                },
                "initiating-event-analysis": {
                    "id": "IEA",
                    "initiators": [{"id": "IE", "probability": 1.0, "systemRefs": ["SYS"]}]
                },
                "event-sequence-analysis": {
                    "id": "ESA",
                    "eventSequences": [{"id": "SEQ", "initiatingEventId": "IE", "functionalEventBindings": [{"id": "FEB", "functionalEventId": "FE", "faultTreeId": "FT"}]}]
                },
                "event-sequence-quantification": {
                    "id": "ESQ",
                    "quantificationResults": [{"id": "QR", "eventSequenceId": "SEQ", "initiatingEventId": "IE", "frequency": 1.0e-6}]
                },
                "risk-integration": {
                    "id": "RI",
                    "eventSequenceToReleaseCategoryMappings": []
                },
                "human-reliability-analysis": {
                    "id": "HRA-1",
                    "methods": []
                }
            }
        }"#;

        let mut bundle = parse_openpra_json(payload).unwrap();
        assert!(bundle.model.is_some());
        let diagnostics = resolve_openpra_refs(&mut bundle, ResolveMode::Compatible).unwrap();

        assert!(diagnostics.iter().any(|d| {
            d.code == "REF_OUT_OF_SCOPE_PLACEHOLDER_USED"
                && d.json_path == "$.technicalElements.human-reliability-analysis"
        }));
        assert!(bundle.placeholders.iter().any(|p| {
            p.source_element == "human-reliability-analysis"
                && p.target_type == "out-of-scope-technical-element"
        }));
    }

    #[test]
    fn validate_valid_payload_has_no_errors() {
        let diagnostics = validate_openpra_json(valid_payload()).unwrap();
        assert!(diagnostics.is_empty());
    }

    #[test]
    fn parse_valid_payload_extracts_model_id() {
        let bundle = parse_openpra_json(valid_payload()).unwrap();
        assert_eq!(bundle.model_id.as_deref(), Some("MODEL-1"));
        assert!(bundle.model.is_some());
        assert!(bundle.diagnostics.is_empty(), "{:?}", bundle.diagnostics);
    }

    #[test]
    fn parse_invalid_payload_returns_diagnostics_bundle() {
        let bundle = parse_openpra_json(r#"{"technicalElements": 5}"#).unwrap();
        assert!(bundle.model_id.is_none());
        assert_eq!(bundle.diagnostics.len(), 1);
        assert_eq!(bundle.diagnostics[0].code, "SCHEMA_VALIDATION_FAILED");
    }

    #[test]
    fn resolve_refs_full_payload_emits_only_ri_placeholder_warning() {
        let mut bundle = parse_openpra_json(valid_payload()).unwrap();
        let diagnostics = resolve_openpra_refs(&mut bundle, ResolveMode::Compatible).unwrap();

        assert!(diagnostics.iter().all(|d| d.code != "REF_MISSING_REQUIRED"));
        assert!(diagnostics
            .iter()
            .any(|d| d.code == "REF_OUT_OF_SCOPE_PLACEHOLDER_USED"));
        assert!(!bundle.placeholders.is_empty());
    }

    #[test]
    fn resolve_unresolved_ri_edge_is_error_in_strict_mode() {
        let payload = r#"{
            "id": "MODEL-2",
            "technicalElements": {
                "data-analysis": {
                    "id": "DA-2",
                    "dataParameters": [{"id": "DP-2", "probability": 0.02}]
                },
                "systems-analysis": {
                    "id": "SA-2",
                    "systemDefinitions": [{"id": "SYS-2", "faultTreeId": "FT-2"}],
                    "systemLogicModels": [{"id": "FT-2", "modelType": "fault-tree"}]
                },
                "initiating-event-analysis": {
                    "id": "IEA-2",
                    "initiators": [{"id": "IE-2", "frequency": 1.0e-3, "dataParameterRefs": ["DP-2"]}]
                },
                "event-sequence-analysis": {
                    "id": "ESA-2",
                    "eventSequences": [{
                        "id": "SEQ-2",
                        "initiatingEventId": "IE-2",
                        "functionalEventBindings": [{"id": "FEB-2", "faultTreeId": "FT-2"}]
                    }]
                },
                "event-sequence-quantification": {
                    "id": "ESQ-2",
                    "quantificationResults": [{
                        "id": "QR-2",
                        "eventSequenceId": "SEQ-2",
                        "initiatingEventId": "IE-2",
                        "frequency": 2.0e-6
                    }]
                },
                "risk-integration": {
                    "id": "RI-2",
                    "eventSequenceToReleaseCategoryMappings": [
                        {"id": "RM-2", "sequenceId": "SEQ-MISSING", "releaseCategoryId": "REL-2"}
                    ]
                }
            }
        }"#;

        let mut bundle = parse_openpra_json(payload).unwrap();
        let diagnostics = resolve_openpra_refs(&mut bundle, ResolveMode::Strict).unwrap();

        assert!(diagnostics.iter().any(|d| d.code == "REF_MISSING_REQUIRED"));
    }

    #[test]
    fn resolve_unresolved_ri_edge_uses_placeholder_in_compatible_mode() {
        let payload = r#"{
            "id": "MODEL-3",
            "technicalElements": {
                "data-analysis": {
                    "id": "DA-3",
                    "dataParameters": [{"id": "DP-3", "probability": 0.03}]
                },
                "systems-analysis": {
                    "id": "SA-3",
                    "systemDefinitions": [{"id": "SYS-3", "faultTreeId": "FT-3"}],
                    "systemLogicModels": [{"id": "FT-3", "modelType": "fault-tree"}]
                },
                "initiating-event-analysis": {
                    "id": "IEA-3",
                    "initiators": [{"id": "IE-3", "frequency": 1.5e-3, "dataParameterRefs": ["DP-3"]}]
                },
                "event-sequence-analysis": {
                    "id": "ESA-3",
                    "eventSequences": [{
                        "id": "SEQ-3",
                        "initiatingEventId": "IE-3",
                        "functionalEventBindings": [{"id": "FEB-3", "faultTreeId": "FT-3"}]
                    }]
                },
                "event-sequence-quantification": {
                    "id": "ESQ-3",
                    "quantificationResults": [{
                        "id": "QR-3",
                        "eventSequenceId": "SEQ-3",
                        "initiatingEventId": "IE-3",
                        "frequency": 3.0e-6
                    }]
                },
                "risk-integration": {
                    "id": "RI-3",
                    "eventSequenceToReleaseCategoryMappings": [
                        {"id": "RM-3", "sequenceId": "SEQ-MISSING", "releaseCategoryId": "REL-3"}
                    ]
                }
            }
        }"#;

        let mut bundle = parse_openpra_json(payload).unwrap();
        let diagnostics = resolve_openpra_refs(&mut bundle, ResolveMode::Compatible).unwrap();

        assert!(diagnostics
            .iter()
            .any(|d| d.code == "REF_OUT_OF_SCOPE_PLACEHOLDER_USED"));
        assert!(diagnostics.iter().all(|d| d.code != "REF_MISSING_REQUIRED"));
    }

    #[test]
    fn to_engine_inputs_carries_full_model() {
        let bundle = parse_openpra_json(valid_payload()).unwrap();
        let inputs = to_engine_inputs(&bundle).unwrap();
        assert_eq!(inputs.model_id.as_deref(), Some("MODEL-1"));
        assert!(inputs.model.is_some());
        assert!(inputs.praxis_model.is_some());
        assert_eq!(inputs.praxis_initiating_events.len(), 1);
        assert_eq!(inputs.praxis_event_trees.len(), 1);
    }

    #[test]
    fn to_engine_inputs_runs_event_tree_monte_carlo() {
        let payload = r#"{
            "id": "MODEL-MC",
            "technicalElements": {
                "data-analysis": {
                    "id": "DA-MC",
                    "dataParameters": [
                        {"id": "DP-A", "probability": 0.01},
                        {"id": "DP-B", "probability": 0.02}
                    ]
                },
                "systems-analysis": {
                    "id": "SA-MC",
                    "systemDefinitions": [{"id": "SYS-MC", "faultTreeId": "FT-MC"}],
                    "systemLogicModels": [
                        {
                            "id": "FT-MC",
                            "modelType": "or",
                            "rootRef": "G-MC",
                            "basicEventRefs": ["DP-A", "DP-B"]
                        }
                    ]
                },
                "initiating-event-analysis": {
                    "id": "IEA-MC",
                    "initiators": [
                        {
                            "id": "IE-MC",
                            "frequency": 1.0e-3,
                            "systemRefs": ["SYS-MC"],
                            "dataParameterRefs": ["DP-A"]
                        }
                    ]
                },
                "event-sequence-analysis": {
                    "id": "ESA-MC",
                    "eventSequences": [
                        {
                            "id": "SEQ-MC-1",
                            "initiatingEventId": "IE-MC",
                            "functionalEventBindings": [
                                {"id": "FEB-MC-1", "functionalEventId": "FE-MC-1", "faultTreeId": "FT-MC"}
                            ]
                        },
                        {
                            "id": "SEQ-MC-2",
                            "initiatingEventId": "IE-MC",
                            "functionalEventBindings": [
                                {"id": "FEB-MC-2", "functionalEventId": "FE-MC-1", "faultTreeId": "FT-MC"}
                            ]
                        }
                    ]
                },
                "event-sequence-quantification": {
                    "id": "ESQ-MC",
                    "quantificationResults": [
                        {"id": "QR-MC-1", "eventSequenceId": "SEQ-MC-1", "initiatingEventId": "IE-MC", "frequency": 1.0e-6},
                        {"id": "QR-MC-2", "eventSequenceId": "SEQ-MC-2", "initiatingEventId": "IE-MC", "frequency": 2.0e-6}
                    ]
                },
                "risk-integration": {
                    "id": "RI-MC",
                    "eventSequenceToReleaseCategoryMappings": []
                }
            }
        }"#;

        let bundle = parse_openpra_json(payload).unwrap();
        let inputs = to_engine_inputs(&bundle).unwrap();

        let model = inputs.praxis_model.as_ref().unwrap();
        let initiating_event = inputs.praxis_initiating_events[0].clone();
        let event_tree_id = initiating_event.event_tree_id.clone().unwrap();
        let event_tree = inputs
            .praxis_event_tree_library
            .get(&event_tree_id)
            .unwrap()
            .clone();

        let analysis = crate::mc::DpEventTreeMonteCarloAnalysis::new(
            initiating_event,
            event_tree,
            model,
            Some(77),
            256,
        )
        .unwrap()
        .with_event_tree_library(&inputs.praxis_event_tree_library);

        let result = analysis.run_cpu().unwrap();
        assert_eq!(result.num_trials, 256);
        assert!(!result.sequences.is_empty());
    }

    #[test]
    fn from_engine_outputs_serializes_envelope() {
        let bundle = parse_openpra_json(valid_payload()).unwrap();
        let outputs = EngineOutputs {
            model_id: Some("MODEL-1".to_string()),
            result_payload: Some(serde_json::json!({
                "id": "QR-1",
                "frequency": 1.0e-6
            })),
            schema_version: None,
            engine_version: None,
            run_metadata: None,
            placeholders: Vec::new(),
            diagnostics: Vec::new(),
        };

        let json = from_engine_outputs(&outputs, &bundle).unwrap();
        assert!(json.contains("event-sequence-quantification"));
        assert!(json.contains("placeholderProvenance"));
    }
}
