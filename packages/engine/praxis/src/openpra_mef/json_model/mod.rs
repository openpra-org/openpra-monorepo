pub mod data_analysis;
pub mod event_sequence_analysis;
pub mod event_sequence_quantification;
pub mod initiating_event_analysis;
pub mod risk_integration;
pub mod systems_analysis;

use data_analysis::DataAnalysisJsonModel;
use event_sequence_analysis::EventSequenceAnalysisJsonModel;
use event_sequence_quantification::EventSequenceQuantificationJsonModel;
use initiating_event_analysis::InitiatingEventAnalysisJsonModel;
use risk_integration::RiskIntegrationJsonModel;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use systems_analysis::SystemsAnalysisJsonModel;

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct OpenPraJsonModel {
	pub id: Option<String>,
	pub technical_elements: TechnicalElements,
	pub metadata: Option<Value>,
	pub additional_fields: HashMap<String, Value>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct TechnicalElements {
	pub data_analysis: Option<DataAnalysisJsonModel>,
	pub systems_analysis: Option<SystemsAnalysisJsonModel>,
	pub initiating_event_analysis: Option<InitiatingEventAnalysisJsonModel>,
	pub event_sequence_analysis: Option<EventSequenceAnalysisJsonModel>,
	pub event_sequence_quantification: Option<EventSequenceQuantificationJsonModel>,
	pub risk_integration: Option<RiskIntegrationJsonModel>,
	pub additional_elements: HashMap<String, Value>,
}
