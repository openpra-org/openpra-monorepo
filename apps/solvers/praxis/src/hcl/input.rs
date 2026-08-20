use std::fs;
use std::path::Path;

use quick_xml::events::{BytesStart, Event};
use quick_xml::Reader;
use serde::{Deserialize, Serialize};
use tensorbayes::BayesianGraph;

use crate::{PraxisError, Result};

/// Canonical, name-based discrete BN input used at the PRAXIS process boundary.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct CanonicalBayesianNetwork {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub variables: Vec<CanonicalBayesianVariable>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct CanonicalBayesianVariable {
    pub name: String,
    pub states: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub parents: Vec<String>,
    pub probabilities: Vec<f64>,
}

impl CanonicalBayesianNetwork {
    pub fn into_graph(self) -> Result<BayesianGraph> {
        if self.variables.is_empty() {
            return Err(PraxisError::Hcl(
                "canonical Bayesian network contains no variables".to_string(),
            ));
        }

        let mut graph = BayesianGraph::new();
        for variable in &self.variables {
            graph.add_variable(&variable.name, &variable.states)?;
        }
        for variable in &self.variables {
            let child = graph.node_id(&variable.name)?;
            for parent_name in &variable.parents {
                let parent = graph.node_id(parent_name)?;
                graph.add_edge(parent, child)?;
            }
        }
        for variable in self.variables {
            let node = graph.node_id(&variable.name)?;
            let expected = graph.family_size(node)?;
            if variable.probabilities.len() != expected {
                return Err(PraxisError::Hcl(format!(
                    "canonical BN variable '{}' has {} probabilities; expected {expected} for one scalar CPT",
                    variable.name,
                    variable.probabilities.len()
                )));
            }
            graph.set_cpt(node, variable.probabilities)?;
        }
        graph.validate()?;
        Ok(graph)
    }

    pub fn from_xdsl(document: &str) -> Result<Self> {
        parse_xdsl(document)
    }

    pub fn from_xdsl_file(path: impl AsRef<Path>) -> Result<Self> {
        let path = path.as_ref();
        let document = fs::read_to_string(path).map_err(|error| {
            PraxisError::Io(format!(
                "failed to read XDSL file '{}': {error}",
                path.display()
            ))
        })?;
        Self::from_xdsl(&document)
    }
}

#[derive(Default)]
struct XdslVariable {
    name: String,
    states: Vec<String>,
    parents: Vec<String>,
    probabilities: Vec<f64>,
}

#[derive(Clone, Copy)]
enum Capture {
    Parents,
    Probabilities,
}

/// Imports the discrete CPT subset of GeNIe/SMILE XDSL.
///
/// Supported input is `<nodes><cpt id="..."><state id="..."/>`, optional
/// `<parents>`, and `<probabilities>`. Decision, utility, deterministic, and
/// continuous nodes are rejected instead of being silently approximated.
pub fn parse_xdsl(document: &str) -> Result<CanonicalBayesianNetwork> {
    let mut reader = Reader::from_str(document);
    reader.trim_text(true);
    let mut buffer = Vec::new();
    let mut network_id = None;
    let mut in_nodes = false;
    let mut depth = 0usize;
    let mut nodes_depth = None;
    let mut current: Option<XdslVariable> = None;
    let mut capture = None;
    let mut variables = Vec::new();

    loop {
        match reader.read_event_into(&mut buffer) {
            Ok(Event::Start(element)) => {
                let name = element.local_name();
                if in_nodes
                    && current.is_none()
                    && nodes_depth.is_some_and(|container_depth| depth == container_depth + 1)
                    && name.as_ref() != b"cpt"
                {
                    return Err(unsupported_node_type(name.as_ref()));
                }
                match name.as_ref() {
                    b"smile" => network_id = optional_attribute(&element, b"id")?,
                    b"nodes" => {
                        in_nodes = true;
                        nodes_depth = Some(depth);
                    }
                    b"cpt" if in_nodes => {
                        if current.is_some() {
                            return Err(xdsl_error("nested XDSL CPT nodes are not supported"));
                        }
                        current = Some(XdslVariable {
                            name: required_attribute(&element, b"id", "cpt")?,
                            ..XdslVariable::default()
                        });
                    }
                    b"state" if current.is_some() => {
                        current
                            .as_mut()
                            .expect("checked above")
                            .states
                            .push(required_attribute(&element, b"id", "state")?);
                    }
                    b"parents" if current.is_some() => capture = Some(Capture::Parents),
                    b"probabilities" if current.is_some() => capture = Some(Capture::Probabilities),
                    _ => {}
                }
                depth += 1;
            }
            Ok(Event::Empty(element)) => {
                let name = element.local_name();
                if in_nodes
                    && current.is_none()
                    && nodes_depth.is_some_and(|container_depth| depth == container_depth + 1)
                {
                    return Err(unsupported_node_type(name.as_ref()));
                }
                match name.as_ref() {
                    b"state" if current.is_some() => {
                        current
                            .as_mut()
                            .expect("checked above")
                            .states
                            .push(required_attribute(&element, b"id", "state")?);
                    }
                    _ => {}
                }
            }
            Ok(Event::Text(text)) => {
                let Some(mode) = capture else {
                    buffer.clear();
                    continue;
                };
                let value = text
                    .unescape()
                    .map_err(|error| xdsl_error(&format!("invalid escaped text: {error}")))?;
                let variable = current.as_mut().expect("capture requires a current CPT");
                match mode {
                    Capture::Parents => {
                        variable
                            .parents
                            .extend(value.split_whitespace().map(str::to_owned));
                    }
                    Capture::Probabilities => {
                        for token in value.split_whitespace() {
                            let probability = token.parse::<f64>().map_err(|_| {
                                xdsl_error(&format!(
                                    "CPT '{}' contains invalid probability '{token}'",
                                    variable.name
                                ))
                            })?;
                            variable.probabilities.push(probability);
                        }
                    }
                }
            }
            Ok(Event::End(element)) => {
                depth = depth.saturating_sub(1);
                match element.local_name().as_ref() {
                    b"parents" | b"probabilities" => capture = None,
                    b"cpt" if current.is_some() => {
                        let variable = current.take().expect("checked above");
                        if variable.states.is_empty() {
                            return Err(xdsl_error(&format!(
                                "CPT '{}' defines no states",
                                variable.name
                            )));
                        }
                        if variable.probabilities.is_empty() {
                            return Err(xdsl_error(&format!(
                                "CPT '{}' defines no probabilities",
                                variable.name
                            )));
                        }
                        variables.push(CanonicalBayesianVariable {
                            name: variable.name,
                            states: variable.states,
                            parents: variable.parents,
                            probabilities: variable.probabilities,
                        });
                    }
                    b"nodes" => {
                        in_nodes = false;
                        nodes_depth = None;
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(error) => return Err(xdsl_error(&format!("XML parse error: {error}"))),
            _ => {}
        }
        buffer.clear();
    }

    if current.is_some() {
        return Err(xdsl_error("unexpected end of input inside a CPT node"));
    }
    if variables.is_empty() {
        return Err(xdsl_error("XDSL contains no discrete CPT nodes"));
    }
    let canonical = CanonicalBayesianNetwork {
        id: network_id,
        variables,
    };
    canonical.clone().into_graph()?;
    Ok(canonical)
}

fn required_attribute(element: &BytesStart<'_>, name: &[u8], context: &str) -> Result<String> {
    optional_attribute(element, name)?.ok_or_else(|| {
        xdsl_error(&format!(
            "XDSL <{context}> is missing required '{}' attribute",
            String::from_utf8_lossy(name)
        ))
    })
}

fn optional_attribute(element: &BytesStart<'_>, name: &[u8]) -> Result<Option<String>> {
    for attribute in element.attributes() {
        let attribute =
            attribute.map_err(|error| xdsl_error(&format!("invalid XML attribute: {error}")))?;
        if attribute.key.as_ref() == name {
            let value = attribute
                .unescape_value()
                .map_err(|error| xdsl_error(&format!("invalid XML attribute value: {error}")))?;
            return Ok(Some(value.into_owned()));
        }
    }
    Ok(None)
}

fn xdsl_error(message: &str) -> PraxisError {
    PraxisError::Hcl(format!("XDSL: {message}"))
}

fn unsupported_node_type(name: &[u8]) -> PraxisError {
    xdsl_error(&format!(
        "unsupported XDSL node type '{}'",
        String::from_utf8_lossy(name)
    ))
}
