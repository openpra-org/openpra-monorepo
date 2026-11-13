use openrc::error::OpenRcError;
use openrc::json::JsonValue;
use openrc::run::{check_text, run_text};
use serde_json::{json, Map, Number, Value};

use crate::transport::{SolverRequest, RADIOLOGICAL_CONSEQUENCE_METHOD};

pub(crate) fn validate(request: &SolverRequest) -> Result<Value, OpenRcError> {
    let overview = check_text(&request.config_text, request.met_file_text.as_deref())?;
    Ok(json!({
        "scope": RADIOLOGICAL_CONSEQUENCE_METHOD,
        "valid": true,
        "caseName": overview.case_name,
        "mode": overview.mode,
        "geometry": overview.geometry,
        "nuclideCount": overview.nuclide_count,
        "segmentCount": overview.segment_count,
        "metRecordCount": overview.met_record_count
    }))
}

pub(crate) fn execute(request: &SolverRequest) -> Result<Value, OpenRcError> {
    let mut console: Vec<u8> = Vec::new();
    let results = run_text(
        &request.config_text,
        request.met_file_text.as_deref(),
        &mut console,
    )?;
    Ok(json!({
        "methodType": RADIOLOGICAL_CONSEQUENCE_METHOD,
        "console": String::from_utf8_lossy(&console),
        "results": results_json(&results)
    }))
}

pub(crate) fn results_json(value: &JsonValue) -> Value {
    match value {
        JsonValue::Null => Value::Null,
        JsonValue::Bool(flag) => Value::Bool(*flag),
        JsonValue::Int(number) => Value::Number(Number::from(*number)),
        JsonValue::Float(number) => Number::from_f64(*number).map_or(Value::Null, Value::Number),
        JsonValue::Text(text) => Value::String(text.clone()),
        JsonValue::List(items) => Value::Array(items.iter().map(results_json).collect()),
        JsonValue::Object(entries) => Value::Object(
            entries
                .iter()
                .map(|(key, item)| (key.clone(), results_json(item)))
                .collect::<Map<String, Value>>(),
        ),
    }
}

#[cfg(test)]
mod tests {
    use openrc::json::JsonValue;
    use serde_json::{json, Value};

    use super::{execute, results_json, validate};
    use crate::transport::{SolverRequest, RADIOLOGICAL_CONSEQUENCE_METHOD};

    const CONFIG: &str = "\
[run]
case_name = adapter_case
mode = lmp
modules = RC10_RCAD

[source_term]
Cs-137 = 1.0E12
I-131 = 1.0E12
Xe-133 = 1.0E12

[receptor]
x_m = 1000.0
y_m = 0.0
z_m = 0.0

[meteorology]
stability_class = D
wind_speed_m_s = 3.0
mixing_height_m = none

[release]
integration_time_s = 86400
plume_segments = 1

[release.segment_1]
delay_s = 0.0
duration_s = 3600.0
height_m = 0.0
release_fractions_by_group = 1,1,1,1,1,1,1,1,1,1

[dcf]
organ = ICRP60ED
path = unused/DCF.json

[decay]
path = unused/Chains.json
include_ingrowth = false
simple_decay_at_receptor = false
collapse_half_life_sec = 1.0

[deposition]
dry_deposition_velocity_m_s = 0.003
deposition_velocities_by_group = 0,0.003,0.003,0.003,0.003,0.003,0.003,0.003,0,0.003

[outputs]
write_csv = false
output_dir = unused
";

    fn request(config_text: &str, met_file_text: Option<&str>) -> SolverRequest {
        SolverRequest {
            method_type: RADIOLOGICAL_CONSEQUENCE_METHOD.to_string(),
            config_text: config_text.to_string(),
            met_file_text: met_file_text.map(str::to_string),
        }
    }

    fn keys(value: &Value) -> Vec<&str> {
        value
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect()
    }

    #[test]
    fn validates_a_case_and_reports_what_the_engine_read() {
        let result = validate(&request(CONFIG, None)).unwrap();

        assert_eq!(
            result,
            json!({
                "scope": "RADIOLOGICAL_CONSEQUENCE",
                "valid": true,
                "caseName": "adapter_case",
                "mode": "lmp",
                "geometry": "centerline",
                "nuclideCount": 3,
                "segmentCount": 1,
                "metRecordCount": 1
            })
        );
        assert_eq!(
            keys(&result),
            [
                "scope",
                "valid",
                "caseName",
                "mode",
                "geometry",
                "nuclideCount",
                "segmentCount",
                "metRecordCount"
            ]
        );
    }

    #[test]
    fn counts_the_rows_of_the_met_file_text() {
        let config = CONFIG.replace(
            "stability_class = D\nwind_speed_m_s = 3.0\n",
            "met_file = weather.met\n",
        );
        let met = "# class, speed\nD,3.0\nF,1.5\nA,6.0\n";
        let result = validate(&request(&config, Some(met))).unwrap();
        assert_eq!(result["metRecordCount"], 3);

        let executed = execute(&request(&config, Some(met))).unwrap();
        assert_eq!(executed["results"]["n_realizations"], 3);
        assert_eq!(
            executed["results"]["realizations"]
                .as_array()
                .unwrap()
                .len(),
            3
        );
    }

    #[test]
    fn executes_a_case_and_returns_console_and_results() {
        let result = execute(&request(CONFIG, None)).unwrap();

        assert_eq!(keys(&result), ["methodType", "console", "results"]);
        assert_eq!(result["methodType"], "RADIOLOGICAL_CONSEQUENCE");
        let console = result["console"].as_str().unwrap();
        assert!(console.starts_with("  case_name : adapter_case\n  mode      : lmp\n"));
        assert!(console
            .contains("\nTotal released activity : 3.000e+12 Bq  (3 nuclide-segment pairs)\n"));
        assert!(console.contains("\nTop 10 nuclide contributors to TEDE:\n"));
        assert!(!console.contains('\r'));
        assert!(!console.contains("Loading config"));
        assert!(!console.contains("Results written to"));

        let results = &result["results"];
        assert_eq!(
            keys(results),
            [
                "case_name",
                "geometry",
                "mode",
                "receptor_x_m",
                "stability_class",
                "wind_speed_m_s",
                "tede_sv",
                "tede_msv",
                "chi_over_q_s_m3",
                "ground_deposition_bq_m2",
                "lmp_tede_sv",
                "epz_distance_m",
                "missing_dcfs",
                "breakdown_msv"
            ]
        );
        assert_eq!(results["case_name"], "adapter_case");
        assert_eq!(results["geometry"], "centerline");
        assert_eq!(results["receptor_x_m"], 1000.0);
        assert_eq!(results["missing_dcfs"], json!([]));
        assert_eq!(
            keys(&results["breakdown_msv"]),
            ["Cs-137", "I-131", "Xe-133"]
        );
        let tede_sv = results["tede_sv"].as_f64().unwrap();
        let tede_msv = results["tede_msv"].as_f64().unwrap();
        assert!(tede_sv > 0.0 && tede_sv.is_finite());
        assert_eq!(tede_msv.to_bits(), (tede_sv * 1000.0).to_bits());
    }

    #[test]
    fn repeated_executions_return_the_same_json() {
        let first = execute(&request(CONFIG, None)).unwrap();
        let second = execute(&request(CONFIG, None)).unwrap();
        assert_eq!(first.to_string(), second.to_string());
    }

    #[test]
    fn engine_errors_pass_through_with_their_own_messages() {
        let error = validate(&request("", None)).unwrap_err();
        assert_eq!(error.kind(), "InvalidValue");
        assert!(error
            .message()
            .starts_with("Config is missing required section(s): "));

        let error = execute(&request(CONFIG, Some("D,3.0\n"))).unwrap_err();
        assert_eq!(error.kind(), "InvalidValue");
        assert_eq!(
            error.message(),
            "met file text was given but [meteorology] met_file is not set"
        );

        let no_segments = CONFIG.replace("plume_segments = 1", "plume_segments = 0");
        for error in [
            validate(&request(&no_segments, None)).unwrap_err(),
            execute(&request(&no_segments, None)).unwrap_err(),
        ] {
            assert_eq!(error.kind(), "OutOfRange");
            assert_eq!(error.message(), "list index out of range");
        }
    }

    #[test]
    fn converts_every_results_value_kind_and_keeps_key_order() {
        let value = JsonValue::Object(vec![
            ("zeta".to_string(), JsonValue::Null),
            ("alpha".to_string(), JsonValue::Bool(true)),
            ("count".to_string(), JsonValue::Int(-7)),
            ("big".to_string(), JsonValue::Int(i64::MAX)),
            ("ratio".to_string(), JsonValue::Float(0.1)),
            ("whole".to_string(), JsonValue::Float(1000.0)),
            ("minus_zero".to_string(), JsonValue::Float(-0.0)),
            ("name".to_string(), JsonValue::Text("\u{3c7}/Q".to_string())),
            (
                "grid".to_string(),
                JsonValue::List(vec![
                    JsonValue::List(vec![JsonValue::Float(1.5), JsonValue::Float(2.5)]),
                    JsonValue::List(Vec::new()),
                ]),
            ),
            ("empty".to_string(), JsonValue::Object(Vec::new())),
            (
                "1000".to_string(),
                JsonValue::Object(vec![("p50".to_string(), JsonValue::Float(3.25))]),
            ),
            (
                "500".to_string(),
                JsonValue::Object(vec![("p50".to_string(), JsonValue::Float(1.25))]),
            ),
        ]);
        let converted = results_json(&value);
        assert_eq!(
            converted.to_string(),
            "{\"zeta\":null,\"alpha\":true,\"count\":-7,\"big\":9223372036854775807,\
             \"ratio\":0.1,\"whole\":1000.0,\"minus_zero\":-0.0,\"name\":\"\u{3c7}/Q\",\
             \"grid\":[[1.5,2.5],[]],\"empty\":{},\"1000\":{\"p50\":3.25},\"500\":{\"p50\":1.25}}"
        );
        assert!(converted["count"].is_i64());
        assert!(converted["whole"].is_f64());
    }

    #[test]
    fn numbers_that_are_not_finite_become_null() {
        let value = JsonValue::List(vec![
            JsonValue::Float(f64::NAN),
            JsonValue::Float(f64::INFINITY),
            JsonValue::Float(f64::NEG_INFINITY),
            JsonValue::Float(f64::MAX),
            JsonValue::Float(f64::from_bits(1)),
        ]);
        let converted = results_json(&value);
        assert_eq!(converted[0], Value::Null);
        assert_eq!(converted[1], Value::Null);
        assert_eq!(converted[2], Value::Null);
        assert_eq!(converted[3].as_f64().unwrap().to_bits(), f64::MAX.to_bits());
        assert_eq!(converted[4].as_f64().unwrap().to_bits(), 1);
    }

    #[test]
    fn every_float_survives_the_trip_to_json_text_and_back() {
        let mut state = 0x9e37_79b9_7f4a_7c15_u64;
        let mut checked = 0;
        while checked < 20_000 {
            state ^= state << 13;
            state ^= state >> 7;
            state ^= state << 17;
            let number = f64::from_bits(state);
            if !number.is_finite() {
                continue;
            }
            let text = results_json(&JsonValue::Float(number)).to_string();
            let parsed: Value = serde_json::from_str(&text).unwrap();
            assert_eq!(
                parsed.as_f64().unwrap().to_bits(),
                number.to_bits(),
                "{text}"
            );
            checked += 1;
        }
    }
}
