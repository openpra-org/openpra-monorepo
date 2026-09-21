use clap::Parser;
use praxis::algorithms::build::VariableOrder;
use std::path::PathBuf;
use std::time::Duration;

#[derive(Parser, Debug)]
pub struct Args {
    #[arg(long = "analysis", value_enum, default_value_t = Analysis::ProbabilityOnly)]
    pub analysis: Analysis,

    #[arg(long = "algorithm", value_enum, default_value_t = Algorithm::MonteCarlo)]
    pub algorithm: Algorithm,

    #[arg(
        long = "variable-order",
        value_enum,
        value_name = "METHOD",
        help = "Variable ordering for BDD and ZBDD construction [possible values: dfs, force, sloan, dfs-scram, dfs-plain, reverse, sift, gsift, ils]"
    )]
    pub variable_order: Option<VariableOrder>,

    #[arg(
        long = "reorder-budget-seconds",
        value_name = "SECONDS",
        help = "Time budget for sift, gsift, or ils variable reordering"
    )]
    pub reorder_budget_seconds: Option<u64>,

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

    #[arg(
        long = "interactive-truncation",
        help = "After building the ZBDD, show diagram-native cut-set statistics and prompt for limits before enumeration"
    )]
    pub interactive_truncation: bool,

    #[arg(
        long = "cut-set-stats-only",
        help = "Build the truncated ZBDD and report diagram-native cut-set statistics without materializing cut sets"
    )]
    pub cut_set_stats_only: bool,

    #[arg(
        long = "end-state-map",
        value_name = "TSV",
        help = "Sequence ID and end-state name TSV for --algorithm zbdd-end-state; output contains grouped cut sets without end-state probability"
    )]
    pub end_state_map: Option<PathBuf>,

    #[arg(long = "cut-off-basis", value_enum, default_value_t = CutOffBasis::Probability, help = "Interpret --cut-off as a product probability (default), or as a product frequency for event trees: probability times the initiating-event frequency, which is the SAPHIRE truncation convention")]
    pub cut_off_basis: CutOffBasis,

    #[arg(long = "mission-time")]
    pub mission_time: Option<f64>,

    #[arg(long = "time-step")]
    pub time_step: Option<f64>,

    #[arg(long = "validate")]
    pub validate: bool,

    #[arg(long = "verbosity", default_value = "0")]
    pub verbosity: u32,

    #[arg(long = "print")]
    pub print: bool,

    #[arg(long = "watch")]
    pub watch: bool,

    #[arg(
        long = "visualize",
        help = "Generate Graphviz diagrams; DOT source is always saved and rendered output is selected by --visualize-format"
    )]
    pub visualize: bool,

    #[arg(
        long = "visualize-out-dir",
        value_name = "DIR",
        default_value = "./viz_output",
        help = "Directory for generated DOT, SVG, and PDF visualization files"
    )]
    pub visualize_out_dir: std::path::PathBuf,

    #[arg(
        long = "visualize-format",
        value_enum,
        default_value_t = VisualizeFormat::Svg,
        help = "Rendered visualization format; DOT source is always saved"
    )]
    pub visualize_format: VisualizeFormat,

    #[arg(
        long = "visualize-stdout",
        help = "Print raw DOT source to stdout (in addition to saving files)"
    )]
    pub visualize_stdout: bool,

    #[arg(long = "optimize")]
    pub optimize: bool,

    #[arg(
        long = "treewidth",
        help = "Compute greedy min-fill treewidth upper bound on the incidence graph (per maximal module)"
    )]
    pub treewidth: bool,

    #[arg(
        long = "pathwidth",
        help = "Compute greedy vertex-separation pathwidth upper bound on the incidence graph (per maximal module)"
    )]
    pub pathwidth: bool,

    #[arg(
        long = "widths-only",
        help = "Skip quantification; compute structural width metrics only and exit"
    )]
    pub widths_only: bool,

    #[arg(
        long = "simplify-house-events",
        help = "Before building, fold constant/house-event leaves and splice NULL/NOT gates (optional; the BDD handles these natively, so results are unchanged)"
    )]
    pub simplify_house_events: bool,

    #[arg(
        long = "complement-unity",
        help = "Event trees: replace each successful functional-event formula with Unity (TRUE), while preserving NOT gates inside failed fault trees, matching SAPHIRE sequence construction"
    )]
    pub complement_unity: bool,

    #[arg(
        long = "delete-term",
        help = "Event trees: apply the delete-term rule to a succeeded system, dropping its formula and deleting every product that contains one of its cut sets (a product that fails a succeeded system is not a product of the sequence). This is the SAPHIRE/FTREX convention"
    )]
    pub delete_term: bool,

    #[arg(
        long = "saphire-success",
        help = "Event trees: apply SAPHIRE's native per-functional-event success processing, including Unity, delete-term systems, and complemented systems or developed events"
    )]
    pub saphire_success: bool,

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

    #[arg(
        long = "export-model-pbf",
        value_name = "PATH",
        help = "Export the parsed fault-tree model as PRAXIS Boolean Format (PBF) and exit"
    )]
    pub export_model_pbf: Option<PathBuf>,

    #[arg(long = "output-format", value_enum, default_value_t = OutputFormat::Xml)]
    pub output_format: OutputFormat,

    #[arg(
        long = "hcl-request",
        value_name = "JSON",
        help = "Quantify the fault tree with a versioned HCL request and emit JSON"
    )]
    pub hcl_request: Option<PathBuf>,

    #[arg(long = "saphire-project", value_name = "PROJECT")]
    pub saphire_project: Option<String>,

    #[arg(
        long = "saphire-analysis",
        value_name = "ANALYSIS",
        default_value = "RANDOM/CD"
    )]
    pub saphire_analysis: String,

    #[arg(value_name = "input-file")]
    pub input_file: Option<PathBuf>,
}

impl Args {
    pub fn effective_variable_order(&self) -> VariableOrder {
        self.variable_order.unwrap_or(VariableOrder::Dfs)
    }

    pub fn reorder_budget(&self) -> Duration {
        Duration::from_secs(self.reorder_budget_seconds.unwrap_or(60))
    }
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
    ZbddDirect,
    ZbddDelterm,
    ZbddEndState,
    Mocus,
    MocusPi,
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
    Importance,
}

#[derive(clap::ValueEnum, Debug, Clone, Copy, PartialEq, Eq)]
pub enum Approximation {
    RareEvent,
    Mcub,
}

#[derive(clap::ValueEnum, Debug, Clone, Copy, PartialEq, Eq)]
pub enum CutOffBasis {
    Probability,
    Frequency,
}

#[derive(clap::ValueEnum, Debug, Clone, Copy, PartialEq, Eq)]
pub enum Backend {
    Cpu,
    Cuda,
    Wgpu,
}

#[derive(clap::ValueEnum, Debug, Clone, Copy, PartialEq, Eq)]
pub enum OutputFormat {
    Xml,
    Ftc,
}

#[derive(clap::ValueEnum, Debug, Clone, Copy, PartialEq, Eq)]
pub enum VisualizeFormat {
    Dot,
    Svg,
    Pdf,
    All,
}

impl VisualizeFormat {
    pub fn writes_svg(self) -> bool {
        matches!(self, Self::Svg | Self::All)
    }

    pub fn writes_pdf(self) -> bool {
        matches!(self, Self::Pdf | Self::All)
    }
}
