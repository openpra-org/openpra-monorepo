//! Hybrid Causal Logic bridge between PRAXIS BDDs and TensorBayes.
//!
//! The Phase 3 computational bridge and Phase 4 public model/I/O boundary live
//! here. OpenPRA/Praetor transport integration remains a Phase 5 concern.

mod api;
mod bayesian;
mod binding;
mod input;
mod model;
mod quantify;
mod request;

pub(crate) use api::conditional_evidence_probabilities_for_network;
pub use api::{quantify_hcl, quantify_hcl_batch, quantify_hcl_hazard_grid_batch};
pub use bayesian::{query_bayesian_network, BayesianMarginal, BayesianStateProbability};
pub use binding::{HclBaseEvidence, HclEventBinding, HclEventBindings};
pub use input::{parse_xdsl, CanonicalBayesianNetwork, CanonicalBayesianVariable};
pub use model::{
    HclBatchCompilationStats, HclBatchResult, HclBindingSpec, HclBridgeStats, HclEvidenceSpec,
    HclHazardGridBatchResult, HclJunctionTreeStats, HclModel, HclResult, HclSettings,
};
pub use quantify::HclQuantifier;
pub use request::{HclNetworkInput, HclRequest, HCL_REQUEST_VERSION};
