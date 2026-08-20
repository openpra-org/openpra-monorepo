use praxis::core::ccf::{CcfGroup, CcfModel, TestingScheme};
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};
use praxis::io::parser::parse_fault_tree;
use std::collections::HashMap;

#[test]
fn test_beta_factor_two_components() {
    let mut ft = FaultTree::new("BetaTest2", "TOP").unwrap();

    let members = vec!["Pump1".to_string(), "Pump2".to_string()];
    let ccf_group = CcfGroup::new("Pumps", members, CcfModel::BetaFactor(0.2))
        .unwrap()
        .with_distribution("0.1".to_string());

    ft.add_ccf_group(ccf_group).unwrap();

    let mut base_probs = HashMap::new();
    base_probs.insert("Pumps".to_string(), 0.1);
    ft.expand_ccf_groups(&base_probs).unwrap();

    assert_eq!(ft.basic_events().len(), 3, "Should have 3 expanded events");

    let indep_prob = 0.08;
    let common_prob = 0.02;

    let mut independent_count = 0;
    let mut common_count = 0;

    for (id, event) in ft.basic_events() {
        if id.contains("indep") {
            assert!(
                (event.probability() - indep_prob).abs() < 1e-10,
                "Independent event probability should be {}",
                indep_prob
            );
            independent_count += 1;
        } else if id.contains("common") {
            assert!(
                (event.probability() - common_prob).abs() < 1e-10,
                "Common event probability should be {}",
                common_prob
            );
            common_count += 1;
        }
    }

    assert_eq!(independent_count, 2, "Should have 2 independent events");
    assert_eq!(common_count, 1, "Should have 1 common event");
}

#[test]
fn test_beta_factor_three_components_from_xml() {
    let xml = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="BetaFactorCCF">
    <define-gate name="TopEvent">
      <and>
        <event name="TrainOne"/>
        <event name="TrainTwo"/>
        <event name="TrainThree"/>
      </and>
    </define-gate>
  </define-fault-tree>
  <define-CCF-group name="Pumps" model="beta-factor">
    <members>
      <basic-event name="PumpOne"/>
      <basic-event name="PumpTwo"/>
      <basic-event name="PumpThree"/>
    </members>
    <distribution>
      <float value="0.1"/>
    </distribution>
    <factor level="3">
      <float value="0.2"/>
    </factor>
  </define-CCF-group>
</opsa-mef>"#;

    let mut ft = parse_fault_tree(xml).unwrap();
    assert_eq!(ft.ccf_groups().len(), 1, "Should have 1 CCF group");

    let mut base_probs = HashMap::new();
    base_probs.insert("Pumps".to_string(), 0.1);
    ft.expand_ccf_groups(&base_probs).unwrap();

    assert_eq!(ft.basic_events().len(), 4, "Should have 4 expanded events");

    let mut independent_count = 0;
    let mut common_count = 0;

    for id in ft.basic_events().keys() {
        if id.contains("indep") {
            independent_count += 1;
        } else if id.contains("common") {
            common_count += 1;
        }
    }

    assert_eq!(independent_count, 3, "Should have 3 independent events");
    assert_eq!(common_count, 1, "Should have 1 common event");
}

#[test]
fn test_alpha_factor_three_components() {
    let mut ft = FaultTree::new("AlphaTest3", "TOP").unwrap();

    let members = vec![
        "Comp1".to_string(),
        "Comp2".to_string(),
        "Comp3".to_string(),
    ];
    let alphas = vec![0.7, 0.2, 0.1];
    let ccf_group = CcfGroup::new(
        "Components",
        members,
        CcfModel::AlphaFactor {
            factors: alphas,
            scheme: TestingScheme::NonStaggered,
        },
    )
    .unwrap()
    .with_distribution("0.1".to_string());

    ft.add_ccf_group(ccf_group).unwrap();

    let mut base_probs = HashMap::new();
    base_probs.insert("Components".to_string(), 0.1);
    ft.expand_ccf_groups(&base_probs).unwrap();

    assert_eq!(ft.basic_events().len(), 7, "Should have 7 expanded events");

    let mut level_1_count = 0;
    let mut level_2_count = 0;
    let mut level_3_count = 0;

    for id in ft.basic_events().keys() {
        if id.contains("alpha-1") {
            level_1_count += 1;
        } else if id.contains("alpha-2") {
            level_2_count += 1;
        } else if id.contains("alpha-3") {
            level_3_count += 1;
        }
    }

    assert_eq!(level_1_count, 3, "Should have 3 single-failure events");
    assert_eq!(level_2_count, 3, "Should have 3 double-failure events");
    assert_eq!(level_3_count, 1, "Should have 1 triple-failure event");

    let expected_prob_l1 = (0.7 / 1.4) * 0.1;
    for (id, event) in ft.basic_events() {
        if id.contains("alpha-1") {
            assert!(
                (event.probability() - expected_prob_l1).abs() < 1e-6,
                "Level 1 event probability should be approximately {}, got {}",
                expected_prob_l1,
                event.probability()
            );
        }
    }
}

#[test]
fn test_alpha_factor_from_xml() {
    let xml = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="AlphaFactorCCF">
    <define-gate name="TopEvent">
      <and>
        <event name="TrainOne"/>
        <event name="TrainTwo"/>
        <event name="TrainThree"/>
      </and>
    </define-gate>
  </define-fault-tree>
  <define-CCF-group name="Valves" model="alpha-factor">
    <members>
      <basic-event name="ValveOne"/>
      <basic-event name="ValveTwo"/>
      <basic-event name="ValveThree"/>
    </members>
    <distribution>
      <float value="0.1"/>
    </distribution>
    <factors>
      <factor level="1">
        <float value="0.7"/>
      </factor>
      <factor level="2">
        <float value="0.2"/>
      </factor>
      <factor level="3">
        <float value="0.1"/>
      </factor>
    </factors>
  </define-CCF-group>
</opsa-mef>"#;

    let mut ft = parse_fault_tree(xml).unwrap();
    assert_eq!(ft.ccf_groups().len(), 1, "Should have 1 CCF group");

    let ccf = ft.get_ccf_group("Valves").unwrap();
    match &ccf.model {
        CcfModel::AlphaFactor {
            factors: alphas, ..
        } => {
            assert_eq!(alphas.len(), 3);
            assert_eq!(alphas[0], 0.7);
            assert_eq!(alphas[1], 0.2);
            assert_eq!(alphas[2], 0.1);
        }
        _ => panic!("Expected AlphaFactor model"),
    }

    let mut base_probs = HashMap::new();
    base_probs.insert("Valves".to_string(), 0.1);
    ft.expand_ccf_groups(&base_probs).unwrap();

    assert_eq!(ft.basic_events().len(), 7, "Should have 7 expanded events");
}

#[test]
fn test_mgl_four_components() {
    let mut ft = FaultTree::new("MGLTest4", "TOP").unwrap();

    let members = vec![
        "Unit1".to_string(),
        "Unit2".to_string(),
        "Unit3".to_string(),
        "Unit4".to_string(),
    ];
    let q_factors = vec![0.1, 0.3, 0.5];
    let ccf_group = CcfGroup::new("Units", members, CcfModel::Mgl(q_factors))
        .unwrap()
        .with_distribution("0.1".to_string());

    ft.add_ccf_group(ccf_group).unwrap();

    let mut base_probs = HashMap::new();
    base_probs.insert("Units".to_string(), 0.1);
    ft.expand_ccf_groups(&base_probs).unwrap();

    assert_eq!(
        ft.basic_events().len(),
        15,
        "Should have 15 expanded events"
    );

    let mut level_counts = HashMap::new();
    for id in ft.basic_events().keys() {
        if id.contains("mgl-1") {
            *level_counts.entry(1).or_insert(0) += 1;
        } else if id.contains("mgl-2") {
            *level_counts.entry(2).or_insert(0) += 1;
        } else if id.contains("mgl-3") {
            *level_counts.entry(3).or_insert(0) += 1;
        } else if id.contains("mgl-4") {
            *level_counts.entry(4).or_insert(0) += 1;
        }
    }

    assert_eq!(
        level_counts.get(&1),
        Some(&4),
        "Should have 4 single-failure events"
    );
    assert_eq!(
        level_counts.get(&2),
        Some(&6),
        "Should have 6 double-failure events"
    );
    assert_eq!(
        level_counts.get(&3),
        Some(&4),
        "Should have 4 triple-failure events"
    );
    assert_eq!(
        level_counts.get(&4),
        Some(&1),
        "Should have 1 quad-failure event"
    );

    let expected_prob_l1 = (1.0 - 0.1) * 0.1;
    for (id, event) in ft.basic_events() {
        if id.contains("mgl-1") {
            assert!(
                (event.probability() - expected_prob_l1).abs() < 1e-10,
                "Level 1 event probability should be {}",
                expected_prob_l1
            );
        }
    }
}

#[test]
fn test_fault_tree_with_ccf_integration() {
    let mut ft = FaultTree::new("IntegrationTest", "TOP").unwrap();

    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("TrainA".to_string());
    top_gate.add_operand("TrainB".to_string());
    ft.add_gate(top_gate).unwrap();

    let mut train_a = Gate::new("TrainA".to_string(), Formula::And).unwrap();
    train_a.add_operand("PumpA".to_string());
    train_a.add_operand("ValveA".to_string());
    ft.add_gate(train_a).unwrap();

    let mut train_b = Gate::new("TrainB".to_string(), Formula::And).unwrap();
    train_b.add_operand("PumpB".to_string());
    train_b.add_operand("ValveB".to_string());
    ft.add_gate(train_b).unwrap();

    let pump_members = vec!["PumpA".to_string(), "PumpB".to_string()];
    let pump_ccf = CcfGroup::new("PumpCCF", pump_members, CcfModel::BetaFactor(0.1))
        .unwrap()
        .with_distribution("0.05".to_string());
    ft.add_ccf_group(pump_ccf).unwrap();

    let valve_members = vec!["ValveA".to_string(), "ValveB".to_string()];
    let valve_ccf = CcfGroup::new("ValveCCF", valve_members, CcfModel::BetaFactor(0.15))
        .unwrap()
        .with_distribution("0.03".to_string());
    ft.add_ccf_group(valve_ccf).unwrap();

    assert_eq!(ft.gates().len(), 3, "Should have 3 gates");
    assert_eq!(ft.ccf_groups().len(), 2, "Should have 2 CCF groups");
    assert_eq!(
        ft.basic_events().len(),
        0,
        "Should have no basic events before expansion"
    );

    let mut base_probs = HashMap::new();
    base_probs.insert("PumpCCF".to_string(), 0.05);
    base_probs.insert("ValveCCF".to_string(), 0.03);
    ft.expand_ccf_groups(&base_probs).unwrap();

    assert_eq!(
        ft.basic_events().len(),
        6,
        "Should have 6 expanded events (3 per CCF group)"
    );

    let pump_events: Vec<_> = ft
        .basic_events()
        .iter()
        .filter(|(id, _)| id.contains("PumpCCF"))
        .collect();
    let valve_events: Vec<_> = ft
        .basic_events()
        .iter()
        .filter(|(id, _)| id.contains("ValveCCF"))
        .collect();

    assert_eq!(pump_events.len(), 3, "Should have 3 pump CCF events");
    assert_eq!(valve_events.len(), 3, "Should have 3 valve CCF events");
}

#[test]
fn test_ccf_probability_conservation() {
    let mut ft = FaultTree::new("ProbConservation", "TOP").unwrap();

    let members = vec!["E1".to_string(), "E2".to_string(), "E3".to_string()];
    let ccf_group = CcfGroup::new("CCF", members, CcfModel::BetaFactor(0.3))
        .unwrap()
        .with_distribution("0.1".to_string());

    ft.add_ccf_group(ccf_group).unwrap();

    let mut base_probs = HashMap::new();
    base_probs.insert("CCF".to_string(), 0.1);
    ft.expand_ccf_groups(&base_probs).unwrap();

    let total_prob: f64 = ft.basic_events().values().map(|e| e.probability()).sum();
    let expected_total = 3.0 * 0.07 + 0.03;

    assert!(
        (total_prob - expected_total).abs() < 1e-10,
        "Total probability should be approximately {}, got {}",
        expected_total,
        total_prob
    );
}

#[test]
fn test_multiple_ccf_groups_mixed_models() {
    let mut ft = FaultTree::new("MixedModels", "TOP").unwrap();

    let beta_members = vec!["A1".to_string(), "A2".to_string()];
    let beta_ccf = CcfGroup::new("BetaGroup", beta_members, CcfModel::BetaFactor(0.2))
        .unwrap()
        .with_distribution("0.1".to_string());
    ft.add_ccf_group(beta_ccf).unwrap();

    let alpha_members = vec!["B1".to_string(), "B2".to_string(), "B3".to_string()];
    let alpha_ccf = CcfGroup::new(
        "AlphaGroup",
        alpha_members,
        CcfModel::AlphaFactor {
            factors: vec![0.6, 0.3, 0.1],
            scheme: TestingScheme::NonStaggered,
        },
    )
    .unwrap()
    .with_distribution("0.05".to_string());
    ft.add_ccf_group(alpha_ccf).unwrap();

    let mut base_probs = HashMap::new();
    base_probs.insert("BetaGroup".to_string(), 0.1);
    base_probs.insert("AlphaGroup".to_string(), 0.05);
    ft.expand_ccf_groups(&base_probs).unwrap();

    assert_eq!(
        ft.basic_events().len(),
        10,
        "Should have 10 expanded events total"
    );

    let beta_events: Vec<_> = ft
        .basic_events()
        .keys()
        .filter(|id| id.starts_with("BetaGroup"))
        .collect();
    let alpha_events: Vec<_> = ft
        .basic_events()
        .keys()
        .filter(|id| id.starts_with("AlphaGroup"))
        .collect();

    assert_eq!(beta_events.len(), 3, "Should have 3 Beta-Factor events");
    assert_eq!(alpha_events.len(), 7, "Should have 7 Alpha-Factor events");
}

#[test]
fn test_ccf_end_to_end_realistic() {
    let xml = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="RealisticCCF">
    <define-gate name="SystemFailure">
      <or>
        <event name="SubsystemA"/>
        <event name="SubsystemB"/>
      </or>
    </define-gate>
    <define-gate name="SubsystemA">
      <and>
        <event name="PumpA1"/>
        <event name="PumpA2"/>
      </and>
    </define-gate>
    <define-gate name="SubsystemB">
      <and>
        <event name="PumpB1"/>
        <event name="PumpB2"/>
      </and>
    </define-gate>
  </define-fault-tree>
  <define-CCF-group name="PumpsA" model="beta-factor">
    <members>
      <basic-event name="PumpA1"/>
      <basic-event name="PumpA2"/>
    </members>
    <distribution>
      <float value="0.01"/>
    </distribution>
    <factor level="2">
      <float value="0.1"/>
    </factor>
  </define-CCF-group>
  <define-CCF-group name="PumpsB" model="beta-factor">
    <members>
      <basic-event name="PumpB1"/>
      <basic-event name="PumpB2"/>
    </members>
    <distribution>
      <float value="0.015"/>
    </distribution>
    <factor level="2">
      <float value="0.12"/>
    </factor>
  </define-CCF-group>
</opsa-mef>"#;

    let mut ft = parse_fault_tree(xml).unwrap();

    assert_eq!(ft.element().id(), "RealisticCCF");
    assert_eq!(ft.gates().len(), 3);
    assert_eq!(ft.ccf_groups().len(), 2);

    let mut base_probs = HashMap::new();
    base_probs.insert("PumpsA".to_string(), 0.01);
    base_probs.insert("PumpsB".to_string(), 0.015);
    ft.expand_ccf_groups(&base_probs).unwrap();

    assert_eq!(ft.basic_events().len(), 6);

    let pumps_a_events: HashMap<_, _> = ft
        .basic_events()
        .iter()
        .filter(|(id, _)| id.starts_with("PumpsA"))
        .collect();

    for (id, event) in pumps_a_events {
        if id.contains("indep") {
            assert!(
                (event.probability() - 0.009).abs() < 1e-10,
                "PumpsA independent event should have p=0.009"
            );
        } else if id.contains("common") {
            assert!(
                (event.probability() - 0.001).abs() < 1e-10,
                "PumpsA common event should have p=0.001"
            );
        }
    }

    let pumps_b_events: HashMap<_, _> = ft
        .basic_events()
        .iter()
        .filter(|(id, _)| id.starts_with("PumpsB"))
        .collect();

    for (id, event) in pumps_b_events {
        if id.contains("indep") {
            assert!(
                (event.probability() - 0.0132).abs() < 1e-10,
                "PumpsB independent event should have p=0.0132"
            );
        } else if id.contains("common") {
            assert!(
                (event.probability() - 0.0018).abs() < 1e-10,
                "PumpsB common event should have p=0.0018"
            );
        }
    }
}
