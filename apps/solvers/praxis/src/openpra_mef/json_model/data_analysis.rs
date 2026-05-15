use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct DataAnalysisJsonModel {
    pub id: Option<String>,
    pub data_parameters: Vec<DataParameter>,
    pub component_groupings: Vec<IdGroup>,
    pub outlier_components: Vec<IdRef>,
    pub external_data_sources: Vec<ExternalDataSource>,
    pub data_consistency_checks: Vec<ConsistencyCheck>,
    pub documentation: Option<Value>,
    pub sensitivity_studies: Vec<Value>,
    pub additional_fields: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct DataParameter {
    pub id: String,
    pub probability: Option<f64>,
    pub frequency: Option<f64>,
    pub distribution: Option<Value>,
    pub system_ref: Option<String>,
    pub component_ref: Option<String>,
    pub metadata_refs: Vec<IdRef>,
    pub additional_fields: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct IdRef {
    pub id: String,
    pub ref_type: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct IdGroup {
    pub id: String,
    pub members: Vec<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct ExternalDataSource {
    pub id: String,
    pub source_type: Option<String>,
    pub uri: Option<String>,
    pub additional_fields: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct ConsistencyCheck {
    pub id: String,
    pub check_type: Option<String>,
    pub status: Option<String>,
    pub details: Option<String>,
    pub additional_fields: HashMap<String, Value>,
}
