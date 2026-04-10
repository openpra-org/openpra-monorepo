use std::collections::HashMap;

use praxis::core::event_tree::{Branch, BranchTarget, EventTree, FunctionalEvent};
use praxis::core::gate::Formula;
use praxis::io::parser::parse_event_tree_model;
use praxis::mc::{DpEventTreeMonteCarloAnalysis, EventTreeMonteCarloResult};
use praxis::openpra_mef::addon_json::{parse_openpra_json, resolve_openpra_refs, to_engine_inputs};
use praxis::openpra_mef::contracts::{ResolveMode, Severity};
use serde_json::{json, Value};

#[derive(Clone)]
struct PathLeaf {
    sequence_id: String,
    path_signature: Vec<PathStep>,
}

#[derive(Clone)]
struct PathStep {
    functional_event_id: String,
    state: String,
    collect_formula_negated: Option<bool>,
}

fn collect_leaves(
    branch: &Branch,
    event_tree: &EventTree,
    active_steps: &[PathStep],
    out: &mut Vec<PathLeaf>,
) {
    match &branch.target {
        BranchTarget::Sequence(seq_id) => {
            out.push(PathLeaf {
                sequence_id: seq_id.clone(),
                path_signature: active_steps.to_vec(),
            });
        }
        BranchTarget::Fork(fork) => {
            for path in &fork.paths {
                let mut next_steps = active_steps.to_vec();
                next_steps.push(PathStep {
                    functional_event_id: fork.functional_event_id.clone(),
                    state: path.state.clone(),
                    collect_formula_negated: path.collect_formula_negated,
                });
                collect_leaves(&path.branch, event_tree, &next_steps, out);
            }
        }
        BranchTarget::NamedBranch(named_id) => {
            let named = event_tree
                .named_branches
                .get(named_id)
                .unwrap_or_else(|| panic!("missing named branch '{named_id}'"));
            collect_leaves(&named.branch, event_tree, active_steps, out);
        }
    }
}

fn formula_to_model_type(formula: &Formula) -> &'static str {
    match formula {
        Formula::And => "and",
        Formula::Or => "or",
        Formula::Not => "not",
        Formula::AtLeast { .. } => "atleast",
        Formula::Xor => "xor",
        Formula::Nand => "nand",
        Formula::Nor => "nor",
        Formula::Iff => "iff",
    }
}

fn normalize_fault_tree_ref(raw_ref: &str, known_fault_trees: &HashMap<String, ()>) -> Option<String> {
    if known_fault_trees.contains_key(raw_ref) {
        return Some(raw_ref.to_string());
    }

    let prefix = raw_ref.split('.').next().unwrap_or(raw_ref);
    if known_fault_trees.contains_key(prefix) {
        return Some(prefix.to_string());
    }

    None
}

fn fe_binding_json(id: String, fe: &FunctionalEvent, known_fault_trees: &HashMap<String, ()>) -> Value {
    if let Some(ft_id) = &fe.fault_tree_id {
        if let Some(normalized_ft_id) = normalize_fault_tree_ref(ft_id, known_fault_trees) {
            return json!({
                "id": id,
                "functionalEventId": fe.id,
                "faultTreeId": normalized_ft_id,
            });
        }
    }

    if let Some(p) = fe.success_probability {
        json!({
            "id": id,
            "functionalEventId": fe.id,
            "successProbability": p,
        })
    } else {
        json!({
            "id": id,
            "functionalEventId": fe.id,
            "successProbability": 0.5,
        })
    }
}

fn convert_xml_model_to_openpra_json(
    model: &praxis::core::model::Model,
    initiating_events: &[praxis::core::event_tree::InitiatingEvent],
    event_trees: &[EventTree],
) -> String {
    let mut data_parameter_prob: HashMap<String, f64> = HashMap::new();

    for (id, be) in model.basic_events() {
        data_parameter_prob.entry(id.clone()).or_insert(be.probability());
    }

    for (_ft_id, ft) in model.fault_trees() {
        for (id, be) in ft.basic_events() {
            data_parameter_prob
                .entry(id.clone())
                .or_insert(be.probability());
        }
    }

    let mut data_parameter_ids: Vec<String> = data_parameter_prob.keys().cloned().collect();
    data_parameter_ids.sort();

    let mut data_parameters = Vec::new();
    for id in data_parameter_ids {
        let p = data_parameter_prob.get(&id).copied().unwrap_or(0.0);
        data_parameters.push(json!({
            "id": id,
            "probability": p,
        }));
    }

    let mut system_definitions = Vec::new();
    let mut system_logic_models = Vec::new();
    let mut known_fault_trees: HashMap<String, ()> = HashMap::new();
    for (ft_id, ft) in model.fault_trees() {
        known_fault_trees.insert(ft_id.clone(), ());
        let sys_id = format!("SYS::{ft_id}");
        system_definitions.push(json!({
            "id": sys_id,
            "faultTreeId": ft_id,
        }));

        let model_type = ft
            .get_gate(ft.top_event())
            .map(|gate| formula_to_model_type(gate.formula()))
            .unwrap_or("or");

        let basic_event_refs: Vec<String> = ft.basic_events().keys().cloned().collect();

        system_logic_models.push(json!({
            "id": ft_id,
            "modelType": model_type,
            "rootRef": ft.top_event(),
            "basicEventRefs": basic_event_refs,
            "gateRefs": [],
        }));
    }

    let mut initiators = Vec::new();
    let mut event_sequences = Vec::new();
    let mut quantification_results = Vec::new();

    let mut event_tree_by_id: HashMap<String, &EventTree> = HashMap::new();
    for et in event_trees {
        event_tree_by_id.insert(et.id.clone(), et);
    }

    fn collect_reachable_event_tree_ids(
        root_id: &str,
        event_tree_by_id: &HashMap<String, &EventTree>,
    ) -> Vec<String> {
        let mut ordered = Vec::new();
        let mut seen: HashMap<String, ()> = HashMap::new();
        let mut stack = vec![root_id.to_string()];

        while let Some(next_id) = stack.pop() {
            if seen.contains_key(&next_id) {
                continue;
            }
            seen.insert(next_id.clone(), ());
            ordered.push(next_id.clone());

            if let Some(et) = event_tree_by_id.get(&next_id) {
                let mut linked: Vec<String> = et
                    .sequences
                    .values()
                    .filter_map(|seq| seq.linked_event_tree_id.clone())
                    .collect();
                linked.sort();
                linked.reverse();
                for linked_id in linked {
                    if event_tree_by_id.contains_key(&linked_id) && !seen.contains_key(&linked_id)
                    {
                        stack.push(linked_id);
                    }
                }
            }
        }

        ordered
    }

    let mut quant_idx = 0usize;
    for ie in initiating_events {
        let primary_et_id = ie
            .event_tree_id
            .as_ref()
            .cloned()
            .or_else(|| event_trees.first().map(|et| et.id.clone()))
            .unwrap_or_else(|| "event-tree-0".to_string());

        let reachable_tree_ids = collect_reachable_event_tree_ids(&primary_et_id, &event_tree_by_id);
        for source_et_id in reachable_tree_ids {
            let event_tree = event_tree_by_id
                .get(&source_et_id)
                .copied()
                .unwrap_or_else(|| panic!("missing event tree '{source_et_id}' for IE '{}';", ie.id));

            let mut leaves = Vec::new();
            collect_leaves(&event_tree.initial_state, event_tree, &[], &mut leaves);

            let mut seq_index = 0usize;
            for leaf in leaves {
                seq_index += 1;
                let sequence = event_tree.sequences.get(&leaf.sequence_id).unwrap();
                let sequence_name = sequence
                    .name
                    .clone()
                    .unwrap_or_else(|| leaf.sequence_id.clone());
                let sequence_id = format!("{}::{}::path-{seq_index}", source_et_id, leaf.sequence_id);

                let mut bindings = Vec::new();
                for step in &leaf.path_signature {
                    if let Some(fe) = event_tree.functional_events.get(&step.functional_event_id) {
                        let bind_id = format!("FEB::{}::{}::{seq_index}", ie.id, fe.id);
                        bindings.push(fe_binding_json(bind_id, fe, &known_fault_trees));
                    }
                }

                let path_signature: Vec<Value> = leaf
                    .path_signature
                    .iter()
                    .map(|step| {
                        json!({
                            "functionalEventId": step.functional_event_id,
                            "state": step.state,
                            "collectFormulaNegated": step.collect_formula_negated,
                        })
                    })
                    .collect();

                let mut seq_json = json!({
                    "id": sequence_id,
                    "name": sequence_name,
                    "initiatingEventId": ie.id,
                    "functionalEventBindings": bindings,
                    "pathSignature": path_signature,
                    "sourceEventTreeId": source_et_id,
                });

                if let Some(linked) = &sequence.linked_event_tree_id {
                    seq_json["linkedSequenceIds"] = json!([linked]);
                }

                event_sequences.push(seq_json);

                quant_idx += 1;
                quantification_results.push(json!({
                    "id": format!("QR::{quant_idx}"),
                    "eventSequenceId": sequence_id,
                    "initiatingEventId": ie.id,
                    "frequency": 0.0,
                }));
            }
        }

        let mut initiator_json = json!({
            "id": ie.id,
            "name": ie.name,
            "systemRefs": [],
            "dataParameterRefs": [],
            "sourceEventTreeId": primary_et_id,
        });

        if let Some(probability) = ie.probability {
            initiator_json["probability"] = json!(probability);
        } else if let Some(frequency) = ie.frequency {
            initiator_json["frequency"] = json!(frequency);
        } else {
            initiator_json["probability"] = json!(1.0);
        }

        if let Some(ft_id) = &ie.fault_tree_id {
            initiator_json["systemRefs"] = json!([format!("SYS::{ft_id}")]);
        }

        initiators.push(initiator_json);
    }

    let payload = json!({
        "id": model.element().id(),
        "technicalElements": {
            "data-analysis": {
                "id": "DA::xml-converted",
                "dataParameters": data_parameters,
            },
            "systems-analysis": {
                "id": "SA::xml-converted",
                "systemDefinitions": system_definitions,
                "systemLogicModels": system_logic_models,
            },
            "initiating-event-analysis": {
                "id": "IEA::xml-converted",
                "initiators": initiators,
            },
            "event-sequence-analysis": {
                "id": "ESA::xml-converted",
                "eventSequences": event_sequences,
            },
            "event-sequence-quantification": {
                "id": "ESQ::xml-converted",
                "quantificationResults": quantification_results,
            },
            "risk-integration": {
                "id": "RI::xml-converted",
                "eventSequenceToReleaseCategoryMappings": [],
            }
        }
    });

    serde_json::to_string_pretty(&payload).unwrap()
}

fn result_map(result: &EventTreeMonteCarloResult) -> HashMap<String, f64> {
    let mut out = HashMap::new();
    for seq in &result.sequences {
        out.insert(seq.sequence.id.clone(), seq.probability_estimate);
    }
    out
}

fn result_map_by_name_or_id(result: &EventTreeMonteCarloResult) -> HashMap<String, f64> {
    let mut out = HashMap::new();
    for seq in &result.sequences {
        let key = seq
            .sequence
            .name
            .as_ref()
            .cloned()
            .unwrap_or_else(|| seq.sequence.id.clone());
        *out.entry(key).or_insert(0.0) += seq.probability_estimate;
    }
    out
}

fn run_xml_vs_json_parity(
    xml: &str,
    expected_sequences: &[&str],
    per_sequence_tolerance: f64,
    total_tolerance: f64,
) {
    let (xml_model, xml_ies, xml_ets) = parse_event_tree_model(xml).unwrap();
    let ie_xml = xml_ies[0].clone();
    let et_xml = xml_ets[0].clone();

    let mut xml_library: HashMap<String, EventTree> = HashMap::new();
    for et in &xml_ets {
        xml_library.insert(et.id.clone(), et.clone());
    }

    let xml_run = DpEventTreeMonteCarloAnalysis::new(ie_xml, et_xml, &xml_model, Some(42), 200_000)
        .unwrap()
        .with_event_tree_library(&xml_library)
        .run_cpu()
        .unwrap();

    let json_payload = convert_xml_model_to_openpra_json(&xml_model, &xml_ies, &xml_ets);

    let mut bundle = parse_openpra_json(&json_payload).unwrap();
    let diagnostics = resolve_openpra_refs(&mut bundle, ResolveMode::Compatible).unwrap();
    assert!(
        diagnostics.iter().all(|d| d.severity != Severity::Error),
        "expected conversion payload to resolve without errors, got diagnostics: {:?}",
        diagnostics
    );

    let inputs = to_engine_inputs(&bundle).unwrap();
    let json_model = inputs.praxis_model.as_ref().unwrap();
    let json_ie = inputs.praxis_initiating_events[0].clone();
    let json_et_id = json_ie.event_tree_id.clone().unwrap();
    let json_et = inputs.praxis_event_tree_library.get(&json_et_id).unwrap().clone();

    let json_run = DpEventTreeMonteCarloAnalysis::new(json_ie, json_et, json_model, Some(42), 200_000)
        .unwrap()
        .with_event_tree_library(&inputs.praxis_event_tree_library)
        .run_cpu()
        .unwrap();

    let xml_probs = result_map(&xml_run);
    let json_probs = result_map_by_name_or_id(&json_run);

    for seq_id in expected_sequences {
        let p_xml = *xml_probs.get(*seq_id).unwrap_or(&0.0);
        let p_json = *json_probs.get(*seq_id).unwrap_or(&0.0);
        let delta = (p_xml - p_json).abs();
        assert!(
            delta < per_sequence_tolerance,
            "sequence {seq_id} parity delta too large: xml={p_xml}, json={p_json}, delta={delta}"
        );
    }

    let total_xml: f64 = xml_probs.values().sum();
    let total_json: f64 = json_probs.values().sum();
    assert!((total_xml - 1.0).abs() < total_tolerance, "total_xml={total_xml}");
    assert!((total_json - 1.0).abs() < total_tolerance, "total_json={total_json}");
}

#[test]
fn xml_converted_openpra_json_parity_for_linked_fault_trees_fixture() {
    let xml = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/eta/EventTrees/linked_fault_trees_shared_be.xml"
    ));
    run_xml_vs_json_parity(xml, &["BothFail", "Other"], 0.12, 0.02);
}

#[test]
fn xml_converted_openpra_json_parity_for_gas_leak_reactive_fixture() {
    let xml = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/eta/EventTrees/gas_leak/gas_leak_reactive.xml"
    ));

    run_xml_vs_json_parity(
        xml,
        &["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"],
        0.50,
        0.03,
    );
}

#[test]
fn xml_converted_openpra_json_parity_for_gas_leak_combined_fixture() {
    let xml = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/eta/EventTrees/gas_leak/gas_leak_combined.xml"
    ));

    run_xml_vs_json_parity(
        xml,
        &["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9"],
        0.50,
        0.03,
    );
}
