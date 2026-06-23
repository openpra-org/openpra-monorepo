use praxis::boolean::contract::{
    Approximation, BasicEventBinding, BasicEventBindingTable, BasicEventId, BasicEventValue,
    BooleanModel, BooleanNode, BooleanOperator, BooleanSequence, BooleanTree, CcfGroup,
    CcfGroupTable, CcfParameterModel, EndStateNode, Exposure, NodeId, QuantificationSettings,
    RateBasis, RawDataPrior, RawDataSpec, SolverTarget, SummaryCentral, SummaryFamily, SummarySpec,
    SummarySpread,
};
use praxis::boolean::quantify::quantify;
use praxis::expression::Expr;

fn gate(id: NodeId, operator: BooleanOperator, inputs: Vec<NodeId>) -> BooleanNode {
    BooleanNode::Gate {
        id,
        operator,
        inputs,
        k: None,
    }
}

fn atleast(id: NodeId, k: usize, inputs: Vec<NodeId>) -> BooleanNode {
    BooleanNode::Gate {
        id,
        operator: BooleanOperator::Atleast,
        inputs,
        k: Some(k),
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

fn fault_tree_entry(id: i64, top_node_id: NodeId) -> BooleanTree {
    BooleanTree {
        id,
        top_node_id,
        ..Default::default()
    }
}

fn or_two_events_model() -> (BooleanModel, BasicEventBindingTable) {
    let mut model = BooleanModel {
        id: 1,
        ..Default::default()
    };
    model
        .nodes
        .insert(1, gate(1, BooleanOperator::Or, vec![2, 3]));
    model.nodes.insert(2, basic(2, 10));
    model.nodes.insert(3, basic(3, 11));
    model.fault_trees.push(fault_tree_entry(100, 1));
    let bindings = BasicEventBindingTable {
        id: 1,
        bindings: vec![binding(10, 0.1), binding(11, 0.2)],
        ..Default::default()
    };
    (model, bindings)
}

fn demo_tree_model() -> (BooleanModel, BasicEventBindingTable) {
    let mut model = BooleanModel {
        id: 1,
        ..Default::default()
    };
    model
        .nodes
        .insert(1, gate(1, BooleanOperator::Or, vec![2, 3]));
    model
        .nodes
        .insert(2, gate(2, BooleanOperator::And, vec![4, 5]));
    model
        .nodes
        .insert(3, gate(3, BooleanOperator::And, vec![6, 7]));
    model.nodes.insert(4, basic(4, 1));
    model.nodes.insert(5, basic(5, 2));
    model.nodes.insert(6, basic(6, 3));
    model.nodes.insert(7, basic(7, 4));
    model.fault_trees.push(fault_tree_entry(100, 1));
    let bindings = BasicEventBindingTable {
        id: 1,
        bindings: vec![
            binding(1, 0.1),
            binding(2, 0.1),
            binding(3, 0.1),
            binding(4, 0.1),
        ],
        ..Default::default()
    };
    (model, bindings)
}

fn consensus_model() -> (BooleanModel, BasicEventBindingTable) {
    let mut model = BooleanModel {
        id: 1,
        ..Default::default()
    };
    model
        .nodes
        .insert(1, gate(1, BooleanOperator::Or, vec![2, 3]));
    model
        .nodes
        .insert(2, gate(2, BooleanOperator::And, vec![4, 5]));
    model
        .nodes
        .insert(3, gate(3, BooleanOperator::And, vec![6, 7]));
    model.nodes.insert(4, basic(4, 10));
    model.nodes.insert(5, basic(5, 11));
    model
        .nodes
        .insert(6, gate(6, BooleanOperator::Not, vec![8]));
    model.nodes.insert(8, basic(8, 10));
    model.nodes.insert(7, basic(7, 12));
    model.fault_trees.push(fault_tree_entry(100, 1));
    let bindings = BasicEventBindingTable {
        id: 1,
        bindings: vec![binding(10, 0.1), binding(11, 0.1), binding(12, 0.1)],
        ..Default::default()
    };
    (model, bindings)
}

#[test]
fn prime_implicants_zbdd_finds_consensus_and_negation() {
    let (model, bindings) = consensus_model();
    let settings = QuantificationSettings {
        prime_implicants: Some(true),
        probability: Some(true),
        ..Default::default()
    };
    let result = quantify(&model, &bindings, &CcfGroupTable::default(), &settings).unwrap();
    let ft = result.fault_trees.unwrap();
    let cut_sets = ft[0].cut_sets.as_ref().unwrap();
    assert_eq!(cut_sets.prime_implicants, Some(true));
    assert_eq!(cut_sets.products, 3);
    let list = cut_sets.list.as_ref().unwrap();
    assert!(
        list.iter().any(|cs| cs.literals.iter().any(|l| l.negated)),
        "non-coherent primes must contain a negated literal"
    );
    let prob = ft[0].top_event_probability.as_ref().unwrap();
    assert!((prob.value - 0.10).abs() < 1e-9, "exact P = {}", prob.value);
}

#[test]
fn prime_implicants_tdd_matches_zbdd() {
    let (model, bindings) = consensus_model();
    let settings = QuantificationSettings {
        prime_implicants_tdd: Some(true),
        probability: Some(true),
        ..Default::default()
    };
    let result = quantify(&model, &bindings, &CcfGroupTable::default(), &settings).unwrap();
    let ft = result.fault_trees.unwrap();
    let cut_sets = ft[0].cut_sets.as_ref().unwrap();
    assert_eq!(cut_sets.prime_implicants, Some(true));
    assert_eq!(cut_sets.products, 3);
    let prob = ft[0].top_event_probability.as_ref().unwrap();
    assert!((prob.value - 0.10).abs() < 1e-9);
}

#[test]
fn prime_implicants_consensus_finds_consensus_through_quantify() {
    let (model, bindings) = consensus_model();
    let settings = QuantificationSettings {
        prime_implicants_consensus: Some(true),
        probability: Some(true),
        ..Default::default()
    };
    let result = quantify(&model, &bindings, &CcfGroupTable::default(), &settings).unwrap();
    let ft = result.fault_trees.unwrap();
    let cut_sets = ft[0].cut_sets.as_ref().unwrap();
    assert_eq!(cut_sets.prime_implicants, Some(true));
    assert_eq!(
        cut_sets.products, 3,
        "consensus engine must find all 3 prime implicants including the consensus b&c"
    );
    let list = cut_sets.list.as_ref().unwrap();
    assert!(
        list.iter().any(|cs| cs.literals.iter().any(|l| l.negated)),
        "non-coherent primes must contain a negated literal"
    );
    let prob = ft[0].top_event_probability.as_ref().unwrap();
    assert!(
        prob.value.is_finite() && prob.value >= 0.10 && prob.value <= 0.12,
        "P = {}",
        prob.value
    );
}

#[test]
fn preprocess_flags_are_wired_and_preserve_probability() {
    let (model, bindings) = consensus_model();

    let base = QuantificationSettings {
        bdd: Some(true),
        probability: Some(true),
        ..Default::default()
    };
    let p_default = quantify(&model, &bindings, &CcfGroupTable::default(), &base)
        .unwrap()
        .fault_trees
        .unwrap()[0]
        .top_event_probability
        .as_ref()
        .unwrap()
        .value;

    let ablated = QuantificationSettings {
        bdd: Some(true),
        probability: Some(true),
        preprocess_normalize_gates: Some(false),
        preprocess_fold_constants: Some(false),
        preprocess_splice_null_gates: Some(false),
        preprocess_coalesce_gates: Some(false),
        preprocess_detect_modules: Some(false),
        ..Default::default()
    };
    let p_ablated = quantify(&model, &bindings, &CcfGroupTable::default(), &ablated)
        .unwrap()
        .fault_trees
        .unwrap()[0]
        .top_event_probability
        .as_ref()
        .unwrap()
        .value;

    assert!(
        (p_default - p_ablated).abs() < 1e-12,
        "preprocess flags changed probability: {} vs {}",
        p_default,
        p_ablated
    );
}

#[test]
fn bdd_exact_probability_for_or_tree() {
    let (model, bindings) = or_two_events_model();
    let settings = QuantificationSettings {
        bdd: Some(true),
        ..Default::default()
    };
    let result = quantify(&model, &bindings, &CcfGroupTable::default(), &settings).unwrap();

    assert_eq!(result.solver_name, SolverTarget::Praxis);
    assert_eq!(result.boolean_model_ref, 1);
    let fault_trees = result.fault_trees.unwrap();
    assert_eq!(fault_trees.len(), 1);
    let probability = fault_trees[0].top_event_probability.as_ref().unwrap();
    assert!((probability.value - 0.28).abs() < 1e-12);
    assert_eq!(probability.approximation, Some(Approximation::Exact));
}

#[test]
fn bdd_exact_probability_for_demo_tree() {
    let (model, bindings) = demo_tree_model();
    let settings = QuantificationSettings {
        bdd: Some(true),
        ..Default::default()
    };
    let result = quantify(&model, &bindings, &CcfGroupTable::default(), &settings).unwrap();
    let fault_trees = result.fault_trees.unwrap();
    let probability = fault_trees[0].top_event_probability.as_ref().unwrap();
    assert!((probability.value - 0.0199).abs() < 1e-12);
}

#[test]
fn mocus_cut_sets_with_rare_event_approximation() {
    let (model, bindings) = demo_tree_model();
    let settings = QuantificationSettings {
        mocus: Some(true),
        rare_event: Some(true),
        ..Default::default()
    };
    let result = quantify(&model, &bindings, &CcfGroupTable::default(), &settings).unwrap();
    let fault_trees = result.fault_trees.unwrap();
    let cut_sets = fault_trees[0].cut_sets.as_ref().unwrap();
    assert_eq!(cut_sets.products, 2);
    let list = cut_sets.list.as_ref().unwrap();
    let mut literal_ids: Vec<Vec<i64>> = list
        .iter()
        .map(|cs| cs.literals.iter().map(|l| l.basic_event_id).collect())
        .collect();
    literal_ids.sort();
    assert_eq!(literal_ids, vec![vec![1, 2], vec![3, 4]]);
    assert!(list.iter().all(|cs| cs.order == 2));

    let probability = fault_trees[0].top_event_probability.as_ref().unwrap();
    assert!((probability.value - 0.02).abs() < 1e-12);
    assert_eq!(probability.approximation, Some(Approximation::RareEvent));
}

#[test]
fn zbdd_cut_sets_match_mocus() {
    let (model, bindings) = demo_tree_model();
    let settings = QuantificationSettings {
        zbdd: Some(true),
        ..Default::default()
    };
    let result = quantify(&model, &bindings, &CcfGroupTable::default(), &settings).unwrap();
    let fault_trees = result.fault_trees.unwrap();
    let cut_sets = fault_trees[0].cut_sets.as_ref().unwrap();
    assert_eq!(cut_sets.products, 2);
    let probability = fault_trees[0].top_event_probability.as_ref().unwrap();
    assert!((probability.value - 0.0199).abs() < 1e-12);
}

#[test]
fn atleast_gate_quantifies_two_of_three() {
    let mut model = BooleanModel {
        id: 1,
        ..Default::default()
    };
    model.nodes.insert(1, atleast(1, 2, vec![2, 3, 4]));
    model.nodes.insert(2, basic(2, 1));
    model.nodes.insert(3, basic(3, 2));
    model.nodes.insert(4, basic(4, 3));
    model.fault_trees.push(fault_tree_entry(100, 1));
    let bindings = BasicEventBindingTable {
        id: 1,
        bindings: vec![binding(1, 0.5), binding(2, 0.5), binding(3, 0.5)],
        ..Default::default()
    };
    let settings = QuantificationSettings {
        bdd: Some(true),
        ..Default::default()
    };
    let result = quantify(&model, &bindings, &CcfGroupTable::default(), &settings).unwrap();
    let probability = result.fault_trees.unwrap()[0]
        .top_event_probability
        .clone()
        .unwrap();
    assert!((probability.value - 0.5).abs() < 1e-12);
}

#[test]
fn null_gate_acts_as_pass_through() {
    let mut model = BooleanModel {
        id: 1,
        ..Default::default()
    };
    model
        .nodes
        .insert(1, gate(1, BooleanOperator::Null, vec![2]));
    model.nodes.insert(2, basic(2, 1));
    model.fault_trees.push(fault_tree_entry(100, 1));
    let bindings = BasicEventBindingTable {
        id: 1,
        bindings: vec![binding(1, 0.1)],
        ..Default::default()
    };
    let settings = QuantificationSettings {
        bdd: Some(true),
        ..Default::default()
    };
    let result = quantify(&model, &bindings, &CcfGroupTable::default(), &settings).unwrap();
    let probability = result.fault_trees.unwrap()[0]
        .top_event_probability
        .clone()
        .unwrap();
    assert!((probability.value - 0.1).abs() < 1e-12);
}

#[test]
fn sequence_with_success_branch_and_frequency() {
    let mut model = BooleanModel {
        id: 1,
        ..Default::default()
    };
    model
        .nodes
        .insert(1, gate(1, BooleanOperator::And, vec![2, 4]));
    model
        .nodes
        .insert(2, gate(2, BooleanOperator::Not, vec![3]));
    model.nodes.insert(3, basic(3, 1));
    model.nodes.insert(4, basic(4, 2));
    model.sequences.push(BooleanSequence {
        id: 500,
        initiating_event_id: 9,
        expression_node_id: 1,
        ..Default::default()
    });
    let bindings = BasicEventBindingTable {
        id: 1,
        bindings: vec![binding(1, 0.1), binding(2, 0.2), binding(9, 0.5)],
        ..Default::default()
    };
    let settings = QuantificationSettings {
        bdd: Some(true),
        ..Default::default()
    };
    let result = quantify(&model, &bindings, &CcfGroupTable::default(), &settings).unwrap();
    let sequences = result.sum_of_products.unwrap();
    assert_eq!(sequences.len(), 1);
    let sequence = &sequences[0];
    let probability = sequence.probability.as_ref().unwrap();
    assert!((probability.value - 0.18).abs() < 1e-12);
    assert!((sequence.frequency.unwrap() - 0.09).abs() < 1e-12);
}

#[test]
fn end_state_aggregates_sequences_via_aggregation_node() {
    let mut model = BooleanModel {
        id: 1,
        ..Default::default()
    };
    model
        .nodes
        .insert(10, gate(10, BooleanOperator::Or, vec![20]));
    model
        .nodes
        .insert(11, gate(11, BooleanOperator::Or, vec![21]));
    model
        .nodes
        .insert(12, gate(12, BooleanOperator::Or, vec![10, 11]));
    model.nodes.insert(20, basic(20, 1));
    model.nodes.insert(21, basic(21, 2));
    model.sequences.push(BooleanSequence {
        id: 501,
        initiating_event_id: 9,
        expression_node_id: 10,
        end_state_id: Some(700),
        ..Default::default()
    });
    model.sequences.push(BooleanSequence {
        id: 502,
        initiating_event_id: 9,
        expression_node_id: 11,
        end_state_id: Some(700),
        ..Default::default()
    });
    model.end_states.push(EndStateNode {
        id: 700,
        sequence_ids: vec![501, 502],
        aggregation_node_id: Some(12),
        ..Default::default()
    });
    let bindings = BasicEventBindingTable {
        id: 1,
        bindings: vec![binding(1, 0.1), binding(2, 0.2), binding(9, 0.5)],
        ..Default::default()
    };
    let settings = QuantificationSettings {
        bdd: Some(true),
        ..Default::default()
    };
    let result = quantify(&model, &bindings, &CcfGroupTable::default(), &settings).unwrap();

    let end_states = result.end_states.unwrap();
    assert_eq!(end_states.len(), 1);
    let end_state = &end_states[0];
    let probability = end_state.probability.as_ref().unwrap();
    assert!((probability.value - 0.28).abs() < 1e-12);
    assert!((end_state.frequency.unwrap() - 0.15).abs() < 1e-12);
    assert_eq!(
        end_state.contributing_sequence_ids.as_ref().unwrap(),
        &vec![501, 502]
    );
}

#[test]
fn monte_carlo_estimates_or_tree() {
    let (model, bindings) = or_two_events_model();
    let settings = QuantificationSettings {
        monte_carlo: Some(true),
        num_trials: Some(100_000),
        seed: Some(847),
        ..Default::default()
    };
    let result = quantify(&model, &bindings, &CcfGroupTable::default(), &settings).unwrap();
    let probability = result.fault_trees.unwrap()[0]
        .top_event_probability
        .clone()
        .unwrap();
    assert_eq!(probability.approximation, Some(Approximation::MonteCarlo));
    assert!((probability.value - 0.28).abs() < 0.01);
}

#[test]
fn importance_measures_cover_all_basic_events() {
    let (model, bindings) = or_two_events_model();
    let settings = QuantificationSettings {
        bdd: Some(true),
        importance: Some(true),
        ..Default::default()
    };
    let result = quantify(&model, &bindings, &CcfGroupTable::default(), &settings).unwrap();
    let fault_trees = result.fault_trees.unwrap();
    let importance = fault_trees[0].importance.as_ref().unwrap();
    let mut ids: Vec<i64> = importance.iter().map(|m| m.basic_event_id).collect();
    ids.sort();
    assert_eq!(ids, vec![10, 11]);
    for measure in importance {
        assert!(measure.risk_achievement_worth.unwrap() >= 1.0);
        assert!(measure.birnbaum.unwrap() > 0.0);
    }
}

#[test]
fn uncertainty_propagates_normal_distribution() {
    let mut model = BooleanModel {
        id: 1,
        ..Default::default()
    };
    model.nodes.insert(1, gate(1, BooleanOperator::Or, vec![2]));
    model.nodes.insert(2, basic(2, 1));
    model.fault_trees.push(fault_tree_entry(100, 1));
    let bindings = BasicEventBindingTable {
        id: 1,
        bindings: vec![BasicEventBinding {
            basic_event_id: 1,
            value: BasicEventValue::Expression(Expr::normal(0.3, 0.05)),
            ..Default::default()
        }],
        ..Default::default()
    };
    let settings = QuantificationSettings {
        bdd: Some(true),
        uncertainty: Some(true),
        num_trials: Some(2_000),
        seed: Some(847),
        ..Default::default()
    };
    let result = quantify(&model, &bindings, &CcfGroupTable::default(), &settings).unwrap();
    let fault_trees = result.fault_trees.unwrap();
    let uncertainty = fault_trees[0].uncertainty.as_ref().unwrap();
    assert!((uncertainty.mean - 0.3).abs() < 0.05);
    assert!(uncertainty.standard_deviation.unwrap() > 0.0);
    assert!(uncertainty.quantiles.is_some());
}

#[test]
fn sil_band_derives_from_probability() {
    let mut model = BooleanModel {
        id: 1,
        ..Default::default()
    };
    model.nodes.insert(1, gate(1, BooleanOperator::Or, vec![2]));
    model.nodes.insert(2, basic(2, 1));
    model.fault_trees.push(fault_tree_entry(100, 1));
    let bindings = BasicEventBindingTable {
        id: 1,
        bindings: vec![binding(1, 5e-4)],
        ..Default::default()
    };
    let settings = QuantificationSettings {
        bdd: Some(true),
        sil: Some(true),
        ..Default::default()
    };
    let result = quantify(&model, &bindings, &CcfGroupTable::default(), &settings).unwrap();
    let sils = result.safety_integrity_levels.unwrap();
    assert_eq!(sils.len(), 1);
    assert_eq!(sils[0].sil_band, Some(3));
    assert!((sils[0].average_probability.unwrap() - 5e-4).abs() < 1e-15);
}

#[test]
fn ccf_beta_factor_raises_and_gate_probability() {
    let mut model = BooleanModel {
        id: 1,
        ..Default::default()
    };
    model
        .nodes
        .insert(1, gate(1, BooleanOperator::And, vec![2, 3]));
    model.nodes.insert(2, basic(2, 10));
    model.nodes.insert(3, basic(3, 11));
    model.fault_trees.push(fault_tree_entry(100, 1));
    let bindings = BasicEventBindingTable {
        id: 1,
        bindings: vec![binding(10, 0.1), binding(11, 0.1)],
        ..Default::default()
    };
    let ccf = CcfGroupTable {
        id: 1,
        boolean_model_ref: 1,
        groups: vec![CcfGroup {
            id: 5,
            name: None,
            member_basic_event_ids: vec![10, 11],
            model: CcfParameterModel::BetaFactor {
                beta: 0.1,
                total_failure_probability: 0.1,
            },
            data_analysis_ccf_parameter_ref: None,
        }],
    };
    let settings = QuantificationSettings {
        bdd: Some(true),
        ccf: Some(true),
        ..Default::default()
    };

    let result = quantify(&model, &bindings, &ccf, &settings).unwrap();
    let probability = result.fault_trees.unwrap()[0]
        .top_event_probability
        .clone()
        .unwrap();

    let common = 0.01;
    let indep = 0.09;
    let expected = common + indep * indep - common * indep * indep;
    assert!((probability.value - expected).abs() < 1e-9);

    assert!(probability.value > 0.018);
}

fn value_binding(basic_event_id: BasicEventId, value: BasicEventValue) -> BasicEventBinding {
    BasicEventBinding {
        basic_event_id,
        value,
        ..Default::default()
    }
}

fn one_event_model() -> BooleanModel {
    let mut model = BooleanModel {
        id: 1,
        ..Default::default()
    };
    model
        .nodes
        .insert(1, gate(1, BooleanOperator::Or, vec![2]));
    model.nodes.insert(2, basic(2, 10));
    model.fault_trees.push(fault_tree_entry(100, 1));
    model
}

fn top_probability(
    model: &BooleanModel,
    bindings: &BasicEventBindingTable,
    settings: &QuantificationSettings,
) -> f64 {
    let result = quantify(model, bindings, &CcfGroupTable::default(), settings).unwrap();
    result.fault_trees.unwrap()[0]
        .top_event_probability
        .clone()
        .unwrap()
        .value
}

#[test]
fn rate_per_hour_resolves_to_exponential() {
    let model = one_event_model();
    let bindings = BasicEventBindingTable {
        id: 1,
        bindings: vec![value_binding(
            10,
            BasicEventValue::Rate {
                rate: 1.0e-3,
                basis: RateBasis::PerHour,
                mission_time: None,
            },
        )],
        ..Default::default()
    };
    let settings = QuantificationSettings {
        bdd: Some(true),
        mission_time: Some(100.0),
        ..Default::default()
    };
    let p = top_probability(&model, &bindings, &settings);
    let expected = 1.0 - (-1.0e-3f64 * 100.0).exp();
    assert!((p - expected).abs() < 1e-9);
}

#[test]
fn rate_per_demand_is_point_probability() {
    let model = one_event_model();
    let bindings = BasicEventBindingTable {
        id: 1,
        bindings: vec![value_binding(
            10,
            BasicEventValue::Rate {
                rate: 0.02,
                basis: RateBasis::PerDemand,
                mission_time: None,
            },
        )],
        ..Default::default()
    };
    let settings = QuantificationSettings {
        bdd: Some(true),
        ..Default::default()
    };
    let p = top_probability(&model, &bindings, &settings);
    assert!((p - 0.02).abs() < 1e-12);
}

#[test]
fn summary_mean_error_factor_lognormal_uses_given_mean() {
    let model = one_event_model();
    let bindings = BasicEventBindingTable {
        id: 1,
        bindings: vec![value_binding(
            10,
            BasicEventValue::Summary(SummarySpec {
                central: SummaryCentral::Mean(0.01),
                spread: SummarySpread::ErrorFactor(3.0),
                family: SummaryFamily::Lognormal,
            }),
        )],
        ..Default::default()
    };
    let settings = QuantificationSettings {
        bdd: Some(true),
        ..Default::default()
    };
    let p = top_probability(&model, &bindings, &settings);
    assert!((p - 0.01).abs() < 1e-9);
}

#[test]
fn raw_data_demands_uses_jeffreys_posterior_mean() {
    let model = one_event_model();
    let bindings = BasicEventBindingTable {
        id: 1,
        bindings: vec![value_binding(
            10,
            BasicEventValue::RawData(RawDataSpec {
                failures: 2.0,
                exposure: Exposure::Demands(1000.0),
                prior: RawDataPrior::Jeffreys,
            }),
        )],
        ..Default::default()
    };
    let settings = QuantificationSettings {
        bdd: Some(true),
        ..Default::default()
    };
    let p = top_probability(&model, &bindings, &settings);
    let expected = (2.0 + 0.5) / (1000.0 + 1.0);
    assert!((p - expected).abs() < 1e-9);
}

#[test]
fn expression_resolves_named_parameter() {
    let model = one_event_model();
    let mut parameters = std::collections::HashMap::new();
    parameters.insert("q".to_string(), Expr::Constant(0.05));
    let bindings = BasicEventBindingTable {
        id: 1,
        bindings: vec![value_binding(
            10,
            BasicEventValue::Expression(Expr::Parameter("q".to_string())),
        )],
        parameters,
        ..Default::default()
    };
    let settings = QuantificationSettings {
        bdd: Some(true),
        ..Default::default()
    };
    let p = top_probability(&model, &bindings, &settings);
    assert!((p - 0.05).abs() < 1e-9);
}
