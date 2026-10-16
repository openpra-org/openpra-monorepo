use praxis::algorithms::build::build_sequence_bdd;
use praxis::algorithms::pdag::PdagNode;
use praxis::analysis::event_tree_quantification::{
    EventTreeBddDiagnostics, EventTreeSequenceDiagnostics, EventTreeSequenceProbability,
};
use praxis::analysis::sequence_formula::{SequenceFormulaBuilder, SequenceFormulas};
use praxis::Result;
use serde::Deserialize;

use super::EventTreeAdapter;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub(super) enum SuccessTreatmentInput {
    Complement,
    DeleteTerm,
    Unity,
}

pub(super) fn sequence_formulas(
    adapter: &EventTreeAdapter,
    treatment: SuccessTreatmentInput,
) -> Result<SequenceFormulas> {
    SequenceFormulaBuilder::new(&adapter.model)
        .with_complement_unity(treatment == SuccessTreatmentInput::Unity)
        .with_delete_term(treatment == SuccessTreatmentInput::DeleteTerm)
        .build(&adapter.event_tree, 1.0)
}

pub(super) fn sequence_ids(adapter: &EventTreeAdapter) -> Vec<String> {
    let mut ids: Vec<String> = adapter.event_tree.sequences.keys().cloned().collect();
    ids.sort();
    ids
}

pub(super) fn probabilities(
    adapter: &EventTreeAdapter,
    treatment: SuccessTreatmentInput,
) -> Result<Vec<EventTreeSequenceProbability>> {
    let SequenceFormulas {
        mut pdag,
        sequence_roots,
        unconditional,
        event_probs,
        ..
    } = sequence_formulas(adapter, treatment)?;
    let mut probabilities = Vec::new();
    for sequence_id in sequence_ids(adapter) {
        let (conditional_probability, bdd) = if unconditional.contains(&sequence_id) {
            (1.0, None)
        } else if let Some(&root) = sequence_roots.get(&sequence_id) {
            pdag.set_root(root)?;
            let (order, diagram, diagram_root) = build_sequence_bdd(&pdag, &event_probs)?;
            let variable_order = order
                .iter()
                .filter_map(|index| match pdag.get_node(*index) {
                    Some(PdagNode::BasicEvent { id, .. }) => Some(id.clone()),
                    _ => None,
                })
                .collect();
            (
                diagram.probability(diagram_root),
                Some(EventTreeBddDiagnostics {
                    nodes: diagram.node_count(),
                    variables: diagram.variable_count(),
                    variable_order,
                }),
            )
        } else {
            (0.0, None)
        };
        probabilities.push(EventTreeSequenceProbability {
            sequence_id,
            conditional_probability,
            uncertainty: None,
            uncertainty_samples: None,
            diagnostics: EventTreeSequenceDiagnostics {
                bdd,
                bridge: None,
                junction_tree: None,
            },
        });
    }
    Ok(probabilities)
}
