use std::fs;
use std::io::{self, Write};

use crate::config::{load_config, parse_config, OpenRcConfig};
use crate::error::OpenRcError;
use crate::json::{object_insert, to_indented_text, JsonValue};
use crate::met::{load_met, parse_met, MetRecord};
use crate::number::{max_of, min_of, modulo, sum_floats};
use crate::rcad::{Engine, GaussianOptions, PolarRunResult, Receptor, RunResult};
use crate::rcre::compute_segment_releases;
use crate::sort::{order_by_key, sort_floats};
use crate::text::{format_exp, format_fixed, pad_left, pad_right, path_text, repr_float};

pub fn percentile(sorted_values: &[f64], p: f64) -> f64 {
    let count = sorted_values.len();
    if count <= 1 {
        return sorted_values.first().copied().unwrap_or(f64::NAN);
    }
    let index = p / 100.0 * ((count - 1) as f64);
    let low = index as usize;
    let high = (low + 1).min(count - 1);
    sorted_values[low] + (index - low as f64) * (sorted_values[high] - sorted_values[low])
}

pub fn downwind_sector_index(sector_azimuths_deg: &[f64], wind_dir_deg: f64) -> usize {
    let downwind = modulo(wind_dir_deg + 180.0, 360.0);
    let mut best = 999.0;
    let mut best_index = 0;
    for (index, azimuth) in sector_azimuths_deg.iter().enumerate() {
        let difference = (modulo(azimuth - downwind + 180.0 + 360.0, 360.0) - 180.0).abs();
        if difference < best {
            best = difference;
            best_index = index;
        }
    }
    best_index
}

fn emit(console: &mut dyn Write, line: &str) -> Result<(), OpenRcError> {
    writeln!(console, "{line}").map_err(|error| OpenRcError::Io(error.to_string()))
}

fn sorted_ascending(mut values: Vec<f64>) -> Vec<f64> {
    sort_floats(&mut values);
    values
}

fn largest(values: &[f64]) -> Result<f64, OpenRcError> {
    let mut iterator = values.iter().copied();
    let first = iterator
        .next()
        .ok_or_else(|| OpenRcError::InvalidValue("max() arg is an empty sequence".to_string()))?;
    Ok(iterator.fold(first, max_of))
}

fn smallest(values: &[f64]) -> Result<f64, OpenRcError> {
    let mut iterator = values.iter().copied();
    let first = iterator
        .next()
        .ok_or_else(|| OpenRcError::InvalidValue("min() arg is an empty sequence".to_string()))?;
    Ok(iterator.fold(first, min_of))
}

fn out_of_range() -> OpenRcError {
    OpenRcError::OutOfRange("list index out of range".to_string())
}

fn integer_text(value: f64) -> Result<String, OpenRcError> {
    if value.is_nan() {
        return Err(OpenRcError::InvalidValue(
            "cannot convert float NaN to integer".to_string(),
        ));
    }
    if value.is_infinite() {
        return Err(OpenRcError::InvalidValue(
            "cannot convert float infinity to integer".to_string(),
        ));
    }
    let truncated = value.trunc();
    if truncated == 0.0 {
        return Ok("0".to_string());
    }
    Ok(format!("{truncated:.0}"))
}

fn options_for(
    cfg: &OpenRcConfig,
    record: &MetRecord,
    release_height: f64,
    centerline: bool,
) -> GaussianOptions {
    GaussianOptions {
        wind_speed_m_s: record.wind_speed_m_s,
        stability_class: record.stability_class.clone(),
        mixing_height_m: record.mixing_height_m.or(cfg.mixing_height_m),
        plume_centerline_height_m: release_height,
        dry_deposition_velocity_m_s: cfg.dry_deposition_velocity_m_s,
        reflect_ground: true,
        well_mixed: false,
        include_ingrowth: cfg.include_ingrowth,
        simple_decay_at_receptor: cfg.simple_decay_at_receptor,
        collapse_half_life_sec: cfg.collapse_half_life_sec,
        compute_lmp: centerline && cfg.mode == "lmp",
        compute_epz: centerline && cfg.mode == "epz",
        sigma_model: cfg.sigma_model.clone(),
        measurement_height_m: cfg.measurement_height_m,
        displacement_height_m: cfg.displacement_height_m,
        sigma_v_m_s: record.sigma_v_m_s,
        sigma_w_m_s: record.sigma_w_m_s,
        ..GaussianOptions::default()
    }
}

fn write_results(
    cfg: &OpenRcConfig,
    summary: &JsonValue,
    console: &mut dyn Write,
) -> Result<(), OpenRcError> {
    fs::create_dir_all(&cfg.output_dir)
        .map_err(|error| OpenRcError::Io(format!("{}: {error}", path_text(&cfg.output_dir))))?;
    let out_path = cfg
        .output_dir
        .join(format!("{}_results.json", cfg.case_name));
    let text = to_indented_text(summary);
    let content = if cfg!(windows) {
        text.replace('\n', "\r\n")
    } else {
        text
    };
    fs::write(&out_path, content)
        .map_err(|error| OpenRcError::Io(format!("{}: {error}", path_text(&out_path))))?;
    emit(console, "")?;
    emit(
        console,
        &format!("Results written to: {}", path_text(&out_path)),
    )
}

fn grid_object(result: &PolarRunResult) -> JsonValue {
    JsonValue::Object(vec![
        (
            "chi_q_s_m3".to_string(),
            JsonValue::grid(&result.chi_q_s_m3),
        ),
        (
            "air_conc_bq_m3".to_string(),
            JsonValue::grid(&result.air_conc_bq_m3),
        ),
        (
            "ground_dep_bq_m2".to_string(),
            JsonValue::grid(&result.ground_dep_bq_m2),
        ),
        (
            "cloudshine_sv".to_string(),
            JsonValue::grid(&result.cloudshine_sv),
        ),
        (
            "groundshine_sv".to_string(),
            JsonValue::grid(&result.groundshine_sv),
        ),
        (
            "inhalation_sv".to_string(),
            JsonValue::grid(&result.inhalation_sv),
        ),
        ("tede_sv".to_string(), JsonValue::grid(&result.tede_sv)),
    ])
}

fn max_sector_tede(
    result: &PolarRunResult,
    sector_count: i64,
    ring_index: usize,
) -> Result<f64, OpenRcError> {
    let mut values: Vec<f64> = Vec::new();
    for sector_index in 0..sector_count.max(0) as usize {
        let value = result
            .tede_sv
            .get(sector_index)
            .and_then(|row| row.get(ring_index))
            .ok_or_else(out_of_range)?;
        values.push(*value);
    }
    largest(&values)
}

fn run_centerline(
    cfg: &OpenRcConfig,
    met_records: &[MetRecord],
    release_height: f64,
    console: &mut dyn Write,
) -> Result<Vec<RunResult>, OpenRcError> {
    let count = met_records.len();
    let receptor = Receptor {
        x_m: cfg.receptor_x_m,
        y_m: cfg.receptor_y_m,
        z_m: cfg.receptor_z_m,
    };
    let mut engine = Engine::new();
    let mut results: Vec<RunResult> = Vec::with_capacity(count);

    for (index, record) in met_records.iter().enumerate() {
        let opts = options_for(cfg, record, release_height, true);
        let result = engine.run_gaussian_tede(
            &cfg.source_term_bq,
            &receptor,
            cfg.integration_time_s,
            Some(&opts),
            &cfg.dcf_organ,
            &cfg.plume_segments,
            Some(&cfg.deposition_velocities_by_group),
        )?;
        results.push(result);
        if count > 1 && (index + 1) % (count / 10).max(1) == 0 {
            emit(
                console,
                &format!("  {}/{} realizations complete ...", index + 1, count),
            )?;
        }
    }

    emit(console, "")?;
    emit(console, &"=".repeat(60))?;

    if count == 1 {
        let result = &results[0];
        emit(
            console,
            &format!(
                "  TEDE             : {} mSv  ({} Sv)",
                format_fixed(result.tede_sv * 1000.0, 4),
                format_exp(result.tede_sv, 4)
            ),
        )?;
        emit(
            console,
            &format!(
                "  chi/Q            : {} s/m\u{b3}",
                format_exp(result.chi_over_q_s_m3, 4)
            ),
        )?;
        emit(
            console,
            &format!(
                "  Ground dep total : {} Bq/m\u{b2}",
                format_exp(result.ground_deposition_bq_m2, 4)
            ),
        )?;
        if cfg.mode == "lmp" {
            emit(
                console,
                &format!(
                    "  LMP TEDE (756 m) : {} mSv  (30-day at EAB)",
                    format_fixed(result.lmp_tede_sv * 1000.0, 4)
                ),
            )?;
        } else if cfg.mode == "epz" && result.epz_distance_m > 0.0 {
            emit(
                console,
                &format!(
                    "  EPZ distance     : {} m  (1-rem boundary)",
                    format_fixed(result.epz_distance_m, 0)
                ),
            )?;
        }
        if !result.missing_dcfs.is_empty() {
            emit(
                console,
                &format!("  Missing DCFs     : {}", result.missing_dcfs.join(", ")),
            )?;
        }
        emit(console, &"=".repeat(60))?;
        if !result.breakdown_sv_by_nuclide.is_empty() {
            emit(console, "")?;
            emit(console, "Top 10 nuclide contributors to TEDE:")?;
            for (nuclide, dose_sv) in ranked_breakdown(result).iter().take(10) {
                let percent = if result.tede_sv != 0.0 {
                    dose_sv / result.tede_sv * 100.0
                } else {
                    0.0
                };
                emit(
                    console,
                    &format!(
                        "  {} {} mSv  ({}%)",
                        pad_right(nuclide, 12),
                        format_fixed(dose_sv * 1000.0, 4),
                        format_fixed(percent, 1)
                    ),
                )?;
            }
        }
    } else {
        let tede_sv = sorted_ascending(results.iter().map(|result| result.tede_sv).collect());
        let lmp_sv = if cfg.mode == "lmp" {
            Some(sorted_ascending(
                results.iter().map(|result| result.lmp_tede_sv).collect(),
            ))
        } else {
            None
        };
        let mut worst_index = 0;
        for (index, result) in results.iter().enumerate() {
            if result.tede_sv > results[worst_index].tede_sv {
                worst_index = index;
            }
        }
        let worst = &results[worst_index];
        emit(console, &format!("  Realizations     : {count}"))?;
        emit(
            console,
            &format!(
                "  TEDE  5th pct    : {} mSv",
                format_fixed(percentile(&tede_sv, 5.0) * 1000.0, 2)
            ),
        )?;
        emit(
            console,
            &format!(
                "  TEDE 50th pct    : {} mSv",
                format_fixed(percentile(&tede_sv, 50.0) * 1000.0, 2)
            ),
        )?;
        emit(
            console,
            &format!(
                "  TEDE 95th pct    : {} mSv",
                format_fixed(percentile(&tede_sv, 95.0) * 1000.0, 2)
            ),
        )?;
        emit(
            console,
            &format!(
                "  TEDE max         : {} mSv  (class {}, {} m/s)",
                format_fixed(worst.tede_sv * 1000.0, 2),
                met_records[worst_index].stability_class,
                repr_float(met_records[worst_index].wind_speed_m_s)
            ),
        )?;
        if let Some(lmp_sv) = lmp_sv.as_ref().filter(|values| !values.is_empty()) {
            emit(
                console,
                &format!(
                    "  LMP  50th pct    : {} mSv  (at EAB)",
                    format_fixed(percentile(lmp_sv, 50.0) * 1000.0, 2)
                ),
            )?;
            emit(
                console,
                &format!(
                    "  LMP  95th pct    : {} mSv  (at EAB)",
                    format_fixed(percentile(lmp_sv, 95.0) * 1000.0, 2)
                ),
            )?;
        }
        emit(console, &"=".repeat(60))?;
    }

    Ok(results)
}

fn centerline_summary(
    cfg: &OpenRcConfig,
    met_records: &[MetRecord],
    results: &[RunResult],
) -> Result<JsonValue, OpenRcError> {
    let count = met_records.len();
    let summary = if count == 1 {
        let result = &results[0];
        JsonValue::Object(vec![
            ("case_name".to_string(), JsonValue::text(&cfg.case_name)),
            ("geometry".to_string(), JsonValue::text("centerline")),
            ("mode".to_string(), JsonValue::text(&cfg.mode)),
            (
                "receptor_x_m".to_string(),
                JsonValue::Float(cfg.receptor_x_m),
            ),
            (
                "stability_class".to_string(),
                JsonValue::text(&met_records[0].stability_class),
            ),
            (
                "wind_speed_m_s".to_string(),
                JsonValue::Float(met_records[0].wind_speed_m_s),
            ),
            ("tede_sv".to_string(), JsonValue::Float(result.tede_sv)),
            (
                "tede_msv".to_string(),
                JsonValue::Float(result.tede_sv * 1000.0),
            ),
            (
                "chi_over_q_s_m3".to_string(),
                JsonValue::Float(result.chi_over_q_s_m3),
            ),
            (
                "ground_deposition_bq_m2".to_string(),
                JsonValue::Float(result.ground_deposition_bq_m2),
            ),
            (
                "lmp_tede_sv".to_string(),
                JsonValue::Float(result.lmp_tede_sv),
            ),
            (
                "epz_distance_m".to_string(),
                JsonValue::Float(result.epz_distance_m),
            ),
            (
                "missing_dcfs".to_string(),
                JsonValue::texts(&result.missing_dcfs),
            ),
            (
                "breakdown_msv".to_string(),
                JsonValue::Object(
                    ranked_breakdown(result)
                        .into_iter()
                        .map(|(nuclide, dose_sv)| {
                            (nuclide.to_string(), JsonValue::Float(dose_sv * 1000.0))
                        })
                        .collect(),
                ),
            ),
        ])
    } else {
        let tede_sv: Vec<f64> = results.iter().map(|result| result.tede_sv).collect();
        let sorted = sorted_ascending(tede_sv.clone());
        let realizations: Vec<JsonValue> = results
            .iter()
            .enumerate()
            .map(|(index, result)| {
                JsonValue::Object(vec![
                    ("index".to_string(), JsonValue::Int(index as i64)),
                    (
                        "stability_class".to_string(),
                        JsonValue::text(&met_records[index].stability_class),
                    ),
                    (
                        "wind_speed_m_s".to_string(),
                        JsonValue::Float(met_records[index].wind_speed_m_s),
                    ),
                    (
                        "wind_dir_deg".to_string(),
                        JsonValue::optional_float(met_records[index].wind_dir_deg),
                    ),
                    (
                        "tede_msv".to_string(),
                        JsonValue::Float(result.tede_sv * 1000.0),
                    ),
                    (
                        "lmp_tede_msv".to_string(),
                        JsonValue::Float(result.lmp_tede_sv * 1000.0),
                    ),
                    (
                        "chi_over_q_s_m3".to_string(),
                        JsonValue::Float(result.chi_over_q_s_m3),
                    ),
                ])
            })
            .collect();
        JsonValue::Object(vec![
            ("case_name".to_string(), JsonValue::text(&cfg.case_name)),
            ("geometry".to_string(), JsonValue::text("centerline")),
            ("mode".to_string(), JsonValue::text(&cfg.mode)),
            (
                "receptor_x_m".to_string(),
                JsonValue::Float(cfg.receptor_x_m),
            ),
            ("n_realizations".to_string(), JsonValue::Int(count as i64)),
            (
                "tede_msv".to_string(),
                JsonValue::Object(vec![
                    (
                        "p05".to_string(),
                        JsonValue::Float(percentile(&sorted, 5.0) * 1000.0),
                    ),
                    (
                        "p50".to_string(),
                        JsonValue::Float(percentile(&sorted, 50.0) * 1000.0),
                    ),
                    (
                        "p95".to_string(),
                        JsonValue::Float(percentile(&sorted, 95.0) * 1000.0),
                    ),
                    (
                        "max".to_string(),
                        JsonValue::Float(largest(&tede_sv)? * 1000.0),
                    ),
                    (
                        "min".to_string(),
                        JsonValue::Float(smallest(&tede_sv)? * 1000.0),
                    ),
                ]),
            ),
            ("realizations".to_string(), JsonValue::List(realizations)),
        ])
    };
    Ok(summary)
}

fn ranked_breakdown(result: &RunResult) -> Vec<(&str, f64)> {
    let doses: Vec<f64> = result
        .breakdown_sv_by_nuclide
        .iter()
        .map(|(_, dose_sv)| *dose_sv)
        .collect();
    order_by_key(&doses, true)
        .into_iter()
        .map(|index| {
            let (nuclide, dose_sv) = &result.breakdown_sv_by_nuclide[index];
            (nuclide.as_str(), *dose_sv)
        })
        .collect()
}

fn segment_record_index(
    delay_s: f64,
    met_period_s: f64,
    count: usize,
) -> Result<usize, OpenRcError> {
    if met_period_s == 0.0 {
        return Err(OpenRcError::ZeroDivision(
            "float division by zero".to_string(),
        ));
    }
    let ratio = delay_s / met_period_s;
    if ratio.is_nan() {
        return Err(OpenRcError::InvalidValue(
            "cannot convert float NaN to integer".to_string(),
        ));
    }
    if ratio.is_infinite() {
        return Err(OpenRcError::InvalidValue(
            "cannot convert float infinity to integer".to_string(),
        ));
    }
    let truncated = ratio.trunc();
    let last = count as f64 - 1.0;
    let chosen = if last < truncated { last } else { truncated };
    let wrapped = if chosen < 0.0 {
        chosen + count as f64
    } else {
        chosen
    };
    if wrapped < 0.0 {
        return Err(out_of_range());
    }
    Ok(wrapped as usize)
}

struct PolarOutcome {
    results: Vec<PolarRunResult>,
    segment_met: Option<Vec<MetRecord>>,
}

fn wind_shift_records(
    cfg: &OpenRcConfig,
    met_records: &[MetRecord],
) -> Result<Vec<MetRecord>, OpenRcError> {
    let count = met_records.len();
    let mut selected: Vec<MetRecord> = Vec::with_capacity(cfg.plume_segments.len());
    for (segment_index, segment) in cfg.plume_segments.iter().enumerate() {
        let record_index = segment_record_index(segment.delay_s, cfg.met_period_s, count)?;
        let record = &met_records[record_index];
        if record.wind_dir_deg.is_none() {
            return Err(OpenRcError::InvalidValue(format!(
                "Polar grid mode requires wind_dir_deg in every met record \
                 (met record {record_index}, used by segment {segment_index}, is missing it \
                 \u{2014} add wind_dir_deg to your met file)"
            )));
        }
        selected.push(record.clone());
    }
    Ok(selected)
}

fn run_polar(
    cfg: &OpenRcConfig,
    met_records: &[MetRecord],
    release_height: f64,
    console: &mut dyn Write,
) -> Result<PolarOutcome, OpenRcError> {
    let count = met_records.len();
    let mut engine = Engine::new();
    let mut polar_results: Vec<PolarRunResult> = Vec::new();
    let mut segment_met: Option<Vec<MetRecord>> = None;

    if cfg.wind_shift {
        let selected = wind_shift_records(cfg, met_records)?;

        let first = selected.first().ok_or_else(out_of_range)?.clone();
        let opts = options_for(cfg, &first, release_height, false);
        let result = engine.run_gaussian_polar(
            &cfg.source_term_bq,
            cfg.polar_sector_count,
            &cfg.polar_ring_distances_m,
            first.wind_dir_deg.unwrap_or(f64::NAN),
            cfg.integration_time_s,
            Some(&opts),
            &cfg.dcf_organ,
            &cfg.plume_segments,
            Some(&cfg.deposition_velocities_by_group),
            Some(&selected),
        )?;
        polar_results.push(result);

        let directions: Vec<String> = selected
            .iter()
            .enumerate()
            .map(|(index, record)| {
                format!(
                    "seg{}\u{2192}{}\u{b0}({},{}m/s)",
                    index,
                    format_fixed(record.wind_dir_deg.unwrap_or(f64::NAN), 0),
                    record.stability_class,
                    repr_float(record.wind_speed_m_s)
                )
            })
            .collect();
        emit(
            console,
            &format!("  Wind shift       : {} segments", cfg.plume_segments.len()),
        )?;
        emit(console, &format!("    {}", directions.join("  ")))?;
        segment_met = Some(selected);
    } else {
        for (index, record) in met_records.iter().enumerate() {
            let opts = options_for(cfg, record, release_height, false);
            let result = engine.run_gaussian_polar(
                &cfg.source_term_bq,
                cfg.polar_sector_count,
                &cfg.polar_ring_distances_m,
                record.wind_dir_deg.unwrap_or(f64::NAN),
                cfg.integration_time_s,
                Some(&opts),
                &cfg.dcf_organ,
                &cfg.plume_segments,
                Some(&cfg.deposition_velocities_by_group),
                None,
            )?;
            polar_results.push(result);
            if count > 1 && (index + 1) % (count / 10).max(1) == 0 {
                emit(
                    console,
                    &format!("  {}/{} realizations complete ...", index + 1, count),
                )?;
            }
        }
    }

    emit(console, "")?;
    emit(console, &"=".repeat(70))?;

    let rings = &cfg.polar_ring_distances_m;
    let sector_count = cfg.polar_sector_count;
    let result_count = polar_results.len();

    if result_count == 1 {
        let result = &polar_results[0];
        let downwind = downwind_sector_index(&result.sector_azimuths_deg, result.wind_dir_deg);
        if !cfg.wind_shift {
            let centre = result
                .sector_azimuths_deg
                .get(downwind)
                .ok_or_else(out_of_range)?;
            emit(
                console,
                &format!(
                    "  Wind direction   : {}\u{b0}  (downwind sector {}, centre {}\u{b0})",
                    format_fixed(result.wind_dir_deg, 1),
                    downwind,
                    format_fixed(*centre, 1)
                ),
            )?;
        }
        emit(
            console,
            &format!("  \u{3c7}/Q reference    : first-segment downwind sector {downwind}"),
        )?;
        emit(console, "")?;
        emit(
            console,
            &format!(
                "  {}  {}  {}  {}  {}",
                pad_left("Distance(m)", 12),
                pad_left("\u{3c7}/Q(s/m\u{b3})", 12),
                pad_left("DW TEDE(mSv)", 13),
                pad_left("Max TEDE(mSv)", 14),
                pad_left("GrdDep(Bq/m\u{b2})", 14)
            ),
        )?;
        emit(console, &format!("  {}", "-".repeat(72)))?;
        for (ring_index, ring) in rings.iter().enumerate() {
            let cell = |grid: &[Vec<f64>]| -> Result<f64, OpenRcError> {
                grid.get(downwind)
                    .and_then(|row| row.get(ring_index))
                    .copied()
                    .ok_or_else(out_of_range)
            };
            let chi_q_downwind = cell(&result.chi_q_s_m3)?;
            let tede_downwind = cell(&result.tede_sv)? * 1000.0;
            let deposition_downwind = cell(&result.ground_dep_bq_m2)?;
            let tede_max = max_sector_tede(result, sector_count, ring_index)? * 1000.0;
            emit(
                console,
                &format!(
                    "  {}  {}  {}  {}  {}",
                    pad_left(&format_fixed(*ring, 0), 12),
                    pad_left(&format_exp(chi_q_downwind, 4), 12),
                    pad_left(&format_fixed(tede_downwind, 4), 13),
                    pad_left(&format_fixed(tede_max, 4), 14),
                    pad_left(&format_exp(deposition_downwind, 3), 14)
                ),
            )?;
        }
        emit(console, &"=".repeat(70))?;
        if !result.missing_dcfs.is_empty() {
            emit(
                console,
                &format!("  Missing DCFs: {}", result.missing_dcfs.join(", ")),
            )?;
        }
    } else {
        emit(console, &format!("  Realizations     : {result_count}"))?;
        emit(console, "")?;
        emit(
            console,
            &format!(
                "  {}  {}  {}  {}  {}  (mSv, max sector each realization)",
                pad_left("Distance(m)", 12),
                pad_left("p05 TEDE", 10),
                pad_left("p50 TEDE", 10),
                pad_left("p95 TEDE", 10),
                pad_left("max TEDE", 10)
            ),
        )?;
        emit(console, &format!("  {}", "-".repeat(62)))?;
        for (ring_index, ring) in rings.iter().enumerate() {
            let max_tedes = ring_max_tedes(&polar_results, sector_count, ring_index)?;
            let last = max_tedes.last().copied().ok_or_else(out_of_range)?;
            emit(
                console,
                &format!(
                    "  {}  {}  {}  {}  {}",
                    pad_left(&format_fixed(*ring, 0), 12),
                    pad_left(&format_fixed(percentile(&max_tedes, 5.0), 3), 10),
                    pad_left(&format_fixed(percentile(&max_tedes, 50.0), 3), 10),
                    pad_left(&format_fixed(percentile(&max_tedes, 95.0), 3), 10),
                    pad_left(&format_fixed(last, 3), 10)
                ),
            )?;
        }
        emit(console, &"=".repeat(70))?;
    }

    Ok(PolarOutcome {
        results: polar_results,
        segment_met,
    })
}

fn polar_summary(
    cfg: &OpenRcConfig,
    met_records: &[MetRecord],
    outcome: &PolarOutcome,
) -> Result<JsonValue, OpenRcError> {
    let polar_results = &outcome.results;
    let segment_met = &outcome.segment_met;
    let rings = &cfg.polar_ring_distances_m;
    let sector_count = cfg.polar_sector_count;
    let result_count = polar_results.len();
    let summary = if result_count == 1 {
        let result = &polar_results[0];
        let reference = match segment_met {
            Some(records) if !records.is_empty() => &records[0],
            _ => &met_records[0],
        };
        let mut entries = vec![
            ("case_name".to_string(), JsonValue::text(&cfg.case_name)),
            ("geometry".to_string(), JsonValue::text("polar")),
            ("wind_shift".to_string(), JsonValue::Bool(cfg.wind_shift)),
            ("mode".to_string(), JsonValue::text(&cfg.mode)),
            ("sector_count".to_string(), JsonValue::Int(sector_count)),
            (
                "sector_azimuths_deg".to_string(),
                JsonValue::floats(&result.sector_azimuths_deg),
            ),
            (
                "ring_distances_m".to_string(),
                JsonValue::floats(&result.ring_distances_m),
            ),
            (
                "wind_dir_deg".to_string(),
                JsonValue::Float(result.wind_dir_deg),
            ),
            (
                "stability_class".to_string(),
                JsonValue::text(&reference.stability_class),
            ),
            (
                "wind_speed_m_s".to_string(),
                JsonValue::Float(reference.wind_speed_m_s),
            ),
            (
                "missing_dcfs".to_string(),
                JsonValue::texts(&result.missing_dcfs),
            ),
            ("grid".to_string(), grid_object(result)),
        ];
        if let Some(records) = segment_met.as_ref().filter(|records| !records.is_empty()) {
            let items: Vec<JsonValue> = records
                .iter()
                .enumerate()
                .map(|(index, record)| {
                    JsonValue::Object(vec![
                        ("segment".to_string(), JsonValue::Int(index as i64)),
                        (
                            "stability_class".to_string(),
                            JsonValue::text(&record.stability_class),
                        ),
                        (
                            "wind_speed_m_s".to_string(),
                            JsonValue::Float(record.wind_speed_m_s),
                        ),
                        (
                            "wind_dir_deg".to_string(),
                            JsonValue::optional_float(record.wind_dir_deg),
                        ),
                        (
                            "mixing_height_m".to_string(),
                            JsonValue::optional_float(record.mixing_height_m),
                        ),
                    ])
                })
                .collect();
            entries.push(("segment_met".to_string(), JsonValue::List(items)));
        }
        JsonValue::Object(entries)
    } else {
        let mut per_ring: Vec<(String, JsonValue)> = Vec::new();
        for (ring_index, ring) in rings.iter().enumerate() {
            let max_tedes = ring_max_tedes(polar_results, sector_count, ring_index)?;
            object_insert(
                &mut per_ring,
                &integer_text(*ring)?,
                JsonValue::Object(vec![
                    (
                        "p05".to_string(),
                        JsonValue::Float(percentile(&max_tedes, 5.0)),
                    ),
                    (
                        "p50".to_string(),
                        JsonValue::Float(percentile(&max_tedes, 50.0)),
                    ),
                    (
                        "p95".to_string(),
                        JsonValue::Float(percentile(&max_tedes, 95.0)),
                    ),
                    ("max".to_string(), JsonValue::Float(largest(&max_tedes)?)),
                ]),
            );
        }
        let realizations: Vec<JsonValue> = polar_results
            .iter()
            .enumerate()
            .map(|(index, result)| {
                JsonValue::Object(vec![
                    ("index".to_string(), JsonValue::Int(index as i64)),
                    (
                        "stability_class".to_string(),
                        JsonValue::text(&met_records[index].stability_class),
                    ),
                    (
                        "wind_speed_m_s".to_string(),
                        JsonValue::Float(met_records[index].wind_speed_m_s),
                    ),
                    (
                        "wind_dir_deg".to_string(),
                        JsonValue::optional_float(met_records[index].wind_dir_deg),
                    ),
                    ("grid".to_string(), grid_object(result)),
                ])
            })
            .collect();
        JsonValue::Object(vec![
            ("case_name".to_string(), JsonValue::text(&cfg.case_name)),
            ("geometry".to_string(), JsonValue::text("polar")),
            ("wind_shift".to_string(), JsonValue::Bool(cfg.wind_shift)),
            ("mode".to_string(), JsonValue::text(&cfg.mode)),
            ("sector_count".to_string(), JsonValue::Int(sector_count)),
            ("ring_distances_m".to_string(), JsonValue::floats(rings)),
            (
                "n_realizations".to_string(),
                JsonValue::Int(result_count as i64),
            ),
            (
                "per_ring_max_tede_msv".to_string(),
                JsonValue::Object(per_ring),
            ),
            ("realizations".to_string(), JsonValue::List(realizations)),
        ])
    };
    Ok(summary)
}

fn ring_max_tedes(
    polar_results: &[PolarRunResult],
    sector_count: i64,
    ring_index: usize,
) -> Result<Vec<f64>, OpenRcError> {
    let mut values: Vec<f64> = Vec::with_capacity(polar_results.len());
    for result in polar_results {
        values.push(max_sector_tede(result, sector_count, ring_index)? * 1000.0);
    }
    Ok(sorted_ascending(values))
}

const TEXT_SOURCE: &str = "<string>";

enum MetSource<'a> {
    File,
    Text(Option<&'a str>),
}

enum Outcome {
    Centerline(Vec<RunResult>),
    Polar(PolarOutcome),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CaseOverview {
    pub case_name: String,
    pub mode: String,
    pub geometry: String,
    pub nuclide_count: usize,
    pub segment_count: usize,
    pub met_record_count: usize,
}

fn prepare(
    cfg: &OpenRcConfig,
    source: &MetSource,
    console: &mut dyn Write,
) -> Result<Vec<MetRecord>, OpenRcError> {
    emit(console, &format!("  case_name : {}", cfg.case_name))?;
    emit(console, &format!("  mode      : {}", cfg.mode))?;
    emit(console, &format!("  geometry  : {}", cfg.geometry))?;
    emit(
        console,
        &format!("  nuclides  : {}", cfg.source_term_bq.len()),
    )?;
    emit(
        console,
        &format!("  segments  : {}", cfg.plume_segments.len()),
    )?;

    let met_records: Vec<MetRecord> = match &cfg.met_path {
        Some(met_path) => {
            let records = match source {
                MetSource::File => load_met(met_path)?,
                MetSource::Text(Some(content)) => parse_met(content, &path_text(met_path))?,
                MetSource::Text(None) => {
                    return Err(OpenRcError::FileNotFound(format!(
                        "Met file not found: {}",
                        path_text(met_path)
                    )));
                }
            };
            emit(
                console,
                &format!(
                    "  met file  : {}  ({} realizations)",
                    path_text(met_path),
                    records.len()
                ),
            )?;
            records
        }
        None => {
            let (Some(stability_class), Some(wind_speed_m_s)) =
                (cfg.stability_class.as_deref(), cfg.wind_speed_m_s)
            else {
                return Err(OpenRcError::InvalidValue(
                    "[meteorology] stability_class and wind_speed_m_s are required \
                     without a met file"
                        .to_string(),
                ));
            };
            emit(
                console,
                &format!(
                    "  met       : single trial  (class {}, {} m/s)",
                    stability_class,
                    repr_float(wind_speed_m_s)
                ),
            )?;
            vec![MetRecord::new(stability_class, wind_speed_m_s)]
        }
    };

    if cfg.geometry == "polar" {
        for (index, record) in met_records.iter().enumerate() {
            if record.wind_dir_deg.is_none() {
                return Err(OpenRcError::InvalidValue(format!(
                    "Polar grid mode requires wind_dir_deg in every met record \
                     (record {index} is missing it).  Add wind_dir_deg to your met file \
                     or supply it in the single-trial [meteorology] section."
                )));
            }
        }
        emit(
            console,
            &format!("  sectors   : {}", cfg.polar_sector_count),
        )?;
        let first_ring = cfg
            .polar_ring_distances_m
            .first()
            .ok_or_else(out_of_range)?;
        let last_ring = cfg.polar_ring_distances_m.last().ok_or_else(out_of_range)?;
        emit(
            console,
            &format!(
                "  rings     : {}  ({}-{} m)",
                cfg.polar_ring_distances_m.len(),
                format_fixed(*first_ring, 0),
                format_fixed(*last_ring, 0)
            ),
        )?;
        let label = if cfg.wind_shift {
            format!(
                "enabled  (met period {} s)",
                format_fixed(cfg.met_period_s, 0)
            )
        } else {
            "disabled".to_string()
        };
        emit(console, &format!("  wind shift: {label}"))?;
    }
    Ok(met_records)
}

fn compute(
    cfg: &OpenRcConfig,
    met_records: &[MetRecord],
    console: &mut dyn Write,
) -> Result<Outcome, OpenRcError> {
    emit(console, "")?;

    let segment_releases = compute_segment_releases(
        &cfg.source_term_bq,
        &cfg.plume_segments,
        Some(&cfg.deposition_velocities_by_group),
    );
    let released = || {
        segment_releases
            .iter()
            .flat_map(|segment| segment.released_bq.iter().map(|(_, activity)| *activity))
    };
    let total_released = sum_floats(released());
    let released_count = released().filter(|activity| *activity > 0.0).count();
    emit(
        console,
        &format!(
            "Total released activity : {} Bq  ({} nuclide-segment pairs)",
            format_exp(total_released, 3),
            released_count
        ),
    )?;
    emit(console, "")?;

    let release_height = cfg
        .plume_segments
        .first()
        .ok_or_else(out_of_range)?
        .height_m;

    if cfg.geometry == "centerline" {
        run_centerline(cfg, met_records, release_height, console).map(Outcome::Centerline)
    } else {
        run_polar(cfg, met_records, release_height, console).map(Outcome::Polar)
    }
}

fn summarize(
    cfg: &OpenRcConfig,
    met_records: &[MetRecord],
    outcome: &Outcome,
) -> Result<JsonValue, OpenRcError> {
    match outcome {
        Outcome::Centerline(results) => centerline_summary(cfg, met_records, results),
        Outcome::Polar(polar) => polar_summary(cfg, met_records, polar),
    }
}

fn parse_text_case(config_text: &str, met_text: Option<&str>) -> Result<OpenRcConfig, OpenRcError> {
    let cfg = parse_config(config_text, TEXT_SOURCE)?;
    if cfg.met_path.is_none() && met_text.is_some() {
        return Err(OpenRcError::InvalidValue(
            "met file text was given but [meteorology] met_file is not set".to_string(),
        ));
    }
    Ok(cfg)
}

pub fn main(config_path: &str, console: &mut dyn Write) -> Result<(), OpenRcError> {
    emit(console, &format!("Loading config: {config_path}"))?;
    let cfg = load_config(config_path)?;
    let met_records = prepare(&cfg, &MetSource::File, console)?;
    let outcome = compute(&cfg, &met_records, console)?;
    if cfg.write_csv {
        let summary = summarize(&cfg, &met_records, &outcome)?;
        write_results(&cfg, &summary, console)?;
    }
    Ok(())
}

pub fn run_text(
    config_text: &str,
    met_text: Option<&str>,
    console: &mut dyn Write,
) -> Result<JsonValue, OpenRcError> {
    let cfg = parse_text_case(config_text, met_text)?;
    let met_records = prepare(&cfg, &MetSource::Text(met_text), console)?;
    let outcome = compute(&cfg, &met_records, console)?;
    summarize(&cfg, &met_records, &outcome)
}

pub fn check_text(config_text: &str, met_text: Option<&str>) -> Result<CaseOverview, OpenRcError> {
    let cfg = parse_text_case(config_text, met_text)?;
    let met_records = prepare(&cfg, &MetSource::Text(met_text), &mut io::sink())?;
    cfg.plume_segments.first().ok_or_else(out_of_range)?;
    if cfg.geometry != "centerline" && cfg.wind_shift {
        wind_shift_records(&cfg, &met_records)?;
    }
    Ok(CaseOverview {
        case_name: cfg.case_name,
        mode: cfg.mode,
        geometry: cfg.geometry,
        nuclide_count: cfg.source_term_bq.len(),
        segment_count: cfg.plume_segments.len(),
        met_record_count: met_records.len(),
    })
}
