use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};

use praxis::analysis::event_tree_quantification::{
    EventTreeBddDiagnostics, EventTreeSequenceDiagnostics, EventTreeSequenceProbability,
};
use praxis::analysis::sequence_measures::{
    compile_sequence_diagrams, importance_by_family, sample_families, ImportanceGroup,
    SequenceDiagram,
};
use praxis::core::distribution_sampling::{
    require_probability, SamplingMethod, SamplingPlan, UncertaintyProgram,
};
use praxis::core::model::Model;
use praxis::expression::Expr;
use praxis::{PraxisError, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::{event_tree_result_json, EventTreeAdapter};

const MAX_TRIALS: usize = 100_000;
const MAX_GROUPS: usize = 5_000;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct ImportanceGroupInput {
    key: String,
    #[serde(default)]
    events: Vec<String>,
    #[serde(default)]
    ccf_groups: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct ImportanceInput {
    #[serde(default)]
    groups: Vec<ImportanceGroupInput>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct SamplingInput {
    trials: usize,
    seed: u64,
    method: SamplingMethod,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct ProbabilityOverride {
    id: String,
    probability: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct OverridesInput {
    #[serde(default)]
    events: Vec<ProbabilityOverride>,
    #[serde(default)]
    ccf_groups: Vec<ProbabilityOverride>,
}

impl OverridesInput {
    pub(super) fn validate(&self) -> Result<()> {
        for entry in self.events.iter().chain(self.ccf_groups.iter()) {
            if entry.id.trim().is_empty() || !(0.0..=1.0).contains(&entry.probability) {
                return Err(PraxisError::Settings(format!(
                    "override '{}' needs an id and a probability between 0 and 1",
                    entry.id
                )));
            }
        }
        Ok(())
    }

    pub(super) fn apply(&self, model: &mut Model) -> Result<()> {
        let mut targets: Vec<(String, f64)> = self
            .events
            .iter()
            .map(|entry| (entry.id.clone(), entry.probability))
            .collect();
        for entry in &self.ccf_groups {
            let mut found = false;
            for fault_tree in model.fault_trees().values() {
                if let Some(group) = fault_tree.ccf_groups().get(&entry.id) {
                    found = true;
                    let expanded: Vec<String> = group.expand()?.into_iter().map(|event| event.id).collect();
                    let present = expanded.iter().any(|id| fault_tree.basic_events().contains_key(id));
                    let ids = if present { expanded } else { group.members.clone() };
                    targets.extend(ids.into_iter().map(|id| (id, entry.probability)));
                }
            }
            if !found {
                return Err(PraxisError::Settings(format!("override names common cause group '{}', which the run does not hold", entry.id)));
            }
        }
        let tree_ids: Vec<String> = model.fault_trees().keys().cloned().collect();
        for tree_id in tree_ids {
            if let Some(fault_tree) = model.get_fault_tree_mut(&tree_id) {
                for (id, probability) in &targets {
                    if let Some(event) = fault_tree.get_basic_event_mut(id) {
                        event.set_probability(*probability)?;
                    }
                }
            }
        }
        Ok(())
    }
}

impl ImportanceInput {
    pub(super) fn validate(&self) -> Result<()> {
        if self.groups.len() > MAX_GROUPS {
            return Err(PraxisError::Settings(format!("importance takes at most {MAX_GROUPS} groups")));
        }
        let mut keys = HashSet::new();
        for group in &self.groups {
            if group.key.trim().is_empty() || !keys.insert(group.key.as_str()) {
                return Err(PraxisError::Settings(format!(
                    "importance group key '{}' must be present and unique",
                    group.key
                )));
            }
            if group.events.is_empty() && group.ccf_groups.is_empty() {
                return Err(PraxisError::Settings(format!("importance group '{}' needs events", group.key)));
            }
        }
        Ok(())
    }
}

impl SamplingInput {
    pub(super) fn validate(&self) -> Result<()> {
        if self.trials == 0 || self.trials > MAX_TRIALS {
            return Err(PraxisError::Settings(format!("sampling needs between 1 and {MAX_TRIALS} trials")));
        }
        Ok(())
    }
}

struct CcfTerm {
    group_id: String,
    members: Vec<String>,
}

fn ccf_terms(adapter: &EventTreeAdapter) -> Result<HashMap<String, CcfTerm>> {
    let mut terms = HashMap::new();
    if !adapter.expand_ccf {
        return Ok(terms);
    }
    for fault_tree in adapter.model.fault_trees().values() {
        for (group_id, group) in fault_tree.ccf_groups() {
            for event in group.expand()? {
                terms.insert(
                    event.id,
                    CcfTerm {
                        group_id: group_id.clone(),
                        members: event.failed_members,
                    },
                );
            }
        }
    }
    Ok(terms)
}

fn family_map(adapter: &EventTreeAdapter) -> HashMap<String, String> {
    adapter
        .snapshot
        .sequences
        .iter()
        .filter_map(|sequence| {
            let final_id = sequence
                .sequence_chain
                .last()
                .map_or(sequence.id.as_str(), |link| link.entity_id.as_str());
            adapter
                .sequence_families
                .get(final_id)
                .map(|family| (sequence.id.clone(), family.clone()))
        })
        .collect()
}

fn variables_json(diagrams: &[SequenceDiagram], terms: &HashMap<String, CcfTerm>) -> Vec<Value> {
    let mut seen: BTreeMap<String, f64> = BTreeMap::new();
    for diagram in diagrams {
        for (var, id) in diagram.variables.iter().enumerate() {
            seen.entry(id.clone()).or_insert(diagram.nominal[var]);
        }
    }
    seen.into_iter()
        .map(|(id, probability)| {
            let mut value = json!({ "id": id, "probability": probability });
            if let Some(term) = terms.get(&id) {
                value["ccfGroupId"] = json!(term.group_id);
                value["ccfMembers"] = json!(term.members);
            }
            value
        })
        .collect()
}

fn importance_json(
    adapter: &EventTreeAdapter,
    diagrams: &[SequenceDiagram],
    family_of: &HashMap<String, String>,
    terms: &HashMap<String, CcfTerm>,
    input: &ImportanceInput,
) -> Value {
    let mut by_group: HashMap<&str, Vec<String>> = HashMap::new();
    for (id, term) in terms {
        by_group.entry(term.group_id.as_str()).or_default().push(id.clone());
    }
    let groups: Vec<ImportanceGroup> = input
        .groups
        .iter()
        .map(|group| {
            let mut events: BTreeSet<String> = group.events.iter().cloned().collect();
            for ccf_group in &group.ccf_groups {
                if let Some(members) = by_group.get(ccf_group.as_str()) {
                    events.extend(members.iter().cloned());
                }
            }
            ImportanceGroup {
                key: group.key.clone(),
                events: events.into_iter().collect(),
            }
        })
        .collect();
    let families = importance_by_family(diagrams, family_of, adapter.initiating_event_frequency, &groups);
    json!({
        "families": families.iter().map(|family| json!({
            "familyId": family.family_id,
            "base": family.base,
            "events": family.events.iter().map(|change| json!({ "id": change.id, "decrease": change.decrease, "increase": change.increase })).collect::<Vec<_>>(),
            "groups": family.groups.iter().map(|change| json!({ "key": change.id, "decrease": change.decrease, "increase": change.increase })).collect::<Vec<_>>(),
        })).collect::<Vec<_>>(),
        "variables": variables_json(diagrams, terms),
    })
}

fn sampling_json(
    adapter: &EventTreeAdapter,
    diagrams: &[SequenceDiagram],
    family_of: &HashMap<String, String>,
    input: &SamplingInput,
) -> Result<Value> {
    let mut parameters: HashMap<String, Expr> = HashMap::new();
    let mut events: BTreeMap<String, &Expr> = BTreeMap::new();
    let mut checks: BTreeMap<&str, &Expr> = BTreeMap::new();
    let mut mission_time = None;
    for fault_tree in adapter.model.fault_trees().values() {
        for (subject, check) in fault_tree.probability_checks() {
            checks.entry(subject.as_str()).or_insert(check);
        }
        mission_time.get_or_insert(fault_tree.mission_time());
        for (name, expression) in fault_tree.parameters() {
            match parameters.get(name) {
                Some(existing) if existing != expression => {
                    return Err(PraxisError::Settings(format!(
                        "uncertain parameter '{name}' has two different definitions"
                    )))
                }
                Some(_) => {}
                None => {
                    parameters.insert(name.clone(), expression.clone());
                }
            }
        }
        for (id, event) in fault_tree.basic_events() {
            if let Some(value) = event.value() {
                events.entry(id.clone()).or_insert(value);
            }
        }
    }
    let program = UncertaintyProgram::from_expressions(parameters, mission_time.unwrap_or(1.0));
    let targets: Vec<&Expr> = checks.values().chain(events.values()).copied().collect();
    let plan = SamplingPlan {
        method: input.method,
        trials: input.trials,
        seed: input.seed,
    };
    let mut checked = program.sample(&targets, &plan)?;
    let columns = checked.split_off(checks.len());
    for (subject, column) in checks.keys().zip(&checked) {
        for (trial, value) in column.iter().enumerate() {
            require_probability(subject, Some(trial), *value)?;
        }
    }
    let initiator = adapter.initiator.sample(&plan)?;
    let mut variables: HashMap<String, Vec<f64>> = HashMap::with_capacity(events.len());
    for (id, column) in events.keys().zip(columns) {
        for (trial, value) in column.iter().enumerate() {
            require_probability(&format!("basic event '{id}'"), Some(trial), *value)?;
        }
        variables.insert(id.clone(), column);
    }
    let families = sample_families(
        diagrams,
        family_of,
        adapter.initiating_event_frequency,
        Some(&initiator),
        &variables,
        input.trials,
    )?;
    let used: BTreeSet<&str> = diagrams
        .iter()
        .flat_map(|diagram| diagram.variables.iter().map(String::as_str))
        .filter(|id| variables.contains_key(*id))
        .collect();
    Ok(json!({
        "trials": input.trials,
        "seed": input.seed,
        "method": input.method,
        "sampledEvents": used.len(),
        "families": families.into_iter().map(|(family_id, values)| json!({ "familyId": family_id, "values": values })).collect::<Vec<_>>(),
    }))
}

pub(super) fn execute(
    adapter: &EventTreeAdapter,
    importance: Option<&ImportanceInput>,
    sampling: Option<&SamplingInput>,
) -> Result<Value> {
    let diagrams = compile_sequence_diagrams(&adapter.model, &adapter.event_tree)?;
    let mut values = Vec::new();
    let probabilities: Vec<EventTreeSequenceProbability> = diagrams
        .iter()
        .map(|diagram| EventTreeSequenceProbability {
            sequence_id: diagram.sequence_id.clone(),
            conditional_probability: diagram.evaluate(&diagram.nominal, &mut values),
            uncertainty: None,
            uncertainty_samples: None,
            diagnostics: EventTreeSequenceDiagnostics {
                bdd: Some(EventTreeBddDiagnostics {
                    nodes: diagram.node_count(),
                    variables: diagram.variables.len(),
                    variable_order: diagram.variables.clone(),
                }),
                bridge: None,
                junction_tree: None,
            },
        })
        .collect();
    let mut value = event_tree_result_json(adapter, &probabilities, None)?;
    let family_of = family_map(adapter);
    let terms = ccf_terms(adapter)?;
    if let Some(input) = importance {
        value["importance"] = importance_json(adapter, &diagrams, &family_of, &terms, input);
    }
    if let Some(input) = sampling {
        value["sampling"] = sampling_json(adapter, &diagrams, &family_of, input)?;
    }
    Ok(value)
}

#[cfg(test)]
mod tests {
    use serde_json::{json, Value};

    use crate::event_tree::execute;
    use crate::transport::SolverRequest;

    const X: f64 = 0.1;
    const Y: f64 = 0.01;
    const Z: f64 = 0.2;

    fn leaf(tree: &str, event: &str) -> Value {
        json!({ "id": format!("{tree}-{event}"), "kind": "BASIC_EVENT_REFERENCE", "basicEventId": event })
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
                .map(|(order, event)| json!({ "id": format!("{id}-{top}-{order}"), "gateId": top, "childId": format!("{id}-{event}"), "order": order }))
                .collect::<Vec<_>>()
        })
    }

    fn step(event: &str, outcome: &str) -> Value {
        json!({ "functionalEventId": event, "outcome": outcome })
    }

    fn request(extra: Value, ccf: bool) -> SolverRequest {
        request_with(extra, ccf, Vec::new(), json!([]))
    }

    fn request_with(extra: Value, ccf: bool, replaced: Vec<Value>, parameters: Value) -> SolverRequest {
        let mut request = json!({
            "schemaVersion": "1.0.0", "methodType": "EVENT_TREE", "modelId": "ET", "revision": 1,
            "mode": "INDEPENDENT", "requestedBy": "analyst",
            "sequenceFamilies": { "SS": "OK", "SF": "DAMAGE", "FS": "DAMAGE", "FF": "RELEASE" }
        });
        for (key, value) in extra.as_object().unwrap() {
            request[key] = value.clone();
        }
        let events: Vec<Value> = [("X", X), ("Y", Y), ("Z", Z)]
            .iter()
            .map(|(id, value)| {
                replaced
                    .iter()
                    .find(|event| event["id"] == *id)
                    .cloned()
                    .unwrap_or_else(|| crate::fault_tree::tests::point_event(id, *value))
            })
            .collect();
        let mut catalogue = json!({ "projectId": "P", "basicEvents": events, "uncertaintyParameters": parameters });
        if ccf {
            request["expandCcf"] = json!(true);
            catalogue["commonCauseFailureGroups"] = json!([{
                "id": "G", "members": ["X", "Z"], "factors": crate::fault_tree::tests::beta_factor(0.1), "total": crate::fault_tree::tests::point(0.15)
            }]);
        }
        let paths = [
            ("SS", "SUCCESS", "SUCCESS", "SAFE"),
            ("SF", "SUCCESS", "FAILURE", "DAMAGE"),
            ("FS", "FAILURE", "SUCCESS", "DAMAGE"),
            ("FF", "FAILURE", "FAILURE", "RELEASE"),
        ];
        let sequences: Vec<Value> = paths.iter().map(|(id, a, b, end)| json!({
            "id": id, "path": [step("FE-A", a), step("FE-B", b)], "result": { "kind": "END_STATE", "endStateId": end }
        })).collect();
        let tree = json!({
            "id": "ET", "methodType": "EVENT_TREE", "revision": 1,
            "initiatingEvent": { "target": { "modelId": "IE", "entityId": "IE-1" } },
            "initiatingEventFrequency": { "expression": crate::fault_tree::tests::per_year(2.0) },
            "functionalEvents": [{ "id": "FE-A", "name": "A", "order": 0 }, { "id": "FE-B", "name": "B", "order": 1 }],
            "functionalEventFaultTreeLinks": [
                { "functionalEventId": "FE-A", "faultTreeTopGate": { "modelId": "A", "entityId": "TOP-A" } },
                { "functionalEventId": "FE-B", "faultTreeTopGate": { "modelId": "B", "entityId": "TOP-B" } }
            ],
            "endStates": [{ "id": "SAFE" }, { "id": "DAMAGE" }, { "id": "RELEASE" }],
            "sequences": sequences
        });
        SolverRequest::from_json(
            &json!({
                "schemaVersion": "1.0.0",
                "request": request,
                "modelSnapshots": [or_tree("A", &["X", "Y"]), or_tree("B", &["Y", "Z"]), tree],
                "resources": { "faultTreeBasicEventCatalogue": catalogue }
            })
            .to_string(),
        )
        .unwrap()
    }

    fn families_by_enumeration(p: [f64; 3]) -> [(String, f64); 3] {
        let mut ok = 0.0;
        let mut damage = 0.0;
        let mut release = 0.0;
        for state in 0..8u8 {
            let on = [state & 1 != 0, state & 2 != 0, state & 4 != 0];
            let weight: f64 = (0..3).map(|index| if on[index] { p[index] } else { 1.0 - p[index] }).product();
            let a = on[0] || on[1];
            let b = on[1] || on[2];
            match (a, b) {
                (false, false) => ok += weight,
                (true, true) => release += weight,
                _ => damage += weight,
            }
        }
        [("DAMAGE".to_string(), 2.0 * damage), ("OK".to_string(), 2.0 * ok), ("RELEASE".to_string(), 2.0 * release)]
    }

    fn of(values: [(String, f64); 3], id: &str) -> f64 {
        values.iter().find(|(name, _)| name == id).map_or(0.0, |(_, value)| *value)
    }

    fn family<'f>(families: &'f Value, id: &str) -> &'f Value {
        families.as_array().unwrap().iter().find(|family| family["familyId"] == id).unwrap()
    }

    fn change<'f>(family: &'f Value, list: &str, field: &str, id: &str) -> Option<&'f Value> {
        family[list].as_array().unwrap().iter().find(|entry| entry[field] == id)
    }

    fn near(got: f64, expected: f64) {
        assert!((got - expected).abs() <= 1e-15 * expected.abs().max(1e-3), "got {got}, expected {expected}");
    }

    fn near_scaled(got: f64, expected: f64, scale: f64) {
        assert!((got - expected).abs() <= 1e-13 * scale, "got {got}, expected {expected}");
    }

    #[test]
    fn importance_matches_conditioning_by_enumeration() {
        let result = execute(&request(json!({ "importance": { "groups": [{ "key": "XZ", "events": ["X", "Z"] }] } }), false)).unwrap();
        let plain = execute(&request(json!({}), false)).unwrap();
        for (left, right) in result["sequences"].as_array().unwrap().iter().zip(plain["sequences"].as_array().unwrap()) {
            assert_eq!(left["conditionalProbability"], right["conditionalProbability"]);
        }
        let importance = &result["importance"];
        let names = ["X", "Y", "Z"];
        for (family_id, value) in families_by_enumeration([X, Y, Z]) {
            let entry = family(&importance["families"], &family_id);
            near(entry["base"].as_f64().unwrap(), value);
            for (index, name) in names.iter().enumerate() {
                let mut down = [X, Y, Z];
                down[index] = 0.0;
                let mut up = [X, Y, Z];
                up[index] = 1.0;
                let removed = of(families_by_enumeration(down), &family_id);
                let failed = of(families_by_enumeration(up), &family_id);
                let found = change(entry, "events", "id", name);
                let (decrease, increase) = found.map_or((0.0, 0.0), |item| (item["decrease"].as_f64().unwrap(), item["increase"].as_f64().unwrap()));
                near_scaled(decrease, value - removed, value);
                near_scaled(increase, failed - value, value);
            }
            let removed = of(families_by_enumeration([0.0, Y, 0.0]), &family_id);
            let failed = of(families_by_enumeration([1.0, Y, 1.0]), &family_id);
            let group = change(entry, "groups", "key", "XZ").unwrap();
            near_scaled(group["decrease"].as_f64().unwrap(), value - removed, value);
            near_scaled(group["increase"].as_f64().unwrap(), failed - value, value);
        }
        let variables = importance["variables"].as_array().unwrap();
        assert_eq!(variables.iter().map(|variable| variable["id"].as_str().unwrap()).collect::<Vec<_>>(), ["X", "Y", "Z"]);
    }

    fn sampling(events: Vec<Value>, parameters: Value, extra: Value) -> Value {
        sampling_from(events, parameters, extra, None)
    }

    fn sampling_from(events: Vec<Value>, parameters: Value, extra: Value, initiator: Option<Value>) -> Value {
        let mut input = json!({ "trials": 20000, "seed": 5, "method": "LATIN_HYPERCUBE" });
        for (key, value) in extra.as_object().unwrap() {
            input[key] = value.clone();
        }
        let mut request = request_with(json!({ "sampling": input }), false, events, parameters);
        if let Some(initiator) = initiator {
            request.model_snapshots[2]["initiatingEventFrequency"] = initiator;
        }
        execute(&request).unwrap()
    }

    fn values(result: &Value, id: &str) -> Vec<f64> {
        family(&result["sampling"]["families"], id)["values"].as_array().unwrap().iter().map(|value| value.as_f64().unwrap()).collect()
    }

    fn mean(values: &[f64]) -> f64 {
        values.iter().sum::<f64>() / values.len() as f64
    }

    fn parameter(entity: &str) -> Value {
        json!({ "referenceType": "WORKBOOK_PARAMETER", "workbookId": "da", "entityId": entity })
    }

    fn uses(id: &str, entity: &str) -> Value {
        json!({ "id": id, "expression": { "node": "PARAMETER", "reference": parameter(entity) } })
    }

    fn lognormal(entity: &str, mean: f64) -> Value {
        json!({ "reference": parameter(entity), "expression": crate::fault_tree::tests::value("PROBABILITY", json!({
            "family": "TRUNCATED",
            "law": { "family": "LOGNORMAL", "mean": mean, "errorFactor": 3.0, "level": 0.95 },
            "lower": null,
            "upper": 1.0
        })) })
    }

    #[test]
    fn point_inputs_reproduce_the_exact_families_in_every_trial() {
        let result = sampling(Vec::new(), json!([]), json!({}));
        for (family_id, value) in families_by_enumeration([X, Y, Z]) {
            for trial in values(&result, &family_id) {
                near(trial, value);
            }
        }
    }

    #[test]
    fn a_shared_parameter_correlates_its_events() {
        let m = 0.006;
        let sigma = 3.0_f64.ln() / 1.644_853_626_951_472_2;
        let shared = sampling(vec![uses("X", "pump"), uses("Z", "pump")], json!([lognormal("pump", m)]), json!({}));
        let apart = sampling(
            vec![uses("X", "pump-a"), uses("Z", "pump-b")],
            json!([lognormal("pump-a", m), lognormal("pump-b", m)]),
            json!({}),
        );
        let product = |result: &Value| -> f64 {
            let terms: Vec<f64> = values(result, "RELEASE").iter().map(|value| (value / 2.0 - Y) / (1.0 - Y)).collect();
            mean(&terms) / (m * m)
        };
        let shared_ratio = product(&shared);
        let apart_ratio = product(&apart);
        assert!((shared_ratio / (sigma * sigma).exp() - 1.0).abs() < 0.04, "shared ratio {shared_ratio} expected {}", (sigma * sigma).exp());
        assert!((apart_ratio - 1.0).abs() < 0.04, "apart ratio {apart_ratio}");
        let again = sampling(vec![uses("X", "pump"), uses("Z", "pump")], json!([lognormal("pump", m)]), json!({}));
        assert_eq!(values(&shared, "RELEASE"), values(&again, "RELEASE"));
    }

    #[test]
    fn a_sampled_initiator_and_a_mission_model_set_each_trial() {
        let mission = json!({ "id": "Z", "expression": { "node": "MODEL", "model": {
            "form": "MISSION",
            "rate": crate::fault_tree::tests::value("PER_HOUR", json!({ "family": "POINT", "value": 0.002 })),
            "missionTime": crate::fault_tree::tests::value("HOURS", json!({ "family": "POINT", "value": 100.0 }))
        } } });
        let initiator = json!({ "expression": crate::fault_tree::tests::per_year(1.5) });
        let result = sampling_from(vec![mission], json!([]), json!({}), Some(initiator));
        let z = -(-0.2_f64).exp_m1();
        for (family_id, value) in families_by_enumeration([X, Y, z]) {
            for trial in values(&result, &family_id) {
                assert!((trial - value * 0.75).abs() <= 1e-14 * value, "{family_id}: {trial} against {}", value * 0.75);
            }
        }
    }

    #[test]
    fn the_tree_frequency_is_sampled_with_its_own_annualization() {
        let initiator = json!({
            "expression": crate::fault_tree::tests::value("PER_HOUR", json!({ "family": "UNIFORM", "lower": 1.0e-4, "upper": 3.0e-4 })),
            "annualization": { "basis": "CRITICAL_YEAR", "hoursPerYear": 7000.0 }
        });
        let sampled = sampling_from(Vec::new(), json!([]), json!({}), Some(initiator.clone()));
        let mut point_request = request(json!({}), false);
        point_request.model_snapshots[2]["initiatingEventFrequency"] = initiator;
        let point = execute(&point_request).unwrap();
        assert!((point["frequencySemantics"]["annualizedInitiatingEventFrequency"]["value"].as_f64().unwrap() - 1.4).abs() < 1e-12);
        for (family_id, value) in families_by_enumeration([X, Y, Z]) {
            let per_frequency = value / 2.0;
            let trials = values(&sampled, &family_id);
            for trial in &trials {
                let frequency = trial / per_frequency;
                assert!((0.7 - 1e-12..=2.1 + 1e-12).contains(&frequency), "{family_id}: {frequency}");
            }
            assert!((mean(&trials) / per_frequency - 1.4).abs() < 1e-3, "{family_id}");
        }
    }

    #[test]
    fn common_cause_terms_join_groups_and_scale_with_the_group_total() {
        let result = execute(&request(json!({ "importance": { "groups": [{ "key": "CCF-G", "ccfGroups": ["G"] }] } }), true)).unwrap();
        let variables = result["importance"]["variables"].as_array().unwrap();
        let terms: Vec<&Value> = variables.iter().filter(|variable| variable["ccfGroupId"] == "G").collect();
        assert_eq!(terms.len(), 3);
        let total: f64 = terms.iter().map(|term| term["probability"].as_f64().unwrap()).sum();
        near(total, 0.15 * 0.9 * 2.0 + 0.15 * 0.1);
        assert!(change(family(&result["importance"]["families"], "RELEASE"), "groups", "key", "CCF-G").is_some());
        let plain = execute(&request(json!({}), true)).unwrap();
        let point = execute(&request(json!({ "sampling": { "trials": 3, "seed": 1, "method": "MONTE_CARLO" } }), true)).unwrap();
        let release: f64 = plain["sequences"].as_array().unwrap().iter().filter(|sequence| sequence["sequenceId"] == "FF").map(|sequence| sequence["annualFrequency"].as_f64().unwrap()).sum();
        for trial in values(&point, "RELEASE") {
            near(trial, release);
        }
    }

    #[test]
    fn refuses_invalid_measure_requests() {
        let bad = [
            json!({ "sampling": { "trials": 0, "seed": 1, "method": "MONTE_CARLO" } }),
            json!({ "sampling": { "trials": 5, "seed": 1, "method": "MONTE_CARLO", "keys": [] } }),
            json!({ "sampling": { "trials": 5, "seed": 1, "method": "MONTE_CARLO", "initiator": crate::fault_tree::tests::point(0.5) } }),
            json!({ "importance": { "groups": [{ "key": "A", "events": ["X"] }, { "key": "A", "events": ["Z"] }] } }),
            json!({ "importance": { "groups": [{ "key": "A" }] } }),
            json!({ "importance": {}, "cutSets": { "basis": "FREQUENCY", "cutOffs": [0.1], "quantifier": "MCUB", "keep": 1 } }),
        ];
        for extra in bad {
            assert!(execute(&request(extra.clone(), false)).is_err(), "{extra}");
        }
    }

    #[test]
    fn overrides_set_event_and_common_cause_probabilities() {
        let result = execute(&request(json!({ "overrides": { "events": [{ "id": "X", "probability": 1.0 }] } }), false)).unwrap();
        for (family_id, value) in families_by_enumeration([1.0, Y, Z]) {
            let total: f64 = result["sequences"].as_array().unwrap().iter()
                .filter(|sequence| match family_id.as_str() { "OK" => sequence["sequenceId"] == "SS", "RELEASE" => sequence["sequenceId"] == "FF", _ => sequence["sequenceId"] == "SF" || sequence["sequenceId"] == "FS" })
                .map(|sequence| sequence["annualFrequency"].as_f64().unwrap())
                .sum();
            near(total, value);
        }
        let failed = execute(&request(json!({ "overrides": { "ccfGroups": [{ "id": "G", "probability": 1.0 }] }, "importance": {} }), true)).unwrap();
        for variable in failed["importance"]["variables"].as_array().unwrap() {
            if variable["ccfGroupId"] == "G" {
                assert_eq!(variable["probability"].as_f64().unwrap(), 1.0);
            }
        }
        let release: f64 = failed["sequences"].as_array().unwrap().iter().filter(|sequence| sequence["sequenceId"] == "FF").map(|sequence| sequence["annualFrequency"].as_f64().unwrap()).sum();
        near(release, 2.0);
        assert!(execute(&request(json!({ "overrides": { "events": [{ "id": "X", "probability": 1.5 }] } }), false)).is_err());
        assert!(execute(&request(json!({ "overrides": { "ccfGroups": [{ "id": "NONE", "probability": 1.0 }] } }), true)).is_err());
    }
}
