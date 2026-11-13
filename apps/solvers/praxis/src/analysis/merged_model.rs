use std::collections::{HashMap, HashSet};

use crate::algorithms::pdag::{NodeIndex, Pdag, PdagNode};
use crate::algorithms::role_groups::{find_same_role_groups, Role};
use crate::core::event::BasicEvent;
use crate::core::fault_tree::FaultTree;
use crate::Result;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MergedRole {
    Any,
    All,
}

#[derive(Debug, Clone, PartialEq)]
pub struct MergedEvent {
    pub name: String,
    pub role: MergedRole,
    pub members: Vec<String>,
    pub probability: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct MergedModel {
    pub fault_tree: FaultTree,
    pub merged_events: Vec<MergedEvent>,
}

fn is_taken(fault_tree: &FaultTree, name: &str) -> bool {
    fault_tree.get_gate(name).is_some()
        || fault_tree.get_basic_event(name).is_some()
        || fault_tree.get_house_event(name).is_some()
}

pub fn merge_same_role_events(fault_tree: &FaultTree) -> Result<MergedModel> {
    let pdag = Pdag::from_fault_tree(fault_tree)?;
    let in_common_cause_group: HashSet<&str> = fault_tree
        .ccf_groups()
        .values()
        .flat_map(|group| group.members.iter().map(String::as_str))
        .collect();
    let name_of = |node: NodeIndex| pdag.get_node(node).and_then(PdagNode::id);
    let eligible = |event: NodeIndex| {
        name_of(event)
            .filter(|name| !in_common_cause_group.contains(name))
            .and_then(|name| fault_tree.get_basic_event(name))
            .is_some_and(|event| {
                !event.is_initiator()
                    && event.value().is_none()
                    && event.probability() > 0.0
                    && event.probability() < 1.0
            })
    };
    let mut found: Vec<(Role, Vec<String>)> = find_same_role_groups(&pdag, eligible)
        .into_iter()
        .map(|(role, members)| {
            let mut names: Vec<String> = members
                .iter()
                .filter_map(|&member| name_of(member))
                .map(str::to_string)
                .collect();
            names.sort();
            (role, names)
        })
        .collect();
    found.sort_by(|a, b| a.1.cmp(&b.1));

    let mut merged_tree = fault_tree.clone();
    let mut merged_events: Vec<MergedEvent> = Vec::with_capacity(found.len());
    let mut merged_name_of: HashMap<String, String> = HashMap::new();
    let mut serial = 0usize;
    for (role, members) in found {
        let mut name = format!("merged-events-{serial}");
        while is_taken(fault_tree, &name) {
            serial += 1;
            name = format!("merged-events-{serial}");
        }
        serial += 1;
        let probability = role.probability(
            members
                .iter()
                .filter_map(|member| fault_tree.get_basic_event(member))
                .map(BasicEvent::probability),
        );
        merged_tree.add_basic_event(BasicEvent::new(name.clone(), probability)?)?;
        for member in &members {
            merged_name_of.insert(member.clone(), name.clone());
        }
        merged_events.push(MergedEvent {
            name,
            role: match role {
                Role::Any => MergedRole::Any,
                Role::All => MergedRole::All,
            },
            members,
            probability,
        });
    }

    let reachable: HashSet<&str> = pdag
        .nodes()
        .values()
        .filter(|node| node.is_gate())
        .filter_map(PdagNode::id)
        .collect();
    let mut used_elsewhere: HashSet<String> = HashSet::new();
    let gate_names: Vec<String> = fault_tree.gates().keys().cloned().collect();
    for gate_name in gate_names {
        let Some(gate) = merged_tree.get_gate_mut(&gate_name) else {
            continue;
        };
        if !reachable.contains(gate_name.as_str()) {
            used_elsewhere.extend(gate.operands().iter().cloned());
            continue;
        }
        let mut operands: Vec<String> = Vec::with_capacity(gate.operands().len());
        for operand in gate.operands() {
            let mapped = merged_name_of.get(operand).unwrap_or(operand);
            if !operands.contains(mapped) {
                operands.push(mapped.clone());
            }
        }
        *gate.operands_mut() = operands;
    }
    for member in merged_name_of.keys() {
        if !used_elsewhere.contains(member) {
            merged_tree.remove_basic_event(member);
        }
    }

    Ok(MergedModel {
        fault_tree: merged_tree,
        merged_events,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::analysis::quantify::{quantify, Engine, Settings};
    use crate::io::parser::parse_fault_tree;
    use crate::io::pbf::{decode_fault_tree, encode_fault_tree};
    use std::collections::BTreeSet;

    const MODEL: &str = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="PLANT">
    <define-gate name="TOP"><or><gate name="SEQ1"/><gate name="SEQ2"/></or></define-gate>
    <define-gate name="SEQ1"><and><basic-event name="IE1"/><basic-event name="FLAG"/><gate name="TRAIN-A"/><gate name="TRAIN-B"/></and></define-gate>
    <define-gate name="SEQ2"><and><basic-event name="IE2"/><gate name="TRAIN-A"/><not><gate name="CHECK"/></not></and></define-gate>
    <define-gate name="TRAIN-A"><or><basic-event name="A1"/><gate name="A-MORE"/><gate name="BOTH"/><basic-event name="SUP"/><basic-event name="X"/></or></define-gate>
    <define-gate name="A-MORE"><or><basic-event name="A2"/><basic-event name="A3"/></or></define-gate>
    <define-gate name="BOTH"><and><basic-event name="P"/><basic-event name="Q"/></and></define-gate>
    <define-gate name="TRAIN-B"><or><basic-event name="B1"/><basic-event name="B2"/><basic-event name="SUP"/></or></define-gate>
    <define-gate name="CHECK"><or><basic-event name="B1"/><basic-event name="B2"/><basic-event name="X"/></or></define-gate>
  </define-fault-tree>
  <model-data>
    <define-basic-event name="IE1"><attributes><attribute name="initiator" value="true"/></attributes><float value="0.1"/></define-basic-event>
    <define-basic-event name="IE2"><attributes><attribute name="initiator" value="true"/></attributes><float value="0.5"/></define-basic-event>
    <define-basic-event name="A1"><float value="1e-2"/></define-basic-event>
    <define-basic-event name="A2"><float value="2e-3"/></define-basic-event>
    <define-basic-event name="A3"><float value="3e-5"/></define-basic-event>
    <define-basic-event name="B1"><float value="2e-2"/></define-basic-event>
    <define-basic-event name="B2"><float value="3e-4"/></define-basic-event>
    <define-basic-event name="P"><float value="0.2"/></define-basic-event>
    <define-basic-event name="Q"><float value="0.3"/></define-basic-event>
    <define-basic-event name="X"><float value="0.05"/></define-basic-event>
    <define-basic-event name="SUP"><float value="1e-3"/></define-basic-event>
    <define-basic-event name="FLAG"><float value="1.0"/></define-basic-event>
  </model-data>
</opsa-mef>"#;

    fn names(items: &[&str]) -> Vec<String> {
        items.iter().map(|item| item.to_string()).collect()
    }

    fn exact_probability(fault_tree: &FaultTree) -> f64 {
        quantify(fault_tree, &Settings::default())
            .unwrap()
            .probability
            .unwrap()
            .value
    }

    fn cut_sets(fault_tree: &FaultTree) -> BTreeSet<Vec<String>> {
        let settings = Settings {
            engine: Engine::ZbddDelterm,
            ..Default::default()
        };
        quantify(fault_tree, &settings)
            .unwrap()
            .cut_sets
            .unwrap()
            .list
            .into_iter()
            .map(|cut_set| {
                let mut literals: Vec<String> =
                    cut_set.literals.into_iter().map(|(name, _)| name).collect();
                literals.sort();
                literals
            })
            .collect()
    }

    fn expanded(sets: &BTreeSet<Vec<String>>, merged: &[MergedEvent]) -> BTreeSet<Vec<String>> {
        let by_name: HashMap<&str, &MergedEvent> = merged
            .iter()
            .map(|event| (event.name.as_str(), event))
            .collect();
        let mut out = BTreeSet::new();
        for set in sets {
            let mut partial: Vec<Vec<String>> = vec![Vec::new()];
            for literal in set {
                partial = match by_name.get(literal.as_str()) {
                    None => partial
                        .into_iter()
                        .map(|mut chosen| {
                            chosen.push(literal.clone());
                            chosen
                        })
                        .collect(),
                    Some(event) if event.role == MergedRole::All => partial
                        .into_iter()
                        .map(|mut chosen| {
                            chosen.extend(event.members.iter().cloned());
                            chosen
                        })
                        .collect(),
                    Some(event) => partial
                        .iter()
                        .flat_map(|chosen| {
                            event.members.iter().map(move |member| {
                                let mut next = chosen.clone();
                                next.push(member.clone());
                                next
                            })
                        })
                        .collect(),
                };
            }
            for mut chosen in partial {
                chosen.sort();
                out.insert(chosen);
            }
        }
        out
    }

    #[test]
    fn events_in_the_same_role_become_one_event() {
        let fault_tree = parse_fault_tree(MODEL).unwrap();
        let merged = merge_same_role_events(&fault_tree).unwrap();

        assert_eq!(merged.merged_events.len(), 3);
        let first = &merged.merged_events[0];
        assert_eq!(first.name, "merged-events-0");
        assert_eq!(first.role, MergedRole::Any);
        assert_eq!(first.members, names(&["A1", "A2", "A3"]));
        assert!((first.probability - (1.0 - 0.99 * 0.998 * 0.99997)).abs() < 1e-15);
        let second = &merged.merged_events[1];
        assert_eq!(second.role, MergedRole::Any);
        assert_eq!(second.members, names(&["B1", "B2"]));
        let third = &merged.merged_events[2];
        assert_eq!(third.role, MergedRole::All);
        assert_eq!(third.members, names(&["P", "Q"]));
        assert!((third.probability - 0.06).abs() < 1e-15);

        let tree = &merged.fault_tree;
        for member in ["A1", "A2", "A3", "B1", "B2", "P", "Q"] {
            assert!(tree.get_basic_event(member).is_none(), "{member}");
        }
        for kept in ["IE1", "IE2", "SUP", "FLAG", "X"] {
            assert!(tree.get_basic_event(kept).is_some(), "{kept}");
        }
        assert!(tree.get_basic_event("IE1").unwrap().is_initiator());
        assert_eq!(
            tree.get_gate("TRAIN-B").unwrap().operands(),
            ["merged-events-1", "SUP"]
        );
        assert_eq!(
            tree.get_gate("CHECK").unwrap().operands(),
            ["merged-events-1", "X"]
        );
        assert_eq!(
            tree.get_gate("BOTH").unwrap().operands(),
            ["merged-events-2"]
        );
    }

    #[test]
    fn the_merged_model_has_the_same_exact_probability() {
        let fault_tree = parse_fault_tree(MODEL).unwrap();
        let merged = merge_same_role_events(&fault_tree).unwrap();

        let original = exact_probability(&fault_tree);
        let collapsed = exact_probability(&merged.fault_tree);
        assert!(original > 0.0);
        assert!(
            (original - collapsed).abs() <= 1e-12 * original,
            "{original} against {collapsed}"
        );
    }

    #[test]
    fn expanding_the_merged_cut_sets_gives_the_original_cut_sets() {
        let fault_tree = parse_fault_tree(MODEL).unwrap();
        let merged = merge_same_role_events(&fault_tree).unwrap();

        let original = cut_sets(&fault_tree);
        let collapsed = cut_sets(&merged.fault_tree);
        assert!(collapsed.len() < original.len());
        assert_eq!(expanded(&collapsed, &merged.merged_events), original);
    }

    #[test]
    fn the_merged_model_survives_export_without_its_members() {
        let fault_tree = parse_fault_tree(MODEL).unwrap();
        let merged = merge_same_role_events(&fault_tree).unwrap();

        let decoded = decode_fault_tree(&encode_fault_tree(&merged.fault_tree).unwrap()).unwrap();
        assert_eq!(decoded.top_event(), "TOP");
        assert_eq!(decoded.basic_events().len(), 8);
        assert!(decoded.get_basic_event("merged-events-0").is_some());
        assert!(decoded.get_basic_event("A1").is_none());
        let again = merge_same_role_events(&decoded).unwrap();
        assert!(again.merged_events.is_empty());
    }

    #[test]
    fn a_name_already_in_the_model_is_not_reused() {
        let fault_tree =
            parse_fault_tree(&MODEL.replace("\"SUP\"", "\"merged-events-0\"")).unwrap();
        let merged = merge_same_role_events(&fault_tree).unwrap();

        assert_eq!(merged.merged_events[0].name, "merged-events-1");
        assert_eq!(
            merged
                .fault_tree
                .get_basic_event("merged-events-0")
                .unwrap()
                .probability(),
            1e-3
        );
    }
}
