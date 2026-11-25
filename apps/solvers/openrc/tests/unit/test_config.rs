use std::path::Path;

use serde_json::{json, Value};

use openrc::config::{load_config, OpenRcConfig};
use openrc::text::{path_text, repr_str};

use crate::support::{items, kind_for, remove_scratch, scratch_dir, text, vector};

fn float_json(value: f64) -> Value {
    if value.is_finite() {
        json!(value)
    } else if value.is_nan() {
        json!("nan")
    } else if value > 0.0 {
        json!("inf")
    } else {
        json!("-inf")
    }
}

fn path_json(path: &Path, data_dir: &Path) -> Value {
    json!(path_text(path)
        .replace(&path_text(data_dir), "@DATA@")
        .replace('\\', "/"))
}

pub(crate) fn config_json(config: &OpenRcConfig, data_dir: &Path) -> Value {
    let source: Vec<Value> = config
        .source_term_bq
        .iter()
        .map(|(name, activity)| json!([name, float_json(*activity)]))
        .collect();
    let segments: Vec<Value> = config
        .plume_segments
        .iter()
        .map(|segment| {
            json!({
                "delay_s": segment.delay_s,
                "duration_s": segment.duration_s,
                "height_m": segment.height_m,
                "release_fractions_by_group": segment.release_fractions_by_group,
            })
        })
        .collect();
    json!({
        "case_name": config.case_name,
        "modules": config.modules,
        "mode": config.mode,
        "source_term_bq": source,
        "receptor_x_m": config.receptor_x_m,
        "receptor_y_m": config.receptor_y_m,
        "receptor_z_m": config.receptor_z_m,
        "mixing_height_m": config.mixing_height_m,
        "integration_time_s": config.integration_time_s,
        "plume_segments": segments,
        "dcf_organ": config.dcf_organ,
        "dcf_path": path_json(&config.dcf_path, data_dir),
        "decay_path": path_json(&config.decay_path, data_dir),
        "include_ingrowth": config.include_ingrowth,
        "simple_decay_at_receptor": config.simple_decay_at_receptor,
        "collapse_half_life_sec": config.collapse_half_life_sec,
        "dry_deposition_velocity_m_s": config.dry_deposition_velocity_m_s,
        "deposition_velocities_by_group": config.deposition_velocities_by_group,
        "write_csv": config.write_csv,
        "output_dir": path_json(&config.output_dir, data_dir),
        "stability_class": config.stability_class,
        "wind_speed_m_s": config.wind_speed_m_s,
        "met_path": config.met_path.as_deref().map(|path| path_json(path, data_dir)),
        "geometry": config.geometry,
        "polar_sector_count": config.polar_sector_count,
        "polar_ring_distances_m": config.polar_ring_distances_m,
        "wind_shift": config.wind_shift,
        "met_period_s": config.met_period_s,
        "sigma_model": config.sigma_model,
        "measurement_height_m": config.measurement_height_m,
        "displacement_height_m": config.displacement_height_m,
        "decay_data": config.decay_data,
        "dcf_data": config.dcf_data,
    })
}

fn normalized(message: &str, config_path: &Path, data_dir: &Path) -> String {
    message
        .replace(&repr_str(&path_text(config_path)), "@PATH@")
        .replace(&path_text(data_dir), "@DATA@")
        .replace('\\', "/")
}

#[test]
fn configs_match_reference() {
    let data = vector("config.json");
    let data_dir = scratch_dir("config");
    for (name, content) in data["files"].as_object().expect("files") {
        std::fs::write(data_dir.join(name), text(content)).expect("write data file");
    }
    let data_text = path_text(&data_dir).replace('\\', "/");
    let cases = items(&data["cases"]);
    assert!(cases.len() > 150);
    let mut accepted = 0;
    let mut rejected = 0;
    for (index, case) in cases.iter().enumerate() {
        let name = text(&case["name"]);
        let config_path = if case.get("folder").is_some() {
            let folder = data_dir.join("a_folder");
            std::fs::create_dir_all(&folder).expect("create folder");
            folder
        } else if case["text"].is_null() {
            data_dir.join("absent").join("config.txt")
        } else {
            let path = data_dir.join(format!("config_{index}.txt"));
            let content = text(&case["text"]).replace("@DATA@", &data_text);
            std::fs::write(&path, content).expect("write config");
            path
        };
        let result = load_config(&config_path);
        match case.get("error") {
            None => {
                let config = result.unwrap_or_else(|error| {
                    panic!("{name}: must load, got {}: {error}", error.kind())
                });
                let actual = config_json(&config, &data_dir);
                let expected = &case["config"];
                for (key, expected_value) in expected.as_object().expect("config fields") {
                    assert_eq!(&actual[key], expected_value, "{name}: field {key}");
                }
                assert_eq!(
                    actual.as_object().map(|fields| fields.len()),
                    expected.as_object().map(|fields| fields.len()),
                    "{name}: field count"
                );
                accepted += 1;
            }
            Some(expected) => {
                let error = match result {
                    Ok(_) => panic!("{name}: must fail with {}", expected["type"]),
                    Err(error) => error,
                };
                let python_type = text(&expected["type"]);
                assert_eq!(
                    error.kind(),
                    kind_for(python_type),
                    "{name}: {}",
                    error.message()
                );
                let compare_message = match python_type {
                    "KeyError" | "JSONDecodeError" | "AttributeError" => false,
                    _ => name != "byte order mark",
                };
                if compare_message {
                    assert_eq!(
                        normalized(error.message(), &config_path, &data_dir),
                        text(&expected["message"]).replace('\\', "/"),
                        "{name}"
                    );
                }
                rejected += 1;
            }
        }
    }
    assert!(accepted > 50, "accepted {accepted}");
    assert!(rejected > 90, "rejected {rejected}");
    remove_scratch(&data_dir);
}
