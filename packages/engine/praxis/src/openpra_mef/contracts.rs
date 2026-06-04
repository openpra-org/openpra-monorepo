use crate::openpra_mef::json_model::OpenPraJsonModel;
use crate::openpra_mef::resolve::placeholders::PlaceholderRecord;
use crate::{core::event_tree::EventTree, core::event_tree::InitiatingEvent, core::model::Model};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResolveMode {
    Strict,
    Compatible,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Severity {
    Error,
    Warning,
    Info,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Diagnostic {
    pub code: String,
    pub severity: Severity,
    pub message: String,
    pub json_path: String,
    pub source_element: Option<String>,
    pub source_id: Option<String>,
    pub target_type: Option<String>,
    pub target_id: Option<String>,
    pub hint: Option<String>,
}

impl Diagnostic {
    pub fn new(
        code: impl Into<String>,
        severity: Severity,
        message: impl Into<String>,
        json_path: impl Into<String>,
    ) -> Self {
        Self {
            code: code.into(),
            severity,
            message: message.into(),
            json_path: json_path.into(),
            source_element: None,
            source_id: None,
            target_type: None,
            target_id: None,
            hint: None,
        }
    }

    pub fn with_ref_context(
        mut self,
        source_element: impl Into<String>,
        source_id: impl Into<String>,
        target_type: impl Into<String>,
        target_id: impl Into<String>,
    ) -> Self {
        self.source_element = Some(source_element.into());
        self.source_id = Some(source_id.into());
        self.target_type = Some(target_type.into());
        self.target_id = Some(target_id.into());
        self
    }

    pub fn with_hint(mut self, hint: impl Into<String>) -> Self {
        self.hint = Some(hint.into());
        self
    }
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct OpenPraJsonBundle {
    pub model_id: Option<String>,
    pub model: Option<OpenPraJsonModel>,
    pub raw_json: Option<Value>,
    pub placeholders: Vec<PlaceholderRecord>,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, Default)]
pub struct EngineInputs {
    pub model_id: Option<String>,
    pub model: Option<OpenPraJsonModel>,
    pub placeholders: Vec<PlaceholderRecord>,
    pub praxis_model: Option<Model>,
    pub praxis_initiating_events: Vec<InitiatingEvent>,
    pub praxis_event_trees: Vec<EventTree>,
    pub praxis_event_tree_library: HashMap<String, EventTree>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct EngineOutputs {
    pub model_id: Option<String>,
    pub result_payload: Option<Value>,
    pub schema_version: Option<String>,
    pub engine_version: Option<String>,
    pub run_metadata: Option<Value>,
    pub placeholders: Vec<PlaceholderRecord>,
    pub diagnostics: Vec<Diagnostic>,
}
