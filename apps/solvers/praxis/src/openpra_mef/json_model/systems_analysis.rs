use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct SystemsAnalysisJsonModel {
    pub id: Option<String>,
    pub system_definitions: Vec<SystemDefinition>,
    pub system_logic_models: Vec<SystemLogicModel>,
    pub common_cause_failure_groups: Vec<CcfGroup>,
    pub system_dependencies: Vec<SystemDependency>,
    pub documentation: Option<Value>,
    pub additional_fields: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct SystemDefinition {
    pub id: String,
    pub name: Option<String>,
    pub fault_tree_id: Option<String>,
    pub component_refs: Vec<String>,
    pub additional_fields: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct SystemLogicModel {
    pub id: String,
    pub name: Option<String>,
    pub model_type: Option<String>,
    pub root_ref: Option<String>,
    pub basic_event_refs: Vec<String>,
    pub gate_refs: Vec<String>,
    pub additional_fields: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct CcfGroup {
    pub id: String,
    pub members: Vec<String>,
    pub model: Option<String>,
    pub additional_fields: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct SystemDependency {
    pub id: String,
    pub source_ref: Option<String>,
    pub target_ref: Option<String>,
    pub dependency_type: Option<String>,
    pub additional_fields: HashMap<String, Value>,
}
