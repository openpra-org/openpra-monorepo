use crate::{Error, Result};
use std::collections::{HashMap, HashSet};
use std::fmt;

/// Hard-evidence sentinel used by [`crate::EvidenceBatch`].
pub const UNOBSERVED: i32 = -1;

#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub struct NodeId(u32);

impl NodeId {
    pub const fn new(value: u32) -> Self {
        Self(value)
    }

    pub const fn index(self) -> usize {
        self.0 as usize
    }
}

impl fmt::Display for NodeId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<NodeId> for usize {
    fn from(value: NodeId) -> Self {
        value.index()
    }
}

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub struct StateIndex(usize);

impl StateIndex {
    pub const fn new(value: usize) -> Self {
        Self(value)
    }

    pub const fn index(self) -> usize {
        self.0
    }
}

#[derive(Clone, Debug)]
pub struct Variable {
    id: NodeId,
    name: String,
    states: Vec<String>,
    cpt: Vec<f64>,
}

impl Variable {
    pub fn id(&self) -> NodeId {
        self.id
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn states(&self) -> &[String] {
        &self.states
    }

    pub fn cardinality(&self) -> usize {
        self.states.len()
    }

    pub fn cpt(&self) -> &[f64] {
        &self.cpt
    }
}

/// A mutable finite, discrete Bayesian DAG.
///
/// Parent order is insertion order and is part of the CPT layout contract.
/// A node's flat CPT axes are `[parents..., child, batch]`; the final batch
/// axis is omitted for a scalar CPT.
#[derive(Clone, Debug, Default)]
pub struct BayesianGraph {
    variables: Vec<Variable>,
    name_to_id: HashMap<String, NodeId>,
    parents: Vec<Vec<NodeId>>,
    children: Vec<Vec<NodeId>>,
}

impl BayesianGraph {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add_variable<S: AsRef<str>>(&mut self, name: &str, states: &[S]) -> Result<NodeId> {
        if name.is_empty() {
            return Err(Error::EmptyVariableName);
        }
        if self.name_to_id.contains_key(name) {
            return Err(Error::DuplicateVariableName(name.to_owned()));
        }
        if states.is_empty() {
            return Err(Error::EmptyStateSet(name.to_owned()));
        }

        let mut labels = Vec::with_capacity(states.len());
        let mut seen = HashSet::with_capacity(states.len());
        for state in states {
            let label = state.as_ref().to_owned();
            if !seen.insert(label.clone()) {
                return Err(Error::DuplicateStateLabel {
                    variable: name.to_owned(),
                    state: label,
                });
            }
            labels.push(label);
        }

        let raw_id = u32::try_from(self.variables.len()).map_err(|_| Error::DimensionOverflow {
            context: "node identifier",
        })?;
        let id = NodeId::new(raw_id);
        self.variables.push(Variable {
            id,
            name: name.to_owned(),
            states: labels,
            cpt: Vec::new(),
        });
        self.name_to_id.insert(name.to_owned(), id);
        self.parents.push(Vec::new());
        self.children.push(Vec::new());
        Ok(id)
    }

    pub fn add_edge(&mut self, parent: NodeId, child: NodeId) -> Result<()> {
        self.ensure_node(parent)?;
        self.ensure_node(child)?;
        if parent == child {
            return Err(Error::SelfEdge(parent));
        }
        if self.parents[child.index()].contains(&parent) {
            return Err(Error::DuplicateEdge { parent, child });
        }
        if self.can_reach(child, parent) {
            return Err(Error::GraphCycle { parent, child });
        }

        self.parents[child.index()].push(parent);
        self.children[parent.index()].push(child);
        Ok(())
    }

    pub fn add_edge_by_name(&mut self, parent: &str, child: &str) -> Result<()> {
        self.add_edge(self.node_id(parent)?, self.node_id(child)?)
    }

    pub fn set_cpt(&mut self, node: NodeId, values: Vec<f64>) -> Result<()> {
        self.ensure_node(node)?;
        let family_size = self.family_size(node)?;
        if values.is_empty() || !values.len().is_multiple_of(family_size) {
            return Err(Error::InvalidCptSize {
                node,
                family_size,
                actual: values.len(),
            });
        }
        self.variables[node.index()].cpt = values;
        Ok(())
    }

    pub fn set_cpt_by_name(&mut self, name: &str, values: Vec<f64>) -> Result<()> {
        self.set_cpt(self.node_id(name)?, values)
    }

    pub fn validate(&self) -> Result<()> {
        self.validate_with_tolerance(1e-6)
    }

    pub fn validate_with_tolerance(&self, tolerance: f64) -> Result<()> {
        for variable in &self.variables {
            let node = variable.id;
            if variable.cpt.is_empty() {
                return Err(Error::MissingCpt { node });
            }
            let family_size = self.family_size(node)?;
            if !variable.cpt.len().is_multiple_of(family_size) {
                return Err(Error::InvalidCptSize {
                    node,
                    family_size,
                    actual: variable.cpt.len(),
                });
            }
            let batch_size = variable.cpt.len() / family_size;
            let cardinality = variable.cardinality();
            let parent_configurations = family_size / cardinality;

            for batch in 0..batch_size {
                for parent_configuration in 0..parent_configurations {
                    let mut sum = 0.0;
                    for state in 0..cardinality {
                        let family_index = parent_configuration * cardinality + state;
                        let index = if batch_size == 1 {
                            family_index
                        } else {
                            family_index * batch_size + batch
                        };
                        let value = variable.cpt[index];
                        if !value.is_finite() {
                            return Err(Error::NonFiniteProbability { node, index });
                        }
                        if !(0.0..=1.0).contains(&value) {
                            return Err(Error::ProbabilityOutOfRange { node, index, value });
                        }
                        sum += value;
                    }
                    if (sum - 1.0).abs() > tolerance {
                        return Err(Error::CptRowNotNormalized {
                            node,
                            parent_configuration,
                            batch,
                            sum,
                            tolerance,
                        });
                    }
                }
            }
        }
        Ok(())
    }

    pub fn variable(&self, node: NodeId) -> Result<&Variable> {
        self.variables
            .get(node.index())
            .ok_or(Error::UnknownNode(node))
    }

    pub fn variable_by_name(&self, name: &str) -> Result<&Variable> {
        self.variable(self.node_id(name)?)
    }

    pub fn node_id(&self, name: &str) -> Result<NodeId> {
        self.name_to_id
            .get(name)
            .copied()
            .ok_or_else(|| Error::UnknownVariable(name.to_owned()))
    }

    pub fn parents(&self, node: NodeId) -> Result<&[NodeId]> {
        self.parents
            .get(node.index())
            .map(Vec::as_slice)
            .ok_or(Error::UnknownNode(node))
    }

    pub fn children(&self, node: NodeId) -> Result<&[NodeId]> {
        self.children
            .get(node.index())
            .map(Vec::as_slice)
            .ok_or(Error::UnknownNode(node))
    }

    pub fn variables(&self) -> &[Variable] {
        &self.variables
    }

    pub fn num_variables(&self) -> usize {
        self.variables.len()
    }

    pub fn family_scope(&self, node: NodeId) -> Result<Vec<NodeId>> {
        let mut scope = self.parents(node)?.to_vec();
        scope.push(node);
        Ok(scope)
    }

    pub fn family_size(&self, node: NodeId) -> Result<usize> {
        let mut size = self.variable(node)?.cardinality();
        for parent in self.parents(node)? {
            size = size
                .checked_mul(self.variable(*parent)?.cardinality())
                .ok_or(Error::DimensionOverflow {
                    context: "CPT family size",
                })?;
        }
        Ok(size)
    }

    pub fn cpt_batch_size(&self, node: NodeId) -> Result<usize> {
        let variable = self.variable(node)?;
        if variable.cpt.is_empty() {
            return Err(Error::MissingCpt { node });
        }
        Ok(variable.cpt.len() / self.family_size(node)?)
    }

    pub(crate) fn cardinality(&self, node: NodeId) -> Result<usize> {
        Ok(self.variable(node)?.cardinality())
    }

    fn ensure_node(&self, node: NodeId) -> Result<()> {
        self.variable(node).map(|_| ())
    }

    fn can_reach(&self, start: NodeId, target: NodeId) -> bool {
        let mut stack = vec![start];
        let mut visited = vec![false; self.num_variables()];
        visited[start.index()] = true;
        while let Some(node) = stack.pop() {
            if node == target {
                return true;
            }
            for &child in &self.children[node.index()] {
                if !visited[child.index()] {
                    visited[child.index()] = true;
                    stack.push(child);
                }
            }
        }
        false
    }
}
