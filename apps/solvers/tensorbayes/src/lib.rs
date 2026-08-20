//! Exact inference for finite, discrete Bayesian networks.
//!
//! TensorBayes owns only generic Bayesian-network concepts. PRAXIS-specific
//! Boolean bindings and Hybrid Causal Logic traversal belong in PRAXIS.

mod compiler;
mod engine;
mod error;
mod factor;
mod graph;
mod junction_tree;
mod tensor;
mod workspace;

pub use compiler::CompileHeuristic;
pub use engine::{EvidenceBatch, ExecutionEngine, MarginalBatch, MultiMarginalBatch};
pub use error::{Error, Result};
pub use factor::Factor;
pub use graph::{BayesianGraph, NodeId, StateIndex, Variable, UNOBSERVED};
pub use junction_tree::{Clique, CompiledJunctionTree, JunctionTreeStats, Separator};
pub use tensor::DenseTensor;
pub use workspace::InferenceWorkspace;
