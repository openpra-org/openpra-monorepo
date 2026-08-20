use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::core::fault_tree::FaultTree;
use crate::hcl::{
    CanonicalBayesianNetwork, CanonicalBayesianVariable, HclBindingSpec, HclEvidenceSpec, HclModel,
    HclSettings,
};
use crate::{PraxisError, Result};

pub const HCL_REQUEST_VERSION: u32 = 1;

/// Versioned process-boundary input for HCL quantification.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct HclRequest {
    #[serde(default = "current_version")]
    pub schema_version: u32,
    pub network: HclNetworkInput,
    #[serde(default)]
    pub bindings: Vec<HclBindingSpec>,
    #[serde(default)]
    pub base_evidence: Vec<HclEvidenceSpec>,
    #[serde(default)]
    pub settings: HclSettings,
}

/// Selects canonical BN data, embedded XDSL, or an XDSL file.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "format", rename_all = "snake_case", deny_unknown_fields)]
pub enum HclNetworkInput {
    Canonical {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        id: Option<String>,
        variables: Vec<CanonicalBayesianVariable>,
    },
    Xdsl {
        document: String,
    },
    XdslFile {
        path: PathBuf,
    },
}

impl HclRequest {
    pub fn from_json(json: &str) -> Result<Self> {
        let request: Self = serde_json::from_str(json)
            .map_err(|error| PraxisError::Serialization(error.to_string()))?;
        request.validate_version()?;
        Ok(request)
    }

    pub fn from_json_file(path: impl AsRef<Path>) -> Result<Self> {
        let path = path.as_ref();
        let json = fs::read_to_string(path).map_err(|error| {
            PraxisError::Io(format!(
                "failed to read HCL request '{}': {error}",
                path.display()
            ))
        })?;
        Self::from_json(&json)
    }

    pub fn into_model(self, fault_tree: FaultTree) -> Result<(HclModel, HclSettings)> {
        self.into_model_with_base(fault_tree, None)
    }

    pub fn into_model_with_base(
        self,
        fault_tree: FaultTree,
        base_directory: Option<&Path>,
    ) -> Result<(HclModel, HclSettings)> {
        self.validate_version()?;
        let network = self.network.into_canonical(base_directory)?.into_graph()?;
        let model = HclModel::new(fault_tree, network)?
            .with_bindings(self.bindings)
            .with_base_evidence(self.base_evidence);
        Ok((model, self.settings))
    }

    fn validate_version(&self) -> Result<()> {
        if self.schema_version != HCL_REQUEST_VERSION {
            return Err(PraxisError::Hcl(format!(
                "unsupported HCL request schema version {}; expected {HCL_REQUEST_VERSION}",
                self.schema_version
            )));
        }
        Ok(())
    }
}

impl HclNetworkInput {
    fn into_canonical(self, base_directory: Option<&Path>) -> Result<CanonicalBayesianNetwork> {
        match self {
            Self::Canonical { id, variables } => Ok(CanonicalBayesianNetwork { id, variables }),
            Self::Xdsl { document } => CanonicalBayesianNetwork::from_xdsl(&document),
            Self::XdslFile { path } => {
                let resolved = if path.is_relative() {
                    base_directory.map_or(path.clone(), |base| base.join(&path))
                } else {
                    path
                };
                CanonicalBayesianNetwork::from_xdsl_file(resolved)
            }
        }
    }
}

const fn current_version() -> u32 {
    HCL_REQUEST_VERSION
}
