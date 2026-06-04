use quick_xml::events::Event;
use quick_xml::Reader;
use std::io::BufRead;

use crate::core::ccf::{CcfGroup, CcfModel};
use crate::core::event::BasicEvent;
use crate::core::event_tree::{EventTree, InitiatingEvent};
use crate::core::fault_tree::FaultTree;
use crate::core::gate::{Formula, Gate};
use crate::core::model::Model;
use crate::error::{MefError, Result};

#[derive(Debug)]
pub enum ParsedInput {
  FaultTree(FaultTree),
  EventTreeModel(crate::io::event_tree_parser::EventTreeModel),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MefKind {
  FaultTree,
  EventTree,
}

fn detect_mef_kind(xml: &str) -> Result<MefKind> {
  let mut reader = Reader::from_str(xml);
  reader.trim_text(true);

  let mut buf = Vec::new();
  let mut saw_fault_tree = false;

  loop {
    match reader.read_event_into(&mut buf) {
      Ok(Event::Start(e)) | Ok(Event::Empty(e)) => match e.name().as_ref() {
        b"define-event-tree" | b"define-initiating-event" => return Ok(MefKind::EventTree),
        b"define-fault-tree" => saw_fault_tree = true,
        _ => {}
      },
      Ok(Event::Eof) => break,
      Err(e) => {
        return Err(MefError::Validity(format!("XML parse error: {e}")).into());
      }
      _ => {}
    }
    buf.clear();
  }

  if saw_fault_tree {
    Ok(MefKind::FaultTree)
  } else {
    Err(MefError::Validity(
      "Input XML does not contain <define-fault-tree> or <define-event-tree>".to_string(),
    )
    .into())
  }
}

pub fn parse_any_mef(xml: &str) -> Result<ParsedInput> {
  match detect_mef_kind(xml)? {
    MefKind::EventTree => {
      let parsed = crate::io::event_tree_parser::parse_event_tree_model_full(xml)?;
      Ok(ParsedInput::EventTreeModel(parsed))
    }
    MefKind::FaultTree => Ok(ParsedInput::FaultTree(parse_fault_tree(xml)?)),
  }
}

pub fn parse_element<R: BufRead>(reader: &mut Reader<R>, name: &str) -> Result<BasicEvent> {
    let mut probability = None;
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) | Ok(Event::Empty(e)) if e.name().as_ref() == b"float" => {
                for attr in e.attributes() {
                    let attr = attr.map_err(|e| {
                        MefError::Validity(format!("Invalid attribute in {}: {}", name, e))
                    })?;

                    if attr.key.as_ref() == b"value" {
                        let value_str = std::str::from_utf8(&attr.value).map_err(|_| {
                            MefError::Validity(format!(
                                "Invalid UTF-8 in value attribute for {}",
                                name
                            ))
                        })?;

                        probability = Some(value_str.parse::<f64>().map_err(|_| {
                            MefError::Validity(format!(
                                "Invalid probability value '{}' for {}",
                                value_str, name
                            ))
                        })?);
                    }
                }
            }
            Ok(Event::End(e)) if e.name().as_ref() == b"define-basic-event" => {
                break;
            }
            Ok(Event::Eof) => {
                return Err(MefError::Validity(format!(
                    "Unexpected EOF while parsing basic event {}",
                    name
                ))
                .into());
            }
            Err(e) => {
                return Err(
                    MefError::Validity(format!("XML parse error in {}: {}", name, e)).into(),
                );
            }
            _ => {}
        }
        buf.clear();
    }

    let prob = probability.ok_or_else(|| {
        MefError::Validity(format!(
            "Missing probability value for basic event {}",
            name
        ))
    })?;

    BasicEvent::new(name.to_string(), prob)
}

/// Parse a gate element from XML
///
/// Parses `<define-gate name="G1"><and><basic-event name="E1"/></and></define-gate>`
pub fn parse_gate<R: BufRead>(reader: &mut Reader<R>, name: &str) -> Result<Gate> {
    let mut formula = None;
    let mut operands = Vec::new();
    let mut buf = Vec::new();
    let mut in_formula = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                let tag_name = e.name();
                match tag_name.as_ref() {
                    b"and" => {
                        formula = Some(Formula::And);
                        in_formula = true;
                    }
                    b"or" => {
                        formula = Some(Formula::Or);
                        in_formula = true;
                    }
                    b"not" => {
                        formula = Some(Formula::Not);
                        in_formula = true;
                    }
                    b"xor" => {
                        formula = Some(Formula::Xor);
                        in_formula = true;
                    }
                    b"nand" => {
                        formula = Some(Formula::Nand);
                        in_formula = true;
                    }
                    b"nor" => {
                        formula = Some(Formula::Nor);
                        in_formula = true;
                    }
                    b"iff" => {
                        formula = Some(Formula::Iff);
                        in_formula = true;
                    }
                    b"atleast" => {
                        let mut min = 1;
                        for attr in e.attributes() {
                            let attr = attr.map_err(|e| {
                                MefError::Validity(format!(
                                    "Invalid attribute in gate {}: {}",
                                    name, e
                                ))
                            })?;

                            if attr.key.as_ref() == b"min" {
                                let min_str = std::str::from_utf8(&attr.value).map_err(|_| {
                                    MefError::Validity(format!(
                                        "Invalid UTF-8 in min attribute for gate {}",
                                        name
                                    ))
                                })?;

                                min = min_str.parse::<usize>().map_err(|_| {
                                    MefError::Validity(format!(
                                        "Invalid min value '{}' for gate {}",
                                        min_str, name
                                    ))
                                })?;
                            }
                        }
                        formula = Some(Formula::AtLeast { min });
                        in_formula = true;
                    }
                    _ => {}
                }
            }
            Ok(Event::Empty(e)) => {
                if in_formula {
                    let tag_name = e.name();
                    match tag_name.as_ref() {
                        b"basic-event" | b"gate" | b"house-event" => {
                            for attr in e.attributes() {
                                let attr = attr.map_err(|e| {
                                    MefError::Validity(format!("Invalid attribute: {}", e))
                                })?;

                                if attr.key.as_ref() == b"name" {
                                    let operand_name =
                                        std::str::from_utf8(&attr.value).map_err(|_| {
                                            MefError::Validity(
                                                "Invalid UTF-8 in name attribute".to_string(),
                                            )
                                        })?;
                                    operands.push(operand_name.to_string());
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }
            Ok(Event::End(e)) => {
                let tag_name = e.name();
                if tag_name.as_ref() == b"define-gate" {
                    break;
                } else if in_formula {
                    match tag_name.as_ref() {
                        b"and" | b"or" | b"not" | b"xor" | b"nand" | b"nor" | b"iff"
                        | b"atleast" => {
                            in_formula = false;
                        }
                        _ => {}
                    }
                }
            }
            Ok(Event::Eof) => {
                return Err(MefError::Validity(format!(
                    "Unexpected EOF while parsing gate {}",
                    name
                ))
                .into());
            }
            Err(e) => {
                return Err(
                    MefError::Validity(format!("XML parse error in gate {}: {}", name, e)).into(),
                );
            }
            _ => {}
        }
        buf.clear();
    }

    let formula = formula
        .ok_or_else(|| MefError::Validity(format!("Missing gate formula for gate {}", name)))?;

    let mut gate = Gate::new(name.to_string(), formula)?;
    for operand in operands {
        gate.add_operand(operand);
    }

    Ok(gate)
}

/// Parse a CCF (Common Cause Failure) group from XML
///
/// Parses `<define-CCF-group name="CCF1" model="beta-factor">...</define-CCF-group>`
///
/// # Expected XML structure
/// ```xml
/// <define-CCF-group name="Pumps" model="beta-factor">
///   <members>
///     <basic-event name="Pump1"/>
///     <basic-event name="Pump2"/>
///   </members>
///   <distribution>
///     <float value="0.1"/>
///   </distribution>
///   <factor level="2">
///     <float value="0.2"/>
///   </factor>
/// </define-CCF-group>
/// ```
pub fn parse_ccf_group<R: BufRead>(
    reader: &mut Reader<R>,
    name: &str,
    model_type: &str,
) -> Result<CcfGroup> {
    let mut members = Vec::new();
    let mut distribution_value = None;
    let mut factors = Vec::new();
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) | Ok(Event::Empty(e)) => {
                let tag_name = e.name();
                match tag_name.as_ref() {
                    b"basic-event" => {
                        // Parse member basic event name
                        for attr in e.attributes() {
                            let attr = attr.map_err(|e| {
                                MefError::Validity(format!("Invalid attribute: {}", e))
                            })?;

                            if attr.key.as_ref() == b"name" {
                                let member_name =
                                    std::str::from_utf8(&attr.value).map_err(|_| {
                                        MefError::Validity(
                                            "Invalid UTF-8 in member name".to_string(),
                                        )
                                    })?;
                                members.push(member_name.to_string());
                            }
                        }
                    }
                    b"float" => {
                        // Parse float value (for distribution or factor)
                        for attr in e.attributes() {
                            let attr = attr.map_err(|e| {
                                MefError::Validity(format!("Invalid attribute: {}", e))
                            })?;

                            if attr.key.as_ref() == b"value" {
                                let value_str = std::str::from_utf8(&attr.value).map_err(|_| {
                                    MefError::Validity("Invalid UTF-8 in value".to_string())
                                })?;

                                let value = value_str.parse::<f64>().map_err(|_| {
                                    MefError::Validity(format!(
                                        "Invalid float value '{}'",
                                        value_str
                                    ))
                                })?;

                                // Check if we're in distribution or factor context
                                // We'll track this based on whether we've seen distribution yet
                                if distribution_value.is_none() && factors.is_empty() {
                                    distribution_value = Some(value);
                                } else {
                                    factors.push(value);
                                }
                            }
                        }
                    }
                    b"factor" => {
                        // Factor element - the float will be parsed in the next iteration
                        // We can extract the level attribute here if needed
                        // For now, we just parse factors in order
                    }
                    _ => {}
                }
            }
            Ok(Event::End(e)) => {
                if e.name().as_ref() == b"define-CCF-group" {
                    break;
                }
            }
            Ok(Event::Eof) => {
                return Err(MefError::Validity(format!(
                    "Unexpected EOF while parsing CCF group {}",
                    name
                ))
                .into());
            }
            Err(e) => {
                return Err(MefError::Validity(format!(
                    "XML parse error in CCF group {}: {}",
                    name, e
                ))
                .into());
            }
            _ => {}
        }
        buf.clear();
    }

    // Validate required elements
    if members.is_empty() {
        return Err(MefError::Validity(format!(
            "CCF group {} must have at least one member",
            name
        ))
        .into());
    }

    // Create the appropriate CCF model based on model_type
    let model = match model_type.to_lowercase().as_str() {
        "beta-factor" => {
            if factors.is_empty() {
                return Err(MefError::Validity(format!(
                    "Beta-Factor CCF group {} requires a factor value",
                    name
                ))
                .into());
            }
            CcfModel::BetaFactor(factors[0])
        }
        "alpha-factor" => {
            if factors.is_empty() {
                return Err(MefError::Validity(format!(
                    "Alpha-Factor CCF group {} requires factor values",
                    name
                ))
                .into());
            }
            CcfModel::AlphaFactor(factors)
        }
        "mgl" => {
            if factors.is_empty() {
                return Err(MefError::Validity(format!(
                    "MGL CCF group {} requires factor values",
                    name
                ))
                .into());
            }
            CcfModel::Mgl(factors)
        }
        "phi-factor" => {
            if factors.is_empty() {
                return Err(MefError::Validity(format!(
                    "Phi-Factor CCF group {} requires factor values",
                    name
                ))
                .into());
            }
            CcfModel::PhiFactor(factors)
        }
        _ => {
            return Err(MefError::Validity(format!(
                "Unknown CCF model type '{}' for group {}",
                model_type, name
            ))
            .into());
        }
    };

    // Create CCF group
    let mut ccf_group = CcfGroup::new(name, members, model)?;

    // Add distribution if present
    if let Some(dist_value) = distribution_value {
        ccf_group = ccf_group.with_distribution(dist_value.to_string());
    }

    Ok(ccf_group)
}

pub fn parse_fault_tree(xml_content: &str) -> Result<FaultTree> {
    let mut reader = Reader::from_str(xml_content);
    reader.trim_text(true);

    let mut ft_name = None;
    let mut top_gate = None;
    let mut gates = Vec::new();
    let mut basic_events = Vec::new();
    let mut ccf_groups = Vec::new();
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                let tag_name = e.name();
                match tag_name.as_ref() {
                    b"define-fault-tree" => {
                        for attr in e.attributes() {
                            let attr = attr.map_err(|e| {
                                MefError::Validity(format!("Invalid attribute: {}", e))
                            })?;

                            if attr.key.as_ref() == b"name" {
                                ft_name = Some(
                                    std::str::from_utf8(&attr.value)
                                        .map_err(|_| {
                                            MefError::Validity(
                                                "Invalid UTF-8 in fault tree name".to_string(),
                                            )
                                        })?
                                        .to_string(),
                                );
                            }
                        }
                    }
                    b"define-gate" => {
                        let mut gate_name = None;
                        for attr in e.attributes() {
                            let attr = attr.map_err(|e| {
                                MefError::Validity(format!("Invalid attribute: {}", e))
                            })?;

                            if attr.key.as_ref() == b"name" {
                                gate_name = Some(
                                    std::str::from_utf8(&attr.value)
                                        .map_err(|_| {
                                            MefError::Validity(
                                                "Invalid UTF-8 in gate name".to_string(),
                                            )
                                        })?
                                        .to_string(),
                                );
                            }
                        }

                        if let Some(name) = gate_name {
                            if top_gate.is_none() {
                                top_gate = Some(name.clone());
                            }
                            let gate = parse_gate(&mut reader, &name)?;
                            gates.push(gate);
                        }
                    }
                    b"define-basic-event" => {
                        let mut event_name = None;
                        for attr in e.attributes() {
                            let attr = attr.map_err(|e| {
                                MefError::Validity(format!("Invalid attribute: {}", e))
                            })?;

                            if attr.key.as_ref() == b"name" {
                                event_name = Some(
                                    std::str::from_utf8(&attr.value)
                                        .map_err(|_| {
                                            MefError::Validity(
                                                "Invalid UTF-8 in basic event name".to_string(),
                                            )
                                        })?
                                        .to_string(),
                                );
                            }
                        }

                        if let Some(name) = event_name {
                            let event = parse_element(&mut reader, &name)?;
                            basic_events.push(event);
                        }
                    }
                    b"define-CCF-group" => {
                        let mut ccf_name = None;
                        let mut model_type = None;

                        for attr in e.attributes() {
                            let attr = attr.map_err(|e| {
                                MefError::Validity(format!("Invalid attribute: {}", e))
                            })?;

                            match attr.key.as_ref() {
                                b"name" => {
                                    ccf_name = Some(
                                        std::str::from_utf8(&attr.value)
                                            .map_err(|_| {
                                                MefError::Validity(
                                                    "Invalid UTF-8 in CCF group name".to_string(),
                                                )
                                            })?
                                            .to_string(),
                                    );
                                }
                                b"model" => {
                                    model_type = Some(
                                        std::str::from_utf8(&attr.value)
                                            .map_err(|_| {
                                                MefError::Validity(
                                                    "Invalid UTF-8 in CCF model type".to_string(),
                                                )
                                            })?
                                            .to_string(),
                                    );
                                }
                                _ => {}
                            }
                        }

                        if let (Some(name), Some(model)) = (ccf_name, model_type) {
                            let ccf_group = parse_ccf_group(&mut reader, &name, &model)?;
                            ccf_groups.push(ccf_group);
                        } else {
                            return Err(MefError::Validity(
                                "CCF group must have both 'name' and 'model' attributes"
                                    .to_string(),
                            )
                            .into());
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                return Err(MefError::Validity(format!("XML parse error: {}", e)).into());
            }
            _ => {}
        }
        buf.clear();
    }

    let ft_name = ft_name
        .ok_or_else(|| MefError::Validity("Missing fault tree name attribute".to_string()))?;

    let top_gate = top_gate
        .ok_or_else(|| MefError::Validity(format!("No gates defined in fault tree {}", ft_name)))?;

    let mut ft = FaultTree::new(&ft_name, &top_gate)?;

    for gate in gates {
        ft.add_gate(gate)?;
    }

    for event in basic_events {
        ft.add_basic_event(event)?;
    }

    for ccf_group in ccf_groups {
        ft.add_ccf_group(ccf_group)?;
    }

    Ok(ft)
}

#[cfg(test)]
#[allow(clippy::items_after_test_module)]
mod tests {
    use super::*;

    // T116-T118: parse_element() tests
    #[test]
    fn test_parse_element_basic() {
        let xml = r#"<define-basic-event name="E1"><float value="0.5"/></define-basic-event>"#;
        let mut reader = Reader::from_str(xml);
        reader.trim_text(true);

        loop {
            match reader.read_event() {
                Ok(Event::Start(e)) if e.name().as_ref() == b"define-basic-event" => {
                    let event = parse_element(&mut reader, "E1").unwrap();
                    assert_eq!(event.probability(), 0.5);
                    assert_eq!(event.element().id(), "E1");
                    break;
                }
                Ok(Event::Eof) => panic!("Unexpected EOF"),
                _ => {}
            }
        }
    }

    #[test]
    fn test_parse_element_zero_probability() {
        let xml = r#"<define-basic-event name="E2"><float value="0.0"/></define-basic-event>"#;
        let mut reader = Reader::from_str(xml);
        reader.trim_text(true);

        loop {
            match reader.read_event() {
                Ok(Event::Start(e)) if e.name().as_ref() == b"define-basic-event" => {
                    let event = parse_element(&mut reader, "E2").unwrap();
                    assert_eq!(event.probability(), 0.0);
                    break;
                }
                Ok(Event::Eof) => panic!("Unexpected EOF"),
                _ => {}
            }
        }
    }

    #[test]
    fn test_parse_element_one_probability() {
        let xml = r#"<define-basic-event name="E3"><float value="1.0"/></define-basic-event>"#;
        let mut reader = Reader::from_str(xml);
        reader.trim_text(true);

        loop {
            match reader.read_event() {
                Ok(Event::Start(e)) if e.name().as_ref() == b"define-basic-event" => {
                    let event = parse_element(&mut reader, "E3").unwrap();
                    assert_eq!(event.probability(), 1.0);
                    break;
                }
                Ok(Event::Eof) => panic!("Unexpected EOF"),
                _ => {}
            }
        }
    }

    // T119-T121: parse_gate() tests
    #[test]
    fn test_parse_gate_and() {
        let xml = r#"<define-gate name="G1"><and><basic-event name="E1"/><basic-event name="E2"/></and></define-gate>"#;
        let mut reader = Reader::from_str(xml);
        reader.trim_text(true);

        loop {
            match reader.read_event() {
                Ok(Event::Start(e)) if e.name().as_ref() == b"define-gate" => {
                    let gate = parse_gate(&mut reader, "G1").unwrap();
                    assert!(matches!(gate.formula(), Formula::And));
                    assert_eq!(gate.operands().len(), 2);
                    assert_eq!(gate.operands()[0], "E1");
                    assert_eq!(gate.operands()[1], "E2");
                    break;
                }
                Ok(Event::Eof) => panic!("Unexpected EOF"),
                _ => {}
            }
        }
    }

    #[test]
    fn test_parse_gate_or() {
        let xml = r#"<define-gate name="G2"><or><basic-event name="A"/><basic-event name="B"/><basic-event name="C"/></or></define-gate>"#;
        let mut reader = Reader::from_str(xml);
        reader.trim_text(true);

        loop {
            match reader.read_event() {
                Ok(Event::Start(e)) if e.name().as_ref() == b"define-gate" => {
                    let gate = parse_gate(&mut reader, "G2").unwrap();
                    assert!(matches!(gate.formula(), Formula::Or));
                    assert_eq!(gate.operands().len(), 3);
                    break;
                }
                Ok(Event::Eof) => panic!("Unexpected EOF"),
                _ => {}
            }
        }
    }

    #[test]
    fn test_parse_gate_not() {
        let xml = r#"<define-gate name="G3"><not><basic-event name="E1"/></not></define-gate>"#;
        let mut reader = Reader::from_str(xml);
        reader.trim_text(true);

        loop {
            match reader.read_event() {
                Ok(Event::Start(e)) if e.name().as_ref() == b"define-gate" => {
                    let gate = parse_gate(&mut reader, "G3").unwrap();
                    assert!(matches!(gate.formula(), Formula::Not));
                    assert_eq!(gate.operands().len(), 1);
                    break;
                }
                Ok(Event::Eof) => panic!("Unexpected EOF"),
                _ => {}
            }
        }
    }

    // T122-T124: parse_fault_tree() tests
    #[test]
    fn test_parse_fault_tree_simple_and() {
        let xml = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="depth1">
    <define-gate name="and">
      <and>
        <basic-event name="A"/>
        <basic-event name="B"/>
      </and>
    </define-gate>
    <define-basic-event name="A">
      <float value="0.5"/>
    </define-basic-event>
    <define-basic-event name="B">
      <float value="0.25"/>
    </define-basic-event>
  </define-fault-tree>
</opsa-mef>"#;

        let ft = parse_fault_tree(xml).unwrap();
        assert_eq!(ft.element().id(), "depth1");
        assert_eq!(ft.top_event(), "and");
        assert_eq!(ft.gates().len(), 1);
        assert_eq!(ft.basic_events().len(), 2);

        let gate = ft.get_gate("and").unwrap();
        assert!(matches!(gate.formula(), Formula::And));

        let event_a = ft.get_basic_event("A").unwrap();
        assert_eq!(event_a.probability(), 0.5);

        let event_b = ft.get_basic_event("B").unwrap();
        assert_eq!(event_b.probability(), 0.25);
    }

    #[test]
    fn test_parse_fault_tree_nested_gates() {
        let xml = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="nested">
    <define-gate name="Top">
      <and>
        <gate name="G1"/>
        <basic-event name="C"/>
      </and>
    </define-gate>
    <define-gate name="G1">
      <or>
        <basic-event name="A"/>
        <basic-event name="B"/>
      </or>
    </define-gate>
    <define-basic-event name="A">
      <float value="0.1"/>
    </define-basic-event>
    <define-basic-event name="B">
      <float value="0.2"/>
    </define-basic-event>
    <define-basic-event name="C">
      <float value="0.5"/>
    </define-basic-event>
  </define-fault-tree>
</opsa-mef>"#;

        let ft = parse_fault_tree(xml).unwrap();
        assert_eq!(ft.element().id(), "nested");
        assert_eq!(ft.gates().len(), 2);
        assert_eq!(ft.basic_events().len(), 3);
    }

    #[test]
    fn test_parse_fault_tree_complex_formulas() {
        let xml = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="complex">
    <define-gate name="G1">
      <xor>
        <basic-event name="A"/>
        <basic-event name="B"/>
      </xor>
    </define-gate>
    <define-basic-event name="A">
      <float value="0.3"/>
    </define-basic-event>
    <define-basic-event name="B">
      <float value="0.4"/>
    </define-basic-event>
  </define-fault-tree>
</opsa-mef>"#;

        let ft = parse_fault_tree(xml).unwrap();
        let gate = ft.get_gate("G1").unwrap();
        assert!(matches!(gate.formula(), Formula::Xor));
    }

    // T261: CCF parsing tests

    #[test]
    fn test_parse_ccf_beta_factor() {
        let xml = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="BetaFactorTest">
    <define-gate name="Top">
      <or>
        <basic-event name="Pump1"/>
        <basic-event name="Pump2"/>
      </or>
    </define-gate>
  </define-fault-tree>
  <define-CCF-group name="Pumps" model="beta-factor">
    <members>
      <basic-event name="Pump1"/>
      <basic-event name="Pump2"/>
    </members>
    <distribution>
      <float value="0.1"/>
    </distribution>
    <factor level="2">
      <float value="0.2"/>
    </factor>
  </define-CCF-group>
</opsa-mef>"#;

        let ft = parse_fault_tree(xml).unwrap();
        assert_eq!(ft.ccf_groups().len(), 1);

        let ccf = ft.get_ccf_group("Pumps").unwrap();
        assert_eq!(ccf.element().id(), "Pumps");
        assert_eq!(ccf.members.len(), 2);
        assert_eq!(ccf.members[0], "Pump1");
        assert_eq!(ccf.members[1], "Pump2");

        match &ccf.model {
            CcfModel::BetaFactor(beta) => assert_eq!(*beta, 0.2),
            _ => panic!("Expected BetaFactor model"),
        }
    }

    #[test]
    fn test_parse_ccf_alpha_factor() {
        let xml = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="AlphaFactorTest">
    <define-gate name="Top">
      <or>
        <basic-event name="Pump1"/>
        <basic-event name="Pump2"/>
        <basic-event name="Pump3"/>
      </or>
    </define-gate>
  </define-fault-tree>
  <define-CCF-group name="Pumps" model="alpha-factor">
    <members>
      <basic-event name="Pump1"/>
      <basic-event name="Pump2"/>
      <basic-event name="Pump3"/>
    </members>
    <distribution>
      <float value="0.1"/>
    </distribution>
    <factors>
      <factor level="1">
        <float value="0.7"/>
      </factor>
      <factor level="2">
        <float value="0.2"/>
      </factor>
      <factor level="3">
        <float value="0.1"/>
      </factor>
    </factors>
  </define-CCF-group>
</opsa-mef>"#;

        let ft = parse_fault_tree(xml).unwrap();
        assert_eq!(ft.ccf_groups().len(), 1);

        let ccf = ft.get_ccf_group("Pumps").unwrap();
        assert_eq!(ccf.members.len(), 3);

        match &ccf.model {
            CcfModel::AlphaFactor(alphas) => {
                assert_eq!(alphas.len(), 3);
                assert_eq!(alphas[0], 0.7);
                assert_eq!(alphas[1], 0.2);
                assert_eq!(alphas[2], 0.1);
            }
            _ => panic!("Expected AlphaFactor model"),
        }
    }

    #[test]
    fn test_parse_ccf_mgl() {
        let xml = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="MGLTest">
    <define-gate name="Top">
      <or>
        <basic-event name="Valve1"/>
        <basic-event name="Valve2"/>
        <basic-event name="Valve3"/>
      </or>
    </define-gate>
  </define-fault-tree>
  <define-CCF-group name="Valves" model="MGL">
    <members>
      <basic-event name="Valve1"/>
      <basic-event name="Valve2"/>
      <basic-event name="Valve3"/>
    </members>
    <distribution>
      <float value="0.1"/>
    </distribution>
    <factors>
      <factor level="1">
        <float value="0.05"/>
      </factor>
      <factor level="2">
        <float value="0.2"/>
      </factor>
      <factor level="3">
        <float value="0.1"/>
      </factor>
    </factors>
  </define-CCF-group>
</opsa-mef>"#;

        let ft = parse_fault_tree(xml).unwrap();
        assert_eq!(ft.ccf_groups().len(), 1);

        let ccf = ft.get_ccf_group("Valves").unwrap();
        assert_eq!(ccf.members.len(), 3);

        match &ccf.model {
            CcfModel::Mgl(factors) => {
                assert_eq!(factors.len(), 3);
                assert_eq!(factors[0], 0.05);
                assert_eq!(factors[1], 0.2);
                assert_eq!(factors[2], 0.1);
            }
            _ => panic!("Expected MGL model"),
        }
    }

    #[test]
    fn test_parse_ccf_multiple_groups() {
        let xml = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="MultiCCF">
    <define-gate name="Top">
      <and>
        <basic-event name="Pump1"/>
        <basic-event name="Valve1"/>
      </and>
    </define-gate>
  </define-fault-tree>
  <define-CCF-group name="Pumps" model="beta-factor">
    <members>
      <basic-event name="Pump1"/>
      <basic-event name="Pump2"/>
    </members>
    <distribution>
      <float value="0.1"/>
    </distribution>
    <factor level="2">
      <float value="0.2"/>
    </factor>
  </define-CCF-group>
  <define-CCF-group name="Valves" model="beta-factor">
    <members>
      <basic-event name="Valve1"/>
      <basic-event name="Valve2"/>
    </members>
    <distribution>
      <float value="0.05"/>
    </distribution>
    <factor level="2">
      <float value="0.15"/>
    </factor>
  </define-CCF-group>
</opsa-mef>"#;

        let ft = parse_fault_tree(xml).unwrap();
        assert_eq!(ft.ccf_groups().len(), 2);

        let pumps_ccf = ft.get_ccf_group("Pumps").unwrap();
        assert_eq!(pumps_ccf.members.len(), 2);

        let valves_ccf = ft.get_ccf_group("Valves").unwrap();
        assert_eq!(valves_ccf.members.len(), 2);
    }

    #[test]
    fn test_parse_ccf_from_beta_factor_xml() {
        // Test with actual beta_factor_ccf.xml structure
        let xml = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="BetaFactorCCF">
    <define-gate name="TopEvent">
      <and>
        <event name="TrainOne"/>
        <event name="TrainTwo"/>
        <event name="TrainThree"/>
      </and>
    </define-gate>
  </define-fault-tree>
  <define-CCF-group name="Pumps" model="beta-factor">
    <members>
      <basic-event name="PumpOne"/>
      <basic-event name="PumpTwo"/>
      <basic-event name="PumpThree"/>
    </members>
    <distribution>
      <float value="0.1"/>
    </distribution>
    <factor level="3">
      <float value="0.2"/>
    </factor>
  </define-CCF-group>
</opsa-mef>"#;

        let ft = parse_fault_tree(xml).unwrap();
        assert_eq!(ft.ccf_groups().len(), 1);

        let ccf = ft.get_ccf_group("Pumps").unwrap();
        assert_eq!(ccf.element().id(), "Pumps");
        assert_eq!(ccf.members.len(), 3);
        assert!(ccf.distribution.is_some());
    }

    #[test]
    fn test_parse_ccf_error_no_model() {
        // Missing model attribute should error
        let xml = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="Test">
    <define-gate name="Top">
      <or>
        <basic-event name="A"/>
      </or>
    </define-gate>
  </define-fault-tree>
  <define-CCF-group name="BadCCF">
    <members>
      <basic-event name="A"/>
      <basic-event name="B"/>
    </members>
  </define-CCF-group>
</opsa-mef>"#;

        let result = parse_fault_tree(xml);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_ccf_error_invalid_model() {
        let xml = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="Test">
    <define-gate name="Top">
      <or>
        <basic-event name="A"/>
      </or>
    </define-gate>
  </define-fault-tree>
  <define-CCF-group name="BadCCF" model="invalid-model">
    <members>
      <basic-event name="A"/>
      <basic-event name="B"/>
    </members>
    <distribution>
      <float value="0.1"/>
    </distribution>
    <factor level="2">
      <float value="0.2"/>
    </factor>
  </define-CCF-group>
</opsa-mef>"#;

        let result = parse_fault_tree(xml);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_ccf_error_no_members() {
        let xml = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="Test">
    <define-gate name="Top">
      <or>
        <basic-event name="A"/>
      </or>
    </define-gate>
  </define-fault-tree>
  <define-CCF-group name="BadCCF" model="beta-factor">
    <members>
    </members>
    <distribution>
      <float value="0.1"/>
    </distribution>
    <factor level="2">
      <float value="0.2"/>
    </factor>
  </define-CCF-group>
</opsa-mef>"#;

        let result = parse_fault_tree(xml);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_ccf_phi_factor() {
        let xml = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="PhiFactorTest">
    <define-gate name="Top">
      <or>
        <basic-event name="Component1"/>
        <basic-event name="Component2"/>
      </or>
    </define-gate>
  </define-fault-tree>
  <define-CCF-group name="Components" model="phi-factor">
    <members>
      <basic-event name="Component1"/>
      <basic-event name="Component2"/>
    </members>
    <distribution>
      <float value="0.1"/>
    </distribution>
    <factors>
      <factor level="1">
        <float value="0.5"/>
      </factor>
      <factor level="2">
        <float value="0.5"/>
      </factor>
    </factors>
  </define-CCF-group>
</opsa-mef>"#;

        let ft = parse_fault_tree(xml).unwrap();
        assert_eq!(ft.ccf_groups().len(), 1);

        let ccf = ft.get_ccf_group("Components").unwrap();
        assert_eq!(ccf.members.len(), 2);

        match &ccf.model {
            CcfModel::PhiFactor(phis) => {
                assert_eq!(phis.len(), 2);
                assert_eq!(phis[0], 0.5);
                assert_eq!(phis[1], 0.5);
            }
            _ => panic!("Expected PhiFactor model"),
        }
    }
}

/// Parse event tree model from XML
///
/// This is a simplified event tree parser that extracts:
/// - Model with fault trees
/// - Initiating events  
/// - Event trees with functional events and sequences
///
/// # Example XML structure
/// ```xml
/// <opsa-mef>
///   <define-fault-tree name="FT1">...</define-fault-tree>
///   <define-initiating-event name="IE1">
///     <float value="0.001"/>
///   </define-initiating-event>
///   <define-event-tree name="ET1">
///     <initial-state>
///       <sequence name="SEQ1"/>
///     </initial-state>
///   </define-event-tree>
/// </opsa-mef>
/// ```
pub fn parse_event_tree_model(xml: &str) -> Result<(Model, Vec<InitiatingEvent>, Vec<EventTree>)> {
    let parsed = crate::io::event_tree_parser::parse_event_tree_model_full(xml)?;
    Ok((parsed.model, parsed.initiating_events, parsed.event_trees))
}
