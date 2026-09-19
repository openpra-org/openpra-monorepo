//! Rust port of HCL_MH's hazard_sweep.py::generate_hazard_sweep_scenarios (335–370).
//! The last dimension varies fastest. Exclusions precede numbering and the limit.

use std::collections::{BTreeMap, HashSet};

use serde::{Deserialize, Serialize};

use crate::{PraxisError, Result};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HazardDimension {
    pub id: String,
    pub bn_node: String,
    pub states: Vec<String>,
    #[serde(default)]
    pub state_labels: BTreeMap<String, String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HazardSweepSpec {
    pub dimensions: Vec<HazardDimension>,
    #[serde(default)]
    pub excluded_assignments: Vec<BTreeMap<String, String>>,
    pub max_scenarios: Option<usize>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HazardSweepScenario {
    pub scenario_id: String,
    pub label: String,
    pub enabled: bool,
    pub selected: bool,
    pub evidence: BTreeMap<String, String>,
    pub hazard_assignments: BTreeMap<String, String>,
    pub hazard_dimensions: Vec<String>,
}

impl HazardSweepSpec {
    /// Typed-input counterpart of load_hazard_sweep_spec's dimension/exclusion checks.
    /// YAML aliases and token conversion belong to the source's file loader.
    pub fn validate(&self) -> Result<()> {
        let fail = |message: &str| PraxisError::Hcl(message.into());
        if self.max_scenarios == Some(0) {
            return Err(fail("maxScenarios must be positive when provided"));
        }
        let mut ids = HashSet::new();
        let mut nodes = HashSet::new();
        for dim in &self.dimensions {
            if dim.id.trim().is_empty()
                || dim.bn_node.trim().is_empty()
                || !ids.insert(&dim.id)
                || !nodes.insert(&dim.bn_node)
            {
                return Err(fail(
                    "Each hazard dimension must have a unique id and BN node",
                ));
            }
            let states: HashSet<_> = dim.states.iter().collect();
            if states.is_empty()
                || states.len() != dim.states.len()
                || dim.states.iter().any(|s| s.trim().is_empty())
            {
                return Err(fail(
                    "Each hazard dimension requires nonempty, unique states",
                ));
            }
        }
        for excluded in &self.excluded_assignments {
            for (id, state) in excluded {
                if !self
                    .dimensions
                    .iter()
                    .any(|d| &d.id == id && d.states.contains(state))
                {
                    return Err(fail(
                        "Excluded assignment contains an unknown dimension or state",
                    ));
                }
            }
        }
        Ok(())
    }
}

pub fn generate_hazard_sweep_scenarios(spec: &HazardSweepSpec) -> Result<Vec<HazardSweepScenario>> {
    spec.validate()?;
    let dims = &spec.dimensions;
    if dims.is_empty() {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    let mut positions = vec![0; dims.len()];
    loop {
        let by_dim: BTreeMap<_, _> = dims
            .iter()
            .zip(&positions)
            .map(|(d, &i)| (d.id.clone(), d.states[i].clone()))
            .collect();
        let excluded = spec
            .excluded_assignments
            .iter()
            .any(|ex| ex.iter().all(|(k, v)| by_dim.get(k) == Some(v)));
        if !excluded {
            out.push(HazardSweepScenario {
                scenario_id: format!("hz_{:04}", out.len() + 1),
                label: dims
                    .iter()
                    .zip(&positions)
                    .map(|(d, &i)| {
                        let state = &d.states[i];
                        format!("{}={}", d.id, d.state_labels.get(state).unwrap_or(state))
                    })
                    .collect::<Vec<_>>()
                    .join(" | "),
                enabled: true,
                selected: true,
                evidence: dims
                    .iter()
                    .zip(&positions)
                    .map(|(d, &i)| (d.bn_node.clone(), d.states[i].clone()))
                    .collect(),
                hazard_assignments: by_dim,
                hazard_dimensions: dims.iter().map(|d| d.id.clone()).collect(),
            });
            if spec.max_scenarios.is_some_and(|limit| out.len() >= limit) {
                break;
            }
        }
        // Equivalent to itertools.product: carry from the rightmost dimension.
        let mut index = dims.len();
        loop {
            if index == 0 {
                return Ok(out);
            }
            index -= 1;
            positions[index] += 1;
            if positions[index] < dims[index].states.len() {
                break;
            }
            positions[index] = 0;
        }
    }
    Ok(out)
}
