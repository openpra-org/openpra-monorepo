use std::collections::{BTreeMap, HashMap, HashSet};

use praxis::analysis::event_tree_quantification::{
    EventTreeSequenceDiagnostics, EventTreeSequenceProbability,
};
use praxis::analysis::sequence_cut_sets::{
    cut_set_sweep, merge_cut_sets, scale_for, sequence_cut_sets, CutOffBasis, CutSetQuantifier,
    CutSetSweepPoint, SequenceCutSetSettings, SequenceCutSets, WeightedCutSet,
};
use praxis::{PraxisError, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::{event_tree_result_json, EventTreeAdapter};

const MAX_KEEP: usize = 10_000;
const MAX_FOCUS: usize = 500;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub(super) enum CutOffBasisInput {
    Frequency,
    Probability,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub(super) enum CutSetQuantifierInput {
    Mcub,
    RareEvent,
    Exact,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct FocusInput {
    key: String,
    events: Vec<String>,
    minimum: usize,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct CutSetsInput {
    basis: CutOffBasisInput,
    cut_offs: Vec<f64>,
    quantifier: CutSetQuantifierInput,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    limit_order: Option<usize>,
    keep: usize,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    focus: Vec<FocusInput>,
}

impl CutSetsInput {
    fn settings(&self) -> SequenceCutSetSettings {
        SequenceCutSetSettings {
            cut_offs: self.cut_offs.clone(),
            basis: match self.basis {
                CutOffBasisInput::Frequency => CutOffBasis::Frequency,
                CutOffBasisInput::Probability => CutOffBasis::Probability,
            },
            quantifier: match self.quantifier {
                CutSetQuantifierInput::Mcub => CutSetQuantifier::MinCutUpperBound,
                CutSetQuantifierInput::RareEvent => CutSetQuantifier::RareEvent,
                CutSetQuantifierInput::Exact => CutSetQuantifier::Exact,
            },
            limit_order: self.limit_order,
        }
    }

    pub(super) fn validate(&self) -> Result<()> {
        self.settings().validate()?;
        if self.keep == 0 || self.keep > MAX_KEEP {
            return Err(PraxisError::Settings(format!(
                "cut sets kept per sequence must be between 1 and {MAX_KEEP}"
            )));
        }
        if self.focus.len() > MAX_FOCUS {
            return Err(PraxisError::Settings(format!(
                "a cut set run takes at most {MAX_FOCUS} focus groups"
            )));
        }
        let mut keys = HashSet::new();
        for focus in &self.focus {
            if focus.key.trim().is_empty() || !keys.insert(focus.key.as_str()) {
                return Err(PraxisError::Settings(format!(
                    "focus group key '{}' must be present and unique",
                    focus.key
                )));
            }
            let events: HashSet<&str> = focus.events.iter().map(String::as_str).collect();
            if events.is_empty() || events.len() != focus.events.len() {
                return Err(PraxisError::Settings(format!(
                    "focus group '{}' needs distinct events",
                    focus.key
                )));
            }
            if focus.minimum == 0 || focus.minimum > events.len() {
                return Err(PraxisError::Settings(format!(
                    "focus group '{}' needs a minimum between 1 and its {} events",
                    focus.key,
                    events.len()
                )));
            }
        }
        Ok(())
    }
}

fn cut_set_json(cut_set: &WeightedCutSet, annual: f64) -> Value {
    json!({
        "order": cut_set.events.len(),
        "probability": cut_set.probability,
        "annualFrequency": cut_set.probability * annual,
        "basicEventIds": cut_set.events,
    })
}

fn focus_json(cut_sets: &[WeightedCutSet], focus: &[FocusInput], annual: f64) -> Vec<Value> {
    focus
        .iter()
        .filter_map(|group| {
            let members: HashSet<&str> = group.events.iter().map(String::as_str).collect();
            let items: Vec<Value> = cut_sets
                .iter()
                .filter(|cut_set| {
                    cut_set
                        .events
                        .iter()
                        .filter(|event| members.contains(event.as_str()))
                        .count()
                        >= group.minimum
                })
                .map(|cut_set| cut_set_json(cut_set, annual))
                .collect();
            (!items.is_empty()).then(|| json!({ "key": group.key, "items": items }))
        })
        .collect()
}

fn sweep_json(sweep: &[CutSetSweepPoint], annual: f64) -> Vec<Value> {
    sweep
        .iter()
        .map(|point| {
            json!({
                "cutOff": point.cut_off,
                "count": point.count,
                "probability": point.probability,
                "annualFrequency": point.probability * annual,
            })
        })
        .collect()
}

fn items_json(cut_sets: &[WeightedCutSet], keep: usize, annual: f64) -> Vec<Value> {
    cut_sets
        .iter()
        .take(keep)
        .map(|cut_set| cut_set_json(cut_set, annual))
        .collect()
}

fn order_distribution(cut_sets: &[WeightedCutSet]) -> Vec<usize> {
    let highest = cut_sets.iter().map(|cut_set| cut_set.events.len()).max();
    let mut counts = vec![0; highest.map_or(0, |order| order + 1)];
    for cut_set in cut_sets {
        counts[cut_set.events.len()] += 1;
    }
    counts
}

pub(super) fn execute(adapter: &EventTreeAdapter, input: &CutSetsInput) -> Result<Value> {
    let settings = input.settings();
    let annual = adapter.initiating_event_frequency;
    let analysis = sequence_cut_sets(&adapter.model, &adapter.event_tree, &settings, annual)?;
    let scale = scale_for(settings.basis, annual);
    let by_id: HashMap<&str, &SequenceCutSets> = analysis
        .sequences
        .iter()
        .map(|sequence| (sequence.sequence_id.as_str(), sequence))
        .collect();
    let probabilities: Vec<EventTreeSequenceProbability> = analysis
        .sequences
        .iter()
        .map(|sequence| EventTreeSequenceProbability {
            sequence_id: sequence.sequence_id.clone(),
            conditional_probability: sequence.sweep.last().map_or(0.0, |point| point.probability),
            uncertainty: None,
            uncertainty_samples: None,
            diagnostics: EventTreeSequenceDiagnostics {
                bdd: None,
                bridge: None,
                junction_tree: None,
            },
        })
        .collect();
    let mut value = event_tree_result_json(adapter, &probabilities, None)?;
    if let Some(sequences) = value["sequences"].as_array_mut() {
        for sequence in sequences.iter_mut() {
            let id = sequence["sequenceId"]
                .as_str()
                .unwrap_or_default()
                .to_string();
            let entry = by_id.get(id.as_str()).copied().ok_or_else(|| {
                PraxisError::Logic(format!(
                    "PRAXIS did not return cut sets for sequence '{id}'"
                ))
            })?;
            sequence["cutSets"] = json!({
                "count": entry.cut_sets.len(),
                "failedCount": entry.failed_count,
                "distributionByOrder": order_distribution(&entry.cut_sets),
                "sweep": sweep_json(&entry.sweep, annual),
                "items": items_json(&entry.cut_sets, input.keep, annual),
            });
            let focus = focus_json(&entry.cut_sets, &input.focus, annual);
            if !focus.is_empty() {
                sequence["cutSets"]["focus"] = Value::Array(focus);
            }
        }
    }
    let mut families: BTreeMap<String, (Vec<&SequenceCutSets>, Vec<String>)> = BTreeMap::new();
    for sequence in &adapter.snapshot.sequences {
        let final_id = sequence
            .sequence_chain
            .last()
            .map_or(sequence.id.as_str(), |link| link.entity_id.as_str());
        let Some(family_id) = adapter.sequence_families.get(final_id) else {
            continue;
        };
        let entry = by_id.get(sequence.id.as_str()).copied().ok_or_else(|| {
            PraxisError::Logic(format!(
                "PRAXIS did not return cut sets for sequence '{}'",
                sequence.id
            ))
        })?;
        let slot = families.entry(family_id.clone()).or_default();
        slot.0.push(entry);
        slot.1.push(sequence.id.clone());
    }
    let mut family_values = Vec::with_capacity(families.len());
    for (family_id, (members, sequence_ids)) in families {
        let lists: Vec<&[WeightedCutSet]> = members
            .iter()
            .map(|member| member.cut_sets.as_slice())
            .collect();
        let merged = merge_cut_sets(&lists);
        let sweep = cut_set_sweep(&merged, &settings, scale, &analysis.event_probabilities)?;
        family_values.push(json!({
            "familyId": family_id,
            "sequenceIds": sequence_ids,
            "count": merged.len(),
            "sweep": sweep_json(&sweep, annual),
            "items": items_json(&merged, input.keep, annual),
        }));
    }
    value["cutSetAnalysis"] = json!(input);
    value["families"] = Value::Array(family_values);
    Ok(value)
}

#[cfg(test)]
mod tests {
    use serde_json::{json, Value};

    use crate::event_tree::execute;
    use crate::transport::SolverRequest;

    fn leaf(tree: &str, event: &str) -> Value {
        json!({ "id": format!("{tree}-{event}"), "kind": "BASIC_EVENT_REFERENCE", "basicEventId": event })
    }

    fn input(tree: &str, gate: &str, child: &str, order: usize) -> Value {
        json!({ "id": format!("{tree}-{gate}-{order}"), "gateId": gate, "childId": child, "order": order })
    }

    fn or_tree(id: &str, events: &[&str]) -> Value {
        let top = format!("TOP-{id}");
        json!({
            "id": id, "projectId": "P", "methodType": "FAULT_TREE", "revision": 1,
            "topGate": { "gateId": top },
            "gates": [{ "id": top, "gateType": "OR" }],
            "leafNodes": events.iter().map(|event| leaf(id, event)).collect::<Vec<_>>(),
            "gateInputs": events
                .iter()
                .enumerate()
                .map(|(order, event)| input(id, &top, &format!("{id}-{event}"), order))
                .collect::<Vec<_>>()
        })
    }

    fn step(event: &str, outcome: &str) -> Value {
        json!({ "functionalEventId": event, "outcome": outcome })
    }

    fn envelope(
        mode: &str,
        trees: Vec<Value>,
        events: &[(&str, &str)],
        sequences: Vec<(&str, Vec<Value>, &str)>,
        probabilities: &[(&str, f64)],
        extra: Value,
    ) -> SolverRequest {
        let mut request = json!({
            "schemaVersion": "1.0.0", "methodType": "EVENT_TREE", "modelId": "ET", "revision": 1,
            "mode": mode, "requestedBy": "analyst"
        });
        for (key, value) in extra.as_object().unwrap() {
            request[key] = value.clone();
        }
        let mut snapshots = trees;
        snapshots.push(json!({
            "id": "ET", "methodType": "EVENT_TREE", "revision": 1,
            "initiatingEvent": { "target": { "modelId": "IE", "entityId": "IE-1" } },
            "initiatingEventFrequency": { "value": 2.0 },
            "functionalEvents": events
                .iter()
                .enumerate()
                .map(|(order, (id, _))| json!({ "id": id, "name": id, "order": order }))
                .collect::<Vec<_>>(),
            "functionalEventFaultTreeLinks": events
                .iter()
                .map(|(id, tree)| json!({
                    "functionalEventId": id,
                    "faultTreeTopGate": { "modelId": tree, "entityId": format!("TOP-{tree}") }
                }))
                .collect::<Vec<_>>(),
            "endStates": [{ "id": "SAFE" }, { "id": "DAMAGE" }, { "id": "RELEASE" }],
            "sequences": sequences
                .into_iter()
                .map(|(id, path, end)| json!({
                    "id": id, "path": path, "result": { "kind": "END_STATE", "endStateId": end }
                }))
                .collect::<Vec<_>>()
        }));
        SolverRequest::from_json(
            &json!({
                "schemaVersion": "1.0.0",
                "request": request,
                "modelSnapshots": snapshots,
                "resources": { "faultTreeBasicEventCatalogue": {
                    "projectId": "P",
                    "basicEvents": probabilities
                        .iter()
                        .map(|(id, value)| json!({ "id": id, "probability": { "value": value } }))
                        .collect::<Vec<_>>()
                } }
            })
            .to_string(),
        )
        .unwrap()
    }

    fn two_systems(cut_sets: Value) -> SolverRequest {
        envelope(
            "INDEPENDENT",
            vec![or_tree("A", &["X", "Y"]), or_tree("B", &["Y", "Z"])],
            &[("FE-A", "A"), ("FE-B", "B")],
            vec![
                (
                    "SS",
                    vec![step("FE-A", "SUCCESS"), step("FE-B", "SUCCESS")],
                    "SAFE",
                ),
                (
                    "SF",
                    vec![step("FE-A", "SUCCESS"), step("FE-B", "FAILURE")],
                    "DAMAGE",
                ),
                (
                    "FS",
                    vec![step("FE-A", "FAILURE"), step("FE-B", "SUCCESS")],
                    "DAMAGE",
                ),
                (
                    "FF",
                    vec![step("FE-A", "FAILURE"), step("FE-B", "FAILURE")],
                    "RELEASE",
                ),
            ],
            &[("X", 0.1), ("Y", 0.01), ("Z", 0.2)],
            json!({
                "cutSets": cut_sets,
                "sequenceFamilies": { "SS": "OK", "SF": "DAMAGE", "FS": "DAMAGE", "FF": "RELEASE" }
            }),
        )
    }

    fn sequence<'a>(result: &'a Value, id: &str) -> &'a Value {
        result["sequences"]
            .as_array()
            .unwrap()
            .iter()
            .find(|sequence| sequence["sequenceId"] == id)
            .unwrap()
    }

    fn family<'a>(result: &'a Value, id: &str) -> &'a Value {
        result["families"]
            .as_array()
            .unwrap()
            .iter()
            .find(|family| family["familyId"] == id)
            .unwrap()
    }

    fn events_of(cut_sets: &Value) -> Vec<Vec<String>> {
        cut_sets["items"]
            .as_array()
            .unwrap()
            .iter()
            .map(|item| {
                item["basicEventIds"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|event| event.as_str().unwrap().to_string())
                    .collect()
            })
            .collect()
    }

    fn close(value: &Value, expected: f64) {
        let got = value.as_f64().unwrap();
        assert!(
            (got - expected).abs() < 1e-15,
            "got {got}, expected {expected}"
        );
    }

    fn quantify(quantifier: &str, cut_offs: Value, basis: &str) -> Value {
        execute(&two_systems(
            json!({ "basis": basis, "cutOffs": cut_offs, "quantifier": quantifier, "keep": 10 }),
        ))
        .unwrap()
    }

    #[test]
    fn delete_terms_remove_products_that_fail_a_succeeded_system() {
        let result = quantify("EXACT", json!([0.1, 0.03, 0.01]), "FREQUENCY");
        let both = sequence(&result, "FF");
        assert_eq!(both["cutSets"]["count"], 2);
        assert_eq!(both["cutSets"]["failedCount"], 2);
        assert_eq!(both["cutSets"]["distributionByOrder"], json!([0, 1, 1]));
        assert_eq!(events_of(&both["cutSets"]), vec![vec!["X", "Z"], vec!["Y"]]);
        close(&both["cutSets"]["items"][0]["annualFrequency"], 0.04);
        let counts: Vec<u64> = both["cutSets"]["sweep"]
            .as_array()
            .unwrap()
            .iter()
            .map(|point| point["count"].as_u64().unwrap())
            .collect();
        assert_eq!(counts, vec![0, 1, 2]);
        close(&both["cutSets"]["sweep"][0]["probability"], 0.0);
        close(&both["cutSets"]["sweep"][1]["probability"], 0.02);
        close(
            &both["cutSets"]["sweep"][2]["probability"],
            0.02 + 0.01 - 0.02 * 0.01,
        );
        close(&both["conditionalProbability"], 0.0298);
        close(&both["annualFrequency"], 0.0596);

        let second = sequence(&result, "SF");
        assert_eq!(second["cutSets"]["failedCount"], 2);
        assert_eq!(events_of(&second["cutSets"]), vec![vec!["Z"]]);
        assert_eq!(
            events_of(&sequence(&result, "FS")["cutSets"]),
            vec![vec!["X"]]
        );
        let none = sequence(&result, "SS");
        assert_eq!(events_of(&none["cutSets"]), vec![Vec::<String>::new()]);
        close(&none["conditionalProbability"], 1.0);

        let damage = family(&result, "DAMAGE");
        assert_eq!(damage["sequenceIds"], json!(["SF", "FS"]));
        assert_eq!(damage["count"], 2);
        close(&damage["sweep"][2]["probability"], 0.28);
        close(&damage["sweep"][2]["annualFrequency"], 0.56);
        close(
            &family(&result, "RELEASE")["sweep"][2]["probability"],
            0.0298,
        );
        close(&family(&result, "OK")["sweep"][0]["probability"], 1.0);
        assert_eq!(
            result["cutSetAnalysis"],
            json!({ "basis": "FREQUENCY", "cutOffs": [0.1, 0.03, 0.01], "quantifier": "EXACT", "keep": 10 })
        );
    }

    #[test]
    fn quantifiers_bases_and_order_limits_follow_their_definitions() {
        let upper = quantify("MCUB", json!([0.01]), "FREQUENCY");
        close(
            &sequence(&upper, "FF")["conditionalProbability"],
            1.0 - 0.98 * 0.99,
        );
        close(
            &family(&upper, "DAMAGE")["sweep"][0]["probability"],
            1.0 - 0.9 * 0.8,
        );
        let rare = quantify("RARE_EVENT", json!([0.01]), "FREQUENCY");
        close(&sequence(&rare, "FF")["conditionalProbability"], 0.03);
        close(&family(&rare, "DAMAGE")["sweep"][0]["probability"], 0.3);

        let probability = quantify("RARE_EVENT", json!([0.015]), "PROBABILITY");
        assert_eq!(
            events_of(&sequence(&probability, "FF")["cutSets"]),
            vec![vec!["X", "Z"]]
        );
        let frequency = quantify("RARE_EVENT", json!([0.015]), "FREQUENCY");
        assert_eq!(sequence(&frequency, "FF")["cutSets"]["count"], 2);

        let limited = execute(&two_systems(json!({
            "basis": "FREQUENCY", "cutOffs": [1e-9], "quantifier": "RARE_EVENT", "keep": 1, "limitOrder": 1
        })))
        .unwrap();
        let both = sequence(&limited, "FF");
        assert_eq!(both["cutSets"]["count"], 1);
        assert_eq!(both["cutSets"]["failedCount"], 1);
        assert_eq!(events_of(&both["cutSets"]), vec![vec!["Y"]]);
        assert_eq!(limited["cutSetAnalysis"]["limitOrder"], 1);
    }

    #[test]
    fn exclusions_delete_the_excluded_combination() {
        let run = |excluded: bool, quantifier: &str| {
            let second = if excluded { "M2-EX" } else { "A-M2" };
            let mut gates = vec![
                json!({ "id": "TOP-A", "gateType": "AND" }),
                json!({ "id": "TRAIN-1", "gateType": "OR" }),
                json!({ "id": "TRAIN-2", "gateType": "OR" }),
            ];
            let mut inputs = vec![
                input("A", "TOP-A", "TRAIN-1", 0),
                input("A", "TOP-A", "TRAIN-2", 1),
                input("A", "TRAIN-1", "A-M1", 0),
                input("A", "TRAIN-1", "A-F1", 1),
                input("A", "TRAIN-2", second, 0),
                input("A", "TRAIN-2", "A-F2", 1),
            ];
            if excluded {
                gates.push(json!({ "id": "M2-EX", "gateType": "AND" }));
                gates.push(json!({ "id": "NOT-M1", "gateType": "NOT" }));
                inputs.push(input("A", "M2-EX", "A-M2", 0));
                inputs.push(input("A", "M2-EX", "NOT-M1", 1));
                inputs.push(input("A", "NOT-M1", "A-M1", 0));
            }
            let leaves: Vec<Value> = ["M1", "M2", "F1", "F2"]
                .iter()
                .map(|event| leaf("A", event))
                .collect();
            let tree = json!({
                "id": "A", "projectId": "P", "methodType": "FAULT_TREE", "revision": 1,
                "topGate": { "gateId": "TOP-A" },
                "gates": gates,
                "leafNodes": leaves,
                "gateInputs": inputs
            });
            let result = execute(&envelope(
                "INDEPENDENT",
                vec![tree],
                &[("FE-A", "A")],
                vec![
                    ("S", vec![step("FE-A", "SUCCESS")], "SAFE"),
                    ("F", vec![step("FE-A", "FAILURE")], "DAMAGE"),
                ],
                &[("M1", 0.05), ("M2", 0.04), ("F1", 0.01), ("F2", 0.02)],
                json!({ "cutSets": { "basis": "PROBABILITY", "cutOffs": [1e-12], "quantifier": quantifier, "keep": 10 } }),
            ))
            .unwrap();
            sequence(&result, "F").clone()
        };
        let free = run(false, "RARE_EVENT");
        assert_eq!(
            events_of(&free["cutSets"]),
            vec![
                vec!["M1", "M2"],
                vec!["F2", "M1"],
                vec!["F1", "M2"],
                vec!["F1", "F2"]
            ]
        );
        close(
            &free["conditionalProbability"],
            0.002 + 0.001 + 0.0004 + 0.0002,
        );
        close(
            &run(false, "MCUB")["conditionalProbability"],
            1.0 - (1.0 - 0.002) * (1.0 - 0.001) * (1.0 - 0.0004) * (1.0 - 0.0002),
        );
        close(
            &run(false, "EXACT")["conditionalProbability"],
            (1.0 - 0.95 * 0.99) * (1.0 - 0.96 * 0.98),
        );
        let excluded = run(true, "RARE_EVENT");
        assert_eq!(
            events_of(&excluded["cutSets"]),
            vec![vec!["F2", "M1"], vec!["F1", "M2"], vec!["F1", "F2"]]
        );
        close(&excluded["conditionalProbability"], 0.001 + 0.0004 + 0.0002);
    }

    #[test]
    fn focus_groups_list_every_kept_cut_set_that_holds_enough_of_their_events() {
        let result = execute(&two_systems(json!({
            "basis": "FREQUENCY", "cutOffs": [1e-9], "quantifier": "RARE_EVENT", "keep": 1,
            "focus": [
                { "key": "PAIR", "events": ["X", "Z"], "minimum": 2 },
                { "key": "ANY", "events": ["Y", "Z"], "minimum": 1 }
            ]
        })))
        .unwrap();
        let focus = |id: &str| sequence(&result, id)["cutSets"]["focus"].clone();
        let both = focus("FF");
        assert_eq!(both[0]["key"], "PAIR");
        assert_eq!(both[0]["items"].as_array().unwrap().len(), 1);
        assert_eq!(both[0]["items"][0]["basicEventIds"], json!(["X", "Z"]));
        close(&both[0]["items"][0]["annualFrequency"], 0.04);
        assert_eq!(both[1]["key"], "ANY");
        assert_eq!(both[1]["items"].as_array().unwrap().len(), 2);
        assert_eq!(focus("SF")[0]["key"], "ANY");
        assert_eq!(focus("SF").as_array().unwrap().len(), 1);
        assert!(focus("FS").is_null());
        assert_eq!(
            sequence(&result, "FF")["cutSets"]["items"]
                .as_array()
                .unwrap()
                .len(),
            1
        );
        assert_eq!(result["cutSetAnalysis"]["focus"][0]["minimum"], 2);
    }

    #[test]
    fn refuses_invalid_cut_set_requests() {
        let error = |cut_sets: Value| execute(&two_systems(cut_sets)).unwrap_err().to_string();
        let with = |field: &str, value: Value| {
            let mut cut_sets = json!({ "basis": "FREQUENCY", "cutOffs": [1e-6], "quantifier": "MCUB", "keep": 10 });
            cut_sets[field] = value;
            cut_sets
        };
        assert!(error(with("keep", json!(0))).contains("between 1 and 10000"));
        assert!(
            error(with("cutOffs", json!([1e-6, 1e-5]))).contains("from the highest to the lowest")
        );
        assert!(error(with("cutOffs", json!([]))).contains("between 1 and 40 cut-offs"));
        let mut above_one = with("basis", json!("PROBABILITY"));
        above_one["cutOffs"] = json!([2.0]);
        assert!(error(above_one).contains("must not exceed 1"));
        assert!(error(with("limitOrder", json!(0))).contains("order limit must be at least 1"));
        assert!(error(with("cutoff", json!(1e-6))).contains("unknown field"));
        assert!(error(with(
            "focus",
            json!([{ "key": "A", "events": ["X"], "minimum": 0 }])
        ))
        .contains("minimum between 1 and its 1 events"));
        assert!(error(with(
            "focus",
            json!([{ "key": "A", "events": ["X", "Y"], "minimum": 3 }])
        ))
        .contains("minimum between 1 and its 2 events"));
        assert!(error(with(
            "focus",
            json!([{ "key": "A", "events": ["X", "X"], "minimum": 1 }])
        ))
        .contains("distinct events"));
        assert!(error(with("focus", json!([{ "key": "A", "events": ["X"], "minimum": 1 }, { "key": "A", "events": ["Y"], "minimum": 1 }]))).contains("present and unique"));
        let hybrid = envelope(
            "HYBRID_CAUSAL_LOGIC",
            Vec::new(),
            &[],
            Vec::new(),
            &[],
            json!({ "cutSets": { "basis": "FREQUENCY", "cutOffs": [1e-6], "quantifier": "MCUB", "keep": 10 } }),
        );
        assert!(execute(&hybrid)
            .unwrap_err()
            .to_string()
            .contains("Cut sets are available for independent event-tree runs"));
    }
}
