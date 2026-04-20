use std::collections::HashMap;
use praxis::openpra_mef::event_tree_quantification::{
    EtAlgorithmKind, EtQuantificationRequest, MefEventTreeGraph, MefEtEdge, MefEtEdgeData,
    MefEtNode, MefEtNodeData, MefFunctionalEvent, quantify_event_tree,
};
use praxis::openpra_mef::fault_tree_quantification::{
    ApproximationKind, MefFaultTreeGraph, MefFaultTreeNode,
};

fn be_node(id: &str, p: f64) -> (String, MefFaultTreeNode) {
    (id.to_string(), MefFaultTreeNode {
        uuid: id.to_string(),
        node_type: "BASIC_EVENT".to_string(),
        name: id.to_string(),
        inputs: vec![],
        probability: Some(p),
        probability_type: None,
        probability_distribution: None,
        k_value: None,
        house_event_value: None,
        transfer_tree_id: None,
    })
}

fn gate_node(id: &str, gate_type: &str, inputs: Vec<&str>) -> (String, MefFaultTreeNode) {
    (id.to_string(), MefFaultTreeNode {
        uuid: id.to_string(),
        node_type: gate_type.to_string(),
        name: id.to_string(),
        inputs: inputs.into_iter().map(str::to_string).collect(),
        probability: None,
        probability_type: None,
        probability_distribution: None,
        k_value: None,
        house_event_value: None,
        transfer_tree_id: None,
    })
}

fn visible_node(id: &str, label: &str, depth: i64) -> MefEtNode {
    MefEtNode {
        id: id.to_string(),
        node_type: Some("visibleNode".to_string()),
        data: MefEtNodeData {
            label: label.to_string(),
            depth: Some(depth),
            ..Default::default()
        },
        position: Default::default(),
    }
}

fn output_node(id: &str, seq_label: &str, depth: i64) -> MefEtNode {
    MefEtNode {
        id: id.to_string(),
        node_type: Some("outputNode".to_string()),
        data: MefEtNodeData {
            label: seq_label.to_string(),
            depth: Some(depth),
            is_sequence_id: Some(true),
            ..Default::default()
        },
        position: Default::default(),
    }
}

fn branch_edge(id: &str, src: &str, tgt: &str, state: &str, fe_id: &str) -> MefEtEdge {
    MefEtEdge {
        id: id.to_string(),
        source: src.to_string(),
        target: tgt.to_string(),
        data: MefEtEdgeData {
            label: Some(state.to_string()),
            branch_state: Some(state.to_string()),
            fe_id: Some(fe_id.to_string()),
            ..Default::default()
        },
    }
}

fn fe_entry(ft_id: &str, gate: &str) -> MefFunctionalEvent {
    MefFunctionalEvent {
        id: ft_id.to_string(),
        name: None,
        fault_tree_id: Some(ft_id.to_string()),
        collected_gate: Some(gate.to_string()),
        success_is_complement: None,
        success_probability: None,
        order: None,
    }
}

fn build_two_ft_trees() -> HashMap<String, MefFaultTreeGraph> {
    let mut trees = HashMap::new();

    let mut iva_nodes = HashMap::new();
    iva_nodes.extend([
        be_node("RC1", 0.1),
        be_node("X1", 0.1),
        gate_node("TOP_A", "OR_GATE", vec!["RC1", "X1"]),
    ]);
    trees.insert("FT_IVA".to_string(), MefFaultTreeGraph {
        fault_tree_id: "FT_IVA".to_string(),
        top_event_id: "TOP_A".to_string(),
        nodes: iva_nodes,
    });

    let mut bd_nodes = HashMap::new();
    bd_nodes.extend([
        be_node("RC1", 0.1),
        be_node("X2", 0.1),
        gate_node("TOP_BD", "OR_GATE", vec!["RC1", "X2"]),
    ]);
    trees.insert("FT_BD".to_string(), MefFaultTreeGraph {
        fault_tree_id: "FT_BD".to_string(),
        top_event_id: "TOP_BD".to_string(),
        nodes: bd_nodes,
    });

    trees
}

fn build_request(alg: EtAlgorithmKind, approx: Option<ApproximationKind>) -> EtQuantificationRequest {
    let nodes = vec![
        visible_node("n_iva",  "FE1", 1),
        visible_node("n_bd_s", "FE2", 2),
        visible_node("n_bd_f", "FE2", 2),
        output_node("seq_s1",  "S1",  3),
        output_node("seq_s2",  "S2",  3),
        output_node("seq_s3",  "S3",  3),
        output_node("seq_s4",  "S4",  3),
    ];
    let edges = vec![
        branch_edge("e1", "n_iva",  "n_bd_s", "success", "FE1"),
        branch_edge("e2", "n_iva",  "n_bd_f", "failure", "FE1"),
        branch_edge("e3", "n_bd_s", "seq_s1", "success", "FE2"),
        branch_edge("e4", "n_bd_s", "seq_s2", "failure", "FE2"),
        branch_edge("e5", "n_bd_f", "seq_s3", "success", "FE2"),
        branch_edge("e6", "n_bd_f", "seq_s4", "failure", "FE2"),
    ];
    let mut functional_events = HashMap::new();
    functional_events.insert("FE1".to_string(), fe_entry("FT_IVA", "TOP_A"));
    functional_events.insert("FE2".to_string(), fe_entry("FT_BD",  "TOP_BD"));

    EtQuantificationRequest {
        graph: MefEventTreeGraph {
            event_tree_id: "TestET".to_string(),
            nodes,
            edges,
            functional_events: Some(functional_events),
        },
        algorithm: alg,
        approximation: approx,
        max_order: None,
        num_samples: None,
        fault_trees: build_two_ft_trees(),
        visualize: false,
        visualize_out_dir: None,
        visualize_sequence: None,
    }
}

#[test]
fn test_all_success_sequence_has_no_cut_sets() {
    let req = build_request(EtAlgorithmKind::Bdd, None);
    let result = quantify_event_tree(&req).unwrap();
    let s1 = result.sequences.iter().find(|s| s.sequence_id == "S1").unwrap();
    assert_eq!(s1.cut_sets.len(), 0, "All-success S1 should have no cut sets");
}

#[test]
fn test_zbdd_s2_excludes_shared_event_rc1() {
    let req = build_request(EtAlgorithmKind::Zbdd, Some(ApproximationKind::RareEvent));
    let result = quantify_event_tree(&req).unwrap();
    let s2 = result.sequences.iter().find(|s| s.sequence_id == "S2").unwrap();

    let has_rc1 = s2.cut_sets.iter().any(|cs| cs.events.contains(&"RC1".to_string()));
    assert!(!has_rc1,
        "S2 (IVA success, BD failure) should exclude RC1 via delete-term conditioning. Cut sets: {:?}",
        s2.cut_sets
    );
    assert_eq!(s2.cut_sets.len(), 1, "S2 should have exactly 1 conditioned cut set {{X2}}");
}

#[test]
fn test_bdd_s2_excludes_shared_event_rc1() {
    let req = build_request(EtAlgorithmKind::Bdd, None);
    let result = quantify_event_tree(&req).unwrap();
    let s2 = result.sequences.iter().find(|s| s.sequence_id == "S2").unwrap();

    let has_rc1 = s2.cut_sets.iter().any(|cs| cs.events.contains(&"RC1".to_string()));
    assert!(!has_rc1,
        "BDD S2 should also exclude RC1 via delete-term conditioning. Cut sets: {:?}",
        s2.cut_sets
    );
}

#[test]
fn test_zbdd_s3_excludes_shared_event_rc1() {
    let req = build_request(EtAlgorithmKind::Zbdd, Some(ApproximationKind::RareEvent));
    let result = quantify_event_tree(&req).unwrap();
    let s3 = result.sequences.iter().find(|s| s.sequence_id == "S3").unwrap();

    let has_rc1 = s3.cut_sets.iter().any(|cs| cs.events.contains(&"RC1".to_string()));
    assert!(!has_rc1,
        "S3 (IVA failure, BD success) should exclude RC1. Cut sets: {:?}",
        s3.cut_sets
    );
    assert_eq!(s3.cut_sets.len(), 1, "S3 should have exactly 1 conditioned cut set {{X1}}");
}

#[test]
fn test_all_failure_sequence_has_conditioned_cut_sets() {
    let req = build_request(EtAlgorithmKind::Zbdd, Some(ApproximationKind::RareEvent));
    let result = quantify_event_tree(&req).unwrap();
    let s4 = result.sequences.iter().find(|s| s.sequence_id == "S4").unwrap();

    assert!(!s4.cut_sets.is_empty(), "All-failure S4 should have cut sets");
    assert_eq!(s4.cut_sets.len(), 2,
        "S4 compound (IVA AND BD = RC1 OR X1*X2) should have 2 MCS. Got: {:?}", s4.cut_sets
    );
    let rc1_cs = s4.cut_sets.iter().find(|cs| cs.events == vec!["RC1".to_string()]);
    assert!(rc1_cs.is_some(), "S4 should contain singleton {{RC1}} cut set");
}

#[test]
fn test_bdd_and_zbdd_probability_agree() {
    let req_bdd  = build_request(EtAlgorithmKind::Bdd,  None);
    let req_zbdd = build_request(EtAlgorithmKind::Zbdd, Some(ApproximationKind::RareEvent));
    let r_bdd  = quantify_event_tree(&req_bdd).unwrap();
    let r_zbdd = quantify_event_tree(&req_zbdd).unwrap();

    for seq_bdd in &r_bdd.sequences {
        let seq_z = r_zbdd.sequences.iter().find(|s| s.sequence_id == seq_bdd.sequence_id).unwrap();
        let p_bdd = seq_bdd.probability.unwrap_or(0.0);
        let p_z = seq_z.probability.unwrap_or(0.0);
        assert!(
            (p_bdd - p_z).abs() < 1e-4,
            "BDD and ZBDD should give similar probability for {}. BDD={}, ZBDD={}",
            seq_bdd.sequence_id, p_bdd, p_z
        );
    }
}

#[test]
fn test_zbdd_conditioned_cut_set_counts_correct() {
    let req = build_request(EtAlgorithmKind::Zbdd, Some(ApproximationKind::RareEvent));
    let result = quantify_event_tree(&req).unwrap();

    let s1 = result.sequences.iter().find(|s| s.sequence_id == "S1").unwrap();
    let s2 = result.sequences.iter().find(|s| s.sequence_id == "S2").unwrap();
    let s3 = result.sequences.iter().find(|s| s.sequence_id == "S3").unwrap();
    let s4 = result.sequences.iter().find(|s| s.sequence_id == "S4").unwrap();

    assert_eq!(s1.cut_sets.len(), 0, "S1 (all-success) should have 0 cut sets");
    assert_eq!(s2.cut_sets.len(), 1, "S2 (IVA-s, BD-f) should have 1 conditioned cut set {{X2}}");
    assert_eq!(s3.cut_sets.len(), 1, "S3 (IVA-f, BD-s) should have 1 conditioned cut set {{X1}}");
    assert_eq!(s4.cut_sets.len(), 2, "S4 (all-failure) should have 2 cut sets {{RC1}}, {{X1,X2}}");
}

#[test]
fn test_elapsed_ms_fields_populated() {
    let req = build_request(EtAlgorithmKind::Bdd, None);
    let result = quantify_event_tree(&req).unwrap();
    assert!(result.elapsed_ms >= 0.0);
    for seq in &result.sequences {
        assert!(seq.elapsed_ms >= 0.0);
    }
}

#[test]
fn test_mcub_probability_on_conditioned_cut_sets() {
    let req = build_request(EtAlgorithmKind::Zbdd, Some(ApproximationKind::Mcub));
    let result = quantify_event_tree(&req).unwrap();

    let s2 = result.sequences.iter().find(|s| s.sequence_id == "S2").unwrap();
    assert!(s2.probability.unwrap_or(0.0) > 0.0, "S2 MCUB probability should be positive");
    let expected_s2_prob = 0.1_f64;
    assert!(
        (s2.probability.unwrap() - expected_s2_prob).abs() < 0.02,
        "S2 MCUB probability should be ~0.1 (only {{X2}} cut set). Got: {}",
        s2.probability.unwrap()
    );
}

#[test]
fn test_monte_carlo_returns_empty_cut_sets() {
    let mut req = build_request(EtAlgorithmKind::MonteCarlo, None);
    req.num_samples = Some(100);
    let result = quantify_event_tree(&req).unwrap();
    for seq in &result.sequences {
        assert_eq!(seq.cut_sets.len(), 0,
            "Monte Carlo should return empty cut sets for {}", seq.sequence_id
        );
    }
}
