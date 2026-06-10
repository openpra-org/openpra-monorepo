use praxis::boolean::contract::{
    Approximation, BasicEventBinding, BasicEventBindingTable, BasicEventId, BooleanModel,
    BooleanNode, BooleanOperator, BooleanSequence, BooleanTree, CcfGroupTable, EndStateNode,
    NodeId, ParameterDistribution, QuantificationSettings, SolverTarget,
};
use praxis::boolean::quantify::quantify;

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
        point_probability: Some(probability),
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
            point_probability: Some(0.3),
            distribution: Some(ParameterDistribution::Normal {
                mean: 0.3,
                std_dev: 0.05,
            }),
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
