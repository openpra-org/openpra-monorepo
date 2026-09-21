use crate::cli::args::Args;

pub fn save_outputs(
    cli: &Args,
    dot_content: &str,
    file_stem: &str,
    description: &str,
    verbose: bool,
    graphviz_available: bool,
) {
    if cli.visualize_stdout {
        println!("{}", dot_content);
    }

    let dot_path = cli.visualize_out_dir.join(format!("{file_stem}.dot"));
    match praxis::analysis::visualize::save_dot(dot_content, &dot_path) {
        Ok(()) if verbose => {
            eprintln!("Saved {description} DOT source to {}", dot_path.display());
        }
        Err(error) => {
            eprintln!("Warning: Failed to save {description} DOT source: {error}");
        }
        Ok(()) => {}
    }

    if !cli.visualize_format.writes_svg() && !cli.visualize_format.writes_pdf() {
        return;
    }
    if !graphviz_available {
        eprintln!(
            "Warning: Graphviz 'dot' not found in PATH. Rendered {description} output skipped."
        );
        return;
    }

    if cli.visualize_format.writes_svg() {
        let svg_path = cli.visualize_out_dir.join(format!("{file_stem}.svg"));
        match praxis::analysis::visualize::save_svg(dot_content, &svg_path) {
            Ok(()) if verbose => {
                eprintln!("Saved {description} SVG to {}", svg_path.display());
            }
            Err(error) => {
                eprintln!("Warning: Failed to save {description} SVG: {error}");
            }
            Ok(()) => {}
        }
    }

    if cli.visualize_format.writes_pdf() {
        let pdf_path = cli.visualize_out_dir.join(format!("{file_stem}.pdf"));
        match praxis::analysis::visualize::save_pdf(dot_content, &pdf_path) {
            Ok(()) if verbose => {
                eprintln!("Saved {description} PDF to {}", pdf_path.display());
            }
            Err(error) => {
                eprintln!("Warning: Failed to save {description} PDF: {error}");
            }
            Ok(()) => {}
        }
    }
}
