use quick_xml::events::{BytesStart, Event};
use quick_xml::name::QName;
use quick_xml::Reader;
use std::collections::HashMap;
use std::io::BufRead;

use crate::core::ccf::{CcfGroup, CcfModel, TestingScheme};
use crate::core::event::BasicEvent;
use crate::core::event_tree::{EventTree, InitiatingEvent};
use crate::core::fault_tree::FaultTree;
use crate::core::gate::{Formula, Gate};
use crate::core::model::Model;
use crate::error::{MefError, Result};
use crate::expression::expr::{inverse_normal_cdf, LOGNORMAL_EF_QUANTILE};
use crate::expression::{EvalContext, Expr};

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
    let value = parse_named_expression(reader, "define-basic-event")?;
    let empty = HashMap::new();
    let ctx = EvalContext::constant(&empty, 1.0);
    let nominal = value.evaluate(&ctx)?;
    build_basic_event(name, nominal, value)
}

fn build_basic_event(name: &str, nominal: f64, value: Expr) -> Result<BasicEvent> {
    let clamped = nominal.clamp(0.0, 1.0);
    if matches!(value, Expr::Constant(_)) {
        BasicEvent::new(name.to_string(), clamped)
    } else {
        BasicEvent::with_value(name.to_string(), clamped, value)
    }
}

fn qname_string(name: QName) -> Result<String> {
    Ok(std::str::from_utf8(name.as_ref())
        .map_err(|_| MefError::Validity("invalid UTF-8 in element name".to_string()))?
        .to_string())
}

fn owned_attrs(element: &BytesStart) -> Result<Vec<(String, String)>> {
    let mut out = Vec::new();
    for attr in element.attributes() {
        let attr = attr.map_err(|err| MefError::Validity(format!("invalid attribute: {}", err)))?;
        let key = std::str::from_utf8(attr.key.as_ref())
            .map_err(|_| MefError::Validity("invalid UTF-8 in attribute name".to_string()))?
            .to_string();
        let value = std::str::from_utf8(&attr.value)
            .map_err(|_| MefError::Validity("invalid UTF-8 in attribute value".to_string()))?
            .to_string();
        out.push((key, value));
    }
    Ok(out)
}

fn find_attr<'a>(attrs: &'a [(String, String)], key: &str) -> Option<&'a str> {
    attrs
        .iter()
        .find(|(k, _)| k == key)
        .map(|(_, v)| v.as_str())
}

fn attr_f64(attrs: &[(String, String)], key: &str, element: &str) -> Result<f64> {
    let raw = find_attr(attrs, key).ok_or_else(|| {
        MefError::Validity(format!("<{}> is missing the '{}' attribute", element, key))
    })?;
    raw.parse::<f64>().map_err(|_| {
        MefError::Validity(format!(
            "<{}> has an invalid {} value '{}'",
            element, key, raw
        ))
        .into()
    })
}

fn attr_str<'a>(attrs: &'a [(String, String)], key: &str, element: &str) -> Result<&'a str> {
    find_attr(attrs, key).ok_or_else(|| {
        MefError::Validity(format!("<{}> is missing the '{}' attribute", element, key)).into()
    })
}

fn take_one(mut children: Vec<Expr>, element: &str) -> Result<Box<Expr>> {
    if children.len() != 1 {
        return Err(
            MefError::Validity(format!("<{}> requires exactly one argument", element)).into(),
        );
    }
    Ok(Box::new(children.pop().unwrap()))
}

fn take_two(mut children: Vec<Expr>, element: &str) -> Result<(Box<Expr>, Box<Expr>)> {
    if children.len() != 2 {
        return Err(
            MefError::Validity(format!("<{}> requires exactly two arguments", element)).into(),
        );
    }
    let second = Box::new(children.pop().unwrap());
    let first = Box::new(children.pop().unwrap());
    Ok((first, second))
}

fn take_three(mut children: Vec<Expr>, element: &str) -> Result<(Box<Expr>, Box<Expr>, Box<Expr>)> {
    if children.len() != 3 {
        return Err(
            MefError::Validity(format!("<{}> requires exactly three arguments", element)).into(),
        );
    }
    let third = Box::new(children.pop().unwrap());
    let second = Box::new(children.pop().unwrap());
    let first = Box::new(children.pop().unwrap());
    Ok((first, second, third))
}

type FourArguments = (Box<Expr>, Box<Expr>, Box<Expr>, Box<Expr>);

fn take_four(mut children: Vec<Expr>, element: &str) -> Result<FourArguments> {
    if children.len() != 4 {
        return Err(
            MefError::Validity(format!("<{}> requires exactly four arguments", element)).into(),
        );
    }
    let fourth = Box::new(children.pop().unwrap());
    let third = Box::new(children.pop().unwrap());
    let second = Box::new(children.pop().unwrap());
    let first = Box::new(children.pop().unwrap());
    Ok((first, second, third, fourth))
}

fn require_nonempty(children: Vec<Expr>, element: &str) -> Result<Vec<Expr>> {
    if children.is_empty() {
        return Err(
            MefError::Validity(format!("<{}> requires at least one argument", element)).into(),
        );
    }
    Ok(children)
}

fn make_expr(name: &str, attrs: &[(String, String)], children: Vec<Expr>) -> Result<Expr> {
    match name {
        "float" | "int" => Ok(Expr::Constant(attr_f64(attrs, "value", name)?)),
        "bool" => {
            let raw = attr_str(attrs, "value", name)?;
            let truth = matches!(raw, "true" | "1");
            Ok(Expr::Constant(if truth { 1.0 } else { 0.0 }))
        }
        "parameter" => Ok(Expr::Parameter(attr_str(attrs, "name", name)?.to_string())),
        "system-mission-time" => Ok(Expr::MissionTime),
        "pi" => Ok(Expr::Pi),
        "raw-data" => rawdata_leaf(attrs),

        "add" => Ok(Expr::Add(require_nonempty(children, name)?)),
        "sub" => Ok(Expr::Sub(require_nonempty(children, name)?)),
        "mul" => Ok(Expr::Mul(require_nonempty(children, name)?)),
        "div" => Ok(Expr::Div(require_nonempty(children, name)?)),
        "min" => Ok(Expr::Min(require_nonempty(children, name)?)),
        "max" => Ok(Expr::Max(require_nonempty(children, name)?)),
        "mean" => Ok(Expr::Mean(require_nonempty(children, name)?)),
        "pow" => {
            let (a, b) = take_two(children, name)?;
            Ok(Expr::Pow(a, b))
        }
        "mod" => {
            let (a, b) = take_two(children, name)?;
            Ok(Expr::Mod(a, b))
        }

        "neg" => Ok(Expr::Neg(take_one(children, name)?)),
        "abs" => Ok(Expr::Abs(take_one(children, name)?)),
        "sqrt" => Ok(Expr::Sqrt(take_one(children, name)?)),
        "exp" => Ok(Expr::Exp(take_one(children, name)?)),
        "ln" => Ok(Expr::Ln(take_one(children, name)?)),
        "log10" => Ok(Expr::Log10(take_one(children, name)?)),
        "sin" => Ok(Expr::Sin(take_one(children, name)?)),
        "cos" => Ok(Expr::Cos(take_one(children, name)?)),
        "tan" => Ok(Expr::Tan(take_one(children, name)?)),
        "asin" => Ok(Expr::Asin(take_one(children, name)?)),
        "acos" => Ok(Expr::Acos(take_one(children, name)?)),
        "atan" => Ok(Expr::Atan(take_one(children, name)?)),
        "sinh" => Ok(Expr::Sinh(take_one(children, name)?)),
        "cosh" => Ok(Expr::Cosh(take_one(children, name)?)),
        "tanh" => Ok(Expr::Tanh(take_one(children, name)?)),
        "floor" => Ok(Expr::Floor(take_one(children, name)?)),
        "ceil" => Ok(Expr::Ceil(take_one(children, name)?)),

        "and" => Ok(Expr::And(require_nonempty(children, name)?)),
        "or" => Ok(Expr::Or(require_nonempty(children, name)?)),
        "not" => Ok(Expr::Not(take_one(children, name)?)),
        "eq" => {
            let (a, b) = take_two(children, name)?;
            Ok(Expr::Eq(a, b))
        }
        "ne" | "neq" => {
            let (a, b) = take_two(children, name)?;
            Ok(Expr::Ne(a, b))
        }
        "lt" => {
            let (a, b) = take_two(children, name)?;
            Ok(Expr::Lt(a, b))
        }
        "gt" => {
            let (a, b) = take_two(children, name)?;
            Ok(Expr::Gt(a, b))
        }
        "le" | "leq" => {
            let (a, b) = take_two(children, name)?;
            Ok(Expr::Le(a, b))
        }
        "ge" | "geq" => {
            let (a, b) = take_two(children, name)?;
            Ok(Expr::Ge(a, b))
        }
        "ite" | "if" => {
            let (a, b, c) = take_three(children, name)?;
            Ok(Expr::Ite(a, b, c))
        }

        "exponential" => {
            let (lambda, time) = take_two(children, name)?;
            Ok(Expr::Exponential { lambda, time })
        }
        "GLM" | "glm" => {
            let (gamma, lambda, mu, time) = take_four(children, name)?;
            Ok(Expr::Glm {
                gamma,
                lambda,
                mu,
                time,
            })
        }
        "Weibull" | "weibull" => {
            let (scale, shape, t0, time) = take_four(children, name)?;
            Ok(Expr::Weibull {
                scale,
                shape,
                t0,
                time,
            })
        }

        "uniform-deviate" => {
            let (lower, upper) = take_two(children, name)?;
            Ok(Expr::UniformDeviate { lower, upper })
        }
        "normal-deviate" => {
            let (mean, sigma) = take_two(children, name)?;
            Ok(Expr::NormalDeviate { mean, sigma })
        }
        "lognormal-deviate" => lognormal_deviate_expr(children),
        "gamma-deviate" => {
            let (shape, rate) = take_two(children, name)?;
            Ok(Expr::GammaDeviate { shape, rate })
        }
        "beta-deviate" => {
            let (alpha, beta) = take_two(children, name)?;
            Ok(Expr::BetaDeviate { alpha, beta })
        }
        "triangular-deviate" => {
            let (lower, mode, upper) = take_three(children, name)?;
            Ok(Expr::TriangularDeviate { lower, mode, upper })
        }

        "histogram" => Err(MefError::Validity(
            "<histogram> in XML is not yet supported; supply it through the Boolean contract expression form".to_string(),
        )
        .into()),

        other => Err(
            MefError::Validity(format!("unsupported expression element <{}>", other)).into(),
        ),
    }
}

fn lognormal_deviate_expr(children: Vec<Expr>) -> Result<Expr> {
    if children.len() != 2 && children.len() != 3 {
        return Err(MefError::Validity(
            "<lognormal-deviate> requires (mean, error-factor) or (mean, error-factor, level)"
                .to_string(),
        )
        .into());
    }
    let level = if children.len() == 3 {
        let empty = HashMap::new();
        let ctx = EvalContext::constant(&empty, 1.0);
        children[2].evaluate(&ctx)?
    } else {
        0.95
    };
    let z = if (level - 0.95).abs() < 1e-12 {
        LOGNORMAL_EF_QUANTILE
    } else {
        inverse_normal_cdf(level)
    };
    let mean = children[0].clone();
    let error_factor = children[1].clone();
    let sigma = Expr::Div(vec![Expr::Ln(Box::new(error_factor)), Expr::Constant(z)]);
    let mu = Expr::Sub(vec![
        Expr::Ln(Box::new(mean)),
        Expr::Div(vec![
            Expr::Mul(vec![sigma.clone(), sigma.clone()]),
            Expr::Constant(2.0),
        ]),
    ]);
    Ok(Expr::LognormalDeviate {
        mu: Box::new(mu),
        sigma: Box::new(sigma),
    })
}

fn rawdata_leaf(attrs: &[(String, String)]) -> Result<Expr> {
    let failures = attr_f64(attrs, "failures", "raw-data")?;
    let prior = match find_attr(attrs, "prior") {
        Some("uniform") => 1.0,
        Some("jeffreys") | None => 0.5,
        Some(other) => {
            return Err(MefError::Validity(format!("unknown raw-data prior '{}'", other)).into())
        }
    };
    if let Some(raw) = find_attr(attrs, "demands") {
        let demands = raw.parse::<f64>().map_err(|_| {
            MefError::Validity(format!("raw-data has an invalid demands value '{}'", raw))
        })?;
        if failures > demands {
            return Err(
                MefError::Validity("raw-data: failures cannot exceed demands".to_string()).into(),
            );
        }
        Ok(Expr::beta(failures + prior, demands - failures + prior))
    } else if let Some(raw) = find_attr(attrs, "hours") {
        let hours = raw.parse::<f64>().map_err(|_| {
            MefError::Validity(format!("raw-data has an invalid hours value '{}'", raw))
        })?;
        if hours <= 0.0 {
            return Err(MefError::Validity(
                "raw-data: exposure hours must be positive".to_string(),
            )
            .into());
        }
        Ok(Expr::gamma(failures + prior, hours))
    } else {
        Err(MefError::Validity("raw-data requires either 'demands' or 'hours'".to_string()).into())
    }
}

fn is_metadata(name: &str) -> bool {
    matches!(name, "label" | "attributes" | "attribute")
}

fn skip_subtree<R: BufRead>(reader: &mut Reader<R>, tag: &str) -> Result<()> {
    let mut depth = 1usize;
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                if qname_string(e.name())? == tag {
                    depth += 1;
                }
            }
            Ok(Event::End(e)) => {
                if qname_string(e.name())? == tag {
                    depth -= 1;
                    if depth == 0 {
                        break;
                    }
                }
            }
            Ok(Event::Eof) => {
                return Err(
                    MefError::Validity(format!("unexpected EOF while skipping <{}>", tag)).into(),
                );
            }
            Err(e) => {
                return Err(MefError::Validity(format!(
                    "XML parse error while skipping <{}>: {}",
                    tag, e
                ))
                .into());
            }
            _ => {}
        }
        buf.clear();
    }
    Ok(())
}

fn read_expr_children<R: BufRead>(reader: &mut Reader<R>, parent: &str) -> Result<Vec<Expr>> {
    let mut children = Vec::new();
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Empty(e)) => {
                let name = qname_string(e.name())?;
                let attrs = owned_attrs(&e)?;
                children.push(make_expr(&name, &attrs, Vec::new())?);
            }
            Ok(Event::Start(e)) => {
                let name = qname_string(e.name())?;
                let attrs = owned_attrs(&e)?;
                let nested = read_expr_children(reader, &name)?;
                children.push(make_expr(&name, &attrs, nested)?);
            }
            Ok(Event::End(e)) => {
                if qname_string(e.name())? == parent {
                    break;
                }
            }
            Ok(Event::Eof) => {
                return Err(MefError::Validity(format!(
                    "unexpected EOF inside expression <{}>",
                    parent
                ))
                .into());
            }
            Err(e) => {
                return Err(MefError::Validity(format!(
                    "XML parse error in expression <{}>: {}",
                    parent, e
                ))
                .into());
            }
            _ => {}
        }
        buf.clear();
    }
    Ok(children)
}

fn parse_named_expression<R: BufRead>(reader: &mut Reader<R>, closing: &str) -> Result<Expr> {
    let mut value: Option<Expr> = None;
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Empty(e)) => {
                let name = qname_string(e.name())?;
                if !is_metadata(&name) && value.is_none() {
                    let attrs = owned_attrs(&e)?;
                    value = Some(make_expr(&name, &attrs, Vec::new())?);
                }
            }
            Ok(Event::Start(e)) => {
                let name = qname_string(e.name())?;
                if is_metadata(&name) {
                    skip_subtree(reader, &name)?;
                } else if value.is_none() {
                    let attrs = owned_attrs(&e)?;
                    let nested = read_expr_children(reader, &name)?;
                    value = Some(make_expr(&name, &attrs, nested)?);
                } else {
                    skip_subtree(reader, &name)?;
                }
            }
            Ok(Event::End(e)) => {
                if qname_string(e.name())? == closing {
                    break;
                }
            }
            Ok(Event::Eof) => {
                return Err(MefError::Validity(format!(
                    "unexpected EOF while parsing <{}>",
                    closing
                ))
                .into());
            }
            Err(e) => {
                return Err(
                    MefError::Validity(format!("XML parse error in <{}>: {}", closing, e)).into(),
                );
            }
            _ => {}
        }
        buf.clear();
    }
    value.ok_or_else(|| {
        MefError::Validity(format!("<{}> does not contain a value expression", closing)).into()
    })
}

fn formula_from_tag(tag: &[u8], e: &BytesStart, gate: &str) -> Result<Option<Formula>> {
    let formula = match tag {
        b"and" => Formula::And,
        b"or" => Formula::Or,
        b"not" => Formula::Not,
        b"xor" => Formula::Xor,
        b"nand" => Formula::Nand,
        b"nor" => Formula::Nor,
        b"iff" => Formula::Iff,
        b"atleast" => {
            let mut min = 1;
            for attr in e.attributes() {
                let attr = attr.map_err(|err| {
                    MefError::Validity(format!("Invalid attribute in gate {}: {}", gate, err))
                })?;
                if attr.key.as_ref() == b"min" {
                    let min_str = std::str::from_utf8(&attr.value).map_err(|_| {
                        MefError::Validity(format!(
                            "Invalid UTF-8 in min attribute for gate {}",
                            gate
                        ))
                    })?;
                    min = min_str.parse::<usize>().map_err(|_| {
                        MefError::Validity(format!(
                            "Invalid min value '{}' for gate {}",
                            min_str, gate
                        ))
                    })?;
                }
            }
            Formula::AtLeast { min }
        }
        _ => return Ok(None),
    };
    Ok(Some(formula))
}

fn operand_name(e: &BytesStart) -> Result<Option<String>> {
    match e.name().as_ref() {
        b"basic-event" | b"gate" | b"house-event" => {
            for attr in e.attributes() {
                let attr =
                    attr.map_err(|err| MefError::Validity(format!("Invalid attribute: {}", err)))?;
                if attr.key.as_ref() == b"name" {
                    let name = std::str::from_utf8(&attr.value).map_err(|_| {
                        MefError::Validity("Invalid UTF-8 in name attribute".to_string())
                    })?;
                    return Ok(Some(name.to_string()));
                }
            }
            Ok(None)
        }
        _ => Ok(None),
    }
}

fn skip_to_end<R: BufRead>(reader: &mut Reader<R>, target: Vec<u8>) -> Result<()> {
    let mut depth = 1;
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) if e.name().as_ref() == target.as_slice() => depth += 1,
            Ok(Event::End(e)) if e.name().as_ref() == target.as_slice() => {
                depth -= 1;
                if depth == 0 {
                    return Ok(());
                }
            }
            Ok(Event::Eof) => {
                return Err(MefError::Validity(
                    "Unexpected EOF while skipping element".to_string(),
                )
                .into());
            }
            Err(e) => {
                return Err(MefError::Validity(format!("XML parse error: {}", e)).into());
            }
            _ => {}
        }
        buf.clear();
    }
}

fn read_formula<R: BufRead>(
    reader: &mut Reader<R>,
    gate_name: String,
    formula: Formula,
    prefix: &str,
    counter: &mut usize,
    synthetic: &mut Vec<Gate>,
) -> Result<Gate> {
    let mut gate = Gate::new(gate_name.clone(), formula)?;
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                if let Some(child_formula) = formula_from_tag(e.name().as_ref(), &e, &gate_name)? {
                    let child_name = format!("__{}_aut{}", prefix, *counter);
                    *counter += 1;
                    let child = read_formula(
                        reader,
                        child_name.clone(),
                        child_formula,
                        prefix,
                        counter,
                        synthetic,
                    )?;
                    synthetic.push(child);
                    gate.add_operand(child_name);
                } else {
                    let target = e.name().as_ref().to_vec();
                    skip_to_end(reader, target)?;
                }
            }
            Ok(Event::Empty(e)) => {
                if let Some(name) = operand_name(&e)? {
                    gate.add_operand(name);
                }
            }
            Ok(Event::End(_)) => break,
            Ok(Event::Eof) => {
                return Err(MefError::Validity(format!(
                    "Unexpected EOF while parsing gate {}",
                    gate_name
                ))
                .into());
            }
            Err(e) => {
                return Err(MefError::Validity(format!(
                    "XML parse error in gate {}: {}",
                    gate_name, e
                ))
                .into());
            }
            _ => {}
        }
        buf.clear();
    }
    Ok(gate)
}

pub fn parse_gate<R: BufRead>(reader: &mut Reader<R>, name: &str) -> Result<Vec<Gate>> {
    let mut buf = Vec::new();
    let mut synthetic: Vec<Gate> = Vec::new();
    let mut counter = 0usize;
    let mut main = None;
    let mut passthrough: Vec<String> = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                if let Some(formula) = formula_from_tag(e.name().as_ref(), &e, name)? {
                    let gate = read_formula(
                        reader,
                        name.to_string(),
                        formula,
                        name,
                        &mut counter,
                        &mut synthetic,
                    )?;
                    main = Some(gate);
                } else if let Some(operand) = operand_name(&e)? {
                    passthrough.push(operand);
                    let target = e.name().as_ref().to_vec();
                    skip_to_end(reader, target)?;
                } else {
                    let target = e.name().as_ref().to_vec();
                    skip_to_end(reader, target)?;
                }
            }
            Ok(Event::Empty(e)) => {
                if let Some(operand) = operand_name(&e)? {
                    passthrough.push(operand);
                }
            }
            Ok(Event::End(e)) => {
                if e.name().as_ref() == b"define-gate" {
                    break;
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

    let main = match main {
        Some(gate) => gate,
        None if !passthrough.is_empty() => {
            let mut gate = Gate::new(name.to_string(), Formula::Or)?;
            for operand in passthrough {
                gate.add_operand(operand);
            }
            gate
        }
        None => {
            return Err(MefError::Validity(format!(
                "Missing gate formula for gate {}",
                name
            ))
            .into())
        }
    };
    let mut out = Vec::with_capacity(1 + synthetic.len());
    out.push(main);
    out.append(&mut synthetic);
    Ok(out)
}

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

                                if distribution_value.is_none() && factors.is_empty() {
                                    distribution_value = Some(value);
                                } else {
                                    factors.push(value);
                                }
                            }
                        }
                    }
                    b"factor" => {}
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

    if members.is_empty() {
        return Err(MefError::Validity(format!(
            "CCF group {} must have at least one member",
            name
        ))
        .into());
    }

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
            CcfModel::AlphaFactor {
                factors,
                scheme: TestingScheme::NonStaggered,
            }
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

    let mut ccf_group = CcfGroup::new(name, members, model)?;

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
    let mut basic_event_values: Vec<(String, Expr)> = Vec::new();
    let mut parameters: Vec<(String, Expr)> = Vec::new();
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
                            let parsed = parse_gate(&mut reader, &name)?;
                            gates.extend(parsed);
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
                            let value = parse_named_expression(&mut reader, "define-basic-event")?;
                            basic_event_values.push((name, value));
                        }
                    }
                    b"define-parameter" => {
                        let mut parameter_name = None;
                        for attr in e.attributes() {
                            let attr = attr.map_err(|e| {
                                MefError::Validity(format!("Invalid attribute: {}", e))
                            })?;

                            if attr.key.as_ref() == b"name" {
                                parameter_name = Some(
                                    std::str::from_utf8(&attr.value)
                                        .map_err(|_| {
                                            MefError::Validity(
                                                "Invalid UTF-8 in parameter name".to_string(),
                                            )
                                        })?
                                        .to_string(),
                                );
                            }
                        }

                        let name = parameter_name.ok_or_else(|| {
                            MefError::Validity(
                                "define-parameter must have a 'name' attribute".to_string(),
                            )
                        })?;
                        let value = parse_named_expression(&mut reader, "define-parameter")?;
                        parameters.push((name, value));
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

    let mut parameter_map = HashMap::new();
    for (name, value) in &parameters {
        parameter_map.insert(name.clone(), value.clone());
    }

    let mission_time = ft.mission_time();
    let mut built_events = Vec::with_capacity(basic_event_values.len());
    {
        let ctx = EvalContext::constant(&parameter_map, mission_time);
        for (name, value) in basic_event_values {
            let nominal = value.evaluate(&ctx)?;
            built_events.push(build_basic_event(&name, nominal, value)?);
        }
    }

    for (name, value) in parameters {
        ft.set_parameter(name, value);
    }

    for event in built_events {
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

    #[test]
    fn test_parse_gate_and() {
        let xml = r#"<define-gate name="G1"><and><basic-event name="E1"/><basic-event name="E2"/></and></define-gate>"#;
        let mut reader = Reader::from_str(xml);
        reader.trim_text(true);

        loop {
            match reader.read_event() {
                Ok(Event::Start(e)) if e.name().as_ref() == b"define-gate" => {
                    let gates = parse_gate(&mut reader, "G1").unwrap();
                    let gate = &gates[0];
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
    fn test_parse_gate_pass_through() {
        let xml = r#"<define-gate name="r1"><gate name="g1"/></define-gate>"#;
        let mut reader = Reader::from_str(xml);
        reader.trim_text(true);

        loop {
            match reader.read_event() {
                Ok(Event::Start(e)) if e.name().as_ref() == b"define-gate" => {
                    let gates = parse_gate(&mut reader, "r1").unwrap();
                    let gate = &gates[0];
                    assert!(matches!(gate.formula(), Formula::Or));
                    assert_eq!(gate.operands().len(), 1);
                    assert_eq!(gate.operands()[0], "g1");
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
                    let gates = parse_gate(&mut reader, "G2").unwrap();
                    let gate = &gates[0];
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
                    let gates = parse_gate(&mut reader, "G3").unwrap();
                    let gate = &gates[0];
                    assert!(matches!(gate.formula(), Formula::Not));
                    assert_eq!(gate.operands().len(), 1);
                    break;
                }
                Ok(Event::Eof) => panic!("Unexpected EOF"),
                _ => {}
            }
        }
    }

    #[test]
    fn test_parse_gate_inline_not_preserves_sibling_and_sign() {
        let xml = r#"<define-gate name="g"><and><not><basic-event name="a"/></not><basic-event name="b"/></and></define-gate>"#;
        let mut reader = Reader::from_str(xml);
        reader.trim_text(true);

        loop {
            match reader.read_event() {
                Ok(Event::Start(e)) if e.name().as_ref() == b"define-gate" => {
                    let gates = parse_gate(&mut reader, "g").unwrap();
                    assert_eq!(gates.len(), 2);
                    let main = &gates[0];
                    assert!(matches!(main.formula(), Formula::And));
                    assert_eq!(main.operands().len(), 2);
                    assert!(main.operands().iter().any(|o| o.as_str() == "b"));
                    let synth_ref = main
                        .operands()
                        .iter()
                        .find(|o| o.as_str() != "b")
                        .expect("synthetic operand for inline not");
                    assert!(synth_ref.starts_with("__g_aut"));
                    let synth = gates
                        .iter()
                        .find(|g| g.element().id() == synth_ref.as_str())
                        .expect("synthetic gate registered");
                    assert!(matches!(synth.formula(), Formula::Not));
                    assert_eq!(synth.operands(), &["a".to_string()]);
                    break;
                }
                Ok(Event::Eof) => panic!("Unexpected EOF"),
                _ => {}
            }
        }
    }

    #[test]
    fn test_parse_fault_tree_inline_not_is_not_constant_true() {
        let xml = r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="inline">
    <define-gate name="top">
      <and>
        <not><basic-event name="a"/></not>
        <basic-event name="b"/>
      </and>
    </define-gate>
    <define-basic-event name="a"><float value="0.1"/></define-basic-event>
    <define-basic-event name="b"><float value="0.1"/></define-basic-event>
  </define-fault-tree>
</opsa-mef>"#;

        let ft = parse_fault_tree(xml).unwrap();
        assert_eq!(ft.top_event(), "top");
        let pdag = crate::algorithms::pdag::Pdag::from_fault_tree(&ft).unwrap();
        let events = crate::algorithms::ordering::basic_events(&pdag);
        let mut var_of = HashMap::new();
        for (i, &e) in events.iter().enumerate() {
            var_of.insert(e, i);
        }
        let (_bdd, root) =
            crate::algorithms::bdd_engine::Bdd::from_pdag_with_order(&pdag, &var_of).unwrap();
        assert!(!root.is_true(), "inline not must not collapse to constant true");
        assert!(!root.is_false());
    }

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
            CcfModel::AlphaFactor {
                factors: alphas, ..
            } => {
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
                assert_eq!(factors.len(), 2);
                assert_eq!(factors[0], 0.2);
                assert_eq!(factors[1], 0.1);
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

    fn single_event_fault_tree(event_body: &str, extra: &str) -> String {
        format!(
            r#"<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="ft">
    <define-gate name="top">
      <or>
        <basic-event name="A"/>
      </or>
    </define-gate>
    <define-basic-event name="A">{event_body}</define-basic-event>
    {extra}
  </define-fault-tree>
</opsa-mef>"#
        )
    }

    #[test]
    fn parses_exponential_failure_model() {
        let xml = single_event_fault_tree(
            r#"<exponential><float value="0.001"/><float value="100.0"/></exponential>"#,
            "",
        );
        let ft = parse_fault_tree(&xml).unwrap();
        let event = ft.get_basic_event("A").unwrap();
        let expected = 1.0 - (-0.001f64 * 100.0).exp();
        assert!((event.probability() - expected).abs() < 1e-9);
        assert!(event.value().is_some());
    }

    #[test]
    fn parses_lognormal_deviate_mean_matches_input() {
        let xml = single_event_fault_tree(
            r#"<lognormal-deviate><float value="0.01"/><float value="3.0"/></lognormal-deviate>"#,
            "",
        );
        let ft = parse_fault_tree(&xml).unwrap();
        let event = ft.get_basic_event("A").unwrap();
        assert!((event.probability() - 0.01).abs() < 1e-9);
        assert!(event.value().is_some());
    }

    #[test]
    fn parses_define_parameter_and_reference() {
        let xml = single_event_fault_tree(
            r#"<parameter name="lambda"/>"#,
            r#"<define-parameter name="lambda"><float value="0.002"/></define-parameter>"#,
        );
        let ft = parse_fault_tree(&xml).unwrap();
        let event = ft.get_basic_event("A").unwrap();
        assert!((event.probability() - 0.002).abs() < 1e-12);
        assert!(event.value().is_some());
        assert!(ft.parameters().contains_key("lambda"));
    }

    #[test]
    fn parses_raw_data_jeffreys_posterior_mean() {
        let xml = single_event_fault_tree(r#"<raw-data failures="2" demands="1000"/>"#, "");
        let ft = parse_fault_tree(&xml).unwrap();
        let event = ft.get_basic_event("A").unwrap();
        assert!((event.probability() - 2.5 / 1001.0).abs() < 1e-12);
        assert!(event.value().is_some());
    }

    #[test]
    fn parses_nested_arithmetic_expression() {
        let xml =
            single_event_fault_tree(r#"<mul><float value="0.5"/><float value="0.2"/></mul>"#, "");
        let ft = parse_fault_tree(&xml).unwrap();
        let event = ft.get_basic_event("A").unwrap();
        assert!((event.probability() - 0.1).abs() < 1e-12);
        assert!(event.value().is_some());
    }

    #[test]
    fn skips_label_before_expression() {
        let xml =
            single_event_fault_tree(r#"<label>a description</label><float value="0.3"/>"#, "");
        let ft = parse_fault_tree(&xml).unwrap();
        let event = ft.get_basic_event("A").unwrap();
        assert_eq!(event.probability(), 0.3);
        assert!(event.value().is_none());
    }
}

pub fn parse_event_tree_model(xml: &str) -> Result<(Model, Vec<InitiatingEvent>, Vec<EventTree>)> {
    let parsed = crate::io::event_tree_parser::parse_event_tree_model_full(xml)?;
    Ok((parsed.model, parsed.initiating_events, parsed.event_trees))
}
