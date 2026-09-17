//! Snapshot adaptation of HCL_MH/et/et_compiler.py::enumerate_paths:
//! carry the path into each transfer target's entry, and stop only at terminal
//! end states. PRAXIS's inherited sequence builder and BDD evaluate the logic.

use super::*;
use uuid::Uuid;

pub(super) struct LinkedEventTree {
    pub event_tree: EventTree,
    pub sequences: Vec<EventTreeSequenceSnapshot>,
    pub fault_trees: HashMap<String, String>,
}

struct Builder<'a> {
    snapshots: &'a HashMap<String, EventTreeSnapshot>,
    events: HashMap<String, FunctionalEvent>,
    sequences: Vec<EventTreeSequenceSnapshot>,
    fault_trees: HashMap<String, String>,
    tree_ids: HashSet<String>,
    tree_chain: Vec<String>,
    sequence_chain: Vec<EntityReference>,
    path: Vec<EventTreePathStep>,
}

pub(super) fn build(
    root: &str,
    snapshots: &HashMap<String, EventTreeSnapshot>,
) -> Result<LinkedEventTree> {
    let mut builder = Builder {
        snapshots,
        events: HashMap::new(),
        sequences: Vec::new(),
        fault_trees: HashMap::new(),
        tree_ids: HashSet::new(),
        tree_chain: Vec::new(),
        sequence_chain: Vec::new(),
        path: Vec::new(),
    };
    let initial = builder.tree(root)?;
    let mut event_tree = EventTree::new(root.to_string(), initial);
    for event in builder.events.into_values() {
        event_tree.add_functional_event(event)?;
    }
    for sequence in &builder.sequences {
        event_tree.add_sequence(Sequence::new(sequence.id.clone()))?;
    }
    event_tree.validate()?;
    Ok(LinkedEventTree {
        event_tree,
        sequences: builder.sequences,
        fault_trees: builder.fault_trees,
    })
}

impl Builder<'_> {
    fn tree(&mut self, id: &str) -> Result<Branch> {
        if self.tree_chain.iter().any(|tree| tree == id) {
            return Err(PraxisError::Logic(format!(
                "event-tree transfer loop reaches '{id}'"
            )));
        }
        let snapshot = self
            .snapshots
            .get(id)
            .ok_or_else(|| {
                PraxisError::Logic(format!("event-tree transfer model '{id}' is missing"))
            })?
            .clone();
        let mut events = snapshot.functional_events.clone();
        events.sort_by_key(|event| event.order);
        if events
            .iter()
            .enumerate()
            .any(|(order, event)| event.order != order)
        {
            return Err(PraxisError::Logic(
                "event-tree functional-event order must be contiguous from zero".into(),
            ));
        }
        if self.tree_ids.insert(id.to_string()) {
            let links: HashMap<_, _> = snapshot
                .functional_event_fault_tree_links
                .iter()
                .map(|link| (link.functional_event_id.as_str(), &link.fault_tree_top_gate))
                .collect();
            if links.len() != snapshot.functional_event_fault_tree_links.len() {
                return Err(PraxisError::Logic(
                    "event-tree contains duplicate functional-event fault-tree links".into(),
                ));
            }
            for event in &events {
                let link = links.get(event.id.as_str());
                if link.is_none()
                    && !snapshot.sequences.iter().all(|sequence| {
                        sequence.path.iter().any(|step| {
                            step.functional_event_id == event.id
                                && step.outcome == EventTreeBranchOutcome::Bypassed
                        })
                    })
                {
                    return Err(PraxisError::Logic(format!(
                        "functional event '{}' has no fault-tree top-gate link",
                        event.id
                    )));
                }
                let key = serde_json::to_string(&(id, &event.id)).unwrap();
                let mut core = FunctionalEvent::new(key.clone()).with_name(event.name.clone());
                if let Some(link) = link {
                    if let Some(top) = self
                        .fault_trees
                        .insert(link.model_id.clone(), link.entity_id.clone())
                    {
                        if top != link.entity_id {
                            return Err(PraxisError::Logic(format!(
                                "fault tree '{}' references inconsistent top gates",
                                link.model_id
                            )));
                        }
                    }
                    core = core.with_fault_tree(link.model_id.clone());
                }
                if self.events.insert(key, core).is_some() {
                    return Err(PraxisError::Logic(format!(
                        "duplicate functional event '{}'",
                        event.id
                    )));
                }
            }
        }
        self.tree_chain.push(id.to_string());
        let candidates: Vec<_> = snapshot.sequences.iter().collect();
        let result = self.branch(&snapshot, &events, &candidates, 0);
        self.tree_chain.pop();
        result
    }

    fn branch(
        &mut self,
        snapshot: &EventTreeSnapshot,
        events: &[FunctionalEventSnapshot],
        candidates: &[&EventTreeSequenceSnapshot],
        depth: usize,
    ) -> Result<Branch> {
        if depth == events.len() {
            if candidates.len() != 1 || candidates[0].path.len() != depth {
                return Err(PraxisError::Logic(
                    "event-tree path must resolve to exactly one complete sequence".into(),
                ));
            }
            let sequence = candidates[0];
            self.sequence_chain.push(EntityReference {
                model_id: snapshot.id.clone(),
                entity_id: sequence.id.clone(),
            });
            let result = match &sequence.result {
                EventTreeBranchResult::Transfer { target } => self.tree(&target.model_id),
                EventTreeBranchResult::EndState { end_state_id } => {
                    if !snapshot
                        .end_states
                        .iter()
                        .any(|state| &state.id == end_state_id)
                    {
                        return Err(PraxisError::Logic(format!(
                            "event-tree result resolves undeclared end state '{end_state_id}'"
                        )));
                    }
                    let id = if self.sequence_chain.len() == 1 {
                        sequence.id.clone()
                    } else {
                        Uuid::new_v5(
                            &Uuid::NAMESPACE_OID,
                            &serde_json::to_vec(&self.sequence_chain).unwrap(),
                        )
                        .to_string()
                    };
                    self.sequences.push(EventTreeSequenceSnapshot {
                        id: id.clone(),
                        path: self.path.clone(),
                        result: sequence.result.clone(),
                        sequence_chain: if self.sequence_chain.len() == 1 {
                            Vec::new()
                        } else {
                            self.sequence_chain.clone()
                        },
                    });
                    Ok(Branch::new(BranchTarget::Sequence(id)))
                }
            };
            self.sequence_chain.pop();
            return result;
        }
        let event = &events[depth];
        let mut paths = Vec::new();
        for (outcome, name) in [
            (EventTreeBranchOutcome::Success, "success"),
            (EventTreeBranchOutcome::Failure, "failure"),
            (EventTreeBranchOutcome::Bypassed, "bypass"),
        ] {
            let matching: Vec<_> = candidates
                .iter()
                .copied()
                .filter(|sequence| {
                    sequence.path.get(depth).is_some_and(|step| {
                        step.functional_event_id == event.id && step.outcome == outcome
                    })
                })
                .collect();
            if matching.is_empty() {
                continue;
            }
            self.path.push(EventTreePathStep {
                functional_event_id: event.id.clone(),
                outcome,
            });
            let branch = self.branch(snapshot, events, &matching, depth + 1)?;
            self.path.pop();
            let path = Path::new(name.to_string(), branch)?;
            paths.push(if outcome == EventTreeBranchOutcome::Bypassed {
                path.with_probability(1.0)
            } else {
                path.with_collect_formula_negated(outcome == EventTreeBranchOutcome::Success)
            });
        }
        let bypass = paths.iter().any(|path| path.state == "bypass");
        // Preserve HCL_MH's supplied edges. A single outcome still contributes
        // its Boolean condition through collect_formula_negated above.
        if paths.is_empty() || (bypass && paths.len() != 1) {
            return Err(PraxisError::Logic(format!(
                "functional event '{}' must define success and/or failure paths, or one bypass path",
                event.id
            )));
        }
        Ok(Branch::new(BranchTarget::Fork(Fork::new(
            serde_json::to_string(&(&snapshot.id, &event.id)).unwrap(),
            paths,
        )?)))
    }
}
