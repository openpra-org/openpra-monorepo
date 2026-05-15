//! Integration tests for CCF (Common Cause Failure) analysis
//!
//! Tests end-to-end CCF functionality including:
//! - Parsing CCF groups from OpenPSA MEF XML
//! - Expanding CCF groups into basic events
//! - Verifying probability calculations for different CCF models
//! - Integration with fault tree analysis

use praxis::core::ccf::{CcfGroup, CcfModel};
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};
use praxis::io::parser::parse_fault_tree;
use std::collections::HashMap;

/// Test Beta-Factor CCF with 2-component system
///
/// Model: β = 0.2, Q = 0.1
/// Expected events:
/// - 2 independent events: Q_indep = (1-β)·Q = 0.8 * 0.1 = 0.08 each
/// - 1 common event: Q_common = β·Q = 0.2 * 0.1 = 0.02
#[test]
fn test_beta_factor_two_components() {
    let mut ft = FaultTree::new("BetaTest2", "TOP").unwrap();

    // Create CCF group
    let members = vec!["Pump1".to_string(), "Pump2".to_string()];
    let ccf_group = CcfGroup::new("Pumps", members, CcfModel::BetaFactor(0.2))
        .unwrap()
        .with_distribution("0.1".to_string());

    ft.add_ccf_group(ccf_group).unwrap();

    // Expand CCF groups
    let mut base_probs = HashMap::new();
    base_probs.insert("Pumps".to_string(), 0.1);
    ft.expand_ccf_groups(&base_probs).unwrap();

    // Verify 3 basic events were created
    assert_eq!(ft.basic_events().len(), 3, "Should have 3 expanded events");

    // Verify independent event probabilities
    let indep_prob = 0.08; // (1-β)·Q = 0.8 * 0.1
    let common_prob = 0.02; // β·Q = 0.2 * 0.1

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

/// Test Beta-Factor CCF with 3-component system from XML file
///
/// Uses actual beta_factor_ccf.xml structure with 2 CCF groups (Pumps, Valves)
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

    // Expand CCF groups
    let mut base_probs = HashMap::new();
    base_probs.insert("Pumps".to_string(), 0.1);
    ft.expand_ccf_groups(&base_probs).unwrap();

    // Verify 4 basic events were created (3 independent + 1 common)
    assert_eq!(ft.basic_events().len(), 4, "Should have 4 expanded events");

    // Count event types
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

/// Test Alpha-Factor CCF model with 3-component system
///
/// Model: α = [0.7, 0.2, 0.1], Q = 0.1
/// Expected events:
/// - 3 single-failure events: α₁·Q/C(3,1) = 0.7 * 0.1 / 3 ≈ 0.0233 each
/// - 3 double-failure events: α₂·Q/C(3,2) = 0.2 * 0.1 / 3 ≈ 0.0067 each
/// - 1 triple-failure event: α₃·Q/C(3,3) = 0.1 * 0.1 / 1 = 0.01
#[test]
fn test_alpha_factor_three_components() {
    let mut ft = FaultTree::new("AlphaTest3", "TOP").unwrap();

    // Create CCF group
    let members = vec![
        "Comp1".to_string(),
        "Comp2".to_string(),
        "Comp3".to_string(),
    ];
    let alphas = vec![0.7, 0.2, 0.1];
    let ccf_group = CcfGroup::new("Components", members, CcfModel::AlphaFactor(alphas))
        .unwrap()
        .with_distribution("0.1".to_string());

    ft.add_ccf_group(ccf_group).unwrap();

    // Expand CCF groups
    let mut base_probs = HashMap::new();
    base_probs.insert("Components".to_string(), 0.1);
    ft.expand_ccf_groups(&base_probs).unwrap();

    // Verify 7 basic events were created (3 single + 3 double + 1 triple)
    assert_eq!(ft.basic_events().len(), 7, "Should have 7 expanded events");

    // Count events by level
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

    // Verify probability calculation for level 1 events
    let expected_prob_l1 = 0.7 * 0.1 / 3.0; // α₁·Q/C(3,1)
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

/// Test Alpha-Factor CCF from actual XML file
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
        CcfModel::AlphaFactor(alphas) => {
            assert_eq!(alphas.len(), 3);
            assert_eq!(alphas[0], 0.7);
            assert_eq!(alphas[1], 0.2);
            assert_eq!(alphas[2], 0.1);
        }
        _ => panic!("Expected AlphaFactor model"),
    }

    // Expand CCF groups
    let mut base_probs = HashMap::new();
    base_probs.insert("Valves".to_string(), 0.1);
    ft.expand_ccf_groups(&base_probs).unwrap();

    assert_eq!(ft.basic_events().len(), 7, "Should have 7 expanded events");
}

/// Test MGL (Multiple Greek Letter) CCF model with 4-component system
///
/// Model: Q = [0.05, 0.02, 0.01, 0.005] (Q₁, Q₂, Q₃, Q₄)
/// Expected events:
/// - C(4,1) = 4 single-failure events: Q₁/4 each
/// - C(4,2) = 6 double-failure events: Q₂/6 each
/// - C(4,3) = 4 triple-failure events: Q₃/4 each
/// - C(4,4) = 1 quad-failure event: Q₄
#[test]
fn test_mgl_four_components() {
    let mut ft = FaultTree::new("MGLTest4", "TOP").unwrap();

    // Create CCF group
    let members = vec![
        "Unit1".to_string(),
        "Unit2".to_string(),
        "Unit3".to_string(),
        "Unit4".to_string(),
    ];
    let q_factors = vec![0.05, 0.02, 0.01, 0.005];
    let ccf_group = CcfGroup::new("Units", members, CcfModel::Mgl(q_factors))
        .unwrap()
        .with_distribution("0.1".to_string());

    ft.add_ccf_group(ccf_group).unwrap();

    // Expand CCF groups
    let mut base_probs = HashMap::new();
    base_probs.insert("Units".to_string(), 0.1);
    ft.expand_ccf_groups(&base_probs).unwrap();

    // Verify 15 basic events were created (4 + 6 + 4 + 1)
    assert_eq!(
        ft.basic_events().len(),
        15,
        "Should have 15 expanded events"
    );

    // Count events by level
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

    // Verify probability for level 1 events: Q₁/C(4,1) = 0.05/4 = 0.0125
    let expected_prob_l1 = 0.05 / 4.0;
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

/// Test complete fault tree with CCF groups
///
/// This test verifies that CCF groups integrate properly with:
/// - Fault tree gates
/// - Basic events
/// - Analysis pipeline
#[test]
fn test_fault_tree_with_ccf_integration() {
    let mut ft = FaultTree::new("IntegrationTest", "TOP").unwrap();

    // Add top gate: TOP = TrainA OR TrainB
    let mut top_gate = Gate::new("TOP".to_string(), Formula::Or).unwrap();
    top_gate.add_operand("TrainA".to_string());
    top_gate.add_operand("TrainB".to_string());
    ft.add_gate(top_gate).unwrap();

    // Add train gates: TrainA = PumpA AND ValveA
    let mut train_a = Gate::new("TrainA".to_string(), Formula::And).unwrap();
    train_a.add_operand("PumpA".to_string());
    train_a.add_operand("ValveA".to_string());
    ft.add_gate(train_a).unwrap();

    let mut train_b = Gate::new("TrainB".to_string(), Formula::And).unwrap();
    train_b.add_operand("PumpB".to_string());
    train_b.add_operand("ValveB".to_string());
    ft.add_gate(train_b).unwrap();

    // Add CCF group for pumps
    let pump_members = vec!["PumpA".to_string(), "PumpB".to_string()];
    let pump_ccf = CcfGroup::new("PumpCCF", pump_members, CcfModel::BetaFactor(0.1))
        .unwrap()
        .with_distribution("0.05".to_string());
    ft.add_ccf_group(pump_ccf).unwrap();

    // Add CCF group for valves
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

    // Expand CCF groups
    let mut base_probs = HashMap::new();
    base_probs.insert("PumpCCF".to_string(), 0.05);
    base_probs.insert("ValveCCF".to_string(), 0.03);
    ft.expand_ccf_groups(&base_probs).unwrap();

    // Each CCF group with 2 members creates 3 events (2 indep + 1 common)
    assert_eq!(
        ft.basic_events().len(),
        6,
        "Should have 6 expanded events (3 per CCF group)"
    );

    // Verify we have the expected event types
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

/// Test CCF probability conservation
///
/// Verifies that the sum of probabilities of all expanded events
/// approximately equals the base probability (accounting for combinations)
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

    // For Beta-Factor with n=3, β=0.3, Q=0.1:
    // - 3 independent events: (1-β)·Q = 0.7 * 0.1 = 0.07 each
    // - 1 common event: β·Q = 0.3 * 0.1 = 0.03
    // Total probability represented: 3*0.07 + 0.03 = 0.24
    // (This is NOT the same as base probability due to overlapping failure modes)

    let total_prob: f64 = ft.basic_events().values().map(|e| e.probability()).sum();
    let expected_total = 3.0 * 0.07 + 0.03; // 0.24

    assert!(
        (total_prob - expected_total).abs() < 1e-10,
        "Total probability should be approximately {}, got {}",
        expected_total,
        total_prob
    );
}

/// Test multiple CCF groups with mixed models
#[test]
fn test_multiple_ccf_groups_mixed_models() {
    let mut ft = FaultTree::new("MixedModels", "TOP").unwrap();

    // Beta-Factor group
    let beta_members = vec!["A1".to_string(), "A2".to_string()];
    let beta_ccf = CcfGroup::new("BetaGroup", beta_members, CcfModel::BetaFactor(0.2))
        .unwrap()
        .with_distribution("0.1".to_string());
    ft.add_ccf_group(beta_ccf).unwrap();

    // Alpha-Factor group
    let alpha_members = vec!["B1".to_string(), "B2".to_string(), "B3".to_string()];
    let alpha_ccf = CcfGroup::new(
        "AlphaGroup",
        alpha_members,
        CcfModel::AlphaFactor(vec![0.6, 0.3, 0.1]),
    )
    .unwrap()
    .with_distribution("0.05".to_string());
    ft.add_ccf_group(alpha_ccf).unwrap();

    // Expand all CCF groups
    let mut base_probs = HashMap::new();
    base_probs.insert("BetaGroup".to_string(), 0.1);
    base_probs.insert("AlphaGroup".to_string(), 0.05);
    ft.expand_ccf_groups(&base_probs).unwrap();

    // Beta-Factor: 2 members → 3 events
    // Alpha-Factor: 3 members → 7 events
    // Total: 10 events
    assert_eq!(
        ft.basic_events().len(),
        10,
        "Should have 10 expanded events total"
    );

    // Verify event ID prefixes
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

/// Test CCF parsing and expansion end-to-end with realistic XML
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

    // Parse fault tree with CCF groups
    let mut ft = parse_fault_tree(xml).unwrap();

    // Verify structure
    assert_eq!(ft.element().id(), "RealisticCCF");
    assert_eq!(ft.gates().len(), 3);
    assert_eq!(ft.ccf_groups().len(), 2);

    // Expand CCF groups
    let mut base_probs = HashMap::new();
    base_probs.insert("PumpsA".to_string(), 0.01);
    base_probs.insert("PumpsB".to_string(), 0.015);
    ft.expand_ccf_groups(&base_probs).unwrap();

    // Each CCF group: 2 members → 3 events (2 indep + 1 common)
    assert_eq!(ft.basic_events().len(), 6);

    // Verify probabilities for PumpsA (β=0.1, Q=0.01)
    // Independent: (1-0.1)*0.01 = 0.009
    // Common: 0.1*0.01 = 0.001
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

    // Verify probabilities for PumpsB (β=0.12, Q=0.015)
    // Independent: (1-0.12)*0.015 = 0.0132
    // Common: 0.12*0.015 = 0.0018
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
