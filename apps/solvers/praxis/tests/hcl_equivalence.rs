use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{bail, Context, Result};
use approx::assert_abs_diff_eq;
use praxis::algorithms::build::{build_bdd_with_order, BuildOptions};
use praxis::algorithms::pdag::{Connective, NodeIndex, Pdag, PdagNode};
use praxis::core::event::BasicEvent;
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};
use praxis::hcl::{
    parse_xdsl, quantify_hcl, HclBaseEvidence, HclBindingSpec, HclEventBinding, HclEventBindings,
    HclEvidenceSpec, HclModel, HclQuantifier, HclSettings,
};
use praxis::io::parser::parse_fault_tree;
use tensorbayes::{
    BayesianGraph, CompileHeuristic, CompiledJunctionTree, EvidenceBatch, ExecutionEngine, NodeId,
    StateIndex, UNOBSERVED,
};

const EPSILON: f64 = 1e-12;
const MAX_BRUTE_FORCE_ASSIGNMENTS: usize = 1_000_000;

fn fixture_path(relative: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/data/hcl_legacy")
        .join(relative)
}

fn read_fixture(relative: &str) -> String {
    let path = fixture_path(relative);
    fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("failed to read fixture '{}': {error}", path.display()))
}

fn compile(graph: BayesianGraph) -> Result<CompiledJunctionTree> {
    Ok(CompiledJunctionTree::compile(
        graph,
        CompileHeuristic::MinFill,
    )?)
}

fn query_true_probability(
    graph: &BayesianGraph,
    query: NodeId,
    evidence_specs: &[HclEvidenceSpec],
) -> Result<f64> {
    let mut evidence = vec![UNOBSERVED; graph.num_variables()];
    for spec in evidence_specs {
        let node = graph.node_id(&spec.node)?;
        let variable = graph.variable(node)?;
        let state = variable
            .states()
            .iter()
            .position(|candidate| candidate == &spec.state)
            .with_context(|| {
                format!(
                    "state '{}' does not exist on evidence node '{}'",
                    spec.state, spec.node
                )
            })?;
        evidence[node.index()] = i32::try_from(state)?;
    }

    let mut engine = ExecutionEngine::new(compile(graph.clone())?);
    let marginal = engine.evaluate(
        &EvidenceBatch::new(1, graph.num_variables(), evidence)?,
        query,
    )?;
    let row = marginal.row(0).context("missing marginal row")?;
    if row.len() != 2 {
        bail!("verification query node must be binary");
    }
    Ok(row[1])
}

/// Independently embeds the fault tree as deterministic nodes in a cloned BN.
///
/// This is deliberately test-only. It shares model types and TensorBayes with
/// PRAXIS, but it does not call the BDD builder or the HCL Shannon traversal.
fn build_unified_bn(model: &HclModel) -> Result<(BayesianGraph, NodeId)> {
    let pdag = Pdag::from_fault_tree(model.fault_tree())?;
    let mut graph = model.network().clone();
    let bindings: HashMap<&str, &HclBindingSpec> = model
        .bindings()
        .iter()
        .map(|binding| (binding.event.as_str(), binding))
        .collect();
    let mut node_of = HashMap::<NodeIndex, NodeId>::new();

    for index in pdag.topological_sort()? {
        match pdag
            .get_node(index)
            .context("topological order referenced a missing PDAG node")?
        {
            PdagNode::BasicEvent { id, .. } => {
                let node = graph
                    .add_variable(&verification_name(&graph, "event", id), &["false", "true"])?;
                if let Some(binding) = bindings.get(id.as_str()) {
                    let parent = graph.node_id(&binding.node)?;
                    graph.add_edge(parent, node)?;
                    let parent_variable = graph.variable(parent)?;
                    let true_states: HashSet<usize> = binding
                        .true_states
                        .iter()
                        .map(|state| {
                            parent_variable
                                .states()
                                .iter()
                                .position(|candidate| candidate == state)
                                .with_context(|| {
                                    format!(
                                        "state '{state}' does not exist on bound node '{}'",
                                        binding.node
                                    )
                                })
                        })
                        .collect::<Result<_>>()?;
                    let mut cpt = Vec::with_capacity(parent_variable.cardinality() * 2);
                    for state in 0..parent_variable.cardinality() {
                        cpt.extend_from_slice(if true_states.contains(&state) {
                            &[0.0, 1.0]
                        } else {
                            &[1.0, 0.0]
                        });
                    }
                    graph.set_cpt(node, cpt)?;
                } else {
                    let probability = model
                        .fault_tree()
                        .get_basic_event(id)
                        .with_context(|| format!("missing basic event '{id}'"))?
                        .probability();
                    graph.set_cpt(node, vec![1.0 - probability, probability])?;
                }
                node_of.insert(index, node);
            }
            PdagNode::Constant { value, .. } => {
                let node = graph.add_variable(
                    &verification_name(&graph, "constant", &index.to_string()),
                    &["false", "true"],
                )?;
                graph.set_cpt(
                    node,
                    if *value {
                        vec![0.0, 1.0]
                    } else {
                        vec![1.0, 0.0]
                    },
                )?;
                node_of.insert(index, node);
            }
            PdagNode::Gate {
                id,
                connective,
                operands,
                min_number,
                ..
            } => {
                let node = graph
                    .add_variable(&verification_name(&graph, "gate", id), &["false", "true"])?;
                let mut unique_inputs = Vec::<NodeIndex>::new();
                let mut input_position = HashMap::<NodeIndex, usize>::new();
                for operand in operands {
                    let absolute = operand.abs();
                    if let std::collections::hash_map::Entry::Vacant(entry) =
                        input_position.entry(absolute)
                    {
                        entry.insert(unique_inputs.len());
                        unique_inputs.push(absolute);
                    }
                }
                for input in &unique_inputs {
                    graph.add_edge(node_of[input], node)?;
                }

                let rows = 1usize
                    .checked_shl(u32::try_from(unique_inputs.len())?)
                    .context("deterministic gate CPT is too large")?;
                let mut cpt = Vec::with_capacity(rows * 2);
                for row in 0..rows {
                    let values: Vec<bool> = operands
                        .iter()
                        .map(|operand| {
                            let position = input_position[&operand.abs()];
                            let raw = ((row >> (unique_inputs.len() - position - 1)) & 1) == 1;
                            if *operand < 0 {
                                !raw
                            } else {
                                raw
                            }
                        })
                        .collect();
                    let output = evaluate_gate(*connective, &values, *min_number);
                    cpt.extend_from_slice(if output { &[0.0, 1.0] } else { &[1.0, 0.0] });
                }
                graph.set_cpt(node, cpt)?;
                node_of.insert(index, node);
            }
        }
    }

    let root_ref = pdag.root().context("fault tree has no PDAG root")?;
    let root = node_of[&root_ref.abs()];
    let inverted = (root_ref < 0) ^ pdag.complement();
    if !inverted {
        graph.validate()?;
        return Ok((graph, root));
    }

    let query = graph.add_variable(
        &verification_name(&graph, "root", "inverted"),
        &["false", "true"],
    )?;
    graph.add_edge(root, query)?;
    graph.set_cpt(query, vec![0.0, 1.0, 1.0, 0.0])?;
    graph.validate()?;
    Ok((graph, query))
}

fn verification_name(graph: &BayesianGraph, kind: &str, id: &str) -> String {
    let base = format!("__hcl_verify__{kind}__{id}");
    if graph.node_id(&base).is_err() {
        return base;
    }
    (1usize..)
        .map(|suffix| format!("{base}__{suffix}"))
        .find(|candidate| graph.node_id(candidate).is_err())
        .expect("an unused verification node name must exist")
}

fn evaluate_gate(connective: Connective, values: &[bool], min_number: Option<usize>) -> bool {
    match connective {
        Connective::And => values.iter().all(|value| *value),
        Connective::Or => values.iter().any(|value| *value),
        Connective::Not => values.first().is_some_and(|value| !value),
        Connective::AtLeast => {
            values.iter().filter(|value| **value).count() >= min_number.unwrap_or(1)
        }
        Connective::Xor => values.iter().fold(false, |parity, value| parity ^ value),
        Connective::Nand => !values.iter().all(|value| *value),
        Connective::Nor => !values.iter().any(|value| *value),
        Connective::Iff => values
            .first()
            .is_none_or(|first| values.iter().all(|value| value == first)),
        Connective::Null => values.first().copied().unwrap_or(true),
    }
}

/// Enumerates the original BN and every unbound Boolean event.
///
/// This oracle is intentionally limited to small cases so verification cannot
/// silently turn into a benchmark.
fn brute_force_hcl(model: &HclModel) -> Result<f64> {
    let pdag = Pdag::from_fault_tree(model.fault_tree())?;
    let graph = model.network();
    let mut binding_by_event = HashMap::<String, (NodeId, HashSet<usize>)>::new();
    for binding in model.bindings() {
        let node = graph.node_id(&binding.node)?;
        let variable = graph.variable(node)?;
        let states = binding
            .true_states
            .iter()
            .map(|state| {
                variable
                    .states()
                    .iter()
                    .position(|candidate| candidate == state)
                    .with_context(|| format!("unknown state '{state}' on node '{}'", binding.node))
            })
            .collect::<Result<HashSet<_>>>()?;
        binding_by_event.insert(binding.event.clone(), (node, states));
    }

    let unbound: Vec<String> = model
        .fault_tree()
        .basic_events()
        .keys()
        .filter(|event| !binding_by_event.contains_key(*event))
        .cloned()
        .collect();
    let bn_assignments = graph
        .variables()
        .iter()
        .try_fold(1usize, |count, variable| {
            count
                .checked_mul(variable.cardinality())
                .context("BN state space overflow")
        })?;
    let event_assignments = 1usize
        .checked_shl(u32::try_from(unbound.len())?)
        .context("unbound event state space overflow")?;
    let total_assignments = bn_assignments
        .checked_mul(event_assignments)
        .context("combined state space overflow")?;
    if total_assignments > MAX_BRUTE_FORCE_ASSIGNMENTS {
        bail!(
            "brute-force verification needs {total_assignments} assignments; limit is {MAX_BRUTE_FORCE_ASSIGNMENTS}"
        );
    }

    let evidence: HashMap<NodeId, usize> = model
        .base_evidence()
        .iter()
        .map(|spec| {
            let node = graph.node_id(&spec.node)?;
            let state = graph
                .variable(node)?
                .states()
                .iter()
                .position(|candidate| candidate == &spec.state)
                .with_context(|| format!("unknown evidence state '{}'", spec.state))?;
            Ok((node, state))
        })
        .collect::<Result<_>>()?;

    let order = pdag.topological_sort()?;
    let root_ref = pdag.root().context("fault tree has no PDAG root")?;
    let mut numerator = 0.0;
    let mut denominator = 0.0;
    for code in 0..bn_assignments {
        let assignment = decode_assignment(code, graph);
        if evidence
            .iter()
            .any(|(node, state)| assignment[node.index()] != *state)
        {
            continue;
        }
        let joint = bn_joint_probability(graph, &assignment)?;
        for event_code in 0..event_assignments {
            let mut event_values = HashMap::<String, bool>::new();
            let mut event_weight = 1.0;
            for (position, event) in unbound.iter().enumerate() {
                let value = ((event_code >> position) & 1) == 1;
                let probability = model
                    .fault_tree()
                    .get_basic_event(event)
                    .context("unbound event is missing from the fault tree")?
                    .probability();
                event_values.insert(event.clone(), value);
                event_weight *= if value {
                    probability
                } else {
                    1.0 - probability
                };
            }
            for (event, (node, true_states)) in &binding_by_event {
                event_values.insert(
                    event.clone(),
                    true_states.contains(&assignment[node.index()]),
                );
            }

            let top = evaluate_pdag(&pdag, &order, &event_values, root_ref)? ^ pdag.complement();
            let weight = joint * event_weight;
            denominator += weight;
            if top {
                numerator += weight;
            }
        }
    }
    if denominator == 0.0 {
        bail!("base evidence has zero probability");
    }
    Ok(numerator / denominator)
}

fn decode_assignment(mut code: usize, graph: &BayesianGraph) -> Vec<usize> {
    let mut assignment = vec![0; graph.num_variables()];
    for variable in graph.variables().iter().rev() {
        assignment[variable.id().index()] = code % variable.cardinality();
        code /= variable.cardinality();
    }
    assignment
}

fn bn_joint_probability(graph: &BayesianGraph, assignment: &[usize]) -> Result<f64> {
    let mut joint = 1.0;
    for variable in graph.variables() {
        let node = variable.id();
        let parent_configuration =
            graph
                .parents(node)?
                .iter()
                .try_fold(0usize, |row, parent| {
                    row.checked_mul(graph.variable(*parent)?.cardinality())
                        .and_then(|value| value.checked_add(assignment[parent.index()]))
                        .context("CPT index overflow")
                })?;
        let cpt_index = parent_configuration * variable.cardinality() + assignment[node.index()];
        joint *= variable.cpt()[cpt_index];
    }
    Ok(joint)
}

fn evaluate_pdag(
    pdag: &Pdag,
    order: &[NodeIndex],
    event_values: &HashMap<String, bool>,
    root_ref: NodeIndex,
) -> Result<bool> {
    let mut values = HashMap::<NodeIndex, bool>::new();
    for index in order {
        let value = match pdag.get_node(*index).context("missing PDAG node")? {
            PdagNode::BasicEvent { id, .. } => *event_values
                .get(id)
                .with_context(|| format!("missing truth value for event '{id}'"))?,
            PdagNode::Constant { value, .. } => *value,
            PdagNode::Gate {
                connective,
                operands,
                min_number,
                ..
            } => {
                let inputs: Vec<bool> = operands
                    .iter()
                    .map(|operand| {
                        let raw = values[&operand.abs()];
                        if *operand < 0 {
                            !raw
                        } else {
                            raw
                        }
                    })
                    .collect();
                evaluate_gate(*connective, &inputs, *min_number)
            }
        };
        values.insert(*index, value);
    }
    let root = values[&root_ref.abs()];
    Ok(if root_ref < 0 { !root } else { root })
}

fn legacy_lazy_k5_model() -> HclModel {
    let fault_tree = parse_fault_tree(&read_fixture("lazy_k5/FT.xml")).unwrap();
    let network = parse_xdsl(&read_fixture("lazy_k5/BN.xdsl"))
        .unwrap()
        .into_graph()
        .unwrap();
    let bindings = (0..5)
        .map(|index| HclBindingSpec {
            event: format!("I{index}"),
            node: format!("I{index}"),
            true_states: vec!["True".to_string()],
        })
        .collect();
    HclModel::new(fault_tree, network)
        .unwrap()
        .with_bindings(bindings)
}

fn multistate_evidence_model() -> HclModel {
    let mut fault_tree = FaultTree::new("partitioned-weather", "TOP").unwrap();
    fault_tree
        .add_basic_event(BasicEvent::new("Wet".to_string(), 0.5).unwrap())
        .unwrap();
    fault_tree
        .add_basic_event(BasicEvent::new("Snow".to_string(), 0.2).unwrap())
        .unwrap();
    let mut not_snow = Gate::new("NOT_SNOW".to_string(), Formula::Not).unwrap();
    not_snow.add_operand("Snow".to_string());
    fault_tree.add_gate(not_snow).unwrap();
    let mut top = Gate::new("TOP".to_string(), Formula::And).unwrap();
    top.add_operand("Wet".to_string());
    top.add_operand("NOT_SNOW".to_string());
    fault_tree.add_gate(top).unwrap();

    let mut graph = BayesianGraph::new();
    let weather = graph
        .add_variable("Weather", &["sun", "rain", "snow"])
        .unwrap();
    let signal = graph.add_variable("Signal", &["off", "on"]).unwrap();
    graph.add_edge(weather, signal).unwrap();
    graph.set_cpt(weather, vec![0.5, 0.3, 0.2]).unwrap();
    graph
        .set_cpt(signal, vec![0.9, 0.1, 0.2, 0.8, 0.6, 0.4])
        .unwrap();

    HclModel::new(fault_tree, graph)
        .unwrap()
        .with_bindings(vec![
            HclBindingSpec {
                event: "Wet".to_string(),
                node: "Weather".to_string(),
                true_states: vec!["rain".to_string(), "snow".to_string()],
            },
            HclBindingSpec {
                event: "Snow".to_string(),
                node: "Weather".to_string(),
                true_states: vec!["snow".to_string()],
            },
        ])
        .with_base_evidence(vec![HclEvidenceSpec {
            node: "Signal".to_string(),
            state: "on".to_string(),
        }])
}

#[test]
fn legacy_lazy_k5_matches_frozen_and_rebuilt_unified_networks() -> Result<()> {
    const EXPECTED: f64 = 1.908_921_557_181_624_7e-2;

    let model = legacy_lazy_k5_model();
    let shannon = quantify_hcl(&model, &HclSettings::default())?.probability;

    let frozen = parse_xdsl(&read_fixture("lazy_k5/BN_unified.xdsl"))?.into_graph()?;
    let frozen_probability = query_true_probability(&frozen, frozen.node_id("Top")?, &[])?;

    let (rebuilt, rebuilt_top) = build_unified_bn(&model)?;
    let rebuilt_probability = query_true_probability(&rebuilt, rebuilt_top, model.base_evidence())?;
    let enumerated = brute_force_hcl(&model)?;

    assert_abs_diff_eq!(shannon, EXPECTED, epsilon = EPSILON);
    assert_abs_diff_eq!(shannon, frozen_probability, epsilon = EPSILON);
    assert_abs_diff_eq!(shannon, rebuilt_probability, epsilon = EPSILON);
    assert_abs_diff_eq!(shannon, enumerated, epsilon = EPSILON);
    Ok(())
}

#[test]
fn multistate_bindings_evidence_and_variable_order_match_both_oracles() -> Result<()> {
    let model = multistate_evidence_model();
    let expected = 0.24 / 0.37;
    let enumerated = brute_force_hcl(&model)?;
    let (unified, top) = build_unified_bn(&model)?;
    let unified_probability = query_true_probability(&unified, top, model.base_evidence())?;

    for order in [
        vec!["Wet".to_string(), "Snow".to_string()],
        vec!["Snow".to_string(), "Wet".to_string()],
    ] {
        let result = quantify_hcl(
            &model,
            &HclSettings {
                variable_order: Some(order),
                ..HclSettings::default()
            },
        )?;
        assert_abs_diff_eq!(result.probability, expected, epsilon = EPSILON);
        assert_abs_diff_eq!(result.probability, enumerated, epsilon = EPSILON);
        assert_abs_diff_eq!(result.probability, unified_probability, epsilon = EPSILON);
    }
    Ok(())
}

#[test]
fn shannon_cache_reuse_and_clear_are_probability_invariant() -> Result<()> {
    let model = multistate_evidence_model();
    let order = vec!["Wet".to_string(), "Snow".to_string()];
    let built = build_bdd_with_order(model.fault_tree(), BuildOptions::default(), &order)?;
    let weather = model.network().node_id("Weather")?;
    let mut bindings = HclEventBindings::new();
    bindings.insert(HclEventBinding::for_event(
        &built,
        "Wet",
        weather,
        vec![StateIndex::new(1), StateIndex::new(2)],
    )?)?;
    bindings.insert(HclEventBinding::for_event(
        &built,
        "Snow",
        weather,
        vec![StateIndex::new(2)],
    )?)?;
    let signal = model.network().node_id("Signal")?;
    let mut evidence = HclBaseEvidence::unobserved(model.network().num_variables());
    evidence.observe(signal, StateIndex::new(1))?;

    let tree = compile(model.network().clone())?;
    let mut quantifier = HclQuantifier::new(&built.bdd, tree, bindings, evidence)?;
    let first = quantifier.quantify(built.root)?;
    let misses = quantifier.stats().bn_query_cache_misses;
    let cached = quantifier.quantify(built.root)?;
    assert!(quantifier.stats().bdd_context_cache_hits > 0);
    assert_eq!(quantifier.stats().bn_query_cache_misses, misses);

    quantifier.clear_caches();
    let after_clear = quantifier.quantify(built.root)?;
    let oracle = brute_force_hcl(&model)?;
    assert_abs_diff_eq!(first, oracle, epsilon = EPSILON);
    assert_abs_diff_eq!(cached, oracle, epsilon = EPSILON);
    assert_abs_diff_eq!(after_clear, oracle, epsilon = EPSILON);
    Ok(())
}
