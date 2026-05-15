// Integration tests for Event Tree Analysis
// Tests the complete workflow from initiating event to sequence collection

use praxis::analysis::event_tree::EventTreeAnalysis;
use praxis::core::event_tree::*;
use praxis::core::model::Model;

#[test]
fn test_simple_loca_event_tree() {
    // Simulate a simplified Loss of Coolant Accident (LOCA) event tree
    let ie = InitiatingEvent::new("IE-LOCA".to_string())
        .with_name("Loss of Coolant Accident".to_string());

    // Define sequences (outcomes)
    let seq_safe = Sequence::new("SEQ-SAFE".to_string()).with_name("Safe Shutdown".to_string());
    let seq_core_damage = Sequence::new("SEQ-CD".to_string()).with_name("Core Damage".to_string());

    // Define functional event (Emergency Core Cooling System)
    let fe_eccs = FunctionalEvent::new("FE-ECCS".to_string())
        .with_name("Emergency Core Cooling System".to_string())
        .with_order(1);

    // Create fork paths for ECCS
    let eccs_success = Path::new(
        "success".to_string(),
        Branch::new(BranchTarget::Sequence("SEQ-SAFE".to_string())),
    )
    .unwrap();

    let eccs_failure = Path::new(
        "failure".to_string(),
        Branch::new(BranchTarget::Sequence("SEQ-CD".to_string())),
    )
    .unwrap();

    let eccs_fork = Fork::new("FE-ECCS".to_string(), vec![eccs_success, eccs_failure]).unwrap();

    // Build event tree
    let initial = Branch::new(BranchTarget::Fork(eccs_fork));
    let mut et =
        EventTree::new("ET-LOCA".to_string(), initial).with_name("LOCA Event Tree".to_string());

    et.add_sequence(seq_safe).unwrap();
    et.add_sequence(seq_core_damage).unwrap();
    et.add_functional_event(fe_eccs).unwrap();

    // Perform analysis
    let model = Model::new("TestModel".to_string()).unwrap();
    let mut eta = EventTreeAnalysis::new(ie, et, &model);
    eta.analyze().expect("Analysis should succeed");

    // Verify results
    let sequences = eta.sequences();
    assert_eq!(sequences.len(), 2, "Should have 2 sequences");

    // Check that we have both outcomes
    let seq_ids: Vec<&str> = sequences.iter().map(|s| s.sequence.id.as_str()).collect();
    assert!(seq_ids.contains(&"SEQ-SAFE"));
    assert!(seq_ids.contains(&"SEQ-CD"));

    // Verify paths contain the ECCS functional event
    for seq_result in sequences {
        assert_eq!(seq_result.path.len(), 1);
        assert_eq!(seq_result.path[0].0, "FE-ECCS");
        assert!(seq_result.path[0].1 == "success" || seq_result.path[0].1 == "failure");
    }
}

#[test]
fn test_complex_event_tree_with_multiple_systems() {
    // More complex event tree with multiple safety systems
    let ie =
        InitiatingEvent::new("IE-LOSP".to_string()).with_name("Loss of Offsite Power".to_string());

    // Define 4 sequences
    let seq_ok = Sequence::new("SEQ-OK".to_string());
    let seq_sbo = Sequence::new("SEQ-SBO".to_string()); // Station Blackout
    let seq_cd1 = Sequence::new("SEQ-CD1".to_string());
    let seq_cd2 = Sequence::new("SEQ-CD2".to_string());

    // Define functional events
    let fe_edg = FunctionalEvent::new("FE-EDG".to_string())
        .with_name("Emergency Diesel Generators".to_string())
        .with_order(1);
    let fe_cooling = FunctionalEvent::new("FE-COOLING".to_string())
        .with_name("Cooling Systems".to_string())
        .with_order(2);

    // Create second-level forks (cooling system)
    let cooling_fork_edg_ok = Fork::new(
        "FE-COOLING".to_string(),
        vec![
            Path::new(
                "success".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ-OK".to_string())),
            )
            .unwrap(),
            Path::new(
                "failure".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ-CD1".to_string())),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    let cooling_fork_edg_fail = Fork::new(
        "FE-COOLING".to_string(),
        vec![
            Path::new(
                "success".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ-SBO".to_string())),
            )
            .unwrap(),
            Path::new(
                "failure".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ-CD2".to_string())),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    // Create first-level fork (EDG)
    let edg_fork = Fork::new(
        "FE-EDG".to_string(),
        vec![
            Path::new(
                "success".to_string(),
                Branch::new(BranchTarget::Fork(cooling_fork_edg_ok)),
            )
            .unwrap(),
            Path::new(
                "failure".to_string(),
                Branch::new(BranchTarget::Fork(cooling_fork_edg_fail)),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    // Build event tree
    let initial = Branch::new(BranchTarget::Fork(edg_fork));
    let mut et = EventTree::new("ET-LOSP".to_string(), initial);

    et.add_sequence(seq_ok).unwrap();
    et.add_sequence(seq_sbo).unwrap();
    et.add_sequence(seq_cd1).unwrap();
    et.add_sequence(seq_cd2).unwrap();
    et.add_functional_event(fe_edg).unwrap();
    et.add_functional_event(fe_cooling).unwrap();

    // Perform analysis
    let model = Model::new("TestModel".to_string()).unwrap();
    let mut eta = EventTreeAnalysis::new(ie, et, &model);
    eta.analyze().expect("Analysis should succeed");

    // Verify results
    let sequences = eta.sequences();
    assert_eq!(sequences.len(), 4, "Should have 4 sequences (2^2)");

    // All sequences should have 2-element paths
    for seq_result in sequences {
        assert_eq!(
            seq_result.path.len(),
            2,
            "Each path should go through 2 functional events"
        );
        assert_eq!(seq_result.path[0].0, "FE-EDG");
        assert_eq!(seq_result.path[1].0, "FE-COOLING");
    }

    // Verify all 4 sequences were found
    let seq_ids: Vec<&str> = sequences.iter().map(|s| s.sequence.id.as_str()).collect();
    assert!(seq_ids.contains(&"SEQ-OK"));
    assert!(seq_ids.contains(&"SEQ-SBO"));
    assert!(seq_ids.contains(&"SEQ-CD1"));
    assert!(seq_ids.contains(&"SEQ-CD2"));
}

#[test]
fn test_event_tree_with_named_branches() {
    // Test named branch reuse
    let ie = InitiatingEvent::new("IE-1".to_string());

    let seq_a = Sequence::new("SEQ-A".to_string());
    let seq_b = Sequence::new("SEQ-B".to_string());

    // Create a reusable named branch
    let common_branch = NamedBranch::new(
        "COMMON-PATH".to_string(),
        Branch::new(BranchTarget::Sequence("SEQ-A".to_string())),
    );

    let fe = FunctionalEvent::new("FE-1".to_string());

    // Fork where one path goes to named branch, other to different sequence
    let fork = Fork::new(
        "FE-1".to_string(),
        vec![
            Path::new(
                "path1".to_string(),
                Branch::new(BranchTarget::NamedBranch("COMMON-PATH".to_string())),
            )
            .unwrap(),
            Path::new(
                "path2".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ-B".to_string())),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    let initial = Branch::new(BranchTarget::Fork(fork));
    let mut et = EventTree::new("ET-1".to_string(), initial);

    et.add_sequence(seq_a).unwrap();
    et.add_sequence(seq_b).unwrap();
    et.add_functional_event(fe).unwrap();
    et.add_named_branch(common_branch).unwrap();

    let model = Model::new("TestModel".to_string()).unwrap();
    let mut eta = EventTreeAnalysis::new(ie, et, &model);
    eta.analyze().expect("Analysis should succeed");

    let sequences = eta.sequences();
    assert_eq!(sequences.len(), 2);

    // Verify both sequences were reached
    let seq_ids: Vec<&str> = sequences.iter().map(|s| s.sequence.id.as_str()).collect();
    assert!(seq_ids.contains(&"SEQ-A"));
    assert!(seq_ids.contains(&"SEQ-B"));
}

// Additional tests based on XML scenarios from mcSCRAM/input/EventTrees/

#[test]
fn test_attack_tree_three_level_security() {
    // Based on attack.xml: 3-level security system
    // L1 (access denied) -> L2 (attack detected) -> L3 (attack interdicted)
    // Attack succeeds only if all 3 levels fail

    let ie = InitiatingEvent::new("IE-Attack".to_string()).with_name("Security Attack".to_string());

    let seq_success = Sequence::new("SEQ-AttackSucceeds".to_string());
    let seq_fail = Sequence::new("SEQ-AttackFails".to_string());

    let fe_l1 = FunctionalEvent::new("FE-L1".to_string())
        .with_name("Access Denied".to_string())
        .with_order(1);
    let fe_l2 = FunctionalEvent::new("FE-L2".to_string())
        .with_name("Attack Detected".to_string())
        .with_order(2);
    let fe_l3 = FunctionalEvent::new("FE-L3".to_string())
        .with_name("Attack Interdicted".to_string())
        .with_order(3);

    // Level 3 fork (innermost)
    let l3_fork = Fork::new(
        "FE-L3".to_string(),
        vec![
            Path::new(
                "yes".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ-AttackFails".to_string())),
            )
            .unwrap(),
            Path::new(
                "no".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ-AttackSucceeds".to_string())),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    // Level 2 fork
    let l2_fork = Fork::new(
        "FE-L2".to_string(),
        vec![
            Path::new("yes".to_string(), Branch::new(BranchTarget::Fork(l3_fork))).unwrap(),
            Path::new(
                "no".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ-AttackSucceeds".to_string())),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    // Level 1 fork (outermost)
    let l1_fork = Fork::new(
        "FE-L1".to_string(),
        vec![
            Path::new(
                "yes".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ-AttackFails".to_string())),
            )
            .unwrap(),
            Path::new("no".to_string(), Branch::new(BranchTarget::Fork(l2_fork))).unwrap(),
        ],
    )
    .unwrap();

    let initial = Branch::new(BranchTarget::Fork(l1_fork));
    let mut et = EventTree::new("ET-Attack".to_string(), initial);

    et.add_sequence(seq_success).unwrap();
    et.add_sequence(seq_fail).unwrap();
    et.add_functional_event(fe_l1).unwrap();
    et.add_functional_event(fe_l2).unwrap();
    et.add_functional_event(fe_l3).unwrap();

    let model = Model::new("TestModel".to_string()).unwrap();
    let mut eta = EventTreeAnalysis::new(ie, et, &model);
    eta.analyze().expect("Analysis should succeed");

    let sequences = eta.sequences();
    // Should have 4 terminal sequences:
    // 1. L1=yes -> AttackFails
    // 2. L1=no, L2=yes, L3=yes -> AttackFails
    // 3. L1=no, L2=yes, L3=no -> AttackSucceeds
    // 4. L1=no, L2=no -> AttackSucceeds
    assert_eq!(sequences.len(), 4, "Should have 4 possible paths");

    // Count outcomes
    let success_count = sequences
        .iter()
        .filter(|s| s.sequence.id == "SEQ-AttackSucceeds")
        .count();
    let fail_count = sequences
        .iter()
        .filter(|s| s.sequence.id == "SEQ-AttackFails")
        .count();

    assert_eq!(success_count, 2, "Attack succeeds in 2 scenarios");
    assert_eq!(fail_count, 2, "Attack fails in 2 scenarios");
}

#[test]
fn test_bcd_tree_with_named_branch_reuse() {
    // Based on bcd.xml: Named branch reuse pattern
    // B -> C -> D (both success and failure paths of C reuse same "D-if-B" branch)

    let ie = InitiatingEvent::new("IE-I".to_string());

    let seq_success = Sequence::new("SEQ-Success".to_string());
    let seq_failure = Sequence::new("SEQ-Failure".to_string());

    let fe_b = FunctionalEvent::new("FE-B".to_string()).with_order(1);
    let fe_c = FunctionalEvent::new("FE-C".to_string()).with_order(2);
    let fe_d = FunctionalEvent::new("FE-D".to_string()).with_order(3);

    // Create reusable named branch "D-if-B"
    let d_fork = Fork::new(
        "FE-D".to_string(),
        vec![
            Path::new(
                "success".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ-Success".to_string())),
            )
            .unwrap(),
            Path::new(
                "failure".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ-Failure".to_string())),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    let named_branch = NamedBranch::new(
        "D-if-B".to_string(),
        Branch::new(BranchTarget::Fork(d_fork)),
    );

    // C fork where both paths lead to the same named branch
    let c_fork = Fork::new(
        "FE-C".to_string(),
        vec![
            Path::new(
                "success".to_string(),
                Branch::new(BranchTarget::NamedBranch("D-if-B".to_string())),
            )
            .unwrap(),
            Path::new(
                "failure".to_string(),
                Branch::new(BranchTarget::NamedBranch("D-if-B".to_string())),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    // Create another D fork for B failure path (direct to D)
    let d_fork_b_fail = Fork::new(
        "FE-D".to_string(),
        vec![
            Path::new(
                "success".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ-Success".to_string())),
            )
            .unwrap(),
            Path::new(
                "failure".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ-Failure".to_string())),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    // B fork
    let b_fork = Fork::new(
        "FE-B".to_string(),
        vec![
            Path::new(
                "success".to_string(),
                Branch::new(BranchTarget::Fork(c_fork)),
            )
            .unwrap(),
            Path::new(
                "failure".to_string(),
                Branch::new(BranchTarget::Fork(d_fork_b_fail)),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    let initial = Branch::new(BranchTarget::Fork(b_fork));
    let mut et = EventTree::new("ET-BCD".to_string(), initial);

    et.add_sequence(seq_success).unwrap();
    et.add_sequence(seq_failure).unwrap();
    et.add_functional_event(fe_b).unwrap();
    et.add_functional_event(fe_c).unwrap();
    et.add_functional_event(fe_d).unwrap();
    et.add_named_branch(named_branch).unwrap();

    let model = Model::new("TestModel".to_string()).unwrap();
    let mut eta = EventTreeAnalysis::new(ie, et, &model);
    eta.analyze().expect("Analysis should succeed");

    let sequences = eta.sequences();
    // Should have 6 paths:
    // B=success, C=success, D=success -> Success
    // B=success, C=success, D=failure -> Failure
    // B=success, C=failure, D=success -> Success
    // B=success, C=failure, D=failure -> Failure
    // B=failure, D=success -> Success
    // B=failure, D=failure -> Failure
    assert_eq!(sequences.len(), 6, "Should have 6 possible paths");

    // Verify both outcomes are reachable
    let seq_ids: Vec<&str> = sequences.iter().map(|s| s.sequence.id.as_str()).collect();
    assert!(seq_ids.contains(&"SEQ-Success"));
    assert!(seq_ids.contains(&"SEQ-Failure"));
}

#[test]
fn test_mef_example_bypass_state() {
    // Based on mef_example.xml: Event tree with bypass state
    // F -> G -> H with bypass state in H

    let ie = InitiatingEvent::new("IE-1".to_string());

    let seq_s1 = Sequence::new("SEQ-S1".to_string());
    let seq_s2 = Sequence::new("SEQ-S2".to_string());
    let seq_s5 = Sequence::new("SEQ-S5".to_string());
    let seq_s6 = Sequence::new("SEQ-S6".to_string());

    let fe_f = FunctionalEvent::new("FE-F".to_string()).with_order(1);
    let fe_g = FunctionalEvent::new("FE-G".to_string()).with_order(2);
    let fe_h = FunctionalEvent::new("FE-H".to_string()).with_order(3);

    // H fork with bypass state (for G failure path)
    let h_fork_bypass = Fork::new(
        "FE-H".to_string(),
        vec![
            Path::new(
                "bypass".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ-S5".to_string())),
            )
            .unwrap(),
            Path::new(
                "failure".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ-S6".to_string())),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    // H fork (regular success/failure for sub-tree7)
    let h_fork_regular = Fork::new(
        "FE-H".to_string(),
        vec![
            Path::new(
                "success".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ-S1".to_string())),
            )
            .unwrap(),
            Path::new(
                "failure".to_string(),
                Branch::new(BranchTarget::Sequence("SEQ-S2".to_string())),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    // Named branch for sub-tree7
    let sub_tree7 = NamedBranch::new(
        "sub-tree7".to_string(),
        Branch::new(BranchTarget::Fork(h_fork_regular)),
    );

    // G fork
    let g_fork = Fork::new(
        "FE-G".to_string(),
        vec![
            Path::new(
                "success".to_string(),
                Branch::new(BranchTarget::NamedBranch("sub-tree7".to_string())),
            )
            .unwrap(),
            Path::new(
                "failure".to_string(),
                Branch::new(BranchTarget::Fork(h_fork_bypass)),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    // F fork
    let f_fork = Fork::new(
        "FE-F".to_string(),
        vec![
            Path::new(
                "success".to_string(),
                Branch::new(BranchTarget::NamedBranch("sub-tree7".to_string())),
            )
            .unwrap(),
            Path::new(
                "failure".to_string(),
                Branch::new(BranchTarget::Fork(g_fork)),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    let initial = Branch::new(BranchTarget::Fork(f_fork));
    let mut et = EventTree::new("ET-MEF".to_string(), initial);

    et.add_sequence(seq_s1).unwrap();
    et.add_sequence(seq_s2).unwrap();
    et.add_sequence(seq_s5).unwrap();
    et.add_sequence(seq_s6).unwrap();
    et.add_functional_event(fe_f).unwrap();
    et.add_functional_event(fe_g).unwrap();
    et.add_functional_event(fe_h).unwrap();
    et.add_named_branch(sub_tree7).unwrap();

    let model = Model::new("TestModel".to_string()).unwrap();
    let mut eta = EventTreeAnalysis::new(ie, et, &model);
    eta.analyze().expect("Analysis should succeed");

    let sequences = eta.sequences();
    // Should have 6 paths:
    // F=success, H=success -> S1
    // F=success, H=failure -> S2
    // F=failure, G=success, H=success -> S1
    // F=failure, G=success, H=failure -> S2
    // F=failure, G=failure, H=bypass -> S5
    // F=failure, G=failure, H=failure -> S6
    assert_eq!(sequences.len(), 6, "Should have 6 possible paths");

    // Verify all 4 sequences are reachable
    let seq_ids: Vec<&str> = sequences.iter().map(|s| s.sequence.id.as_str()).collect();
    assert!(seq_ids.contains(&"SEQ-S1"));
    assert!(seq_ids.contains(&"SEQ-S2"));
    assert!(seq_ids.contains(&"SEQ-S5"));
    assert!(seq_ids.contains(&"SEQ-S6"));

    // Verify bypass state exists
    let has_bypass = sequences
        .iter()
        .any(|s| s.path.iter().any(|(_, state)| state == "bypass"));
    assert!(
        has_bypass,
        "Should have at least one path with bypass state"
    );
}

#[test]
fn test_gas_leak_simple_detection() {
    // Based on gas_leak.xml: Simple gas detection event tree
    // Gas-detection -> (Working: Link-to-reactive, Failed: S9)

    let ie = InitiatingEvent::new("IE-GasLeak".to_string()).with_name("Gas Leak".to_string());

    let seq_s9 = Sequence::new("SEQ-S9".to_string());
    let seq_reactive = Sequence::new("SEQ-Link-to-reactive".to_string())
        .with_name("Link to Reactive Event Tree".to_string());

    let fe_detection = FunctionalEvent::new("FE-Gas-detection".to_string())
        .with_name("Gas Detection System".to_string())
        .with_order(1);

    // Simple fork: Working (W) or Failed (F)
    let detection_fork = Fork::new(
        "FE-Gas-detection".to_string(),
        vec![
            Path::new(
                "W".to_string(), // Working
                Branch::new(BranchTarget::Sequence("SEQ-Link-to-reactive".to_string())),
            )
            .unwrap(),
            Path::new(
                "F".to_string(), // Failed
                Branch::new(BranchTarget::Sequence("SEQ-S9".to_string())),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    let initial = Branch::new(BranchTarget::Fork(detection_fork));
    let mut et = EventTree::new("ET-GasLeak".to_string(), initial);

    et.add_sequence(seq_s9).unwrap();
    et.add_sequence(seq_reactive).unwrap();
    et.add_functional_event(fe_detection).unwrap();

    let model = Model::new("TestModel".to_string()).unwrap();
    let mut eta = EventTreeAnalysis::new(ie, et, &model);
    eta.analyze().expect("Analysis should succeed");

    let sequences = eta.sequences();
    assert_eq!(sequences.len(), 2, "Should have 2 possible paths");

    // Verify both sequences are reachable
    let seq_ids: Vec<&str> = sequences.iter().map(|s| s.sequence.id.as_str()).collect();
    assert!(seq_ids.contains(&"SEQ-S9"));
    assert!(seq_ids.contains(&"SEQ-Link-to-reactive"));

    // Verify custom state names (W, F instead of success, failure)
    let states: Vec<&str> = sequences
        .iter()
        .flat_map(|s| s.path.iter().map(|(_, state)| state.as_str()))
        .collect();
    assert!(states.contains(&"W"));
    assert!(states.contains(&"F"));
}

#[test]
fn test_complex_branching_all_combinations() {
    // Stress test: 3 functional events with 2 states each = 2^3 = 8 paths
    let ie = InitiatingEvent::new("IE-Complex".to_string());

    // 8 terminal sequences
    let seqs: Vec<Sequence> = (0..8)
        .map(|i| Sequence::new(format!("SEQ-{}", i)))
        .collect();

    let fe1 = FunctionalEvent::new("FE-1".to_string()).with_order(1);
    let fe2 = FunctionalEvent::new("FE-2".to_string()).with_order(2);
    let fe3 = FunctionalEvent::new("FE-3".to_string()).with_order(3);

    // Build 8 terminal forks (level 3)
    let create_fork3 = |s0: usize, s1: usize| {
        Fork::new(
            "FE-3".to_string(),
            vec![
                Path::new(
                    "A".to_string(),
                    Branch::new(BranchTarget::Sequence(format!("SEQ-{}", s0))),
                )
                .unwrap(),
                Path::new(
                    "B".to_string(),
                    Branch::new(BranchTarget::Sequence(format!("SEQ-{}", s1))),
                )
                .unwrap(),
            ],
        )
        .unwrap()
    };

    // Build 4 level-2 forks
    let fork2_0 = Fork::new(
        "FE-2".to_string(),
        vec![
            Path::new(
                "A".to_string(),
                Branch::new(BranchTarget::Fork(create_fork3(0, 1))),
            )
            .unwrap(),
            Path::new(
                "B".to_string(),
                Branch::new(BranchTarget::Fork(create_fork3(2, 3))),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    let fork2_1 = Fork::new(
        "FE-2".to_string(),
        vec![
            Path::new(
                "A".to_string(),
                Branch::new(BranchTarget::Fork(create_fork3(4, 5))),
            )
            .unwrap(),
            Path::new(
                "B".to_string(),
                Branch::new(BranchTarget::Fork(create_fork3(6, 7))),
            )
            .unwrap(),
        ],
    )
    .unwrap();

    // Build level-1 fork
    let fork1 = Fork::new(
        "FE-1".to_string(),
        vec![
            Path::new("A".to_string(), Branch::new(BranchTarget::Fork(fork2_0))).unwrap(),
            Path::new("B".to_string(), Branch::new(BranchTarget::Fork(fork2_1))).unwrap(),
        ],
    )
    .unwrap();

    let initial = Branch::new(BranchTarget::Fork(fork1));
    let mut et = EventTree::new("ET-Complex".to_string(), initial);

    for seq in seqs {
        et.add_sequence(seq).unwrap();
    }
    et.add_functional_event(fe1).unwrap();
    et.add_functional_event(fe2).unwrap();
    et.add_functional_event(fe3).unwrap();

    let model = Model::new("TestModel".to_string()).unwrap();
    let mut eta = EventTreeAnalysis::new(ie, et, &model);
    eta.analyze().expect("Analysis should succeed");

    let sequences = eta.sequences();
    assert_eq!(sequences.len(), 8, "Should have 8 paths (2^3)");

    // Verify all paths have 3 functional events
    for result in sequences.iter() {
        assert_eq!(
            result.path.len(),
            3,
            "Each path should traverse 3 functional events"
        );
    }

    // Verify all 8 sequences are reached
    let mut seq_ids: Vec<&str> = sequences.iter().map(|s| s.sequence.id.as_str()).collect();
    seq_ids.sort();
    assert_eq!(seq_ids.len(), 8);
    for i in 0..8 {
        let expected = format!("SEQ-{}", i);
        assert!(
            seq_ids.contains(&expected.as_str()),
            "Missing sequence: {}",
            expected
        );
    }
}
