use std::collections::{BTreeMap, HashMap, HashSet};

use crate::algorithms::noncoherent_mocus::{gate_expansion, Expansion};
use crate::algorithms::pdag::{Connective, NodeIndex, Pdag, PdagNode};
use crate::Result;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub(crate) enum Role {
    Any,
    All,
}

#[derive(Debug, Clone)]
pub(crate) struct RoleGroup {
    pub role: Role,
    pub merged: NodeIndex,
    pub members: Vec<NodeIndex>,
}

fn role_of(connective: Connective) -> Option<Role> {
    match connective {
        Connective::Or | Connective::Nor => Some(Role::Any),
        Connective::And | Connective::Nand => Some(Role::All),
        _ => None,
    }
}

fn absorbs(parent: Connective, child: Connective) -> bool {
    matches!(
        (parent, child),
        (Connective::Or | Connective::Nor, Connective::Or)
            | (Connective::And | Connective::Nand, Connective::And)
    )
}

fn reachable_gates(pdag: &Pdag, root: NodeIndex) -> Vec<NodeIndex> {
    let mut order: Vec<NodeIndex> = Vec::new();
    let mut opened: HashSet<NodeIndex> = HashSet::new();
    let mut stack: Vec<(NodeIndex, bool)> = vec![(root.abs(), false)];
    while let Some((node, expanded)) = stack.pop() {
        if expanded {
            order.push(node);
            continue;
        }
        let Some(PdagNode::Gate { operands, .. }) = pdag.get_node(node) else {
            continue;
        };
        if !opened.insert(node) {
            continue;
        }
        stack.push((node, true));
        for &operand in operands.iter().rev() {
            let child = operand.abs();
            if !opened.contains(&child) {
                stack.push((child, false));
            }
        }
    }
    order
}

struct Flattened {
    representative: HashMap<NodeIndex, NodeIndex>,
    operands: HashMap<NodeIndex, Vec<NodeIndex>>,
    connective: HashMap<NodeIndex, Connective>,
}

fn flatten(pdag: &Pdag, gates: &[NodeIndex]) -> Flattened {
    let mut flattened = Flattened {
        representative: HashMap::new(),
        operands: HashMap::new(),
        connective: HashMap::new(),
    };
    let mut by_shape: HashMap<(Connective, Option<usize>, Vec<NodeIndex>), NodeIndex> =
        HashMap::new();
    for &gate in gates {
        let Some(PdagNode::Gate {
            connective,
            operands,
            min_number,
            ..
        }) = pdag.get_node(gate)
        else {
            continue;
        };
        let mut flat: Vec<NodeIndex> = Vec::with_capacity(operands.len());
        for &operand in operands {
            let child = operand.abs();
            match pdag.get_node(child) {
                Some(PdagNode::Gate {
                    connective: inner, ..
                }) => {
                    let Some(&rep) = flattened.representative.get(&child) else {
                        continue;
                    };
                    if operand > 0 && absorbs(*connective, *inner) {
                        flat.extend(flattened.operands[&rep].iter().copied());
                    } else {
                        flat.push(if operand < 0 { -rep } else { rep });
                    }
                }
                Some(_) => flat.push(operand),
                None => {}
            }
        }
        flat.sort_unstable();
        if role_of(*connective).is_some() {
            flat.dedup();
        }
        let shape = (*connective, *min_number, flat);
        match by_shape.get(&shape) {
            Some(&rep) => {
                flattened.representative.insert(gate, rep);
            }
            None => {
                flattened.representative.insert(gate, gate);
                flattened.operands.insert(gate, shape.2.clone());
                flattened.connective.insert(gate, shape.0);
                by_shape.insert(shape, gate);
            }
        }
    }
    flattened
}

fn live_representatives(flattened: &Flattened, root: NodeIndex) -> Vec<NodeIndex> {
    let mut live: Vec<NodeIndex> = Vec::new();
    let mut seen: HashSet<NodeIndex> = HashSet::new();
    let Some(&top) = flattened.representative.get(&root.abs()) else {
        return live;
    };
    let mut stack = vec![top];
    while let Some(rep) = stack.pop() {
        if !seen.insert(rep) {
            continue;
        }
        live.push(rep);
        for &operand in &flattened.operands[&rep] {
            let child = operand.abs();
            if flattened.operands.contains_key(&child) && !seen.contains(&child) {
                stack.push(child);
            }
        }
    }
    live.sort_unstable();
    live
}

pub(crate) fn find_same_role_groups(
    pdag: &Pdag,
    eligible: impl Fn(NodeIndex) -> bool,
) -> Vec<(Role, Vec<NodeIndex>)> {
    let Some(root) = pdag.root() else {
        return Vec::new();
    };
    let gates = reachable_gates(pdag, root);
    let flattened = flatten(pdag, &gates);
    let live = live_representatives(&flattened, root);

    let mut parents: HashMap<NodeIndex, Vec<NodeIndex>> = HashMap::new();
    let mut barred: HashSet<NodeIndex> = HashSet::new();
    for &rep in &live {
        let role = role_of(flattened.connective[&rep]);
        for &operand in &flattened.operands[&rep] {
            let child = operand.abs();
            if !matches!(pdag.get_node(child), Some(PdagNode::BasicEvent { .. })) {
                continue;
            }
            if operand > 0 && role.is_some() {
                parents.entry(child).or_default().push(rep);
            } else {
                barred.insert(child);
            }
        }
    }

    let mut classes: BTreeMap<(Role, Vec<NodeIndex>), Vec<NodeIndex>> = BTreeMap::new();
    for (&event, gates) in &parents {
        if barred.contains(&event) || !eligible(event) {
            continue;
        }
        let mut roles = gates
            .iter()
            .filter_map(|gate| role_of(flattened.connective[gate]));
        let Some(first) = roles.next() else {
            continue;
        };
        if roles.any(|role| role != first) {
            continue;
        }
        let mut key = gates.clone();
        key.sort_unstable();
        key.dedup();
        classes.entry((first, key)).or_default().push(event);
    }

    let mut groups: Vec<(Role, Vec<NodeIndex>)> = classes
        .into_iter()
        .filter(|(_, members)| members.len() >= 2)
        .map(|((role, _), mut members)| {
            members.sort_unstable();
            (role, members)
        })
        .collect();
    groups.sort_by(|a, b| a.1.cmp(&b.1));
    groups
}

pub(crate) fn merge_same_role_events(
    pdag: &mut Pdag,
    eligible: impl Fn(NodeIndex) -> bool,
) -> Result<Vec<RoleGroup>> {
    let found = find_same_role_groups(pdag, eligible);
    if found.is_empty() {
        return Ok(Vec::new());
    }
    let Some(root) = pdag.root() else {
        return Ok(Vec::new());
    };
    let gates = reachable_gates(pdag, root);

    let mut groups: Vec<RoleGroup> = Vec::with_capacity(found.len());
    let mut merged_of: HashMap<NodeIndex, NodeIndex> = HashMap::new();
    let mut serial = 0usize;
    for (role, members) in found {
        let mut id = format!("merged-events-{serial}");
        while pdag.get_index(&id).is_some() {
            serial += 1;
            id = format!("merged-events-{serial}");
        }
        serial += 1;
        let merged = pdag.add_basic_event(id);
        for &member in &members {
            merged_of.insert(member, merged);
        }
        groups.push(RoleGroup {
            role,
            merged,
            members,
        });
    }

    for gate in gates {
        let Some(PdagNode::Gate { operands, .. }) = pdag.get_node(gate) else {
            continue;
        };
        if !operands
            .iter()
            .any(|operand| *operand > 0 && merged_of.contains_key(operand))
        {
            continue;
        }
        let mut rewritten: Vec<NodeIndex> = Vec::with_capacity(operands.len());
        for &operand in operands {
            let mapped = if operand > 0 {
                merged_of.get(&operand).copied().unwrap_or(operand)
            } else {
                operand
            };
            if !merged_of.contains_key(&operand) || !rewritten.contains(&mapped) {
                rewritten.push(mapped);
            }
        }
        pdag.update_gate_operands(gate, rewritten)?;
    }
    Ok(groups)
}

fn is_event(pdag: &Pdag, node: NodeIndex) -> bool {
    matches!(pdag.get_node(node), Some(PdagNode::BasicEvent { .. }))
}

fn negates_a_gate(flattened: &Flattened, rep: NodeIndex) -> bool {
    flattened.connective.get(&rep) == Some(&Connective::Not)
        && flattened.operands[&rep]
            .first()
            .is_some_and(|inner| *inner > 0 && flattened.operands.contains_key(inner))
}

struct FailureSide {
    parents: HashMap<NodeIndex, Vec<NodeIndex>>,
    barred: HashSet<NodeIndex>,
    supported: bool,
}

fn failure_side(pdag: &Pdag, flattened: &Flattened, root: NodeIndex) -> FailureSide {
    let mut side = FailureSide {
        parents: HashMap::new(),
        barred: HashSet::new(),
        supported: true,
    };
    let Some(&top) = flattened.representative.get(&root.abs()) else {
        return side;
    };
    let mut visited: HashSet<(NodeIndex, bool)> = HashSet::new();
    let mut pending: Vec<(NodeIndex, bool)> = vec![(top, root < 0)];
    while let Some((rep, negated)) = pending.pop() {
        if !visited.insert((rep, negated)) {
            continue;
        }
        let connective = flattened.connective[&rep];
        let operands = &flattened.operands[&rep];
        let role = match (negated, connective) {
            (false, Connective::Or) => Some(Role::Any),
            (false, Connective::And) => Some(Role::All),
            _ => None,
        };
        for &operand in operands {
            let child = operand.abs();
            if !is_event(pdag, child) {
                continue;
            }
            if operand > 0 && role.is_some() {
                side.parents.entry(child).or_default().push(rep);
            } else {
                side.barred.insert(child);
            }
        }
        let (references, conjunctive) = match gate_expansion(connective, negated, operands, None) {
            Expansion::Conjunction(references) | Expansion::AtLeast(_, references) => {
                (references, true)
            }
            Expansion::Disjunction(references) => (references, false),
            Expansion::Unsupported => {
                side.supported = false;
                continue;
            }
        };
        for reference in references {
            let child = reference.abs();
            if !flattened.operands.contains_key(&child) {
                continue;
            }
            let checked_later = if reference > 0 {
                negates_a_gate(flattened, child)
            } else {
                conjunctive
            };
            if !checked_later {
                pending.push((child, reference < 0));
            }
        }
    }
    side
}

pub(crate) fn carve_failure_side_groups(
    pdag: &mut Pdag,
    eligible: impl Fn(NodeIndex) -> bool,
) -> Result<Vec<RoleGroup>> {
    let Some(root) = pdag.root() else {
        return Ok(Vec::new());
    };
    let effective_root = if pdag.complement() { -root } else { root };
    let gates = reachable_gates(pdag, root);
    let flattened = flatten(pdag, &gates);
    let side = failure_side(pdag, &flattened, effective_root);
    if !side.supported {
        return Ok(Vec::new());
    }

    let mut classes: BTreeMap<(Role, Vec<NodeIndex>), Vec<NodeIndex>> = BTreeMap::new();
    for (&event, parents) in &side.parents {
        if side.barred.contains(&event) || !eligible(event) {
            continue;
        }
        let mut roles = parents
            .iter()
            .filter_map(|parent| role_of(flattened.connective[parent]));
        let Some(first) = roles.next() else {
            continue;
        };
        if roles.any(|role| role != first) {
            continue;
        }
        let mut key = parents.clone();
        key.sort_unstable();
        key.dedup();
        classes.entry((first, key)).or_default().push(event);
    }

    let mut found: Vec<(Role, Vec<NodeIndex>, Vec<NodeIndex>)> = classes
        .into_iter()
        .filter(|(_, members)| members.len() >= 2)
        .map(|((role, parents), mut members)| {
            members.sort_unstable();
            (role, members, parents)
        })
        .collect();
    found.sort_by(|a, b| a.1.cmp(&b.1));
    if found.is_empty() {
        return Ok(Vec::new());
    }

    let mut groups: Vec<RoleGroup> = Vec::with_capacity(found.len());
    let mut group_gate_of: HashMap<NodeIndex, NodeIndex> = HashMap::new();
    let mut rewritten_parents: HashSet<NodeIndex> = HashSet::new();
    let mut serial = 0usize;
    for (role, members, parents) in found {
        let mut id = format!("grouped-events-{serial}");
        while pdag.get_index(&id).is_some() {
            serial += 1;
            id = format!("grouped-events-{serial}");
        }
        serial += 1;
        let connective = match role {
            Role::Any => Connective::Or,
            Role::All => Connective::And,
        };
        let group_gate = pdag.add_gate(id, connective, members.clone(), None)?;
        for &member in &members {
            group_gate_of.insert(member, group_gate);
        }
        rewritten_parents.extend(parents);
        groups.push(RoleGroup {
            role,
            merged: group_gate,
            members,
        });
    }

    for gate in gates {
        let Some(&representative) = flattened.representative.get(&gate) else {
            continue;
        };
        if !rewritten_parents.contains(&representative) {
            continue;
        }
        let mut operands: Vec<NodeIndex> = Vec::new();
        for &operand in &flattened.operands[&representative] {
            let mapped = if operand > 0 {
                group_gate_of.get(&operand).copied().unwrap_or(operand)
            } else {
                operand
            };
            if !operands.contains(&mapped) {
                operands.push(mapped);
            }
        }
        pdag.update_gate_operands(gate, operands)?;
    }
    Ok(groups)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn event(pdag: &mut Pdag, name: &str) -> NodeIndex {
        pdag.add_basic_event(name.to_string())
    }

    fn gate(
        pdag: &mut Pdag,
        name: &str,
        connective: Connective,
        operands: Vec<NodeIndex>,
    ) -> NodeIndex {
        pdag.add_gate(name.to_string(), connective, operands, None)
            .unwrap()
    }

    fn names(pdag: &Pdag, nodes: &[NodeIndex]) -> Vec<String> {
        nodes
            .iter()
            .map(|node| pdag.get_node(*node).unwrap().id().unwrap().to_string())
            .collect()
    }

    #[test]
    fn events_under_one_gate_only_form_a_group() {
        let mut pdag = Pdag::new();
        let a: Vec<NodeIndex> = ["A1", "A2", "A3"]
            .iter()
            .map(|n| event(&mut pdag, n))
            .collect();
        let b: Vec<NodeIndex> = ["B1", "B2"].iter().map(|n| event(&mut pdag, n)).collect();
        let shared = event(&mut pdag, "S");
        let g1 = gate(
            &mut pdag,
            "G1",
            Connective::Or,
            vec![a[0], a[1], a[2], shared],
        );
        let g2 = gate(&mut pdag, "G2", Connective::Or, vec![b[0], b[1], shared]);
        let top = gate(&mut pdag, "TOP", Connective::And, vec![g1, g2]);
        pdag.set_root(top).unwrap();

        let groups = find_same_role_groups(&pdag, |_| true);
        assert_eq!(groups.len(), 2);
        assert_eq!(groups[0].0, Role::Any);
        assert_eq!(names(&pdag, &groups[0].1), vec!["A1", "A2", "A3"]);
        assert_eq!(names(&pdag, &groups[1].1), vec!["B1", "B2"]);
    }

    #[test]
    fn events_with_the_same_parents_group_across_nested_gates() {
        let mut pdag = Pdag::new();
        let x = event(&mut pdag, "X");
        let y = event(&mut pdag, "Y");
        let a = event(&mut pdag, "A");
        let b = event(&mut pdag, "B");
        let inner1 = gate(&mut pdag, "H1", Connective::Or, vec![y]);
        let g1 = gate(&mut pdag, "G1", Connective::Or, vec![x, inner1, a]);
        let inner2 = gate(&mut pdag, "H2", Connective::Or, vec![x, y]);
        let g2 = gate(&mut pdag, "G2", Connective::Or, vec![inner2, b]);
        let top = gate(&mut pdag, "TOP", Connective::And, vec![g1, g2]);
        pdag.set_root(top).unwrap();

        let groups = find_same_role_groups(&pdag, |_| true);
        assert_eq!(groups.len(), 1);
        assert_eq!(names(&pdag, &groups[0].1), vec!["X", "Y"]);
    }

    #[test]
    fn a_shared_inner_gate_keeps_its_events_apart() {
        let mut pdag = Pdag::new();
        let x = event(&mut pdag, "X");
        let y = event(&mut pdag, "Y");
        let z = event(&mut pdag, "Z");
        let inner = gate(&mut pdag, "H", Connective::Or, vec![y, z]);
        let g1 = gate(&mut pdag, "G1", Connective::Or, vec![x, inner]);
        let g2 = gate(&mut pdag, "G2", Connective::And, vec![inner, x]);
        let top = gate(&mut pdag, "TOP", Connective::Or, vec![g1, g2]);
        pdag.set_root(top).unwrap();

        let groups = find_same_role_groups(&pdag, |_| true);
        assert_eq!(groups.len(), 1);
        assert_eq!(names(&pdag, &groups[0].1), vec!["Y", "Z"]);
    }

    #[test]
    fn events_that_always_occur_together_under_and_gates_group() {
        let mut pdag = Pdag::new();
        let x = event(&mut pdag, "X");
        let y = event(&mut pdag, "Y");
        let a = event(&mut pdag, "A");
        let b = event(&mut pdag, "B");
        let g1 = gate(&mut pdag, "G1", Connective::And, vec![x, y, a]);
        let g2 = gate(&mut pdag, "G2", Connective::And, vec![x, y, b]);
        let top = gate(&mut pdag, "TOP", Connective::Or, vec![g1, g2]);
        pdag.set_root(top).unwrap();

        let groups = find_same_role_groups(&pdag, |_| true);
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].0, Role::All);
        assert_eq!(names(&pdag, &groups[0].1), vec!["X", "Y"]);
    }

    #[test]
    fn negated_and_counted_occurrences_are_left_alone() {
        let mut pdag = Pdag::new();
        let x = event(&mut pdag, "X");
        let y = event(&mut pdag, "Y");
        let u = event(&mut pdag, "U");
        let v = event(&mut pdag, "V");
        let w = event(&mut pdag, "W");
        let g1 = gate(&mut pdag, "G1", Connective::Or, vec![x, y]);
        let g2 = gate(&mut pdag, "G2", Connective::And, vec![g1, -x]);
        let vote = pdag
            .add_gate(
                "VOTE".to_string(),
                Connective::AtLeast,
                vec![u, v, w],
                Some(2),
            )
            .unwrap();
        let top = gate(&mut pdag, "TOP", Connective::Or, vec![g2, vote]);
        pdag.set_root(top).unwrap();

        assert!(find_same_role_groups(&pdag, |_| true).is_empty());
    }

    fn operands_of(pdag: &Pdag, gate: NodeIndex) -> Vec<NodeIndex> {
        match pdag.get_node(gate) {
            Some(PdagNode::Gate { operands, .. }) => operands.clone(),
            _ => panic!("gate expected"),
        }
    }

    #[test]
    fn events_that_differ_only_under_a_negated_gate_form_a_failure_side_group() {
        let mut pdag = Pdag::new();
        let ie1 = event(&mut pdag, "IE1");
        let ie2 = event(&mut pdag, "IE2");
        let a = event(&mut pdag, "A");
        let b = event(&mut pdag, "B");
        let c = event(&mut pdag, "C");
        let d = event(&mut pdag, "D");
        let train = gate(&mut pdag, "TRAIN", Connective::Or, vec![a, b, c]);
        let check = gate(&mut pdag, "CHECK", Connective::Or, vec![a, d]);
        let seq1 = gate(&mut pdag, "SEQ1", Connective::And, vec![ie1, train, -check]);
        let seq2 = gate(&mut pdag, "SEQ2", Connective::And, vec![ie2, train]);
        let top = gate(&mut pdag, "TOP", Connective::Or, vec![seq1, seq2]);
        pdag.set_root(top).unwrap();

        let everywhere = find_same_role_groups(&pdag, |_| true);
        assert_eq!(everywhere.len(), 1);
        assert_eq!(names(&pdag, &everywhere[0].1), vec!["B", "C"]);

        let original = pdag.clone();
        let groups = carve_failure_side_groups(&mut pdag, |_| true).unwrap();

        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].role, Role::Any);
        assert_eq!(names(&pdag, &groups[0].members), vec!["A", "B", "C"]);
        assert_eq!(operands_of(&pdag, train), vec![groups[0].merged]);
        assert_eq!(operands_of(&pdag, groups[0].merged), vec![a, b, c]);
        assert_eq!(operands_of(&pdag, check), vec![a, d]);
        assert!(crate::algorithms::bdd_engine::Bdd::equivalent(&original, &pdag).unwrap());
    }

    #[test]
    fn a_not_gate_over_a_gate_hides_its_events_like_a_negated_reference() {
        let mut pdag = Pdag::new();
        let ie = event(&mut pdag, "IE");
        let a = event(&mut pdag, "A");
        let b = event(&mut pdag, "B");
        let d = event(&mut pdag, "D");
        let train = gate(&mut pdag, "TRAIN", Connective::Or, vec![a, b]);
        let check = gate(&mut pdag, "CHECK", Connective::Or, vec![a, d]);
        let success = gate(&mut pdag, "SUCCESS", Connective::Not, vec![check]);
        let top = gate(&mut pdag, "TOP", Connective::And, vec![ie, train, success]);
        pdag.set_root(top).unwrap();

        let original = pdag.clone();
        let groups = carve_failure_side_groups(&mut pdag, |_| true).unwrap();

        assert_eq!(groups.len(), 1);
        assert_eq!(names(&pdag, &groups[0].members), vec!["A", "B"]);
        assert_eq!(operands_of(&pdag, check), vec![a, d]);
        assert!(crate::algorithms::bdd_engine::Bdd::equivalent(&original, &pdag).unwrap());
    }

    #[test]
    fn an_event_negated_on_the_failure_side_stays_out_of_the_groups() {
        let mut pdag = Pdag::new();
        let ie = event(&mut pdag, "IE");
        let a = event(&mut pdag, "A");
        let b = event(&mut pdag, "B");
        let c = event(&mut pdag, "C");
        let train = gate(&mut pdag, "TRAIN", Connective::Or, vec![a, b, c]);
        let seq1 = gate(&mut pdag, "SEQ1", Connective::And, vec![ie, train, -a]);
        let seq2 = gate(&mut pdag, "SEQ2", Connective::And, vec![ie, train]);
        let top = gate(&mut pdag, "TOP", Connective::Or, vec![seq1, seq2]);
        pdag.set_root(top).unwrap();

        let original = pdag.clone();
        let groups = carve_failure_side_groups(&mut pdag, |_| true).unwrap();

        assert_eq!(groups.len(), 1);
        assert_eq!(names(&pdag, &groups[0].members), vec!["B", "C"]);
        assert_eq!(operands_of(&pdag, train), vec![a, groups[0].merged]);
        assert!(crate::algorithms::bdd_engine::Bdd::equivalent(&original, &pdag).unwrap());
    }

    #[test]
    fn events_reached_only_through_a_negated_gate_form_no_group() {
        let mut pdag = Pdag::new();
        let ie = event(&mut pdag, "IE");
        let a = event(&mut pdag, "A");
        let b = event(&mut pdag, "B");
        let check = gate(&mut pdag, "CHECK", Connective::Or, vec![a, b]);
        let top = gate(&mut pdag, "TOP", Connective::And, vec![ie, -check]);
        pdag.set_root(top).unwrap();

        assert!(carve_failure_side_groups(&mut pdag, |_| true)
            .unwrap()
            .is_empty());
        assert_eq!(operands_of(&pdag, check), vec![a, b]);
    }

    #[test]
    fn identical_gates_and_nested_gates_are_all_regrouped() {
        let mut pdag = Pdag::new();
        let ie1 = event(&mut pdag, "IE1");
        let ie2 = event(&mut pdag, "IE2");
        let a = event(&mut pdag, "A");
        let b = event(&mut pdag, "B");
        let s = event(&mut pdag, "S");
        let d = event(&mut pdag, "D");
        let inner = gate(&mut pdag, "INNER", Connective::Or, vec![b]);
        let first = gate(&mut pdag, "FIRST", Connective::Or, vec![a, inner, s]);
        let twin = gate(&mut pdag, "TWIN", Connective::Or, vec![s, b, a]);
        let other = gate(&mut pdag, "OTHER", Connective::Or, vec![s, d]);
        let check = gate(&mut pdag, "CHECK", Connective::Or, vec![a, d]);
        let seq1 = gate(
            &mut pdag,
            "SEQ1",
            Connective::And,
            vec![ie1, first, other, -check],
        );
        let seq2 = gate(&mut pdag, "SEQ2", Connective::And, vec![ie2, twin]);
        let top = gate(&mut pdag, "TOP", Connective::Or, vec![seq1, seq2]);
        pdag.set_root(top).unwrap();

        let original = pdag.clone();
        let groups = carve_failure_side_groups(&mut pdag, |_| true).unwrap();

        assert_eq!(groups.len(), 1);
        assert_eq!(names(&pdag, &groups[0].members), vec!["A", "B"]);
        let group_gate = groups[0].merged;
        assert_eq!(operands_of(&pdag, first), vec![group_gate, s]);
        assert_eq!(operands_of(&pdag, twin), vec![group_gate, s]);
        assert_eq!(operands_of(&pdag, inner), vec![b]);
        assert_eq!(operands_of(&pdag, check), vec![a, d]);
        assert!(crate::algorithms::bdd_engine::Bdd::equivalent(&original, &pdag).unwrap());
    }

    #[test]
    fn events_that_always_fail_together_on_the_failure_side_form_an_all_group() {
        let mut pdag = Pdag::new();
        let ie = event(&mut pdag, "IE");
        let x = event(&mut pdag, "X");
        let y = event(&mut pdag, "Y");
        let a = event(&mut pdag, "A");
        let d = event(&mut pdag, "D");
        let both = gate(&mut pdag, "BOTH", Connective::And, vec![x, y, a]);
        let check = gate(&mut pdag, "CHECK", Connective::Or, vec![x, d]);
        let top = gate(&mut pdag, "TOP", Connective::And, vec![ie, both, -check]);
        pdag.set_root(top).unwrap();

        let original = pdag.clone();
        let groups = carve_failure_side_groups(&mut pdag, |_| true).unwrap();

        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].role, Role::All);
        assert_eq!(names(&pdag, &groups[0].members), vec!["IE", "X", "Y", "A"]);
        assert!(crate::algorithms::bdd_engine::Bdd::equivalent(&original, &pdag).unwrap());
    }

    #[test]
    fn merging_rewrites_every_parent_once() {
        let mut pdag = Pdag::new();
        let x = event(&mut pdag, "X");
        let y = event(&mut pdag, "Y");
        let a = event(&mut pdag, "A");
        let inner = gate(&mut pdag, "H", Connective::Or, vec![y]);
        let g1 = gate(&mut pdag, "G1", Connective::Or, vec![x, inner, a]);
        let top = gate(&mut pdag, "TOP", Connective::And, vec![g1, a]);
        pdag.set_root(top).unwrap();

        let groups = merge_same_role_events(&mut pdag, |_| true).unwrap();
        assert_eq!(groups.len(), 1);
        let merged = groups[0].merged;
        let Some(PdagNode::Gate { operands, .. }) = pdag.get_node(g1) else {
            panic!("gate expected");
        };
        assert_eq!(operands, &vec![merged, inner, a]);
        let Some(PdagNode::Gate { operands, .. }) = pdag.get_node(inner) else {
            panic!("gate expected");
        };
        assert_eq!(operands, &vec![merged]);
    }

    #[test]
    fn ineligible_events_stay_out_of_a_group() {
        let mut pdag = Pdag::new();
        let x = event(&mut pdag, "X");
        let y = event(&mut pdag, "Y");
        let z = event(&mut pdag, "Z");
        let top = gate(&mut pdag, "TOP", Connective::Or, vec![x, y, z]);
        pdag.set_root(top).unwrap();

        let groups = find_same_role_groups(&pdag, |node| node != z);
        assert_eq!(groups.len(), 1);
        assert_eq!(names(&pdag, &groups[0].1), vec!["X", "Y"]);
    }
}
