use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

fn praxis_binary() -> PathBuf {
    [
        PathBuf::from("target/debug/praxis-cli"),
        PathBuf::from("target/debug/praxis-cli.exe"),
    ]
    .into_iter()
    .find(|candidate| candidate.exists())
    .expect("praxis-cli binary not found; run 'cargo build --bin praxis-cli' first")
}

#[test]
fn dot_visualization_writes_source_without_rendered_files() {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time")
        .as_nanos();
    let output_dir = std::env::temp_dir().join(format!("praxis-cli-viz-{nonce}"));

    let output = Command::new(praxis_binary())
        .arg("tests/fixtures/core/and.xml")
        .args([
            "--algorithm",
            "bdd",
            "--visualize",
            "--visualize-format",
            "dot",
            "--visualize-out-dir",
        ])
        .arg(&output_dir)
        .output()
        .expect("run PRAXIS visualization");

    assert!(
        output.status.success(),
        "visualization failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    let dot_files: Vec<_> = fs::read_dir(&output_dir)
        .expect("visualization directory")
        .map(|entry| entry.expect("directory entry").path())
        .collect();
    assert_eq!(dot_files.len(), 1);
    assert_eq!(
        dot_files[0].extension().and_then(|value| value.to_str()),
        Some("dot")
    );
    let source = fs::read_to_string(&dot_files[0]).expect("DOT source");
    assert!(source.starts_with("digraph"));

    let _ = fs::remove_dir_all(output_dir);
}

#[test]
fn all_visualization_formats_keep_dot_and_render_svg_and_pdf() {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time")
        .as_nanos();
    let output_dir = std::env::temp_dir().join(format!("praxis-cli-viz-all-{nonce}"));

    let output = Command::new(praxis_binary())
        .arg("tests/fixtures/core/and.xml")
        .args([
            "--algorithm",
            "bdd",
            "--visualize",
            "--visualize-format",
            "all",
            "--visualize-out-dir",
        ])
        .arg(&output_dir)
        .output()
        .expect("run PRAXIS visualization");
    assert!(
        output.status.success(),
        "visualization failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    let extensions: Vec<_> = fs::read_dir(&output_dir)
        .expect("visualization directory")
        .map(|entry| {
            entry
                .expect("directory entry")
                .path()
                .extension()
                .and_then(|value| value.to_str())
                .expect("file extension")
                .to_string()
        })
        .collect();
    for expected in ["dot", "svg", "pdf"] {
        assert!(
            extensions.iter().any(|actual| actual == expected),
            "missing {expected} output; found {extensions:?}"
        );
    }

    let _ = fs::remove_dir_all(output_dir);
}
