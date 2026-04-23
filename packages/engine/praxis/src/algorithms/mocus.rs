use crate::core::fault_tree::FaultTree;
use crate::core::gate::Formula;
use crate::error::{MefError, PraxisError};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CutSet {
    pub events: HashSet<String>,
}

impl CutSet {
    pub fn new(events: Vec<String>) -> Self {
        Self {
            events: events.into_iter().collect(),
        }
    }

    pub fn order(&self) -> usize {
        self.events.len()
    }

    pub fn is_minimal(&self, other_sets: &[CutSet]) -> bool {
        for other in other_sets {
            if other != self && other.events.is_subset(&self.events) {
                return false;
            }
        }
        true
    }
}

pub struct Mocus<'a> {
    fault_tree: &'a FaultTree,
    cut_sets: Vec<CutSet>,
    cut_sets_bits: Vec<Vec<u64>>,
    max_order: Option<usize>,
    basic_event_index: HashMap<String, usize>,
    basic_event_bit_words: usize,
}

impl<'a> Mocus<'a> {
    pub fn new(fault_tree: &'a FaultTree) -> Self {
        Self {
            fault_tree,
            cut_sets: Vec::new(),
            cut_sets_bits: Vec::new(),
            max_order: None,
            basic_event_index: HashMap::new(),
            basic_event_bit_words: 0,
        }
    }

    pub fn with_max_order(mut self, max_order: usize) -> Self {
        self.max_order = Some(max_order);
        self
    }

    pub fn analyze(&mut self) -> Result<&[CutSet], PraxisError> {
        self.cut_sets.clear();
        self.cut_sets_bits.clear();

        self.validate_element_exists(self.fault_tree.top_event(), "top event".to_string())?;

        self.validate_no_cycles()?;

        self.rebuild_basic_event_index();

        let mut work_queue: VecDeque<Vec<String>> = VecDeque::new();
        let mut seen_work_sets: HashSet<Vec<String>> = HashSet::new();

        let Some(initial_set) = self.canonicalize_set(&[self.fault_tree.top_event().to_string()])
        else {
            return Ok(&self.cut_sets);
        };
        seen_work_sets.insert(initial_set.clone());
        work_queue.push_back(initial_set);

        while let Some(current_set) = work_queue.pop_front() {
            let Some(current_set) = self.canonicalize_set(&current_set) else {
                continue;
            };

            self.validate_set_references(&current_set)?;

            if self.should_prune_set(&current_set) {
                continue;
            }

            if self.all_basic_events(&current_set) {
                let cut_set_bits = self.basic_event_bits_from_ids(&current_set);
                let cut_set = CutSet::new(current_set.clone());

                if let Some(max) = self.max_order {
                    if cut_set.order() > max {
                        continue;
                    }
                }

                self.try_add_minimal_cut_set(cut_set, cut_set_bits);
                continue;
            }

            if let Some(expanded) = self.expand_set(&current_set)? {
                for next_set in expanded {
                    let Some(next_set) = self.canonicalize_set(&next_set) else {
                        continue;
                    };
                    if seen_work_sets.insert(next_set.clone()) {
                        work_queue.push_back(next_set);
                    }
                }
            }
        }

        Ok(&self.cut_sets)
    }

    pub fn cut_sets(&self) -> &[CutSet] {
        &self.cut_sets
    }

    fn all_basic_events(&self, set: &[String]) -> bool {
        set.iter()
            .all(|id| self.fault_tree.basic_events().contains_key(id))
    }

    fn simplify_set_constants(&self, set: &[String]) -> Option<Vec<String>> {
        let mut out = Vec::with_capacity(set.len());
        for id in set {
            if let Some(house) = self.fault_tree.get_house_event(id) {
                if house.state() {
                    continue;
                }
                return None;
            }
            out.push(id.clone());
        }
        Some(out)
    }

    fn canonicalize_set(&self, set: &[String]) -> Option<Vec<String>> {
        let mut out = self.simplify_set_constants(set)?;
        out.sort();
        out.dedup();
        Some(out)
    }

    fn should_prune_set(&self, set: &[String]) -> bool {
        let basic_bits = self.basic_event_bits_from_set(set);
        if let Some(max) = self.max_order {
            if Self::bitset_popcount(&basic_bits) > max {
                return true;
            }
        }

        self.cut_sets_bits
            .iter()
            .any(|known| Self::bitset_is_subset(known, &basic_bits))
    }

    fn try_add_minimal_cut_set(&mut self, candidate: CutSet, candidate_bits: Vec<u64>) {
        if self
            .cut_sets_bits
            .iter()
            .any(|known| Self::bitset_is_subset(known, &candidate_bits))
        {
            return;
        }

        let old_cut_sets = std::mem::take(&mut self.cut_sets);
        let old_bits = std::mem::take(&mut self.cut_sets_bits);

        for (known_set, known_bits) in old_cut_sets.into_iter().zip(old_bits) {
            if !Self::bitset_is_subset(&candidate_bits, &known_bits) {
                self.cut_sets.push(known_set);
                self.cut_sets_bits.push(known_bits);
            }
        }

        self.cut_sets.push(candidate);
        self.cut_sets_bits.push(candidate_bits);
    }

    fn rebuild_basic_event_index(&mut self) {
        let mut ids: Vec<String> = self.fault_tree.basic_events().keys().cloned().collect();
        ids.sort();

        self.basic_event_index.clear();
        for (idx, id) in ids.into_iter().enumerate() {
            self.basic_event_index.insert(id, idx);
        }

        let n = self.basic_event_index.len();
        self.basic_event_bit_words = n.div_ceil(64);
    }

    fn basic_event_bits_from_set(&self, set: &[String]) -> Vec<u64> {
        let mut bits = vec![0u64; self.basic_event_bit_words];
        for id in set {
            let Some(&idx) = self.basic_event_index.get(id) else {
                continue;
            };
            let word = idx / 64;
            let bit = idx % 64;
            bits[word] |= 1u64 << bit;
        }
        bits
    }

    fn basic_event_bits_from_ids(&self, ids: &[String]) -> Vec<u64> {
        let mut bits = vec![0u64; self.basic_event_bit_words];
        for id in ids {
            if let Some(&idx) = self.basic_event_index.get(id) {
                let word = idx / 64;
                let bit = idx % 64;
                bits[word] |= 1u64 << bit;
            }
        }
        bits
    }

    fn bitset_is_subset(sub: &[u64], sup: &[u64]) -> bool {
        sub.iter().zip(sup.iter()).all(|(&a, &b)| (a & !b) == 0)
    }

    fn bitset_popcount(bits: &[u64]) -> usize {
        bits.iter().map(|w| w.count_ones() as usize).sum()
    }

    fn validate_set_references(&self, set: &[String]) -> Result<(), PraxisError> {
        for id in set {
            self.validate_element_exists(id, "fault tree element".to_string())?;
        }
        Ok(())
    }

    fn validate_element_exists(&self, id: &str, element_type: String) -> Result<(), PraxisError> {
        if self.fault_tree.gates().contains_key(id)
            || self.fault_tree.basic_events().contains_key(id)
            || self.fault_tree.house_events().contains_key(id)
        {
            Ok(())
        } else {
            Err(PraxisError::Mef(MefError::UndefinedElement {
                reference: id.to_string(),
                element_type,
            }))
        }
    }

    fn validate_no_cycles(&self) -> Result<(), PraxisError> {
        let top = self.fault_tree.top_event();
        if !self.fault_tree.gates().contains_key(top) {
            return Ok(());
        }

        let mut visited: HashSet<String> = HashSet::new();
        let mut stack: Vec<String> = Vec::new();
        let mut stack_pos: HashMap<String, usize> = HashMap::new();

        self.dfs_gate_cycle_check(top, &mut visited, &mut stack, &mut stack_pos)
    }

    fn dfs_gate_cycle_check(
        &self,
        gate_id: &str,
        visited: &mut HashSet<String>,
        stack: &mut Vec<String>,
        stack_pos: &mut HashMap<String, usize>,
    ) -> Result<(), PraxisError> {
        if visited.contains(gate_id) {
            return Ok(());
        }

        stack_pos.insert(gate_id.to_string(), stack.len());
        stack.push(gate_id.to_string());

        let gate = &self.fault_tree.gates()[gate_id];
        for operand in gate.operands() {
            if !self.fault_tree.gates().contains_key(operand) {
                continue;
            }

            if let Some(&pos) = stack_pos.get(operand) {
                let mut cycle = stack[pos..].to_vec();
                cycle.push(operand.clone());
                return Err(PraxisError::Mef(MefError::Cycle {
                    cycle_path: cycle.join(" -> "),
                }));
            }

            self.dfs_gate_cycle_check(operand, visited, stack, stack_pos)?;
        }

        stack.pop();
        stack_pos.remove(gate_id);
        visited.insert(gate_id.to_string());
        Ok(())
    }

    fn expand_set(&self, set: &[String]) -> Result<Option<Vec<Vec<String>>>, PraxisError> {
        let gate_pos = set
            .iter()
            .position(|id| self.fault_tree.gates().contains_key(id));

        let gate_pos = match gate_pos {
            Some(pos) => pos,
            None => return Ok(None),
        };

        let gate_id = &set[gate_pos];
        let gate = &self.fault_tree.gates()[gate_id];

        for operand in gate.operands() {
            self.validate_element_exists(operand, format!("operand of gate '{gate_id}'"))?;
        }

        let new_sets = match gate.formula() {
            Formula::And => Self::expand_as_and(set, gate_pos, gate.operands()),
            Formula::Or => Self::expand_as_or(set, gate_pos, gate.operands()),
            Formula::Xor | Formula::Nand | Formula::Nor | Formula::Not | Formula::Iff => {
                return Err(Self::non_coherent_gate_error(gate.formula()));
            }
            Formula::AtLeast { min } => {
                let k = *min;
                let operands = gate.operands();
                let n = operands.len();

                if k == 0 {
                    let mut new_set = Vec::new();
                    new_set.extend_from_slice(&set[..gate_pos]);
                    new_set.extend_from_slice(&set[gate_pos + 1..]);
                    vec![new_set]
                } else if k > n {
                    Vec::new()
                } else if k == 1 {
                    Self::expand_as_or(set, gate_pos, operands)
                } else if k == n {
                    Self::expand_as_and(set, gate_pos, operands)
                } else {
                    let combos = Self::generate_combinations(operands, k);
                    combos
                        .into_iter()
                        .map(|combo| Self::replace_gate_with(set, gate_pos, combo))
                        .collect()
                }
            }
        };

        Ok(Some(new_sets))
    }

    fn non_coherent_gate_error(formula: &Formula) -> PraxisError {
        let gate_name = match formula {
            Formula::Xor => "XOR",
            Formula::Nand => "NAND",
            Formula::Nor => "NOR",
            Formula::Not => "NOT",
            Formula::Iff => "IFF",
            _ => "<unknown>",
        };

        PraxisError::IllegalOperation(format!(
            "MOCUS supports only coherent fault trees; {gate_name} is non-coherent and is not supported. Use BDD/ZBDD (or a preprocessor that expands complex gates, which may introduce complements)."
        ))
    }

    fn replace_gate_with(set: &[String], gate_pos: usize, replacement: Vec<String>) -> Vec<String> {
        let mut new_set = Vec::new();
        new_set.extend_from_slice(&set[..gate_pos]);
        new_set.extend(replacement);
        new_set.extend_from_slice(&set[gate_pos + 1..]);
        new_set
    }

    fn expand_as_and(set: &[String], gate_pos: usize, operands: &[String]) -> Vec<Vec<String>> {
        vec![Self::replace_gate_with(set, gate_pos, operands.to_vec())]
    }

    fn expand_as_or(set: &[String], gate_pos: usize, operands: &[String]) -> Vec<Vec<String>> {
        operands
            .iter()
            .map(|arg| Self::replace_gate_with(set, gate_pos, vec![arg.clone()]))
            .collect()
    }

    fn generate_combinations(items: &[String], k: usize) -> Vec<Vec<String>> {
        fn rec(
            items: &[String],
            k: usize,
            start: usize,
            current: &mut Vec<String>,
            out: &mut Vec<Vec<String>>,
        ) {
            if k == 0 {
                out.push(current.clone());
                return;
            }
            if start + k > items.len() {
                return;
            }
            for i in start..=items.len() - k {
                current.push(items[i].clone());
                rec(items, k - 1, i + 1, current, out);
                current.pop();
            }
        }

        let mut out = Vec::new();
        let mut current = Vec::with_capacity(k);
        rec(items, k, 0, &mut current, &mut out);
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::event::BasicEvent;
    use crate::core::event::HouseEvent;
    use crate::core::gate::Gate;
    use crate::error::MefError;

    #[test]
    fn test_cut_set_order() {
        let cs = CutSet::new(vec!["E1".to_string(), "E2".to_string(), "E3".to_string()]);
        assert_eq!(cs.order(), 3);
    }

    #[test]
    fn test_cut_set_is_minimal() {
        let cs1 = CutSet::new(vec!["E1".to_string(), "E2".to_string()]);
        let cs2 = CutSet::new(vec!["E1".to_string()]);
        let cs3 = CutSet::new(vec!["E3".to_string()]);

        assert!(!cs1.is_minimal(&[cs2.clone(), cs3.clone()]));
        assert!(cs2.is_minimal(&[cs1.clone(), cs3.clone()]));
    }

    #[test]
    fn test_mocus_and_gate() {
        let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();

        let mut mocus = Mocus::new(&ft);
        let cut_sets = mocus.analyze().unwrap();

        assert_eq!(cut_sets.len(), 1);
        assert_eq!(cut_sets[0].order(), 2);
        assert!(cut_sets[0].events.contains("E1"));
        assert!(cut_sets[0].events.contains("E2"));
    }

    #[test]
    fn test_mocus_or_gate() {
        let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::Or).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();

        let mut mocus = Mocus::new(&ft);
        let cut_sets = mocus.analyze().unwrap();

        assert_eq!(cut_sets.len(), 2);
        assert!(cut_sets
            .iter()
            .any(|cs| cs.order() == 1 && cs.events.contains("E1")));
        assert!(cut_sets
            .iter()
            .any(|cs| cs.order() == 1 && cs.events.contains("E2")));
    }

    #[test]
    fn test_mocus_house_event_true_is_removed() {
        let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("H1".to_string());
        ft.add_gate(gate).unwrap();

        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_house_event(HouseEvent::new("H1".to_string(), true).unwrap())
            .unwrap();

        let mut mocus = Mocus::new(&ft);
        let cut_sets = mocus.analyze().unwrap();

        assert_eq!(cut_sets.len(), 1);
        assert_eq!(cut_sets[0].order(), 1);
        assert!(cut_sets[0].events.contains("E1"));
        assert!(!cut_sets[0].events.contains("H1"));
    }

    #[test]
    fn test_mocus_house_event_false_makes_set_unsatisfiable() {
        let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("H0".to_string());
        ft.add_gate(gate).unwrap();

        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_house_event(HouseEvent::new("H0".to_string(), false).unwrap())
            .unwrap();

        let mut mocus = Mocus::new(&ft);
        let cut_sets = mocus.analyze().unwrap();
        assert_eq!(cut_sets.len(), 0);
    }

    #[test]
    fn test_mocus_house_event_true_or_short_circuits_to_empty_cut_set() {
        let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::Or).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("H1".to_string());
        ft.add_gate(gate).unwrap();

        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_house_event(HouseEvent::new("H1".to_string(), true).unwrap())
            .unwrap();

        let mut mocus = Mocus::new(&ft);
        let cut_sets = mocus.analyze().unwrap();

        assert_eq!(cut_sets.len(), 1);
        assert_eq!(cut_sets[0].order(), 0);
    }

    #[test]
    fn test_mocus_atleast_with_house_event_true_reduces_k() {
        let mut ft = FaultTree::new("FT-1".to_string(), "TOP".to_string()).unwrap();

        let mut top = Gate::new("TOP".to_string(), Formula::AtLeast { min: 2 }).unwrap();
        top.add_operand("H1".to_string());
        top.add_operand("E1".to_string());
        top.add_operand("E2".to_string());
        ft.add_gate(top).unwrap();

        ft.add_house_event(HouseEvent::new("H1".to_string(), true).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();

        let mut mocus = Mocus::new(&ft);
        let cut_sets = mocus.analyze().unwrap();

        assert_eq!(cut_sets.len(), 2);
        assert!(cut_sets
            .iter()
            .any(|cs| cs.order() == 1 && cs.events.contains("E1")));
        assert!(cut_sets
            .iter()
            .any(|cs| cs.order() == 1 && cs.events.contains("E2")));
    }

    #[test]
    fn test_mocus_rejects_xor_gate() {
        let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::Xor).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();

        let mut mocus = Mocus::new(&ft);
        match mocus.analyze() {
            Err(PraxisError::IllegalOperation(msg)) => {
                assert!(msg.to_lowercase().contains("xor"));
            }
            other => panic!("Expected IllegalOperation for XOR, got: {:?}", other),
        }
    }

    #[test]
    fn test_mocus_rejects_nand_gate() {
        let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::Nand).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();

        let mut mocus = Mocus::new(&ft);
        match mocus.analyze() {
            Err(PraxisError::IllegalOperation(msg)) => {
                assert!(msg.to_lowercase().contains("nand"));
            }
            other => panic!("Expected IllegalOperation for NAND, got: {:?}", other),
        }
    }

    #[test]
    fn test_mocus_rejects_nor_gate() {
        let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::Nor).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();

        let mut mocus = Mocus::new(&ft);
        match mocus.analyze() {
            Err(PraxisError::IllegalOperation(msg)) => {
                assert!(msg.to_lowercase().contains("nor"));
            }
            other => panic!("Expected IllegalOperation for NOR, got: {:?}", other),
        }
    }

    #[test]
    fn test_mocus_rejects_iff_gate() {
        let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::Iff).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();

        let mut mocus = Mocus::new(&ft);
        match mocus.analyze() {
            Err(PraxisError::IllegalOperation(msg)) => {
                assert!(msg.to_lowercase().contains("iff"));
            }
            other => panic!("Expected IllegalOperation for IFF, got: {:?}", other),
        }
    }

    #[test]
    fn test_mocus_rejects_not_gate() {
        let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::Not).unwrap();
        gate.add_operand("E1".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();

        let mut mocus = Mocus::new(&ft);
        match mocus.analyze() {
            Err(PraxisError::IllegalOperation(msg)) => {
                assert!(msg.to_lowercase().contains("not"));
            }
            other => panic!("Expected IllegalOperation for NOT, got: {:?}", other),
        }
    }

    #[test]
    fn test_mocus_mixed_gates() {
        let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();

        let mut g1 = Gate::new("G1".to_string(), Formula::Or).unwrap();
        g1.add_operand("G2".to_string());
        g1.add_operand("E3".to_string());
        ft.add_gate(g1).unwrap();

        let mut g2 = Gate::new("G2".to_string(), Formula::And).unwrap();
        g2.add_operand("E1".to_string());
        g2.add_operand("E2".to_string());
        ft.add_gate(g2).unwrap();

        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E3".to_string(), 0.03).unwrap())
            .unwrap();

        let mut mocus = Mocus::new(&ft);
        let cut_sets = mocus.analyze().unwrap();

        assert_eq!(cut_sets.len(), 2);

        assert!(cut_sets
            .iter()
            .any(|cs| cs.order() == 1 && cs.events.contains("E3")));

        assert!(cut_sets
            .iter()
            .any(|cs| { cs.order() == 2 && cs.events.contains("E1") && cs.events.contains("E2") }));
    }

    #[test]
    fn test_mocus_with_max_order() {
        let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        gate.add_operand("E3".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E3".to_string(), 0.03).unwrap())
            .unwrap();

        let mut mocus = Mocus::new(&ft).with_max_order(2);
        let cut_sets = mocus.analyze().unwrap();

        assert_eq!(cut_sets.len(), 0);
    }

    #[test]
    fn test_mocus_atleast_gate() {
        let mut ft = FaultTree::new("FT-1".to_string(), "TOP".to_string()).unwrap();

        let mut top = Gate::new("TOP".to_string(), Formula::AtLeast { min: 2 }).unwrap();
        top.add_operand("E1".to_string());
        top.add_operand("E2".to_string());
        top.add_operand("E3".to_string());
        ft.add_gate(top).unwrap();

        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E3".to_string(), 0.03).unwrap())
            .unwrap();

        let mut mocus = Mocus::new(&ft);
        let cut_sets = mocus.analyze().unwrap();

        assert_eq!(cut_sets.len(), 3);
        for cs in cut_sets {
            assert_eq!(cs.order(), 2);
        }

        assert!(cut_sets
            .iter()
            .any(|cs| cs.events.contains("E1") && cs.events.contains("E2")));
        assert!(cut_sets
            .iter()
            .any(|cs| cs.events.contains("E1") && cs.events.contains("E3")));
        assert!(cut_sets
            .iter()
            .any(|cs| cs.events.contains("E2") && cs.events.contains("E3")));
    }

    #[test]
    fn test_non_minimal_removal() {
        let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();

        let mut g1 = Gate::new("G1".to_string(), Formula::Or).unwrap();
        g1.add_operand("G2".to_string());
        g1.add_operand("E1".to_string());
        ft.add_gate(g1).unwrap();

        let mut g2 = Gate::new("G2".to_string(), Formula::And).unwrap();
        g2.add_operand("E1".to_string());
        g2.add_operand("E2".to_string());
        ft.add_gate(g2).unwrap();

        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();

        let mut mocus = Mocus::new(&ft);
        let cut_sets = mocus.analyze().unwrap();

        assert_eq!(cut_sets.len(), 1);
        assert_eq!(cut_sets[0].order(), 1);
        assert!(cut_sets[0].events.contains("E1"));
    }

    #[test]
    fn test_mocus_errors_on_unknown_top_event() {
        let ft = FaultTree::new("FT-1".to_string(), "MISSING".to_string()).unwrap();
        let mut mocus = Mocus::new(&ft);
        match mocus.analyze() {
            Err(PraxisError::Mef(MefError::UndefinedElement {
                reference,
                element_type,
            })) => {
                assert_eq!(reference, "MISSING");
                assert!(element_type.to_lowercase().contains("top"));
            }
            other => panic!("Expected UndefinedElement for top event, got: {:?}", other),
        }
    }

    #[test]
    fn test_mocus_errors_on_unknown_gate_operand() {
        let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();

        let mut mocus = Mocus::new(&ft);
        match mocus.analyze() {
            Err(PraxisError::Mef(MefError::UndefinedElement {
                reference,
                element_type,
            })) => {
                assert_eq!(reference, "E2");
                assert!(element_type.contains("G1"));
            }
            other => panic!(
                "Expected UndefinedElement for missing gate operand, got: {:?}",
                other
            ),
        }
    }

    #[test]
    fn test_mocus_errors_on_direct_gate_cycle() {
        let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        gate.add_operand("G1".to_string());
        gate.add_operand("E1".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();

        let mut mocus = Mocus::new(&ft);
        match mocus.analyze() {
            Err(PraxisError::Mef(MefError::Cycle { cycle_path })) => {
                assert!(cycle_path.contains("G1"));
            }
            other => panic!("Expected Cycle error, got: {:?}", other),
        }
    }

    #[test]
    fn test_mocus_errors_on_indirect_gate_cycle() {
        let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();

        let mut g1 = Gate::new("G1".to_string(), Formula::Or).unwrap();
        g1.add_operand("G2".to_string());
        g1.add_operand("E1".to_string());
        ft.add_gate(g1).unwrap();

        let mut g2 = Gate::new("G2".to_string(), Formula::And).unwrap();
        g2.add_operand("G1".to_string());
        g2.add_operand("E2".to_string());
        ft.add_gate(g2).unwrap();

        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();

        let mut mocus = Mocus::new(&ft);
        match mocus.analyze() {
            Err(PraxisError::Mef(MefError::Cycle { cycle_path })) => {
                assert!(cycle_path.contains("G1"));
                assert!(cycle_path.contains("G2"));
            }
            other => panic!("Expected Cycle error, got: {:?}", other),
        }
    }

    #[test]
    fn test_mocus_dedups_duplicate_gate_operands() {
        let mut ft = FaultTree::new("FT-1".to_string(), "G1".to_string()).unwrap();

        let mut g1 = Gate::new("G1".to_string(), Formula::And).unwrap();
        g1.add_operand("G2".to_string());
        g1.add_operand("G2".to_string());
        ft.add_gate(g1).unwrap();

        let mut g2 = Gate::new("G2".to_string(), Formula::Or).unwrap();
        g2.add_operand("E1".to_string());
        g2.add_operand("E2".to_string());
        ft.add_gate(g2).unwrap();

        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();

        let mut mocus = Mocus::new(&ft);
        let cut_sets = mocus.analyze().unwrap();

        assert_eq!(cut_sets.len(), 2);
        assert!(cut_sets
            .iter()
            .any(|cs| cs.order() == 1 && cs.events.contains("E1")));
        assert!(cut_sets
            .iter()
            .any(|cs| cs.order() == 1 && cs.events.contains("E2")));
    }
}
