use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct PlaceholderRecord {
    pub source_element: String,
    pub source_id: String,
    pub target_type: String,
    pub target_id: String,
    pub reason: String,
}
