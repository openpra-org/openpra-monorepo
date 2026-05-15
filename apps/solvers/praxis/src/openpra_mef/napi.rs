use crate::openpra_mef::addon_json::{
    from_engine_outputs, parse_openpra_json, resolve_openpra_refs, to_engine_inputs,
    validate_openpra_json,
};
use crate::openpra_mef::contracts::{Diagnostic, EngineOutputs, ResolveMode, Severity};
use crate::{PraxisError, Result};
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine as _;
use serde_json::json;
use serde::Deserialize;
use std::any::Any;
use std::collections::{HashMap, HashSet};
use std::time::Instant;

fn is_success_state(state: &str) -> bool {
    matches!(
        state.trim().to_ascii_lowercase().as_str(),
        "success" | "yes" | "true"
    )
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
enum TinyProbabilityThresholdRecipe {
    Default,
    LogSpaceMean,
    GeometricMean,
    HarmonicMean,
}

impl TinyProbabilityThresholdRecipe {
    fn as_label(self) -> &'static str {
        match self {
            TinyProbabilityThresholdRecipe::Default => "default",
            TinyProbabilityThresholdRecipe::LogSpaceMean => "logSpaceMean",
            TinyProbabilityThresholdRecipe::GeometricMean => "geometricMean",
            TinyProbabilityThresholdRecipe::HarmonicMean => "harmonicMean",
        }
    }
}

fn tiny_probability_eta(p_hat_mc: f64, recipe: TinyProbabilityThresholdRecipe) -> f64 {
    let eps = f64::EPSILON;
    let p_hat = if p_hat_mc.is_finite() {
        p_hat_mc.clamp(0.0, 1.0)
    } else {
        0.0
    };

    let a = eps;
    let b = eps * p_hat;

    let eta = match recipe {
        TinyProbabilityThresholdRecipe::Default => a.max(b),
        TinyProbabilityThresholdRecipe::GeometricMean => (a * b).sqrt(),
        TinyProbabilityThresholdRecipe::HarmonicMean => {
            if a > 0.0 && b > 0.0 {
                2.0 * a * b / (a + b)
            } else {
                0.0
            }
        }
        TinyProbabilityThresholdRecipe::LogSpaceMean => {
            if a > 0.0 && b > 0.0 {
                let log10 = (a.log10() + b.log10()) / 2.0;
                10.0_f64.powf(log10)
            } else {
                0.0
            }
        }
    };

    if eta.is_finite() && eta > 0.0 {
        eta.max(f64::MIN_POSITIVE)
    } else {
        f64::MIN_POSITIVE
    }
}

#[derive(Debug, Clone)]
struct SequencePathStep {
    functional_event_id: String,
    state: String,
    probability: Option<f64>,
    collect_formula_negated: Option<bool>,
}

fn find_sequence_path_steps(
    tree: &crate::core::event_tree::EventTree,
    sequence_id: &str,
) -> Option<Vec<SequencePathStep>> {
    fn find_in_branch(
        tree: &crate::core::event_tree::EventTree,
        branch: &crate::core::event_tree::Branch,
        sequence_id: &str,
        visited_named: &mut HashSet<String>,
    ) -> Option<Vec<SequencePathStep>> {
        match &branch.target {
            crate::core::event_tree::BranchTarget::Sequence(id) => {
                if id == sequence_id {
                    Some(Vec::new())
                } else {
                    None
                }
            }
            crate::core::event_tree::BranchTarget::Fork(fork) => {
                for path in &fork.paths {
                    if let Some(mut tail) =
                        find_in_branch(tree, &path.branch, sequence_id, visited_named)
                    {
                        let mut out = Vec::with_capacity(tail.len() + 1);
                        out.push(SequencePathStep {
                            functional_event_id: fork.functional_event_id.clone(),
                            state: path.state.clone(),
                            probability: path.probability,
                            collect_formula_negated: path.collect_formula_negated,
                        });
                        out.append(&mut tail);
                        return Some(out);
                    }
                }
                None
            }
            crate::core::event_tree::BranchTarget::NamedBranch(named_id) => {
                if !visited_named.insert(named_id.clone()) {
                    return None;
                }
                let named = tree.named_branches.get(named_id)?;
                find_in_branch(tree, &named.branch, sequence_id, visited_named)
            }
        }
    }

    let mut visited_named = HashSet::new();
    find_in_branch(tree, &tree.initial_state, sequence_id, &mut visited_named)
}

#[derive(Debug, Clone)]
struct AdaptiveCutSetOutcome {
    cut_sets: Vec<crate::algorithms::mocus::CutSet>,
    tau: f64,
    eta: f64,
    eta_recipe: String,
    max_order: usize,
    relative_error_target: f64,
    max_cut_sets: usize,
    original_cut_sets: usize,
    retained_cut_sets: usize,
    stop_reason: String,
    stop_mcub_relative_error: Option<f64>,
    stop_mcub_partial: Option<f64>,
    dropped_tiny: usize,
    dropped_tau: usize,
    dropped_order: usize,
    p_rare_event: f64,
    p_mcub: f64,
}

fn cut_set_prob_from_ids(
    cut_set: &crate::algorithms::mocus::CutSet,
    prob_by_event_id: &HashMap<String, f64>,
) -> f64 {
    let mut product = 1.0;
    for id in &cut_set.events {
        let Some(&p) = prob_by_event_id.get(id) else {
            return 0.0;
        };
        product *= p;
    }
    product
}

fn combine_and_prune_cut_sets(
    left: Vec<crate::algorithms::mocus::CutSet>,
    right: Vec<crate::algorithms::mocus::CutSet>,
    prob_by_event_id: &HashMap<String, f64>,
    tau: f64,
    eta: f64,
    max_order: usize,
    max_sets: usize,
    dropped_tau: &mut usize,
    dropped_tiny: &mut usize,
    dropped_order: &mut usize,
) -> Vec<crate::algorithms::mocus::CutSet> {
    let mut out_scored: Vec<(f64, crate::algorithms::mocus::CutSet)> = Vec::new();

    for a in &left {
        for b in &right {
            let merged: HashSet<String> = a.events.union(&b.events).cloned().collect();

            if max_order > 0 && merged.len() > max_order {
                *dropped_order += 1;
                continue;
            }

            let cs = crate::algorithms::mocus::CutSet {
                events: merged.into_iter().collect(),
            };

            let p = cut_set_prob_from_ids(&cs, prob_by_event_id);

            if p < eta {
                *dropped_tiny += 1;
                continue;
            }
            if p < tau {
                *dropped_tau += 1;
                continue;
            }

            out_scored.push((p, cs));
        }
    }

    out_scored.sort_by(|a, b| b.0.total_cmp(&a.0));
    if out_scored.len() > max_sets {
        out_scored.truncate(max_sets);
    }

    out_scored.sort_by(|a, b| {
        a.1.order()
            .cmp(&b.1.order())
            .then_with(|| b.0.total_cmp(&a.0))
    });

    let mut kept: Vec<crate::algorithms::mocus::CutSet> = Vec::new();
    'outer: for (_, cs) in out_scored {
        for known in &kept {
            if known.events.is_subset(&cs.events) {
                continue 'outer;
            }
        }
        kept.push(cs);
    }

    kept
}

fn build_i32_probabilities(
    model: &crate::core::model::Model,
    prob_by_event_id: &HashMap<String, f64>,
) -> (HashMap<String, i32>, HashMap<i32, f64>) {
    let mut ids: Vec<String> = model.basic_events().keys().cloned().collect();
    ids.sort();

    let mut event_index: HashMap<String, i32> = HashMap::new();
    let mut probs_i32: HashMap<i32, f64> = HashMap::new();

    for (idx0, id) in ids.into_iter().enumerate() {
        let idx = (idx0 as i32) + 1;
        event_index.insert(id.clone(), idx);
        if let Some(&p) = prob_by_event_id.get(&id) {
            probs_i32.insert(idx, p);
        }
    }

    let mut next = (event_index.len() as i32) + 1;
    let mut all_ids: Vec<&String> = prob_by_event_id.keys().collect();
    all_ids.sort();
    for id in all_ids {
        if event_index.contains_key(id) {
            continue;
        }
        event_index.insert(id.clone(), next);
        probs_i32.insert(next, prob_by_event_id.get(id).copied().unwrap_or(0.0));
        next += 1;
    }

    (event_index, probs_i32)
}

fn cut_set_to_i32(
    cut_set: &crate::algorithms::mocus::CutSet,
    event_index: &mut HashMap<String, i32>,
    probs_i32: &mut HashMap<i32, f64>,
    prob_by_event_id: &HashMap<String, f64>,
) -> Vec<i32> {
    let mut out: Vec<i32> = Vec::with_capacity(cut_set.events.len());
    for id in &cut_set.events {
        if let Some(&idx) = event_index.get(id) {
            out.push(idx);
            continue;
        }
        let idx = (event_index.len() as i32) + 1;
        event_index.insert(id.clone(), idx);
        probs_i32.insert(idx, prob_by_event_id.get(id).copied().unwrap_or(0.0));
        out.push(idx);
    }
    out
}

fn adaptive_cut_sets_for_sequence(
    model: &crate::core::model::Model,
    event_tree_library: &HashMap<String, crate::core::event_tree::EventTree>,
    root_tree: &crate::core::event_tree::EventTree,
    sequence_id: &str,
    p_hat_mc: f64,
    max_order: usize,
    relative_error_target: f64,
    max_cut_sets: usize,
    tiny_recipe: TinyProbabilityThresholdRecipe,
    enumeration_backend: AdaptiveCutSetEnumerationBackend,
) -> Result<Option<AdaptiveCutSetOutcome>> {
    let mut trees_to_search: Vec<&crate::core::event_tree::EventTree> = Vec::new();
    trees_to_search.push(root_tree);
    for tree in event_tree_library.values() {
        trees_to_search.push(tree);
    }

    let mut steps: Option<Vec<SequencePathStep>> = None;
    let mut step_tree: Option<&crate::core::event_tree::EventTree> = None;
    for tree in trees_to_search {
        if let Some(found) = find_sequence_path_steps(tree, sequence_id) {
            steps = Some(found);
            step_tree = Some(tree);
            break;
        }
    }

    let Some(steps) = steps else {
        return Ok(None);
    };
    let Some(step_tree) = step_tree else {
        return Ok(None);
    };

    let mut prob_by_event_id: HashMap<String, f64> = HashMap::new();
    for (id, event) in model.basic_events() {
        prob_by_event_id.insert(id.clone(), event.probability());
    }

    let eta = tiny_probability_eta(p_hat_mc, tiny_recipe);
    let tau = eta;

    let mut combined: Vec<crate::algorithms::mocus::CutSet> =
        vec![crate::algorithms::mocus::CutSet::new(Vec::new())];

    let mut original_cut_sets = 1usize;
    let mut dropped_tau = 0usize;
    let mut dropped_tiny = 0usize;
    let mut dropped_order = 0usize;

    let max_sets_working: usize = 25_000.min(max_cut_sets.max(1));

    for step in steps {
        let normalized_state = step.state.trim().to_ascii_lowercase();
        if normalized_state == "bypass" {
            continue;
        }

        if let Some(p) = step.probability {
            let pseudo_id = format!(
                "__openpra_path_prob::{}::{}",
                step.functional_event_id, step.state
            );
            prob_by_event_id.insert(pseudo_id.clone(), p.clamp(0.0, 1.0));
            let requirement_sets = vec![crate::algorithms::mocus::CutSet::new(vec![pseudo_id])];
            original_cut_sets =
                original_cut_sets.saturating_mul(requirement_sets.len().max(1));
            combined = combine_and_prune_cut_sets(
                combined,
                requirement_sets,
                &prob_by_event_id,
                tau,
                eta,
                max_order,
                max_sets_working,
                &mut dropped_tau,
                &mut dropped_tiny,
                &mut dropped_order,
            );
            continue;
        }

        let select_true = if let Some(negated) = step.collect_formula_negated {
            !negated
        } else {
            is_success_state(&step.state)
        };

        let fe = step_tree.functional_events.get(&step.functional_event_id);

        if select_true {
            if let Some(ft_id) = fe.and_then(|f| f.fault_tree_id.as_deref()) {
                let Some(ft) = model.get_fault_tree(ft_id) else {
                    continue;
                };
                let max_order_opt = (max_order > 0).then_some(max_order);
                let requirement_sets: Vec<crate::algorithms::mocus::CutSet> =
                    match enumeration_backend {
                        AdaptiveCutSetEnumerationBackend::Mocus => {
                            let mut mocus = crate::algorithms::mocus::Mocus::new(ft);
                            if let Some(mo) = max_order_opt {
                                mocus = mocus.with_max_order(mo);
                            }
                            let sets = mocus.analyze()?;
                            sets.to_vec()
                        }
                        AdaptiveCutSetEnumerationBackend::Zbdd => {
                            let mut pdag = crate::algorithms::bdd_pdag::BddPdag::from_fault_tree(ft)?;
                            pdag.compute_ordering_and_modules()?;
                            let (mut bdd_engine, bdd_root) = crate::algorithms::bdd_engine::Bdd::build_from_pdag(&pdag)?;
                            bdd_engine.freeze();
                            let (zbdd, zbdd_root) = crate::algorithms::zbdd_engine::ZbddEngine::build_from_bdd(&bdd_engine, bdd_root, false);
                            let var_order = pdag.variable_order().to_vec();
                            let mut sets: Vec<crate::algorithms::mocus::CutSet> = zbdd
                                .enumerate(zbdd_root)
                                .iter()
                                .map(|set| {
                                    let events: Vec<String> = set
                                        .iter()
                                        .filter_map(|&pos| {
                                            var_order.get(pos)
                                                .and_then(|&idx| pdag.node(idx))
                                                .and_then(|n| n.id().map(|s| s.to_string()))
                                        })
                                        .collect();
                                    crate::algorithms::mocus::CutSet::new(events)
                                })
                                .collect();
                            if let Some(mo) = max_order_opt {
                                sets.retain(|cs| cs.order() <= mo);
                            }
                            if tau > 0.0 {
                                sets.retain(|cs| {
                                    let p: f64 = cs.events.iter()
                                        .map(|e| prob_by_event_id.get(e).copied().unwrap_or(0.0))
                                        .product();
                                    p >= tau
                                });
                                if sets.len() > max_sets_working {
                                    sets.sort_by(|a, b| {
                                        let pa: f64 = a.events.iter().map(|e| prob_by_event_id.get(e).copied().unwrap_or(0.0)).product();
                                        let pb: f64 = b.events.iter().map(|e| prob_by_event_id.get(e).copied().unwrap_or(0.0)).product();
                                        pb.partial_cmp(&pa).unwrap_or(std::cmp::Ordering::Equal)
                                    });
                                    sets.truncate(max_sets_working);
                                }
                            }
                            sets
                        }
                    };
                original_cut_sets =
                    original_cut_sets.saturating_mul(requirement_sets.len().max(1));
                combined = combine_and_prune_cut_sets(
                    combined,
                    requirement_sets,
                    &prob_by_event_id,
                    tau,
                    eta,
                    max_order,
                    max_sets_working,
                    &mut dropped_tau,
                    &mut dropped_tiny,
                    &mut dropped_order,
                );
                continue;
            }

            let p_true = fe
                .and_then(|f| f.success_probability)
                .unwrap_or(0.5)
                .clamp(0.0, 1.0);
            let pseudo_id = format!("__openpra_fe_true::{}", step.functional_event_id);
            prob_by_event_id.insert(pseudo_id.clone(), p_true);
            let requirement_sets = vec![crate::algorithms::mocus::CutSet::new(vec![pseudo_id])];
            original_cut_sets =
                original_cut_sets.saturating_mul(requirement_sets.len().max(1));
            combined = combine_and_prune_cut_sets(
                combined,
                requirement_sets,
                &prob_by_event_id,
                tau,
                eta,
                max_order,
                max_sets_working,
                &mut dropped_tau,
                &mut dropped_tiny,
                &mut dropped_order,
            );
        } else {
            let p_true = if let Some(ft_id) = fe.and_then(|f| f.fault_tree_id.as_deref()) {
                let Some(ft) = model.get_fault_tree(ft_id) else {
                    continue;
                };
                let max_order_opt = (max_order > 0).then_some(max_order);

                let sets: Vec<crate::algorithms::mocus::CutSet> = match enumeration_backend {
                    AdaptiveCutSetEnumerationBackend::Mocus => {
                        let mut mocus = crate::algorithms::mocus::Mocus::new(ft);
                        if let Some(mo) = max_order_opt {
                            mocus = mocus.with_max_order(mo);
                        }
                        let sets = mocus.analyze()?;
                        sets.to_vec()
                    }
                    AdaptiveCutSetEnumerationBackend::Zbdd => {
                        let mut pdag = crate::algorithms::bdd_pdag::BddPdag::from_fault_tree(ft)?;
                        pdag.compute_ordering_and_modules()?;
                        let (mut bdd_engine, bdd_root) = crate::algorithms::bdd_engine::Bdd::build_from_pdag(&pdag)?;
                        bdd_engine.freeze();
                        let (zbdd, zbdd_root) = crate::algorithms::zbdd_engine::ZbddEngine::build_from_bdd(&bdd_engine, bdd_root, false);
                        let var_order = pdag.variable_order().to_vec();
                        let mut sets: Vec<crate::algorithms::mocus::CutSet> = zbdd
                            .enumerate(zbdd_root)
                            .iter()
                            .map(|set| {
                                let events: Vec<String> = set
                                    .iter()
                                    .filter_map(|&pos| {
                                        var_order.get(pos)
                                            .and_then(|&idx| pdag.node(idx))
                                            .and_then(|n| n.id().map(|s| s.to_string()))
                                    })
                                    .collect();
                                crate::algorithms::mocus::CutSet::new(events)
                            })
                            .collect();
                        if let Some(mo) = max_order_opt {
                            sets.retain(|cs| cs.order() <= mo);
                        }
                        sets
                    }
                };

                let mut id_to_idx: HashMap<String, i32> = HashMap::new();
                let mut ids: Vec<String> = model.basic_events().keys().cloned().collect();
                ids.sort();
                for (idx0, id) in ids.into_iter().enumerate() {
                    id_to_idx.insert(id, (idx0 as i32) + 1);
                }

                let mut event_probs: HashMap<i32, f64> = HashMap::new();
                for (id, event) in model.basic_events() {
                    if let Some(&idx) = id_to_idx.get(id) {
                        event_probs.insert(idx, event.probability());
                    }
                }

                let cut_sets_i32: Vec<Vec<i32>> = sets
                    .iter()
                    .map(|cs| {
                        let mut v: Vec<i32> = cs
                            .events
                            .iter()
                            .filter_map(|id| id_to_idx.get(id).copied())
                            .collect();
                        v.sort();
                        v
                    })
                    .collect();

                crate::analysis::approximations::mcub_approximation(&cut_sets_i32, &event_probs)
                    .clamp(0.0, 1.0)
            } else {
                fe.and_then(|f| f.success_probability)
                    .unwrap_or(0.5)
                    .clamp(0.0, 1.0)
            };

            let p_false = (1.0 - p_true).clamp(0.0, 1.0);
            let pseudo_id = format!("__openpra_fe_false::{}", step.functional_event_id);
            prob_by_event_id.insert(pseudo_id.clone(), p_false);
            let requirement_sets = vec![crate::algorithms::mocus::CutSet::new(vec![pseudo_id])];
            original_cut_sets =
                original_cut_sets.saturating_mul(requirement_sets.len().max(1));
            combined = combine_and_prune_cut_sets(
                combined,
                requirement_sets,
                &prob_by_event_id,
                tau,
                eta,
                max_order,
                max_sets_working,
                &mut dropped_tau,
                &mut dropped_tiny,
                &mut dropped_order,
            );
        }
    }

    if combined.len() == 1 && combined[0].events.is_empty() {
        return Ok(None);
    }

    let mut ranked: Vec<(f64, crate::algorithms::mocus::CutSet)> = combined
        .into_iter()
        .map(|cs| (cut_set_prob_from_ids(&cs, &prob_by_event_id), cs))
        .collect();
    ranked.sort_by(|a, b| b.0.total_cmp(&a.0));

    let mut retained_cut_sets: Vec<crate::algorithms::mocus::CutSet> = Vec::new();
    let mut retained_i32: Vec<Vec<i32>> = Vec::new();
    let (mut event_index, mut probs_i32) = build_i32_probabilities(model, &prob_by_event_id);

    let target = relative_error_target.abs();
    let mut running_prod_mcub = 1.0;
    let mut stop_after = ranked.len().min(max_cut_sets.max(1));
    let mut stop_reason = "exhausted".to_string();
    let mut stop_mcub_relative_error: Option<f64> = None;
    let mut stop_mcub_partial: Option<f64> = None;

    for (ix, (score, cs)) in ranked.iter().cloned().take(stop_after).enumerate() {
        retained_cut_sets.push(cs.clone());
        let cs_i32 = cut_set_to_i32(&cs, &mut event_index, &mut probs_i32, &prob_by_event_id);
        let p_cs = crate::analysis::approximations::cut_set_probability(&cs_i32, &probs_i32);
        retained_i32.push(cs_i32);

        running_prod_mcub *= 1.0 - p_cs;
        let p_mcub_partial = (1.0 - running_prod_mcub).clamp(0.0, 1.0);

        if p_hat_mc.is_finite() && p_hat_mc > 0.0 && target.is_finite() {
            let rel_err = ((p_mcub_partial - p_hat_mc).abs()) / p_hat_mc;
            stop_mcub_relative_error = Some(rel_err);
            stop_mcub_partial = Some(p_mcub_partial);

            if rel_err <= target {
                stop_after = ix + 1;
                stop_reason = "relativeErrorMet".to_string();
                break;
            }
        }

        if score < eta {
            stop_after = ix + 1;
            stop_reason = "belowEta".to_string();
            break;
        }
    }

    retained_cut_sets.truncate(stop_after);
    retained_i32.truncate(stop_after);

    let p_rare_event = crate::analysis::approximations::rare_event_approximation(
        &retained_i32,
        &probs_i32,
    );
    let p_mcub = crate::analysis::approximations::mcub_approximation(&retained_i32, &probs_i32);

    Ok(Some(AdaptiveCutSetOutcome {
        cut_sets: retained_cut_sets,
        tau,
        eta,
        eta_recipe: tiny_recipe.as_label().to_string(),
        max_order,
        relative_error_target: target,
        max_cut_sets: max_cut_sets.max(1),
        original_cut_sets,
        retained_cut_sets: stop_after,
        stop_reason,
        stop_mcub_relative_error,
        stop_mcub_partial,
        dropped_tiny,
        dropped_tau,
        dropped_order,
        p_rare_event,
        p_mcub,
    }))
}

fn panic_payload_to_string(payload: Box<dyn Any + Send>) -> String {
    if let Some(s) = payload.downcast_ref::<&'static str>() {
        (*s).to_string()
    } else if let Some(s) = payload.downcast_ref::<String>() {
        s.clone()
    } else {
        "<non-string panic payload>".to_string()
    }
}

const NAPI_MAX_INPUT_BYTES: usize = 8 * 1024 * 1024;

fn severity_to_str(severity: Severity) -> &'static str {
    match severity {
        Severity::Error => "error",
        Severity::Warning => "warning",
        Severity::Info => "info",
    }
}

fn diagnostics_json(diagnostics: &[Diagnostic]) -> serde_json::Value {
    serde_json::Value::Array(
        diagnostics
            .iter()
            .map(|d| {
                json!({
                    "code": d.code,
                    "severity": severity_to_str(d.severity),
                    "message": d.message,
                    "jsonPath": d.json_path,
                    "sourceElement": d.source_element,
                    "sourceId": d.source_id,
                    "targetType": d.target_type,
                    "targetId": d.target_id,
                    "hint": d.hint,
                })
            })
            .collect(),
    )
}

pub fn validate_openpra_json_contract(input: &str) -> Result<String> {
    let total_started = Instant::now();
    enforce_payload_limit(input, "validate_openpra_json")?;

    let validate_started = Instant::now();
    let diagnostics = validate_openpra_json(input)?;
    let validate_ms = validate_started.elapsed().as_secs_f64() * 1000.0;
    let has_errors = diagnostics.iter().any(|d| d.severity == Severity::Error);

    let serialize_started = Instant::now();
    let rendered = serde_json::to_string_pretty(&json!({
        "ok": !has_errors,
        "diagnostics": diagnostics_json(&diagnostics),
        "limits": payload_limits_json(),
        "telemetry": {
            "endpoint": "validate_openpra_json",
            "timingsMs": {
                "validate": validate_ms,
                "serialize": null,
                "total": null,
            }
        }
    }))
    .map_err(|err| PraxisError::Serialization(format!("Failed to serialize validation output: {err}")))?;

    let serialize_ms = serialize_started.elapsed().as_secs_f64() * 1000.0;
    let total_ms = total_started.elapsed().as_secs_f64() * 1000.0;
    let mut parsed: serde_json::Value = serde_json::from_str(&rendered)
        .map_err(|err| PraxisError::Serialization(format!("Failed to parse validation output for telemetry patching: {err}")))?;
    parsed["telemetry"]["timingsMs"]["serialize"] = json!(serialize_ms);
    parsed["telemetry"]["timingsMs"]["total"] = json!(total_ms);

    serde_json::to_string_pretty(&parsed)
        .map_err(|err| PraxisError::Serialization(format!("Failed to serialize validation output: {err}")))
}

pub fn quantify_openpra_json_contract(input: &str, mode: ResolveMode) -> Result<String> {
    let total_started = Instant::now();
    let input_fingerprint = stable_input_fingerprint(input);

    enforce_payload_limit(input, "quantify_openpra_json")?;

    let parse_started = Instant::now();
    let mut bundle = parse_openpra_json(input)?;
    let parse_ms = parse_started.elapsed().as_secs_f64() * 1000.0;

    let resolve_started = Instant::now();
    let diagnostics = resolve_openpra_refs(&mut bundle, mode)?;
    let resolve_ms = resolve_started.elapsed().as_secs_f64() * 1000.0;

    let seed = 42_u64;
    let num_trials_requested = 256_usize;
    let mut build_inputs_ms: Option<f64> = None;
    let mut quantify_ms: Option<f64> = None;

    if diagnostics.iter().any(|d| d.severity == Severity::Error) {
        let outputs = EngineOutputs {
            model_id: bundle.model_id.clone(),
            run_metadata: Some(run_metadata_json(
                "cpu",
                seed,
                num_trials_requested,
                None,
                None,
                crate::mc::core::ConvergenceSettings::disabled(),
                None,
                telemetry_timings_json(parse_ms, resolve_ms, build_inputs_ms, quantify_ms, None, None),
                reproducibility_json(seed, mode, &input_fingerprint, bundle.model_id.as_deref()),
            )),
            ..EngineOutputs::default()
        };

        return serialize_quantify_output(outputs, &bundle, total_started);
    }

    let build_started = Instant::now();
    let inputs = to_engine_inputs(&bundle)?;
    build_inputs_ms = Some(build_started.elapsed().as_secs_f64() * 1000.0);

    let outputs = if let (Some(model), Some(ie)) = (
        inputs.praxis_model.as_ref(),
        inputs.praxis_initiating_events.first(),
    ) {
        if let Some(event_tree_id) = ie.event_tree_id.as_deref() {
            if let Some(et) = inputs.praxis_event_tree_library.get(event_tree_id) {
                let run_started = Instant::now();
                let ie_for_run = ie.clone();
                let et_for_run = et.clone();
                let model_for_run = model.clone();
                let event_tree_library_for_run = inputs.praxis_event_tree_library.clone();

                let run_handle = std::thread::Builder::new()
                    .name("openpra-quantify-cpu".to_string())
                    .stack_size(32 * 1024 * 1024)
                    .spawn(move || {
                        crate::mc::DpEventTreeMonteCarloAnalysis::new(
                            ie_for_run,
                            et_for_run,
                            &model_for_run,
                            Some(seed),
                            num_trials_requested,
                        )?
                        .with_event_tree_library(&event_tree_library_for_run)
                        .run_cpu()
                    })
                    .map_err(|err| {
                        PraxisError::Logic(format!(
                            "Failed to spawn quantify worker thread: {err}"
                        ))
                    })?;

                let result = run_handle
                    .join()
                    .map_err(|_| {
                        PraxisError::Logic(
                            "Quantification worker thread panicked during CPU execution".to_string(),
                        )
                    })??;
                let timing_ms = run_started.elapsed().as_secs_f64() * 1000.0;
                quantify_ms = Some(timing_ms);

                let result_payload = serde_json::Value::Array(
                    result
                        .sequences
                        .iter()
                        .map(|s| {
                            let mut row = quantification_seed_row_for_sequence(&bundle, &s.sequence.id)
                                .unwrap_or_default();

                            row.entry("id".to_string())
                                .or_insert_with(|| json!(s.sequence.id.clone()));
                            row.entry("eventSequenceId".to_string())
                                .or_insert_with(|| json!(s.sequence.id.clone()));

                            row.insert("probability".to_string(), json!(s.probability_estimate));
                            row.insert("frequency".to_string(), json!(s.frequency_estimate));
                            row.insert("numTrials".to_string(), json!(s.num_trials));
                            row.insert("successes".to_string(), json!(s.successes));
                            row.insert(
                                "uncertainty".to_string(),
                                sequence_uncertainty_json(
                                    s.probability_estimate,
                                    s.frequency_estimate,
                                    s.successes,
                                    s.num_trials,
                                    0.95,
                                ),
                            );
                            row.insert(
                                "convergence".to_string(),
                                sequence_convergence_json(false, None, s.num_trials, None, None, None),
                            );

                            serde_json::Value::Object(row)
                        })
                        .collect(),
                );

                EngineOutputs {
                    model_id: bundle.model_id.clone(),
                    result_payload: Some(result_payload),
                    schema_version: Some("openpra-mef-output-v1".to_string()),
                    engine_version: Some(env!("CARGO_PKG_VERSION").to_string()),
                    run_metadata: Some(run_metadata_json(
                        "cpu",
                        seed,
                        num_trials_requested,
                        Some(result.num_trials),
                        Some(timing_ms),
                        crate::mc::core::ConvergenceSettings::disabled(),
                        None,
                        telemetry_timings_json(
                            parse_ms,
                            resolve_ms,
                            build_inputs_ms,
                            quantify_ms,
                            None,
                            None,
                        ),
                        reproducibility_json(
                            seed,
                            mode,
                            &input_fingerprint,
                            bundle.model_id.as_deref(),
                        ),
                    )),
                    placeholders: bundle.placeholders.clone(),
                    diagnostics: Vec::new(),
                }
            } else {
                let mut outputs = EngineOutputs {
                    model_id: bundle.model_id.clone(),
                    schema_version: Some("openpra-mef-output-v1".to_string()),
                    engine_version: Some(env!("CARGO_PKG_VERSION").to_string()),
                    run_metadata: Some(run_metadata_json(
                        "cpu",
                        seed,
                        num_trials_requested,
                        None,
                        None,
                        crate::mc::core::ConvergenceSettings::disabled(),
                        None,
                        telemetry_timings_json(
                            parse_ms,
                            resolve_ms,
                            build_inputs_ms,
                            quantify_ms,
                            None,
                            None,
                        ),
                        reproducibility_json(
                            seed,
                            mode,
                            &input_fingerprint,
                            bundle.model_id.as_deref(),
                        ),
                    )),
                    ..EngineOutputs::default()
                };
                outputs.diagnostics.push(Diagnostic::new(
                    "RUN_MISSING_EVENT_TREE",
                    Severity::Error,
                    format!("Event tree '{event_tree_id}' not found in engine library"),
                    "$.technicalElements.event-sequence-analysis",
                ));
                outputs
            }
        } else {
            let mut outputs = EngineOutputs {
                model_id: bundle.model_id.clone(),
                schema_version: Some("openpra-mef-output-v1".to_string()),
                engine_version: Some(env!("CARGO_PKG_VERSION").to_string()),
                run_metadata: Some(run_metadata_json(
                    "cpu",
                    seed,
                    num_trials_requested,
                    None,
                    None,
                    crate::mc::core::ConvergenceSettings::disabled(),
                    None,
                    telemetry_timings_json(
                        parse_ms,
                        resolve_ms,
                        build_inputs_ms,
                        quantify_ms,
                        None,
                        None,
                    ),
                    reproducibility_json(
                        seed,
                        mode,
                        &input_fingerprint,
                        bundle.model_id.as_deref(),
                    ),
                )),
                ..EngineOutputs::default()
            };
            outputs.diagnostics.push(Diagnostic::new(
                "RUN_MISSING_EVENT_TREE_REFERENCE",
                Severity::Error,
                "Initiating event does not reference an event tree",
                "$.technicalElements.initiating-event-analysis",
            ));
            outputs
        }
    } else {
        let mut outputs = EngineOutputs {
            model_id: bundle.model_id.clone(),
            schema_version: Some("openpra-mef-output-v1".to_string()),
            engine_version: Some(env!("CARGO_PKG_VERSION").to_string()),
            run_metadata: Some(run_metadata_json(
                "cpu",
                seed,
                num_trials_requested,
                None,
                None,
                crate::mc::core::ConvergenceSettings::disabled(),
                None,
                telemetry_timings_json(
                    parse_ms,
                    resolve_ms,
                    build_inputs_ms,
                    quantify_ms,
                    None,
                    None,
                ),
                reproducibility_json(
                    seed,
                    mode,
                    &input_fingerprint,
                    bundle.model_id.as_deref(),
                ),
            )),
            ..EngineOutputs::default()
        };
        outputs.diagnostics.push(Diagnostic::new(
            "RUN_NO_EXECUTABLE_SCENARIO",
            Severity::Warning,
            "No executable event-tree scenario was derived from input",
            "$.technicalElements",
        ));
        outputs
    };

    serialize_quantify_output(outputs, &bundle, total_started)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
enum PraxisBackend {
    Cpu,
    Cuda,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
enum AdaptiveCutSetEnumerationBackend {
    Mocus,
    Zbdd,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct PraxisNodeOptions {
    strict: Option<bool>,
    adaptive: Option<bool>,
    backend: Option<PraxisBackend>,
    seed: Option<u64>,

    adaptive_relative_error_target: Option<f64>,
    adaptive_max_cut_sets: Option<usize>,
    adaptive_tiny_probability_threshold_recipe: Option<TinyProbabilityThresholdRecipe>,
    adaptive_cut_set_enumeration_backend: Option<AdaptiveCutSetEnumerationBackend>,

    mc_early_stop: Option<bool>,
    mc_delta: Option<f64>,
    mc_confidence: Option<f64>,
    mc_burn_in: Option<u64>,

    iterations: Option<usize>,
    batches: Option<usize>,
    #[serde(rename = "bitpacksPerBatch")]
    bitpacks_per_batch: Option<usize>,
    omega: Option<usize>,

    watch: Option<bool>,

    /// Base64-encoded bincode payload produced by `compile_event_tree_pdag_openpra_json_with_settings`.
    /// When set, the quantification run will reuse the compiled PDAG instead of rebuilding it.
    compiled_event_tree_pdag_base64: Option<String>,
}

fn encode_compiled_event_tree_pdag_base64(
    compiled: &crate::mc::CompiledEventTreePdagV1,
) -> Result<String> {
    let bytes = bincode::serialize(compiled).map_err(|err| {
        PraxisError::Serialization(format!("Failed to serialize compiled PDAG: {err}"))
    })?;
    Ok(BASE64_STANDARD.encode(bytes))
}

fn decode_compiled_event_tree_pdag_base64(
    encoded: &str,
) -> Result<crate::mc::CompiledEventTreePdagV1> {
    let bytes = BASE64_STANDARD.decode(encoded.trim()).map_err(|err| {
        PraxisError::Settings(format!("Invalid compiled PDAG base64 payload: {err}"))
    })?;
    bincode::deserialize::<crate::mc::CompiledEventTreePdagV1>(&bytes).map_err(|err| {
        PraxisError::Serialization(format!("Failed to deserialize compiled PDAG: {err}"))
    })
}

pub fn compile_event_tree_pdag_openpra_json_with_settings_contract(
    model_json: &str,
    settings_json: &str,
) -> Result<String> {
    enforce_payload_limit(model_json, "compile_event_tree_pdag_openpra_json_with_settings")?;
    enforce_payload_limit(settings_json, "compile_event_tree_pdag_openpra_json_with_settings")?;

    let options: PraxisNodeOptions = if settings_json.trim().is_empty() {
        PraxisNodeOptions::default()
    } else {
        serde_json::from_str(settings_json).map_err(|err| {
            PraxisError::Settings(format!(
                "Invalid settings JSON for NAPI compile_event_tree_pdag: {err}"
            ))
        })?
    };

    let mode = if options.strict.unwrap_or(false) {
        ResolveMode::Strict
    } else {
        ResolveMode::Compatible
    };

    let seed = options.seed.unwrap_or(42_u64);

    let parse_started = Instant::now();
    let mut bundle = parse_openpra_json(model_json)?;
    let parse_ms = parse_started.elapsed().as_secs_f64() * 1000.0;

    let resolve_started = Instant::now();
    let diagnostics = resolve_openpra_refs(&mut bundle, mode)?;
    let resolve_ms = resolve_started.elapsed().as_secs_f64() * 1000.0;

    if diagnostics.iter().any(|d| d.severity == Severity::Error) {
        return Err(PraxisError::Settings(format!(
            "Model contains errors; cannot compile PDAG (parse_ms={:.3}, resolve_ms={:.3})",
            parse_ms, resolve_ms
        )));
    }

    let inputs = to_engine_inputs(&bundle)?;
    let (Some(model), Some(ie)) = (
        inputs.praxis_model.as_ref(),
        inputs.praxis_initiating_events.first(),
    ) else {
        return Err(PraxisError::Settings(
            "Cannot compile PDAG: missing model or initiating event".to_string(),
        ));
    };

    let Some(event_tree_id) = ie.event_tree_id.as_deref() else {
        return Err(PraxisError::Settings(
            "Cannot compile PDAG: initiating event missing eventTreeId".to_string(),
        ));
    };
    let Some(et) = inputs.praxis_event_tree_library.get(event_tree_id) else {
        return Err(PraxisError::Settings(format!(
            "Cannot compile PDAG: event tree '{}' not found in library",
            event_tree_id
        )));
    };

    let analysis = crate::mc::DpEventTreeMonteCarloAnalysis::new(
        ie.clone(),
        et.clone(),
        model,
        Some(seed),
        1,
    )?;

    let compiled = analysis
        .with_event_tree_library(&inputs.praxis_event_tree_library)
        .compile_event_tree_pdag()?;

    let encoded = encode_compiled_event_tree_pdag_base64(&compiled)?;
    let out = json!({
        "compiledEventTreePdagBase64": encoded,
        "version": compiled.version,
        "initiatingEventId": compiled.initiating_event_id,
        "eventTreeId": compiled.event_tree_id,
    });
    serde_json::to_string(&out)
        .map_err(|err| PraxisError::Serialization(format!("Failed to render compile output: {err}")))
}

pub fn quantify_openpra_json_with_settings_contract(
    model_json: &str,
    settings_json: &str,
) -> Result<String> {
    let total_started = Instant::now();
    let input_fingerprint = stable_input_fingerprint(model_json);

    enforce_payload_limit(model_json, "quantify_openpra_json_with_settings")?;
    enforce_payload_limit(settings_json, "quantify_openpra_json_with_settings")?;

    let options: PraxisNodeOptions = if settings_json.trim().is_empty() {
        PraxisNodeOptions::default()
    } else {
        serde_json::from_str(settings_json).map_err(|err| {
            PraxisError::Settings(format!("Invalid settings JSON for NAPI quantify: {err}"))
        })?
    };

    let mode = if options.strict.unwrap_or(false) {
        ResolveMode::Strict
    } else {
        ResolveMode::Compatible
    };

    let backend = options.backend.unwrap_or(PraxisBackend::Cpu);
    let watch = options.watch.unwrap_or(false);

    let compiled_event_tree_pdag_base64 = options.compiled_event_tree_pdag_base64.clone();
    let seed = options.seed.unwrap_or(42_u64);
    let adaptive = options.adaptive.unwrap_or(false);
    let adaptive_relative_error_target = options.adaptive_relative_error_target.unwrap_or(0.001);
    let adaptive_max_cut_sets = options.adaptive_max_cut_sets.unwrap_or(25_000);
    let adaptive_tiny_probability_threshold_recipe = options
        .adaptive_tiny_probability_threshold_recipe
        .unwrap_or(TinyProbabilityThresholdRecipe::Default);
    let adaptive_cut_set_enumeration_backend = options
        .adaptive_cut_set_enumeration_backend
        .unwrap_or(AdaptiveCutSetEnumerationBackend::Mocus);

    let mc_early_stop = options.mc_early_stop.unwrap_or(false);
    let mc_delta = options.mc_delta.unwrap_or(0.001);
    let mc_confidence = options.mc_confidence.unwrap_or(0.95);
    let mc_burn_in = options.mc_burn_in.unwrap_or(0);

    if mc_early_stop {
        if !(mc_delta.is_finite() && mc_delta > 0.0) {
            return Err(PraxisError::Settings(
                "settings.mcDelta must be a finite number > 0 when mcEarlyStop=true".to_string(),
            ));
        }
        if !(mc_confidence.is_finite() && mc_confidence > 0.0 && mc_confidence < 1.0) {
            return Err(PraxisError::Settings(
                "settings.mcConfidence must be a finite number in (0,1) when mcEarlyStop=true"
                    .to_string(),
            ));
        }
    }

    let has_layout_field = options.iterations.is_some()
        || options.batches.is_some()
        || options.bitpacks_per_batch.is_some()
        || options.omega.is_some();

    let (num_trials_requested, explicit_params) = if has_layout_field {
        let iterations = options.iterations.ok_or_else(|| {
            PraxisError::Settings(
                "settings.iterations is required when providing an explicit layout".to_string(),
            )
        })?;
        let batches = options.batches.ok_or_else(|| {
            PraxisError::Settings(
                "settings.batches is required when providing an explicit layout".to_string(),
            )
        })?;
        let bitpacks_per_batch = options.bitpacks_per_batch.ok_or_else(|| {
            PraxisError::Settings(
                "settings.bitpacksPerBatch is required when providing an explicit layout"
                    .to_string(),
            )
        })?;
        let omega = options.omega.ok_or_else(|| {
            PraxisError::Settings(
                "settings.omega is required when providing an explicit layout".to_string(),
            )
        })?;

        let params = crate::mc::plan::RunParams::new(
            iterations,
            batches,
            bitpacks_per_batch,
            omega,
            seed,
        );
        (params.total_trials_covered(), Some(params))
    } else if mc_early_stop {
        let omega = crate::mc::plan::RunParams::DEFAULT_OMEGA;
        let params = crate::mc::plan::RunParams::new(4, 1, 1, omega, seed);
        (params.total_trials_covered(), Some(params))
    } else {
        (256_usize, None)
    };

    let convergence = if mc_early_stop {
        crate::mc::core::ConvergenceSettings {
            enabled: true,
            delta: mc_delta,
            confidence: mc_confidence,
            burn_in: mc_burn_in,
        }
    } else {
        crate::mc::core::ConvergenceSettings::disabled()
    };

    let parse_started = Instant::now();
    let mut bundle = parse_openpra_json(model_json)?;
    let parse_ms = parse_started.elapsed().as_secs_f64() * 1000.0;

    let resolve_started = Instant::now();
    let diagnostics = resolve_openpra_refs(&mut bundle, mode)?;
    let resolve_ms = resolve_started.elapsed().as_secs_f64() * 1000.0;

    let mut build_inputs_ms: Option<f64> = None;
    let mut quantify_ms: Option<f64> = None;

    let backend_label = match backend {
        PraxisBackend::Cpu => "cpu",
        PraxisBackend::Cuda => "cuda",
    };

    if diagnostics.iter().any(|d| d.severity == Severity::Error) {
        let outputs = EngineOutputs {
            model_id: bundle.model_id.clone(),
            run_metadata: Some(run_metadata_json(
                backend_label,
                seed,
                num_trials_requested,
                None,
                None,
                convergence,
                None,
                telemetry_timings_json(parse_ms, resolve_ms, build_inputs_ms, quantify_ms, None, None),
                reproducibility_json(seed, mode, &input_fingerprint, bundle.model_id.as_deref()),
            )),
            ..EngineOutputs::default()
        };

        return serialize_quantify_output(outputs, &bundle, total_started);
    }

    let build_started = Instant::now();
    let inputs = to_engine_inputs(&bundle)?;
    build_inputs_ms = Some(build_started.elapsed().as_secs_f64() * 1000.0);

    let outputs = if let (Some(model), Some(ie)) = (
        inputs.praxis_model.as_ref(),
        inputs.praxis_initiating_events.first(),
    ) {
        if let Some(event_tree_id) = ie.event_tree_id.as_deref() {
            if let Some(et) = inputs.praxis_event_tree_library.get(event_tree_id) {
                let run_started = Instant::now();
                let ie_for_run = ie.clone();
                let et_for_run = et.clone();
                let model_for_run = model.clone();
                let event_tree_library_for_run = inputs.praxis_event_tree_library.clone();
                let explicit_params_for_run = explicit_params;
                let backend_for_run = backend;
                let watch_for_run = watch;
                let convergence_for_run = convergence;
                let compiled_event_tree_pdag_for_run = compiled_event_tree_pdag_base64;

                let run_handle = std::thread::Builder::new()
                    .name("openpra-quantify".to_string())
                    .stack_size(32 * 1024 * 1024)
                    .spawn(move || {
                        match backend_for_run {
                            PraxisBackend::Cpu => {
                                let analysis = if let Some(params) = explicit_params_for_run {
                                    crate::mc::DpEventTreeMonteCarloAnalysis::with_run_params(
                                        ie_for_run,
                                        et_for_run,
                                        &model_for_run,
                                        params,
                                    )?
                                } else {
                                    crate::mc::DpEventTreeMonteCarloAnalysis::new(
                                        ie_for_run,
                                        et_for_run,
                                        &model_for_run,
                                        Some(seed),
                                        num_trials_requested,
                                    )?
                                };

                                let analysis =
                                    analysis.with_event_tree_library(&event_tree_library_for_run);

                                if let Some(encoded) = compiled_event_tree_pdag_for_run.as_deref()
                                {
                                    let compiled = decode_compiled_event_tree_pdag_base64(encoded)?;
                                    Ok::<_, PraxisError>(
                                        analysis.run_cpu_with_watch_and_convergence_compiled(
                                            &compiled,
                                            watch_for_run,
                                            convergence_for_run,
                                        )?,
                                    )
                                } else {
                                    Ok::<_, PraxisError>(
                                        analysis.run_cpu_with_watch_and_convergence(
                                            watch_for_run,
                                            convergence_for_run,
                                        )?,
                                    )
                                }
                            }
                            PraxisBackend::Cuda => {
                                #[cfg(all(feature = "gpu", feature = "cuda"))]
                                {
                                    use cubecl::prelude::*;
                                    use cubecl_cuda::CudaRuntime;

                                    let analysis = if let Some(params) = explicit_params_for_run {
                                        crate::mc::DpEventTreeMonteCarloAnalysis::with_run_params(
                                            ie_for_run,
                                            et_for_run,
                                            &model_for_run,
                                            params,
                                        )?
                                    } else {
                                        crate::mc::DpEventTreeMonteCarloAnalysis::new(
                                            ie_for_run,
                                            et_for_run,
                                            &model_for_run,
                                            Some(seed),
                                            num_trials_requested,
                                        )?
                                    };

                                    let device = <CudaRuntime as Runtime>::Device::default();

                                    let analysis =
                                        analysis.with_event_tree_library(&event_tree_library_for_run);

                                    if let Some(encoded) =
                                        compiled_event_tree_pdag_for_run.as_deref()
                                    {
                                        let compiled =
                                            decode_compiled_event_tree_pdag_base64(encoded)?;
                                        Ok::<_, PraxisError>(
                                            analysis
                                                .run_gpu_with_watch_and_convergence_compiled::<
                                                    CudaRuntime,
                                                >(
                                                    &device,
                                                    &compiled,
                                                    watch_for_run,
                                                    convergence_for_run,
                                                )?,
                                        )
                                    } else {
                                        Ok::<_, PraxisError>(
                                            analysis
                                                .run_gpu_with_watch_and_convergence::<CudaRuntime>(
                                                    &device,
                                                    watch_for_run,
                                                    convergence_for_run,
                                                )?,
                                        )
                                    }
                                }
                                #[cfg(not(all(feature = "gpu", feature = "cuda")))]
                                {
                                    Err(PraxisError::Settings(
                                        "CUDA backend requested, but PRAXIS was built without the 'cuda' feature"
                                            .to_string(),
                                    ))
                                }
                            }
                        }
                    })
                    .map_err(|err| {
                        PraxisError::Logic(format!(
                            "Failed to spawn quantify worker thread: {err}"
                        ))
                    })?;

                let result = run_handle
                    .join()
                    .map_err(|payload| {
                        PraxisError::Logic(format!(
                            "Quantification worker thread panicked during execution: {}",
                            panic_payload_to_string(payload)
                        ))
                    })??;
                let timing_ms = run_started.elapsed().as_secs_f64() * 1000.0;
                quantify_ms = Some(timing_ms);

                let run_convergence_met = if convergence.enabled {
                    result.sequences.iter().all(|s| {
                        crate::mc::stats::should_stop_convergence_wald_linear_and_log10(
                            s.probability_estimate,
                            s.num_trials as u64,
                            convergence.delta,
                            convergence.confidence,
                            convergence.burn_in,
                        )
                    })
                } else {
                    false
                };

                let result_payload = serde_json::Value::Array(
                    result
                        .sequences
                        .iter()
                        .map(|s| {
                            let mut row = quantification_seed_row_for_sequence(&bundle, &s.sequence.id)
                                .unwrap_or_default();

                            row.entry("id".to_string())
                                .or_insert_with(|| json!(s.sequence.id.clone()));
                            row.entry("eventSequenceId".to_string())
                                .or_insert_with(|| json!(s.sequence.id.clone()));

                            row.insert("probability".to_string(), json!(s.probability_estimate));
                            row.insert("frequency".to_string(), json!(s.frequency_estimate));
                            row.insert("numTrials".to_string(), json!(s.num_trials));
                            row.insert("successes".to_string(), json!(s.successes));

                            if adaptive {
                                let upper = crate::mc::stats::clopper_pearson_upper_bound(
                                    s.successes as u64,
                                    s.num_trials as u64,
                                    mc_confidence,
                                );
                                row.insert(
                                    "conditionalProbabilityUpperBound".to_string(),
                                    json!(upper),
                                );

                                if s.successes == 0 {
                                    row.insert(
                                        "cutSetEnumerationSkipped".to_string(),
                                        json!(true),
                                    );
                                } else {
                                    let k = 6usize;
                                    match adaptive_cut_sets_for_sequence(
                                        model,
                                        &inputs.praxis_event_tree_library,
                                        et,
                                        &s.sequence.id,
                                        s.probability_estimate,
                                        k,
                                        adaptive_relative_error_target,
                                        adaptive_max_cut_sets,
                                        adaptive_tiny_probability_threshold_recipe,
                                        adaptive_cut_set_enumeration_backend,
                                    ) {
                                        Ok(Some(outcome)) => {
                                            let cut_sets_json: Vec<serde_json::Value> = outcome
                                                .cut_sets
                                                .iter()
                                                .map(|cs| {
                                                    let mut members: Vec<String> =
                                                        cs.events.iter().cloned().collect();
                                                    members.sort();
                                                    json!({"definition": members})
                                                })
                                                .collect();
                                            row.insert("cutSets".to_string(), json!(cut_sets_json));

                                            row.insert(
                                                "adaptiveCutSetSummary".to_string(),
                                                json!({
                                                    "tau": outcome.tau,
                                                    "tinyProbabilityThreshold": outcome.eta,
                                                    "tinyProbabilityThresholdRecipe": outcome.eta_recipe,
                                                    "maxOrder": outcome.max_order,
                                                    "relativeErrorTarget": outcome.relative_error_target,
                                                    "maxCutSets": outcome.max_cut_sets,
                                                    "originalCutSetsEstimate": outcome.original_cut_sets,
                                                    "retainedCutSets": outcome.retained_cut_sets,
                                                    "stopReason": outcome.stop_reason,
                                                    "stopMcubRelativeError": outcome.stop_mcub_relative_error,
                                                    "stopMcubPartial": outcome.stop_mcub_partial,
                                                    "droppedTiny": outcome.dropped_tiny,
                                                    "droppedTau": outcome.dropped_tau,
                                                    "droppedOrder": outcome.dropped_order,
                                                    "rareEventApproximation": outcome.p_rare_event,
                                                    "mcubApproximation": outcome.p_mcub,
                                                }),
                                            );
                                        }
                                        Ok(None) => {
                                            row.insert(
                                                "cutSetEnumerationSkipped".to_string(),
                                                json!(true),
                                            );
                                        }
                                        Err(err) => {
                                            row.insert(
                                                "cutSetEnumerationSkipped".to_string(),
                                                json!(true),
                                            );
                                            row.insert(
                                                "cutSetEnumerationError".to_string(),
                                                json!(err.to_string()),
                                            );
                                        }
                                    }
                                }
                            }
                            row.insert(
                                "uncertainty".to_string(),
                                sequence_uncertainty_json(
                                    s.probability_estimate,
                                    s.frequency_estimate,
                                    s.successes,
                                    s.num_trials,
                                    mc_confidence,
                                ),
                            );
                            row.insert(
                                "convergence".to_string(),
                                sequence_convergence_json(
                                    convergence.enabled,
                                    Some(
                                        crate::mc::stats::should_stop_convergence_wald_linear_and_log10(
                                            s.probability_estimate,
                                            s.num_trials as u64,
                                            convergence.delta,
                                            convergence.confidence,
                                            convergence.burn_in,
                                        ),
                                    )
                                    .filter(|_| convergence.enabled),
                                    s.num_trials,
                                    convergence.enabled.then_some(convergence.delta),
                                    convergence.enabled.then_some(convergence.confidence),
                                    convergence.enabled.then_some(convergence.burn_in),
                                ),
                            );

                            serde_json::Value::Object(row)
                        })
                        .collect(),
                );

                EngineOutputs {
                    model_id: bundle.model_id.clone(),
                    result_payload: Some(result_payload),
                    schema_version: Some("openpra-mef-output-v1".to_string()),
                    engine_version: Some(env!("CARGO_PKG_VERSION").to_string()),
                    run_metadata: Some(run_metadata_json(
                        backend_label,
                        seed,
                        num_trials_requested,
                        Some(result.num_trials),
                        Some(timing_ms),
                        convergence,
                        Some(run_convergence_met).filter(|_| convergence.enabled),
                        telemetry_timings_json(
                            parse_ms,
                            resolve_ms,
                            build_inputs_ms,
                            quantify_ms,
                            None,
                            None,
                        ),
                        reproducibility_json(
                            seed,
                            mode,
                            &input_fingerprint,
                            bundle.model_id.as_deref(),
                        ),
                    )),
                    placeholders: bundle.placeholders.clone(),
                    diagnostics: Vec::new(),
                }
            } else {
                let mut outputs = EngineOutputs {
                    model_id: bundle.model_id.clone(),
                    schema_version: Some("openpra-mef-output-v1".to_string()),
                    engine_version: Some(env!("CARGO_PKG_VERSION").to_string()),
                    run_metadata: Some(run_metadata_json(
                        backend_label,
                        seed,
                        num_trials_requested,
                        None,
                        None,
                        convergence,
                        None,
                        telemetry_timings_json(
                            parse_ms,
                            resolve_ms,
                            build_inputs_ms,
                            quantify_ms,
                            None,
                            None,
                        ),
                        reproducibility_json(seed, mode, &input_fingerprint, bundle.model_id.as_deref()),
                    )),
                    ..EngineOutputs::default()
                };
                outputs.diagnostics.push(Diagnostic::new(
                    "RUN_MISSING_EVENT_TREE",
                    Severity::Error,
                    format!("Event tree '{event_tree_id}' not found in engine library"),
                    "$.technicalElements.event-sequence-analysis",
                ));
                outputs
            }
        } else {
            let mut outputs = EngineOutputs {
                model_id: bundle.model_id.clone(),
                schema_version: Some("openpra-mef-output-v1".to_string()),
                engine_version: Some(env!("CARGO_PKG_VERSION").to_string()),
                run_metadata: Some(run_metadata_json(
                    backend_label,
                    seed,
                    num_trials_requested,
                    None,
                    None,
                    convergence,
                    None,
                    telemetry_timings_json(
                        parse_ms,
                        resolve_ms,
                        build_inputs_ms,
                        quantify_ms,
                        None,
                        None,
                    ),
                    reproducibility_json(seed, mode, &input_fingerprint, bundle.model_id.as_deref()),
                )),
                ..EngineOutputs::default()
            };
            outputs.diagnostics.push(Diagnostic::new(
                "RUN_MISSING_EVENT_TREE_REFERENCE",
                Severity::Error,
                "Initiating event does not reference an event tree",
                "$.technicalElements.initiating-event-analysis",
            ));
            outputs
        }
    } else {
        let mut outputs = EngineOutputs {
            model_id: bundle.model_id.clone(),
            schema_version: Some("openpra-mef-output-v1".to_string()),
            engine_version: Some(env!("CARGO_PKG_VERSION").to_string()),
            run_metadata: Some(run_metadata_json(
                backend_label,
                seed,
                num_trials_requested,
                None,
                None,
                convergence,
                None,
                telemetry_timings_json(parse_ms, resolve_ms, build_inputs_ms, quantify_ms, None, None),
                reproducibility_json(seed, mode, &input_fingerprint, bundle.model_id.as_deref()),
            )),
            ..EngineOutputs::default()
        };
        outputs.diagnostics.push(Diagnostic::new(
            "RUN_NO_EXECUTABLE_SCENARIO",
            Severity::Warning,
            "No executable event-tree scenario was derived from input",
            "$.technicalElements",
        ));
        outputs
    };

    serialize_quantify_output(outputs, &bundle, total_started)
}

fn serialize_quantify_output(
    outputs: EngineOutputs,
    bundle: &crate::openpra_mef::contracts::OpenPraJsonBundle,
    total_started: Instant,
) -> Result<String> {
    let serialize_started = Instant::now();
    let rendered = from_engine_outputs(&outputs, bundle)?;
    let serialize_ms = serialize_started.elapsed().as_secs_f64() * 1000.0;
    let total_ms = total_started.elapsed().as_secs_f64() * 1000.0;

    let mut parsed: serde_json::Value = serde_json::from_str(&rendered).map_err(|err| {
        PraxisError::Serialization(format!(
            "Failed to parse quantify output for telemetry patching: {err}"
        ))
    })?;
    parsed["outputMetadata"]["runMetadata"]["telemetry"]["timingsMs"]["serialize"] = json!(serialize_ms);
    parsed["outputMetadata"]["runMetadata"]["telemetry"]["timingsMs"]["total"] = json!(total_ms);

    serde_json::to_string_pretty(&parsed)
        .map_err(|err| PraxisError::Serialization(format!("Failed to serialize quantify output: {err}")))
}

pub fn convert_openpsa_xml_to_openpra_json_contract(input: &str) -> Result<String> {
    let total_started = Instant::now();
    enforce_payload_limit(input, "convert_openpsa_xml_to_openpra_json")?;
    let convert_started = Instant::now();
    let mode = ResolveMode::Compatible;

    let response = convert_single_xml_response(input, mode, None, None);
    let convert_ms = convert_started.elapsed().as_secs_f64() * 1000.0;

    let serialize_started = Instant::now();
    let rendered = serde_json::to_string_pretty(&json!({
        "ok": response.ok,
        "modelId": response.model_id,
        "openPraJson": response.model,
        "diagnostics": diagnostics_json(&response.diagnostics),
        "fileSummary": {
            "index": 0,
            "fileId": null,
            "filePath": null,
            "ok": response.ok,
            "modelId": response.model_id,
            "diagnostics": response.diagnostic_counts,
            "inputBytes": input.len(),
        },
        "conversionMetadata": {
            "version": "v1",
            "mode": "single",
            "summary": {
                "totalFiles": 1,
                "okFiles": if response.ok { 1 } else { 0 },
                "failedFiles": if response.ok { 0 } else { 1 },
            },
            "reproducibility": conversion_reproducibility_json(
                mode,
                &stable_input_fingerprint(input),
                response.model_id.as_deref(),
                None,
            )
        },
        "limits": payload_limits_json(),
        "telemetry": {
            "endpoint": "convert_openpsa_xml_to_openpra_json",
            "timingsMs": {
                "convert": convert_ms,
                "serialize": null,
                "total": null,
            }
        }
    }))
    .map_err(|err| PraxisError::Serialization(format!("Failed to serialize conversion output: {err}")))?;

    let serialize_ms = serialize_started.elapsed().as_secs_f64() * 1000.0;
    let total_ms = total_started.elapsed().as_secs_f64() * 1000.0;
    let mut parsed: serde_json::Value = serde_json::from_str(&rendered).map_err(|err| {
        PraxisError::Serialization(format!(
            "Failed to parse conversion output for telemetry patching: {err}"
        ))
    })?;
    parsed["telemetry"]["timingsMs"]["serialize"] = json!(serialize_ms);
    parsed["telemetry"]["timingsMs"]["total"] = json!(total_ms);

    serde_json::to_string_pretty(&parsed)
        .map_err(|err| PraxisError::Serialization(format!("Failed to serialize conversion output: {err}")))
}

pub fn convert_openpsa_xml_file_to_openpra_json_contract(file_path: &str, input: &str) -> Result<String> {
    let total_started = Instant::now();
    enforce_payload_limit(input, "convert_openpsa_xml_file_to_openpra_json")?;
    let convert_started = Instant::now();
    let mode = ResolveMode::Compatible;

    let response = convert_single_xml_response(input, mode, None, Some(file_path));
    let convert_ms = convert_started.elapsed().as_secs_f64() * 1000.0;

    let serialize_started = Instant::now();
    let rendered = serde_json::to_string_pretty(&json!({
        "ok": response.ok,
        "modelId": response.model_id,
        "openPraJson": response.model,
        "diagnostics": diagnostics_json(&response.diagnostics),
        "fileSummary": {
            "index": 0,
            "fileId": null,
            "filePath": file_path,
            "ok": response.ok,
            "modelId": response.model_id,
            "diagnostics": response.diagnostic_counts,
            "inputBytes": input.len(),
        },
        "conversionMetadata": {
            "version": "v1",
            "mode": "file",
            "summary": {
                "totalFiles": 1,
                "okFiles": if response.ok { 1 } else { 0 },
                "failedFiles": if response.ok { 0 } else { 1 },
            },
            "reproducibility": conversion_reproducibility_json(
                mode,
                &stable_input_fingerprint(input),
                response.model_id.as_deref(),
                Some(file_path),
            )
        },
        "limits": payload_limits_json(),
        "telemetry": {
            "endpoint": "convert_openpsa_xml_file_to_openpra_json",
            "timingsMs": {
                "convert": convert_ms,
                "serialize": null,
                "total": null,
            }
        }
    }))
    .map_err(|err| PraxisError::Serialization(format!("Failed to serialize conversion output: {err}")))?;

    let serialize_ms = serialize_started.elapsed().as_secs_f64() * 1000.0;
    let total_ms = total_started.elapsed().as_secs_f64() * 1000.0;
    let mut parsed: serde_json::Value = serde_json::from_str(&rendered).map_err(|err| {
        PraxisError::Serialization(format!(
            "Failed to parse conversion output for telemetry patching: {err}"
        ))
    })?;
    parsed["telemetry"]["timingsMs"]["serialize"] = json!(serialize_ms);
    parsed["telemetry"]["timingsMs"]["total"] = json!(total_ms);

    serde_json::to_string_pretty(&parsed)
        .map_err(|err| PraxisError::Serialization(format!("Failed to serialize conversion output: {err}")))
}

pub fn convert_openpsa_xml_batch_to_openpra_json_contract(input: &str) -> Result<String> {
    let total_started = Instant::now();
    enforce_payload_limit(input, "convert_openpsa_xml_batch_to_openpra_json")?;
    let convert_started = Instant::now();

    let payload: serde_json::Value = serde_json::from_str(input).map_err(|err| {
        PraxisError::Settings(format!(
            "Batch conversion input must be JSON: {{\"files\":[{{\"path\":...,\"xml\":...}}]}} ({err})"
        ))
    })?;

    let files = payload
        .get("files")
        .and_then(|value| value.as_array())
        .ok_or_else(|| {
            PraxisError::Settings("Batch conversion input requires a 'files' array".to_string())
        })?;

    let mode = match payload
        .get("strict")
        .and_then(|value| value.as_bool())
        .unwrap_or(false)
    {
        true => ResolveMode::Strict,
        false => ResolveMode::Compatible,
    };

    let mut results = Vec::new();
    let mut ok_files = 0usize;
    let mut failed_files = 0usize;

    for (index, file_entry) in files.iter().enumerate() {
        let file_id = file_entry
            .get("id")
            .and_then(|value| value.as_str())
            .map(|value| value.to_string());
        let file_path = file_entry
            .get("path")
            .and_then(|value| value.as_str())
            .map(|value| value.to_string());

        let xml = file_entry
            .get("xml")
            .and_then(|value| value.as_str())
            .unwrap_or_default();

        if xml.is_empty() {
            let diagnostic = Diagnostic::new(
                "CONV_BATCH_FILE_XML_MISSING",
                Severity::Error,
                "Batch file entry missing non-empty 'xml' payload",
                format!("$.files[{index}].xml"),
            )
            .with_hint("Provide XML content for each file entry");

            let counts = diagnostic_counts(&[diagnostic.clone()]);
            results.push(json!({
                "index": index,
                "fileId": file_id,
                "filePath": file_path,
                "ok": false,
                "modelId": null,
                "openPraJson": null,
                "diagnostics": diagnostics_json(&[diagnostic]),
                "summary": {
                    "diagnostics": counts,
                    "inputBytes": 0,
                }
            }));
            failed_files += 1;
            continue;
        }

        let response = convert_single_xml_response(
            xml,
            mode,
            file_id.as_deref(),
            file_path.as_deref(),
        );

        if response.ok {
            ok_files += 1;
        } else {
            failed_files += 1;
        }

        results.push(json!({
            "index": index,
            "fileId": file_id,
            "filePath": file_path,
            "ok": response.ok,
            "modelId": response.model_id,
            "openPraJson": response.model,
            "diagnostics": diagnostics_json(&response.diagnostics),
            "summary": {
                "diagnostics": response.diagnostic_counts,
                "inputBytes": xml.len(),
            }
        }));
    }

    let convert_ms = convert_started.elapsed().as_secs_f64() * 1000.0;
    let serialize_started = Instant::now();
    let rendered = serde_json::to_string_pretty(&json!({
        "ok": failed_files == 0,
        "files": results,
        "summary": {
            "totalFiles": files.len(),
            "okFiles": ok_files,
            "failedFiles": failed_files,
        },
        "conversionMetadata": {
            "version": "v1",
            "mode": "batch",
            "resolveMode": match mode {
                ResolveMode::Strict => "strict",
                ResolveMode::Compatible => "compatible",
            },
            "summary": {
                "totalFiles": files.len(),
                "okFiles": ok_files,
                "failedFiles": failed_files,
            },
            "reproducibility": {
                "version": "v1",
                "requestFingerprint": {
                    "algorithm": "fnv1a64",
                    "value": stable_input_fingerprint(input),
                },
                "resolveMode": match mode {
                    ResolveMode::Strict => "strict",
                    ResolveMode::Compatible => "compatible",
                },
                "converterVersion": env!("CARGO_PKG_VERSION"),
            }
        },
        "limits": payload_limits_json(),
        "telemetry": {
            "endpoint": "convert_openpsa_xml_batch_to_openpra_json",
            "timingsMs": {
                "convert": convert_ms,
                "serialize": null,
                "total": null,
            }
        }
    }))
    .map_err(|err| PraxisError::Serialization(format!("Failed to serialize batch conversion output: {err}")))?;

    let serialize_ms = serialize_started.elapsed().as_secs_f64() * 1000.0;
    let total_ms = total_started.elapsed().as_secs_f64() * 1000.0;
    let mut parsed: serde_json::Value = serde_json::from_str(&rendered).map_err(|err| {
        PraxisError::Serialization(format!(
            "Failed to parse batch conversion output for telemetry patching: {err}"
        ))
    })?;
    parsed["telemetry"]["timingsMs"]["serialize"] = json!(serialize_ms);
    parsed["telemetry"]["timingsMs"]["total"] = json!(total_ms);

    serde_json::to_string_pretty(&parsed).map_err(|err| {
        PraxisError::Serialization(format!("Failed to serialize batch conversion output: {err}"))
    })
}

#[derive(Default)]
struct SingleConversionResponse {
    ok: bool,
    model_id: Option<String>,
    model: Option<crate::openpra_mef::json_model::OpenPraJsonModel>,
    diagnostics: Vec<Diagnostic>,
    diagnostic_counts: serde_json::Value,
}

fn convert_single_xml_response(
    input: &str,
    mode: ResolveMode,
    file_id: Option<&str>,
    file_path: Option<&str>,
) -> SingleConversionResponse {
    match crate::openpra_mef::addon_openpsa_xml::parse_openpsa_xml_with_mode(input, mode) {
        Ok(bundle) => {
            let counts = diagnostic_counts(&bundle.diagnostics);
            SingleConversionResponse {
                ok: !bundle
                    .diagnostics
                    .iter()
                    .any(|diagnostic| diagnostic.severity == Severity::Error),
                model_id: bundle.model_id,
                model: bundle.model,
                diagnostics: bundle.diagnostics,
                diagnostic_counts: counts,
            }
        }
        Err(err) => {
            let mut diagnostic = Diagnostic::new("CONV_FAILED", Severity::Error, err.to_string(), "$.input")
                .with_hint("Inspect XML input and diagnostics for unresolved references or malformed structures");
            if let Some(file_id) = file_id {
                diagnostic = diagnostic.with_ref_context("file", file_id, "xml", file_path.unwrap_or("<inline>"));
            }

            let diagnostics = vec![diagnostic];
            SingleConversionResponse {
                ok: false,
                model_id: None,
                model: None,
                diagnostic_counts: diagnostic_counts(&diagnostics),
                diagnostics,
            }
        }
    }
}

fn diagnostic_counts(diagnostics: &[Diagnostic]) -> serde_json::Value {
    let errors = diagnostics
        .iter()
        .filter(|diagnostic| diagnostic.severity == Severity::Error)
        .count();
    let warnings = diagnostics
        .iter()
        .filter(|diagnostic| diagnostic.severity == Severity::Warning)
        .count();
    let infos = diagnostics
        .iter()
        .filter(|diagnostic| diagnostic.severity == Severity::Info)
        .count();

    json!({
        "error": errors,
        "warning": warnings,
        "info": infos,
    })
}

fn enforce_payload_limit(input: &str, endpoint: &str) -> Result<()> {
    let bytes = input.len();
    if bytes > NAPI_MAX_INPUT_BYTES {
        return Err(PraxisError::Settings(format!(
            "NAPI_INPUT_TOO_LARGE: endpoint='{endpoint}', bytes={bytes}, limitBytes={NAPI_MAX_INPUT_BYTES}"
        )));
    }
    Ok(())
}

fn payload_limits_json() -> serde_json::Value {
    json!({
        "maxInputBytes": NAPI_MAX_INPUT_BYTES,
        "recommendedMaxInputBytes": NAPI_MAX_INPUT_BYTES / 2,
        "notes": [
            "Requests larger than maxInputBytes are rejected before parsing",
            "For large workloads, prefer file-based workflows or chunked preprocessing",
        ]
    })
}

fn run_metadata_json(
    backend: &str,
    seed: u64,
    num_trials_requested: usize,
    num_trials_executed: Option<usize>,
    timing_ms: Option<f64>,
    convergence: crate::mc::core::ConvergenceSettings,
    convergence_met: Option<bool>,
    telemetry: serde_json::Value,
    reproducibility: serde_json::Value,
) -> serde_json::Value {
    let convergence_json = if convergence.enabled {
        json!({
            "enabled": true,
            "criterion": "wald-linear-log10",
            "confidence": convergence.confidence,
            "delta": convergence.delta,
            "burnIn": convergence.burn_in,
            "met": convergence_met,
            "trialsEvaluated": num_trials_executed,
        })
    } else {
        json!({
            "enabled": false,
            "criterion": "wald-linear-log10",
            "confidence": 0.95,
            "delta": null,
            "burnIn": null,
            "met": null,
            "trialsEvaluated": num_trials_executed,
        })
    };

    json!({
        "backend": backend,
        "params": {
            "numTrialsRequested": num_trials_requested,
            "numTrialsExecuted": num_trials_executed,
        },
        "seed": seed,
        "timingMs": timing_ms,
        "convergence": convergence_json,
        "telemetry": telemetry,
        "reproducibility": reproducibility,
    })
}

fn telemetry_timings_json(
    parse_ms: f64,
    resolve_ms: f64,
    build_inputs_ms: Option<f64>,
    quantify_ms: Option<f64>,
    serialize_ms: Option<f64>,
    total_ms: Option<f64>,
) -> serde_json::Value {
    json!({
        "version": "v1",
        "timingsMs": {
            "parse": parse_ms,
            "resolve": resolve_ms,
            "buildInputs": build_inputs_ms,
            "quantify": quantify_ms,
            "serialize": serialize_ms,
            "total": total_ms,
        }
    })
}

fn reproducibility_json(
    seed: u64,
    mode: ResolveMode,
    input_fingerprint: &str,
    model_id: Option<&str>,
) -> serde_json::Value {
    json!({
        "version": "v1",
        "seed": seed,
        "resolveMode": match mode {
            ResolveMode::Strict => "strict",
            ResolveMode::Compatible => "compatible",
        },
        "inputFingerprint": {
            "algorithm": "fnv1a64",
            "value": input_fingerprint,
        },
        "modelId": model_id,
        "engineVersion": env!("CARGO_PKG_VERSION"),
    })
}

fn conversion_reproducibility_json(
    mode: ResolveMode,
    input_fingerprint: &str,
    model_id: Option<&str>,
    file_path: Option<&str>,
) -> serde_json::Value {
    json!({
        "version": "v1",
        "resolveMode": match mode {
            ResolveMode::Strict => "strict",
            ResolveMode::Compatible => "compatible",
        },
        "inputFingerprint": {
            "algorithm": "fnv1a64",
            "value": input_fingerprint,
        },
        "modelId": model_id,
        "filePath": file_path,
        "converterVersion": env!("CARGO_PKG_VERSION"),
    })
}

fn stable_input_fingerprint(input: &str) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in input.as_bytes() {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

fn sequence_uncertainty_json(
    probability: f64,
    frequency: f64,
    successes: usize,
    num_trials: usize,
    confidence_level: f64,
) -> serde_json::Value {
    if num_trials == 0 {
        return json!({
            "method": "binomial-wald",
            "confidenceLevel": confidence_level,
            "standardError": null,
            "halfWidth95": null,
            "relativeHalfWidth95": null,
            "frequencyHalfWidth95": null,
            "confidenceIntervalLower": null,
            "confidenceIntervalUpper": null,
            "sampleSize": 0,
            "successes": successes,
        });
    }

    let n = num_trials as f64;
    let variance = (probability * (1.0 - probability) / n).max(0.0);
    let standard_error = variance.sqrt();
    let z = crate::mc::stats::normal_quantile_two_sided(confidence_level).unwrap_or(1.96_f64);
    let half_width = z * standard_error;
    let relative_half_width_95 = if probability > 0.0 {
        Some(half_width / probability)
    } else {
        None
    };
    let frequency_scale = if probability > 0.0 {
        Some(frequency / probability)
    } else {
        None
    };
    let frequency_half_width = frequency_scale.map(|scale| half_width * scale);

    let (ci_lo, ci_hi) = crate::mc::stats::ci_wald_z(probability, num_trials as u64, z);

    json!({
        "method": "binomial-wald",
        "confidenceLevel": confidence_level,
        "standardError": standard_error,
        "halfWidth95": half_width,
        "relativeHalfWidth95": relative_half_width_95,
        "frequencyHalfWidth95": frequency_half_width,
        "confidenceIntervalLower": ci_lo,
        "confidenceIntervalUpper": ci_hi,
        "sampleSize": num_trials,
        "successes": successes,
    })
}

fn sequence_convergence_json(
    enabled: bool,
    met: Option<bool>,
    trials_evaluated: usize,
    delta: Option<f64>,
    confidence: Option<f64>,
    burn_in: Option<u64>,
) -> serde_json::Value {
    json!({
        "enabled": enabled,
        "criterion": "wald-linear-log10",
        "confidence": confidence,
        "delta": delta,
        "burnIn": burn_in,
        "met": met,
        "trialsEvaluated": trials_evaluated,
    })
}

fn quantification_seed_row_for_sequence(
    bundle: &crate::openpra_mef::contracts::OpenPraJsonBundle,
    sequence_id: &str,
) -> Option<serde_json::Map<String, serde_json::Value>> {
    let esq = bundle
        .model
        .as_ref()?
        .technical_elements
        .event_sequence_quantification
        .as_ref()?;

    let matched = esq.quantification_results.iter().find(|result| {
        result.event_sequence_id.as_deref() == Some(sequence_id) || result.id == sequence_id
    })?;

    Some(quantification_result_seed_map(matched))
}

fn quantification_result_seed_map(
    result: &crate::openpra_mef::json_model::event_sequence_quantification::QuantificationResult,
) -> serde_json::Map<String, serde_json::Value> {
    let mut row = serde_json::Map::new();
    row.insert("id".to_string(), json!(result.id));

    if let Some(event_sequence_id) = &result.event_sequence_id {
        row.insert("eventSequenceId".to_string(), json!(event_sequence_id));
    }
    if let Some(family_id) = &result.family_id {
        row.insert("familyId".to_string(), json!(family_id));
    }
    if let Some(initiating_event_id) = &result.initiating_event_id {
        row.insert("initiatingEventId".to_string(), json!(initiating_event_id));
    }

    merge_additional_fields(&mut row, &result.additional_fields);
    row
}

fn merge_additional_fields(
    row: &mut serde_json::Map<String, serde_json::Value>,
    additional_fields: &HashMap<String, serde_json::Value>,
) {
    let mut keys: Vec<&String> = additional_fields.keys().collect();
    keys.sort();

    for key in keys {
        if !row.contains_key(key) {
            if let Some(value) = additional_fields.get(key) {
                row.insert(key.clone(), value.clone());
            }
        }
    }
}

#[cfg(feature = "napi-rs")]
mod node_bindings {
    use super::*;
    use napi::Error;
    use napi_derive::napi;

    #[napi]
    pub fn validate_openpra_json(input: String) -> napi::Result<String> {
        validate_openpra_json_contract(&input).map_err(|e| Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn quantify_openpra_json(input: String, strict: Option<bool>) -> napi::Result<String> {
        let mode = if strict.unwrap_or(false) {
            ResolveMode::Strict
        } else {
            ResolveMode::Compatible
        };
        quantify_openpra_json_contract(&input, mode).map_err(|e| Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn quantify_openpra_json_with_settings(
        model_json: String,
        settings_json: String,
    ) -> napi::Result<String> {
        quantify_openpra_json_with_settings_contract(&model_json, &settings_json)
            .map_err(|e| Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn compile_event_tree_pdag_openpra_json_with_settings(
        model_json: String,
        settings_json: String,
    ) -> napi::Result<String> {
        compile_event_tree_pdag_openpra_json_with_settings_contract(&model_json, &settings_json)
            .map_err(|e| Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn convert_openpsa_xml_to_openpra_json(input: String) -> napi::Result<String> {
        convert_openpsa_xml_to_openpra_json_contract(&input)
            .map_err(|e| Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn convert_openpsa_xml_file_to_openpra_json(
        file_path: String,
        input: String,
    ) -> napi::Result<String> {
        convert_openpsa_xml_file_to_openpra_json_contract(&file_path, &input)
            .map_err(|e| Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn convert_openpsa_xml_batch_to_openpra_json(input: String) -> napi::Result<String> {
        convert_openpsa_xml_batch_to_openpra_json_contract(&input)
            .map_err(|e| Error::from_reason(e.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_contract_reports_invalid_json() {
        let rendered = validate_openpra_json_contract("{ not-json }").unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&rendered).unwrap();
        assert_eq!(parsed["ok"], false);
        assert!(parsed["diagnostics"].is_array());
        assert_eq!(parsed["telemetry"]["endpoint"], "validate_openpra_json");
        assert!(parsed["telemetry"]["timingsMs"]["validate"].is_number());
        assert!(parsed["telemetry"]["timingsMs"]["serialize"].is_number());
        assert!(parsed["telemetry"]["timingsMs"]["total"].is_number());
    }

    #[test]
    fn quantify_contract_returns_output_envelope() {
        let input = r#"{
            "id": "MODEL-NAPI-1",
            "technicalElements": {
                "data-analysis": {"id": "DA", "dataParameters": [{"id": "DP", "probability": 0.01}]},
                "systems-analysis": {
                    "id": "SA",
                    "systemDefinitions": [{"id": "SYS", "faultTreeId": "FT"}],
                    "systemLogicModels": [{"id": "FT", "modelType": "or", "basicEventRefs": ["DP"]}]
                },
                "initiating-event-analysis": {"id": "IEA", "initiators": [{"id": "IE", "probability": 1.0}]},
                "event-sequence-analysis": {
                    "id": "ESA",
                    "eventSequences": [
                        {"id": "SEQ1", "initiatingEventId": "IE", "functionalEventBindings": [{"id": "FEB1", "functionalEventId": "FE1", "faultTreeId": "FT"}]},
                        {"id": "SEQ2", "initiatingEventId": "IE", "functionalEventBindings": [{"id": "FEB2", "functionalEventId": "FE1", "faultTreeId": "FT"}]}
                    ]
                },
                "event-sequence-quantification": {"id": "ESQ", "quantificationResults": []},
                "risk-integration": {"id": "RI", "eventSequenceToReleaseCategoryMappings": []}
            }
        }"#;

        let rendered = quantify_openpra_json_contract(input, ResolveMode::Compatible).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&rendered).unwrap();
        assert_eq!(parsed["id"], "MODEL-NAPI-1");
        assert_eq!(parsed["outputMetadata"]["schemaVersion"], "openpra-mef-output-v1");
        assert_eq!(parsed["outputMetadata"]["runMetadata"]["backend"], "cpu");
        assert_eq!(parsed["outputMetadata"]["runMetadata"]["reproducibility"]["version"], "v1");
        assert_eq!(
            parsed["outputMetadata"]["runMetadata"]["reproducibility"]["resolveMode"],
            "compatible"
        );
        assert!(parsed["outputMetadata"]["runMetadata"]["telemetry"]["timingsMs"]["parse"].is_number());
        assert!(parsed["outputMetadata"]["runMetadata"]["telemetry"]["timingsMs"]["resolve"].is_number());
        assert!(parsed["outputMetadata"]["runMetadata"]["telemetry"]["timingsMs"]["serialize"].is_number());
        assert!(parsed["outputMetadata"]["runMetadata"]["telemetry"]["timingsMs"]["total"].is_number());
        assert!(parsed["technicalElements"]["event-sequence-quantification"]["quantificationResults"].is_array());
    }

    #[test]
    fn validate_contract_rejects_large_payloads() {
        let oversized = "x".repeat(NAPI_MAX_INPUT_BYTES + 1);
        let err = validate_openpra_json_contract(&oversized).unwrap_err();
        assert!(err.to_string().contains("NAPI_INPUT_TOO_LARGE"));
    }

    #[test]
    fn conversion_contract_returns_converted_openpra_payload() {
        let xml = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/core/and.xml"));
        let rendered = convert_openpsa_xml_to_openpra_json_contract(xml).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&rendered).unwrap();

        assert_eq!(parsed["ok"], true);
        assert!(parsed["openPraJson"]["technical_elements"]["data_analysis"].is_object());
        assert!(parsed["openPraJson"]["technical_elements"]["systems_analysis"].is_object());
        assert_eq!(parsed["conversionMetadata"]["version"], "v1");
        assert_eq!(parsed["conversionMetadata"]["mode"], "single");
        assert_eq!(
            parsed["conversionMetadata"]["reproducibility"]["resolveMode"],
            "compatible"
        );
        assert_eq!(parsed["fileSummary"]["inputBytes"], xml.len());
        assert_eq!(parsed["limits"]["maxInputBytes"], NAPI_MAX_INPUT_BYTES as u64);
        assert!(parsed["telemetry"]["timingsMs"]["convert"].is_number());
        assert!(parsed["telemetry"]["timingsMs"]["serialize"].is_number());
        assert!(parsed["telemetry"]["timingsMs"]["total"].is_number());
    }

    #[test]
    fn conversion_file_contract_includes_file_summary_and_reproducibility() {
        let xml = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/core/and.xml"));
        let rendered =
            convert_openpsa_xml_file_to_openpra_json_contract("fixtures/core/and.xml", xml)
                .unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&rendered).unwrap();

        assert_eq!(parsed["ok"], true);
        assert_eq!(parsed["fileSummary"]["filePath"], "fixtures/core/and.xml");
        assert_eq!(parsed["conversionMetadata"]["mode"], "file");
        assert_eq!(
            parsed["conversionMetadata"]["reproducibility"]["filePath"],
            "fixtures/core/and.xml"
        );
        assert!(parsed["telemetry"]["timingsMs"]["convert"].is_number());
    }

    #[test]
    fn conversion_batch_contract_returns_per_file_summaries() {
        let valid_xml =
            include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/core/and.xml"));
        let batch_request = json!({
            "strict": false,
            "files": [
                {
                    "id": "and",
                    "path": "fixtures/core/and.xml",
                    "xml": valid_xml
                },
                {
                    "id": "broken",
                    "path": "fixtures/broken.xml",
                    "xml": "<opsa-mef><define-fault-tree></opsa-mef>"
                }
            ]
        });

        let rendered =
            convert_openpsa_xml_batch_to_openpra_json_contract(&batch_request.to_string()).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&rendered).unwrap();

        assert_eq!(parsed["ok"], false);
        assert_eq!(parsed["summary"]["totalFiles"], 2);
        assert_eq!(parsed["summary"]["okFiles"], 1);
        assert_eq!(parsed["summary"]["failedFiles"], 1);
        assert_eq!(parsed["conversionMetadata"]["mode"], "batch");

        let files = parsed["files"].as_array().expect("files array expected");
        assert_eq!(files.len(), 2);
        assert_eq!(files[0]["summary"]["inputBytes"], valid_xml.len());
        assert!(files[0]["summary"]["diagnostics"]["info"].is_number());
        assert!(files[1]["diagnostics"].is_array());
        assert!(parsed["telemetry"]["timingsMs"]["convert"].is_number());
        assert!(parsed["telemetry"]["timingsMs"]["serialize"].is_number());
    }

    #[test]
    fn quantify_contract_retains_cutset_compatible_esq_fields() {
        let input = r#"{
            "id": "MODEL-NAPI-CUTSET-1",
            "technicalElements": {
                "data-analysis": {"id": "DA", "dataParameters": [{"id": "DP", "probability": 0.01}]},
                "systems-analysis": {
                    "id": "SA",
                    "systemDefinitions": [{"id": "SYS", "faultTreeId": "FT"}],
                    "systemLogicModels": [{"id": "FT", "modelType": "or", "basicEventRefs": ["DP"]}]
                },
                "initiating-event-analysis": {"id": "IEA", "initiators": [{"id": "IE", "probability": 1.0}]},
                "event-sequence-analysis": {
                    "id": "ESA",
                    "eventSequences": [
                        {"id": "SEQ1", "initiatingEventId": "IE", "functionalEventBindings": [{"id": "FEB1", "functionalEventId": "FE1", "faultTreeId": "FT"}]},
                        {"id": "SEQ2", "initiatingEventId": "IE", "functionalEventBindings": [{"id": "FEB2", "functionalEventId": "FE1", "faultTreeId": "FT"}]}
                    ]
                },
                "event-sequence-quantification": {
                    "id": "ESQ",
                    "quantificationResults": [
                        {
                            "id": "QR-SEQ1",
                            "eventSequenceId": "SEQ1",
                            "initiatingEventId": "IE",
                            "familyId": "FAM-A",
                            "cutSets": [{"id": "CS-1", "members": ["DP"]}],
                            "cutSetGrouping": {"by": "system", "groupCount": 1}
                        }
                    ]
                },
                "risk-integration": {"id": "RI", "eventSequenceToReleaseCategoryMappings": []}
            }
        }"#;

        let rendered = quantify_openpra_json_contract(input, ResolveMode::Compatible).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&rendered).unwrap();
        let rows = parsed["technicalElements"]["event-sequence-quantification"]["quantificationResults"]
            .as_array()
            .unwrap();

        let seq1 = rows
            .iter()
            .find(|row| row["eventSequenceId"] == "SEQ1")
            .expect("Expected quantified row for SEQ1");

        assert_eq!(seq1["id"], "QR-SEQ1");
        assert_eq!(seq1["familyId"], "FAM-A");
        assert_eq!(seq1["initiatingEventId"], "IE");
        assert!(seq1["cutSets"].is_array());
        assert_eq!(seq1["cutSets"][0]["id"], "CS-1");
        assert_eq!(seq1["cutSetGrouping"]["groupCount"], 1);
        assert!(seq1["probability"].is_number());
        assert!(seq1["frequency"].is_number());
        assert!(seq1["uncertainty"]["standardError"].is_number());
        assert_eq!(seq1["uncertainty"]["confidenceLevel"], 0.95);
        assert_eq!(seq1["convergence"]["enabled"], false);
        assert!(seq1["numTrials"].is_u64());
        assert!(seq1["successes"].is_u64());
    }

    #[test]
    fn quantify_with_settings_emits_adaptive_upper_bound() {
        let model_json = r#"{
            "id": "MODEL-NAPI-ADAPTIVE-1",
            "technicalElements": {
                "data-analysis": {"id": "DA", "dataParameters": [{"id": "DP", "probability": 0.0}]},
                "systems-analysis": {
                    "id": "SA",
                    "systemDefinitions": [{"id": "SYS", "faultTreeId": "FT"}],
                    "systemLogicModels": [{"id": "FT", "modelType": "or", "basicEventRefs": ["DP"]}]
                },
                "initiating-event-analysis": {"id": "IEA", "initiators": [{"id": "IE", "probability": 1.0}]},
                "event-sequence-analysis": {
                    "id": "ESA",
                    "eventSequences": [
                        {"id": "SEQ1", "initiatingEventId": "IE", "functionalEventBindings": [{"id": "FEB1", "functionalEventId": "FE1", "faultTreeId": "FT"}]}
                    ]
                },
                "event-sequence-quantification": {"id": "ESQ", "quantificationResults": []},
                "risk-integration": {"id": "RI", "eventSequenceToReleaseCategoryMappings": []}
            }
        }"#;

        let settings_json = r#"{"adaptive": true}"#;
        let rendered =
            quantify_openpra_json_with_settings_contract(model_json, settings_json).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&rendered).unwrap();

        let rows = parsed["technicalElements"]["event-sequence-quantification"]["quantificationResults"]
            .as_array()
            .unwrap();
        let seq1 = rows
            .iter()
            .find(|row| row["eventSequenceId"] == "SEQ1")
            .expect("Expected quantified row for SEQ1");

        assert!(seq1["probability"].is_number());
        assert!(seq1["conditionalProbabilityUpperBound"].is_number());
        assert!(seq1["conditionalProbabilityUpperBound"].as_f64().unwrap() >= 0.0);
    }
    #[test]
    fn quantify_with_settings_adaptive_stops_retaining_cut_sets_by_relative_error() {
        let model_json = r#"{
            "id": "MODEL-NAPI-ADAPTIVE-STOP-1",
            "technicalElements": {
                "data-analysis": {
                    "id": "DA",
                    "dataParameters": [
                        {"id": "DP1", "probability": 0.2},
                        {"id": "DP2", "probability": 0.2}
                    ]
                },
                "systems-analysis": {
                    "id": "SA",
                    "systemDefinitions": [{"id": "SYS", "faultTreeId": "FT"}],
                    "systemLogicModels": [{"id": "FT", "modelType": "or", "basicEventRefs": ["DP1", "DP2"]}]
                },
                "initiating-event-analysis": {
                    "id": "IEA",
                    "initiators": [{"id": "IE", "probability": 1.0}]
                },
                "event-sequence-analysis": {
                    "id": "ESA",
                    "eventSequences": [
                        {
                            "id": "SEQ1",
                            "initiatingEventId": "IE",
                            "pathSignature": [{"functionalEventId": "FE1", "state": "success"}],
                            "functionalEventBindings": [{"id": "FEB1", "functionalEventId": "FE1", "faultTreeId": "FT"}]
                        },
                        {
                            "id": "SEQ2",
                            "initiatingEventId": "IE",
                            "pathSignature": [{"functionalEventId": "FE1", "state": "failure"}],
                            "functionalEventBindings": [{"id": "FEB2", "functionalEventId": "FE1", "faultTreeId": "FT"}]
                        }
                    ]
                },
                "event-sequence-quantification": {"id": "ESQ", "quantificationResults": []},
                "risk-integration": {"id": "RI", "eventSequenceToReleaseCategoryMappings": []}
            }
        }"#;

        let settings_json = r#"{"adaptive": true, "adaptiveRelativeErrorTarget": 0.5, "adaptiveMaxCutSets": 10, "adaptiveCutSetEnumerationBackend": "zbdd"}"#;
        let rendered =
            quantify_openpra_json_with_settings_contract(model_json, settings_json).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&rendered).unwrap();

        let rows = parsed["technicalElements"]["event-sequence-quantification"]["quantificationResults"]
            .as_array()
            .unwrap();
        let seq1 = rows
            .iter()
            .find(|row| row["eventSequenceId"] == "SEQ1")
            .expect("Expected quantified row for SEQ1");

        assert!(seq1["successes"].as_u64().unwrap() > 0);
        assert!(seq1["cutSets"].is_array());
        assert_eq!(seq1["cutSets"].as_array().unwrap().len(), 1);
        assert_eq!(
            seq1["adaptiveCutSetSummary"]["retainedCutSets"].as_u64().unwrap(),
            1
        );
        assert_eq!(
            seq1["adaptiveCutSetSummary"]["stopReason"].as_str().unwrap(),
            "relativeErrorMet"
        );
        assert!(
            seq1["adaptiveCutSetSummary"]["stopMcubRelativeError"]
                .as_f64()
                .unwrap()
                <= 0.5
        );
    }

    #[test]
    fn quantify_with_settings_mc_early_stop_reports_convergence_and_ci() {
        let model_json = r#"{
            "id": "MODEL-NAPI-MC-EARLY-STOP-1",
            "technicalElements": {
                "data-analysis": {
                    "id": "DA",
                    "dataParameters": [
                        {"id": "DP1", "probability": 0.2},
                        {"id": "DP2", "probability": 0.2}
                    ]
                },
                "systems-analysis": {
                    "id": "SA",
                    "systemDefinitions": [{"id": "SYS", "faultTreeId": "FT"}],
                    "systemLogicModels": [{"id": "FT", "modelType": "or", "basicEventRefs": ["DP1", "DP2"]}]
                },
                "initiating-event-analysis": {
                    "id": "IEA",
                    "initiators": [{"id": "IE", "probability": 1.0}]
                },
                "event-sequence-analysis": {
                    "id": "ESA",
                    "eventSequences": [
                        {
                            "id": "SEQ1",
                            "initiatingEventId": "IE",
                            "pathSignature": [{"functionalEventId": "FE1", "state": "success"}],
                            "functionalEventBindings": [{"id": "FEB1", "functionalEventId": "FE1", "faultTreeId": "FT"}]
                        },
                        {
                            "id": "SEQ2",
                            "initiatingEventId": "IE",
                            "pathSignature": [{"functionalEventId": "FE1", "state": "failure"}],
                            "functionalEventBindings": [{"id": "FEB2", "functionalEventId": "FE1", "faultTreeId": "FT"}]
                        }
                    ]
                },
                "event-sequence-quantification": {"id": "ESQ", "quantificationResults": []},
                "risk-integration": {"id": "RI", "eventSequenceToReleaseCategoryMappings": []}
            }
        }"#;

        let settings_json = r#"{
            "mcEarlyStop": true,
            "mcDelta": 0.5,
            "mcConfidence": 0.95,
            "mcBurnIn": 0,
            "iterations": 10,
            "batches": 1,
            "bitpacksPerBatch": 1,
            "omega": 64
        }"#;

        let rendered =
            quantify_openpra_json_with_settings_contract(model_json, settings_json).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&rendered).unwrap();

        let run = &parsed["outputMetadata"]["runMetadata"];
        assert_eq!(run["convergence"]["enabled"].as_bool().unwrap(), true);
        assert!(run["convergence"]["delta"].as_f64().unwrap() > 0.0);
        assert_eq!(run["convergence"]["confidence"].as_f64().unwrap(), 0.95);

        let requested = run["params"]["numTrialsRequested"].as_u64().unwrap();
        let executed = run["params"]["numTrialsExecuted"].as_u64().unwrap();
        assert!(executed <= requested);
        assert!(executed < requested);

        let rows = parsed["technicalElements"]["event-sequence-quantification"]["quantificationResults"]
            .as_array()
            .unwrap();
        let seq1 = rows
            .iter()
            .find(|row| row["eventSequenceId"] == "SEQ1")
            .expect("Expected quantified row for SEQ1");

        assert_eq!(seq1["convergence"]["enabled"].as_bool().unwrap(), true);
        assert_eq!(seq1["convergence"]["met"].as_bool().unwrap(), true);
        assert!(seq1["uncertainty"]["confidenceIntervalLower"].is_number());
        assert!(seq1["uncertainty"]["confidenceIntervalUpper"].is_number());
    }

    #[test]
    fn adaptive_tiny_probability_threshold_recipe_is_applied_and_reported() {
        let model_json = r#"{
            "id": "MODEL-NAPI-ADAPTIVE-TINY-RECIPE-1",
            "technicalElements": {
                "data-analysis": {
                    "id": "DA",
                    "dataParameters": [
                        {"id": "DP1", "probability": 0.5},
                        {"id": "DP2", "probability": 0.5}
                    ]
                },
                "systems-analysis": {
                    "id": "SA",
                    "systemDefinitions": [{"id": "SYS", "faultTreeId": "FT"}],
                    "systemLogicModels": [{"id": "FT", "modelType": "or", "basicEventRefs": ["DP1", "DP2"]}]
                },
                "initiating-event-analysis": {
                    "id": "IEA",
                    "initiators": [{"id": "IE", "probability": 1.0}]
                },
                "event-sequence-analysis": {
                    "id": "ESA",
                    "eventSequences": [
                        {
                            "id": "SEQ1",
                            "initiatingEventId": "IE",
                            "pathSignature": [{"functionalEventId": "FE1", "state": "success"}],
                            "functionalEventBindings": [{"id": "FEB1", "functionalEventId": "FE1", "faultTreeId": "FT"}]
                        },
                        {
                            "id": "SEQ2",
                            "initiatingEventId": "IE",
                            "pathSignature": [{"functionalEventId": "FE1", "state": "failure"}],
                            "functionalEventBindings": [{"id": "FEB2", "functionalEventId": "FE1", "faultTreeId": "FT"}]
                        }
                    ]
                },
                "event-sequence-quantification": {"id": "ESQ", "quantificationResults": []},
                "risk-integration": {"id": "RI", "eventSequenceToReleaseCategoryMappings": []}
            }
        }"#;

        let settings_default = r#"{
            "adaptive": true,
            "adaptiveTinyProbabilityThresholdRecipe": "default",
            "iterations": 10,
            "batches": 1,
            "bitpacksPerBatch": 1,
            "omega": 64,
            "seed": 123
        }"#;
        let settings_geom = r#"{
            "adaptive": true,
            "adaptiveTinyProbabilityThresholdRecipe": "geometricMean",
            "iterations": 10,
            "batches": 1,
            "bitpacksPerBatch": 1,
            "omega": 64,
            "seed": 123
        }"#;
        let settings_harm = r#"{
            "adaptive": true,
            "adaptiveTinyProbabilityThresholdRecipe": "harmonicMean",
            "iterations": 10,
            "batches": 1,
            "bitpacksPerBatch": 1,
            "omega": 64,
            "seed": 123
        }"#;

        let out_default =
            quantify_openpra_json_with_settings_contract(model_json, settings_default).unwrap();
        let out_geom =
            quantify_openpra_json_with_settings_contract(model_json, settings_geom).unwrap();
        let out_harm =
            quantify_openpra_json_with_settings_contract(model_json, settings_harm).unwrap();

        let parsed_default: serde_json::Value = serde_json::from_str(&out_default).unwrap();
        let parsed_geom: serde_json::Value = serde_json::from_str(&out_geom).unwrap();
        let parsed_harm: serde_json::Value = serde_json::from_str(&out_harm).unwrap();

        let rows_default = parsed_default["technicalElements"]["event-sequence-quantification"]
            ["quantificationResults"]
            .as_array()
            .unwrap();
        let rows_geom = parsed_geom["technicalElements"]["event-sequence-quantification"]
            ["quantificationResults"]
            .as_array()
            .unwrap();
        let rows_harm = parsed_harm["technicalElements"]["event-sequence-quantification"]
            ["quantificationResults"]
            .as_array()
            .unwrap();

        let seq1_default = rows_default
            .iter()
            .find(|row| row["eventSequenceId"] == "SEQ1")
            .unwrap();
        let seq1_geom = rows_geom
            .iter()
            .find(|row| row["eventSequenceId"] == "SEQ1")
            .unwrap();
        let seq1_harm = rows_harm
            .iter()
            .find(|row| row["eventSequenceId"] == "SEQ1")
            .unwrap();

        let eta_default = seq1_default["adaptiveCutSetSummary"]["tinyProbabilityThreshold"]
            .as_f64()
            .unwrap();
        let eta_geom = seq1_geom["adaptiveCutSetSummary"]["tinyProbabilityThreshold"]
            .as_f64()
            .unwrap();
        let eta_harm = seq1_harm["adaptiveCutSetSummary"]["tinyProbabilityThreshold"]
            .as_f64()
            .unwrap();

        assert_eq!(
            seq1_default["adaptiveCutSetSummary"]["tinyProbabilityThresholdRecipe"]
                .as_str()
                .unwrap(),
            "default"
        );
        assert_eq!(
            seq1_geom["adaptiveCutSetSummary"]["tinyProbabilityThresholdRecipe"]
                .as_str()
                .unwrap(),
            "geometricMean"
        );
        assert_eq!(
            seq1_harm["adaptiveCutSetSummary"]["tinyProbabilityThresholdRecipe"]
                .as_str()
                .unwrap(),
            "harmonicMean"
        );

        assert!(eta_default.is_finite() && eta_default > 0.0);
        assert!(eta_geom.is_finite() && eta_geom > 0.0);
        assert!(eta_harm.is_finite() && eta_harm > 0.0);

        // For any non-degenerate p_hat_mc in (0,1), default (max-based) is most aggressive.
        assert!(eta_default >= eta_geom);
        assert!(eta_geom >= eta_harm);
    }

    #[test]
    fn quantify_with_settings_adaptive_skips_cut_sets_when_zero_successes() {
        let model_json = r#"{
            "id": "MODEL-NAPI-ADAPTIVE-RARE-1",
            "technicalElements": {
                "data-analysis": {"id": "DA", "dataParameters": [{"id": "DP", "probability": 1e-9}]},
                "systems-analysis": {
                    "id": "SA",
                    "systemDefinitions": [{"id": "SYS", "faultTreeId": "FT"}],
                    "systemLogicModels": [{"id": "FT", "modelType": "or", "basicEventRefs": ["DP"]}]
                },
                "initiating-event-analysis": {"id": "IEA", "initiators": [{"id": "IE", "probability": 1.0}]},
                "event-sequence-analysis": {
                    "id": "ESA",
                    "eventSequences": [
                        {
                            "id": "SEQ1",
                            "initiatingEventId": "IE",
                            "pathSignature": [{"functionalEventId": "FE1", "state": "success"}],
                            "functionalEventBindings": [{"id": "FEB1", "functionalEventId": "FE1", "faultTreeId": "FT"}]
                        },
                        {
                            "id": "SEQ2",
                            "initiatingEventId": "IE",
                            "pathSignature": [{"functionalEventId": "FE1", "state": "failure"}],
                            "functionalEventBindings": [{"id": "FEB2", "functionalEventId": "FE1", "faultTreeId": "FT"}]
                        }
                    ]
                },
                "event-sequence-quantification": {"id": "ESQ", "quantificationResults": []},
                "risk-integration": {"id": "RI", "eventSequenceToReleaseCategoryMappings": []}
            }
        }"#;

        let settings_json = r#"{"adaptive": true}"#;
        let rendered =
            quantify_openpra_json_with_settings_contract(model_json, settings_json).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&rendered).unwrap();

        let rows = parsed["technicalElements"]["event-sequence-quantification"]["quantificationResults"]
            .as_array()
            .unwrap();

        let seq1 = rows
            .iter()
            .find(|row| row["eventSequenceId"] == "SEQ1")
            .expect("Expected quantified row for SEQ1");

        assert!(seq1["conditionalProbabilityUpperBound"].is_number());
        assert_eq!(seq1["successes"].as_u64().unwrap(), 0);
        assert_eq!(seq1["probability"].as_f64().unwrap(), 0.0);
        assert_eq!(seq1["frequency"].as_f64().unwrap(), 0.0);
        assert_eq!(seq1["cutSetEnumerationSkipped"].as_bool().unwrap(), true);
    }

    #[test]
    fn compiled_event_tree_pdag_reuse_matches_baseline_quantification() {
        let model_json = r#"{
            "id": "MODEL-NAPI-COMPILED-PDAG-1",
            "technicalElements": {
                "data-analysis": {
                    "id": "DA",
                    "dataParameters": [
                        {"id": "DP1", "probability": 0.2},
                        {"id": "DP2", "probability": 0.2}
                    ]
                },
                "systems-analysis": {
                    "id": "SA",
                    "systemDefinitions": [{"id": "SYS", "faultTreeId": "FT"}],
                    "systemLogicModels": [{"id": "FT", "modelType": "or", "basicEventRefs": ["DP1", "DP2"]}]
                },
                "initiating-event-analysis": {
                    "id": "IEA",
                    "initiators": [{"id": "IE", "probability": 1.0}]
                },
                "event-sequence-analysis": {
                    "id": "ESA",
                    "eventSequences": [
                        {
                            "id": "SEQ1",
                            "initiatingEventId": "IE",
                            "pathSignature": [{"functionalEventId": "FE1", "state": "success"}],
                            "functionalEventBindings": [{"id": "FEB1", "functionalEventId": "FE1", "faultTreeId": "FT"}]
                        },
                        {
                            "id": "SEQ2",
                            "initiatingEventId": "IE",
                            "pathSignature": [{"functionalEventId": "FE1", "state": "failure"}],
                            "functionalEventBindings": [{"id": "FEB2", "functionalEventId": "FE1", "faultTreeId": "FT"}]
                        }
                    ]
                },
                "event-sequence-quantification": {"id": "ESQ", "quantificationResults": []},
                "risk-integration": {"id": "RI", "eventSequenceToReleaseCategoryMappings": []}
            }
        }"#;

        let settings_baseline = r#"{
            "iterations": 6,
            "batches": 1,
            "bitpacksPerBatch": 1,
            "omega": 64,
            "seed": 123
        }"#;

        let baseline =
            quantify_openpra_json_with_settings_contract(model_json, settings_baseline).unwrap();
        let compiled_rendered = compile_event_tree_pdag_openpra_json_with_settings_contract(
            model_json,
            settings_baseline,
        )
        .unwrap();
        let compiled_value: serde_json::Value = serde_json::from_str(&compiled_rendered).unwrap();
        let compiled_b64 = compiled_value["compiledEventTreePdagBase64"]
            .as_str()
            .unwrap();
        assert!(!compiled_b64.is_empty());

        let settings_compiled = json!({
            "iterations": 6,
            "batches": 1,
            "bitpacksPerBatch": 1,
            "omega": 64,
            "seed": 123,
            "compiledEventTreePdagBase64": compiled_b64,
        })
        .to_string();

        let compiled_run =
            quantify_openpra_json_with_settings_contract(model_json, &settings_compiled).unwrap();

        let baseline_v: serde_json::Value = serde_json::from_str(&baseline).unwrap();
        let compiled_v: serde_json::Value = serde_json::from_str(&compiled_run).unwrap();

        let base_rows = baseline_v["technicalElements"]["event-sequence-quantification"]
            ["quantificationResults"]
            .as_array()
            .unwrap();
        let comp_rows = compiled_v["technicalElements"]["event-sequence-quantification"]
            ["quantificationResults"]
            .as_array()
            .unwrap();

        assert_eq!(base_rows.len(), comp_rows.len());

        for base_row in base_rows {
            let seq_id = base_row["eventSequenceId"].as_str().unwrap();
            let comp_row = comp_rows
                .iter()
                .find(|r| r["eventSequenceId"].as_str() == Some(seq_id))
                .unwrap();

            assert_eq!(base_row["numTrials"], comp_row["numTrials"]);
            assert_eq!(base_row["successes"], comp_row["successes"]);
            assert_eq!(base_row["probability"], comp_row["probability"]);
            assert_eq!(base_row["frequency"], comp_row["frequency"]);
        }
    }
}
