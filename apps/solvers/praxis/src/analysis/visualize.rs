use crate::core::event_tree::{Branch, BranchTarget, EventTree};
use crate::core::fault_tree::FaultTree;
use crate::core::gate::Formula;
use crate::error::{PraxisError, Result};
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::process::Command;

const FT_GRAPH_ATTRS: &str = "\
  rankdir=TB;\n\
  splines=polyline;\n\
  nodesep=0.5;\n\
  ranksep=0.8;\n\
  node [fontname=\"Helvetica\", fontsize=10];\n\
  edge [fontname=\"Helvetica\", fontsize=9];\n";

pub fn graphviz_available() -> bool {
    Command::new("dot")
        .arg("-V")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

pub fn generate_dot_from_fault_tree(ft: &FaultTree) -> String {
    let mut declared: HashSet<&str> = HashSet::new();
    for id in ft.gates().keys() {
        declared.insert(id.as_str());
    }
    for id in ft.basic_events().keys() {
        declared.insert(id.as_str());
    }
    for id in ft.house_events().keys() {
        declared.insert(id.as_str());
    }

    let mut unresolved: HashSet<String> = HashSet::new();
    let mut dot = String::new();
    dot.push_str("digraph PDAG {\n");
    dot.push_str(FT_GRAPH_ATTRS);

    for (id, gate) in ft.gates() {
        let label = gate.element().name().unwrap_or(id);
        let escaped = label.replace('"', "\\\"");
        let attrs = match gate.formula() {
            Formula::And => format!("shape=triangle, label=\"AND\\n{}\"", escaped),
            Formula::Or => format!("shape=invtriangle, label=\"OR\\n{}\"", escaped),
            Formula::Not => format!("shape=diamond, label=\"NOT\\n{}\"", escaped),
            Formula::AtLeast { min } => {
                format!("shape=hexagon, label=\">={}\\n{}\"", min, escaped)
            }
            Formula::Xor => format!("shape=diamond, style=dashed, label=\"XOR\\n{}\"", escaped),
            Formula::Nand => {
                format!("shape=triangle, style=dashed, label=\"NAND\\n{}\"", escaped)
            }
            Formula::Nor => {
                format!("shape=invtriangle, style=dashed, label=\"NOR\\n{}\"", escaped)
            }
            Formula::Iff => {
                format!("shape=diamond, style=dotted, label=\"IFF\\n{}\"", escaped)
            }
        };
        dot.push_str(&format!("  \"{}\" [{}];\n", id, attrs));

        for op in gate.operands() {
            dot.push_str(&format!("  \"{}\" -> \"{}\";\n", id, op));
            if !declared.contains(op.as_str()) {
                unresolved.insert(op.clone());
            }
        }
    }

    for (id, event) in ft.basic_events() {
        let label = event.element().name().unwrap_or(id);
        let escaped = label.replace('"', "\\\"");
        dot.push_str(&format!(
            "  \"{}\" [shape=circle, label=\"{}\"];\n",
            id, escaped
        ));
    }

    for (id, event) in ft.house_events() {
        let label = event.element().name().unwrap_or(id);
        let escaped = label.replace('"', "\\\"");
        dot.push_str(&format!(
            "  \"{}\" [shape=house, label=\"{}\"];\n",
            id, escaped
        ));
    }

    for id in &unresolved {
        let escaped = id.replace('"', "\\\"");
        dot.push_str(&format!(
            "  \"{}\" [shape=ellipse, style=dashed, label=\"{}\\n(external ref)\", color=orange];\n",
            id, escaped
        ));
    }

    dot.push_str("}\n");
    dot
}

pub fn generate_event_tree_dot(et: &EventTree, ie_id: &str) -> String {
    let et_label = et.id.replace('"', "\\\"");
    let ie_label = ie_id.replace('"', "\\\"");

    let mut dot = String::new();
    dot.push_str(&format!("digraph \"{}\" {{\n", et_label));
    dot.push_str("  rankdir=LR;\n");
    dot.push_str("  splines=polyline;\n");
    dot.push_str("  nodesep=0.6;\n");
    dot.push_str("  ranksep=1.5;\n");
    dot.push_str("  node [fontname=\"Helvetica\", fontsize=10];\n");
    dot.push_str("  edge [fontname=\"Helvetica\", fontsize=9];\n");

    dot.push_str(&format!(
        "  \"ie\" [shape=box, style=filled, fillcolor=lightblue, label=\"IE: {}\"];\n",
        ie_label
    ));

    let mut seq_counter = 0usize;
    traverse_branch(
        &et.initial_state,
        Some("ie"),
        None,
        &mut seq_counter,
        &mut dot,
        "",
    );

    dot.push_str("}\n");
    dot
}

fn traverse_branch(
    branch: &Branch,
    parent_id: Option<&str>,
    edge_state: Option<&str>,
    seq_counter: &mut usize,
    dot: &mut String,
    path_prefix: &str,
) {
    match &branch.target {
        BranchTarget::Fork(fork) => {
            let sanitized = path_prefix
                .chars()
                .map(|c| if c.is_alphanumeric() { c } else { '_' })
                .collect::<String>();
            let node_id = if sanitized.is_empty() {
                "fork_root".to_string()
            } else {
                format!("fork_{}", sanitized)
            };

            let fe_label = fork.functional_event_id.replace('"', "\\\"");
            dot.push_str(&format!(
                "  \"{}\" [shape=diamond, label=\"{}\"];\n",
                node_id, fe_label
            ));

            if let Some(pid) = parent_id {
                write_et_edge(dot, pid, &node_id, edge_state);
            }

            for path in &fork.paths {
                let new_prefix = if path_prefix.is_empty() {
                    path.state.clone()
                } else {
                    format!("{}_{}", path_prefix, path.state)
                };
                traverse_branch(
                    &path.branch,
                    Some(&node_id),
                    Some(&path.state),
                    seq_counter,
                    dot,
                    &new_prefix,
                );
            }
        }

        BranchTarget::Sequence(seq_id) => {
            let node_id = format!("seq_{}", seq_counter);
            *seq_counter += 1;
            let label = seq_id.replace('"', "\\\"");
            dot.push_str(&format!(
                "  \"{}\" [shape=box, style=filled, fillcolor=lightyellow, label=\"{}\"];\n",
                node_id, label
            ));
            if let Some(pid) = parent_id {
                write_et_edge(dot, pid, &node_id, edge_state);
            }
        }

        BranchTarget::NamedBranch(branch_id) => {
            let sanitized = branch_id
                .chars()
                .map(|c| if c.is_alphanumeric() { c } else { '_' })
                .collect::<String>();
            let node_id = format!("named_{}", sanitized);
            let label = branch_id.replace('"', "\\\"");
            dot.push_str(&format!(
                "  \"{}\" [shape=box, style=dashed, label=\"ref: {}\"];\n",
                node_id, label
            ));
            if let Some(pid) = parent_id {
                write_et_edge(dot, pid, &node_id, edge_state);
            }
        }
    }
}

fn write_et_edge(dot: &mut String, from: &str, to: &str, state: Option<&str>) {
    let label = state.unwrap_or("");
    let lower = label.to_lowercase();
    let (color, style) = if lower == "w" || lower == "success" || lower == "yes" {
        ("green4", "bold")
    } else if lower == "f" || lower == "failure" || lower == "no" {
        ("red3", "bold")
    } else {
        ("black", "solid")
    };
    dot.push_str(&format!(
        "  \"{}\" -> \"{}\" [label=\"{}\", color={}, style={}];\n",
        from, to, label, color, style
    ));
}

pub fn save_svg(dot_content: &str, output_path: &Path) -> Result<()> {
    save_with_format(dot_content, output_path, "svg")
}

pub fn save_pdf(dot_content: &str, output_path: &Path) -> Result<()> {
    save_with_format(dot_content, output_path, "pdf")
}

fn save_with_format(dot_content: &str, output_path: &Path, format: &str) -> Result<()> {
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            PraxisError::Io(format!("Failed to create visualization directory: {}", e))
        })?;
    }

    let tmp_dot_path = output_path.with_extension("dot");
    fs::write(&tmp_dot_path, dot_content).map_err(|e| {
        PraxisError::Io(format!("Failed to write dot file: {}", e))
    })?;

    let format_flag = format!("-T{}", format);
    let status = Command::new("dot")
        .args([
            &format_flag,
            tmp_dot_path.to_str().unwrap(),
            "-o",
            output_path.to_str().unwrap(),
        ])
        .status()
        .map_err(|e| {
            PraxisError::Io(format!(
                "Failed to execute 'dot' command (is Graphviz installed?): {}",
                e
            ))
        })?;

    if !status.success() {
        return Err(PraxisError::Logic(format!(
            "'dot' command failed with status: {}",
            status
        )));
    }

    let _ = fs::remove_file(&tmp_dot_path);
    Ok(())
}
