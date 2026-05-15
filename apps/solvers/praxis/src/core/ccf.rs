/// Common Cause Failure (CCF) analysis data structures
///
/// This module provides data structures for modeling common cause failures,
/// where multiple components fail due to a single shared cause. Supports
/// multiple CCF models including Beta-Factor, Alpha-Factor, MGL, and Phi-Factor.
use crate::core::element::Element;
use crate::Result;
use serde::{Deserialize, Serialize};

/// Common Cause Failure group definition
///
/// A CCF group represents a set of components that can fail together
/// due to common causes. The group is expanded into multiple basic events
/// based on the selected CCF model.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CcfGroup {
    /// Element metadata (id, name, label)
    element: Element,

    /// Member component IDs
    pub members: Vec<String>,

    /// CCF model and parameters
    pub model: CcfModel,

    /// Distribution for the base failure rate (optional)
    pub distribution: Option<String>,
}

impl CcfGroup {
    /// Create a new CCF group
    ///
    /// # Arguments
    /// * `id` - Unique identifier for the CCF group
    /// * `members` - List of component IDs in the group
    /// * `model` - CCF model with parameters
    ///
    /// # Returns
    /// * `Ok(CcfGroup)` - Successfully created CCF group
    /// * `Err` - If validation fails (e.g., < 2 members)
    ///
    /// # Examples
    /// ```
    /// use praxis::core::ccf::{CcfGroup, CcfModel};
    ///
    /// let members = vec!["Pump1".to_string(), "Pump2".to_string()];
    /// let model = CcfModel::BetaFactor(0.1);
    /// let group = CcfGroup::new("CCF-Pumps", members, model).unwrap();
    /// ```
    pub fn new(id: impl Into<String>, members: Vec<String>, model: CcfModel) -> Result<Self> {
        let element = Element::new(id.into())?;

        // Validate: CCF groups require at least 2 members
        if members.len() < 2 {
            return Err(crate::error::PraxisError::Logic(
                "CCF group must have at least 2 members".to_string(),
            ));
        }

        // Validate model parameters match member count
        model.validate(members.len())?;

        Ok(CcfGroup {
            element,
            members,
            model,
            distribution: None,
        })
    }

    /// Get the element (for id, name, label access)
    pub fn element(&self) -> &Element {
        &self.element
    }

    /// Get mutable element reference
    pub fn element_mut(&mut self) -> &mut Element {
        &mut self.element
    }

    /// Set the distribution expression
    pub fn with_distribution(mut self, distribution: String) -> Self {
        self.distribution = Some(distribution);
        self
    }

    /// Get the number of members in the group
    pub fn size(&self) -> usize {
        self.members.len()
    }

    /// Expand the CCF group into basic events
    ///
    /// Generates expanded events based on the CCF model. Each expanded event
    /// represents a specific failure combination.
    ///
    /// # Returns
    /// Vector of expanded CCF events with IDs and probabilities
    pub fn expand(&self, base_probability: f64) -> Result<Vec<CcfEvent>> {
        self.model
            .expand(self.element.id(), &self.members, base_probability)
    }
}

/// CCF model types and parameters
///
/// Different models for calculating common cause failure probabilities.
/// Each model has different parameters and generates different event sets.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CcfModel {
    /// Beta-Factor model: P_common = β·Q, P_independent = (1-β)·Q
    ///
    /// The simplest CCF model with a single parameter β ∈ [0,1].
    /// Generates n+1 events: n independent events + 1 common event.
    BetaFactor(f64),

    /// Alpha-Factor model: Multiple α parameters for different failure combinations
    ///
    /// More sophisticated than Beta-Factor, allows different probabilities
    /// for different subset sizes. α_k represents the fraction of failures
    /// involving exactly k components.
    ///
    /// Parameters: α_1, α_2, ..., α_n where Σα_i = 1
    AlphaFactor(Vec<f64>),

    /// Multiple Greek Letter (MGL) model
    ///
    /// Most general model supporting all k-out-of-n combinations.
    /// Parameters represent probabilities for different failure combinations.
    ///
    /// Parameters: Q_1, Q_2, ..., Q_n for each failure level
    Mgl(Vec<f64>),

    /// Phi-Factor model: Similar to Alpha-Factor with different parameterization
    ///
    /// φ_k represents the conditional probability that given a failure,
    /// exactly k components fail together.
    PhiFactor(Vec<f64>),
}

impl CcfModel {
    /// Validate model parameters
    ///
    /// Checks that parameters are valid for the given number of members:
    /// - Values in valid ranges (0-1 for probabilities)
    /// - Correct number of parameters for member count
    /// - Parameters sum to 1 where required (Alpha-Factor, Phi-Factor)
    pub fn validate(&self, member_count: usize) -> Result<()> {
        match self {
            CcfModel::BetaFactor(beta) => {
                if *beta < 0.0 || *beta > 1.0 {
                    return Err(crate::error::PraxisError::Mef(
                        crate::error::MefError::Domain {
                            message: "Beta factor must be in range [0, 1]".to_string(),
                            value: Some(beta.to_string()),
                            attribute: Some("beta".to_string()),
                        },
                    ));
                }
            }
            CcfModel::AlphaFactor(alphas) => {
                if alphas.len() != member_count {
                    return Err(crate::error::PraxisError::Logic(format!(
                        "Alpha-Factor model requires {} parameters for {} members, got {}",
                        member_count,
                        member_count,
                        alphas.len()
                    )));
                }

                // Check all values in [0, 1]
                for (i, alpha) in alphas.iter().enumerate() {
                    if *alpha < 0.0 || *alpha > 1.0 {
                        return Err(crate::error::PraxisError::Mef(
                            crate::error::MefError::Domain {
                                message: format!(
                                    "Alpha factor α_{} = {} must be in range [0, 1]",
                                    i + 1,
                                    alpha
                                ),
                                value: Some(alpha.to_string()),
                                attribute: Some(format!("alpha_{}", i + 1)),
                            },
                        ));
                    }
                }

                // Check sum equals 1
                let sum: f64 = alphas.iter().sum();
                if (sum - 1.0).abs() > 1e-6 {
                    return Err(crate::error::PraxisError::Mef(
                        crate::error::MefError::Domain {
                            message: format!("Alpha factors must sum to 1, got {}", sum),
                            value: Some(sum.to_string()),
                            attribute: Some("alpha_sum".to_string()),
                        },
                    ));
                }
            }
            CcfModel::Mgl(factors) => {
                if factors.len() != member_count {
                    return Err(crate::error::PraxisError::Logic(format!(
                        "MGL model requires {} parameters for {} members, got {}",
                        member_count,
                        member_count,
                        factors.len()
                    )));
                }

                // Check all values in [0, 1]
                for (i, q) in factors.iter().enumerate() {
                    if *q < 0.0 || *q > 1.0 {
                        return Err(crate::error::PraxisError::Mef(
                            crate::error::MefError::Domain {
                                message: format!(
                                    "MGL factor Q_{} = {} must be in range [0, 1]",
                                    i + 1,
                                    q
                                ),
                                value: Some(q.to_string()),
                                attribute: Some(format!("Q_{}", i + 1)),
                            },
                        ));
                    }
                }
            }
            CcfModel::PhiFactor(phis) => {
                if phis.len() != member_count {
                    return Err(crate::error::PraxisError::Logic(format!(
                        "Phi-Factor model requires {} parameters for {} members, got {}",
                        member_count,
                        member_count,
                        phis.len()
                    )));
                }

                // Check all values in [0, 1]
                for (i, phi) in phis.iter().enumerate() {
                    if *phi < 0.0 || *phi > 1.0 {
                        return Err(crate::error::PraxisError::Mef(
                            crate::error::MefError::Domain {
                                message: format!(
                                    "Phi factor φ_{} = {} must be in range [0, 1]",
                                    i + 1,
                                    phi
                                ),
                                value: Some(phi.to_string()),
                                attribute: Some(format!("phi_{}", i + 1)),
                            },
                        ));
                    }
                }

                // Check sum equals 1
                let sum: f64 = phis.iter().sum();
                if (sum - 1.0).abs() > 1e-6 {
                    return Err(crate::error::PraxisError::Mef(
                        crate::error::MefError::Domain {
                            message: format!("Phi factors must sum to 1, got {}", sum),
                            value: Some(sum.to_string()),
                            attribute: Some("phi_sum".to_string()),
                        },
                    ));
                }
            }
        }
        Ok(())
    }

    /// Expand CCF model into individual failure events
    ///
    /// # Arguments
    /// * `group_id` - ID of the CCF group
    /// * `members` - List of member component IDs
    /// * `base_probability` - Base failure probability Q
    ///
    /// # Returns
    /// Vector of expanded events with IDs and calculated probabilities
    pub fn expand(
        &self,
        group_id: &str,
        members: &[String],
        base_probability: f64,
    ) -> Result<Vec<CcfEvent>> {
        match self {
            CcfModel::BetaFactor(beta) => {
                expand_beta_factor(group_id, members, *beta, base_probability)
            }
            CcfModel::AlphaFactor(alphas) => {
                expand_alpha_factor(group_id, members, alphas, base_probability)
            }
            CcfModel::Mgl(factors) => expand_mgl(group_id, members, factors, base_probability),
            CcfModel::PhiFactor(phis) => {
                expand_phi_factor(group_id, members, phis, base_probability)
            }
        }
    }

    /// Get a human-readable name for the model
    pub fn model_name(&self) -> &'static str {
        match self {
            CcfModel::BetaFactor(_) => "Beta-Factor",
            CcfModel::AlphaFactor(_) => "Alpha-Factor",
            CcfModel::Mgl(_) => "MGL",
            CcfModel::PhiFactor(_) => "Phi-Factor",
        }
    }
}

/// Expanded CCF event
///
/// Represents a single failure mode generated from CCF expansion.
/// Each event corresponds to a specific combination of component failures.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CcfEvent {
    /// Generated event ID (e.g., "CCF-Pumps-indep-1", "CCF-Pumps-common")
    pub id: String,

    /// Components that fail in this event
    pub failed_members: Vec<String>,

    /// Calculated probability for this failure mode
    pub probability: f64,

    /// Order of the event (number of simultaneous failures)
    pub order: usize,
}

impl CcfEvent {
    /// Create a new CCF event
    pub fn new(id: String, failed_members: Vec<String>, probability: f64) -> Self {
        let order = failed_members.len();
        CcfEvent {
            id,
            failed_members,
            probability,
            order,
        }
    }
}

// ============================================================================
// CCF Model Expansion Functions
// ============================================================================

/// Expand Beta-Factor model
///
/// Generates n+1 events:
/// - n independent events: P_i = (1-β)Q for each member
/// - 1 common event: P_common = βQ for all members
fn expand_beta_factor(
    group_id: &str,
    members: &[String],
    beta: f64,
    base_prob: f64,
) -> Result<Vec<CcfEvent>> {
    let mut events = Vec::new();

    // Independent failures: (1-β)Q for each member
    let indep_prob = (1.0 - beta) * base_prob;
    for (i, member) in members.iter().enumerate() {
        let event_id = format!("{}-indep-{}", group_id, i + 1);
        events.push(CcfEvent::new(event_id, vec![member.clone()], indep_prob));
    }

    // Common failure: βQ for all members
    let common_prob = beta * base_prob;
    let event_id = format!("{}-common", group_id);
    events.push(CcfEvent::new(event_id, members.to_vec(), common_prob));

    Ok(events)
}

/// Expand Alpha-Factor model
///
/// Generates events for all possible failure combinations.
/// α_k represents the fraction of failures involving exactly k components.
fn expand_alpha_factor(
    group_id: &str,
    members: &[String],
    alphas: &[f64],
    base_prob: f64,
) -> Result<Vec<CcfEvent>> {
    let mut events = Vec::new();
    let n = members.len();

    // For each failure level k (1 to n components)
    for k in 1..=n {
        let alpha_k = alphas[k - 1];
        let prob_k = alpha_k * base_prob;

        // Generate all combinations of size k
        let combinations = generate_combinations(members, k);
        let num_combinations = combinations.len();

        // Distribute probability equally among combinations
        let event_prob = prob_k / num_combinations as f64;

        for (i, combo) in combinations.iter().enumerate() {
            let event_id = format!("{}-alpha-{}-{}", group_id, k, i + 1);
            events.push(CcfEvent::new(event_id, combo.clone(), event_prob));
        }
    }

    Ok(events)
}

/// Expand MGL (Multiple Greek Letter) model
///
/// Similar to Alpha-Factor but with direct Q_k probabilities.
fn expand_mgl(
    group_id: &str,
    members: &[String],
    factors: &[f64],
    _base_prob: f64,
) -> Result<Vec<CcfEvent>> {
    let mut events = Vec::new();
    let n = members.len();

    // For each failure level k (1 to n components)
    for k in 1..=n {
        let q_k = factors[k - 1];

        // Generate all combinations of size k
        let combinations = generate_combinations(members, k);
        let num_combinations = combinations.len();

        // Distribute probability equally among combinations
        let event_prob = q_k / num_combinations as f64;

        for (i, combo) in combinations.iter().enumerate() {
            let event_id = format!("{}-mgl-{}-{}", group_id, k, i + 1);
            events.push(CcfEvent::new(event_id, combo.clone(), event_prob));
        }
    }

    Ok(events)
}

/// Expand Phi-Factor model
///
/// Similar to Alpha-Factor with different parameterization.
fn expand_phi_factor(
    group_id: &str,
    members: &[String],
    phis: &[f64],
    base_prob: f64,
) -> Result<Vec<CcfEvent>> {
    let mut events = Vec::new();
    let n = members.len();

    // For each failure level k (1 to n components)
    for k in 1..=n {
        let phi_k = phis[k - 1];
        let prob_k = phi_k * base_prob;

        // Generate all combinations of size k
        let combinations = generate_combinations(members, k);
        let num_combinations = combinations.len();

        // Distribute probability equally among combinations
        let event_prob = prob_k / num_combinations as f64;

        for (i, combo) in combinations.iter().enumerate() {
            let event_id = format!("{}-phi-{}-{}", group_id, k, i + 1);
            events.push(CcfEvent::new(event_id, combo.clone(), event_prob));
        }
    }

    Ok(events)
}

/// Generate all combinations of size k from items
fn generate_combinations(items: &[String], k: usize) -> Vec<Vec<String>> {
    let n = items.len();
    if k > n || k == 0 {
        return vec![];
    }
    if k == n {
        return vec![items.to_vec()];
    }

    let mut result = Vec::new();
    let mut indices: Vec<usize> = (0..k).collect();

    loop {
        // Add current combination
        let combo: Vec<String> = indices.iter().map(|&i| items[i].clone()).collect();
        result.push(combo);

        // Find the rightmost index that can be incremented
        let mut pos = k;
        while pos > 0 && indices[pos - 1] == n - k + pos - 1 {
            pos -= 1;
        }

        // If no index can be incremented, we're done
        if pos == 0 {
            break;
        }

        // Increment the found index and reset all indices to its right
        indices[pos - 1] += 1;
        for j in pos..k {
            indices[j] = indices[j - 1] + 1;
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ccf_group_creation() {
        let members = vec!["E1".to_string(), "E2".to_string()];
        let model = CcfModel::BetaFactor(0.1);
        let group = CcfGroup::new("CCF1", members.clone(), model).unwrap();

        assert_eq!(group.element().id(), "CCF1");
        assert_eq!(group.members, members);
        assert_eq!(group.size(), 2);
    }

    #[test]
    fn test_ccf_group_requires_min_two_members() {
        let members = vec!["E1".to_string()];
        let model = CcfModel::BetaFactor(0.1);
        let result = CcfGroup::new("CCF1", members, model);

        assert!(result.is_err());
    }

    #[test]
    fn test_beta_factor_validation() {
        let model = CcfModel::BetaFactor(0.5);
        assert!(model.validate(2).is_ok());

        let invalid = CcfModel::BetaFactor(1.5);
        assert!(invalid.validate(2).is_err());

        let negative = CcfModel::BetaFactor(-0.1);
        assert!(negative.validate(2).is_err());
    }

    #[test]
    fn test_alpha_factor_validation() {
        let model = CcfModel::AlphaFactor(vec![0.7, 0.3]);
        assert!(model.validate(2).is_ok());

        // Wrong number of parameters
        let wrong_count = CcfModel::AlphaFactor(vec![0.7, 0.3]);
        assert!(wrong_count.validate(3).is_err());

        // Sum not equal to 1
        let wrong_sum = CcfModel::AlphaFactor(vec![0.5, 0.3]);
        assert!(wrong_sum.validate(2).is_err());
    }

    #[test]
    fn test_beta_factor_expansion() {
        let members = vec!["E1".to_string(), "E2".to_string()];
        let beta = 0.1;
        let base_prob = 0.01;

        let events = expand_beta_factor("CCF1", &members, beta, base_prob).unwrap();

        // Should have 3 events: 2 independent + 1 common
        assert_eq!(events.len(), 3);

        // Check independent events (use approximate equality due to floating point)
        assert!((events[0].probability - 0.009).abs() < 1e-9); // (1-0.1) * 0.01
        assert!((events[1].probability - 0.009).abs() < 1e-9);

        // Check common event
        assert!((events[2].probability - 0.001).abs() < 1e-9); // 0.1 * 0.01
        assert_eq!(events[2].failed_members.len(), 2);
    }

    #[test]
    fn test_generate_combinations() {
        let items = vec!["A".to_string(), "B".to_string(), "C".to_string()];

        let combos_1 = generate_combinations(&items, 1);
        assert_eq!(combos_1.len(), 3);

        let combos_2 = generate_combinations(&items, 2);
        assert_eq!(combos_2.len(), 3); // C(3,2) = 3

        let combos_3 = generate_combinations(&items, 3);
        assert_eq!(combos_3.len(), 1); // C(3,3) = 1
    }

    #[test]
    fn test_ccf_event_order() {
        let event = CcfEvent::new(
            "CCF1-common".to_string(),
            vec!["E1".to_string(), "E2".to_string(), "E3".to_string()],
            0.001,
        );

        assert_eq!(event.order, 3);
    }

    // ============================================================================
    // Beta-Factor Model Tests
    // ============================================================================

    #[test]
    fn test_beta_factor_two_components() {
        // Test Beta-Factor with 2 components as in quickstart.md Test 4.1
        let group = CcfGroup::new(
            "Pumps",
            vec!["PumpOne".to_string(), "PumpTwo".to_string()],
            CcfModel::BetaFactor(0.2),
        )
        .unwrap();

        let base_prob = 0.1;
        let events = group.expand(base_prob).unwrap();

        // Should have 3 events: 2 independent + 1 common
        assert_eq!(events.len(), 3);

        // Check independent events: (1-0.2) * 0.1 = 0.08
        assert!((events[0].probability - 0.08).abs() < 1e-9);
        assert_eq!(events[0].failed_members, vec!["PumpOne"]);
        assert_eq!(events[0].order, 1);

        assert!((events[1].probability - 0.08).abs() < 1e-9);
        assert_eq!(events[1].failed_members, vec!["PumpTwo"]);
        assert_eq!(events[1].order, 1);

        // Check common event: 0.2 * 0.1 = 0.02
        assert!((events[2].probability - 0.02).abs() < 1e-9);
        assert_eq!(events[2].failed_members.len(), 2);
        assert_eq!(events[2].order, 2);
    }

    #[test]
    fn test_beta_factor_three_components() {
        // Test Beta-Factor with 3 components (like Valves in beta_factor_ccf.xml)
        let group = CcfGroup::new(
            "Valves",
            vec![
                "ValveOne".to_string(),
                "ValveTwo".to_string(),
                "ValveThree".to_string(),
            ],
            CcfModel::BetaFactor(0.2),
        )
        .unwrap();

        let base_prob = 0.1;
        let events = group.expand(base_prob).unwrap();

        // Should have 4 events: 3 independent + 1 common
        assert_eq!(events.len(), 4);

        // Check all independent events have correct probability
        for event in events.iter().take(3) {
            assert!((event.probability - 0.08).abs() < 1e-9);
            assert_eq!(event.order, 1);
        }

        // Check common event
        assert!((events[3].probability - 0.02).abs() < 1e-9);
        assert_eq!(events[3].failed_members.len(), 3);
        assert_eq!(events[3].order, 3);
    }

    #[test]
    fn test_beta_factor_high_beta() {
        // Test with high beta value (strong common cause)
        let group = CcfGroup::new(
            "CCF1",
            vec!["E1".to_string(), "E2".to_string()],
            CcfModel::BetaFactor(0.8),
        )
        .unwrap();

        let base_prob = 0.5;
        let events = group.expand(base_prob).unwrap();

        // Independent: (1-0.8) * 0.5 = 0.1
        assert!((events[0].probability - 0.1).abs() < 1e-9);
        assert!((events[1].probability - 0.1).abs() < 1e-9);

        // Common: 0.8 * 0.5 = 0.4 (dominant)
        assert!((events[2].probability - 0.4).abs() < 1e-9);
    }

    #[test]
    fn test_beta_factor_low_beta() {
        // Test with low beta value (weak common cause)
        let group = CcfGroup::new(
            "CCF2",
            vec!["E1".to_string(), "E2".to_string()],
            CcfModel::BetaFactor(0.05),
        )
        .unwrap();

        let base_prob = 0.2;
        let events = group.expand(base_prob).unwrap();

        // Independent: (1-0.05) * 0.2 = 0.19 (dominant)
        assert!((events[0].probability - 0.19).abs() < 1e-9);
        assert!((events[1].probability - 0.19).abs() < 1e-9);

        // Common: 0.05 * 0.2 = 0.01 (small)
        assert!((events[2].probability - 0.01).abs() < 1e-9);
    }

    #[test]
    fn test_beta_factor_zero_beta() {
        // Test beta = 0 (no common cause, all independent)
        let group = CcfGroup::new(
            "CCF3",
            vec!["E1".to_string(), "E2".to_string()],
            CcfModel::BetaFactor(0.0),
        )
        .unwrap();

        let base_prob = 0.1;
        let events = group.expand(base_prob).unwrap();

        // All probability goes to independent events
        assert!((events[0].probability - 0.1).abs() < 1e-9);
        assert!((events[1].probability - 0.1).abs() < 1e-9);

        // Common event has zero probability
        assert!((events[2].probability).abs() < 1e-9);
    }

    #[test]
    fn test_beta_factor_one_beta() {
        // Test beta = 1 (all common cause, no independent)
        let group = CcfGroup::new(
            "CCF4",
            vec!["E1".to_string(), "E2".to_string()],
            CcfModel::BetaFactor(1.0),
        )
        .unwrap();

        let base_prob = 0.1;
        let events = group.expand(base_prob).unwrap();

        // All probability goes to common event
        assert!((events[0].probability).abs() < 1e-9);
        assert!((events[1].probability).abs() < 1e-9);

        // Common event has all probability
        assert!((events[2].probability - 0.1).abs() < 1e-9);
    }

    #[test]
    fn test_beta_factor_event_names() {
        // Test that event IDs are generated correctly
        let group = CcfGroup::new(
            "PumpGroup",
            vec!["P1".to_string(), "P2".to_string(), "P3".to_string()],
            CcfModel::BetaFactor(0.15),
        )
        .unwrap();

        let events = group.expand(0.05).unwrap();

        // Check event ID format
        assert_eq!(events[0].id, "PumpGroup-indep-1");
        assert_eq!(events[1].id, "PumpGroup-indep-2");
        assert_eq!(events[2].id, "PumpGroup-indep-3");
        assert_eq!(events[3].id, "PumpGroup-common");
    }

    #[test]
    fn test_beta_factor_probability_conservation() {
        // Verify total probability is conserved across all failure modes
        let group = CcfGroup::new(
            "CCF5",
            vec!["E1".to_string(), "E2".to_string()],
            CcfModel::BetaFactor(0.3),
        )
        .unwrap();

        let base_prob = 0.2;
        let events = group.expand(base_prob).unwrap();

        // For 2 components:
        // Total = 2 * P_indep + P_common
        // Total = 2 * (1-β)Q + βQ = 2(1-β)Q + βQ = (2-2β+β)Q = (2-β)Q
        let total = events[0].probability + events[1].probability + events[2].probability;
        let expected = (2.0 - 0.3) * base_prob; // (2 - β) * Q

        assert!((total - expected).abs() < 1e-9);
    }

    #[test]
    fn test_beta_factor_large_group() {
        // Test with larger group (5 components)
        let members: Vec<String> = (1..=5).map(|i| format!("E{}", i)).collect();
        let group = CcfGroup::new("CCF6", members, CcfModel::BetaFactor(0.25)).unwrap();

        let base_prob = 0.08;
        let events = group.expand(base_prob).unwrap();

        // Should have 6 events: 5 independent + 1 common
        assert_eq!(events.len(), 6);

        // Check independent probabilities
        for event in events.iter().take(5) {
            assert!((event.probability - 0.06).abs() < 1e-9); // (1-0.25) * 0.08
            assert_eq!(event.order, 1);
        }

        // Check common event
        assert!((events[5].probability - 0.02).abs() < 1e-9); // 0.25 * 0.08
        assert_eq!(events[5].order, 5);
    }

    #[test]
    fn test_beta_factor_validation_out_of_range() {
        // Test that beta outside [0,1] is rejected
        let result1 = CcfGroup::new(
            "Bad1",
            vec!["E1".to_string(), "E2".to_string()],
            CcfModel::BetaFactor(-0.1),
        );
        assert!(result1.is_err());

        let result2 = CcfGroup::new(
            "Bad2",
            vec!["E1".to_string(), "E2".to_string()],
            CcfModel::BetaFactor(1.5),
        );
        assert!(result2.is_err());
    }

    // ============================================================================
    // Alpha-Factor Model Tests
    // ============================================================================

    #[test]
    fn test_alpha_factor_three_components() {
        // Test Alpha-Factor with 3 components as in alpha_factor_ccf.xml
        // α₁ = 0.7, α₂ = 0.2, α₃ = 0.1 (must sum to 1.0)
        let group = CcfGroup::new(
            "Pumps",
            vec![
                "PumpOne".to_string(),
                "PumpTwo".to_string(),
                "PumpThree".to_string(),
            ],
            CcfModel::AlphaFactor(vec![0.7, 0.2, 0.1]),
        )
        .unwrap();

        let base_prob = 0.1;
        let events = group.expand(base_prob).unwrap();

        // Alpha-Factor generates events for all k-combinations
        // k=1: C(3,1)=3 events, each gets α₁*Q / 3 = 0.7*0.1/3 ≈ 0.0233
        // k=2: C(3,2)=3 events, each gets α₂*Q / 3 = 0.2*0.1/3 ≈ 0.0067
        // k=3: C(3,3)=1 event,  gets α₃*Q / 1 = 0.1*0.1/1 = 0.01
        // Total: 7 events
        assert_eq!(events.len(), 7);

        // Check k=1 events (order 1)
        for event in events.iter().take(3) {
            assert!((event.probability - 0.7 * 0.1 / 3.0).abs() < 1e-9);
            assert_eq!(event.order, 1);
        }

        // Check k=2 events (order 2)
        for event in events.iter().take(6).skip(3) {
            assert!((event.probability - 0.2 * 0.1 / 3.0).abs() < 1e-9);
            assert_eq!(event.order, 2);
        }

        // Check k=3 event (order 3)
        assert!((events[6].probability - 0.1 * 0.1).abs() < 1e-9);
        assert_eq!(events[6].order, 3);
    }

    #[test]
    fn test_alpha_factor_two_components() {
        // Test Alpha-Factor with 2 components
        // α₁ = 0.6, α₂ = 0.4 (must sum to 1.0)
        let group = CcfGroup::new(
            "Valves",
            vec!["V1".to_string(), "V2".to_string()],
            CcfModel::AlphaFactor(vec![0.6, 0.4]),
        )
        .unwrap();

        let base_prob = 0.05;
        let events = group.expand(base_prob).unwrap();

        // k=1: C(2,1)=2 events, each gets 0.6*0.05/2 = 0.015
        // k=2: C(2,2)=1 event,  gets 0.4*0.05/1 = 0.02
        // Total: 3 events
        assert_eq!(events.len(), 3);

        assert!((events[0].probability - 0.015).abs() < 1e-9);
        assert!((events[1].probability - 0.015).abs() < 1e-9);
        assert!((events[2].probability - 0.02).abs() < 1e-9);
    }

    #[test]
    fn test_alpha_factor_equal_distribution() {
        // Test with equal α values
        let group = CcfGroup::new(
            "Equal",
            vec!["E1".to_string(), "E2".to_string(), "E3".to_string()],
            CcfModel::AlphaFactor(vec![1.0 / 3.0, 1.0 / 3.0, 1.0 / 3.0]),
        )
        .unwrap();

        let base_prob = 0.3;
        let events = group.expand(base_prob).unwrap();

        assert_eq!(events.len(), 7);

        // All k=1 events should have same probability
        assert!((events[0].probability - events[1].probability).abs() < 1e-9);
        assert!((events[1].probability - events[2].probability).abs() < 1e-9);

        // All k=2 events should have same probability
        assert!((events[3].probability - events[4].probability).abs() < 1e-9);
        assert!((events[4].probability - events[5].probability).abs() < 1e-9);
    }

    #[test]
    fn test_alpha_factor_extreme_single_failure() {
        // Test with all probability on single failures (α₁=1.0, others=0)
        let group = CcfGroup::new(
            "SingleOnly",
            vec!["E1".to_string(), "E2".to_string()],
            CcfModel::AlphaFactor(vec![1.0, 0.0]),
        )
        .unwrap();

        let base_prob = 0.2;
        let events = group.expand(base_prob).unwrap();

        // All probability on k=1 events
        assert!((events[0].probability - 0.1).abs() < 1e-9);
        assert!((events[1].probability - 0.1).abs() < 1e-9);
        assert!((events[2].probability).abs() < 1e-9); // k=2 has zero
    }

    #[test]
    fn test_alpha_factor_extreme_total_failure() {
        // Test with all probability on total failure (α₁=0, α₂=0, α₃=1.0)
        let group = CcfGroup::new(
            "TotalOnly",
            vec!["E1".to_string(), "E2".to_string(), "E3".to_string()],
            CcfModel::AlphaFactor(vec![0.0, 0.0, 1.0]),
        )
        .unwrap();

        let base_prob = 0.15;
        let events = group.expand(base_prob).unwrap();

        // Zero probability on k=1 and k=2
        for event in events.iter().take(6) {
            assert!(event.probability.abs() < 1e-9);
        }

        // All probability on k=3
        assert!((events[6].probability - 0.15).abs() < 1e-9);
    }

    #[test]
    fn test_alpha_factor_probability_conservation() {
        // Verify total probability equals base probability
        let group = CcfGroup::new(
            "Conservation",
            vec!["E1".to_string(), "E2".to_string(), "E3".to_string()],
            CcfModel::AlphaFactor(vec![0.5, 0.3, 0.2]),
        )
        .unwrap();

        let base_prob = 0.25;
        let events = group.expand(base_prob).unwrap();

        let total: f64 = events.iter().map(|e| e.probability).sum();
        assert!((total - base_prob).abs() < 1e-9);
    }

    #[test]
    fn test_alpha_factor_event_names() {
        // Test Alpha-Factor event ID generation
        let group = CcfGroup::new(
            "TestGroup",
            vec!["A".to_string(), "B".to_string()],
            CcfModel::AlphaFactor(vec![0.7, 0.3]),
        )
        .unwrap();

        let events = group.expand(0.1).unwrap();

        // k=1 events
        assert_eq!(events[0].id, "TestGroup-alpha-1-1");
        assert_eq!(events[1].id, "TestGroup-alpha-1-2");
        // k=2 event
        assert_eq!(events[2].id, "TestGroup-alpha-2-1");
    }

    #[test]
    fn test_alpha_factor_validation_sum_not_one() {
        // Test that α values not summing to 1 is rejected
        let result = CcfGroup::new(
            "BadSum",
            vec!["E1".to_string(), "E2".to_string()],
            CcfModel::AlphaFactor(vec![0.5, 0.3]), // Sums to 0.8, not 1.0
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_alpha_factor_validation_out_of_range() {
        // Test that α values outside [0,1] are rejected
        let result = CcfGroup::new(
            "BadRange",
            vec!["E1".to_string(), "E2".to_string()],
            CcfModel::AlphaFactor(vec![1.5, -0.5]),
        );
        assert!(result.is_err());
    }

    // ============================================================================
    // MGL Model Tests
    // ============================================================================

    #[test]
    fn test_mgl_three_components() {
        // Test MGL with 3 components as in mgl_ccf.xml
        // Q₁ = 0 (not specified, defaults to 0)
        // Q₂ = 0.2, Q₃ = 0.1
        let group = CcfGroup::new(
            "Pumps",
            vec![
                "PumpOne".to_string(),
                "PumpTwo".to_string(),
                "PumpThree".to_string(),
            ],
            CcfModel::Mgl(vec![0.0, 0.2, 0.1]),
        )
        .unwrap();

        let base_prob = 0.1; // Distribution value (not used in MGL directly)
        let events = group.expand(base_prob).unwrap();

        // MGL generates events for all k-combinations with direct Q_k values
        // k=1: C(3,1)=3 events, each gets Q₁ / 3 = 0.0/3 = 0
        // k=2: C(3,2)=3 events, each gets Q₂ / 3 = 0.2/3 ≈ 0.0667
        // k=3: C(3,3)=1 event,  gets Q₃ / 1 = 0.1/1 = 0.1
        // Total: 7 events
        assert_eq!(events.len(), 7);

        // Check k=1 events (Q₁ = 0)
        for event in events.iter().take(3) {
            assert!(event.probability.abs() < 1e-9);
            assert_eq!(event.order, 1);
        }

        // Check k=2 events (Q₂ = 0.2)
        for event in events.iter().take(6).skip(3) {
            assert!((event.probability - 0.2 / 3.0).abs() < 1e-9);
            assert_eq!(event.order, 2);
        }

        // Check k=3 event (Q₃ = 0.1)
        assert!((events[6].probability - 0.1).abs() < 1e-9);
        assert_eq!(events[6].order, 3);
    }

    #[test]
    fn test_mgl_two_components() {
        // Test MGL with 2 components
        // Q₁ = 0.05, Q₂ = 0.03
        let group = CcfGroup::new(
            "Valves",
            vec!["V1".to_string(), "V2".to_string()],
            CcfModel::Mgl(vec![0.05, 0.03]),
        )
        .unwrap();

        let base_prob = 0.1;
        let events = group.expand(base_prob).unwrap();

        // k=1: C(2,1)=2 events, each gets 0.05/2 = 0.025
        // k=2: C(2,2)=1 event,  gets 0.03/1 = 0.03
        // Total: 3 events
        assert_eq!(events.len(), 3);

        assert!((events[0].probability - 0.025).abs() < 1e-9);
        assert!((events[1].probability - 0.025).abs() < 1e-9);
        assert!((events[2].probability - 0.03).abs() < 1e-9);
    }

    #[test]
    fn test_mgl_only_total_failure() {
        // Test MGL with only total failure probability
        // Q₁ = 0, Q₂ = 0, Q₃ = 0.12
        let group = CcfGroup::new(
            "TotalOnly",
            vec!["E1".to_string(), "E2".to_string(), "E3".to_string()],
            CcfModel::Mgl(vec![0.0, 0.0, 0.12]),
        )
        .unwrap();

        let base_prob = 0.1;
        let events = group.expand(base_prob).unwrap();

        // Zero probability on k=1 and k=2
        for event in events.iter().take(6) {
            assert!(event.probability.abs() < 1e-9);
        }

        // All probability on k=3
        assert!((events[6].probability - 0.12).abs() < 1e-9);
    }

    #[test]
    fn test_mgl_equal_probabilities() {
        // Test MGL with equal probabilities for all k levels
        let group = CcfGroup::new(
            "Equal",
            vec!["E1".to_string(), "E2".to_string(), "E3".to_string()],
            CcfModel::Mgl(vec![0.15, 0.15, 0.15]),
        )
        .unwrap();

        let base_prob = 0.1;
        let events = group.expand(base_prob).unwrap();

        assert_eq!(events.len(), 7);

        // k=1: 3 events, each 0.15/3 = 0.05
        for event in events.iter().take(3) {
            assert!((event.probability - 0.05).abs() < 1e-9);
        }

        // k=2: 3 events, each 0.15/3 = 0.05
        for event in events.iter().take(6).skip(3) {
            assert!((event.probability - 0.05).abs() < 1e-9);
        }

        // k=3: 1 event, 0.15/1 = 0.15
        assert!((events[6].probability - 0.15).abs() < 1e-9);
    }

    #[test]
    fn test_mgl_decreasing_probabilities() {
        // Test typical MGL pattern: Q₁ > Q₂ > Q₃
        let group = CcfGroup::new(
            "Decreasing",
            vec!["E1".to_string(), "E2".to_string(), "E3".to_string()],
            CcfModel::Mgl(vec![0.3, 0.15, 0.05]),
        )
        .unwrap();

        let base_prob = 0.1;
        let events = group.expand(base_prob).unwrap();

        // k=1: highest individual probabilities
        assert!((events[0].probability - 0.1).abs() < 1e-9);

        // k=2: medium probabilities
        assert!((events[3].probability - 0.05).abs() < 1e-9);

        // k=3: lowest probability
        assert!((events[6].probability - 0.05).abs() < 1e-9);

        // Verify decreasing trend in per-event probabilities
        assert!(events[0].probability > events[3].probability);
    }

    #[test]
    fn test_mgl_event_names() {
        // Test MGL event ID generation
        let group = CcfGroup::new(
            "MGLGroup",
            vec!["A".to_string(), "B".to_string()],
            CcfModel::Mgl(vec![0.08, 0.04]),
        )
        .unwrap();

        let events = group.expand(0.1).unwrap();

        // k=1 events
        assert_eq!(events[0].id, "MGLGroup-mgl-1-1");
        assert_eq!(events[1].id, "MGLGroup-mgl-1-2");
        // k=2 event
        assert_eq!(events[2].id, "MGLGroup-mgl-2-1");
    }

    #[test]
    fn test_mgl_validation_out_of_range() {
        // Test that Q values outside [0,1] are rejected
        let result = CcfGroup::new(
            "BadRange",
            vec!["E1".to_string(), "E2".to_string()],
            CcfModel::Mgl(vec![1.5, 0.2]),
        );
        assert!(result.is_err());

        let result2 = CcfGroup::new(
            "BadRange2",
            vec!["E1".to_string(), "E2".to_string()],
            CcfModel::Mgl(vec![0.1, -0.05]),
        );
        assert!(result2.is_err());
    }

    #[test]
    fn test_mgl_large_group() {
        // Test MGL with 5 components
        let members: Vec<String> = (1..=5).map(|i| format!("E{}", i)).collect();
        let group = CcfGroup::new(
            "LargeMGL",
            members,
            CcfModel::Mgl(vec![0.5, 0.3, 0.15, 0.08, 0.02]),
        )
        .unwrap();

        let base_prob = 0.1;
        let events = group.expand(base_prob).unwrap();

        // Total events: C(5,1) + C(5,2) + C(5,3) + C(5,4) + C(5,5)
        //             = 5 + 10 + 10 + 5 + 1 = 31
        assert_eq!(events.len(), 31);

        // Check first k=1 event: Q₁/C(5,1) = 0.5/5 = 0.1
        assert!((events[0].probability - 0.1).abs() < 1e-9);

        // Check last event (k=5): Q₅/1 = 0.02
        assert!((events[30].probability - 0.02).abs() < 1e-9);
        assert_eq!(events[30].order, 5);
    }

    #[test]
    fn test_mgl_base_prob_not_used() {
        // MGL uses Q_k values directly, not base_prob
        // This test verifies behavior is same regardless of base_prob
        let group = CcfGroup::new(
            "MGLTest",
            vec!["E1".to_string(), "E2".to_string()],
            CcfModel::Mgl(vec![0.06, 0.04]),
        )
        .unwrap();

        let events1 = group.expand(0.1).unwrap();
        let events2 = group.expand(0.5).unwrap();

        // Probabilities should be same for both
        assert!((events1[0].probability - events2[0].probability).abs() < 1e-9);
        assert!((events1[1].probability - events2[1].probability).abs() < 1e-9);
        assert!((events1[2].probability - events2[2].probability).abs() < 1e-9);
    }
}
