use std::collections::{BTreeMap, HashMap};

use rand::{Rng, SeedableRng};
use rand_chacha::ChaCha8Rng;
use rand_distr::{Beta as BetaSampler, Distribution, Gamma as GammaSampler, StandardNormal};
use statrs::distribution::{Beta, ContinuousCDF, Gamma, Normal};

use crate::algorithms::bdd_engine::{Bdd, BddRef};
use crate::algorithms::build::build_sequence_bdd_with_successes;
use crate::algorithms::pdag::PdagNode;
use crate::analysis::sequence_formula::SequenceFormulaBuilder;
use crate::core::event_tree::EventTree;
use crate::core::model::Model;
use crate::{PraxisError, Result};

#[derive(Clone, Copy, Debug, PartialEq)]
enum Link {
    False,
    True,
    Node { index: usize, complement: bool },
}

#[derive(Clone, Copy, Debug)]
struct FlatNode {
    var: usize,
    high: Link,
    low: Link,
}

#[derive(Clone, Debug)]
pub struct SequenceDiagram {
    pub sequence_id: String,
    pub variables: Vec<String>,
    pub nominal: Vec<f64>,
    nodes: Vec<FlatNode>,
    root: Link,
}

impl SequenceDiagram {
    fn certain(sequence_id: String) -> Self {
        Self {
            sequence_id,
            variables: Vec::new(),
            nominal: Vec::new(),
            nodes: Vec::new(),
            root: Link::True,
        }
    }

    fn from_bdd(sequence_id: String, bdd: &Bdd, root: BddRef, variables: Vec<String>) -> Result<Self> {
        let nominal = bdd.var_probs().to_vec();
        if nominal.len() < variables.len() {
            return Err(PraxisError::Logic(format!(
                "sequence '{sequence_id}' has fewer variable probabilities than variables"
            )));
        }
        let mut index_of: HashMap<i32, usize> = HashMap::new();
        let mut nodes: Vec<FlatNode> = Vec::new();
        let mut stack: Vec<(BddRef, bool)> = Vec::new();
        if !root.is_terminal() {
            stack.push((root.regular(), false));
        }
        while let Some((reference, expanded)) = stack.pop() {
            let key = reference.raw();
            if index_of.contains_key(&key) {
                continue;
            }
            let node = *bdd.node(reference);
            if expanded {
                let link = |child: BddRef, index_of: &HashMap<i32, usize>| -> Result<Link> {
                    if child.is_true() {
                        return Ok(Link::True);
                    }
                    if child.is_false() {
                        return Ok(Link::False);
                    }
                    let index = index_of.get(&child.regular().raw()).copied().ok_or_else(|| {
                        PraxisError::Logic("decision diagram child was not flattened before its parent".to_string())
                    })?;
                    Ok(Link::Node { index, complement: child.is_complement() })
                };
                if node.var >= variables.len() {
                    return Err(PraxisError::Logic(format!(
                        "sequence '{sequence_id}' tests a variable outside its order"
                    )));
                }
                let flat = FlatNode {
                    var: node.var,
                    high: link(node.high, &index_of)?,
                    low: link(node.low, &index_of)?,
                };
                index_of.insert(key, nodes.len());
                nodes.push(flat);
                continue;
            }
            stack.push((reference, true));
            for child in [node.high, node.low] {
                if !child.is_terminal() && !index_of.contains_key(&child.regular().raw()) {
                    stack.push((child.regular(), false));
                }
            }
        }
        let root = if root.is_true() {
            Link::True
        } else if root.is_false() {
            Link::False
        } else {
            let index = index_of.get(&root.regular().raw()).copied().ok_or_else(|| {
                PraxisError::Logic(format!("sequence '{sequence_id}' lost its root while flattening"))
            })?;
            Link::Node { index, complement: root.is_complement() }
        };
        let mut nominal = nominal;
        nominal.truncate(variables.len());
        Ok(Self { sequence_id, variables, nominal, nodes, root })
    }

    fn signed(link: Link, negate: bool, values: &[f64]) -> f64 {
        match link {
            Link::False => {
                if negate {
                    1.0
                } else {
                    0.0
                }
            }
            Link::True => {
                if negate {
                    0.0
                } else {
                    1.0
                }
            }
            Link::Node { index, complement } => values[2 * index + usize::from(complement != negate)],
        }
    }

    pub fn node_count(&self) -> usize {
        self.nodes.len()
    }

    pub fn evaluate(&self, probabilities: &[f64], values: &mut Vec<f64>) -> f64 {
        values.clear();
        values.resize(2 * self.nodes.len(), 0.0);
        for (index, node) in self.nodes.iter().enumerate() {
            let p = probabilities[node.var];
            values[2 * index] = p * Self::signed(node.high, false, values) + (1.0 - p) * Self::signed(node.low, false, values);
            values[2 * index + 1] = p * Self::signed(node.high, true, values) + (1.0 - p) * Self::signed(node.low, true, values);
        }
        Self::signed(self.root, false, values)
    }

    pub fn gradient(&self, probabilities: &[f64]) -> (f64, Vec<f64>) {
        let mut values = Vec::new();
        let value = self.evaluate(probabilities, &mut values);
        let mut gradient = vec![0.0; self.variables.len()];
        let mut adjoint = vec![0.0; 2 * self.nodes.len()];
        if let Link::Node { index, complement } = self.root {
            adjoint[2 * index + usize::from(complement)] = 1.0;
        }
        for index in (0..self.nodes.len()).rev() {
            let node = self.nodes[index];
            let p = probabilities[node.var];
            for polarity in 0..2 {
                let weight = adjoint[2 * index + polarity];
                if weight == 0.0 {
                    continue;
                }
                let negate = polarity == 1;
                gradient[node.var] += weight * (Self::signed(node.high, negate, &values) - Self::signed(node.low, negate, &values));
                if let Link::Node { index: child, complement } = node.high {
                    adjoint[2 * child + usize::from(complement != negate)] += weight * p;
                }
                if let Link::Node { index: child, complement } = node.low {
                    adjoint[2 * child + usize::from(complement != negate)] += weight * (1.0 - p);
                }
            }
        }
        (value, gradient)
    }
}

pub fn compile_sequence_diagrams(model: &Model, event_tree: &EventTree) -> Result<Vec<SequenceDiagram>> {
    let formulas = SequenceFormulaBuilder::new(model).build(event_tree, 1.0)?;
    let mut sequence_ids: Vec<String> = event_tree.sequences.keys().cloned().collect();
    sequence_ids.sort();
    let mut pdag = formulas.pdag;
    let mut diagrams = Vec::with_capacity(sequence_ids.len());
    for sequence_id in sequence_ids {
        if formulas.unconditional.contains(&sequence_id) {
            diagrams.push(SequenceDiagram::certain(sequence_id));
            continue;
        }
        let root = formulas.sequence_roots.get(&sequence_id).copied().ok_or_else(|| {
            PraxisError::Logic(format!("event-tree sequence '{sequence_id}' has no Boolean formula"))
        })?;
        let (order, bdd, bdd_root, _) =
            build_sequence_bdd_with_successes(&mut pdag, &formulas.event_probs, root, &[], &sequence_id)?;
        let variables = order
            .iter()
            .map(|index| match pdag.get_node(*index) {
                Some(PdagNode::BasicEvent { id, .. }) => Ok(id.clone()),
                _ => Err(PraxisError::Logic(format!(
                    "sequence '{sequence_id}' orders a node that is not a basic event"
                ))),
            })
            .collect::<Result<Vec<_>>>()?;
        diagrams.push(SequenceDiagram::from_bdd(sequence_id, &bdd, bdd_root, variables)?);
    }
    Ok(diagrams)
}

#[derive(Clone, Debug, PartialEq)]
pub struct TargetChange {
    pub id: String,
    pub decrease: f64,
    pub increase: f64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct FamilyImportance {
    pub family_id: String,
    pub base: f64,
    pub events: Vec<TargetChange>,
    pub groups: Vec<TargetChange>,
}

#[derive(Clone, Debug)]
pub struct ImportanceGroup {
    pub key: String,
    pub events: Vec<String>,
}

#[derive(Default)]
struct FamilyAccumulator {
    base: f64,
    events: BTreeMap<String, (f64, f64)>,
    groups: BTreeMap<String, (f64, f64)>,
}

pub fn importance_by_family(
    diagrams: &[SequenceDiagram],
    family_of: &HashMap<String, String>,
    frequency: f64,
    groups: &[ImportanceGroup],
) -> Vec<FamilyImportance> {
    let mut families: BTreeMap<String, FamilyAccumulator> = BTreeMap::new();
    let mut values = Vec::new();
    for diagram in diagrams {
        let Some(family_id) = family_of.get(&diagram.sequence_id) else {
            continue;
        };
        let slot = families.entry(family_id.clone()).or_default();
        let (value, gradient) = diagram.gradient(&diagram.nominal);
        slot.base += frequency * value;
        for (var, id) in diagram.variables.iter().enumerate() {
            let birnbaum = gradient[var];
            if birnbaum == 0.0 {
                continue;
            }
            let p = diagram.nominal[var];
            let entry = slot.events.entry(id.clone()).or_insert((0.0, 0.0));
            entry.0 += frequency * p * birnbaum;
            entry.1 += frequency * (1.0 - p) * birnbaum;
        }
        let position: HashMap<&str, usize> = diagram
            .variables
            .iter()
            .enumerate()
            .map(|(var, id)| (id.as_str(), var))
            .collect();
        for group in groups {
            let members: Vec<usize> = group
                .events
                .iter()
                .filter_map(|event| position.get(event.as_str()).copied())
                .collect();
            if members.is_empty() {
                continue;
            }
            let mut probabilities = diagram.nominal.clone();
            for &var in &members {
                probabilities[var] = 0.0;
            }
            let removed = diagram.evaluate(&probabilities, &mut values);
            for &var in &members {
                probabilities[var] = 1.0;
            }
            let failed = diagram.evaluate(&probabilities, &mut values);
            if removed == value && failed == value {
                continue;
            }
            let entry = slot.groups.entry(group.key.clone()).or_insert((0.0, 0.0));
            entry.0 += frequency * (value - removed);
            entry.1 += frequency * (failed - value);
        }
    }
    families
        .into_iter()
        .map(|(family_id, slot)| FamilyImportance {
            family_id,
            base: slot.base,
            events: slot
                .events
                .into_iter()
                .map(|(id, (decrease, increase))| TargetChange { id, decrease, increase })
                .collect(),
            groups: slot
                .groups
                .into_iter()
                .map(|(id, (decrease, increase))| TargetChange { id, decrease, increase })
                .collect(),
        })
        .collect()
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum KeyDistribution {
    Point { value: f64 },
    LogNormal { median: f64, error_factor: f64 },
    Normal { mean: f64, standard_deviation: f64 },
    Gamma { shape: f64, rate: f64 },
    Beta { alpha: f64, beta: f64 },
    Uniform { lower: f64, upper: f64 },
    Exponential { rate: f64 },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SamplingMethod {
    MonteCarlo,
    LatinHypercube,
}

const LOGNORMAL_Z95: f64 = 1.644_853_626_951_472_2;

impl KeyDistribution {
    pub fn validate(&self, key: &str) -> Result<()> {
        let positive = |value: f64| value.is_finite() && value > 0.0;
        let valid = match *self {
            KeyDistribution::Point { value } => value.is_finite() && value >= 0.0,
            KeyDistribution::LogNormal { median, error_factor } => positive(median) && error_factor.is_finite() && error_factor >= 1.0,
            KeyDistribution::Normal { mean, standard_deviation } => mean.is_finite() && standard_deviation.is_finite() && standard_deviation >= 0.0,
            KeyDistribution::Gamma { shape, rate } => positive(shape) && positive(rate),
            KeyDistribution::Beta { alpha, beta } => positive(alpha) && positive(beta),
            KeyDistribution::Uniform { lower, upper } => lower.is_finite() && upper.is_finite() && lower < upper,
            KeyDistribution::Exponential { rate } => positive(rate),
        };
        if valid {
            Ok(())
        } else {
            Err(PraxisError::Settings(format!("sampling key '{key}' has an invalid distribution")))
        }
    }

    pub fn mean(&self) -> f64 {
        match *self {
            KeyDistribution::Point { value } => value,
            KeyDistribution::LogNormal { median, error_factor } => {
                let sigma = error_factor.ln() / LOGNORMAL_Z95;
                median * (0.5 * sigma * sigma).exp()
            }
            KeyDistribution::Normal { mean, .. } => mean,
            KeyDistribution::Gamma { shape, rate } => shape / rate,
            KeyDistribution::Beta { alpha, beta } => alpha / (alpha + beta),
            KeyDistribution::Uniform { lower, upper } => 0.5 * (lower + upper),
            KeyDistribution::Exponential { rate } => 1.0 / rate,
        }
    }

    fn sample(&self, rng: &mut ChaCha8Rng) -> Result<f64> {
        Ok(match *self {
            KeyDistribution::Point { value } => value,
            KeyDistribution::LogNormal { median, error_factor } => {
                let z: f64 = rng.sample(StandardNormal);
                median * (z * error_factor.ln() / LOGNORMAL_Z95).exp()
            }
            KeyDistribution::Normal { mean, standard_deviation } => {
                let z: f64 = rng.sample(StandardNormal);
                mean + standard_deviation * z
            }
            KeyDistribution::Gamma { shape, rate } => GammaSampler::new(shape, 1.0 / rate)
                .map_err(|error| PraxisError::Settings(format!("gamma sampler: {error}")))?
                .sample(rng),
            KeyDistribution::Beta { alpha, beta } => BetaSampler::new(alpha, beta)
                .map_err(|error| PraxisError::Settings(format!("beta sampler: {error}")))?
                .sample(rng),
            KeyDistribution::Uniform { lower, upper } => lower + (upper - lower) * rng.gen::<f64>(),
            KeyDistribution::Exponential { rate } => -(1.0 - rng.gen::<f64>()).ln() / rate,
        })
    }

    pub fn quantile(&self, u: f64) -> Result<f64> {
        let normal = Normal::new(0.0, 1.0).map_err(|error| PraxisError::Settings(format!("normal: {error}")))?;
        Ok(match *self {
            KeyDistribution::Point { value } => value,
            KeyDistribution::LogNormal { median, error_factor } => {
                median * (normal.inverse_cdf(u) * error_factor.ln() / LOGNORMAL_Z95).exp()
            }
            KeyDistribution::Normal { mean, standard_deviation } => mean + standard_deviation * normal.inverse_cdf(u),
            KeyDistribution::Gamma { shape, rate } => {
                let law = Gamma::new(shape, rate).map_err(|error| PraxisError::Settings(format!("gamma: {error}")))?;
                let mean = shape / rate;
                invert_positive(|x| law.cdf(x), u, mean * 1e-12, mean * 1e6)
            }
            KeyDistribution::Beta { alpha, beta } => {
                let law = Beta::new(alpha, beta).map_err(|error| PraxisError::Settings(format!("beta: {error}")))?;
                invert_positive(|x| law.cdf(x), u, 1e-300, 1.0)
            }
            KeyDistribution::Uniform { lower, upper } => lower + (upper - lower) * u,
            KeyDistribution::Exponential { rate } => -(1.0 - u).ln() / rate,
        })
    }
}

fn invert_positive(cdf: impl Fn(f64) -> f64, u: f64, low: f64, high: f64) -> f64 {
    let mut lo = low.ln();
    let mut hi = high.ln();
    if cdf(low) >= u {
        return low;
    }
    while cdf(hi.exp()) < u && hi < 700.0 {
        hi += 2.0;
    }
    for _ in 0..200 {
        let mid = 0.5 * (lo + hi);
        if cdf(mid.exp()) < u {
            lo = mid;
        } else {
            hi = mid;
        }
        if hi - lo < 1e-13 {
            break;
        }
    }
    (0.5 * (lo + hi)).exp()
}

fn stream_seed(seed: u64, key: &str) -> u64 {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in key.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    let mut mixed = seed ^ hash;
    mixed = (mixed ^ (mixed >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
    mixed = (mixed ^ (mixed >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
    mixed ^ (mixed >> 31)
}

pub fn draw_key(
    key: &str,
    distribution: &KeyDistribution,
    seed: u64,
    trials: usize,
    method: SamplingMethod,
) -> Result<Vec<f64>> {
    distribution.validate(key)?;
    let mut rng = ChaCha8Rng::seed_from_u64(stream_seed(seed, key));
    match method {
        SamplingMethod::MonteCarlo => (0..trials).map(|_| distribution.sample(&mut rng)).collect(),
        SamplingMethod::LatinHypercube => {
            let mut strata: Vec<usize> = (0..trials).collect();
            for index in (1..trials).rev() {
                let other = rng.gen_range(0..=index);
                strata.swap(index, other);
            }
            let width = 1.0 / trials as f64;
            strata
                .into_iter()
                .map(|stratum| {
                    let mut u = (stratum as f64 + rng.gen::<f64>()) * width;
                    if u <= 0.0 {
                        u = f64::MIN_POSITIVE;
                    }
                    if u >= 1.0 {
                        u = 1.0 - f64::EPSILON;
                    }
                    distribution.quantile(u)
                })
                .collect()
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SampleForm {
    Probability,
    Rate,
}

#[derive(Clone, Debug)]
pub struct SampledVariable {
    pub key: usize,
    pub form: SampleForm,
    pub scale: f64,
}

impl SampledVariable {
    fn value(&self, draw: f64) -> f64 {
        let value = match self.form {
            SampleForm::Probability => draw * self.scale,
            SampleForm::Rate => 1.0 - (-(draw.max(0.0)) * self.scale).exp(),
        };
        value.clamp(0.0, 1.0)
    }
}

pub struct SampledFrequency {
    pub key: usize,
    pub scale: f64,
}

pub fn sample_families(
    diagrams: &[SequenceDiagram],
    family_of: &HashMap<String, String>,
    frequency: f64,
    sampled_frequency: Option<&SampledFrequency>,
    variables: &HashMap<String, SampledVariable>,
    draws: &[Vec<f64>],
    trials: usize,
) -> Result<BTreeMap<String, Vec<f64>>> {
    if draws.iter().any(|row| row.len() != trials) {
        return Err(PraxisError::Settings("every sampling key needs one draw per trial".to_string()));
    }
    let mut families: BTreeMap<String, Vec<f64>> = BTreeMap::new();
    let mut values = Vec::new();
    for diagram in diagrams {
        let Some(family_id) = family_of.get(&diagram.sequence_id) else {
            continue;
        };
        let sampled: Vec<(usize, &SampledVariable)> = diagram
            .variables
            .iter()
            .enumerate()
            .filter_map(|(var, id)| variables.get(id).map(|variable| (var, variable)))
            .collect();
        if let Some(bad) = sampled.iter().find(|(_, variable)| variable.key >= draws.len()) {
            return Err(PraxisError::Settings(format!("sampled variable uses missing key {}", bad.1.key)));
        }
        let totals = families.entry(family_id.clone()).or_insert_with(|| vec![0.0; trials]);
        let mut probabilities = diagram.nominal.clone();
        for (trial, total) in totals.iter_mut().enumerate() {
            for (var, variable) in &sampled {
                probabilities[*var] = variable.value(draws[variable.key][trial]);
            }
            let weight = match sampled_frequency {
                Some(source) => draws
                    .get(source.key)
                    .map(|row| row[trial].max(0.0) * source.scale)
                    .ok_or_else(|| PraxisError::Settings("the initiator uses a missing sampling key".to_string()))?,
                None => frequency,
            };
            *total += weight * diagram.evaluate(&probabilities, &mut values);
        }
    }
    Ok(families)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn exact_lognormal_mean(median: f64, error_factor: f64) -> f64 {
        let sigma = error_factor.ln() / LOGNORMAL_Z95;
        median * (0.5 * sigma * sigma).exp()
    }

    #[test]
    fn draws_repeat_for_a_key_and_differ_between_keys() {
        let law = KeyDistribution::LogNormal { median: 1e-3, error_factor: 5.0 };
        let first = draw_key("DA-1", &law, 7, 200, SamplingMethod::MonteCarlo).unwrap();
        let again = draw_key("DA-1", &law, 7, 200, SamplingMethod::MonteCarlo).unwrap();
        let other = draw_key("DA-2", &law, 7, 200, SamplingMethod::MonteCarlo).unwrap();
        assert_eq!(first, again);
        assert_ne!(first, other);
        let reseeded = draw_key("DA-1", &law, 8, 200, SamplingMethod::MonteCarlo).unwrap();
        assert_ne!(first, reseeded);
    }

    #[test]
    fn latin_hypercube_puts_one_draw_in_every_stratum() {
        let law = KeyDistribution::Uniform { lower: 0.0, upper: 1.0 };
        let draws = draw_key("U", &law, 3, 500, SamplingMethod::LatinHypercube).unwrap();
        let mut strata: Vec<usize> = draws.iter().map(|u| (u * 500.0).floor() as usize).collect();
        strata.sort_unstable();
        assert_eq!(strata, (0..500).collect::<Vec<_>>());
    }

    #[test]
    fn quantiles_invert_each_law() {
        let cases = [
            KeyDistribution::LogNormal { median: 2e-4, error_factor: 3.0 },
            KeyDistribution::Gamma { shape: 2.5, rate: 10759.29 },
            KeyDistribution::Beta { alpha: 0.5, beta: 656.5 },
            KeyDistribution::Exponential { rate: 4.0 },
            KeyDistribution::Normal { mean: 0.3, standard_deviation: 0.05 },
        ];
        for law in cases {
            for u in [1e-6, 0.05, 0.5, 0.95, 0.999_999] {
                let x = law.quantile(u).unwrap();
                let back = match law {
                    KeyDistribution::LogNormal { median, error_factor } => {
                        Normal::new(0.0, 1.0).unwrap().cdf((x / median).ln() * LOGNORMAL_Z95 / error_factor.ln())
                    }
                    KeyDistribution::Gamma { shape, rate } => Gamma::new(shape, rate).unwrap().cdf(x),
                    KeyDistribution::Beta { alpha, beta } => Beta::new(alpha, beta).unwrap().cdf(x),
                    KeyDistribution::Exponential { rate } => 1.0 - (-rate * x).exp(),
                    KeyDistribution::Normal { mean, standard_deviation } => Normal::new(mean, standard_deviation).unwrap().cdf(x),
                    _ => u,
                };
                assert!((back - u).abs() <= 1e-9 * u.max(1e-3), "{law:?} u={u} x={x} back={back}");
            }
        }
        let law = KeyDistribution::LogNormal { median: 1e-3, error_factor: 5.0 };
        assert!((law.quantile(0.95).unwrap() - 5e-3).abs() < 1e-15);
    }

    #[test]
    fn sample_means_approach_the_law_means() {
        let cases = [
            KeyDistribution::LogNormal { median: 1e-3, error_factor: 5.0 },
            KeyDistribution::Gamma { shape: 2.5, rate: 10759.29 },
            KeyDistribution::Beta { alpha: 0.5, beta: 656.5 },
        ];
        for method in [SamplingMethod::MonteCarlo, SamplingMethod::LatinHypercube] {
            for law in cases {
                let count = if method == SamplingMethod::MonteCarlo { 100_000 } else { 20_000 };
                let draws = draw_key("K", &law, 11, count, method).unwrap();
                let mean = draws.iter().sum::<f64>() / draws.len() as f64;
                let variance = draws.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / (draws.len() - 1) as f64;
                let error = (variance / draws.len() as f64).sqrt();
                assert!((mean - law.mean()).abs() < 5.0 * error, "{law:?} {method:?} mean {mean} expected {}", law.mean());
            }
        }
        assert!((KeyDistribution::LogNormal { median: 1e-3, error_factor: 5.0 }.mean() - exact_lognormal_mean(1e-3, 5.0)).abs() < 1e-18);
    }
}
