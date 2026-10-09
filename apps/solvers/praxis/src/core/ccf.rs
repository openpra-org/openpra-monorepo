use std::collections::HashSet;

use crate::core::distribution::{
    CcfFactorModel, CcfTesting, UncertainParameter, UncertainUnit, VectorLaw,
};
use crate::core::distribution_sampling::{require_probability, UncertaintyProgram};
use crate::core::element::Element;
use crate::error::{MefError, PraxisError};
use crate::expression::Expr;
use crate::Result;

#[derive(Debug, Clone, PartialEq)]
pub struct CcfGroup {
    element: Element,
    pub members: Vec<String>,
    pub model: CcfModel,
    pub total: Expr,
}

fn structure_error(message: String) -> PraxisError {
    PraxisError::Mef(MefError::Validity(message))
}

impl CcfGroup {
    pub fn new(
        id: impl Into<String>,
        members: Vec<String>,
        mut model: CcfModel,
        mut total: Expr,
    ) -> Result<Self> {
        let element = Element::new(id.into())?;
        if members.len() < 2 {
            return Err(structure_error(format!(
                "common cause group '{}' needs at least 2 members",
                element.id()
            )));
        }
        model.validate(element.id(), members.len())?;
        total.assign_draw_keys(&format!("ccf:{}/total", element.id()));
        model.assign_draw_keys(element.id());
        let group = CcfGroup {
            element,
            members,
            model,
            total,
        };
        for (subject, check) in group.checks() {
            if let Expr::Constant(value) = check {
                require_probability(&subject, None, value)?;
            }
        }
        Ok(group)
    }

    pub fn element(&self) -> &Element {
        &self.element
    }

    pub fn element_mut(&mut self) -> &mut Element {
        &mut self.element
    }

    pub fn size(&self) -> usize {
        self.members.len()
    }

    pub fn checks(&self) -> Vec<(String, Expr)> {
        let id = self.element.id();
        let mut checks = vec![(
            format!("common cause group '{}' total", id),
            self.total.clone(),
        )];
        checks.extend(self.model.checks(id));
        checks
    }

    pub fn expand(&self) -> Result<Vec<CcfEvent>> {
        self.model
            .expand(self.element.id(), &self.members, &self.total)
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum CcfModel {
    BetaFactor(Expr),
    AlphaFactor {
        testing: CcfTesting,
        alphas: Vec<Expr>,
    },
    Mgl(Vec<Expr>),
    RaspMgl {
        factors: Vec<Expr>,
        virtual_events: Vec<RaspCcfEvent>,
    },
    PhiFactor(Vec<Expr>),
}

#[derive(Debug, Clone, PartialEq)]
pub struct RaspCcfEvent {
    pub id: String,
    pub member_indices: Vec<usize>,
}

pub fn alphas_key(group_id: &str) -> String {
    format!("ccf:{}/alphas", group_id)
}

pub fn phis_key(group_id: &str) -> String {
    format!("ccf:{}/phis", group_id)
}

pub fn fixed_components(key: &str, values: Vec<f64>) -> Result<Vec<Expr>> {
    let law = VectorLaw::Fixed { values };
    law.check_shape()?;
    Ok((0..law.len())
        .map(|index| Expr::Component {
            key: key.to_string(),
            index,
            law: Box::new(law.clone()),
        })
        .collect())
}

fn scalar_factor(
    table: &[UncertainParameter],
    expression: &crate::core::distribution::UncertainExpression,
    key: String,
) -> Result<Expr> {
    UncertaintyProgram::target(table, expression, &key, UncertainUnit::Fraction)
}

impl CcfModel {
    pub fn from_factors(
        group_id: &str,
        factors: &CcfFactorModel,
        table: &[UncertainParameter],
        program: &UncertaintyProgram,
    ) -> Result<CcfModel> {
        factors.check_shape()?;
        Ok(match factors {
            CcfFactorModel::BetaFactor { beta } => CcfModel::BetaFactor(scalar_factor(
                table,
                beta,
                format!("ccf:{}/beta", group_id),
            )?),
            CcfFactorModel::Mgl { factors } => CcfModel::Mgl(
                factors
                    .iter()
                    .enumerate()
                    .map(|(index, factor)| {
                        scalar_factor(
                            table,
                            factor,
                            format!("ccf:{}/factor/{}", group_id, index + 1),
                        )
                    })
                    .collect::<Result<Vec<Expr>>>()?,
            ),
            CcfFactorModel::AlphaFactor { testing, alphas } => CcfModel::AlphaFactor {
                testing: *testing,
                alphas: program.vector_components(alphas, &alphas_key(group_id))?,
            },
            CcfFactorModel::PhiFactor { phis } => {
                CcfModel::PhiFactor(program.vector_components(phis, &phis_key(group_id))?)
            }
        })
    }

    fn assign_draw_keys(&mut self, group_id: &str) {
        match self {
            CcfModel::BetaFactor(beta) => beta.assign_draw_keys(&format!("ccf:{}/beta", group_id)),
            CcfModel::AlphaFactor { alphas, .. } => {
                for alpha in alphas {
                    alpha.assign_draw_keys(&alphas_key(group_id));
                }
            }
            CcfModel::PhiFactor(phis) => {
                for phi in phis {
                    phi.assign_draw_keys(&phis_key(group_id));
                }
            }
            CcfModel::Mgl(factors) | CcfModel::RaspMgl { factors, .. } => {
                for (index, factor) in factors.iter_mut().enumerate() {
                    factor.assign_draw_keys(&format!("ccf:{}/factor/{}", group_id, index + 1));
                }
            }
        }
    }

    pub fn validate(&self, group_id: &str, member_count: usize) -> Result<()> {
        match self {
            CcfModel::BetaFactor(_) => Ok(()),
            CcfModel::AlphaFactor { alphas, .. } => {
                same_size(group_id, "alpha factor", alphas.len(), member_count)
            }
            CcfModel::PhiFactor(phis) => same_size(group_id, "phi factor", phis.len(), member_count),
            CcfModel::Mgl(factors) => mgl_size(group_id, factors.len(), member_count),
            CcfModel::RaspMgl {
                factors,
                virtual_events,
            } => {
                mgl_size(group_id, factors.len(), member_count)?;
                if virtual_events.is_empty() {
                    return Err(structure_error(format!(
                        "common cause group '{}' needs virtual events",
                        group_id
                    )));
                }
                let mut event_ids = HashSet::new();
                for event in virtual_events {
                    if event.id.is_empty() || !event_ids.insert(event.id.as_str()) {
                        return Err(structure_error(format!(
                            "common cause group '{}' needs unique, named virtual events",
                            group_id
                        )));
                    }
                    if event.member_indices.is_empty()
                        || event.member_indices.len() > factors.len() + 1
                    {
                        return Err(structure_error(format!(
                            "virtual event '{}' of common cause group '{}' has order {}, outside 1 to {}",
                            event.id,
                            group_id,
                            event.member_indices.len(),
                            factors.len() + 1
                        )));
                    }
                    let mut indices = HashSet::new();
                    for index in &event.member_indices {
                        if *index >= member_count || !indices.insert(*index) {
                            return Err(structure_error(format!(
                                "virtual event '{}' of common cause group '{}' names an unknown or repeated member",
                                event.id, group_id
                            )));
                        }
                    }
                }
                Ok(())
            }
        }
    }

    pub fn checks(&self, group_id: &str) -> Vec<(String, Expr)> {
        match self {
            CcfModel::BetaFactor(beta) => vec![(
                format!("common cause group '{}' beta factor", group_id),
                beta.clone(),
            )],
            CcfModel::Mgl(factors) | CcfModel::RaspMgl { factors, .. } => factors
                .iter()
                .enumerate()
                .map(|(index, factor)| {
                    (
                        format!("common cause group '{}' MGL factor {}", group_id, index + 1),
                        factor.clone(),
                    )
                })
                .collect(),
            CcfModel::AlphaFactor { .. } | CcfModel::PhiFactor(_) => Vec::new(),
        }
    }

    pub fn expand(&self, group_id: &str, members: &[String], total: &Expr) -> Result<Vec<CcfEvent>> {
        let n = members.len();
        let mut events = Vec::new();
        match self {
            CcfModel::BetaFactor(beta) => {
                let independent = product(
                    vec![Expr::Sub(vec![Expr::Constant(1.0), beta.clone()])],
                    total,
                );
                for (index, member) in members.iter().enumerate() {
                    events.push(CcfEvent::new(
                        format!("{}-indep-{}", group_id, index + 1),
                        vec![member.clone()],
                        independent.clone(),
                    ));
                }
                events.push(CcfEvent::new(
                    format!("{}-common", group_id),
                    members.to_vec(),
                    product(vec![beta.clone()], total),
                ));
            }
            CcfModel::AlphaFactor { testing, alphas } => {
                let weighted = Expr::Add(
                    alphas
                        .iter()
                        .enumerate()
                        .map(|(index, alpha)| {
                            product(vec![Expr::Constant((index + 1) as f64)], alpha)
                        })
                        .collect(),
                );
                for k in 1..=n {
                    let alpha = alphas[k - 1].clone();
                    let value = match testing {
                        CcfTesting::NonStaggered => product(
                            vec![
                                Expr::Constant(k as f64 / binomial(n - 1, k - 1)),
                                Expr::Div(vec![alpha, weighted.clone()]),
                            ],
                            total,
                        ),
                        CcfTesting::Staggered => product(
                            vec![Expr::Constant(1.0 / binomial(n - 1, k - 1)), alpha],
                            total,
                        ),
                    };
                    for (index, combination) in combinations(members, k).into_iter().enumerate() {
                        events.push(CcfEvent::new(
                            format!("{}-alpha-{}-{}", group_id, k, index + 1),
                            combination,
                            value.clone(),
                        ));
                    }
                }
            }
            CcfModel::Mgl(factors) => {
                for k in 1..=factors.len() + 1 {
                    let value = mgl_subset(n, k, factors, total);
                    for (index, combination) in combinations(members, k).into_iter().enumerate() {
                        events.push(CcfEvent::new(
                            format!("{}-mgl-{}-{}", group_id, k, index + 1),
                            combination,
                            value.clone(),
                        ));
                    }
                }
            }
            CcfModel::RaspMgl {
                factors,
                virtual_events,
            } => {
                for virtual_event in virtual_events {
                    events.push(CcfEvent::new(
                        virtual_event.id.clone(),
                        virtual_event
                            .member_indices
                            .iter()
                            .map(|index| members[*index].clone())
                            .collect(),
                        mgl_subset(n, virtual_event.member_indices.len(), factors, total),
                    ));
                }
            }
            CcfModel::PhiFactor(phis) => {
                for (level, phi) in phis.iter().enumerate() {
                    let k = level + 1;
                    let value = product(vec![phi.clone()], total);
                    for (index, combination) in combinations(members, k).into_iter().enumerate() {
                        events.push(CcfEvent::new(
                            format!("{}-phi-{}-{}", group_id, k, index + 1),
                            combination,
                            value.clone(),
                        ));
                    }
                }
            }
        }
        Ok(events)
    }

    pub fn model_name(&self) -> &'static str {
        match self {
            CcfModel::BetaFactor(_) => "Beta-Factor",
            CcfModel::AlphaFactor { .. } => "Alpha-Factor",
            CcfModel::Mgl(_) => "MGL",
            CcfModel::RaspMgl { .. } => "RASP MGL",
            CcfModel::PhiFactor(_) => "Phi-Factor",
        }
    }

    pub fn replaces_parent_event(&self) -> bool {
        matches!(self, CcfModel::RaspMgl { .. })
    }
}

fn same_size(group_id: &str, name: &str, count: usize, member_count: usize) -> Result<()> {
    if count == member_count {
        return Ok(());
    }
    Err(structure_error(format!(
        "common cause group '{}' has {} members but {} {} values",
        group_id, member_count, count, name
    )))
}

fn mgl_size(group_id: &str, count: usize, member_count: usize) -> Result<()> {
    if count >= 1 && count < member_count {
        return Ok(());
    }
    Err(structure_error(format!(
        "common cause group '{}' has {} members and needs 1 to {} MGL factors, not {}",
        group_id,
        member_count,
        member_count - 1,
        count
    )))
}

fn product(mut factors: Vec<Expr>, total: &Expr) -> Expr {
    factors.retain(|factor| *factor != Expr::Constant(1.0));
    factors.push(total.clone());
    if factors.len() == 1 {
        return factors.remove(0);
    }
    Expr::Mul(factors)
}

fn mgl_subset(n: usize, k: usize, factors: &[Expr], total: &Expr) -> Expr {
    let mut terms = vec![Expr::Constant(1.0 / binomial(n - 1, k - 1))];
    terms.extend(factors[..k - 1].iter().cloned());
    if k <= factors.len() {
        terms.push(Expr::Sub(vec![Expr::Constant(1.0), factors[k - 1].clone()]));
    }
    product(terms, total)
}

#[derive(Debug, Clone, PartialEq)]
pub struct CcfEvent {
    pub id: String,
    pub failed_members: Vec<String>,
    pub value: Expr,
    pub order: usize,
}

impl CcfEvent {
    pub fn new(id: String, failed_members: Vec<String>, value: Expr) -> Self {
        let order = failed_members.len();
        CcfEvent {
            id,
            failed_members,
            value,
            order,
        }
    }
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

fn combinations(items: &[String], k: usize) -> Vec<Vec<String>> {
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
        result.push(indices.iter().map(|&i| items[i].clone()).collect());
        let mut position = k;
        while position > 0 && indices[position - 1] == n - k + position - 1 {
            position -= 1;
        }
        if position == 0 {
            break;
        }
        indices[position - 1] += 1;
        for j in position..k {
            indices[j] = indices[j - 1] + 1;
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::*;
    use crate::core::distribution::{
        Law, ParameterReference, ParameterReferenceType, UncertainExpression, UncertainValue,
        UncertainVector, UncertainVectorParameter,
    };
    use crate::core::distribution_sampling::{SamplingMethod, SamplingPlan};
    use crate::expression::EvalContext;

    fn names(count: usize) -> Vec<String> {
        (1..=count).map(|index| format!("E{}", index)).collect()
    }

    fn numbers(values: &[f64]) -> Vec<Expr> {
        values.iter().map(|value| Expr::Constant(*value)).collect()
    }

    fn alpha(group: &str, testing: CcfTesting, values: &[f64]) -> CcfModel {
        CcfModel::AlphaFactor {
            testing,
            alphas: fixed_components(&alphas_key(group), values.to_vec()).unwrap(),
        }
    }

    fn group(id: &str, count: usize, model: CcfModel, total: f64) -> CcfGroup {
        CcfGroup::new(id, names(count), model, Expr::Constant(total)).unwrap()
    }

    fn points(group: &CcfGroup) -> Vec<(String, Vec<String>, f64)> {
        let parameters = HashMap::new();
        let context = EvalContext::constant(&parameters, 1.0);
        group
            .expand()
            .unwrap()
            .into_iter()
            .map(|event| {
                let value = event.value.evaluate(&context).unwrap();
                (event.id, event.failed_members, value)
            })
            .collect()
    }

    fn marginal(events: &[(String, Vec<String>, f64)], member: &str) -> f64 {
        events
            .iter()
            .filter(|(_, members, _)| members.iter().any(|name| name == member))
            .map(|(_, _, value)| value)
            .sum()
    }

    #[test]
    fn groups_need_two_members_and_matching_vector_lengths() {
        assert!(CcfGroup::new("G", names(1), CcfModel::BetaFactor(Expr::Constant(0.1)), Expr::Constant(0.1)).is_err());
        assert!(CcfGroup::new("G", names(3), alpha("G", CcfTesting::NonStaggered, &[0.7, 0.3]), Expr::Constant(0.1)).is_err());
        let phis = CcfModel::PhiFactor(fixed_components(&phis_key("G"), vec![0.5, 0.5]).unwrap());
        assert!(CcfGroup::new("G", names(3), phis, Expr::Constant(0.1)).is_err());
        assert!(CcfGroup::new("G", names(2), CcfModel::Mgl(numbers(&[0.1, 0.2])), Expr::Constant(0.1)).is_err());
        assert!(fixed_components("k", vec![0.5, 0.3]).is_err());
    }

    #[test]
    fn constant_factors_and_totals_outside_zero_to_one_name_the_group() {
        for (model, total) in [
            (CcfModel::BetaFactor(Expr::Constant(1.5)), 0.1),
            (CcfModel::BetaFactor(Expr::Constant(-0.1)), 0.1),
            (CcfModel::Mgl(numbers(&[1.2])), 0.1),
            (CcfModel::BetaFactor(Expr::Constant(0.1)), 1.2),
        ] {
            let error = CcfGroup::new("Pumps", names(2), model, Expr::Constant(total)).unwrap_err();
            assert!(error.to_string().contains("common cause group 'Pumps'"), "{error}");
        }
    }

    #[test]
    fn beta_factor_splits_the_total() {
        let events = points(&group("Pumps", 3, CcfModel::BetaFactor(Expr::Constant(0.2)), 0.1));
        assert_eq!(events.len(), 4);
        assert_eq!(events[0].0, "Pumps-indep-1");
        assert_eq!(events[3].0, "Pumps-common");
        for event in &events[..3] {
            assert!((event.2 - 0.08).abs() < 1e-15);
            assert_eq!(event.1.len(), 1);
        }
        assert!((events[3].2 - 0.02).abs() < 1e-15);
        assert_eq!(events[3].1.len(), 3);
        assert!((marginal(&events, "E1") - 0.1).abs() < 1e-15);
    }

    #[test]
    fn non_staggered_alpha_factor_follows_its_formula() {
        let events = points(&group("Pumps", 3, alpha("Pumps", CcfTesting::NonStaggered, &[0.7, 0.2, 0.1]), 0.1));
        let weighted = 0.7 + 2.0 * 0.2 + 3.0 * 0.1;
        assert_eq!(events.len(), 7);
        for event in &events[..3] {
            assert!((event.2 - 0.7 / weighted * 0.1).abs() < 1e-15);
        }
        for event in &events[3..6] {
            assert!((event.2 - 2.0 / 2.0 * 0.2 / weighted * 0.1).abs() < 1e-15);
        }
        assert!((events[6].2 - 3.0 * 0.1 / weighted * 0.1).abs() < 1e-15);
        assert!((marginal(&events, "E2") - 0.1).abs() < 1e-15);
        assert_eq!(events[0].0, "Pumps-alpha-1-1");
        assert_eq!(events[3].0, "Pumps-alpha-2-1");
    }

    #[test]
    fn staggered_alpha_factor_follows_its_formula() {
        let events = points(&group("Pumps", 3, alpha("Pumps", CcfTesting::Staggered, &[0.7, 0.2, 0.1]), 0.1));
        for event in &events[..3] {
            assert!((event.2 - 0.07).abs() < 1e-15);
        }
        for event in &events[3..6] {
            assert!((event.2 - 0.5 * 0.2 * 0.1).abs() < 1e-15);
        }
        assert!((events[6].2 - 0.01).abs() < 1e-15);
        assert!((marginal(&events, "E1") - 0.1).abs() < 1e-15);
    }

    #[test]
    fn mgl_reduces_to_the_beta_factor_and_keeps_marginals() {
        let events = points(&group("Valves", 3, CcfModel::Mgl(numbers(&[0.1, 0.5])), 0.1));
        assert_eq!(events.len(), 7);
        for event in &events[..3] {
            assert!((event.2 - 0.9 * 0.1).abs() < 1e-15);
        }
        for event in &events[3..6] {
            assert!((event.2 - 0.5 * 0.1 * 0.5 * 0.1).abs() < 1e-15);
        }
        assert!((events[6].2 - 0.1 * 0.5 * 0.1).abs() < 1e-15);
        assert_eq!(events[0].0, "Valves-mgl-1-1");
        let large = points(&group("Large", 5, CcfModel::Mgl(numbers(&[0.1, 0.2, 0.3, 0.4])), 0.1));
        assert_eq!(large.len(), 31);
        assert!((marginal(&large, "E1") - 0.1).abs() < 1e-15);
        let pair = points(&group("Pair", 2, CcfModel::Mgl(numbers(&[0.2])), 0.1));
        let beta = points(&group("Pair", 2, CcfModel::BetaFactor(Expr::Constant(0.2)), 0.1));
        for (left, right) in pair.iter().zip(&beta) {
            assert!((left.2 - right.2).abs() < 1e-15);
        }
    }

    #[test]
    fn phi_factor_assigns_each_level() {
        let phis = CcfModel::PhiFactor(fixed_components(&phis_key("Phi"), vec![0.6, 0.3, 0.1]).unwrap());
        let events = points(&group("Phi", 3, phis, 0.1));
        assert_eq!(events.len(), 7);
        assert!((events[0].2 - 0.06).abs() < 1e-15);
        assert!((events[3].2 - 0.03).abs() < 1e-15);
        assert!((events[6].2 - 0.01).abs() < 1e-15);
        assert_eq!(events[6].0, "Phi-phi-3-1");
    }

    #[test]
    fn rasp_mgl_keeps_virtual_names_and_subsets() {
        let model = CcfModel::RaspMgl {
            factors: numbers(&[0.02, 0.0]),
            virtual_events: vec![
                RaspCcfEvent { id: "G-AB".into(), member_indices: vec![0, 1] },
                RaspCcfEvent { id: "G-ABC".into(), member_indices: vec![0, 1, 2] },
            ],
        };
        let events = points(&group("G", 3, model, 7.2e-7));
        assert_eq!(events[0].0, "G-AB");
        assert_eq!(events[0].1, vec!["E1", "E2"]);
        assert!((events[0].2 - 7.2e-9).abs() < 1e-20);
        assert_eq!(events[1].2, 0.0);
        let repeated = CcfModel::RaspMgl {
            factors: numbers(&[0.02]),
            virtual_events: vec![RaspCcfEvent { id: "G-AA".into(), member_indices: vec![0, 0] }],
        };
        assert!(CcfGroup::new("G", names(3), repeated, Expr::Constant(0.1)).is_err());
    }

    fn reference(entity: &str) -> ParameterReference {
        ParameterReference {
            reference_type: ParameterReferenceType::WorkbookParameter,
            workbook_id: "da".to_string(),
            entity_id: entity.to_string(),
        }
    }

    #[test]
    fn contract_factors_lower_to_keyed_draws_and_shared_vectors() {
        let table = vec![UncertainParameter {
            reference: reference("beta"),
            expression: UncertainExpression::Value {
                value: UncertainValue {
                    unit: UncertainUnit::Fraction,
                    law: Law::Beta { alpha: 2.0, beta: 18.0, lower: 0.0, upper: 1.0 },
                },
            },
        }];
        let vectors = vec![UncertainVectorParameter {
            reference: reference("alphas"),
            vector: VectorLaw::Dirichlet { concentrations: vec![30.0, 6.0, 4.0] },
        }];
        let program = UncertaintyProgram::from_table(&table).unwrap().with_vectors(&vectors).unwrap();
        let beta = CcfModel::from_factors(
            "Pumps",
            &CcfFactorModel::BetaFactor { beta: UncertainExpression::Parameter { reference: reference("beta") } },
            &table,
            &program,
        )
        .unwrap();
        assert_eq!(beta, CcfModel::BetaFactor(Expr::Parameter("da:beta".to_string())));
        let shared = CcfFactorModel::AlphaFactor {
            testing: CcfTesting::Staggered,
            alphas: UncertainVector::Parameter { reference: reference("alphas") },
        };
        let pumps = CcfModel::from_factors("Pumps", &shared, &table, &program).unwrap();
        let valves = CcfModel::from_factors("Valves", &shared, &table, &program).unwrap();
        let (CcfModel::AlphaFactor { alphas: left, .. }, CcfModel::AlphaFactor { alphas: right, .. }) = (&pumps, &valves) else {
            panic!("alpha models expected");
        };
        assert_eq!(left, right);
        let typed = CcfModel::from_factors(
            "Pumps",
            &CcfFactorModel::AlphaFactor {
                testing: CcfTesting::NonStaggered,
                alphas: UncertainVector::Value { law: VectorLaw::Dirichlet { concentrations: vec![9.0, 1.0] } },
            },
            &table,
            &program,
        )
        .unwrap();
        let CcfModel::AlphaFactor { alphas, .. } = typed else {
            panic!("alpha model expected");
        };
        assert!(matches!(&alphas[0], Expr::Component { key, .. } if key == "ccf:Pumps/alphas"));
        let group = CcfGroup::new("Pumps", names(3), pumps, Expr::Constant(0.1)).unwrap();
        let expanded = group.expand().unwrap();
        let program = UncertaintyProgram::from_expressions(program.into_parameters(), 1.0);
        let targets: Vec<&Expr> = expanded.iter().map(|event| &event.value).collect();
        let plan = SamplingPlan { method: SamplingMethod::MonteCarlo, trials: 200, seed: 3 };
        let columns = program.sample(&targets, &plan).unwrap();
        let marginals = columns[0]
            .iter()
            .zip(&columns[3])
            .zip(&columns[4])
            .zip(&columns[6])
            .map(|(((first, second), third), fourth)| first + second + third + fourth);
        for (trial, marginal) in marginals.enumerate() {
            assert!((marginal - 0.1).abs() < 1e-15, "trial {trial}: {marginal}");
        }
    }
}
