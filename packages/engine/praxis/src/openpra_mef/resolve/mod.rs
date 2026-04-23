pub mod placeholders;
pub mod registry;
pub mod rules;

use crate::openpra_mef::contracts::{Diagnostic, ResolveMode, Severity};
use crate::openpra_mef::json_model::OpenPraJsonModel;
use placeholders::PlaceholderRecord;
use registry::{EntityType, ReferenceRegistry};
use rules::{classify_unresolved, ResolutionOutcome};

pub fn resolve_model_refs(
	model: &OpenPraJsonModel,
	mode: ResolveMode,
) -> (ReferenceRegistry, Vec<PlaceholderRecord>, Vec<Diagnostic>) {
	let registry = ReferenceRegistry::from_model(model);
	let strict_mode = mode == ResolveMode::Strict;

	let mut placeholders = Vec::new();
	let mut diagnostics = Vec::new();

	if let Some(ri) = &model.technical_elements.risk_integration {
		let source_id = ri.id.as_deref().unwrap_or("risk-integration");
		placeholders.push(PlaceholderRecord {
			source_element: "risk-integration".to_string(),
			source_id: source_id.to_string(),
			target_type: "ri-solver".to_string(),
			target_id: "praxis-ri-engine".to_string(),
			reason:
				"Risk Integration computation remains placeholder until Praxis RI solver support is implemented"
					.to_string(),
		});
		diagnostics.push(
			Diagnostic::new(
				"REF_OUT_OF_SCOPE_PLACEHOLDER_USED",
				Severity::Warning,
				"Risk Integration preserved with placeholder computation policy",
				"$.technicalElements.risk-integration",
			)
			.with_ref_context(
				"risk-integration",
				source_id,
				"ri-solver",
				"praxis-ri-engine",
			)
			.with_hint("RI fields are preserved; enable RI solver support to eliminate placeholder path"),
		);
	}

	for additional_element_name in model.technical_elements.additional_elements.keys() {
		placeholders.push(PlaceholderRecord {
			source_element: additional_element_name.clone(),
			source_id: additional_element_name.clone(),
			target_type: "out-of-scope-technical-element".to_string(),
			target_id: additional_element_name.clone(),
			reason: "Out-of-scope technical element preserved as v1 placeholder".to_string(),
		});
		diagnostics.push(
			Diagnostic::new(
				"REF_OUT_OF_SCOPE_PLACEHOLDER_USED",
				Severity::Warning,
				format!(
					"Out-of-scope technical element '{}' preserved with placeholder policy",
					additional_element_name
				),
				format!("$.technicalElements.{}", additional_element_name),
			)
			.with_ref_context(
				additional_element_name,
				additional_element_name,
				"out-of-scope-technical-element",
				additional_element_name,
			)
			.with_hint("Element is retained in additionalElements for forward compatibility"),
		);
	}

	let mut resolve_ref = |source_element: &str,
						   source_id: &str,
						   target_type: EntityType,
						   target_id: &str,
						   json_path: String| {
		if target_id.trim().is_empty() {
			diagnostics.push(
				Diagnostic::new(
					"REF_EMPTY_ID",
					Severity::Error,
					"Empty or blank reference ID",
					json_path,
				)
				.with_ref_context(
					source_element,
					source_id,
					target_type.as_str(),
					target_id,
				)
				.with_hint("Provide a non-empty reference ID"),
			);
			return;
		}

		if registry.contains(target_type, target_id) {
			return;
		}

		match classify_unresolved(source_element, target_type.as_str(), strict_mode) {
			ResolutionOutcome::Resolved => {}
			ResolutionOutcome::Placeholder => {
				placeholders.push(PlaceholderRecord {
					source_element: source_element.to_string(),
					source_id: source_id.to_string(),
					target_type: target_type.as_str().to_string(),
					target_id: target_id.to_string(),
					reason: "Unresolved reference covered by placeholder policy".to_string(),
				});
				diagnostics.push(
					Diagnostic::new(
						"REF_OUT_OF_SCOPE_PLACEHOLDER_USED",
						Severity::Warning,
						"Reference unresolved; using placeholder policy",
						json_path,
					)
					.with_ref_context(
						source_element,
						source_id,
						target_type.as_str(),
						target_id,
					)
					.with_hint("Provide the missing target to eliminate placeholder usage"),
				);
			}
			ResolutionOutcome::Error => {
				diagnostics.push(
					Diagnostic::new(
						"REF_MISSING_REQUIRED",
						Severity::Error,
						"Required reference not found",
						json_path,
					)
					.with_ref_context(
						source_element,
						source_id,
						target_type.as_str(),
						target_id,
					)
					.with_hint("Add target entity or remove stale reference"),
				);
			}
		}
	};

	if let Some(iea) = &model.technical_elements.initiating_event_analysis {
		for (idx, group) in iea.initiating_event_groups.iter().enumerate() {
			for (member_idx, member) in group.members.iter().enumerate() {
				resolve_ref(
					"initiating-event-analysis",
					&group.id,
					EntityType::Initiator,
					member,
					format!(
						"$.technicalElements.initiating-event-analysis.initiatingEventGroups[{idx}].members[{member_idx}]"
					),
				);
			}
		}

		for initiator in &iea.initiators {
			for (idx, data_ref) in initiator.data_parameter_refs.iter().enumerate() {
				resolve_ref(
					"initiating-event-analysis",
					&initiator.id,
					EntityType::DataParameter,
					data_ref,
					format!(
						"$.technicalElements.initiating-event-analysis.initiators[{idx}].dataParameterRefs"
					),
				);
			}

			for (idx, system_ref) in initiator.system_refs.iter().enumerate() {
				resolve_ref(
					"initiating-event-analysis",
					&initiator.id,
					EntityType::SystemDefinition,
					system_ref,
					format!(
						"$.technicalElements.initiating-event-analysis.initiators[{idx}].systemRefs"
					),
				);
			}
		}
	}

	if let Some(esa) = &model.technical_elements.event_sequence_analysis {
		for (idx, sequence) in esa.event_sequences.iter().enumerate() {
			if let Some(initiator_id) = &sequence.initiating_event_id {
				resolve_ref(
					"event-sequence-analysis",
					&sequence.id,
					EntityType::Initiator,
					initiator_id,
					format!(
						"$.technicalElements.event-sequence-analysis.eventSequences[{idx}].initiatingEventId"
					),
				);
			}

			for (binding_idx, binding) in sequence.functional_event_bindings.iter().enumerate() {
				if let Some(logic_ref) = &binding.fault_tree_id {
					resolve_ref(
						"event-sequence-analysis",
						&sequence.id,
						EntityType::SystemLogicModel,
						logic_ref,
						format!(
							"$.technicalElements.event-sequence-analysis.eventSequences[{idx}].functionalEventBindings[{binding_idx}].faultTreeId"
						),
					);
				}
				if let Some(dp_ref) = &binding.data_parameter_id {
					resolve_ref(
						"event-sequence-analysis",
						&sequence.id,
						EntityType::DataParameter,
						dp_ref,
						format!(
							"$.technicalElements.event-sequence-analysis.eventSequences[{idx}].functionalEventBindings[{binding_idx}].dataParameterId"
						),
					);
				}
			}
		}

		if let Some(scope) = &esa.scope_definition {
			for (idx, initiating_event_id) in scope.initiating_event_ids.iter().enumerate() {
				resolve_ref(
					"event-sequence-analysis",
					"scope-definition",
					EntityType::Initiator,
					initiating_event_id,
					format!(
						"$.technicalElements.event-sequence-analysis.scopeDefinition.initiatingEventIds[{idx}]"
					),
				);
			}

			for (idx, sequence_id) in scope.event_sequence_ids.iter().enumerate() {
				resolve_ref(
					"event-sequence-analysis",
					"scope-definition",
					EntityType::EventSequence,
					sequence_id,
					format!(
						"$.technicalElements.event-sequence-analysis.scopeDefinition.eventSequenceIds[{idx}]"
					),
				);
			}
		}
	}

	if let Some(sa) = &model.technical_elements.systems_analysis {
		for (idx, definition) in sa.system_definitions.iter().enumerate() {
			if let Some(fault_tree_id) = &definition.fault_tree_id {
				resolve_ref(
					"systems-analysis",
					&definition.id,
					EntityType::SystemLogicModel,
					fault_tree_id,
					format!(
						"$.technicalElements.systems-analysis.systemDefinitions[{idx}].faultTreeId"
					),
				);
			}

			for (component_idx, component_ref) in definition.component_refs.iter().enumerate() {
				resolve_ref(
					"systems-analysis",
					&definition.id,
					EntityType::DataParameter,
					component_ref,
					format!(
						"$.technicalElements.systems-analysis.systemDefinitions[{idx}].componentRefs[{component_idx}]"
					),
				);
			}
		}

		for (idx, logic_model) in sa.system_logic_models.iter().enumerate() {
			for (be_idx, basic_event_ref) in logic_model.basic_event_refs.iter().enumerate() {
				resolve_ref(
					"systems-analysis",
					&logic_model.id,
					EntityType::DataParameter,
					basic_event_ref,
					format!(
						"$.technicalElements.systems-analysis.systemLogicModels[{idx}].basicEventRefs[{be_idx}]"
					),
				);
			}
		}

		for (idx, dependency) in sa.system_dependencies.iter().enumerate() {
			if let Some(source_ref) = &dependency.source_ref {
				resolve_ref(
					"systems-analysis",
					&dependency.id,
					EntityType::SystemDefinition,
					source_ref,
					format!(
						"$.technicalElements.systems-analysis.systemDependencies[{idx}].sourceRef"
					),
				);
			}
			if let Some(target_ref) = &dependency.target_ref {
				resolve_ref(
					"systems-analysis",
					&dependency.id,
					EntityType::SystemDefinition,
					target_ref,
					format!(
						"$.technicalElements.systems-analysis.systemDependencies[{idx}].targetRef"
					),
				);
			}
		}

		for (idx, group) in sa.common_cause_failure_groups.iter().enumerate() {
			for (member_idx, member) in group.members.iter().enumerate() {
				resolve_ref(
					"systems-analysis",
					&group.id,
					EntityType::DataParameter,
					member,
					format!(
						"$.technicalElements.systems-analysis.commonCauseFailureGroups[{idx}].members[{member_idx}]"
					),
				);
			}
		}
	}

	if let Some(esq) = &model.technical_elements.event_sequence_quantification {
		for (idx, result) in esq.quantification_results.iter().enumerate() {
			if let Some(seq_id) = &result.event_sequence_id {
				resolve_ref(
					"event-sequence-quantification",
					&result.id,
					EntityType::EventSequence,
					seq_id,
					format!(
						"$.technicalElements.event-sequence-quantification.quantificationResults[{idx}].eventSequenceId"
					),
				);
			}

			if let Some(ie_id) = &result.initiating_event_id {
				resolve_ref(
					"event-sequence-quantification",
					&result.id,
					EntityType::Initiator,
					ie_id,
					format!(
						"$.technicalElements.event-sequence-quantification.quantificationResults[{idx}].initiatingEventId"
					),
				);
			}

			if let Some(family_id) = &result.family_id {
				resolve_ref(
					"event-sequence-quantification",
					&result.id,
					EntityType::QuantificationFamily,
					family_id,
					format!(
						"$.technicalElements.event-sequence-quantification.quantificationResults[{idx}].familyId"
					),
				);
			}
		}

		for (idx, family) in esq.event_sequence_families.iter().enumerate() {
			for (sequence_idx, sequence_id) in family.sequence_ids.iter().enumerate() {
				resolve_ref(
					"event-sequence-quantification",
					&family.id,
					EntityType::EventSequence,
					sequence_id,
					format!(
						"$.technicalElements.event-sequence-quantification.eventSequenceFamilies[{idx}].sequenceIds[{sequence_idx}]"
					),
				);
			}

			if let Some(initiating_event_id) = &family.representative_initiating_event_id {
				resolve_ref(
					"event-sequence-quantification",
					&family.id,
					EntityType::Initiator,
					initiating_event_id,
					format!(
						"$.technicalElements.event-sequence-quantification.eventSequenceFamilies[{idx}].representativeInitiatingEventId"
					),
				);
			}
		}
	}

	if let Some(ri) = &model.technical_elements.risk_integration {
		let source_id = ri.id.as_deref().unwrap_or("risk-integration");

		for (idx, mapping) in ri
			.event_sequence_to_release_category_mappings
			.iter()
			.enumerate()
		{
			if let Some(sequence_id) = &mapping.sequence_id {
				resolve_ref(
					"risk-integration",
					source_id,
					EntityType::EventSequence,
					sequence_id,
					format!(
						"$.technicalElements.risk-integration.eventSequenceToReleaseCategoryMappings[{idx}].sequenceId"
					),
				);
			}
		}
	}

	(registry, placeholders, diagnostics)
}
