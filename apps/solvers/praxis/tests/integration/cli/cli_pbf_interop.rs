use praxis::analysis::quantify::{quantify, Engine, Settings};
use praxis::core::ccf::{BinomialFailureRate, CcfGroup, CcfModel, RaspCcfEvent};
use praxis::core::distribution::{CcfTesting, Law};
use praxis::core::fault_tree::FaultTree;
use praxis::expression::Expr;
use praxis::io::parser::parse_fault_tree;
use praxis::io::pbf::{decode_fault_tree, encode_fault_tree, LEGACY_MODEL_VERSION, MODEL_VERSION};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

const INITIATOR: &[u8] = include_bytes!("../../data/pbf_interop/pracciolini_initiator.pbf");
const CCF: &[u8] = include_bytes!("../../data/pbf_interop/pracciolini_ccf.pbf");
const DEVIATE: &[u8] = include_bytes!("../../data/pbf_interop/pracciolini_deviate.pbf");
const EVENT_TREE: &[u8] = include_bytes!("../../data/pbf_interop/pracciolini_event_tree.pbf");
const ANNEX: &[u8] = include_bytes!("../../data/pbf_interop/pracciolini_annex.pbf");
const PRAXIS_MODEL: &[u8] = include_bytes!("../../data/pbf_interop/praxis_model.pbf");
const PRAXIS_MODEL_XML: &str = include_str!("../../data/pbf_interop/praxis_model.xml");

fn praxis_binary() -> PathBuf {
    let candidates = [
        PathBuf::from("target/debug/praxis-cli"),
        PathBuf::from("target/debug/praxis-cli.exe"),
    ];

    candidates
        .into_iter()
        .find(|candidate| candidate.exists())
        .expect("praxis-cli binary not found; run 'cargo build --bin praxis-cli' first")
}

fn parameter(name: &str) -> Expr {
    Expr::Parameter(name.to_string())
}

fn virtual_events() -> Vec<RaspCcfEvent> {
    vec![RaspCcfEvent {
        id: "PAIR".to_string(),
        member_indices: vec![0, 1],
    }]
}

fn praxis_tree() -> FaultTree {
    let mut tree = parse_fault_tree(PRAXIS_MODEL_XML).expect("parse XML fixture");
    let total = Some(Expr::Constant(0.01));
    let groups = [
        (
            "ALPHA",
            CcfModel::AlphaFactor {
                testing: CcfTesting::Staggered,
                alphas: vec![parameter("first"), parameter("second")],
            },
            total.clone(),
        ),
        (
            "BETA",
            CcfModel::BetaFactor(parameter("first")),
            Some(Expr::draw(Law::Uniform {
                lower: 0.005,
                upper: 0.015,
            })),
        ),
        (
            "BFR",
            CcfModel::BinomialFailureRate(BinomialFailureRate {
                independent: Expr::Constant(0.001),
                non_lethal_shock: Expr::Constant(0.002),
                component_failure: Expr::Constant(0.3),
                lethal_shock: Expr::Constant(0.004),
            }),
            None,
        ),
        (
            "MGL",
            CcfModel::Mgl(vec![parameter("first")]),
            total.clone(),
        ),
        (
            "PHI",
            CcfModel::PhiFactor(vec![parameter("first"), parameter("second")]),
            total.clone(),
        ),
        (
            "RASP",
            CcfModel::RaspMgl {
                factors: vec![Expr::Constant(0.1)],
                virtual_events: virtual_events(),
            },
            total.clone(),
        ),
        (
            "RASP-EXPR",
            CcfModel::RaspMgl {
                factors: vec![parameter("first")],
                virtual_events: virtual_events(),
            },
            total.clone(),
        ),
    ];
    for (id, model, group_total) in groups {
        let members = vec!["P1".to_string(), "P2".to_string()];
        let group = CcfGroup::new(id, members, model, group_total).expect("build CCF group");
        tree.add_ccf_group(group).expect("add CCF group");
    }
    tree
}

fn decode_error(bytes: &[u8]) -> String {
    decode_fault_tree(bytes)
        .expect_err("decoding should fail")
        .to_string()
}

#[test]
fn pracciolini_initiators_survive_into_the_delete_term_engine() {
    assert_eq!(INITIATOR[4], LEGACY_MODEL_VERSION);
    let tree = decode_fault_tree(INITIATOR).expect("decode Pracciolini model");

    assert!(tree.get_basic_event("I1").unwrap().is_initiator());
    assert!(tree.get_basic_event("I2").unwrap().is_initiator());
    assert!(!tree.get_basic_event("A").unwrap().is_initiator());
    assert!(tree.get_basic_event("A").unwrap().value().is_some());
    assert_eq!(tree.mission_time(), 24.0);

    let settings = Settings {
        engine: Engine::ZbddDelterm,
        ..Default::default()
    };
    let cut_sets = quantify(&tree, &settings)
        .expect("quantify Pracciolini model")
        .cut_sets
        .expect("cut sets");
    assert_eq!(cut_sets.products, 3, "I1 and I2 must not share a cut set");
}

#[test]
fn a_pracciolini_annex_is_read_past() {
    assert_eq!(&ANNEX[..INITIATOR.len()], INITIATOR);
    assert_eq!(&ANNEX[INITIATOR.len()..INITIATOR.len() + 4], b"PBX1");
    let with_annex = decode_fault_tree(ANNEX).expect("decode model with annex");
    let plain = decode_fault_tree(INITIATOR).expect("decode model");

    assert!(with_annex.get_gate("SPARE").is_none());
    assert!(with_annex.get_basic_event("LOOSE").is_none());
    assert_eq!(
        encode_fault_tree(&with_annex).expect("encode"),
        encode_fault_tree(&plain).expect("encode")
    );
}

#[test]
fn pracciolini_ccf_group_loads_and_expands() {
    assert_eq!(CCF[4], LEGACY_MODEL_VERSION);
    let tree = decode_fault_tree(CCF).expect("decode Pracciolini model");

    let group = &tree.ccf_groups()["PUMPS"];
    assert_eq!(group.members, ["P1", "P2"]);
    assert_eq!(group.model, CcfModel::BetaFactor(Expr::Constant(0.1)));
    assert_eq!(group.total, Some(Expr::Constant(0.01)));

    let settings = Settings {
        ccf: true,
        ..Default::default()
    };
    let probability = quantify(&tree, &settings)
        .expect("quantify Pracciolini model")
        .probability
        .expect("probability")
        .value;
    let independent = 0.9 * 0.01;
    let common = 0.1 * 0.01;
    let expected = common + (1.0 - common) * independent * independent;
    assert!((probability - expected).abs() < 1e-12, "{probability}");
}

#[test]
fn cli_solves_a_pracciolini_model() {
    let build = Command::new("cargo")
        .args(["build", "--bin", "praxis-cli"])
        .output()
        .expect("failed to build praxis-cli");
    assert!(
        build.status.success(),
        "build failed: {}",
        String::from_utf8_lossy(&build.stderr)
    );

    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before Unix epoch")
        .as_nanos();
    let temp_dir = std::env::temp_dir();
    let input_path = temp_dir.join(format!("praxis-interop-{nonce}.pbf"));
    let output_path = temp_dir.join(format!("praxis-interop-{nonce}.xml"));
    fs::write(&input_path, INITIATOR).expect("write PBF fixture");

    let output = Command::new(praxis_binary())
        .arg(&input_path)
        .args(["--algorithm", "zbdd-delterm", "--analysis", "cutsets-only"])
        .arg("--output")
        .arg(&output_path)
        .output()
        .expect("run praxis-cli with PBF input");

    let result_xml = fs::read_to_string(&output_path).unwrap_or_default();
    let _ = fs::remove_file(&input_path);
    let _ = fs::remove_file(&output_path);

    assert!(
        output.status.success(),
        "command failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(result_xml.contains("<minimal-cut-sets count=\"3\">"));
}

#[test]
fn written_models_stay_at_the_current_version() {
    let bytes = encode_fault_tree(&praxis_tree()).expect("encode model");
    if std::env::var_os("PRAXIS_UPDATE_PBF_INTEROP").is_some() {
        fs::write("tests/data/pbf_interop/praxis_model.pbf", &bytes).expect("write fixture");
        return;
    }

    assert_eq!(bytes[4], MODEL_VERSION);
    assert_eq!(
        bytes, PRAXIS_MODEL,
        "regenerate praxis_model.pbf and retest Pracciolini"
    );
    assert_eq!(
        encode_fault_tree(&decode_fault_tree(&bytes).expect("decode model")).expect("re-encode"),
        bytes
    );
}

#[test]
fn event_tree_models_are_refused_by_name() {
    assert_eq!(EVENT_TREE[4], 2);
    assert!(decode_error(EVENT_TREE).contains("event tree"));

    let mut offline = EVENT_TREE.to_vec();
    offline[4] = 3;
    assert!(decode_error(&offline).contains("event tree"));
}

#[test]
fn legacy_deviates_are_refused_instead_of_misread() {
    assert_eq!(DEVIATE[4], LEGACY_MODEL_VERSION);
    assert!(decode_error(DEVIATE).contains("OpenPSA XML"));
}

#[test]
fn unknown_model_versions_are_refused() {
    let mut future = PRAXIS_MODEL.to_vec();
    future[4] = 5;
    assert!(decode_error(&future).contains("unsupported model version 5"));
}
