use quick_xml::Writer;
use std::io;
use std::path::PathBuf;

pub fn write_text_output(
    output_file: Option<&PathBuf>,
    content: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(path) = output_file {
        std::fs::write(path, content)
            .map_err(|e| format!("Failed to write output file '{}': {}", path.display(), e))?;
        return Ok(());
    }

    println!("{content}");
    Ok(())
}

pub fn writer_vec() -> Writer<Vec<u8>> {
    Writer::new_with_indent(Vec::new(), b' ', 2)
}

pub fn writer_stdout() -> Writer<io::Stdout> {
    Writer::new_with_indent(io::stdout(), b' ', 2)
}
