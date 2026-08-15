//! Hybrid Causal Logic bridge between PRAXIS BDDs and TensorBayes.
//!
//! Model I/O and the final public request envelope are Phase 4 concerns. This
//! module contains the Phase 3 computational boundary only.

mod binding;
mod model;
mod quantify;

pub use binding::{HclBaseEvidence, HclEventBinding, HclEventBindings};
pub use model::HclBridgeStats;
pub use quantify::HclQuantifier;
