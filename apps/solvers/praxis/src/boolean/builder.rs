use std::collections::{HashMap, HashSet};

use crate::boolean::contract::{
    BasicEventBinding, BasicEventBindingTable, BasicEventId, BooleanModel, BooleanNode,
    BooleanOperator, CcfGroupTable, CcfParameterModel, NodeId, ParameterDistribution,
};
use crate::core::ccf::{CcfGroup, CcfModel};
use crate::core::event::{BasicEvent, Distribution, HouseEvent};
use crate::core::fault_tree::FaultTree;
use crate::core::gate::{Formula, Gate};
use crate::{PraxisError, Result};

const LOGNORMAL_EF_QUANTILE: f64 = 1.6448536269514722;

pub fn gate_operand_id(node_id: NodeId) -> String {
    format!("g{node_id}")
}

pub fn basic_event_operand_id(basic_event_id: BasicEventId) -> String {
    format!("b{basic_event_id}")
}

pub fn house_operand_id(node_id: NodeId) -> String {
    format!("h{node_id}")
}

pub fn numeric_basic_event_id(operand_id: &str) -> Option<BasicEventId> {
    operand_id
        .strip_prefix('b')
        .and_then(|rest| rest.parse().ok())
}

pub struct BindingIndex<'a> {
    bindings: HashMap<BasicEventId, &'a BasicEventBinding>,
    house_states: HashMap<NodeId, bool>,
}

impl<'a> BindingIndex<'a> {
    pub fn new(table: &'a BasicEventBindingTable) -> Self {
        let mut bindings = HashMap::new();
        for binding in &table.bindings {
            bindings.insert(binding.basic_event_id, binding);
        }
        let mut house_states = HashMap::new();
        for state in &table.house_event_states {
            house_states.insert(state.house_event_id, state.state);
        }
        BindingIndex {
            bindings,
            house_states,
        }
    }

    pub fn nominal_probability(&self, basic_event_id: BasicEventId) -> f64 {
        let Some(binding) = self.bindings.get(&basic_event_id) else {
            return 0.0;
        };
        if let Some(p) = binding.point_probability {
            return p.clamp(0.0, 1.0);
        }
        binding
            .distribution
            .as_ref()
            .map(|d| distribution_mean(d).clamp(0.0, 1.0))
            .unwrap_or(0.0)
    }

    pub fn distribution(&self, basic_event_id: BasicEventId) -> Option<Distribution> {
        self.bindings
            .get(&basic_event_id)
            .and_then(|binding| binding.distribution.as_ref())
            .and_then(praxis_distribution)
    }

    pub fn house_state(&self, node_id: NodeId) -> bool {
        self.house_states.get(&node_id).copied().unwrap_or(false)
    }

    pub fn initiating_frequency(&self, basic_event_id: BasicEventId) -> Option<f64> {
        self.bindings
            .get(&basic_event_id)
            .and_then(|binding| binding.point_probability)
    }
}

fn distribution_mean(distribution: &ParameterDistribution) -> f64 {
    match distribution {
        ParameterDistribution::Lognormal {
            median,
            error_factor,
        } => {
            let mu = median.ln();
            let sigma = error_factor.ln() / LOGNORMAL_EF_QUANTILE;
            (mu + sigma * sigma / 2.0).exp()
        }
        ParameterDistribution::Normal { mean, .. } => *mean,
        ParameterDistribution::Uniform { lower, upper } => (lower + upper) / 2.0,
        ParameterDistribution::PointEstimate { value } => *value,
        _ => 0.0,
    }
}

fn praxis_distribution(distribution: &ParameterDistribution) -> Option<Distribution> {
    match distribution {
        ParameterDistribution::Normal { mean, std_dev } => {
            Some(Distribution::Normal(*mean, *std_dev))
        }
        ParameterDistribution::Lognormal {
            median,
            error_factor,
        } => Some(Distribution::LogNormal(
            median.ln(),
            error_factor.ln() / LOGNORMAL_EF_QUANTILE,
        )),
        ParameterDistribution::Uniform { lower, upper } => {
            Some(Distribution::Uniform(*lower, *upper))
        }
        _ => None,
    }
}

fn to_formula(operator: BooleanOperator, k: Option<usize>) -> Result<Formula> {
    Ok(match operator {
        BooleanOperator::And => Formula::And,
        BooleanOperator::Or => Formula::Or,
        BooleanOperator::Not => Formula::Not,
        BooleanOperator::Xor => Formula::Xor,
        BooleanOperator::Atleast => Formula::AtLeast {
            min: k.ok_or_else(|| {
                PraxisError::Logic("ATLEAST gate requires the k parameter".to_string())
            })?,
        },
        BooleanOperator::Null => Formula::Or,
    })
}

pub fn is_gate_node(model: &BooleanModel, node_id: NodeId) -> bool {
    matches!(model.nodes.get(&node_id), Some(BooleanNode::Gate { .. }))
}

pub fn build_root_fault_tree(
    model: &BooleanModel,
    bindings: &BindingIndex,
    ccf_groups: &CcfGroupTable,
    fault_tree_id: &str,
    root_node_id: NodeId,
    apply_ccf: bool,
) -> Result<FaultTree> {
    if !is_gate_node(model, root_node_id) {
        return Err(PraxisError::Logic(format!(
            "Root node {root_node_id} is not a gate"
        )));
    }

    let mut fault_tree = FaultTree::new(fault_tree_id, gate_operand_id(root_node_id))?;
    let mut visited: HashSet<NodeId> = HashSet::new();
    let mut added_basic: HashSet<BasicEventId> = HashSet::new();
    let mut stack = vec![root_node_id];

    while let Some(node_id) = stack.pop() {
        if !visited.insert(node_id) {
            continue;
        }
        let node = model.nodes.get(&node_id).ok_or_else(|| {
            PraxisError::Logic(format!("Referenced node {node_id} is not in the model"))
        })?;
        match node {
            BooleanNode::Gate {
                id,
                operator,
                inputs,
                k,
            } => {
                let mut gate = Gate::new(gate_operand_id(*id), to_formula(*operator, *k)?)?;
                for input in inputs {
                    let target = model.nodes.get(input).ok_or_else(|| {
                        PraxisError::Logic(format!("Gate {id} references missing node {input}"))
                    })?;
                    let operand = match target {
                        BooleanNode::Gate { .. } => gate_operand_id(*input),
                        BooleanNode::BasicEvent { basic_event_id, .. } => {
                            basic_event_operand_id(*basic_event_id)
                        }
                        BooleanNode::HouseEvent { .. } => house_operand_id(*input),
                    };
                    gate.add_operand(operand);
                    stack.push(*input);
                }
                fault_tree.add_gate(gate)?;
            }
            BooleanNode::BasicEvent { basic_event_id, .. } => {
                if added_basic.insert(*basic_event_id) {
                    let mut basic_event = BasicEvent::new(
                        basic_event_operand_id(*basic_event_id),
                        bindings.nominal_probability(*basic_event_id),
                    )?;
                    basic_event.set_distribution(bindings.distribution(*basic_event_id));
                    fault_tree.add_basic_event(basic_event)?;
                }
            }
            BooleanNode::HouseEvent { id } => {
                fault_tree.add_house_event(HouseEvent::new(
                    house_operand_id(*id),
                    bindings.house_state(*id),
                )?)?;
            }
        }
    }

    if apply_ccf {
        attach_ccf_groups(&mut fault_tree, ccf_groups)?;
    }

    Ok(fault_tree)
}

fn attach_ccf_groups(fault_tree: &mut FaultTree, table: &CcfGroupTable) -> Result<()> {
    let mut base_probabilities = HashMap::new();
    for group in &table.groups {
        let members: Vec<String> = group
            .member_basic_event_ids
            .iter()
            .map(|id| basic_event_operand_id(*id))
            .collect();
        if members.is_empty()
            || !members
                .iter()
                .all(|member| fault_tree.basic_events().contains_key(member))
        {
            continue;
        }
        let group_id = format!("c{}", group.id);
        let (model, total_failure_probability) = to_ccf_model(&group.model);
        fault_tree.add_ccf_group(CcfGroup::new(group_id.clone(), members, model)?)?;
        base_probabilities.insert(group_id, total_failure_probability);
    }
    if !base_probabilities.is_empty() {
        fault_tree.expand_ccf_groups(&base_probabilities)?;
    }
    Ok(())
}

fn to_ccf_model(model: &CcfParameterModel) -> (CcfModel, f64) {
    match model {
        CcfParameterModel::BetaFactor {
            beta,
            total_failure_probability,
        } => (CcfModel::BetaFactor(*beta), *total_failure_probability),
        CcfParameterModel::Mgl {
            beta,
            gamma,
            delta,
            additional_factors,
            total_failure_probability,
        } => {
            let mut factors = vec![*beta];
            if let Some(gamma) = gamma {
                factors.push(*gamma);
            }
            if let Some(delta) = delta {
                factors.push(*delta);
            }
            factors.extend(additional_factors.values().copied());
            (CcfModel::Mgl(factors), *total_failure_probability)
        }
        CcfParameterModel::AlphaFactor {
            alpha_factors,
            total_failure_probability,
        } => (
            CcfModel::AlphaFactor(alpha_factors.values().copied().collect()),
            *total_failure_probability,
        ),
        CcfParameterModel::PhiFactor {
            phi_factors,
            total_failure_probability,
        } => (
            CcfModel::PhiFactor(phi_factors.values().copied().collect()),
            *total_failure_probability,
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::boolean::contract::{BasicEventBinding, HouseEventStateBinding};

    fn gate(id: NodeId, operator: BooleanOperator, inputs: Vec<NodeId>) -> BooleanNode {
        BooleanNode::Gate {
            id,
            operator,
            inputs,
            k: None,
        }
    }

    fn basic(id: NodeId, basic_event_id: BasicEventId) -> BooleanNode {
        BooleanNode::BasicEvent { id, basic_event_id }
    }

    fn binding(basic_event_id: BasicEventId, probability: f64) -> BasicEventBinding {
        BasicEventBinding {
            basic_event_id,
            point_probability: Some(probability),
            ..Default::default()
        }
    }

    fn or_model() -> (BooleanModel, BasicEventBindingTable) {
        let mut model = BooleanModel {
            id: 1,
            ..Default::default()
        };
        model
            .nodes
            .insert(1, gate(1, BooleanOperator::Or, vec![2, 3]));
        model.nodes.insert(2, basic(2, 10));
        model.nodes.insert(3, basic(3, 11));
        let bindings = BasicEventBindingTable {
            id: 1,
            bindings: vec![binding(10, 0.1), binding(11, 0.2)],
            ..Default::default()
        };
        (model, bindings)
    }

    #[test]
    fn builds_or_tree_with_prefixed_ids() {
        let (model, table) = or_model();
        let index = BindingIndex::new(&table);
        let fault_tree =
            build_root_fault_tree(&model, &index, &CcfGroupTable::default(), "ft1", 1, false)
                .unwrap();

        assert_eq!(fault_tree.top_event(), "g1");
        let top = fault_tree.get_gate("g1").unwrap();
        assert_eq!(top.formula(), &Formula::Or);
        assert_eq!(top.operands(), ["b10", "b11"]);
        assert_eq!(
            fault_tree.get_basic_event("b10").unwrap().probability(),
            0.1
        );
        assert_eq!(
            fault_tree.get_basic_event("b11").unwrap().probability(),
            0.2
        );
    }

    #[test]
    fn shared_basic_event_nodes_dedupe() {
        let mut model = BooleanModel {
            id: 1,
            ..Default::default()
        };
        model
            .nodes
            .insert(1, gate(1, BooleanOperator::And, vec![2, 3]));
        model.nodes.insert(2, basic(2, 10));
        model.nodes.insert(3, basic(3, 10));
        let table = BasicEventBindingTable {
            id: 1,
            bindings: vec![binding(10, 0.5)],
            ..Default::default()
        };
        let index = BindingIndex::new(&table);
        let fault_tree =
            build_root_fault_tree(&model, &index, &CcfGroupTable::default(), "ft1", 1, false)
                .unwrap();
        assert_eq!(fault_tree.basic_events().len(), 1);
    }

    #[test]
    fn house_event_state_comes_from_bindings() {
        let mut model = BooleanModel {
            id: 1,
            ..Default::default()
        };
        model
            .nodes
            .insert(1, gate(1, BooleanOperator::And, vec![2, 3]));
        model.nodes.insert(2, basic(2, 10));
        model.nodes.insert(3, BooleanNode::HouseEvent { id: 3 });
        let table = BasicEventBindingTable {
            id: 1,
            bindings: vec![binding(10, 0.5)],
            house_event_states: vec![HouseEventStateBinding {
                house_event_id: 3,
                state: true,
            }],
            ..Default::default()
        };
        let index = BindingIndex::new(&table);
        let fault_tree =
            build_root_fault_tree(&model, &index, &CcfGroupTable::default(), "ft1", 1, false)
                .unwrap();
        assert!(fault_tree.get_house_event("h3").unwrap().state());
    }

    #[test]
    fn non_gate_root_is_rejected() {
        let (model, table) = or_model();
        let index = BindingIndex::new(&table);
        let result =
            build_root_fault_tree(&model, &index, &CcfGroupTable::default(), "ft1", 2, false);
        assert!(result.is_err());
    }

    #[test]
    fn beta_factor_ccf_expands_events() {
        let (model, table) = or_model();
        let index = BindingIndex::new(&table);
        let ccf = CcfGroupTable {
            id: 1,
            boolean_model_ref: 1,
            groups: vec![crate::boolean::contract::CcfGroup {
                id: 7,
                name: None,
                member_basic_event_ids: vec![10, 11],
                model: CcfParameterModel::BetaFactor {
                    beta: 0.1,
                    total_failure_probability: 0.01,
                },
                data_analysis_ccf_parameter_ref: None,
            }],
        };
        let fault_tree = build_root_fault_tree(&model, &index, &ccf, "ft1", 1, true).unwrap();
        assert!(fault_tree.basic_events().len() > 2);
        assert_eq!(fault_tree.ccf_groups().len(), 1);
    }
}
