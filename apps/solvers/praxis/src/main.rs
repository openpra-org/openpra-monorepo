mod cli;

use clap::Parser;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = cli::args::Args::parse();
    praxis::init_tracing(cli.verbosity);
    cli::run::run(cli)
}
