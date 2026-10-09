use std::collections::{HashMap, HashSet};

#[cfg(test)]
use tensorbayes::StateIndex;

use tensorbayes::{
    BayesianGraph, CompileHeuristic, CompiledJunctionTree, EvidenceBatch, ExecutionEngine, NodeId,
};

use crate::algorithms::bdd_engine::{Bdd, BddRef, BDD_FALSE, BDD_NULL, BDD_TRUE};
use crate::core::fault_tree::FaultTree;
use crate::hcl::{HclBaseEvidence, HclEventBinding, HclEventBindings, HclUncertaintySettings};
use crate::{PraxisError, Result};

mod population;
use population::Plan;

#[cfg(test)]
mod statistical_checks;
#[cfg(test)]
mod cpt_source_tests;
#[cfg(test)]
mod seismic_source_tests;
#[cfg(test)]
mod source_tests;

const SAMPLE_CHUNK_SIZE: usize = 256;

struct SampleChunk {
    start: usize,
    end: usize,
    tree: CompiledJunctionTree,
}

pub(crate) struct PreparedHclUncertainty {
    chunks: Vec<SampleChunk>,
    sample_count: usize,
    seed: u64,
    event_samples: HashMap<String, Vec<f64>>,
    overrides: HashSet<String>,
}

impl PreparedHclUncertainty {
    pub(crate) fn new(
        network: &BayesianGraph,
        settings: &HclUncertaintySettings,
        sources: &[&FaultTree],
    ) -> Result<Self> {
        Self::with_chunk_size(network, settings, sources, SAMPLE_CHUNK_SIZE)
    }

    fn with_chunk_size(
        network: &BayesianGraph,
        settings: &HclUncertaintySettings,
        sources: &[&FaultTree],
        chunk_size: usize,
    ) -> Result<Self> {
        validate_network(network, settings)?;
        if chunk_size == 0 {
            return Err(PraxisError::Logic(
                "HCL uncertainty needs a positive sample chunk size".to_string(),
            ));
        }
        let population = Plan::new(network, settings, sources)?.draw(network, settings)?;
        let mut chunks = Vec::new();
        for start in (0..settings.sample_count).step_by(chunk_size) {
            let end = (start + chunk_size).min(settings.sample_count);
            let mut chunk_network = network.clone();
            for variable in population.network.variables() {
                if population.network.cpt_batch_size(variable.id())? == 1 {
                    continue;
                }
                let values = variable
                    .cpt()
                    .chunks_exact(settings.sample_count)
                    .flat_map(|family| family[start..end].iter().copied())
                    .collect();
                chunk_network.set_cpt(variable.id(), values)?;
            }
            chunks.push(SampleChunk {
                start,
                end,
                tree: CompiledJunctionTree::compile(chunk_network, CompileHeuristic::MinFill)?,
            });
        }
        Ok(Self {
            chunks,
            sample_count: settings.sample_count,
            seed: settings.seed,
            event_samples: population.event_samples,
            overrides: population.overrides,
        })
    }

    pub(crate) fn sample_count(&self) -> usize {
        self.sample_count
    }

    pub(crate) fn seed(&self) -> u64 {
        self.seed
    }

    pub(crate) fn quantify(
        &self,
        bdd: &Bdd,
        root: BddRef,
        bindings: HclEventBindings,
        base_evidence: HclBaseEvidence,
        event_by_variable: &[Option<String>],
    ) -> Result<Vec<f64>> {
        let mut probabilities = Vec::with_capacity(bdd.variable_count());
        for variable in 0..bdd.variable_count() {
            let nominal = bdd.var_probs().get(variable).copied().ok_or_else(|| {
                PraxisError::Hcl(format!(
                    "BDD variable {variable} has no nominal probability for uncertainty propagation"
                ))
            })?;
            let event = event_by_variable.get(variable).and_then(Option::as_ref);
            if let Some(event) = event {
                if bindings.get(variable).is_some() && self.overrides.contains(event) {
                    return Err(PraxisError::Hcl(format!(
                        "basic event '{}' is BN-bound; define uncertainty on its BN CPT row instead",
                        event
                    )));
                }
            }
            probabilities.push(
                event
                    .and_then(|event| self.event_samples.get(event))
                    .cloned()
                    .unwrap_or_else(|| vec![nominal; self.sample_count]),
            );
        }
        let mut samples = Vec::with_capacity(self.sample_count);
        for chunk in &self.chunks {
            let slice = probabilities
                .iter()
                .map(|values| values[chunk.start..chunk.end].to_vec())
                .collect();
            samples.extend(
                BatchedHclQuantifier::new(
                    bdd,
                    chunk.tree.clone(),
                    bindings.clone(),
                    base_evidence.clone(),
                    slice,
                    chunk.end - chunk.start,
                )?
                .quantify(root)?,
            );
        }
        Ok(samples)
    }
}

fn validate_network(network: &BayesianGraph, settings: &HclUncertaintySettings) -> Result<()> {
    if !(10..=10_000).contains(&settings.sample_count) {
        return Err(PraxisError::Hcl(
            "HCL uncertainty sample count must be between 10 and 10000".to_string(),
        ));
    }
    network.validate()?;
    for variable in network.variables() {
        if network.cpt_batch_size(variable.id())? != 1 {
            return Err(PraxisError::Hcl(format!(
                "uncertainty input BN node '{}' must have a scalar CPT",
                variable.name()
            )));
        }
    }
    Ok(())
}

pub fn validate_hcl_uncertainty_settings(
    network: &BayesianGraph,
    settings: &HclUncertaintySettings,
) -> Result<()> {
    validate_network(network, settings)?;
    Plan::new(network, settings, &[])?;
    Ok(())
}

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
struct EvidenceContext {
    allowed: Vec<Option<Vec<bool>>>,
    cardinalities: Vec<usize>,
}

impl EvidenceContext {
    fn from_base(tree: &CompiledJunctionTree, base: &HclBaseEvidence) -> Result<Self> {
        if base.states().len() != tree.graph().num_variables() {
            return Err(PraxisError::Hcl(
                "uncertainty evidence width does not match the BN".to_string(),
            ));
        }
        let mut allowed = vec![None; tree.graph().num_variables()];
        let cardinalities = tree
            .graph()
            .variables()
            .iter()
            .map(|variable| variable.cardinality())
            .collect::<Vec<_>>();
        for variable in tree.graph().variables() {
            let state = base.states()[variable.id().index()];
            if state >= 0 {
                if state as usize >= variable.cardinality() {
                    return Err(PraxisError::Hcl(format!(
                        "uncertainty evidence state {state} is invalid for BN node '{}'",
                        variable.name()
                    )));
                }
                let mut mask = vec![false; variable.cardinality()];
                mask[state as usize] = true;
                allowed[variable.id().index()] = Some(mask);
            }
        }
        Ok(Self {
            allowed,
            cardinalities,
        })
    }

    fn extend(&self, binding: &HclEventBinding, event_occurs: bool) -> Option<Self> {
        let node_index = binding.bn_node().index();
        let mut branch_mask = vec![!event_occurs; self.cardinalities[node_index]];
        for state in binding.true_states() {
            branch_mask[state.index()] = event_occurs;
        }
        if let Some(existing) = &self.allowed[node_index] {
            for (allowed, was_allowed) in branch_mask.iter_mut().zip(existing) {
                *allowed &= *was_allowed;
            }
        }
        if !branch_mask.iter().any(|allowed| *allowed) {
            return None;
        }
        let mut extended = self.clone();
        extended.allowed[node_index] = Some(branch_mask);
        Some(extended)
    }
}

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
struct BddContextKey {
    node: BddRef,
    context: EvidenceContext,
}

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
struct BnQueryKey {
    variable: usize,
    context: EvidenceContext,
}

struct BatchedHclQuantifier<'a> {
    bdd: &'a Bdd,
    engine: ExecutionEngine,
    bindings: HclEventBindings,
    evidence: EvidenceBatch,
    initial_context: EvidenceContext,
    event_probabilities: Vec<Vec<f64>>,
    sample_count: usize,
    bdd_cache: HashMap<BddContextKey, Vec<f64>>,
    bn_cache: HashMap<BnQueryKey, Vec<f64>>,
}

impl<'a> BatchedHclQuantifier<'a> {
    fn new(
        bdd: &'a Bdd,
        tree: CompiledJunctionTree,
        bindings: HclEventBindings,
        base: HclBaseEvidence,
        event_probabilities: Vec<Vec<f64>>,
        sample_count: usize,
    ) -> Result<Self> {
        for binding in bindings.iter() {
            if binding.bdd_variable() >= bdd.variable_count() {
                return Err(PraxisError::Hcl(
                    "uncertainty binding references an unknown BDD variable".to_string(),
                ));
            }
            let variable = tree.graph().variable(binding.bn_node())?;
            if binding.true_states().is_empty()
                || binding.true_states().len() >= variable.cardinality()
            {
                return Err(PraxisError::Hcl(
                    "uncertainty binding must define a non-empty proper BN state subset"
                        .to_string(),
                ));
            }
        }
        let initial_context = EvidenceContext::from_base(&tree, &base)?;
        let rows = vec![base.states().to_vec(); sample_count];
        let evidence = EvidenceBatch::from_rows(&rows)?;
        Ok(Self {
            bdd,
            engine: ExecutionEngine::new(tree),
            bindings,
            evidence,
            initial_context,
            event_probabilities,
            sample_count,
            bdd_cache: HashMap::new(),
            bn_cache: HashMap::new(),
        })
    }

    fn quantify(&mut self, root: BddRef) -> Result<Vec<f64>> {
        if root == BDD_NULL {
            return Err(PraxisError::Hcl(
                "cannot quantify the null BDD reference".to_string(),
            ));
        }
        self.recurse(root, &self.initial_context.clone())
    }

    fn recurse(&mut self, reference: BddRef, context: &EvidenceContext) -> Result<Vec<f64>> {
        if reference == BDD_TRUE {
            return Ok(vec![1.0; self.sample_count]);
        }
        if reference == BDD_FALSE {
            return Ok(vec![0.0; self.sample_count]);
        }
        if reference.is_complement() {
            let mut values = self.recurse(reference.regular(), context)?;
            values.iter_mut().for_each(|value| *value = 1.0 - *value);
            return Ok(values);
        }
        let key = BddContextKey {
            node: reference,
            context: context.clone(),
        };
        if let Some(values) = self.bdd_cache.get(&key) {
            return Ok(values.clone());
        }
        let node = *self.bdd.node(reference);
        let probabilities = if let Some(binding) = self.bindings.get(node.var).cloned() {
            self.conditional_event_probabilities(&binding, context)?
        } else {
            self.event_probabilities
                .get(node.var)
                .cloned()
                .ok_or_else(|| {
                    PraxisError::Hcl(format!(
                        "unbound BDD variable {} has no uncertainty population",
                        node.var
                    ))
                })?
        };
        let high = match self.bindings.get(node.var).cloned() {
            Some(binding) => match context.extend(&binding, true) {
                Some(next) => self.recurse(node.high, &next)?,
                None => vec![0.0; self.sample_count],
            },
            None => self.recurse(node.high, context)?,
        };
        let low = match self.bindings.get(node.var).cloned() {
            Some(binding) => match context.extend(&binding, false) {
                Some(next) => self.recurse(node.low, &next)?,
                None => vec![0.0; self.sample_count],
            },
            None => self.recurse(node.low, context)?,
        };
        let values = probabilities
            .iter()
            .zip(high.iter().zip(low.iter()))
            // HCL_MH: bdd_vec_shannon.py::_fused_shannon.
            .map(|(probability, (high, low))| low + probability * (high - low))
            .collect::<Vec<_>>();
        self.bdd_cache.insert(key, values.clone());
        Ok(values)
    }

    fn conditional_event_probabilities(
        &mut self,
        binding: &HclEventBinding,
        context: &EvidenceContext,
    ) -> Result<Vec<f64>> {
        let key = BnQueryKey {
            variable: binding.bdd_variable(),
            context: context.clone(),
        };
        if let Some(values) = self.bn_cache.get(&key) {
            return Ok(values.clone());
        }
        self.engine.clear_soft_evidence();
        for (node_index, allowed) in context.allowed.iter().enumerate() {
            let Some(allowed) = allowed else { continue };
            let node = NodeId::new(u32::try_from(node_index).map_err(|_| {
                PraxisError::Hcl("BN node index exceeds supported range".to_string())
            })?);
            let likelihoods = allowed
                .iter()
                .map(|allowed| if *allowed { 1.0 } else { 0.0 })
                .collect::<Vec<_>>();
            self.engine.set_soft_evidence(node, &likelihoods)?;
        }
        let marginal = self.engine.evaluate(&self.evidence, binding.bn_node())?;
        let mut values = Vec::with_capacity(self.sample_count);
        for sample in 0..self.sample_count {
            let row = marginal.row(sample).ok_or_else(|| {
                PraxisError::Hcl("TensorBayes omitted an uncertainty sample".to_string())
            })?;
            let true_mass: f64 = binding
                .true_states()
                .iter()
                .map(|state| row[state.index()])
                .sum();
            let total: f64 = row.iter().sum();
            if !(total > 0.0 && total.is_finite()) {
                return Err(PraxisError::Hcl(format!(
                    "BN node marginal has no finite mass in uncertainty sample {}",
                    sample + 1
                )));
            }
            values.push(true_mass / total);
        }
        self.bn_cache.insert(key, values.clone());
        Ok(values)
    }
}

