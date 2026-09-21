use crate::cli::args::{Algorithm, Approximation, Args, Backend, CutOffBasis};
use crate::cli::metadata::{
    display_zbdd_sequence_metadata, prompt_for_limits_with_defaults, ZbddSequenceSummary,
};
use crate::cli::optimize::{
    estimate_model_nodes, optimize_run_params_for_cpu, optimize_run_params_for_cuda,
};
use crate::cli::output::{writer_stdout, writer_vec};
use praxis::algorithms::bdd_engine::{Bdd, BddRef};
use praxis::algorithms::end_state_zbdd::EndStateZbdd;
use praxis::algorithms::mocus::CutSet;
use praxis::algorithms::pdag::{NodeIndex, Pdag};
use praxis::algorithms::zbdd_engine::ZbddEngine;
use praxis::algorithms::zbdd_engine::ZbddRef;
use praxis::algorithms::zbdd_engine::{ZBDD_BASE, ZBDD_EMPTY};
use praxis::analysis::sequence_formula::SequenceFormulaBuilder;
use praxis::core::event_tree::InitiatingEvent;
use praxis::core::fault_tree::FaultTree;
use praxis::io::event_tree_parser::EventTreeModel;
use praxis::io::reporter::{
    write_comprehensive_report, AnalysisReport, EventTreeAnalyticReport, EventTreeAnalyticSequence,
    EventTreeMonteCarloReport,
};
use praxis::mc::core::ConvergenceSettings;
use praxis::mc::plan::{choose_run_params_for_num_trials, RunParams};
use praxis::mc::DpEventTreeMonteCarloAnalysis;
use quick_xml::events::{BytesDecl, BytesEnd, BytesStart, Event};
use quick_xml::Writer;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{BufWriter, Write};

type ParsedModelWithLibs = (
    praxis::core::model::Model,
    Vec<InitiatingEvent>,
    Vec<praxis::core::event_tree::EventTree>,
    HashMap<String, praxis::core::event_tree::EventTree>,
);

#[cfg(feature = "cuda")]
use cubecl_cuda::CudaRuntime;

#[cfg(feature = "wgpu")]
use cubecl_wgpu::WgpuRuntime;

fn parse_model_with_libs_from_parsed(
    parsed: &EventTreeModel,
) -> Result<ParsedModelWithLibs, Box<dyn std::error::Error>> {
    let mut model = parsed.model.clone();
    let fault_tree_ids: Vec<String> = model.fault_trees().keys().cloned().collect();
    for fault_tree_id in fault_tree_ids {
        let fault_tree = model
            .get_fault_tree_mut(&fault_tree_id)
            .ok_or_else(|| format!("Missing parsed fault tree '{}'", fault_tree_id))?;
        if fault_tree.ccf_groups().is_empty() {
            continue;
        }
        let mut base_probabilities = HashMap::new();
        for (group_id, group) in fault_tree.ccf_groups() {
            let distribution = group.distribution.as_ref().ok_or_else(|| {
                format!(
                    "CCF group '{}' in fault tree '{}' has no distribution",
                    group_id, fault_tree_id
                )
            })?;
            let probability = distribution.parse::<f64>().map_err(|_| {
                format!(
                    "CCF group '{}' in fault tree '{}' has invalid distribution '{}'",
                    group_id, fault_tree_id, distribution
                )
            })?;
            base_probabilities.insert(group_id.clone(), probability);
        }
        fault_tree
            .expand_ccf_groups(&base_probabilities)
            .map_err(|error| {
                format!(
                    "Failed to expand CCF groups in fault tree '{}': {}",
                    fault_tree_id, error
                )
            })?;
    }
    let initiating_events = parsed.initiating_events.clone();
    let event_trees = parsed.event_trees.clone();

    let mut event_tree_library: HashMap<String, praxis::core::event_tree::EventTree> =
        HashMap::new();
    for et in &event_trees {
        event_tree_library
            .entry(et.id.clone())
            .or_insert_with(|| et.clone());
    }

    Ok((model, initiating_events, event_trees, event_tree_library))
}

fn event_names_from_pdag(pdag: &Pdag, order: &[NodeIndex]) -> Vec<Option<String>> {
    order
        .iter()
        .map(|&idx| {
            pdag.get_node(idx)
                .and_then(|n| n.id().map(|s| s.to_string()))
        })
        .collect()
}

fn enumerate_cut_sets_et(
    zbdd: &ZbddEngine,
    root: ZbddRef,
    event_names: &[Option<String>],
) -> Vec<CutSet> {
    zbdd.enumerate(root)
        .iter()
        .map(|set| {
            let events: Vec<String> = set
                .iter()
                .filter_map(|&pos| event_names.get(pos).and_then(|n| n.clone()))
                .collect();
            CutSet::new(events)
        })
        .collect()
}

/// The factor folded into every product's value before it meets the cut-off.
/// On the frequency basis a sequence product is worth its probability times the
/// initiating-event frequency, so the cut-off is compared against a frequency;
/// on the probability basis the products keep their bare probability.
fn truncation_scale(basis: CutOffBasis, ie_frequency: f64) -> f64 {
    match basis {
        CutOffBasis::Frequency => ie_frequency,
        CutOffBasis::Probability => 1.0,
    }
}

/// Whether no product of this sequence can reach the cut-off. A product's true
/// weight is P(product AND sequence), which is bounded by both P(product) and
/// the sequence's own probability, so once the sequence itself falls below the
/// cut-off every product provably does too and the list is empty. This is what
/// keeps a sequence that a succeeded system has made impossible (probability
/// exactly zero) from still reporting the products of its failed systems: the
/// cut-set projection drops the complemented systems, so their weight reaches
/// the truncation only through this bound.
fn sequence_below_cut_off(scale: f64, probability: f64, cut_off: Option<f64>) -> bool {
    match cut_off {
        Some(min_value) => scale * probability < min_value,
        None => false,
    }
}

fn compute_approx_et(
    zbdd: &ZbddEngine,
    root: ZbddRef,
    approximation: Option<Approximation>,
) -> f64 {
    match approximation {
        Some(Approximation::RareEvent) => zbdd.rare_event_probability(root),
        Some(Approximation::Mcub) => zbdd.min_cut_upper_bound_graph(root),
        None => f64::NAN,
    }
}

struct SequenceBdd {
    variable_order: Vec<NodeIndex>,
    bdd: Bdd,
    root: BddRef,
    delete_roots: Vec<BddRef>,
    probability: f64,
}

/// Build one sequence's BDD, together with the BDDs of the systems it succeeded so
/// that delete-term can subtract their cut sets afterwards. `success_roots` is empty
/// unless delete-term is on, in which case the sequence formula holds only the failed
/// systems and each succeeded system deletes the products that contain its cut sets.
fn build_sequence_bdd_for(
    pdag: &mut Pdag,
    event_probs: &HashMap<String, f64>,
    seq_id: &str,
    sequence_root: NodeIndex,
    success_roots: &[NodeIndex],
) -> Result<SequenceBdd, Box<dyn std::error::Error>> {
    let (variable_order, mut bdd, root, delete_roots) =
        praxis::algorithms::build::build_sequence_bdd_with_successes(
            pdag,
            event_probs,
            sequence_root,
            success_roots,
            seq_id,
        )
        .map_err(|e| format!("BDD build failed for '{}': {}", seq_id, e))?;

    let probability = bdd.probability(root);
    bdd.freeze();

    Ok(SequenceBdd {
        variable_order,
        bdd,
        root,
        delete_roots,
        probability,
    })
}

fn analytic_zbdd_wf1_no_approx_no_limits(
    cli: &Args,
    model: &praxis::core::model::Model,
    event_tree: &praxis::core::event_tree::EventTree,
    event_tree_library: &HashMap<String, praxis::core::event_tree::EventTree>,
    _ie: &InitiatingEvent,
    ie_frequency: f64,
    _verbose: bool,
) -> Result<Vec<EventTreeAnalyticSequence>, Box<dyn std::error::Error>> {
    let praxis::analysis::sequence_formula::SequenceFormulas {
        mut pdag,
        sequence_roots,
        sequence_success_roots,
        unconditional,
        event_probs,
        ie_frequency: _,
    } = SequenceFormulaBuilder::new(model)
        .with_complement_unity(cli.complement_unity)
        .with_delete_term(cli.delete_term)
        .with_saphire_success(cli.saphire_success)
        .with_event_tree_library(event_tree_library)
        .build(event_tree, ie_frequency)
        .map_err(|e| {
            format!(
                "Sequence formula construction failed for '{}': {}",
                event_tree.id, e
            )
        })?;

    let mut all_seq_ids: Vec<String> = sequence_roots.keys().cloned().collect();
    for id in &unconditional {
        if !sequence_roots.contains_key(id.as_str()) {
            all_seq_ids.push(id.clone());
        }
    }
    all_seq_ids.sort();

    let initial_limit_order = cli.limit_order.map(|value| value as usize);
    let initial_cut_off = cli.cut_off;
    let initial_scale = truncation_scale(cli.cut_off_basis, ie_frequency);
    let mut meta_entries: Vec<ZbddSequenceSummary> = Vec::new();
    for (index, seq_id) in all_seq_ids.iter().enumerate() {
        eprintln!(
            "Collecting cut-set statistics at the initial limits for sequence {}/{}: {}",
            index + 1,
            all_seq_ids.len(),
            seq_id
        );
        if unconditional.contains(seq_id) {
            meta_entries.push(ZbddSequenceSummary::from_stats(
                seq_id.clone(),
                ie_frequency,
                None,
                ie_frequency,
            ));
            continue;
        }
        let Some(&root_idx) = sequence_roots.get(seq_id.as_str()) else {
            meta_entries.push(ZbddSequenceSummary::from_stats(
                seq_id.clone(),
                0.0,
                None,
                ie_frequency,
            ));
            continue;
        };

        let successes = sequence_success_roots
            .get(seq_id.as_str())
            .cloned()
            .unwrap_or_default();
        let SequenceBdd {
            variable_order: _,
            bdd,
            root: bdd_root,
            delete_roots,
            probability: exact_prob,
        } = build_sequence_bdd_for(&mut pdag, &event_probs, seq_id, root_idx, &successes)?;
        if sequence_below_cut_off(initial_scale, exact_prob, initial_cut_off) {
            meta_entries.push(ZbddSequenceSummary::from_stats(
                seq_id.clone(),
                exact_prob * ie_frequency,
                None,
                ie_frequency,
            ));
            continue;
        }
        let (zbdd, zbdd_root) = if cli.complement_unity || cli.saphire_success {
            let (zbdd, root, _) = praxis::algorithms::direct_zbdd::build_sequence_zbdd_from_pdag(
                &pdag,
                &event_probs,
                root_idx,
                &successes,
                initial_cut_off,
                initial_limit_order,
                initial_scale,
            )?;
            (zbdd, root)
        } else {
            ZbddEngine::build_from_bdd_with_delete_terms(
                &bdd,
                bdd_root,
                &delete_roots,
                false,
                initial_limit_order,
                initial_cut_off,
                initial_scale,
            )
        };
        let stats = zbdd.stats(zbdd_root);
        meta_entries.push(ZbddSequenceSummary::from_stats(
            seq_id.clone(),
            exact_prob * ie_frequency,
            stats,
            ie_frequency,
        ));

        // The BDD and ZBDD are intentionally dropped here. Interactive event-tree
        // analysis keeps only lightweight statistics between sequences.
        drop(zbdd);
        drop(bdd);
    }
    display_zbdd_sequence_metadata(&meta_entries);

    let (limit_order, cut_off) =
        prompt_for_limits_with_defaults(cli.limit_order.map(|value| value as usize), cli.cut_off);

    let mut sequences: Vec<EventTreeAnalyticSequence> = Vec::new();
    for (index, seq_id) in all_seq_ids.iter().enumerate() {
        eprintln!(
            "Solving sequence {}/{} with selected limits: {}",
            index + 1,
            all_seq_ids.len(),
            seq_id
        );
        if unconditional.contains(seq_id) {
            let mut m = HashMap::new();
            m.insert(0usize, 1u64);
            sequences.push(EventTreeAnalyticSequence {
                sequence_id: seq_id.clone(),
                path: vec![],
                probability: 1.0,
                frequency: ie_frequency,
                cut_sets: vec![CutSet::new(Vec::new())],
                order_dist: m,
            });
            continue;
        }
        let Some(&root_idx) = sequence_roots.get(seq_id.as_str()) else {
            sequences.push(EventTreeAnalyticSequence {
                sequence_id: seq_id.clone(),
                path: vec![],
                probability: 0.0,
                frequency: 0.0,
                cut_sets: Vec::new(),
                order_dist: HashMap::new(),
            });
            continue;
        };

        let successes = sequence_success_roots
            .get(seq_id.as_str())
            .cloned()
            .unwrap_or_default();
        let SequenceBdd {
            variable_order,
            bdd,
            root: bdd_root,
            delete_roots,
            probability: exact_prob,
        } = build_sequence_bdd_for(&mut pdag, &event_probs, seq_id, root_idx, &successes)?;
        let scale = truncation_scale(cli.cut_off_basis, ie_frequency);

        if sequence_below_cut_off(scale, exact_prob, cut_off) {
            sequences.push(EventTreeAnalyticSequence {
                sequence_id: seq_id.clone(),
                path: vec![],
                probability: exact_prob,
                frequency: exact_prob * ie_frequency,
                cut_sets: Vec::new(),
                order_dist: HashMap::new(),
            });
            continue;
        }

        let (zbdd, zbdd_root, event_names) = if cli.complement_unity || cli.saphire_success {
            praxis::algorithms::direct_zbdd::build_sequence_zbdd_from_pdag(
                &pdag,
                &event_probs,
                root_idx,
                &successes,
                cut_off,
                limit_order,
                scale,
            )?
        } else {
            let event_names = event_names_from_pdag(&pdag, &variable_order);
            let (zbdd, root) = ZbddEngine::build_from_bdd_with_delete_terms(
                &bdd,
                bdd_root,
                &delete_roots,
                false,
                limit_order,
                cut_off,
                scale,
            );
            (zbdd, root, event_names)
        };
        let order_dist = zbdd.count_by_order(zbdd_root);
        let cut_sets = enumerate_cut_sets_et(&zbdd, zbdd_root, &event_names);

        sequences.push(EventTreeAnalyticSequence {
            sequence_id: seq_id.clone(),
            path: vec![],
            probability: exact_prob,
            frequency: exact_prob * ie_frequency,
            cut_sets,
            order_dist,
        });
    }

    Ok(sequences)
}

fn analytic_zbdd_wf2_approx_no_limits(
    cli: &Args,
    model: &praxis::core::model::Model,
    event_tree: &praxis::core::event_tree::EventTree,
    event_tree_library: &HashMap<String, praxis::core::event_tree::EventTree>,
    _ie: &InitiatingEvent,
    ie_frequency: f64,
    _verbose: bool,
) -> Result<Vec<EventTreeAnalyticSequence>, Box<dyn std::error::Error>> {
    let praxis::analysis::sequence_formula::SequenceFormulas {
        pdag,
        sequence_roots,
        sequence_success_roots,
        unconditional,
        event_probs,
        ie_frequency: _,
    } = SequenceFormulaBuilder::new(model)
        .with_complement_unity(cli.complement_unity)
        .with_delete_term(cli.delete_term)
        .with_saphire_success(cli.saphire_success)
        .with_event_tree_library(event_tree_library)
        .build(event_tree, ie_frequency)
        .map_err(|e| {
            format!(
                "Sequence formula construction failed for '{}': {}",
                event_tree.id, e
            )
        })?;

    let mut all_seq_ids: Vec<String> = sequence_roots.keys().cloned().collect();
    for id in &unconditional {
        if !sequence_roots.contains_key(id.as_str()) {
            all_seq_ids.push(id.clone());
        }
    }
    all_seq_ids.sort();

    let initial_limit_order = cli.limit_order.map(|value| value as usize);
    let initial_cut_off = cli.cut_off;
    let initial_scale = truncation_scale(cli.cut_off_basis, ie_frequency);
    let mut meta_entries: Vec<ZbddSequenceSummary> = Vec::new();
    for (index, seq_id) in all_seq_ids.iter().enumerate() {
        eprintln!(
            "Collecting cut-set statistics at the initial limits for sequence {}/{}: {}",
            index + 1,
            all_seq_ids.len(),
            seq_id
        );
        if unconditional.contains(seq_id) {
            meta_entries.push(ZbddSequenceSummary::from_stats(
                seq_id.clone(),
                ie_frequency,
                None,
                ie_frequency,
            ));
            continue;
        }
        let Some(&root_idx) = sequence_roots.get(seq_id.as_str()) else {
            meta_entries.push(ZbddSequenceSummary::from_stats(
                seq_id.clone(),
                0.0,
                None,
                ie_frequency,
            ));
            continue;
        };

        let successes = sequence_success_roots
            .get(seq_id.as_str())
            .cloned()
            .unwrap_or_default();
        let (zbdd, zbdd_root, _) = praxis::algorithms::direct_zbdd::build_sequence_zbdd_from_pdag(
            &pdag,
            &event_probs,
            root_idx,
            &successes,
            initial_cut_off,
            initial_limit_order,
            initial_scale,
        )?;
        let approx_prob = compute_approx_et(&zbdd, zbdd_root, cli.approximation);
        let stats = zbdd.stats(zbdd_root);
        meta_entries.push(ZbddSequenceSummary::from_stats(
            seq_id.clone(),
            approx_prob * ie_frequency,
            stats,
            ie_frequency,
        ));

        // Keep only the statistics between sequences; the full decision diagrams
        // are rebuilt with the analyst's limits during the second pass.
        drop(zbdd);
    }
    display_zbdd_sequence_metadata(&meta_entries);

    let (limit_order, cut_off) =
        prompt_for_limits_with_defaults(cli.limit_order.map(|value| value as usize), cli.cut_off);

    let mut sequences: Vec<EventTreeAnalyticSequence> = Vec::new();
    for (index, seq_id) in all_seq_ids.iter().enumerate() {
        eprintln!(
            "Solving sequence {}/{} with selected limits: {}",
            index + 1,
            all_seq_ids.len(),
            seq_id
        );
        if unconditional.contains(seq_id) {
            let mut m = HashMap::new();
            m.insert(0usize, 1u64);
            sequences.push(EventTreeAnalyticSequence {
                sequence_id: seq_id.clone(),
                path: vec![],
                probability: 1.0,
                frequency: ie_frequency,
                cut_sets: vec![CutSet::new(Vec::new())],
                order_dist: m,
            });
            continue;
        }
        let Some(&root_idx) = sequence_roots.get(seq_id.as_str()) else {
            sequences.push(EventTreeAnalyticSequence {
                sequence_id: seq_id.clone(),
                path: vec![],
                probability: 0.0,
                frequency: 0.0,
                cut_sets: Vec::new(),
                order_dist: HashMap::new(),
            });
            continue;
        };

        let successes = sequence_success_roots
            .get(seq_id.as_str())
            .cloned()
            .unwrap_or_default();
        let scale = truncation_scale(cli.cut_off_basis, ie_frequency);
        let (zbdd, zbdd_root, event_names) =
            praxis::algorithms::direct_zbdd::build_sequence_zbdd_from_pdag(
                &pdag,
                &event_probs,
                root_idx,
                &successes,
                cut_off,
                limit_order,
                scale,
            )?;
        let final_prob = compute_approx_et(&zbdd, zbdd_root, cli.approximation);
        let order_dist = zbdd.count_by_order(zbdd_root);
        let cut_sets = enumerate_cut_sets_et(&zbdd, zbdd_root, &event_names);

        sequences.push(EventTreeAnalyticSequence {
            sequence_id: seq_id.clone(),
            path: vec![],
            probability: final_prob,
            frequency: final_prob * ie_frequency,
            cut_sets,
            order_dist,
        });
    }

    Ok(sequences)
}

fn analytic_zbdd_wf3_no_approx_limits(
    cli: &Args,
    model: &praxis::core::model::Model,
    event_tree: &praxis::core::event_tree::EventTree,
    event_tree_library: &HashMap<String, praxis::core::event_tree::EventTree>,
    _ie: &InitiatingEvent,
    ie_frequency: f64,
    verbose: bool,
) -> Result<Vec<EventTreeAnalyticSequence>, Box<dyn std::error::Error>> {
    let limit_order = cli.limit_order.map(|n| n as usize);
    let cut_off = cli.cut_off;
    let scale = truncation_scale(cli.cut_off_basis, ie_frequency);

    let praxis::analysis::sequence_formula::SequenceFormulas {
        mut pdag,
        sequence_roots,
        sequence_success_roots,
        unconditional,
        event_probs,
        ie_frequency: _,
    } = SequenceFormulaBuilder::new(model)
        .with_complement_unity(cli.complement_unity)
        .with_delete_term(cli.delete_term)
        .with_saphire_success(cli.saphire_success)
        .with_event_tree_library(event_tree_library)
        .build(event_tree, ie_frequency)
        .map_err(|e| {
            format!(
                "Sequence formula construction failed for '{}': {}",
                event_tree.id, e
            )
        })?;

    let mut all_seq_ids: Vec<String> = sequence_roots.keys().cloned().collect();
    for id in &unconditional {
        if !sequence_roots.contains_key(id.as_str()) {
            all_seq_ids.push(id.clone());
        }
    }
    all_seq_ids.sort();

    let mut sequences: Vec<EventTreeAnalyticSequence> = Vec::new();

    for seq_id in &all_seq_ids {
        if unconditional.contains(seq_id) {
            let mut m = HashMap::new();
            m.insert(0usize, 1u64);
            sequences.push(EventTreeAnalyticSequence {
                sequence_id: seq_id.clone(),
                path: vec![],
                probability: 1.0,
                frequency: ie_frequency,
                cut_sets: vec![CutSet::new(Vec::new())],
                order_dist: m,
            });
            continue;
        }
        let Some(&root_idx) = sequence_roots.get(seq_id.as_str()) else {
            sequences.push(EventTreeAnalyticSequence {
                sequence_id: seq_id.clone(),
                path: vec![],
                probability: 0.0,
                frequency: 0.0,
                cut_sets: Vec::new(),
                order_dist: HashMap::new(),
            });
            continue;
        };

        let successes = sequence_success_roots
            .get(seq_id.as_str())
            .cloned()
            .unwrap_or_default();
        let t0 = std::time::Instant::now();
        let SequenceBdd {
            variable_order,
            bdd,
            root: bdd_root,
            delete_roots,
            probability: exact_prob,
        } = build_sequence_bdd_for(&mut pdag, &event_probs, seq_id, root_idx, &successes)?;
        if verbose {
            eprintln!(
                "[{}] bdd build, probability {:.6e}: {:?}",
                seq_id,
                exact_prob,
                t0.elapsed()
            );
        }

        if sequence_below_cut_off(scale, exact_prob, cut_off) {
            if verbose {
                eprintln!(
                    "[{}] sequence value {:.6e} is below the cut-off; no product can reach it",
                    seq_id,
                    scale * exact_prob
                );
            }
            sequences.push(EventTreeAnalyticSequence {
                sequence_id: seq_id.clone(),
                path: vec![],
                probability: exact_prob,
                frequency: exact_prob * ie_frequency,
                cut_sets: Vec::new(),
                order_dist: HashMap::new(),
            });
            continue;
        }

        let t2 = std::time::Instant::now();
        let (zbdd, zbdd_root, event_names) = if cli.complement_unity || cli.saphire_success {
            // Successful event-tree paths have already been replaced by Unity
            // in SequenceFormulaBuilder. Preserve NOT gates inside the failed
            // fault trees and use the signed direct builder so a complemented
            // probability-one flag is correctly impossible instead of becoming
            // an unqualified positive cut set.
            praxis::algorithms::direct_zbdd::build_sequence_zbdd_from_pdag(
                &pdag,
                &event_probs,
                root_idx,
                &successes,
                cut_off,
                limit_order,
                scale,
            )?
        } else {
            let event_names = event_names_from_pdag(&pdag, &variable_order);
            let (zbdd, zbdd_root) = ZbddEngine::build_from_bdd_with_delete_terms(
                &bdd,
                bdd_root,
                &delete_roots,
                false,
                limit_order,
                cut_off,
                scale,
            );
            (zbdd, zbdd_root, event_names)
        };
        if verbose {
            eprintln!(
                "[{}] zbdd convert ({} delete-term system(s)): {:?}",
                seq_id,
                delete_roots.len(),
                t2.elapsed()
            );
        }

        let t3 = std::time::Instant::now();
        let order_dist = zbdd.count_by_order(zbdd_root);
        let cut_sets = enumerate_cut_sets_et(&zbdd, zbdd_root, &event_names);
        if verbose {
            eprintln!("[{}] count+enumerate: {:?}", seq_id, t3.elapsed());
        }

        sequences.push(EventTreeAnalyticSequence {
            sequence_id: seq_id.clone(),
            path: vec![],
            probability: exact_prob,
            frequency: exact_prob * ie_frequency,
            cut_sets,
            order_dist,
        });
    }

    Ok(sequences)
}

fn analytic_zbdd_wf4_approx_limits(
    cli: &Args,
    model: &praxis::core::model::Model,
    event_tree: &praxis::core::event_tree::EventTree,
    event_tree_library: &HashMap<String, praxis::core::event_tree::EventTree>,
    _ie: &InitiatingEvent,
    ie_frequency: f64,
    _verbose: bool,
) -> Result<Vec<EventTreeAnalyticSequence>, Box<dyn std::error::Error>> {
    let limit_order = cli.limit_order.map(|n| n as usize);
    let cut_off = cli.cut_off;
    let scale = truncation_scale(cli.cut_off_basis, ie_frequency);

    let praxis::analysis::sequence_formula::SequenceFormulas {
        pdag,
        sequence_roots,
        sequence_success_roots,
        unconditional,
        event_probs,
        ie_frequency: _,
    } = SequenceFormulaBuilder::new(model)
        .with_complement_unity(cli.complement_unity)
        .with_delete_term(cli.delete_term)
        .with_saphire_success(cli.saphire_success)
        .with_event_tree_library(event_tree_library)
        .build(event_tree, ie_frequency)
        .map_err(|e| {
            format!(
                "Sequence formula construction failed for '{}': {}",
                event_tree.id, e
            )
        })?;

    let mut all_seq_ids: Vec<String> = sequence_roots.keys().cloned().collect();
    for id in &unconditional {
        if !sequence_roots.contains_key(id.as_str()) {
            all_seq_ids.push(id.clone());
        }
    }
    all_seq_ids.sort();

    let mut sequences: Vec<EventTreeAnalyticSequence> = Vec::new();

    for (index, seq_id) in all_seq_ids.iter().enumerate() {
        eprintln!(
            "Solving sequence {}/{} at the selected limits: {}",
            index + 1,
            all_seq_ids.len(),
            seq_id
        );
        if unconditional.contains(seq_id) {
            let mut m = HashMap::new();
            m.insert(0usize, 1u64);
            sequences.push(EventTreeAnalyticSequence {
                sequence_id: seq_id.clone(),
                path: vec![],
                probability: 1.0,
                frequency: ie_frequency,
                cut_sets: vec![CutSet::new(Vec::new())],
                order_dist: m,
            });
            continue;
        }
        let Some(&root_idx) = sequence_roots.get(seq_id.as_str()) else {
            sequences.push(EventTreeAnalyticSequence {
                sequence_id: seq_id.clone(),
                path: vec![],
                probability: 0.0,
                frequency: 0.0,
                cut_sets: Vec::new(),
                order_dist: HashMap::new(),
            });
            continue;
        };

        let successes = sequence_success_roots
            .get(seq_id.as_str())
            .cloned()
            .unwrap_or_default();
        let (zbdd, zbdd_root, event_names) =
            praxis::algorithms::direct_zbdd::build_sequence_zbdd_from_pdag(
                &pdag,
                &event_probs,
                root_idx,
                &successes,
                cut_off,
                limit_order,
                scale,
            )?;
        let approx_prob = compute_approx_et(&zbdd, zbdd_root, cli.approximation);
        let order_dist = zbdd.count_by_order(zbdd_root);
        let cut_sets = enumerate_cut_sets_et(&zbdd, zbdd_root, &event_names);

        sequences.push(EventTreeAnalyticSequence {
            sequence_id: seq_id.clone(),
            path: vec![],
            probability: approx_prob,
            frequency: approx_prob * ie_frequency,
            cut_sets,
            order_dist,
        });
    }

    Ok(sequences)
}

fn run_monte_carlo_impl(
    cli: &Args,
    model: praxis::core::model::Model,
    initiating_events: Vec<InitiatingEvent>,
    event_trees: Vec<praxis::core::event_tree::EventTree>,
    event_tree_library: HashMap<String, praxis::core::event_tree::EventTree>,
    verbose: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    if cli.validate {
        if verbose {
            eprintln!("Validation successful - input file is valid OpenPSA MEF format");
        }
        return Ok(());
    }

    if verbose {
        eprintln!(
            "Parsed model with {} fault trees",
            model.fault_trees().len()
        );
        eprintln!("Initiating events: {}", initiating_events.len());
        eprintln!("Event trees: {}", event_trees.len());
    }

    let mut computed_event_tree_monte_carlo: Vec<EventTreeMonteCarloReport> = Vec::new();
    let auto_cuda_num_trials = !cli.optimize
        && matches!(
            (cli.iterations, cli.batches, cli.bitpacks_per_batch),
            (None, None, None)
        )
        && matches!(cli.backend.unwrap_or(Backend::Cpu), Backend::Cuda);

    let auto_cuda_node_count = if auto_cuda_num_trials {
        Some(estimate_model_nodes(&model))
    } else {
        None
    };

    let pairs = select_event_trees_to_run(&initiating_events, &event_trees)?;

    if cli.visualize {
        let graphviz_ok = praxis::analysis::visualize::graphviz_available();
        for (ie, event_tree) in &pairs {
            let et_dot = praxis::analysis::visualize::generate_event_tree_dot(event_tree, &ie.id);
            crate::cli::visualization::save_outputs(
                cli,
                &et_dot,
                &format!("{}_tree", event_tree.id),
                "event-tree visualization",
                verbose,
                graphviz_ok,
            );
        }
    }

    for (ie, event_tree) in pairs {
        let backend = cli.backend.unwrap_or(Backend::Cpu);
        let explicit_params: Option<RunParams> = if cli.optimize || auto_cuda_num_trials {
            let node_count = auto_cuda_node_count.unwrap_or_else(|| estimate_model_nodes(&model));
            Some(match backend {
                Backend::Cpu => optimize_run_params_for_cpu(node_count, cli.seed)?,
                Backend::Cuda => {
                    optimize_run_params_for_cuda(cli.num_trials as usize, node_count, cli.seed)?
                }
                Backend::Wgpu => {
                    return Err(anyhow::anyhow!(
                        "--optimize is currently supported for '--backend cpu' and '--backend cuda' only"
                    )
                    .into());
                }
            })
        } else {
            match (cli.iterations, cli.batches, cli.bitpacks_per_batch) {
                (None, None, None) => None,
                (Some(t), Some(b), Some(p)) => {
                    let t = t as usize;
                    let b = b as usize;
                    let p = p as usize;
                    if t == 0 || b == 0 || p == 0 {
                        return Err(anyhow::anyhow!(
                            "iterations, batches, and bitpacks-per-batch must all be > 0"
                        )
                        .into());
                    }
                    Some(RunParams::new(t, b, p, RunParams::DEFAULT_OMEGA, cli.seed))
                }
                _ => {
                    return Err(anyhow::anyhow!(
                        "If setting any of iterations/batches/bitpacks-per-batch, you must set all three"
                    )
                    .into());
                }
            }
        };

        let effective_trials: usize = if let Some(params) = explicit_params {
            params.total_trials_covered()
        } else {
            cli.num_trials as usize
        };

        if verbose {
            eprintln!("\nRunning event-tree Monte Carlo simulation...");
            eprintln!("Trials: {}", effective_trials);
            eprintln!("Seed: {}", cli.seed);
            if cli.optimize {
                if let Some(params) = explicit_params {
                    let backend_name = match backend {
                        Backend::Cpu => "CPU",
                        Backend::Cuda => "CUDA",
                        Backend::Wgpu => "WGPU",
                    };
                    eprintln!(
                        "{} optimize enabled: T={}, B={}, P={}, omega={} (auto-sized)",
                        backend_name, params.t, params.b, params.p, params.omega
                    );
                }
            } else if auto_cuda_num_trials {
                if let Some(params) = explicit_params {
                    eprintln!(
                        "CUDA num-trials auto-optimized: T={}, B={}, P={}, omega={} (auto-sized)",
                        params.t, params.b, params.p, params.omega
                    );
                }
            }
        }

        let mc_analysis = if let Some(params) = explicit_params {
            DpEventTreeMonteCarloAnalysis::with_run_params(
                ie.clone(),
                event_tree.clone(),
                &model,
                params,
            )?
        } else {
            DpEventTreeMonteCarloAnalysis::new(
                ie.clone(),
                event_tree.clone(),
                &model,
                Some(cli.seed),
                cli.num_trials as usize,
            )?
        }
        .with_event_tree_library(&event_tree_library);

        let backend_requested = match backend {
            Backend::Cpu => "cpu",
            Backend::Cuda => "cuda",
            Backend::Wgpu => "wgpu",
        }
        .to_string();

        let convergence = ConvergenceSettings {
            enabled: cli.early_stop,
            delta: cli.delta,
            confidence: cli.confidence,
            burn_in: cli.burn_in,
        };

        let (backend_used, mc_result) = match backend {
            Backend::Cpu => {
                if verbose {
                    eprintln!("Running event-tree Monte Carlo on CPU...");
                }
                let start = std::time::Instant::now();
                let result = mc_analysis
                    .run_cpu_with_watch_and_convergence(cli.watch, convergence)
                    .map_err(|e| format!("Event tree Monte Carlo failed: {}", e))?;
                if verbose {
                    eprintln!("CPU execution time: {:.3}s", start.elapsed().as_secs_f64());
                }
                ("cpu".to_string(), result)
            }
            Backend::Cuda => {
                #[cfg(feature = "cuda")]
                {
                    if verbose {
                        eprintln!("Running event-tree Monte Carlo on GPU (CUDA)...");
                    }
                    let start = std::time::Instant::now();
                    let device = Default::default();
                    let result = mc_analysis
                        .run_gpu_with_watch_and_convergence::<CudaRuntime>(
                            &device,
                            cli.watch,
                            convergence,
                        )
                        .map_err(|e| format!("Event tree Monte Carlo failed: {}", e))?;
                    if verbose {
                        eprintln!("GPU execution time: {:.3}s", start.elapsed().as_secs_f64());
                    }
                    ("cuda".to_string(), result)
                }

                #[cfg(not(feature = "cuda"))]
                {
                    return Err(anyhow::anyhow!(
                        "CUDA backend requested but this build was not compiled with CUDA support"
                    )
                    .into());
                }
            }

            Backend::Wgpu => {
                #[cfg(feature = "wgpu")]
                {
                    if verbose {
                        eprintln!("Running event-tree Monte Carlo on GPU (WGPU)...");
                    }
                    let start = std::time::Instant::now();
                    let device = Default::default();
                    let result = mc_analysis
                        .run_gpu_with_watch_and_convergence::<WgpuRuntime>(
                            &device,
                            cli.watch,
                            convergence,
                        )
                        .map_err(|e| format!("Event tree Monte Carlo failed: {}", e))?;
                    if verbose {
                        eprintln!("GPU execution time: {:.3}s", start.elapsed().as_secs_f64());
                    }
                    ("wgpu".to_string(), result)
                }

                #[cfg(not(feature = "wgpu"))]
                {
                    return Err(anyhow::anyhow!(
                        "WGPU backend requested but this build was not compiled with WGPU support"
                    )
                    .into());
                }
            }
        };

        if cli.print || verbose {
            println!("\n=== Event Tree Monte Carlo Results ===");
            println!("Event Tree: {}", event_tree.id);
            println!("Initiating Event: {}", ie.id);
            println!("Number of Trials: {}", mc_result.num_trials);
            if let Some(prob) = ie.probability {
                println!("IE Probability: {:.6e}", prob);
            }
            if let Some(freq) = ie.frequency {
                println!("IE Frequency: {:.6e} /year", freq);
            }
            println!("\nSequences:");
            println!(
                "{:<20} {:<15} {:<15} {:<12}",
                "Sequence ID", "Probability", "Frequency", "Successes"
            );
            println!("{}", "-".repeat(70));

            for seq in &mc_result.sequences {
                println!(
                    "{:<20} {:<15.6e} {:<15.6e} {}/{}",
                    seq.sequence.id,
                    seq.probability_estimate,
                    seq.frequency_estimate,
                    seq.successes,
                    seq.num_trials
                );
            }
            println!("====================================\n");
        }

        let run_params_for_report = if let Some(params) = explicit_params {
            Some(params)
        } else {
            choose_run_params_for_num_trials(cli.num_trials as usize, cli.seed)
                .ok()
                .map(|layout| layout.params)
        };

        let cfg = praxis::mc::core::MonteCarloRunConfig {
            engine: "dpmc".to_string(),
            target: "event-tree".to_string(),
            backend_requested,
            backend_used: backend_used.clone(),
            seed: cli.seed,
            num_trials_requested: effective_trials,
            run_params: run_params_for_report,
            early_stop: cli.early_stop.then_some(true),
            delta: cli.early_stop.then_some(cli.delta),
            burn_in: cli.early_stop.then_some(cli.burn_in),
            confidence: cli.early_stop.then_some(cli.confidence),
            policy: cli.early_stop.then_some("wald-linear+log10".to_string()),
        };

        computed_event_tree_monte_carlo.push(EventTreeMonteCarloReport {
            event_tree_id: event_tree.id.clone(),
            initiating_event_id: ie.id.clone(),
            initiating_event_probability: ie.probability,
            initiating_event_frequency: ie.frequency,
            monte_carlo: mc_result.clone(),
            monte_carlo_config: Some(cfg),
        });
    }

    let dummy_ft_id = event_trees
        .first()
        .map(|et| et.id.as_str())
        .unwrap_or("event-tree");
    let dummy_fault_tree = FaultTree::new(dummy_ft_id, dummy_ft_id)?;
    let dummy_result = praxis::analysis::fault_tree::AnalysisResult {
        top_event_probability: 0.0,
        gates_analyzed: 0,
        basic_events_count: 0,
    };

    let total_gates: usize = model
        .fault_trees()
        .values()
        .map(|ft| ft.gates().len())
        .sum();
    let total_basic_events: usize = model.basic_events().len();

    let report = AnalysisReport::new(dummy_result)
        .without_fault_tree_analysis()
        .with_model_features(total_gates, total_basic_events)
        .with_event_tree_monte_carlo(computed_event_tree_monte_carlo);

    if let Some(ref output_path) = cli.output_file {
        if verbose {
            eprintln!("Writing results to: {}", output_path.display());
        }
        let mut writer = writer_vec();
        write_comprehensive_report(&mut writer, &dummy_fault_tree, &report)?;
        let xml_output = String::from_utf8(writer.into_inner())
            .map_err(|e| format!("Failed to convert XML to string: {}", e))?;
        fs::write(output_path, xml_output)
            .map_err(|e| format!("Failed to write output file: {}", e))?;
        if verbose {
            eprintln!("Results written successfully");
        }
    }

    if !cli.print && cli.output_file.is_none() {
        let mut writer = writer_stdout();
        write_comprehensive_report(&mut writer, &dummy_fault_tree, &report)?;
    }

    Ok(())
}

pub fn run_monte_carlo_from_parsed(
    cli: &Args,
    parsed: &EventTreeModel,
    verbose: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let (model, initiating_events, event_trees, event_tree_library) =
        parse_model_with_libs_from_parsed(parsed)?;
    run_monte_carlo_impl(
        cli,
        model,
        initiating_events,
        event_trees,
        event_tree_library,
        verbose,
    )
}

fn run_analytic_impl(
    cli: &Args,
    model: praxis::core::model::Model,
    initiating_events: Vec<InitiatingEvent>,
    event_trees: Vec<praxis::core::event_tree::EventTree>,
    event_tree_library: HashMap<String, praxis::core::event_tree::EventTree>,
    algorithm: Algorithm,
    verbose: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    if cli.validate {
        if verbose {
            eprintln!("Validation successful - input file is valid OpenPSA MEF format");
        }
        return Ok(());
    }

    if verbose {
        eprintln!(
            "Parsed model with {} fault trees",
            model.fault_trees().len()
        );
        eprintln!("Initiating events: {}", initiating_events.len());
        eprintln!("Event trees: {}", event_trees.len());
    }

    let algorithm_name = match algorithm {
        Algorithm::Bdd => "bdd",
        Algorithm::Zbdd => "zbdd",
        _ => "bdd",
    };

    let pairs = select_event_trees_to_run(&initiating_events, &event_trees)?;
    let mut analytic_reports: Vec<EventTreeAnalyticReport> = Vec::new();
    let graphviz_ok = !cli.visualize || praxis::analysis::visualize::graphviz_available();

    let mut all_event_probs: HashMap<String, f64> = HashMap::new();
    for ft in model.fault_trees().values() {
        for (id, ev) in ft.basic_events() {
            all_event_probs.insert(id.clone(), ev.probability());
        }
    }

    for (ie, event_tree) in pairs {
        if verbose {
            eprintln!(
                "\nRunning analytic event-tree analysis ({}) for '{}'...",
                algorithm_name, event_tree.id
            );
        }

        let ie_frequency = ie.frequency.unwrap_or(1.0);

        if cli.visualize {
            let et_dot = praxis::analysis::visualize::generate_event_tree_dot(&event_tree, &ie.id);
            crate::cli::visualization::save_outputs(
                cli,
                &et_dot,
                &format!("{}_tree", event_tree.id),
                "event-tree visualization",
                verbose,
                graphviz_ok,
            );
        }

        let sequences: Vec<EventTreeAnalyticSequence> = if algorithm == Algorithm::Zbdd {
            let has_approx = cli.approximation.is_some();

            match (has_approx, cli.interactive_truncation) {
                (false, true) => analytic_zbdd_wf1_no_approx_no_limits(
                    cli,
                    &model,
                    &event_tree,
                    &event_tree_library,
                    &ie,
                    ie_frequency,
                    verbose,
                )?,
                (true, true) => analytic_zbdd_wf2_approx_no_limits(
                    cli,
                    &model,
                    &event_tree,
                    &event_tree_library,
                    &ie,
                    ie_frequency,
                    verbose,
                )?,
                (false, false) => analytic_zbdd_wf3_no_approx_limits(
                    cli,
                    &model,
                    &event_tree,
                    &event_tree_library,
                    &ie,
                    ie_frequency,
                    verbose,
                )?,
                (true, false) => analytic_zbdd_wf4_approx_limits(
                    cli,
                    &model,
                    &event_tree,
                    &event_tree_library,
                    &ie,
                    ie_frequency,
                    verbose,
                )?,
            }
        } else {
            let praxis::analysis::sequence_formula::SequenceFormulas {
                mut pdag,
                sequence_roots,
                sequence_success_roots: _,
                unconditional,
                event_probs,
                ie_frequency: _,
            } = SequenceFormulaBuilder::new(&model)
                .with_complement_unity(cli.complement_unity)
                .with_delete_term(cli.delete_term)
                .with_saphire_success(cli.saphire_success)
                .with_event_tree_library(&event_tree_library)
                .build(&event_tree, ie_frequency)
                .map_err(|e| {
                    format!(
                        "Sequence formula construction failed for '{}': {}",
                        event_tree.id, e
                    )
                })?;

            let mut all_seq_ids: Vec<String> = sequence_roots.keys().cloned().collect();
            for id in &unconditional {
                if !sequence_roots.contains_key(id.as_str()) {
                    all_seq_ids.push(id.clone());
                }
            }
            all_seq_ids.sort();

            let mut seqs: Vec<EventTreeAnalyticSequence> = Vec::new();
            for seq_id in &all_seq_ids {
                let probability = if unconditional.contains(seq_id) {
                    1.0
                } else if let Some(&root_idx) = sequence_roots.get(seq_id.as_str()) {
                    pdag.set_root(root_idx)
                        .map_err(|e| format!("BDD root error for '{}': {}", seq_id, e))?;
                    let (_order, bdd, bdd_root) =
                        praxis::algorithms::build::build_sequence_bdd(&pdag, &event_probs)
                            .map_err(|e| format!("BDD build failed for '{}': {}", seq_id, e))?;
                    bdd.probability(bdd_root)
                } else {
                    0.0
                };
                seqs.push(EventTreeAnalyticSequence {
                    sequence_id: seq_id.clone(),
                    path: vec![],
                    probability,
                    frequency: probability * ie_frequency,
                    cut_sets: Vec::new(),
                    order_dist: HashMap::new(),
                });
            }
            seqs
        };

        if cli.print || verbose {
            println!("\n=== Event Tree Analytic Results ===");
            println!("Event Tree: {}", event_tree.id);
            println!("Initiating Event: {}", ie.id);
            println!("Algorithm: {}", algorithm_name);
            if let Some(prob) = ie.probability {
                println!("IE Probability: {:.6e}", prob);
            }
            if let Some(freq) = ie.frequency {
                println!("IE Frequency: {:.6e} /year", freq);
            }
            println!("\nSequences:");
            println!(
                "{:<20} {:<15} {:<15}",
                "Sequence ID", "Probability", "Frequency"
            );
            println!("{}", "-".repeat(55));
            for seq in &sequences {
                println!(
                    "{:<20} {:<15.6e} {:<15.6e}",
                    seq.sequence_id, seq.probability, seq.frequency
                );
            }
            println!("===================================");

            let has_stats = sequences.iter().any(|s| !s.order_dist.is_empty());
            if has_stats {
                println!("\n=== Minimal Cut-Set Counts per Sequence ===");
                for seq in &sequences {
                    if seq.order_dist.is_empty() {
                        continue;
                    }
                    let total: u64 = seq.order_dist.values().sum();
                    println!("  {:<18} total={}", seq.sequence_id, total);
                }
                println!("===========================================\n");
            } else {
                println!();
            }
        }

        analytic_reports.push(EventTreeAnalyticReport {
            event_tree_id: event_tree.id.clone(),
            initiating_event_id: ie.id.clone(),
            initiating_event_probability: ie.probability,
            initiating_event_frequency: ie.frequency,
            algorithm: algorithm_name.to_string(),
            sequences,
        });
    }

    let dummy_ft_id = event_trees
        .first()
        .map(|et| et.id.as_str())
        .unwrap_or("event-tree");
    let dummy_fault_tree = FaultTree::new(dummy_ft_id, dummy_ft_id)?;
    let dummy_result = praxis::analysis::fault_tree::AnalysisResult {
        top_event_probability: 0.0,
        gates_analyzed: 0,
        basic_events_count: 0,
    };

    let total_gates: usize = model
        .fault_trees()
        .values()
        .map(|ft| ft.gates().len())
        .sum();
    let total_basic_events: usize = model.basic_events().len();

    let report = AnalysisReport::new(dummy_result)
        .without_fault_tree_analysis()
        .with_model_features(total_gates, total_basic_events)
        .with_event_tree_analytic(analytic_reports);

    if let Some(ref output_path) = cli.output_file {
        if verbose {
            eprintln!("Writing results to: {}", output_path.display());
        }
        let mut writer = writer_vec();
        write_comprehensive_report(&mut writer, &dummy_fault_tree, &report)?;
        let xml_output = String::from_utf8(writer.into_inner())
            .map_err(|e| format!("Failed to convert XML to string: {}", e))?;
        fs::write(output_path, xml_output)
            .map_err(|e| format!("Failed to write output file: {}", e))?;
        if verbose {
            eprintln!("Results written successfully");
        }
    }

    if !cli.print && cli.output_file.is_none() {
        let mut writer = writer_stdout();
        write_comprehensive_report(&mut writer, &dummy_fault_tree, &report)?;
    }

    Ok(())
}

pub fn run_analytic_from_parsed(
    cli: &Args,
    parsed: &EventTreeModel,
    algorithm: Algorithm,
    verbose: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let (model, initiating_events, event_trees, event_tree_library) =
        parse_model_with_libs_from_parsed(parsed)?;
    run_analytic_impl(
        cli,
        model,
        initiating_events,
        event_trees,
        event_tree_library,
        algorithm,
        verbose,
    )
}

/// Build named end-state cut-set families in one shared ZBDD manager. This
/// does not quantify end-state probability or write SAPHIRE end-state records.
pub fn run_end_state_from_parsed(
    cli: &Args,
    parsed: &EventTreeModel,
    verbose: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let map_path = cli
        .end_state_map
        .as_ref()
        .ok_or("missing --end-state-map")?;
    let mut end_states = HashMap::<String, String>::new();
    for (number, raw) in fs::read_to_string(map_path)?.lines().enumerate() {
        if raw.is_empty() || raw.starts_with('#') {
            continue;
        }
        let (sequence, end_state) = raw
            .split_once('\t')
            .ok_or_else(|| format!("end-state map line {} must contain one tab", number + 1))?;
        if end_state.contains('\t') || sequence.trim().is_empty() {
            return Err(format!("invalid end-state map line {}", number + 1).into());
        }
        if end_states
            .insert(sequence.trim().to_string(), end_state.trim().to_string())
            .is_some()
        {
            return Err(
                format!("duplicate sequence '{}' in end-state map", sequence.trim()).into(),
            );
        }
    }
    let (model, initiating_events, event_trees, library) =
        parse_model_with_libs_from_parsed(parsed)?;
    let pairs = select_event_trees_to_run(&initiating_events, &event_trees)?;
    if pairs.len() != 1 {
        return Err("zbdd-end-state requires exactly one event tree per input".into());
    }
    let (ie, event_tree) = pairs.into_iter().next().unwrap();
    if cli.validate {
        return Ok(());
    }
    let formulas = SequenceFormulaBuilder::new(&model)
        .with_complement_unity(cli.complement_unity)
        .with_delete_term(cli.delete_term)
        .with_saphire_success(cli.saphire_success)
        .with_event_tree_library(&library)
        .build(&event_tree, ie.frequency.unwrap_or(1.0))?;
    let mut sequence_ids: Vec<String> = formulas.sequence_roots.keys().cloned().collect();
    for id in &formulas.unconditional {
        if !formulas.sequence_roots.contains_key(id) {
            sequence_ids.push(id.clone());
        }
    }
    sequence_ids.sort();
    let known_ids: HashSet<&str> = sequence_ids.iter().map(String::as_str).collect();
    for id in end_states.keys() {
        if !known_ids.contains(id.as_str()) {
            return Err(format!("end-state map contains unknown sequence '{}'", id).into());
        }
    }
    let scale = truncation_scale(cli.cut_off_basis, ie.frequency.unwrap_or(1.0));
    let mut jobs = Vec::new();
    for id in &sequence_ids {
        let end_state = end_states
            .get(id)
            .ok_or_else(|| format!("sequence '{}' is missing from end-state map", id))?;
        // SAPHIRE permits sequences without an assigned end state. They do not
        // belong to any named aggregate; the explicit blank map row skips them.
        if end_state.is_empty() {
            continue;
        }
        let unconditional = formulas.unconditional.contains(id);
        jobs.push(praxis::algorithms::direct_zbdd::EndStateSequence {
            end_state: end_state.clone(),
            failure_root: if unconditional {
                None
            } else {
                Some(
                    *formulas
                        .sequence_roots
                        .get(id)
                        .ok_or_else(|| format!("sequence '{}' has no cut-set formula", id))?,
                )
            },
            success_roots: if unconditional {
                Vec::new()
            } else {
                formulas
                    .sequence_success_roots
                    .get(id)
                    .cloned()
                    .unwrap_or_default()
            },
        });
    }
    if verbose {
        eprintln!("aggregating {} sequences by end state", jobs.len());
    }
    let (engine, groups, names) =
        praxis::algorithms::direct_zbdd::build_end_state_zbdd_from_pdag_with_order(
            &formulas.pdag,
            &formulas.event_probs,
            &jobs,
            cli.cut_off,
            cli.limit_order.map(|order| order as usize),
            scale,
            cli.effective_variable_order(),
            cli.reorder_budget(),
        )?;
    let aggregate = EndStateZbdd::from_shared(engine, names, groups)?;

    let destination: Box<dyn Write> = if let Some(path) = &cli.output_file {
        Box::new(BufWriter::new(fs::File::create(path)?))
    } else {
        Box::new(BufWriter::new(std::io::stdout()))
    };
    let mut writer = Writer::new(destination);
    writer.write_event(Event::Decl(BytesDecl::new("1.0", Some("UTF-8"), None)))?;
    let mut document = BytesStart::new("end-state-cut-sets");
    document.push_attribute(("event-tree", event_tree.id.as_str()));
    document.push_attribute(("algorithm", "zbdd-end-state"));
    writer.write_event(Event::Start(document))?;
    for (name, root) in aggregate.groups() {
        let count = aggregate
            .engine()
            .count_by_order(root)
            .values()
            .fold(0_u64, |sum, count| sum.saturating_add(*count));
        let count_text = count.to_string();
        let nodes_text = aggregate.engine().reachable_count(root).to_string();
        let mut group = BytesStart::new("end-state");
        group.push_attribute(("name", name));
        group.push_attribute(("cut-sets", count_text.as_str()));
        group.push_attribute(("zbdd-nodes", nodes_text.as_str()));
        writer.write_event(Event::Start(group))?;
        if !cli.cut_set_stats_only {
            write_end_state_products(&mut writer, &aggregate, root, &mut Vec::new())?;
        }
        writer.write_event(Event::End(BytesEnd::new("end-state")))?;
        eprintln!("end-state {name}: {count} minimal cut sets, {nodes_text} ZBDD nodes");
    }
    writer.write_event(Event::End(BytesEnd::new("end-state-cut-sets")))?;
    Ok(())
}

fn write_end_state_products(
    writer: &mut Writer<Box<dyn Write>>,
    aggregate: &EndStateZbdd,
    root: ZbddRef,
    path: &mut Vec<usize>,
) -> Result<(), Box<dyn std::error::Error>> {
    if root == ZBDD_EMPTY {
        return Ok(());
    }
    if root == ZBDD_BASE {
        writer.write_event(Event::Start(BytesStart::new("cut-set")))?;
        for &variable in path.iter() {
            let mut event = BytesStart::new("basic-event");
            event.push_attribute(("name", aggregate.variable_names()[variable].as_str()));
            writer.write_event(Event::Empty(event))?;
        }
        writer.write_event(Event::End(BytesEnd::new("cut-set")))?;
        return Ok(());
    }
    let node = aggregate.engine().node(root);
    write_end_state_products(writer, aggregate, node.low, path)?;
    path.push(node.var);
    write_end_state_products(writer, aggregate, node.high, path)?;
    path.pop();
    Ok(())
}

fn select_event_trees_to_run(
    initiating_events: &[InitiatingEvent],
    event_trees: &[praxis::core::event_tree::EventTree],
) -> Result<Vec<(InitiatingEvent, praxis::core::event_tree::EventTree)>, Box<dyn std::error::Error>>
{
    let mut seen_et_ids: HashSet<String> = HashSet::new();
    let mut referenced: Vec<(InitiatingEvent, praxis::core::event_tree::EventTree)> = Vec::new();
    for ie in initiating_events {
        let Some(et_id) = &ie.event_tree_id else {
            continue;
        };
        if !seen_et_ids.insert(et_id.clone()) {
            continue;
        }
        let et = event_trees
            .iter()
            .find(|et| &et.id == et_id)
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "Initiating event '{}' references missing event tree '{}'",
                    ie.id,
                    et_id
                )
            })?;
        referenced.push((ie.clone(), et.clone()));
    }
    if !referenced.is_empty() {
        return Ok(referenced);
    }

    let pairs = event_trees
        .iter()
        .enumerate()
        .map(|(et_idx, event_tree)| {
            let ie = if !initiating_events.is_empty() {
                initiating_events[et_idx.min(initiating_events.len() - 1)].clone()
            } else {
                InitiatingEvent::new("default-ie".to_string())
            };
            (ie, event_tree.clone())
        })
        .collect();
    Ok(pairs)
}
