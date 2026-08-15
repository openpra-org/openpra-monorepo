use crate::NodeId;
use thiserror::Error;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, Error, PartialEq)]
pub enum Error {
    #[error("a variable named '{0}' already exists")]
    DuplicateVariableName(String),

    #[error("variable names cannot be empty")]
    EmptyVariableName,

    #[error("variable '{0}' must define at least one state")]
    EmptyStateSet(String),

    #[error("variable '{variable}' contains a duplicate state label '{state}'")]
    DuplicateStateLabel { variable: String, state: String },

    #[error("unknown node {0}")]
    UnknownNode(NodeId),

    #[error("unknown variable '{0}'")]
    UnknownVariable(String),

    #[error("state {state} is outside node {node}'s cardinality {cardinality}")]
    UnknownState {
        node: NodeId,
        state: usize,
        cardinality: usize,
    },

    #[error("a node cannot be its own parent: {0}")]
    SelfEdge(NodeId),

    #[error("edge {parent} -> {child} already exists")]
    DuplicateEdge { parent: NodeId, child: NodeId },

    #[error("adding edge {parent} -> {child} would create a cycle")]
    GraphCycle { parent: NodeId, child: NodeId },

    #[error("node {node} requires a CPT with {family_size} values per batch, but got {actual}")]
    InvalidCptSize {
        node: NodeId,
        family_size: usize,
        actual: usize,
    },

    #[error("node {node} has no CPT")]
    MissingCpt { node: NodeId },

    #[error("node {node}'s CPT contains a non-finite value at index {index}")]
    NonFiniteProbability { node: NodeId, index: usize },

    #[error("node {node}'s CPT contains {value} outside [0, 1] at index {index}")]
    ProbabilityOutOfRange {
        node: NodeId,
        index: usize,
        value: f64,
    },

    #[error("node {node}'s CPT row {parent_configuration}, batch {batch} sums to {sum}, expected 1 ± {tolerance}")]
    CptRowNotNormalized {
        node: NodeId,
        parent_configuration: usize,
        batch: usize,
        sum: f64,
        tolerance: f64,
    },

    #[error("arithmetic overflow while computing {context}")]
    DimensionOverflow { context: &'static str },

    #[error("tensor shape cannot be empty")]
    EmptyTensorShape,

    #[error("tensor data length {actual} does not match shape size {expected}")]
    TensorDataLength { expected: usize, actual: usize },

    #[error("tensor index has {actual} axes, expected {expected}")]
    TensorRankMismatch { expected: usize, actual: usize },

    #[error("tensor index {index} is outside axis {axis} of size {size}")]
    TensorIndexOutOfBounds {
        axis: usize,
        index: usize,
        size: usize,
    },

    #[error("factor scope and tensor rank are incompatible")]
    FactorRankMismatch,

    #[error("node {node} has conflicting cardinalities {left} and {right} in factor operation")]
    FactorCardinalityMismatch {
        node: NodeId,
        left: usize,
        right: usize,
    },

    #[error("factor batch sizes {left} and {right} cannot be broadcast")]
    FactorBatchMismatch { left: usize, right: usize },

    #[error("factor operation references node {0} outside its scope")]
    NodeOutsideFactor(NodeId),

    #[error("cannot compile an empty Bayesian graph")]
    EmptyGraph,

    #[error("junction-tree compilation could not place the CPT for node {0}")]
    CptAssignmentFailure(NodeId),

    #[error("evidence batch size must be greater than zero")]
    EmptyEvidenceBatch,

    #[error("evidence contains {actual} values, expected {expected}")]
    EvidenceLength { expected: usize, actual: usize },

    #[error("evidence width {actual} does not match model width {expected}")]
    EvidenceWidth { expected: usize, actual: usize },

    #[error("evidence value {state} for node {node} is invalid; use -1 for unobserved")]
    InvalidEvidenceState { node: NodeId, state: i32 },

    #[error("soft evidence for node {node} has {actual} values, expected {expected}")]
    SoftEvidenceCardinality {
        node: NodeId,
        expected: usize,
        actual: usize,
    },

    #[error("soft-evidence batch size {actual} does not match inference batch size {expected}")]
    SoftEvidenceBatch { expected: usize, actual: usize },

    #[error("soft evidence for node {node} contains invalid likelihood {value} at index {index}")]
    InvalidLikelihood {
        node: NodeId,
        index: usize,
        value: f64,
    },

    #[error("CPT batch size {actual} for node {node} must be 1 or match inference batch size {expected}")]
    CptBatchMismatch {
        node: NodeId,
        expected: usize,
        actual: usize,
    },

    #[error("query list cannot be empty")]
    EmptyQuery,

    #[error("evidence has zero probability in batch row {batch}")]
    ZeroMassEvidence { batch: usize },

    #[error("workspace has not been calibrated")]
    WorkspaceNotCalibrated,
}
