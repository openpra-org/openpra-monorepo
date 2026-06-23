use crate::algorithms::bdd_engine::Bdd;
use crate::algorithms::mocus::CutSet;
use crate::algorithms::pdag::Pdag;
use crate::analysis::width::compute_dfs_metadata_pdag;
use crate::core::event::BasicEvent;
use crate::error::{PraxisError, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ImportanceFactors {
    pub occurrence: usize,

    pub mif: f64,

    pub cif: f64,

    pub dif: f64,

    pub raw: f64,

    pub rrw: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportanceRecord {
    pub event_id: String,

    pub factors: ImportanceFactors,
}

pub struct ImportanceAnalysis<'a> {
    fault_tree: &'a crate::core::fault_tree::FaultTree,
    nominal_probability: f64,
}

impl<'a> ImportanceAnalysis<'a> {
    pub fn new(
        fault_tree: &'a crate::core::fault_tree::FaultTree,
        nominal_probability: f64,
    ) -> Result<Self> {
        if !(0.0..=1.0).contains(&nominal_probability) {
            return Err(PraxisError::Logic(format!(
                "Invalid nominal probability: {}. Must be in [0,1]",
                nominal_probability
            )));
        }

        Ok(ImportanceAnalysis {
            fault_tree,
            nominal_probability,
        })
    }

    pub fn analyze(&self) -> Result<Vec<ImportanceRecord>> {
        let mut results = Vec::new();

        if self.nominal_probability == 0.0 {
            for event_id in self.fault_tree.basic_events().keys() {
                results.push(ImportanceRecord {
                    event_id: event_id.clone(),
                    factors: ImportanceFactors {
                        occurrence: 0,
                        mif: 0.0,
                        cif: 0.0,
                        dif: 0.0,
                        raw: f64::INFINITY,
                        rrw: f64::INFINITY,
                    },
                });
            }
            return Ok(results);
        }

        for (event_id, event) in self.fault_tree.basic_events() {
            let factors = self.calculate_factors(event_id, event)?;
            results.push(ImportanceRecord {
                event_id: event_id.clone(),
                factors,
            });
        }

        results.sort_by(|a, b| {
            b.factors
                .mif
                .partial_cmp(&a.factors.mif)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        Ok(results)
    }

    fn calculate_factors(&self, event_id: &str, event: &BasicEvent) -> Result<ImportanceFactors> {
        let p_event = event.probability();

        let p_top_given_one = self.evaluate_with_event_probability(event_id, 1.0)?;

        let p_top_given_zero = self.evaluate_with_event_probability(event_id, 0.0)?;

        let mif = p_top_given_one - p_top_given_zero;

        let cif = if self.nominal_probability > 0.0 {
            (mif * p_event) / self.nominal_probability
        } else {
            0.0
        };

        let dif = if self.nominal_probability > 0.0 {
            (self.nominal_probability - p_top_given_zero) / self.nominal_probability
        } else {
            0.0
        };

        let raw = if self.nominal_probability > 0.0 {
            p_top_given_one / self.nominal_probability
        } else {
            f64::INFINITY
        };

        let rrw = if p_top_given_zero > 0.0 {
            self.nominal_probability / p_top_given_zero
        } else {
            f64::INFINITY
        };

        let occurrence = if mif.abs() > 1e-10 { 1 } else { 0 };

        Ok(ImportanceFactors {
            occurrence,
            mif,
            cif,
            dif,
            raw,
            rrw,
        })
    }

    fn evaluate_with_event_probability(
        &self,
        event_id: &str,
        override_probability: f64,
    ) -> Result<f64> {
        let pdag = Pdag::from_fault_tree(self.fault_tree)?;
        let meta = compute_dfs_metadata_pdag(&pdag)?;
        let var_probs = pdag.level_var_probs(self.fault_tree, &meta.var_of)?;
        let (mut bdd, root) =
            Bdd::from_pdag_with_order_and_probs(&pdag, &meta.var_of, var_probs)?;

        if let Some(var) = pdag
            .get_index(event_id)
            .and_then(|idx| meta.var_of.get(&idx).copied())
        {
            let mut probs = bdd.var_probs().to_vec();
            probs[var] = override_probability;
            bdd.set_var_probs(probs);
        }

        Ok(bdd.probability(root))
    }

    pub fn compute_fussell_vesely_from_cutsets(
        &self,
        cut_sets: &[CutSet],
    ) -> Result<HashMap<String, f64>> {
        let mut fv_values = HashMap::new();

        if self.nominal_probability == 0.0 {
            for event_id in self.fault_tree.basic_events().keys() {
                fv_values.insert(event_id.clone(), 0.0);
            }
            return Ok(fv_values);
        }

        let event_probs: HashMap<String, f64> = self
            .fault_tree
            .basic_events()
            .iter()
            .map(|(id, event)| (id.clone(), event.probability()))
            .collect();

        for event_id in self.fault_tree.basic_events().keys() {
            let relevant_cutsets: Vec<&CutSet> = cut_sets
                .iter()
                .filter(|cs| cs.events.contains(event_id))
                .collect();

            if relevant_cutsets.is_empty() {
                fv_values.insert(event_id.clone(), 0.0);
                continue;
            }

            let prob_union =
                self.calculate_cutset_union_probability(&relevant_cutsets, &event_probs)?;

            let fv = prob_union / self.nominal_probability;

            let fv_clamped = fv.clamp(0.0, 1.0);

            fv_values.insert(event_id.clone(), fv_clamped);
        }

        Ok(fv_values)
    }

    fn calculate_cutset_union_probability(
        &self,
        cut_sets: &[&CutSet],
        event_probs: &HashMap<String, f64>,
    ) -> Result<f64> {
        if cut_sets.is_empty() {
            return Ok(0.0);
        }

        let mut cutset_probs: Vec<f64> = Vec::new();
        for cs in cut_sets {
            let mut prob = 1.0;
            for event_id in &cs.events {
                prob *= event_probs.get(event_id.as_str()).ok_or_else(|| {
                    PraxisError::Logic(format!("Event {} not found in fault tree", event_id))
                })?;
            }
            cutset_probs.push(prob);
        }

        let sum_prob: f64 = cutset_probs.iter().sum();

        let max_prob = cutset_probs.iter().cloned().fold(0.0_f64, f64::max);
        if max_prob < 0.1 {
            Ok(sum_prob)
        } else if cut_sets.len() == 1 {
            Ok(cutset_probs[0])
        } else if cut_sets.len() == 2 {
            let p_a = cutset_probs[0];
            let p_b = cutset_probs[1];

            let mut intersection_prob = 1.0;
            for event_id in &cut_sets[0].events {
                if cut_sets[1].events.contains(event_id) {
                    intersection_prob *= event_probs.get(event_id.as_str()).unwrap();
                }
            }

            Ok(p_a + p_b - p_a * p_b)
        } else {
            let complement_product: f64 = cutset_probs.iter().map(|p| 1.0 - p).product();
            Ok(1.0 - complement_product)
        }
    }

    pub fn compute_raw(&self) -> Result<HashMap<String, f64>> {
        let mut raw_values = HashMap::new();

        if self.nominal_probability == 0.0 {
            for event_id in self.fault_tree.basic_events().keys() {
                raw_values.insert(event_id.clone(), f64::INFINITY);
            }
            return Ok(raw_values);
        }

        for event_id in self.fault_tree.basic_events().keys() {
            let p_top_given_one = self.evaluate_with_event_probability(event_id, 1.0)?;

            let raw = p_top_given_one / self.nominal_probability;

            raw_values.insert(event_id.clone(), raw);
        }

        Ok(raw_values)
    }

    pub fn compute_rrw(&self) -> Result<HashMap<String, f64>> {
        let mut rrw_values = HashMap::new();

        if self.nominal_probability == 0.0 {
            for event_id in self.fault_tree.basic_events().keys() {
                rrw_values.insert(event_id.clone(), f64::INFINITY);
            }
            return Ok(rrw_values);
        }

        for event_id in self.fault_tree.basic_events().keys() {
            let p_top_given_zero = self.evaluate_with_event_probability(event_id, 0.0)?;

            let rrw = if p_top_given_zero > 0.0 {
                self.nominal_probability / p_top_given_zero
            } else {
                f64::INFINITY
            };

            rrw_values.insert(event_id.clone(), rrw);
        }

        Ok(rrw_values)
    }

    pub fn compute_birnbaum(&self) -> Result<HashMap<String, f64>> {
        let mut birnbaum_values = HashMap::new();

        for event_id in self.fault_tree.basic_events().keys() {
            let p_top_given_one = self.evaluate_with_event_probability(event_id, 1.0)?;

            let p_top_given_zero = self.evaluate_with_event_probability(event_id, 0.0)?;

            let birnbaum = p_top_given_one - p_top_given_zero;

            birnbaum_values.insert(event_id.clone(), birnbaum);
        }

        Ok(birnbaum_values)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::analysis::fault_tree::FaultTreeAnalysis;
    use crate::core::fault_tree::FaultTree;
    use crate::core::gate::{Formula, Gate};

    #[test]
    fn test_importance_analysis_new() {
        let ft = FaultTree::new("TestFT", "G1").unwrap();
        let result = ImportanceAnalysis::new(&ft, 0.5);
        assert!(result.is_ok());
    }

    #[test]
    fn test_importance_analysis_invalid_probability() {
        let ft = FaultTree::new("TestFT", "G1").unwrap();
        assert!(ImportanceAnalysis::new(&ft, -0.1).is_err());
        assert!(ImportanceAnalysis::new(&ft, 1.5).is_err());
    }

    #[test]
    fn test_importance_analysis_simple_and() {
        let mut ft = FaultTree::new("TestFT", "G1").unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.1).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.2).unwrap())
            .unwrap();

        let fta = FaultTreeAnalysis::new(&ft).unwrap();
        let fta_result = fta.analyze().unwrap();

        let importance = ImportanceAnalysis::new(&ft, fta_result.top_event_probability).unwrap();
        let results = importance.analyze().unwrap();

        assert_eq!(results.len(), 2);

        let e1_record = results.iter().find(|r| r.event_id == "E1").unwrap();
        let e2_record = results.iter().find(|r| r.event_id == "E2").unwrap();

        assert!((e1_record.factors.mif - 0.2).abs() < 1e-6);
        assert!((e2_record.factors.mif - 0.1).abs() < 1e-6);
    }

    #[test]
    fn test_importance_analysis_simple_or() {
        let mut ft = FaultTree::new("TestFT", "G1").unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::Or).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.3).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.4).unwrap())
            .unwrap();

        let fta = FaultTreeAnalysis::new(&ft).unwrap();
        let fta_result = fta.analyze().unwrap();

        let importance = ImportanceAnalysis::new(&ft, fta_result.top_event_probability).unwrap();
        let results = importance.analyze().unwrap();

        assert_eq!(results.len(), 2);

        for record in &results {
            assert!(record.factors.mif > 0.0);
            assert!(record.factors.raw >= 1.0);
        }
    }

    #[test]
    fn test_importance_factors_zero_probability() {
        let mut ft = FaultTree::new("TestFT", "G1").unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.0).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.0).unwrap())
            .unwrap();

        let importance = ImportanceAnalysis::new(&ft, 0.0).unwrap();
        let results = importance.analyze().unwrap();

        assert_eq!(results.len(), 2);

        for record in &results {
            assert_eq!(record.factors.mif, 0.0);
            assert!(record.factors.raw.is_infinite());
        }
    }

    #[test]
    fn test_raw_factor_critical_event() {
        let mut ft = FaultTree::new("TestFT", "G1").unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.01).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.99).unwrap())
            .unwrap();

        let fta = FaultTreeAnalysis::new(&ft).unwrap();
        let fta_result = fta.analyze().unwrap();

        let importance = ImportanceAnalysis::new(&ft, fta_result.top_event_probability).unwrap();
        let results = importance.analyze().unwrap();

        let e2_record = results.iter().find(|r| r.event_id == "E2").unwrap();

        assert!(e2_record.factors.raw >= 1.0);
    }

    #[test]
    fn test_rrw_factor() {
        let mut ft = FaultTree::new("TestFT", "G1").unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::Or).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.5).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.5).unwrap())
            .unwrap();

        let fta = FaultTreeAnalysis::new(&ft).unwrap();
        let fta_result = fta.analyze().unwrap();

        let importance = ImportanceAnalysis::new(&ft, fta_result.top_event_probability).unwrap();
        let results = importance.analyze().unwrap();

        for record in &results {
            assert!(record.factors.rrw > 1.0);
        }
    }

    #[test]
    fn test_importance_record_clone() {
        let record = ImportanceRecord {
            event_id: "E1".to_string(),
            factors: ImportanceFactors {
                occurrence: 1,
                mif: 0.5,
                cif: 0.3,
                dif: 0.4,
                raw: 2.0,
                rrw: 1.5,
            },
        };

        let cloned = record.clone();
        assert_eq!(record.event_id, cloned.event_id);
        assert_eq!(record.factors, cloned.factors);
    }
    #[test]
    fn test_raw_or_gate() {
        let mut ft = FaultTree::new("TestFT".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::Or).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.1).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.2).unwrap())
            .unwrap();

        let fta = FaultTreeAnalysis::new(&ft).unwrap();
        let fta_result = fta.analyze().unwrap();
        let top_prob = fta_result.top_event_probability;

        let importance = ImportanceAnalysis::new(&ft, top_prob).unwrap();
        let raw_values = importance.compute_raw().unwrap();

        let raw_e1 = raw_values.get("E1").unwrap();
        let raw_e2 = raw_values.get("E2").unwrap();

        assert!((*raw_e1 - 3.57).abs() < 0.1, "RAW(E1) = {}", raw_e1);
        assert!((*raw_e2 - 3.57).abs() < 0.1, "RAW(E2) = {}", raw_e2);

        assert!(*raw_e1 >= 1.0);
        assert!(*raw_e2 >= 1.0);
    }

    #[test]
    fn test_raw_and_gate() {
        let mut ft = FaultTree::new("TestFT".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.1).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.2).unwrap())
            .unwrap();

        let fta = FaultTreeAnalysis::new(&ft).unwrap();
        let fta_result = fta.analyze().unwrap();

        let importance = ImportanceAnalysis::new(&ft, fta_result.top_event_probability).unwrap();
        let raw_values = importance.compute_raw().unwrap();

        let raw_e1 = raw_values.get("E1").unwrap();
        let raw_e2 = raw_values.get("E2").unwrap();

        assert!((*raw_e1 - 10.0).abs() < 0.1, "RAW(E1) = {}", raw_e1);
        assert!((*raw_e2 - 5.0).abs() < 0.1, "RAW(E2) = {}", raw_e2);

        assert!(*raw_e1 > *raw_e2);
    }

    #[test]
    fn test_raw_high_probability_event() {
        let mut ft = FaultTree::new("TestFT".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::Or).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.99).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.01).unwrap())
            .unwrap();

        let fta = FaultTreeAnalysis::new(&ft).unwrap();
        let fta_result = fta.analyze().unwrap();

        let importance = ImportanceAnalysis::new(&ft, fta_result.top_event_probability).unwrap();
        let raw_values = importance.compute_raw().unwrap();

        let raw_e1 = raw_values.get("E1").unwrap();

        assert!(
            (*raw_e1 - 1.0).abs() < 0.02,
            "RAW(E1) = {} should be close to 1.0",
            raw_e1
        );
        assert!(*raw_e1 >= 1.0, "RAW must be >= 1.0");
    }

    #[test]
    fn test_raw_always_greater_equal_one() {
        let mut ft = FaultTree::new("TestFT".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::Or).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        gate.add_operand("E3".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.1).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.5).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E3".to_string(), 0.9).unwrap())
            .unwrap();

        let fta = FaultTreeAnalysis::new(&ft).unwrap();
        let fta_result = fta.analyze().unwrap();

        let importance = ImportanceAnalysis::new(&ft, fta_result.top_event_probability).unwrap();
        let raw_values = importance.compute_raw().unwrap();

        for (event_id, raw) in &raw_values {
            assert!(*raw >= 1.0, "{}: RAW = {} < 1", event_id, raw);
        }
    }

    #[test]
    fn test_rrw_or_gate() {
        let mut ft = FaultTree::new("TestFT".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::Or).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.1).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.2).unwrap())
            .unwrap();

        let fta = FaultTreeAnalysis::new(&ft).unwrap();
        let fta_result = fta.analyze().unwrap();

        let importance = ImportanceAnalysis::new(&ft, fta_result.top_event_probability).unwrap();
        let rrw_values = importance.compute_rrw().unwrap();

        let rrw_e1 = rrw_values.get("E1").unwrap();
        let rrw_e2 = rrw_values.get("E2").unwrap();

        assert!((*rrw_e1 - 1.4).abs() < 0.1, "RRW(E1) = {}", rrw_e1);
        assert!((*rrw_e2 - 2.8).abs() < 0.1, "RRW(E2) = {}", rrw_e2);

        assert!(*rrw_e2 > *rrw_e1);
    }

    #[test]
    fn test_rrw_and_gate() {
        let mut ft = FaultTree::new("TestFT".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.1).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.2).unwrap())
            .unwrap();

        let fta = FaultTreeAnalysis::new(&ft).unwrap();
        let fta_result = fta.analyze().unwrap();

        let importance = ImportanceAnalysis::new(&ft, fta_result.top_event_probability).unwrap();
        let rrw_values = importance.compute_rrw().unwrap();

        let rrw_e1 = rrw_values.get("E1").unwrap();
        let rrw_e2 = rrw_values.get("E2").unwrap();

        assert!(rrw_e1.is_infinite(), "RRW(E1) = {}", rrw_e1);
        assert!(rrw_e2.is_infinite(), "RRW(E2) = {}", rrw_e2);
    }

    #[test]
    fn test_rrw_always_greater_equal_one() {
        let mut ft = FaultTree::new("TestFT".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::Or).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        gate.add_operand("E3".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.1).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.5).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E3".to_string(), 0.9).unwrap())
            .unwrap();

        let fta = FaultTreeAnalysis::new(&ft).unwrap();
        let fta_result = fta.analyze().unwrap();

        let importance = ImportanceAnalysis::new(&ft, fta_result.top_event_probability).unwrap();
        let rrw_values = importance.compute_rrw().unwrap();

        for (event_id, rrw) in &rrw_values {
            assert!(*rrw >= 1.0, "{}: RRW = {} < 1", event_id, rrw);
        }
    }

    #[test]
    fn test_raw_rrw_relationship() {
        let mut ft = FaultTree::new("TestFT".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.1).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.2).unwrap())
            .unwrap();

        let fta = FaultTreeAnalysis::new(&ft).unwrap();
        let fta_result = fta.analyze().unwrap();

        let importance = ImportanceAnalysis::new(&ft, fta_result.top_event_probability).unwrap();
        let raw_values = importance.compute_raw().unwrap();
        let rrw_values = importance.compute_rrw().unwrap();

        for event_id in ["E1", "E2"] {
            let raw = raw_values.get(event_id).unwrap();
            let rrw = rrw_values.get(event_id).unwrap();

            assert!(*raw > 1.0, "{}: RAW = {}", event_id, raw);
            assert!(
                rrw.is_infinite() || *rrw > 1.0,
                "{}: RRW = {}",
                event_id,
                rrw
            );
        }
    }

    #[test]
    fn test_birnbaum_or_gate() {
        let mut ft = FaultTree::new("TestFT".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::Or).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.1).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.2).unwrap())
            .unwrap();

        let fta = FaultTreeAnalysis::new(&ft).unwrap();
        let fta_result = fta.analyze().unwrap();

        let importance = ImportanceAnalysis::new(&ft, fta_result.top_event_probability).unwrap();
        let bi_values = importance.compute_birnbaum().unwrap();

        let bi_e1 = bi_values.get("E1").unwrap();
        let bi_e2 = bi_values.get("E2").unwrap();

        assert!((*bi_e1 - 0.8).abs() < 0.01, "BI(E1) = {}", bi_e1);
        assert!((*bi_e2 - 0.9).abs() < 0.01, "BI(E2) = {}", bi_e2);

        assert!(*bi_e2 > *bi_e1);
    }

    #[test]
    fn test_birnbaum_and_gate() {
        let mut ft = FaultTree::new("TestFT".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.1).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.2).unwrap())
            .unwrap();

        let fta = FaultTreeAnalysis::new(&ft).unwrap();
        let fta_result = fta.analyze().unwrap();

        let importance = ImportanceAnalysis::new(&ft, fta_result.top_event_probability).unwrap();
        let bi_values = importance.compute_birnbaum().unwrap();

        let bi_e1 = bi_values.get("E1").unwrap();
        let bi_e2 = bi_values.get("E2").unwrap();

        assert!((*bi_e1 - 0.2).abs() < 0.01, "BI(E1) = {}", bi_e1);
        assert!((*bi_e2 - 0.1).abs() < 0.01, "BI(E2) = {}", bi_e2);

        assert!(*bi_e1 > *bi_e2);
    }

    #[test]
    fn test_birnbaum_bounds() {
        let mut ft = FaultTree::new("TestFT".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::Or).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        gate.add_operand("E3".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.1).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.5).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E3".to_string(), 0.9).unwrap())
            .unwrap();

        let fta = FaultTreeAnalysis::new(&ft).unwrap();
        let fta_result = fta.analyze().unwrap();

        let importance = ImportanceAnalysis::new(&ft, fta_result.top_event_probability).unwrap();
        let bi_values = importance.compute_birnbaum().unwrap();

        for (event_id, bi) in &bi_values {
            assert!(
                *bi >= 0.0 && *bi <= 1.0,
                "{}: BI = {} out of [0,1]",
                event_id,
                bi
            );
        }
    }

    #[test]
    fn test_birnbaum_single_event() {
        let mut ft = FaultTree::new("TestFT".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::Or).unwrap();
        gate.add_operand("E1".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.3).unwrap())
            .unwrap();

        let fta = FaultTreeAnalysis::new(&ft).unwrap();
        let fta_result = fta.analyze().unwrap();

        let importance = ImportanceAnalysis::new(&ft, fta_result.top_event_probability).unwrap();
        let bi_values = importance.compute_birnbaum().unwrap();

        let bi_e1 = bi_values.get("E1").unwrap();

        assert!((*bi_e1 - 1.0).abs() < 0.01, "BI(E1) = {}", bi_e1);
    }

    #[test]
    fn test_birnbaum_irrelevant_event() {
        let mut ft = FaultTree::new("TestFT".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::Or).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 1.0).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.5).unwrap())
            .unwrap();

        let fta = FaultTreeAnalysis::new(&ft).unwrap();
        let fta_result = fta.analyze().unwrap();

        let importance = ImportanceAnalysis::new(&ft, fta_result.top_event_probability).unwrap();
        let bi_values = importance.compute_birnbaum().unwrap();

        let bi_e2 = bi_values.get("E2").unwrap();

        assert!((*bi_e2).abs() < 0.01, "BI(E2) = {} should be ~0", bi_e2);
    }

    #[test]
    fn test_birnbaum_vs_raw_rrw() {
        let mut ft = FaultTree::new("TestFT".to_string(), "G1".to_string()).unwrap();
        let mut gate = Gate::new("G1".to_string(), Formula::Or).unwrap();
        gate.add_operand("E1".to_string());
        gate.add_operand("E2".to_string());
        ft.add_gate(gate).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.3).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.4).unwrap())
            .unwrap();

        let fta = FaultTreeAnalysis::new(&ft).unwrap();
        let fta_result = fta.analyze().unwrap();

        let importance = ImportanceAnalysis::new(&ft, fta_result.top_event_probability).unwrap();
        let bi_values = importance.compute_birnbaum().unwrap();
        let raw_values = importance.compute_raw().unwrap();
        let rrw_values = importance.compute_rrw().unwrap();

        for event_id in ["E1", "E2"] {
            let bi = bi_values.get(event_id).unwrap();
            let raw = raw_values.get(event_id).unwrap();
            let rrw = rrw_values.get(event_id).unwrap();

            assert!(*bi > 0.0, "{}: BI = {}", event_id, bi);
            assert!(*raw >= 1.0, "{}: RAW = {}", event_id, raw);
            assert!(*rrw >= 1.0, "{}: RRW = {}", event_id, rrw);
        }
    }

    #[test]
    fn test_importance_exact_with_repeated_event() {
        let mut ft = FaultTree::new("Shared", "TOP").unwrap();
        let mut top = Gate::new("TOP".to_string(), Formula::Or).unwrap();
        top.add_operand("G1".to_string());
        top.add_operand("G2".to_string());
        ft.add_gate(top).unwrap();
        let mut g1 = Gate::new("G1".to_string(), Formula::And).unwrap();
        g1.add_operand("A".to_string());
        g1.add_operand("B".to_string());
        ft.add_gate(g1).unwrap();
        let mut g2 = Gate::new("G2".to_string(), Formula::And).unwrap();
        g2.add_operand("A".to_string());
        g2.add_operand("C".to_string());
        ft.add_gate(g2).unwrap();
        ft.add_basic_event(BasicEvent::new("A".to_string(), 0.1).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("B".to_string(), 0.2).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("C".to_string(), 0.3).unwrap())
            .unwrap();

        let importance = ImportanceAnalysis::new(&ft, 0.044).unwrap();
        let results = importance.analyze().unwrap();
        let mif = |id: &str| {
            results
                .iter()
                .find(|r| r.event_id == id)
                .unwrap()
                .factors
                .mif
        };

        assert!((mif("A") - 0.44).abs() < 1e-9);
        assert!((mif("B") - 0.07).abs() < 1e-9);
        assert!((mif("C") - 0.08).abs() < 1e-9);

        let dif_a = results
            .iter()
            .find(|r| r.event_id == "A")
            .unwrap()
            .factors
            .dif;
        assert!((dif_a - 1.0).abs() < 1e-9);
    }
}
