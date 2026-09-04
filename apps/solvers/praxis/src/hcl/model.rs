use serde::{Deserialize, Serialize};
use tensorbayes::BayesianGraph;

use crate::core::fault_tree::FaultTree;
use crate::Result;

#[derive(Clone, Copy, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
pub struct HclBridgeStats {
    pub quantifications: u64,
    pub bdd_context_cache_hits: u64,
    pub bdd_context_cache_misses: u64,
    pub bn_query_cache_hits: u64,
    pub bn_query_cache_misses: u64,
}

/// Name-based binding used by the public HCL API and serialized requests.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct HclBindingSpec {
    pub event: String,
    pub node: String,
    pub true_states: Vec<String>,
}

/// Persistent hard evidence expressed with stable BN node and state names.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct HclEvidenceSpec {
    pub node: String,
    pub state: String,
}

/// Public in-memory HCL model.
#[derive(Clone, Debug)]
pub struct HclModel {
    fault_tree: FaultTree,
    network: BayesianGraph,
    bindings: Vec<HclBindingSpec>,
    base_evidence: Vec<HclEvidenceSpec>,
}

impl HclModel {
    pub fn new(fault_tree: FaultTree, network: BayesianGraph) -> Result<Self> {
        network.validate()?;
        Ok(Self {
            fault_tree,
            network,
            bindings: Vec::new(),
            base_evidence: Vec::new(),
        })
    }

    pub fn with_bindings(mut self, bindings: Vec<HclBindingSpec>) -> Self {
        self.bindings = bindings;
        self
    }

    pub fn with_base_evidence(mut self, base_evidence: Vec<HclEvidenceSpec>) -> Self {
        self.base_evidence = base_evidence;
        self
    }

    pub fn fault_tree(&self) -> &FaultTree {
        &self.fault_tree
    }

    pub fn network(&self) -> &BayesianGraph {
        &self.network
    }

    pub fn bindings(&self) -> &[HclBindingSpec] {
        &self.bindings
    }

    pub fn base_evidence(&self) -> &[HclEvidenceSpec] {
        &self.base_evidence
    }
}

/// Controls construction of the BDD used for HCL quantification.
#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(default, deny_unknown_fields)]
pub struct HclSettings {
    /// Exact basic-event order. When omitted, PRAXIS uses its normal BDD order.
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
    Beta { alpha: f64, beta: f64 },
    Lognormal { median: f64, error_factor: f64 },
    Uniform { lower: f64, upper: f64 },
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
    pub equivalent_sample_size: f64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct HclUncertaintySettings {
    pub sample_count: usize,
    pub seed: u64,
    pub basic_event_distributions: Vec<HclBasicEventUncertaintySpec>,
    pub cpt_row_distributions: Vec<HclCptRowUncertaintySpec>,
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
    pub standard_deviation: f64,
    pub coefficient_of_variation: Option<f64>,
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
        let mean = sorted.iter().sum::<f64>() / sorted.len() as f64;
        let variance = if sorted.len() > 1 {
            sorted
                .iter()
                .map(|sample| (sample - mean).powi(2))
                .sum::<f64>()
                / (sorted.len() - 1) as f64
        } else {
            0.0
        };
        let standard_deviation = variance.sqrt();
        Ok(Self {
            sample_count: sorted.len(),
            seed,
            mean,
            standard_deviation,
            coefficient_of_variation: (mean > 0.0).then_some(standard_deviation / mean),
            minimum: sorted[0],
            percentile_05: percentile(&sorted, 0.05),
            median: percentile(&sorted, 0.50),
            percentile_95: percentile(&sorted, 0.95),
            maximum: sorted[sorted.len() - 1],
        })
    }

    pub fn scaled(&self, factor: f64) -> Self {
        Self {
            sample_count: self.sample_count,
            seed: self.seed,
            mean: self.mean * factor,
            standard_deviation: self.standard_deviation * factor,
            coefficient_of_variation: self.coefficient_of_variation,
            minimum: self.minimum * factor,
            percentile_05: self.percentile_05 * factor,
            median: self.median * factor,
            percentile_95: self.percentile_95 * factor,
            maximum: self.maximum * factor,
        }
    }
}

fn percentile(sorted: &[f64], probability: f64) -> f64 {
    let position = probability * (sorted.len() - 1) as f64;
    let lower = position.floor() as usize;
    let upper = position.ceil() as usize;
    if lower == upper {
        sorted[lower]
    } else {
        let fraction = position - lower as f64;
        sorted[lower] * (1.0 - fraction) + sorted[upper] * fraction
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct HclJunctionTreeStats {
    pub num_cliques: usize,
    pub max_clique_size: usize,
    pub treewidth: usize,
    pub total_table_entries: usize,
}

/// BN state condition associated with one fault-tree literal in an HCL cut set.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HclCutSetBindingTrace {
    pub bayesian_network_node_id: String,
    pub state_ids: Vec<String>,
    pub parent_node_ids: Vec<String>,
}

/// One signed structural fault-tree literal. A binding trace describes the BN
/// condition used to quantify it but never changes structural cut-set identity.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HclCutSetLiteral {
    pub basic_event_id: String,
    pub complemented: bool,
    pub binding: Option<HclCutSetBindingTrace>,
}

/// One structural minimal cut set augmented with an exact HCL joint probability
/// and deterministic BN ancestry metadata.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HclCutSet {
    pub rank: usize,
    pub order: usize,
    pub probability: f64,
    pub coverage: Option<f64>,
    pub literals: Vec<HclCutSetLiteral>,
    pub bn_ancestor_node_ids: Vec<String>,
    pub bn_root_cause_node_ids: Vec<String>,
}

/// Complete structural enumeration for one target and one evidence context.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HclCutSetAnalysis {
    pub total_count: usize,
    pub cut_sets: Vec<HclCutSet>,
}

/// Conventional PRA importance measures for one structural fault-tree basic
/// event under the active HCL evidence context. A BN node id is retained when
/// the event probability originates from a Bayesian binding.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HclImportanceMeasure {
    pub rank: usize,
    pub basic_event_id: String,
    pub bayesian_network_node_id: Option<String>,
    pub event_probability: f64,
    pub probability_if_true: f64,
    pub probability_if_false: f64,
    pub birnbaum: f64,
    pub criticality: Option<f64>,
    pub fussell_vesely: Option<f64>,
    pub risk_achievement_worth: Option<f64>,
    pub risk_reduction_worth: Option<f64>,
}

/// Complete dependency-aware importance ranking for one HCL target.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HclImportanceAnalysis {
    pub total_count: usize,
    pub measures: Vec<HclImportanceMeasure>,
}

/// Stable, serializable result returned by [`crate::hcl::quantify_hcl`].
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct HclResult {
    pub probability: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uncertainty: Option<HclUncertaintySummary>,
    #[serde(skip)]
    pub uncertainty_samples: Option<Vec<f64>>,
    pub cut_sets: HclCutSetAnalysis,
    pub importance: HclImportanceAnalysis,
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
    pub results: Vec<HclResult>,
    pub compilation: HclBatchCompilationStats,
}

/// HCL batch results plus exact P(hazard assignment | common evidence) weights.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct HclHazardGridBatchResult {
    pub quantification: HclBatchResult,
    pub raw_weights: Vec<f64>,
    pub uncertainty_raw_weights: Option<Vec<Vec<f64>>>,
}

impl HclResult {
    pub fn to_json_pretty(&self) -> Result<String> {
        serde_json::to_string_pretty(self)
            .map_err(|error| crate::PraxisError::Serialization(error.to_string()))
    }
}
