use std::collections::{BTreeMap, HashMap};

use crate::algorithms::bdd_engine::BddRef;
use crate::hcl::{numpy_statistics, HclEventBinding, HclQuantifier};
use crate::Result;

#[derive(Clone, Debug, PartialEq)]
pub struct EventConditional {
    pub event: String,
    pub bound: bool,
    pub in_target: bool,
    pub probability: f64,
    pub occurred: Option<f64>,
    pub not_occurred: Option<f64>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct TargetConditionals {
    pub total: f64,
    pub events: Vec<EventConditional>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct EventImportance {
    pub event: String,
    pub probability: f64,
    pub occurred: Option<f64>,
    pub not_occurred: Option<f64>,
    pub birnbaum: Option<f64>,
    pub risk_achievement_worth: Option<f64>,
    pub risk_reduction_worth: Option<f64>,
    pub fussell_vesely: Option<f64>,
    pub criticality: Option<f64>,
}

impl TargetConditionals {
    pub fn certain() -> Self {
        Self {
            total: 1.0,
            events: Vec::new(),
        }
    }

    pub fn measures(&self) -> Vec<EventImportance> {
        let total = self.total;
        let known = total > 0.0;
        self.events
            .iter()
            .filter(|event| event.in_target)
            .map(|event| {
                let occurred = event.occurred.map(|value| value.clamp(0.0, 1.0));
                let not_occurred = event.not_occurred.map(|value| value.clamp(0.0, 1.0));
                let probability = event.probability.clamp(0.0, 1.0);
                EventImportance {
                    event: event.event.clone(),
                    probability,
                    occurred,
                    not_occurred,
                    birnbaum: occurred
                        .zip(not_occurred)
                        .map(|(with, without)| with - without),
                    risk_achievement_worth: occurred.filter(|_| known).map(|with| with / total),
                    risk_reduction_worth: not_occurred
                        .filter(|&without| known && without > 0.0)
                        .map(|without| total / without),
                    fussell_vesely: not_occurred
                        .filter(|_| known)
                        .map(|without| (total - without) / total),
                    criticality: known.then(|| occurred.unwrap_or(0.0) * probability / total),
                }
            })
            .collect()
    }

    pub fn sum(parts: &[&TargetConditionals]) -> TargetConditionals {
        let mut merged: BTreeMap<&str, EventConditional> = BTreeMap::new();
        for part in parts {
            for event in &part.events {
                let entry =
                    merged
                        .entry(event.event.as_str())
                        .or_insert_with(|| EventConditional {
                            event: event.event.clone(),
                            bound: event.bound,
                            in_target: false,
                            probability: event.probability,
                            occurred: Some(0.0),
                            not_occurred: Some(0.0),
                        });
                entry.in_target = entry.in_target || event.in_target;
            }
        }
        for part in parts {
            let own: HashMap<&str, &EventConditional> = part
                .events
                .iter()
                .map(|event| (event.event.as_str(), event))
                .collect();
            for (name, entry) in merged.iter_mut() {
                let (with, without) = match own.get(name) {
                    Some(event) => (event.occurred, event.not_occurred),
                    None => (Some(part.total), Some(part.total)),
                };
                entry.occurred = entry.occurred.zip(with).map(|(sum, value)| sum + value);
                entry.not_occurred = entry
                    .not_occurred
                    .zip(without)
                    .map(|(sum, value)| sum + value);
            }
        }
        TargetConditionals {
            total: parts.iter().map(|part| part.total).sum(),
            events: merged.into_values().collect(),
        }
    }

    pub fn mix(parts: &[(f64, &TargetConditionals)]) -> Option<TargetConditionals> {
        let weight: f64 = parts.iter().map(|(weight, _)| weight).sum();
        if parts.is_empty() || weight <= 0.0 {
            return None;
        }
        let lookups: Vec<HashMap<&str, &EventConditional>> = parts
            .iter()
            .map(|(_, part)| {
                part.events
                    .iter()
                    .map(|event| (event.event.as_str(), event))
                    .collect()
            })
            .collect();
        let mut names: BTreeMap<&str, (bool, bool)> = BTreeMap::new();
        for (_, part) in parts {
            for event in &part.events {
                let entry = names
                    .entry(event.event.as_str())
                    .or_insert((event.bound, false));
                entry.1 = entry.1 || event.in_target;
            }
        }
        let events = names
            .into_iter()
            .map(|(name, (bound, in_target))| {
                let shared = lookups
                    .iter()
                    .find_map(|lookup| lookup.get(name))
                    .map_or(0.0, |event| event.probability);
                let mut probability = 0.0;
                let mut with = (0.0, 0.0);
                let mut without = (0.0, 0.0);
                for ((share, part), lookup) in parts.iter().zip(&lookups) {
                    let (chance, occurred, not_occurred) = match lookup.get(name) {
                        Some(event) => (event.probability, event.occurred, event.not_occurred),
                        None => (shared, Some(part.total), Some(part.total)),
                    };
                    probability += share * chance;
                    let (on, off) = if bound {
                        (share * chance, share * (1.0 - chance))
                    } else {
                        (*share, *share)
                    };
                    if let Some(value) = occurred {
                        with.0 += on * value;
                        with.1 += on;
                    }
                    if let Some(value) = not_occurred {
                        without.0 += off * value;
                        without.1 += off;
                    }
                }
                EventConditional {
                    event: name.to_string(),
                    bound,
                    in_target,
                    probability: probability / weight,
                    occurred: (with.1 > 0.0).then(|| with.0 / with.1),
                    not_occurred: (without.1 > 0.0).then(|| without.0 / without.1),
                }
            })
            .collect();
        Some(TargetConditionals {
            total: parts
                .iter()
                .map(|(share, part)| share * part.total)
                .sum::<f64>()
                / weight,
            events,
        })
    }
}

pub(crate) fn target_conditionals(
    quantifier: &mut HclQuantifier,
    root: BddRef,
    inside: &[(String, usize)],
    outside: &[(String, HclEventBinding)],
) -> Result<TargetConditionals> {
    let total = quantifier.quantify(root)?;
    let mut events = Vec::with_capacity(inside.len() + outside.len());
    for (name, variable) in inside {
        events.push(EventConditional {
            event: name.clone(),
            bound: quantifier.bindings().get(*variable).is_some(),
            in_target: true,
            probability: quantifier.event_probability(*variable)?,
            occurred: quantifier.conditional_on(root, *variable, true)?,
            not_occurred: quantifier.conditional_on(root, *variable, false)?,
        });
    }
    for (name, binding) in outside {
        events.push(EventConditional {
            event: name.clone(),
            bound: true,
            in_target: false,
            probability: quantifier.binding_probability(binding)?,
            occurred: quantifier.conditional_on_binding(root, binding, true)?,
            not_occurred: quantifier.conditional_on_binding(root, binding, false)?,
        });
    }
    events.sort_by(|left, right| left.event.cmp(&right.event));
    Ok(TargetConditionals { total, events })
}

#[derive(Clone, Debug, PartialEq)]
pub struct SampledConditional {
    pub event: String,
    pub bound: bool,
    pub in_target: bool,
    pub probability: Vec<f64>,
    pub occurred: Vec<f64>,
    pub not_occurred: Vec<f64>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct SampledTarget {
    pub total: Vec<f64>,
    pub events: Vec<SampledConditional>,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct MeasureSummary {
    pub sample_count: usize,
    pub mean: f64,
    pub percentile_05: f64,
    pub median: f64,
    pub percentile_95: f64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct SampledEventImportance {
    pub event: String,
    pub birnbaum: Option<MeasureSummary>,
    pub risk_achievement_worth: Option<MeasureSummary>,
    pub risk_reduction_worth: Option<MeasureSummary>,
    pub fussell_vesely: Option<MeasureSummary>,
    pub criticality: Option<MeasureSummary>,
}

fn summary(values: impl Iterator<Item = Option<f64>>) -> Option<MeasureSummary> {
    let mut defined: Vec<f64> = values.flatten().filter(|value| value.is_finite()).collect();
    if defined.is_empty() {
        return None;
    }
    let mean = numpy_statistics::mean(&defined);
    defined.sort_by(|left, right| left.total_cmp(right));
    Some(MeasureSummary {
        sample_count: defined.len(),
        mean,
        percentile_05: numpy_statistics::percentile(&defined, 0.05),
        median: numpy_statistics::median(&defined),
        percentile_95: numpy_statistics::percentile(&defined, 0.95),
    })
}

fn known(value: f64) -> Option<f64> {
    (!value.is_nan()).then(|| value.clamp(0.0, 1.0))
}

impl TargetConditionals {
    pub fn leading(&self, keep: usize) -> Vec<String> {
        let mut rows = self.measures();
        rows.sort_by(|left, right| {
            right
                .fussell_vesely
                .unwrap_or(f64::NEG_INFINITY)
                .total_cmp(&left.fussell_vesely.unwrap_or(f64::NEG_INFINITY))
                .then_with(|| left.event.cmp(&right.event))
        });
        rows.truncate(keep);
        rows.into_iter().map(|row| row.event).collect()
    }
}

impl SampledTarget {
    pub fn certain(sample_count: usize) -> Self {
        Self {
            total: vec![1.0; sample_count],
            events: Vec::new(),
        }
    }

    pub fn sum(parts: &[&SampledTarget]) -> SampledTarget {
        let count = parts.first().map_or(0, |part| part.total.len());
        let mut total = vec![0.0; count];
        for part in parts {
            for (sum, value) in total.iter_mut().zip(&part.total) {
                *sum += value;
            }
        }
        let mut merged: BTreeMap<&str, SampledConditional> = BTreeMap::new();
        for part in parts {
            for event in &part.events {
                let entry =
                    merged
                        .entry(event.event.as_str())
                        .or_insert_with(|| SampledConditional {
                            event: event.event.clone(),
                            bound: event.bound,
                            in_target: false,
                            probability: event.probability.clone(),
                            occurred: vec![0.0; count],
                            not_occurred: vec![0.0; count],
                        });
                entry.in_target = entry.in_target || event.in_target;
            }
        }
        for part in parts {
            let own: HashMap<&str, &SampledConditional> = part
                .events
                .iter()
                .map(|event| (event.event.as_str(), event))
                .collect();
            for (name, entry) in merged.iter_mut() {
                let (with, without) = match own.get(name) {
                    Some(event) => (&event.occurred, &event.not_occurred),
                    None => (&part.total, &part.total),
                };
                for (sum, value) in entry.occurred.iter_mut().zip(with) {
                    *sum += value;
                }
                for (sum, value) in entry.not_occurred.iter_mut().zip(without) {
                    *sum += value;
                }
            }
        }
        SampledTarget {
            total,
            events: merged.into_values().collect(),
        }
    }

    pub fn measures(&self, keep: &[String]) -> Vec<SampledEventImportance> {
        keep.iter()
            .filter_map(|name| self.events.iter().find(|event| &event.event == name))
            .map(|event| {
                let rows = || {
                    self.total
                        .iter()
                        .zip(&event.probability)
                        .zip(event.occurred.iter().zip(&event.not_occurred))
                        .map(|((&total, &chance), (&with, &without))| {
                            (total, chance.clamp(0.0, 1.0), known(with), known(without))
                        })
                };
                SampledEventImportance {
                    event: event.event.clone(),
                    birnbaum: summary(
                        rows().map(|(_, _, with, without)| with.zip(without).map(|(a, b)| a - b)),
                    ),
                    risk_achievement_worth: summary(rows().map(|(total, _, with, _)| {
                        with.filter(|_| total > 0.0).map(|value| value / total)
                    })),
                    risk_reduction_worth: summary(rows().map(|(total, _, _, without)| {
                        without
                            .filter(|&value| total > 0.0 && value > 0.0)
                            .map(|value| total / value)
                    })),
                    fussell_vesely: summary(rows().map(|(total, _, _, without)| {
                        without
                            .filter(|_| total > 0.0)
                            .map(|value| (total - value) / total)
                    })),
                    criticality: summary(rows().map(|(total, chance, with, _)| {
                        (total > 0.0).then(|| with.unwrap_or(0.0) * chance / total)
                    })),
                }
            })
            .collect()
    }
}
