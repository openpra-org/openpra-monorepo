use std::collections::{HashMap, HashSet};

use rand_distr::{Beta, Distribution, Gamma, LogNormal, Uniform};
use tensorbayes::{
    BayesianGraph, CompileHeuristic, CompiledJunctionTree, EvidenceBatch, ExecutionEngine, NodeId,
    StateIndex,
};

use crate::algorithms::bdd_engine::{Bdd, BddRef, BDD_FALSE, BDD_NULL, BDD_TRUE};
use crate::hcl::{
    HclBaseEvidence, HclEventBinding, HclEventBindings, HclEvidenceSpec,
    HclProbabilityDistribution, HclUncertaintySettings,
};
use crate::mc::prng::initialize_rng;
use crate::{PraxisError, Result};

const NORMAL_95TH_PERCENTILE: f64 = 1.644_853_626_951_472_2;

/// One sampled BN and sampled independent-event population. TensorBayes stores
/// samples on its CPT batch axis, so the junction tree is compiled once for the
/// complete Monte Carlo population.
pub(crate) struct PreparedHclUncertainty {
    tree: CompiledJunctionTree,
    sample_count: usize,
    seed: u64,
    event_samples: HashMap<String, Vec<f64>>,
}

impl PreparedHclUncertainty {
    pub(crate) fn new(network: &BayesianGraph, settings: &HclUncertaintySettings) -> Result<Self> {
        validate_hcl_uncertainty_settings(network, settings)?;
        let mut rng = initialize_rng(Some(settings.seed));
        let mut sampled_network = network.clone();
        let mut rows_by_node: HashMap<NodeId, HashMap<usize, f64>> = HashMap::new();
        for row in &settings.cpt_row_distributions {
            let node = sampled_network.node_id(&row.node)?;
            if rows_by_node
                .entry(node)
                .or_default()
                .insert(row.row_index, row.equivalent_sample_size)
                .is_some()
            {
                return Err(PraxisError::Hcl(format!(
                    "CPT row {} of BN node '{}' has more than one uncertainty definition",
                    row.row_index, row.node
                )));
            }
        }

        let node_ids: Vec<NodeId> = sampled_network
            .variables()
            .iter()
            .map(|variable| variable.id())
            .collect();
        for node in node_ids {
            let variable = network.variable(node)?;
            let cardinality = variable.cardinality();
            let family_size = network.family_size(node)?;
            if network.cpt_batch_size(node)? != 1 {
                return Err(PraxisError::Hcl(format!(
                    "uncertainty input BN node '{}' must have a scalar CPT",
                    variable.name()
                )));
            }
            let row_count = family_size / cardinality;
            if let Some(rows) = rows_by_node.get(&node) {
                if let Some(row_index) = rows.keys().find(|row_index| **row_index >= row_count) {
                    return Err(PraxisError::Hcl(format!(
                        "CPT row {row_index} is out of range for BN node '{}'",
                        variable.name()
                    )));
                }
            }
            let mut values = vec![0.0; family_size * settings.sample_count];
            for row_index in 0..row_count {
                let nominal =
                    &variable.cpt()[row_index * cardinality..(row_index + 1) * cardinality];
                let equivalent_sample_size = rows_by_node
                    .get(&node)
                    .and_then(|rows| rows.get(&row_index))
                    .copied();
                for sample_index in 0..settings.sample_count {
                    let sampled = match equivalent_sample_size {
                        Some(sample_size) => sample_dirichlet_row(
                            nominal,
                            sample_size,
                            &mut rng,
                            variable.name(),
                            row_index,
                        )?,
                        None => nominal.to_vec(),
                    };
                    for (state_index, probability) in sampled.into_iter().enumerate() {
                        let family_index = row_index * cardinality + state_index;
                        values[family_index * settings.sample_count + sample_index] = probability;
                    }
                }
            }
            sampled_network.set_cpt(node, values)?;
        }
        sampled_network.validate()?;
        let tree = CompiledJunctionTree::compile(sampled_network, CompileHeuristic::MinFill)?;

        let mut event_samples = HashMap::new();
        for event in &settings.basic_event_distributions {
            let samples = (0..settings.sample_count)
                .map(|_| sample_probability(&event.distribution, &mut rng))
                .collect::<Result<Vec<_>>>()?;
            if event_samples.insert(event.event.clone(), samples).is_some() {
                return Err(PraxisError::Hcl(format!(
                    "basic event '{}' has more than one uncertainty definition",
                    event.event
                )));
            }
        }

        Ok(Self {
            tree,
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
            let samples = event
                .and_then(|event| self.event_samples.get(event))
                .cloned()
                .unwrap_or_else(|| vec![nominal; self.sample_count]);
            probabilities.push(samples);
        }
        BatchedHclQuantifier::new(
            bdd,
            self.tree.clone(),
            bindings,
            base_evidence,
            probabilities,
            self.sample_count,
        )?
        .quantify(root)
    }

    /// Returns one hazard-cell probability vector per assignment row. Each
    /// vector retains the same sample ordering as HCL top-event results.
    pub(crate) fn conditional_evidence_probabilities(
        &self,
        base_evidence: &[HclEvidenceSpec],
        assignment_rows: &[Vec<HclEvidenceSpec>],
    ) -> Result<Vec<Vec<f64>>> {
        if assignment_rows.is_empty() {
            return Err(PraxisError::Hcl(
                "hazard uncertainty requires at least one assignment row".to_string(),
            ));
        }
        let network = self.tree.graph();
        let mut resolved_base = HclBaseEvidence::unobserved(network.num_variables());
        let mut base_nodes = HashSet::new();
        for spec in base_evidence {
            let node = network.node_id(&spec.node)?;
            if !base_nodes.insert(node) {
                return Err(PraxisError::Hcl(format!(
                    "base evidence observes BN node '{}' more than once",
                    spec.node
                )));
            }
            let variable = network.variable(node)?;
            let state = variable
                .states()
                .iter()
                .position(|state| state == &spec.state)
                .ok_or_else(|| {
                    PraxisError::Hcl(format!(
                        "base evidence state '{}' does not exist on BN node '{}'",
                        spec.state, spec.node
                    ))
                })?;
            resolved_base.observe(node, StateIndex::new(state))?;
        }

        let mut resolved_rows = Vec::with_capacity(assignment_rows.len());
        let mut hazard_nodes: Option<HashSet<NodeId>> = None;
        for assignments in assignment_rows {
            if assignments.is_empty() {
                return Err(PraxisError::Hcl(
                    "hazard uncertainty assignment rows cannot be empty".to_string(),
                ));
            }
            let mut nodes = HashSet::new();
            let mut resolved = Vec::with_capacity(assignments.len());
            for spec in assignments {
                let node = network.node_id(&spec.node)?;
                if !nodes.insert(node) {
                    return Err(PraxisError::Hcl(format!(
                        "hazard assignment observes BN node '{}' more than once",
                        spec.node
                    )));
                }
                let variable = network.variable(node)?;
                let state = variable
                    .states()
                    .iter()
                    .position(|state| state == &spec.state)
                    .ok_or_else(|| {
                        PraxisError::Hcl(format!(
                            "hazard assignment state '{}' does not exist on BN node '{}'",
                            spec.state, spec.node
                        ))
                    })?;
                resolved.push((
                    node,
                    i32::try_from(state).map_err(|_| {
                        PraxisError::Hcl("hazard state index exceeds supported range".to_string())
                    })?,
                ));
            }
            match &hazard_nodes {
                Some(expected) if expected != &nodes => {
                    return Err(PraxisError::Hcl(
                        "hazard uncertainty rows must define the same dimensions".to_string(),
                    ));
                }
                None => hazard_nodes = Some(nodes),
                _ => {}
            }
            resolved_rows.push(resolved);
        }
        for node in hazard_nodes.unwrap_or_default() {
            resolved_base.clear(node)?;
        }

        let base_rows = vec![resolved_base.states().to_vec(); self.sample_count];
        let mut engine = ExecutionEngine::new(self.tree.clone());
        let base_probabilities =
            engine.evidence_probabilities(&EvidenceBatch::from_rows(&base_rows)?)?;
        if base_probabilities
            .iter()
            .any(|probability| *probability <= 0.0)
        {
            return Err(PraxisError::Hcl(
                "common evidence has zero probability in an uncertainty sample".to_string(),
            ));
        }
        resolved_rows
            .into_iter()
            .map(|assignments| {
                let mut row = resolved_base.states().to_vec();
                for (node, state) in assignments {
                    row[node.index()] = state;
                }
                let rows = vec![row; self.sample_count];
                let probabilities =
                    engine.evidence_probabilities(&EvidenceBatch::from_rows(&rows)?)?;
                Ok(probabilities
                    .into_iter()
                    .zip(&base_probabilities)
                    .map(|(probability, base)| (probability / base).clamp(0.0, 1.0))
                    .collect())
            })
            .collect()
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

    let mut events = HashSet::new();
    for event in &settings.basic_event_distributions {
        validate_probability_distribution(&event.distribution)?;
        if !events.insert(&event.event) {
            return Err(PraxisError::Hcl(format!(
                "basic event '{}' has more than one uncertainty definition",
                event.event
            )));
        }
    }

    let mut rows = HashSet::new();
    for row in &settings.cpt_row_distributions {
        let node = network.node_id(&row.node)?;
        if !rows.insert((node, row.row_index)) {
            return Err(PraxisError::Hcl(format!(
                "CPT row {} of BN node '{}' has more than one uncertainty definition",
                row.row_index, row.node
            )));
        }
        let variable = network.variable(node)?;
        if network.cpt_batch_size(node)? != 1 {
            return Err(PraxisError::Hcl(format!(
                "uncertainty input BN node '{}' must have a scalar CPT",
                variable.name()
            )));
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
    Ok(())
}

fn validate_settings(settings: &HclUncertaintySettings) -> Result<()> {
    if !(10..=10_000).contains(&settings.sample_count) {
        return Err(PraxisError::Hcl(
            "HCL uncertainty sample count must be between 10 and 10000".to_string(),
        ));
    }
    for row in &settings.cpt_row_distributions {
        if !row.equivalent_sample_size.is_finite() || row.equivalent_sample_size <= 0.0 {
            return Err(PraxisError::Hcl(format!(
                "CPT uncertainty for BN node '{}' requires a positive equivalent sample size",
                row.node
            )));
        }
    }
    Ok(())
}

fn sample_probability<R: rand::Rng + ?Sized>(
    distribution: &HclProbabilityDistribution,
    rng: &mut R,
) -> Result<f64> {
    validate_probability_distribution(distribution)?;
    let value = match *distribution {
        HclProbabilityDistribution::Beta { alpha, beta } => Beta::new(alpha, beta)
            .map_err(|error| PraxisError::Hcl(error.to_string()))?
            .sample(rng),
        HclProbabilityDistribution::Lognormal {
            median,
            error_factor,
        } => {
            let sigma = error_factor.ln() / NORMAL_95TH_PERCENTILE;
            LogNormal::new(median.ln(), sigma)
                .map_err(|error| PraxisError::Hcl(error.to_string()))?
                .sample(rng)
        }
        HclProbabilityDistribution::Uniform { lower, upper } => {
            Uniform::new(lower, upper).sample(rng)
        }
    };
    Ok(value.clamp(0.0, 1.0))
}

fn validate_probability_distribution(distribution: &HclProbabilityDistribution) -> Result<()> {
    match *distribution {
        HclProbabilityDistribution::Beta { alpha, beta }
            if !alpha.is_finite() || alpha <= 0.0 || !beta.is_finite() || beta <= 0.0 =>
        {
            Err(PraxisError::Hcl(
                "beta uncertainty parameters must be positive".to_string(),
            ))
        }
        HclProbabilityDistribution::Lognormal {
            median,
            error_factor,
        } if !median.is_finite()
            || !(0.0..=1.0).contains(&median)
            || median == 0.0
            || !error_factor.is_finite()
            || error_factor <= 1.0 =>
        {
            Err(PraxisError::Hcl(
                "lognormal uncertainty requires a median in (0,1] and error factor above one"
                    .to_string(),
            ))
        }
        HclProbabilityDistribution::Uniform { lower, upper }
            if !lower.is_finite()
                || !upper.is_finite()
                || lower < 0.0
                || upper > 1.0
                || lower >= upper =>
        {
            Err(PraxisError::Hcl(
                "uniform uncertainty bounds must satisfy 0 <= lower < upper <= 1".to_string(),
            ))
        }
        _ => Ok(()),
    }
}

fn sample_dirichlet_row<R: rand::Rng + ?Sized>(
    nominal: &[f64],
    equivalent_sample_size: f64,
    rng: &mut R,
    node: &str,
    row_index: usize,
) -> Result<Vec<f64>> {
    let positive: Vec<usize> = nominal
        .iter()
        .enumerate()
        .filter_map(|(index, probability)| (*probability > 0.0).then_some(index))
        .collect();
    if positive.is_empty() {
        return Err(PraxisError::Hcl(format!(
            "CPT row {row_index} of BN node '{node}' has no positive probability"
        )));
    }
    if positive.len() == 1 {
        let mut deterministic = vec![0.0; nominal.len()];
        deterministic[positive[0]] = 1.0;
        return Ok(deterministic);
    }
    let mut sampled = vec![0.0; nominal.len()];
    let mut sum = 0.0;
    for state in positive {
        let alpha = nominal[state] * equivalent_sample_size;
        let draw = Gamma::new(alpha, 1.0)
            .map_err(|error| PraxisError::Hcl(error.to_string()))?
            .sample(rng);
        sampled[state] = draw;
        sum += draw;
    }
    if !sum.is_finite() || sum <= 0.0 {
        return Err(PraxisError::Hcl(format!(
            "could not sample CPT row {row_index} of BN node '{node}'"
        )));
    }
    sampled
        .iter_mut()
        .for_each(|probability| *probability /= sum);
    Ok(sampled)
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
            .map(|(probability, (high, low))| {
                (probability * high + (1.0 - probability) * low).clamp(0.0, 1.0)
            })
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
    use crate::hcl::{HclBasicEventUncertaintySpec, HclCptRowUncertaintySpec};

    #[test]
    fn samples_cpt_rows_and_independent_events_reproducibly() {
        let mut graph = BayesianGraph::new();
        let node = graph.add_variable("N", &["F", "T"]).unwrap();
        graph.set_cpt(node, vec![0.8, 0.2]).unwrap();
        let settings = HclUncertaintySettings {
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
                equivalent_sample_size: 20.0,
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
