pub mod algorithms;
pub mod analysis;
pub mod core;
pub mod error;
pub mod expression;
pub mod hcl;
pub mod io;
pub mod mc;
pub mod quantitative;

pub use error::{MefError, PraxisError, Result, XmlError};

pub fn init_tracing(verbosity: u32) {
    use std::str::FromStr;
    use tracing::Level;

    let env_level = std::env::var("PRAXIS_LOG")
        .ok()
        .and_then(|s| Level::from_str(s.trim()).ok());

    if verbosity == 0 && env_level.is_none() {
        return;
    }

    let level = env_level.unwrap_or(match verbosity {
        0 => Level::WARN,
        1 => Level::INFO,
        2 => Level::DEBUG,
        _ => Level::TRACE,
    });

    let _ = tracing_subscriber::fmt()
        .with_writer(std::io::stderr)
        .without_time()
        .with_target(true)
        .compact()
        .with_max_level(level)
        .try_init();
}
