use std::collections::HashMap;

use praxis::analysis::event_tree_quantification::{
    EventTreeSequenceDiagnostics, EventTreeSequenceProbability,
};
use praxis::core::event_tree::{Branch, BranchTarget, EventTree, Fork, InitiatingEvent, Path};
use praxis::mc::core::ConvergenceSettings;
use praxis::mc::DpEventTreeMonteCarloAnalysis;
use praxis::{PraxisError, Result};
use serde::Deserialize;
use serde_json::{json, Value};

use super::{event_tree_result_json, EventTreeAdapter};

fn default_convergence_delta() -> f64 {
    0.1
}

fn default_confidence_level() -> f64 {
    0.95
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct MonteCarloInput {
    trials: usize,
    seed: u64,
    #[serde(default)]
    early_stop: bool,
    #[serde(default = "default_convergence_delta")]
    convergence_delta: f64,
    #[serde(default = "default_confidence_level")]
    confidence_level: f64,
    #[serde(default)]
    burn_in_trials: u64,
}

impl MonteCarloInput {
    pub(super) fn validate(&self) -> Result<()> {
        if self.trials == 0 {
            return Err(PraxisError::Settings(
                "a Monte Carlo run needs at least one trial".to_string(),
            ));
        }
        if !(self.convergence_delta.is_finite() && self.convergence_delta > 0.0) {
            return Err(PraxisError::Settings(
                "the relative error target must be above zero".to_string(),
            ));
        }
        if !(self.confidence_level > 0.0 && self.confidence_level < 1.0) {
            return Err(PraxisError::Settings(
                "the confidence must lie between 0 and 1".to_string(),
            ));
        }
        Ok(())
    }
}

fn without_bypass_forks(branch: &Branch) -> Branch {
    let BranchTarget::Fork(fork) = &branch.target else {
        return branch.clone();
    };
    if let [path] = fork.paths.as_slice() {
        if path.collect_formula_negated.is_none() {
            let mut inner = without_bypass_forks(&path.branch);
            let mut instructions = branch.instructions.clone();
            instructions.append(&mut inner.instructions);
            inner.instructions = instructions;
            for (id, state) in &branch.house_event_assignments {
                inner
                    .house_event_assignments
                    .entry(id.clone())
                    .or_insert(*state);
            }
            return inner;
        }
    }
    let paths = fork
        .paths
        .iter()
        .map(|path| Path {
            state: path.state.clone(),
            probability: path.probability,
            collect_formula_negated: path.collect_formula_negated,
            branch: without_bypass_forks(&path.branch),
        })
        .collect();
    Branch {
        instructions: branch.instructions.clone(),
        house_event_assignments: branch.house_event_assignments.clone(),
        target: BranchTarget::Fork(Fork {
            functional_event_id: fork.functional_event_id.clone(),
            paths,
        }),
    }
}

pub(super) fn execute(adapter: &EventTreeAdapter, input: &MonteCarloInput) -> Result<Value> {
    let event_tree = EventTree {
        id: adapter.event_tree.id.clone(),
        name: adapter.event_tree.name.clone(),
        initial_state: without_bypass_forks(&adapter.event_tree.initial_state),
        sequences: adapter.event_tree.sequences.clone(),
        functional_events: adapter.event_tree.functional_events.clone(),
        named_branches: adapter.event_tree.named_branches.clone(),
    };
    let initiator = InitiatingEvent::new(adapter.model_id.clone())
        .with_probability(1.0)
        .with_frequency(adapter.initiating_event_frequency);
    let analysis = DpEventTreeMonteCarloAnalysis::new(
        initiator,
        event_tree,
        &adapter.model,
        Some(input.seed),
        input.trials,
    )?;
    let result = analysis.run_cpu_with_watch_and_convergence(
        false,
        ConvergenceSettings {
            enabled: input.early_stop,
            delta: input.convergence_delta,
            confidence: input.confidence_level,
            burn_in: input.burn_in_trials,
        },
    )?;
    let by_sequence: HashMap<&str, (f64, usize)> = result
        .sequences
        .iter()
        .map(|sequence| {
            (
                sequence.sequence.id.as_str(),
                (sequence.probability_estimate, sequence.successes),
            )
        })
        .collect();
    let probabilities: Vec<EventTreeSequenceProbability> = adapter
        .snapshot
        .sequences
        .iter()
        .map(|sequence| EventTreeSequenceProbability {
            sequence_id: sequence.id.clone(),
            conditional_probability: by_sequence
                .get(sequence.id.as_str())
                .map_or(0.0, |(estimate, _)| *estimate),
            uncertainty: None,
            uncertainty_samples: None,
            diagnostics: EventTreeSequenceDiagnostics {
                bdd: None,
                bridge: None,
                junction_tree: None,
            },
        })
        .collect();
    let mut value = event_tree_result_json(adapter, &probabilities, &[], None)?;
    if let Some(sequences) = value["sequences"].as_array_mut() {
        for sequence in sequences.iter_mut() {
            let successes = sequence["sequenceId"]
                .as_str()
                .and_then(|id| by_sequence.get(id))
                .map_or(0, |(_, successes)| *successes);
            sequence["monteCarlo"] = json!({
                "successes": successes,
                "trials": result.num_trials,
            });
        }
    }
    value["monteCarlo"] = json!({
        "trials": result.num_trials,
        "requestedTrials": input.trials,
        "seed": input.seed,
        "stoppedEarly": result.num_trials < input.trials,
    });
    Ok(value)
}
