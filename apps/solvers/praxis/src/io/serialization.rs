use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{BufReader, BufWriter};
use std::path::Path;

use crate::algorithms::mocus::CutSet;
use crate::analysis::fault_tree::AnalysisResult;
use crate::analysis::importance::ImportanceRecord;
use crate::analysis::sil::Sil;
use crate::analysis::uncertainty::UncertaintyAnalysis;
use crate::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisCheckpoint {

    pub fta_result: AnalysisResult,

    pub cut_sets: Option<Vec<CutSet>>,

    pub importance: Option<Vec<ImportanceRecord>>,

    pub uncertainty: Option<UncertaintyAnalysis>,

    pub sil: Option<Sil>,

    pub timestamp: u64,

    pub version: String,
}

impl AnalysisCheckpoint {

    pub fn new(fta_result: AnalysisResult) -> Self {
        use std::time::{SystemTime, UNIX_EPOCH};

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        AnalysisCheckpoint {
            fta_result,
            cut_sets: None,
            importance: None,
            uncertainty: None,
            sil: None,
            timestamp,
            version: env!("CARGO_PKG_VERSION").to_string(),
        }
    }

    pub fn with_cut_sets(mut self, cut_sets: Vec<CutSet>) -> Self {
        self.cut_sets = Some(cut_sets);
        self
    }

    pub fn with_importance(mut self, importance: Vec<ImportanceRecord>) -> Self {
        self.importance = Some(importance);
        self
    }

    pub fn with_uncertainty(mut self, uncertainty: UncertaintyAnalysis) -> Self {
        self.uncertainty = Some(uncertainty);
        self
    }

    pub fn with_sil(mut self, sil: Sil) -> Self {
        self.sil = Some(sil);
        self
    }

}

pub fn save_checkpoint<P: AsRef<Path>>(path: P, checkpoint: &AnalysisCheckpoint) -> Result<()> {
    let file = File::create(path)?;
    let writer = BufWriter::new(file);
    bincode::serialize_into(writer, checkpoint)
        .map_err(|e| crate::error::PraxisError::Serialization(e.to_string()))?;
    Ok(())
}

pub fn load_checkpoint<P: AsRef<Path>>(path: P) -> Result<AnalysisCheckpoint> {
    let file = File::open(path)?;
    let reader = BufReader::new(file);
    bincode::deserialize_from(reader)
        .map_err(|e| crate::error::PraxisError::Serialization(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::algorithms::mocus::CutSet;
    use crate::analysis::fault_tree::AnalysisResult;
    use std::fs;

    #[test]
    fn test_checkpoint_new() {
        let result = AnalysisResult {
            top_event_probability: 0.123,
            gates_analyzed: 5,
            basic_events_count: 10,
        };

        let checkpoint = AnalysisCheckpoint::new(result);
        assert_eq!(checkpoint.fta_result.top_event_probability, 0.123);
        assert!(checkpoint.cut_sets.is_none());
        assert!(checkpoint.importance.is_none());
        assert_eq!(checkpoint.version, env!("CARGO_PKG_VERSION"));
    }

    #[test]
    fn test_checkpoint_builder() {
        let result = AnalysisResult {
            top_event_probability: 0.456,
            gates_analyzed: 3,
            basic_events_count: 5,
        };

        let cut_sets = vec![
            CutSet::new(vec!["E1".to_string(), "E2".to_string()]),
            CutSet::new(vec!["E3".to_string()]),
        ];

        let checkpoint = AnalysisCheckpoint::new(result).with_cut_sets(cut_sets.clone());

        assert_eq!(checkpoint.cut_sets.as_ref().unwrap().len(), 2);
        assert_eq!(checkpoint.cut_sets.as_ref().unwrap()[0].events.len(), 2);
    }

    #[test]
    fn test_save_and_load_checkpoint() {
        let temp_file = "test_checkpoint.bin";

        let result = AnalysisResult {
            top_event_probability: 0.789,
            gates_analyzed: 7,
            basic_events_count: 12,
        };

        let checkpoint = AnalysisCheckpoint::new(result);

        save_checkpoint(temp_file, &checkpoint).expect("Save failed");

        let loaded = load_checkpoint(temp_file).expect("Load failed");

        assert_eq!(loaded.fta_result.top_event_probability, 0.789);
        assert_eq!(loaded.fta_result.gates_analyzed, 7);
        assert_eq!(loaded.version, checkpoint.version);

        fs::remove_file(temp_file).ok();
    }

    #[test]
    fn test_save_and_load_checkpoint_with_cut_sets() {
        let temp_file = "test_checkpoint_cutsets.bin";

        let result = AnalysisResult {
            top_event_probability: 0.111,
            gates_analyzed: 2,
            basic_events_count: 4,
        };

        let cut_sets = vec![
            CutSet::new(vec!["E1".to_string()]),
            CutSet::new(vec!["E2".to_string(), "E3".to_string()]),
            CutSet::new(vec!["E4".to_string(), "E5".to_string(), "E6".to_string()]),
        ];

        let checkpoint = AnalysisCheckpoint::new(result).with_cut_sets(cut_sets);

        save_checkpoint(temp_file, &checkpoint).expect("Save failed");
        let loaded = load_checkpoint(temp_file).expect("Load failed");

        assert_eq!(loaded.cut_sets.as_ref().unwrap().len(), 3);
        assert_eq!(loaded.cut_sets.as_ref().unwrap()[0].events.len(), 1);
        assert_eq!(loaded.cut_sets.as_ref().unwrap()[1].events.len(), 2);
        assert_eq!(loaded.cut_sets.as_ref().unwrap()[2].events.len(), 3);

        fs::remove_file(temp_file).ok();
    }

    #[test]
    fn test_load_nonexistent_checkpoint() {
        let result = load_checkpoint("nonexistent_file.bin");
        assert!(result.is_err());
    }
}
