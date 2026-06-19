use crate::error::{MefError, PraxisError};
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq)]
pub struct InitiatingEvent {

    pub id: String,

    pub name: Option<String>,

    pub event_tree_id: Option<String>,

    pub probability: Option<f64>,

    pub frequency: Option<f64>,

    pub fault_tree_id: Option<String>,
}

impl InitiatingEvent {

    pub fn new(id: String) -> Self {
        Self {
            id,
            name: None,
            event_tree_id: None,
            probability: None,
            frequency: None,
            fault_tree_id: None,
        }
    }

    pub fn with_name(mut self, name: String) -> Self {
        self.name = Some(name);
        self
    }

    pub fn with_event_tree(mut self, event_tree_id: String) -> Self {
        self.event_tree_id = Some(event_tree_id);
        self
    }

    pub fn with_probability(mut self, probability: f64) -> Self {
        self.probability = Some(probability);
        self
    }

    pub fn with_frequency(mut self, frequency: f64) -> Self {
        self.frequency = Some(frequency);
        self
    }

    pub fn with_fault_tree(mut self, fault_tree_id: String) -> Self {
        self.fault_tree_id = Some(fault_tree_id);
        self
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Sequence {

    pub id: String,

    pub name: Option<String>,

    pub linked_event_tree_id: Option<String>,

    pub instructions: Vec<String>,
}

impl Sequence {

    pub fn new(id: String) -> Self {
        Self {
            id,
            name: None,
            linked_event_tree_id: None,
            instructions: Vec::new(),
        }
    }

    pub fn with_name(mut self, name: String) -> Self {
        self.name = Some(name);
        self
    }

    pub fn with_instructions(mut self, instructions: Vec<String>) -> Self {
        self.instructions = instructions;
        self
    }

    pub fn with_linked_event_tree(mut self, event_tree_id: String) -> Self {
        self.linked_event_tree_id = Some(event_tree_id);
        self
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct FunctionalEvent {

    pub id: String,

    pub name: Option<String>,

    pub order: i32,

    pub fault_tree_id: Option<String>,

    pub success_probability: Option<f64>,
}

impl FunctionalEvent {

    pub fn new(id: String) -> Self {
        Self {
            id,
            name: None,
            order: 0,
            fault_tree_id: None,
            success_probability: None,
        }
    }

    pub fn with_name(mut self, name: String) -> Self {
        self.name = Some(name);
        self
    }

    pub fn with_order(mut self, order: i32) -> Self {
        self.order = order;
        self
    }

    pub fn with_fault_tree(mut self, fault_tree_id: String) -> Self {
        self.fault_tree_id = Some(fault_tree_id);
        self
    }

    pub fn with_success_probability(mut self, probability: f64) -> Self {
        self.success_probability = Some(probability);
        self
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct NamedBranch {

    pub id: String,

    pub name: Option<String>,

    pub branch: Branch,
}

impl NamedBranch {

    pub fn new(id: String, branch: Branch) -> Self {
        Self {
            id,
            name: None,
            branch,
        }
    }

    pub fn with_name(mut self, name: String) -> Self {
        self.name = Some(name);
        self
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum BranchTarget {

    Sequence(String),

    Fork(Fork),

    NamedBranch(String),
}

#[derive(Debug, Clone, PartialEq)]
pub struct Branch {

    pub instructions: Vec<String>,

    pub house_event_assignments: HashMap<String, bool>,

    pub target: BranchTarget,
}

impl Branch {

    pub fn new(target: BranchTarget) -> Self {
        Self {
            instructions: Vec::new(),
            house_event_assignments: HashMap::new(),
            target,
        }
    }

    pub fn with_instructions(mut self, instructions: Vec<String>) -> Self {
        self.instructions = instructions;
        self
    }

    pub fn with_house_event_assignment(mut self, id: String, state: bool) -> Self {
        self.house_event_assignments.insert(id, state);
        self
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Path {

    pub state: String,

    pub probability: Option<f64>,

    pub collect_formula_negated: Option<bool>,

    pub branch: Branch,
}

impl Path {

    pub fn new(state: String, branch: Branch) -> Result<Self, PraxisError> {
        if state.is_empty() {
            return Err(PraxisError::Logic(
                "The state string for functional events cannot be empty".to_string(),
            ));
        }
        Ok(Self {
            state,
            probability: None,
            collect_formula_negated: None,
            branch,
        })
    }

    pub fn with_probability(mut self, probability: f64) -> Self {
        self.probability = Some(probability);
        self
    }

    pub fn with_collect_formula_negated(mut self, negated: bool) -> Self {
        self.collect_formula_negated = Some(negated);
        self
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Fork {

    pub functional_event_id: String,

    pub paths: Vec<Path>,
}

impl Fork {

    pub fn new(functional_event_id: String, paths: Vec<Path>) -> Result<Self, PraxisError> {
        if paths.is_empty() {
            return Err(PraxisError::Mef(MefError::Validity(
                "Fork must have at least one path".to_string(),
            )));
        }

        for i in 0..paths.len() {
            for j in (i + 1)..paths.len() {
                if paths[i].state == paths[j].state {
                    return Err(PraxisError::Mef(MefError::Validity(format!(
                        "Duplicate state path '{}' in fork for functional event '{}'",
                        paths[i].state, functional_event_id
                    ))));
                }
            }
        }

        Ok(Self {
            functional_event_id,
            paths,
        })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct EventTree {

    pub id: String,

    pub name: Option<String>,

    pub initial_state: Branch,

    pub sequences: HashMap<String, Sequence>,

    pub functional_events: HashMap<String, FunctionalEvent>,

    pub named_branches: HashMap<String, NamedBranch>,
}

impl EventTree {

    pub fn new(id: String, initial_state: Branch) -> Self {
        Self {
            id,
            name: None,
            initial_state,
            sequences: HashMap::new(),
            functional_events: HashMap::new(),
            named_branches: HashMap::new(),
        }
    }

    pub fn with_name(mut self, name: String) -> Self {
        self.name = Some(name);
        self
    }

    pub fn add_sequence(&mut self, sequence: Sequence) -> Result<(), PraxisError> {
        if self.sequences.contains_key(&sequence.id) {
            return Err(PraxisError::Mef(MefError::DuplicateElement {
                element_id: sequence.id.clone(),
                element_type: "sequence".to_string(),
                container_id: Some(self.id.clone()),
            }));
        }
        self.sequences.insert(sequence.id.clone(), sequence);
        Ok(())
    }

    pub fn add_functional_event(
        &mut self,
        functional_event: FunctionalEvent,
    ) -> Result<(), PraxisError> {
        if self.functional_events.contains_key(&functional_event.id) {
            return Err(PraxisError::Mef(MefError::DuplicateElement {
                element_id: functional_event.id.clone(),
                element_type: "functional event".to_string(),
                container_id: Some(self.id.clone()),
            }));
        }
        self.functional_events
            .insert(functional_event.id.clone(), functional_event);
        Ok(())
    }

    pub fn add_named_branch(&mut self, named_branch: NamedBranch) -> Result<(), PraxisError> {
        if self.named_branches.contains_key(&named_branch.id) {
            return Err(PraxisError::Mef(MefError::DuplicateElement {
                element_id: named_branch.id.clone(),
                element_type: "named branch".to_string(),
                container_id: Some(self.id.clone()),
            }));
        }
        self.named_branches
            .insert(named_branch.id.clone(), named_branch);
        Ok(())
    }

    pub fn validate(&self) -> Result<(), PraxisError> {
        self.validate_branch(&self.initial_state)?;
        Ok(())
    }

    fn validate_branch(&self, branch: &Branch) -> Result<(), PraxisError> {
        match &branch.target {
            BranchTarget::Sequence(seq_id) => {
                if !self.sequences.contains_key(seq_id) {
                    return Err(PraxisError::Mef(MefError::UndefinedElement {
                        reference: seq_id.clone(),
                        element_type: "sequence".to_string(),
                    }));
                }
            }
            BranchTarget::Fork(fork) => {
                if !self
                    .functional_events
                    .contains_key(&fork.functional_event_id)
                {
                    return Err(PraxisError::Mef(MefError::UndefinedElement {
                        reference: fork.functional_event_id.clone(),
                        element_type: "functional event".to_string(),
                    }));
                }
                for path in &fork.paths {
                    self.validate_branch(&path.branch)?;
                }
            }
            BranchTarget::NamedBranch(branch_id) => {
                if !self.named_branches.contains_key(branch_id) {
                    return Err(PraxisError::Mef(MefError::UndefinedElement {
                        reference: branch_id.clone(),
                        element_type: "named branch".to_string(),
                    }));
                }

                let named_branch = &self.named_branches[branch_id];
                self.validate_branch(&named_branch.branch)?;
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initiating_event_new() {
        let ie = InitiatingEvent::new("IE-LOCA".to_string());
        assert_eq!(ie.id, "IE-LOCA");
        assert_eq!(ie.name, None);
        assert_eq!(ie.event_tree_id, None);
        assert_eq!(ie.probability, None);
        assert_eq!(ie.frequency, None);
        assert_eq!(ie.fault_tree_id, None);
    }

    #[test]
    fn test_initiating_event_with_name() {
        let ie = InitiatingEvent::new("IE-1".to_string()).with_name("Loss of Coolant".to_string());
        assert_eq!(ie.name, Some("Loss of Coolant".to_string()));
    }

    #[test]
    fn test_initiating_event_with_probability() {
        let ie = InitiatingEvent::new("IE-1".to_string()).with_probability(0.001);
        assert_eq!(ie.probability, Some(0.001));
    }

    #[test]
    fn test_initiating_event_with_frequency() {
        let ie = InitiatingEvent::new("IE-1".to_string()).with_frequency(0.5);
        assert_eq!(ie.frequency, Some(0.5));
    }

    #[test]
    fn test_initiating_event_with_fault_tree() {
        let ie = InitiatingEvent::new("IE-1".to_string()).with_fault_tree("FT-IE-1".to_string());
        assert_eq!(ie.fault_tree_id, Some("FT-IE-1".to_string()));
    }

    #[test]
    fn test_initiating_event_builder_chain() {
        let ie = InitiatingEvent::new("IE-LOCA".to_string())
            .with_name("Loss of Coolant Accident".to_string())
            .with_fault_tree("FT-LOCA".to_string())
            .with_frequency(0.001);

        assert_eq!(ie.id, "IE-LOCA");
        assert_eq!(ie.name, Some("Loss of Coolant Accident".to_string()));
        assert_eq!(ie.fault_tree_id, Some("FT-LOCA".to_string()));
        assert_eq!(ie.frequency, Some(0.001));
    }

    #[test]
    fn test_sequence_new() {
        let seq = Sequence::new("SEQ-1".to_string());
        assert_eq!(seq.id, "SEQ-1");
        assert_eq!(seq.name, None);
        assert!(seq.instructions.is_empty());
    }

    #[test]
    fn test_sequence_with_name() {
        let seq = Sequence::new("SEQ-1".to_string()).with_name("Success Sequence".to_string());
        assert_eq!(seq.name, Some("Success Sequence".to_string()));
    }

    #[test]
    fn test_functional_event_new() {
        let fe = FunctionalEvent::new("FE-1".to_string());
        assert_eq!(fe.id, "FE-1");
        assert_eq!(fe.order, 0);
    }

    #[test]
    fn test_functional_event_with_order() {
        let fe = FunctionalEvent::new("FE-1".to_string()).with_order(5);
        assert_eq!(fe.order, 5);
    }

    #[test]
    fn test_path_new_valid() {
        let target = BranchTarget::Sequence("SEQ-1".to_string());
        let branch = Branch::new(target);
        let result = Path::new("success".to_string(), branch);
        assert!(result.is_ok());
        let path = result.unwrap();
        assert_eq!(path.state, "success");
    }

    #[test]
    fn test_path_new_empty_state() {
        let target = BranchTarget::Sequence("SEQ-1".to_string());
        let branch = Branch::new(target);
        let result = Path::new("".to_string(), branch);
        assert!(result.is_err());
        if let Err(PraxisError::Logic(message)) = result {
            assert!(message.contains("cannot be empty"));
        } else {
            panic!("Expected Logic error");
        }
    }

    #[test]
    fn test_fork_new_valid() {
        let success_target = BranchTarget::Sequence("SEQ-SUCCESS".to_string());
        let failure_target = BranchTarget::Sequence("SEQ-FAILURE".to_string());
        let success_path = Path::new("success".to_string(), Branch::new(success_target)).unwrap();
        let failure_path = Path::new("failure".to_string(), Branch::new(failure_target)).unwrap();

        let result = Fork::new("FE-1".to_string(), vec![success_path, failure_path]);
        assert!(result.is_ok());
        let fork = result.unwrap();
        assert_eq!(fork.functional_event_id, "FE-1");
        assert_eq!(fork.paths.len(), 2);
    }

    #[test]
    fn test_fork_new_empty_paths() {
        let result = Fork::new("FE-1".to_string(), vec![]);
        assert!(result.is_err());
        if let Err(PraxisError::Mef(MefError::Validity(message))) = result {
            assert!(message.contains("at least one path"));
        } else {
            panic!("Expected Validity error");
        }
    }

    #[test]
    fn test_fork_new_duplicate_states() {
        let target1 = BranchTarget::Sequence("SEQ-1".to_string());
        let target2 = BranchTarget::Sequence("SEQ-2".to_string());
        let path1 = Path::new("success".to_string(), Branch::new(target1)).unwrap();
        let path2 = Path::new("success".to_string(), Branch::new(target2)).unwrap();

        let result = Fork::new("FE-1".to_string(), vec![path1, path2]);
        assert!(result.is_err());
        if let Err(PraxisError::Mef(MefError::Validity(message))) = result {
            assert!(message.contains("Duplicate state"));
            assert!(message.contains("success"));
        } else {
            panic!("Expected Validity error");
        }
    }

    #[test]
    fn test_event_tree_new() {
        let target = BranchTarget::Sequence("SEQ-1".to_string());
        let initial = Branch::new(target);
        let et = EventTree::new("ET-1".to_string(), initial);
        assert_eq!(et.id, "ET-1");
        assert!(et.sequences.is_empty());
        assert!(et.functional_events.is_empty());
    }

    #[test]
    fn test_event_tree_add_sequence() {
        let target = BranchTarget::Sequence("SEQ-1".to_string());
        let initial = Branch::new(target);
        let mut et = EventTree::new("ET-1".to_string(), initial);

        let seq = Sequence::new("SEQ-1".to_string());
        assert!(et.add_sequence(seq).is_ok());
        assert_eq!(et.sequences.len(), 1);
    }

    #[test]
    fn test_event_tree_add_duplicate_sequence() {
        let target = BranchTarget::Sequence("SEQ-1".to_string());
        let initial = Branch::new(target);
        let mut et = EventTree::new("ET-1".to_string(), initial);

        let seq1 = Sequence::new("SEQ-1".to_string());
        et.add_sequence(seq1).unwrap();

        let seq2 = Sequence::new("SEQ-1".to_string());
        let result = et.add_sequence(seq2);
        assert!(result.is_err());
    }

    #[test]
    fn test_event_tree_add_functional_event() {
        let target = BranchTarget::Sequence("SEQ-1".to_string());
        let initial = Branch::new(target);
        let mut et = EventTree::new("ET-1".to_string(), initial);

        let fe = FunctionalEvent::new("FE-1".to_string());
        assert!(et.add_functional_event(fe).is_ok());
        assert_eq!(et.functional_events.len(), 1);
    }

    #[test]
    fn test_event_tree_validate_simple() {
        let seq = Sequence::new("SEQ-1".to_string());
        let target = BranchTarget::Sequence("SEQ-1".to_string());
        let initial = Branch::new(target);
        let mut et = EventTree::new("ET-1".to_string(), initial);
        et.add_sequence(seq).unwrap();

        assert!(et.validate().is_ok());
    }

    #[test]
    fn test_event_tree_validate_missing_sequence() {
        let target = BranchTarget::Sequence("SEQ-MISSING".to_string());
        let initial = Branch::new(target);
        let et = EventTree::new("ET-1".to_string(), initial);

        let result = et.validate();
        assert!(result.is_err());
        if let Err(PraxisError::Mef(MefError::UndefinedElement { reference, .. })) = result {
            assert_eq!(reference, "SEQ-MISSING");
        } else {
            panic!("Expected Undeclared error");
        }
    }

    #[test]
    fn test_event_tree_validate_with_fork() {
        let fe = FunctionalEvent::new("FE-1".to_string());
        let seq1 = Sequence::new("SEQ-SUCCESS".to_string());
        let seq2 = Sequence::new("SEQ-FAILURE".to_string());

        let success_target = BranchTarget::Sequence("SEQ-SUCCESS".to_string());
        let failure_target = BranchTarget::Sequence("SEQ-FAILURE".to_string());
        let success_path = Path::new("success".to_string(), Branch::new(success_target)).unwrap();
        let failure_path = Path::new("failure".to_string(), Branch::new(failure_target)).unwrap();
        let fork = Fork::new("FE-1".to_string(), vec![success_path, failure_path]).unwrap();

        let initial = Branch::new(BranchTarget::Fork(fork));
        let mut et = EventTree::new("ET-1".to_string(), initial);
        et.add_functional_event(fe).unwrap();
        et.add_sequence(seq1).unwrap();
        et.add_sequence(seq2).unwrap();

        assert!(et.validate().is_ok());
    }

    #[test]
    fn test_event_tree_validate_missing_functional_event() {
        let success_target = BranchTarget::Sequence("SEQ-SUCCESS".to_string());
        let failure_target = BranchTarget::Sequence("SEQ-FAILURE".to_string());
        let success_path = Path::new("success".to_string(), Branch::new(success_target)).unwrap();
        let failure_path = Path::new("failure".to_string(), Branch::new(failure_target)).unwrap();
        let fork = Fork::new("FE-MISSING".to_string(), vec![success_path, failure_path]).unwrap();

        let initial = Branch::new(BranchTarget::Fork(fork));
        let et = EventTree::new("ET-1".to_string(), initial);

        let result = et.validate();
        assert!(result.is_err());
        if let Err(PraxisError::Mef(MefError::UndefinedElement { reference, .. })) = result {
            assert_eq!(reference, "FE-MISSING");
        } else {
            panic!("Expected Undeclared error");
        }
    }

    #[test]
    fn test_named_branch() {
        let target = BranchTarget::Sequence("SEQ-1".to_string());
        let branch = Branch::new(target);
        let nb = NamedBranch::new("BRANCH-1".to_string(), branch);
        assert_eq!(nb.id, "BRANCH-1");
    }

    #[test]
    fn test_event_tree_add_named_branch() {
        let target = BranchTarget::Sequence("SEQ-1".to_string());
        let initial = Branch::new(target.clone());
        let mut et = EventTree::new("ET-1".to_string(), initial);

        let branch = Branch::new(target);
        let nb = NamedBranch::new("BRANCH-1".to_string(), branch);
        assert!(et.add_named_branch(nb).is_ok());
        assert_eq!(et.named_branches.len(), 1);
    }

    #[test]
    fn test_clone() {
        let seq = Sequence::new("SEQ-1".to_string());
        let seq_clone = seq.clone();
        assert_eq!(seq, seq_clone);

        let fe = FunctionalEvent::new("FE-1".to_string());
        let fe_clone = fe.clone();
        assert_eq!(fe, fe_clone);
    }

    #[test]
    fn test_functional_event_with_fault_tree() {
        let fe = FunctionalEvent::new("FE-COOLANT".to_string())
            .with_fault_tree("FT-COOLANT-FAILURE".to_string());

        assert_eq!(fe.id, "FE-COOLANT");
        assert_eq!(fe.fault_tree_id, Some("FT-COOLANT-FAILURE".to_string()));
        assert_eq!(fe.success_probability, None);
    }

    #[test]
    fn test_functional_event_with_success_probability() {
        let fe = FunctionalEvent::new("FE-COOLANT".to_string()).with_success_probability(0.99);

        assert_eq!(fe.id, "FE-COOLANT");
        assert_eq!(fe.fault_tree_id, None);
        assert_eq!(fe.success_probability, Some(0.99));
    }

    #[test]
    fn test_functional_event_with_both_fault_tree_and_probability() {
        let fe = FunctionalEvent::new("FE-COOLANT".to_string())
            .with_fault_tree("FT-COOLANT-FAILURE".to_string())
            .with_success_probability(0.99);

        assert_eq!(fe.id, "FE-COOLANT");
        assert_eq!(fe.fault_tree_id, Some("FT-COOLANT-FAILURE".to_string()));
        assert_eq!(fe.success_probability, Some(0.99));
    }

    #[test]
    fn test_functional_event_builder_pattern() {
        let fe = FunctionalEvent::new("FE-ECCS".to_string())
            .with_name("Emergency Core Cooling System".to_string())
            .with_order(1)
            .with_fault_tree("FT-ECCS".to_string())
            .with_success_probability(0.999);

        assert_eq!(fe.id, "FE-ECCS");
        assert_eq!(fe.name, Some("Emergency Core Cooling System".to_string()));
        assert_eq!(fe.order, 1);
        assert_eq!(fe.fault_tree_id, Some("FT-ECCS".to_string()));
        assert_eq!(fe.success_probability, Some(0.999));
    }
}
