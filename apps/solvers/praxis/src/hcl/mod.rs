//! Hybrid Causal Logic bridge between PRAXIS BDDs and TensorBayes.
//!
//! The Phase 3 computational bridge and Phase 4 public model/I/O boundary live
//! here. OpenPRA/Praetor transport integration remains a Phase 5 concern.

mod api;
mod bayesian;
mod binding;
mod cut_sets;
mod importance;
mod input;
mod model;
mod quantify;
mod request;
mod uncertainty;

pub(crate) use api::conditional_evidence_probabilities_for_network;
pub use api::{
    quantify_hcl, quantify_hcl_batch, quantify_hcl_hazard_grid_batch,
    summarize_hcl_hazard_uncertainty,
};
pub use bayesian::{query_bayesian_network, BayesianMarginal, BayesianStateProbability};
pub use binding::{HclBaseEvidence, HclEventBinding, HclEventBindings};
pub(crate) use cut_sets::{evaluate_cut_sets, prepare_cut_sets, HclCutSetTemplate};
pub(crate) use importance::evaluate_importance;
pub use input::{parse_xdsl, CanonicalBayesianNetwork, CanonicalBayesianVariable};
pub use model::{
    HclBasicEventUncertaintySpec, HclBatchCompilationStats, HclBatchResult, HclBindingSpec,
    HclBridgeStats, HclCptRowUncertaintySpec, HclCutSet, HclCutSetAnalysis, HclCutSetBindingTrace,
    HclCutSetLiteral, HclEvidenceSpec, HclHazardGridBatchResult, HclImportanceAnalysis,
    HclImportanceMeasure, HclJunctionTreeStats, HclModel, HclProbabilityDistribution, HclResult,
    HclSettings, HclUncertaintySettings, HclUncertaintySummary,
};
pub use quantify::HclQuantifier;
pub use request::{HclNetworkInput, HclRequest, HCL_REQUEST_VERSION};
pub use uncertainty::validate_hcl_uncertainty_settings;
pub(crate) use uncertainty::PreparedHclUncertainty;
