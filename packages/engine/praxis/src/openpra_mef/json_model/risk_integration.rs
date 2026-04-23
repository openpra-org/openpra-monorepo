use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct RiskIntegrationJsonModel {
    pub id: Option<String>,
    pub risk_significance_criteria: Vec<NamedValue>,
    pub event_sequence_to_release_category_mappings: Vec<RiskMapping>,
    pub integrated_risk_results: Vec<NamedValue>,
    pub significant_contributors: Vec<NamedValue>,
    pub integration_methods: Vec<NamedValue>,
    pub placeholder_used: bool,
    pub placeholder_reason: Option<String>,
    pub additional_fields: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct NamedValue {
    pub id: String,
    pub payload: Value,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct RiskMapping {
    pub id: String,
    pub sequence_id: Option<String>,
    pub release_category_id: Option<String>,
    pub payload: Option<Value>,
}
