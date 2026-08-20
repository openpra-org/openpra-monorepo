use quick_xml::Writer;
use std::io;

pub fn writer_vec() -> Writer<Vec<u8>> {
    Writer::new_with_indent(Vec::new(), b' ', 2)
}

pub fn writer_stdout() -> Writer<io::Stdout> {
    Writer::new_with_indent(io::stdout(), b' ', 2)
}
