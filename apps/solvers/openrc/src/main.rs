use std::io::{self, Write};
use std::process::ExitCode;

struct ConsoleText<W: Write> {
    inner: W,
}

impl<W: Write> Write for ConsoleText<W> {
    fn write(&mut self, buffer: &[u8]) -> io::Result<usize> {
        if cfg!(windows) {
            for piece in buffer.split_inclusive(|byte| *byte == b'\n') {
                match piece.strip_suffix(b"\n") {
                    Some(line) => {
                        self.inner.write_all(line)?;
                        self.inner.write_all(b"\r\n")?;
                    }
                    None => self.inner.write_all(piece)?,
                }
            }
        } else {
            self.inner.write_all(buffer)?;
        }
        Ok(buffer.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        self.inner.flush()
    }
}

fn main() -> ExitCode {
    let arguments: Vec<String> = std::env::args().collect();
    let mut console = ConsoleText {
        inner: io::stdout().lock(),
    };
    let Some(config_path) = arguments.get(1) else {
        let _ = writeln!(console, "Usage: openrc-cli <config.txt>");
        return ExitCode::from(1);
    };
    let outcome = openrc::run::main(config_path, &mut console);
    let _ = console.flush();
    match outcome {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("error: {error}");
            ExitCode::from(1)
        }
    }
}
