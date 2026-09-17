use serde::{Deserialize, Serialize};

use crate::hcl::{numpy_statistics, HclBridgeStats, HclJunctionTreeStats, HclSettings};
use crate::Result;

/// Settings for the existing extended analyses, separate from `HclSettings`.
#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(default, deny_unknown_fields)]
pub struct HclAnalysisSettings {
    /// Exact basic-event order. When omitted, use HCL_MH BN-depth ordering and a BFS FT-only block.
    pub variable_order: Option<Vec<String>>,
    pub fold_constants: bool,
    pub splice_null_gates: bool,
    pub uncertainty: Option<HclUncertaintySettings>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(
    tag = "family",
    rename_all = "SCREAMING_SNAKE_CASE",
    deny_unknown_fields
)]
pub enum HclProbabilityDistribution {
    Beta {
        alpha: f64,
        beta: f64,
    },
    Lognormal {
        median: f64,
        #[serde(alias = "errorFactor")]
        error_factor: f64,
    },
    Uniform {
        lower: f64,
        upper: f64,
    },
    Normal {
        mean: f64,
        #[serde(alias = "standardDeviation")]
        standard_deviation: f64,
    },
    Logitnormal {
        mu: f64,
        sigma: f64,
    },
    Gamma {
        shape: f64,
        scale: f64,
    },
    Exponential {
        rate: f64,
    },
    Triangular {
        lower: f64,
        mode: f64,
        upper: f64,
    },
}

/// Shared selection of HCL_MH's distinct FT and BN sampling routines.
#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq, Serialize)]
pub enum HclSampler {
    /// Preserve saved configurations that predate the sampler setting.
    #[default]
    #[serde(rename = "MC")]
    MonteCarlo,
    #[serde(rename = "LHS")]
    LatinHypercube,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct HclBasicEventUncertaintySpec {
    pub event: String,
    pub distribution: HclProbabilityDistribution,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct HclCptRowUncertaintySpec {
    pub node: String,
    pub row_index: usize,
    pub prior: HclCptPrior,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(
    tag = "family",
    rename_all = "SCREAMING_SNAKE_CASE",
    deny_unknown_fields
)]
pub enum HclCptPrior {
    /// `true_state` identifies the state corresponding to HCL_MH's `True` label.
    Beta {
        alpha: f64,
        beta: f64,
        #[serde(alias = "trueStateId")]
        true_state: String,
    },
    /// Parameters in the BN node's state order.
    Dirichlet { alpha: Vec<f64> },
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct HclCptGeneratorSpec {
    pub node: String,
    pub generator: HclCptGenerator,
}

/// HCL_MH node generators. State/parent identifiers adapt source labels only.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum HclCptGenerator {
    SeismicFragility {
        pga_parent_id: String,
        theta: f64,
        beta_r: f64,
        beta_u: f64,
        true_state_id: String,
        false_state_id: String,
        pga_centers: Vec<HclPgaCenter>,
    },
    SeismicPgaBins {
        none_state_id: String,
        mission_time: f64,
        frequency_to_probability: HclPgaFrequencyConversion,
        bins: Vec<HclPgaBin>,
    },
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum HclPgaFrequencyConversion {
    Poisson,
    Linear,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HclPgaCenter {
    pub state_id: String,
    pub value: f64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HclPgaBin {
    pub state_id: String,
    pub median_frequency: f64,
    pub error_factor95: f64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct HclUncertaintySettings {
    pub sample_count: usize,
    pub seed: u64,
    #[serde(default, alias = "basic_event_sampler")]
    pub sampler: HclSampler,
    #[serde(default)]
    pub cpt_probability_clip_epsilon: f64,
    pub basic_event_distributions: Vec<HclBasicEventUncertaintySpec>,
    pub cpt_row_distributions: Vec<HclCptRowUncertaintySpec>,
    /// Source node order: row-prior nodes (first occurrence), then this list.
    #[serde(default)]
    pub cpt_generators: Vec<HclCptGeneratorSpec>,
}

/// Compact empirical distribution returned by PRAXIS after uncertainty
/// propagation. The same sample indices are retained internally where event-
/// tree aggregation needs correlated sequence totals.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HclUncertaintySummary {
    pub sample_count: usize,
    pub seed: u64,
    pub mean: f64,
    /// HCL_MH quantifier population SD: variance divides by the sample count.
    pub standard_deviation: f64,
    pub minimum: f64,
    pub percentile_05: f64,
    pub median: f64,
    pub percentile_95: f64,
    pub maximum: f64,
}

impl HclUncertaintySummary {
    pub fn from_samples(samples: &[f64], seed: u64) -> Result<Self> {
        if samples.is_empty() {
            return Err(crate::PraxisError::Hcl(
                "uncertainty propagation returned no samples".to_string(),
            ));
        }
        if samples
            .iter()
            .any(|sample| !sample.is_finite() || *sample < 0.0)
        {
            return Err(crate::PraxisError::Hcl(
                "uncertainty propagation returned an invalid sample".to_string(),
            ));
        }
        let mut sorted = samples.to_vec();
        sorted.sort_by(|left, right| left.total_cmp(right));
        // HCL_MH runner.py::_vector_stats uses the original vector for mean
        // and population SD; only quantiles need ordered values.
        let mean = numpy_statistics::mean(samples);
        let standard_deviation = numpy_statistics::population_standard_deviation(samples, mean);
        Ok(Self {
            sample_count: sorted.len(),
            seed,
            mean,
            standard_deviation,
            minimum: sorted[0],
            percentile_05: numpy_statistics::percentile(&sorted, 0.05),
            median: numpy_statistics::median(&sorted),
            percentile_95: numpy_statistics::percentile(&sorted, 0.95),
            maximum: sorted[sorted.len() - 1],
        })
    }
}

/// Stable, serializable result returned by [`crate::hcl::analyze_hcl`].
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct HclAnalysisResult {
    pub probability: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uncertainty: Option<HclUncertaintySummary>,
    #[serde(skip)]
    pub uncertainty_samples: Option<Vec<f64>>,
    pub bdd_nodes: usize,
    pub bdd_variables: usize,
    pub variable_order: Vec<String>,
    pub bridge: HclBridgeStats,
    pub junction_tree: HclJunctionTreeStats,
}

/// Compilation work shared by every evidence row in one HCL batch.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct HclBatchCompilationStats {
    pub bdd_compilations: usize,
    pub junction_tree_compilations: usize,
    pub scenario_evaluations: usize,
}

/// Exact HCL results produced from one compiled BDD and junction tree.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct HclBatchResult {
    pub results: Vec<HclAnalysisResult>,
    /// Original input indices for evaluated scenarios; zero-weight point rows are omitted.
    pub scenario_indices: Vec<usize>,
    pub compilation: HclBatchCompilationStats,
}

/// HCL batch results plus exact P(hazard assignment | common evidence) weights.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct HclHazardGridBatchResult {
    pub quantification: HclBatchResult,
    pub raw_weights: Vec<f64>,
}

impl HclAnalysisResult {
    pub fn to_json_pretty(&self) -> Result<String> {
        serde_json::to_string_pretty(self)
            .map_err(|error| crate::PraxisError::Serialization(error.to_string()))
    }
}

/// Adapts application analysis settings to the unchanged probability-only API.
impl From<&HclAnalysisSettings> for HclSettings {
    fn from(settings: &HclAnalysisSettings) -> Self {
        Self {
            variable_order: settings.variable_order.clone(),
            fold_constants: settings.fold_constants,
            splice_null_gates: settings.splice_null_gates,
        }
    }
}
