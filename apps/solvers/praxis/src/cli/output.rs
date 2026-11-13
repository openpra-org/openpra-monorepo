use quick_xml::Writer;
use std::io::{self, Write};

pub fn writer_vec() -> Writer<Vec<u8>> {
    Writer::new_with_indent(Vec::new(), b' ', 2)
}

pub fn writer_stdout() -> Writer<io::BufWriter<io::Stdout>> {
    Writer::new_with_indent(io::BufWriter::new(io::stdout()), b' ', 2)
}

pub fn finish_stdout(writer: Writer<io::BufWriter<io::Stdout>>) -> io::Result<()> {
    writer.into_inner().flush()
}
