use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct InitiatingEventAnalysisJsonModel {
    pub id: Option<String>,
    pub initiators: Vec<Initiator>,
    pub initiating_event_groups: Vec<InitiatorGroup>,
    pub quantification: Option<Value>,
    pub screening_criteria: Option<Value>,
    pub insights: Option<Value>,
    pub documentation: Option<Value>,
    pub additional_fields: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Initiator {
    pub id: String,
    pub name: Option<String>,
    pub frequency: Option<f64>,
    pub probability: Option<f64>,
    pub system_refs: Vec<String>,
    pub data_parameter_refs: Vec<String>,
    pub additional_fields: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct InitiatorGroup {
    pub id: String,
    pub members: Vec<String>,
    pub additional_fields: HashMap<String, Value>,
}
