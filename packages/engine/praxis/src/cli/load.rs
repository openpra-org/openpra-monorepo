use praxis::core::fault_tree::FaultTree;
use praxis::io::parser::parse_fault_tree;
use std::fs;
use std::path::PathBuf;

pub fn parse_fault_tree_from_xml(xml_content: &str) -> Result<FaultTree, Box<dyn std::error::Error>> {
    let fault_tree =
        parse_fault_tree(xml_content).map_err(|e| format!("Failed to parse XML: {}", e))?;
    Ok(fault_tree)
}

/// Load and parse fault tree from XML file
#[allow(dead_code)]
pub fn load_input_file(path: &PathBuf) -> Result<FaultTree, Box<dyn std::error::Error>> {
    let xml_content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file '{}': {}", path.display(), e))?;

    parse_fault_tree_from_xml(&xml_content)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_input_file_not_found() {
        let path = PathBuf::from("nonexistent.xml");
        let result = load_input_file(&path);
        assert!(result.is_err());
    }
}
