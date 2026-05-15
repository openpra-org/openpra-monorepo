use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct EventSequenceQuantificationJsonModel {
    pub id: Option<String>,
    pub quantification_results: Vec<QuantificationResult>,
    pub event_sequence_families: Vec<QuantificationFamily>,
    pub quantification_methods: Vec<QuantificationMethod>,
    pub uncertainty_treatment: Option<Value>,
    pub dependency_treatment: Option<Value>,
    pub additional_fields: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct QuantificationResult {
    pub id: String,
    pub event_sequence_id: Option<String>,
    pub family_id: Option<String>,
    pub initiating_event_id: Option<String>,
    pub frequency: Option<f64>,
    pub probability: Option<f64>,
    pub additional_fields: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct QuantificationFamily {
    pub id: String,
    pub sequence_ids: Vec<String>,
    pub representative_initiating_event_id: Option<String>,
    pub additional_fields: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct QuantificationMethod {
    pub id: String,
    pub method_type: Option<String>,
    pub backend: Option<String>,
    pub parameters: Option<Value>,
}
