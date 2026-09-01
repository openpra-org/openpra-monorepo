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
#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(default, deny_unknown_fields)]
pub struct HclSettings {
    /// Exact basic-event order. When omitted, PRAXIS uses its normal BDD order.
    pub variable_order: Option<Vec<String>>,
    pub fold_constants: bool,
    pub splice_null_gates: bool,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct HclJunctionTreeStats {
    pub num_cliques: usize,
    pub max_clique_size: usize,
    pub treewidth: usize,
    pub total_table_entries: usize,
}

/// Stable, serializable result returned by [`crate::hcl::quantify_hcl`].
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct HclResult {
    pub probability: f64,
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
}

impl HclResult {
    pub fn to_json_pretty(&self) -> Result<String> {
        serde_json::to_string_pretty(self)
            .map_err(|error| crate::PraxisError::Serialization(error.to_string()))
    }
}
