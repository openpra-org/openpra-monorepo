use std::collections::{HashMap, HashSet};

use tensorbayes::{EvidenceBatch, NodeId, StateIndex, UNOBSERVED};

use crate::algorithms::build::BddBuild;
use crate::algorithms::pdag::PdagNode;
use crate::{PraxisError, Result};

/// Maps one Boolean BDD variable to a state subset of one Bayesian node.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HclEventBinding {
    bdd_variable: usize,
    bn_node: NodeId,
    true_states: Vec<StateIndex>,
}

impl HclEventBinding {
    pub fn new(bdd_variable: usize, bn_node: NodeId, true_states: Vec<StateIndex>) -> Result<Self> {
        if true_states.is_empty() {
            return Err(PraxisError::Hcl(
                "an HCL event binding must contain at least one true state".to_string(),
            ));
        }
        let mut seen = HashSet::with_capacity(true_states.len());
        if true_states.iter().any(|state| !seen.insert(state.index())) {
            return Err(PraxisError::Hcl(
                "an HCL event binding contains duplicate true states".to_string(),
            ));
        }
        Ok(Self {
            bdd_variable,
            bn_node,
            true_states,
        })
    }

    pub fn for_event(
        build: &BddBuild,
        event_id: &str,
        bn_node: NodeId,
        true_states: Vec<StateIndex>,
    ) -> Result<Self> {
        let event_index = build.pdag.get_index(event_id).ok_or_else(|| {
            PraxisError::Hcl(format!("fault-tree event '{event_id}' does not exist"))
        })?;
        if !matches!(
            build.pdag.get_node(event_index),
            Some(PdagNode::BasicEvent { .. })
        ) {
            return Err(PraxisError::Hcl(format!(
                "fault-tree element '{event_id}' is not a basic event"
            )));
        }
        let bdd_variable = build.var_of.get(&event_index).copied().ok_or_else(|| {
            PraxisError::Hcl(format!("fault-tree event '{event_id}' has no BDD variable"))
        })?;
        Self::new(bdd_variable, bn_node, true_states)
    }

    pub fn bdd_variable(&self) -> usize {
        self.bdd_variable
    }

    pub fn bn_node(&self) -> NodeId {
        self.bn_node
    }

    pub fn true_states(&self) -> &[StateIndex] {
        &self.true_states
    }
}

#[derive(Clone, Debug, Default)]
pub struct HclEventBindings {
    by_variable: HashMap<usize, HclEventBinding>,
}

impl HclEventBindings {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn insert(&mut self, binding: HclEventBinding) -> Result<()> {
        let variable = binding.bdd_variable();
        match self.by_variable.entry(variable) {
            std::collections::hash_map::Entry::Vacant(entry) => {
                entry.insert(binding);
            }
            std::collections::hash_map::Entry::Occupied(_) => {
                return Err(PraxisError::Hcl(format!(
                    "BDD variable {variable} has more than one HCL binding"
                )));
            }
        }
        Ok(())
    }

    pub fn get(&self, bdd_variable: usize) -> Option<&HclEventBinding> {
        self.by_variable.get(&bdd_variable)
    }

    pub fn iter(&self) -> impl Iterator<Item = &HclEventBinding> {
        self.by_variable.values()
    }

    pub fn is_empty(&self) -> bool {
        self.by_variable.is_empty()
    }

    pub fn len(&self) -> usize {
        self.by_variable.len()
    }
}

/// Persistent hard BN evidence applied to every HCL probability query.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HclBaseEvidence {
    states: Vec<i32>,
}

impl HclBaseEvidence {
    pub fn unobserved(num_bn_variables: usize) -> Self {
        Self {
            states: vec![UNOBSERVED; num_bn_variables],
        }
    }

    pub fn observe(&mut self, node: NodeId, state: StateIndex) -> Result<()> {
        let Some(slot) = self.states.get_mut(node.index()) else {
            return Err(PraxisError::Hcl(format!(
                "base evidence references unknown BN node {node}"
            )));
        };
        *slot = i32::try_from(state.index()).map_err(|_| {
            PraxisError::Hcl(format!(
                "state {} cannot be represented as hard evidence",
                state.index()
            ))
        })?;
        Ok(())
    }

    pub fn clear(&mut self, node: NodeId) -> Result<()> {
        let Some(slot) = self.states.get_mut(node.index()) else {
            return Err(PraxisError::Hcl(format!(
                "base evidence references unknown BN node {node}"
            )));
        };
        *slot = UNOBSERVED;
        Ok(())
    }

    pub fn states(&self) -> &[i32] {
        &self.states
    }

    pub(crate) fn to_batch(&self) -> Result<EvidenceBatch> {
        EvidenceBatch::new(1, self.states.len(), self.states.clone()).map_err(Into::into)
    }
}
