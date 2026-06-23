use std::collections::{HashMap, HashSet};

use crate::algorithms::pdag::{Connective, NodeIndex, Pdag};
use crate::core::event_tree::{Branch, BranchTarget, EventTree};
use crate::core::fault_tree::FaultTree;
use crate::core::gate::Formula;
use crate::core::model::Model;
use crate::error::{PraxisError, Result};

pub struct SequenceFormulas {

    pub pdag: Pdag,

    pub sequence_roots: HashMap<String, NodeIndex>,

    pub unconditional: HashSet<String>,

    pub event_probs: HashMap<String, f64>,

    pub ie_frequency: f64,
}

pub struct SequenceFormulaBuilder<'a> {
    model: &'a Model,
    et_library: Option<&'a HashMap<String, EventTree>>,
    pdag: Pdag,

    event_probs: HashMap<String, f64>,

    sequence_paths: HashMap<String, Vec<NodeIndex>>,

    unconditional: HashSet<String>,

    next_synthetic: usize,

    true_const: Option<NodeIndex>,

    false_const: Option<NodeIndex>,
}

impl<'a> SequenceFormulaBuilder<'a> {
    pub fn new(model: &'a Model) -> Self {
        Self {
            model,
            et_library: None,
            pdag: Pdag::new(),
            event_probs: HashMap::new(),
            sequence_paths: HashMap::new(),
            unconditional: HashSet::new(),
            next_synthetic: 0,
            true_const: None,
            false_const: None,
        }
    }

    fn const_true(&mut self) -> NodeIndex {
        if let Some(idx) = self.true_const {
            return idx;
        }
        let idx = self.pdag.add_constant(true);
        self.true_const = Some(idx);
        idx
    }

    fn const_false(&mut self) -> NodeIndex {
        if let Some(idx) = self.false_const {
            return idx;
        }
        let idx = self.pdag.add_constant(false);
        self.false_const = Some(idx);
        idx
    }

    pub fn with_event_tree_library(mut self, lib: &'a HashMap<String, EventTree>) -> Self {
        self.et_library = Some(lib);
        self
    }

    pub fn build(mut self, et: &EventTree, ie_frequency: f64) -> Result<SequenceFormulas> {
        et.validate()?;

        let initial = et.initial_state.clone();
        self.collect_sequences(et, &initial, Vec::new(), HashMap::new())?;

        let mut sequence_roots = HashMap::new();
        let all_paths = std::mem::take(&mut self.sequence_paths);
        for (seq_id, paths) in all_paths {
            if paths.is_empty() {
                continue;
            }

            if self.unconditional.contains(&seq_id) {
                continue;
            }
            let root = if paths.len() == 1 {
                paths[0]
            } else {
                let id = format!("__OR__{}", self.next_synthetic);
                self.next_synthetic += 1;
                self.pdag.add_gate(id, Connective::Or, paths, None)?
            };
            sequence_roots.insert(seq_id, root);
        }

        Ok(SequenceFormulas {
            pdag: self.pdag,
            sequence_roots,
            unconditional: self.unconditional,
            event_probs: self.event_probs,
            ie_frequency,
        })
    }

    fn collect_sequences(
        &mut self,
        et: &EventTree,
        branch: &Branch,
        path_collector: Vec<NodeIndex>,
        house_overrides: HashMap<String, bool>,
    ) -> Result<()> {

        let mut overrides = house_overrides;
        for (id, val) in &branch.house_event_assignments {
            overrides.insert(id.clone(), *val);
        }

        match branch.target.clone() {
            BranchTarget::Sequence(seq_id) => {
                self.handle_sequence(et, &seq_id, path_collector, overrides)
            }

            BranchTarget::Fork(fork) => {
                let fe_id = fork.functional_event_id.clone();
                let fe = et.functional_events.get(&fe_id).ok_or_else(|| {
                    PraxisError::Logic(format!(
                        "Functional event '{}' not found in event tree '{}'",
                        fe_id, et.id
                    ))
                })?;
                let fe_ft_id = fe.fault_tree_id.clone();

                for path in &fork.paths {
                    let mut new_collector = path_collector.clone();

                    if let Some(negated) = path.collect_formula_negated {
                        if let Some(ref ft_id) = fe_ft_id {

                            let ft: FaultTree =
                                self.model.get_fault_tree(ft_id).ok_or_else(|| {
                                    PraxisError::Logic(format!(
                                        "Fault tree '{}' not found for functional event '{}'",
                                        ft_id, fe_id
                                    ))
                                })?.clone();

                            let scope = make_scope_key(&overrides);
                            let root_idx = self.add_ft_scoped(&ft, &overrides, &scope)?;
                            let formula_idx = if negated { -root_idx } else { root_idx };
                            new_collector.push(formula_idx);
                        }

                    }

                    self.collect_sequences(
                        et,
                        &path.branch,
                        new_collector,
                        overrides.clone(),
                    )?;
                }
                Ok(())
            }

            BranchTarget::NamedBranch(branch_id) => {
                let branch = et
                    .named_branches
                    .get(&branch_id)
                    .ok_or_else(|| {
                        PraxisError::Logic(format!(
                            "Named branch '{}' not found in event tree '{}'",
                            branch_id, et.id
                        ))
                    })?
                    .branch
                    .clone();
                self.collect_sequences(et, &branch, path_collector, overrides)
            }
        }
    }

    fn handle_sequence(
        &mut self,
        et: &EventTree,
        seq_id: &str,
        path_collector: Vec<NodeIndex>,
        overrides: HashMap<String, bool>,
    ) -> Result<()> {
        let sequence = et.sequences.get(seq_id).ok_or_else(|| {
            PraxisError::Logic(format!(
                "Sequence '{}' not found in event tree '{}'",
                seq_id, et.id
            ))
        })?;

        if let Some(linked_et_id) = sequence.linked_event_tree_id.clone() {
            if linked_et_id == et.id {

                let initial = et.initial_state.clone();
                return self.collect_sequences(et, &initial, path_collector, overrides);
            }
            if let Some(lib) = self.et_library {

                let linked_et: EventTree = lib.get(&linked_et_id).ok_or_else(|| {
                    PraxisError::Logic(format!(
                        "Linked event tree '{}' not found",
                        linked_et_id
                    ))
                })?.clone();
                linked_et.validate()?;
                let initial = linked_et.initial_state.clone();
                return self.collect_sequences(&linked_et, &initial, path_collector, overrides);
            }

        }

        match self.build_path_gate(path_collector)? {
            Some(idx) => {
                self.sequence_paths
                    .entry(seq_id.to_string())
                    .or_default()
                    .push(idx);
            }
            None => {

                self.unconditional.insert(seq_id.to_string());
            }
        }
        Ok(())
    }

    fn build_path_gate(&mut self, path_collector: Vec<NodeIndex>) -> Result<Option<NodeIndex>> {
        Ok(match path_collector.len() {
            0 => None,
            1 => Some(path_collector[0]),
            _ => {
                let id = format!("__AND__{}", self.next_synthetic);
                self.next_synthetic += 1;
                let idx =
                    self.pdag
                        .add_gate(id, Connective::And, path_collector, None)?;
                Some(idx)
            }
        })
    }

    fn add_ft_scoped(
        &mut self,
        ft: &FaultTree,
        overrides: &HashMap<String, bool>,
        scope: &str,
    ) -> Result<NodeIndex> {
        let ft_name = ft.element().id();
        let ft_scope = if scope.is_empty() {
            ft_name.to_string()
        } else {
            format!("{}__{}", ft_name, scope)
        };

        let scoped_top = scoped_node_id(ft.top_event(), &ft_scope);
        if let Some(idx) = self.pdag.get_index(&scoped_top) {
            return Ok(idx);
        }

        for be in ft.basic_events().values() {
            let id = be.element().id().to_string();
            self.pdag.add_basic_event(id.clone());
            self.event_probs.insert(id, be.probability());
        }

        let mut gate_cache: HashMap<String, NodeIndex> = HashMap::new();
        self.add_element_scoped(ft, ft.top_event(), overrides, &ft_scope, &mut gate_cache)
    }

    fn add_element_scoped(
        &mut self,
        ft: &FaultTree,
        element_id: &str,
        overrides: &HashMap<String, bool>,
        scope: &str,
        cache: &mut HashMap<String, NodeIndex>,
    ) -> Result<NodeIndex> {
        let scoped_id = scoped_node_id(element_id, scope);

        if let Some(idx) = self.pdag.get_index(&scoped_id) {
            return Ok(idx);
        }

        if let Some(&idx) = cache.get(&scoped_id) {
            return Ok(idx);
        }

        if let Some(&val) = overrides.get(element_id) {
            let idx = if val {
                self.const_true()
            } else {
                self.const_false()
            };
            cache.insert(scoped_id, idx);
            return Ok(idx);
        }

        if let Some(he) = ft.get_house_event(element_id) {
            let idx = if he.state() {
                self.const_true()
            } else {
                self.const_false()
            };
            cache.insert(scoped_id, idx);
            return Ok(idx);
        }

        if let Some(idx) = self.pdag.get_index(element_id) {
            cache.insert(scoped_id, idx);
            return Ok(idx);
        }

        let gate = ft.get_gate(element_id).ok_or_else(|| {
            PraxisError::Logic(format!(
                "SequenceFormulaBuilder: element '{}' not found in fault tree '{}'",
                element_id,
                ft.element().id()
            ))
        })?;

        let connective = Connective::from_formula(gate.formula());
        let min_number = match gate.formula() {
            Formula::AtLeast { min } => Some(*min),
            _ => None,
        };

        let mut operand_indices = Vec::new();
        for op_id in gate.operands() {
            let op_idx = self.add_element_scoped(ft, op_id, overrides, scope, cache)?;
            operand_indices.push(op_idx);
        }

        let idx = self
            .pdag
            .add_gate(scoped_id.clone(), connective, operand_indices, min_number)?;
        cache.insert(scoped_id, idx);
        Ok(idx)
    }
}

fn make_scope_key(overrides: &HashMap<String, bool>) -> String {
    if overrides.is_empty() {
        return String::new();
    }
    let mut pairs: Vec<(&String, &bool)> = overrides.iter().collect();
    pairs.sort_by_key(|(k, _)| k.as_str());
    pairs
        .iter()
        .map(|(k, v)| format!("{}={}", k, if **v { 'T' } else { 'F' }))
        .collect::<Vec<_>>()
        .join(",")
}

fn scoped_node_id(id: &str, scope: &str) -> String {
    if scope.is_empty() {
        id.to_string()
    } else {
        format!("{}__{}", id, scope)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::algorithms::pdag::PdagNode;
    use crate::core::event::BasicEvent;
    use crate::core::event::HouseEvent;
    use crate::core::event_tree::{Fork, FunctionalEvent, Path, Sequence};
    use crate::core::fault_tree::FaultTree;
    use crate::core::gate::{Formula, Gate};
    use crate::core::model::Model;

    fn simple_ft(ft_id: &str, top_id: &str, e1: &str, e2: &str) -> FaultTree {
        let mut ft = FaultTree::new(ft_id, top_id).unwrap();
        let mut top = Gate::new(top_id.to_string(), Formula::Or).unwrap();
        top.add_operand(e1.to_string());
        top.add_operand(e2.to_string());
        ft.add_gate(top).unwrap();
        ft.add_basic_event(BasicEvent::new(e1.to_string(), 0.1).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new(e2.to_string(), 0.2).unwrap())
            .unwrap();
        ft
    }

    #[test]
    fn test_no_collect_formula_is_unconditional() {
        let model = Model::new("M").unwrap();
        let fe = FunctionalEvent::new("FE".to_string());

        let success_path = Path::new(
            "success".to_string(),
            Branch::new(BranchTarget::Sequence("SEQ-OK".to_string())),
        )
        .unwrap();
        let failure_path = Path::new(
            "failure".to_string(),
            Branch::new(BranchTarget::Sequence("SEQ-FAIL".to_string())),
        )
        .unwrap();

        let fork = Fork::new("FE".to_string(), vec![success_path, failure_path]).unwrap();
        let initial = Branch::new(BranchTarget::Fork(fork));
        let mut et = EventTree::new("ET".to_string(), initial);
        et.add_sequence(Sequence::new("SEQ-OK".to_string())).unwrap();
        et.add_sequence(Sequence::new("SEQ-FAIL".to_string()))
            .unwrap();
        et.add_functional_event(fe).unwrap();

        let formulas = SequenceFormulaBuilder::new(&model)
            .build(&et, 1.0)
            .unwrap();

        assert!(formulas.sequence_roots.is_empty());
        assert!(formulas.unconditional.contains("SEQ-OK"));
        assert!(formulas.unconditional.contains("SEQ-FAIL"));
    }

    #[test]
    fn test_collect_formula_failure_path() {
        let mut model = Model::new("M").unwrap();
        model
            .add_fault_tree(simple_ft("FT-COOL", "G-COOL", "E1", "E2"))
            .unwrap();

        let mut fe = FunctionalEvent::new("FE-COOL".to_string());
        fe.fault_tree_id = Some("FT-COOL".to_string());

        let success_path = Path::new(
            "success".to_string(),
            Branch::new(BranchTarget::Sequence("SEQ-OK".to_string())),
        )
        .unwrap()
        .with_collect_formula_negated(false);

        let failure_path = Path::new(
            "failure".to_string(),
            Branch::new(BranchTarget::Sequence("SEQ-FAIL".to_string())),
        )
        .unwrap()
        .with_collect_formula_negated(true);

        let fork = Fork::new("FE-COOL".to_string(), vec![success_path, failure_path]).unwrap();
        let initial = Branch::new(BranchTarget::Fork(fork));
        let mut et = EventTree::new("ET".to_string(), initial);
        et.add_sequence(Sequence::new("SEQ-OK".to_string())).unwrap();
        et.add_sequence(Sequence::new("SEQ-FAIL".to_string()))
            .unwrap();
        et.add_functional_event(fe).unwrap();

        let formulas = SequenceFormulaBuilder::new(&model)
            .build(&et, 1.0)
            .unwrap();

        assert!(formulas.unconditional.is_empty());
        assert!(formulas.sequence_roots.contains_key("SEQ-OK"));
        assert!(formulas.sequence_roots.contains_key("SEQ-FAIL"));

        let ok_root = formulas.sequence_roots["SEQ-OK"];
        let fail_root = formulas.sequence_roots["SEQ-FAIL"];
        assert!(ok_root > 0, "success root should be positive");
        assert_eq!(fail_root, -ok_root, "failure root should be complement");

        assert!(formulas.pdag.get_index("E1").is_some());
        assert!(formulas.pdag.get_index("E2").is_some());
    }

    #[test]
    fn test_two_forks_and_chain() {
        let mut model = Model::new("M").unwrap();
        model
            .add_fault_tree(simple_ft("FT-1", "G1", "E1", "E2"))
            .unwrap();
        model
            .add_fault_tree(simple_ft("FT-2", "G2", "E3", "E4"))
            .unwrap();

        let mut fe1 = FunctionalEvent::new("FE-1".to_string());
        fe1.fault_tree_id = Some("FT-1".to_string());
        let mut fe2 = FunctionalEvent::new("FE-2".to_string());
        fe2.fault_tree_id = Some("FT-2".to_string());

        let seq_ff = Sequence::new("SEQ-FF".to_string());
        let seq_fs = Sequence::new("SEQ-FS".to_string());
        let seq_s  = Sequence::new("SEQ-S".to_string());

        let fork2 = Fork::new(
            "FE-2".to_string(),
            vec![
                Path::new(
                    "success".to_string(),
                    Branch::new(BranchTarget::Sequence("SEQ-FS".to_string())),
                )
                .unwrap()
                .with_collect_formula_negated(false),
                Path::new(
                    "failure".to_string(),
                    Branch::new(BranchTarget::Sequence("SEQ-FF".to_string())),
                )
                .unwrap()
                .with_collect_formula_negated(true),
            ],
        )
        .unwrap();

        let fork1 = Fork::new(
            "FE-1".to_string(),
            vec![
                Path::new(
                    "success".to_string(),
                    Branch::new(BranchTarget::Sequence("SEQ-S".to_string())),
                )
                .unwrap()
                .with_collect_formula_negated(false),
                Path::new(
                    "failure".to_string(),
                    Branch::new(BranchTarget::Fork(fork2)),
                )
                .unwrap()
                .with_collect_formula_negated(true),
            ],
        )
        .unwrap();

        let mut et = EventTree::new("ET".to_string(), Branch::new(BranchTarget::Fork(fork1)));
        et.add_sequence(seq_ff).unwrap();
        et.add_sequence(seq_fs).unwrap();
        et.add_sequence(seq_s).unwrap();
        et.add_functional_event(fe1).unwrap();
        et.add_functional_event(fe2).unwrap();

        let formulas = SequenceFormulaBuilder::new(&model)
            .build(&et, 1.0)
            .unwrap();

        assert!(formulas.unconditional.is_empty());

        let ff_root = formulas.sequence_roots["SEQ-FF"];
        let ff_node = formulas.pdag.get_node(ff_root).expect("SEQ-FF root must exist");
        assert!(ff_node.is_gate());

        let s_root = formulas.sequence_roots["SEQ-S"];
        assert!(s_root > 0);

        for be in ["E1", "E2", "E3", "E4"] {
            assert!(formulas.pdag.get_index(be).is_some(), "{be} missing from pdag");
        }
    }

    #[test]
    fn test_two_paths_to_same_sequence_or_gate() {
        let mut model = Model::new("M").unwrap();
        model
            .add_fault_tree(simple_ft("FT-A", "GA", "E1", "E2"))
            .unwrap();
        model
            .add_fault_tree(simple_ft("FT-B", "GB", "E3", "E4"))
            .unwrap();

        let mut fe_a = FunctionalEvent::new("FE-A".to_string());
        fe_a.fault_tree_id = Some("FT-A".to_string());
        let mut fe_b = FunctionalEvent::new("FE-B".to_string());
        fe_b.fault_tree_id = Some("FT-B".to_string());

        let fork_b_after_fail = Fork::new(
            "FE-B".to_string(),
            vec![
                Path::new(
                    "success".to_string(),
                    Branch::new(BranchTarget::Sequence("SEQ-TARGET".to_string())),
                )
                .unwrap()
                .with_collect_formula_negated(false),
            ],
        )
        .unwrap();

        let fork_a = Fork::new(
            "FE-A".to_string(),
            vec![
                Path::new(
                    "success".to_string(),
                    Branch::new(BranchTarget::Sequence("SEQ-TARGET".to_string())),
                )
                .unwrap()
                .with_collect_formula_negated(false),
                Path::new(
                    "failure".to_string(),
                    Branch::new(BranchTarget::Fork(fork_b_after_fail)),
                )
                .unwrap()
                .with_collect_formula_negated(true),
            ],
        )
        .unwrap();

        let mut et = EventTree::new("ET".to_string(), Branch::new(BranchTarget::Fork(fork_a)));
        et.add_sequence(Sequence::new("SEQ-TARGET".to_string()))
            .unwrap();
        et.add_functional_event(fe_a).unwrap();
        et.add_functional_event(fe_b).unwrap();

        let formulas = SequenceFormulaBuilder::new(&model)
            .build(&et, 1.0)
            .unwrap();

        let root = formulas.sequence_roots["SEQ-TARGET"];
        let node = formulas.pdag.get_node(root).unwrap();
        assert!(node.is_gate());
        match node {
            PdagNode::Gate { connective, .. } => {
                assert_eq!(*connective, Connective::Or);
            }
            _ => panic!("expected a Gate node"),
        }
    }

    #[test]
    fn test_house_event_override_true() {
        let mut model = Model::new("M").unwrap();

        let mut ft = FaultTree::new("FT-HE", "G-HE").unwrap();
        let mut top = Gate::new("G-HE".to_string(), Formula::Or).unwrap();
        top.add_operand("E1".to_string());
        top.add_operand("H1".to_string());
        ft.add_gate(top).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.05).unwrap())
            .unwrap();
        ft.add_house_event(HouseEvent::new("H1".to_string(), false).unwrap())
            .unwrap();
        model.add_fault_tree(ft).unwrap();

        let mut fe = FunctionalEvent::new("FE".to_string());
        fe.fault_tree_id = Some("FT-HE".to_string());

        let path = Path::new(
            "failure".to_string(),
            Branch::new(BranchTarget::Sequence("SEQ-1".to_string())),
        )
        .unwrap()
        .with_collect_formula_negated(true);

        let fork = Fork::new("FE".to_string(), vec![path]).unwrap();
        let mut initial = Branch::new(BranchTarget::Fork(fork));
        initial
            .house_event_assignments
            .insert("H1".to_string(), true);
        let mut et = EventTree::new("ET".to_string(), initial);
        et.add_sequence(Sequence::new("SEQ-1".to_string())).unwrap();
        et.add_functional_event(fe).unwrap();

        let formulas = SequenceFormulaBuilder::new(&model)
            .build(&et, 1.0)
            .unwrap();

        assert!(formulas.sequence_roots.contains_key("SEQ-1"));

        let has_true = formulas
            .pdag
            .nodes()
            .values()
            .any(|n| matches!(n, PdagNode::Constant { value: true, .. }));
        assert!(has_true, "expected a TRUE constant node from the override");
    }

    #[test]
    fn test_house_event_default_value_false() {
        let mut model = Model::new("M").unwrap();

        let mut ft = FaultTree::new("FT-HE2", "G-HE2").unwrap();
        let mut top = Gate::new("G-HE2".to_string(), Formula::And).unwrap();
        top.add_operand("E1".to_string());
        top.add_operand("H2".to_string());
        ft.add_gate(top).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.1).unwrap())
            .unwrap();
        ft.add_house_event(HouseEvent::new("H2".to_string(), false).unwrap())
            .unwrap();
        model.add_fault_tree(ft).unwrap();

        let mut fe = FunctionalEvent::new("FE2".to_string());
        fe.fault_tree_id = Some("FT-HE2".to_string());

        let path = Path::new(
            "failure".to_string(),
            Branch::new(BranchTarget::Sequence("SEQ-1".to_string())),
        )
        .unwrap()
        .with_collect_formula_negated(false);

        let fork = Fork::new("FE2".to_string(), vec![path]).unwrap();
        let mut et = EventTree::new("ET".to_string(), Branch::new(BranchTarget::Fork(fork)));
        et.add_sequence(Sequence::new("SEQ-1".to_string())).unwrap();
        et.add_functional_event(fe).unwrap();

        let formulas = SequenceFormulaBuilder::new(&model)
            .build(&et, 1.0)
            .unwrap();

        assert!(formulas.sequence_roots.contains_key("SEQ-1"));
        let has_false = formulas
            .pdag
            .nodes()
            .values()
            .any(|n| matches!(n, PdagNode::Constant { value: false, .. }));
        assert!(has_false, "expected a FALSE constant node from the house event");
    }

    #[test]
    fn test_ie_frequency_forwarded() {
        let model = Model::new("M").unwrap();
        let initial = Branch::new(BranchTarget::Sequence("SEQ-1".to_string()));
        let mut et = EventTree::new("ET".to_string(), initial);
        et.add_sequence(Sequence::new("SEQ-1".to_string())).unwrap();

        let formulas = SequenceFormulaBuilder::new(&model)
            .build(&et, 1.23e-4)
            .unwrap();

        assert!((formulas.ie_frequency - 1.23e-4).abs() < 1e-15);
    }

    #[test]
    fn test_dedup_same_ft_same_scope() {
        let mut model = Model::new("M").unwrap();
        model
            .add_fault_tree(simple_ft("FT-X", "GX", "E1", "E2"))
            .unwrap();

        let mut fe1 = FunctionalEvent::new("FE-1".to_string());
        fe1.fault_tree_id = Some("FT-X".to_string());
        let mut fe2 = FunctionalEvent::new("FE-2".to_string());
        fe2.fault_tree_id = Some("FT-X".to_string());

        let fork2 = Fork::new(
            "FE-2".to_string(),
            vec![Path::new(
                "failure".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ-1".to_string())),
            )
            .unwrap()
            .with_collect_formula_negated(true)],
        )
        .unwrap();

        let fork1 = Fork::new(
            "FE-1".to_string(),
            vec![Path::new(
                "failure".to_string(),
                Branch::new(BranchTarget::Fork(fork2)),
            )
            .unwrap()
            .with_collect_formula_negated(true)],
        )
        .unwrap();

        let mut et = EventTree::new("ET".to_string(), Branch::new(BranchTarget::Fork(fork1)));
        et.add_sequence(Sequence::new("SEQ-1".to_string())).unwrap();
        et.add_functional_event(fe1).unwrap();
        et.add_functional_event(fe2).unwrap();

        let formulas = SequenceFormulaBuilder::new(&model)
            .build(&et, 1.0)
            .unwrap();

        let root = formulas.sequence_roots["SEQ-1"];
        let node = formulas.pdag.get_node(root).unwrap();
        assert!(node.is_gate());

        assert!(formulas.pdag.get_index("GX__FT-X").is_some(), "GX__FT-X must be in pdag");
        assert!(formulas.pdag.get_index("GX").is_none(), "plain GX must not exist after ft-scope fix");
    }

    #[test]
    fn test_named_branch_followed() {
        let model = Model::new("M").unwrap();

        let named_branch = crate::core::event_tree::NamedBranch::new(
            "NB-1".to_string(),
            Branch::new(BranchTarget::Sequence("SEQ-1".to_string())),
        );

        let initial = Branch::new(BranchTarget::NamedBranch("NB-1".to_string()));
        let mut et = EventTree::new("ET".to_string(), initial);
        et.add_sequence(Sequence::new("SEQ-1".to_string())).unwrap();
        et.add_named_branch(named_branch).unwrap();

        let formulas = SequenceFormulaBuilder::new(&model)
            .build(&et, 1.0)
            .unwrap();

        assert!(formulas.unconditional.contains("SEQ-1"));
        assert!(!formulas.sequence_roots.contains_key("SEQ-1"));
    }
}
