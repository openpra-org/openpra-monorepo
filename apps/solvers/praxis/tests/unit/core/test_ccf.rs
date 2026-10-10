use std::collections::BTreeMap;

use praxis::core::ccf::{
    impact_vector, map_down, map_up, CcfEvent, CcfGroup, CcfModel, Multiplicity,
};
use praxis::core::distribution::{CcfFactorModel, UncertainExpression, UncertainUnit};
use praxis::core::distribution_sampling::{SamplingMethod, SamplingPlan, UncertaintyProgram};
use praxis::core::fault_tree::FaultTree;
use praxis::expression::Expr;
use praxis::io::pbf::{decode_fault_tree, encode_fault_tree};
use serde::Deserialize;
use serde_json::{json, Value};

const POINT_TOLERANCE: f64 = 1e-12;
const TRIALS: usize = 20_000;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PointOrder {
    order: usize,
    count: usize,
    value: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PointCase {
    name: String,
    size: usize,
    factors: CcfFactorModel,
    total: Option<UncertainExpression>,
    orders: Vec<PointOrder>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SampledOrder {
    order: usize,
    count: usize,
    mean: f64,
    plugin: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SampledCase {
    name: String,
    size: usize,
    factors: CcfFactorModel,
    total: Option<UncertainExpression>,
    orders: Vec<SampledOrder>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DownCase {
    counts: Vec<f64>,
    target_size: usize,
    expected: Vec<f64>,
    no_impact: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpCase {
    independent: f64,
    non_lethal: Vec<f64>,
    lethal: f64,
    rho: f64,
    target_size: usize,
    expected: Vec<f64>,
}

#[derive(Deserialize)]
struct Mapping {
    down: Vec<DownCase>,
    up: Vec<UpCase>,
}

#[derive(Deserialize)]
struct Reference {
    points: Vec<PointCase>,
    sampled: Vec<SampledCase>,
    mapping: Mapping,
}

fn reference() -> Reference {
    let text = std::fs::read_to_string(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/data/ccf_reference.json"
    ))
    .unwrap();
    serde_json::from_str(&text).unwrap()
}

fn members(size: usize) -> Vec<String> {
    (1..=size).map(|index| format!("M{index}")).collect()
}

fn close(actual: f64, expected: f64, tolerance: f64) -> bool {
    (actual - expected).abs() <= tolerance * expected.abs().max(f64::MIN_POSITIVE)
}

struct Built {
    program: UncertaintyProgram,
    group: CcfGroup,
}

fn build(
    id: &str,
    size: usize,
    factors: &CcfFactorModel,
    total: Option<&UncertainExpression>,
) -> praxis::Result<Built> {
    let program = UncertaintyProgram::from_table(&[])?.with_vectors(&[])?;
    let model = CcfModel::from_factors(id, factors, &[], &program)?;
    let total = total
        .map(|expression| {
            UncertaintyProgram::target(
                &[],
                expression,
                &format!("ccf:{id}/total"),
                UncertainUnit::Probability,
            )
        })
        .transpose()?;
    let group = CcfGroup::new(id, members(size), model, total)?;
    Ok(Built {
        program: UncertaintyProgram::from_expressions(program.into_parameters(), 1.0),
        group,
    })
}

fn by_order(events: Vec<CcfEvent>) -> BTreeMap<usize, Vec<CcfEvent>> {
    let mut orders: BTreeMap<usize, Vec<CcfEvent>> = BTreeMap::new();
    for event in events {
        orders.entry(event.order).or_default().push(event);
    }
    orders
}

#[test]
fn every_model_matches_hand_values_for_groups_of_two_to_eight() {
    let reference = reference();
    assert_eq!(reference.points.len(), 63);
    for case in &reference.points {
        let built = build("G", case.size, &case.factors, case.total.as_ref()).unwrap();
        let orders = by_order(built.group.expand().unwrap());
        assert_eq!(
            orders.keys().copied().collect::<Vec<_>>(),
            case.orders.iter().map(|order| order.order).collect::<Vec<_>>(),
            "{}",
            case.name
        );
        for expected in &case.orders {
            let events = &orders[&expected.order];
            assert_eq!(events.len(), expected.count, "{} order {}", case.name, expected.order);
            for event in events {
                let value = built.program.point(&event.value).unwrap();
                assert!(
                    close(value, expected.value, POINT_TOLERANCE),
                    "{} order {}: {} against {}",
                    case.name,
                    expected.order,
                    value,
                    expected.value
                );
            }
        }
    }
}

fn mean_and_error(column: &[f64]) -> (f64, f64) {
    let count = column.len() as f64;
    let mean = column.iter().sum::<f64>() / count;
    let variance = column.iter().map(|value| (value - mean).powi(2)).sum::<f64>() / (count - 1.0);
    (mean, (variance / count).sqrt())
}

#[test]
fn sampled_means_match_exact_means_for_every_model() {
    let reference = reference();
    assert_eq!(reference.sampled.len(), 42);
    for case in &reference.sampled {
        let built = build("G", case.size, &case.factors, case.total.as_ref()).unwrap();
        let orders = by_order(built.group.expand().unwrap());
        let targets: Vec<&Expr> = case
            .orders
            .iter()
            .map(|order| &orders[&order.order][0].value)
            .collect();
        for expected in &case.orders {
            assert_eq!(orders[&expected.order].len(), expected.count, "{}", case.name);
            let point = built.program.point(&orders[&expected.order][0].value).unwrap();
            assert!(
                close(point, expected.plugin, POINT_TOLERANCE),
                "{} order {} plug-in {} against {}",
                case.name,
                expected.order,
                point,
                expected.plugin
            );
        }
        for (method, seed) in [(SamplingMethod::MonteCarlo, 11), (SamplingMethod::LatinHypercube, 12)] {
            let plan = SamplingPlan { method, trials: TRIALS, seed };
            let columns = built.program.sample(&targets, &plan).unwrap();
            for (expected, column) in case.orders.iter().zip(&columns) {
                let (mean, error) = mean_and_error(column);
                assert!(error > 0.0, "{} order {} does not vary", case.name, expected.order);
                assert!(
                    (mean - expected.mean).abs() <= 5.0 * error,
                    "{} {:?} order {}: mean {} against {} with standard error {}",
                    case.name,
                    method,
                    expected.order,
                    mean,
                    expected.mean,
                    error
                );
            }
        }
    }
}

fn binomial_failure_rate(parts: [f64; 4], size: usize, order: usize) -> f64 {
    let [independent, shock, component, lethal] = parts;
    let mut value = shock
        * component.powi(order as i32)
        * (1.0 - component).powi((size - order) as i32);
    if order == 1 {
        value += independent;
    }
    if order == size {
        value += lethal;
    }
    value
}

#[test]
fn binomial_failure_rate_events_follow_each_drawn_trial() {
    let reference = reference();
    for case in reference
        .sampled
        .iter()
        .filter(|case| matches!(case.factors, CcfFactorModel::BinomialFailureRate { .. }))
    {
        let built = build("G", case.size, &case.factors, None).unwrap();
        let CcfModel::BinomialFailureRate(model) = &built.group.model else {
            panic!("binomial failure rate model expected");
        };
        let orders = by_order(built.group.expand().unwrap());
        let mut targets = vec![
            &model.independent,
            &model.non_lethal_shock,
            &model.component_failure,
            &model.lethal_shock,
        ];
        targets.extend((1..=case.size).map(|order| &orders[&order][0].value));
        let plan = SamplingPlan { method: SamplingMethod::LatinHypercube, trials: 500, seed: 4 };
        let columns = built.program.sample(&targets, &plan).unwrap();
        for trial in 0..plan.trials {
            let parts = [columns[0][trial], columns[1][trial], columns[2][trial], columns[3][trial]];
            for order in 1..=case.size {
                let expected = binomial_failure_rate(parts, case.size, order);
                let actual = columns[3 + order][trial];
                assert!(
                    close(actual, expected, POINT_TOLERANCE),
                    "{} trial {} order {}: {} against {}",
                    case.name,
                    trial,
                    order,
                    actual,
                    expected
                );
            }
        }
    }
}

fn factors(value: Value) -> CcfFactorModel {
    serde_json::from_value(value).unwrap()
}

fn fraction(value: f64) -> Value {
    json!({ "node": "VALUE", "value": { "unit": "FRACTION", "law": { "family": "POINT", "value": value } } })
}

fn probability(value: f64) -> Value {
    json!({ "node": "VALUE", "value": { "unit": "PROBABILITY", "law": { "family": "POINT", "value": value } } })
}

fn bfr() -> CcfFactorModel {
    factors(json!({
        "model": "BINOMIAL_FAILURE_RATE",
        "independent": probability(1e-3),
        "nonLethalShock": probability(2e-4),
        "componentFailure": fraction(0.15),
        "lethalShock": probability(3e-6)
    }))
}

fn total() -> UncertainExpression {
    serde_json::from_value(probability(2e-3)).unwrap()
}

#[test]
fn mgl_takes_one_to_n_minus_one_factors_and_phi_exactly_n() {
    for size in 2..=8 {
        for count in 1..=size + 1 {
            let model = factors(json!({ "model": "MGL", "factors": vec![fraction(0.2); count] }));
            let built = build("G", size, &model, Some(&total()));
            assert_eq!(built.is_ok(), count < size, "MGL size {size} with {count} factors");
        }
        for count in 2..=size + 1 {
            let values = vec![1.0 / count as f64; count];
            let model = factors(json!({ "model": "PHI_FACTOR", "phis": { "node": "VALUE", "law": { "family": "FIXED", "values": values } } }));
            let built = build("G", size, &model, Some(&total()));
            assert_eq!(built.is_ok(), count == size, "phi size {size} with {count} factors");
        }
    }
    let empty = factors(json!({ "model": "MGL", "factors": [] }));
    assert!(build("G", 3, &empty, Some(&total())).is_err());
}

#[test]
fn only_the_binomial_failure_rate_model_goes_without_a_total() {
    let error = build("Pumps", 3, &bfr(), Some(&total())).err().unwrap().to_string();
    assert!(error.contains("common cause group 'Pumps'") && error.contains("takes no total"), "{error}");
    let alpha = factors(json!({
        "model": "ALPHA_FACTOR",
        "testing": "STAGGERED",
        "alphas": { "node": "VALUE", "law": { "family": "FIXED", "values": [0.9, 0.1] } }
    }));
    let error = build("Pumps", 2, &alpha, None).err().unwrap().to_string();
    assert!(error.contains("needs a total"), "{error}");
    assert!(build("Pumps", 2, &alpha, Some(&total())).is_ok());
    assert!(build("Pumps", 2, &bfr(), None).is_ok());
}

#[test]
fn binomial_failure_rate_parts_outside_zero_to_one_name_the_group() {
    let model = factors(json!({
        "model": "BINOMIAL_FAILURE_RATE",
        "independent": probability(1e-3),
        "nonLethalShock": probability(2e-4),
        "componentFailure": { "node": "VALUE", "value": { "unit": "FACTOR", "law": { "family": "POINT", "value": 1.5 } } },
        "lethalShock": probability(3e-6)
    }));
    let error = match build("Pumps", 3, &model, None) {
        Err(error) => error.to_string(),
        Ok(built) => {
            let mut tree = FaultTree::new("T", "M1").unwrap();
            tree.add_ccf_group(built.group).unwrap();
            tree.expand_ccf_groups().unwrap_err().to_string()
        }
    };
    assert!(error.contains("common cause group 'Pumps' component failure fraction"), "{error}");
}

#[test]
fn binomial_failure_rate_groups_survive_the_binary_model_format() {
    let built = build("Pumps", 3, &bfr(), None).unwrap();
    let mut tree = FaultTree::new("T", "TOP").unwrap();
    let mut gate = praxis::core::gate::Gate::new("TOP".to_string(), praxis::core::gate::Formula::And).unwrap();
    for member in members(3) {
        tree.add_basic_event(praxis::core::event::BasicEvent::new(member.clone(), 0.01).unwrap()).unwrap();
        gate.add_operand(member);
    }
    tree.add_gate(gate).unwrap();
    tree.add_ccf_group(built.group.clone()).unwrap();
    let decoded = decode_fault_tree(&encode_fault_tree(&tree).unwrap()).unwrap();
    let group = &decoded.ccf_groups()["Pumps"];
    assert_eq!(group.model, built.group.model);
    assert_eq!(group.total, None);
}

fn near_all(actual: &[f64], expected: &[f64], tolerance: f64) -> bool {
    actual.len() == expected.len()
        && actual
            .iter()
            .zip(expected)
            .all(|(left, right)| (left - right).abs() <= tolerance * right.abs().max(1.0))
}

#[test]
fn mapping_down_matches_table_c3() {
    let four = [1.0, 2.0, 3.0, 4.0];
    let three = map_down(&four, 3).unwrap();
    assert!(near_all(&three.counts, &[0.75 + 1.0, 1.0 + 2.25, 0.75 + 4.0], 1e-15));
    assert!((three.no_impact - 0.25).abs() < 1e-15);
    let two = map_down(&four, 2).unwrap();
    assert!(near_all(&two.counts, &[0.5 + 4.0 / 3.0 + 1.5, 2.0 / 6.0 + 1.5 + 4.0], 1e-15));
    assert!((two.no_impact - (0.5 + 2.0 / 6.0)).abs() < 1e-15);
    let one = map_down(&four, 1).unwrap();
    assert!(near_all(&one.counts, &[0.25 + 1.0 + 2.25 + 4.0], 1e-15));
    assert!((one.no_impact - (0.75 + 1.0 + 0.75)).abs() < 1e-15);
    let from_three = map_down(&[3.0, 6.0, 9.0], 2).unwrap();
    assert!(near_all(&from_three.counts, &[2.0 + 4.0, 2.0 + 9.0], 1e-15));
    let from_two = map_down(&[2.0, 5.0], 1).unwrap();
    assert!(near_all(&from_two.counts, &[1.0 + 5.0], 1e-15));
    assert!(map_down(&four, 4).is_err());
    assert!(map_down(&four, 0).is_err());
    assert!(map_down(&[1.0, -1.0], 1).is_err());
}

#[test]
fn mapping_up_matches_table_c6() {
    let cases: [(&[f64], f64, &[f64]); 9] = [
        (&[1.0], 0.9, &[0.2, 0.9]),
        (&[1.0], 0.9, &[0.03, 0.27, 0.81]),
        (&[1.0], 0.9, &[0.004, 0.054, 0.324, 0.729]),
        (&[1.0], 0.1, &[2.916, 0.486, 0.036, 0.001]),
        (&[1.0, 0.0], 0.1, &[1.35, 0.1, 0.0]),
        (&[1.0, 0.0], 0.1, &[1.62, 0.225, 0.01, 0.0]),
        (&[0.5, 0.5], 0.1, &[0.81, 0.5175, 0.095, 0.005]),
        (&[0.5, 0.5], 0.5, &[0.25, 0.4375, 0.375, 0.125]),
        (&[0.25, 0.5, 0.25], 0.1, &[0.3, 0.475, 0.275, 0.025]),
    ];
    for (source, rho, expected) in cases {
        let mapped = map_up(0.0, source, 0.0, rho, expected.len()).unwrap();
        assert!(near_all(&mapped.counts, expected, 1e-12), "{source:?} {rho}: {:?}", mapped.counts);
    }
    let independent = map_up(1.0, &[0.0, 0.0, 0.0], 0.0, 0.4, 4).unwrap();
    assert!(near_all(&independent.counts, &[4.0 / 3.0, 0.0, 0.0, 0.0], 1e-15));
    let lethal = map_up(0.0, &[0.0], 1.0, 0.4, 4).unwrap();
    assert!(near_all(&lethal.counts, &[0.0, 0.0, 0.0, 1.0], 1e-15));
    assert!(map_up(0.0, &[1.0, 1.0], 0.0, 1.5, 3).is_err());
    assert!(map_up(0.0, &[1.0, 1.0], 0.0, 0.5, 2).is_err());
    assert!(map_up(-1.0, &[1.0, 1.0], 0.0, 0.5, 3).is_err());
}

#[test]
fn mapping_keeps_binomial_failure_rate_counts_for_groups_up_to_eight() {
    let reference = reference();
    for case in &reference.mapping.down {
        let mapped = map_down(&case.counts, case.target_size).unwrap();
        assert!(near_all(&mapped.counts, &case.expected, 1e-12), "{:?} to {}", case.counts, case.target_size);
        assert!((mapped.no_impact - case.no_impact).abs() <= 1e-12 * case.no_impact.max(1.0));
    }
    for case in &reference.mapping.up {
        let mapped = map_up(case.independent, &case.non_lethal, case.lethal, case.rho, case.target_size).unwrap();
        assert!(near_all(&mapped.counts, &case.expected, 1e-12), "{:?} to {}", case.non_lethal, case.target_size);
    }
}

#[test]
fn multiplicity_rows_become_counts_by_order() {
    let rows = [
        Multiplicity { failed: 2, events: 3.0 },
        Multiplicity { failed: 4, events: 1.0 },
        Multiplicity { failed: 2, events: 0.5 },
    ];
    let vector = impact_vector(4, &rows).unwrap();
    assert_eq!(vector.counts, vec![0.0, 3.5, 0.0, 1.0]);
    assert!(impact_vector(4, &[Multiplicity { failed: 5, events: 1.0 }]).is_err());
    assert!(impact_vector(4, &[Multiplicity { failed: 0, events: 1.0 }]).is_err());
    assert!(impact_vector(4, &[Multiplicity { failed: 1, events: f64::NAN }]).is_err());
}
