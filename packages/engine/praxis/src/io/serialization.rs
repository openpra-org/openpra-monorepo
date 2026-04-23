//! Analysis state serialization and checkpointing
//!
//! This module provides functionality to save and restore analysis state,
//! enabling:
//! - Checkpointing during long-running computations
//! - Resuming interrupted analyses
//! - Caching intermediate results for reuse
//!
//! State is serialized using serde (bincode format for efficiency).
//!
//! # Examples
//!
//! ```no_run
//! use praxis::analysis::fault_tree::AnalysisResult;
//! use praxis::io::serialization::{AnalysisCheckpoint, load_checkpoint, save_checkpoint};
//!
//! let result = AnalysisResult {
//!     top_event_probability: 0.123,
//!     gates_analyzed: 0,
//!     basic_events_count: 0,
//! };
//! let checkpoint = AnalysisCheckpoint::new(result);
//! save_checkpoint("checkpoint.bin", &checkpoint).expect("Save failed");
//!
//! let loaded = load_checkpoint("checkpoint.bin").expect("Load failed");
//! assert_eq!(loaded.fta_result.top_event_probability, 0.123);
//! ```
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

/// Complete analysis checkpoint containing all computed results
///
/// This structure holds all analysis state that can be serialized,
/// allowing resumption of long-running computations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisCheckpoint {
    /// Basic fault tree analysis result
    pub fta_result: AnalysisResult,

    /// Minimal cut sets (if computed)
    pub cut_sets: Option<Vec<CutSet>>,

    /// Importance analysis results (if computed)
    pub importance: Option<Vec<ImportanceRecord>>,

    /// Uncertainty analysis results (if computed)
    pub uncertainty: Option<UncertaintyAnalysis>,

    /// SIL metrics (if computed)
    pub sil: Option<Sil>,

    /// Timestamp when checkpoint was created
    pub timestamp: u64,

    /// Version of mcSCRAM that created this checkpoint
    pub version: String,
}

impl AnalysisCheckpoint {
    /// Create a new empty checkpoint with basic FTA result
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

    /// Add cut sets to checkpoint
    pub fn with_cut_sets(mut self, cut_sets: Vec<CutSet>) -> Self {
        self.cut_sets = Some(cut_sets);
        self
    }

    /// Add importance results to checkpoint
    pub fn with_importance(mut self, importance: Vec<ImportanceRecord>) -> Self {
        self.importance = Some(importance);
        self
    }

    /// Add uncertainty results to checkpoint
    pub fn with_uncertainty(mut self, uncertainty: UncertaintyAnalysis) -> Self {
        self.uncertainty = Some(uncertainty);
        self
    }

    /// Add SIL metrics to checkpoint
    pub fn with_sil(mut self, sil: Sil) -> Self {
        self.sil = Some(sil);
        self
    }

}

/// Save analysis checkpoint to file
///
/// Uses bincode for efficient binary serialization. The file can be
/// loaded later to resume analysis.
///
/// # Arguments
/// * `path` - Path where checkpoint will be saved
/// * `checkpoint` - Checkpoint data to save
///
/// # Returns
/// * `Result<()>` - Success or error
///
/// # Examples
///
/// ```no_run
/// use praxis::analysis::fault_tree::AnalysisResult;
/// use praxis::io::serialization::{AnalysisCheckpoint, save_checkpoint};
///
/// let result = AnalysisResult {
///     top_event_probability: 0.123,
///     gates_analyzed: 0,
///     basic_events_count: 0,
/// };
/// let checkpoint = AnalysisCheckpoint::new(result);
/// save_checkpoint("analysis.ckpt", &checkpoint).expect("Save failed");
/// ```
pub fn save_checkpoint<P: AsRef<Path>>(path: P, checkpoint: &AnalysisCheckpoint) -> Result<()> {
    let file = File::create(path)?;
    let writer = BufWriter::new(file);
    bincode::serialize_into(writer, checkpoint)
        .map_err(|e| crate::error::PraxisError::Serialization(e.to_string()))?;
    Ok(())
}

/// Load analysis checkpoint from file
///
/// Deserializes a previously saved checkpoint, allowing analysis to resume.
///
/// # Arguments
/// * `path` - Path to checkpoint file
///
/// # Returns
/// * `Result<AnalysisCheckpoint>` - Loaded checkpoint or error
///
/// # Examples
///
/// ```no_run
/// use praxis::io::serialization::{AnalysisCheckpoint, load_checkpoint};
///
/// let checkpoint = load_checkpoint("analysis.ckpt").expect("Load failed");
/// println!("Loaded checkpoint from version {}", checkpoint.version);
/// println!("Top event probability: {}", checkpoint.fta_result.top_event_probability);
/// ```
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

        // Create checkpoint
        let result = AnalysisResult {
            top_event_probability: 0.789,
            gates_analyzed: 7,
            basic_events_count: 12,
        };

        let checkpoint = AnalysisCheckpoint::new(result);

        // Save
        save_checkpoint(temp_file, &checkpoint).expect("Save failed");

        // Load
        let loaded = load_checkpoint(temp_file).expect("Load failed");

        // Verify
        assert_eq!(loaded.fta_result.top_event_probability, 0.789);
        assert_eq!(loaded.fta_result.gates_analyzed, 7);
        assert_eq!(loaded.version, checkpoint.version);

        // Cleanup
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

        // Save and load
        save_checkpoint(temp_file, &checkpoint).expect("Save failed");
        let loaded = load_checkpoint(temp_file).expect("Load failed");

        // Verify cut sets preserved
        assert_eq!(loaded.cut_sets.as_ref().unwrap().len(), 3);
        assert_eq!(loaded.cut_sets.as_ref().unwrap()[0].events.len(), 1);
        assert_eq!(loaded.cut_sets.as_ref().unwrap()[1].events.len(), 2);
        assert_eq!(loaded.cut_sets.as_ref().unwrap()[2].events.len(), 3);

        // Cleanup
        fs::remove_file(temp_file).ok();
    }

    #[test]
    fn test_load_nonexistent_checkpoint() {
        let result = load_checkpoint("nonexistent_file.bin");
        assert!(result.is_err());
    }
}
