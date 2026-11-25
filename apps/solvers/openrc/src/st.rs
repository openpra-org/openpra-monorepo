use std::path::Path;
use std::sync::{Mutex, OnceLock};

use serde_json::Value;

use crate::error::OpenRcError;
use crate::text::{path_text, read_file_text};

const DEFAULT_DECAY_JSON: &str = include_str!("../data/Chains.json");

static CACHED_DECAY_DATA: OnceLock<Value> = OnceLock::new();
static LOADING: Mutex<()> = Mutex::new(());

fn parse_decay_json(text: &str, source: &str) -> Result<Value, OpenRcError> {
    let raw: Value = serde_json::from_str(text)
        .map_err(|error| OpenRcError::Json(format!("{source}: {error}")))?;
    match raw {
        Value::Object(mut entries) => match entries.shift_remove("nuclides") {
            Some(nuclides) => Ok(nuclides),
            None => Ok(Value::Object(entries)),
        },
        _ => Err(OpenRcError::InvalidType(format!(
            "{source}: the top level of the decay data must be an object"
        ))),
    }
}

pub fn load_decay_data(json_path: Option<&Path>) -> Result<&'static Value, OpenRcError> {
    if let Some(cached) = CACHED_DECAY_DATA.get() {
        return Ok(cached);
    }
    let _guard = LOADING
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some(cached) = CACHED_DECAY_DATA.get() {
        return Ok(cached);
    }
    let result = match json_path {
        Some(path) => parse_decay_json(&read_file_text(path)?, &path_text(path))?,
        None => parse_decay_json(DEFAULT_DECAY_JSON, "Chains.json")?,
    };
    Ok(CACHED_DECAY_DATA.get_or_init(|| result))
}

pub fn get_nuclide_data<'a>(
    nuclide: &str,
    decay_data: Option<&'a Value>,
) -> Result<Option<&'a Value>, OpenRcError> {
    let data: &'a Value = match decay_data {
        Some(data) => data,
        None => load_decay_data(None)?,
    };
    Ok(data.get(nuclide))
}
