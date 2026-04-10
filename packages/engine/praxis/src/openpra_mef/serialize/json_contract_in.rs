use crate::openpra_mef::json_model::OpenPraJsonModel;
use serde_json::Value;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RenderContext {
	Default,
	TechnicalElements,
}

fn snake_to_camel(input: &str) -> String {
	let mut parts = input.split('_');
	let mut out = parts.next().unwrap_or_default().to_string();
	for part in parts {
		if part.is_empty() {
			continue;
		}
		let mut chars = part.chars();
		if let Some(first) = chars.next() {
			out.push(first.to_ascii_uppercase());
			out.push_str(chars.as_str());
		}
	}
	out
}

fn technical_element_key_from_internal(internal: &str) -> Option<&'static str> {
	match internal {
		"data_analysis" => Some("data-analysis"),
		"systems_analysis" => Some("systems-analysis"),
		"initiating_event_analysis" => Some("initiating-event-analysis"),
		"event_sequence_analysis" => Some("event-sequence-analysis"),
		"event_sequence_quantification" => Some("event-sequence-quantification"),
		"risk_integration" => Some("risk-integration"),
		_ => None,
	}
}

fn flatten_additional_fields(
	out: &mut serde_json::Map<String, Value>,
	additional_fields: &Value,
	context: RenderContext,
) {
	let Some(obj) = additional_fields.as_object() else {
		return;
	};

	for (key, value) in obj {
		if out.contains_key(key) {
			continue;
		}
		out.insert(key.clone(), render_value(value, context));
	}
}

fn render_object(
	obj: &serde_json::Map<String, Value>,
	context: RenderContext,
) -> serde_json::Map<String, Value> {
	let mut out = serde_json::Map::new();

	for (key, value) in obj {
		if key == "additional_fields" {
			flatten_additional_fields(&mut out, value, context);
			continue;
		}

		if context == RenderContext::TechnicalElements && key == "additional_elements" {
			if let Some(additional_obj) = value.as_object() {
				for (element_name, element_value) in additional_obj {
					if out.contains_key(element_name) {
						continue;
					}
					out.insert(element_name.clone(), render_value(element_value, RenderContext::Default));
				}
			}
			continue;
		}

		let (rendered_key, next_context) = if context == RenderContext::TechnicalElements {
			(
				technical_element_key_from_internal(key)
					.map(|s| s.to_string())
					.unwrap_or_else(|| snake_to_camel(key)),
				RenderContext::Default,
			)
		} else {
			let rendered = snake_to_camel(key);
			let next = if rendered == "technicalElements" {
				RenderContext::TechnicalElements
			} else {
				RenderContext::Default
			};
			(rendered, next)
		};

		out.insert(rendered_key, render_value(value, next_context));
	}

	out
}

fn render_value(value: &Value, context: RenderContext) -> Value {
	match value {
		Value::Object(obj) => Value::Object(render_object(obj, context)),
		Value::Array(items) => {
			Value::Array(items.iter().map(|item| render_value(item, context)).collect())
		}
		_ => value.clone(),
	}
}

/// Render an internal `OpenPraJsonModel` (snake_case structs + `additional_fields` maps)
/// into the OpenPRA MEF JSON contract input shape:
/// - `technicalElements` key casing
/// - kebab-case technical element names (e.g. `data-analysis`)
/// - camelCase field names
/// - flatten `additional_fields` into the containing object
pub fn render_openpra_contract_value(model: &OpenPraJsonModel) -> Value {
	let internal_value = serde_json::to_value(model).expect("OpenPRA model must serialize");
	render_value(&internal_value, RenderContext::Default)
}
