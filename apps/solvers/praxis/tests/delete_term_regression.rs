use std::collections::{BTreeSet, HashMap};

use praxis::algorithms::direct_zbdd::build_sequence_zbdd_from_pdag;
use praxis::algorithms::pdag::{Connective, NodeIndex, Pdag};
use praxis::analysis::sequence_formula::{SequenceFormulaBuilder, SequenceFormulas};
use praxis::core::event_tree::EventTree;
use praxis::io::event_tree_parser::parse_event_tree_model_full;

type Term = BTreeSet<String>;
type Family = Vec<Term>;

fn family(terms: &[&str]) -> Family {
    terms
        .iter()
        .map(|term| term.split_whitespace().map(str::to_string).collect())
        .collect()
}

fn normalize(input: Family) -> Family {
    let mut terms: Vec<Term> = input.into_iter().collect();
    terms.sort_by(|left, right| {
        left.len()
            .cmp(&right.len())
            .then_with(|| left.iter().cmp(right.iter()))
    });

    let mut minimal: Family = Vec::new();
    for candidate in terms {
        if !minimal.iter().any(|term| term.is_subset(&candidate)) {
            minimal.push(candidate);
        }
    }
    minimal.sort_by(|left, right| left.iter().cmp(right.iter()));
    minimal
}

/// Independent set-family oracle for a sequence with failed systems F_i and
/// succeeded systems S_j:
///
///     minimize(AND_i F_i) \\ { C | some cut set of S_j is a subset of C }
///
/// This deliberately does not use a BDD or ZBDD operation.
fn delete_term_oracle(failures: &[Family], successes: &[Family]) -> Family {
    let mut positive = family(&[""]);
    for failure in failures {
        let mut product = Vec::new();
        for left in &positive {
            for right in failure {
                product.push(left.union(right).cloned().collect());
            }
        }
        positive = normalize(product);
    }

    let delete_sets: Family = successes
        .iter()
        .flat_map(|success| normalize(success.clone()))
        .collect();
    normalize(
        positive
            .into_iter()
            .filter(|candidate| !delete_sets.iter().any(|delete| delete.is_subset(candidate)))
            .collect(),
    )
}

fn add_dnf(pdag: &mut Pdag, id: &str, dnf: &Family) -> NodeIndex {
    if dnf.is_empty() {
        return pdag.add_constant(false);
    }

    let mut products = Vec::new();
    for (index, term) in dnf.iter().enumerate() {
        let events: Vec<NodeIndex> = term
            .iter()
            .map(|name| pdag.add_basic_event(name.clone()))
            .collect();
        let product = match events.as_slice() {
            [] => pdag.add_constant(true),
            [event] => *event,
            _ => pdag
                .add_gate(
                    format!("{id}__PRODUCT_{index}"),
                    Connective::And,
                    events,
                    None,
                )
                .unwrap(),
        };
        products.push(product);
    }

    match products.as_slice() {
        [product] => *product,
        _ => pdag
            .add_gate(id.to_string(), Connective::Or, products, None)
            .unwrap(),
    }
}

fn praxis_result(
    failures: &[Family],
    successes: &[Family],
    probabilities: &HashMap<String, f64>,
    cut_off: Option<f64>,
    order_limit: Option<usize>,
    ie_frequency: f64,
) -> Family {
    let mut pdag = Pdag::new();
    let failure_roots: Vec<NodeIndex> = failures
        .iter()
        .enumerate()
        .map(|(index, dnf)| add_dnf(&mut pdag, &format!("FAILURE_{index}"), dnf))
        .collect();
    let sequence_root = match failure_roots.as_slice() {
        [] => pdag.add_constant(true),
        [root] => *root,
        _ => pdag
            .add_gate(
                "SEQUENCE_FAILURES".to_string(),
                Connective::And,
                failure_roots,
                None,
            )
            .unwrap(),
    };
    pdag.set_root(sequence_root).unwrap();
    let success_roots: Vec<NodeIndex> = successes
        .iter()
        .enumerate()
        .map(|(index, dnf)| add_dnf(&mut pdag, &format!("SUCCESS_{index}"), dnf))
        .collect();

    let (zbdd, root, names) = build_sequence_zbdd_from_pdag(
        &pdag,
        probabilities,
        sequence_root,
        &success_roots,
        cut_off,
        order_limit,
        ie_frequency,
    )
    .unwrap();

    normalize(
        zbdd.enumerate(root)
            .into_iter()
            .map(|set| {
                set.into_iter()
                    .map(|variable| {
                        names[variable]
                            .clone()
                            .unwrap_or_else(|| panic!("variable {variable} has no event name"))
                    })
                    .collect()
            })
            .collect(),
    )
}

fn all_probabilities(failures: &[Family], successes: &[Family]) -> HashMap<String, f64> {
    failures
        .iter()
        .chain(successes)
        .flatten()
        .flatten()
        .map(|event| (event.clone(), 0.1))
        .collect()
}

#[test]
fn easy_to_complex_cases_match_independent_oracle() {
    struct Case {
        name: &'static str,
        failures: Vec<Family>,
        successes: Vec<Family>,
        expected: Family,
    }

    let cases = vec![
        Case {
            name: "single OR failure",
            failures: vec![family(&["A", "B"])],
            successes: vec![],
            expected: family(&["A", "B"]),
        },
        Case {
            name: "AND cross product",
            failures: vec![family(&["A", "B"]), family(&["C", "D"])],
            successes: vec![],
            expected: family(&["A C", "A D", "B C", "B D"]),
        },
        Case {
            name: "partial overlap deletion",
            failures: vec![family(&["A", "B C"])],
            successes: vec![family(&["B"])],
            expected: family(&["A"]),
        },
        Case {
            name: "exact cut-set deletion",
            failures: vec![family(&["A B", "C D"])],
            successes: vec![family(&["A B"])],
            expected: family(&["C D"]),
        },
        Case {
            name: "success singleton deletes every containing set",
            failures: vec![family(&["A B", "A C", "D E"])],
            successes: vec![family(&["A"])],
            expected: family(&["D E"]),
        },
        Case {
            name: "disjoint success has no effect",
            failures: vec![family(&["A B", "C D"])],
            successes: vec![family(&["E"])],
            expected: family(&["A B", "C D"]),
        },
        Case {
            name: "multiple failures and multiple successes",
            failures: vec![family(&["A", "B"]), family(&["C", "D"])],
            successes: vec![family(&["A"]), family(&["D"])],
            expected: family(&["B C"]),
        },
        Case {
            name: "shared event absorption",
            failures: vec![family(&["X", "A"]), family(&["X", "B"])],
            successes: vec![],
            expected: family(&["X", "A B"]),
        },
        Case {
            name: "all candidates deleted",
            failures: vec![family(&["A B", "A C"])],
            successes: vec![family(&["A"])],
            expected: family(&[]),
        },
        Case {
            name: "duplicates and nonminimal products absorbed",
            failures: vec![family(&["A", "A", "A B", "A B C"])],
            successes: vec![],
            expected: family(&["A"]),
        },
        Case {
            name: "two-out-of-three expansion with a success state",
            failures: vec![family(&["A B", "A C", "B C"])],
            successes: vec![family(&["A B"])],
            expected: family(&["A C", "B C"]),
        },
    ];

    for case in cases {
        let oracle = delete_term_oracle(&case.failures, &case.successes);
        assert_eq!(oracle, normalize(case.expected), "oracle: {}", case.name);
        let probabilities = all_probabilities(&case.failures, &case.successes);
        let actual = praxis_result(
            &case.failures,
            &case.successes,
            &probabilities,
            None,
            None,
            1.0,
        );
        assert_eq!(actual, oracle, "PRAXIS: {}", case.name);
    }
}

#[test]
fn native_atleast_gate_is_deleted_by_subset_semantics() {
    let mut pdag = Pdag::new();
    let a = pdag.add_basic_event("A".to_string());
    let b = pdag.add_basic_event("B".to_string());
    let c = pdag.add_basic_event("C".to_string());
    let sequence_root = pdag
        .add_gate(
            "TWO-OF-THREE".to_string(),
            Connective::AtLeast,
            vec![a, b, c],
            Some(2),
        )
        .unwrap();
    let success_root = pdag
        .add_gate("SUCCESS-AB".to_string(), Connective::And, vec![a, b], None)
        .unwrap();
    pdag.set_root(sequence_root).unwrap();

    let probabilities = HashMap::from([
        ("A".to_string(), 0.1),
        ("B".to_string(), 0.1),
        ("C".to_string(), 0.1),
    ]);
    let (zbdd, root, names) = build_sequence_zbdd_from_pdag(
        &pdag,
        &probabilities,
        sequence_root,
        &[success_root],
        None,
        None,
        1.0,
    )
    .unwrap();
    let actual = normalize(
        zbdd.enumerate(root)
            .into_iter()
            .map(|set| {
                set.into_iter()
                    .map(|variable| names[variable].clone().unwrap())
                    .collect()
            })
            .collect(),
    );

    assert_eq!(actual, family(&["A C", "B C"]));
}

#[test]
fn saphire_success_mask_sets_absent_complemented_events_false() {
    let mut pdag = Pdag::new();
    let a = pdag.add_basic_event("A".to_string());
    let x = pdag.add_basic_event("X".to_string());
    let not_x = pdag
        .add_gate("NOT-X".to_string(), Connective::Not, vec![x], None)
        .unwrap();
    let success = pdag
        .add_gate("SUCCESS".to_string(), Connective::And, vec![a, not_x], None)
        .unwrap();
    pdag.set_root(a).unwrap();

    let probabilities = HashMap::from([("A".to_string(), 0.1), ("X".to_string(), 0.5)]);
    let (zbdd, root, _) =
        build_sequence_zbdd_from_pdag(&pdag, &probabilities, a, &[success], None, None, 1.0)
            .unwrap();

    // The failed-system family contains only A, so SAPHIRE masks X to FALSE.
    // SUCCESS becomes A AND TRUE and therefore deletes the failed cut set A.
    assert!(zbdd.enumerate(root).is_empty());
}

fn shared_multi_state_case() -> (Vec<Family>, Vec<Family>, Family, Family) {
    let rail = [
        "X U1", "X U2", "X U3", "X U4", "X U5", "X U6", "X U7", "X U8",
    ];
    let mut f1 = family(&rail);
    f1.extend(family(&["A B", "C D"]));
    let mut f2 = family(&rail);
    f2.extend(family(&["A C", "B D"]));
    let mut f3 = family(&rail);
    f3.extend(family(&["A D", "B C"]));

    let all_u = "U1 U2 U3 U4 U5 U6 U7 U8";
    let successes = vec![
        family(&["A B", &format!("X C D {all_u}")]),
        family(&["A C", &format!("X B D {all_u}")]),
        family(&["B C", &format!("X A D {all_u}")]),
    ];

    let before_delete = family(&[
        "X U1", "X U2", "X U3", "X U4", "X U5", "X U6", "X U7", "X U8", "A B C", "A B D", "A C D",
        "B C D",
    ]);
    let after_delete = family(&rail);
    (vec![f1, f2, f3], successes, before_delete, after_delete)
}

fn shared_probabilities() -> HashMap<String, f64> {
    let mut probabilities = HashMap::from([
        ("X".to_string(), 1e-1),
        ("A".to_string(), 1e-1),
        ("B".to_string(), 1e-1),
        ("C".to_string(), 1e-1),
        ("D".to_string(), 1e-1),
    ]);
    for index in 1..=8 {
        probabilities.insert(format!("U{index}"), 10_f64.powi(-index));
    }
    probabilities
}

#[test]
fn large_shared_event_sequence_uses_every_success_tree() {
    let (failures, successes, before_delete, after_delete) = shared_multi_state_case();
    let probabilities = shared_probabilities();
    let before_delete = normalize(before_delete);
    assert_eq!(delete_term_oracle(&failures, &[]), before_delete);
    assert_eq!(
        praxis_result(&failures, &[], &probabilities, None, None, 1.0),
        before_delete
    );
    assert_eq!(
        delete_term_oracle(&failures, &successes),
        normalize(after_delete.clone())
    );

    // Removing any one succeeded system exposes one distinct order-3 cut set.
    let missing_one = delete_term_oracle(&failures, &successes[1..]);
    assert!(missing_one.contains(&family(&["A B D"])[0]));
    assert_eq!(
        praxis_result(&failures, &successes[1..], &probabilities, None, None, 1.0,),
        missing_one
    );
    let missing_two = delete_term_oracle(&failures, &[successes[0].clone(), successes[2].clone()]);
    assert!(missing_two.contains(&family(&["A C D"])[0]));
    assert_eq!(
        praxis_result(
            &failures,
            &[successes[0].clone(), successes[2].clone()],
            &probabilities,
            None,
            None,
            1.0,
        ),
        missing_two
    );
    let missing_three = delete_term_oracle(&failures, &successes[..2]);
    assert!(missing_three.contains(&family(&["B C D"])[0]));
    assert_eq!(
        praxis_result(&failures, &successes[..2], &probabilities, None, None, 1.0,),
        missing_three
    );

    let actual = praxis_result(&failures, &successes, &probabilities, None, None, 1.0);
    assert_eq!(actual, normalize(after_delete));
}

fn apply_expected_limits(
    input: Family,
    probabilities: &HashMap<String, f64>,
    cut_off: Option<f64>,
    order_limit: Option<usize>,
    ie_frequency: f64,
) -> Family {
    normalize(
        input
            .into_iter()
            .filter(|term| order_limit.map_or(true, |limit| term.len() <= limit))
            .filter(|term| {
                cut_off.map_or(true, |minimum| {
                    let conditional: f64 = term.iter().map(|event| probabilities[event]).product();
                    conditional * ie_frequency >= minimum
                })
            })
            .collect(),
    )
}

#[test]
fn order_and_frequency_limits_match_known_boundaries() {
    let (failures, successes, _, after_delete) = shared_multi_state_case();
    let probabilities = shared_probabilities();
    let configurations = [
        (None, Some(1), 1.0),
        (None, Some(2), 1.0),
        (Some(5e-6), None, 1.0),
        (Some(5e-6), None, 10.0),
        (Some(5e-6), Some(2), 10.0),
    ];

    for (cut_off, order_limit, ie_frequency) in configurations {
        let expected = apply_expected_limits(
            after_delete.clone(),
            &probabilities,
            cut_off,
            order_limit,
            ie_frequency,
        );
        let actual = praxis_result(
            &failures,
            &successes,
            &probabilities,
            cut_off,
            order_limit,
            ie_frequency,
        );
        assert_eq!(
            actual, expected,
            "cutoff={cut_off:?}, order={order_limit:?}, IE={ie_frequency}"
        );
    }
}

fn parsed_fixture_result(cut_off: Option<f64>, order_limit: Option<usize>) -> Family {
    let parsed = parse_event_tree_model_full(include_str!(
        "fixtures/delete_term/shared_multi_state_large.xml"
    ))
    .unwrap();
    let event_tree = parsed
        .event_trees
        .iter()
        .find(|tree| tree.id == "ET-SHARED-MULTI-STATE")
        .unwrap();
    let event_tree_library: HashMap<String, EventTree> = parsed
        .event_trees
        .iter()
        .map(|tree| (tree.id.clone(), tree.clone()))
        .collect();
    let ie_frequency = parsed
        .initiating_events
        .iter()
        .find(|event| event.event_tree_id.as_deref() == Some(event_tree.id.as_str()))
        .and_then(|event| event.frequency)
        .unwrap();

    let SequenceFormulas {
        pdag,
        sequence_roots,
        sequence_success_roots,
        event_probs,
        ..
    } = SequenceFormulaBuilder::new(&parsed.model)
        .with_delete_term(true)
        .with_event_tree_library(&event_tree_library)
        .build(event_tree, ie_frequency)
        .unwrap();
    let sequence_root = sequence_roots["SEQ-TARGET"];
    let success_roots = &sequence_success_roots["SEQ-TARGET"];
    assert_eq!(success_roots.len(), 3);

    let (zbdd, root, names) = build_sequence_zbdd_from_pdag(
        &pdag,
        &event_probs,
        sequence_root,
        success_roots,
        cut_off,
        order_limit,
        ie_frequency,
    )
    .unwrap();
    normalize(
        zbdd.enumerate(root)
            .into_iter()
            .map(|set| {
                set.into_iter()
                    .map(|variable| names[variable].clone().unwrap())
                    .collect()
            })
            .collect(),
    )
}

#[test]
fn openpsa_fixture_runs_through_parser_sequence_builder_and_delete_term() {
    let (_, _, _, expected) = shared_multi_state_case();
    assert_eq!(parsed_fixture_result(None, None), normalize(expected));

    // The fixture has IE frequency 10. At a 5e-6 frequency cutoff, U1..U5
    // survive while U6..U8 fall below the threshold.
    assert_eq!(
        parsed_fixture_result(Some(5e-6), None),
        family(&["X U1", "X U2", "X U3", "X U4", "X U5"])
    );
    assert!(parsed_fixture_result(None, Some(1)).is_empty());
}
