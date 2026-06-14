use std::collections::{BTreeMap, HashMap, HashSet};

use crate::boolean::contract::{
    BasicEventBinding, BasicEventBindingTable, BasicEventId, BasicEventValue, BooleanModel,
    BooleanNode, BooleanOperator, CcfGroupTable, CcfParameterModel, CcfTestingScheme, Exposure,
    NodeId, RateBasis, RawDataPrior, RawDataSpec, SummaryCentral, SummaryFamily, SummarySpec,
    SummarySpread,
};
use crate::core::ccf::{CcfGroup, CcfModel, TestingScheme};
use crate::core::event::{BasicEvent, HouseEvent};
use crate::core::fault_tree::FaultTree;
use crate::core::gate::{Formula, Gate};
use crate::expression::{EvalContext, Expr};
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
    parameters: &'a HashMap<String, Expr>,
    mission_time: f64,
}

impl<'a> BindingIndex<'a> {
    pub fn new(table: &'a BasicEventBindingTable, mission_time: f64) -> Self {
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
            parameters: &table.parameters,
            mission_time,
        }
    }

    pub fn parameters(&self) -> &HashMap<String, Expr> {
        self.parameters
    }

    pub fn mission_time(&self) -> f64 {
        self.mission_time
    }

    pub fn resolve(&self, basic_event_id: BasicEventId) -> Result<(f64, Option<Expr>)> {
        let Some(binding) = self.bindings.get(&basic_event_id) else {
            return Ok((0.0, None));
        };
        resolve_value(&binding.value, self.parameters, self.mission_time)
    }

    pub fn nominal_probability(&self, basic_event_id: BasicEventId) -> f64 {
        self.resolve(basic_event_id)
            .map(|(nominal, _)| nominal.clamp(0.0, 1.0))
            .unwrap_or(0.0)
    }

    pub fn house_state(&self, node_id: NodeId) -> bool {
        self.house_states.get(&node_id).copied().unwrap_or(false)
    }

    pub fn initiating_frequency(&self, basic_event_id: BasicEventId) -> Option<f64> {
        let binding = self.bindings.get(&basic_event_id)?;
        resolve_value(&binding.value, self.parameters, self.mission_time)
            .ok()
            .map(|(nominal, _)| nominal)
    }
}

fn resolve_value(
    value: &BasicEventValue,
    parameters: &HashMap<String, Expr>,
    mission_time: f64,
) -> Result<(f64, Option<Expr>)> {
    let ctx = EvalContext::new(parameters, mission_time, mission_time);
    match value {
        BasicEventValue::Probability(p) => Ok((*p, None)),
        BasicEventValue::Rate {
            rate,
            basis,
            mission_time: mt,
        } => match basis {
            RateBasis::PerDemand => Ok((*rate, None)),
            RateBasis::PerHour => {
                let time = mt.map(Expr::Constant).unwrap_or(Expr::MissionTime);
                let expr = Expr::Exponential {
                    lambda: Box::new(Expr::Constant(*rate)),
                    time: Box::new(time),
                };
                let nominal = expr.evaluate(&ctx)?;
                Ok((nominal, Some(expr)))
            }
        },
        BasicEventValue::Summary(spec) => {
            let expr = summary_to_expr(spec)?;
            let nominal = expr.evaluate(&ctx)?;
            Ok((nominal, Some(expr)))
        }
        BasicEventValue::RawData(spec) => {
            let expr = rawdata_to_expr(spec)?;
            let nominal = expr.evaluate(&ctx)?;
            Ok((nominal, Some(expr)))
        }
        BasicEventValue::Expression(expr) => {
            let nominal = expr.evaluate(&ctx)?;
            Ok((nominal, Some(expr.clone())))
        }
    }
}

fn summary_to_expr(spec: &SummarySpec) -> Result<Expr> {
    match spec.family {
        SummaryFamily::Lognormal => {
            let sigma = match spec.spread {
                SummarySpread::ErrorFactor(ef) => ef.ln() / LOGNORMAL_EF_QUANTILE,
                SummarySpread::StdDev(sd) => sd,
                SummarySpread::Percentiles { p05, p95 } => {
                    (p95 / p05).ln() / (2.0 * LOGNORMAL_EF_QUANTILE)
                }
            };
            let mu = match spec.central {
                SummaryCentral::Median(median) => median.ln(),
                SummaryCentral::Mean(mean) => mean.ln() - sigma * sigma / 2.0,
            };
            Ok(Expr::lognormal(mu, sigma))
        }
        SummaryFamily::Normal => {
            let sigma = match spec.spread {
                SummarySpread::StdDev(sd) => sd,
                SummarySpread::Percentiles { p05, p95 } => {
                    (p95 - p05) / (2.0 * LOGNORMAL_EF_QUANTILE)
                }
                SummarySpread::ErrorFactor(_) => {
                    return Err(PraxisError::Logic(
                        "error factor is not defined for a normal summary".to_string(),
                    ))
                }
            };
            let mean = match spec.central {
                SummaryCentral::Mean(mean) | SummaryCentral::Median(mean) => mean,
            };
            Ok(Expr::normal(mean, sigma))
        }
    }
}

fn rawdata_to_expr(spec: &RawDataSpec) -> Result<Expr> {
    let prior = match spec.prior {
        RawDataPrior::Jeffreys => 0.5,
        RawDataPrior::Uniform => 1.0,
    };
    match spec.exposure {
        Exposure::Demands(n) => {
            if spec.failures > n {
                return Err(PraxisError::Logic(
                    "raw data: failures cannot exceed demands".to_string(),
                ));
            }
            Ok(Expr::beta(spec.failures + prior, n - spec.failures + prior))
        }
        Exposure::Hours(t) => {
            if t <= 0.0 {
                return Err(PraxisError::Logic(
                    "raw data: exposure time must be positive".to_string(),
                ));
            }
            Ok(Expr::gamma(spec.failures + prior, t))
        }
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
    fault_tree.set_mission_time(bindings.mission_time());
    for (name, expr) in bindings.parameters() {
        fault_tree.set_parameter(name.clone(), expr.clone());
    }
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
                    let (nominal, value_expr) = bindings.resolve(*basic_event_id)?;
                    let mut basic_event = BasicEvent::new(
                        basic_event_operand_id(*basic_event_id),
                        nominal.clamp(0.0, 1.0),
                    )?;
                    basic_event.set_value(value_expr);
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

fn ordered_by_level(map: &BTreeMap<String, f64>) -> Vec<f64> {
    let mut entries: Vec<(usize, f64)> = map
        .iter()
        .filter_map(|(key, value)| key.parse::<usize>().ok().map(|level| (level, *value)))
        .collect();
    entries.sort_by_key(|(level, _)| *level);
    entries.into_iter().map(|(_, value)| value).collect()
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
            factors.extend(ordered_by_level(additional_factors));
            (CcfModel::Mgl(factors), *total_failure_probability)
        }
        CcfParameterModel::AlphaFactor {
            alpha_factors,
            total_failure_probability,
            testing_scheme,
        } => (
            CcfModel::AlphaFactor {
                factors: ordered_by_level(alpha_factors),
                scheme: match testing_scheme {
                    Some(CcfTestingScheme::Staggered) => TestingScheme::Staggered,
                    _ => TestingScheme::NonStaggered,
                },
            },
            *total_failure_probability,
        ),
        CcfParameterModel::PhiFactor {
            phi_factors,
            total_failure_probability,
        } => (
            CcfModel::PhiFactor(ordered_by_level(phi_factors)),
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
            value: BasicEventValue::Probability(probability),
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
        let index = BindingIndex::new(&table, 1.0);
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
        let index = BindingIndex::new(&table, 1.0);
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
        let index = BindingIndex::new(&table, 1.0);
        let fault_tree =
            build_root_fault_tree(&model, &index, &CcfGroupTable::default(), "ft1", 1, false)
                .unwrap();
        assert!(fault_tree.get_house_event("h3").unwrap().state());
    }

    #[test]
    fn non_gate_root_is_rejected() {
        let (model, table) = or_model();
        let index = BindingIndex::new(&table, 1.0);
        let result =
            build_root_fault_tree(&model, &index, &CcfGroupTable::default(), "ft1", 2, false);
        assert!(result.is_err());
    }

    #[test]
    fn beta_factor_ccf_expands_events() {
        let (model, table) = or_model();
        let index = BindingIndex::new(&table, 1.0);
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
