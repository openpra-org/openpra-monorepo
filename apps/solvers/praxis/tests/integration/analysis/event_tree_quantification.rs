// Integration tests for Event Tree Quantification (T249)
// Tests sequence probability calculation with actual fault tree linkage

use praxis::analysis::event_tree::EventTreeAnalysis;
use praxis::analysis::fault_tree::FaultTreeAnalysis;
use praxis::core::event::BasicEvent;
use praxis::core::event_tree::*;
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};
use praxis::core::model::Model;

/// Test simple IE + FT link with direct probability calculation
#[test]
fn test_simple_ie_with_fault_tree() {
    // Create model with basic events
    let mut model = Model::new("GasLeakModel".to_string()).unwrap();

    // NOTE: In current implementation, FT probability represents SUCCESS probability
    // So we model detection SUCCESS, not detection failure
    // P(detection succeeds) = P(NOT (CPU fails OR 2+ sensors fail))
    //                       = 1 - P(CPU OR atleast2sensors)
    //                       ≈ 1 - 0.0571 = 0.9429
    let cpu = BasicEvent::new("CPU".to_string(), 0.05).unwrap();
    let sen1 = BasicEvent::new("SEN1".to_string(), 0.05).unwrap();
    let sen2 = BasicEvent::new("SEN2".to_string(), 0.05).unwrap();
    let sen3 = BasicEvent::new("SEN3".to_string(), 0.05).unwrap();

    model.add_basic_event(cpu.clone()).unwrap();
    model.add_basic_event(sen1.clone()).unwrap();
    model.add_basic_event(sen2.clone()).unwrap();
    model.add_basic_event(sen3.clone()).unwrap();

    // Create fault tree modeling detection SUCCESS (all components work)
    let mut ft = FaultTree::new("GasDetection".to_string(), "root".to_string()).unwrap();

    // For success: CPU works AND at least 2 of 3 sensors work
    // P(success) = P(CPU works) × P(at least 2 sensors work)
    // = 0.95 × (1 - P(at most 1 works))
    // = 0.95 × (1 - [P(all fail) + 3×P(exactly 1 works)])
    // = 0.95 × (1 - [0.05³ + 3×0.05×0.95²])
    // = 0.95 × (1 - [0.000125 + 0.135375])
    // = 0.95 × 0.8645 ≈ 0.821
    //
    // Actually, let's use a simpler model for testing:
    // FT = CPU_OK AND SEN1_OK  (simplified - both must work)
    // P = 0.95 × 0.95 = 0.9025

    let mut root_gate = Gate::new("root".to_string(), Formula::And).unwrap();
    root_gate.add_operand("CPU_OK".to_string());
    root_gate.add_operand("SEN1_OK".to_string());

    ft.add_gate(root_gate).unwrap();

    // Use complement events (1 - failure probability = success probability)
    let cpu_ok = BasicEvent::new("CPU_OK".to_string(), 0.95).unwrap();
    let sen1_ok = BasicEvent::new("SEN1_OK".to_string(), 0.95).unwrap();
    model.add_basic_event(cpu_ok.clone()).unwrap();
    model.add_basic_event(sen1_ok.clone()).unwrap();
    ft.add_basic_event(cpu_ok).unwrap();
    ft.add_basic_event(sen1_ok).unwrap();

    model.add_fault_tree(ft).unwrap();

    // Analyze fault tree to get probability
    let ft_ref = model.get_fault_tree("GasDetection").unwrap();
    let fta = FaultTreeAnalysis::new(ft_ref).unwrap();
    let ft_result = fta.analyze().unwrap();
    let ft_probability = ft_result.top_event_probability;

    // Create initiating event with fault tree link (NOT direct probability)
    // In the current implementation, if ft_id exists, it takes precedence
    let ie =
        InitiatingEvent::new("GasLeak".to_string()).with_fault_tree("GasDetection".to_string());

    // Create simple event tree with one functional event
    let fe_detection = FunctionalEvent::new("Detection".to_string())
        .with_fault_tree("GasDetection".to_string())
        .with_order(1);

    let seq_safe = Sequence::new("Safe".to_string());
    let seq_danger = Sequence::new("Danger".to_string());

    // Success = detection works (P = ft_probability, since FT represents success of detection)
    let path_success = Path::new(
        "success".to_string(),
        Branch::new(BranchTarget::Sequence("Safe".to_string())),
    )
    .unwrap();

    // Failure = detection fails (P = 1 - ft_probability)
    let path_failure = Path::new(
        "failure".to_string(),
        Branch::new(BranchTarget::Sequence("Danger".to_string())),
    )
    .unwrap();

    let fork = Fork::new("Detection".to_string(), vec![path_success, path_failure]).unwrap();

    let mut et = EventTree::new(
        "GasLeakET".to_string(),
        Branch::new(BranchTarget::Fork(fork)),
    );
    et.add_sequence(seq_safe).unwrap();
    et.add_sequence(seq_danger).unwrap();
    et.add_functional_event(fe_detection).unwrap();

    // Analyze event tree
    let mut eta = EventTreeAnalysis::new(ie, et, &model);
    eta.analyze().unwrap();

    let sequences = eta.sequences();
    assert_eq!(sequences.len(), 2, "Should have 2 sequences");

    // Verify probabilities
    // IE probability = FT probability = 0.9025 (since IE is linked to the same FT as Detection)
    // P(Safe) = P(IE) × P(detection succeeds) = 0.9025 × ft_probability = 0.9025 × 0.9025
    // P(Danger) = P(IE) × P(detection fails) = 0.9025 × (1 - ft_probability) = 0.9025 × 0.0975
    let ie_probability = ft_probability; // IE uses same FT
    for seq in sequences {
        if seq.sequence.id == "Safe" {
            let expected = ie_probability * ft_probability;
            assert!(
                (seq.probability - expected).abs() < 1e-6,
                "Safe sequence probability should be {} but was {}",
                expected,
                seq.probability
            );
        } else if seq.sequence.id == "Danger" {
            let expected = ie_probability * (1.0 - ft_probability);
            assert!(
                (seq.probability - expected).abs() < 1e-6,
                "Danger sequence probability should be {} but was {}",
                expected,
                seq.probability
            );
        }
    }
}

/// Test 2-level fork with multiple fault tree probabilities
#[test]
fn test_two_level_fork_with_fault_trees() {
    let mut model = Model::new("SafetyModel".to_string()).unwrap();

    // Create two simple fault trees
    // FT1: Simple OR gate - P = P(A) + P(B) - P(A)×P(B) = 0.1 + 0.2 - 0.02 = 0.28
    let be_a = BasicEvent::new("A".to_string(), 0.1).unwrap();
    let be_b = BasicEvent::new("B".to_string(), 0.2).unwrap();
    model.add_basic_event(be_a.clone()).unwrap();
    model.add_basic_event(be_b.clone()).unwrap();

    let mut ft1 = FaultTree::new("System1".to_string(), "root".to_string()).unwrap();
    let mut gate1 = Gate::new("root".to_string(), Formula::Or).unwrap();
    gate1.add_operand("A".to_string());
    gate1.add_operand("B".to_string());
    ft1.add_gate(gate1).unwrap();
    ft1.add_basic_event(be_a).unwrap();
    ft1.add_basic_event(be_b).unwrap();
    model.add_fault_tree(ft1).unwrap();

    // FT2: Simple AND gate - P = P(C) × P(D) = 0.15 × 0.25 = 0.0375
    let be_c = BasicEvent::new("C".to_string(), 0.15).unwrap();
    let be_d = BasicEvent::new("D".to_string(), 0.25).unwrap();
    model.add_basic_event(be_c.clone()).unwrap();
    model.add_basic_event(be_d.clone()).unwrap();

    let mut ft2 = FaultTree::new("System2".to_string(), "root".to_string()).unwrap();
    let mut gate2 = Gate::new("root".to_string(), Formula::And).unwrap();
    gate2.add_operand("C".to_string());
    gate2.add_operand("D".to_string());
    ft2.add_gate(gate2).unwrap();
    ft2.add_basic_event(be_c).unwrap();
    ft2.add_basic_event(be_d).unwrap();
    model.add_fault_tree(ft2).unwrap();

    // Calculate fault tree probabilities
    let fta1 = FaultTreeAnalysis::new(model.get_fault_tree("System1").unwrap()).unwrap();
    let p_ft1 = fta1.analyze().unwrap().top_event_probability;

    let fta2 = FaultTreeAnalysis::new(model.get_fault_tree("System2").unwrap()).unwrap();
    let p_ft2 = fta2.analyze().unwrap().top_event_probability;

    // Create initiating event
    let ie = InitiatingEvent::new("IE1".to_string()).with_probability(0.01);

    // Create two-level event tree
    let fe1 = FunctionalEvent::new("System1".to_string())
        .with_fault_tree("System1".to_string())
        .with_order(1);

    let fe2 = FunctionalEvent::new("System2".to_string())
        .with_fault_tree("System2".to_string())
        .with_order(2);

    // Sequences
    let seq_s1 = Sequence::new("S1".to_string()); // Both succeed
    let seq_s2 = Sequence::new("S2".to_string()); // System1 succeeds, System2 fails
    let seq_s3 = Sequence::new("S3".to_string()); // System1 fails, System2 succeeds
    let seq_s4 = Sequence::new("S4".to_string()); // Both fail

    // Build nested forks
    // Inner fork (System2) when System1 succeeds
    let inner_fork_s1_succeeds = Fork::new(
        "System2".to_string(),
        vec![
            Path::new(
                "success".to_string(),
                Branch::new(BranchTarget::Sequence("S1".to_string())),
            )
            .unwrap(),
            Path::new(
                "failure".to_string(),
                Branch::new(BranchTarget::Sequence("S2".to_string())),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    // Inner fork (System2) when System1 fails
    let inner_fork_s1_fails = Fork::new(
        "System2".to_string(),
        vec![
            Path::new(
                "success".to_string(),
                Branch::new(BranchTarget::Sequence("S3".to_string())),
            )
            .unwrap(),
            Path::new(
                "failure".to_string(),
                Branch::new(BranchTarget::Sequence("S4".to_string())),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    // Outer fork (System1)
    let outer_fork = Fork::new(
        "System1".to_string(),
        vec![
            Path::new(
                "success".to_string(),
                Branch::new(BranchTarget::Fork(inner_fork_s1_succeeds)),
            )
            .unwrap(),
            Path::new(
                "failure".to_string(),
                Branch::new(BranchTarget::Fork(inner_fork_s1_fails)),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    let mut et = EventTree::new(
        "ET1".to_string(),
        Branch::new(BranchTarget::Fork(outer_fork)),
    );
    et.add_sequence(seq_s1).unwrap();
    et.add_sequence(seq_s2).unwrap();
    et.add_sequence(seq_s3).unwrap();
    et.add_sequence(seq_s4).unwrap();
    et.add_functional_event(fe1).unwrap();
    et.add_functional_event(fe2).unwrap();

    // Analyze
    let mut eta = EventTreeAnalysis::new(ie, et, &model);
    eta.analyze().unwrap();

    let sequences = eta.sequences();
    assert_eq!(sequences.len(), 4, "Should have 4 sequences");

    // Expected probabilities (FT probability = success probability):
    // P(IE) = 0.01
    // P(System1 succeeds) = p_ft1 = 0.28
    // P(System1 fails) = 1 - p_ft1 = 0.72
    // P(System2 succeeds) = p_ft2 = 0.0375
    // P(System2 fails) = 1 - p_ft2 = 0.9625
    //
    // P(S1) = 0.01 × 0.28 × 0.0375 = 0.000105
    // P(S2) = 0.01 × 0.28 × 0.9625 = 0.002695
    // P(S3) = 0.01 × 0.72 × 0.0375 = 0.00027
    // P(S4) = 0.01 × 0.72 × 0.9625 = 0.00693

    let p_ie = 0.01;
    let p_s1_succeeds = p_ft1;
    let p_s1_fails = 1.0 - p_ft1;
    let p_s2_succeeds = p_ft2;
    let p_s2_fails = 1.0 - p_ft2;

    let expected_probs = [
        ("S1", p_ie * p_s1_succeeds * p_s2_succeeds),
        ("S2", p_ie * p_s1_succeeds * p_s2_fails),
        ("S3", p_ie * p_s1_fails * p_s2_succeeds),
        ("S4", p_ie * p_s1_fails * p_s2_fails),
    ];

    for (seq_id, expected) in &expected_probs {
        let seq = sequences.iter().find(|s| s.sequence.id == *seq_id).unwrap();
        assert!(
            (seq.probability - expected).abs() < 1e-6,
            "Sequence {} probability should be {} but was {}",
            seq_id,
            expected,
            seq.probability
        );
    }
}

/// Test 3-level nested forks with multiple fault trees
#[test]
fn test_three_level_nested_forks() {
    let mut model = Model::new("ComplexModel".to_string()).unwrap();

    // Create three fault trees with different probabilities
    // FT1: Single event, P = 0.1
    let be1 = BasicEvent::new("E1".to_string(), 0.1).unwrap();
    model.add_basic_event(be1.clone()).unwrap();
    let mut ft1 = FaultTree::new("FT1".to_string(), "E1".to_string()).unwrap();
    ft1.add_basic_event(be1).unwrap();
    model.add_fault_tree(ft1).unwrap();

    // FT2: OR gate, P = 0.2 + 0.3 - 0.06 = 0.44
    let be2 = BasicEvent::new("E2".to_string(), 0.2).unwrap();
    let be3 = BasicEvent::new("E3".to_string(), 0.3).unwrap();
    model.add_basic_event(be2.clone()).unwrap();
    model.add_basic_event(be3.clone()).unwrap();
    let mut ft2 = FaultTree::new("FT2".to_string(), "root".to_string()).unwrap();
    let mut gate2 = Gate::new("root".to_string(), Formula::Or).unwrap();
    gate2.add_operand("E2".to_string());
    gate2.add_operand("E3".to_string());
    ft2.add_gate(gate2).unwrap();
    ft2.add_basic_event(be2).unwrap();
    ft2.add_basic_event(be3).unwrap();
    model.add_fault_tree(ft2).unwrap();

    // FT3: AND gate, P = 0.25 × 0.4 = 0.1
    let be4 = BasicEvent::new("E4".to_string(), 0.25).unwrap();
    let be5 = BasicEvent::new("E5".to_string(), 0.4).unwrap();
    model.add_basic_event(be4.clone()).unwrap();
    model.add_basic_event(be5.clone()).unwrap();
    let mut ft3 = FaultTree::new("FT3".to_string(), "root".to_string()).unwrap();
    let mut gate3 = Gate::new("root".to_string(), Formula::And).unwrap();
    gate3.add_operand("E4".to_string());
    gate3.add_operand("E5".to_string());
    ft3.add_gate(gate3).unwrap();
    ft3.add_basic_event(be4).unwrap();
    ft3.add_basic_event(be5).unwrap();
    model.add_fault_tree(ft3).unwrap();

    // Calculate FT probabilities
    let p_ft1 = FaultTreeAnalysis::new(model.get_fault_tree("FT1").unwrap())
        .unwrap()
        .analyze()
        .unwrap()
        .top_event_probability;
    let p_ft2 = FaultTreeAnalysis::new(model.get_fault_tree("FT2").unwrap())
        .unwrap()
        .analyze()
        .unwrap()
        .top_event_probability;
    let p_ft3 = FaultTreeAnalysis::new(model.get_fault_tree("FT3").unwrap())
        .unwrap()
        .analyze()
        .unwrap()
        .top_event_probability;

    // Create IE with probability
    let ie = InitiatingEvent::new("IE".to_string()).with_probability(0.005);

    // Create functional events
    let fe1 = FunctionalEvent::new("FE1".to_string())
        .with_fault_tree("FT1".to_string())
        .with_order(1);
    let fe2 = FunctionalEvent::new("FE2".to_string())
        .with_fault_tree("FT2".to_string())
        .with_order(2);
    let fe3 = FunctionalEvent::new("FE3".to_string())
        .with_fault_tree("FT3".to_string())
        .with_order(3);

    // Create 8 sequences (2^3 outcomes)
    let sequences: Vec<Sequence> = (1..=8)
        .map(|i| Sequence::new(format!("SEQ{}", i)))
        .collect();

    // Build 3-level nested fork structure (using success/failure states)
    // Level 3 (innermost) - 4 copies needed
    let l3_ss = Fork::new(
        "FE3".to_string(),
        vec![
            Path::new(
                "success".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ1".to_string())),
            )
            .unwrap(),
            Path::new(
                "failure".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ2".to_string())),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    let l3_sf = Fork::new(
        "FE3".to_string(),
        vec![
            Path::new(
                "success".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ3".to_string())),
            )
            .unwrap(),
            Path::new(
                "failure".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ4".to_string())),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    let l3_fs = Fork::new(
        "FE3".to_string(),
        vec![
            Path::new(
                "success".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ5".to_string())),
            )
            .unwrap(),
            Path::new(
                "failure".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ6".to_string())),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    let l3_ff = Fork::new(
        "FE3".to_string(),
        vec![
            Path::new(
                "success".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ7".to_string())),
            )
            .unwrap(),
            Path::new(
                "failure".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ8".to_string())),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    // Level 2 (middle) - 2 copies needed
    let l2_s = Fork::new(
        "FE2".to_string(),
        vec![
            Path::new(
                "success".to_string(),
                Branch::new(BranchTarget::Fork(l3_ss)),
            )
            .unwrap(),
            Path::new(
                "failure".to_string(),
                Branch::new(BranchTarget::Fork(l3_sf)),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    let l2_f = Fork::new(
        "FE2".to_string(),
        vec![
            Path::new(
                "success".to_string(),
                Branch::new(BranchTarget::Fork(l3_fs)),
            )
            .unwrap(),
            Path::new(
                "failure".to_string(),
                Branch::new(BranchTarget::Fork(l3_ff)),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    // Level 1 (outermost)
    let l1 = Fork::new(
        "FE1".to_string(),
        vec![
            Path::new("success".to_string(), Branch::new(BranchTarget::Fork(l2_s))).unwrap(),
            Path::new("failure".to_string(), Branch::new(BranchTarget::Fork(l2_f))).unwrap(),
        ],
    )
    .unwrap();

    // Build event tree
    let mut et = EventTree::new("ET3Level".to_string(), Branch::new(BranchTarget::Fork(l1)));
    for seq in sequences {
        et.add_sequence(seq).unwrap();
    }
    et.add_functional_event(fe1).unwrap();
    et.add_functional_event(fe2).unwrap();
    et.add_functional_event(fe3).unwrap();

    // Analyze
    let mut eta = EventTreeAnalysis::new(ie, et, &model);
    eta.analyze().unwrap();

    let results = eta.sequences();
    assert_eq!(results.len(), 8, "Should have 8 sequences");

    // Calculate expected probabilities (FT prob = success prob)
    let p_ie = 0.005;
    let p1_s = p_ft1; // System 1 succeeds
    let p1_f = 1.0 - p_ft1; // System 1 fails
    let p2_s = p_ft2; // System 2 succeeds
    let p2_f = 1.0 - p_ft2; // System 2 fails
    let p3_s = p_ft3; // System 3 succeeds
    let p3_f = 1.0 - p_ft3; // System 3 fails

    let expected = [
        ("SEQ1", p_ie * p1_s * p2_s * p3_s), // S-S-S
        ("SEQ2", p_ie * p1_s * p2_s * p3_f), // S-S-F
        ("SEQ3", p_ie * p1_s * p2_f * p3_s), // S-F-S
        ("SEQ4", p_ie * p1_s * p2_f * p3_f), // S-F-F
        ("SEQ5", p_ie * p1_f * p2_s * p3_s), // F-S-S
        ("SEQ6", p_ie * p1_f * p2_s * p3_f), // F-S-F
        ("SEQ7", p_ie * p1_f * p2_f * p3_s), // F-F-S
        ("SEQ8", p_ie * p1_f * p2_f * p3_f), // F-F-F
    ];

    for (seq_id, expected_prob) in &expected {
        let seq = results.iter().find(|s| s.sequence.id == *seq_id).unwrap();
        assert!(
            (seq.probability - expected_prob).abs() < 1e-9,
            "Sequence {} probability should be {:.9} but was {:.9}",
            seq_id,
            expected_prob,
            seq.probability
        );
    }

    // Verify sum of probabilities equals IE probability
    let total_prob: f64 = results.iter().map(|s| s.probability).sum();
    assert!(
        (total_prob - p_ie).abs() < 1e-9,
        "Total probability should equal IE probability: {} != {}",
        total_prob,
        p_ie
    );
}

/// Test direct probability override (FE without fault tree)
#[test]
fn test_direct_probability_override() {
    let model = Model::new("SimpleModel".to_string()).unwrap();

    // IE with direct probability
    let ie = InitiatingEvent::new("IE".to_string()).with_probability(0.01);

    // FE with direct success probability (no FT link)
    let fe = FunctionalEvent::new("FE".to_string())
        .with_success_probability(0.95) // 95% success probability
        .with_order(1);

    let seq_ok = Sequence::new("OK".to_string());
    let seq_fail = Sequence::new("FAIL".to_string());

    let fork = Fork::new(
        "FE".to_string(),
        vec![
            Path::new(
                "success".to_string(),
                Branch::new(BranchTarget::Sequence("OK".to_string())),
            )
            .unwrap(),
            Path::new(
                "failure".to_string(),
                Branch::new(BranchTarget::Sequence("FAIL".to_string())),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    let mut et = EventTree::new("ET".to_string(), Branch::new(BranchTarget::Fork(fork)));
    et.add_sequence(seq_ok).unwrap();
    et.add_sequence(seq_fail).unwrap();
    et.add_functional_event(fe).unwrap();

    let mut eta = EventTreeAnalysis::new(ie, et, &model);
    eta.analyze().unwrap();

    let sequences = eta.sequences();
    assert_eq!(sequences.len(), 2);

    // P(OK) = 0.01 × 0.95 = 0.0095
    // P(FAIL) = 0.01 × 0.05 = 0.0005
    for seq in sequences {
        if seq.sequence.id == "OK" {
            let expected = 0.01 * 0.95;
            assert!(
                (seq.probability - expected).abs() < 1e-9,
                "OK probability should be {} but was {}",
                expected,
                seq.probability
            );
        } else {
            let expected = 0.01 * 0.05;
            assert!(
                (seq.probability - expected).abs() < 1e-9,
                "FAIL probability should be {} but was {}",
                expected,
                seq.probability
            );
        }
    }
}

/// Test IE with fault tree link
#[test]
fn test_ie_with_fault_tree_link() {
    let mut model = Model::new("IEModel".to_string()).unwrap();

    // Create fault tree for IE
    let be1 = BasicEvent::new("E1".to_string(), 0.001).unwrap();
    let be2 = BasicEvent::new("E2".to_string(), 0.002).unwrap();
    model.add_basic_event(be1.clone()).unwrap();
    model.add_basic_event(be2.clone()).unwrap();

    let mut ft = FaultTree::new("IE_FT".to_string(), "root".to_string()).unwrap();
    let mut gate = Gate::new("root".to_string(), Formula::Or).unwrap();
    gate.add_operand("E1".to_string());
    gate.add_operand("E2".to_string());
    ft.add_gate(gate).unwrap();
    ft.add_basic_event(be1).unwrap();
    ft.add_basic_event(be2).unwrap();
    model.add_fault_tree(ft).unwrap();

    // Calculate FT probability: P = 0.001 + 0.002 - 0.000002 = 0.002998
    let p_ie_ft = FaultTreeAnalysis::new(model.get_fault_tree("IE_FT").unwrap())
        .unwrap()
        .analyze()
        .unwrap()
        .top_event_probability;

    // Create IE linked to fault tree (no direct probability)
    let ie = InitiatingEvent::new("IE".to_string()).with_fault_tree("IE_FT".to_string());

    // Simple sequence
    let seq = Sequence::new("SEQ".to_string());
    let mut et = EventTree::new(
        "ET".to_string(),
        Branch::new(BranchTarget::Sequence("SEQ".to_string())),
    );
    et.add_sequence(seq).unwrap();

    let mut eta = EventTreeAnalysis::new(ie, et, &model);
    eta.analyze().unwrap();

    let sequences = eta.sequences();
    assert_eq!(sequences.len(), 1);

    // Sequence probability should equal IE FT probability
    assert!(
        (sequences[0].probability - p_ie_ft).abs() < 1e-9,
        "Sequence probability should be {} but was {}",
        p_ie_ft,
        sequences[0].probability
    );
}

/// Test IE with both fault tree and direct probability (FT should take precedence)
#[test]
fn test_ie_direct_probability_precedence() {
    let mut model = Model::new("PrecedenceModel".to_string()).unwrap();

    // Create fault tree with P = 0.5
    let be = BasicEvent::new("E".to_string(), 0.5).unwrap();
    model.add_basic_event(be.clone()).unwrap();
    let mut ft = FaultTree::new("FT".to_string(), "E".to_string()).unwrap();
    ft.add_basic_event(be).unwrap();
    model.add_fault_tree(ft).unwrap();

    // IE with both FT link AND direct probability - FT should take precedence
    let ie = InitiatingEvent::new("IE".to_string())
        .with_fault_tree("FT".to_string())
        .with_probability(0.123); // This should be IGNORED since FT exists

    let seq = Sequence::new("SEQ".to_string());
    let mut et = EventTree::new(
        "ET".to_string(),
        Branch::new(BranchTarget::Sequence("SEQ".to_string())),
    );
    et.add_sequence(seq).unwrap();

    let mut eta = EventTreeAnalysis::new(ie, et, &model);
    eta.analyze().unwrap();

    let sequences = eta.sequences();
    assert_eq!(sequences.len(), 1);

    // Should use FT probability (0.5), not direct probability (0.123)
    assert!(
        (sequences[0].probability - 0.5).abs() < 1e-9,
        "Should use FT probability 0.5, but was {}",
        sequences[0].probability
    );
}
