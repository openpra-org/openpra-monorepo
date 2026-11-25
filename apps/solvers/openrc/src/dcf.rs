use std::path::Path;
use std::sync::{Mutex, OnceLock};

use serde_json::Value;

use crate::error::OpenRcError;
use crate::text::{path_text, read_file_text};

const DEFAULT_DCF_JSON: &str = include_str!("../data/DCF.json");

static CACHED_DCF_DATA: OnceLock<Value> = OnceLock::new();
static LOADING: Mutex<()> = Mutex::new(());

fn parse_dcf_json(text: &str, source: &str) -> Result<Value, OpenRcError> {
    serde_json::from_str(text).map_err(|error| OpenRcError::Json(format!("{source}: {error}")))
}

pub fn load_dcf_data(json_path: Option<&Path>) -> Result<&'static Value, OpenRcError> {
    if let Some(cached) = CACHED_DCF_DATA.get() {
        return Ok(cached);
    }
    let _guard = LOADING
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some(cached) = CACHED_DCF_DATA.get() {
        return Ok(cached);
    }
    let result = match json_path {
        Some(path) => parse_dcf_json(&read_file_text(path)?, &path_text(path))?,
        None => parse_dcf_json(DEFAULT_DCF_JSON, "DCF.json")?,
    };
    Ok(CACHED_DCF_DATA.get_or_init(|| result))
}

pub fn get_dcf_values<'a>(dcf_data: &'a Value, nuclide: &str, organ: &str) -> Option<&'a Value> {
    let key = format!("{nuclide}_{organ}");
    let entry = dcf_data.get("dcfs")?.get(&key)?;
    if entry.is_null() {
        return None;
    }
    static EMPTY: OnceLock<Value> = OnceLock::new();
    match entry.get("values") {
        Some(Value::Null) => None,
        Some(values) => Some(values),
        None => Some(EMPTY.get_or_init(|| Value::Object(serde_json::Map::new()))),
    }
}
