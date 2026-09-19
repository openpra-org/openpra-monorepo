//! HCL_MH/oracle/bn_path_oracle.py: _lhs_standard_normal, _compile_uq,
//! _precompute_samples_mc/lhs, and _pybncore_build_cpt_batch seismic branches.
use super::{numpy_rng::NumpyRng, statistics_normal};
use crate::hcl::numpy_statistics::numpy_sum;
use crate::hcl::{
    HclCptGenerator, HclCptGeneratorSpec, HclPgaFrequencyConversion, HclSampler,
    HclUncertaintySettings,
};
use crate::{PraxisError, Result};
use std::collections::HashSet;
use tensorbayes::BayesianGraph;

extern "C" {
    fn hcl_math_erf(x: f64) -> f64;
}

fn invalid(message: &str) -> PraxisError {
    PraxisError::Hcl(message.into())
}
fn positive(x: f64) -> bool {
    x.is_finite() && x > 0.
}
fn nonnegative(x: f64) -> bool {
    x.is_finite() && x >= 0.
}

pub(super) fn validate_generator(
    network: &BayesianGraph,
    spec: &HclCptGeneratorSpec,
) -> Result<()> {
    let node = network.node_id(&spec.node)?;
    let states = network.variable(node)?.states();
    match &spec.generator {
        HclCptGenerator::SeismicFragility {
            pga_parent_id,
            theta,
            beta_r,
            beta_u,
            true_state_id,
            false_state_id,
            pga_centers,
        } => {
            if states.len() != 2
                || true_state_id == false_state_id
                || !states.contains(true_state_id)
                || !states.contains(false_state_id)
            {
                return Err(invalid("Seismic fragility requires a binary node with distinct existing true/false states"));
            }
            let parent = network.node_id(pga_parent_id)?;
            if !network.parents(node)?.contains(&parent) {
                return Err(invalid(
                    "Seismic fragility PGA node must be a parent of the component",
                ));
            }
            if !positive(*theta) || !positive(*beta_r) || !nonnegative(*beta_u) {
                return Err(invalid(
                    "Seismic fragility requires theta > 0, betaR > 0 and betaU >= 0, all finite",
                ));
            }
            let parent_states = network.variable(parent)?.states();
            let mapped: HashSet<_> = pga_centers.iter().map(|center| &center.state_id).collect();
            if mapped.len() != pga_centers.len()
                || mapped.len() != parent_states.len()
                || pga_centers.iter().any(|center| {
                    !parent_states.contains(&center.state_id) || !nonnegative(center.value)
                })
            {
                return Err(invalid(
                    "Seismic fragility requires one nonnegative finite PGA center per parent state",
                ));
            }
        }
        HclCptGenerator::SeismicPgaBins {
            none_state_id,
            mission_time,
            bins,
            ..
        } => {
            if !network.parents(node)?.is_empty()
                || !states.contains(none_state_id)
                || !positive(*mission_time)
            {
                return Err(invalid("Seismic PGA bins require a root node, an existing none state and positive finite mission time"));
            }
            let mapped: HashSet<_> = bins.iter().map(|bin| &bin.state_id).collect();
            if bins.is_empty()
                || mapped.len() != bins.len()
                || bins.len() + 1 != states.len()
                || bins.iter().any(|bin| {
                    &bin.state_id == none_state_id
                        || !states.contains(&bin.state_id)
                        || !nonnegative(bin.median_frequency)
                        || !bin.error_factor95.is_finite()
                        || bin.error_factor95 <= 1.
                })
            {
                return Err(invalid("Seismic PGA bins must cover every non-none state once, with finite median frequency >= 0 and EF95 > 1"));
            }
        }
    }
    Ok(())
}

fn lhs_normal(rng: &mut NumpyRng, size: usize) -> Vec<f64> {
    let mut values = (0..size)
        .map(|i| {
            let u = ((i as f64 + rng.uniform01()) / size as f64).clamp(1e-12, 1. - 1e-12);
            statistics_normal::inverse_cdf(u)
        })
        .collect::<Vec<_>>();
    rng.shuffle(&mut values);
    values
}

/// Output uses TensorBayes/source [parent rows, child state, sample] layout.
pub(super) fn sample_generator(
    network: &BayesianGraph,
    spec: &HclCptGeneratorSpec,
    settings: &HclUncertaintySettings,
    rng: &mut NumpyRng,
) -> Result<Vec<f64>> {
    let node = network.node_id(&spec.node)?;
    let variable = network.variable(node)?;
    let states = variable.states();
    let width = states.len();
    let size = settings.sample_count;
    let mut values = vec![0.; network.family_size(node)? * size];
    match &spec.generator {
        HclCptGenerator::SeismicFragility {
            pga_parent_id,
            theta,
            beta_r,
            beta_u,
            true_state_id,
            false_state_id,
            pga_centers,
        } => {
            // One capacity draw per sample, reused across ALL rows of this node.
            let z = match settings.sampler {
                HclSampler::MonteCarlo => (0..size).map(|_| rng.standard_normal()).collect(),
                HclSampler::LatinHypercube => lhs_normal(rng, size),
            };
            let capacities = z
                .iter()
                .map(|draw| theta * (beta_u * draw).exp())
                .collect::<Vec<_>>();
            let parent = network.node_id(pga_parent_id)?;
            let parents = network.parents(node)?;
            let position = parents.iter().position(|p| *p == parent).unwrap();
            let stride = parents[position + 1..].iter().try_fold(1usize, |n, p| {
                network.variable(*p).map(|v| n * v.cardinality())
            })?;
            let parent_states = network.variable(parent)?.states();
            let ti = states.iter().position(|s| s == true_state_id).unwrap();
            let fi = states.iter().position(|s| s == false_state_id).unwrap();
            let epsilon = settings.cpt_probability_clip_epsilon;
            for row in 0..network.family_size(node)? / width {
                let state = &parent_states[(row / stride) % parent_states.len()];
                let g = pga_centers
                    .iter()
                    .find(|c| &c.state_id == state)
                    .unwrap()
                    .value;
                for (sample, alpha) in capacities.iter().enumerate() {
                    let p = if g <= 0. {
                        0.
                    } else {
                        let x = (g / alpha).ln() / beta_r;
                        // Source _std_norm_cdf uses math.erf, not erfc or SciPy.
                        0.5 * (1. + unsafe { hcl_math_erf(x / 2_f64.sqrt()) })
                    };
                    if !p.is_finite() {
                        return Err(invalid(
                            "Seismic fragility produced a nonfinite probability",
                        ));
                    }
                    let p = p.clamp(0., 1.).clamp(epsilon, 1. - epsilon);
                    values[(row * width + ti) * size + sample] = p;
                    values[(row * width + fi) * size + sample] = 1. - p;
                }
            }
        }
        HclCptGenerator::SeismicPgaBins {
            none_state_id,
            mission_time,
            frequency_to_probability,
            bins,
        } => {
            let count = bins.len();
            let mut z = vec![0.; size * count];
            match settings.sampler {
                HclSampler::MonteCarlo => z.iter_mut().for_each(|x| *x = rng.standard_normal()),
                HclSampler::LatinHypercube => {
                    for bin in 0..count {
                        for (sample, value) in lhs_normal(rng, size).into_iter().enumerate() {
                            z[sample * count + bin] = value;
                        }
                    }
                }
            }
            let none = states.iter().position(|s| s == none_state_id).unwrap();
            let sigmas = bins
                .iter()
                .map(|bin| bin.error_factor95.ln() / 1.645)
                .collect::<Vec<_>>();
            let indices = bins
                .iter()
                .map(|bin| states.iter().position(|s| s == &bin.state_id).unwrap())
                .collect::<Vec<_>>();
            let mut q = vec![0.; count];
            for sample in 0..size {
                for (j, bin) in bins.iter().enumerate() {
                    let lam = bin.median_frequency * (sigmas[j] * z[sample * count + j]).exp();
                    q[j] = match frequency_to_probability {
                        HclPgaFrequencyConversion::Poisson => 1. - (-lam * mission_time).exp(),
                        HclPgaFrequencyConversion::Linear => lam * mission_time,
                    };
                    if !q[j].is_finite() {
                        return Err(invalid("Seismic PGA bins produced a nonfinite probability"));
                    }
                    q[j] = q[j].max(0.);
                    values[indices[j] * size + sample] = q[j];
                }
                let sum = numpy_sum(&q);
                if sum > 1. + 1e-9 {
                    return Err(invalid("Seismic PGA-bin probabilities sum above 1 + 1e-9; the source rejects this sample"));
                }
                values[none * size + sample] = (1. - sum).max(0.);
            }
        }
    }
    Ok(values)
}
