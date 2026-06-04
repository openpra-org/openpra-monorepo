use clap::Parser;
use std::path::PathBuf;

#[derive(Parser, Debug)]
pub struct Args {
    #[arg(long = "input-format", value_enum, default_value_t = InputFormat::Auto)]
    pub input_format: InputFormat,

    #[arg(long = "output-format", value_enum, default_value_t = OutputFormat::Auto)]
    pub output_format: OutputFormat,

    #[arg(long = "analysis", value_enum, default_value_t = Analysis::ProbabilityOnly)]
    pub analysis: Analysis,

    #[arg(long = "algorithm", value_enum, default_value_t = Algorithm::MonteCarlo)]
    pub algorithm: Algorithm,

    #[arg(long = "approximation", value_enum)]
    pub approximation: Option<Approximation>,

    #[arg(long = "backend", value_enum)]
    pub backend: Option<Backend>,

    #[arg(long = "seed", default_value = "847")]
    pub seed: u64,

    #[arg(long = "num-trials", default_value = "10000")]
    pub num_trials: u32,

    #[arg(long = "bitpacks-per-batch")]
    pub bitpacks_per_batch: Option<u32>,

    #[arg(long = "batches")]
    pub batches: Option<u32>,

    #[arg(long = "iterations")]
    pub iterations: Option<u32>,

    #[arg(long = "limit-order")]
    pub limit_order: Option<u32>,

    #[arg(long = "cut-off")]
    pub cut_off: Option<f64>,

    #[arg(long = "mission-time")]
    pub mission_time: Option<f64>,

    #[arg(long = "time-step")]
    pub time_step: Option<f64>,

    #[arg(long = "num-quantiles")]
    pub num_quantiles: Option<u32>,

    #[arg(long = "num-bins")]
    pub num_bins: Option<u32>,

    #[arg(long = "validate")]
    pub validate: bool,

    #[arg(long = "verbosity", default_value = "0")]
    pub verbosity: u32,

    #[arg(long = "print")]
    pub print: bool,

    #[arg(long = "watch")]
    pub watch: bool,

    #[arg(long = "visualize", help = "Generate and save Graphviz (.dot) and SVG graphs of the PDAGs")]
    pub visualize: bool,

    #[arg(long = "visualize-out-dir", value_name = "DIR", default_value = "./viz_output", help = "Directory to save generated .dot and .svg files")]
    pub visualize_out_dir: std::path::PathBuf,

    #[arg(long = "visualize-sequence", value_name = "SEQ_ID", help = "Specific sequence ID to output to stdout for event trees")]
    pub visualize_sequence: Option<String>,

    #[arg(long = "visualize-stdout", help = "Print raw DOT source to stdout (in addition to saving files)")]
    pub visualize_stdout: bool,

    #[arg(long = "optimize")]
    pub optimize: bool,

    #[arg(long = "early-stop")]
    pub early_stop: bool,

    #[arg(long = "delta", default_value = "0.1")]
    pub delta: f64,

    #[arg(long = "confidence", default_value = "0.95")]
    pub confidence: f64,

    #[arg(long = "burn-in", default_value = "0")]
    pub burn_in: u64,

    #[arg(long = "vrt", value_enum, default_value_t = Vrt::None)]
    pub vrt: Vrt,

    #[arg(long = "is-bias-factor", default_value = "10.0")]
    pub is_bias_factor: f64,

    #[arg(long = "is-max-events", default_value = "32")]
    pub is_max_events: u32,

    #[arg(long = "is-q-min", default_value = "1e-12")]
    pub is_q_min: f64,

    #[arg(long = "stratify-events", default_value = "4")]
    pub stratify_events: u32,

    #[arg(long = "output", value_name = "output-file")]
    pub output_file: Option<PathBuf>,

    #[arg(value_name = "input-file")]
    pub input_file: Option<PathBuf>,
}

#[derive(clap::ValueEnum, Debug, Clone, Copy, PartialEq, Eq)]
pub enum Vrt {
    None,
    Importance,
    Stratified,
}

#[derive(clap::ValueEnum, Debug, Clone, Copy, PartialEq, Eq)]
pub enum Algorithm {
    Bdd,
    Zbdd,
    Mocus,
    MonteCarlo,
}

#[derive(clap::ValueEnum, Debug, Clone, Copy, PartialEq, Eq)]
pub enum Analysis {
    ProbabilityOnly,
    CutsetsOnly,
    CutsetsAndProbability,
    Ccf,
    Sil,
    Uncertainty,
}

#[derive(clap::ValueEnum, Debug, Clone, Copy, PartialEq, Eq)]
pub enum Approximation {
    RareEvent,
    Mcub,
}

#[derive(clap::ValueEnum, Debug, Clone, Copy, PartialEq, Eq)]
pub enum Backend {
    Cpu,
    Cuda,
    Wgpu,
}

#[derive(clap::ValueEnum, Debug, Clone, Copy, PartialEq, Eq)]
pub enum InputFormat {
    Auto,
    Xml,
    Json,
}

#[derive(clap::ValueEnum, Debug, Clone, Copy, PartialEq, Eq)]
pub enum OutputFormat {
    Auto,
    Xml,
    Json,
}
