use std::collections::HashMap;
use std::time::Duration;

use crate::algorithms::bdd_engine::Bdd;
use crate::algorithms::bdd_pdag::BddPdag;
use crate::algorithms::mocus::Mocus;
use crate::algorithms::reorder::{best_order, ReorderMethod};
use crate::algorithms::zbdd_engine::{ZbddEngine, ZbddRef};
use crate::analysis::importance::{ImportanceAnalysis, ImportanceRecord};
use crate::analysis::labelled_zbdd;
use crate::analysis::sil::Sil;
use crate::analysis::ternary_dd;
use crate::analysis::uncertainty::{propagate_uncertainty, UncertaintyAnalysis};
use crate::core::fault_tree::FaultTree;
use crate::mc::DpMonteCarloAnalysis;
use crate::Result;

use crate::boolean::builder::{
    build_root_fault_tree, is_gate_node, numeric_basic_event_id, BindingIndex,
};
use crate::boolean::contract::{
    Approximation, BasicEventBindingTable, BooleanModel, CcfGroupTable, CutSet, CutSetLiteral,
    CutSetResult, EndStateQuantification, FaultTreeQuantification, ImportanceMeasureResult,
    ProbabilityResult, QuantificationResult, QuantificationSettings, Quantile,
    SafetyIntegrityLevelResult, SequenceQuantification, SolverTarget, UncertaintyResult,
    VariableOrdering,
};

const DEFAULT_NUM_TRIALS: usize = 10_000;
const DEFAULT_SEED: u64 = 847;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum EngineChoice {
    Bdd,
    Zbdd,
    Mocus,
    MonteCarlo,
    PiZbdd,
    PiTdd,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ApproxChoice {
    RareEvent,
    Mcub,
}

struct Resolved {
    engine: EngineChoice,
    approximation: Option<ApproxChoice>,
    probability: bool,
    importance: bool,
    uncertainty: bool,
    ccf: bool,
    sil: bool,
    limit_order: Option<usize>,
    cut_off: Option<f64>,
    num_trials: usize,
    seed: u64,
    reorder: Option<ReorderMethod>,
    reorder_budget: Duration,
}

const DEFAULT_REORDER_BUDGET_SECONDS: f64 = 10.0;

fn resolve(settings: &QuantificationSettings) -> Resolved {
    let engine = if settings.prime_implicants_tdd.unwrap_or(false) {
        EngineChoice::PiTdd
    } else if settings.prime_implicants.unwrap_or(false) {
        EngineChoice::PiZbdd
    } else if settings.mocus.unwrap_or(false) {
        EngineChoice::Mocus
    } else if settings.bdd.unwrap_or(false) {
        EngineChoice::Bdd
    } else if settings.zbdd.unwrap_or(false) {
        EngineChoice::Zbdd
    } else if settings.monte_carlo.unwrap_or(false) {
        EngineChoice::MonteCarlo
    } else {
        EngineChoice::Bdd
    };
    let approximation = if settings.rare_event.unwrap_or(false) {
        Some(ApproxChoice::RareEvent)
    } else if settings.mcub.unwrap_or(false) {
        Some(ApproxChoice::Mcub)
    } else {
        None
    };
    Resolved {
        engine,
        approximation,
        probability: settings.probability.unwrap_or(true),
        importance: settings.importance.unwrap_or(false),
        uncertainty: settings.uncertainty.unwrap_or(false),
        ccf: settings.ccf.unwrap_or(false),
        sil: settings.sil.unwrap_or(false),
        limit_order: settings.limit_order.map(|n| n as usize),
        cut_off: settings.cut_off,
        num_trials: settings
            .num_trials
            .map(|n| n.max(1) as usize)
            .unwrap_or(DEFAULT_NUM_TRIALS),
        seed: settings.seed.unwrap_or(DEFAULT_SEED),
        reorder: settings.reorder.map(|v| match v {
            VariableOrdering::Sift => ReorderMethod::Sift,
            VariableOrdering::Gsift => ReorderMethod::Gsift,
            VariableOrdering::Ils => ReorderMethod::Ils,
        }),
        reorder_budget: Duration::from_secs_f64(
            settings
                .reorder_budget_seconds
                .filter(|s| s.is_finite() && *s > 0.0)
                .unwrap_or(DEFAULT_REORDER_BUDGET_SECONDS),
        ),
    }
}

fn prepared_bdd_pdag(fault_tree: &FaultTree, resolved: &Resolved) -> Result<BddPdag> {
    let mut pdag = BddPdag::from_fault_tree(fault_tree)?;
    pdag.compute_ordering_and_modules()?;
    if let Some(method) = resolved.reorder {
        let order = best_order(&pdag, method, resolved.reorder_budget);
        pdag.set_variable_order(order);
    }
    Ok(pdag)
}

#[derive(Default)]
struct RootOutcome {
    probability: Option<ProbabilityResult>,
    cut_sets: Option<CutSetResult>,
    importance: Option<Vec<ImportanceMeasureResult>>,
    uncertainty: Option<UncertaintyResult>,
}

fn exact_probability(value: f64) -> ProbabilityResult {
    ProbabilityResult {
        value,
        exact_probability: Some(value),
        approximation: Some(Approximation::Exact),
        ..Default::default()
    }
}

fn approx_probability(value: f64, approximation: Approximation) -> ProbabilityResult {
    ProbabilityResult {
        value,
        approximate_probability: Some(value),
        approximation: Some(approximation),
        ..Default::default()
    }
}

fn set_probability(events: &[String], fault_tree: &FaultTree) -> f64 {
    events
        .iter()
        .map(|event| {
            fault_tree
                .get_basic_event(event)
                .map(|basic| basic.probability())
                .unwrap_or(0.0)
        })
        .product()
}

fn rare_event_value(event_sets: &[Vec<String>], fault_tree: &FaultTree) -> f64 {
    event_sets
        .iter()
        .map(|set| set_probability(set, fault_tree))
        .sum::<f64>()
        .min(1.0)
}

fn mcub_value(event_sets: &[Vec<String>], fault_tree: &FaultTree) -> f64 {
    1.0 - event_sets
        .iter()
        .map(|set| 1.0 - set_probability(set, fault_tree))
        .product::<f64>()
}

fn enumerate_event_sets(zbdd: &ZbddEngine, root: ZbddRef, pdag: &BddPdag) -> Vec<Vec<String>> {
    let var_order = pdag.variable_order().to_vec();
    zbdd.enumerate(root)
        .iter()
        .map(|set| {
            let mut events: Vec<String> = set
                .iter()
                .filter_map(|&pos| {
                    var_order
                        .get(pos)
                        .and_then(|&idx| pdag.node(idx))
                        .and_then(|node| node.id().map(|id| id.to_string()))
                })
                .collect();
            events.sort();
            events
        })
        .collect()
}

fn cut_set_result(event_sets: &[Vec<String>], fault_tree: &FaultTree) -> CutSetResult {
    let mut list = Vec::with_capacity(event_sets.len());
    let mut max_order = 0usize;
    for events in event_sets {
        let order = events.len();
        max_order = max_order.max(order);
        list.push(CutSet {
            order,
            literals: events
                .iter()
                .map(|event| CutSetLiteral {
                    basic_event_id: numeric_basic_event_id(event).unwrap_or(0),
                    negated: false,
                })
                .collect(),
            probability: Some(set_probability(events, fault_tree)),
            contribution: None,
        });
    }
    let mut distribution = vec![0usize; max_order + 1];
    for cut_set in &list {
        distribution[cut_set.order] += 1;
    }
    CutSetResult {
        products: list.len(),
        distribution_by_order: Some(distribution),
        list: Some(list),
        ..Default::default()
    }
}

fn importance_results(records: Vec<ImportanceRecord>) -> Vec<ImportanceMeasureResult> {
    records
        .into_iter()
        .map(|record| ImportanceMeasureResult {
            basic_event_id: numeric_basic_event_id(&record.event_id).unwrap_or(0),
            fussell_vesely: Some(record.factors.dif),
            risk_achievement_worth: Some(record.factors.raw),
            risk_reduction_worth: Some(record.factors.rrw),
            birnbaum: Some(record.factors.mif),
            criticality: Some(record.factors.cif),
        })
        .collect()
}

fn uncertainty_result(analysis: &UncertaintyAnalysis) -> UncertaintyResult {
    let values = analysis.quantiles();
    let quantiles = if values.is_empty() {
        None
    } else {
        Some(
            values
                .iter()
                .enumerate()
                .map(|(i, value)| Quantile {
                    fraction: (i + 1) as f64 / values.len() as f64,
                    value: *value,
                })
                .collect(),
        )
    };
    UncertaintyResult {
        mean: analysis.mean(),
        standard_deviation: Some(analysis.sigma()),
        error_factor: Some(analysis.error_factor()),
        quantiles,
        ..Default::default()
    }
}

fn run_root(fault_tree: &FaultTree, resolved: &Resolved) -> Result<RootOutcome> {
    let mut outcome = RootOutcome::default();

    match resolved.engine {
        EngineChoice::Bdd => {
            let pdag = prepared_bdd_pdag(fault_tree, resolved)?;
            let (bdd, root) = Bdd::build_from_pdag(&pdag)?;
            if resolved.probability {
                let value = if resolved.limit_order.is_some() || resolved.cut_off.is_some() {
                    bdd.probability_with_limits(root, resolved.limit_order, resolved.cut_off)
                } else {
                    bdd.probability(root)
                };
                outcome.probability = Some(exact_probability(value));
            }
        }
        EngineChoice::Zbdd => {
            let pdag = prepared_bdd_pdag(fault_tree, resolved)?;
            let (mut bdd, root) = Bdd::build_from_pdag(&pdag)?;
            let exact = if resolved.probability && resolved.approximation.is_none() {
                Some(bdd.probability(root))
            } else {
                None
            };
            bdd.freeze();
            let (zbdd, zbdd_root) = if resolved.limit_order.is_some() || resolved.cut_off.is_some()
            {
                ZbddEngine::build_from_bdd_with_limits(
                    &bdd,
                    root,
                    false,
                    resolved.limit_order,
                    resolved.cut_off,
                )
            } else {
                ZbddEngine::build_from_bdd(&bdd, root, false)
            };
            let event_sets = enumerate_event_sets(&zbdd, zbdd_root, &pdag);
            outcome.cut_sets = Some(cut_set_result(&event_sets, fault_tree));
            if resolved.probability {
                outcome.probability = Some(match resolved.approximation {
                    Some(ApproxChoice::RareEvent) => approx_probability(
                        zbdd.rare_event_probability(zbdd_root),
                        Approximation::RareEvent,
                    ),
                    Some(ApproxChoice::Mcub) => approx_probability(
                        zbdd.min_cut_upper_bound_graph(zbdd_root),
                        Approximation::Mcub,
                    ),
                    None => exact_probability(exact.unwrap_or(f64::NAN)),
                });
            }
        }
        EngineChoice::Mocus => {
            let mut mocus = Mocus::new(fault_tree);
            if let Some(limit) = resolved.limit_order {
                mocus = mocus.with_max_order(limit);
            }
            let analyzed = mocus.analyze()?.to_vec();
            let original = analyzed.len();
            let mut event_sets: Vec<Vec<String>> = analyzed
                .iter()
                .map(|cut_set| {
                    let mut events: Vec<String> = cut_set.events.iter().cloned().collect();
                    events.sort();
                    events
                })
                .collect();
            if let Some(cut_off) = resolved.cut_off {
                event_sets.retain(|set| set_probability(set, fault_tree) >= cut_off);
            }
            let mut cut_sets = cut_set_result(&event_sets, fault_tree);
            if event_sets.len() != original {
                cut_sets.original_products = Some(original);
            }
            outcome.cut_sets = Some(cut_sets);
            if resolved.probability {
                if let Some(approximation) = resolved.approximation {
                    outcome.probability = Some(match approximation {
                        ApproxChoice::RareEvent => approx_probability(
                            rare_event_value(&event_sets, fault_tree),
                            Approximation::RareEvent,
                        ),
                        ApproxChoice::Mcub => approx_probability(
                            mcub_value(&event_sets, fault_tree),
                            Approximation::Mcub,
                        ),
                    });
                }
            }
        }
        EngineChoice::MonteCarlo => {
            let analysis =
                DpMonteCarloAnalysis::new(fault_tree, Some(resolved.seed), resolved.num_trials)?;
            let mc = analysis.run_cpu()?;
            if resolved.probability {
                outcome.probability = Some(approx_probability(
                    mc.probability_estimate,
                    Approximation::MonteCarlo,
                ));
            }
        }
        EngineChoice::PiZbdd => {
            prime_implicant_outcome(fault_tree, resolved, false, &mut outcome)?;
        }
        EngineChoice::PiTdd => {
            prime_implicant_outcome(fault_tree, resolved, true, &mut outcome)?;
        }
    }

    if resolved.importance {
        if let Some(p_top) = outcome
            .probability
            .as_ref()
            .map(|p| p.value)
            .filter(|p| p.is_finite() && *p > 0.0)
        {
            let records = ImportanceAnalysis::new(fault_tree, p_top)?.analyze()?;
            outcome.importance = Some(importance_results(records));
        }
    }

    if resolved.uncertainty {
        let analysis = propagate_uncertainty(fault_tree, resolved.num_trials, Some(resolved.seed))?;
        outcome.uncertainty = Some(uncertainty_result(&analysis));
    }

    Ok(outcome)
}

fn prime_implicant_outcome(
    fault_tree: &FaultTree,
    resolved: &Resolved,
    use_tdd: bool,
    outcome: &mut RootOutcome,
) -> Result<()> {
    let pdag = prepared_bdd_pdag(fault_tree, resolved)?;
    let (mut bdd, root) = Bdd::build_from_pdag(&pdag)?;
    let exact = if resolved.probability && resolved.approximation.is_none() {
        Some(bdd.probability(root))
    } else {
        None
    };
    let var_order = pdag.variable_order().to_vec();
    let n = var_order.len();
    let var_prob: Vec<f64> = bdd.var_probs().to_vec();
    let mut var_name: Vec<String> = vec![String::new(); n];
    for (pos, &idx) in var_order.iter().enumerate() {
        if let Some(node) = pdag.node(idx) {
            if let Some(id) = node.id() {
                var_name[pos] = id.to_string();
            }
        }
    }
    let var_event: Vec<i32> = (0..n as i32).map(|i| i + 1).collect();
    let max_order = resolved.limit_order.unwrap_or(usize::MAX);
    let min_prob = resolved.cut_off.unwrap_or(0.0);

    let (extracted, rare_event): (Vec<(Vec<i32>, f64)>, f64) = if use_tdd {
        let (teng, troot) = ternary_dd::prime_tdd(&mut bdd, root);
        let ext = teng.extract(troot, &var_event, &var_prob, max_order, min_prob);
        let re = teng.rare_event_probability(troot, &var_prob);
        (ext, re)
    } else {
        let (mut zeng, zroot) = labelled_zbdd::prime_zbdd(&mut bdd, root);
        let ext = labelled_zbdd::extract(&zeng, zroot, &var_event, &var_prob, max_order, min_prob);
        let mut lit_probs = vec![0.0f64; 2 * n];
        for v in 0..n {
            lit_probs[2 * v] = var_prob[v];
            lit_probs[2 * v + 1] = 1.0 - var_prob[v];
        }
        zeng.set_var_probs(lit_probs);
        let re = zeng.rare_event_probability(zroot);
        (ext, re)
    };

    outcome.cut_sets = Some(signed_cut_set_result(&extracted, &var_name));

    if resolved.probability {
        outcome.probability = Some(match resolved.approximation {
            Some(ApproxChoice::RareEvent) => {
                approx_probability(rare_event, Approximation::RareEvent)
            }
            Some(ApproxChoice::Mcub) => {
                let log_keep: f64 = extracted.iter().map(|(_, p)| (-(*p)).ln_1p()).sum();
                approx_probability(-log_keep.exp_m1(), Approximation::Mcub)
            }
            None => exact_probability(exact.unwrap_or(f64::NAN)),
        });
    }
    Ok(())
}

fn signed_cut_set_result(extracted: &[(Vec<i32>, f64)], var_name: &[String]) -> CutSetResult {
    let mut list = Vec::with_capacity(extracted.len());
    let mut max_order = 0usize;
    for (cube, prob) in extracted {
        let order = cube.len();
        max_order = max_order.max(order);
        let literals = cube
            .iter()
            .map(|&lit| {
                let pos = lit.unsigned_abs() as usize - 1;
                CutSetLiteral {
                    basic_event_id: numeric_basic_event_id(&var_name[pos]).unwrap_or(0),
                    negated: lit < 0,
                }
            })
            .collect();
        list.push(CutSet {
            order,
            literals,
            probability: Some(*prob),
            contribution: None,
        });
    }
    let mut distribution = vec![0usize; max_order + 1];
    for cut_set in &list {
        distribution[cut_set.order] += 1;
    }
    CutSetResult {
        products: list.len(),
        prime_implicants: Some(true),
        distribution_by_order: Some(distribution),
        list: Some(list),
        ..Default::default()
    }
}

pub fn quantify(
    model: &BooleanModel,
    bindings: &BasicEventBindingTable,
    ccf_groups: &CcfGroupTable,
    settings: &QuantificationSettings,
) -> Result<QuantificationResult> {
    let resolved = resolve(settings);
    let index = BindingIndex::new(bindings, settings.mission_time.unwrap_or(1.0));

    let mut result = QuantificationResult {
        boolean_model_ref: model.id,
        solver_name: settings.solver.unwrap_or(SolverTarget::Praxis),
        ..Default::default()
    };

    let mut fault_trees = Vec::new();
    let mut safety_integrity_levels = Vec::new();
    for tree in &model.fault_trees {
        if !is_gate_node(model, tree.top_node_id) {
            continue;
        }
        let fault_tree = build_root_fault_tree(
            model,
            &index,
            ccf_groups,
            &format!("ft{}", tree.id),
            tree.top_node_id,
            resolved.ccf,
        )?;
        let outcome = run_root(&fault_tree, &resolved)?;
        if resolved.sil {
            if let Some(p_top) = outcome
                .probability
                .as_ref()
                .map(|p| p.value)
                .filter(|p| p.is_finite())
            {
                safety_integrity_levels.push(SafetyIntegrityLevelResult {
                    fault_tree_id: tree.id,
                    average_probability: Some(p_top),
                    sil_band: Some(Sil::from_probability(p_top).sil_level() as i32),
                });
            }
        }
        fault_trees.push(FaultTreeQuantification {
            fault_tree_id: tree.id,
            top_node_id: tree.top_node_id,
            top_event_probability: outcome.probability,
            cut_sets: outcome.cut_sets,
            importance: outcome.importance,
            uncertainty: outcome.uncertainty,
        });
    }

    let mut sequences = Vec::new();
    let mut sequence_frequency: HashMap<i64, f64> = HashMap::new();
    for sequence in &model.sequences {
        if !is_gate_node(model, sequence.expression_node_id) {
            continue;
        }
        let fault_tree = build_root_fault_tree(
            model,
            &index,
            ccf_groups,
            &format!("sq{}", sequence.id),
            sequence.expression_node_id,
            resolved.ccf,
        )?;
        let outcome = run_root(&fault_tree, &resolved)?;
        let frequency = outcome
            .probability
            .as_ref()
            .map(|p| p.value)
            .filter(|p| p.is_finite())
            .map(|p| {
                p * index
                    .initiating_frequency(sequence.initiating_event_id)
                    .unwrap_or(1.0)
            });
        if let Some(value) = frequency {
            sequence_frequency.insert(sequence.id, value);
        }
        sequences.push(SequenceQuantification {
            sequence_id: sequence.id,
            initiating_event_id: sequence.initiating_event_id,
            end_state_id: sequence.end_state_id,
            frequency,
            probability: outcome.probability,
            cut_sets: outcome.cut_sets,
            uncertainty: outcome.uncertainty,
        });
    }

    let mut end_states = Vec::new();
    for end_state in &model.end_states {
        let mut quantification = EndStateQuantification {
            end_state_id: end_state.id,
            name: end_state.name.clone(),
            ..Default::default()
        };
        if let Some(aggregation) = end_state.aggregation_node_id {
            if is_gate_node(model, aggregation) {
                let fault_tree = build_root_fault_tree(
                    model,
                    &index,
                    ccf_groups,
                    &format!("es{}", end_state.id),
                    aggregation,
                    resolved.ccf,
                )?;
                let outcome = run_root(&fault_tree, &resolved)?;
                quantification.probability = outcome.probability;
                quantification.uncertainty = outcome.uncertainty;
            }
        }
        let mut frequency = 0.0;
        let mut has_frequency = false;
        for sequence_id in &end_state.sequence_ids {
            if let Some(value) = sequence_frequency.get(sequence_id) {
                frequency += value;
                has_frequency = true;
            }
        }
        if has_frequency {
            quantification.frequency = Some(frequency);
        }
        if !end_state.sequence_ids.is_empty() {
            quantification.contributing_sequence_ids = Some(end_state.sequence_ids.clone());
        }
        end_states.push(quantification);
    }

    if !fault_trees.is_empty() {
        result.fault_trees = Some(fault_trees);
    }
    if !sequences.is_empty() {
        result.sum_of_products = Some(sequences);
    }
    if !end_states.is_empty() {
        result.end_states = Some(end_states);
    }
    if !safety_integrity_levels.is_empty() {
        result.safety_integrity_levels = Some(safety_integrity_levels);
    }
    Ok(result)
}
