use std::fs;
use std::path::PathBuf;

use quick_xml::events::{BytesDecl, BytesEnd, BytesStart, Event};
use quick_xml::Writer;

use crate::cli::args::Args;
use praxis::algorithms::bdd_pdag::BddPdag;
use praxis::analysis::width::{
    compute_widths, ModuleKind, ModuleWidthReport, WidthOptions, WidthReport, WidthsReport,
};
use praxis::core::fault_tree::FaultTree;

pub fn run_widths_only(
    cli: &Args,
    fault_tree: &FaultTree,
    verbose: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let compute_treewidth = cli.treewidth || !cli.pathwidth;
    let compute_pathwidth = cli.pathwidth || !cli.treewidth;

    if verbose {
        eprintln!("Building PDAG from fault tree: {}", fault_tree.element().id());
    }

    let mut pdag = BddPdag::from_fault_tree(fault_tree)?;
    pdag.compute_ordering_and_modules()?;

    if verbose {
        eprintln!(
            "PDAG: {} basic events, {} gates",
            pdag.num_variables(),
            pdag.num_gates()
        );
        if compute_treewidth {
            eprintln!("Computing greedy min-fill treewidth upper bound...");
        }
        if compute_pathwidth {
            eprintln!("Computing greedy vertex-separation pathwidth upper bound...");
        }
    }

    let report = compute_widths(
        &pdag,
        WidthOptions {
            compute_treewidth,
            compute_pathwidth,
        },
    )?;

    if verbose {
        if let Some(tw) = report.max_treewidth {
            eprintln!(
                "Treewidth (max over modules) = {}, total compute time {} ms",
                tw, report.treewidth_total_time_ms
            );
        }
        if let Some(pw) = report.max_pathwidth {
            eprintln!(
                "Pathwidth (max over modules) = {}, total compute time {} ms",
                pw, report.pathwidth_total_time_ms
            );
        }
    }

    let xml = render_widths_xml(fault_tree.element().id(), &report)?;
    emit_output(cli.output_file.as_ref(), &xml)
}

fn render_widths_xml(
    fault_tree_id: &str,
    report: &WidthsReport,
) -> Result<String, Box<dyn std::error::Error>> {
    let mut writer: Writer<Vec<u8>> = Writer::new_with_indent(Vec::new(), b' ', 2);

    writer.write_event(Event::Decl(BytesDecl::new("1.0", Some("UTF-8"), None)))?;

    let mut root = BytesStart::new("praxis-graph-metrics");
    root.push_attribute(("fault-tree", fault_tree_id));
    writer.write_event(Event::Start(root))?;

    write_simple_text(&mut writer, "coherent", &report.coherent.to_string())?;
    write_simple_text(&mut writer, "num-basic-events", &report.num_basic_events.to_string())?;
    write_simple_text(&mut writer, "num-gates", &report.num_gates.to_string())?;
    write_simple_text(&mut writer, "num-modules", &report.num_modules.to_string())?;

    if let Some(tw) = report.max_treewidth {
        let mut e = BytesStart::new("max-treewidth");
        e.push_attribute(("upper-bound", tw.to_string().as_str()));
        e.push_attribute((
            "total-compute-time-ms",
            report.treewidth_total_time_ms.to_string().as_str(),
        ));
        writer.write_event(Event::Empty(e))?;
    }
    if let Some(pw) = report.max_pathwidth {
        let mut e = BytesStart::new("max-pathwidth");
        e.push_attribute(("upper-bound", pw.to_string().as_str()));
        e.push_attribute((
            "total-compute-time-ms",
            report.pathwidth_total_time_ms.to_string().as_str(),
        ));
        writer.write_event(Event::Empty(e))?;
    }

    writer.write_event(Event::Start(BytesStart::new("modules")))?;
    for module in &report.modules {
        write_module(&mut writer, module)?;
    }
    writer.write_event(Event::End(BytesEnd::new("modules")))?;

    writer.write_event(Event::End(BytesEnd::new("praxis-graph-metrics")))?;

    let bytes = writer.into_inner();
    Ok(String::from_utf8(bytes)?)
}

fn write_module(
    writer: &mut Writer<Vec<u8>>,
    module: &ModuleWidthReport,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut start = BytesStart::new("module");
    let kind = match module.kind {
        ModuleKind::Skeleton => "skeleton",
        ModuleKind::Module => "module",
    };
    start.push_attribute(("kind", kind));
    start.push_attribute(("root-gate-index", module.root_gate_idx.to_string().as_str()));
    if let Some(ref id) = module.root_gate_id {
        start.push_attribute(("root-gate-id", id.as_str()));
    }
    start.push_attribute(("num-vertices", module.num_vertices.to_string().as_str()));
    start.push_attribute(("num-edges", module.num_edges.to_string().as_str()));
    writer.write_event(Event::Start(start))?;

    if let Some(ref tw) = module.treewidth {
        write_width_element(writer, "treewidth", tw)?;
    }
    if let Some(ref pw) = module.pathwidth {
        write_width_element(writer, "pathwidth", pw)?;
    }

    writer.write_event(Event::End(BytesEnd::new("module")))?;
    Ok(())
}

fn write_width_element(
    writer: &mut Writer<Vec<u8>>,
    name: &str,
    width: &WidthReport,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut e = BytesStart::new(name);
    e.push_attribute(("upper-bound", width.upper_bound.to_string().as_str()));
    e.push_attribute(("compute-time-ms", width.compute_time_ms.to_string().as_str()));
    writer.write_event(Event::Empty(e))?;
    Ok(())
}

fn write_simple_text(
    writer: &mut Writer<Vec<u8>>,
    name: &str,
    text: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    writer.write_event(Event::Start(BytesStart::new(name)))?;
    writer.write_event(Event::Text(quick_xml::events::BytesText::new(text)))?;
    writer.write_event(Event::End(BytesEnd::new(name)))?;
    Ok(())
}

fn emit_output(
    output_file: Option<&PathBuf>,
    xml: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(path) = output_file {
        fs::write(path, xml)
            .map_err(|e| format!("Failed to write output file '{}': {}", path.display(), e))?;
        return Ok(());
    }
    println!("{xml}");
    Ok(())
}
