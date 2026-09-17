use std::collections::{HashMap, HashSet};

#[cfg(test)]
use tensorbayes::StateIndex;

use tensorbayes::{
    BayesianGraph, CompileHeuristic, CompiledJunctionTree, EvidenceBatch, ExecutionEngine, NodeId,
};

use crate::algorithms::bdd_engine::{Bdd, BddRef, BDD_FALSE, BDD_NULL, BDD_TRUE};
use crate::hcl::{HclBaseEvidence, HclEventBinding, HclEventBindings, HclUncertaintySettings};
use crate::{PraxisError, Result};

mod cpt_sampling;
mod numpy_rng;
mod quantiles;
mod sampling;
mod seismic;
mod statistics_normal;
use numpy_rng::NumpyRng;
use sampling::{sample_probabilities, validate_probability_distribution};

#[cfg(test)]
mod cpt_source_tests;
#[cfg(test)]
mod source_tests;

// HCL_MH: uq/basic_event_models.py::_lognormal_mu_sigma and
// engines/bdd_vec_shannon.py::_NameResolver. These apply to UQ only.
const PROBABILITY_FLOOR: f64 = 1e-15;
// HCL_MH exposes sample slicing in solve_top_event_vector/evaluate_bdd and
// defaults its vectorized BN oracle to chunks of 256 samples.
const SAMPLE_CHUNK_SIZE: usize = 256;

struct SampleChunk {
    start: usize,
    end: usize,
    tree: CompiledJunctionTree,
}

/// One shared sample population, evaluated in slices of the same BDD. FT draws
/// follow HCL_MH's Monte Carlo probability-vector builder; TensorBayes carries
/// each slice on its CPT batch axis. See uncertainty/SOURCE.md.
pub(crate) struct PreparedHclUncertainty {
    chunks: Vec<SampleChunk>,
    sample_count: usize,
    seed: u64,
    event_samples: HashMap<String, Vec<f64>>,
}

impl PreparedHclUncertainty {
    pub(crate) fn new(network: &BayesianGraph, settings: &HclUncertaintySettings) -> Result<Self> {
        Self::with_chunk_size(network, settings, SAMPLE_CHUNK_SIZE)
    }

    fn with_chunk_size(
        network: &BayesianGraph,
        settings: &HclUncertaintySettings,
        chunk_size: usize,
    ) -> Result<Self> {
        validate_hcl_uncertainty_settings(network, settings)?;
        assert!(chunk_size > 0);
        let sampled_network = cpt_sampling::sample_network(network, settings)?;
        let mut chunks = Vec::new();
        for start in (0..settings.sample_count).step_by(chunk_size) {
            let end = (start + chunk_size).min(settings.sample_count);
            let mut chunk_network = network.clone();
            for variable in sampled_network.variables() {
                if sampled_network.cpt_batch_size(variable.id())? == 1 {
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

        let mut ft_rng = NumpyRng::new(settings.seed);
        let mut event_samples = HashMap::new();
        for event in &settings.basic_event_distributions {
            let samples = sample_probabilities(
                &event.distribution,
                settings.sampler,
                settings.sample_count,
                &mut ft_rng,
            )?;
            if event_samples.insert(event.event.clone(), samples).is_some() {
                return Err(PraxisError::Hcl(format!(
                    "basic event '{}' has more than one uncertainty definition",
                    event.event
                )));
            }
        }

        Ok(Self {
            chunks,
            sample_count: settings.sample_count,
            seed: settings.seed,
            event_samples,
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
            if bindings.get(variable).is_some()
                && event.is_some_and(|event| self.event_samples.contains_key(event))
            {
                return Err(PraxisError::Hcl(format!(
                    "basic event '{}' is BN-bound; define uncertainty on its BN CPT row instead",
                    event.expect("checked as present")
                )));
            }
            let mut samples = event
                .and_then(|event| self.event_samples.get(event))
                .cloned()
                .unwrap_or_else(|| vec![nominal; self.sample_count]);
            // _NameResolver clips both sampled vectors and scalar fallbacks.
            samples.iter_mut().for_each(|probability| {
                *probability = probability.clamp(PROBABILITY_FLOOR, 1.0 - PROBABILITY_FLOOR);
            });
            probabilities.push(samples);
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

/// Validates HCL uncertainty inputs without constructing or evaluating a
/// sampled population. Transport validation can therefore remain complete
/// without duplicating execution work.
pub fn validate_hcl_uncertainty_settings(
    network: &BayesianGraph,
    settings: &HclUncertaintySettings,
) -> Result<()> {
    validate_settings(settings)?;
    network.validate()?;
    for variable in network.variables() {
        if network.cpt_batch_size(variable.id())? != 1 {
            return Err(PraxisError::Hcl(format!(
                "uncertainty input BN node '{}' must have a scalar CPT",
                variable.name()
            )));
        }
    }

    let mut events = HashSet::new();
    for event in &settings.basic_event_distributions {
        validate_probability_distribution(&event.distribution, settings.sampler)?;
        if !events.insert(&event.event) {
            return Err(PraxisError::Hcl(format!(
                "basic event '{}' has more than one uncertainty definition",
                event.event
            )));
        }
    }

    let mut rows = HashSet::new();
    let mut beta_states = HashMap::new();
    for row in &settings.cpt_row_distributions {
        let node = network.node_id(&row.node)?;
        if !rows.insert((node, row.row_index)) {
            return Err(PraxisError::Hcl(format!(
                "CPT row {} of BN node '{}' has more than one uncertainty definition",
                row.row_index, row.node
            )));
        }
        let variable = network.variable(node)?;
        cpt_sampling::validate_prior(&row.prior, variable.states())?;
        if let crate::hcl::HclCptPrior::Beta { true_state, .. } = &row.prior {
            if beta_states
                .insert(node, true_state)
                .is_some_and(|previous| previous != true_state)
            {
                return Err(PraxisError::Hcl(format!(
                    "Beta priors for BN node '{}' must use the same probability state",
                    row.node
                )));
            }
        }
        let row_count = network.family_size(node)? / variable.cardinality();
        if row.row_index >= row_count {
            return Err(PraxisError::Hcl(format!(
                "CPT row {} is out of range for BN node '{}'",
                row.row_index,
                variable.name()
            )));
        }
    }
    let mut generator_nodes = HashSet::new();
    for spec in &settings.cpt_generators {
        let node = network.node_id(&spec.node)?;
        if !generator_nodes.insert(node) || rows.iter().any(|(n, _)| *n == node) {
            return Err(PraxisError::Hcl(format!(
                "BN node '{}' must use either row priors or one generator",
                spec.node
            )));
        }
        seismic::validate_generator(network, spec)?;
    }
    Ok(())
}

fn validate_settings(settings: &HclUncertaintySettings) -> Result<()> {
    if !(10..=10_000).contains(&settings.sample_count) {
        return Err(PraxisError::Hcl(
            "HCL uncertainty sample count must be between 10 and 10000".to_string(),
        ));
    }
    if !settings.cpt_probability_clip_epsilon.is_finite()
        || !(0.0..0.5).contains(&settings.cpt_probability_clip_epsilon)
    {
        return Err(PraxisError::Hcl(
            "CPT probability clipping epsilon must be finite and in [0, 0.5)".into(),
        ));
    }
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
            let probability = binding
                .true_states()
                .iter()
                .map(|state| row[state.index()])
                .sum::<f64>()
                .clamp(0.0, 1.0);
            values.push(probability);
        }
        self.bn_cache.insert(key, values.clone());
        Ok(values)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::algorithms::bdd_engine::{Bdd, BddNode};
    use crate::hcl::{
        HclBasicEventUncertaintySpec, HclCptRowUncertaintySpec, HclProbabilityDistribution,
    };

    #[test]
    fn samples_cpt_rows_and_independent_events_reproducibly() {
        let mut graph = BayesianGraph::new();
        let node = graph.add_variable("N", &["F", "T"]).unwrap();
        graph.set_cpt(node, vec![0.8, 0.2]).unwrap();
        let settings = HclUncertaintySettings {
            cpt_generators: vec![],
            sampler: Default::default(),
            cpt_probability_clip_epsilon: 0.0,
            sample_count: 200,
            seed: 42,
            basic_event_distributions: vec![HclBasicEventUncertaintySpec {
                event: "E".to_string(),
                distribution: HclProbabilityDistribution::Beta {
                    alpha: 2.0,
                    beta: 8.0,
                },
            }],
            cpt_row_distributions: vec![HclCptRowUncertaintySpec {
                node: "N".to_string(),
                row_index: 0,
                prior: crate::hcl::HclCptPrior::Dirichlet {
                    alpha: vec![16.0, 4.0],
                },
            }],
        };
        let first = PreparedHclUncertainty::new(&graph, &settings).unwrap();
        let second = PreparedHclUncertainty::new(&graph, &settings).unwrap();
        assert_eq!(first.event_samples["E"], second.event_samples["E"]);
        assert_eq!(first.sample_count(), 200);
        assert_eq!(first.seed(), 42);
    }

    #[test]
    fn quantifies_a_sampled_unbound_bdd() {
        let mut graph = BayesianGraph::new();
        let node = graph.add_variable("N", &["F", "T"]).unwrap();
        graph.set_cpt(node, vec![0.8, 0.2]).unwrap();
        let settings = HclUncertaintySettings {
            cpt_generators: vec![],
            sampler: Default::default(),
            cpt_probability_clip_epsilon: 0.0,
            sample_count: 100,
            seed: 7,
            basic_event_distributions: vec![HclBasicEventUncertaintySpec {
                event: "E".to_string(),
                distribution: HclProbabilityDistribution::Uniform {
                    lower: 0.1,
                    upper: 0.3,
                },
            }],
            cpt_row_distributions: vec![],
        };
        let prepared = PreparedHclUncertainty::new(&graph, &settings).unwrap();
        let mut bdd = Bdd::new();
        let root = bdd.alloc_node(BddNode::new(0, BDD_TRUE, BDD_FALSE));
        bdd.set_var_probs(vec![0.2]);
        let samples = prepared
            .quantify(
                &bdd,
                root,
                HclEventBindings::new(),
                HclBaseEvidence::unobserved(1),
                &[Some("E".to_string())],
            )
            .unwrap();
        assert_eq!(samples.len(), 100);
        assert!(samples.iter().all(|sample| (0.1..0.3).contains(sample)));
    }
}

#[cfg(test)]
mod seismic_source_tests;
