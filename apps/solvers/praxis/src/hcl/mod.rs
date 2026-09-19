//! Hybrid Causal Logic bridge between PRAXIS BDDs and TensorBayes.
//!
//! Main's original probability API is separate from the existing branch
//! analyses used by the application addon. See README.md for the source boundary.

mod analysis;
pub(crate) use analysis::bridge_delta;
mod api;
mod bayesian;
mod binding;
mod hazard;
mod hazard_sweep;
mod input;
mod model;
mod numpy_statistics;
pub(crate) mod ordering;
mod quantify;
mod request;
mod uncertainty;

pub use analysis::{
    analyze_hcl, quantify_hcl_batch, quantify_hcl_hazard_grid_batch, HclAnalysisResult,
    HclAnalysisSettings, HclBasicEventUncertaintySpec, HclBatchCompilationStats, HclBatchResult,
    HclCptGenerator, HclCptGeneratorSpec, HclCptPrior, HclCptRowUncertaintySpec,
    HclHazardGridBatchResult, HclPgaBin, HclPgaCenter, HclPgaFrequencyConversion,
    HclProbabilityDistribution, HclSampler, HclUncertaintySettings, HclUncertaintySummary,
};
pub use api::quantify_hcl;
pub use bayesian::{
    query_bayesian_network, query_bayesian_network_batch, BayesianBatchResult, BayesianMarginal,
    BayesianStateProbability,
};
pub use binding::{HclBaseEvidence, HclEventBinding, HclEventBindings};
pub use hazard::ensure_hazard_convolution_supported;
pub(crate) use hazard::{conditional_evidence_probabilities_for_network, prepare_hazard_evidence};
pub use hazard_sweep::{
    generate_hazard_sweep_scenarios, HazardDimension, HazardSweepScenario, HazardSweepSpec,
};
pub use input::{parse_xdsl, CanonicalBayesianNetwork, CanonicalBayesianVariable};
pub use model::{
    HclBindingSpec, HclBridgeStats, HclEvidenceSpec, HclJunctionTreeStats, HclModel, HclResult,
    HclSettings,
};
pub use ordering::source_fault_tree_order;
pub use quantify::HclQuantifier;
pub use request::{HclNetworkInput, HclRequest, HCL_REQUEST_VERSION};
pub use uncertainty::validate_hcl_uncertainty_settings;
pub(crate) use uncertainty::PreparedHclUncertainty;

#[cfg(test)]
mod summary_source_tests;

#[cfg(test)]
mod hazard_source_tests;
