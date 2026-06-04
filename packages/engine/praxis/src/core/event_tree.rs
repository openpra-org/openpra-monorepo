// Event Tree facilities for PRA analysis.
// Based on mcSCRAM/src/event_tree.h and mcSCRAM/src/event_tree.cc

use crate::error::{MefError, PraxisError};
use std::collections::HashMap;

/// Event-tree Initiating Event.
///
/// Represents the initial event that triggers an event tree analysis,
/// such as a loss of coolant accident (LOCA) or loss of power.
#[derive(Debug, Clone, PartialEq)]
pub struct InitiatingEvent {
    /// Unique identifier for this initiating event
    pub id: String,
    /// Optional human-readable name
    pub name: Option<String>,
    /// Optional reference to associated event tree
    pub event_tree_id: Option<String>,
    /// Probability of this initiating event occurring (conditional probability)
    pub probability: Option<f64>,
    /// Frequency of this initiating event (per year)
    pub frequency: Option<f64>,
    /// Optional reference to fault tree for calculating IE probability
    pub fault_tree_id: Option<String>,
}

impl InitiatingEvent {
    /// Creates a new initiating event with the given ID.
    ///
    /// # Example
    /// ```
    /// use praxis::core::event_tree::InitiatingEvent;
    ///
    /// let ie = InitiatingEvent::new("IE-LOCA".to_string());
    /// assert_eq!(ie.id, "IE-LOCA");
    /// ```
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

    /// Sets the name for this initiating event.
    pub fn with_name(mut self, name: String) -> Self {
        self.name = Some(name);
        self
    }

    /// Associates an event tree with this initiating event.
    pub fn with_event_tree(mut self, event_tree_id: String) -> Self {
        self.event_tree_id = Some(event_tree_id);
        self
    }

    /// Sets the probability for this initiating event.
    pub fn with_probability(mut self, probability: f64) -> Self {
        self.probability = Some(probability);
        self
    }

    /// Sets the frequency for this initiating event.
    pub fn with_frequency(mut self, frequency: f64) -> Self {
        self.frequency = Some(frequency);
        self
    }

    /// Links this initiating event to a fault tree for probability calculation.
    pub fn with_fault_tree(mut self, fault_tree_id: String) -> Self {
        self.fault_tree_id = Some(fault_tree_id);
        self
    }
}

/// Represents sequences in event trees.
///
/// Sequences are terminal nodes in event trees that represent
/// specific outcomes after traversing functional event branches.
#[derive(Debug, Clone, PartialEq)]
pub struct Sequence {
    /// Unique identifier for this sequence
    pub id: String,
    /// Optional human-readable name
    pub name: Option<String>,
    /// Optional linked event tree that continues the sequence.
    ///
    /// In MEF, this corresponds to:
    /// `<define-sequence name="X"><event-tree name="Other-ET"/></define-sequence>`.
    pub linked_event_tree_id: Option<String>,
    /// Instructions to execute at this sequence (instruction IDs)
    pub instructions: Vec<String>,
}

impl Sequence {
    /// Creates a new sequence with the given ID.
    ///
    /// # Arguments
    /// * `id` - Unique identifier for the sequence
    ///
    /// # Example
    /// ```
    /// use praxis::core::event_tree::Sequence;
    ///
    /// let seq = Sequence::new("SEQ-1".to_string());
    /// assert_eq!(seq.id, "SEQ-1");
    /// ```
    pub fn new(id: String) -> Self {
        Self {
            id,
            name: None,
            linked_event_tree_id: None,
            instructions: Vec::new(),
        }
    }

    /// Sets the name for this sequence.
    pub fn with_name(mut self, name: String) -> Self {
        self.name = Some(name);
        self
    }

    /// Sets the instructions for this sequence.
    pub fn with_instructions(mut self, instructions: Vec<String>) -> Self {
        self.instructions = instructions;
        self
    }

    /// Links this sequence to another event tree to continue traversal.
    pub fn with_linked_event_tree(mut self, event_tree_id: String) -> Self {
        self.linked_event_tree_id = Some(event_tree_id);
        self
    }
}

/// Represents functional events in event trees.
///
/// Functional events are pivot points in event trees where the
/// system state changes based on the success or failure of a
/// specific function or component.
///
/// Functional events can be linked to fault trees for quantitative
/// analysis, allowing computation of sequence frequencies.
#[derive(Debug, Clone, PartialEq)]
pub struct FunctionalEvent {
    /// Unique identifier for this functional event
    pub id: String,
    /// Optional human-readable name
    pub name: Option<String>,
    /// Order of the functional event in the event tree (0 = unassigned)
    pub order: i32,
    /// Optional reference to a fault tree that models this functional event
    ///
    /// When specified, the fault tree's top event probability is used
    /// to calculate the failure probability of this functional event.
    pub fault_tree_id: Option<String>,
    /// Optional success probability for this functional event
    ///
    /// If specified, this value is used directly instead of computing
    /// from a linked fault tree. Range: [0.0, 1.0]
    pub success_probability: Option<f64>,
}

impl FunctionalEvent {
    /// Creates a new functional event with the given ID.
    ///
    /// # Arguments
    /// * `id` - Unique identifier for the functional event
    ///
    /// # Example
    /// ```
    /// use praxis::core::event_tree::FunctionalEvent;
    ///
    /// let fe = FunctionalEvent::new("FE-COOLANT".to_string());
    /// assert_eq!(fe.id, "FE-COOLANT");
    /// assert_eq!(fe.order, 0);
    /// ```
    pub fn new(id: String) -> Self {
        Self {
            id,
            name: None,
            order: 0,
            fault_tree_id: None,
            success_probability: None,
        }
    }

    /// Sets the name for this functional event.
    pub fn with_name(mut self, name: String) -> Self {
        self.name = Some(name);
        self
    }

    /// Sets the order for this functional event.
    pub fn with_order(mut self, order: i32) -> Self {
        self.order = order;
        self
    }

    /// Links this functional event to a fault tree for quantitative analysis.
    ///
    /// The linked fault tree's top event probability will be used to compute
    /// the failure probability of this functional event.
    ///
    /// # Arguments
    /// * `fault_tree_id` - ID of the fault tree to link
    ///
    /// # Example
    /// ```
    /// use praxis::core::event_tree::FunctionalEvent;
    ///
    /// let fe = FunctionalEvent::new("FE-COOLANT".to_string())
    ///     .with_fault_tree("FT-COOLANT-FAILURE".to_string());
    /// assert_eq!(fe.fault_tree_id, Some("FT-COOLANT-FAILURE".to_string()));
    /// ```
    pub fn with_fault_tree(mut self, fault_tree_id: String) -> Self {
        self.fault_tree_id = Some(fault_tree_id);
        self
    }

    /// Sets the success probability for this functional event.
    ///
    /// When set, this value is used directly instead of computing from
    /// a linked fault tree. The success probability should be in [0.0, 1.0].
    ///
    /// # Arguments
    /// * `probability` - Success probability (0.0 = always fails, 1.0 = always succeeds)
    ///
    /// # Example
    /// ```
    /// use praxis::core::event_tree::FunctionalEvent;
    ///
    /// let fe = FunctionalEvent::new("FE-COOLANT".to_string())
    ///     .with_success_probability(0.99);
    /// assert_eq!(fe.success_probability, Some(0.99));
    /// ```
    pub fn with_success_probability(mut self, probability: f64) -> Self {
        self.success_probability = Some(probability);
        self
    }
}

/// Named branches that can be referenced and reused in event trees.
#[derive(Debug, Clone, PartialEq)]
pub struct NamedBranch {
    /// Unique identifier for this named branch
    pub id: String,
    /// Optional human-readable name
    pub name: Option<String>,
    /// Branch definition
    pub branch: Branch,
}

impl NamedBranch {
    /// Creates a new named branch.
    pub fn new(id: String, branch: Branch) -> Self {
        Self {
            id,
            name: None,
            branch,
        }
    }

    /// Sets the name for this named branch.
    pub fn with_name(mut self, name: String) -> Self {
        self.name = Some(name);
        self
    }
}

/// Target types for branches in event trees.
#[derive(Debug, Clone, PartialEq)]
pub enum BranchTarget {
    /// Terminal sequence
    Sequence(String),
    /// Fork to another set of branches
    Fork(Fork),
    /// Reference to a named branch
    NamedBranch(String),
}

/// Branch representation in event trees.
///
/// Branches connect functional events to their outcomes,
/// carrying instructions and leading to targets (sequences, forks, or other branches).
#[derive(Debug, Clone, PartialEq)]
pub struct Branch {
    /// Instructions to execute at this branch (instruction IDs)
    pub instructions: Vec<String>,
    /// Deterministic house-event assignments applied when entering this branch.
    ///
    /// These correspond to MEF `set-house-event` instructions (typically used to
    /// constrain later functional-event forks and/or fault-tree house-event nodes).
    pub house_event_assignments: HashMap<String, bool>,
    /// Target of this branch
    pub target: BranchTarget,
}

impl Branch {
    /// Creates a new branch with the given target.
    pub fn new(target: BranchTarget) -> Self {
        Self {
            instructions: Vec::new(),
            house_event_assignments: HashMap::new(),
            target,
        }
    }

    /// Sets the instructions for this branch.
    pub fn with_instructions(mut self, instructions: Vec<String>) -> Self {
        self.instructions = instructions;
        self
    }

    /// Adds/overrides a house-event assignment for this branch.
    pub fn with_house_event_assignment(mut self, id: String, state: bool) -> Self {
        self.house_event_assignments.insert(id, state);
        self
    }
}

/// Functional-event state paths in event trees.
///
/// Paths represent specific states (success/failure) of a functional event.
#[derive(Debug, Clone, PartialEq)]
pub struct Path {
    /// State identifier for the functional event (e.g., "success", "failure")
    pub state: String,
    /// Optional probability for this path state (from MEF instructions like `collect-expression`)
    pub probability: Option<f64>,
    /// Optional indication that a `collect-formula` on this path negates the referenced gate.
    ///
    /// This enables fixtures where a path probability is specified via:
    /// - `<collect-formula><gate .../></collect-formula>`  => use FT top probability
    /// - `<collect-formula><not><gate .../></not></collect-formula>` => use complement
    pub collect_formula_negated: Option<bool>,
    /// Branch taken for this state
    pub branch: Branch,
}

impl Path {
    /// Creates a new path with the given state.
    ///
    /// # Arguments
    /// * `state` - State identifier (must not be empty)
    /// * `branch` - Branch for this state
    ///
    /// # Errors
    /// Returns `PraxisError::Mef` if state is empty.
    ///
    /// # Example
    /// ```
    /// use praxis::core::event_tree::{Path, Branch, BranchTarget};
    ///
    /// let target = BranchTarget::Sequence("SEQ-1".to_string());
    /// let branch = Branch::new(target);
    /// let path = Path::new("success".to_string(), branch).unwrap();
    /// assert_eq!(path.state, "success");
    /// ```
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

    /// Sets an explicit probability for this path state.
    pub fn with_probability(mut self, probability: f64) -> Self {
        self.probability = Some(probability);
        self
    }

    /// Marks whether this path's `collect-formula` negates the referenced gate.
    pub fn with_collect_formula_negated(mut self, negated: bool) -> Self {
        self.collect_formula_negated = Some(negated);
        self
    }
}

/// Functional event forks.
///
/// Forks split an event tree based on the possible states
/// of a functional event, with each path leading to a different outcome.
#[derive(Debug, Clone, PartialEq)]
pub struct Fork {
    /// ID of the functional event being forked
    pub functional_event_id: String,
    /// Paths for different states of the functional event
    pub paths: Vec<Path>,
}

impl Fork {
    /// Creates a new fork for a functional event.
    ///
    /// # Arguments
    /// * `functional_event_id` - ID of the functional event
    /// * `paths` - Paths for different states (must be non-empty, no duplicate states)
    ///
    /// # Errors
    /// Returns `PraxisError::Mef` if:
    /// - paths is empty
    /// - duplicate states exist in paths
    ///
    /// # Example
    /// ```
    /// use praxis::core::event_tree::{Fork, Path, Branch, BranchTarget};
    ///
    /// let success_target = BranchTarget::Sequence("SEQ-SUCCESS".to_string());
    /// let failure_target = BranchTarget::Sequence("SEQ-FAILURE".to_string());
    /// let success_path = Path::new("success".to_string(), Branch::new(success_target)).unwrap();
    /// let failure_path = Path::new("failure".to_string(), Branch::new(failure_target)).unwrap();
    ///
    /// let fork = Fork::new("FE-COOLANT".to_string(), vec![success_path, failure_path]).unwrap();
    /// assert_eq!(fork.functional_event_id, "FE-COOLANT");
    /// assert_eq!(fork.paths.len(), 2);
    /// ```
    pub fn new(functional_event_id: String, paths: Vec<Path>) -> Result<Self, PraxisError> {
        if paths.is_empty() {
            return Err(PraxisError::Mef(MefError::Validity(
                "Fork must have at least one path".to_string(),
            )));
        }

        // Check for duplicate states
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

/// Event Tree representation with MEF constructs.
///
/// Event trees model the progression of accident scenarios,
/// starting from an initiating event and branching based on
/// the success or failure of safety functions.
#[derive(Debug, Clone, PartialEq)]
pub struct EventTree {
    /// Unique identifier for this event tree
    pub id: String,
    /// Optional human-readable name
    pub name: Option<String>,
    /// Initial state branch (starting point of the tree)
    pub initial_state: Branch,
    /// Sequences in this event tree (terminal nodes)
    pub sequences: HashMap<String, Sequence>,
    /// Functional events in this event tree
    pub functional_events: HashMap<String, FunctionalEvent>,
    /// Named branches in this event tree (reusable branches)
    pub named_branches: HashMap<String, NamedBranch>,
}

impl EventTree {
    /// Creates a new event tree with the given ID and initial state.
    ///
    /// # Arguments
    /// * `id` - Unique identifier for the event tree
    /// * `initial_state` - Starting branch for the tree
    ///
    /// # Example
    /// ```
    /// use praxis::core::event_tree::{EventTree, Branch, BranchTarget, Fork, Path};
    ///
    /// let success_target = BranchTarget::Sequence("SEQ-OK".to_string());
    /// let failure_target = BranchTarget::Sequence("SEQ-FAIL".to_string());
    /// let success_path = Path::new("success".to_string(), Branch::new(success_target)).unwrap();
    /// let failure_path = Path::new("failure".to_string(), Branch::new(failure_target)).unwrap();
    /// let fork = Fork::new("FE-1".to_string(), vec![success_path, failure_path]).unwrap();
    ///
    /// let initial = Branch::new(BranchTarget::Fork(fork));
    /// let et = EventTree::new("ET-LOCA".to_string(), initial);
    /// assert_eq!(et.id, "ET-LOCA");
    /// ```
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

    /// Sets the name for this event tree.
    pub fn with_name(mut self, name: String) -> Self {
        self.name = Some(name);
        self
    }

    /// Adds a sequence to this event tree.
    ///
    /// # Errors
    /// Returns `PraxisError::Mef` if a sequence with this ID already exists.
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

    /// Adds a functional event to this event tree.
    ///
    /// # Errors
    /// Returns `PraxisError::Mef` if a functional event with this ID already exists.
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

    /// Adds a named branch to this event tree.
    ///
    /// # Errors
    /// Returns `PraxisError::Mef` if a named branch with this ID already exists.
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

    /// Validates the event tree structure.
    ///
    /// Checks that all references (functional events, sequences, named branches)
    /// point to existing elements.
    ///
    /// # Errors
    /// Returns `PraxisError::Mef` if validation fails.
    pub fn validate(&self) -> Result<(), PraxisError> {
        self.validate_branch(&self.initial_state)?;
        Ok(())
    }

    /// Helper to validate a branch recursively.
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
                // Recursively validate the named branch
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

    // T247: InitiatingEvent tests
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
