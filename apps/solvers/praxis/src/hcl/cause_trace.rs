use std::collections::HashMap;
use std::rc::Rc;

use tensorbayes::{BayesianGraph, CompiledJunctionTree, ExecutionEngine, NodeId, StateIndex};

use crate::hcl::context::{ContextSpace, PathContext};
use crate::hcl::{HclBaseEvidence, HclBindingSpec, HclEventBinding};
use crate::{PraxisError, Result};

#[derive(Clone, Debug, PartialEq)]
pub struct CauseShift {
    pub node: String,
    pub state: String,
    pub baseline: f64,
    pub with_cut_set: f64,
    pub distance: f64,
}

pub(crate) struct CauseTracer<'a> {
    network: &'a BayesianGraph,
    engine: ExecutionEngine,
    space: ContextSpace,
    bindings: HashMap<String, HclEventBinding>,
    bound: Vec<bool>,
    evidence: HclBaseEvidence,
    baseline: Vec<Vec<f64>>,
    posteriors: HashMap<PathContext, Rc<Vec<Vec<f64>>>>,
}

impl<'a> CauseTracer<'a> {
    pub(crate) fn new(
        network: &'a BayesianGraph,
        tree: CompiledJunctionTree,
        specs: &[HclBindingSpec],
        evidence: HclBaseEvidence,
    ) -> Result<Self> {
        let mut bindings = HashMap::with_capacity(specs.len());
        let mut bound = vec![false; network.num_variables()];
        for (index, spec) in specs.iter().enumerate() {
            let node = network.node_id(&spec.node)?;
            let names = network.variable(node)?.states();
            let mut states = Vec::with_capacity(spec.true_states.len());
            for state in &spec.true_states {
                let position = names.iter().position(|name| name == state).ok_or_else(|| {
                    PraxisError::Hcl(format!(
                        "binding state '{state}' does not exist on BN node '{}'",
                        spec.node
                    ))
                })?;
                states.push(StateIndex::new(position));
            }
            bound[node.index()] = true;
            bindings.insert(
                spec.event.clone(),
                HclEventBinding::new(index, node, states)?,
            );
        }
        let mut tracer = Self {
            network,
            engine: {
                let mut engine = ExecutionEngine::new(tree);
                engine.allow_zero_mass(true);
                engine
            },
            space: ContextSpace::new(network, evidence.states()),
            bindings,
            bound,
            evidence: evidence.clone(),
            baseline: Vec::new(),
            posteriors: HashMap::new(),
        };
        tracer.set_evidence(evidence)?;
        Ok(tracer)
    }

    pub(crate) fn set_evidence(&mut self, evidence: HclBaseEvidence) -> Result<()> {
        self.space.set_base(evidence.states());
        self.evidence = evidence;
        self.posteriors.clear();
        let empty = self.space.empty();
        self.baseline = self.marginals(&empty)?.ok_or_else(|| {
            PraxisError::Hcl("the evidence of a cause trace has zero probability".to_string())
        })?;
        Ok(())
    }

    fn marginals(&mut self, context: &PathContext) -> Result<Option<Vec<Vec<f64>>>> {
        self.engine.invalidate_workspace_cache();
        self.engine.clear_soft_evidence();
        for &restriction in context.iter() {
            let (node, allowed) = self.space.restriction(restriction);
            let likelihoods: Vec<f64> = allowed
                .iter()
                .map(|&is_allowed| if is_allowed { 1.0 } else { 0.0 })
                .collect();
            self.engine.set_soft_evidence(node, &likelihoods)?;
        }
        let batch = self.evidence.to_batch()?;
        let count = self.network.num_variables();
        let mut values = Vec::with_capacity(count);
        for index in 0..count {
            let node = NodeId::new(index as u32);
            let marginal = if index == 0 {
                self.engine.evaluate(&batch, node)?
            } else {
                self.engine.workspace().query_marginal(node)?
            };
            values.push(marginal.values().to_vec());
        }
        self.engine.clear_soft_evidence();
        if !self.engine.zero_mass_rows().is_empty() {
            return Ok(None);
        }
        Ok(Some(values))
    }

    pub(crate) fn shifts(&mut self, events: &[String], keep: usize) -> Result<Vec<CauseShift>> {
        let mut context = self.space.empty();
        for event in events {
            let Some(binding) = self.bindings.get(event) else {
                continue;
            };
            match self.space.extend(&context, binding, true) {
                Some(next) => context = next,
                None => return Ok(Vec::new()),
            }
        }
        if context.is_empty() {
            return Ok(Vec::new());
        }
        let posterior = match self.posteriors.get(&context) {
            Some(values) => Rc::clone(values),
            None => {
                let Some(values) = self.marginals(&context)? else {
                    return Ok(Vec::new());
                };
                let values = Rc::new(values);
                self.posteriors
                    .insert(PathContext::clone(&context), Rc::clone(&values));
                values
            }
        };
        let mut shifts = Vec::new();
        for index in 0..self.network.num_variables() {
            if self.bound[index] || self.evidence.states()[index] >= 0 {
                continue;
            }
            let node = NodeId::new(index as u32);
            let support = self.space.node_support(node);
            if self.space.project(support, &context).is_empty() {
                continue;
            }
            let before = &self.baseline[index];
            let after = &posterior[index];
            let mut distance = 0.0;
            let mut leading = 0;
            let mut largest = 0.0;
            for (state, (old, new)) in before.iter().zip(after.iter()).enumerate() {
                let change = (new - old).abs();
                distance += change;
                if change > largest {
                    largest = change;
                    leading = state;
                }
            }
            if distance == 0.0 {
                continue;
            }
            let variable = self.network.variable(node)?;
            shifts.push(CauseShift {
                node: variable.name().to_string(),
                state: variable.states()[leading].clone(),
                baseline: before[leading],
                with_cut_set: after[leading],
                distance: distance / 2.0,
            });
        }
        shifts.sort_by(|left, right| {
            right
                .distance
                .total_cmp(&left.distance)
                .then_with(|| left.node.cmp(&right.node))
        });
        shifts.truncate(keep);
        Ok(shifts)
    }
}
