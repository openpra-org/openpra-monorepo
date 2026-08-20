use crate::analysis::fault_tree::FaultTreeAnalysis;
use crate::core::event_tree::{Branch, BranchTarget, EventTree, InitiatingEvent, Sequence};
use crate::core::model::Model;
use crate::error::PraxisError;
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq)]
pub struct SequenceResult {
    pub sequence: Sequence,
    pub path: Vec<(String, String)>,
    pub probability: f64,
    pub frequency: f64,
}

pub struct EventTreeAnalysis<'a> {
    pub initiating_event: InitiatingEvent,
    pub event_tree: EventTree,
    pub model: &'a Model,
    event_tree_library: Option<&'a HashMap<String, EventTree>>,
    sequences: Vec<SequenceResult>,
}

impl<'a> EventTreeAnalysis<'a> {
    pub fn new(initiating_event: InitiatingEvent, event_tree: EventTree, model: &'a Model) -> Self {
        Self {
            initiating_event,
            event_tree,
            model,
            event_tree_library: None,
            sequences: Vec::new(),
        }
    }

    pub fn with_event_tree_library(mut self, library: &'a HashMap<String, EventTree>) -> Self {
        self.event_tree_library = Some(library);
        self
    }

    pub fn analyze(&mut self) -> Result<(), PraxisError> {
        self.event_tree.validate()?;
        self.sequences.clear();

        let initial_path = Vec::new();
        let ie_probability = self.compute_initiating_event_probability()?;
        let house_events = HashMap::new();

        let root_event_tree = self.event_tree.clone();
        let initial_branch = root_event_tree.initial_state.clone();
        self.traverse_branch(
            &root_event_tree,
            &initial_branch,
            initial_path,
            ie_probability,
            house_events,
        )?;

        Ok(())
    }

    pub fn sequences(&self) -> &[SequenceResult] {
        &self.sequences
    }

    fn compute_initiating_event_probability(&self) -> Result<f64, PraxisError> {
        if let Some(ft_id) = &self.initiating_event.fault_tree_id {
            let fault_tree = self.model.get_fault_tree(ft_id).ok_or_else(|| {
                PraxisError::Logic(format!(
                    "Fault tree '{}' not found for initiating event '{}'",
                    ft_id, self.initiating_event.id
                ))
            })?;
            let ft_analysis = FaultTreeAnalysis::new(fault_tree)?;
            let ft_result = ft_analysis.analyze()?;
            Ok(ft_result.top_event_probability)
        } else {
            Ok(self.initiating_event.probability.unwrap_or(1.0))
        }
    }

    fn is_success_state(state: &str) -> bool {
        matches!(state.to_ascii_lowercase().as_str(), "success" | "yes")
    }

    fn compute_functional_event_probability(
        &self,
        event_tree: &EventTree,
        fe_id: &str,
    ) -> Result<f64, PraxisError> {
        let fe = event_tree.functional_events.get(fe_id).ok_or_else(|| {
            PraxisError::Logic(format!(
                "Functional event '{}' not found in event tree",
                fe_id
            ))
        })?;

        if let Some(ft_id) = &fe.fault_tree_id {
            let fault_tree = self.model.get_fault_tree(ft_id).ok_or_else(|| {
                PraxisError::Logic(format!("Fault tree '{}' not found in model", ft_id))
            })?;
            let ft_analysis = FaultTreeAnalysis::new(fault_tree)?;
            let ft_result = ft_analysis.analyze()?;
            Ok(ft_result.top_event_probability)
        } else if let Some(prob) = fe.success_probability {
            Ok(prob)
        } else {
            Ok(0.5)
        }
    }

    fn traverse_branch(
        &mut self,
        event_tree: &EventTree,
        branch: &Branch,
        path: Vec<(String, String)>,
        probability: f64,
        mut house_events: HashMap<String, bool>,
    ) -> Result<(), PraxisError> {
        for (id, state) in &branch.house_event_assignments {
            house_events.insert(id.clone(), *state);
        }

        match &branch.target {
            BranchTarget::Sequence(seq_id) => {
                let sequence = event_tree.sequences.get(seq_id).ok_or_else(|| {
                    PraxisError::Logic(format!(
                        "Sequence '{}' not found in event tree '{}'",
                        seq_id, event_tree.id
                    ))
                })?;

                if let Some(linked_et_id) = &sequence.linked_event_tree_id {
                    if linked_et_id == &event_tree.id {
                        event_tree.validate()?;
                        let linked_initial = event_tree.initial_state.clone();
                        return self.traverse_branch(
                            event_tree,
                            &linked_initial,
                            path,
                            probability,
                            house_events,
                        );
                    }

                    if let Some(lib) = self.event_tree_library {
                        let linked_et = lib.get(linked_et_id).ok_or_else(|| {
                            PraxisError::Logic(format!(
                                "Linked event tree '{}' not found for sequence '{}'",
                                linked_et_id, sequence.id
                            ))
                        })?;

                        linked_et.validate()?;
                        let linked_initial = linked_et.initial_state.clone();
                        return self.traverse_branch(
                            linked_et,
                            &linked_initial,
                            path,
                            probability,
                            house_events,
                        );
                    }
                }

                let ie_frequency = self.initiating_event.frequency.unwrap_or(1.0);
                let frequency = probability * ie_frequency;

                self.sequences.push(SequenceResult {
                    sequence: sequence.clone(),
                    path,
                    probability,
                    frequency,
                });
                Ok(())
            }
            BranchTarget::Fork(fork) => {
                if let Some(fixed) = house_events.get(&fork.functional_event_id).copied() {
                    let fixed_state = if fixed { "true" } else { "false" };
                    for fork_path in &fork.paths {
                        if fork_path.state == fixed_state {
                            let mut new_path = path.clone();
                            new_path
                                .push((fork.functional_event_id.clone(), fork_path.state.clone()));
                            self.traverse_branch(
                                event_tree,
                                &fork_path.branch,
                                new_path,
                                probability,
                                house_events.clone(),
                            )?;
                            return Ok(());
                        }
                    }

                    return Err(PraxisError::Logic(format!(
                        "No path for fixed house-event state '{}' in fork for functional event '{}'",
                        fixed_state, fork.functional_event_id
                    )));
                }

                for fork_path in &fork.paths {
                    let mut new_path = path.clone();
                    new_path.push((fork.functional_event_id.clone(), fork_path.state.clone()));

                    let state_probability = if let Some(p) = fork_path.probability {
                        p
                    } else if let Some(negated) = fork_path.collect_formula_negated {
                        let p = self.compute_functional_event_probability(
                            event_tree,
                            &fork.functional_event_id,
                        )?;
                        if negated {
                            1.0 - p
                        } else {
                            p
                        }
                    } else {
                        let fe_probability = self.compute_functional_event_probability(
                            event_tree,
                            &fork.functional_event_id,
                        )?;
                        if Self::is_success_state(&fork_path.state) {
                            fe_probability
                        } else {
                            1.0 - fe_probability
                        }
                    };

                    self.traverse_branch(
                        event_tree,
                        &fork_path.branch,
                        new_path,
                        probability * state_probability,
                        house_events.clone(),
                    )?;
                }
                Ok(())
            }
            BranchTarget::NamedBranch(branch_id) => {
                if let Some(named_branch) = event_tree.named_branches.get(branch_id) {
                    let branch_clone = named_branch.branch.clone();
                    self.traverse_branch(
                        event_tree,
                        &branch_clone,
                        path,
                        probability,
                        house_events,
                    )?;
                }
                Ok(())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::event_tree::{Fork, FunctionalEvent, Path};
    use crate::core::model::Model;

    #[test]
    fn test_event_tree_analysis_new() {
        let model = Model::new("TestModel".to_string()).unwrap();
        let ie = InitiatingEvent::new("IE-1".to_string());
        let target = BranchTarget::Sequence("SEQ-1".to_string());
        let et = EventTree::new("ET-1".to_string(), Branch::new(target));

        let eta = EventTreeAnalysis::new(ie, et, &model);
        assert_eq!(eta.initiating_event.id, "IE-1");
        assert_eq!(eta.event_tree.id, "ET-1");
        assert_eq!(eta.sequences.len(), 0);
    }

    #[test]
    fn test_event_tree_analysis_simple_sequence() {
        let model = Model::new("TestModel".to_string()).unwrap();
        let ie = InitiatingEvent::new("IE-1".to_string());
        let seq = Sequence::new("SEQ-1".to_string());

        let target = BranchTarget::Sequence("SEQ-1".to_string());
        let initial = Branch::new(target);
        let mut et = EventTree::new("ET-1".to_string(), initial);
        et.add_sequence(seq).unwrap();

        let mut eta = EventTreeAnalysis::new(ie, et, &model);
        assert!(eta.analyze().is_ok());

        let results = eta.sequences();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].sequence.id, "SEQ-1");
        assert_eq!(results[0].path.len(), 0);
    }

    #[test]
    fn test_event_tree_analysis_with_fork() {
        let ie = InitiatingEvent::new("IE-LOCA".to_string());
        let seq_ok = Sequence::new("SEQ-OK".to_string());
        let seq_fail = Sequence::new("SEQ-FAIL".to_string());
        let fe = FunctionalEvent::new("FE-COOLANT".to_string());

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

        let fork = Fork::new("FE-COOLANT".to_string(), vec![success_path, failure_path]).unwrap();
        let initial = Branch::new(BranchTarget::Fork(fork));
        let mut et = EventTree::new("ET-LOCA".to_string(), initial);
        et.add_sequence(seq_ok).unwrap();
        et.add_sequence(seq_fail).unwrap();
        et.add_functional_event(fe).unwrap();

        let model = Model::new("TestModel".to_string()).unwrap();
        let mut eta = EventTreeAnalysis::new(ie, et, &model);
        assert!(eta.analyze().is_ok());

        let results = eta.sequences();
        assert_eq!(results.len(), 2);
        assert!(results[0].sequence.id == "SEQ-OK" || results[0].sequence.id == "SEQ-FAIL");
        assert_eq!(results[0].path.len(), 1);
        assert_eq!(results[0].path[0].0, "FE-COOLANT");
        assert!(results[1].sequence.id == "SEQ-OK" || results[1].sequence.id == "SEQ-FAIL");
        assert_eq!(results[1].path.len(), 1);
        assert_eq!(results[1].path[0].0, "FE-COOLANT");
        assert_ne!(results[0].sequence.id, results[1].sequence.id);
    }

    #[test]
    fn test_event_tree_analysis_multiple_forks() {
        let ie = InitiatingEvent::new("IE-1".to_string());
        let seq_ss = Sequence::new("SEQ-SS".to_string());
        let seq_sf = Sequence::new("SEQ-SF".to_string());
        let seq_fs = Sequence::new("SEQ-FS".to_string());
        let seq_ff = Sequence::new("SEQ-FF".to_string());

        let fe1 = FunctionalEvent::new("FE-1".to_string()).with_order(1);
        let fe2 = FunctionalEvent::new("FE-2".to_string()).with_order(2);

        let fork2_success = Fork::new(
            "FE-2".to_string(),
            vec![
                Path::new(
                    "success".to_string(),
                    Branch::new(BranchTarget::Sequence("SEQ-SS".to_string())),
                )
                .unwrap(),
                Path::new(
                    "failure".to_string(),
                    Branch::new(BranchTarget::Sequence("SEQ-SF".to_string())),
                )
                .unwrap(),
            ],
        )
        .unwrap();

        let fork2_failure = Fork::new(
            "FE-2".to_string(),
            vec![
                Path::new(
                    "success".to_string(),
                    Branch::new(BranchTarget::Sequence("SEQ-FS".to_string())),
                )
                .unwrap(),
                Path::new(
                    "failure".to_string(),
                    Branch::new(BranchTarget::Sequence("SEQ-FF".to_string())),
                )
                .unwrap(),
            ],
        )
        .unwrap();

        let fork1 = Fork::new(
            "FE-1".to_string(),
            vec![
                Path::new(
                    "success".to_string(),
                    Branch::new(BranchTarget::Fork(fork2_success)),
                )
                .unwrap(),
                Path::new(
                    "failure".to_string(),
                    Branch::new(BranchTarget::Fork(fork2_failure)),
                )
                .unwrap(),
            ],
        )
        .unwrap();

        let initial = Branch::new(BranchTarget::Fork(fork1));
        let mut et = EventTree::new("ET-1".to_string(), initial);
        et.add_sequence(seq_ss).unwrap();
        et.add_sequence(seq_sf).unwrap();
        et.add_sequence(seq_fs).unwrap();
        et.add_sequence(seq_ff).unwrap();
        et.add_functional_event(fe1).unwrap();
        et.add_functional_event(fe2).unwrap();

        let model = Model::new("TestModel".to_string()).unwrap();
        let mut eta = EventTreeAnalysis::new(ie, et, &model);
        assert!(eta.analyze().is_ok());

        let results = eta.sequences();
        assert_eq!(results.len(), 4);

        for result in results {
            assert_eq!(result.path.len(), 2);
            assert_eq!(result.path[0].0, "FE-1");
            assert_eq!(result.path[1].0, "FE-2");
        }
    }

    #[test]
    fn test_event_tree_analysis_invalid_tree() {
        let ie = InitiatingEvent::new("IE-1".to_string());
        let target = BranchTarget::Sequence("SEQ-MISSING".to_string());
        let et = EventTree::new("ET-1".to_string(), Branch::new(target));

        let model = Model::new("TestModel".to_string()).unwrap();
        let mut eta = EventTreeAnalysis::new(ie, et, &model);
        let result = eta.analyze();
        assert!(result.is_err());
    }

    #[test]
    fn test_event_tree_analysis_named_branch() {
        let ie = InitiatingEvent::new("IE-1".to_string());
        let seq = Sequence::new("SEQ-1".to_string());
        let target = BranchTarget::Sequence("SEQ-1".to_string());
        let named_branch = crate::core::event_tree::NamedBranch::new("BRANCH-1".to_string(), Branch::new(target));
        let initial = Branch::new(BranchTarget::NamedBranch("BRANCH-1".to_string()));

        let mut et = EventTree::new("ET-1".to_string(), initial);
        et.add_sequence(seq).unwrap();
        et.add_named_branch(named_branch).unwrap();

        let model = Model::new("TestModel".to_string()).unwrap();
        let mut eta = EventTreeAnalysis::new(ie, et, &model);
        assert!(eta.analyze().is_ok());

        let results = eta.sequences();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].sequence.id, "SEQ-1");
    }

    #[test]
    fn test_clone() {
        let seq = SequenceResult {
            sequence: Sequence::new("SEQ-1".to_string()),
            path: vec![("FE-1".to_string(), "success".to_string())],
            probability: 0.5,
            frequency: 0.01,
        };
        let seq_clone = seq.clone();
        assert_eq!(seq, seq_clone);
    }

    #[test]
    fn test_sequence_probability_with_direct_probability() {
        let model = Model::new("TestModel".to_string()).unwrap();
        let mut ie = InitiatingEvent::new("IE-LOCA".to_string());
        ie.probability = Some(0.001);
        ie.frequency = Some(0.1);

        let mut fe = FunctionalEvent::new("FE-COOLANT".to_string());
        fe.success_probability = Some(0.9);

        let seq_ok = Sequence::new("SEQ-OK".to_string());
        let seq_fail = Sequence::new("SEQ-FAIL".to_string());

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
        let fork = Fork::new("FE-COOLANT".to_string(), vec![success_path, failure_path]).unwrap();

        let initial = Branch::new(BranchTarget::Fork(fork));
        let mut et = EventTree::new("ET-LOCA".to_string(), initial);
        et.add_sequence(seq_ok).unwrap();
        et.add_sequence(seq_fail).unwrap();
        et.add_functional_event(fe).unwrap();

        let mut eta = EventTreeAnalysis::new(ie, et, &model);
        assert!(eta.analyze().is_ok());

        let results = eta.sequences();
        assert_eq!(results.len(), 2);

        let success_result = results.iter().find(|r| r.sequence.id == "SEQ-OK").unwrap();
        let failure_result = results
            .iter()
            .find(|r| r.sequence.id == "SEQ-FAIL")
            .unwrap();

        assert!((success_result.probability - 0.0009).abs() < 1e-10);
        assert!((success_result.frequency - 0.0009 * 0.1).abs() < 1e-10);
        assert!((failure_result.probability - 0.0001).abs() < 1e-10);
        assert!((failure_result.frequency - 0.0001 * 0.1).abs() < 1e-10);
    }

    #[test]
    fn test_sequence_probability_with_fault_tree() {
        use crate::core::event::BasicEvent;
        use crate::core::fault_tree::FaultTree;
        use crate::core::gate::{Formula, Gate};

        let mut model = Model::new("TestModel".to_string()).unwrap();
        let mut ft = FaultTree::new("FT-COOLANT", "TopGate").unwrap();
        let mut gate = Gate::new("TopGate".to_string(), Formula::Or).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.1).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.2).unwrap())
            .unwrap();
        model.add_fault_tree(ft).unwrap();

        let mut ie = InitiatingEvent::new("IE-LOCA".to_string());
        ie.probability = Some(1.0);
        ie.frequency = Some(1.0);

        let mut fe = FunctionalEvent::new("FE-COOLANT".to_string());
        fe.fault_tree_id = Some("FT-COOLANT".to_string());

        let seq_ok = Sequence::new("SEQ-OK".to_string());
        let seq_fail = Sequence::new("SEQ-FAIL".to_string());

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
        let fork = Fork::new("FE-COOLANT".to_string(), vec![success_path, failure_path]).unwrap();

        let initial = Branch::new(BranchTarget::Fork(fork));
        let mut et = EventTree::new("ET-LOCA".to_string(), initial);
        et.add_sequence(seq_ok).unwrap();
        et.add_sequence(seq_fail).unwrap();
        et.add_functional_event(fe).unwrap();

        let mut eta = EventTreeAnalysis::new(ie, et, &model);
        assert!(eta.analyze().is_ok());

        let results = eta.sequences();
        assert_eq!(results.len(), 2);

        let success_result = results.iter().find(|r| r.sequence.id == "SEQ-OK").unwrap();
        let failure_result = results
            .iter()
            .find(|r| r.sequence.id == "SEQ-FAIL")
            .unwrap();

        assert!((success_result.probability - 0.28).abs() < 1e-10);
        assert!((failure_result.probability - 0.72).abs() < 1e-10);
    }

    #[test]
    fn test_sequence_probability_default() {
        let model = Model::new("TestModel".to_string()).unwrap();

        let mut ie = InitiatingEvent::new("IE-1".to_string());
        ie.probability = Some(1.0);
        ie.frequency = Some(1.0);

        let fe = FunctionalEvent::new("FE-1".to_string());

        let seq_ok = Sequence::new("SEQ-OK".to_string());
        let seq_fail = Sequence::new("SEQ-FAIL".to_string());

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
        let fork = Fork::new("FE-1".to_string(), vec![success_path, failure_path]).unwrap();

        let initial = Branch::new(BranchTarget::Fork(fork));
        let mut et = EventTree::new("ET-1".to_string(), initial);
        et.add_sequence(seq_ok).unwrap();
        et.add_sequence(seq_fail).unwrap();
        et.add_functional_event(fe).unwrap();

        let mut eta = EventTreeAnalysis::new(ie, et, &model);
        assert!(eta.analyze().is_ok());

        let results = eta.sequences();
        let success_result = results.iter().find(|r| r.sequence.id == "SEQ-OK").unwrap();
        let failure_result = results
            .iter()
            .find(|r| r.sequence.id == "SEQ-FAIL")
            .unwrap();

        assert!((success_result.probability - 0.5).abs() < 1e-10);
        assert!((failure_result.probability - 0.5).abs() < 1e-10);
    }

    #[test]
    fn test_sequence_probability_multiple_fes() {
        let model = Model::new("TestModel".to_string()).unwrap();

        let mut ie = InitiatingEvent::new("IE-1".to_string());
        ie.probability = Some(1.0);
        ie.frequency = Some(1.0);

        let mut fe1 = FunctionalEvent::new("FE-1".to_string());
        fe1.success_probability = Some(0.8);

        let mut fe2 = FunctionalEvent::new("FE-2".to_string());
        fe2.success_probability = Some(0.9);
        let seq_ss = Sequence::new("SEQ-SS".to_string());

        let fork2 = Fork::new(
            "FE-2".to_string(),
            vec![Path::new(
                "success".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ-SS".to_string())),
            )
            .unwrap()],
        )
        .unwrap();

        let fork1 = Fork::new(
            "FE-1".to_string(),
            vec![Path::new(
                "success".to_string(),
                Branch::new(BranchTarget::Fork(fork2)),
            )
            .unwrap()],
        )
        .unwrap();

        let initial = Branch::new(BranchTarget::Fork(fork1));
        let mut et = EventTree::new("ET-1".to_string(), initial);
        et.add_sequence(seq_ss).unwrap();
        et.add_functional_event(fe1).unwrap();
        et.add_functional_event(fe2).unwrap();

        let mut eta = EventTreeAnalysis::new(ie, et, &model);
        assert!(eta.analyze().is_ok());

        let results = eta.sequences();
        assert_eq!(results.len(), 1);
        assert!((results[0].probability - 0.72).abs() < 1e-10);
    }

    #[test]
    fn test_initiating_event_with_fault_tree() {
        use crate::core::event::BasicEvent;
        use crate::core::fault_tree::FaultTree;
        use crate::core::gate::{Formula, Gate};

        let mut model = Model::new("TestModel".to_string()).unwrap();
        let mut ft_ie = FaultTree::new("FT-IE", "TopGate").unwrap();
        let mut gate = Gate::new("TopGate".to_string(), Formula::Or).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft_ie.add_gate(gate).unwrap();
        ft_ie
            .add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft_ie
            .add_basic_event(BasicEvent::new("E2".to_string(), 0.02).unwrap())
            .unwrap();
        model.add_fault_tree(ft_ie).unwrap();

        let ie = InitiatingEvent::new("IE-LOCA".to_string())
            .with_fault_tree("FT-IE".to_string())
            .with_frequency(1.0);

        let seq = Sequence::new("SEQ-1".to_string());
        let initial = Branch::new(BranchTarget::Sequence("SEQ-1".to_string()));
        let mut et = EventTree::new("ET-1".to_string(), initial);
        et.add_sequence(seq).unwrap();

        let mut eta = EventTreeAnalysis::new(ie, et, &model);
        assert!(eta.analyze().is_ok());

        let results = eta.sequences();
        assert_eq!(results.len(), 1);

        assert!((results[0].probability - 0.0298).abs() < 1e-10);
        assert!((results[0].frequency - 0.0298).abs() < 1e-10);
    }

    #[test]
    fn test_initiating_event_direct_probability_override() {
        let model = Model::new("TestModel".to_string()).unwrap();

        let ie = InitiatingEvent::new("IE-1".to_string())
            .with_probability(0.05)
            .with_frequency(2.0);

        let seq = Sequence::new("SEQ-1".to_string());
        let initial = Branch::new(BranchTarget::Sequence("SEQ-1".to_string()));
        let mut et = EventTree::new("ET-1".to_string(), initial);
        et.add_sequence(seq).unwrap();

        let mut eta = EventTreeAnalysis::new(ie, et, &model);
        assert!(eta.analyze().is_ok());

        let results = eta.sequences();

        assert!((results[0].probability - 0.05).abs() < 1e-10);
        assert!((results[0].frequency - 0.1).abs() < 1e-10);
    }

    #[test]
    fn test_initiating_event_with_fault_tree_and_functional_events() {
        use crate::core::event::BasicEvent;
        use crate::core::fault_tree::FaultTree;
        use crate::core::gate::{Formula, Gate};

        let mut model = Model::new("TestModel".to_string()).unwrap();
        let mut ft_ie = FaultTree::new("FT-IE", "TopGate").unwrap();
        let mut gate = Gate::new("TopGate".to_string(), Formula::And).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft_ie.add_gate(gate).unwrap();
        ft_ie
            .add_basic_event(BasicEvent::new("E1".to_string(), 0.1).unwrap())
            .unwrap();
        ft_ie
            .add_basic_event(BasicEvent::new("E2".to_string(), 0.2).unwrap())
            .unwrap();
        model.add_fault_tree(ft_ie).unwrap();

        let ie = InitiatingEvent::new("IE-1".to_string())
            .with_fault_tree("FT-IE".to_string())
            .with_frequency(10.0);

        let mut fe = FunctionalEvent::new("FE-1".to_string());
        fe.success_probability = Some(0.95);

        let seq_ok = Sequence::new("SEQ-OK".to_string());
        let seq_fail = Sequence::new("SEQ-FAIL".to_string());

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
        let fork = Fork::new("FE-1".to_string(), vec![success_path, failure_path]).unwrap();

        let initial = Branch::new(BranchTarget::Fork(fork));
        let mut et = EventTree::new("ET-1".to_string(), initial);
        et.add_sequence(seq_ok).unwrap();
        et.add_sequence(seq_fail).unwrap();
        et.add_functional_event(fe).unwrap();

        let mut eta = EventTreeAnalysis::new(ie, et, &model);
        assert!(eta.analyze().is_ok());

        let results = eta.sequences();
        assert_eq!(results.len(), 2);

        let success_result = results.iter().find(|r| r.sequence.id == "SEQ-OK").unwrap();
        let failure_result = results
            .iter()
            .find(|r| r.sequence.id == "SEQ-FAIL")
            .unwrap();

        assert!((success_result.probability - 0.019).abs() < 1e-10);
        assert!((success_result.frequency - 0.19).abs() < 1e-10);

        assert!((failure_result.probability - 0.001).abs() < 1e-10);
        assert!((failure_result.frequency - 0.01).abs() < 1e-10);
    }

    #[test]
    fn test_initiating_event_missing_fault_tree_error() {
        let model = Model::new("TestModel".to_string()).unwrap();

        let ie =
            InitiatingEvent::new("IE-1".to_string()).with_fault_tree("FT-NONEXISTENT".to_string());

        let seq = Sequence::new("SEQ-1".to_string());
        let initial = Branch::new(BranchTarget::Sequence("SEQ-1".to_string()));
        let mut et = EventTree::new("ET-1".to_string(), initial);
        et.add_sequence(seq).unwrap();

        let mut eta = EventTreeAnalysis::new(ie, et, &model);
        let result = eta.analyze();

        assert!(result.is_err());
        match result {
            Err(PraxisError::Logic(msg)) => {
                assert!(msg.contains("Fault tree"));
                assert!(msg.contains("not found"));
            }
            _ => panic!("Expected Logic error for missing fault tree"),
        }
    }
}
