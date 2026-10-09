use serde::{Deserialize, Serialize};

use crate::core::distribution::{
    UncertainExpression, UncertainParameter, UncertainVector, UncertainVectorParameter,
};
use crate::core::distribution_sampling::{SamplingMethod, SamplingPlan};
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

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
pub enum HclSampler {
    #[serde(rename = "MC")]
    MonteCarlo,
    #[serde(rename = "LHS")]
    LatinHypercube,
}

impl HclSampler {
    pub fn method(self) -> SamplingMethod {
        match self {
            HclSampler::MonteCarlo => SamplingMethod::MonteCarlo,
            HclSampler::LatinHypercube => SamplingMethod::LatinHypercube,
        }
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HclBasicEventUncertainty {
    pub event: String,
    pub expression: UncertainExpression,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HclCptRowUncertainty {
    pub node: String,
    pub row_index: usize,
    pub row: UncertainVector,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HclCptGeneratorSpec {
    pub node: String,
    pub generator: HclCptGenerator,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "SCREAMING_SNAKE_CASE",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum HclCptGenerator {
    SeismicFragility {
        pga_parent_id: String,
        true_state_id: String,
        false_state_id: String,
        median: UncertainExpression,
        randomness: UncertainExpression,
        demands: Vec<HclFragilityDemand>,
    },
    SeismicPgaBins {
        none_state_id: String,
        mission_time: UncertainExpression,
        conversion: HclPgaFrequencyConversion,
        bins: Vec<HclPgaBin>,
    },
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum HclPgaFrequencyConversion {
    Poisson,
    Linear,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HclFragilityDemand {
    pub state_id: String,
    pub demand: f64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HclPgaBin {
    pub state_id: String,
    pub frequency: UncertainExpression,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HclUncertaintySettings {
    pub sample_count: usize,
    pub seed: u64,
    pub sampler: HclSampler,
    #[serde(default)]
    pub basic_events: Vec<HclBasicEventUncertainty>,
    #[serde(default)]
    pub cpt_rows: Vec<HclCptRowUncertainty>,
    #[serde(default)]
    pub cpt_generators: Vec<HclCptGeneratorSpec>,
    #[serde(default)]
    pub uncertainty_parameters: Vec<UncertainParameter>,
    #[serde(default)]
    pub uncertainty_vectors: Vec<UncertainVectorParameter>,
}

impl HclUncertaintySettings {
    pub fn plan(&self) -> SamplingPlan {
        SamplingPlan {
            method: self.sampler.method(),
            trials: self.sample_count,
            seed: self.seed,
        }
    }
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
