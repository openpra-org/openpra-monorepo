use std::collections::{HashMap, HashSet};

use crate::algorithms::pdag::{Connective, NodeIndex, Pdag, PdagNode};

#[derive(Clone, Copy, PartialEq, Eq)]
enum Kind {
    Event,
    Constant(bool),
    Gate(Connective),
    Missing,
}

pub(crate) struct GateLogic {
    kinds: Vec<Kind>,
    minimums: Vec<u32>,
    first: Vec<u32>,
    edges: Vec<i32>,
    levels: Vec<u32>,
    monotone: Vec<bool>,
    supports: Vec<u64>,
    words: usize,
    ids: HashMap<NodeIndex, u32>,
}

pub(crate) struct Assignment {
    epoch: u32,
    seen: Vec<u32>,
    value: Vec<i8>,
    truth: Vec<u64>,
    falsity: Vec<u64>,
    touched: Vec<usize>,
}

const NO_LEVEL: u32 = u32::MAX;

impl GateLogic {
    pub(crate) fn new(
        pdag: &Pdag,
        roots: &[NodeIndex],
        level_of: &HashMap<NodeIndex, usize>,
        level_count: usize,
    ) -> Self {
        let words = level_count.div_ceil(64).max(1);
        let mut logic = GateLogic {
            kinds: Vec::new(),
            minimums: Vec::new(),
            first: Vec::new(),
            edges: Vec::new(),
            levels: Vec::new(),
            monotone: Vec::new(),
            supports: Vec::new(),
            words,
            ids: HashMap::new(),
        };
        let mut pending: Vec<(NodeIndex, bool)> =
            roots.iter().rev().map(|root| (root.abs(), false)).collect();
        let mut opened: HashSet<NodeIndex> = HashSet::new();
        while let Some((node, expanded)) = pending.pop() {
            if expanded {
                logic.add(pdag, node, level_of);
                continue;
            }
            if !opened.insert(node) {
                continue;
            }
            pending.push((node, true));
            if let Some(PdagNode::Gate { operands, .. }) = pdag.get_node(node) {
                for &operand in operands.iter().rev() {
                    let child = operand.abs();
                    if !opened.contains(&child) {
                        pending.push((child, false));
                    }
                }
            }
        }
        logic.first.push(logic.edges.len() as u32);
        logic
    }

    fn add(&mut self, pdag: &Pdag, node: NodeIndex, level_of: &HashMap<NodeIndex, usize>) {
        let id = self.kinds.len() as u32;
        self.ids.insert(node, id);
        self.first.push(self.edges.len() as u32);
        let mut support = vec![0u64; self.words];
        let mut monotone = true;
        let mut level = NO_LEVEL;
        let mut minimum = 1u32;
        let kind = match pdag.get_node(node) {
            Some(PdagNode::BasicEvent { .. }) => {
                if let Some(&l) = level_of.get(&node) {
                    level = l as u32;
                    if l / 64 < self.words {
                        support[l / 64] |= 1u64 << (l % 64);
                    }
                }
                Kind::Event
            }
            Some(PdagNode::Constant { value, .. }) => {
                monotone = !*value;
                Kind::Constant(*value)
            }
            Some(PdagNode::Gate {
                connective,
                operands,
                min_number,
                ..
            }) => {
                minimum = min_number.unwrap_or(1) as u32;
                if !matches!(
                    connective,
                    Connective::And | Connective::Or | Connective::AtLeast | Connective::Null
                ) || operands.is_empty()
                    || minimum == 0
                {
                    monotone = false;
                }
                for &operand in operands {
                    match self.ids.get(&operand.abs()) {
                        Some(&child) => {
                            let signed = child as i32 + 1;
                            self.edges.push(if operand < 0 { -signed } else { signed });
                            if operand < 0 || !self.monotone[child as usize] {
                                monotone = false;
                            }
                            let start = child as usize * self.words;
                            for word in 0..self.words {
                                support[word] |= self.supports[start + word];
                            }
                        }
                        None => {
                            self.edges.push(0);
                            monotone = false;
                        }
                    }
                }
                Kind::Gate(*connective)
            }
            None => Kind::Missing,
        };
        self.kinds.push(kind);
        self.minimums.push(minimum);
        self.levels.push(level);
        self.monotone.push(monotone);
        self.supports.extend(support);
    }

    pub(crate) fn id(&self, node: NodeIndex) -> Option<u32> {
        self.ids.get(&node.abs()).copied()
    }

    pub(crate) fn assignment(&self) -> Assignment {
        Assignment {
            epoch: 0,
            seen: vec![0; self.kinds.len()],
            value: vec![0; self.kinds.len()],
            truth: vec![0; self.words],
            falsity: vec![0; self.words],
            touched: Vec::new(),
        }
    }

    pub(crate) fn assign(&self, state: &mut Assignment, literals: &[usize]) {
        for &word in &state.touched {
            state.truth[word] = 0;
            state.falsity[word] = 0;
        }
        state.touched.clear();
        state.epoch = state.epoch.wrapping_add(1);
        if state.epoch == 0 {
            state.seen.iter_mut().for_each(|stamp| *stamp = 0);
            state.epoch = 1;
        }
        for &literal in literals {
            let level = literal / 2;
            let word = level / 64;
            if word >= self.words {
                continue;
            }
            if literal % 2 == 0 {
                state.truth[word] |= 1u64 << (level % 64);
            } else {
                state.falsity[word] |= 1u64 << (level % 64);
            }
            state.touched.push(word);
        }
    }

    pub(crate) fn evaluate(&self, state: &mut Assignment, id: u32, unknown: i8) -> i8 {
        let index = id as usize;
        if state.seen[index] == state.epoch {
            return state.value[index];
        }
        let value = match self.kinds[index] {
            Kind::Event => {
                let level = self.levels[index];
                if level == NO_LEVEL {
                    unknown
                } else {
                    let (word, bit) = (level as usize / 64, 1u64 << (level % 64));
                    if state.truth[word] & bit != 0 {
                        1
                    } else if state.falsity[word] & bit != 0 {
                        -1
                    } else {
                        unknown
                    }
                }
            }
            Kind::Constant(value) => {
                if value {
                    1
                } else {
                    -1
                }
            }
            Kind::Missing => -1,
            Kind::Gate(connective) => {
                if unknown == -1 && self.monotone[index] && !self.touches(state, index) {
                    -1
                } else {
                    self.gate_value(state, index, connective, unknown)
                }
            }
        };
        state.seen[index] = state.epoch;
        state.value[index] = value;
        value
    }

    fn touches(&self, state: &Assignment, index: usize) -> bool {
        let start = index * self.words;
        state
            .touched
            .iter()
            .any(|&word| self.supports[start + word] & state.truth[word] != 0)
    }

    fn operand(&self, state: &mut Assignment, edge: i32, unknown: i8) -> i8 {
        if edge == 0 {
            return -1;
        }
        let value = self.evaluate(state, edge.unsigned_abs() - 1, unknown);
        if edge < 0 {
            -value
        } else {
            value
        }
    }

    fn gate_value(
        &self,
        state: &mut Assignment,
        index: usize,
        connective: Connective,
        unknown: i8,
    ) -> i8 {
        let (start, end) = (self.first[index] as usize, self.first[index + 1] as usize);
        match connective {
            Connective::And | Connective::Nand => {
                let mut all = 1i8;
                for position in start..end {
                    let value = self.operand(state, self.edges[position], unknown);
                    if value == -1 {
                        all = -1;
                        break;
                    }
                    if value == 0 {
                        all = 0;
                    }
                }
                if connective == Connective::Nand {
                    -all
                } else {
                    all
                }
            }
            Connective::Or | Connective::Nor => {
                let mut any = -1i8;
                for position in start..end {
                    let value = self.operand(state, self.edges[position], unknown);
                    if value == 1 {
                        any = 1;
                        break;
                    }
                    if value == 0 {
                        any = 0;
                    }
                }
                if connective == Connective::Nor {
                    -any
                } else {
                    any
                }
            }
            Connective::Not => {
                if start < end {
                    -self.operand(state, self.edges[start], unknown)
                } else {
                    -1
                }
            }
            Connective::Null => {
                if start < end {
                    self.operand(state, self.edges[start], unknown)
                } else {
                    -1
                }
            }
            Connective::AtLeast => {
                let needed = self.minimums[index] as usize;
                let mut held = 0usize;
                let mut open = 0usize;
                for position in start..end {
                    match self.operand(state, self.edges[position], unknown) {
                        1 => held += 1,
                        0 => open += 1,
                        _ => {}
                    }
                }
                if held >= needed {
                    1
                } else if held + open < needed {
                    -1
                } else {
                    0
                }
            }
            Connective::Xor => {
                let mut odd = false;
                let mut open = false;
                for position in start..end {
                    match self.operand(state, self.edges[position], unknown) {
                        1 => odd = !odd,
                        0 => open = true,
                        _ => {}
                    }
                }
                if open {
                    0
                } else if odd {
                    1
                } else {
                    -1
                }
            }
            Connective::Iff => {
                let mut open = false;
                let mut first: Option<i8> = None;
                let mut equal = true;
                for position in start..end {
                    let value = self.operand(state, self.edges[position], unknown);
                    if value == 0 {
                        open = true;
                    }
                    match first {
                        None => first = Some(value),
                        Some(seen) => {
                            if seen != value {
                                equal = false;
                            }
                        }
                    }
                }
                if open {
                    0
                } else if equal {
                    1
                } else {
                    -1
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reference(
        pdag: &Pdag,
        index: NodeIndex,
        truth: &[NodeIndex],
        falsity: &[NodeIndex],
        unknown: i8,
    ) -> i8 {
        let node = index.abs();
        let value = match pdag.get_node(node) {
            Some(PdagNode::BasicEvent { .. }) => {
                if truth.contains(&node) {
                    1
                } else if falsity.contains(&node) {
                    -1
                } else {
                    unknown
                }
            }
            Some(PdagNode::Constant { value, .. }) => {
                if *value {
                    1
                } else {
                    -1
                }
            }
            Some(PdagNode::Gate {
                connective,
                operands,
                min_number,
                ..
            }) => {
                let values: Vec<i8> = operands
                    .iter()
                    .map(|&operand| reference(pdag, operand, truth, falsity, unknown))
                    .collect();
                let held = values.iter().filter(|&&v| v == 1).count();
                let open = values.iter().filter(|&&v| v == 0).count();
                let lost = values.iter().filter(|&&v| v == -1).count();
                match connective {
                    Connective::And | Connective::Nand => {
                        let all = if lost > 0 {
                            -1
                        } else if open > 0 {
                            0
                        } else {
                            1
                        };
                        if *connective == Connective::Nand {
                            -all
                        } else {
                            all
                        }
                    }
                    Connective::Or | Connective::Nor => {
                        let any = if held > 0 {
                            1
                        } else if open > 0 {
                            0
                        } else {
                            -1
                        };
                        if *connective == Connective::Nor {
                            -any
                        } else {
                            any
                        }
                    }
                    Connective::Not => -values[0],
                    Connective::Null => values[0],
                    Connective::AtLeast => {
                        let needed = min_number.unwrap_or(1);
                        if held >= needed {
                            1
                        } else if held + open < needed {
                            -1
                        } else {
                            0
                        }
                    }
                    Connective::Xor => {
                        if open > 0 {
                            0
                        } else if held % 2 == 1 {
                            1
                        } else {
                            -1
                        }
                    }
                    Connective::Iff => {
                        if open > 0 {
                            0
                        } else if values.iter().all(|&v| v == values[0]) {
                            1
                        } else {
                            -1
                        }
                    }
                }
            }
            None => -1,
        };
        if index < 0 {
            -value
        } else {
            value
        }
    }

    struct Lcg(u64);

    impl Lcg {
        fn next(&mut self, bound: usize) -> usize {
            self.0 = self
                .0
                .wrapping_mul(6364136223846793005)
                .wrapping_add(1442695040888963407);
            ((self.0 >> 33) as usize) % bound
        }
    }

    #[test]
    fn evaluation_matches_a_plain_recursive_reference_on_random_graphs() {
        let connectives = [
            Connective::And,
            Connective::Or,
            Connective::Not,
            Connective::Null,
            Connective::AtLeast,
            Connective::Nand,
            Connective::Nor,
            Connective::Xor,
            Connective::Iff,
        ];
        let mut random = Lcg(7);
        for round in 0..300 {
            let mut pdag = Pdag::new();
            let event_count = 5 + random.next(4);
            let events: Vec<NodeIndex> = (0..event_count)
                .map(|i| pdag.add_basic_event(format!("E{i}")))
                .collect();
            let mut nodes = events.clone();
            let coherent = round % 3 == 0;
            let gate_count = 4 + random.next(8);
            let mut gates: Vec<NodeIndex> = Vec::new();
            for g in 0..gate_count {
                let connective = if coherent {
                    [Connective::And, Connective::Or, Connective::AtLeast][random.next(3)]
                } else {
                    connectives[random.next(connectives.len())]
                };
                let arity = match connective {
                    Connective::Not | Connective::Null => 1,
                    _ => 2 + random.next(3),
                };
                let mut operands: Vec<NodeIndex> = Vec::new();
                for _ in 0..arity {
                    let pick = nodes[random.next(nodes.len())];
                    let negated = !coherent && random.next(5) == 0;
                    operands.push(if negated { -pick } else { pick });
                }
                let minimum = if connective == Connective::AtLeast {
                    Some(1 + random.next(arity))
                } else {
                    None
                };
                let gate = pdag
                    .add_gate(format!("G{g}"), connective, operands, minimum)
                    .unwrap();
                nodes.push(gate);
                gates.push(gate);
            }
            let level_of: HashMap<NodeIndex, usize> =
                events.iter().enumerate().map(|(l, &e)| (e, l)).collect();
            let logic = GateLogic::new(&pdag, &gates, &level_of, event_count);
            let mut state = logic.assignment();
            for mask in 0..(1usize << event_count) {
                let split = random.next(1usize << event_count);
                let mut literals: Vec<usize> = Vec::new();
                let mut truth: Vec<NodeIndex> = Vec::new();
                let mut falsity: Vec<NodeIndex> = Vec::new();
                for (l, &e) in events.iter().enumerate() {
                    if mask >> l & 1 == 1 {
                        literals.push(2 * l);
                        truth.push(e);
                    } else if split >> l & 1 == 1 {
                        literals.push(2 * l + 1);
                        falsity.push(e);
                    }
                }
                for unknown in [-1i8, 0] {
                    logic.assign(&mut state, &literals);
                    for &gate in &gates {
                        let id = logic.id(gate).unwrap();
                        assert_eq!(
                            logic.evaluate(&mut state, id, unknown),
                            reference(&pdag, gate, &truth, &falsity, unknown),
                            "round {round} gate {gate} mask {mask} unknown {unknown}"
                        );
                    }
                }
            }
        }
    }
}
