use std::collections::{HashMap, HashSet};

use crate::algorithms::bdd_engine::Bdd;
use crate::algorithms::build::build_sequence_bdd_with_successes;
use crate::algorithms::pdag::{Connective, NodeIndex, Pdag};
use crate::algorithms::zbdd_engine::ZbddEngine;
use crate::analysis::sequence_formula::SequenceFormulaBuilder;
use crate::analysis::width::compute_dfs_metadata_pdag;
use crate::core::event_tree::EventTree;
use crate::core::model::Model;
use crate::{PraxisError, Result};

const MAX_CUT_OFFS: usize = 40;
const SUBSET_ENUMERATION_LIMIT: usize = 16;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CutSetQuantifier {
    MinCutUpperBound,
    RareEvent,
    Exact,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CutOffBasis {
    Probability,
    Frequency,
}

#[derive(Clone, Debug, PartialEq)]
pub struct SequenceCutSetSettings {
    pub cut_offs: Vec<f64>,
    pub basis: CutOffBasis,
    pub quantifier: CutSetQuantifier,
    pub limit_order: Option<usize>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct WeightedCutSet {
    pub events: Vec<String>,
    pub probability: f64,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct CutSetSweepPoint {
    pub cut_off: f64,
    pub count: usize,
    pub probability: f64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct SequenceCutSets {
    pub sequence_id: String,
    pub failed_count: usize,
    pub cut_sets: Vec<WeightedCutSet>,
    pub sweep: Vec<CutSetSweepPoint>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct SequenceCutSetAnalysis {
    pub sequences: Vec<SequenceCutSets>,
    pub event_probabilities: HashMap<String, f64>,
}

impl SequenceCutSetSettings {
    pub fn validate(&self) -> Result<()> {
        if self.cut_offs.is_empty() || self.cut_offs.len() > MAX_CUT_OFFS {
            return Err(PraxisError::Settings(format!(
                "a cut set run needs between 1 and {MAX_CUT_OFFS} cut-offs"
            )));
        }
        for cut_off in &self.cut_offs {
            if !(cut_off.is_finite() && *cut_off > 0.0) {
                return Err(PraxisError::Settings(format!(
                    "cut-off {cut_off} must be a positive number"
                )));
            }
            if self.basis == CutOffBasis::Probability && *cut_off > 1.0 {
                return Err(PraxisError::Settings(format!(
                    "probability cut-off {cut_off} must not exceed 1"
                )));
            }
        }
        if self.cut_offs.windows(2).any(|pair| pair[1] >= pair[0]) {
            return Err(PraxisError::Settings(
                "cut-offs must be given from the highest to the lowest".to_string(),
            ));
        }
        if self.limit_order == Some(0) {
            return Err(PraxisError::Settings(
                "the cut set order limit must be at least 1".to_string(),
            ));
        }
        Ok(())
    }

    pub fn lowest_cut_off(&self) -> f64 {
        self.cut_offs.last().copied().unwrap_or(0.0)
    }
}

pub fn scale_for(basis: CutOffBasis, annual_initiating_frequency: f64) -> f64 {
    match basis {
        CutOffBasis::Frequency => annual_initiating_frequency,
        CutOffBasis::Probability => 1.0,
    }
}

fn product_probability(events: &[String], probabilities: &HashMap<String, f64>) -> Result<f64> {
    events.iter().try_fold(1.0, |product, event| {
        probabilities
            .get(event)
            .map(|p| product * p)
            .ok_or_else(|| {
                PraxisError::Logic(format!("cut set event '{event}' has no probability"))
            })
    })
}

fn sort_cut_sets(cut_sets: &mut [WeightedCutSet]) {
    cut_sets.sort_by(|left, right| {
        right
            .probability
            .total_cmp(&left.probability)
            .then_with(|| left.events.len().cmp(&right.events.len()))
            .then_with(|| left.events.cmp(&right.events))
    });
}

fn names_in_order(pdag: &Pdag, order: &[NodeIndex]) -> Vec<Option<String>> {
    order
        .iter()
        .map(|&index| {
            pdag.get_node(index)
                .and_then(|node| node.id().map(|id| id.to_string()))
        })
        .collect()
}

pub fn sequence_cut_sets(
    model: &Model,
    event_tree: &EventTree,
    settings: &SequenceCutSetSettings,
    annual_initiating_frequency: f64,
) -> Result<SequenceCutSetAnalysis> {
    settings.validate()?;
    let scale = scale_for(settings.basis, annual_initiating_frequency);
    let formulas = SequenceFormulaBuilder::new(model)
        .with_delete_term(true)
        .build(event_tree, 1.0)?;
    let event_probabilities = formulas.event_probs.clone();
    let mut pdag = formulas.pdag;
    let mut sequence_ids: Vec<String> = event_tree.sequences.keys().cloned().collect();
    sequence_ids.sort();
    let lowest = settings.lowest_cut_off();
    let mut sequences = Vec::with_capacity(sequence_ids.len());
    for sequence_id in sequence_ids {
        if formulas.unconditional.contains(&sequence_id) {
            let cut_sets = if scale >= lowest {
                vec![WeightedCutSet {
                    events: Vec::new(),
                    probability: 1.0,
                }]
            } else {
                Vec::new()
            };
            let sweep = cut_set_sweep(&cut_sets, settings, scale, &event_probabilities)?;
            sequences.push(SequenceCutSets {
                sequence_id,
                failed_count: cut_sets.len(),
                cut_sets,
                sweep,
            });
            continue;
        }
        let root = formulas
            .sequence_roots
            .get(&sequence_id)
            .copied()
            .ok_or_else(|| {
                PraxisError::Logic(format!(
                    "event-tree sequence '{sequence_id}' has no Boolean formula"
                ))
            })?;
        let successes = formulas
            .sequence_success_roots
            .get(&sequence_id)
            .cloned()
            .unwrap_or_default();
        let (order, mut bdd, bdd_root, delete_roots) = build_sequence_bdd_with_successes(
            &mut pdag,
            &event_probabilities,
            root,
            &successes,
            &sequence_id,
        )?;
        bdd.freeze();
        let names = names_in_order(&pdag, &order);
        let (failed, failed_root) = ZbddEngine::build_from_bdd_with_limits(
            &bdd,
            bdd_root,
            false,
            settings.limit_order,
            Some(lowest),
            scale,
        );
        let failed_count = failed
            .count_by_order(failed_root)
            .values()
            .map(|&count| count as usize)
            .sum();
        let (zbdd, zbdd_root) = ZbddEngine::build_from_bdd_with_delete_terms(
            &bdd,
            bdd_root,
            &delete_roots,
            false,
            settings.limit_order,
            Some(lowest),
            scale,
        );
        let mut cut_sets = Vec::new();
        for positions in zbdd.enumerate(zbdd_root) {
            let mut events = Vec::with_capacity(positions.len());
            for position in positions {
                let name = names.get(position).cloned().flatten().ok_or_else(|| {
                    PraxisError::Logic(format!(
                        "sequence '{sequence_id}' produced a cut set variable with no event"
                    ))
                })?;
                events.push(name);
            }
            events.sort();
            let probability = product_probability(&events, &event_probabilities)?;
            cut_sets.push(WeightedCutSet {
                events,
                probability,
            });
        }
        sort_cut_sets(&mut cut_sets);
        let sweep = cut_set_sweep(&cut_sets, settings, scale, &event_probabilities)?;
        sequences.push(SequenceCutSets {
            sequence_id,
            failed_count,
            cut_sets,
            sweep,
        });
    }
    Ok(SequenceCutSetAnalysis {
        sequences,
        event_probabilities,
    })
}

pub fn prefix_counts(cut_sets: &[WeightedCutSet], cut_offs: &[f64], scale: f64) -> Vec<usize> {
    cut_offs
        .iter()
        .map(|&cut_off| cut_sets.partition_point(|cut_set| scale * cut_set.probability >= cut_off))
        .collect()
}

pub fn cut_set_sweep(
    cut_sets: &[WeightedCutSet],
    settings: &SequenceCutSetSettings,
    scale: f64,
    event_probabilities: &HashMap<String, f64>,
) -> Result<Vec<CutSetSweepPoint>> {
    let counts = prefix_counts(cut_sets, &settings.cut_offs, scale);
    let probabilities = match settings.quantifier {
        CutSetQuantifier::RareEvent => rare_event_prefixes(cut_sets, &counts),
        CutSetQuantifier::MinCutUpperBound => upper_bound_prefixes(cut_sets, &counts),
        CutSetQuantifier::Exact => exact_prefixes(cut_sets, &counts, event_probabilities)?,
    };
    Ok(settings
        .cut_offs
        .iter()
        .zip(counts)
        .zip(probabilities)
        .map(|((&cut_off, count), probability)| CutSetSweepPoint {
            cut_off,
            count,
            probability,
        })
        .collect())
}

pub fn rare_event_prefixes(cut_sets: &[WeightedCutSet], counts: &[usize]) -> Vec<f64> {
    let mut sums = Vec::with_capacity(counts.len());
    let mut total = 0.0;
    let mut taken = 0;
    for &count in counts {
        for cut_set in &cut_sets[taken..count.max(taken)] {
            total += cut_set.probability;
        }
        taken = taken.max(count);
        sums.push(total.min(1.0));
    }
    sums
}

pub fn upper_bound_prefixes(cut_sets: &[WeightedCutSet], counts: &[usize]) -> Vec<f64> {
    let mut bounds = Vec::with_capacity(counts.len());
    let mut log_survival = 0.0;
    let mut certain = false;
    let mut taken = 0;
    for &count in counts {
        for cut_set in &cut_sets[taken..count.max(taken)] {
            if cut_set.probability >= 1.0 {
                certain = true;
            } else {
                log_survival += (-cut_set.probability).ln_1p();
            }
        }
        taken = taken.max(count);
        bounds.push(if certain { 1.0 } else { -log_survival.exp_m1() });
    }
    bounds
}

pub fn exact_prefixes(
    cut_sets: &[WeightedCutSet],
    counts: &[usize],
    event_probabilities: &HashMap<String, f64>,
) -> Result<Vec<f64>> {
    if counts.is_empty() {
        return Ok(Vec::new());
    }
    let mut pdag = Pdag::new();
    let mut product_nodes: Vec<Option<NodeIndex>> = Vec::with_capacity(cut_sets.len());
    let mut certain_from = None;
    for (position, cut_set) in cut_sets.iter().enumerate() {
        if cut_set.events.is_empty() {
            certain_from.get_or_insert(position);
            product_nodes.push(None);
            continue;
        }
        let literals: Vec<NodeIndex> = cut_set
            .events
            .iter()
            .map(|event| pdag.add_basic_event(event.clone()))
            .collect();
        let node = if literals.len() == 1 {
            literals[0]
        } else {
            pdag.add_gate(
                format!("__CUT_SET__{position}"),
                Connective::And,
                literals,
                None,
            )?
        };
        product_nodes.push(Some(node));
    }
    let mut prefix_roots: Vec<Option<NodeIndex>> = Vec::with_capacity(counts.len());
    let mut previous: Option<NodeIndex> = None;
    let mut taken = 0;
    for (step, &count) in counts.iter().enumerate() {
        let mut operands: Vec<NodeIndex> = previous.into_iter().collect();
        operands.extend(
            product_nodes[taken..count.max(taken)]
                .iter()
                .flatten()
                .copied(),
        );
        taken = taken.max(count);
        let root = match operands.len() {
            0 => None,
            1 => Some(operands[0]),
            _ => Some(pdag.add_gate(
                format!("__CUT_PREFIX__{step}"),
                Connective::Or,
                operands,
                None,
            )?),
        };
        prefix_roots.push(root);
        previous = root;
    }
    let last = prefix_roots.iter().rev().find_map(|root| *root);
    let mut manager = match last {
        Some(top) => {
            pdag.set_root(top)?;
            let meta = compute_dfs_metadata_pdag(&pdag)?;
            let mut bdd = Bdd::new();
            bdd.set_var_probs(pdag.level_var_probs_from_map(event_probabilities, &meta.var_of));
            Some((bdd, meta.var_of))
        }
        None => None,
    };
    let mut results = Vec::with_capacity(counts.len());
    for (root, &count) in prefix_roots.iter().zip(counts) {
        let certain = certain_from.is_some_and(|position| position < count);
        let value = match (certain, root, manager.as_mut()) {
            (true, _, _) => 1.0,
            (false, Some(node), Some((bdd, var_of))) => {
                let reference = bdd.build_pdag_index(&pdag, *node, var_of)?;
                bdd.probability(reference)
            }
            _ => 0.0,
        };
        results.push(value);
    }
    Ok(results)
}

pub fn merge_cut_sets(families: &[&[WeightedCutSet]]) -> Vec<WeightedCutSet> {
    let mut unique: HashMap<Vec<String>, f64> = HashMap::new();
    for family in families {
        for cut_set in family.iter() {
            unique
                .entry(cut_set.events.clone())
                .or_insert(cut_set.probability);
        }
    }
    let mut candidates: Vec<(Vec<String>, f64)> = unique.into_iter().collect();
    candidates.sort_by(|left, right| {
        left.0
            .len()
            .cmp(&right.0.len())
            .then_with(|| left.0.cmp(&right.0))
    });
    let mut kept: Vec<WeightedCutSet> = Vec::with_capacity(candidates.len());
    let mut kept_keys: HashSet<Vec<String>> = HashSet::with_capacity(candidates.len());
    for (events, probability) in candidates {
        if contains_kept_subset(&events, &kept, &kept_keys) {
            continue;
        }
        kept_keys.insert(events.clone());
        kept.push(WeightedCutSet {
            events,
            probability,
        });
    }
    sort_cut_sets(&mut kept);
    kept
}

fn contains_kept_subset(
    events: &[String],
    kept: &[WeightedCutSet],
    kept_keys: &HashSet<Vec<String>>,
) -> bool {
    if kept_keys.contains(&Vec::new()) {
        return true;
    }
    let order = events.len();
    if order <= SUBSET_ENUMERATION_LIMIT {
        let full: u32 = (1u32 << order) - 1;
        for mask in 1..full {
            let subset: Vec<String> = (0..order)
                .filter(|bit| mask & (1 << bit) != 0)
                .map(|bit| events[bit].clone())
                .collect();
            if kept_keys.contains(&subset) {
                return true;
            }
        }
        return false;
    }
    let members: HashSet<&String> = events.iter().collect();
    kept.iter().any(|cut_set| {
        cut_set.events.len() < order && cut_set.events.iter().all(|event| members.contains(event))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn set(events: &[&str], probabilities: &HashMap<String, f64>) -> WeightedCutSet {
        let mut names: Vec<String> = events.iter().map(|event| event.to_string()).collect();
        names.sort();
        let probability = product_probability(&names, probabilities).unwrap();
        WeightedCutSet {
            events: names,
            probability,
        }
    }

    fn probabilities(pairs: &[(&str, f64)]) -> HashMap<String, f64> {
        pairs
            .iter()
            .map(|(name, p)| (name.to_string(), *p))
            .collect()
    }

    fn exact_union_by_enumeration(
        cut_sets: &[WeightedCutSet],
        probabilities: &HashMap<String, f64>,
    ) -> f64 {
        let mut events: Vec<String> = cut_sets
            .iter()
            .flat_map(|cut_set| cut_set.events.clone())
            .collect();
        events.sort();
        events.dedup();
        let mut total = 0.0;
        for state in 0u64..(1u64 << events.len()) {
            let on: HashSet<&String> = events
                .iter()
                .enumerate()
                .filter(|(bit, _)| state & (1 << bit) != 0)
                .map(|(_, event)| event)
                .collect();
            if !cut_sets
                .iter()
                .any(|cut_set| cut_set.events.iter().all(|event| on.contains(event)))
            {
                continue;
            }
            total += events
                .iter()
                .map(|event| {
                    let p = probabilities[event];
                    if on.contains(event) {
                        p
                    } else {
                        1.0 - p
                    }
                })
                .product::<f64>();
        }
        total
    }

    #[test]
    fn quantifiers_match_their_definitions_on_every_prefix() {
        let p = probabilities(&[("a", 0.3), ("b", 0.2), ("c", 0.1), ("d", 0.05)]);
        let mut cut_sets = vec![
            set(&["a", "b"], &p),
            set(&["a", "c"], &p),
            set(&["b", "c", "d"], &p),
            set(&["d"], &p),
        ];
        sort_cut_sets(&mut cut_sets);
        let counts = vec![1, 2, 4];
        let rare = rare_event_prefixes(&cut_sets, &counts);
        let bound = upper_bound_prefixes(&cut_sets, &counts);
        let exact = exact_prefixes(&cut_sets, &counts, &p).unwrap();
        for (step, &count) in counts.iter().enumerate() {
            let prefix = &cut_sets[..count];
            let sum: f64 = prefix.iter().map(|cut_set| cut_set.probability).sum();
            let product: f64 = prefix
                .iter()
                .map(|cut_set| 1.0 - cut_set.probability)
                .product();
            assert!((rare[step] - sum).abs() < 1e-15);
            assert!((bound[step] - (1.0 - product)).abs() < 1e-15);
            assert!((exact[step] - exact_union_by_enumeration(prefix, &p)).abs() < 1e-15);
            assert!(exact[step] <= bound[step] + 1e-15 && bound[step] <= rare[step] + 1e-15);
        }
    }

    #[test]
    fn an_empty_cut_set_makes_every_quantifier_certain() {
        let p = probabilities(&[("a", 0.3)]);
        let cut_sets = vec![
            WeightedCutSet {
                events: Vec::new(),
                probability: 1.0,
            },
            set(&["a"], &p),
        ];
        assert_eq!(
            exact_prefixes(&cut_sets, &[0, 1, 2], &p).unwrap(),
            vec![0.0, 1.0, 1.0]
        );
        assert_eq!(
            upper_bound_prefixes(&cut_sets, &[0, 1, 2]),
            vec![0.0, 1.0, 1.0]
        );
        assert_eq!(rare_event_prefixes(&cut_sets, &[0, 2]), vec![0.0, 1.0]);
    }

    #[test]
    fn merging_keeps_only_the_minimal_union() {
        let p = probabilities(&[("a", 0.3), ("b", 0.2), ("c", 0.1), ("d", 0.05)]);
        let first = vec![set(&["a", "b"], &p), set(&["c", "d"], &p)];
        let second = vec![
            set(&["a", "b", "c"], &p),
            set(&["a", "b"], &p),
            set(&["d"], &p),
        ];
        let merged = merge_cut_sets(&[&first, &second]);
        let keys: Vec<Vec<String>> = merged
            .iter()
            .map(|cut_set| cut_set.events.clone())
            .collect();
        assert_eq!(
            keys,
            vec![
                vec!["a".to_string(), "b".to_string()],
                vec!["d".to_string()]
            ]
        );
    }

    #[test]
    fn prefix_counts_follow_the_scaled_values() {
        let p = probabilities(&[("a", 1e-3), ("b", 1e-4), ("c", 1e-6)]);
        let mut cut_sets = vec![
            set(&["a"], &p),
            set(&["b"], &p),
            set(&["c"], &p),
            set(&["a", "b"], &p),
        ];
        sort_cut_sets(&mut cut_sets);
        assert_eq!(
            prefix_counts(&cut_sets, &[5e-3, 5e-4, 5e-6, 5e-8], 10.0),
            vec![1, 2, 3, 4]
        );
    }

    #[test]
    fn settings_reject_unordered_or_invalid_cut_offs() {
        let base = SequenceCutSetSettings {
            cut_offs: vec![1e-6, 1e-8],
            basis: CutOffBasis::Frequency,
            quantifier: CutSetQuantifier::MinCutUpperBound,
            limit_order: None,
        };
        assert!(base.validate().is_ok());
        assert!(SequenceCutSetSettings {
            cut_offs: vec![1e-8, 1e-6],
            ..base.clone()
        }
        .validate()
        .is_err());
        assert!(SequenceCutSetSettings {
            cut_offs: vec![],
            ..base.clone()
        }
        .validate()
        .is_err());
        assert!(SequenceCutSetSettings {
            cut_offs: vec![2.0],
            basis: CutOffBasis::Probability,
            ..base.clone()
        }
        .validate()
        .is_err());
        assert!(SequenceCutSetSettings {
            limit_order: Some(0),
            ..base
        }
        .validate()
        .is_err());
    }
}
