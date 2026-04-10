pub mod addon_json;
pub mod addon_openpsa_xml;
pub mod napi;
pub mod json_model;
pub mod contracts;
pub mod resolve;
pub mod serialize;
pub mod validate;

pub use contracts::{
    Diagnostic, EngineInputs, EngineOutputs, OpenPraJsonBundle, ResolveMode, Severity,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn openpra_mef_smoke_public_types_visible() {
        let mut bundle = OpenPraJsonBundle::default();
        let _mode = ResolveMode::Strict;
        let diag = Diagnostic::new(
            "SCHEMA_INVALID_JSON",
            Severity::Error,
            "Invalid JSON",
            "$.input",
        );
        assert_eq!(diag.code, "SCHEMA_INVALID_JSON");
        let _ = crate::openpra_mef::addon_json::resolve_openpra_refs(
            &mut bundle,
            ResolveMode::Compatible,
        );
    }
}
