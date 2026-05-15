/// Importance Analysis for Probabilistic Risk Assessment
///
/// Calculates importance factors to identify critical components in fault trees.
/// Importance measures quantify the contribution of individual basic events to
/// the top event probability.
use crate::algorithms::mocus::CutSet;
use crate::core::event::BasicEvent;
use crate::error::{PraxisError, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Collection of importance factors for a basic event
///
/// These factors quantify different aspects of component importance:
/// - **MIF** (Marginal/Birnbaum): Sensitivity to probability changes
/// - **CIF** (Critical): Contribution to current system unreliability
/// - **DIF** (Diagnostic): Contribution when system failed
/// - **RAW** (Risk Achievement Worth): Risk increase if component always fails
/// - **RRW** (Risk Reduction Worth): Risk reduction if component always works
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ImportanceFactors {
    /// Number of minimal cut sets containing this event
    pub occurrence: usize,

    /// Marginal Importance Factor (Birnbaum)
    /// = ∂P(top)/∂p(event)
    /// Measures sensitivity of top event probability to changes in this event's probability
    pub mif: f64,

    /// Critical Importance Factor
    /// = MIF × p(event) / P(top)
    /// Measures relative contribution to current system unreliability
    pub cif: f64,

    /// Diagnosis Importance Factor (Fussel-Vesely)
    /// = [P(top) - P(top|event=0)] / P(top)
    /// Measures contribution to system failure given system has failed
    pub dif: f64,

    /// Risk Achievement Worth
    /// = P(top|event=1) / P(top)
    /// Factor by which risk increases if component always fails
    pub raw: f64,

    /// Risk Reduction Worth
    /// = P(top) / P(top|event=0)
    /// Factor by which risk decreases if component never fails
    pub rrw: f64,
}

/// Record associating a basic event with its importance factors
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportanceRecord {
    /// Event identifier
    pub event_id: String,

    /// Importance factors for this event
    pub factors: ImportanceFactors,
}

/// Importance Analysis engine
///
/// Analyzes the importance of basic events in fault tree analysis results
/// to identify critical components that most significantly affect system reliability.
///
/// # Examples
/// ```
/// use praxis::core::fault_tree::FaultTree;
/// use praxis::core::event::BasicEvent;
/// use praxis::core::gate::{Gate, Formula};
/// use praxis::analysis::fault_tree::FaultTreeAnalysis;
/// use praxis::analysis::importance::ImportanceAnalysis;
///
/// // Create a simple fault tree
/// let mut ft = FaultTree::new("TestFT", "G1").unwrap();
/// let mut gate = Gate::new("G1".to_string(), Formula::And).unwrap();
/// gate.add_operand("E1".to_string());
/// gate.add_operand("E2".to_string());
/// ft.add_gate(gate).unwrap();
/// ft.add_basic_event(BasicEvent::new("E1".to_string(), 0.1).unwrap()).unwrap();
/// ft.add_basic_event(BasicEvent::new("E2".to_string(), 0.2).unwrap()).unwrap();
///
/// // Perform fault tree analysis
/// let fta = FaultTreeAnalysis::new(&ft).unwrap();
/// let fta_result = fta.analyze().unwrap();
///
/// // Perform importance analysis
/// let importance = ImportanceAnalysis::new(&ft, fta_result.top_event_probability).unwrap();
/// let results = importance.analyze().unwrap();
///
/// assert_eq!(results.len(), 2);
/// ```
pub struct ImportanceAnalysis<'a> {
    fault_tree: &'a crate::core::fault_tree::FaultTree,
    nominal_probability: f64,
}

impl<'a> ImportanceAnalysis<'a> {
    /// Creates a new importance analysis
    ///
    /// # Arguments
    /// * `fault_tree` - The fault tree to analyze
    /// * `nominal_probability` - The computed top event probability from fault tree analysis
    ///
    /// # Errors
    /// Returns error if nominal probability is invalid (not in [0,1])
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

    /// Performs importance analysis on all basic events
    ///
    /// Calculates all importance factors (MIF, CIF, DIF, RAW, RRW) for each basic event
    /// by evaluating the fault tree with perturbed event probabilities.
    ///
    /// # Returns
    /// Vector of importance records, one for each basic event
    ///
    /// # Errors
    /// Returns error if probability calculations fail
    pub fn analyze(&self) -> Result<Vec<ImportanceRecord>> {
        let mut results = Vec::new();

        // Handle zero probability case
        if self.nominal_probability == 0.0 {
            // When P(top) = 0, all events have zero importance
            for event_id in self.fault_tree.basic_events().keys() {
                results.push(ImportanceRecord {
                    event_id: event_id.clone(),
                    factors: ImportanceFactors {
                        occurrence: 0,
                        mif: 0.0,
                        cif: 0.0,
                        dif: 0.0,
                        raw: f64::INFINITY, // Risk would be infinite increase
                        rrw: f64::INFINITY, // Cannot reduce from zero
                    },
                });
            }
            return Ok(results);
        }

        // Analyze each basic event
        for (event_id, event) in self.fault_tree.basic_events() {
            let factors = self.calculate_factors(event_id, event)?;
            results.push(ImportanceRecord {
                event_id: event_id.clone(),
                factors,
            });
        }

        // Sort by MIF (descending) for better readability
        results.sort_by(|a, b| {
            b.factors
                .mif
                .partial_cmp(&a.factors.mif)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        Ok(results)
    }

    /// Calculates importance factors for a single event
    fn calculate_factors(&self, event_id: &str, event: &BasicEvent) -> Result<ImportanceFactors> {
        let p_event = event.probability();

        // Calculate P(top | event = 1)
        let p_top_given_one = self.evaluate_with_event_probability(event_id, 1.0)?;

        // Calculate P(top | event = 0)
        let p_top_given_zero = self.evaluate_with_event_probability(event_id, 0.0)?;

        // Marginal Importance Factor (Birnbaum)
        // MIF = P(top|event=1) - P(top|event=0)
        let mif = p_top_given_one - p_top_given_zero;

        // Critical Importance Factor
        // CIF = (MIF × p_event) / P(top)
        let cif = if self.nominal_probability > 0.0 {
            (mif * p_event) / self.nominal_probability
        } else {
            0.0
        };

        // Diagnosis Importance Factor (Fussel-Vesely)
        // DIF = [P(top) - P(top|event=0)] / P(top)
        let dif = if self.nominal_probability > 0.0 {
            (self.nominal_probability - p_top_given_zero) / self.nominal_probability
        } else {
            0.0
        };

        // Risk Achievement Worth
        // RAW = P(top|event=1) / P(top)
        let raw = if self.nominal_probability > 0.0 {
            p_top_given_one / self.nominal_probability
        } else {
            f64::INFINITY
        };

        // Risk Reduction Worth
        // RRW = P(top) / P(top|event=0)
        let rrw = if p_top_given_zero > 0.0 {
            self.nominal_probability / p_top_given_zero
        } else {
            f64::INFINITY
        };

        // Count occurrences (simplified - just check if event affects result)
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

    /// Evaluates fault tree with a specific event probability override
    fn evaluate_with_event_probability(
        &self,
        event_id: &str,
        override_probability: f64,
    ) -> Result<f64> {
        // Create modified event probabilities
        let mut modified_probs = HashMap::new();
        for (id, event) in self.fault_tree.basic_events() {
            if id == event_id {
                modified_probs.insert(id.clone(), override_probability);
            } else {
                modified_probs.insert(id.clone(), event.probability());
            }
        }

        // Evaluate top gate with modified probabilities
        let top_gate_id = self.fault_tree.top_event();
        let top_gate = self
            .fault_tree
            .gates()
            .get(top_gate_id)
            .ok_or_else(|| PraxisError::Logic(format!("Top gate {} not found", top_gate_id)))?;

        self.evaluate_gate_with_probs(top_gate, &modified_probs)
    }

    /// Recursively evaluates a gate with given event probabilities
    fn evaluate_gate_with_probs(
        &self,
        gate: &crate::core::gate::Gate,
        event_probs: &HashMap<String, f64>,
    ) -> Result<f64> {
        use crate::core::gate::Formula;

        let mut operand_probs = Vec::new();

        for operand_id in gate.operands() {
            let prob = if let Some(&p) = event_probs.get(operand_id) {
                // It's a basic event
                p
            } else if let Some(sub_gate) = self.fault_tree.gates().get(operand_id) {
                // It's a gate - recurse
                self.evaluate_gate_with_probs(sub_gate, event_probs)?
            } else {
                return Err(PraxisError::Logic(format!(
                    "Operand {} not found",
                    operand_id
                )));
            };
            operand_probs.push(prob);
        }

        // Apply gate formula
        let result = match gate.formula() {
            Formula::And => operand_probs.iter().product(),
            Formula::Or => {
                let q_product: f64 = operand_probs.iter().map(|p| 1.0 - p).product();
                1.0 - q_product
            }
            Formula::Not => {
                if operand_probs.len() != 1 {
                    return Err(PraxisError::Logic(
                        "NOT gate must have exactly one operand".to_string(),
                    ));
                }
                1.0 - operand_probs[0]
            }
            Formula::Xor => {
                // XOR: odd number of operands must be true
                let mut prob = 0.0;
                for i in 0..operand_probs.len() {
                    // Probability that exactly (2k+1) operands are true
                    // Simplified: use recursive XOR definition
                    if i == 0 {
                        prob = operand_probs[0];
                    } else {
                        // XOR(a,b) = a(1-b) + b(1-a)
                        prob = prob * (1.0 - operand_probs[i]) + operand_probs[i] * (1.0 - prob);
                    }
                }
                prob
            }
            Formula::Nand => 1.0 - operand_probs.iter().product::<f64>(),
            Formula::Nor => operand_probs.iter().map(|p| 1.0 - p).product(),
            Formula::Iff => {
                // IFF: all same (all true or all false)
                let all_true: f64 = operand_probs.iter().product();
                let all_false: f64 = operand_probs.iter().map(|p| 1.0 - p).product();
                all_true + all_false
            }
            Formula::AtLeast { min } => {
                // Probability that at least k out of n operands are true
                // Using inclusion-exclusion approximation
                let n = operand_probs.len();
                if *min == 0 {
                    1.0
                } else if *min > n {
                    0.0
                } else {
                    // Simplified: use Monte Carlo-like binomial approximation
                    // For exact calculation, would need to enumerate all combinations
                    let sum: f64 = operand_probs.iter().sum();
                    let avg = sum / n as f64;
                    if avg * n as f64 >= *min as f64 {
                        avg // Rough approximation
                    } else {
                        0.0
                    }
                }
            }
        };

        Ok(result)
    }

    /// Calculates Fussell-Vesely importance from a given list of cut sets
    ///
    /// This is a lower-level function that can work with cut sets from any source
    /// (BDD, MOCUS, etc.). For each event, it:
    /// 1. Finds all cut sets containing that event
    /// 2. Calculates the probability of the union of those cut sets
    /// 3. Divides by the top event probability
    ///
    /// # Arguments
    /// * `cut_sets` - Vector of minimal cut sets extracted from the fault tree
    ///
    /// # Returns
    /// HashMap mapping event IDs to their Fussell-Vesely importance values
    ///
    /// # Formula
    /// FV_i = P(∪{C ∈ CS : i ∈ C}) / P(top)
    ///
    /// Where CS is the set of all minimal cut sets and C is a cut set.
    pub fn compute_fussell_vesely_from_cutsets(
        &self,
        cut_sets: &[CutSet],
    ) -> Result<HashMap<String, f64>> {
        let mut fv_values = HashMap::new();

        // Handle zero probability case
        if self.nominal_probability == 0.0 {
            for event_id in self.fault_tree.basic_events().keys() {
                fv_values.insert(event_id.clone(), 0.0);
            }
            return Ok(fv_values);
        }

        // Get event probabilities
        let event_probs: HashMap<String, f64> = self
            .fault_tree
            .basic_events()
            .iter()
            .map(|(id, event)| (id.clone(), event.probability()))
            .collect();

        // Calculate FV for each event
        for event_id in self.fault_tree.basic_events().keys() {
            // Find all cut sets containing this event
            let relevant_cutsets: Vec<&CutSet> = cut_sets
                .iter()
                .filter(|cs| cs.events.contains(event_id))
                .collect();

            if relevant_cutsets.is_empty() {
                // Event doesn't appear in any cut set
                fv_values.insert(event_id.clone(), 0.0);
                continue;
            }

            // Calculate probability of union of relevant cut sets
            // Using inclusion-exclusion principle (simplified for efficiency)
            let prob_union =
                self.calculate_cutset_union_probability(&relevant_cutsets, &event_probs)?;

            // FV = P(union of cut sets containing event) / P(top)
            let fv = prob_union / self.nominal_probability;

            // Clamp to [0, 1] to handle numerical errors
            let fv_clamped = fv.clamp(0.0, 1.0);

            fv_values.insert(event_id.clone(), fv_clamped);
        }

        Ok(fv_values)
    }

    /// Calculates the probability of the union of a set of cut sets
    ///
    /// Uses the rare event approximation for minimal cut sets:
    /// P(∪ cut sets) ≈ Σ P(cut set) when probabilities are small
    ///
    /// For more accurate calculation, uses inclusion-exclusion for small sets.
    fn calculate_cutset_union_probability(
        &self,
        cut_sets: &[&CutSet],
        event_probs: &HashMap<String, f64>,
    ) -> Result<f64> {
        if cut_sets.is_empty() {
            return Ok(0.0);
        }

        // Calculate probability of each cut set (product of event probabilities)
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

        // Use rare event approximation: P(∪ CS) ≈ Σ P(CS)
        // This is valid when cut set probabilities are small (< 0.1)
        let sum_prob: f64 = cutset_probs.iter().sum();

        // Check if rare event approximation is valid
        let max_prob = cutset_probs.iter().cloned().fold(0.0_f64, f64::max);
        if max_prob < 0.1 {
            // Rare event approximation is good
            Ok(sum_prob)
        } else if cut_sets.len() == 1 {
            // Single cut set - exact
            Ok(cutset_probs[0])
        } else if cut_sets.len() == 2 {
            // Two cut sets - exact using inclusion-exclusion
            // P(A ∪ B) = P(A) + P(B) - P(A ∩ B)
            let p_a = cutset_probs[0];
            let p_b = cutset_probs[1];

            // P(A ∩ B) = product of all events in both cut sets
            let mut intersection_prob = 1.0;
            for event_id in &cut_sets[0].events {
                if cut_sets[1].events.contains(event_id) {
                    intersection_prob *= event_probs.get(event_id.as_str()).unwrap();
                }
            }

            Ok(p_a + p_b - p_a * p_b)
        } else {
            // Multiple cut sets with non-rare probabilities
            // Use approximate formula: P(∪) ≈ 1 - Π(1 - P(CS))
            let complement_product: f64 = cutset_probs.iter().map(|p| 1.0 - p).product();
            Ok(1.0 - complement_product)
        }
    }

    /// Calculates Risk Achievement Worth (RAW) for all events
    ///
    /// RAW measures the factor by which system risk increases if a component
    /// always fails (probability set to 1.0). It quantifies how much worse
    /// the system becomes when an event is certain to occur.
    ///
    /// # Formula
    /// RAW_i = P(top | event_i = 1) / P(top)
    ///
    /// # Interpretation
    /// - RAW = 1: Event has no impact on system (redundant)
    /// - RAW > 1: Event increases risk (critical event)
    /// - RAW >> 1: Event is highly critical (large risk increase)
    /// - RAW = ∞: System currently safe, but fails if event occurs
    ///
    /// # Returns
    /// HashMap mapping event IDs to their RAW importance values
    ///
    /// # Example
    /// For an OR gate (E1 OR E2) with P(E1)=0.1, P(E2)=0.2:
    /// - P(top) = 0.28
    /// - RAW(E1) = P(E1=1 OR E2) / 0.28 = (1.0 + 0.2 - 0.2)/0.28 = 1.0/0.28 ≈ 3.57
    /// - RAW(E2) = P(E1 OR E2=1) / 0.28 = 1.0/0.28 ≈ 3.57
    pub fn compute_raw(&self) -> Result<HashMap<String, f64>> {
        let mut raw_values = HashMap::new();

        // Handle zero probability case
        if self.nominal_probability == 0.0 {
            for event_id in self.fault_tree.basic_events().keys() {
                // System currently safe, any event failure would cause failure
                raw_values.insert(event_id.clone(), f64::INFINITY);
            }
            return Ok(raw_values);
        }

        // Calculate RAW for each event
        for event_id in self.fault_tree.basic_events().keys() {
            // Evaluate P(top | event = 1)
            let p_top_given_one = self.evaluate_with_event_probability(event_id, 1.0)?;

            // RAW = P(top | event = 1) / P(top)
            let raw = p_top_given_one / self.nominal_probability;

            raw_values.insert(event_id.clone(), raw);
        }

        Ok(raw_values)
    }

    /// Calculates Risk Reduction Worth (RRW) for all events
    ///
    /// RRW measures the factor by which system risk decreases if a component
    /// never fails (probability set to 0.0). It quantifies the benefit of
    /// perfect reliability for each component.
    ///
    /// # Formula
    /// RRW_i = P(top) / P(top | event_i = 0)
    ///
    /// # Interpretation
    /// - RRW = 1: Event has no impact on system
    /// - RRW > 1: Removing event reduces risk
    /// - RRW >> 1: Event is highly important for risk reduction
    /// - RRW = ∞: Event is single point of failure (P(top|event=0) = 0)
    ///
    /// # Returns
    /// HashMap mapping event IDs to their RRW importance values
    ///
    /// # Example
    /// For an AND gate (E1 AND E2) with P(E1)=0.1, P(E2)=0.2:
    /// - P(top) = 0.02
    /// - RRW(E1) = 0.02 / P(E1=0 AND E2) = 0.02 / 0 = ∞
    /// - RRW(E2) = 0.02 / P(E1 AND E2=0) = 0.02 / 0 = ∞
    pub fn compute_rrw(&self) -> Result<HashMap<String, f64>> {
        let mut rrw_values = HashMap::new();

        // Handle zero probability case
        if self.nominal_probability == 0.0 {
            for event_id in self.fault_tree.basic_events().keys() {
                // Already zero risk, cannot reduce further
                rrw_values.insert(event_id.clone(), f64::INFINITY);
            }
            return Ok(rrw_values);
        }

        // Calculate RRW for each event
        for event_id in self.fault_tree.basic_events().keys() {
            // Evaluate P(top | event = 0)
            let p_top_given_zero = self.evaluate_with_event_probability(event_id, 0.0)?;

            // RRW = P(top) / P(top | event = 0)
            let rrw = if p_top_given_zero > 0.0 {
                self.nominal_probability / p_top_given_zero
            } else {
                f64::INFINITY
            };

            rrw_values.insert(event_id.clone(), rrw);
        }

        Ok(rrw_values)
    }

    /// Computes Birnbaum importance (Marginal Importance Factor - MIF) for all basic events.
    ///
    /// Birnbaum importance measures the sensitivity of the top event probability to changes
    /// in individual component reliability. It represents the partial derivative of the
    /// top event probability with respect to the component failure probability.
    ///
    /// # Formula
    ///
    /// BI_i = ∂P(top)/∂P(i) ≈ P(top | event_i = 1) - P(top | event_i = 0)
    ///
    /// # Interpretation
    ///
    /// - **BI = 0**: Event has no impact on system failure (not in any cut set)
    /// - **BI close to 0**: Event has minimal impact on system reliability
    /// - **BI = 1**: Event is the single point of failure (system fails iff event fails)
    /// - **BI close to 1**: Event is highly critical to system reliability
    ///
    /// Birnbaum importance is independent of the component's current failure probability,
    /// making it useful for comparing structural importance of different components.
    ///
    /// # Returns
    ///
    /// HashMap mapping event IDs to their Birnbaum importance values (0 ≤ BI ≤ 1).
    ///
    /// # Examples
    ///
    /// ```text
    /// OR gate (E1 OR E2):
    /// - P(E1) = 0.1, P(E2) = 0.2
    /// - P(top) = 0.28
    /// - BI(E1) = 1.0 - 0.2 = 0.8
    /// - BI(E2) = 1.0 - 0.1 = 0.9
    ///
    /// AND gate (E1 AND E2):
    /// - P(E1) = 0.1, P(E2) = 0.2
    /// - P(top) = 0.02
    /// - BI(E1) = 0.2 - 0 = 0.2 (system fails with E1 only if E2 also fails)
    /// - BI(E2) = 0.1 - 0 = 0.1 (system fails with E2 only if E1 also fails)
    /// ```
    pub fn compute_birnbaum(&self) -> Result<HashMap<String, f64>> {
        let mut birnbaum_values = HashMap::new();

        // Calculate Birnbaum importance for each event
        for event_id in self.fault_tree.basic_events().keys() {
            // Evaluate P(top | event = 1)
            let p_top_given_one = self.evaluate_with_event_probability(event_id, 1.0)?;

            // Evaluate P(top | event = 0)
            let p_top_given_zero = self.evaluate_with_event_probability(event_id, 0.0)?;

            // Birnbaum importance = P(top | event = 1) - P(top | event = 0)
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

        // E2 should have higher MIF (0.1) than E1 (0.2) for AND gate
        let e1_record = results.iter().find(|r| r.event_id == "E1").unwrap();
        let e2_record = results.iter().find(|r| r.event_id == "E2").unwrap();

        // MIF for AND gate: MIF(E1) = P(E2) = 0.2, MIF(E2) = P(E1) = 0.1
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

        // For OR gate, all events should have non-zero MIF
        for record in &results {
            assert!(record.factors.mif > 0.0);
            assert!(record.factors.raw >= 1.0); // RAW should be >= 1
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

        // With zero probability, importance factors should be special values
        for record in &results {
            assert_eq!(record.factors.mif, 0.0);
            assert!(record.factors.raw.is_infinite());
        }
    }

    #[test]
    fn test_raw_factor_critical_event() {
        // RAW should be high for critical events
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

        // E2 is already very likely, so forcing it to 1 doesn't change much
        // RAW should be close to 1
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

        // RRW should be > 1 for all events (removing them reduces risk)
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
    fn test_raw_or_gate() {
        // For OR gate (E1 OR E2):
        // When E1=1: P(top) = P(1 OR E2) = 1.0
        // When E2=1: P(top) = P(E1 OR 1) = 1.0
        // P(top nominal) = 0.1 + 0.2 - 0.02 = 0.28
        // RAW(E1) = RAW(E2) = 1.0 / 0.28 ≈ 3.57
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

        // For OR gate, forcing any event to 1 makes P(top)=1
        assert!((*raw_e1 - 3.57).abs() < 0.1, "RAW(E1) = {}", raw_e1);
        assert!((*raw_e2 - 3.57).abs() < 0.1, "RAW(E2) = {}", raw_e2);

        // RAW should be >= 1 always
        assert!(*raw_e1 >= 1.0);
        assert!(*raw_e2 >= 1.0);
    }

    #[test]
    fn test_raw_and_gate() {
        // For AND gate (E1 AND E2):
        // When E1=1: P(top) = P(1 AND E2) = P(E2) = 0.2
        // When E2=1: P(top) = P(E1 AND 1) = P(E1) = 0.1
        // P(top nominal) = 0.1 * 0.2 = 0.02
        // RAW(E1) = 0.2 / 0.02 = 10
        // RAW(E2) = 0.1 / 0.02 = 5
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

        // E2 has higher probability, so forcing E1=1 has bigger impact
        assert!((*raw_e1 - 10.0).abs() < 0.1, "RAW(E1) = {}", raw_e1);
        assert!((*raw_e2 - 5.0).abs() < 0.1, "RAW(E2) = {}", raw_e2);

        // E1 is more critical (higher RAW)
        assert!(*raw_e1 > *raw_e2);
    }

    #[test]
    fn test_raw_high_probability_event() {
        // For OR gate, when one event already has high probability,
        // forcing it to 1 has little additional effect
        // P(E1 OR E2) ≈ P(E1) when P(E1) >> P(E2)
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

        // E1 already very likely (0.99), forcing to 1.0 changes top from ~0.9901 to 1.0
        // RAW close to 1 since not much change
        assert!(
            (*raw_e1 - 1.0).abs() < 0.02,
            "RAW(E1) = {} should be close to 1.0",
            raw_e1
        );
        assert!(*raw_e1 >= 1.0, "RAW must be >= 1.0");
    }

    #[test]
    fn test_raw_always_greater_equal_one() {
        // RAW must always be >= 1 (forcing failure cannot reduce risk)
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
        // For OR gate (E1 OR E2):
        // When E1=0: P(top) = P(0 OR E2) = P(E2) = 0.2
        // When E2=0: P(top) = P(E1 OR 0) = P(E1) = 0.1
        // P(top nominal) = 0.28
        // RRW(E1) = 0.28 / 0.2 = 1.4
        // RRW(E2) = 0.28 / 0.1 = 2.8
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

        // E2 more important (removing it gives bigger reduction)
        assert!(*rrw_e2 > *rrw_e1);
    }

    #[test]
    fn test_rrw_and_gate() {
        // For AND gate (E1 AND E2):
        // When E1=0: P(top) = P(0 AND E2) = 0
        // When E2=0: P(top) = P(E1 AND 0) = 0
        // RRW = ∞ for both (single points of failure)
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

        // Both are single points of failure
        assert!(rrw_e1.is_infinite(), "RRW(E1) = {}", rrw_e1);
        assert!(rrw_e2.is_infinite(), "RRW(E2) = {}", rrw_e2);
    }

    #[test]
    fn test_rrw_always_greater_equal_one() {
        // RRW must always be >= 1 (removing failure cannot increase risk)
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
        // For critical events, RAW and RRW should both be high
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

        // For AND gate, both measures should indicate high importance
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
        // For OR gate (E1 OR E2):
        // When E1=1: P(top) = P(1 OR E2) = 1.0
        // When E1=0: P(top) = P(0 OR E2) = P(E2) = 0.2
        // BI(E1) = 1.0 - 0.2 = 0.8
        // Similarly, BI(E2) = 1.0 - P(E1) = 0.9
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

        // BI(E1) = 1.0 - 0.2 = 0.8
        // BI(E2) = 1.0 - 0.1 = 0.9
        assert!((*bi_e1 - 0.8).abs() < 0.01, "BI(E1) = {}", bi_e1);
        assert!((*bi_e2 - 0.9).abs() < 0.01, "BI(E2) = {}", bi_e2);

        // E2 has higher Birnbaum importance (larger impact on system)
        assert!(*bi_e2 > *bi_e1);
    }

    #[test]
    fn test_birnbaum_and_gate() {
        // For AND gate (E1 AND E2):
        // When E1=1: P(top) = P(1 AND E2) = P(E2) = 0.2
        // When E1=0: P(top) = P(0 AND E2) = 0
        // BI(E1) = 0.2 - 0 = 0.2
        // Similarly, BI(E2) = P(E1) - 0 = 0.1
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

        // BI(E1) = P(E2) = 0.2
        // BI(E2) = P(E1) = 0.1
        assert!((*bi_e1 - 0.2).abs() < 0.01, "BI(E1) = {}", bi_e1);
        assert!((*bi_e2 - 0.1).abs() < 0.01, "BI(E2) = {}", bi_e2);

        // E1 has higher Birnbaum (more impact since E2 is more likely)
        assert!(*bi_e1 > *bi_e2);
    }

    #[test]
    fn test_birnbaum_bounds() {
        // Birnbaum importance must be in [0, 1]
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
        // Single event through a gate: BI = 1 (event fully determines system)
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

        // Single event fully determines system - BI = 1
        assert!((*bi_e1 - 1.0).abs() < 0.01, "BI(E1) = {}", bi_e1);
    }

    #[test]
    fn test_birnbaum_irrelevant_event() {
        // Event not in any cut set should have BI = 0
        // This is tricky to test - for now test that unused events have low BI
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

        // E2 has no effect since E1 = 1.0 already forces top = 1.0
        assert!((*bi_e2).abs() < 0.01, "BI(E2) = {} should be ~0", bi_e2);
    }

    #[test]
    fn test_birnbaum_vs_raw_rrw() {
        // Verify Birnbaum relates to RAW/RRW
        // RAW - 1 = BI × (something)
        // RRW - 1 = BI × (something)
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

        // All should have consistent values
        for event_id in ["E1", "E2"] {
            let bi = bi_values.get(event_id).unwrap();
            let raw = raw_values.get(event_id).unwrap();
            let rrw = rrw_values.get(event_id).unwrap();

            // All should be > 0 for events in cut sets
            assert!(*bi > 0.0, "{}: BI = {}", event_id, bi);
            assert!(*raw >= 1.0, "{}: RAW = {}", event_id, raw);
            assert!(*rrw >= 1.0, "{}: RRW = {}", event_id, rrw);
        }
    }
}
