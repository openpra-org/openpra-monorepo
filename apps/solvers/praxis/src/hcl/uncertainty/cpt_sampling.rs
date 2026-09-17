//! Port of HCL_MH/oracle/bn_path_oracle.py row-prior sampling and CPT batches.
use super::numpy_rng::NumpyRng;
use crate::hcl::numpy_statistics::numpy_sum;
use crate::hcl::{HclCptPrior, HclSampler, HclUncertaintySettings};
use crate::{PraxisError, Result};
use tensorbayes::BayesianGraph;

pub(super) fn validate_prior(prior: &HclCptPrior, states: &[String]) -> Result<()> {
    let valid = match prior {
        HclCptPrior::Beta {
            alpha,
            beta,
            true_state,
        } => {
            states.len() == 2
                && states.contains(true_state)
                && alpha.is_finite()
                && *alpha > 0.0
                && beta.is_finite()
                && *beta > 0.0
        }
        HclCptPrior::Dirichlet { alpha } => {
            alpha.len() == states.len()
                && !alpha.is_empty()
                && alpha.iter().all(|a| a.is_finite() && *a >= 0.0)
                && alpha.iter().sum::<f64>().is_finite()
                && alpha.iter().any(|a| *a > 0.0)
        }
    };
    if !valid {
        return Err(PraxisError::Hcl(
            "Invalid CPT prior: Beta needs two states, a valid true state and positive finite alpha/beta; Dirichlet needs one nonnegative finite alpha per state, with a positive finite total".into(),
        ));
    }
    Ok(())
}

/// Values are [sample, state], exactly as RowSpec.samples in the source.
pub(super) fn sample_row(
    prior: &HclCptPrior,
    states: &[String],
    sampler: HclSampler,
    size: usize,
    epsilon: f64,
    rng: &mut NumpyRng,
) -> Result<Vec<f64>> {
    let width = states.len();
    let values = match prior {
        HclCptPrior::Beta {
            alpha,
            beta,
            true_state,
        } => {
            let mut draws = (0..size)
                .map(|_| rng.beta(*alpha, *beta))
                .collect::<Vec<_>>();
            if sampler == HclSampler::LatinHypercube {
                draws.sort_by(f64::total_cmp);
                rng.shuffle(&mut draws);
            }
            let true_index = states.iter().position(|state| state == true_state).unwrap();
            let mut values = vec![0.0; size * width];
            for (row, p) in values.chunks_exact_mut(width).zip(draws) {
                let p = p.clamp(0.0, 1.0).clamp(epsilon, 1.0 - epsilon);
                row[true_index] = p;
                row[1 - true_index] = 1.0 - p;
            }
            values
        }
        HclCptPrior::Dirichlet { alpha } => match sampler {
            HclSampler::MonteCarlo => rng.dirichlet(alpha, size),
            HclSampler::LatinHypercube => {
                // The source's BN "LHS" sorts/shuffles random Gamma columns.
                // It does NOT use the FT sampler's strata or inverse CDF.
                let mut values = vec![0.0; size * width];
                for (state, shape) in alpha.iter().enumerate() {
                    let mut draws = (0..size)
                        .map(|_| rng.gamma(*shape, 1.0))
                        .collect::<Vec<_>>();
                    draws.sort_by(f64::total_cmp);
                    rng.shuffle(&mut draws);
                    for (sample, value) in draws.into_iter().enumerate() {
                        values[sample * width + state] = value;
                    }
                }
                for row in values.chunks_exact_mut(width) {
                    let sum = numpy_sum(row);
                    for value in row {
                        *value /= sum;
                    }
                }
                values
            }
        },
    };
    if values.iter().any(|p| !p.is_finite()) {
        return Err(PraxisError::Hcl(
            "CPT sampling produced a nonfinite probability; the source sampler cannot normalize these prior draws".into(),
        ));
    }
    Ok(values)
}

pub(super) fn sample_network(
    network: &BayesianGraph,
    settings: &HclUncertaintySettings,
) -> Result<BayesianGraph> {
    let mut result = network.clone();
    let mut rng = NumpyRng::new(settings.seed);
    // _compile_uq visits the ordered nodes mapping, then each node's rows list.
    // Preserve first node occurrence and the configured row order within it.
    let mut nodes = Vec::new();
    for spec in &settings.cpt_row_distributions {
        let node = network.node_id(&spec.node)?;
        if !nodes.contains(&node) {
            nodes.push(node);
        }
    }
    for node in nodes {
        let variable = network.variable(node)?;
        let width = variable.cardinality();
        let mut values = variable
            .cpt()
            .iter()
            .flat_map(|p| std::iter::repeat_n(*p, settings.sample_count))
            .collect::<Vec<_>>();
        for spec in settings
            .cpt_row_distributions
            .iter()
            .filter(|s| s.node == variable.name())
        {
            let draws = sample_row(
                &spec.prior,
                variable.states(),
                settings.sampler,
                settings.sample_count,
                settings.cpt_probability_clip_epsilon,
                &mut rng,
            )?;
            for sample in 0..settings.sample_count {
                for state in 0..width {
                    values[(spec.row_index * width + state) * settings.sample_count + sample] =
                        draws[sample * width + state];
                }
            }
        }
        result.set_cpt(node, values)?;
    }
    for spec in &settings.cpt_generators {
        let values = super::seismic::sample_generator(network, spec, settings, &mut rng)?;
        result.set_cpt(network.node_id(&spec.node)?, values)?;
    }
    result.validate()?;
    Ok(result)
}
