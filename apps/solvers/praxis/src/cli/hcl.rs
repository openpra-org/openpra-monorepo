use std::fs;
use std::path::Path;

use praxis::core::fault_tree::FaultTree;
use praxis::hcl::{quantify_hcl, HclRequest};

use crate::cli::args::Args;

pub fn run_hcl_request(
    cli: &Args,
    fault_tree: FaultTree,
    request_path: &Path,
    verbose: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    if verbose {
        eprintln!("Loading HCL request: {}", request_path.display());
    }
    let request = HclRequest::from_json_file(request_path)?;
    let base_directory = request_path.parent();
    let (model, settings) = request.into_model_with_base(fault_tree, base_directory)?;
    let result = quantify_hcl(&model, &settings)?;
    let json = result.to_json_pretty()?;

    if let Some(output_path) = &cli.output_file {
        fs::write(output_path, format!("{json}\n")).map_err(|error| {
            format!(
                "Failed to write HCL output file '{}': {error}",
                output_path.display()
            )
        })?;
        if verbose {
            eprintln!("HCL results written to: {}", output_path.display());
        }
    }
    if cli.output_file.is_none() || cli.print {
        println!("{json}");
    }
    Ok(())
}
