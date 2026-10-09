use std::collections::{BTreeMap, HashMap};

use crate::algorithms::bdd_engine::{Bdd, BddRef};
use crate::algorithms::build::build_sequence_bdd_with_successes;
use crate::algorithms::pdag::PdagNode;
use crate::analysis::sequence_formula::SequenceFormulaBuilder;
use crate::core::event_tree::EventTree;
use crate::core::model::Model;
use crate::{PraxisError, Result};

#[derive(Clone, Copy, Debug, PartialEq)]
enum Link {
    False,
    True,
    Node { index: usize, complement: bool },
}

#[derive(Clone, Copy, Debug)]
struct FlatNode {
    var: usize,
    high: Link,
    low: Link,
}

#[derive(Clone, Debug)]
pub struct SequenceDiagram {
    pub sequence_id: String,
    pub variables: Vec<String>,
    pub nominal: Vec<f64>,
    nodes: Vec<FlatNode>,
    root: Link,
}

impl SequenceDiagram {
    fn certain(sequence_id: String) -> Self {
        Self {
            sequence_id,
            variables: Vec::new(),
            nominal: Vec::new(),
            nodes: Vec::new(),
            root: Link::True,
        }
    }

    fn from_bdd(sequence_id: String, bdd: &Bdd, root: BddRef, variables: Vec<String>) -> Result<Self> {
        let nominal = bdd.var_probs().to_vec();
        if nominal.len() < variables.len() {
            return Err(PraxisError::Logic(format!(
                "sequence '{sequence_id}' has fewer variable probabilities than variables"
            )));
        }
        let mut index_of: HashMap<i32, usize> = HashMap::new();
        let mut nodes: Vec<FlatNode> = Vec::new();
        let mut stack: Vec<(BddRef, bool)> = Vec::new();
        if !root.is_terminal() {
            stack.push((root.regular(), false));
        }
        while let Some((reference, expanded)) = stack.pop() {
            let key = reference.raw();
            if index_of.contains_key(&key) {
                continue;
            }
            let node = *bdd.node(reference);
            if expanded {
                let link = |child: BddRef, index_of: &HashMap<i32, usize>| -> Result<Link> {
                    if child.is_true() {
                        return Ok(Link::True);
                    }
                    if child.is_false() {
                        return Ok(Link::False);
                    }
                    let index = index_of.get(&child.regular().raw()).copied().ok_or_else(|| {
                        PraxisError::Logic("decision diagram child was not flattened before its parent".to_string())
                    })?;
                    Ok(Link::Node { index, complement: child.is_complement() })
                };
                if node.var >= variables.len() {
                    return Err(PraxisError::Logic(format!(
                        "sequence '{sequence_id}' tests a variable outside its order"
                    )));
                }
                let flat = FlatNode {
                    var: node.var,
                    high: link(node.high, &index_of)?,
                    low: link(node.low, &index_of)?,
                };
                index_of.insert(key, nodes.len());
                nodes.push(flat);
                continue;
            }
            stack.push((reference, true));
            for child in [node.high, node.low] {
                if !child.is_terminal() && !index_of.contains_key(&child.regular().raw()) {
                    stack.push((child.regular(), false));
                }
            }
        }
        let root = if root.is_true() {
            Link::True
        } else if root.is_false() {
            Link::False
        } else {
            let index = index_of.get(&root.regular().raw()).copied().ok_or_else(|| {
                PraxisError::Logic(format!("sequence '{sequence_id}' lost its root while flattening"))
            })?;
            Link::Node { index, complement: root.is_complement() }
        };
        let mut nominal = nominal;
        nominal.truncate(variables.len());
        Ok(Self { sequence_id, variables, nominal, nodes, root })
    }

    fn signed(link: Link, negate: bool, values: &[f64]) -> f64 {
        match link {
            Link::False => {
                if negate {
                    1.0
                } else {
                    0.0
                }
            }
            Link::True => {
                if negate {
                    0.0
                } else {
                    1.0
                }
            }
            Link::Node { index, complement } => values[2 * index + usize::from(complement != negate)],
        }
    }

    pub fn node_count(&self) -> usize {
        self.nodes.len()
    }

    pub fn evaluate(&self, probabilities: &[f64], values: &mut Vec<f64>) -> f64 {
        values.clear();
        values.resize(2 * self.nodes.len(), 0.0);
        for (index, node) in self.nodes.iter().enumerate() {
            let p = probabilities[node.var];
            values[2 * index] = p * Self::signed(node.high, false, values) + (1.0 - p) * Self::signed(node.low, false, values);
            values[2 * index + 1] = p * Self::signed(node.high, true, values) + (1.0 - p) * Self::signed(node.low, true, values);
        }
        Self::signed(self.root, false, values)
    }

    pub fn gradient(&self, probabilities: &[f64]) -> (f64, Vec<f64>) {
        let mut values = Vec::new();
        let value = self.evaluate(probabilities, &mut values);
        let mut gradient = vec![0.0; self.variables.len()];
        let mut adjoint = vec![0.0; 2 * self.nodes.len()];
        if let Link::Node { index, complement } = self.root {
            adjoint[2 * index + usize::from(complement)] = 1.0;
        }
        for index in (0..self.nodes.len()).rev() {
            let node = self.nodes[index];
            let p = probabilities[node.var];
            for polarity in 0..2 {
                let weight = adjoint[2 * index + polarity];
                if weight == 0.0 {
                    continue;
                }
                let negate = polarity == 1;
                gradient[node.var] += weight * (Self::signed(node.high, negate, &values) - Self::signed(node.low, negate, &values));
                if let Link::Node { index: child, complement } = node.high {
                    adjoint[2 * child + usize::from(complement != negate)] += weight * p;
                }
                if let Link::Node { index: child, complement } = node.low {
                    adjoint[2 * child + usize::from(complement != negate)] += weight * (1.0 - p);
                }
            }
        }
        (value, gradient)
    }
}

pub fn compile_sequence_diagrams(model: &Model, event_tree: &EventTree) -> Result<Vec<SequenceDiagram>> {
    let formulas = SequenceFormulaBuilder::new(model).build(event_tree, 1.0)?;
    let mut sequence_ids: Vec<String> = event_tree.sequences.keys().cloned().collect();
    sequence_ids.sort();
    let mut pdag = formulas.pdag;
    let mut diagrams = Vec::with_capacity(sequence_ids.len());
    for sequence_id in sequence_ids {
        if formulas.unconditional.contains(&sequence_id) {
            diagrams.push(SequenceDiagram::certain(sequence_id));
            continue;
        }
        let root = formulas.sequence_roots.get(&sequence_id).copied().ok_or_else(|| {
            PraxisError::Logic(format!("event-tree sequence '{sequence_id}' has no Boolean formula"))
        })?;
        let (order, bdd, bdd_root, _) =
            build_sequence_bdd_with_successes(&mut pdag, &formulas.event_probs, root, &[], &sequence_id)?;
        let variables = order
            .iter()
            .map(|index| match pdag.get_node(*index) {
                Some(PdagNode::BasicEvent { id, .. }) => Ok(id.clone()),
                _ => Err(PraxisError::Logic(format!(
                    "sequence '{sequence_id}' orders a node that is not a basic event"
                ))),
            })
            .collect::<Result<Vec<_>>>()?;
        diagrams.push(SequenceDiagram::from_bdd(sequence_id, &bdd, bdd_root, variables)?);
    }
    Ok(diagrams)
}

#[derive(Clone, Debug, PartialEq)]
pub struct TargetChange {
    pub id: String,
    pub decrease: f64,
    pub increase: f64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct FamilyImportance {
    pub family_id: String,
    pub base: f64,
    pub events: Vec<TargetChange>,
    pub groups: Vec<TargetChange>,
}

#[derive(Clone, Debug)]
pub struct ImportanceGroup {
    pub key: String,
    pub events: Vec<String>,
}

#[derive(Default)]
struct FamilyAccumulator {
    base: f64,
    events: BTreeMap<String, (f64, f64)>,
    groups: BTreeMap<String, (f64, f64)>,
}

pub fn importance_by_family(
    diagrams: &[SequenceDiagram],
    family_of: &HashMap<String, String>,
    frequency: f64,
    groups: &[ImportanceGroup],
) -> Vec<FamilyImportance> {
    let mut families: BTreeMap<String, FamilyAccumulator> = BTreeMap::new();
    let mut values = Vec::new();
    for diagram in diagrams {
        let Some(family_id) = family_of.get(&diagram.sequence_id) else {
            continue;
        };
        let slot = families.entry(family_id.clone()).or_default();
        let (value, gradient) = diagram.gradient(&diagram.nominal);
        slot.base += frequency * value;
        for (var, id) in diagram.variables.iter().enumerate() {
            let birnbaum = gradient[var];
            if birnbaum == 0.0 {
                continue;
            }
            let p = diagram.nominal[var];
            let entry = slot.events.entry(id.clone()).or_insert((0.0, 0.0));
            entry.0 += frequency * p * birnbaum;
            entry.1 += frequency * (1.0 - p) * birnbaum;
        }
        let position: HashMap<&str, usize> = diagram
            .variables
            .iter()
            .enumerate()
            .map(|(var, id)| (id.as_str(), var))
            .collect();
        for group in groups {
            let members: Vec<usize> = group
                .events
                .iter()
                .filter_map(|event| position.get(event.as_str()).copied())
                .collect();
            if members.is_empty() {
                continue;
            }
            let mut probabilities = diagram.nominal.clone();
            for &var in &members {
                probabilities[var] = 0.0;
            }
            let removed = diagram.evaluate(&probabilities, &mut values);
            for &var in &members {
                probabilities[var] = 1.0;
            }
            let failed = diagram.evaluate(&probabilities, &mut values);
            if removed == value && failed == value {
                continue;
            }
            let entry = slot.groups.entry(group.key.clone()).or_insert((0.0, 0.0));
            entry.0 += frequency * (value - removed);
            entry.1 += frequency * (failed - value);
        }
    }
    families
        .into_iter()
        .map(|(family_id, slot)| FamilyImportance {
            family_id,
            base: slot.base,
            events: slot
                .events
                .into_iter()
                .map(|(id, (decrease, increase))| TargetChange { id, decrease, increase })
                .collect(),
            groups: slot
                .groups
                .into_iter()
                .map(|(id, (decrease, increase))| TargetChange { id, decrease, increase })
                .collect(),
        })
        .collect()
}

pub fn sample_families(
    diagrams: &[SequenceDiagram],
    family_of: &HashMap<String, String>,
    frequency: f64,
    sampled_frequency: Option<&[f64]>,
    variables: &HashMap<String, Vec<f64>>,
    trials: usize,
) -> Result<BTreeMap<String, Vec<f64>>> {
    if variables.values().any(|column| column.len() != trials)
        || sampled_frequency.is_some_and(|column| column.len() != trials)
    {
        return Err(PraxisError::Settings(
            "every sampled input needs one value per trial".to_string(),
        ));
    }
    let mut families: BTreeMap<String, Vec<f64>> = BTreeMap::new();
    let mut values = Vec::new();
    for diagram in diagrams {
        let Some(family_id) = family_of.get(&diagram.sequence_id) else {
            continue;
        };
        let sampled: Vec<(usize, &Vec<f64>)> = diagram
            .variables
            .iter()
            .enumerate()
            .filter_map(|(var, id)| variables.get(id).map(|column| (var, column)))
            .collect();
        let totals = families.entry(family_id.clone()).or_insert_with(|| vec![0.0; trials]);
        let mut probabilities = diagram.nominal.clone();
        for (trial, total) in totals.iter_mut().enumerate() {
            for (var, column) in &sampled {
                probabilities[*var] = column[trial];
            }
            let weight = sampled_frequency.map_or(frequency, |column| column[trial]);
            *total += weight * diagram.evaluate(&probabilities, &mut values);
        }
    }
    Ok(families)
}
