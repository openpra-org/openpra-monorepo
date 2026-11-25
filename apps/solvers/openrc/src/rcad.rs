use std::collections::{BTreeSet, HashMap};
use std::f64::consts::PI;
use std::hash::Hash;
use std::sync::{Arc, OnceLock};

use indexmap::IndexMap;
use serde_json::Value;

use crate::config::PlumeSegment;
use crate::dcf::load_dcf_data;
use crate::error::OpenRcError;
use crate::met::MetRecord;
use crate::number::{max_of, modulo, parse_float, power, round_to_digits, square, sum_floats};
use crate::rcre::{chemical_group_for_nuclide, deposition_velocity_for_nuclide};
use crate::st::load_decay_data;
use crate::text::{repr_str, strip};

extern "C" {
    fn erf(x: f64) -> f64;
}

pub const DEFAULT_N_TERMS: i64 = 100;
pub const DEFAULT_N_INTERVALS: i64 = 80;
pub const DEPOSITION_RADIAL_BREAKPOINTS: [f64; 8] =
    [1.0, 100.0, 200.0, 500.0, 1000.0, 2000.0, 5000.0, 10000.0];

const BREATHING_RATE_M3_S: f64 = 3.3e-4;
const EAB_DISTANCE_M: f64 = 756.4;
const DOSE_LIMIT_SV: f64 = 0.01;
const DEFAULT_ORGAN: &str = "ICRP60ED";
const VERTICAL_PSI_CACHE_SIZE: usize = 8192;
const DRY_DEP_CACHE_SIZE: usize = 4096;

pub type ActivityFractions = IndexMap<String, f64>;

#[derive(Debug, Clone, PartialEq)]
pub struct Receptor {
    pub x_m: f64,
    pub y_m: f64,
    pub z_m: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct GaussianOptions {
    pub wind_speed_m_s: f64,
    pub stability_class: String,
    pub mixing_height_m: Option<f64>,
    pub plume_centerline_height_m: f64,
    pub dry_deposition_velocity_m_s: f64,
    pub reflect_ground: bool,
    pub well_mixed: bool,
    pub y_scale: f64,
    pub z_scale: f64,
    pub include_ingrowth: bool,
    pub simple_decay_at_receptor: bool,
    pub collapse_half_life_sec: f64,
    pub compute_lmp: bool,
    pub compute_epz: bool,
    pub sigma_model: String,
    pub measurement_height_m: f64,
    pub displacement_height_m: f64,
    pub sigma_v_m_s: Option<f64>,
    pub sigma_w_m_s: Option<f64>,
}

impl Default for GaussianOptions {
    fn default() -> Self {
        Self {
            wind_speed_m_s: 3.0,
            stability_class: "D".to_string(),
            mixing_height_m: None,
            plume_centerline_height_m: 0.0,
            dry_deposition_velocity_m_s: 0.003,
            reflect_ground: true,
            well_mixed: false,
            y_scale: 1.0,
            z_scale: 1.0,
            include_ingrowth: false,
            simple_decay_at_receptor: false,
            collapse_half_life_sec: 1.0,
            compute_lmp: true,
            compute_epz: true,
            sigma_model: "ek".to_string(),
            measurement_height_m: 3.8,
            displacement_height_m: 0.37,
            sigma_v_m_s: None,
            sigma_w_m_s: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct RunResult {
    pub chi_over_q_s_m3: f64,
    pub chi_bq_s_m3: f64,
    pub tede_sv: f64,
    pub breakdown_sv_by_nuclide: Vec<(String, f64)>,
    pub dry_dep_fraction_remaining: f64,
    pub ground_deposition_bq_m2: f64,
    pub missing_dcfs: Vec<String>,
    pub lmp_chi_over_q_s_m3: f64,
    pub lmp_tede_sv: f64,
    pub epz_distance_m: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PolarRunResult {
    pub sector_azimuths_deg: Vec<f64>,
    pub ring_distances_m: Vec<f64>,
    pub wind_dir_deg: f64,
    pub chi_q_s_m3: Vec<Vec<f64>>,
    pub air_conc_bq_m3: Vec<Vec<f64>>,
    pub ground_dep_bq_m2: Vec<Vec<f64>>,
    pub cloudshine_sv: Vec<Vec<f64>>,
    pub groundshine_sv: Vec<Vec<f64>>,
    pub inhalation_sv: Vec<Vec<f64>>,
    pub tede_sv: Vec<Vec<f64>>,
    pub missing_dcfs: Vec<String>,
}

const PGDIST: [f64; 50] = [
    1.0e+00, 1.4e+00, 2.0e+00, 3.0e+00, 4.0e+00, 6.0e+00, 8.0e+00, 1.0e+01, 1.4e+01, 2.0e+01,
    3.0e+01, 4.0e+01, 6.0e+01, 8.0e+01, 1.0e+02, 1.4e+02, 2.0e+02, 3.0e+02, 4.0e+02, 6.0e+02,
    8.0e+02, 1.0e+03, 1.4e+03, 2.0e+03, 3.0e+03, 4.0e+03, 6.0e+03, 8.0e+03, 1.0e+04, 1.4e+04,
    2.0e+04, 3.0e+04, 4.0e+04, 6.0e+04, 8.0e+04, 1.0e+05, 1.4e+05, 2.0e+05, 3.0e+05, 4.0e+05,
    6.0e+05, 8.0e+05, 1.0e+06, 1.4e+06, 2.0e+06, 3.0e+06, 4.0e+06, 6.0e+06, 8.0e+06, 1.0e+07,
];

const SIGMA_Y: [[f64; 50]; 6] = [
    [
        3.66e-01, 4.96e-01, 6.84e-01, 9.87e-01, 1.28e+00, 1.84e+00, 2.39e+00, 2.93e+00, 3.97e+00,
        5.47e+00, 7.89e+00, 1.02e+01, 1.48e+01, 1.91e+01, 2.34e+01, 3.17e+01, 4.38e+01, 6.31e+01,
        8.19e+01, 1.18e+02, 1.53e+02, 1.87e+02, 2.54e+02, 3.50e+02, 5.05e+02, 6.55e+02, 9.45e+02,
        1.22e+03, 1.50e+03, 2.03e+03, 2.80e+03, 4.04e+03, 5.24e+03, 7.56e+03, 9.80e+03, 1.20e+04,
        1.62e+04, 2.24e+04, 3.23e+04, 4.19e+04, 6.05e+04, 7.84e+04, 9.59e+04, 1.30e+05, 1.79e+05,
        2.59e+05, 3.35e+05, 4.84e+05, 6.27e+05, 7.67e+05,
    ],
    [
        2.75e-01, 3.73e-01, 5.14e-01, 7.42e-01, 9.62e-01, 1.39e+00, 1.80e+00, 2.20e+00, 2.98e+00,
        4.12e+00, 5.94e+00, 7.70e+00, 1.11e+01, 1.44e+01, 1.76e+01, 2.39e+01, 3.29e+01, 4.75e+01,
        6.16e+01, 8.88e+01, 1.15e+02, 1.41e+02, 1.91e+02, 2.63e+02, 3.80e+02, 4.93e+02, 7.10e+02,
        9.21e+02, 1.13e+03, 1.53e+03, 2.11e+03, 3.04e+03, 3.94e+03, 5.68e+03, 7.37e+03, 9.02e+03,
        1.22e+04, 1.69e+04, 2.43e+04, 3.15e+04, 4.55e+04, 5.90e+04, 7.21e+04, 9.77e+04, 1.35e+05,
        1.95e+05, 2.52e+05, 3.64e+05, 4.72e+05, 5.77e+05,
    ],
    [
        2.09e-01, 2.83e-01, 3.91e-01, 5.63e-01, 7.31e-01, 1.05e+00, 1.37e+00, 1.67e+00, 2.26e+00,
        3.13e+00, 4.51e+00, 5.84e+00, 8.43e+00, 1.09e+01, 1.34e+01, 1.81e+01, 2.50e+01, 3.61e+01,
        4.68e+01, 6.74e+01, 8.74e+01, 1.07e+02, 1.45e+02, 2.00e+02, 2.88e+02, 3.74e+02, 5.39e+02,
        7.00e+02, 8.56e+02, 1.16e+03, 1.60e+03, 2.31e+03, 2.99e+03, 4.32e+03, 5.60e+03, 6.85e+03,
        9.28e+03, 1.28e+04, 1.85e+04, 2.39e+04, 3.45e+04, 4.48e+04, 5.48e+04, 7.42e+04, 1.02e+05,
        1.48e+05, 1.92e+05, 2.76e+05, 3.58e+05, 4.38e+05,
    ],
    [
        1.47e-01, 1.99e-01, 2.75e-01, 3.97e-01, 5.14e-01, 7.42e-01, 9.62e-01, 1.18e+00, 1.59e+00,
        2.20e+00, 3.17e+00, 4.12e+00, 5.94e+00, 7.70e+00, 9.41e+00, 1.28e+01, 1.76e+01, 2.54e+01,
        3.29e+01, 4.75e+01, 6.16e+01, 7.53e+01, 1.02e+02, 1.41e+02, 2.03e+02, 2.63e+02, 3.80e+02,
        4.93e+02, 6.03e+02, 8.17e+02, 1.13e+03, 1.63e+03, 2.11e+03, 3.04e+03, 3.94e+03, 4.82e+03,
        6.53e+03, 9.02e+03, 1.30e+04, 1.69e+04, 2.43e+04, 3.15e+04, 3.86e+04, 5.23e+04, 7.21e+04,
        1.04e+05, 1.35e+05, 1.95e+05, 2.52e+05, 3.09e+05,
    ],
    [
        1.05e-01, 1.42e-01, 1.96e-01, 2.82e-01, 3.66e-01, 5.28e-01, 6.84e-01, 8.37e-01, 1.13e+00,
        1.56e+00, 2.26e+00, 2.93e+00, 4.22e+00, 5.47e+00, 6.69e+00, 9.07e+00, 1.25e+01, 1.81e+01,
        2.34e+01, 3.38e+01, 4.38e+01, 5.36e+01, 7.26e+01, 1.00e+02, 1.44e+02, 1.87e+02, 2.70e+02,
        3.50e+02, 4.28e+02, 5.81e+02, 8.01e+02, 1.16e+03, 1.50e+03, 2.16e+03, 2.80e+03, 3.43e+03,
        4.65e+03, 6.41e+03, 9.25e+03, 1.20e+04, 1.73e+04, 2.24e+04, 2.74e+04, 3.72e+04, 5.13e+04,
        7.40e+04, 9.59e+04, 1.38e+05, 1.79e+05, 2.19e+05,
    ],
    [
        7.22e-02, 9.78e-02, 1.35e-01, 1.95e-01, 2.52e-01, 3.64e-01, 4.72e-01, 5.78e-01, 7.83e-01,
        1.08e+00, 1.56e+00, 2.02e+00, 2.91e+00, 3.78e+00, 4.62e+00, 6.26e+00, 8.64e+00, 1.25e+01,
        1.62e+01, 2.33e+01, 3.02e+01, 3.70e+01, 5.01e+01, 6.91e+01, 9.97e+01, 1.29e+02, 1.86e+02,
        2.42e+02, 2.96e+02, 4.01e+02, 5.53e+02, 7.98e+02, 1.03e+03, 1.49e+03, 1.93e+03, 2.37e+03,
        3.21e+03, 4.42e+03, 6.38e+03, 8.27e+03, 1.19e+04, 1.55e+04, 1.89e+04, 2.57e+04, 3.54e+04,
        5.11e+04, 6.62e+04, 9.55e+04, 1.24e+05, 1.51e+05,
    ],
];

const SIGMA_Z: [[f64; 50]; 6] = [
    [
        1.92e-01, 2.63e-01, 3.67e-01, 5.37e-01, 7.03e-01, 1.03e+00, 1.34e+00, 1.66e+00, 2.27e+00,
        3.17e+00, 4.63e+00, 6.06e+00, 8.86e+00, 1.16e+01, 1.43e+01, 1.89e+01, 2.86e+01, 5.17e+01,
        8.34e+01, 1.72e+02, 2.94e+02, 4.48e+02, 9.20e+02, 1.95e+03, 4.58e+03, 8.36e+03, 1.96e+04,
        3.57e+04, 5.70e+04, 1.15e+05, 2.44e+05, 5.69e+05, 1.04e+06, 2.43e+06, 4.44e+06, 7.08e+06,
        1.43e+07, 3.02e+07, 7.07e+07, 1.29e+08, 3.02e+08, 5.51e+08, 8.79e+08, 1.78e+09, 3.75e+09,
        8.78e+09, 1.60e+10, 3.75e+10, 6.84e+10, 1.09e+11,
    ],
    [
        1.56e-01, 2.13e-01, 2.96e-01, 4.30e-01, 5.60e-01, 8.14e-01, 1.06e+00, 1.30e+00, 1.78e+00,
        2.47e+00, 3.59e+00, 4.68e+00, 6.80e+00, 8.87e+00, 1.09e+01, 1.45e+01, 2.01e+01, 3.01e+01,
        4.06e+01, 6.28e+01, 8.60e+01, 1.10e+02, 1.59e+02, 2.34e+02, 3.62e+02, 4.98e+02, 7.76e+02,
        1.06e+03, 1.36e+03, 1.96e+03, 2.91e+03, 4.53e+03, 6.22e+03, 9.70e+03, 1.33e+04, 1.70e+04,
        2.46e+04, 3.64e+04, 5.68e+04, 7.79e+04, 1.22e+05, 1.67e+05, 2.13e+05, 3.08e+05, 4.56e+05,
        7.12e+05, 9.76e+05, 1.52e+06, 2.09e+06, 2.67e+06,
    ],
    [
        1.16e-01, 1.57e-01, 2.17e-01, 3.14e-01, 4.07e-01, 5.87e-01, 7.62e-01, 9.32e-01, 1.26e+00,
        1.75e+00, 2.52e+00, 3.27e+00, 4.72e+00, 6.12e+00, 7.49e+00, 1.02e+01, 1.41e+01, 2.04e+01,
        2.65e+01, 3.84e+01, 4.99e+01, 6.11e+01, 8.30e+01, 1.15e+02, 1.66e+02, 2.16e+02, 3.13e+02,
        4.06e+02, 4.98e+02, 6.76e+02, 9.36e+02, 1.35e+03, 1.76e+03, 2.55e+03, 3.31e+03, 4.06e+03,
        5.51e+03, 7.63e+03, 1.10e+04, 1.43e+04, 2.07e+04, 2.70e+04, 3.30e+04, 4.49e+04, 6.21e+04,
        8.99e+04, 1.17e+05, 1.69e+05, 2.20e+05, 2.69e+05,
    ],
    [
        7.90e-02, 1.06e-01, 1.45e-01, 2.08e-01, 2.68e-01, 3.83e-01, 4.93e-01, 6.01e-01, 8.08e-01,
        1.11e+00, 1.58e+00, 2.04e+00, 2.91e+00, 3.75e+00, 4.57e+00, 6.29e+00, 8.64e+00, 1.22e+01,
        1.54e+01, 2.12e+01, 2.66e+01, 3.15e+01, 3.99e+01, 5.06e+01, 6.54e+01, 7.80e+01, 9.92e+01,
        1.17e+02, 1.33e+02, 1.61e+02, 1.96e+02, 2.44e+02, 2.86e+02, 3.55e+02, 4.14e+02, 4.66e+02,
        5.57e+02, 6.72e+02, 8.31e+02, 9.67e+02, 1.19e+03, 1.39e+03, 1.56e+03, 1.86e+03, 2.23e+03,
        2.76e+03, 3.20e+03, 3.95e+03, 4.58e+03, 5.14e+03,
    ],
    [
        6.30e-02, 8.45e-02, 1.15e-01, 1.64e-01, 2.11e-01, 3.00e-01, 3.85e-01, 4.68e-01, 6.28e-01,
        8.56e-01, 1.22e+00, 1.57e+00, 2.23e+00, 2.86e+00, 3.48e+00, 4.72e+00, 6.36e+00, 8.79e+00,
        1.10e+01, 1.48e+01, 1.83e+01, 2.15e+01, 2.73e+01, 3.44e+01, 4.34e+01, 5.05e+01, 6.16e+01,
        7.03e+01, 7.77e+01, 8.98e+01, 1.04e+02, 1.22e+02, 1.36e+02, 1.59e+02, 1.77e+02, 1.91e+02,
        2.16e+02, 2.45e+02, 2.81e+02, 3.10e+02, 3.55e+02, 3.91e+02, 4.21e+02, 4.70e+02, 5.28e+02,
        6.02e+02, 6.60e+02, 7.52e+02, 8.24e+02, 8.84e+02,
    ],
    [
        5.30e-02, 6.97e-02, 9.32e-02, 1.30e-01, 1.64e-01, 2.28e-01, 2.88e-01, 3.45e-01, 4.54e-01,
        6.07e-01, 8.45e-01, 1.07e+00, 1.48e+00, 1.88e+00, 2.25e+00, 2.98e+00, 3.99e+00, 5.51e+00,
        6.89e+00, 9.43e+00, 1.17e+01, 1.39e+01, 1.79e+01, 2.23e+01, 2.77e+01, 3.17e+01, 3.78e+01,
        4.24e+01, 4.61e+01, 5.20e+01, 5.87e+01, 6.68e+01, 7.30e+01, 8.22e+01, 8.91e+01, 9.48e+01,
        1.04e+02, 1.14e+02, 1.26e+02, 1.35e+02, 1.49e+02, 1.60e+02, 1.68e+02, 1.82e+02, 1.97e+02,
        2.16e+02, 2.30e+02, 2.51e+02, 2.67e+02, 2.80e+02,
    ],
];

fn log_distances() -> &'static [f64; 50] {
    static LOG_DISTANCES: OnceLock<[f64; 50]> = OnceLock::new();
    LOG_DISTANCES.get_or_init(|| PGDIST.map(f64::ln))
}

fn class_index(stability_class: &str) -> usize {
    match strip(stability_class).to_uppercase().as_str() {
        "A" => 0,
        "B" => 1,
        "C" => 2,
        "E" => 4,
        "F" => 5,
        _ => 3,
    }
}

fn interp(x_m: f64, table: &[f64; 50]) -> f64 {
    let log_dist = log_distances();
    let log_x = max_of(x_m, PGDIST[0]).ln();
    if log_x <= log_dist[0] {
        return table[0];
    }
    if log_x >= log_dist[49] {
        return table[49];
    }
    let mut low = 0usize;
    let mut high = log_dist.len();
    while low < high {
        let middle = (low + high) / 2;
        if log_x < log_dist[middle] {
            high = middle;
        } else {
            low = middle + 1;
        }
    }
    let index = (low - 1).min(log_dist.len() - 2);
    let fraction = (log_x - log_dist[index]) / (log_dist[index + 1] - log_dist[index]);
    (table[index].ln() + fraction * (table[index + 1].ln() - table[index].ln())).exp()
}

pub fn sigma_y(distance_m: f64, stability_class: &str) -> f64 {
    interp(distance_m, &SIGMA_Y[class_index(stability_class)])
}

pub fn sigma_z(distance_m: f64, stability_class: &str) -> f64 {
    interp(distance_m, &SIGMA_Z[class_index(stability_class)])
}

pub fn sigma_yz(distance_m: f64, stability_class: &str) -> (f64, f64) {
    (
        sigma_y(distance_m, stability_class),
        sigma_z(distance_m, stability_class),
    )
}

pub fn hanna_sigma_yz(
    x: f64,
    u: f64,
    sigma_v: f64,
    sigma_w: f64,
    z_m: f64,
    z_d: f64,
) -> (f64, f64) {
    if x <= 0.0 || u < 1e-6 || sigma_w < 1e-6 || sigma_v < 1e-6 {
        return (0.0, 0.0);
    }
    let z_eff = max_of(z_m - z_d, 0.1);
    let travel_time = x / u;
    let t_lw = 0.5 * z_eff / sigma_w;
    let t_lv = 4.0 * t_lw;
    let sigma_z = sigma_w * travel_time / power(1.0 + 0.5 * travel_time / t_lw, 0.5);
    let sigma_y = sigma_v * travel_time / power(1.0 + 0.5 * travel_time / t_lv, 0.5);
    (sigma_y, sigma_z)
}

fn scale_or_one(scale: f64) -> f64 {
    if scale == 0.0 {
        1.0
    } else {
        scale
    }
}

pub fn opts_sigma_yz(distance_m: f64, opts: &GaussianOptions) -> (f64, f64) {
    if let (true, Some(sigma_v), Some(sigma_w), true) = (
        opts.sigma_model == "most",
        opts.sigma_v_m_s,
        opts.sigma_w_m_s,
        opts.wind_speed_m_s > 1e-6,
    ) {
        let (sy, sz) = hanna_sigma_yz(
            distance_m,
            opts.wind_speed_m_s,
            sigma_v,
            sigma_w,
            opts.measurement_height_m,
            opts.displacement_height_m,
        );
        return (
            sy * scale_or_one(opts.y_scale),
            sz * scale_or_one(opts.z_scale),
        );
    }
    let sy = sigma_y(distance_m, &opts.stability_class);
    let sz = sigma_z(distance_m, &opts.stability_class);
    (
        sy * scale_or_one(opts.y_scale),
        sz * scale_or_one(opts.z_scale),
    )
}

fn empty_object() -> &'static Value {
    static EMPTY: OnceLock<Value> = OnceLock::new();
    EMPTY.get_or_init(|| Value::Object(serde_json::Map::new()))
}

pub fn dcf_for_organ<'a>(raw: &'a Value, organ_filter: &str) -> HashMap<&'a str, &'a Value> {
    let suffix = format!("_{organ_filter}");
    let mut table: HashMap<&'a str, &'a Value> = HashMap::new();
    let Some(Value::Object(dcfs)) = raw.get("dcfs") else {
        return table;
    };
    for (key, entry) in dcfs {
        if !key.ends_with(&suffix) {
            continue;
        }
        let Some(nuclide) = entry.get("nuclide").and_then(Value::as_str) else {
            continue;
        };
        if nuclide.is_empty() {
            continue;
        }
        let values: &'a Value = match entry.get("values") {
            Some(values) => values,
            None => empty_object(),
        };
        table.insert(nuclide, values);
    }
    table
}

fn is_truthy(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::Bool(flag) => *flag,
        Value::Number(number) => number.as_f64().is_none_or(|float| float != 0.0),
        Value::String(text) => !text.is_empty(),
        Value::Array(items) => !items.is_empty(),
        Value::Object(entries) => !entries.is_empty(),
    }
}

fn float_of(value: &Value) -> Result<f64, OpenRcError> {
    match value {
        Value::Number(number) => number
            .as_f64()
            .ok_or_else(|| OpenRcError::InvalidValue(format!("number out of range: {number}"))),
        Value::Bool(flag) => Ok(if *flag { 1.0 } else { 0.0 }),
        Value::String(text) => parse_float(text).ok_or_else(|| {
            OpenRcError::InvalidValue(format!(
                "could not convert string to float: {}",
                repr_str(text)
            ))
        }),
        _ => Err(OpenRcError::InvalidType(
            "float() argument must be a string or a real number".to_string(),
        )),
    }
}

fn half_life_sec(entry: Option<&Value>, fallback: f64) -> Result<f64, OpenRcError> {
    match entry.and_then(|data| data.get("half_life_sec")) {
        Some(value) if is_truthy(value) => float_of(value),
        _ => Ok(fallback),
    }
}

pub fn safe_dcf(dcfs: Option<&Value>, key: &str) -> Result<f64, OpenRcError> {
    let Some(dcfs) = dcfs else {
        return Ok(0.0);
    };
    match dcfs.get(key) {
        None | Some(Value::Null) => Ok(0.0),
        Some(Value::Number(number)) => {
            let value = number.as_f64().unwrap_or(0.0);
            Ok(if value < 0.0 { 0.0 } else { value })
        }
        Some(Value::Bool(flag)) => Ok(if *flag { 1.0 } else { 0.0 }),
        Some(_) => Err(OpenRcError::InvalidType(format!(
            "dose coefficient '{key}' is not a number"
        ))),
    }
}

pub fn decay_fraction_at_time(half_life_sec: f64, time_s: f64) -> f64 {
    if half_life_sec <= 0.0 || half_life_sec >= 1e29 {
        return 1.0;
    }
    (-2.0_f64.ln() * time_s / half_life_sec).exp()
}

fn daughter_names(parent_data: Option<&Value>) -> Vec<String> {
    let mut names: Vec<String> = Vec::new();
    let Some(raw) = parent_data.and_then(|data| data.get("daughters")) else {
        return names;
    };
    match raw {
        Value::Array(items) => {
            for item in items {
                match item {
                    Value::String(name) => names.push(name.clone()),
                    Value::Object(entries) => {
                        let chosen = ["nuclide", "name", "id"]
                            .iter()
                            .filter_map(|key| entries.get(*key))
                            .find(|value| is_truthy(value));
                        if let Some(Value::String(name)) = chosen {
                            names.push(name.clone());
                        }
                    }
                    _ => {}
                }
            }
        }
        Value::Object(entries) => names.extend(entries.keys().cloned()),
        Value::String(text) => names.extend(text.chars().map(String::from)),
        _ => {}
    }
    names
}

pub fn simulate_decay_chain_activity_fractions(
    parent: &str,
    decay_data: &Value,
    time_points: &[f64],
    collapse_half_life_sec: f64,
) -> Result<Vec<(f64, ActivityFractions)>, OpenRcError> {
    let parent_data = decay_data.get(parent);
    let hl_p = half_life_sec(parent_data, 1e30)?;
    let lam_p = if hl_p < 1e29 {
        2.0_f64.ln() / hl_p
    } else {
        0.0
    };
    let daughters = daughter_names(parent_data);

    let mut result: Vec<(f64, ActivityFractions)> = Vec::new();
    for &time in time_points {
        let mut fractions: IndexMap<String, f64> = IndexMap::new();
        fractions.insert(parent.to_string(), decay_fraction_at_time(hl_p, time));
        for daughter in &daughters {
            let hl_d = half_life_sec(decay_data.get(daughter.as_str()), 1e30)?;
            if hl_d < collapse_half_life_sec {
                continue;
            }
            let lam_d = if hl_d < 1e29 {
                2.0_f64.ln() / hl_d
            } else {
                0.0
            };
            let delta = lam_d - lam_p;
            let fraction = if delta.abs() < 1e-30 {
                lam_p * time * (-lam_p * time).exp()
            } else {
                lam_p / delta * ((-lam_p * time).exp() - (-lam_d * time).exp())
            };
            fractions.insert(daughter.clone(), max_of(0.0, fraction));
        }
        match result.iter_mut().find(|(known, _)| *known == time) {
            Some(entry) => entry.1 = fractions,
            None => result.push((time, fractions)),
        }
    }
    Ok(result)
}

pub fn ndtr(x: f64) -> f64 {
    0.5 * (1.0 + unsafe { erf(x / 2.0_f64.sqrt()) })
}

fn divide(numerator: f64, denominator: f64) -> Result<f64, OpenRcError> {
    if denominator == 0.0 {
        return Err(OpenRcError::ZeroDivision(
            "float division by zero".to_string(),
        ));
    }
    Ok(numerator / denominator)
}

fn crosswind_fraction(
    azimuth_deg: f64,
    downwind_azimuth_deg: f64,
    distance_m: f64,
    sigma_y_m: f64,
    delta_theta: f64,
) -> Result<f64, OpenRcError> {
    let off_deg = modulo(azimuth_deg - downwind_azimuth_deg + 180.0 + 360.0, 360.0) - 180.0;
    let off_rad = off_deg * (PI / 180.0);
    let mut y_right = distance_m * (off_rad + delta_theta / 2.0).sin();
    let mut y_left = distance_m * (off_rad - delta_theta / 2.0).sin();
    if y_left > y_right {
        std::mem::swap(&mut y_left, &mut y_right);
    }
    Ok(ndtr(divide(y_right, sigma_y_m)?) - ndtr(divide(y_left, sigma_y_m)?))
}

fn key_bits(value: f64, digits: usize) -> u64 {
    (round_to_digits(value, digits) + 0.0).to_bits()
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct VerticalPsiKey {
    z: u64,
    h: u64,
    sig_z: u64,
    mixing_height: Option<u64>,
    reflect_ground: bool,
    n_terms: i64,
    well_mixed: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct DryDepKey {
    x_end: u64,
    v_d: u64,
    wind_speed: u64,
    stability_class: String,
    mixing_height: Option<u64>,
    z_scale: u64,
    sigma_model: String,
    sigma_v: u64,
    sigma_w: u64,
}

#[derive(Debug)]
struct BoundedCache<K> {
    entries: HashMap<K, f64>,
    max_size: usize,
}

impl<K: Hash + Eq> BoundedCache<K> {
    fn new(max_size: usize) -> Self {
        Self {
            entries: HashMap::new(),
            max_size,
        }
    }

    fn get(&self, key: &K) -> Option<f64> {
        self.entries.get(key).copied()
    }

    fn set(&mut self, key: K, value: f64) {
        if self.entries.len() >= self.max_size {
            self.entries.clear();
        }
        self.entries.insert(key, value);
    }
}

#[derive(Debug)]
pub struct Engine {
    dcf_data: Option<Arc<Value>>,
    decay_data: Option<Arc<Value>>,
    vertical_psi_cache: BoundedCache<VerticalPsiKey>,
    dry_dep_cache: BoundedCache<DryDepKey>,
}

impl Default for Engine {
    fn default() -> Self {
        Self::new()
    }
}

impl Engine {
    pub fn new() -> Self {
        Self::with_data(None, None)
    }

    pub fn with_data(dcf_data: Option<Value>, decay_data: Option<Value>) -> Self {
        Self {
            dcf_data: dcf_data.map(Arc::new),
            decay_data: decay_data.map(Arc::new),
            vertical_psi_cache: BoundedCache::new(VERTICAL_PSI_CACHE_SIZE),
            dry_dep_cache: BoundedCache::new(DRY_DEP_CACHE_SIZE),
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn gaussian_plume(
        &mut self,
        q: f64,
        u: f64,
        _x: f64,
        y: f64,
        h: f64,
        sig_y: f64,
        sig_z: f64,
        z: f64,
        mixing_height: Option<f64>,
        reflect_ground: bool,
        n_terms: i64,
        well_mixed: bool,
    ) -> f64 {
        if sig_y == 0.0 || sig_z == 0.0 || u == 0.0 {
            return 0.0;
        }
        let f_y =
            (1.0 / ((2.0 * PI).sqrt() * sig_y)) * (-(square(y) / (2.0 * square(sig_y)))).exp();
        let psi = self.vertical_psi(
            z,
            h,
            sig_z,
            mixing_height,
            reflect_ground,
            n_terms,
            well_mixed,
        );
        (q / u) * f_y * psi
    }

    #[allow(clippy::too_many_arguments)]
    pub fn vertical_psi(
        &mut self,
        z: f64,
        h: f64,
        sig_z: f64,
        mixing_height: Option<f64>,
        reflect_ground: bool,
        n_terms: i64,
        well_mixed: bool,
    ) -> f64 {
        if sig_z == 0.0 {
            return 0.0;
        }
        let key = VerticalPsiKey {
            z: key_bits(z, 9),
            h: key_bits(h, 9),
            sig_z: key_bits(sig_z, 9),
            mixing_height: mixing_height.map(|height| key_bits(height, 6)),
            reflect_ground,
            n_terms,
            well_mixed,
        };
        if let Some(cached) = self.vertical_psi_cache.get(&key) {
            return cached;
        }

        if let Some(hmix) = mixing_height {
            if hmix <= 0.0 {
                return 0.0;
            }
            if well_mixed {
                let value = if (0.0..=hmix).contains(&z) {
                    1.0 / hmix
                } else {
                    0.0
                };
                self.vertical_psi_cache.set(key, value);
                return value;
            }

            let pref = 1.0 / ((2.0 * PI).sqrt() * sig_z);
            let mut series = 0.0;
            let tol: f64 = 1e-14;
            let abs_cut = if tol < 1.0 {
                (-2.0 * square(sig_z) * tol.ln()).sqrt()
            } else {
                0.0
            };
            for n in -n_terms..=n_terms {
                let a = z - h + 2.0 * (n as f64) * hmix;
                let b = z + h + 2.0 * (n as f64) * hmix;
                let term_a = (-(square(a) / (2.0 * square(sig_z)))).exp();
                let term_b = (-(square(b) / (2.0 * square(sig_z)))).exp();
                series += term_a + term_b;
                if a.abs() > abs_cut && b.abs() > abs_cut {
                    break;
                }
            }
            let mut value = pref * series;

            if value <= 0.0 {
                let unbounded_pref = 1.0 / ((2.0 * PI).sqrt() * sig_z);
                value = unbounded_pref * (-(square(z - h) / (2.0 * square(sig_z)))).exp();
                if reflect_ground {
                    value += unbounded_pref * (-(square(z + h) / (2.0 * square(sig_z)))).exp();
                }
            }

            self.vertical_psi_cache.set(key, value);
            return value;
        }

        let pref = 1.0 / ((2.0 * PI).sqrt() * sig_z);
        let mut value = pref * (-(square(z - h) / (2.0 * square(sig_z)))).exp();
        if reflect_ground {
            value += pref * (-(square(z + h) / (2.0 * square(sig_z)))).exp();
        }
        self.vertical_psi_cache.set(key, value);
        value
    }

    pub fn dry_dep_fraction_remaining(
        &mut self,
        x_m: f64,
        opts: &GaussianOptions,
        v_d: Option<f64>,
        n_intervals: i64,
    ) -> f64 {
        let v_d = v_d.unwrap_or(opts.dry_deposition_velocity_m_s);
        if v_d <= 0.0 {
            return 1.0;
        }
        let x_end = x_m;
        if x_end <= 0.0 {
            return 1.0;
        }

        let class_text = if opts.stability_class.is_empty() {
            "D"
        } else {
            opts.stability_class.as_str()
        };
        let cache_key = DryDepKey {
            x_end: key_bits(x_end, 3),
            v_d: key_bits(v_d, 6),
            wind_speed: key_bits(opts.wind_speed_m_s, 3),
            stability_class: strip(class_text).to_uppercase(),
            mixing_height: opts.mixing_height_m.map(|height| key_bits(height, 3)),
            z_scale: key_bits(scale_or_one(opts.z_scale), 3),
            sigma_model: opts.sigma_model.clone(),
            sigma_v: key_bits(opts.sigma_v_m_s.unwrap_or(0.0), 5),
            sigma_w: key_bits(opts.sigma_w_m_s.unwrap_or(0.0), 5),
        };
        if let Some(cached) = self.dry_dep_cache.get(&cache_key) {
            return cached;
        }

        let u = opts.wind_speed_m_s;
        if u.abs() <= 1e-12 {
            self.dry_dep_cache.set(cache_key, 0.0);
            return 0.0;
        }

        let x0 = 1.0;

        if x_end <= x0 {
            let sig_z = opts_sigma_yz(x0, opts).1;
            let psi0 = self.vertical_psi(
                0.0,
                opts.plume_centerline_height_m,
                sig_z,
                opts.mixing_height_m,
                opts.reflect_ground,
                DEFAULT_N_TERMS,
                opts.well_mixed,
            );
            let exponent = -(v_d / u) * psi0 * x_end;
            let result = if exponent < -700.0 {
                0.0
            } else {
                exponent.exp()
            };
            self.dry_dep_cache.set(cache_key, result);
            return result;
        }

        if x_end >= 1000.0 {
            let mut remaining = 1.0;
            let mut previous = x0;
            let points = DEPOSITION_RADIAL_BREAKPOINTS
                .iter()
                .copied()
                .filter(|point| *point < x_end)
                .chain(std::iter::once(x_end));
            for current in points {
                if current <= previous {
                    continue;
                }
                let dx = current - previous;
                let sig_z =
                    0.5 * (opts_sigma_yz(previous, opts).1 + opts_sigma_yz(current, opts).1);
                let psi0 = self.vertical_psi(
                    0.0,
                    opts.plume_centerline_height_m,
                    sig_z,
                    opts.mixing_height_m,
                    opts.reflect_ground,
                    DEFAULT_N_TERMS,
                    opts.well_mixed,
                );
                let exponent = -(v_d / u) * psi0 * dx;
                if exponent < -700.0 {
                    remaining = 0.0;
                    break;
                }
                remaining *= exponent.exp();
                previous = current;
                if remaining <= 1e-12 {
                    remaining = 0.0;
                    break;
                }
            }
            self.dry_dep_cache.set(cache_key, remaining);
            return remaining;
        }

        let intervals = n_intervals.clamp(10, 2000);
        let log_x0 = x0.ln();
        let log_x1 = x_end.ln();
        let mut remaining = 1.0;
        let mut previous = x0;
        for step in 1..=intervals {
            let current = (log_x0 + (log_x1 - log_x0) * (step as f64) / (intervals as f64)).exp();
            let dx = current - previous;
            if dx <= 0.0 {
                previous = current;
                continue;
            }
            let sig_z = 0.5 * (opts_sigma_yz(previous, opts).1 + opts_sigma_yz(current, opts).1);
            let psi0 = self.vertical_psi(
                0.0,
                opts.plume_centerline_height_m,
                sig_z,
                opts.mixing_height_m,
                opts.reflect_ground,
                DEFAULT_N_TERMS,
                opts.well_mixed,
            );
            let exponent = -(v_d / u) * psi0 * dx;
            if exponent < -700.0 {
                remaining = 0.0;
                break;
            }
            remaining *= exponent.exp();
            previous = current;
            if remaining <= 1e-12 {
                remaining = 0.0;
                break;
            }
        }

        self.dry_dep_cache.set(cache_key, remaining);
        remaining
    }

    pub fn chi_over_q_gaussian(&mut self, receptor: &Receptor, opts: &GaussianOptions) -> f64 {
        let x = receptor.x_m;
        let y = receptor.y_m;
        let z = receptor.z_m;
        let u = opts.wind_speed_m_s;
        let h = opts.plume_centerline_height_m;

        let (sig_y, sig_z) = opts_sigma_yz(x, opts);

        let c_per_qdot = self.gaussian_plume(
            1.0,
            u,
            x,
            y,
            h,
            sig_y,
            sig_z,
            z,
            opts.mixing_height_m,
            opts.reflect_ground,
            DEFAULT_N_TERMS,
            opts.well_mixed,
        );
        let f_remain = if opts.dry_deposition_velocity_m_s > 0.0 {
            self.dry_dep_fraction_remaining(x, opts, None, DEFAULT_N_INTERVALS)
        } else {
            1.0
        };
        c_per_qdot * f_remain
    }

    #[allow(clippy::too_many_arguments)]
    fn compute_tede_at_distance(
        &mut self,
        source_term_bq: &[(String, f64)],
        distance_m: f64,
        receptor_z_m: f64,
        integration_time_s: f64,
        opts: &GaussianOptions,
        plume_segments: &[PlumeSegment],
        deposition_velocities_by_group: Option<&[f64]>,
    ) -> Result<f64, OpenRcError> {
        let receptor = Receptor {
            x_m: distance_m,
            y_m: 0.0,
            z_m: receptor_z_m,
        };
        let opts_no_recurse = GaussianOptions {
            compute_lmp: false,
            compute_epz: false,
            ..opts.clone()
        };
        let result = self.run_gaussian_tede(
            source_term_bq,
            &receptor,
            integration_time_s,
            Some(&opts_no_recurse),
            DEFAULT_ORGAN,
            plume_segments,
            deposition_velocities_by_group,
        )?;
        Ok(result.tede_sv)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn run_gaussian_tede(
        &mut self,
        source_term_bq: &[(String, f64)],
        receptor: &Receptor,
        integration_time_s: f64,
        opts: Option<&GaussianOptions>,
        organ_filter: &str,
        plume_segments: &[PlumeSegment],
        deposition_velocities_by_group: Option<&[f64]>,
    ) -> Result<RunResult, OpenRcError> {
        let default_opts = GaussianOptions::default();
        let opts = opts.unwrap_or(&default_opts);

        if plume_segments.is_empty() {
            return Err(OpenRcError::InvalidValue(
                "plume_segments is required and must not be empty".to_string(),
            ));
        }

        let t_full = integration_time_s;
        if t_full <= 0.0 {
            return Err(OpenRcError::InvalidValue(
                "integration_time_s must be > 0".to_string(),
            ));
        }

        let supplied_dcf = self.dcf_data.clone();
        let dcf_raw: &Value = match &supplied_dcf {
            Some(data) => data,
            None => load_dcf_data(None)?,
        };
        let dcf = dcf_for_organ(dcf_raw, organ_filter);
        let supplied_decay = self.decay_data.clone();
        let decay: &Value = if opts.include_ingrowth || opts.simple_decay_at_receptor {
            match &supplied_decay {
                Some(data) => data,
                None => load_decay_data(None)?,
            }
        } else {
            empty_object()
        };

        let dry_dep_fraction = self.dry_dep_fraction_remaining(
            receptor.x_m,
            opts,
            Some(opts.dry_deposition_velocity_m_s),
            DEFAULT_N_INTERVALS,
        );
        let chi_over_q = self.chi_over_q_gaussian(receptor, opts);

        let u = opts.wind_speed_m_s;
        let x = receptor.x_m;
        let travel_time = x / max_of(u.abs(), 1e-12);

        let (sig_y, sig_z) = opts_sigma_yz(x, opts);

        let mut chi_total = 0.0;
        let mut tede_total = 0.0;
        let mut dep_total_bq_m2 = 0.0;
        let mut breakdown: IndexMap<String, f64> = IndexMap::new();
        let mut missing_dcfs: BTreeSet<String> = BTreeSet::new();
        let mut segment_depositions: Vec<(f64, Vec<(String, f64)>)> = Vec::new();

        for segment in plume_segments {
            let seg_delay_s = segment.delay_s;
            let seg_duration_s = segment.duration_s;

            if seg_duration_s <= 0.0 {
                continue;
            }

            let release_fracs_by_group = &segment.release_fractions_by_group;
            if release_fracs_by_group.is_empty()
                || sum_floats(release_fracs_by_group.iter().copied()) == 0.0
            {
                continue;
            }

            let seg_deposition_end_time = seg_delay_s + travel_time + seg_duration_s;

            let mut release_rates_seg: IndexMap<String, f64> = IndexMap::new();
            for (nuclide, total_bq) in source_term_bq {
                let Some(group_idx) = chemical_group_for_nuclide(nuclide) else {
                    continue;
                };
                if !(1..=release_fracs_by_group.len()).contains(&group_idx) {
                    continue;
                }
                let group_frac = release_fracs_by_group[group_idx - 1];
                if group_frac > 0.0 {
                    release_rates_seg
                        .insert(nuclide.clone(), total_bq * group_frac / seg_duration_s);
                }
            }

            let seg_arrival_time = seg_delay_s + travel_time;
            let mut eff_release_rates: IndexMap<String, f64> = IndexMap::new();
            if opts.include_ingrowth {
                let mut decay_fractions_seg: IndexMap<String, IndexMap<String, f64>> =
                    IndexMap::new();
                for parent in release_rates_seg.keys() {
                    let fractions_by_age = simulate_decay_chain_activity_fractions(
                        parent,
                        decay,
                        &[0.0, seg_arrival_time],
                        opts.collapse_half_life_sec,
                    )?;
                    let fractions = fractions_by_age
                        .into_iter()
                        .find(|(time, _)| *time == seg_arrival_time)
                        .map(|(_, fractions)| fractions)
                        .unwrap_or_else(|| IndexMap::from([(parent.clone(), 1.0)]));
                    decay_fractions_seg.insert(parent.clone(), fractions);
                }
                for (parent, qdot) in &release_rates_seg {
                    if *qdot <= 0.0 {
                        continue;
                    }
                    for (nuclide, fraction) in &decay_fractions_seg[parent] {
                        if *fraction > 0.0 {
                            *eff_release_rates.entry(nuclide.clone()).or_insert(0.0) +=
                                qdot * fraction;
                        }
                    }
                }
            } else if opts.simple_decay_at_receptor {
                for (parent, qdot) in &release_rates_seg {
                    if *qdot <= 0.0 {
                        continue;
                    }
                    let half_life = half_life_sec(decay.get(parent.as_str()), 0.0)?;
                    eff_release_rates.insert(
                        parent.clone(),
                        qdot * decay_fraction_at_time(half_life, seg_arrival_time),
                    );
                }
            } else {
                eff_release_rates = release_rates_seg.clone();
            }

            let seg_height_m = segment.height_m;
            let unit_c_receptor = self.gaussian_plume(
                1.0,
                opts.wind_speed_m_s,
                receptor.x_m,
                receptor.y_m,
                seg_height_m,
                sig_y,
                sig_z,
                receptor.z_m,
                opts.mixing_height_m,
                opts.reflect_ground,
                DEFAULT_N_TERMS,
                opts.well_mixed,
            );
            let mut unit_c_ground: Option<f64> = None;
            if eff_release_rates.keys().any(|nuclide| {
                deposition_velocity_for_nuclide(nuclide, deposition_velocities_by_group) > 0.0
            }) {
                unit_c_ground = Some(self.gaussian_plume(
                    1.0,
                    opts.wind_speed_m_s,
                    receptor.x_m,
                    receptor.y_m,
                    seg_height_m,
                    sig_y,
                    sig_z,
                    0.0,
                    opts.mixing_height_m,
                    opts.reflect_ground,
                    DEFAULT_N_TERMS,
                    opts.well_mixed,
                ));
            }

            let mut seg_dep_by_nuclide: Vec<(String, f64)> = Vec::new();
            for (nuclide, qdot_eff) in &eff_release_rates {
                if *qdot_eff <= 0.0 {
                    continue;
                }
                let dcfs = match dcf.get(nuclide.as_str()) {
                    Some(values) if !values.is_null() => *values,
                    _ => {
                        missing_dcfs.insert(nuclide.clone());
                        continue;
                    }
                };

                let v_d = deposition_velocity_for_nuclide(nuclide, deposition_velocities_by_group);
                let nuc_dep_fraction = if v_d > 0.0 {
                    self.dry_dep_fraction_remaining(
                        receptor.x_m,
                        opts,
                        Some(v_d),
                        DEFAULT_N_INTERVALS,
                    )
                } else {
                    1.0
                };
                let qdot_transported = qdot_eff * nuc_dep_fraction;
                let concentration = unit_c_receptor * qdot_transported;
                chi_total += concentration * seg_duration_s;

                if v_d > 0.0 {
                    let unit_ground = match unit_c_ground {
                        Some(value) if value != 0.0 => value,
                        _ => unit_c_receptor,
                    };
                    let c_ground = unit_ground * qdot_transported;
                    let dep_i_bq_m2 = v_d * c_ground * seg_duration_s;
                    seg_dep_by_nuclide.push((nuclide.clone(), dep_i_bq_m2));
                    dep_total_bq_m2 += dep_i_bq_m2;
                }

                let dose_inhale_cloud = concentration
                    * BREATHING_RATE_M3_S
                    * safe_dcf(Some(dcfs), "inhalation_chronic")?
                    * seg_duration_s
                    + concentration * safe_dcf(Some(dcfs), "cloudshine")? * seg_duration_s;
                if dose_inhale_cloud != 0.0 {
                    *breakdown.entry(nuclide.clone()).or_insert(0.0) += dose_inhale_cloud;
                }
                tede_total += dose_inhale_cloud;
            }

            segment_depositions.push((seg_deposition_end_time, seg_dep_by_nuclide));
        }

        for (seg_depo_end_time, seg_dep) in &segment_depositions {
            let groundshine_time = max_of(0.0, t_full - seg_depo_end_time);
            if groundshine_time <= 0.0 {
                continue;
            }
            for (nuclide, dep_bq_m2) in seg_dep {
                if *dep_bq_m2 <= 0.0 {
                    continue;
                }
                let dcfs = match dcf.get(nuclide.as_str()) {
                    Some(values) if !values.is_null() => *values,
                    _ => continue,
                };
                let dose_groundshine =
                    dep_bq_m2 * safe_dcf(Some(dcfs), "groundshine_rate")? * groundshine_time;
                if dose_groundshine != 0.0 {
                    *breakdown.entry(nuclide.clone()).or_insert(0.0) += dose_groundshine;
                }
                tede_total += dose_groundshine;
            }
        }

        let mut lmp_tede = 0.0;
        if opts.compute_lmp {
            lmp_tede = self.compute_tede_at_distance(
                source_term_bq,
                EAB_DISTANCE_M,
                receptor.z_m,
                t_full,
                opts,
                plume_segments,
                deposition_velocities_by_group,
            )?;
        }

        let mut epz_distance_m = 0.0;
        if opts.compute_epz && tede_total > DOSE_LIMIT_SV {
            let mut dist_min = 100.0;
            let mut dist_max = 100_000.0;
            for _ in 0..20 {
                let dist_mid = (dist_min + dist_max) / 2.0;
                let dose_mid = self.compute_tede_at_distance(
                    source_term_bq,
                    dist_mid,
                    receptor.z_m,
                    t_full,
                    opts,
                    plume_segments,
                    deposition_velocities_by_group,
                )?;
                if dose_mid > DOSE_LIMIT_SV {
                    dist_min = dist_mid;
                } else {
                    dist_max = dist_mid;
                }
            }
            epz_distance_m = dist_max;
        }

        Ok(RunResult {
            chi_over_q_s_m3: chi_over_q,
            chi_bq_s_m3: chi_total,
            tede_sv: tede_total,
            breakdown_sv_by_nuclide: breakdown.into_iter().collect(),
            dry_dep_fraction_remaining: dry_dep_fraction,
            ground_deposition_bq_m2: dep_total_bq_m2,
            missing_dcfs: missing_dcfs.into_iter().collect(),
            lmp_chi_over_q_s_m3: 0.0,
            lmp_tede_sv: lmp_tede,
            epz_distance_m,
        })
    }

    #[allow(clippy::too_many_arguments)]
    pub fn run_gaussian_polar(
        &mut self,
        source_term_bq: &[(String, f64)],
        sector_count: i64,
        ring_distances_m: &[f64],
        wind_dir_deg: f64,
        integration_time_s: f64,
        opts: Option<&GaussianOptions>,
        organ_filter: &str,
        plume_segments: &[PlumeSegment],
        deposition_velocities_by_group: Option<&[f64]>,
        segment_met_records: Option<&[MetRecord]>,
    ) -> Result<PolarRunResult, OpenRcError> {
        let default_opts = GaussianOptions::default();
        let opts = opts.unwrap_or(&default_opts);
        if plume_segments.is_empty() {
            return Err(OpenRcError::InvalidValue(
                "plume_segments is required and must not be empty".to_string(),
            ));
        }

        let t_full = integration_time_s;
        if t_full <= 0.0 {
            return Err(OpenRcError::InvalidValue(
                "integration_time_s must be > 0".to_string(),
            ));
        }

        let supplied_dcf = self.dcf_data.clone();
        let dcf_raw: &Value = match &supplied_dcf {
            Some(data) => data,
            None => load_dcf_data(None)?,
        };
        let dcf = dcf_for_organ(dcf_raw, organ_filter);
        let supplied_decay = self.decay_data.clone();
        let decay: &Value = if opts.include_ingrowth || opts.simple_decay_at_receptor {
            match &supplied_decay {
                Some(data) => data,
                None => load_decay_data(None)?,
            }
        } else {
            empty_object()
        };

        let sectors = sector_count.max(0) as usize;
        let rings: Vec<f64> = ring_distances_m.to_vec();
        let ring_count = rings.len();
        let delta_theta = divide(2.0 * PI, sector_count as f64)?;
        let u = opts.wind_speed_m_s;
        if u.abs() < 1e-12 {
            return Err(OpenRcError::InvalidValue(
                "wind_speed_m_s must be > 0 for polar grid run".to_string(),
            ));
        }

        let sector_az: Vec<f64> = (0..sectors)
            .map(|index| (index as f64) * 360.0 / (sector_count as f64))
            .collect();

        let downwind_az = modulo(wind_dir_deg + 180.0, 360.0);

        let mut chi_q = vec![vec![0.0; ring_count]; sectors];
        let mut air_conc = vec![vec![0.0; ring_count]; sectors];
        let mut grd_dep = vec![vec![0.0; ring_count]; sectors];
        let mut cloud_sv = vec![vec![0.0; ring_count]; sectors];
        let mut grnd_sv = vec![vec![0.0; ring_count]; sectors];
        let mut inhl_sv = vec![vec![0.0; ring_count]; sectors];

        let mut missing_dcfs: BTreeSet<String> = BTreeSet::new();

        let first_height = plume_segments[0].height_m;
        for (ring_index, &ring) in rings.iter().enumerate() {
            let (sy, sz) = opts_sigma_yz(ring, opts);
            let psi = self.vertical_psi(
                0.0,
                first_height,
                sz,
                opts.mixing_height_m,
                opts.reflect_ground,
                DEFAULT_N_TERMS,
                opts.well_mixed,
            );
            for (sector_index, &azimuth) in sector_az.iter().enumerate() {
                let crosswind = crosswind_fraction(azimuth, downwind_az, ring, sy, delta_theta)?;
                chi_q[sector_index][ring_index] = divide(crosswind * psi, u * ring * delta_theta)?;
            }
        }

        for (seg_idx, segment) in plume_segments.iter().enumerate() {
            let (seg_wind_dir, seg_stab, seg_u, seg_mh, seg_sv, seg_sw) = match segment_met_records
            {
                Some(records) if !records.is_empty() => {
                    let seg_met = &records[seg_idx.min(records.len() - 1)];
                    (
                        seg_met.wind_dir_deg.unwrap_or(wind_dir_deg),
                        seg_met.stability_class.clone(),
                        seg_met.wind_speed_m_s,
                        seg_met.mixing_height_m.or(opts.mixing_height_m),
                        seg_met.sigma_v_m_s,
                        seg_met.sigma_w_m_s,
                    )
                }
                _ => (
                    wind_dir_deg,
                    opts.stability_class.clone(),
                    u,
                    opts.mixing_height_m,
                    opts.sigma_v_m_s,
                    opts.sigma_w_m_s,
                ),
            };
            if seg_u.abs() < 1e-12 {
                continue;
            }
            let seg_downwind_az = modulo(seg_wind_dir + 180.0, 360.0);

            let seg_delay = segment.delay_s;
            let seg_dur = segment.duration_s;
            let seg_height = segment.height_m;
            let rel_fracs = &segment.release_fractions_by_group;
            if seg_dur <= 0.0
                || rel_fracs.is_empty()
                || sum_floats(rel_fracs.iter().copied()) == 0.0
            {
                continue;
            }

            let opts_seg = GaussianOptions {
                plume_centerline_height_m: seg_height,
                stability_class: seg_stab,
                wind_speed_m_s: seg_u,
                mixing_height_m: seg_mh,
                sigma_v_m_s: seg_sv,
                sigma_w_m_s: seg_sw,
                ..opts.clone()
            };

            for (ring_index, &ring) in rings.iter().enumerate() {
                let travel_time = ring / seg_u;
                let (sy, sz) = opts_sigma_yz(ring, &opts_seg);

                let psi = self.vertical_psi(
                    0.0,
                    seg_height,
                    sz,
                    seg_mh,
                    opts.reflect_ground,
                    DEFAULT_N_TERMS,
                    opts.well_mixed,
                );

                let seg_arrival = seg_delay + travel_time;
                let seg_dep_end = seg_arrival + seg_dur;
                let groundshine_t = max_of(0.0, t_full - seg_dep_end);

                let mut eff_rates: Vec<(&str, f64)> = Vec::new();
                for (nuclide, total_bq) in source_term_bq {
                    let Some(group) = chemical_group_for_nuclide(nuclide) else {
                        continue;
                    };
                    if !(1..=rel_fracs.len()).contains(&group) {
                        continue;
                    }
                    let fraction = rel_fracs[group - 1];
                    if fraction <= 0.0 {
                        continue;
                    }
                    let mut qdot = total_bq * fraction / seg_dur;
                    if opts.simple_decay_at_receptor {
                        let half_life = half_life_sec(decay.get(nuclide.as_str()), 0.0)?;
                        qdot *= decay_fraction_at_time(half_life, seg_arrival);
                    }
                    if qdot > 0.0 {
                        eff_rates.push((nuclide.as_str(), qdot));
                    }
                }

                let mut dep_fracs: Vec<f64> = Vec::with_capacity(eff_rates.len());
                for (nuclide, _) in &eff_rates {
                    let v_d =
                        deposition_velocity_for_nuclide(nuclide, deposition_velocities_by_group);
                    dep_fracs.push(if v_d > 0.0 {
                        self.dry_dep_fraction_remaining(
                            ring,
                            &opts_seg,
                            Some(v_d),
                            DEFAULT_N_INTERVALS,
                        )
                    } else {
                        1.0
                    });
                }

                for (sector_index, &azimuth) in sector_az.iter().enumerate() {
                    let crosswind =
                        crosswind_fraction(azimuth, seg_downwind_az, ring, sy, delta_theta)?;
                    let cq = divide(crosswind * psi, seg_u * ring * delta_theta)?;

                    for (rate_index, (nuclide, qdot)) in eff_rates.iter().enumerate() {
                        let dcfs_n = match dcf.get(nuclide) {
                            Some(values) if !values.is_null() => *values,
                            _ => {
                                missing_dcfs.insert((*nuclide).to_string());
                                continue;
                            }
                        };

                        let v_d = deposition_velocity_for_nuclide(
                            nuclide,
                            deposition_velocities_by_group,
                        );
                        let qdot_t = qdot * dep_fracs[rate_index];
                        let chi_int = qdot_t * cq * seg_dur;

                        air_conc[sector_index][ring_index] += chi_int;
                        inhl_sv[sector_index][ring_index] += chi_int
                            * BREATHING_RATE_M3_S
                            * safe_dcf(Some(dcfs_n), "inhalation_chronic")?;
                        cloud_sv[sector_index][ring_index] +=
                            chi_int * safe_dcf(Some(dcfs_n), "cloudshine")?;

                        let dep_i = if v_d > 0.0 { v_d * chi_int } else { 0.0 };
                        grd_dep[sector_index][ring_index] += dep_i;
                        grnd_sv[sector_index][ring_index] +=
                            dep_i * safe_dcf(Some(dcfs_n), "groundshine_rate")? * groundshine_t;
                    }
                }
            }
        }

        let mut tede = vec![vec![0.0; ring_count]; sectors];
        for sector_index in 0..sectors {
            for ring_index in 0..ring_count {
                air_conc[sector_index][ring_index] /= t_full;
                tede[sector_index][ring_index] = inhl_sv[sector_index][ring_index]
                    + cloud_sv[sector_index][ring_index]
                    + grnd_sv[sector_index][ring_index];
            }
        }

        Ok(PolarRunResult {
            sector_azimuths_deg: sector_az,
            ring_distances_m: rings,
            wind_dir_deg,
            chi_q_s_m3: chi_q,
            air_conc_bq_m3: air_conc,
            ground_dep_bq_m2: grd_dep,
            cloudshine_sv: cloud_sv,
            groundshine_sv: grnd_sv,
            inhalation_sv: inhl_sv,
            tede_sv: tede,
            missing_dcfs: missing_dcfs.into_iter().collect(),
        })
    }
}
