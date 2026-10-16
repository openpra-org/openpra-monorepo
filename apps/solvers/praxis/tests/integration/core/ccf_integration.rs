use praxis::analysis::uncertainty::propagate_uncertainty;
use praxis::core::ccf::{alphas_key, fixed_components, CcfGroup, CcfModel};
use praxis::core::distribution::{CcfTesting, Law};
use praxis::core::distribution_sampling::{SamplingMethod, SamplingPlan};
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};
use praxis::expression::Expr;
use praxis::io::parser::parse_fault_tree;
use std::collections::HashMap;

fn beta(id: &str, members: &[&str], factor: f64, total: f64) -> CcfGroup {
    CcfGroup::new(
        id,
        members.iter().map(|member| member.to_string()).collect(),
        CcfModel::BetaFactor(Expr::Constant(factor)),
        Some(Expr::Constant(total)),
    )
    .unwrap()
}

fn count_containing(ft: &FaultTree, fragment: &str) -> usize {
    ft.basic_events()
        .keys()
        .filter(|id| id.contains(fragment))
        .count()
}

#[test]
fn test_beta_factor_two_components() {
    let mut ft = FaultTree::new("BetaTest2", "TOP").unwrap();
    ft.add_ccf_group(beta("Pumps", &["Pump1", "Pump2"], 0.2, 0.1))
        .unwrap();
    ft.expand_ccf_groups().unwrap();

    assert_eq!(ft.basic_events().len(), 3);
    for (id, event) in ft.basic_events() {
        let expected = if id.contains("indep") { 0.08 } else { 0.02 };
        assert!((event.probability() - expected).abs() < 1e-15, "{id}");
    }
    assert_eq!(count_containing(&ft, "indep"), 2);
    assert_eq!(count_containing(&ft, "common"), 1);
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
    assert_eq!(ft.ccf_groups().len(), 1);
    ft.expand_ccf_groups().unwrap();
    assert_eq!(ft.basic_events().len(), 4);
    assert_eq!(count_containing(&ft, "indep"), 3);
    assert_eq!(count_containing(&ft, "common"), 1);
}

#[test]
fn test_alpha_factor_three_components() {
    let mut ft = FaultTree::new("AlphaTest3", "TOP").unwrap();
    ft.add_ccf_group(
        CcfGroup::new(
            "Components",
            vec!["Comp1".into(), "Comp2".into(), "Comp3".into()],
            CcfModel::AlphaFactor {
                testing: CcfTesting::NonStaggered,
                alphas: fixed_components(&alphas_key("Components"), vec![0.7, 0.2, 0.1]).unwrap(),
            },
            Some(Expr::Constant(0.1)),
        )
        .unwrap(),
    )
    .unwrap();
    ft.expand_ccf_groups().unwrap();

    assert_eq!(ft.basic_events().len(), 7);
    assert_eq!(count_containing(&ft, "alpha-1"), 3);
    assert_eq!(count_containing(&ft, "alpha-2"), 3);
    assert_eq!(count_containing(&ft, "alpha-3"), 1);
    let weighted = 0.7 + 2.0 * 0.2 + 3.0 * 0.1;
    for (id, event) in ft.basic_events() {
        if id.contains("alpha-1") {
            assert!((event.probability() - 0.7 / weighted * 0.1).abs() < 1e-15);
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
    assert_eq!(
        ft.get_ccf_group("Valves").unwrap().model,
        CcfModel::AlphaFactor {
            testing: CcfTesting::NonStaggered,
            alphas: fixed_components(&alphas_key("Valves"), vec![0.7, 0.2, 0.1]).unwrap(),
        }
    );
    ft.expand_ccf_groups().unwrap();
    assert_eq!(ft.basic_events().len(), 7);
}

#[test]
fn test_mgl_four_components() {
    let mut ft = FaultTree::new("MGLTest4", "TOP").unwrap();
    ft.add_ccf_group(
        CcfGroup::new(
            "Units",
            vec!["Unit1".into(), "Unit2".into(), "Unit3".into(), "Unit4".into()],
            CcfModel::Mgl(vec![
                Expr::Constant(0.1),
                Expr::Constant(0.3),
                Expr::Constant(0.5),
            ]),
            Some(Expr::Constant(0.1)),
        )
        .unwrap(),
    )
    .unwrap();
    ft.expand_ccf_groups().unwrap();

    assert_eq!(ft.basic_events().len(), 15);
    let mut level_counts = HashMap::new();
    for level in 1..=4 {
        level_counts.insert(level, count_containing(&ft, &format!("mgl-{level}")));
    }
    assert_eq!(level_counts[&1], 4);
    assert_eq!(level_counts[&2], 6);
    assert_eq!(level_counts[&3], 4);
    assert_eq!(level_counts[&4], 1);
    for (id, event) in ft.basic_events() {
        if id.contains("mgl-1") {
            assert!((event.probability() - 0.9 * 0.1).abs() < 1e-15);
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
    for (train, pump, valve) in [("TrainA", "PumpA", "ValveA"), ("TrainB", "PumpB", "ValveB")] {
        let mut gate = Gate::new(train.to_string(), Formula::And).unwrap();
        gate.add_operand(pump.to_string());
        gate.add_operand(valve.to_string());
        ft.add_gate(gate).unwrap();
    }
    ft.add_ccf_group(beta("PumpCCF", &["PumpA", "PumpB"], 0.1, 0.05))
        .unwrap();
    ft.add_ccf_group(beta("ValveCCF", &["ValveA", "ValveB"], 0.15, 0.03))
        .unwrap();
    assert_eq!(ft.basic_events().len(), 0);
    ft.expand_ccf_groups().unwrap();
    assert_eq!(ft.basic_events().len(), 6);
    assert_eq!(count_containing(&ft, "PumpCCF"), 3);
    assert_eq!(count_containing(&ft, "ValveCCF"), 3);
    assert_eq!(ft.probability_checks().len(), 4);
}

#[test]
fn test_ccf_probability_conservation() {
    let mut ft = FaultTree::new("ProbConservation", "TOP").unwrap();
    ft.add_ccf_group(beta("CCF", &["E1", "E2", "E3"], 0.3, 0.1))
        .unwrap();
    ft.expand_ccf_groups().unwrap();
    let total: f64 = ft.basic_events().values().map(|event| event.probability()).sum();
    assert!((total - (3.0 * 0.07 + 0.03)).abs() < 1e-15);
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
    ft.expand_ccf_groups().unwrap();
    assert_eq!(ft.basic_events().len(), 6);
    for (id, event) in ft.basic_events() {
        let expected = match (id.starts_with("PumpsA"), id.contains("indep")) {
            (true, true) => 0.009,
            (true, false) => 0.001,
            (false, true) => 0.0132,
            (false, false) => 0.0018,
        };
        assert!((event.probability() - expected).abs() < 1e-15, "{id}");
    }
}

#[test]
fn test_sampled_beta_factor_outside_zero_to_one_names_the_group_and_trial() {
    let mut ft = FaultTree::new("Sampled", "TOP").unwrap();
    let mut top = Gate::new("TOP".to_string(), Formula::And).unwrap();
    top.add_operand("A".to_string());
    top.add_operand("B".to_string());
    ft.add_gate(top).unwrap();
    ft.add_ccf_group(
        CcfGroup::new(
            "Pumps",
            vec!["A".into(), "B".into()],
            CcfModel::BetaFactor(Expr::draw(Law::Normal {
                mean: 0.5,
                standard_deviation: 0.4,
            })),
            Some(Expr::Constant(0.1)),
        )
        .unwrap(),
    )
    .unwrap();
    ft.expand_ccf_groups().unwrap();
    let plan = SamplingPlan {
        method: SamplingMethod::MonteCarlo,
        trials: 500,
        seed: 11,
    };
    let error = propagate_uncertainty(&ft, &plan).unwrap_err().to_string();
    assert!(
        error.contains("common cause group 'Pumps' beta factor") && error.contains("trial"),
        "{error}"
    );
}
