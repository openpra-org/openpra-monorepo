mod cli;

use clap::Parser;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = cli::args::Args::parse();
    cli::run::run(cli)
}
