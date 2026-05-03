#!/usr/bin/env python3

from __future__ import annotations

import json
import re
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from datetime import datetime, timezone

SCRIPT_VERSION = "openpra-quantum-expand-real-case-validation-exhaust-ac-v1"

REPO_ROOT = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")
EXPORT_DIR = REPO_ROOT / "_work" / "openpra_phase4_real_bounded_cohort_stratified_exports_v1" / "20260409_033933Z"
SEED_DIR = REPO_ROOT / "_work" / "openpra_quantum_simulator_validation_v1_real_expanded_v2"
OUT_DIR = REPO_ROOT / "_work" / "openpra_quantum_simulator_validation_v1_real_exhaust_ac"
PREP_ROOT = REPO_ROOT / "_work" / "openpra_quantum_real_preparation_v1_exhaust_ac"
PROBE_ROOT = REPO_ROOT / "_work" / "openpra_quantum_real_preparation_probe_exhaust_ac"
ROLLUP_OUT = OUT_DIR / "_rollup"
SUMMARY_DIR = REPO_ROOT / "_work" / "openpra_quantum_real_case_expansion_exhaust_ac_v1"

GEN_PREP = REPO_ROOT / "tools" / "quantum_integration" / "openpra_quantum_generate_preparation_from_clqubo_export_v1.js"
CASE_RUNNER = REPO_ROOT / "tools" / "quantum_integration" / "openpra_quantum_simulator_validation_case_runner_v1.js"
ROLLUP = REPO_ROOT / "tools" / "quantum_integration" / "openpra_quantum_simulator_validation_rollup_v1.js"

SHOTS = 8192
SAMPLING_MODE = "synthetic_exact_mcs"
TARGET_TOPOLOGIES = {"A", "C"}


@dataclass
class SelectedCase:
    export_file: str
    model_id: str
    subtree_id: str
    root_gate_id: str
    topology_class: str
    preparation_artifact_path: str
    case_label: str


def run_cmd(cmd: list[str], cwd: Path = REPO_ROOT) -> str:
    result = subprocess.run(
        cmd,
        cwd=str(cwd),
        text=True,
        capture_output=True,
        check=True,
    )
    return result.stdout.strip()


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def sanitize_token(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", str(value))


def case_label_for(prep: dict) -> str:
    return f"{sanitize_token(prep['modelId'])}__{sanitize_token(prep['subtreeId'])}"


def existing_case_labels(root: Path) -> set[str]:
    if not root.exists():
        return set()
    return {p.name for p in root.iterdir() if p.is_dir() and not p.name.startswith("_")}


def seed_workspace() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for entry in SEED_DIR.iterdir():
        if entry.name.startswith("_"):
            continue
        dest = OUT_DIR / entry.name
        if not dest.exists():
            shutil.copytree(entry, dest)


def build_preparation(export_path: Path, out_root: Path) -> Path:
    out_root.mkdir(parents=True, exist_ok=True)
    prep_path = run_cmd(
        [
            "node",
            str(GEN_PREP),
            "--clqubo-export",
            str(export_path),
            "--output-root",
            str(out_root),
        ]
    )
    return Path(prep_path)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def choose_cases() -> list[SelectedCase]:
    existing = existing_case_labels(OUT_DIR)
    selected: list[SelectedCase] = []

    PROBE_ROOT.mkdir(parents=True, exist_ok=True)
    PREP_ROOT.mkdir(parents=True, exist_ok=True)

    export_files = sorted(EXPORT_DIR.glob("*_clqubo_export.json"))

    for export_path in export_files:
        probe_dir = PROBE_ROOT / export_path.stem
        if probe_dir.exists():
            shutil.rmtree(probe_dir)

        prep_path = build_preparation(export_path, probe_dir)
        prep = load_json(prep_path)

        topology = prep.get("topologyClass")
        model_id = prep.get("modelId", "")
        label = case_label_for(prep)

        is_real = model_id.startswith("phase2b_row_")
        wanted = topology in TARGET_TOPOLOGIES
        already_present = label in existing

        if is_real and wanted and not already_present:
            final_dir = PREP_ROOT / export_path.stem
            if final_dir.exists():
                shutil.rmtree(final_dir)
            shutil.move(str(probe_dir), str(final_dir))
            final_prep_path = final_dir / "openpra_quantum_preparation_artifact_v1.json"

            selected.append(
                SelectedCase(
                    export_file=export_path.name,
                    model_id=prep["modelId"],
                    subtree_id=prep["subtreeId"],
                    root_gate_id=prep["rootGateId"],
                    topology_class=prep["topologyClass"],
                    preparation_artifact_path=str(final_prep_path),
                    case_label=label,
                )
            )
            existing.add(label)
        else:
            shutil.rmtree(probe_dir, ignore_errors=True)

    return selected


def run_validation(selected: list[SelectedCase]) -> None:
    for case in selected:
        run_cmd(
            [
                "node",
                str(CASE_RUNNER),
                "--preparation-artifact",
                case.preparation_artifact_path,
                "--output-root",
                str(OUT_DIR),
                "--shots",
                str(SHOTS),
                "--sampling-mode",
                SAMPLING_MODE,
            ]
        )


def reroll() -> dict:
    run_cmd(
        [
            "node",
            str(ROLLUP),
            "--input-root",
            str(OUT_DIR),
            "--output-root",
            str(ROLLUP_OUT),
        ]
    )
    return load_json(ROLLUP_OUT / "openpra_quantum_simulator_validation_rollup_v1.json")


def split_case_rows(rollup: dict) -> tuple[list[dict], list[dict], list[dict]]:
    real_rows: list[dict] = []
    synthetic_rows: list[dict] = []
    other_rows: list[dict] = []

    for row in rollup["caseRows"]:
        label = row["caseLabel"]
        if label.startswith("phase2b_row_"):
            real_rows.append(row)
        elif label.startswith("synthetic_topology_"):
            synthetic_rows.append(row)
        else:
            other_rows.append(row)

    return real_rows, synthetic_rows, other_rows


def main() -> None:
    run_cmd(["npx", "nx", "build", "quantum-readiness"])

    seed_workspace()
    selected = choose_cases()
    run_validation(selected)
    rollup = reroll()
    real_rows, synthetic_rows, other_rows = split_case_rows(rollup)

    SUMMARY_DIR.mkdir(parents=True, exist_ok=True)

    summary = {
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "scriptVersion": SCRIPT_VERSION,
        "exportDir": str(EXPORT_DIR),
        "seedDir": str(SEED_DIR),
        "outputDir": str(OUT_DIR),
        "prepRoot": str(PREP_ROOT),
        "selectedCases": [case.__dict__ for case in selected],
        "selectedCount": len(selected),
        "rollupPath": str(ROLLUP_OUT / "openpra_quantum_simulator_validation_rollup_v1.json"),
        "totalCasesAfterExpansion": rollup["counts"]["totalCases"],
        "topologyCountsAfterExpansion": rollup["counts"]["topologyCounts"],
        "primaryModeCountsAfterExpansion": rollup["counts"]["primaryModeCounts"],
        "allExactAfterExpansion": rollup["counts"]["allExact"],
        "operatorAttentionCountAfterExpansion": rollup["counts"]["operatorAttentionCount"],
        "realCaseCountAfterExpansion": len(real_rows),
        "syntheticProofCountAfterExpansion": len(synthetic_rows),
        "otherCountAfterExpansion": len(other_rows),
    }

    summary_path = SUMMARY_DIR / "openpra_quantum_real_case_expansion_exhaust_ac_summary_v1.json"
    write_json(summary_path, summary)

    memo_lines = [
        "OpenPRA Quantum Real Case Expansion Exhaust A C Summary v1",
        "",
        f"Generated at UTC: {summary['generatedAtUtc']}",
        f"Script version: {SCRIPT_VERSION}",
        "",
        f"Newly selected count: {summary['selectedCount']}",
        f"Total cases after expansion: {summary['totalCasesAfterExpansion']}",
        f"Topology counts after expansion: {summary['topologyCountsAfterExpansion']}",
        f"Primary mode counts after expansion: {summary['primaryModeCountsAfterExpansion']}",
        f"All exact after expansion: {summary['allExactAfterExpansion']}",
        f"Operator attention count after expansion: {summary['operatorAttentionCountAfterExpansion']}",
        f"Real case count after expansion: {summary['realCaseCountAfterExpansion']}",
        f"Synthetic proof count after expansion: {summary['syntheticProofCountAfterExpansion']}",
        "",
        "Newly selected cases:",
        "",
    ]

    if selected:
        for case in selected:
            memo_lines.append(
                f"{case.export_file} | {case.model_id} | {case.subtree_id} | "
                f"{case.root_gate_id} | {case.topology_class} | {case.case_label}"
            )
    else:
        memo_lines.append("No additional real A or C cases were found.")

    memo_lines.extend(
        [
            "",
            f"Rollup JSON: {summary['rollupPath']}",
            f"Summary JSON: {summary_path}",
            "",
        ]
    )

    memo_path = SUMMARY_DIR / "OPENPRA_QUANTUM_REAL_CASE_EXPANSION_EXHAUST_AC_MEMO_v1.txt"
    memo_path.write_text("\n".join(memo_lines), encoding="utf-8")

    print(memo_path)
    print(summary_path)


if __name__ == "__main__":
    main()
