use std::collections::{BTreeMap, HashSet};

use crate::algorithms::zbdd_engine::{ZbddEngine, ZbddRef};
use crate::{PraxisError, Result};

/// Named end-state roots sharing one ZBDD manager and variable dictionary.
pub struct EndStateZbdd {
    engine: ZbddEngine,
    variable_names: Vec<String>,
    groups: Vec<(String, ZbddRef)>,
}

impl EndStateZbdd {
    pub fn from_shared(
        engine: ZbddEngine,
        names: Vec<Option<String>>,
        groups: BTreeMap<String, (String, ZbddRef)>,
    ) -> Result<Self> {
        let roots: Vec<(String, ZbddRef)> = groups.into_values().collect();
        let used: HashSet<usize> = roots
            .iter()
            .flat_map(|(_, root)| engine.support_variables(*root))
            .collect();
        for &variable in &used {
            if names.get(variable).and_then(Option::as_ref).is_none() {
                return Err(PraxisError::Logic(format!(
                    "end-state ZBDD variable {variable} has no event name"
                )));
            }
        }
        Ok(Self {
            engine,
            variable_names: names
                .into_iter()
                .map(|name| name.unwrap_or_default())
                .collect(),
            groups: roots,
        })
    }

    pub fn engine(&self) -> &ZbddEngine {
        &self.engine
    }

    pub fn variable_names(&self) -> &[String] {
        &self.variable_names
    }

    pub fn groups(&self) -> impl Iterator<Item = (&str, ZbddRef)> {
        self.groups
            .iter()
            .map(|(name, root)| (name.as_str(), *root))
    }
}
