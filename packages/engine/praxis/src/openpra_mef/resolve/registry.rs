use crate::openpra_mef::json_model::OpenPraJsonModel;
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum EntityType {
    DataAnalysis,
    SystemsAnalysis,
    InitiatingEventAnalysis,
    EventSequenceAnalysis,
    EventSequenceQuantification,
    RiskIntegration,
    DataParameter,
    SystemDefinition,
    SystemLogicModel,
    CcfGroup,
    Initiator,
    InitiatorGroup,
    EventSequence,
    EventSequenceFamily,
    QuantificationResult,
    QuantificationFamily,
}

impl EntityType {
    pub fn as_str(&self) -> &'static str {
        match self {
            EntityType::DataAnalysis => "data-analysis",
            EntityType::SystemsAnalysis => "systems-analysis",
            EntityType::InitiatingEventAnalysis => "initiating-event-analysis",
            EntityType::EventSequenceAnalysis => "event-sequence-analysis",
            EntityType::EventSequenceQuantification => "event-sequence-quantification",
            EntityType::RiskIntegration => "risk-integration",
            EntityType::DataParameter => "data-parameter",
            EntityType::SystemDefinition => "system-definition",
            EntityType::SystemLogicModel => "system-logic-model",
            EntityType::CcfGroup => "ccf-group",
            EntityType::Initiator => "initiator",
            EntityType::InitiatorGroup => "initiator-group",
            EntityType::EventSequence => "event-sequence",
            EntityType::EventSequenceFamily => "event-sequence-family",
            EntityType::QuantificationResult => "quantification-result",
            EntityType::QuantificationFamily => "quantification-family",
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct ReferenceRegistry {
    pub total_nodes: usize,
    pub ids_by_type: HashMap<EntityType, HashSet<String>>,
}

impl ReferenceRegistry {
    pub fn register(&mut self, entity_type: EntityType, id: &str) {
        self.ids_by_type
            .entry(entity_type)
            .or_default()
            .insert(id.to_string());
        self.total_nodes += 1;
    }

    pub fn contains(&self, entity_type: EntityType, id: &str) -> bool {
        self.ids_by_type
            .get(&entity_type)
            .is_some_and(|set| set.contains(id))
    }

    pub fn from_model(model: &OpenPraJsonModel) -> Self {
        let mut registry = Self::default();

        if let Some(da) = &model.technical_elements.data_analysis {
            if let Some(id) = &da.id {
                registry.register(EntityType::DataAnalysis, id);
            }
            for parameter in &da.data_parameters {
                registry.register(EntityType::DataParameter, &parameter.id);
            }
        }

        if let Some(sa) = &model.technical_elements.systems_analysis {
            if let Some(id) = &sa.id {
                registry.register(EntityType::SystemsAnalysis, id);
            }
            for definition in &sa.system_definitions {
                registry.register(EntityType::SystemDefinition, &definition.id);
            }
            for logic in &sa.system_logic_models {
                registry.register(EntityType::SystemLogicModel, &logic.id);
            }
            for ccf in &sa.common_cause_failure_groups {
                registry.register(EntityType::CcfGroup, &ccf.id);
            }
        }

        if let Some(iea) = &model.technical_elements.initiating_event_analysis {
            if let Some(id) = &iea.id {
                registry.register(EntityType::InitiatingEventAnalysis, id);
            }
            for initiator in &iea.initiators {
                registry.register(EntityType::Initiator, &initiator.id);
            }
            for group in &iea.initiating_event_groups {
                registry.register(EntityType::InitiatorGroup, &group.id);
            }
        }

        if let Some(esa) = &model.technical_elements.event_sequence_analysis {
            if let Some(id) = &esa.id {
                registry.register(EntityType::EventSequenceAnalysis, id);
            }
            for sequence in &esa.event_sequences {
                registry.register(EntityType::EventSequence, &sequence.id);
            }
            for family in &esa.event_sequence_families {
                registry.register(EntityType::EventSequenceFamily, &family.id);
            }
        }

        if let Some(esq) = &model.technical_elements.event_sequence_quantification {
            if let Some(id) = &esq.id {
                registry.register(EntityType::EventSequenceQuantification, id);
            }
            for result in &esq.quantification_results {
                registry.register(EntityType::QuantificationResult, &result.id);
            }
            for family in &esq.event_sequence_families {
                registry.register(EntityType::QuantificationFamily, &family.id);
            }
        }

        if let Some(ri) = &model.technical_elements.risk_integration {
            if let Some(id) = &ri.id {
                registry.register(EntityType::RiskIntegration, id);
            }
        }

        registry
    }
}
