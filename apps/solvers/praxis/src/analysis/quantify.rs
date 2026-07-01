use std::collections::HashMap;

use crate::algorithms::build::{build_bdd, enumerate_event_names, BuildOptions};
use crate::algorithms::direct_zbdd::build_zbdd_delterm_named;
use crate::algorithms::mocus::Mocus;
use crate::algorithms::noncoherent_mocus::NonCoherentMocus;
use crate::algorithms::pdag::Pdag;
use crate::algorithms::zbdd_engine::ZbddEngine;
use crate::analysis::approximations;
use crate::analysis::fault_tree::FaultTreeAnalysis;
use crate::analysis::importance::ImportanceAnalysis;
use crate::analysis::uncertainty::propagate_uncertainty;
use crate::core::fault_tree::FaultTree;
use crate::error::PraxisError;
use crate::mc::DpMonteCarloAnalysis;
use crate::Result;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Engine {
    Bdd,
    Zbdd,
    ZbddDelterm,
    Mocus,
    MocusPi,
    MonteCarlo,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Approximation {
    Exact,
    RareEvent,
    Mcub,
    MonteCarlo,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Settings {
    pub engine: Engine,
    pub approximation: Option<Approximation>,
    pub limit_order: Option<usize>,
    pub cut_off: Option<f64>,
    pub importance: bool,
    pub uncertainty: bool,
    pub ccf: bool,
    pub num_trials: usize,
    pub seed: u64,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            engine: Engine::Bdd,
            approximation: None,
            limit_order: None,
            cut_off: None,
            importance: false,
            uncertainty: false,
            ccf: false,
            num_trials: 10_000,
            seed: 847,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct ProbabilityOut {
    pub value: f64,
    pub approximation: Approximation,
}

#[derive(Debug, Clone, PartialEq)]
pub struct CutSetOut {
    pub literals: Vec<(String, bool)>,
    pub probability: f64,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct CutSetsOut {
    pub prime_implicants: bool,
    pub products: usize,
    pub distribution_by_order: Vec<usize>,
    pub list: Vec<CutSetOut>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ImportanceOut {
    pub event: String,
    pub birnbaum: f64,
    pub criticality: f64,
    pub fussell_vesely: f64,
    pub raw: f64,
    pub rrw: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct UncertaintyOut {
    pub mean: f64,
    pub standard_deviation: f64,
    pub error_factor: f64,
    pub quantiles: Vec<f64>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct QuantResult {
    pub probability: Option<ProbabilityOut>,
    pub cut_sets: Option<CutSetsOut>,
    pub importance: Option<Vec<ImportanceOut>>,
    pub uncertainty: Option<UncertaintyOut>,
}

fn event_probs(ft: &FaultTree) -> HashMap<String, f64> {
    ft.basic_events()
        .iter()
        .map(|(id, e)| (id.clone(), e.probability()))
        .collect()
}

fn product_probability(events: &[String], probs: &HashMap<String, f64>) -> f64 {
    events
        .iter()
        .map(|e| probs.get(e).copied().unwrap_or(0.0))
        .product()
}

fn cut_sets_from_named(
    mut event_sets: Vec<Vec<String>>,
    probs: &HashMap<String, f64>,
    prime_implicants: bool,
) -> CutSetsOut {
    event_sets.sort();
    let mut max_order = 0;
    let mut list = Vec::with_capacity(event_sets.len());
    for events in &event_sets {
        max_order = max_order.max(events.len());
        let probability = product_probability(events, probs);
        let literals = events.iter().map(|e| (e.clone(), false)).collect();
        list.push(CutSetOut { literals, probability });
    }
    let mut distribution = vec![0usize; max_order + 1];
    for cs in &list {
        distribution[cs.literals.len()] += 1;
    }
    CutSetsOut {
        prime_implicants,
        products: list.len(),
        distribution_by_order: distribution,
        list,
    }
}

fn approx_value(approximation: Approximation, probabilities: &[f64]) -> f64 {
    match approximation {
        Approximation::RareEvent => approximations::rare_event(probabilities),
        Approximation::Mcub => approximations::mcub(probabilities),
        _ => approximations::rare_event(probabilities),
    }
}

pub fn quantify(fault_tree: &FaultTree, settings: &Settings) -> Result<QuantResult> {
    let mut owned;
    let ft: &FaultTree = if settings.ccf && !fault_tree.ccf_groups().is_empty() {
        owned = fault_tree.clone();
        let mut base = HashMap::new();
        for (id, group) in owned.ccf_groups() {
            if let Some(dist) = &group.distribution {
                if let Ok(p) = dist.parse::<f64>() {
                    base.insert(id.clone(), p);
                }
            }
        }
        owned.expand_ccf_groups(&base)?;
        &owned
    } else {
        fault_tree
    };

    let mut result = QuantResult::default();
    let probs = event_probs(ft);

    tracing::info!(
        target: "praxis::quantify",
        engine = ?settings.engine,
        top = ft.top_event(),
        gates = ft.gates().len(),
        basic_events = ft.basic_events().len(),
        cut_off = ?settings.cut_off,
        limit_order = ?settings.limit_order,
        "quantify start"
    );

    match settings.engine {
        Engine::Bdd => {
            let built = build_bdd(ft, BuildOptions::default())?;
            let value = if settings.limit_order.is_some() || settings.cut_off.is_some() {
                built
                    .bdd
                    .probability_with_limits(built.root, settings.limit_order, settings.cut_off)
            } else {
                built.bdd.probability(built.root)
            };
            result.probability = Some(ProbabilityOut {
                value,
                approximation: Approximation::Exact,
            });
        }
        Engine::Zbdd => {
            let built = build_bdd(ft, BuildOptions::default())?;
            let mut bdd = built.bdd;
            let root = built.root;
            let exact = bdd.probability(root);
            bdd.freeze();
            let (zbdd, zroot) = if settings.limit_order.is_some() || settings.cut_off.is_some() {
                ZbddEngine::build_from_bdd_with_limits(
                    &bdd,
                    root,
                    false,
                    settings.limit_order,
                    settings.cut_off,
                )
            } else {
                ZbddEngine::build_from_bdd(&bdd, root, false)
            };
            let event_sets = enumerate_event_names(&zbdd, zroot, &built.pdag, &built.order);
            let per: Vec<f64> = event_sets
                .iter()
                .map(|s| product_probability(s, &probs))
                .collect();
            result.cut_sets = Some(cut_sets_from_named(event_sets, &probs, false));
            result.probability = Some(match settings.approximation {
                Some(Approximation::RareEvent) => ProbabilityOut {
                    value: approximations::rare_event(&per),
                    approximation: Approximation::RareEvent,
                },
                Some(Approximation::Mcub) => ProbabilityOut {
                    value: approximations::mcub(&per),
                    approximation: Approximation::Mcub,
                },
                _ => ProbabilityOut {
                    value: exact,
                    approximation: Approximation::Exact,
                },
            });
        }
        Engine::ZbddDelterm => {
            let pdag = Pdag::from_fault_tree(ft)?;
            let named =
                build_zbdd_delterm_named(&pdag, ft, settings.cut_off, settings.limit_order, None)?;
            let mut per = Vec::with_capacity(named.len());
            let mut max_order = 0;
            let mut list = Vec::with_capacity(named.len());
            for cs in &named {
                let mut literals: Vec<(String, bool)> = Vec::with_capacity(cs.len());
                let mut p = 1.0;
                for lit in cs {
                    let (name, negated) = match lit.strip_prefix('~') {
                        Some(rest) => (rest.to_string(), true),
                        None => (lit.clone(), false),
                    };
                    let pe = probs.get(&name).copied().unwrap_or(0.0);
                    p *= if negated { 1.0 - pe } else { pe };
                    literals.push((name, negated));
                }
                max_order = max_order.max(literals.len());
                per.push(p);
                list.push(CutSetOut {
                    literals,
                    probability: p,
                });
            }
            list.sort_by(|a, b| a.literals.cmp(&b.literals));
            let mut distribution = vec![0usize; max_order + 1];
            for cs in &list {
                distribution[cs.literals.len()] += 1;
            }
            result.cut_sets = Some(CutSetsOut {
                prime_implicants: true,
                products: list.len(),
                distribution_by_order: distribution,
                list,
            });
            let approximation = settings.approximation.unwrap_or(Approximation::Mcub);
            result.probability = Some(ProbabilityOut {
                value: approx_value(approximation, &per),
                approximation,
            });
        }
        Engine::Mocus => {
            let mut mocus = Mocus::new(ft);
            if let Some(n) = settings.limit_order {
                mocus = mocus.with_max_order(n);
            }
            if let Some(c) = settings.cut_off {
                mocus = mocus.with_cut_off(c);
            }
            let mut event_sets: Vec<Vec<String>> = mocus
                .analyze()?
                .iter()
                .map(|cs| {
                    let mut v: Vec<String> = cs.events.iter().cloned().collect();
                    v.sort();
                    v
                })
                .collect();
            event_sets.sort();
            let per: Vec<f64> = event_sets
                .iter()
                .map(|s| product_probability(s, &probs))
                .collect();
            result.cut_sets = Some(cut_sets_from_named(event_sets, &probs, false));
            if let Some(approximation) = settings.approximation {
                result.probability = Some(ProbabilityOut {
                    value: approx_value(approximation, &per),
                    approximation,
                });
            }
        }
        Engine::MocusPi => {
            let pdag = Pdag::from_fault_tree(ft)?;
            let mut engine = NonCoherentMocus::new(&pdag, ft)?;
            let primes = engine.analyze_primes();
            let mut per = Vec::with_capacity(primes.len());
            let mut max_order = 0;
            let mut list = Vec::with_capacity(primes.len());
            for cs in &primes {
                let p = engine.cut_set_probability(cs);
                per.push(p);
                max_order = max_order.max(cs.literals.len());
                let literals = cs
                    .literals
                    .iter()
                    .map(|&lit| {
                        let name = pdag
                            .get_node(lit.abs())
                            .and_then(|n| n.id())
                            .unwrap_or("")
                            .to_string();
                        (name, lit < 0)
                    })
                    .collect();
                list.push(CutSetOut {
                    literals,
                    probability: p,
                });
            }
            list.sort_by(|a, b| a.literals.cmp(&b.literals));
            let mut distribution = vec![0usize; max_order + 1];
            for cs in &list {
                distribution[cs.literals.len()] += 1;
            }
            result.cut_sets = Some(CutSetsOut {
                prime_implicants: true,
                products: list.len(),
                distribution_by_order: distribution,
                list,
            });
            let approximation = settings.approximation.unwrap_or(Approximation::Mcub);
            result.probability = Some(ProbabilityOut {
                value: approx_value(approximation, &per),
                approximation,
            });
        }
        Engine::MonteCarlo => {
            let mc = DpMonteCarloAnalysis::new(ft, Some(settings.seed), settings.num_trials)?
                .run_cpu()?;
            result.probability = Some(ProbabilityOut {
                value: mc.probability_estimate,
                approximation: Approximation::MonteCarlo,
            });
        }
    }

    if settings.importance {
        let nominal = FaultTreeAnalysis::new(ft)?.analyze()?.top_event_probability;
        if nominal.is_finite() && nominal > 0.0 {
            let records = ImportanceAnalysis::new(ft, nominal)?.analyze()?;
            let mut imps: Vec<ImportanceOut> = records
                .into_iter()
                .map(|r| ImportanceOut {
                    event: r.event_id,
                    birnbaum: r.factors.mif,
                    criticality: r.factors.cif,
                    fussell_vesely: r.factors.dif,
                    raw: r.factors.raw,
                    rrw: r.factors.rrw,
                })
                .collect();
            imps.sort_by(|a, b| a.event.cmp(&b.event));
            result.importance = Some(imps);
        }
    }

    if settings.uncertainty {
        let analysis = propagate_uncertainty(ft, settings.num_trials, Some(settings.seed))
            .map_err(|e| PraxisError::Logic(format!("uncertainty failed: {e}")))?;
        result.uncertainty = Some(UncertaintyOut {
            mean: analysis.mean(),
            standard_deviation: analysis.sigma(),
            error_factor: analysis.error_factor(),
            quantiles: analysis.quantiles().to_vec(),
        });
    }

    tracing::info!(
        target: "praxis::quantify",
        probability = ?result.probability.as_ref().map(|p| p.value),
        cut_sets = ?result.cut_sets.as_ref().map(|c| c.products),
        "quantify done"
    );
    Ok(result)
}

pub fn quantify_bytes(model: &[u8], settings: &Settings) -> Result<Vec<u8>> {
    let fault_tree = crate::io::pbf::decode_fault_tree(model)?;
    let result = quantify(&fault_tree, settings)?;
    Ok(crate::io::pbf::encode_result(&result))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::event::BasicEvent;
    use crate::core::gate::{Formula, Gate};

    fn demo() -> FaultTree {
        let mut ft = FaultTree::new("FT", "top").unwrap();
        let mut top = Gate::new("top".into(), Formula::Or).unwrap();
        top.add_operand("g1".into());
        top.add_operand("g2".into());
        ft.add_gate(top).unwrap();
        let mut g1 = Gate::new("g1".into(), Formula::And).unwrap();
        g1.add_operand("A".into());
        g1.add_operand("B".into());
        ft.add_gate(g1).unwrap();
        let mut g2 = Gate::new("g2".into(), Formula::And).unwrap();
        g2.add_operand("C".into());
        g2.add_operand("D".into());
        ft.add_gate(g2).unwrap();
        for e in ["A", "B", "C", "D"] {
            ft.add_basic_event(BasicEvent::new(e.into(), 0.1).unwrap()).unwrap();
        }
        ft
    }

    #[test]
    fn bdd_exact_probability() {
        let ft = demo();
        let r = quantify(&ft, &Settings::default()).unwrap();
        let p = r.probability.unwrap();
        assert_eq!(p.approximation, Approximation::Exact);

        assert!((p.value - 0.0199).abs() < 1e-9);
    }

    #[test]
    fn zbdd_and_mocus_agree_on_cut_sets() {
        let ft = demo();
        let mut s = Settings {
            engine: Engine::Zbdd,
            ..Default::default()
        };
        let z = quantify(&ft, &s).unwrap().cut_sets.unwrap();
        s.engine = Engine::Mocus;
        let m = quantify(&ft, &s).unwrap().cut_sets.unwrap();
        assert_eq!(z.products, 2);
        assert_eq!(m.products, 2);
    }

    #[test]
    fn mocus_pi_consensus() {

        let mut ft = FaultTree::new("FT", "top").unwrap();
        let mut top = Gate::new("top".into(), Formula::Or).unwrap();
        top.add_operand("g1".into());
        top.add_operand("g2".into());
        ft.add_gate(top).unwrap();
        let mut g1 = Gate::new("g1".into(), Formula::And).unwrap();
        g1.add_operand("A".into());
        g1.add_operand("B".into());
        ft.add_gate(g1).unwrap();
        let mut na = Gate::new("na".into(), Formula::Not).unwrap();
        na.add_operand("A".into());
        ft.add_gate(na).unwrap();
        let mut g2 = Gate::new("g2".into(), Formula::And).unwrap();
        g2.add_operand("na".into());
        g2.add_operand("C".into());
        ft.add_gate(g2).unwrap();
        for e in ["A", "B", "C"] {
            ft.add_basic_event(BasicEvent::new(e.into(), 0.1).unwrap()).unwrap();
        }
        let s = Settings {
            engine: Engine::MocusPi,
            ..Default::default()
        };
        let cs = quantify(&ft, &s).unwrap().cut_sets.unwrap();
        assert!(cs.prime_implicants);
        assert_eq!(cs.products, 3);
    }

    #[test]
    fn importance_and_uncertainty() {
        let ft = demo();
        let s = Settings {
            importance: true,
            uncertainty: true,
            num_trials: 200,
            ..Default::default()
        };
        let r = quantify(&ft, &s).unwrap();
        assert_eq!(r.importance.unwrap().len(), 4);
        assert!(r.uncertainty.unwrap().mean >= 0.0);
    }

    #[test]
    fn bytes_path_matches_direct() {
        let ft = demo();
        let model = crate::io::pbf::encode_fault_tree(&ft).unwrap();
        let s = Settings {
            engine: Engine::Zbdd,
            approximation: Some(Approximation::RareEvent),
            importance: true,
            ..Default::default()
        };
        let result_bytes = quantify_bytes(&model, &s).unwrap();
        let from_bytes = crate::io::pbf::decode_result(&result_bytes).unwrap();
        let direct = quantify(&ft, &s).unwrap();
        assert_eq!(from_bytes, direct);
        assert_eq!(from_bytes.cut_sets.unwrap().products, 2);
    }
}
