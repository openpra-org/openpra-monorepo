use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::algorithms::bdd_engine::Bdd as BddEngine;
use crate::algorithms::bdd_pdag::BddPdag;
use crate::algorithms::mocus::CutSet;
use crate::core::fault_tree::FaultTree;
use crate::Result;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub top_event_probability: f64,
    pub gates_analyzed: usize,
    pub basic_events_count: usize,
}

#[derive(Debug)]
pub struct FaultTreeAnalysis<'a> {
    fault_tree: &'a FaultTree,
}

impl<'a> FaultTreeAnalysis<'a> {
    pub fn new(fault_tree: &'a FaultTree) -> Result<Self> {
        Ok(FaultTreeAnalysis { fault_tree })
    }

    pub fn analyze(&self) -> Result<AnalysisResult> {
        let mut pdag = BddPdag::from_fault_tree(self.fault_tree)?;
        pdag.compute_ordering_and_modules()?;
        let (mut bdd_engine, root) = BddEngine::build_from_pdag(&pdag)?;
        let top_probability = bdd_engine.probability(root);
        bdd_engine.freeze();

        Ok(AnalysisResult {
            top_event_probability: top_probability,
            gates_analyzed: self.fault_tree.gates().len(),
            basic_events_count: self.fault_tree.basic_events().len(),
        })
    }
}

pub fn filter_by_order(cut_sets: Vec<CutSet>, max_order: usize) -> Vec<CutSet> {
    cut_sets
        .into_iter()
        .filter(|cs| cs.order() <= max_order)
        .collect()
}

pub fn filter_by_probability(
    cut_sets: Vec<CutSet>,
    event_probs: &HashMap<String, f64>,
    cutoff: f64,
) -> Vec<CutSet> {
    cut_sets
        .into_iter()
        .filter(|cs| {
            let prob: f64 = cs
                .events
                .iter()
                .map(|event_id| event_probs.get(event_id).copied().unwrap_or(1.0))
                .product();
            prob >= cutoff
        })
        .collect()
}
