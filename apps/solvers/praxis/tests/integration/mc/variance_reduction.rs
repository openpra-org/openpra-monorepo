use praxis::analysis::quantify::{quantify, Settings};
use praxis::core::fault_tree::FaultTree;
use praxis::io::parser::parse_fault_tree;
use praxis::mc::core::{ConvergenceSettings, VrtMode, VrtSettings};
use praxis::mc::DpMonteCarloAnalysis;
use std::fs;

const TRIALS: usize = 50_000;
const SEEDS: u64 = 32;

fn tree(name: &str) -> FaultTree {
    let path = format!("tests/fixtures/benchmarks/Aralia/{name}.xml");
    let xml = fs::read_to_string(path).expect("read fixture");
    parse_fault_tree(&xml).expect("parse fixture")
}

fn exact_probability(tree: &FaultTree) -> f64 {
    quantify(tree, &Settings::default())
        .expect("quantify with the BDD")
        .probability
        .expect("probability")
        .value
}

fn settings(mode: VrtMode, is_bias_factor: f64) -> VrtSettings {
    VrtSettings {
        mode,
        is_bias_factor,
        is_max_events: usize::MAX,
        is_q_min: 1.0e-12,
        stratify_events: 4,
    }
}

struct Study {
    mean: f64,
    scatter: f64,
    half_width: f64,
    covered: usize,
}

impl Study {
    fn run(tree: &FaultTree, vrt: VrtSettings, exact: f64) -> Self {
        let mut estimates = Vec::new();
        let mut half_widths = Vec::new();
        let mut covered = 0;
        for seed in 1..=SEEDS {
            let result = DpMonteCarloAnalysis::new(tree, Some(seed * 1009), TRIALS)
                .expect("build Monte Carlo run")
                .run_cpu_with_watch_convergence_and_vrt(false, ConvergenceSettings::disabled(), vrt)
                .expect("run Monte Carlo");
            assert_eq!(result.num_trials, TRIALS);
            estimates.push(result.probability_estimate);
            let (lower, upper) = (
                result.confidence_interval_lower,
                result.confidence_interval_upper,
            );
            half_widths.push((upper - lower) / 2.0);
            covered += usize::from(lower <= exact && exact <= upper);
        }
        let n = estimates.len() as f64;
        let mean = estimates.iter().sum::<f64>() / n;
        let spread = estimates
            .iter()
            .map(|x| (x - mean) * (x - mean))
            .sum::<f64>();
        Self {
            mean,
            scatter: (spread / (n - 1.0)).sqrt(),
            half_width: half_widths.iter().sum::<f64>() / n,
            covered,
        }
    }

    fn assert_centred_on(&self, exact: f64) {
        let standard_error = self.scatter / (SEEDS as f64).sqrt();
        assert!(
            (self.mean - exact).abs() <= 4.0 * standard_error,
            "mean {} exact {} standard error {}",
            self.mean,
            exact,
            standard_error
        );
    }

    fn assert_interval_tracks_the_scatter(&self) {
        let ratio = self.half_width / 1.96 / self.scatter;
        assert!((0.5..=2.0).contains(&ratio), "{ratio}");
        assert!(self.covered as u64 >= SEEDS * 3 / 4, "{}", self.covered);
    }
}

#[test]
fn importance_sampling_recovers_the_bdd_probability() {
    let tree = tree("chinese");
    let exact = exact_probability(&tree);
    let study = Study::run(&tree, settings(VrtMode::ImportanceSampling, 10.0), exact);
    study.assert_centred_on(exact);
    study.assert_interval_tracks_the_scatter();
}

#[test]
fn stratified_sampling_recovers_the_bdd_probability() {
    let tree = tree("chinese");
    let exact = exact_probability(&tree);
    let study = Study::run(&tree, settings(VrtMode::StratifiedSampling, 10.0), exact);
    study.assert_centred_on(exact);
    study.assert_interval_tracks_the_scatter();
}

#[test]
fn variance_reduction_beats_plain_sampling() {
    let tree = tree("baobab1");
    let exact = exact_probability(&tree);
    let plain = Study::run(&tree, VrtSettings::none(), exact);
    let importance = Study::run(&tree, settings(VrtMode::ImportanceSampling, 10.0), exact);
    let stratified = Study::run(&tree, settings(VrtMode::StratifiedSampling, 10.0), exact);
    assert!(importance.scatter < plain.scatter);
    assert!(stratified.scatter < plain.scatter);
}

#[test]
fn importance_sampling_interval_follows_a_rare_top_event() {
    let tree = tree("isp9605");
    let exact = exact_probability(&tree);
    let study = Study::run(&tree, settings(VrtMode::ImportanceSampling, 10.0), exact);
    study.assert_centred_on(exact);
    study.assert_interval_tracks_the_scatter();
}

#[test]
fn a_large_bias_factor_keeps_the_estimate_near_the_bdd_probability() {
    let tree = tree("isp9605");
    let exact = exact_probability(&tree);
    let study = Study::run(&tree, settings(VrtMode::ImportanceSampling, 100.0), exact);
    study.assert_centred_on(exact);
}

#[test]
fn stratified_sampling_works_on_runs_shorter_than_the_strata_need() {
    let tree = tree("chinese");
    let result = DpMonteCarloAnalysis::new(&tree, Some(7), 20)
        .expect("build Monte Carlo run")
        .run_cpu_with_watch_convergence_and_vrt(
            false,
            ConvergenceSettings::disabled(),
            settings(VrtMode::StratifiedSampling, 10.0),
        )
        .expect("run Monte Carlo");
    assert_eq!(result.num_trials, 20);
}

#[cfg(feature = "wgpu")]
#[test]
fn gpu_and_cpu_agree_for_every_sampling_mode() {
    use cubecl_wgpu::WgpuRuntime;

    let tree = tree("isp9605");
    let device = Default::default();
    let modes = [
        VrtSettings::none(),
        settings(VrtMode::ImportanceSampling, 10.0),
        settings(VrtMode::StratifiedSampling, 10.0),
    ];
    for trials in [3_000, 200_000] {
        for vrt in modes {
            let analysis = DpMonteCarloAnalysis::new(&tree, Some(1009), trials)
                .expect("build Monte Carlo run");
            let cpu = analysis
                .run_cpu_with_watch_convergence_and_vrt(false, ConvergenceSettings::disabled(), vrt)
                .expect("run on the CPU");
            let gpu = analysis
                .run_gpu_with_watch_convergence_and_vrt::<WgpuRuntime>(
                    &device,
                    false,
                    ConvergenceSettings::disabled(),
                    vrt,
                )
                .expect("run on the GPU");
            assert_eq!(cpu.successes, gpu.successes, "{trials} {vrt:?}");
            assert_eq!(
                cpu.probability_estimate, gpu.probability_estimate,
                "{trials} {vrt:?}"
            );
        }
    }
}
