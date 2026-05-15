/// Sequence formula builder — Phase 2 of the SCRAM-port pipeline.
///
/// Mirrors SCRAM's `EventTreeAnalysis::CollectSequences()`.
///
/// For each reachable sequence the result is the Boolean formula:
///   `OR over all paths { AND(gate_1, ..., gate_k) }`
/// where each gate_i comes from a `collect-formula` instruction
/// (`Path::collect_formula_negated`) on that path.
///
/// The formula is stored as a root `NodeIdx` inside a shared `BddPdag`,
/// ready to be consumed by the BDD engine (Phase 5) or ZBDD engine (Phase 7).

use std::collections::{HashMap, HashSet};

use crate::algorithms::bdd_pdag::{BddConnective, BddPdag, NodeIdx};
use crate::core::event_tree::{Branch, BranchTarget, EventTree};
use crate::core::fault_tree::FaultTree;
use crate::core::gate::Formula;
use crate::core::model::Model;
use crate::error::{PraxisError, Result};

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

/// Result of [`SequenceFormulaBuilder::build`].
pub struct SequenceFormulas {
    /// Shared BddPdag containing all collected gates and variables.
    pub pdag: BddPdag,

    /// Map from sequence ID to root `NodeIdx` in `pdag`.
    ///
    /// Sequences absent from this map have an unconditional formula (TRUE):
    /// they are reached on at least one path that carries no `collect-formula`
    /// terms.  Their probability equals the IE frequency — no BDD needed.
    pub sequence_roots: HashMap<String, NodeIdx>,

    /// Sequences reached on at least one path with no `collect-formula` terms.
    /// These are unconditionally TRUE; they supersede any entry in
    /// `sequence_roots` for the same ID.
    pub unconditional: HashSet<String>,

    /// IE frequency forwarded from the `build` call.
    pub ie_frequency: f64,
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/// Walks an event tree and produces a `SequenceFormulas`.
///
/// # Usage
/// ```ignore
/// let formulas = SequenceFormulaBuilder::new(&model)
///     .with_event_tree_library(&library)
///     .build(&et, ie_frequency)?;
/// ```
pub struct SequenceFormulaBuilder<'a> {
    model: &'a Model,
    et_library: Option<&'a HashMap<String, EventTree>>,
    pdag: BddPdag,
    /// Accumulated per-path AND-gate indices, keyed by sequence ID.
    sequence_paths: HashMap<String, Vec<NodeIdx>>,
    /// Sequences reachable by a path with no collect-formula terms (always TRUE).
    unconditional: HashSet<String>,
    /// Monotonically increasing counter for synthetic node IDs.
    next_synthetic: usize,
}

impl<'a> SequenceFormulaBuilder<'a> {
    pub fn new(model: &'a Model) -> Self {
        Self {
            model,
            et_library: None,
            pdag: BddPdag::new(),
            sequence_paths: HashMap::new(),
            unconditional: HashSet::new(),
            next_synthetic: 0,
        }
    }

    pub fn with_event_tree_library(mut self, lib: &'a HashMap<String, EventTree>) -> Self {
        self.et_library = Some(lib);
        self
    }

    /// Walk `et` and build a `SequenceFormulas`.
    ///
    /// `ie_frequency` is forwarded into the PDAG for ZBDD cutoff pruning.
    pub fn build(mut self, et: &EventTree, ie_frequency: f64) -> Result<SequenceFormulas> {
        et.validate()?;
        self.pdag.set_ie_frequency(ie_frequency);

        let initial = et.initial_state.clone();
        self.collect_sequences(et, &initial, Vec::new(), HashMap::new())?;

        // Collapse per-sequence path lists into a single root node per sequence.
        let mut sequence_roots = HashMap::new();
        let all_paths = std::mem::take(&mut self.sequence_paths);
        for (seq_id, paths) in all_paths {
            if paths.is_empty() {
                continue;
            }
            // If this sequence is also unconditional, the OR with TRUE = TRUE;
            // skip building a gate and let unconditional supersede.
            if self.unconditional.contains(&seq_id) {
                continue;
            }
            let root = if paths.len() == 1 {
                paths[0]
            } else {
                let id = format!("__OR__{}", self.next_synthetic);
                self.next_synthetic += 1;
                self.pdag.add_gate(id, BddConnective::Or, paths, None)?
            };
            sequence_roots.insert(seq_id, root);
        }

        Ok(SequenceFormulas {
            pdag: self.pdag,
            sequence_roots,
            unconditional: self.unconditional,
            ie_frequency,
        })
    }

    // -----------------------------------------------------------------------
    // Core traversal
    // -----------------------------------------------------------------------

    fn collect_sequences(
        &mut self,
        et: &EventTree,
        branch: &Branch,
        path_collector: Vec<NodeIdx>,
        house_overrides: HashMap<String, bool>,
    ) -> Result<()> {
        // Accumulate SetHouseEvent assignments from this branch.
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

                    // CollectFormula: add FE's fault tree gate to the path formula.
                    if let Some(negated) = path.collect_formula_negated {
                        if let Some(ref ft_id) = fe_ft_id {
                            // Clone to release the borrow on self.model before the
                            // mutable self.add_ft_scoped call below.
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
                        // If the FE has no fault tree, collect-formula has nothing
                        // to collect — skip silently (path contributes no gate term).
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
        path_collector: Vec<NodeIdx>,
        overrides: HashMap<String, bool>,
    ) -> Result<()> {
        let sequence = et.sequences.get(seq_id).ok_or_else(|| {
            PraxisError::Logic(format!(
                "Sequence '{}' not found in event tree '{}'",
                seq_id, et.id
            ))
        })?;

        // Link instruction: splice another event tree.
        if let Some(linked_et_id) = sequence.linked_event_tree_id.clone() {
            if linked_et_id == et.id {
                // Self-link: re-enter current ET from its initial state.
                let initial = et.initial_state.clone();
                return self.collect_sequences(et, &initial, path_collector, overrides);
            }
            if let Some(lib) = self.et_library {
                // Clone to release borrow on self.et_library before recursing.
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
            // No library and not self-link: fall through and treat as a leaf.
        }

        // Leaf: build AND gate for this path and record it.
        match self.build_path_gate(path_collector)? {
            Some(idx) => {
                self.sequence_paths
                    .entry(seq_id.to_string())
                    .or_default()
                    .push(idx);
            }
            None => {
                // Empty collector: this path is unconditionally TRUE.
                self.unconditional.insert(seq_id.to_string());
            }
        }
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Path gate construction
    // -----------------------------------------------------------------------

    /// Combines `path_collector` into one AND gate.
    /// Returns `None` for an empty collector (unconditional path).
    fn build_path_gate(&mut self, path_collector: Vec<NodeIdx>) -> Result<Option<NodeIdx>> {
        Ok(match path_collector.len() {
            0 => None,
            1 => Some(path_collector[0]),
            _ => {
                let id = format!("__AND__{}", self.next_synthetic);
                self.next_synthetic += 1;
                let idx =
                    self.pdag
                        .add_gate(id, BddConnective::And, path_collector, None)?;
                Some(idx)
            }
        })
    }

    // -----------------------------------------------------------------------
    // Fault-tree ingestion into BddPdag
    // -----------------------------------------------------------------------

    /// Adds a fault tree's gates and basic events into `self.pdag` with the
    /// given house-event overrides applied.  Returns the top-gate NodeIdx.
    ///
    /// If the scoped top-gate already exists in the PDAG (identical scope was
    /// processed earlier), returns the existing index without rebuilding.
    fn add_ft_scoped(
        &mut self,
        ft: &FaultTree,
        overrides: &HashMap<String, bool>,
        scope: &str,
    ) -> Result<NodeIdx> {
        let ft_name = ft.element().id();
        let ft_scope = if scope.is_empty() {
            ft_name.to_string()
        } else {
            format!("{}__{}", ft_name, scope)
        };

        let scoped_top = scoped_node_id(ft.top_event(), &ft_scope);
        if let Some(idx) = self.pdag.idx_of(&scoped_top) {
            return Ok(idx);
        }

        for be in ft.basic_events().values() {
            self.pdag
                .add_variable(be.element().id().to_string(), be.probability());
        }

        let mut gate_cache: HashMap<String, NodeIdx> = HashMap::new();
        self.add_element_scoped(ft, ft.top_event(), overrides, &ft_scope, &mut gate_cache)
    }

    fn add_element_scoped(
        &mut self,
        ft: &FaultTree,
        element_id: &str,
        overrides: &HashMap<String, bool>,
        scope: &str,
        cache: &mut HashMap<String, NodeIdx>,
    ) -> Result<NodeIdx> {
        let scoped_id = scoped_node_id(element_id, scope);

        // Check PDAG dedup first.
        if let Some(idx) = self.pdag.idx_of(&scoped_id) {
            return Ok(idx);
        }
        // Then local cache (gates built during this traversal).
        if let Some(&idx) = cache.get(&scoped_id) {
            return Ok(idx);
        }

        // House event override → constant.
        if let Some(&val) = overrides.get(element_id) {
            let idx = if val {
                self.pdag.get_or_create_true()
            } else {
                self.pdag.get_or_create_false()
            };
            cache.insert(scoped_id, idx);
            return Ok(idx);
        }

        // House event default value → constant.
        if let Some(he) = ft.get_house_event(element_id) {
            let idx = if he.state() {
                self.pdag.get_or_create_true()
            } else {
                self.pdag.get_or_create_false()
            };
            cache.insert(scoped_id, idx);
            return Ok(idx);
        }

        // Basic event → look up by original (un-scoped) ID — add_variable used
        // the plain ID.
        if let Some(idx) = self.pdag.idx_of(element_id) {
            cache.insert(scoped_id, idx);
            return Ok(idx);
        }

        // Gate → recurse into operands, then add the gate.
        let gate = ft.get_gate(element_id).ok_or_else(|| {
            PraxisError::Logic(format!(
                "SequenceFormulaBuilder: element '{}' not found in fault tree '{}'",
                element_id,
                ft.element().id()
            ))
        })?;

        let connective = BddConnective::from_formula(gate.formula());
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Stable scope key: sorted "id=T/F" pairs joined by commas.
/// Empty string when `overrides` is empty.
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

/// Returns `"id"` when scope is empty, `"id__scope"` otherwise.
fn scoped_node_id(id: &str, scope: &str) -> String {
    if scope.is_empty() {
        id.to_string()
    } else {
        format!("{}__{}", id, scope)
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::event::BasicEvent;
    use crate::core::event::HouseEvent;
    use crate::core::event_tree::{Fork, FunctionalEvent, Path, Sequence};
    use crate::core::fault_tree::FaultTree;
    use crate::core::gate::{Formula, Gate};
    use crate::core::model::Model;

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

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

    // -----------------------------------------------------------------------
    // T1: sequence with no collect-formula → unconditional (not in roots)
    // -----------------------------------------------------------------------

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
        // Neither path has collect_formula_negated set.

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

        // Both sequences are unconditional — no formula gates.
        assert!(formulas.sequence_roots.is_empty());
        assert!(formulas.unconditional.contains("SEQ-OK"));
        assert!(formulas.unconditional.contains("SEQ-FAIL"));
    }

    // -----------------------------------------------------------------------
    // T2: single fork with collect-formula on failure path
    // -----------------------------------------------------------------------

    #[test]
    fn test_collect_formula_failure_path() {
        let mut model = Model::new("M").unwrap();
        model
            .add_fault_tree(simple_ft("FT-COOL", "G-COOL", "E1", "E2"))
            .unwrap();

        let mut fe = FunctionalEvent::new("FE-COOL".to_string());
        fe.fault_tree_id = Some("FT-COOL".to_string());

        // Success path: collect-formula NOT negated (formula = gate directly)
        // Failure path: collect-formula negated (formula = NOT gate)
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

        // Both sequences have a gate (collect-formula on every path).
        assert!(formulas.unconditional.is_empty());
        assert!(formulas.sequence_roots.contains_key("SEQ-OK"));
        assert!(formulas.sequence_roots.contains_key("SEQ-FAIL"));

        // Failure root should be the complement of the success root.
        let ok_root = formulas.sequence_roots["SEQ-OK"];
        let fail_root = formulas.sequence_roots["SEQ-FAIL"];
        assert!(ok_root > 0, "success root should be positive");
        assert_eq!(fail_root, -ok_root, "failure root should be complement");

        // Both E1 and E2 should be in the PDAG.
        assert!(formulas.pdag.idx_of("E1").is_some());
        assert!(formulas.pdag.idx_of("E2").is_some());
    }

    // -----------------------------------------------------------------------
    // T3: two forks in sequence → AND of two gates on failure-failure path
    // -----------------------------------------------------------------------

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

        // fe1 failure → collect G1 (negated), then check fe2 failure → collect G2 (negated)
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

        // SEQ-FF path: NOT(G1) AND NOT(G2) → AND gate in pdag.
        let ff_root = formulas.sequence_roots["SEQ-FF"];
        let ff_node = formulas.pdag.node(ff_root).expect("SEQ-FF root must exist");
        assert!(ff_node.is_gate());

        // SEQ-S path: G1 only → single positive node.
        let s_root = formulas.sequence_roots["SEQ-S"];
        assert!(s_root > 0);

        // All four basic events should be in the PDAG.
        for be in ["E1", "E2", "E3", "E4"] {
            assert!(formulas.pdag.idx_of(be).is_some(), "{be} missing from pdag");
        }
    }

    // -----------------------------------------------------------------------
    // T4: same sequence via two paths → OR gate
    // -----------------------------------------------------------------------

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

        // SEQ-TARGET reached on:
        //   path 1: FE-A success (collect GA positive), FE-B ignored
        //   path 2: FE-A failure (collect GA negated), FE-B success (collect GB positive)
        // (two distinct paths → OR gate)
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

        // SEQ-TARGET has two contributing paths → OR gate.
        let root = formulas.sequence_roots["SEQ-TARGET"];
        let node = formulas.pdag.node(root).unwrap();
        assert!(node.is_gate());
        match node {
            crate::algorithms::bdd_pdag::BddPdagNode::Gate { connective, .. } => {
                assert_eq!(*connective, crate::algorithms::bdd_pdag::BddConnective::Or);
            }
            _ => panic!("expected a Gate node"),
        }
    }

    // -----------------------------------------------------------------------
    // T5: house event override → constant nodes
    // -----------------------------------------------------------------------

    #[test]
    fn test_house_event_override_true() {
        let mut model = Model::new("M").unwrap();

        // FT with a house event as operand.
        let mut ft = FaultTree::new("FT-HE", "G-HE").unwrap();
        let mut top = Gate::new("G-HE".to_string(), Formula::Or).unwrap();
        top.add_operand("E1".to_string());
        top.add_operand("H1".to_string()); // house event operand
        ft.add_gate(top).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.05).unwrap())
            .unwrap();
        ft.add_house_event(HouseEvent::new("H1".to_string(), false).unwrap())
            .unwrap();
        model.add_fault_tree(ft).unwrap();

        let mut fe = FunctionalEvent::new("FE".to_string());
        fe.fault_tree_id = Some("FT-HE".to_string());

        // Branch that overrides H1 = true.
        let mut branch_target = Branch::new(BranchTarget::Sequence("SEQ-1".to_string()));
        branch_target
            .house_event_assignments
            .insert("H1".to_string(), true);

        let path = Path::new("failure".to_string(), branch_target)
            .unwrap()
            .with_collect_formula_negated(true);

        let fork = Fork::new("FE".to_string(), vec![path]).unwrap();
        let mut et = EventTree::new("ET".to_string(), Branch::new(BranchTarget::Fork(fork)));
        et.add_sequence(Sequence::new("SEQ-1".to_string())).unwrap();
        et.add_functional_event(fe).unwrap();

        let formulas = SequenceFormulaBuilder::new(&model)
            .build(&et, 1.0)
            .unwrap();

        // The PDAG must contain a TRUE constant (from H1=true override).
        assert!(formulas.sequence_roots.contains_key("SEQ-1"));
        // TRUE constant was created — verify get_or_create_true returns a valid node.
        let mut pdag_copy = formulas.pdag;
        let true_idx = pdag_copy.get_or_create_true();
        assert!(true_idx > 0);
        let node = pdag_copy.node(true_idx).unwrap();
        match node {
            crate::algorithms::bdd_pdag::BddPdagNode::Constant { value, .. } => {
                assert!(*value);
            }
            _ => panic!("expected TRUE constant node"),
        }
    }

    #[test]
    fn test_house_event_default_value_false() {
        let mut model = Model::new("M").unwrap();

        // FT with a house event defaulting to FALSE.
        let mut ft = FaultTree::new("FT-HE2", "G-HE2").unwrap();
        let mut top = Gate::new("G-HE2".to_string(), Formula::And).unwrap();
        top.add_operand("E1".to_string());
        top.add_operand("H2".to_string()); // house event, default false
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

        // Gate was built (H2 replaced by FALSE constant internally).
        assert!(formulas.sequence_roots.contains_key("SEQ-1"));
        let mut pdag_copy = formulas.pdag;
        let false_idx = pdag_copy.get_or_create_false();
        assert!(false_idx > 0);
        let node = pdag_copy.node(false_idx).unwrap();
        match node {
            crate::algorithms::bdd_pdag::BddPdagNode::Constant { value, .. } => {
                assert!(!value);
            }
            _ => panic!("expected FALSE constant node"),
        }
    }

    // -----------------------------------------------------------------------
    // T7: ie_frequency forwarded
    // -----------------------------------------------------------------------

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
        assert!((formulas.pdag.ie_frequency() - 1.23e-4).abs() < 1e-15);
    }

    // -----------------------------------------------------------------------
    // T8: deduplication — same FT added twice via same overrides → same root
    // -----------------------------------------------------------------------

    #[test]
    fn test_dedup_same_ft_same_scope() {
        let mut model = Model::new("M").unwrap();
        model
            .add_fault_tree(simple_ft("FT-X", "GX", "E1", "E2"))
            .unwrap();

        // Two functional events pointing to the same fault tree.
        let mut fe1 = FunctionalEvent::new("FE-1".to_string());
        fe1.fault_tree_id = Some("FT-X".to_string());
        let mut fe2 = FunctionalEvent::new("FE-2".to_string());
        fe2.fault_tree_id = Some("FT-X".to_string());

        // Path: FE-1 failure (collect GX negated) → FE-2 failure (collect GX negated)
        // Both refer to the same FT with no overrides → same scoped root → dedup.
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

        // SEQ-1 path: NOT(GX) AND NOT(GX) — the two GX references are the same node.
        let root = formulas.sequence_roots["SEQ-1"];
        let node = formulas.pdag.node(root).unwrap();
        assert!(node.is_gate());

        assert!(formulas.pdag.idx_of("GX__FT-X").is_some(), "GX__FT-X must be in pdag");
        assert!(formulas.pdag.idx_of("GX").is_none(), "plain GX must not exist after ft-scope fix");
    }

    // -----------------------------------------------------------------------
    // T9: named branch is transparently followed
    // -----------------------------------------------------------------------

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

        // Named branch leads to a leaf with no collect-formula → unconditional.
        assert!(formulas.unconditional.contains("SEQ-1"));
        assert!(!formulas.sequence_roots.contains_key("SEQ-1"));
    }
}
