use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct EventSequenceAnalysisJsonModel {
    pub id: Option<String>,
    pub event_sequences: Vec<EventSequence>,
    pub scope_definition: Option<ScopeDefinition>,
    pub event_sequence_families: Vec<EventSequenceFamily>,
    pub release_category_mappings: Vec<ReleaseCategoryMapping>,
    pub dependencies: Option<Value>,
    pub uncertainty: Option<Value>,
    pub documentation: Option<Value>,
    pub additional_fields: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct EventSequence {
    pub id: String,
    pub name: Option<String>,
    pub initiating_event_id: Option<String>,
    pub functional_event_bindings: Vec<FunctionalEventBinding>,
    pub family_ids: Vec<String>,
    pub linked_sequence_ids: Vec<String>,
    pub additional_fields: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct FunctionalEventBinding {
    pub id: String,
    pub functional_event_id: Option<String>,
    pub fault_tree_id: Option<String>,
    pub data_parameter_id: Option<String>,
    pub success_probability: Option<f64>,
    pub additional_fields: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct ScopeDefinition {
    pub initiating_event_ids: Vec<String>,
    pub event_sequence_ids: Vec<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct EventSequenceFamily {
    pub id: String,
    pub sequence_ids: Vec<String>,
    pub representative_initiating_event_id: Option<String>,
    pub additional_fields: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct ReleaseCategoryMapping {
    pub id: String,
    pub sequence_id: Option<String>,
    pub release_category_id: Option<String>,
    pub additional_fields: HashMap<String, Value>,
}
