use crate::engine::{EvidenceBatch, MarginalBatch, MultiMarginalBatch};
use crate::{CompiledJunctionTree, Error, Factor, NodeId, Result, UNOBSERVED};
use std::collections::HashMap;
use std::sync::Arc;

#[derive(Clone, Debug)]
enum SoftEvidence {
    Shared(Vec<f64>),
    Batched { batch_size: usize, values: Vec<f64> },
}

/// Mutable calibration state reusable across evidence batches.
#[derive(Debug)]
pub struct InferenceWorkspace {
    tree: Arc<CompiledJunctionTree>,
    batch_size: usize,
    clique_potentials: Vec<Factor>,
    messages: Vec<Vec<Option<Factor>>>,
    calibrated_potentials: Vec<Factor>,
    node_to_clique: Vec<usize>,
    soft_evidence: HashMap<NodeId, SoftEvidence>,
    calibrated: bool,
}

impl InferenceWorkspace {
    pub fn new(tree: Arc<CompiledJunctionTree>) -> Self {
        let node_to_clique = build_node_to_clique(&tree);
        Self {
            tree,
            batch_size: 0,
            clique_potentials: Vec::new(),
            messages: Vec::new(),
            calibrated_potentials: Vec::new(),
            node_to_clique,
            soft_evidence: HashMap::new(),
            calibrated: false,
        }
    }

    pub fn tree(&self) -> &CompiledJunctionTree {
        &self.tree
    }

    pub fn batch_size(&self) -> usize {
        self.batch_size
    }

    pub fn is_calibrated(&self) -> bool {
        self.calibrated
    }

    pub fn set_soft_evidence(&mut self, node: NodeId, likelihoods: &[f64]) -> Result<()> {
        let cardinality = self.tree.graph().cardinality(node)?;
        validate_likelihoods(node, cardinality, likelihoods)?;
        self.soft_evidence
            .insert(node, SoftEvidence::Shared(likelihoods.to_vec()));
        self.calibrated = false;
        Ok(())
    }

    /// Stores row-major `[batch, state]` virtual evidence for a node.
    pub fn set_soft_evidence_batch(
        &mut self,
        node: NodeId,
        batch_size: usize,
        likelihoods: &[f64],
    ) -> Result<()> {
        if batch_size == 0 {
            return Err(Error::EmptyEvidenceBatch);
        }
        let cardinality = self.tree.graph().cardinality(node)?;
        let expected = batch_size
            .checked_mul(cardinality)
            .ok_or(Error::DimensionOverflow {
                context: "soft-evidence matrix",
            })?;
        if likelihoods.len() != expected {
            return Err(Error::SoftEvidenceCardinality {
                node,
                expected,
                actual: likelihoods.len(),
            });
        }
        validate_likelihood_values(node, likelihoods)?;
        self.soft_evidence.insert(
            node,
            SoftEvidence::Batched {
                batch_size,
                values: likelihoods.to_vec(),
            },
        );
        self.calibrated = false;
        Ok(())
    }

    pub fn clear_soft_evidence(&mut self) {
        self.soft_evidence.clear();
        self.calibrated = false;
    }

    /// Drops derived potentials and messages while retaining persistent soft evidence.
    pub fn invalidate(&mut self) {
        self.batch_size = 0;
        self.clique_potentials.clear();
        self.messages.clear();
        self.calibrated_potentials.clear();
        self.calibrated = false;
    }

    pub fn calibrate(&mut self, evidence: &EvidenceBatch) -> Result<()> {
        validate_evidence(&self.tree, evidence)?;
        self.validate_batch_geometry(evidence.batch_size())?;
        self.batch_size = evidence.batch_size();
        self.calibrated = false;
        self.rebuild_clique_potentials()?;
        self.apply_evidence(evidence)?;

        let clique_count = self.tree.cliques().len();
        self.messages = vec![vec![None; clique_count]; clique_count];
        let (parent, order) = tree_order(&self.tree);

        for &child in order.iter().rev() {
            if child == 0 {
                continue;
            }
            let parent_clique = parent[child];
            let message = self.compute_message(child, parent_clique)?;
            self.messages[child][parent_clique] = Some(message);
        }
        for &parent_clique in &order {
            for &child in self.tree.cliques()[parent_clique].neighbors() {
                if parent[child] == parent_clique {
                    let message = self.compute_message(parent_clique, child)?;
                    self.messages[parent_clique][child] = Some(message);
                }
            }
        }

        self.calibrated_potentials.clear();
        self.calibrated_potentials.reserve(clique_count);
        for clique_id in 0..clique_count {
            let mut belief = self.clique_potentials[clique_id].clone();
            for &neighbor in self.tree.cliques()[clique_id].neighbors() {
                let message = self.messages[neighbor][clique_id]
                    .as_ref()
                    .expect("tree schedule must construct every directed message");
                belief = belief.multiply(message)?;
            }
            self.calibrated_potentials.push(belief);
        }

        let partition = self.calibrated_potentials[0].project_to(&[])?;
        for batch in 0..self.batch_size {
            let mass = partition.tensor().values()[batch];
            if !mass.is_finite() || mass <= 0.0 {
                return Err(Error::ZeroMassEvidence { batch });
            }
        }

        self.calibrated = true;
        Ok(())
    }

    pub fn query_marginal(&self, node: NodeId) -> Result<MarginalBatch> {
        if !self.calibrated {
            return Err(Error::WorkspaceNotCalibrated);
        }
        let cardinality = self.tree.graph().cardinality(node)?;
        let clique_id = *self
            .node_to_clique
            .get(node.index())
            .ok_or(Error::UnknownNode(node))?;
        let marginal = self.calibrated_potentials[clique_id].project_to(&[node])?;
        let values = normalized_row_major(&marginal, cardinality)?;
        Ok(MarginalBatch::new(self.batch_size, cardinality, values))
    }

    pub fn query_marginals(&self, queries: &[NodeId]) -> Result<MultiMarginalBatch> {
        if queries.is_empty() {
            return Err(Error::EmptyQuery);
        }
        if !self.calibrated {
            return Err(Error::WorkspaceNotCalibrated);
        }

        let mut offsets = Vec::with_capacity(queries.len() + 1);
        offsets.push(0);
        for &query in queries {
            let next = offsets.last().copied().unwrap() + self.tree.graph().cardinality(query)?;
            offsets.push(next);
        }
        let total_states = *offsets.last().unwrap();
        let mut values = vec![0.0; self.batch_size * total_states];
        for (query_index, &query) in queries.iter().enumerate() {
            let marginal = self.query_marginal(query)?;
            let start = offsets[query_index];
            let width = marginal.num_states();
            for batch in 0..self.batch_size {
                let source = &marginal.values()[batch * width..(batch + 1) * width];
                let destination_start = batch * total_states + start;
                values[destination_start..destination_start + width].copy_from_slice(source);
            }
        }
        Ok(MultiMarginalBatch::new(
            self.batch_size,
            queries.to_vec(),
            offsets,
            values,
        ))
    }

    fn validate_batch_geometry(&self, batch_size: usize) -> Result<()> {
        for variable in self.tree.graph().variables() {
            let cpt_batch = self.tree.graph().cpt_batch_size(variable.id())?;
            if cpt_batch != 1 && cpt_batch != batch_size {
                return Err(Error::CptBatchMismatch {
                    node: variable.id(),
                    expected: batch_size,
                    actual: cpt_batch,
                });
            }
        }
        for soft in self.soft_evidence.values() {
            if let SoftEvidence::Batched {
                batch_size: actual, ..
            } = soft
            {
                if *actual != batch_size {
                    return Err(Error::SoftEvidenceBatch {
                        expected: batch_size,
                        actual: *actual,
                    });
                }
            }
        }
        Ok(())
    }

    fn rebuild_clique_potentials(&mut self) -> Result<()> {
        self.clique_potentials.clear();
        self.clique_potentials.reserve(self.tree.cliques().len());
        for clique in self.tree.cliques() {
            let cardinalities = clique
                .scope()
                .iter()
                .map(|&node| self.tree.graph().cardinality(node))
                .collect::<Result<Vec<_>>>()?;
            let mut potential =
                Factor::ones(clique.scope().to_vec(), cardinalities, self.batch_size)?;
            for &node in clique.assigned_cpts() {
                let family = self.tree.graph().family_scope(node)?;
                let family_cardinalities = family
                    .iter()
                    .map(|&member| self.tree.graph().cardinality(member))
                    .collect::<Result<Vec<_>>>()?;
                let variable = self.tree.graph().variable(node)?;
                let cpt = Factor::from_values(
                    family,
                    family_cardinalities,
                    self.tree.graph().cpt_batch_size(node)?,
                    variable.cpt().to_vec(),
                )?;
                potential = potential.multiply(&cpt)?;
            }
            self.clique_potentials.push(potential);
        }
        Ok(())
    }

    fn apply_evidence(&mut self, evidence: &EvidenceBatch) -> Result<()> {
        for variable in self.tree.graph().variables() {
            let node = variable.id();
            let cardinality = variable.cardinality();
            let soft = self.soft_evidence.get(&node);
            let has_hard = (0..self.batch_size)
                .any(|batch| evidence.raw_state(batch, node.index()) != UNOBSERVED);
            if !has_hard && soft.is_none() {
                continue;
            }

            let mut likelihoods = vec![1.0; cardinality * self.batch_size];
            for state in 0..cardinality {
                for batch in 0..self.batch_size {
                    let hard_state = evidence.raw_state(batch, node.index());
                    let hard = if hard_state == UNOBSERVED || hard_state as usize == state {
                        1.0
                    } else {
                        0.0
                    };
                    let virtual_likelihood = match soft {
                        None => 1.0,
                        Some(SoftEvidence::Shared(values)) => values[state],
                        Some(SoftEvidence::Batched { values, .. }) => {
                            values[batch * cardinality + state]
                        }
                    };
                    likelihoods[state * self.batch_size + batch] = hard * virtual_likelihood;
                }
            }
            let evidence_factor =
                Factor::from_values(vec![node], vec![cardinality], self.batch_size, likelihoods)?;
            let clique_id = self.node_to_clique[node.index()];
            self.clique_potentials[clique_id] =
                self.clique_potentials[clique_id].multiply(&evidence_factor)?;
        }
        Ok(())
    }

    fn compute_message(&self, from: usize, to: usize) -> Result<Factor> {
        let mut product = self.clique_potentials[from].clone();
        for &neighbor in self.tree.cliques()[from].neighbors() {
            if neighbor == to {
                continue;
            }
            let message = self.messages[neighbor][from]
                .as_ref()
                .expect("tree schedule must construct prerequisite messages");
            product = product.multiply(message)?;
        }
        let separator_id =
            self.tree.separator_by_edge[from][to].expect("adjacent cliques must have a separator");
        product.project_to(self.tree.separators()[separator_id].scope())
    }
}

fn build_node_to_clique(tree: &CompiledJunctionTree) -> Vec<usize> {
    let mut mapping = vec![usize::MAX; tree.graph().num_variables()];
    for clique in tree.cliques() {
        for &node in clique.scope() {
            if mapping[node.index()] == usize::MAX {
                mapping[node.index()] = clique.id();
            }
        }
    }
    mapping
}

fn tree_order(tree: &CompiledJunctionTree) -> (Vec<usize>, Vec<usize>) {
    let count = tree.cliques().len();
    let mut parent = vec![usize::MAX; count];
    let mut order = Vec::with_capacity(count);
    let mut stack = vec![0usize];
    parent[0] = 0;
    while let Some(clique) = stack.pop() {
        order.push(clique);
        for &neighbor in tree.cliques()[clique].neighbors().iter().rev() {
            if parent[neighbor] == usize::MAX {
                parent[neighbor] = clique;
                stack.push(neighbor);
            }
        }
    }
    (parent, order)
}

fn validate_evidence(tree: &CompiledJunctionTree, evidence: &EvidenceBatch) -> Result<()> {
    if evidence.num_variables() != tree.graph().num_variables() {
        return Err(Error::EvidenceWidth {
            expected: tree.graph().num_variables(),
            actual: evidence.num_variables(),
        });
    }
    for batch in 0..evidence.batch_size() {
        for variable in tree.graph().variables() {
            let state = evidence.raw_state(batch, variable.id().index());
            if state < UNOBSERVED || state >= variable.cardinality() as i32 {
                return Err(Error::InvalidEvidenceState {
                    node: variable.id(),
                    state,
                });
            }
        }
    }
    Ok(())
}

fn validate_likelihoods(node: NodeId, cardinality: usize, values: &[f64]) -> Result<()> {
    if values.len() != cardinality {
        return Err(Error::SoftEvidenceCardinality {
            node,
            expected: cardinality,
            actual: values.len(),
        });
    }
    validate_likelihood_values(node, values)
}

fn validate_likelihood_values(node: NodeId, values: &[f64]) -> Result<()> {
    for (index, &value) in values.iter().enumerate() {
        if !value.is_finite() || value < 0.0 {
            return Err(Error::InvalidLikelihood { node, index, value });
        }
    }
    Ok(())
}

fn normalized_row_major(factor: &Factor, cardinality: usize) -> Result<Vec<f64>> {
    let batch_size = factor.batch_size();
    let mut values = vec![0.0; batch_size * cardinality];
    for batch in 0..batch_size {
        let mut sum = 0.0;
        for state in 0..cardinality {
            sum += factor.tensor().values()[state * batch_size + batch];
        }
        if !sum.is_finite() || sum <= 0.0 {
            return Err(Error::ZeroMassEvidence { batch });
        }
        for state in 0..cardinality {
            values[batch * cardinality + state] =
                factor.tensor().values()[state * batch_size + batch] / sum;
        }
    }
    Ok(values)
}
