use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};

use praxis::analysis::event_tree_quantification::{
    EventTreeBddDiagnostics, EventTreeSequenceDiagnostics, EventTreeSequenceProbability,
};
use praxis::analysis::sequence_measures::{
    compile_sequence_diagrams, draw_key, importance_by_family, sample_families, ImportanceGroup,
    KeyDistribution, SampleForm, SampledFrequency, SampledVariable, SamplingMethod,
    SequenceDiagram,
};
use praxis::core::model::Model;
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

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub(super) enum SamplingMethodInput {
    MonteCarlo,
    LatinHypercube,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "type", rename_all = "SCREAMING_SNAKE_CASE", rename_all_fields = "camelCase")]
pub(super) enum DistributionInput {
    Point { value: f64 },
    Lognormal { median: f64, error_factor: f64 },
    Normal { mean: f64, standard_deviation: f64 },
    Gamma { shape: f64, rate: f64 },
    Beta { alpha: f64, beta: f64 },
    Uniform { lower: f64, upper: f64 },
    Exponential { rate: f64 },
}

impl DistributionInput {
    fn law(self) -> KeyDistribution {
        match self {
            DistributionInput::Point { value } => KeyDistribution::Point { value },
            DistributionInput::Lognormal { median, error_factor } => KeyDistribution::LogNormal { median, error_factor },
            DistributionInput::Normal { mean, standard_deviation } => KeyDistribution::Normal { mean, standard_deviation },
            DistributionInput::Gamma { shape, rate } => KeyDistribution::Gamma { shape, rate },
            DistributionInput::Beta { alpha, beta } => KeyDistribution::Beta { alpha, beta },
            DistributionInput::Uniform { lower, upper } => KeyDistribution::Uniform { lower, upper },
            DistributionInput::Exponential { rate } => KeyDistribution::Exponential { rate },
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct SamplingKeyInput {
    key: String,
    distribution: DistributionInput,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub(super) enum SampleFormInput {
    Probability,
    Rate,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct SampledEventInput {
    id: String,
    key: String,
    form: SampleFormInput,
    scale: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct SampledCcfGroupInput {
    id: String,
    key: String,
    scale: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct SampledInitiatorInput {
    key: String,
    scale: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct SamplingInput {
    trials: usize,
    seed: u64,
    method: SamplingMethodInput,
    keys: Vec<SamplingKeyInput>,
    #[serde(default)]
    events: Vec<SampledEventInput>,
    #[serde(default)]
    ccf_groups: Vec<SampledCcfGroupInput>,
    #[serde(default)]
    initiator: Option<SampledInitiatorInput>,
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
                    let expanded: Vec<String> = group.expand(1.0)?.into_iter().map(|event| event.id).collect();
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
        let mut keys = HashSet::new();
        for entry in &self.keys {
            if entry.key.trim().is_empty() || !keys.insert(entry.key.as_str()) {
                return Err(PraxisError::Settings(format!(
                    "sampling key '{}' must be present and unique",
                    entry.key
                )));
            }
            entry.distribution.law().validate(&entry.key)?;
        }
        let known = |key: &str| keys.contains(key);
        let positive = |value: f64| value.is_finite() && value > 0.0;
        let mut events = HashSet::new();
        for event in &self.events {
            if !known(&event.key) || !positive(event.scale) || !events.insert(event.id.as_str()) {
                return Err(PraxisError::Settings(format!(
                    "sampled event '{}' needs a known key, a positive scale and one entry",
                    event.id
                )));
            }
        }
        let mut groups = HashSet::new();
        for group in &self.ccf_groups {
            if !known(&group.key) || !positive(group.scale) || !groups.insert(group.id.as_str()) {
                return Err(PraxisError::Settings(format!(
                    "sampled common cause group '{}' needs a known key, a positive scale and one entry",
                    group.id
                )));
            }
        }
        if let Some(initiator) = &self.initiator {
            if !known(&initiator.key) || !positive(initiator.scale) {
                return Err(PraxisError::Settings("the sampled initiator needs a known key and a positive scale".to_string()));
            }
        }
        Ok(())
    }
}

struct CcfTerm {
    group_id: String,
    members: Vec<String>,
    unit: f64,
}

fn ccf_terms(adapter: &EventTreeAdapter) -> Result<HashMap<String, CcfTerm>> {
    let mut terms = HashMap::new();
    if !adapter.expand_ccf {
        return Ok(terms);
    }
    for fault_tree in adapter.model.fault_trees().values() {
        for (group_id, group) in fault_tree.ccf_groups() {
            for event in group.expand(1.0)? {
                terms.insert(
                    event.id,
                    CcfTerm {
                        group_id: group_id.clone(),
                        members: event.failed_members,
                        unit: event.probability,
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
    terms: &HashMap<String, CcfTerm>,
    input: &SamplingInput,
) -> Result<Value> {
    let method = match input.method {
        SamplingMethodInput::MonteCarlo => SamplingMethod::MonteCarlo,
        SamplingMethodInput::LatinHypercube => SamplingMethod::LatinHypercube,
    };
    let index_of: HashMap<&str, usize> = input
        .keys
        .iter()
        .enumerate()
        .map(|(index, entry)| (entry.key.as_str(), index))
        .collect();
    let draws = input
        .keys
        .iter()
        .map(|entry| draw_key(&entry.key, &entry.distribution.law(), input.seed, input.trials, method))
        .collect::<Result<Vec<_>>>()?;
    let mut variables: HashMap<String, SampledVariable> = HashMap::new();
    for event in &input.events {
        let form = match event.form {
            SampleFormInput::Probability => SampleForm::Probability,
            SampleFormInput::Rate => SampleForm::Rate,
        };
        variables.insert(
            event.id.clone(),
            SampledVariable { key: index_of[event.key.as_str()], form, scale: event.scale },
        );
    }
    let groups: HashMap<&str, &SampledCcfGroupInput> = input
        .ccf_groups
        .iter()
        .map(|group| (group.id.as_str(), group))
        .collect();
    for (id, term) in terms {
        if let Some(group) = groups.get(term.group_id.as_str()) {
            variables.insert(
                id.clone(),
                SampledVariable {
                    key: index_of[group.key.as_str()],
                    form: SampleForm::Probability,
                    scale: term.unit * group.scale,
                },
            );
        }
    }
    let initiator = input
        .initiator
        .as_ref()
        .map(|source| SampledFrequency { key: index_of[source.key.as_str()], scale: source.scale });
    let families = sample_families(
        diagrams,
        family_of,
        adapter.initiating_event_frequency,
        initiator.as_ref(),
        &variables,
        &draws,
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
        value["sampling"] = sampling_json(adapter, &diagrams, &family_of, &terms, input)?;
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
        let mut request = json!({
            "schemaVersion": "1.0.0", "methodType": "EVENT_TREE", "modelId": "ET", "revision": 1,
            "mode": "INDEPENDENT", "requestedBy": "analyst",
            "sequenceFamilies": { "SS": "OK", "SF": "DAMAGE", "FS": "DAMAGE", "FF": "RELEASE" }
        });
        for (key, value) in extra.as_object().unwrap() {
            request[key] = value.clone();
        }
        let events: Vec<Value> = [("X", X), ("Y", Y), ("Z", Z)].iter().map(|(id, value)| json!({ "id": id, "probability": { "value": value } })).collect();
        let mut catalogue = json!({ "projectId": "P", "basicEvents": events });
        if ccf {
            request["expandCcf"] = json!(true);
            catalogue["commonCauseFailureGroups"] = json!([{
                "id": "G", "members": ["X", "Z"], "model": { "kind": "BETA_FACTOR", "beta": 0.1 }, "totalFailureProbability": 0.15
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
            "initiatingEventFrequency": { "value": 2.0 },
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

    fn sampling(keys: Value, events: Value, extra: Value) -> Value {
        let mut input = json!({ "trials": 20000, "seed": 5, "method": "LATIN_HYPERCUBE", "keys": keys, "events": events });
        for (key, value) in extra.as_object().unwrap() {
            input[key] = value.clone();
        }
        execute(&request(json!({ "sampling": input }), false)).unwrap()
    }

    fn values(result: &Value, id: &str) -> Vec<f64> {
        family(&result["sampling"]["families"], id)["values"].as_array().unwrap().iter().map(|value| value.as_f64().unwrap()).collect()
    }

    fn mean(values: &[f64]) -> f64 {
        values.iter().sum::<f64>() / values.len() as f64
    }

    #[test]
    fn point_draws_reproduce_the_exact_families_in_every_trial() {
        let result = sampling(json!([{ "key": "K", "distribution": { "type": "POINT", "value": X } }]), json!([{ "id": "X", "key": "K", "form": "PROBABILITY", "scale": 1.0 }]), json!({}));
        for (family_id, value) in families_by_enumeration([X, Y, Z]) {
            for trial in values(&result, &family_id) {
                near(trial, value);
            }
        }
    }

    #[test]
    fn a_shared_key_correlates_its_events() {
        let law = json!({ "type": "LOGNORMAL", "median": 0.005, "errorFactor": 3.0 });
        let both = json!([{ "id": "X", "key": "K", "form": "PROBABILITY", "scale": 1.0 }, { "id": "Z", "key": "K", "form": "PROBABILITY", "scale": 1.0 }]);
        let shared = sampling(json!([{ "key": "K", "distribution": law }]), both.clone(), json!({}));
        let apart = sampling(json!([{ "key": "K1", "distribution": law }, { "key": "K2", "distribution": law }]), json!([{ "id": "X", "key": "K1", "form": "PROBABILITY", "scale": 1.0 }, { "id": "Z", "key": "K2", "form": "PROBABILITY", "scale": 1.0 }]), json!({}));
        let sigma = 3.0_f64.ln() / 1.644_853_626_951_472_2;
        let m = 0.005 * (0.5 * sigma * sigma).exp();
        let product = |result: &Value| -> f64 {
            let terms: Vec<f64> = values(result, "RELEASE").iter().map(|value| (value / 2.0 - Y) / (1.0 - Y)).collect();
            mean(&terms) / (m * m)
        };
        let shared_ratio = product(&shared);
        let apart_ratio = product(&apart);
        assert!((shared_ratio / (sigma * sigma).exp() - 1.0).abs() < 0.04, "shared ratio {shared_ratio} expected {}", (sigma * sigma).exp());
        assert!((apart_ratio - 1.0).abs() < 0.04, "apart ratio {apart_ratio}");
        let again = sampling(json!([{ "key": "K", "distribution": law }]), both, json!({}));
        assert_eq!(values(&shared, "RELEASE"), values(&again, "RELEASE"));
    }

    #[test]
    fn a_sampled_initiator_and_a_rate_scale_each_trial() {
        let result = sampling(
            json!([{ "key": "IE", "distribution": { "type": "POINT", "value": 3.0 } }, { "key": "L", "distribution": { "type": "POINT", "value": 0.002 } }]),
            json!([{ "id": "Z", "key": "L", "form": "RATE", "scale": 100.0 }]),
            json!({ "initiator": { "key": "IE", "scale": 0.5 } }),
        );
        let z = 1.0 - (-0.2_f64).exp();
        for (family_id, value) in families_by_enumeration([X, Y, z]) {
            for trial in values(&result, &family_id) {
                near(trial, value * 0.75);
            }
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
        let point = execute(&request(json!({ "sampling": {
            "trials": 3, "seed": 1, "method": "MONTE_CARLO",
            "keys": [{ "key": "Q", "distribution": { "type": "POINT", "value": 0.15 } }],
            "ccfGroups": [{ "id": "G", "key": "Q", "scale": 1.0 }]
        } }), true)).unwrap();
        let release: f64 = plain["sequences"].as_array().unwrap().iter().filter(|sequence| sequence["sequenceId"] == "FF").map(|sequence| sequence["annualFrequency"].as_f64().unwrap()).sum();
        for trial in values(&point, "RELEASE") {
            near(trial, release);
        }
    }

    #[test]
    fn refuses_invalid_measure_requests() {
        let bad = [
            json!({ "sampling": { "trials": 0, "seed": 1, "method": "MONTE_CARLO", "keys": [] } }),
            json!({ "sampling": { "trials": 5, "seed": 1, "method": "MONTE_CARLO", "keys": [], "events": [{ "id": "X", "key": "K", "form": "PROBABILITY", "scale": 1.0 }] } }),
            json!({ "sampling": { "trials": 5, "seed": 1, "method": "MONTE_CARLO", "keys": [{ "key": "K", "distribution": { "type": "LOGNORMAL", "median": 0.01, "errorFactor": 0.5 } }] } }),
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
