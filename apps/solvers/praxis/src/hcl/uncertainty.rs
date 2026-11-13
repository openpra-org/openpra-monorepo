use std::collections::{HashMap, HashSet};

#[cfg(test)]
use tensorbayes::StateIndex;

use tensorbayes::{
    BayesianGraph, CompileHeuristic, CompiledJunctionTree, EvidenceBatch, ExecutionEngine, NodeId,
};

use crate::algorithms::bdd_engine::{Bdd, BddRef, BDD_FALSE, BDD_NULL, BDD_TRUE};
use crate::core::fault_tree::FaultTree;
use crate::hcl::context::{ContextSpace, PathContext};
use crate::hcl::{
    HclBaseEvidence, HclEventBinding, HclEventBindings, HclUncertaintyAdjustments,
    HclUncertaintySettings, HclUncertaintySummary, HclZeroContexts,
};
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
    zero_contexts: HclZeroContexts,
    adjustments: HclUncertaintyAdjustments,
}

#[derive(Clone, Debug)]
pub(crate) struct ConditionalSamples {
    pub(crate) probability: Vec<f64>,
    pub(crate) occurred: Vec<f64>,
    pub(crate) not_occurred: Vec<f64>,
}

#[derive(Clone, Debug)]
pub(crate) struct SampledConditionals {
    pub(crate) total: Vec<f64>,
    pub(crate) inside: Vec<ConditionalSamples>,
    pub(crate) outside: Vec<ConditionalSamples>,
}

#[derive(Debug)]
pub(crate) struct UncertainSamples {
    pub(crate) values: Vec<f64>,
    pub(crate) adjustments: HclUncertaintyAdjustments,
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
            zero_contexts: settings.zero_probability_contexts,
            adjustments: HclUncertaintyAdjustments {
                clipped_probabilities: population.clipped_probabilities,
                epsilon_adjusted_cpt_values: population.epsilon_adjusted_cpt_values,
                zero_probability_contexts: 0,
            },
        })
    }

    pub(crate) fn adjustments(&self) -> HclUncertaintyAdjustments {
        self.adjustments
    }

    pub(crate) fn summarize(&self, samples: &UncertainSamples) -> Result<HclUncertaintySummary> {
        Ok(HclUncertaintySummary::from_samples(&samples.values, self.seed)?.with_adjustments(samples.adjustments))
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
    ) -> Result<UncertainSamples> {
        let probabilities = self.populations(bdd, &bindings, event_by_variable)?;
        let mut samples = Vec::with_capacity(self.sample_count);
        let mut zeroed = 0;
        for chunk in &self.chunks {
            let slice = probabilities
                .iter()
                .map(|values| values[chunk.start..chunk.end].to_vec())
                .collect();
            let mut quantifier = BatchedHclQuantifier::new(
                bdd,
                chunk,
                bindings.clone(),
                base_evidence.clone(),
                slice,
                self.zero_contexts,
            )?;
            samples.extend(quantifier.quantify(root)?);
            zeroed += quantifier.zeroed;
        }
        Ok(UncertainSamples {
            values: samples,
            adjustments: self.adjustments.with_zero_contexts(zeroed),
        })
    }

    pub(crate) fn conditionals(
        &self,
        bdd: &Bdd,
        root: BddRef,
        bindings: HclEventBindings,
        base_evidence: HclBaseEvidence,
        event_by_variable: &[Option<String>],
        inside: &[usize],
        outside: &[HclEventBinding],
    ) -> Result<SampledConditionals> {
        let probabilities = self.populations(bdd, &bindings, event_by_variable)?;
        let empty = || ConditionalSamples {
            probability: Vec::with_capacity(self.sample_count),
            occurred: Vec::with_capacity(self.sample_count),
            not_occurred: Vec::with_capacity(self.sample_count),
        };
        let mut result = SampledConditionals {
            total: Vec::with_capacity(self.sample_count),
            inside: inside.iter().map(|_| empty()).collect(),
            outside: outside.iter().map(|_| empty()).collect(),
        };
        for chunk in &self.chunks {
            let slice = probabilities
                .iter()
                .map(|values| values[chunk.start..chunk.end].to_vec())
                .collect();
            let mut quantifier = BatchedHclQuantifier::new(
                bdd,
                chunk,
                bindings.clone(),
                base_evidence.clone(),
                slice,
                self.zero_contexts,
            )?;
            result.total.extend(quantifier.quantify(root)?);
            quantifier.engine.allow_zero_mass(true);
            for (target, &variable) in result.inside.iter_mut().zip(inside) {
                if variable >= bdd.variable_count() {
                    return Err(PraxisError::Hcl(format!(
                        "BDD variable {variable} does not exist"
                    )));
                }
                let (probability, occurred, not_occurred) =
                    match quantifier.bindings.get(variable).cloned() {
                        Some(binding) => quantifier.conditional_on_binding(root, &binding)?,
                        None => quantifier.conditional_on_variable(root, variable)?,
                    };
                target.probability.extend(probability);
                target.occurred.extend(occurred);
                target.not_occurred.extend(not_occurred);
            }
            for (target, binding) in result.outside.iter_mut().zip(outside) {
                let (probability, occurred, not_occurred) =
                    quantifier.conditional_on_binding(root, binding)?;
                target.probability.extend(probability);
                target.occurred.extend(occurred);
                target.not_occurred.extend(not_occurred);
            }
        }
        Ok(result)
    }

    pub(crate) fn evidence_weights(
        &self,
        base: &HclBaseEvidence,
        rows: &[HclBaseEvidence],
    ) -> Result<Vec<Vec<f64>>> {
        let mut weights = vec![Vec::with_capacity(self.sample_count); rows.len()];
        for chunk in &self.chunks {
            let size = chunk.end - chunk.start;
            let order = crate::hcl::hazard::topological_order(chunk.tree.graph())?;
            let mut engine = ExecutionEngine::new(chunk.tree.clone());
            engine.allow_zero_mass(true);
            for (row, target) in rows.iter().enumerate() {
                let mut states = base.states().to_vec();
                let mut weight = vec![1.0; size];
                let mut possible = true;
                for &node in &order {
                    let wanted = target.states()[node.index()];
                    if wanted < 0 {
                        continue;
                    }
                    let fixed = states[node.index()];
                    if fixed >= 0 {
                        if fixed != wanted {
                            possible = false;
                            break;
                        }
                        continue;
                    }
                    let batch = EvidenceBatch::from_rows(&vec![states.clone(); size])?;
                    let marginal = engine.evaluate(&batch, node)?;
                    let empty: HashSet<usize> = engine.zero_mass_rows().iter().copied().collect();
                    for (sample, value) in weight.iter_mut().enumerate() {
                        if empty.contains(&sample) {
                            *value = 0.0;
                            continue;
                        }
                        let values = marginal.row(sample).ok_or_else(|| {
                            PraxisError::Hcl("TensorBayes omitted an uncertainty sample".to_string())
                        })?;
                        let total: f64 = values.iter().sum();
                        *value *= if total > 0.0 {
                            (values[wanted as usize] / total).clamp(0.0, 1.0)
                        } else {
                            0.0
                        };
                    }
                    states[node.index()] = wanted;
                }
                if !possible {
                    weight = vec![0.0; size];
                }
                weights[row].extend(weight);
            }
        }
        Ok(weights)
    }

    fn populations(
        &self,
        bdd: &Bdd,
        bindings: &HclEventBindings,
        event_by_variable: &[Option<String>],
    ) -> Result<Vec<Vec<f64>>> {
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
        Ok(probabilities)
    }
}

fn validate_network(network: &BayesianGraph, settings: &HclUncertaintySettings) -> Result<()> {
    if settings.sample_count < 2 {
        return Err(PraxisError::Hcl(
            "HCL uncertainty needs at least 2 samples".to_string(),
        ));
    }
    if !(settings.cpt_clip_epsilon.is_finite() && (0.0..0.5).contains(&settings.cpt_clip_epsilon)) {
        return Err(PraxisError::Hcl(format!(
            "the CPT epsilon must be at least 0 and below 0.5, not {}",
            settings.cpt_clip_epsilon
        )));
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

fn validate_base_evidence(tree: &CompiledJunctionTree, base: &HclBaseEvidence) -> Result<()> {
    if base.states().len() != tree.graph().num_variables() {
        return Err(PraxisError::Hcl(
            "uncertainty evidence width does not match the BN".to_string(),
        ));
    }
    for variable in tree.graph().variables() {
        let state = base.states()[variable.id().index()];
        if state >= 0 && state as usize >= variable.cardinality() {
            return Err(PraxisError::Hcl(format!(
                "uncertainty evidence state {state} is invalid for BN node '{}'",
                variable.name()
            )));
        }
    }
    Ok(())
}

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
struct BddContextKey {
    node: BddRef,
    context: PathContext,
}

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
struct BnQueryKey {
    variable: usize,
    context: PathContext,
}

struct BatchedHclQuantifier<'a> {
    bdd: &'a Bdd,
    engine: ExecutionEngine,
    bindings: HclEventBindings,
    evidence: EvidenceBatch,
    space: ContextSpace,
    event_probabilities: Vec<Vec<f64>>,
    first_sample: usize,
    sample_count: usize,
    bdd_cache: HashMap<BddContextKey, Vec<f64>>,
    bn_cache: HashMap<BnQueryKey, Vec<f64>>,
    forced: Option<(usize, bool)>,
    forced_cache: HashMap<BddContextKey, Vec<f64>>,
    zeroed: usize,
}

type ConditionalTriple = (Vec<f64>, Vec<f64>, Vec<f64>);

impl<'a> BatchedHclQuantifier<'a> {
    fn new(
        bdd: &'a Bdd,
        chunk: &SampleChunk,
        bindings: HclEventBindings,
        base: HclBaseEvidence,
        event_probabilities: Vec<Vec<f64>>,
        zero_contexts: HclZeroContexts,
    ) -> Result<Self> {
        let tree = chunk.tree.clone();
        let first_sample = chunk.start;
        let sample_count = chunk.end - chunk.start;
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
        validate_base_evidence(&tree, &base)?;
        let space = ContextSpace::new(tree.graph(), base.states());
        let rows = vec![base.states().to_vec(); sample_count];
        let evidence = EvidenceBatch::from_rows(&rows)?;
        let mut engine = ExecutionEngine::new(tree);
        let zero_allowed = zero_contexts == HclZeroContexts::Zero;
        engine.allow_zero_mass(zero_allowed);
        if zero_allowed && base.states().iter().any(|state| *state >= 0) {
            engine.evaluate(&evidence, NodeId::new(0))?;
            if let Some(sample) = engine.zero_mass_rows().first() {
                return Err(PraxisError::Hcl(format!(
                    "the base evidence has zero probability in uncertainty sample {}",
                    first_sample + sample + 1
                )));
            }
        }
        Ok(Self {
            bdd,
            engine,
            bindings,
            evidence,
            space,
            event_probabilities,
            first_sample,
            sample_count,
            bdd_cache: HashMap::new(),
            bn_cache: HashMap::new(),
            forced: None,
            forced_cache: HashMap::new(),
            zeroed: 0,
        })
    }

    fn quantify(&mut self, root: BddRef) -> Result<Vec<f64>> {
        if root == BDD_NULL {
            return Err(PraxisError::Hcl(
                "cannot quantify the null BDD reference".to_string(),
            ));
        }
        let context = self.space.empty();
        self.recurse(root, &context)
    }

    fn conditional_on_variable(
        &mut self,
        root: BddRef,
        variable: usize,
    ) -> Result<ConditionalTriple> {
        let probability = self
            .event_probabilities
            .get(variable)
            .cloned()
            .ok_or_else(|| {
                PraxisError::Hcl(format!(
                    "unbound BDD variable {variable} has no uncertainty population"
                ))
            })?;
        let context = self.space.empty();
        let mut sides = Vec::with_capacity(2);
        for occurs in [true, false] {
            self.forced = Some((variable, occurs));
            self.forced_cache.clear();
            let values = self.recurse(root, &context);
            self.forced = None;
            self.forced_cache.clear();
            sides.push(values?);
        }
        let not_occurred = sides.pop().unwrap_or_default();
        let occurred = sides.pop().unwrap_or_default();
        Ok((probability, occurred, not_occurred))
    }

    fn conditional_on_binding(
        &mut self,
        root: BddRef,
        binding: &HclEventBinding,
    ) -> Result<ConditionalTriple> {
        let kept = self.zeroed;
        let empty = self.space.empty();
        let probability = self.conditional_event_probabilities(binding, &empty)?;
        let mut sides = Vec::with_capacity(2);
        for occurs in [true, false] {
            let Some(context) = self.space.extend(&empty, binding, occurs) else {
                sides.push(vec![f64::NAN; self.sample_count]);
                continue;
            };
            self.engine.clear_soft_evidence();
            for &restriction in context.iter() {
                let (node, allowed) = self.space.restriction(restriction);
                let likelihoods = allowed
                    .iter()
                    .map(|allowed| if *allowed { 1.0 } else { 0.0 })
                    .collect::<Vec<_>>();
                self.engine.set_soft_evidence(node, &likelihoods)?;
            }
            self.engine.evaluate(&self.evidence, binding.bn_node())?;
            let impossible: HashSet<usize> =
                self.engine.zero_mass_rows().iter().copied().collect();
            let mut values = self.recurse(root, &context)?;
            for (sample, value) in values.iter_mut().enumerate() {
                let condition = if occurs {
                    probability[sample]
                } else {
                    1.0 - probability[sample]
                };
                if impossible.contains(&sample) || condition <= 0.0 {
                    *value = f64::NAN;
                }
            }
            sides.push(values);
        }
        self.zeroed = kept;
        let not_occurred = sides.pop().unwrap_or_default();
        let occurred = sides.pop().unwrap_or_default();
        Ok((probability, occurred, not_occurred))
    }

    fn recurse(&mut self, reference: BddRef, context: &PathContext) -> Result<Vec<f64>> {
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
        let support = self.space.support(self.bdd, &self.bindings, reference);
        let key = BddContextKey {
            node: reference,
            context: self.space.project(support, context),
        };
        let node = *self.bdd.node(reference);
        let scratch = self.forced.is_some_and(|(variable, _)| node.var <= variable);
        let known = if scratch {
            self.forced_cache.get(&key)
        } else {
            self.bdd_cache.get(&key)
        };
        if let Some(values) = known {
            return Ok(values.clone());
        }
        if let Some((_, occurs)) = self.forced.filter(|(variable, _)| *variable == node.var) {
            let values = self.recurse(if occurs { node.high } else { node.low }, context)?;
            self.forced_cache.insert(key, values.clone());
            return Ok(values);
        }
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
            Some(binding) => match self.space.extend(context, &binding, true) {
                Some(next) => self.recurse(node.high, &next)?,
                None => vec![0.0; self.sample_count],
            },
            None => self.recurse(node.high, context)?,
        };
        let low = match self.bindings.get(node.var).cloned() {
            Some(binding) => match self.space.extend(context, &binding, false) {
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
        if scratch {
            self.forced_cache.insert(key, values.clone());
        } else {
            self.bdd_cache.insert(key, values.clone());
        }
        Ok(values)
    }

    fn conditional_event_probabilities(
        &mut self,
        binding: &HclEventBinding,
        context: &PathContext,
    ) -> Result<Vec<f64>> {
        let support = self.space.node_support(binding.bn_node());
        let context = &self.space.project(support, context);
        let key = BnQueryKey {
            variable: binding.bdd_variable(),
            context: PathContext::clone(context),
        };
        if let Some(values) = self.bn_cache.get(&key) {
            return Ok(values.clone());
        }
        self.engine.clear_soft_evidence();
        for &restriction in context.iter() {
            let (node, allowed) = self.space.restriction(restriction);
            let likelihoods = allowed
                .iter()
                .map(|allowed| if *allowed { 1.0 } else { 0.0 })
                .collect::<Vec<_>>();
            self.engine.set_soft_evidence(node, &likelihoods)?;
        }
        let marginal = self.engine.evaluate(&self.evidence, binding.bn_node())?;
        let zero_rows: HashSet<usize> = self.engine.zero_mass_rows().iter().copied().collect();
        if let Some(sample) = zero_rows.iter().min() {
            if context.is_empty() {
                return Err(PraxisError::Hcl(format!(
                    "the base evidence has zero probability in uncertainty sample {}",
                    self.first_sample + sample + 1
                )));
            }
        }
        let mut values = Vec::with_capacity(self.sample_count);
        for sample in 0..self.sample_count {
            if zero_rows.contains(&sample) {
                values.push(0.0);
                self.zeroed += 1;
                continue;
            }
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
                    self.first_sample + sample + 1
                )));
            }
            values.push(true_mass / total);
        }
        self.bn_cache.insert(key, values.clone());
        Ok(values)
    }
}

