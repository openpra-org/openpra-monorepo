use crate::core::event_tree::{
    Branch, BranchTarget, EventTree, Fork, FunctionalEvent, NamedBranch, Path, Sequence,
};
use crate::{PraxisError, Result};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::HashMap;

const LIB_KEY_HINT: &str = "praxisEventTreeLibrary";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsonEventTree {
    id: String,
    name: Option<String>,
    initial_state: JsonBranch,
    sequences: Vec<JsonSequence>,
    functional_events: Vec<JsonFunctionalEvent>,
    named_branches: Vec<JsonNamedBranch>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsonSequence {
    id: String,
    name: Option<String>,
    linked_event_tree_id: Option<String>,
    instructions: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsonFunctionalEvent {
    id: String,
    name: Option<String>,
    order: i32,
    fault_tree_id: Option<String>,
    success_probability: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsonNamedBranch {
    id: String,
    name: Option<String>,
    branch: JsonBranch,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsonBranch {
    instructions: Vec<String>,
    house_event_assignments: HashMap<String, bool>,
    target: JsonBranchTarget,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
enum JsonBranchTarget {
    Sequence { id: String },
    NamedBranch { id: String },
    Fork { fork: JsonFork },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsonFork {
    functional_event_id: String,
    paths: Vec<JsonPath>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JsonPath {
    state: String,
    probability: Option<f64>,
    collect_formula_negated: Option<bool>,
    branch: JsonBranch,
}

fn branch_to_json(branch: &Branch) -> JsonBranch {
    let target = match &branch.target {
        BranchTarget::Sequence(id) => JsonBranchTarget::Sequence { id: id.clone() },
        BranchTarget::NamedBranch(id) => JsonBranchTarget::NamedBranch { id: id.clone() },
        BranchTarget::Fork(fork) => JsonBranchTarget::Fork {
            fork: JsonFork {
                functional_event_id: fork.functional_event_id.clone(),
                paths: fork.paths.iter().map(path_to_json).collect(),
            },
        },
    };

    JsonBranch {
        instructions: branch.instructions.clone(),
        house_event_assignments: branch.house_event_assignments.clone(),
        target,
    }
}

fn path_to_json(path: &Path) -> JsonPath {
    JsonPath {
        state: path.state.clone(),
        probability: path.probability,
        collect_formula_negated: path.collect_formula_negated,
        branch: branch_to_json(&path.branch),
    }
}

fn branch_from_json(branch: JsonBranch) -> Result<Branch> {
    let mut out = match branch.target {
        JsonBranchTarget::Sequence { id } => Branch::new(BranchTarget::Sequence(id)),
        JsonBranchTarget::NamedBranch { id } => Branch::new(BranchTarget::NamedBranch(id)),
        JsonBranchTarget::Fork { fork } => {
            let mut paths = Vec::with_capacity(fork.paths.len());
            for json_path in fork.paths {
                paths.push(path_from_json(json_path)?);
            }
            let fork = Fork::new(fork.functional_event_id, paths)?;
            Branch::new(BranchTarget::Fork(fork))
        }
    };

    if !branch.instructions.is_empty() {
        out = out.with_instructions(branch.instructions);
    }
    for (house_event_id, state) in branch.house_event_assignments {
        out = out.with_house_event_assignment(house_event_id, state);
    }
    Ok(out)
}

fn path_from_json(path: JsonPath) -> Result<Path> {
    let mut out = Path::new(path.state, branch_from_json(path.branch)?)?;
    if let Some(p) = path.probability {
        out = out.with_probability(p);
    }
    if let Some(negated) = path.collect_formula_negated {
        out = out.with_collect_formula_negated(negated);
    }
    Ok(out)
}

fn event_tree_to_json(event_tree: &EventTree) -> JsonEventTree {
    let mut sequences: Vec<JsonSequence> = event_tree
        .sequences
        .values()
        .map(|seq| JsonSequence {
            id: seq.id.clone(),
            name: seq.name.clone(),
            linked_event_tree_id: seq.linked_event_tree_id.clone(),
            instructions: seq.instructions.clone(),
        })
        .collect();
    sequences.sort_by(|a, b| a.id.cmp(&b.id));

    let mut functional_events: Vec<JsonFunctionalEvent> = event_tree
        .functional_events
        .values()
        .map(|fe| JsonFunctionalEvent {
            id: fe.id.clone(),
            name: fe.name.clone(),
            order: fe.order,
            fault_tree_id: fe.fault_tree_id.clone(),
            success_probability: fe.success_probability,
        })
        .collect();
    functional_events.sort_by(|a, b| a.id.cmp(&b.id));

    let mut named_branches: Vec<JsonNamedBranch> = event_tree
        .named_branches
        .values()
        .map(|nb| JsonNamedBranch {
            id: nb.id.clone(),
            name: nb.name.clone(),
            branch: branch_to_json(&nb.branch),
        })
        .collect();
    named_branches.sort_by(|a, b| a.id.cmp(&b.id));

    JsonEventTree {
        id: event_tree.id.clone(),
        name: event_tree.name.clone(),
        initial_state: branch_to_json(&event_tree.initial_state),
        sequences,
        functional_events,
        named_branches,
    }
}

fn event_tree_from_json(value: JsonEventTree) -> Result<EventTree> {
    let mut event_tree = EventTree::new(value.id, branch_from_json(value.initial_state)?);
    if let Some(name) = value.name {
        event_tree = event_tree.with_name(name);
    }

    for seq in value.sequences {
        let mut out = Sequence::new(seq.id);
        if let Some(name) = seq.name {
            out = out.with_name(name);
        }
        if let Some(linked) = seq.linked_event_tree_id {
            out = out.with_linked_event_tree(linked);
        }
        if !seq.instructions.is_empty() {
            out = out.with_instructions(seq.instructions);
        }
        event_tree.add_sequence(out)?;
    }

    for fe in value.functional_events {
        let mut out = FunctionalEvent::new(fe.id);
        if let Some(name) = fe.name {
            out = out.with_name(name);
        }
        if fe.order != 0 {
            out = out.with_order(fe.order);
        }
        if let Some(ft_id) = fe.fault_tree_id {
            out = out.with_fault_tree(ft_id);
        }
        if let Some(p) = fe.success_probability {
            out = out.with_success_probability(p);
        }
        event_tree.add_functional_event(out)?;
    }

    for nb in value.named_branches {
        let mut out = NamedBranch::new(nb.id, branch_from_json(nb.branch)?);
        if let Some(name) = nb.name {
            out = out.with_name(name);
        }
        event_tree.add_named_branch(out)?;
    }

    event_tree.validate()?;
    Ok(event_tree)
}

/// Serialize a set of Praxis event trees into a JSON value suitable for storing inside
/// OpenPRA JSON `additional_fields`.
pub fn serialize_event_tree_library(event_trees: &[EventTree]) -> Value {
    let mut by_id: HashMap<String, JsonEventTree> = HashMap::new();
    for event_tree in event_trees {
        by_id.insert(event_tree.id.clone(), event_tree_to_json(event_tree));
    }

    let mut ids: Vec<String> = by_id.keys().cloned().collect();
    ids.sort();

    let mut obj: Map<String, Value> = Map::new();
    for id in ids {
        if let Some(et) = by_id.remove(&id) {
            obj.insert(
                id,
                serde_json::to_value(et)
                    .expect("JsonEventTree must serialize to serde_json::Value"),
            );
        }
    }

    Value::Object(obj)
}

/// Deserialize a Praxis event-tree library from a JSON value.
pub fn deserialize_event_tree_library(value: &Value) -> Result<HashMap<String, EventTree>> {
    let Some(obj) = value.as_object() else {
        return Err(PraxisError::Settings(format!(
            "Expected '{LIB_KEY_HINT}' to be a JSON object"
        )));
    };

    let mut out = HashMap::new();
    for (id, entry) in obj {
        let parsed: JsonEventTree = serde_json::from_value(entry.clone()).map_err(|err| {
            PraxisError::Settings(format!(
                "Failed to parse '{LIB_KEY_HINT}.{id}' as a Praxis event tree graph: {err}"
            ))
        })?;
        let event_tree = event_tree_from_json(parsed)?;
        out.insert(id.clone(), event_tree);
    }
    Ok(out)
}
