use crate::core::ccf::CcfModel;
use crate::core::event_tree::{Branch, BranchTarget, EventTree, FunctionalEvent, InitiatingEvent};
use crate::core::event::Distribution;
use crate::core::gate::Formula;
use crate::core::model::Model;
use crate::io::parser::{parse_any_mef, ParsedInput};
use crate::openpra_mef::contracts::{
    Diagnostic, EngineOutputs, OpenPraJsonBundle, ResolveMode, Severity,
};
use crate::openpra_mef::json_model::data_analysis::{DataAnalysisJsonModel, DataParameter};
use crate::openpra_mef::json_model::event_sequence_analysis::{
    EventSequence, EventSequenceAnalysisJsonModel, FunctionalEventBinding, ScopeDefinition,
};
use crate::openpra_mef::json_model::event_sequence_quantification::{
    EventSequenceQuantificationJsonModel, QuantificationResult,
};
use crate::openpra_mef::json_model::initiating_event_analysis::{
    InitiatingEventAnalysisJsonModel, Initiator,
};
use crate::openpra_mef::json_model::risk_integration::RiskIntegrationJsonModel;
use crate::openpra_mef::json_model::systems_analysis::{
    CcfGroup as SystemsCcfGroup, SystemDefinition, SystemDependency, SystemLogicModel,
    SystemsAnalysisJsonModel,
};
use crate::openpra_mef::json_model::{OpenPraJsonModel, TechnicalElements};
use crate::openpra_mef::resolve::resolve_model_refs;
use crate::{PraxisError, Result};
use crate::openpra_mef::serialize::praxis_event_tree_graph::serialize_event_tree_library;
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};

#[derive(Clone)]
struct PathStep {
    source_event_tree_id: String,
    functional_event_id: String,
    state: String,
    path_probability: Option<f64>,
    collect_formula_negated: Option<bool>,
    house_event_assignments: HashMap<String, bool>,
}

#[derive(Clone)]
struct PathLeaf {
    terminal_event_tree_id: String,
    sequence_id: String,
    path_signature: Vec<PathStep>,
}

#[derive(Clone)]
struct ReferenceEdge {
    source_element: &'static str,
    source_id: String,
    target_type: &'static str,
    target_id: String,
    source_path: String,
}

#[derive(Default)]
struct IrSymbolTables {
    model_id: Option<String>,
    fault_trees: HashSet<String>,
    basic_events: HashSet<String>,
    gates_by_fault_tree: HashMap<String, HashSet<String>>,
    house_events_by_fault_tree: HashMap<String, HashSet<String>>,
    initiating_events: HashSet<String>,
    event_trees: HashSet<String>,
    sequences_by_event_tree: HashMap<String, HashSet<String>>,
    functional_events_by_event_tree: HashMap<String, HashSet<String>>,
    named_branches_by_event_tree: HashMap<String, HashSet<String>>,
}

#[derive(Default)]
struct IrReferenceIndex {
    edges: Vec<ReferenceEdge>,
}

struct OpenPsaConversionIr {
    model: Model,
    initiating_events: Vec<InitiatingEvent>,
    event_trees: Vec<EventTree>,
    symbol_tables: IrSymbolTables,
    reference_index: IrReferenceIndex,
}

pub fn parse_openpsa_xml(xml: &str) -> Result<OpenPraJsonBundle> {
    parse_openpsa_xml_with_mode(xml, ResolveMode::Compatible)
}

pub fn parse_openpsa_xml_with_mode(xml: &str, mode: ResolveMode) -> Result<OpenPraJsonBundle> {
    let (ir, mut diagnostics) = parse_openpsa_xml_to_ir(xml)?;

    let (openpra_model, mut conversion_diagnostics) =
        convert_parsed_to_openpra_model(&ir.model, &ir.initiating_events, &ir.event_trees);
    diagnostics.append(&mut conversion_diagnostics);

    let mut openpra_model = openpra_model;
    normalize_openpra_model(&mut openpra_model);
    openpra_model.metadata = Some(converter_role_boundaries_metadata(&ir));

    let (_registry, placeholders, mut resolve_diagnostics) = resolve_model_refs(&openpra_model, mode);
    diagnostics.append(&mut resolve_diagnostics);

    if mode == ResolveMode::Strict && diagnostics.iter().any(|diagnostic| diagnostic.severity == Severity::Error)
    {
        return Err(PraxisError::Settings(
            "OpenPSA conversion strict-mode reference resolution failed with unresolved required edges"
                .to_string(),
        ));
    }

    Ok(OpenPraJsonBundle {
        model_id: openpra_model.id.clone(),
        model: Some(openpra_model),
        raw_json: None,
        placeholders,
        diagnostics,
    })
}

pub fn to_openpsa_xml(_outputs: &EngineOutputs) -> Result<String> {
    Err(PraxisError::Settings(
        "OpenPRA JSON model to OpenPSA XML bridge is not implemented yet".to_string(),
    ))
}

fn parse_openpsa_xml_to_ir(xml: &str) -> Result<(OpenPsaConversionIr, Vec<Diagnostic>)> {
    let parsed = parse_any_mef(xml)?;
    let (model, initiating_events, event_trees) = match parsed {
        ParsedInput::EventTreeModel(parsed) => {
            (parsed.model, parsed.initiating_events, parsed.event_trees)
        }
        ParsedInput::FaultTree(fault_tree) => {
            let mut model = Model::new(fault_tree.element().id().to_string())?;
            for basic_event in fault_tree.basic_events().values() {
                if model.get_basic_event(basic_event.element().id()).is_none() {
                    model.add_basic_event(basic_event.clone())?;
                }
            }
            model.add_fault_tree(fault_tree)?;
            (model, Vec::new(), Vec::new())
        }
    };

    let symbol_tables = build_symbol_tables(&model, &initiating_events, &event_trees);
    let reference_index = build_reference_index(&model, &initiating_events, &event_trees);

    let mut diagnostics = vec![Diagnostic::new(
        "CONV_IR_READY",
        Severity::Info,
        "OpenPSA parser IR built with symbol tables and reference index",
        "$.input",
    )
    .with_hint("IR validation runs before JSON mapping")];

    let unresolved = validate_ir_references(&symbol_tables, &reference_index);
    if !unresolved.is_empty() {
        let count = unresolved.len();
        diagnostics.extend(unresolved);
        return Err(PraxisError::Settings(format!(
            "OpenPSA IR referential integrity failed with {count} unresolved reference(s)"
        )));
    }

    Ok((
        OpenPsaConversionIr {
            model,
            initiating_events,
            event_trees,
            symbol_tables,
            reference_index,
        },
        diagnostics,
    ))
}

fn build_symbol_tables(
    model: &Model,
    initiating_events: &[InitiatingEvent],
    event_trees: &[EventTree],
) -> IrSymbolTables {
    let mut tables = IrSymbolTables {
        model_id: Some(model.element().id().to_string()),
        ..IrSymbolTables::default()
    };

    for basic_event_id in model.basic_events().keys() {
        tables.basic_events.insert(basic_event_id.clone());
    }

    for (fault_tree_id, fault_tree) in model.fault_trees() {
        tables.fault_trees.insert(fault_tree_id.clone());

        let mut gate_ids = HashSet::new();
        for gate_id in fault_tree.gates().keys() {
            gate_ids.insert(gate_id.clone());
        }
        tables
            .gates_by_fault_tree
            .insert(fault_tree_id.clone(), gate_ids);

        let mut house_event_ids = HashSet::new();
        for house_event_id in fault_tree.house_events().keys() {
            house_event_ids.insert(house_event_id.clone());
        }
        tables
            .house_events_by_fault_tree
            .insert(fault_tree_id.clone(), house_event_ids);

        for basic_event_id in fault_tree.basic_events().keys() {
            tables.basic_events.insert(basic_event_id.clone());
        }
    }

    for initiating_event in initiating_events {
        tables.initiating_events.insert(initiating_event.id.clone());
    }

    for event_tree in event_trees {
        tables.event_trees.insert(event_tree.id.clone());

        let mut sequence_ids = HashSet::new();
        for sequence_id in event_tree.sequences.keys() {
            sequence_ids.insert(sequence_id.clone());
        }
        tables
            .sequences_by_event_tree
            .insert(event_tree.id.clone(), sequence_ids);

        let mut functional_event_ids = HashSet::new();
        for functional_event_id in event_tree.functional_events.keys() {
            functional_event_ids.insert(functional_event_id.clone());
        }
        tables
            .functional_events_by_event_tree
            .insert(event_tree.id.clone(), functional_event_ids);

        let mut named_branch_ids = HashSet::new();
        for named_branch_id in event_tree.named_branches.keys() {
            named_branch_ids.insert(named_branch_id.clone());
        }
        tables
            .named_branches_by_event_tree
            .insert(event_tree.id.clone(), named_branch_ids);
    }

    tables
}

fn build_reference_index(
    model: &Model,
    initiating_events: &[InitiatingEvent],
    event_trees: &[EventTree],
) -> IrReferenceIndex {
    let mut index = IrReferenceIndex::default();

    for (fault_tree_id, fault_tree) in model.fault_trees() {
        for (gate_id, gate) in fault_tree.gates() {
            for operand in gate.operands() {
                index.edges.push(ReferenceEdge {
                    source_element: "systems-analysis",
                    source_id: gate_id.clone(),
                    target_type: "fault-tree-node",
                    target_id: operand.clone(),
                    source_path: format!(
                        "$.openpsa.define-fault-tree['{}'].define-gate['{}'].operand['{}']",
                        fault_tree_id, gate_id, operand
                    ),
                });
            }
        }
    }

    for initiating_event in initiating_events {
        if let Some(event_tree_id) = &initiating_event.event_tree_id {
            index.edges.push(ReferenceEdge {
                source_element: "initiating-event-analysis",
                source_id: initiating_event.id.clone(),
                target_type: "event-tree",
                target_id: event_tree_id.clone(),
                source_path: format!(
                    "$.openpsa.define-initiating-event['{}'].event-tree['{}']",
                    initiating_event.id, event_tree_id
                ),
            });
        }

        if let Some(fault_tree_id) = &initiating_event.fault_tree_id {
            index.edges.push(ReferenceEdge {
                source_element: "initiating-event-analysis",
                source_id: initiating_event.id.clone(),
                target_type: "fault-tree",
                target_id: fault_tree_id.clone(),
                source_path: format!(
                    "$.openpsa.define-initiating-event['{}'].fault-tree['{}']",
                    initiating_event.id, fault_tree_id
                ),
            });
        }
    }

    for event_tree in event_trees {
        for sequence in event_tree.sequences.values() {
            if let Some(linked_event_tree_id) = &sequence.linked_event_tree_id {
                index.edges.push(ReferenceEdge {
                    source_element: "event-sequence-analysis",
                    source_id: sequence.id.clone(),
                    target_type: "event-tree",
                    target_id: linked_event_tree_id.clone(),
                    source_path: format!(
                        "$.openpsa.define-event-tree['{}'].define-sequence['{}'].event-tree['{}']",
                        event_tree.id, sequence.id, linked_event_tree_id
                    ),
                });
            }
        }

        collect_branch_references(
            &event_tree.initial_state,
            event_tree,
            &mut index,
            &mut HashSet::new(),
        );
    }

    index
}

fn collect_branch_references(
    branch: &Branch,
    event_tree: &EventTree,
    index: &mut IrReferenceIndex,
    visited_named_branches: &mut HashSet<String>,
) {
    match &branch.target {
        BranchTarget::Sequence(sequence_id) => {
            index.edges.push(ReferenceEdge {
                source_element: "event-sequence-analysis",
                source_id: event_tree.id.clone(),
                target_type: "sequence",
                target_id: sequence_id.clone(),
                source_path: format!(
                    "$.openpsa.define-event-tree['{}'].branch.sequence['{}']",
                    event_tree.id, sequence_id
                ),
            });
        }
        BranchTarget::Fork(fork) => {
            index.edges.push(ReferenceEdge {
                source_element: "event-sequence-analysis",
                source_id: event_tree.id.clone(),
                target_type: "functional-event",
                target_id: fork.functional_event_id.clone(),
                source_path: format!(
                    "$.openpsa.define-event-tree['{}'].fork.functional-event['{}']",
                    event_tree.id, fork.functional_event_id
                ),
            });

            for path in &fork.paths {
                collect_branch_references(&path.branch, event_tree, index, visited_named_branches);
            }
        }
        BranchTarget::NamedBranch(named_branch_id) => {
            index.edges.push(ReferenceEdge {
                source_element: "event-sequence-analysis",
                source_id: event_tree.id.clone(),
                target_type: "named-branch",
                target_id: named_branch_id.clone(),
                source_path: format!(
                    "$.openpsa.define-event-tree['{}'].named-branch['{}']",
                    event_tree.id, named_branch_id
                ),
            });

            if visited_named_branches.insert(named_branch_id.clone()) {
                if let Some(named_branch) = event_tree.named_branches.get(named_branch_id) {
                    collect_branch_references(
                        &named_branch.branch,
                        event_tree,
                        index,
                        visited_named_branches,
                    );
                }
            }
        }
    }
}

fn validate_ir_references(
    symbol_tables: &IrSymbolTables,
    reference_index: &IrReferenceIndex,
) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();

    for edge in &reference_index.edges {
        let resolved = match edge.target_type {
            "fault-tree-node" => resolves_fault_tree_operand(symbol_tables, &edge.target_id),
            "fault-tree" => symbol_tables.fault_trees.contains(&edge.target_id),
            "event-tree" => symbol_tables.event_trees.contains(&edge.target_id),
            "sequence" => symbol_tables
                .sequences_by_event_tree
                .values()
                .any(|sequence_ids| sequence_ids.contains(&edge.target_id)),
            "functional-event" => symbol_tables
                .functional_events_by_event_tree
                .values()
                .any(|functional_event_ids| functional_event_ids.contains(&edge.target_id)),
            "named-branch" => symbol_tables
                .named_branches_by_event_tree
                .values()
                .any(|named_branch_ids| named_branch_ids.contains(&edge.target_id)),
            _ => true,
        };

        if !resolved {
            diagnostics.push(
                Diagnostic::new(
                    "CONV_IR_UNRESOLVED_REF",
                    Severity::Error,
                    format!(
                        "Unresolved {} reference '{}' from {} '{}'",
                        edge.target_type, edge.target_id, edge.source_element, edge.source_id
                    ),
                    edge.source_path.clone(),
                )
                .with_ref_context(
                    edge.source_element,
                    edge.source_id.clone(),
                    edge.target_type,
                    edge.target_id.clone(),
                )
                .with_hint("Fix XML cross-references or run converter in compatible mode after mapping support is added"),
            );
        }
    }

    diagnostics
}

fn resolves_fault_tree_operand(symbol_tables: &IrSymbolTables, operand: &str) -> bool {
    if symbol_tables.basic_events.contains(operand) {
        return true;
    }

    if symbol_tables
        .gates_by_fault_tree
        .values()
        .any(|gate_ids| gate_ids.contains(operand))
    {
        return true;
    }

    if symbol_tables
        .house_events_by_fault_tree
        .values()
        .any(|house_event_ids| house_event_ids.contains(operand))
    {
        return true;
    }

    if let Some((fault_tree_id, gate_id)) = operand.split_once('.') {
        if let Some(gate_ids) = symbol_tables.gates_by_fault_tree.get(fault_tree_id) {
            return gate_ids.contains(gate_id);
        }
    }

    false
}

fn convert_parsed_to_openpra_model(
    model: &Model,
    initiating_events: &[InitiatingEvent],
    event_trees: &[EventTree],
) -> (OpenPraJsonModel, Vec<Diagnostic>) {
    let mut diagnostics = Vec::new();

    let data_parameters = collect_data_parameters_from_model(model, &mut diagnostics);

    let mut fault_tree_ids: Vec<String> = model.fault_trees().keys().cloned().collect();
    fault_tree_ids.sort();
    let known_fault_trees: HashSet<String> = fault_tree_ids.iter().cloned().collect();
    let known_data_parameter_ids: HashSet<String> = data_parameters.iter().map(|x| x.id.clone()).collect();

    let mut system_definitions = Vec::new();
    let mut system_logic_models = Vec::new();
    let mut common_cause_failure_groups = Vec::new();
    let mut system_dependencies: Vec<SystemDependency> = Vec::new();

    for fault_tree_id in &fault_tree_ids {
        if let Some(fault_tree) = model.get_fault_tree(fault_tree_id) {
            if fault_tree.gates().len() > 1 {
                diagnostics.push(
                    Diagnostic::new(
                        "CONV_PARTIAL_FAULT_TREE_GRAPH",
                        Severity::Warning,
                        format!(
                            "Fault tree '{}' contains {} gates; converter currently emits a reduced root-level SA logic model",
                            fault_tree_id,
                            fault_tree.gates().len()
                        ),
                        "$.input",
                    )
                    .with_ref_context(
                        "systems-analysis",
                        format!("SYS::{fault_tree_id}"),
                        "fault-tree",
                        fault_tree_id.clone(),
                    )
                    .with_hint("Full multi-gate graph export is tracked in converter TODO section 3 (Systems Analysis mapping)"),
                );
            }

            let house_event_refs = house_event_refs_from_fault_tree(fault_tree);

            system_definitions.push(SystemDefinition {
                id: format!("SYS::{fault_tree_id}"),
                name: fault_tree.element().name().map(|name| name.to_string()),
                fault_tree_id: Some(fault_tree_id.clone()),
                component_refs: basic_event_refs_from_fault_tree(fault_tree),
                additional_fields: HashMap::from([
                    ("topEventRef".to_string(), json!(fault_tree.top_event())),
                    ("houseEventRefs".to_string(), json!(house_event_refs.clone())),
                    (
                        "sourceIdentifier".to_string(),
                        json!(fault_tree.element().id()),
                    ),
                ]),
                ..SystemDefinition::default()
            });

            if let Some(system_definition) = system_definitions.last_mut() {
                if let Some(source_name) = fault_tree.element().name() {
                    system_definition
                        .additional_fields
                        .insert("sourceName".to_string(), json!(source_name));
                }
                if let Some(source_label) = fault_tree.element().label() {
                    system_definition
                        .additional_fields
                        .insert("sourceLabel".to_string(), json!(source_label));
                    system_definition
                        .additional_fields
                        .insert("sourceDescription".to_string(), json!(source_label));
                }
            }

            let model_type = fault_tree
                .get_gate(fault_tree.top_event())
                .map(|gate| formula_to_model_type(gate.formula()))
                .or(Some("or".to_string()));

            let mut basic_event_refs: Vec<String> = fault_tree.basic_events().keys().cloned().collect();
            basic_event_refs.sort();

            let mut gate_refs: Vec<String> = fault_tree.gates().keys().cloned().collect();
            gate_refs.sort();

            let gate_catalog = gate_catalog_json(fault_tree);
            let house_event_catalog = house_event_catalog_json(fault_tree);
            let mut logic_additional_fields = HashMap::new();
            logic_additional_fields.insert("gateCatalog".to_string(), gate_catalog);
            logic_additional_fields.insert(
                "houseEventRefs".to_string(),
                json!(house_event_refs),
            );
            logic_additional_fields.insert(
                "houseEventCatalog".to_string(),
                house_event_catalog,
            );
            if let Some(top_gate) = fault_tree.get_gate(fault_tree.top_event()) {
                logic_additional_fields.insert(
                    "rootGateFormula".to_string(),
                    json!(formula_to_model_type(top_gate.formula())),
                );
                logic_additional_fields.insert(
                    "rootGateOperands".to_string(),
                    json!(top_gate.operands()),
                );
                logic_additional_fields.insert(
                    "rootGateSourceIdentifier".to_string(),
                    json!(top_gate.element().id()),
                );
                if let Some(root_gate_name) = top_gate.element().name() {
                    logic_additional_fields
                        .insert("rootGateName".to_string(), json!(root_gate_name));
                }
                if let Some(root_gate_label) = top_gate.element().label() {
                    logic_additional_fields
                        .insert("rootGateLabel".to_string(), json!(root_gate_label));
                    logic_additional_fields.insert(
                        "rootGateDescription".to_string(),
                        json!(root_gate_label),
                    );
                }
            }

            system_logic_models.push(SystemLogicModel {
                id: fault_tree_id.clone(),
                model_type,
                root_ref: Some(fault_tree.top_event().to_string()),
                basic_event_refs,
                gate_refs,
                additional_fields: logic_additional_fields,
                ..SystemLogicModel::default()
            });

            collect_system_dependencies(
                fault_tree_id,
                fault_tree,
                &known_fault_trees,
                &mut system_dependencies,
            );

            let mut ccf_ids: Vec<String> = fault_tree.ccf_groups().keys().cloned().collect();
            ccf_ids.sort();
            for ccf_id in ccf_ids {
                if let Some(group) = fault_tree.get_ccf_group(&ccf_id) {
                    common_cause_failure_groups.push(SystemsCcfGroup {
                        id: ccf_id,
                        members: group.members.clone(),
                        model: Some(ccf_model_name(&group.model).to_string()),
                        additional_fields: HashMap::from([(
                            "sourceFaultTreeId".to_string(),
                            json!(fault_tree_id),
                        )]),
                        ..SystemsCcfGroup::default()
                    });
                }
            }
        }
    }

    let mut event_tree_by_id: HashMap<String, &EventTree> = HashMap::new();
    for event_tree in event_trees {
        event_tree_by_id.insert(event_tree.id.clone(), event_tree);

        let unmapped = collect_unmapped_event_tree_features(event_tree);
        if unmapped.sequence_instruction_count > 0 {
            diagnostics.push(
                Diagnostic::new(
                    "CONV_UNMAPPED_SEQUENCE_INSTRUCTIONS",
                    Severity::Warning,
                    format!(
                        "Event tree '{}' contains {} sequence instructions not yet represented in converted ESA output",
                        event_tree.id, unmapped.sequence_instruction_count
                    ),
                    "$.input",
                )
                .with_ref_context(
                    "event-sequence-analysis",
                    event_tree.id.clone(),
                    "sequence-instructions",
                    event_tree.id.clone(),
                )
                .with_hint("Sequence instruction mapping is pending under converter TODO section 3"),
            );
        }

        if unmapped.branch_instruction_count > 0 {
            diagnostics.push(
                Diagnostic::new(
                    "CONV_UNMAPPED_BRANCH_INSTRUCTIONS",
                    Severity::Warning,
                    format!(
                        "Event tree '{}' contains {} branch instructions not yet represented in converted ESA output",
                        event_tree.id, unmapped.branch_instruction_count
                    ),
                    "$.input",
                )
                .with_ref_context(
                    "event-sequence-analysis",
                    event_tree.id.clone(),
                    "branch-instructions",
                    event_tree.id.clone(),
                )
                .with_hint("Branch instruction mapping is pending under converter TODO section 3"),
            );
        }

    }

    let effective_initiators = if initiating_events.is_empty() && !event_trees.is_empty() {
        let mut synthetic = InitiatingEvent::new("IE::auto-generated".to_string());
        synthetic.probability = Some(1.0);
        synthetic.event_tree_id = Some(event_trees[0].id.clone());
        diagnostics.push(
            Diagnostic::new(
                "CONV_SYNTHETIC_INITIATOR",
                Severity::Warning,
                "No initiating events found in XML; generated synthetic initiator for event-tree traversal",
                "$.input",
            )
            .with_hint("Provide <define-initiating-event> entries in source XML to avoid auto-generation"),
        );
        vec![synthetic]
    } else {
        initiating_events.to_vec()
    };

    let mut initiators = Vec::new();
    let mut event_sequences = Vec::new();
    let mut quantification_results = Vec::new();
    let mut esq_source_rows = 0usize;
    let mut esq_placeholder_rows = 0usize;

    for initiator in &effective_initiators {
        let primary_event_tree_id = initiator
            .event_tree_id
            .clone()
            .or_else(|| event_trees.first().map(|x| x.id.clone()));
        let reachable_tree_ids = primary_event_tree_id
            .as_ref()
            .map(|primary_tree_id| collect_reachable_event_tree_ids(primary_tree_id, &event_tree_by_id));

        let mut mapped_initiator = Initiator {
            id: initiator.id.clone(),
            name: initiator.name.clone(),
            frequency: initiator.frequency,
            probability: initiator.probability,
            ..Initiator::default()
        };

        if mapped_initiator.frequency.is_none() && mapped_initiator.probability.is_none() {
            mapped_initiator.probability = Some(1.0);
        }

        if let Some(fault_tree_id) = &initiator.fault_tree_id {
            if let Some(normalized_fault_tree_id) =
                normalize_fault_tree_ref(fault_tree_id, &known_fault_trees)
            {
                mapped_initiator
                    .system_refs
                    .push(format!("SYS::{normalized_fault_tree_id}"));

                mapped_initiator.data_parameter_refs.extend(
                    collect_data_parameter_refs_for_fault_tree(
                        model,
                        &normalized_fault_tree_id,
                        &known_data_parameter_ids,
                    ),
                );

                mapped_initiator.additional_fields.insert(
                    "sourceFaultTreeId".to_string(),
                    serde_json::Value::String(fault_tree_id.clone()),
                );
            }
        }

        if known_data_parameter_ids.contains(&initiator.id) {
            mapped_initiator
                .data_parameter_refs
                .push(initiator.id.clone());
        }

        if let Some(primary_tree_id) = &primary_event_tree_id {
            mapped_initiator.additional_fields.insert(
                "sourceEventTreeId".to_string(),
                serde_json::Value::String(primary_tree_id.clone()),
            );
        }

        mapped_initiator.additional_fields.insert(
            "sourceIdentifier".to_string(),
            json!(initiator.id.clone()),
        );
        if let Some(source_name) = &initiator.name {
            mapped_initiator
                .additional_fields
                .insert("sourceName".to_string(), json!(source_name));
        }
        if mapped_initiator.frequency.is_some() {
            mapped_initiator
                .additional_fields
                .insert("frequencyUnit".to_string(), json!("per-year"));
        }
        if mapped_initiator.probability.is_some() {
            mapped_initiator
                .additional_fields
                .insert("probabilityUnit".to_string(), json!("probability"));
        }

        if let Some(source_tree_refs) = &reachable_tree_ids {
            mapped_initiator.additional_fields.insert(
                "sourceEventTreeRefs".to_string(),
                json!(source_tree_refs),
            );
        }

        mapped_initiator.system_refs.sort();
        mapped_initiator.system_refs.dedup();
        mapped_initiator.data_parameter_refs.sort();
        mapped_initiator.data_parameter_refs.dedup();

        let mapped_initiator_frequency = mapped_initiator.frequency;
        let mapped_initiator_probability = mapped_initiator.probability;

        initiators.push(mapped_initiator);

        let Some(primary_tree_id) = primary_event_tree_id else {
            continue;
        };

        let Some(primary_event_tree) = event_tree_by_id.get(&primary_tree_id).copied() else {
            diagnostics.push(
                Diagnostic::new(
                    "CONV_MISSING_EVENT_TREE",
                    Severity::Warning,
                    format!(
                        "Initiator '{}' references missing event tree '{primary_tree_id}'",
                        initiator.id
                    ),
                    "$.input",
                )
                .with_ref_context(
                    "initiating-event-analysis",
                    initiator.id.clone(),
                    "event-tree",
                    primary_tree_id,
                ),
            );
            continue;
        };

        let mut leaves = Vec::new();
        let mut active_tree_stack: HashSet<String> = HashSet::from([primary_event_tree.id.clone()]);
        collect_terminal_leaves(
            &primary_event_tree.id,
            &primary_event_tree.id,
            &primary_event_tree.initial_state,
            &event_tree_by_id,
            &[],
            &HashMap::new(),
            &mut active_tree_stack,
            &mut leaves,
            &mut diagnostics,
        );

        for leaf in leaves {
            let Some(terminal_tree) = event_tree_by_id
                .get(&leaf.terminal_event_tree_id)
                .copied()
            else {
                diagnostics.push(
                    Diagnostic::new(
                        "CONV_MISSING_EVENT_TREE",
                        Severity::Warning,
                        format!(
                            "Path leaf references missing event tree '{}'",
                            leaf.terminal_event_tree_id
                        ),
                        "$.input",
                    )
                    .with_ref_context(
                        "event-sequence-analysis",
                        initiator.id.clone(),
                        "event-tree",
                        leaf.terminal_event_tree_id.clone(),
                    ),
                );
                continue;
            };

            let Some(sequence) = terminal_tree.sequences.get(&leaf.sequence_id) else {
                    diagnostics.push(
                        Diagnostic::new(
                            "CONV_MISSING_SEQUENCE",
                            Severity::Warning,
                            format!(
                                "Path leaf references sequence '{}' not found in event tree '{}'",
                                leaf.sequence_id, leaf.terminal_event_tree_id
                            ),
                            "$.input",
                        )
                        .with_ref_context(
                            "event-sequence-analysis",
                            leaf.sequence_id.clone(),
                            "sequence",
                            leaf.terminal_event_tree_id.clone(),
                        ),
                    );
                    continue;
            };

            let path_signature_key = leaf
                .path_signature
                .iter()
                .map(|step| {
                    let mut assignment_rows: Vec<String> = step
                        .house_event_assignments
                        .iter()
                        .map(|(house_event_id, state)| format!("{house_event_id}={state}"))
                        .collect();
                    assignment_rows.sort();
                    let assignment_signature = assignment_rows.join(",");

                    format!(
                        "{}:{}:{}:{}:{}",
                        step.source_event_tree_id,
                        step.functional_event_id,
                        step.state,
                        step.collect_formula_negated.unwrap_or(false),
                        assignment_signature,
                    )
                })
                .collect::<Vec<_>>()
                .join(">");

            let sequence_id = deterministic_generated_id(
                "SEQ",
                &[
                    initiator.id.as_str(),
                    primary_event_tree.id.as_str(),
                    leaf.terminal_event_tree_id.as_str(),
                    leaf.sequence_id.as_str(),
                    path_signature_key.as_str(),
                ],
            );
            let mut bindings = Vec::new();

            for (step_index, step) in leaf.path_signature.iter().enumerate() {
                let functional_event_tree = event_tree_by_id
                    .get(&step.source_event_tree_id)
                    .copied();
                let Some(functional_event) = functional_event_tree
                    .and_then(|tree| tree.functional_events.get(&step.functional_event_id))
                else {
                        diagnostics.push(
                            Diagnostic::new(
                                "CONV_MISSING_FUNCTIONAL_EVENT",
                                Severity::Warning,
                                format!(
                                    "Path references missing functional event '{}' in event tree '{}'",
                                    step.functional_event_id, step.source_event_tree_id
                                ),
                                "$.input",
                            )
                            .with_ref_context(
                                "event-sequence-analysis",
                                sequence_id.clone(),
                                "functional-event",
                                step.functional_event_id.clone(),
                            ),
                        );
                        continue;
                };

                let step_index_str = step_index.to_string();
                let negated_str = step.collect_formula_negated.unwrap_or(false).to_string();
                let binding_id = deterministic_generated_id(
                    "FEB",
                    &[
                        sequence_id.as_str(),
                        step.source_event_tree_id.as_str(),
                        functional_event.id.as_str(),
                        step.state.as_str(),
                        step_index_str.as_str(),
                        negated_str.as_str(),
                    ],
                );

                let mut binding = map_functional_binding(
                    binding_id,
                    functional_event,
                    &known_fault_trees,
                    &known_data_parameter_ids,
                );

                binding
                    .additional_fields
                    .insert("pathState".to_string(), json!(step.state.clone()));
                binding
                    .additional_fields
                    .insert("stepIndex".to_string(), json!(step_index));
                binding.additional_fields.insert(
                    "functionalEventTreeId".to_string(),
                    json!(step.source_event_tree_id.clone()),
                );
                if let Some(negated) = step.collect_formula_negated {
                    binding
                        .additional_fields
                        .insert("collectFormulaNegated".to_string(), json!(negated));
                }
                if let Some(path_probability) = step.path_probability {
                    binding
                        .additional_fields
                        .insert("pathProbability".to_string(), json!(path_probability));
                }
                if functional_event.order != 0 {
                    binding
                        .additional_fields
                        .insert("functionalEventOrder".to_string(), json!(functional_event.order));
                }

                bindings.push(binding);
            }

            let mut additional_fields = HashMap::new();
            let path_signature: Vec<serde_json::Value> = leaf
                .path_signature
                .iter()
                .map(|step| {
                    json!({
                        "functionalEventTreeId": step.source_event_tree_id,
                        "functionalEventId": step.functional_event_id,
                        "state": step.state,
                        "pathProbability": step.path_probability,
                        "collectFormulaNegated": step.collect_formula_negated,
                        "houseEventAssignments": step.house_event_assignments,
                    })
                })
                .collect();
            additional_fields.insert("pathSignature".to_string(), serde_json::Value::Array(path_signature));
            additional_fields.insert(
                "sourceEventTreeId".to_string(),
                serde_json::Value::String(primary_event_tree.id.clone()),
            );
            additional_fields.insert(
                "terminalEventTreeId".to_string(),
                serde_json::Value::String(leaf.terminal_event_tree_id.clone()),
            );
            additional_fields.insert(
                "sourceSequenceId".to_string(),
                serde_json::Value::String(leaf.sequence_id.clone()),
            );
            additional_fields.insert(
                "sourceIdentifier".to_string(),
                serde_json::Value::String(leaf.sequence_id.clone()),
            );

            let linked_sequence_ids = sequence
                .linked_event_tree_id
                .as_ref()
                .map(|x| vec![x.clone()])
                .unwrap_or_default();
            additional_fields.insert(
                "linkedEventTreeRefs".to_string(),
                json!(linked_sequence_ids.clone()),
            );

            event_sequences.push(EventSequence {
                id: sequence_id.clone(),
                name: sequence.name.clone().or_else(|| Some(leaf.sequence_id.clone())),
                initiating_event_id: Some(initiator.id.clone()),
                functional_event_bindings: bindings,
                linked_sequence_ids,
                additional_fields,
                ..EventSequence::default()
            });

            if let Some(sequence_row) = event_sequences.last_mut() {
                if let Some(source_name) = &sequence.name {
                    sequence_row
                        .additional_fields
                        .insert("sourceName".to_string(), json!(source_name));
                }
            }

                let path_probability_product = leaf
                    .path_signature
                    .iter()
                    .map(|step| step.path_probability)
                    .collect::<Option<Vec<_>>>()
                    .map(|values| values.into_iter().product::<f64>());

            let mut quantification_additional_fields = HashMap::new();
            quantification_additional_fields
                .insert("sourceEventTreeId".to_string(), json!(primary_event_tree.id.clone()));
            quantification_additional_fields
                .insert("terminalEventTreeId".to_string(), json!(leaf.terminal_event_tree_id.clone()));
                quantification_additional_fields
                    .insert("sourceSequenceId".to_string(), json!(leaf.sequence_id.clone()));
                quantification_additional_fields
                    .insert("sourceIdentifier".to_string(), json!(leaf.sequence_id.clone()));

                let (baseline_frequency, baseline_probability) =
                    if let Some(path_product) = path_probability_product {
                        esq_source_rows += 1;
                        quantification_additional_fields
                            .insert("baselineSource".to_string(), json!("path-probability"));
                        quantification_additional_fields.insert(
                            "pathProbabilityProduct".to_string(),
                            json!(path_product),
                        );

                        let baseline_frequency =
                            mapped_initiator_frequency.map(|frequency| frequency * path_product);
                        let baseline_probability = mapped_initiator_probability
                            .map(|probability| probability * path_product);
                        (baseline_frequency, baseline_probability)
                    } else {
                        esq_placeholder_rows += 1;
                        quantification_additional_fields
                            .insert("baselineSource".to_string(), json!("placeholder"));
                        quantification_additional_fields.insert(
                            "placeholderReason".to_string(),
                            json!("no-explicit-path-probabilities"),
                        );
                        (Some(0.0), None)
                    };

            let quantification_id = deterministic_generated_id(
                "QR",
                &[sequence_id.as_str(), initiator.id.as_str()],
            );
            quantification_results.push(QuantificationResult {
                id: quantification_id,
                event_sequence_id: Some(sequence_id),
                initiating_event_id: Some(initiator.id.clone()),
                frequency: baseline_frequency,
                probability: baseline_probability,
                additional_fields: quantification_additional_fields,
                ..QuantificationResult::default()
            });
        }
    }

    if esq_placeholder_rows > 0 {
        diagnostics.push(
            Diagnostic::new(
                "CONV_ESQ_BASELINE_PLACEHOLDER",
                Severity::Info,
                format!(
                    "Generated {} ESQ baseline placeholder row(s) without source path probabilities",
                    esq_placeholder_rows
                ),
                "$.input",
            )
            .with_ref_context(
                "event-sequence-quantification",
                "ESQ::xml-converted",
                "baseline",
                "placeholder",
            )
            .with_hint(
                "Provide path probabilities in source event-tree definitions to seed ESQ baseline values",
            ),
        );
    }

    if esq_source_rows > 0 {
        diagnostics.push(
            Diagnostic::new(
                "CONV_ESQ_BASELINE_FROM_SOURCE",
                Severity::Info,
                format!(
                    "Generated {} ESQ baseline row(s) from source path probabilities",
                    esq_source_rows
                ),
                "$.input",
            )
            .with_ref_context(
                "event-sequence-quantification",
                "ESQ::xml-converted",
                "baseline",
                "path-probability",
            ),
        );
    }

    event_sequences.sort_by(|a, b| a.id.cmp(&b.id));
    quantification_results.sort_by(|a, b| a.id.cmp(&b.id));
    initiators.sort_by(|a, b| a.id.cmp(&b.id));
    system_dependencies.sort_by(|a, b| a.id.cmp(&b.id));

    let scope_definition = ScopeDefinition {
        initiating_event_ids: initiators.iter().map(|x| x.id.clone()).collect(),
        event_sequence_ids: event_sequences.iter().map(|x| x.id.clone()).collect(),
    };

    let technical_elements = TechnicalElements {
        data_analysis: Some(DataAnalysisJsonModel {
            id: Some("DA::xml-converted".to_string()),
            data_parameters,
            ..DataAnalysisJsonModel::default()
        }),
        systems_analysis: Some(SystemsAnalysisJsonModel {
            id: Some("SA::xml-converted".to_string()),
            system_definitions,
            system_logic_models,
            common_cause_failure_groups,
            system_dependencies,
            ..SystemsAnalysisJsonModel::default()
        }),
        initiating_event_analysis: Some(InitiatingEventAnalysisJsonModel {
            id: Some("IEA::xml-converted".to_string()),
            initiators,
            ..InitiatingEventAnalysisJsonModel::default()
        }),
        event_sequence_analysis: Some(EventSequenceAnalysisJsonModel {
            id: Some("ESA::xml-converted".to_string()),
            event_sequences,
            scope_definition: Some(scope_definition),
            ..EventSequenceAnalysisJsonModel::default()
        }),
        event_sequence_quantification: Some(EventSequenceQuantificationJsonModel {
            id: Some("ESQ::xml-converted".to_string()),
            quantification_results,
            ..EventSequenceQuantificationJsonModel::default()
        }),
        risk_integration: Some(RiskIntegrationJsonModel {
            id: Some("RI::xml-converted".to_string()),
            placeholder_used: true,
            placeholder_reason: Some(
                "Risk Integration execution remains placeholder where Praxis capabilities are not yet available"
                    .to_string(),
            ),
            ..RiskIntegrationJsonModel::default()
        }),
        ..TechnicalElements::default()
    };

    let mut openpra_model = OpenPraJsonModel {
        id: Some(model.element().id().to_string()),
        technical_elements,
        ..OpenPraJsonModel::default()
    };

    if !event_trees.is_empty() {
        if let Some(esa) = openpra_model.technical_elements.event_sequence_analysis.as_mut() {
            esa.additional_fields.insert(
                "praxisEventTreeLibrary".to_string(),
                serialize_event_tree_library(event_trees),
            );
        }
    }

    (openpra_model, diagnostics)
}

fn normalize_openpra_model(model: &mut OpenPraJsonModel) {
    if let Some(da) = model.technical_elements.data_analysis.as_mut() {
        da.data_parameters.sort_by(|a, b| a.id.cmp(&b.id));
        for parameter in &mut da.data_parameters {
            parameter.probability = normalize_optional_number(parameter.probability);
            parameter.frequency = normalize_optional_number(parameter.frequency);
            parameter.metadata_refs.sort_by(|a, b| a.id.cmp(&b.id));
            if let Some(Value::Array(source_rows)) = parameter.additional_fields.get_mut("sourceProvenance") {
                source_rows.sort_by(|a, b| {
                    let a_path = a
                        .get("sourcePath")
                        .and_then(|value| value.as_str())
                        .unwrap_or_default();
                    let b_path = b
                        .get("sourcePath")
                        .and_then(|value| value.as_str())
                        .unwrap_or_default();
                    a_path.cmp(b_path)
                });
            }
        }
    }

    if let Some(sa) = model.technical_elements.systems_analysis.as_mut() {
        sa.system_definitions.sort_by(|a, b| a.id.cmp(&b.id));
        for definition in &mut sa.system_definitions {
            definition.component_refs.sort();
            definition.component_refs.dedup();
        }

        sa.system_logic_models.sort_by(|a, b| a.id.cmp(&b.id));
        for logic_model in &mut sa.system_logic_models {
            logic_model.basic_event_refs.sort();
            logic_model.basic_event_refs.dedup();
            logic_model.gate_refs.sort();
            logic_model.gate_refs.dedup();
        }

        sa.common_cause_failure_groups.sort_by(|a, b| a.id.cmp(&b.id));
        for group in &mut sa.common_cause_failure_groups {
            group.members.sort();
            group.members.dedup();
        }

        sa.system_dependencies.sort_by(|a, b| a.id.cmp(&b.id));
    }

    if let Some(iea) = model.technical_elements.initiating_event_analysis.as_mut() {
        iea.initiators.sort_by(|a, b| a.id.cmp(&b.id));
        for initiator in &mut iea.initiators {
            initiator.frequency = normalize_optional_number(initiator.frequency);
            initiator.probability = normalize_optional_number(initiator.probability);
            initiator.system_refs.sort();
            initiator.system_refs.dedup();
            initiator.data_parameter_refs.sort();
            initiator.data_parameter_refs.dedup();
        }

        iea.initiating_event_groups.sort_by(|a, b| a.id.cmp(&b.id));
        for group in &mut iea.initiating_event_groups {
            group.members.sort();
            group.members.dedup();
        }
    }

    if let Some(esa) = model.technical_elements.event_sequence_analysis.as_mut() {
        esa.event_sequences.sort_by(|a, b| a.id.cmp(&b.id));
        for sequence in &mut esa.event_sequences {
            sequence.family_ids.sort();
            sequence.family_ids.dedup();
            sequence.linked_sequence_ids.sort();
            sequence.linked_sequence_ids.dedup();

            sequence
                .functional_event_bindings
                .sort_by(|a, b| a.id.cmp(&b.id));
            for binding in &mut sequence.functional_event_bindings {
                binding.success_probability = normalize_optional_number(binding.success_probability);
            }
        }

        if let Some(scope) = esa.scope_definition.as_mut() {
            scope.initiating_event_ids.sort();
            scope.initiating_event_ids.dedup();
            scope.event_sequence_ids.sort();
            scope.event_sequence_ids.dedup();
        }

        esa.event_sequence_families.sort_by(|a, b| a.id.cmp(&b.id));
        for family in &mut esa.event_sequence_families {
            family.sequence_ids.sort();
            family.sequence_ids.dedup();
        }

        esa.release_category_mappings.sort_by(|a, b| a.id.cmp(&b.id));
    }

    if let Some(esq) = model
        .technical_elements
        .event_sequence_quantification
        .as_mut()
    {
        esq.quantification_results.sort_by(|a, b| a.id.cmp(&b.id));
        for result in &mut esq.quantification_results {
            result.frequency = normalize_optional_number(result.frequency);
            result.probability = normalize_optional_number(result.probability);
        }

        esq.event_sequence_families.sort_by(|a, b| a.id.cmp(&b.id));
        for family in &mut esq.event_sequence_families {
            family.sequence_ids.sort();
            family.sequence_ids.dedup();
        }

        esq.quantification_methods.sort_by(|a, b| a.id.cmp(&b.id));
    }
}

fn normalize_optional_number(value: Option<f64>) -> Option<f64> {
    value.map(normalize_number)
}

fn normalize_number(value: f64) -> f64 {
    if value == 0.0 {
        0.0
    } else {
        (value * 1_000_000_000_000.0).round() / 1_000_000_000_000.0
    }
}

fn collect_data_parameters_from_model(
    model: &Model,
    diagnostics: &mut Vec<Diagnostic>,
) -> Vec<DataParameter> {
    let mut data_parameters: HashMap<String, DataParameter> = HashMap::new();

    for (id, basic_event) in model.basic_events() {
        upsert_data_parameter(
            &mut data_parameters,
            diagnostics,
            id,
            basic_event,
            "model-data",
            model.element().id(),
            format!("$.openpsa.model-data.define-basic-event['{id}']"),
        );
    }

    for (fault_tree_id, fault_tree) in model.fault_trees() {
        for (id, basic_event) in fault_tree.basic_events() {
            upsert_data_parameter(
                &mut data_parameters,
                diagnostics,
                id,
                basic_event,
                "fault-tree",
                fault_tree_id,
                format!(
                    "$.openpsa.define-fault-tree['{fault_tree_id}'].define-basic-event['{id}']"
                ),
            );
        }
    }

    let mut out: Vec<DataParameter> = data_parameters.into_values().collect();
    out.sort_by(|a, b| a.id.cmp(&b.id));
    out
}

fn basic_event_refs_from_fault_tree(fault_tree: &crate::core::fault_tree::FaultTree) -> Vec<String> {
    let mut refs: Vec<String> = fault_tree.basic_events().keys().cloned().collect();
    refs.sort();
    refs
}

fn house_event_refs_from_fault_tree(fault_tree: &crate::core::fault_tree::FaultTree) -> Vec<String> {
    let mut refs: Vec<String> = fault_tree.house_events().keys().cloned().collect();
    refs.sort();
    refs
}

fn house_event_catalog_json(fault_tree: &crate::core::fault_tree::FaultTree) -> Value {
    let mut ids: Vec<String> = fault_tree.house_events().keys().cloned().collect();
    ids.sort();

    Value::Array(
        ids.into_iter()
            .filter_map(|house_event_id| {
                fault_tree.house_events().get(&house_event_id).map(|house_event| {
                    json!({
                        "id": house_event.element().id(),
                        "state": house_event.state(),
                    })
                })
            })
            .collect(),
    )
}

fn collect_data_parameter_refs_for_fault_tree(
    model: &Model,
    fault_tree_id: &str,
    known_data_parameter_ids: &HashSet<String>,
) -> Vec<String> {
    let mut refs = Vec::new();

    if let Some(fault_tree) = model.get_fault_tree(fault_tree_id) {
        refs.extend(
            fault_tree
                .basic_events()
                .keys()
                .filter(|id| known_data_parameter_ids.contains(*id))
                .cloned(),
        );
    }

    refs.sort();
    refs.dedup();
    refs
}

fn gate_catalog_json(fault_tree: &crate::core::fault_tree::FaultTree) -> Value {
    let mut gate_ids: Vec<String> = fault_tree.gates().keys().cloned().collect();
    gate_ids.sort();

    let rows: Vec<Value> = gate_ids
        .iter()
        .filter_map(|gate_id| {
            fault_tree.get_gate(gate_id).map(|gate| {
                let mut row = json!({
                    "id": gate.element().id(),
                    "sourceIdentifier": gate.element().id(),
                    "formula": formula_to_model_type(gate.formula()),
                    "operands": gate.operands(),
                });

                if let Some(name) = gate.element().name() {
                    row["name"] = json!(name);
                }
                if let Some(label) = gate.element().label() {
                    row["label"] = json!(label);
                    row["description"] = json!(label);
                }

                row
            })
        })
        .collect();

    Value::Array(rows)
}

fn collect_system_dependencies(
    source_fault_tree_id: &str,
    fault_tree: &crate::core::fault_tree::FaultTree,
    known_fault_trees: &HashSet<String>,
    out: &mut Vec<SystemDependency>,
) {
    let mut seen: HashSet<String> = HashSet::new();

    let mut gate_ids: Vec<String> = fault_tree.gates().keys().cloned().collect();
    gate_ids.sort();

    for gate_id in gate_ids {
        let Some(gate) = fault_tree.get_gate(&gate_id) else {
            continue;
        };

        for operand in gate.operands() {
            let Some((target_fault_tree_id, _)) = operand.split_once('.') else {
                continue;
            };

            if !known_fault_trees.contains(target_fault_tree_id)
                || target_fault_tree_id == source_fault_tree_id
            {
                continue;
            }

            let dedupe_key = format!("{source_fault_tree_id}->{target_fault_tree_id}");
            if !seen.insert(dedupe_key) {
                continue;
            }

            let source_ref = format!("SYS::{source_fault_tree_id}");
            let target_ref = format!("SYS::{target_fault_tree_id}");
            let dependency_id = deterministic_generated_id(
                "DEP",
                &[source_ref.as_str(), target_ref.as_str(), gate_id.as_str(), operand.as_str()],
            );

            let mut additional_fields = HashMap::new();
            additional_fields.insert("sourceGateId".to_string(), json!(gate_id));
            additional_fields.insert("sourceOperand".to_string(), json!(operand));

            out.push(SystemDependency {
                id: dependency_id,
                source_ref: Some(source_ref),
                target_ref: Some(target_ref),
                dependency_type: Some("fault-tree-reference".to_string()),
                additional_fields,
            });
        }
    }
}

fn upsert_data_parameter(
    parameters: &mut HashMap<String, DataParameter>,
    diagnostics: &mut Vec<Diagnostic>,
    id: &str,
    basic_event: &crate::core::event::BasicEvent,
    source_element: &str,
    source_id: &str,
    source_path: String,
) {
    let entry = parameters
        .entry(id.to_string())
        .or_insert_with(|| DataParameter {
            id: id.to_string(),
            ..DataParameter::default()
        });

    if let Some(existing_probability) = entry.probability {
        let new_probability = basic_event.probability();
        if (existing_probability - new_probability).abs() > f64::EPSILON {
            diagnostics.push(
                Diagnostic::new(
                    "CONV_DA_PROBABILITY_CONFLICT",
                    Severity::Warning,
                    format!(
                        "Data parameter '{}' has conflicting probabilities ({existing_probability} vs {new_probability}); preserving first value",
                        id
                    ),
                    source_path.clone(),
                )
                .with_ref_context("data-analysis", id.to_string(), source_element, source_id.to_string())
                .with_hint("Unify duplicated basic-event probabilities in source XML to remove ambiguity"),
            );
        }
    } else {
        entry.probability = Some(basic_event.probability());
    }

    if let Some(distribution) = basic_event.distribution() {
        entry.distribution = Some(distribution_to_json(distribution));
    }

    entry
        .additional_fields
        .insert("sourceIdentifier".to_string(), json!(basic_event.element().id()));
    if let Some(source_name) = basic_event.element().name() {
        entry
            .additional_fields
            .insert("sourceName".to_string(), json!(source_name));
    }
    if let Some(source_label) = basic_event.element().label() {
        entry
            .additional_fields
            .insert("sourceLabel".to_string(), json!(source_label));
        entry
            .additional_fields
            .insert("sourceDescription".to_string(), json!(source_label));
    }
    if entry.probability.is_some() {
        entry
            .additional_fields
            .insert("probabilityUnit".to_string(), json!("probability"));
    }

    let provenance_obj = json!({
        "sourceElement": source_element,
        "sourceId": source_id,
        "sourcePath": source_path,
    });

    let provenance_key = "sourceProvenance".to_string();
    match entry.additional_fields.get_mut(&provenance_key) {
        Some(Value::Array(items)) => items.push(provenance_obj),
        _ => {
            entry
                .additional_fields
                .insert(provenance_key, Value::Array(vec![provenance_obj]));
        }
    }

    let source_count = entry
        .additional_fields
        .get("sourceProvenance")
        .and_then(|value| value.as_array())
        .map(|items| items.len())
        .unwrap_or(0);
    entry
        .additional_fields
        .insert("sourceCount".to_string(), json!(source_count));
}

fn distribution_to_json(distribution: &Distribution) -> Value {
    match distribution {
        Distribution::Normal(mean, std_dev) => {
            json!({ "type": "normal", "mean": mean, "stdDev": std_dev })
        }
        Distribution::LogNormal(mu, sigma) => {
            json!({ "type": "log-normal", "mu": mu, "sigma": sigma })
        }
        Distribution::Uniform(a, b) => {
            json!({ "type": "uniform", "a": a, "b": b })
        }
    }
}

fn collect_reachable_event_tree_ids(
    root_id: &str,
    event_tree_by_id: &HashMap<String, &EventTree>,
) -> Vec<String> {
    let mut ordered = Vec::new();
    let mut visited: HashSet<String> = HashSet::new();
    let mut stack = vec![root_id.to_string()];

    while let Some(current_id) = stack.pop() {
        if !visited.insert(current_id.clone()) {
            continue;
        }

        ordered.push(current_id.clone());
        if let Some(event_tree) = event_tree_by_id.get(&current_id) {
            let mut linked_ids: Vec<String> = event_tree
                .sequences
                .values()
                .filter_map(|sequence| sequence.linked_event_tree_id.clone())
                .collect();
            linked_ids.sort();
            linked_ids.reverse();

            for linked_id in linked_ids {
                if event_tree_by_id.contains_key(&linked_id) && !visited.contains(&linked_id) {
                    stack.push(linked_id);
                }
            }
        }
    }

    ordered
}

fn collect_terminal_leaves(
    root_event_tree_id: &str,
    current_event_tree_id: &str,
    branch: &Branch,
    event_tree_by_id: &HashMap<String, &EventTree>,
    active_steps: &[PathStep],
    active_house_assignments: &HashMap<String, bool>,
    active_tree_stack: &mut HashSet<String>,
    out: &mut Vec<PathLeaf>,
    diagnostics: &mut Vec<Diagnostic>,
) {
    let Some(event_tree) = event_tree_by_id.get(current_event_tree_id).copied() else {
        diagnostics.push(
            Diagnostic::new(
                "CONV_MISSING_EVENT_TREE",
                Severity::Warning,
                format!(
                    "Missing event tree '{}' while collecting linked path leaves",
                    current_event_tree_id
                ),
                "$.input",
            )
            .with_ref_context(
                "event-sequence-analysis",
                root_event_tree_id,
                "event-tree",
                current_event_tree_id,
            ),
        );
        return;
    };

    let mut scoped_house_assignments = active_house_assignments.clone();
    for (house_event_id, state) in &branch.house_event_assignments {
        scoped_house_assignments.insert(house_event_id.clone(), *state);
    }

    match &branch.target {
        BranchTarget::Sequence(sequence_id) => {
            let Some(sequence) = event_tree.sequences.get(sequence_id) else {
                diagnostics.push(
                    Diagnostic::new(
                        "CONV_MISSING_SEQUENCE",
                        Severity::Warning,
                        format!(
                            "Path leaf references sequence '{}' not found in event tree '{}'",
                            sequence_id, event_tree.id
                        ),
                        "$.input",
                    )
                    .with_ref_context(
                        "event-sequence-analysis",
                        sequence_id.clone(),
                        "sequence",
                        event_tree.id.clone(),
                    ),
                );
                return;
            };

            if let Some(linked_tree_id) = &sequence.linked_event_tree_id {
                if active_tree_stack.contains(linked_tree_id) {
                    diagnostics.push(
                        Diagnostic::new(
                            "CONV_CIRCULAR_EVENT_TREE_LINK",
                            Severity::Warning,
                            format!(
                                "Detected circular event-tree link '{}' while collecting path leaves from '{}'; preserving link without expansion",
                                linked_tree_id, root_event_tree_id
                            ),
                            "$.input",
                        )
                        .with_ref_context(
                            "event-sequence-analysis",
                            sequence_id.clone(),
                            "event-tree",
                            linked_tree_id.clone(),
                        ),
                    );
                }
            }

            out.push(PathLeaf {
                terminal_event_tree_id: current_event_tree_id.to_string(),
                sequence_id: sequence_id.clone(),
                path_signature: active_steps.to_vec(),
            });
        }
        BranchTarget::Fork(fork) => {
            for path in &fork.paths {
                let mut next_steps = active_steps.to_vec();
                next_steps.push(PathStep {
                    source_event_tree_id: current_event_tree_id.to_string(),
                    functional_event_id: fork.functional_event_id.clone(),
                    state: path.state.clone(),
                    path_probability: path.probability,
                    collect_formula_negated: path.collect_formula_negated,
                    house_event_assignments: scoped_house_assignments.clone(),
                });
                collect_terminal_leaves(
                    root_event_tree_id,
                    current_event_tree_id,
                    &path.branch,
                    event_tree_by_id,
                    &next_steps,
                    &scoped_house_assignments,
                    active_tree_stack,
                    out,
                    diagnostics,
                );
            }
        }
        BranchTarget::NamedBranch(named_branch_id) => {
            if let Some(named_branch) = event_tree.named_branches.get(named_branch_id) {
                collect_terminal_leaves(
                    root_event_tree_id,
                    current_event_tree_id,
                    &named_branch.branch,
                    event_tree_by_id,
                    active_steps,
                    &scoped_house_assignments,
                    active_tree_stack,
                    out,
                    diagnostics,
                );
            } else {
                diagnostics.push(
                    Diagnostic::new(
                        "CONV_MISSING_NAMED_BRANCH",
                        Severity::Warning,
                        format!(
                            "Named branch '{named_branch_id}' referenced but not defined in event tree '{}'",
                            event_tree.id
                        ),
                        "$.input",
                    )
                    .with_ref_context(
                        "event-sequence-analysis",
                        event_tree.id.clone(),
                        "named-branch",
                        named_branch_id.clone(),
                    ),
                );
            }
        }
    }
}

#[derive(Default)]
struct UnmappedEventTreeFeatures {
    sequence_instruction_count: usize,
    branch_instruction_count: usize,
    branch_house_assignment_count: usize,
}

fn collect_unmapped_event_tree_features(event_tree: &EventTree) -> UnmappedEventTreeFeatures {
    let mut counts = UnmappedEventTreeFeatures::default();

    for sequence in event_tree.sequences.values() {
        counts.sequence_instruction_count += sequence.instructions.len();
    }

    let mut visited_named_branches: HashSet<String> = HashSet::new();
    accumulate_unmapped_from_branch(
        &event_tree.initial_state,
        event_tree,
        &mut visited_named_branches,
        &mut counts,
    );

    counts
}

fn accumulate_unmapped_from_branch(
    branch: &Branch,
    event_tree: &EventTree,
    visited_named_branches: &mut HashSet<String>,
    counts: &mut UnmappedEventTreeFeatures,
) {
    counts.branch_instruction_count += branch.instructions.len();
    counts.branch_house_assignment_count += branch.house_event_assignments.len();

    match &branch.target {
        BranchTarget::Sequence(_) => {}
        BranchTarget::Fork(fork) => {
            for path in &fork.paths {
                accumulate_unmapped_from_branch(
                    &path.branch,
                    event_tree,
                    visited_named_branches,
                    counts,
                );
            }
        }
        BranchTarget::NamedBranch(named_branch_id) => {
            if visited_named_branches.insert(named_branch_id.clone()) {
                if let Some(named_branch) = event_tree.named_branches.get(named_branch_id) {
                    accumulate_unmapped_from_branch(
                        &named_branch.branch,
                        event_tree,
                        visited_named_branches,
                        counts,
                    );
                }
            }
        }
    }
}

fn map_functional_binding(
    id: String,
    functional_event: &FunctionalEvent,
    known_fault_trees: &HashSet<String>,
    known_data_parameter_ids: &HashSet<String>,
) -> FunctionalEventBinding {
    let mut binding = FunctionalEventBinding {
        id,
        functional_event_id: Some(functional_event.id.clone()),
        ..FunctionalEventBinding::default()
    };

    if let Some(fault_tree_id) = &functional_event.fault_tree_id {
        if let Some(normalized_fault_tree_id) = normalize_fault_tree_ref(fault_tree_id, known_fault_trees) {
            binding.fault_tree_id = Some(normalized_fault_tree_id);
            return binding;
        }
    }

    if known_data_parameter_ids.contains(&functional_event.id) {
        binding.data_parameter_id = Some(functional_event.id.clone());
        return binding;
    }

    binding.success_probability = Some(functional_event.success_probability.unwrap_or(0.5));
    binding
}

fn normalize_fault_tree_ref(raw_ref: &str, known_fault_trees: &HashSet<String>) -> Option<String> {
    if known_fault_trees.contains(raw_ref) {
        return Some(raw_ref.to_string());
    }

    let prefix = raw_ref.split('.').next().unwrap_or(raw_ref);
    if known_fault_trees.contains(prefix) {
        return Some(prefix.to_string());
    }

    None
}

fn formula_to_model_type(formula: &Formula) -> String {
    match formula {
        Formula::And => "and".to_string(),
        Formula::Or => "or".to_string(),
        Formula::Not => "not".to_string(),
        Formula::AtLeast { min } => format!("atleast-{min}"),
        Formula::Xor => "xor".to_string(),
        Formula::Nand => "nand".to_string(),
        Formula::Nor => "nor".to_string(),
        Formula::Iff => "iff".to_string(),
    }
}

fn ccf_model_name(model: &CcfModel) -> &'static str {
    match model {
        CcfModel::BetaFactor(_) => "beta-factor",
        CcfModel::AlphaFactor(_) => "alpha-factor",
        CcfModel::Mgl(_) => "mgl",
        CcfModel::PhiFactor(_) => "phi-factor",
    }
}

fn deterministic_generated_id(prefix: &str, components: &[&str]) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for component in components {
        for byte in component.as_bytes() {
            hash ^= *byte as u64;
            hash = hash.wrapping_mul(0x100000001b3);
        }
        hash ^= b'|' as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{prefix}::{hash:016x}")
}

fn converter_role_boundaries_metadata(ir: &OpenPsaConversionIr) -> Value {
    json!({
        "conversionContract": {
            "producer": "openpsa-xml-converter",
            "parserLayer": {
                "name": "openpsa-ir-v1",
                "preservesSourcePathsForDiagnostics": true,
                "symbolTable": {
                    "modelId": ir.symbol_tables.model_id,
                    "faultTreeCount": ir.symbol_tables.fault_trees.len(),
                    "basicEventCount": ir.symbol_tables.basic_events.len(),
                    "initiatingEventCount": ir.symbol_tables.initiating_events.len(),
                    "eventTreeCount": ir.symbol_tables.event_trees.len(),
                    "sequenceCount": ir.symbol_tables.sequences_by_event_tree.values().map(|x| x.len()).sum::<usize>(),
                    "functionalEventCount": ir.symbol_tables.functional_events_by_event_tree.values().map(|x| x.len()).sum::<usize>()
                },
                "referenceIndex": {
                    "edgeCount": ir.reference_index.edges.len()
                },
                "referentialIntegrityValidated": true
            },
            "inputModelElements": [
                "data-analysis",
                "systems-analysis",
                "initiating-event-analysis",
                "event-sequence-analysis"
            ],
            "outputResultElements": [
                "event-sequence-quantification"
            ],
            "requiredConverterElements": [
                "data-analysis",
                "systems-analysis",
                "initiating-event-analysis",
                "event-sequence-analysis",
                "event-sequence-quantification"
            ],
            "ownershipByElement": {
                "data-analysis": "converter-populated",
                "systems-analysis": "converter-populated",
                "initiating-event-analysis": "converter-populated",
                "event-sequence-analysis": "converter-populated",
                "event-sequence-quantification": "converter-seed-populated",
                "event-sequence-quantification-runtime": "engine-populated",
                "outputMetadata": "serializer-populated"
            },
            "scope": {
                "version": "v1",
                "objective": "convert all applicable fields with no silent drops",
                "partialMappingsEmitDiagnostics": true,
                "knownPartialMappings": [
                    "fault-tree multi-gate graph expansion",
                    "fault-tree house events in SA",
                    "event-tree sequence instructions",
                    "event-tree branch instructions",
                    "event-tree branch house-event assignments"
                ]
            },
            "resolutionPolicy": {
                "postMapResolver": "enabled",
                "strict": "unresolved-required-references-are-errors",
                "compatible": "unresolved-noncritical-references-become-placeholders-with-warnings"
            },
            "normalizationPolicy": {
                "ordering": "stable-sort-by-id-for-collections-and-ref-arrays",
                "numericFormatting": "round-to-12-decimals-and-normalize-negative-zero",
                "nullEmptyPolicy": "dedupe-and-sort-ref-arrays-while-preserving-empty-collections"
            },
            "mappingMatrix": {
                "version": "v1",
                "entries": [
                    {
                        "xmlPath": "/opsa-mef/@name|define-model/@name|define-fault-tree/@name",
                        "targetPath": "$.id",
                        "transformRule": "preserve-source-id",
                        "defaultRule": "fallback-to-fault-tree-id-or-parser-model-id",
                        "required": true
                    },
                    {
                        "xmlPath": "/opsa-mef/model-data/define-basic-event/@name",
                        "targetPath": "$.technicalElements.data-analysis.dataParameters[].id",
                        "transformRule": "copy-id",
                        "defaultRule": "none",
                        "required": true
                    },
                    {
                        "xmlPath": "/opsa-mef/model-data/define-basic-event/float/@value",
                        "targetPath": "$.technicalElements.data-analysis.dataParameters[].probability",
                        "transformRule": "parse-f64-probability",
                        "defaultRule": "none",
                        "required": true
                    },
                    {
                        "xmlPath": "/opsa-mef/define-fault-tree/@name",
                        "targetPath": "$.technicalElements.systems-analysis.systemDefinitions[].id",
                        "transformRule": "prefix-with-SYS::",
                        "defaultRule": "none",
                        "required": true
                    },
                    {
                        "xmlPath": "/opsa-mef/define-fault-tree/@name",
                        "targetPath": "$.technicalElements.systems-analysis.systemDefinitions[].faultTreeId",
                        "transformRule": "copy-id",
                        "defaultRule": "none",
                        "required": true
                    },
                    {
                        "xmlPath": "/opsa-mef/define-fault-tree/define-gate",
                        "targetPath": "$.technicalElements.systems-analysis.systemLogicModels[].modelType",
                        "transformRule": "map-formula-to-modelType(and|or|not|atleast|xor|nand|nor|iff)",
                        "defaultRule": "or-when-top-gate-unavailable",
                        "required": true
                    },
                    {
                        "xmlPath": "/opsa-mef/define-fault-tree/@top-event|first-gate-name",
                        "targetPath": "$.technicalElements.systems-analysis.systemLogicModels[].rootRef",
                        "transformRule": "resolve-top-event-ref",
                        "defaultRule": "<faultTreeId>__TOP",
                        "required": true
                    },
                    {
                        "xmlPath": "/opsa-mef/define-fault-tree/basic-event-ref",
                        "targetPath": "$.technicalElements.systems-analysis.systemLogicModels[].basicEventRefs[]",
                        "transformRule": "collect-and-sort-unique",
                        "defaultRule": "empty-array",
                        "required": true
                    },
                    {
                        "xmlPath": "/opsa-mef/define-CCF-group",
                        "targetPath": "$.technicalElements.systems-analysis.commonCauseFailureGroups[]",
                        "transformRule": "map-id-members-model",
                        "defaultRule": "empty-array",
                        "required": false
                    },
                    {
                        "xmlPath": "/opsa-mef/define-initiating-event/@name",
                        "targetPath": "$.technicalElements.initiating-event-analysis.initiators[].id",
                        "transformRule": "copy-id",
                        "defaultRule": "IE::auto-generated-when-none-present",
                        "required": true
                    },
                    {
                        "xmlPath": "/opsa-mef/define-initiating-event/float/@value",
                        "targetPath": "$.technicalElements.initiating-event-analysis.initiators[].probability|frequency",
                        "transformRule": "copy-probability-or-frequency",
                        "defaultRule": "probability=1.0-when-missing",
                        "required": true
                    },
                    {
                        "xmlPath": "/opsa-mef/define-initiating-event/event-tree/@name",
                        "targetPath": "$.technicalElements.initiating-event-analysis.initiators[].additionalFields.sourceEventTreeId",
                        "transformRule": "copy-id",
                        "defaultRule": "first-event-tree-id",
                        "required": true
                    },
                    {
                        "xmlPath": "/opsa-mef/define-event-tree/.../define-sequence/@name",
                        "targetPath": "$.technicalElements.event-sequence-analysis.eventSequences[].id",
                        "transformRule": "deterministic-hash-id(SEQ)",
                        "defaultRule": "none",
                        "required": true
                    },
                    {
                        "xmlPath": "/opsa-mef/define-event-tree/functional-event",
                        "targetPath": "$.technicalElements.event-sequence-analysis.eventSequences[].functionalEventBindings[]",
                        "transformRule": "map-faultTreeId-or-dataParameterId-or-successProbability",
                        "defaultRule": "successProbability=0.5",
                        "required": true
                    },
                    {
                        "xmlPath": "/opsa-mef/define-event-tree/path/state + collect-formula-negated",
                        "targetPath": "$.technicalElements.event-sequence-analysis.eventSequences[].additionalFields.pathSignature[]",
                        "transformRule": "emit-ordered-path-steps-with-state-probability-and-negation",
                        "defaultRule": "empty-array",
                        "required": true
                    },
                    {
                        "xmlPath": "/opsa-mef/define-event-tree/define-sequence/event-tree/@name",
                        "targetPath": "$.technicalElements.event-sequence-analysis.eventSequences[].linkedSequenceIds[]",
                        "transformRule": "copy-linked-event-tree-id-and-add-linkedEventTreeRefs",
                        "defaultRule": "empty-array",
                        "required": false
                    },
                    {
                        "xmlPath": "/derived-from-ESA",
                        "targetPath": "$.technicalElements.event-sequence-quantification.quantificationResults[]",
                        "transformRule": "derive-baseline-from-path-probabilities-when-available; otherwise-seed-placeholder-rows-with-provenance",
                        "defaultRule": "placeholder-frequency=0.0-with-diagnostic",
                        "required": true
                    },
                    {
                        "xmlPath": "/synthetic",
                        "targetPath": "$.technicalElements.risk-integration",
                        "transformRule": "emit-placeholder-risk-integration",
                        "defaultRule": "placeholderUsed=true",
                        "required": true
                    }
                ]
            },
            "idPolicy": {
                "version": "v1",
                "preserveSourceIds": [
                    "model.id",
                    "data-analysis.dataParameters[].id",
                    "systems-analysis.systemDefinitions[].id",
                    "systems-analysis.systemLogicModels[].id",
                    "initiating-event-analysis.initiators[].id"
                ],
                "generatedIds": {
                    "event-sequence-analysis.eventSequences[].id": "SEQ::<fnv1a64(initiatorId|sourceEventTreeId|sourceSequenceId|pathSignature)>",
                    "event-sequence-analysis.eventSequences[].functionalEventBindings[].id": "FEB::<fnv1a64(sequenceId|functionalEventId|state|stepIndex|collectFormulaNegated)>",
                    "event-sequence-quantification.quantificationResults[].id": "QR::<fnv1a64(sequenceId|initiatorId)>"
                }
            },
            "esqPolicy": {
                "converterProduces": [
                    "quantificationResults"
                ],
                "converterBaselineOnly": true,
                "converterRuntimeFieldGuard": "forbid-runtime-only-fields",
                "runtimeProduces": [
                    "riskSignificantSequences",
                    "cutSets",
                    "cutSetGrouping",
                    "uncertainty",
                    "convergence"
                ]
            }
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::ccf::{CcfGroup, CcfModel};
    use crate::core::event::{BasicEvent, Distribution};
    use crate::core::event_tree::{
        Branch, BranchTarget, EventTree, Fork, FunctionalEvent, InitiatingEvent, Path, Sequence,
    };
    use crate::core::fault_tree::FaultTree;
    use crate::core::gate::{Formula, Gate};

    #[test]
    fn parse_openpsa_xml_fault_tree_populates_da_and_sa() {
        let xml = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/core/and.xml"));
        let bundle = parse_openpsa_xml(xml).unwrap();
        let model = bundle.model.unwrap();

        let da = model.technical_elements.data_analysis.expect("DA expected");
        let sa = model.technical_elements.systems_analysis.expect("SA expected");
        let iea = model
            .technical_elements
            .initiating_event_analysis
            .expect("IEA expected");
        let esa = model
            .technical_elements
            .event_sequence_analysis
            .expect("ESA expected");
        let esq = model
            .technical_elements
            .event_sequence_quantification
            .expect("ESQ expected");

        assert!(!da.data_parameters.is_empty());
        assert!(!sa.system_definitions.is_empty());
        assert!(!sa.system_logic_models.is_empty());
        assert!(iea.initiators.is_empty());
        assert!(esa.event_sequences.is_empty());
        assert!(esq.quantification_results.is_empty());

        let metadata = model.metadata.expect("converter metadata expected");
        assert_eq!(
            metadata["conversionContract"]["requiredConverterElements"],
            json!([
                "data-analysis",
                "systems-analysis",
                "initiating-event-analysis",
                "event-sequence-analysis",
                "event-sequence-quantification"
            ])
        );
        assert_eq!(
            metadata["conversionContract"]["ownershipByElement"]["outputMetadata"],
            "serializer-populated"
        );
        assert_eq!(
            metadata["conversionContract"]["idPolicy"]["version"],
            "v1"
        );
        assert_eq!(
            metadata["conversionContract"]["scope"]["partialMappingsEmitDiagnostics"],
            true
        );
        assert_eq!(
            metadata["conversionContract"]["mappingMatrix"]["version"],
            "v1"
        );
        assert_eq!(
            metadata["conversionContract"]["parserLayer"]["name"],
            "openpsa-ir-v1"
        );
        assert_eq!(
            metadata["conversionContract"]["parserLayer"]["referentialIntegrityValidated"],
            true
        );
    }

    #[test]
    fn parse_openpsa_xml_event_tree_populates_iea_esa_esq() {
        let xml = include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/tests/fixtures/eta/EventTrees/MHTGR/OpenPSA_XML/CRW.xml"
        ));

        let bundle = parse_openpsa_xml(xml).unwrap();
        let model = bundle.model.unwrap();

        let iea = model
            .technical_elements
            .initiating_event_analysis
            .as_ref()
            .expect("IEA expected");
        let esa = model
            .technical_elements
            .event_sequence_analysis
            .as_ref()
            .expect("ESA expected");
        let esq = model
            .technical_elements
            .event_sequence_quantification
            .as_ref()
            .expect("ESQ expected");

        assert!(!iea.initiators.is_empty());
        assert!(!esa.event_sequences.is_empty());
        assert!(!esq.quantification_results.is_empty());

        let metadata = model
            .metadata
            .as_ref()
            .expect("converter metadata expected");
        assert_eq!(
            metadata["conversionContract"]["inputModelElements"],
            json!([
                "data-analysis",
                "systems-analysis",
                "initiating-event-analysis",
                "event-sequence-analysis"
            ])
        );
        assert_eq!(
            metadata["conversionContract"]["outputResultElements"],
            json!(["event-sequence-quantification"])
        );
        assert_eq!(
            metadata["conversionContract"]["esqPolicy"]["converterBaselineOnly"],
            json!(true)
        );
        assert_eq!(
            metadata["conversionContract"]["esqPolicy"]["converterRuntimeFieldGuard"],
            json!("forbid-runtime-only-fields")
        );

        let rendered = serde_json::to_value(&model).expect("serialize model to json value");
        let esq_json = &rendered["technical_elements"]["event_sequence_quantification"];
        assert!(esq_json.get("risk_significant_sequences").is_none());
        assert!(esq_json.get("cut_sets").is_none());
        assert!(esq_json.get("convergence").is_none());
    }

    #[test]
    fn data_analysis_parameters_include_source_provenance_metadata() {
        let xml = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/core/and.xml"));
        let bundle = parse_openpsa_xml(xml).unwrap();
        let model = bundle.model.unwrap();
        let da = model.technical_elements.data_analysis.expect("DA expected");

        assert!(!da.data_parameters.is_empty());
        for parameter in da.data_parameters {
            let provenance = parameter
                .additional_fields
                .get("sourceProvenance")
                .and_then(|value| value.as_array())
                .expect("sourceProvenance array expected");
            assert!(!provenance.is_empty());

            let source_count = parameter
                .additional_fields
                .get("sourceCount")
                .and_then(|value| value.as_u64())
                .expect("sourceCount expected");
            assert_eq!(source_count as usize, provenance.len());

            assert!(parameter
                .additional_fields
                .get("sourceIdentifier")
                .and_then(|value| value.as_str())
                .is_some());
            assert_eq!(
                parameter
                    .additional_fields
                    .get("probabilityUnit")
                    .and_then(|value| value.as_str()),
                Some("probability")
            );
        }
    }

    #[test]
    fn data_analysis_distribution_is_serialized_when_available() {
        let mut model = Model::new("MODEL-DA-DIST").unwrap();
        let basic_event = BasicEvent::with_distribution(
            "BE-DIST".to_string(),
            0.2,
            Distribution::Normal(0.2, 0.01),
        )
        .unwrap();

        model.add_basic_event(basic_event.clone()).unwrap();

        let mut fault_tree = FaultTree::new("FT-DIST", "G-TOP").unwrap();
        let gate = Gate::new("G-TOP".to_string(), Formula::Or).unwrap();
        fault_tree.add_gate(gate).unwrap();
        fault_tree.add_basic_event(basic_event).unwrap();
        model.add_fault_tree(fault_tree).unwrap();

        let mut diagnostics = Vec::new();
        let data_parameters = collect_data_parameters_from_model(&model, &mut diagnostics);
        assert!(diagnostics.is_empty());

        let parameter = data_parameters
            .iter()
            .find(|parameter| parameter.id == "BE-DIST")
            .expect("BE-DIST data parameter expected");

        let distribution = parameter
            .distribution
            .as_ref()
            .expect("distribution should be serialized");
        assert_eq!(distribution["type"], "normal");
        assert_eq!(distribution["mean"], json!(0.2));
        assert_eq!(distribution["stdDev"], json!(0.01));
    }

    #[test]
    fn systems_analysis_includes_component_refs_and_gate_catalog() {
        let xml = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/core/and.xml"));
        let bundle = parse_openpsa_xml(xml).unwrap();
        let model = bundle.model.unwrap();

        let sa = model
            .technical_elements
            .systems_analysis
            .expect("systems-analysis expected");

        assert!(!sa.system_definitions.is_empty());
        assert!(!sa.system_logic_models.is_empty());

        let system_definition = &sa.system_definitions[0];
        assert!(!system_definition.component_refs.is_empty());
        assert!(system_definition
            .additional_fields
            .get("topEventRef")
            .and_then(|value| value.as_str())
            .is_some());
        assert!(system_definition
            .additional_fields
            .get("sourceIdentifier")
            .and_then(|value| value.as_str())
            .is_some());
        let definition_house_event_refs = system_definition
            .additional_fields
            .get("houseEventRefs")
            .and_then(|value| value.as_array())
            .expect("system definition houseEventRefs array expected");
        assert!(definition_house_event_refs.is_empty());

        let logic_model = &sa.system_logic_models[0];
        assert!(logic_model.root_ref.is_some());
        assert!(!logic_model.gate_refs.is_empty());

        let gate_catalog = logic_model
            .additional_fields
            .get("gateCatalog")
            .and_then(|value| value.as_array())
            .expect("gateCatalog array expected");
        assert!(!gate_catalog.is_empty());
        assert!(gate_catalog[0].get("sourceIdentifier").is_some());

        assert!(logic_model
            .additional_fields
            .get("rootGateFormula")
            .and_then(|value| value.as_str())
            .is_some());
        assert!(logic_model
            .additional_fields
            .get("rootGateOperands")
            .and_then(|value| value.as_array())
            .is_some());

        let house_event_refs = logic_model
            .additional_fields
            .get("houseEventRefs")
            .and_then(|value| value.as_array())
            .expect("houseEventRefs array expected");
        assert!(house_event_refs.is_empty());
    }

    #[test]
    fn systems_analysis_extracts_cross_fault_tree_dependencies() {
        let mut model = Model::new("MODEL-SA-DEP").unwrap();

        let mut fault_tree_a = FaultTree::new("FT-A", "GA").unwrap();
        fault_tree_a
            .add_gate(Gate::new("GA".to_string(), Formula::Or).unwrap())
            .unwrap();

        let mut fault_tree_b = FaultTree::new("FT-B", "GB").unwrap();
        let mut gate_b = Gate::new("GB".to_string(), Formula::And).unwrap();
        gate_b.add_operand("FT-A.GA".to_string());
        fault_tree_b.add_gate(gate_b).unwrap();

        model.add_fault_tree(fault_tree_a).unwrap();
        model.add_fault_tree(fault_tree_b).unwrap();

        let (model, diagnostics) = convert_parsed_to_openpra_model(&model, &[], &[]);
        assert!(diagnostics.is_empty());

        let sa = model
            .technical_elements
            .systems_analysis
            .expect("systems-analysis expected");

        assert!(!sa.system_dependencies.is_empty());
        assert!(sa.system_dependencies.iter().any(|dependency| {
            dependency.source_ref.as_deref() == Some("SYS::FT-B")
                && dependency.target_ref.as_deref() == Some("SYS::FT-A")
        }));
        assert!(sa
            .system_dependencies
            .iter()
            .all(|dependency| dependency.dependency_type.as_deref() == Some("fault-tree-reference")));
        assert!(sa
            .system_dependencies
            .iter()
            .all(|dependency| dependency.additional_fields.contains_key("sourceGateId")));
        assert!(sa
            .system_dependencies
            .iter()
            .all(|dependency| dependency.additional_fields.contains_key("sourceOperand")));
    }

    #[test]
    fn systems_analysis_maps_ccf_groups_with_source_fault_tree_field() {
        let mut model = Model::new("MODEL-SA-CCF").unwrap();
        model
            .add_basic_event(BasicEvent::new("BE1".to_string(), 1.0e-2).unwrap())
            .unwrap();
        model
            .add_basic_event(BasicEvent::new("BE2".to_string(), 2.0e-2).unwrap())
            .unwrap();

        let mut fault_tree = FaultTree::new("FT-CCF", "G-TOP").unwrap();
        fault_tree
            .add_gate(Gate::new("G-TOP".to_string(), Formula::And).unwrap())
            .unwrap();
        fault_tree
            .add_basic_event(BasicEvent::new("BE1".to_string(), 1.0e-2).unwrap())
            .unwrap();
        fault_tree
            .add_basic_event(BasicEvent::new("BE2".to_string(), 2.0e-2).unwrap())
            .unwrap();
        fault_tree
            .add_ccf_group(
                CcfGroup::new(
                    "CCF-1",
                    vec!["BE1".to_string(), "BE2".to_string()],
                    CcfModel::BetaFactor(0.15),
                )
                .unwrap(),
            )
            .unwrap();

        model.add_fault_tree(fault_tree).unwrap();
        let (openpra_model, diagnostics) = convert_parsed_to_openpra_model(&model, &[], &[]);
        assert!(diagnostics.is_empty());

        let sa = openpra_model
            .technical_elements
            .systems_analysis
            .expect("systems-analysis expected");
        assert_eq!(sa.common_cause_failure_groups.len(), 1);

        let ccf_group = &sa.common_cause_failure_groups[0];
        assert_eq!(ccf_group.id, "CCF-1");
        assert_eq!(ccf_group.model.as_deref(), Some("beta-factor"));
        assert_eq!(
            ccf_group
                .additional_fields
                .get("sourceFaultTreeId")
                .and_then(|value| value.as_str()),
            Some("FT-CCF")
        );
    }

    #[test]
    fn initiating_event_analysis_maps_system_and_data_parameter_refs() {
        let mut model = Model::new("MODEL-IEA-REFS").unwrap();

        let mut fault_tree = FaultTree::new("FT-IE", "G-TOP").unwrap();
        fault_tree
            .add_gate(Gate::new("G-TOP".to_string(), Formula::Or).unwrap())
            .unwrap();
        fault_tree
            .add_basic_event(BasicEvent::new("BE-IE".to_string(), 1.0e-3).unwrap())
            .unwrap();
        model.add_fault_tree(fault_tree).unwrap();

        let mut initiating_event = InitiatingEvent::new("IE-1".to_string());
        initiating_event.fault_tree_id = Some("FT-IE".to_string());
        initiating_event.frequency = Some(1.0e-4);

        let (openpra_model, diagnostics) =
            convert_parsed_to_openpra_model(&model, &[initiating_event], &[]);
        assert!(diagnostics.is_empty());

        let iea = openpra_model
            .technical_elements
            .initiating_event_analysis
            .expect("initiating-event-analysis expected");
        assert_eq!(iea.initiators.len(), 1);

        let initiator = &iea.initiators[0];
        assert_eq!(initiator.system_refs, vec!["SYS::FT-IE".to_string()]);
        assert_eq!(initiator.data_parameter_refs, vec!["BE-IE".to_string()]);
        assert_eq!(initiator.frequency, Some(1.0e-4));
        assert_eq!(initiator.probability, None);
        assert_eq!(
            initiator
                .additional_fields
                .get("sourceFaultTreeId")
                .and_then(|value| value.as_str()),
            Some("FT-IE")
        );
    }

    #[test]
    fn initiating_event_analysis_includes_source_event_tree_refs_and_default_probability() {
        let model = Model::new("MODEL-IEA-EVENT-TREE").unwrap();

        let mut root_tree = EventTree::new(
            "ET-ROOT".to_string(),
            Branch::new(BranchTarget::Sequence("SEQ-ROOT".to_string())),
        );
        root_tree
            .add_sequence(Sequence::new("SEQ-ROOT".to_string()).with_linked_event_tree("ET-LINKED".to_string()))
            .unwrap();

        let mut linked_tree = EventTree::new(
            "ET-LINKED".to_string(),
            Branch::new(BranchTarget::Sequence("SEQ-LINKED".to_string())),
        );
        linked_tree
            .add_sequence(Sequence::new("SEQ-LINKED".to_string()))
            .unwrap();

        let initiating_event = InitiatingEvent::new("IE-ROOT".to_string()).with_event_tree("ET-ROOT".to_string());

        let (openpra_model, diagnostics) =
            convert_parsed_to_openpra_model(&model, &[initiating_event], &[root_tree, linked_tree]);
        assert!(!diagnostics
            .iter()
            .any(|diagnostic| diagnostic.severity != Severity::Info));

        let iea = openpra_model
            .technical_elements
            .initiating_event_analysis
            .expect("initiating-event-analysis expected");
        assert_eq!(iea.initiators.len(), 1);

        let initiator = &iea.initiators[0];
        assert_eq!(initiator.probability, Some(1.0));
        assert_eq!(
            initiator
                .additional_fields
                .get("sourceEventTreeId")
                .and_then(|value| value.as_str()),
            Some("ET-ROOT")
        );

        let source_event_tree_refs = initiator
            .additional_fields
            .get("sourceEventTreeRefs")
            .and_then(|value| value.as_array())
            .expect("sourceEventTreeRefs expected");
        let refs_as_str: Vec<&str> = source_event_tree_refs
            .iter()
            .filter_map(|value| value.as_str())
            .collect();
        assert_eq!(refs_as_str, vec!["ET-ROOT", "ET-LINKED"]);
        assert_eq!(
            initiator
                .additional_fields
                .get("probabilityUnit")
                .and_then(|value| value.as_str()),
            Some("probability")
        );
    }

    #[test]
    fn event_sequence_analysis_maps_path_states_and_binding_metadata() {
        let model = Model::new("MODEL-ESA-PATHS").unwrap();

        let success_branch = Branch::new(BranchTarget::Sequence("SEQ-SUCCESS".to_string()));
        let fail_branch = Branch::new(BranchTarget::Sequence("SEQ-FAIL".to_string()));
        let success_path = Path::new("success".to_string(), success_branch)
            .unwrap()
            .with_probability(0.9)
            .with_collect_formula_negated(false);
        let fail_path = Path::new("failure".to_string(), fail_branch)
            .unwrap()
            .with_probability(0.1)
            .with_collect_formula_negated(true);
        let fork = Fork::new("FE-1".to_string(), vec![success_path, fail_path]).unwrap();

        let mut event_tree = EventTree::new(
            "ET-ESA".to_string(),
            Branch::new(BranchTarget::Fork(fork)),
        );
        event_tree
            .add_functional_event(
                FunctionalEvent::new("FE-1".to_string())
                    .with_order(3)
                    .with_success_probability(0.85),
            )
            .unwrap();
        event_tree
            .add_sequence(Sequence::new("SEQ-SUCCESS".to_string()))
            .unwrap();
        event_tree
            .add_sequence(Sequence::new("SEQ-FAIL".to_string()))
            .unwrap();

        let initiating_event = InitiatingEvent::new("IE-ESA".to_string()).with_event_tree("ET-ESA".to_string());
        let (openpra_model, diagnostics) =
            convert_parsed_to_openpra_model(&model, &[initiating_event], &[event_tree]);
        assert!(!diagnostics
            .iter()
            .any(|diagnostic| diagnostic.severity != Severity::Info));

        let esa = openpra_model
            .technical_elements
            .event_sequence_analysis
            .expect("event-sequence-analysis expected");
        assert_eq!(esa.event_sequences.len(), 2);

        for sequence in &esa.event_sequences {
            let path_signature = sequence
                .additional_fields
                .get("pathSignature")
                .and_then(|value| value.as_array())
                .expect("pathSignature expected");
            assert_eq!(path_signature.len(), 1);

            let step = path_signature[0].as_object().expect("path step object expected");
            assert!(step.contains_key("state"));
            assert!(step.contains_key("pathProbability"));
            assert!(step.contains_key("collectFormulaNegated"));

            let binding = sequence
                .functional_event_bindings
                .first()
                .expect("functional event binding expected");
            assert_eq!(
                binding
                    .additional_fields
                    .get("stepIndex")
                    .and_then(|value| value.as_u64()),
                Some(0)
            );
            assert!(binding.additional_fields.contains_key("pathState"));
            assert!(binding.additional_fields.contains_key("pathProbability"));
            assert_eq!(
                binding
                    .additional_fields
                    .get("functionalEventOrder")
                    .and_then(|value| value.as_i64()),
                Some(3)
            );
        }
    }

    #[test]
    fn event_sequence_analysis_includes_linked_event_tree_references() {
        let model = Model::new("MODEL-ESA-LINKED").unwrap();

        let mut root_tree = EventTree::new(
            "ET-ROOT".to_string(),
            Branch::new(BranchTarget::Sequence("SEQ-ROOT".to_string())),
        );
        root_tree
            .add_sequence(Sequence::new("SEQ-ROOT".to_string()).with_linked_event_tree("ET-NEXT".to_string()))
            .unwrap();

        let mut next_tree = EventTree::new(
            "ET-NEXT".to_string(),
            Branch::new(BranchTarget::Sequence("SEQ-NEXT".to_string())),
        );
        next_tree
            .add_sequence(Sequence::new("SEQ-NEXT".to_string()))
            .unwrap();

        let initiating_event = InitiatingEvent::new("IE-LINK".to_string()).with_event_tree("ET-ROOT".to_string());
        let (openpra_model, diagnostics) =
            convert_parsed_to_openpra_model(&model, &[initiating_event], &[root_tree, next_tree]);
        assert!(!diagnostics
            .iter()
            .any(|diagnostic| diagnostic.severity != Severity::Info));

        let esa = openpra_model
            .technical_elements
            .event_sequence_analysis
            .expect("event-sequence-analysis expected");

        let linked_sequence = esa
            .event_sequences
            .iter()
            .find(|sequence| !sequence.linked_sequence_ids.is_empty())
            .expect("at least one linked sequence expected");

        let linked_event_tree_refs = linked_sequence
            .additional_fields
            .get("linkedEventTreeRefs")
            .and_then(|value| value.as_array())
            .expect("linkedEventTreeRefs expected");
        let refs: Vec<&str> = linked_event_tree_refs
            .iter()
            .filter_map(|value| value.as_str())
            .collect();

        assert_eq!(
            refs,
            linked_sequence
                .linked_sequence_ids
                .iter()
                .map(String::as_str)
                .collect::<Vec<_>>()
        );
        assert!(linked_sequence
            .additional_fields
            .get("sourceSequenceId")
            .and_then(|value| value.as_str())
            .is_some());
    }

    #[test]
    fn esq_baseline_uses_path_probabilities_when_available() {
        let model = Model::new("MODEL-ESQ-SOURCE").unwrap();

        let path = Path::new(
            "success".to_string(),
            Branch::new(BranchTarget::Sequence("SEQ-SRC".to_string())),
        )
        .unwrap()
        .with_probability(0.2);
        let fork = Fork::new("FE-SRC".to_string(), vec![path]).unwrap();

        let mut event_tree = EventTree::new(
            "ET-SRC".to_string(),
            Branch::new(BranchTarget::Fork(fork)),
        );
        event_tree
            .add_functional_event(FunctionalEvent::new("FE-SRC".to_string()))
            .unwrap();
        event_tree
            .add_sequence(Sequence::new("SEQ-SRC".to_string()))
            .unwrap();

        let initiating_event = InitiatingEvent::new("IE-SRC".to_string())
            .with_event_tree("ET-SRC".to_string())
            .with_probability(0.5);

        let (openpra_model, diagnostics) =
            convert_parsed_to_openpra_model(&model, &[initiating_event], &[event_tree]);

        assert!(diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "CONV_ESQ_BASELINE_FROM_SOURCE"));
        assert!(!diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "CONV_ESQ_BASELINE_PLACEHOLDER"));

        let esq = openpra_model
            .technical_elements
            .event_sequence_quantification
            .expect("event-sequence-quantification expected");
        assert_eq!(esq.quantification_results.len(), 1);

        let row = &esq.quantification_results[0];
        assert_eq!(row.frequency, None);
        assert_eq!(row.probability, Some(0.1));
        assert_eq!(
            row.additional_fields
                .get("baselineSource")
                .and_then(|value| value.as_str()),
            Some("path-probability")
        );
        assert_eq!(
            row.additional_fields
                .get("pathProbabilityProduct")
                .and_then(|value| value.as_f64()),
            Some(0.2)
        );
    }

    #[test]
    fn esq_baseline_emits_placeholder_diagnostic_without_path_probabilities() {
        let model = Model::new("MODEL-ESQ-PLACEHOLDER").unwrap();

        let path = Path::new(
            "success".to_string(),
            Branch::new(BranchTarget::Sequence("SEQ-PH".to_string())),
        )
        .unwrap();
        let fork = Fork::new("FE-PH".to_string(), vec![path]).unwrap();

        let mut event_tree = EventTree::new(
            "ET-PH".to_string(),
            Branch::new(BranchTarget::Fork(fork)),
        );
        event_tree
            .add_functional_event(FunctionalEvent::new("FE-PH".to_string()))
            .unwrap();
        event_tree
            .add_sequence(Sequence::new("SEQ-PH".to_string()))
            .unwrap();

        let initiating_event = InitiatingEvent::new("IE-PH".to_string())
            .with_event_tree("ET-PH".to_string())
            .with_frequency(1.0e-4);

        let (openpra_model, diagnostics) =
            convert_parsed_to_openpra_model(&model, &[initiating_event], &[event_tree]);

        assert!(diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "CONV_ESQ_BASELINE_PLACEHOLDER"));

        let esq = openpra_model
            .technical_elements
            .event_sequence_quantification
            .expect("event-sequence-quantification expected");
        assert_eq!(esq.quantification_results.len(), 1);

        let row = &esq.quantification_results[0];
        assert_eq!(row.frequency, Some(0.0));
        assert_eq!(row.probability, None);
        assert_eq!(
            row.additional_fields
                .get("baselineSource")
                .and_then(|value| value.as_str()),
            Some("placeholder")
        );
        assert_eq!(
            row.additional_fields
                .get("placeholderReason")
                .and_then(|value| value.as_str()),
            Some("no-explicit-path-probabilities")
        );
    }

    #[test]
    fn post_map_resolver_strict_mode_errors_on_unresolved_required_edges() {
        let model = OpenPraJsonModel {
            id: Some("MODEL-STRICT".to_string()),
            technical_elements: TechnicalElements {
                event_sequence_analysis: Some(EventSequenceAnalysisJsonModel {
                    event_sequences: vec![EventSequence {
                        id: "SEQ-1".to_string(),
                        initiating_event_id: Some("IE-MISSING".to_string()),
                        ..EventSequence::default()
                    }],
                    scope_definition: Some(ScopeDefinition {
                        initiating_event_ids: vec!["IE-MISSING".to_string()],
                        event_sequence_ids: vec!["SEQ-1".to_string()],
                    }),
                    ..EventSequenceAnalysisJsonModel::default()
                }),
                ..TechnicalElements::default()
            },
            ..OpenPraJsonModel::default()
        };

        let (_registry, placeholders, diagnostics) = resolve_model_refs(&model, ResolveMode::Strict);
        assert!(placeholders.is_empty());
        assert!(diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "REF_MISSING_REQUIRED"));
        assert!(diagnostics
            .iter()
            .any(|diagnostic| diagnostic.severity == Severity::Error));
    }

    #[test]
    fn post_map_resolver_compatible_mode_uses_placeholders_for_noncritical_edges() {
        let model = OpenPraJsonModel {
            id: Some("MODEL-COMPAT".to_string()),
            technical_elements: TechnicalElements {
                initiating_event_analysis: Some(InitiatingEventAnalysisJsonModel {
                    initiators: vec![Initiator {
                        id: "IE-1".to_string(),
                        data_parameter_refs: vec!["DP-MISSING".to_string()],
                        system_refs: vec!["SYS-MISSING".to_string()],
                        ..Initiator::default()
                    }],
                    ..InitiatingEventAnalysisJsonModel::default()
                }),
                ..TechnicalElements::default()
            },
            ..OpenPraJsonModel::default()
        };

        let (_registry, placeholders, diagnostics) =
            resolve_model_refs(&model, ResolveMode::Compatible);

        assert!(diagnostics.iter().all(|diagnostic| diagnostic.severity != Severity::Error));
        assert!(diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "REF_OUT_OF_SCOPE_PLACEHOLDER_USED"));
        assert!(placeholders.iter().any(|placeholder| {
            placeholder.source_element == "initiating-event-analysis"
                && placeholder.target_type == "data-parameter"
        }));
    }

    #[test]
    fn normalization_rules_sort_and_dedupe_references() {
        let mut model = OpenPraJsonModel {
            id: Some("MODEL-NORMALIZE".to_string()),
            technical_elements: TechnicalElements {
                initiating_event_analysis: Some(InitiatingEventAnalysisJsonModel {
                    initiators: vec![Initiator {
                        id: "IE-1".to_string(),
                        system_refs: vec!["SYS-B".to_string(), "SYS-A".to_string(), "SYS-A".to_string()],
                        data_parameter_refs: vec!["DP-B".to_string(), "DP-A".to_string(), "DP-A".to_string()],
                        frequency: Some(-0.0),
                        probability: Some(0.1234567890123456),
                        ..Initiator::default()
                    }],
                    ..InitiatingEventAnalysisJsonModel::default()
                }),
                event_sequence_analysis: Some(EventSequenceAnalysisJsonModel {
                    event_sequences: vec![EventSequence {
                        id: "SEQ-1".to_string(),
                        linked_sequence_ids: vec!["ET-B".to_string(), "ET-A".to_string(), "ET-A".to_string()],
                        ..EventSequence::default()
                    }],
                    scope_definition: Some(ScopeDefinition {
                        initiating_event_ids: vec!["IE-2".to_string(), "IE-1".to_string(), "IE-1".to_string()],
                        event_sequence_ids: vec!["SEQ-2".to_string(), "SEQ-1".to_string(), "SEQ-1".to_string()],
                    }),
                    ..EventSequenceAnalysisJsonModel::default()
                }),
                event_sequence_quantification: Some(EventSequenceQuantificationJsonModel {
                    quantification_results: vec![QuantificationResult {
                        id: "QR-1".to_string(),
                        frequency: Some(-0.0),
                        probability: Some(0.2222222222222222),
                        ..QuantificationResult::default()
                    }],
                    ..EventSequenceQuantificationJsonModel::default()
                }),
                ..TechnicalElements::default()
            },
            ..OpenPraJsonModel::default()
        };

        normalize_openpra_model(&mut model);

        let initiator = &model
            .technical_elements
            .initiating_event_analysis
            .as_ref()
            .expect("IEA expected")
            .initiators[0];
        assert_eq!(initiator.system_refs, vec!["SYS-A", "SYS-B"]);
        assert_eq!(initiator.data_parameter_refs, vec!["DP-A", "DP-B"]);
        assert_eq!(initiator.frequency, Some(0.0));
        assert_eq!(initiator.probability, Some(0.123456789012));

        let scope = model
            .technical_elements
            .event_sequence_analysis
            .as_ref()
            .expect("ESA expected")
            .scope_definition
            .as_ref()
            .expect("scope expected");
        assert_eq!(scope.initiating_event_ids, vec!["IE-1", "IE-2"]);
        assert_eq!(scope.event_sequence_ids, vec!["SEQ-1", "SEQ-2"]);

        let sequence = &model
            .technical_elements
            .event_sequence_analysis
            .as_ref()
            .expect("ESA expected")
            .event_sequences[0];
        assert_eq!(sequence.linked_sequence_ids, vec!["ET-A", "ET-B"]);

        let quant_row = &model
            .technical_elements
            .event_sequence_quantification
            .as_ref()
            .expect("ESQ expected")
            .quantification_results[0];
        assert_eq!(quant_row.frequency, Some(0.0));
        assert_eq!(quant_row.probability, Some(0.222222222222));
    }
}
