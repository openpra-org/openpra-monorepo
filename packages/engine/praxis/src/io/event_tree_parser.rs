//! Event-tree parsing.
//!
//! This module provides a MEF event-tree parser used when the input contains an event-tree model.
//! It is intentionally correctness-first and currently supports the subset needed by
//! `tests/fixtures/eta/EventTrees/linked_fault_trees_shared_be.xml`.

use std::collections::HashMap;
use std::io::BufRead;

use quick_xml::events::{BytesStart, Event};
use quick_xml::Reader;

use crate::core::event_tree::{
    Branch, BranchTarget, EventTree, Fork, FunctionalEvent, InitiatingEvent, NamedBranch, Path,
    Sequence,
};
use crate::core::fault_tree::FaultTree;
use crate::core::gate::Gate;
use crate::core::model::Model;
use crate::error::{MefError, Result};

use crate::io::parser::{parse_ccf_group, parse_element, parse_gate};

/// Parsed event-tree model: a `Model` plus initiating events and event trees.
#[derive(Debug)]
pub struct EventTreeModel {
    pub model: Model,
    pub initiating_events: Vec<InitiatingEvent>,
    pub event_trees: Vec<EventTree>,
}

#[derive(Debug, Default, Clone)]
struct Parameters {
    values: HashMap<String, f64>,
}

fn scan_parameters(xml: &str) -> Result<Parameters> {
    let mut reader = Reader::from_str(xml);
    reader.trim_text(true);

    let mut parameters = Parameters::default();

    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) if e.name().as_ref() == b"define-parameter" => {
                parse_parameter_from_reader(&mut reader, &e, &mut parameters)?;
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(MefError::Validity(format!("XML parse error: {e}")).into()),
            _ => {}
        }
        buf.clear();
    }

    Ok(parameters)
}

fn attr_value(start: &BytesStart, key: &[u8]) -> Result<Option<String>> {
    for attr in start.attributes() {
        let attr = attr.map_err(|e| MefError::Validity(format!("Invalid attribute: {e}")))?;
        if attr.key.as_ref() == key {
            let value = std::str::from_utf8(&attr.value)
                .map_err(|_| MefError::Validity("Invalid UTF-8 in attribute".to_string()))?;
            return Ok(Some(value.to_string()));
        }
    }
    Ok(None)
}

fn required_attr(start: &BytesStart, key: &[u8], ctx: &str) -> Result<String> {
    attr_value(start, key)?.ok_or_else(|| {
        MefError::Validity(format!(
            "Missing required attribute '{}' in {ctx}",
            String::from_utf8_lossy(key)
        ))
        .into()
    })
}

fn skip_to_end<R: BufRead>(reader: &mut Reader<R>, end_tag: &[u8]) -> Result<()> {
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::End(e)) if e.name().as_ref() == end_tag => return Ok(()),
            Ok(Event::Eof) => {
                return Err(MefError::Validity(format!(
                    "Unexpected EOF while skipping element '{}'",
                    String::from_utf8_lossy(end_tag)
                ))
                .into());
            }
            Err(e) => return Err(MefError::Validity(format!("XML parse error: {e}")).into()),
            _ => {}
        }
        buf.clear();
    }
}

fn parse_parameter_from_reader<R: BufRead>(
    reader: &mut Reader<R>,
    start: &BytesStart,
    parameters: &mut Parameters,
) -> Result<()> {
    let name = required_attr(start, b"name", "define-parameter")?;
    let mut value: Option<f64> = None;

    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Empty(e)) if e.name().as_ref() == b"float" => {
                if let Some(v) = attr_value(&e, b"value")? {
                    value = Some(v.parse::<f64>().map_err(|_| {
                        MefError::Validity(format!("Invalid parameter float value: {v}"))
                    })?);
                }
            }
            Ok(Event::Start(e)) if e.name().as_ref() == b"float" => {
                if let Some(v) = attr_value(&e, b"value")? {
                    value = Some(v.parse::<f64>().map_err(|_| {
                        MefError::Validity(format!("Invalid parameter float value: {v}"))
                    })?);
                }
                skip_to_end(reader, b"float")?;
            }
            Ok(Event::End(e)) if e.name().as_ref() == b"define-parameter" => break,
            Ok(Event::Eof) => {
                return Err(MefError::Validity(
                    "Unexpected EOF while parsing define-parameter".to_string(),
                )
                .into());
            }
            Err(e) => return Err(MefError::Validity(format!("XML parse error: {e}")).into()),
            _ => {}
        }
        buf.clear();
    }

    if let Some(v) = value {
        parameters.values.insert(name, v);
    }
    Ok(())
}

fn parse_expression_value<R: BufRead>(
    reader: &mut Reader<R>,
    start: &BytesStart,
    parameters: &Parameters,
) -> Result<f64> {
    match start.name().as_ref() {
        b"float" => {
            let value = required_attr(start, b"value", "float")?;
            skip_to_end(reader, b"float")?;
            value.parse::<f64>().map_err(|_| {
                MefError::Validity(format!(
                    "Invalid float value in collect-expression: {value}"
                ))
                .into()
            })
        }
        b"parameter" => {
            let name = required_attr(start, b"name", "parameter")?;
            skip_to_end(reader, b"parameter")?;
            parameters.values.get(&name).copied().ok_or_else(|| {
                MefError::Validity(format!(
                    "Unknown parameter '{name}' referenced in collect-expression"
                ))
                .into()
            })
        }
        b"sub" => {
            let mut args: Vec<f64> = Vec::new();
            let mut buf = Vec::new();
            loop {
                match reader.read_event_into(&mut buf) {
                    Ok(Event::Start(e)) => {
                        let v = parse_expression_value(reader, &e, parameters)?;
                        args.push(v);
                    }
                    Ok(Event::Empty(e)) => match e.name().as_ref() {
                        b"float" => {
                            let value = required_attr(&e, b"value", "float")?;
                            args.push(value.parse::<f64>().map_err(|_| {
                                MefError::Validity(format!(
                                    "Invalid float value in collect-expression: {value}"
                                ))
                            })?);
                        }
                        b"parameter" => {
                            let name = required_attr(&e, b"name", "parameter")?;
                            args.push(parameters.values.get(&name).copied().ok_or_else(|| {
                                MefError::Validity(format!(
                                    "Unknown parameter '{name}' referenced in collect-expression"
                                ))
                            })?);
                        }
                        _ => {}
                    },
                    Ok(Event::End(e)) if e.name().as_ref() == b"sub" => break,
                    Ok(Event::Eof) => {
                        return Err(MefError::Validity(
                            "Unexpected EOF while parsing <sub> expression".to_string(),
                        )
                        .into());
                    }
                    Err(e) => {
                        return Err(MefError::Validity(format!("XML parse error: {e}")).into())
                    }
                    _ => {}
                }
                buf.clear();
            }

            if args.len() != 2 {
                return Err(MefError::Validity(
                    "<sub> in collect-expression must have exactly two operands".to_string(),
                )
                .into());
            }
            Ok(args[0] - args[1])
        }
        other => {
            // Skip unknown expression nodes for now.
            skip_to_end(reader, other)?;
            Err(MefError::Validity(format!(
                "Unsupported expression '{}' in collect-expression",
                String::from_utf8_lossy(other)
            ))
            .into())
        }
    }
}

fn parse_collect_expression_probability<R: BufRead>(
    reader: &mut Reader<R>,
    parameters: &Parameters,
) -> Result<Option<f64>> {
    let mut probability: Option<f64> = None;
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                probability = Some(parse_expression_value(reader, &e, parameters)?);
            }
            Ok(Event::Empty(e)) => match e.name().as_ref() {
                b"float" => {
                    let value = required_attr(&e, b"value", "float")?;
                    probability = Some(value.parse::<f64>().map_err(|_| {
                        MefError::Validity(format!(
                            "Invalid float value in collect-expression: {value}"
                        ))
                    })?);
                }
                b"parameter" => {
                    let name = required_attr(&e, b"name", "parameter")?;
                    probability = Some(parameters.values.get(&name).copied().ok_or_else(|| {
                        MefError::Validity(format!(
                            "Unknown parameter '{name}' referenced in collect-expression"
                        ))
                    })?);
                }
                _ => {}
            },
            Ok(Event::End(e)) if e.name().as_ref() == b"collect-expression" => break,
            Ok(Event::Eof) => {
                return Err(MefError::Validity(
                    "Unexpected EOF while parsing collect-expression".to_string(),
                )
                .into());
            }
            Err(e) => return Err(MefError::Validity(format!("XML parse error: {e}")).into()),
            _ => {}
        }
        buf.clear();
    }

    Ok(probability)
}

fn parse_set_house_event_from_reader<R: BufRead>(
    reader: &mut Reader<R>,
    start: &BytesStart,
) -> Result<(String, bool)> {
    let name = required_attr(start, b"name", "set-house-event")?;
    let mut state: Option<bool> = None;

    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Empty(e)) if e.name().as_ref() == b"constant" => {
                let v = required_attr(&e, b"value", "constant")?;
                state = Some(match v.as_str() {
                    "true" => true,
                    "false" => false,
                    _ => {
                        return Err(MefError::Validity(format!(
                            "Invalid constant value '{v}' in set-house-event"
                        ))
                        .into());
                    }
                });
            }
            Ok(Event::Start(e)) if e.name().as_ref() == b"constant" => {
                let v = required_attr(&e, b"value", "constant")?;
                state = Some(match v.as_str() {
                    "true" => true,
                    "false" => false,
                    _ => {
                        return Err(MefError::Validity(format!(
                            "Invalid constant value '{v}' in set-house-event"
                        ))
                        .into());
                    }
                });
                skip_to_end(reader, b"constant")?;
            }
            Ok(Event::End(e)) if e.name().as_ref() == b"set-house-event" => break,
            Ok(Event::Eof) => {
                return Err(MefError::Validity(
                    "Unexpected EOF while parsing set-house-event".to_string(),
                )
                .into());
            }
            Err(e) => return Err(MefError::Validity(format!("XML parse error: {e}")).into()),
            _ => {}
        }
        buf.clear();
    }

    let state = state.ok_or_else(|| {
        MefError::Validity("set-house-event missing <constant value=...>".to_string())
    })?;
    Ok((name, state))
}

fn parse_fault_tree_from_reader<R: BufRead>(
    reader: &mut Reader<R>,
    start: &BytesStart,
) -> Result<FaultTree> {
    let ft_name = required_attr(start, b"name", "define-fault-tree")?;

    let mut top_gate: Option<String> = None;
    let mut gates = Vec::new();
    let mut basic_events = Vec::new();
    let mut ccf_groups = Vec::new();

    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => match e.name().as_ref() {
                b"define-gate" => {
                    let gate_name = required_attr(&e, b"name", "define-gate")?;
                    if top_gate.is_none() {
                        top_gate = Some(gate_name.clone());
                    }
                    let gate = parse_gate(reader, &gate_name)?;
                    gates.push(gate);
                }
                b"define-basic-event" => {
                    let event_name = required_attr(&e, b"name", "define-basic-event")?;
                    let event = parse_element(reader, &event_name)?;
                    basic_events.push(event);
                }
                b"define-CCF-group" => {
                    let ccf_name = required_attr(&e, b"name", "define-CCF-group")?;
                    if let Some(model_type) = attr_value(&e, b"model")? {
                        let ccf = parse_ccf_group(reader, &ccf_name, &model_type)?;
                        ccf_groups.push(ccf);
                    } else {
                        // Best-effort: if the model type is missing, skip the group content.
                        skip_to_end(reader, b"define-CCF-group")?;
                    }
                }
                _ => {}
            },
            Ok(Event::End(e)) if e.name().as_ref() == b"define-fault-tree" => break,
            Ok(Event::Eof) => {
                return Err(MefError::Validity(
                    "Unexpected EOF while parsing define-fault-tree".to_string(),
                )
                .into());
            }
            Err(e) => return Err(MefError::Validity(format!("XML parse error: {e}")).into()),
            _ => {}
        }
        buf.clear();
    }

    let top = top_gate.unwrap_or_else(|| "top".to_string());
    let mut ft = FaultTree::new(ft_name, top)?;
    for gate in gates {
        ft.add_gate(gate)?;
    }
    for be in basic_events {
        ft.add_basic_event(be)?;
    }
    for ccf in ccf_groups {
        ft.add_ccf_group(ccf)?;
    }
    Ok(ft)
}

fn parse_model_data<R: BufRead>(
    reader: &mut Reader<R>,
    model: &mut Model,
    parameters: &mut Parameters,
) -> Result<()> {
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => match e.name().as_ref() {
                b"define-basic-event" => {
                    let event_name = required_attr(&e, b"name", "define-basic-event")?;
                    let event = parse_basic_event_with_parameters(reader, &event_name, parameters)?;
                    model.add_basic_event(event)?;
                }
                b"define-parameter" => {
                    parse_parameter_from_reader(reader, &e, parameters)?;
                }
                _ => {}
            },
            Ok(Event::End(e)) if e.name().as_ref() == b"model-data" => break,
            Ok(Event::Eof) => {
                return Err(MefError::Validity(
                    "Unexpected EOF while parsing model-data".to_string(),
                )
                .into());
            }
            Err(e) => return Err(MefError::Validity(format!("XML parse error: {e}")).into()),
            _ => {}
        }
        buf.clear();
    }
    Ok(())
}

fn parse_basic_event_with_parameters<R: BufRead>(
    reader: &mut Reader<R>,
    name: &str,
    parameters: &Parameters,
) -> Result<crate::core::event::BasicEvent> {
    // Similar to `parse_element`, but additionally supports `<parameter name="..."/>`.
    let mut probability: Option<f64> = None;
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) | Ok(Event::Empty(e)) if e.name().as_ref() == b"float" => {
                if let Some(value) = attr_value(&e, b"value")? {
                    probability = Some(value.parse::<f64>().map_err(|_| {
                        MefError::Validity(format!(
                            "Invalid probability value '{}' for basic event {}",
                            value, name
                        ))
                    })?);
                }
            }
            Ok(Event::Empty(e)) if e.name().as_ref() == b"parameter" => {
                if let Some(param_name) = attr_value(&e, b"name")? {
                    let p = parameters.values.get(&param_name).copied().ok_or_else(|| {
                        MefError::Validity(format!(
                            "Unknown parameter '{}' for basic event {}",
                            param_name, name
                        ))
                    })?;
                    probability = Some(p);
                }
            }
            Ok(Event::Start(e)) if e.name().as_ref() == b"parameter" => {
                if let Some(param_name) = attr_value(&e, b"name")? {
                    let p = parameters.values.get(&param_name).copied().ok_or_else(|| {
                        MefError::Validity(format!(
                            "Unknown parameter '{}' for basic event {}",
                            param_name, name
                        ))
                    })?;
                    probability = Some(p);
                }
                // Best-effort: consume any content until </parameter>.
                skip_to_end(reader, b"parameter")?;
            }
            Ok(Event::End(e)) if e.name().as_ref() == b"define-basic-event" => break,
            Ok(Event::Eof) => {
                return Err(MefError::Validity(format!(
                    "Unexpected EOF while parsing basic event {}",
                    name
                ))
                .into());
            }
            Err(e) => {
                return Err(MefError::Validity(format!("XML parse error in {name}: {e}")).into())
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

    crate::core::event::BasicEvent::new(name.to_string(), prob)
}

fn parse_initiating_event_from_reader<R: BufRead>(
    reader: &mut Reader<R>,
    start: &BytesStart,
) -> Result<InitiatingEvent> {
    let id = required_attr(start, b"name", "define-initiating-event")?;
    let mut ie = InitiatingEvent::new(id);

    if let Some(et_id) = attr_value(start, b"event-tree")? {
        ie = ie.with_event_tree(et_id);
    }

    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Empty(e)) if e.name().as_ref() == b"float" => {
                if let Some(value) = attr_value(&e, b"value")? {
                    let prob = value.parse::<f64>().map_err(|_| {
                        MefError::Validity(format!("Invalid initiating-event frequency: {value}"))
                    })?;
                    ie = ie.with_frequency(prob);
                }
            }
            Ok(Event::Start(e)) if e.name().as_ref() == b"float" => {
                if let Some(value) = attr_value(&e, b"value")? {
                    let prob = value.parse::<f64>().map_err(|_| {
                        MefError::Validity(format!("Invalid initiating-event frequency: {value}"))
                    })?;
                    ie = ie.with_frequency(prob);
                }
                skip_to_end(reader, b"float")?;
            }
            Ok(Event::End(e)) if e.name().as_ref() == b"define-initiating-event" => break,
            Ok(Event::Eof) => {
                return Err(MefError::Validity(
                    "Unexpected EOF while parsing define-initiating-event".to_string(),
                )
                .into());
            }
            Err(e) => return Err(MefError::Validity(format!("XML parse error: {e}")).into()),
            _ => {}
        }
        buf.clear();
    }

    Ok(ie)
}

fn parse_initiating_event_empty(start: &BytesStart) -> Result<InitiatingEvent> {
    let id = required_attr(start, b"name", "define-initiating-event")?;
    let mut ie = InitiatingEvent::new(id);
    if let Some(et_id) = attr_value(start, b"event-tree")? {
        ie = ie.with_event_tree(et_id);
    }
    Ok(ie)
}

fn parse_collect_formula_for_ft_link<R: BufRead>(
    reader: &mut Reader<R>,
) -> Result<Option<(String, bool)>> {
    let mut found_ft: Option<String> = None;
    let mut found_negated: bool = false;
    let mut not_depth: usize = 0;

    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) if e.name().as_ref() == b"not" => {
                not_depth += 1;
            }
            Ok(Event::End(e)) if e.name().as_ref() == b"not" => {
                not_depth = not_depth.saturating_sub(1);
            }
            Ok(Event::Empty(e)) if e.name().as_ref() == b"gate" => {
                if let Some(name) = attr_value(&e, b"name")? {
                    if let Some((ft, _rest)) = name.split_once('.') {
                        found_ft = Some(ft.to_string());
                        found_negated = not_depth > 0;
                    }
                }
            }
            Ok(Event::Start(e)) if e.name().as_ref() == b"gate" => {
                if let Some(name) = attr_value(&e, b"name")? {
                    if let Some((ft, _rest)) = name.split_once('.') {
                        found_ft = Some(ft.to_string());
                        found_negated = not_depth > 0;
                    }
                }
                skip_to_end(reader, b"gate")?;
            }
            Ok(Event::End(e)) if e.name().as_ref() == b"collect-formula" => break,
            Ok(Event::Eof) => {
                return Err(MefError::Validity(
                    "Unexpected EOF while parsing collect-formula".to_string(),
                )
                .into());
            }
            Err(e) => return Err(MefError::Validity(format!("XML parse error: {e}")).into()),
            _ => {}
        }
        buf.clear();
    }

    Ok(found_ft.map(|ft| (ft, found_negated)))
}

fn parse_path_from_reader<R: BufRead>(
    reader: &mut Reader<R>,
    start: &BytesStart,
    fork_fe_id: &str,
    fe_links: &mut HashMap<String, String>,
    parameters: &Parameters,
) -> Result<Path> {
    let state = required_attr(start, b"state", "path")?;
    let mut target: Option<BranchTarget> = None;
    let mut path_probability: Option<f64> = None;
    let instructions: Vec<String> = Vec::new();
    let mut house_event_assignments: Vec<(String, bool)> = Vec::new();
    let mut collect_formula_negated: Option<bool> = None;

    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => match e.name().as_ref() {
                b"set-house-event" => {
                    let (id, state) = parse_set_house_event_from_reader(reader, &e)?;
                    house_event_assignments.push((id, state));
                }
                b"collect-formula" => {
                    if let Some((ft_id, negated)) = parse_collect_formula_for_ft_link(reader)? {
                        fe_links.entry(fork_fe_id.to_string()).or_insert(ft_id);
                        collect_formula_negated = Some(negated);
                    }
                }
                b"collect-expression" => {
                    path_probability = parse_collect_expression_probability(reader, parameters)?;
                }
                b"fork" => {
                    let fork = parse_fork(reader, &e, fe_links, parameters)?;
                    target = Some(BranchTarget::Fork(fork));
                }
                b"sequence" => {
                    let seq_id = required_attr(&e, b"name", "sequence")?;
                    skip_to_end(reader, b"sequence")?;
                    target = Some(BranchTarget::Sequence(seq_id));
                }
                b"branch" => {
                    let branch_id = required_attr(&e, b"name", "branch")?;
                    skip_to_end(reader, b"branch")?;
                    target = Some(BranchTarget::NamedBranch(branch_id));
                }
                _ => {}
            },
            Ok(Event::Empty(e)) => match e.name().as_ref() {
                b"sequence" => {
                    let seq_id = required_attr(&e, b"name", "sequence")?;
                    target = Some(BranchTarget::Sequence(seq_id));
                }
                b"branch" => {
                    let branch_id = required_attr(&e, b"name", "branch")?;
                    target = Some(BranchTarget::NamedBranch(branch_id));
                }
                b"float" => {
                    // Some fixtures use <collect-expression><float .../></collect-expression>,
                    // but a bare float is instruction-only; ignore.
                    let _ = attr_value(&e, b"value")?;
                }
                _ => {}
            },
            Ok(Event::End(e)) if e.name().as_ref() == b"path" => break,
            Ok(Event::Eof) => {
                return Err(
                    MefError::Validity("Unexpected EOF while parsing path".to_string()).into(),
                );
            }
            Err(e) => return Err(MefError::Validity(format!("XML parse error: {e}")).into()),
            _ => {}
        }
        buf.clear();
    }

    let target = target.ok_or_else(|| {
        MefError::Validity("Path missing terminal target (sequence/fork/branch)".to_string())
    })?;
    let mut branch = Branch::new(target).with_instructions(instructions);
    for (id, state) in house_event_assignments {
        branch = branch.with_house_event_assignment(id, state);
    }
    let path = Path::new(state, branch)?;
    let path = if let Some(negated) = collect_formula_negated {
        path.with_collect_formula_negated(negated)
    } else {
        path
    };

    Ok(if let Some(p) = path_probability {
        path.with_probability(p)
    } else {
        path
    })
}

fn parse_fork<R: BufRead>(
    reader: &mut Reader<R>,
    start: &BytesStart,
    fe_links: &mut HashMap<String, String>,
    parameters: &Parameters,
) -> Result<Fork> {
    let fe_id = required_attr(start, b"functional-event", "fork")?;
    let mut paths: Vec<Path> = Vec::new();

    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) if e.name().as_ref() == b"path" => {
                let path = parse_path_from_reader(reader, &e, &fe_id, fe_links, parameters)?;
                paths.push(path);
            }
            Ok(Event::End(e)) if e.name().as_ref() == b"fork" => break,
            Ok(Event::Eof) => {
                return Err(
                    MefError::Validity("Unexpected EOF while parsing fork".to_string()).into(),
                );
            }
            Err(e) => return Err(MefError::Validity(format!("XML parse error: {e}")).into()),
            _ => {}
        }
        buf.clear();
    }

    Fork::new(fe_id, paths)
}

fn parse_initial_state<R: BufRead>(
    reader: &mut Reader<R>,
    fe_links: &mut HashMap<String, String>,
    parameters: &Parameters,
) -> Result<Branch> {
    let mut initial_house_events: Vec<(String, bool)> = Vec::new();
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) if e.name().as_ref() == b"set-house-event" => {
                let (id, state) = parse_set_house_event_from_reader(reader, &e)?;
                initial_house_events.push((id, state));
            }
            Ok(Event::Start(e)) if e.name().as_ref() == b"collect-expression" => {
                // Instruction semantics are not wired yet; skip safely.
                skip_to_end(reader, b"collect-expression")?;
            }
            Ok(Event::Start(e)) if e.name().as_ref() == b"fork" => {
                let fork = parse_fork(reader, &e, fe_links, parameters)?;
                // parse_fork consumes its own end tag; we now continue until </initial-state>
                // but the initial-state semantics expect a single entry branch.
                skip_to_end(reader, b"initial-state")?;
                let mut branch = Branch::new(BranchTarget::Fork(fork));
                for (id, state) in initial_house_events {
                    branch = branch.with_house_event_assignment(id, state);
                }
                return Ok(branch);
            }
            Ok(Event::Empty(e)) if e.name().as_ref() == b"collect-expression" => {
                // Instruction semantics are not wired yet.
            }
            Ok(Event::Empty(e)) if e.name().as_ref() == b"sequence" => {
                let seq_id = required_attr(&e, b"name", "sequence")?;
                skip_to_end(reader, b"initial-state")?;
                let mut branch = Branch::new(BranchTarget::Sequence(seq_id));
                for (id, state) in initial_house_events {
                    branch = branch.with_house_event_assignment(id, state);
                }
                return Ok(branch);
            }
            Ok(Event::Start(e)) if e.name().as_ref() == b"sequence" => {
                let seq_id = required_attr(&e, b"name", "sequence")?;
                skip_to_end(reader, b"sequence")?;
                skip_to_end(reader, b"initial-state")?;
                let mut branch = Branch::new(BranchTarget::Sequence(seq_id));
                for (id, state) in initial_house_events {
                    branch = branch.with_house_event_assignment(id, state);
                }
                return Ok(branch);
            }
            Ok(Event::End(e)) if e.name().as_ref() == b"initial-state" => {
                return Err(
                    MefError::Validity("initial-state had no fork/sequence".to_string()).into(),
                );
            }
            Ok(Event::Eof) => {
                return Err(MefError::Validity(
                    "Unexpected EOF while parsing initial-state".to_string(),
                )
                .into());
            }
            Err(e) => return Err(MefError::Validity(format!("XML parse error: {e}")).into()),
            _ => {}
        }
        buf.clear();
    }
}

fn parse_named_branch_from_reader<R: BufRead>(
    reader: &mut Reader<R>,
    start: &BytesStart,
    fe_links: &mut HashMap<String, String>,
    parameters: &Parameters,
) -> Result<NamedBranch> {
    let id = required_attr(start, b"name", "define-branch")?;
    let mut branch_house_events: Vec<(String, bool)> = Vec::new();

    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) if e.name().as_ref() == b"set-house-event" => {
                let (hid, state) = parse_set_house_event_from_reader(reader, &e)?;
                branch_house_events.push((hid, state));
            }
            Ok(Event::Start(e)) if e.name().as_ref() == b"collect-expression" => {
                // Instruction semantics are not wired yet; skip safely.
                skip_to_end(reader, b"collect-expression")?;
            }
            Ok(Event::Start(e)) if e.name().as_ref() == b"fork" => {
                let fork = parse_fork(reader, &e, fe_links, parameters)?;
                skip_to_end(reader, b"define-branch")?;
                let mut branch = Branch::new(BranchTarget::Fork(fork));
                for (hid, state) in branch_house_events {
                    branch = branch.with_house_event_assignment(hid, state);
                }
                return Ok(NamedBranch::new(id, branch));
            }
            Ok(Event::Empty(e)) if e.name().as_ref() == b"collect-expression" => {
                // Instruction semantics are not wired yet.
            }
            Ok(Event::Empty(e)) if e.name().as_ref() == b"sequence" => {
                let seq_id = required_attr(&e, b"name", "sequence")?;
                skip_to_end(reader, b"define-branch")?;
                let mut branch = Branch::new(BranchTarget::Sequence(seq_id));
                for (hid, state) in branch_house_events {
                    branch = branch.with_house_event_assignment(hid, state);
                }
                return Ok(NamedBranch::new(id, branch));
            }
            Ok(Event::Empty(e)) if e.name().as_ref() == b"branch" => {
                let branch_id = required_attr(&e, b"name", "branch")?;
                skip_to_end(reader, b"define-branch")?;
                let mut branch = Branch::new(BranchTarget::NamedBranch(branch_id));
                for (hid, state) in branch_house_events {
                    branch = branch.with_house_event_assignment(hid, state);
                }
                return Ok(NamedBranch::new(id, branch));
            }
            Ok(Event::End(e)) if e.name().as_ref() == b"define-branch" => {
                return Err(MefError::Validity(
                    "define-branch missing fork/sequence/branch target".to_string(),
                )
                .into());
            }
            Ok(Event::Eof) => {
                return Err(MefError::Validity(
                    "Unexpected EOF while parsing define-branch".to_string(),
                )
                .into());
            }
            Err(e) => return Err(MefError::Validity(format!("XML parse error: {e}")).into()),
            _ => {}
        }
        buf.clear();
    }
}

fn parse_event_tree_from_reader<R: BufRead>(
    reader: &mut Reader<R>,
    start: &BytesStart,
    parameters: &Parameters,
) -> Result<EventTree> {
    let et_id = required_attr(start, b"name", "define-event-tree")?;

    let mut sequences: Vec<Sequence> = Vec::new();
    let mut functional_events: Vec<FunctionalEvent> = Vec::new();
    let mut named_branches: Vec<NamedBranch> = Vec::new();
    let mut initial_state: Option<Branch> = None;
    let mut fe_links: HashMap<String, String> = HashMap::new();

    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Empty(e)) => match e.name().as_ref() {
                b"define-functional-event" => {
                    let fe_id = required_attr(&e, b"name", "define-functional-event")?;
                    functional_events.push(FunctionalEvent::new(fe_id));
                }
                b"define-sequence" => {
                    let seq_id = required_attr(&e, b"name", "define-sequence")?;
                    sequences.push(Sequence::new(seq_id));
                }
                _ => {}
            },
            Ok(Event::Start(e)) => match e.name().as_ref() {
                b"define-functional-event" => {
                    let fe_id = required_attr(&e, b"name", "define-functional-event")?;
                    functional_events.push(FunctionalEvent::new(fe_id));
                    skip_to_end(reader, b"define-functional-event")?;
                }
                b"define-sequence" => {
                    let seq_id = required_attr(&e, b"name", "define-sequence")?;
                    let mut seq = Sequence::new(seq_id);

                    // Support `<define-sequence name="X"><event-tree name="ET"/></define-sequence>`.
                    let mut seq_buf = Vec::new();
                    loop {
                        match reader.read_event_into(&mut seq_buf) {
                            Ok(Event::Empty(ev)) if ev.name().as_ref() == b"event-tree" => {
                                let linked = required_attr(&ev, b"name", "event-tree")?;
                                seq = seq.with_linked_event_tree(linked.trim().to_string());
                            }
                            Ok(Event::Start(ev)) if ev.name().as_ref() == b"event-tree" => {
                                let linked = required_attr(&ev, b"name", "event-tree")?;
                                seq = seq.with_linked_event_tree(linked.trim().to_string());
                                skip_to_end(reader, b"event-tree")?;
                            }
                            Ok(Event::End(ev)) if ev.name().as_ref() == b"define-sequence" => break,
                            Ok(Event::Eof) => {
                                return Err(MefError::Validity(
                                    "Unexpected EOF while parsing define-sequence".to_string(),
                                )
                                .into());
                            }
                            Err(err) => {
                                return Err(
                                    MefError::Validity(format!("XML parse error: {err}")).into()
                                )
                            }
                            _ => {}
                        }
                        seq_buf.clear();
                    }

                    sequences.push(seq);
                }
                b"define-branch" => {
                    let nb = parse_named_branch_from_reader(reader, &e, &mut fe_links, parameters)?;
                    named_branches.push(nb);
                }
                b"initial-state" => {
                    initial_state = Some(parse_initial_state(reader, &mut fe_links, parameters)?);
                }
                _ => {}
            },
            Ok(Event::End(e)) if e.name().as_ref() == b"define-event-tree" => break,
            Ok(Event::Eof) => {
                return Err(MefError::Validity(
                    "Unexpected EOF while parsing define-event-tree".to_string(),
                )
                .into());
            }
            Err(e) => return Err(MefError::Validity(format!("XML parse error: {e}")).into()),
            _ => {}
        }
        buf.clear();
    }

    let initial_state = initial_state
        .ok_or_else(|| MefError::Validity(format!("Event tree '{et_id}' missing initial-state")))?;

    let mut et = EventTree::new(et_id, initial_state);
    for seq in sequences {
        et.add_sequence(seq)?;
    }
    for fe in functional_events {
        let fe = if let Some(ft_id) = fe_links.get(&fe.id) {
            fe.with_fault_tree(ft_id.clone())
        } else {
            fe
        };
        et.add_functional_event(fe)?;
    }

    for nb in named_branches {
        et.add_named_branch(nb)?;
    }

    Ok(et)
}

/// Full MEF event-tree parser.
///
/// Currently supports:
/// - `<define-fault-tree name="..."> ... </define-fault-tree>`
/// - `<model-data><define-basic-event .../></model-data>`
/// - `<define-initiating-event ...>` with `<float value="..."/>`
/// - `<define-event-tree ...>` with functional events, sequences, and `initial-state` forks/paths.
pub fn parse_event_tree_model_full(xml: &str) -> Result<EventTreeModel> {
    let mut model = Model::new("model".to_string())?;
    let mut initiating_events: Vec<InitiatingEvent> = Vec::new();
    let mut event_trees: Vec<EventTree> = Vec::new();
    let mut parameters = scan_parameters(xml)?;

    let mut reader = Reader::from_str(xml);
    reader.trim_text(true);

    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => match e.name().as_ref() {
                b"define-fault-tree" => {
                    let ft = parse_fault_tree_from_reader(&mut reader, &e)?;
                    model.add_fault_tree(ft)?;
                }
                b"model-data" => {
                    parse_model_data(&mut reader, &mut model, &mut parameters)?;
                }
                b"define-initiating-event" => {
                    let ie = parse_initiating_event_from_reader(&mut reader, &e)?;
                    initiating_events.push(ie);
                }
                b"define-event-tree" => {
                    let et = parse_event_tree_from_reader(&mut reader, &e, &parameters)?;
                    event_trees.push(et);
                }
                _ => {}
            },
            Ok(Event::Empty(e)) => {
                if e.name().as_ref() == b"define-initiating-event" {
                    let ie = parse_initiating_event_empty(&e)?;
                    initiating_events.push(ie);
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(MefError::Validity(format!("XML parse error: {e}")).into()),
            _ => {}
        }
        buf.clear();
    }

    // MVP compatibility: if basic events are defined in <model-data>, also copy them into each fault tree.
    if !model.basic_events().is_empty() && !model.fault_trees().is_empty() {
        let model_basic_events: Vec<_> = model.basic_events().values().cloned().collect();
        let ft_ids: Vec<_> = model.fault_trees().keys().cloned().collect();
        for ft_id in ft_ids {
            if let Some(ft) = model.get_fault_tree_mut(&ft_id) {
                for be in &model_basic_events {
                    if ft.get_basic_event(be.element().id()).is_none() {
                        // Ignore duplicates defensively.
                        let _ = ft.add_basic_event(be.clone());
                    }
                }
            }
        }
    }

    // MVP compatibility: allow fault trees to reference other fault-tree gates via qualified names
    // like `OtherFaultTree.G1` inside gate formulas. Since '.' is not allowed in element IDs, we
    // rewrite those operands to a safe local gate ID and inline/copy the referenced gate (and any
    // dependent gates) into the consumer fault tree.
    if model.fault_trees().len() > 1 {
        resolve_cross_fault_tree_gate_references(&mut model)?;
    }

    Ok(EventTreeModel {
        model,
        initiating_events,
        event_trees,
    })
}

fn ext_gate_local_id(src_ft_id: &str, src_gate_id: &str) -> String {
    // Must not contain '.' to satisfy Element::new() validation.
    format!("__ext__{src_ft_id}__{src_gate_id}")
}

fn resolve_cross_fault_tree_gate_references(model: &mut Model) -> Result<()> {
    let ft_snapshot: HashMap<String, FaultTree> = model
        .fault_trees()
        .iter()
        .map(|(id, ft)| (id.clone(), ft.clone()))
        .collect();

    let ft_ids: Vec<String> = model.fault_trees().keys().cloned().collect();
    for consumer_ft_id in ft_ids {
        // First rewrite operands in-place (FT.G1 -> __ext__FT__G1) and collect which gates we need to inline.
        let gate_ids: Vec<String> = model
            .get_fault_tree(&consumer_ft_id)
            .ok_or_else(|| {
                MefError::Validity(format!("Fault tree '{consumer_ft_id}' not found"))
            })?
            .gates()
            .keys()
            .cloned()
            .collect();

        let mut pending: Vec<(String, String)> = Vec::new();
        for gate_id in gate_ids {
            let Some(ft) = model.get_fault_tree_mut(&consumer_ft_id) else {
                continue;
            };
            let Some(gate) = ft.get_gate_mut(&gate_id) else {
                continue;
            };
            for op in gate.operands_mut().iter_mut() {
                let Some((src_ft_id, src_gate_id)) = op.split_once('.') else {
                    continue;
                };
                pending.push((src_ft_id.to_string(), src_gate_id.to_string()));
                *op = ext_gate_local_id(src_ft_id, src_gate_id);
            }
        }

        // Then inline/copy any referenced gates into the consumer FT under the safe IDs.
        let mut seen: std::collections::HashSet<(String, String)> =
            std::collections::HashSet::new();
        let mut passes = 0_usize;
        while let Some((src_ft_id, src_gate_id)) = pending.pop() {
            passes += 1;
            if passes > 4096 {
                return Err(MefError::Validity(format!(
                    "Exceeded gate-resolution steps while expanding fault tree '{consumer_ft_id}'"
                ))
                .into());
            }

            if !seen.insert((src_ft_id.clone(), src_gate_id.clone())) {
                continue;
            }

            let src_ft = ft_snapshot.get(&src_ft_id).ok_or_else(|| {
                MefError::Validity(format!(
                    "Fault tree '{src_ft_id}' not found while resolving cross-reference '{src_ft_id}.{src_gate_id}'"
                ))
            })?;

            // Some fixtures use `FaultTree.root` as an alias for the fault tree top event.
            let actual_src_gate_id = if src_gate_id == "root" {
                src_ft.top_event().to_string()
            } else {
                src_gate_id.clone()
            };

            let src_gate = src_ft.get_gate(&actual_src_gate_id).ok_or_else(|| {
                MefError::Validity(format!(
                    "Gate '{actual_src_gate_id}' not found in fault tree '{src_ft_id}' while resolving cross-reference '{src_ft_id}.{src_gate_id}'"
                ))
            })?;

            let local_id = ext_gate_local_id(&src_ft_id, &src_gate_id);

            // Already inlined?
            if model
                .get_fault_tree(&consumer_ft_id)
                .and_then(|ft| ft.get_gate(&local_id))
                .is_some()
            {
                continue;
            }

            let mut new_gate = Gate::new(local_id.clone(), src_gate.formula().clone())?;
            for op in src_gate.operands() {
                let mapped = if let Some((op_ft_id, op_gate_id)) = op.split_once('.') {
                    pending.push((op_ft_id.to_string(), op_gate_id.to_string()));
                    ext_gate_local_id(op_ft_id, op_gate_id)
                } else if src_ft.get_gate(op).is_some() {
                    pending.push((src_ft_id.clone(), op.clone()));
                    ext_gate_local_id(&src_ft_id, op)
                } else {
                    op.clone()
                };
                new_gate.add_operand(mapped);
            }

            model
                .get_fault_tree_mut(&consumer_ft_id)
                .ok_or_else(|| {
                    MefError::Validity(format!("Fault tree '{consumer_ft_id}' not found"))
                })?
                .add_gate(new_gate)?;
        }
    }

    Ok(())
}
