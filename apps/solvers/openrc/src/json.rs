use crate::text::repr_float;

#[derive(Debug, Clone, PartialEq)]
pub enum JsonValue {
    Null,
    Bool(bool),
    Int(i64),
    Float(f64),
    Text(String),
    List(Vec<JsonValue>),
    Object(Vec<(String, JsonValue)>),
}

impl JsonValue {
    pub fn text(value: &str) -> Self {
        JsonValue::Text(value.to_string())
    }

    pub fn optional_float(value: Option<f64>) -> Self {
        value.map_or(JsonValue::Null, JsonValue::Float)
    }

    pub fn floats(values: &[f64]) -> Self {
        JsonValue::List(values.iter().copied().map(JsonValue::Float).collect())
    }

    pub fn grid(rows: &[Vec<f64>]) -> Self {
        JsonValue::List(rows.iter().map(|row| JsonValue::floats(row)).collect())
    }

    pub fn texts(values: &[String]) -> Self {
        JsonValue::List(values.iter().map(|value| JsonValue::text(value)).collect())
    }
}

pub fn object_insert(entries: &mut Vec<(String, JsonValue)>, key: &str, value: JsonValue) {
    match entries.iter_mut().find(|(known, _)| known == key) {
        Some(entry) => entry.1 = value,
        None => entries.push((key.to_string(), value)),
    }
}

fn write_text(text: &str, output: &mut String) {
    output.push('"');
    for character in text.chars() {
        match character {
            '"' => output.push_str("\\\""),
            '\\' => output.push_str("\\\\"),
            '\n' => output.push_str("\\n"),
            '\r' => output.push_str("\\r"),
            '\t' => output.push_str("\\t"),
            '\u{8}' => output.push_str("\\b"),
            '\u{c}' => output.push_str("\\f"),
            ' '..='~' => output.push(character),
            _ => {
                let mut units = [0u16; 2];
                for unit in character.encode_utf16(&mut units) {
                    output.push_str(&format!("\\u{unit:04x}"));
                }
            }
        }
    }
    output.push('"');
}

fn write_float(value: f64, output: &mut String) {
    if value.is_nan() {
        output.push_str("NaN");
    } else if value.is_infinite() {
        output.push_str(if value < 0.0 { "-Infinity" } else { "Infinity" });
    } else {
        output.push_str(&repr_float(value));
    }
}

fn write_indent(level: usize, output: &mut String) {
    output.push('\n');
    for _ in 0..level {
        output.push_str("  ");
    }
}

fn write_value(value: &JsonValue, level: usize, output: &mut String) {
    match value {
        JsonValue::Null => output.push_str("null"),
        JsonValue::Bool(flag) => output.push_str(if *flag { "true" } else { "false" }),
        JsonValue::Int(number) => output.push_str(&number.to_string()),
        JsonValue::Float(number) => write_float(*number, output),
        JsonValue::Text(text) => write_text(text, output),
        JsonValue::List(items) => {
            if items.is_empty() {
                output.push_str("[]");
                return;
            }
            output.push('[');
            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }
                write_indent(level + 1, output);
                write_value(item, level + 1, output);
            }
            write_indent(level, output);
            output.push(']');
        }
        JsonValue::Object(entries) => {
            if entries.is_empty() {
                output.push_str("{}");
                return;
            }
            output.push('{');
            for (index, (key, item)) in entries.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }
                write_indent(level + 1, output);
                write_text(key, output);
                output.push_str(": ");
                write_value(item, level + 1, output);
            }
            write_indent(level, output);
            output.push('}');
        }
    }
}

pub fn to_indented_text(value: &JsonValue) -> String {
    let mut output = String::new();
    write_value(value, 0, &mut output);
    output
}
