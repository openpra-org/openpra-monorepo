use crate::{CompiledJunctionTree, Error, InferenceWorkspace, NodeId, Result, UNOBSERVED};
use std::sync::Arc;

/// Row-major hard evidence with one state per model variable.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EvidenceBatch {
    batch_size: usize,
    num_variables: usize,
    states: Vec<i32>,
}

impl EvidenceBatch {
    pub fn new(batch_size: usize, num_variables: usize, states: Vec<i32>) -> Result<Self> {
        if batch_size == 0 {
            return Err(Error::EmptyEvidenceBatch);
        }
        let expected = batch_size
            .checked_mul(num_variables)
            .ok_or(Error::DimensionOverflow {
                context: "evidence matrix",
            })?;
        if states.len() != expected {
            return Err(Error::EvidenceLength {
                expected,
                actual: states.len(),
            });
        }
        Ok(Self {
            batch_size,
            num_variables,
            states,
        })
    }

    pub fn unobserved(batch_size: usize, num_variables: usize) -> Result<Self> {
        let count = batch_size
            .checked_mul(num_variables)
            .ok_or(Error::DimensionOverflow {
                context: "evidence matrix",
            })?;
        Self::new(batch_size, num_variables, vec![UNOBSERVED; count])
    }

    pub fn from_rows(rows: &[Vec<i32>]) -> Result<Self> {
        if rows.is_empty() {
            return Err(Error::EmptyEvidenceBatch);
        }
        let num_variables = rows[0].len();
        let expected = rows.len() * num_variables;
        let mut states = Vec::with_capacity(expected);
        for row in rows {
            if row.len() != num_variables {
                return Err(Error::EvidenceLength {
                    expected,
                    actual: states.len() + row.len(),
                });
            }
            states.extend_from_slice(row);
        }
        Self::new(rows.len(), num_variables, states)
    }

    pub fn batch_size(&self) -> usize {
        self.batch_size
    }

    pub fn num_variables(&self) -> usize {
        self.num_variables
    }

    pub fn states(&self) -> &[i32] {
        &self.states
    }

    pub fn state(&self, batch: usize, node: NodeId) -> Option<i32> {
        if batch >= self.batch_size || node.index() >= self.num_variables {
            return None;
        }
        Some(self.raw_state(batch, node.index()))
    }

    pub(crate) fn raw_state(&self, batch: usize, node: usize) -> i32 {
        self.states[batch * self.num_variables + node]
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct MarginalBatch {
    batch_size: usize,
    num_states: usize,
    values: Vec<f64>,
}

impl MarginalBatch {
    pub(crate) fn new(batch_size: usize, num_states: usize, values: Vec<f64>) -> Self {
        Self {
            batch_size,
            num_states,
            values,
        }
    }

    pub fn batch_size(&self) -> usize {
        self.batch_size
    }

    pub fn num_states(&self) -> usize {
        self.num_states
    }

    pub fn values(&self) -> &[f64] {
        &self.values
    }

    pub fn row(&self, batch: usize) -> Option<&[f64]> {
        (batch < self.batch_size)
            .then(|| &self.values[batch * self.num_states..(batch + 1) * self.num_states])
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct MultiMarginalBatch {
    batch_size: usize,
    queries: Vec<NodeId>,
    offsets: Vec<usize>,
    values: Vec<f64>,
}

impl MultiMarginalBatch {
    pub(crate) fn new(
        batch_size: usize,
        queries: Vec<NodeId>,
        offsets: Vec<usize>,
        values: Vec<f64>,
    ) -> Self {
        Self {
            batch_size,
            queries,
            offsets,
            values,
        }
    }

    pub fn batch_size(&self) -> usize {
        self.batch_size
    }

    pub fn queries(&self) -> &[NodeId] {
        &self.queries
    }

    pub fn offsets(&self) -> &[usize] {
        &self.offsets
    }

    pub fn values(&self) -> &[f64] {
        &self.values
    }

    pub fn marginal(&self, batch: usize, query_index: usize) -> Option<&[f64]> {
        if batch >= self.batch_size || query_index >= self.queries.len() {
            return None;
        }
        let row_width = *self.offsets.last()?;
        let start = batch * row_width + self.offsets[query_index];
        let end = batch * row_width + self.offsets[query_index + 1];
        Some(&self.values[start..end])
    }
}

/// Single-threaded batch executor that reuses one mutable workspace.
#[derive(Debug)]
pub struct ExecutionEngine {
    tree: Arc<CompiledJunctionTree>,
    workspace: InferenceWorkspace,
}

impl ExecutionEngine {
    pub fn new(tree: CompiledJunctionTree) -> Self {
        let tree = Arc::new(tree);
        let workspace = InferenceWorkspace::new(Arc::clone(&tree));
        Self { tree, workspace }
    }

    pub fn junction_tree(&self) -> &CompiledJunctionTree {
        &self.tree
    }

    pub fn workspace(&self) -> &InferenceWorkspace {
        &self.workspace
    }

    pub fn evaluate(&mut self, evidence: &EvidenceBatch, query: NodeId) -> Result<MarginalBatch> {
        self.tree.graph().variable(query)?;
        self.workspace.calibrate(evidence)?;
        self.workspace.query_marginal(query)
    }

    pub fn evaluate_multi(
        &mut self,
        evidence: &EvidenceBatch,
        queries: &[NodeId],
    ) -> Result<MultiMarginalBatch> {
        if queries.is_empty() {
            return Err(Error::EmptyQuery);
        }
        for &query in queries {
            self.tree.graph().variable(query)?;
        }
        self.workspace.calibrate(evidence)?;
        self.workspace.query_marginals(queries)
    }

    /// Returns the exact probability mass of every hard-evidence row.
    pub fn evidence_probabilities(&mut self, evidence: &EvidenceBatch) -> Result<Vec<f64>> {
        self.workspace
            .calibrate_for_evidence_probability(evidence)?;
        Ok(self.workspace.evidence_probabilities()?.to_vec())
    }

    pub fn set_soft_evidence(&mut self, node: NodeId, likelihoods: &[f64]) -> Result<()> {
        self.workspace.set_soft_evidence(node, likelihoods)
    }

    pub fn set_soft_evidence_batch(
        &mut self,
        node: NodeId,
        batch_size: usize,
        likelihoods: &[f64],
    ) -> Result<()> {
        self.workspace
            .set_soft_evidence_batch(node, batch_size, likelihoods)
    }

    pub fn clear_soft_evidence(&mut self) {
        self.workspace.clear_soft_evidence();
    }

    pub fn invalidate_workspace_cache(&mut self) {
        self.workspace.invalidate();
    }
}
