use crate::core::element::Element;
use crate::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CcfGroup {
    element: Element,

    pub members: Vec<String>,

    pub model: CcfModel,

    pub distribution: Option<String>,
}

impl CcfGroup {
    pub fn new(id: impl Into<String>, members: Vec<String>, model: CcfModel) -> Result<Self> {
        let element = Element::new(id.into())?;

        if members.len() < 2 {
            return Err(crate::error::PraxisError::Logic(
                "CCF group must have at least 2 members".to_string(),
            ));
        }

        model.validate(members.len())?;

        Ok(CcfGroup {
            element,
            members,
            model,
            distribution: None,
        })
    }

    pub fn element(&self) -> &Element {
        &self.element
    }

    pub fn element_mut(&mut self) -> &mut Element {
        &mut self.element
    }

    pub fn with_distribution(mut self, distribution: String) -> Self {
        self.distribution = Some(distribution);
        self
    }

    pub fn size(&self) -> usize {
        self.members.len()
    }

    pub fn expand(&self, base_probability: f64) -> Result<Vec<CcfEvent>> {
        self.model
            .expand(self.element.id(), &self.members, base_probability)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum TestingScheme {
    #[default]
    NonStaggered,
    Staggered,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CcfModel {
    BetaFactor(f64),
    AlphaFactor {
        factors: Vec<f64>,
        scheme: TestingScheme,
    },
    Mgl(Vec<f64>),
    PhiFactor(Vec<f64>),
}

impl CcfModel {
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
            CcfModel::AlphaFactor {
                factors: alphas, ..
            } => {
                if alphas.len() != member_count {
                    return Err(crate::error::PraxisError::Logic(format!(
                        "Alpha-Factor model requires {} parameters for {} members, got {}",
                        member_count,
                        member_count,
                        alphas.len()
                    )));
                }

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
                if factors.is_empty() || factors.len() > member_count - 1 {
                    return Err(crate::error::PraxisError::Logic(format!(
                        "MGL model requires 1 to {} Greek-letter factors for {} members, got {}",
                        member_count - 1,
                        member_count,
                        factors.len()
                    )));
                }

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
                if phis.is_empty() || phis.len() > member_count {
                    return Err(crate::error::PraxisError::Logic(format!(
                        "Phi-Factor model requires 1 to {} factors for {} members, got {}",
                        member_count,
                        member_count,
                        phis.len()
                    )));
                }

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
            CcfModel::AlphaFactor { factors, scheme } => {
                expand_alpha_factor(group_id, members, factors, *scheme, base_probability)
            }
            CcfModel::Mgl(factors) => expand_mgl(group_id, members, factors, base_probability),
            CcfModel::PhiFactor(phis) => {
                expand_phi_factor(group_id, members, phis, base_probability)
            }
        }
    }

    pub fn model_name(&self) -> &'static str {
        match self {
            CcfModel::BetaFactor(_) => "Beta-Factor",
            CcfModel::AlphaFactor { .. } => "Alpha-Factor",
            CcfModel::Mgl(_) => "MGL",
            CcfModel::PhiFactor(_) => "Phi-Factor",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CcfEvent {
    pub id: String,

    pub failed_members: Vec<String>,

    pub probability: f64,

    pub order: usize,
}

impl CcfEvent {
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

fn expand_beta_factor(
    group_id: &str,
    members: &[String],
    beta: f64,
    base_prob: f64,
) -> Result<Vec<CcfEvent>> {
    let mut events = Vec::new();

    let indep_prob = (1.0 - beta) * base_prob;
    for (i, member) in members.iter().enumerate() {
        let event_id = format!("{}-indep-{}", group_id, i + 1);
        events.push(CcfEvent::new(event_id, vec![member.clone()], indep_prob));
    }

    let common_prob = beta * base_prob;
    let event_id = format!("{}-common", group_id);
    events.push(CcfEvent::new(event_id, members.to_vec(), common_prob));

    Ok(events)
}

fn expand_alpha_factor(
    group_id: &str,
    members: &[String],
    alphas: &[f64],
    scheme: TestingScheme,
    base_prob: f64,
) -> Result<Vec<CcfEvent>> {
    let mut events = Vec::new();
    let n = members.len();
    let alpha_total: f64 = alphas
        .iter()
        .enumerate()
        .map(|(index, alpha)| (index + 1) as f64 * alpha)
        .sum();

    for k in 1..=n {
        let alpha_k = alphas[k - 1];
        let reciprocal = 1.0 / binomial(n - 1, k - 1);
        let per_event = match scheme {
            TestingScheme::NonStaggered => {
                if alpha_total == 0.0 {
                    0.0
                } else {
                    k as f64 * reciprocal * (alpha_k / alpha_total) * base_prob
                }
            }
            TestingScheme::Staggered => reciprocal * alpha_k * base_prob,
        };

        for (i, combo) in generate_combinations(members, k).into_iter().enumerate() {
            let event_id = format!("{}-alpha-{}-{}", group_id, k, i + 1);
            events.push(CcfEvent::new(event_id, combo, per_event));
        }
    }

    Ok(events)
}

fn expand_mgl(
    group_id: &str,
    members: &[String],
    factors: &[f64],
    base_prob: f64,
) -> Result<Vec<CcfEvent>> {
    let mut events = Vec::new();
    let n = members.len();
    let max_level = factors.len() + 1;

    for k in 1..=max_level {
        let reciprocal = 1.0 / binomial(n - 1, k - 1);
        let product: f64 = factors[..k - 1].iter().product();
        let closing = if k < max_level {
            1.0 - factors[k - 1]
        } else {
            1.0
        };
        let per_event = reciprocal * product * closing * base_prob;

        for (i, combo) in generate_combinations(members, k).into_iter().enumerate() {
            let event_id = format!("{}-mgl-{}-{}", group_id, k, i + 1);
            events.push(CcfEvent::new(event_id, combo, per_event));
        }
    }

    Ok(events)
}

fn expand_phi_factor(
    group_id: &str,
    members: &[String],
    phis: &[f64],
    base_prob: f64,
) -> Result<Vec<CcfEvent>> {
    let mut events = Vec::new();

    for k in 1..=phis.len() {
        let per_event = phis[k - 1] * base_prob;
        for (i, combo) in generate_combinations(members, k).into_iter().enumerate() {
            let event_id = format!("{}-phi-{}-{}", group_id, k, i + 1);
            events.push(CcfEvent::new(event_id, combo, per_event));
        }
    }

    Ok(events)
}

fn binomial(n: usize, k: usize) -> f64 {
    if k > n {
        return 0.0;
    }
    let k = k.min(n - k);
    let mut result = 1.0;
    for i in 0..k {
        result = result * (n - i) as f64 / (i + 1) as f64;
    }
    result
}

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
        let combo: Vec<String> = indices.iter().map(|&i| items[i].clone()).collect();
        result.push(combo);

        let mut pos = k;
        while pos > 0 && indices[pos - 1] == n - k + pos - 1 {
            pos -= 1;
        }

        if pos == 0 {
            break;
        }

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

    fn alpha(factors: Vec<f64>) -> CcfModel {
        CcfModel::AlphaFactor {
            factors,
            scheme: TestingScheme::NonStaggered,
        }
    }

    #[test]
    fn test_alpha_factor_validation() {
        let model = alpha(vec![0.7, 0.3]);
        assert!(model.validate(2).is_ok());

        let wrong_count = alpha(vec![0.7, 0.3]);
        assert!(wrong_count.validate(3).is_err());

        let wrong_sum = alpha(vec![0.5, 0.3]);
        assert!(wrong_sum.validate(2).is_err());
    }

    #[test]
    fn test_beta_factor_expansion() {
        let members = vec!["E1".to_string(), "E2".to_string()];
        let beta = 0.1;
        let base_prob = 0.01;

        let events = expand_beta_factor("CCF1", &members, beta, base_prob).unwrap();

        assert_eq!(events.len(), 3);

        assert!((events[0].probability - 0.009).abs() < 1e-9);
        assert!((events[1].probability - 0.009).abs() < 1e-9);

        assert!((events[2].probability - 0.001).abs() < 1e-9);
        assert_eq!(events[2].failed_members.len(), 2);
    }

    #[test]
    fn test_generate_combinations() {
        let items = vec!["A".to_string(), "B".to_string(), "C".to_string()];

        let combos_1 = generate_combinations(&items, 1);
        assert_eq!(combos_1.len(), 3);

        let combos_2 = generate_combinations(&items, 2);
        assert_eq!(combos_2.len(), 3);

        let combos_3 = generate_combinations(&items, 3);
        assert_eq!(combos_3.len(), 1);
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

    #[test]
    fn test_beta_factor_two_components() {
        let group = CcfGroup::new(
            "Pumps",
            vec!["PumpOne".to_string(), "PumpTwo".to_string()],
            CcfModel::BetaFactor(0.2),
        )
        .unwrap();

        let base_prob = 0.1;
        let events = group.expand(base_prob).unwrap();

        assert_eq!(events.len(), 3);

        assert!((events[0].probability - 0.08).abs() < 1e-9);
        assert_eq!(events[0].failed_members, vec!["PumpOne"]);
        assert_eq!(events[0].order, 1);

        assert!((events[1].probability - 0.08).abs() < 1e-9);
        assert_eq!(events[1].failed_members, vec!["PumpTwo"]);
        assert_eq!(events[1].order, 1);

        assert!((events[2].probability - 0.02).abs() < 1e-9);
        assert_eq!(events[2].failed_members.len(), 2);
        assert_eq!(events[2].order, 2);
    }

    #[test]
    fn test_beta_factor_three_components() {
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

        assert_eq!(events.len(), 4);

        for event in events.iter().take(3) {
            assert!((event.probability - 0.08).abs() < 1e-9);
            assert_eq!(event.order, 1);
        }

        assert!((events[3].probability - 0.02).abs() < 1e-9);
        assert_eq!(events[3].failed_members.len(), 3);
        assert_eq!(events[3].order, 3);
    }

    #[test]
    fn test_beta_factor_high_beta() {
        let group = CcfGroup::new(
            "CCF1",
            vec!["E1".to_string(), "E2".to_string()],
            CcfModel::BetaFactor(0.8),
        )
        .unwrap();

        let base_prob = 0.5;
        let events = group.expand(base_prob).unwrap();

        assert!((events[0].probability - 0.1).abs() < 1e-9);
        assert!((events[1].probability - 0.1).abs() < 1e-9);

        assert!((events[2].probability - 0.4).abs() < 1e-9);
    }

    #[test]
    fn test_beta_factor_low_beta() {
        let group = CcfGroup::new(
            "CCF2",
            vec!["E1".to_string(), "E2".to_string()],
            CcfModel::BetaFactor(0.05),
        )
        .unwrap();

        let base_prob = 0.2;
        let events = group.expand(base_prob).unwrap();

        assert!((events[0].probability - 0.19).abs() < 1e-9);
        assert!((events[1].probability - 0.19).abs() < 1e-9);

        assert!((events[2].probability - 0.01).abs() < 1e-9);
    }

    #[test]
    fn test_beta_factor_zero_beta() {
        let group = CcfGroup::new(
            "CCF3",
            vec!["E1".to_string(), "E2".to_string()],
            CcfModel::BetaFactor(0.0),
        )
        .unwrap();

        let base_prob = 0.1;
        let events = group.expand(base_prob).unwrap();

        assert!((events[0].probability - 0.1).abs() < 1e-9);
        assert!((events[1].probability - 0.1).abs() < 1e-9);

        assert!((events[2].probability).abs() < 1e-9);
    }

    #[test]
    fn test_beta_factor_one_beta() {
        let group = CcfGroup::new(
            "CCF4",
            vec!["E1".to_string(), "E2".to_string()],
            CcfModel::BetaFactor(1.0),
        )
        .unwrap();

        let base_prob = 0.1;
        let events = group.expand(base_prob).unwrap();

        assert!((events[0].probability).abs() < 1e-9);
        assert!((events[1].probability).abs() < 1e-9);

        assert!((events[2].probability - 0.1).abs() < 1e-9);
    }

    #[test]
    fn test_beta_factor_event_names() {
        let group = CcfGroup::new(
            "PumpGroup",
            vec!["P1".to_string(), "P2".to_string(), "P3".to_string()],
            CcfModel::BetaFactor(0.15),
        )
        .unwrap();

        let events = group.expand(0.05).unwrap();

        assert_eq!(events[0].id, "PumpGroup-indep-1");
        assert_eq!(events[1].id, "PumpGroup-indep-2");
        assert_eq!(events[2].id, "PumpGroup-indep-3");
        assert_eq!(events[3].id, "PumpGroup-common");
    }

    #[test]
    fn test_beta_factor_probability_conservation() {
        let group = CcfGroup::new(
            "CCF5",
            vec!["E1".to_string(), "E2".to_string()],
            CcfModel::BetaFactor(0.3),
        )
        .unwrap();

        let base_prob = 0.2;
        let events = group.expand(base_prob).unwrap();

        let total = events[0].probability + events[1].probability + events[2].probability;
        let expected = (2.0 - 0.3) * base_prob;

        assert!((total - expected).abs() < 1e-9);
    }

    #[test]
    fn test_beta_factor_large_group() {
        let members: Vec<String> = (1..=5).map(|i| format!("E{}", i)).collect();
        let group = CcfGroup::new("CCF6", members, CcfModel::BetaFactor(0.25)).unwrap();

        let base_prob = 0.08;
        let events = group.expand(base_prob).unwrap();

        assert_eq!(events.len(), 6);

        for event in events.iter().take(5) {
            assert!((event.probability - 0.06).abs() < 1e-9);
            assert_eq!(event.order, 1);
        }

        assert!((events[5].probability - 0.02).abs() < 1e-9);
        assert_eq!(events[5].order, 5);
    }

    #[test]
    fn test_beta_factor_validation_out_of_range() {
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

    #[test]
    fn test_alpha_factor_three_components() {
        let group = CcfGroup::new(
            "Pumps",
            vec![
                "PumpOne".to_string(),
                "PumpTwo".to_string(),
                "PumpThree".to_string(),
            ],
            alpha(vec![0.7, 0.2, 0.1]),
        )
        .unwrap();

        let base_prob = 0.1;
        let events = group.expand(base_prob).unwrap();
        let alpha_t = 0.7 + 2.0 * 0.2 + 3.0 * 0.1;

        assert_eq!(events.len(), 7);

        for event in events.iter().take(3) {
            assert!((event.probability - (0.7 / alpha_t) * base_prob).abs() < 1e-9);
            assert_eq!(event.order, 1);
        }
        for event in events.iter().take(6).skip(3) {
            assert!((event.probability - (2.0 / 2.0) * (0.2 / alpha_t) * base_prob).abs() < 1e-9);
            assert_eq!(event.order, 2);
        }
        assert!((events[6].probability - (3.0 / 1.0) * (0.1 / alpha_t) * base_prob).abs() < 1e-9);
        assert_eq!(events[6].order, 3);
    }

    #[test]
    fn test_alpha_factor_two_components() {
        let group = CcfGroup::new(
            "Valves",
            vec!["V1".to_string(), "V2".to_string()],
            alpha(vec![0.6, 0.4]),
        )
        .unwrap();

        let base_prob = 0.05;
        let events = group.expand(base_prob).unwrap();
        let alpha_t = 0.6 + 2.0 * 0.4;

        assert_eq!(events.len(), 3);
        assert!((events[0].probability - (0.6 / alpha_t) * base_prob).abs() < 1e-9);
        assert!((events[1].probability - (0.6 / alpha_t) * base_prob).abs() < 1e-9);
        assert!((events[2].probability - 2.0 * (0.4 / alpha_t) * base_prob).abs() < 1e-9);
    }

    #[test]
    fn test_alpha_factor_equal_distribution() {
        let group = CcfGroup::new(
            "Equal",
            vec!["E1".to_string(), "E2".to_string(), "E3".to_string()],
            alpha(vec![1.0 / 3.0, 1.0 / 3.0, 1.0 / 3.0]),
        )
        .unwrap();

        let base_prob = 0.3;
        let events = group.expand(base_prob).unwrap();

        assert_eq!(events.len(), 7);

        assert!((events[0].probability - events[1].probability).abs() < 1e-9);
        assert!((events[1].probability - events[2].probability).abs() < 1e-9);

        assert!((events[3].probability - events[4].probability).abs() < 1e-9);
        assert!((events[4].probability - events[5].probability).abs() < 1e-9);
    }

    #[test]
    fn test_alpha_factor_extreme_single_failure() {
        let group = CcfGroup::new(
            "SingleOnly",
            vec!["E1".to_string(), "E2".to_string()],
            alpha(vec![1.0, 0.0]),
        )
        .unwrap();

        let base_prob = 0.2;
        let events = group.expand(base_prob).unwrap();

        assert!((events[0].probability - 0.2).abs() < 1e-9);
        assert!((events[1].probability - 0.2).abs() < 1e-9);
        assert!((events[2].probability).abs() < 1e-9);
    }

    #[test]
    fn test_alpha_factor_extreme_total_failure() {
        let group = CcfGroup::new(
            "TotalOnly",
            vec!["E1".to_string(), "E2".to_string(), "E3".to_string()],
            alpha(vec![0.0, 0.0, 1.0]),
        )
        .unwrap();

        let base_prob = 0.15;
        let events = group.expand(base_prob).unwrap();

        for event in events.iter().take(6) {
            assert!(event.probability.abs() < 1e-9);
        }

        assert!((events[6].probability - 0.15).abs() < 1e-9);
    }

    #[test]
    fn test_alpha_factor_marginal_preservation() {
        let members = vec!["E1".to_string(), "E2".to_string(), "E3".to_string()];
        let group =
            CcfGroup::new("Conservation", members.clone(), alpha(vec![0.5, 0.3, 0.2])).unwrap();

        let base_prob = 0.25;
        let events = group.expand(base_prob).unwrap();

        let marginal: f64 = events
            .iter()
            .filter(|e| e.failed_members.contains(&members[0]))
            .map(|e| e.probability)
            .sum();
        assert!((marginal - base_prob).abs() < 1e-9);
    }

    #[test]
    fn test_alpha_factor_staggered_scheme() {
        let members = vec!["E1".to_string(), "E2".to_string(), "E3".to_string()];
        let model = CcfModel::AlphaFactor {
            factors: vec![0.7, 0.2, 0.1],
            scheme: TestingScheme::Staggered,
        };
        let group = CcfGroup::new("Stag", members.clone(), model).unwrap();

        let base_prob = 0.1;
        let events = group.expand(base_prob).unwrap();

        for event in events.iter().take(3) {
            assert!((event.probability - 0.7 * base_prob).abs() < 1e-9);
        }
        for event in events.iter().take(6).skip(3) {
            assert!((event.probability - (1.0 / 2.0) * 0.2 * base_prob).abs() < 1e-9);
        }
        assert!((events[6].probability - 0.1 * base_prob).abs() < 1e-9);

        let marginal: f64 = events
            .iter()
            .filter(|e| e.failed_members.contains(&members[0]))
            .map(|e| e.probability)
            .sum();
        assert!((marginal - base_prob).abs() < 1e-9);
    }

    #[test]
    fn test_alpha_factor_event_names() {
        let group = CcfGroup::new(
            "TestGroup",
            vec!["A".to_string(), "B".to_string()],
            alpha(vec![0.7, 0.3]),
        )
        .unwrap();

        let events = group.expand(0.1).unwrap();

        assert_eq!(events[0].id, "TestGroup-alpha-1-1");
        assert_eq!(events[1].id, "TestGroup-alpha-1-2");

        assert_eq!(events[2].id, "TestGroup-alpha-2-1");
    }

    #[test]
    fn test_alpha_factor_validation_sum_not_one() {
        let result = CcfGroup::new(
            "BadSum",
            vec!["E1".to_string(), "E2".to_string()],
            alpha(vec![0.5, 0.3]),
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_alpha_factor_validation_out_of_range() {
        let result = CcfGroup::new(
            "BadRange",
            vec!["E1".to_string(), "E2".to_string()],
            alpha(vec![1.5, -0.5]),
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_mgl_three_components() {
        let group = CcfGroup::new(
            "Pumps",
            vec![
                "PumpOne".to_string(),
                "PumpTwo".to_string(),
                "PumpThree".to_string(),
            ],
            CcfModel::Mgl(vec![0.1, 0.5]),
        )
        .unwrap();

        let base_prob = 0.1;
        let events = group.expand(base_prob).unwrap();

        assert_eq!(events.len(), 7);

        for event in events.iter().take(3) {
            assert!((event.probability - (1.0 - 0.1) * base_prob).abs() < 1e-9);
            assert_eq!(event.order, 1);
        }
        for event in events.iter().take(6).skip(3) {
            assert!((event.probability - (1.0 / 2.0) * 0.1 * (1.0 - 0.5) * base_prob).abs() < 1e-9);
            assert_eq!(event.order, 2);
        }
        assert!((events[6].probability - 0.1 * 0.5 * base_prob).abs() < 1e-9);
        assert_eq!(events[6].order, 3);
    }

    #[test]
    fn test_mgl_two_components() {
        let group = CcfGroup::new(
            "Valves",
            vec!["V1".to_string(), "V2".to_string()],
            CcfModel::Mgl(vec![0.2]),
        )
        .unwrap();

        let base_prob = 0.1;
        let events = group.expand(base_prob).unwrap();

        assert_eq!(events.len(), 3);
        assert!((events[0].probability - (1.0 - 0.2) * base_prob).abs() < 1e-9);
        assert!((events[1].probability - (1.0 - 0.2) * base_prob).abs() < 1e-9);
        assert!((events[2].probability - 0.2 * base_prob).abs() < 1e-9);
    }

    #[test]
    fn test_mgl_marginal_preservation() {
        let members = vec![
            "E1".to_string(),
            "E2".to_string(),
            "E3".to_string(),
            "E4".to_string(),
        ];
        let group =
            CcfGroup::new("Mgl4", members.clone(), CcfModel::Mgl(vec![0.1, 0.4, 0.5])).unwrap();

        let base_prob = 0.1;
        let events = group.expand(base_prob).unwrap();

        assert_eq!(events.len(), 15);
        let marginal: f64 = events
            .iter()
            .filter(|e| e.failed_members.contains(&members[0]))
            .map(|e| e.probability)
            .sum();
        assert!((marginal - base_prob).abs() < 1e-9);
    }

    #[test]
    fn test_mgl_reduces_to_beta_for_two_members() {
        let members = vec!["E1".to_string(), "E2".to_string()];
        let base_prob = 0.1;
        let mgl = CcfGroup::new("Mgl", members.clone(), CcfModel::Mgl(vec![0.2]))
            .unwrap()
            .expand(base_prob)
            .unwrap();
        let beta = CcfGroup::new("Beta", members, CcfModel::BetaFactor(0.2))
            .unwrap()
            .expand(base_prob)
            .unwrap();

        assert_eq!(mgl.len(), beta.len());
        let mgl_total: f64 = mgl.iter().map(|e| e.probability).sum();
        let beta_total: f64 = beta.iter().map(|e| e.probability).sum();
        assert!((mgl_total - beta_total).abs() < 1e-9);
    }

    #[test]
    fn test_mgl_uses_base_prob() {
        let members = vec!["E1".to_string(), "E2".to_string(), "E3".to_string()];
        let group = CcfGroup::new("Scale", members, CcfModel::Mgl(vec![0.1, 0.5])).unwrap();

        let low = group.expand(0.1).unwrap();
        let high = group.expand(0.2).unwrap();
        for (a, b) in low.iter().zip(high.iter()) {
            assert!((2.0 * a.probability - b.probability).abs() < 1e-9);
        }
    }

    #[test]
    fn test_mgl_event_names() {
        let group = CcfGroup::new(
            "MGLGroup",
            vec!["A".to_string(), "B".to_string()],
            CcfModel::Mgl(vec![0.2]),
        )
        .unwrap();

        let events = group.expand(0.1).unwrap();

        assert_eq!(events[0].id, "MGLGroup-mgl-1-1");
        assert_eq!(events[1].id, "MGLGroup-mgl-1-2");

        assert_eq!(events[2].id, "MGLGroup-mgl-2-1");
    }

    #[test]
    fn test_mgl_validation_out_of_range() {
        let result = CcfGroup::new(
            "BadRange",
            vec!["E1".to_string(), "E2".to_string()],
            CcfModel::Mgl(vec![1.5]),
        );
        assert!(result.is_err());

        let result2 = CcfGroup::new(
            "BadRange2",
            vec!["E1".to_string(), "E2".to_string()],
            CcfModel::Mgl(vec![-0.05]),
        );
        assert!(result2.is_err());
    }

    #[test]
    fn test_mgl_validation_too_many_factors() {
        let result = CcfGroup::new(
            "TooMany",
            vec!["E1".to_string(), "E2".to_string()],
            CcfModel::Mgl(vec![0.1, 0.2]),
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_mgl_large_group() {
        let members: Vec<String> = (1..=5).map(|i| format!("E{}", i)).collect();
        let group = CcfGroup::new(
            "LargeMGL",
            members.clone(),
            CcfModel::Mgl(vec![0.1, 0.2, 0.3, 0.4]),
        )
        .unwrap();

        let base_prob = 0.1;
        let events = group.expand(base_prob).unwrap();

        assert_eq!(events.len(), 31);
        assert_eq!(events[30].order, 5);

        let marginal: f64 = events
            .iter()
            .filter(|e| e.failed_members.contains(&members[0]))
            .map(|e| e.probability)
            .sum();
        assert!((marginal - base_prob).abs() < 1e-9);
    }

    #[test]
    fn test_phi_factor_direct_assignment() {
        let members = vec!["E1".to_string(), "E2".to_string(), "E3".to_string()];
        let group =
            CcfGroup::new("Phi", members, CcfModel::PhiFactor(vec![0.6, 0.3, 0.1])).unwrap();

        let base_prob = 0.1;
        let events = group.expand(base_prob).unwrap();

        assert_eq!(events.len(), 7);
        for event in events.iter().take(3) {
            assert!((event.probability - 0.6 * base_prob).abs() < 1e-9);
        }
        for event in events.iter().take(6).skip(3) {
            assert!((event.probability - 0.3 * base_prob).abs() < 1e-9);
        }
        assert!((events[6].probability - 0.1 * base_prob).abs() < 1e-9);
    }
}
