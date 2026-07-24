//! SAPHIRE Version 2 fault-tree cut-set (FTC) output.

use crate::algorithms::mocus::CutSet;
use crate::error::PraxisError;
use crate::Result;

fn validate_header_field(label: &str, value: &str) -> Result<()> {
    if value.trim().is_empty() {
        return Err(PraxisError::Serialization(format!(
            "FTC {label} must not be empty"
        )));
    }
    if value.contains([',', '\r', '\n']) {
        return Err(PraxisError::Serialization(format!(
            "FTC {label} contains a reserved delimiter"
        )));
    }
    Ok(())
}

fn validate_event_name(name: &str) -> Result<()> {
    if name.is_empty()
        || name.chars().any(char::is_whitespace)
        || name.contains(['*', '+', '.', '\r', '\n'])
    {
        return Err(PraxisError::Serialization(format!(
            "FTC basic-event name '{name}' contains a reserved delimiter"
        )));
    }
    if name.starts_with('~') {
        return Err(PraxisError::Serialization(format!(
            "FTC output does not yet support complemented literal '{name}'"
        )));
    }
    Ok(())
}

/// Serialize minimal cut sets using the SAPHIRE Version 2 FTC dialect.
///
/// The caller supplies the SAPHIRE project and analysis identifiers because
/// neither is part of an OpenPSA fault-tree model or a PBF fault-tree payload.
pub fn serialize_saphire_v2(
    project: &str,
    fault_tree: &str,
    analysis: &str,
    cut_sets: &[CutSet],
) -> Result<String> {
    validate_header_field("project", project)?;
    validate_header_field("fault-tree name", fault_tree)?;
    validate_header_field("analysis", analysis)?;

    if cut_sets.is_empty() {
        return Err(PraxisError::Serialization(
            "FTC output requires at least one minimal cut set".to_string(),
        ));
    }

    let mut products = Vec::with_capacity(cut_sets.len());
    for cut_set in cut_sets {
        if cut_set.events.is_empty() {
            return Err(PraxisError::Serialization(
                "FTC output cannot represent an empty cut set".to_string(),
            ));
        }
        let mut events: Vec<&str> = cut_set.events.iter().map(String::as_str).collect();
        for event in &events {
            validate_event_name(event)?;
        }
        events.sort_unstable();
        products.push(events.join(" * "));
    }
    products.sort_unstable_by(|left, right| {
        let left_order = left.matches(" * ").count() + 1;
        let right_order = right.matches(" * ").count() + 1;
        left_order.cmp(&right_order).then_with(|| left.cmp(right))
    });

    let mut output = String::new();
    output.push_str("* Version = 2\r\n");
    output.push_str(project.trim());
    output.push_str(", ");
    output.push_str(fault_tree.trim());
    output.push(',');
    output.push_str(analysis.trim());
    output.push_str("\r\n=\r\n");

    for (index, product) in products.iter().enumerate() {
        output.push_str(product);
        if index + 1 == products.len() {
            output.push_str(" .\r\n");
        } else {
            output.push_str(" +\r\n");
        }
    }

    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_saphire_version_2_ftc_deterministically() {
        let cut_sets = vec![
            CutSet::new(vec!["B".to_string(), "A".to_string()]),
            CutSet::new(vec!["C".to_string()]),
        ];

        let output = serialize_saphire_v2("PROJECT", "TREE", "RANDOM/CD", &cut_sets).unwrap();

        assert_eq!(
            output,
            "* Version = 2\r\nPROJECT, TREE,RANDOM/CD\r\n=\r\nC +\r\nA * B .\r\n"
        );
    }

    #[test]
    fn rejects_complemented_literals_until_their_ftc_syntax_is_confirmed() {
        let cut_sets = vec![CutSet::new(vec!["~A".to_string()])];
        let error = serialize_saphire_v2("PROJECT", "TREE", "RANDOM/CD", &cut_sets)
            .expect_err("complemented literal should be rejected");

        assert!(error.to_string().contains("complemented literal '~A'"));
    }
}
