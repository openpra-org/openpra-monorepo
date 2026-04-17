#!/usr/bin/env python3

from __future__ import annotations

import json
import re
import shutil
import subprocess
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from datetime import datetime, timezone

SCRIPT_VERSION = "openpra-quantum-expand-real-d-representative-v1"

REPO_ROOT = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")
EXPORT_DIR = REPO_ROOT / "_work" / "openpra_phase4_real_bounded_cohort_stratified_exports_v1" / "20260409_033933Z"
INVENTORY_JSON = REPO_ROOT / "_work" / "openpra_quantum_real_bd_inventory_v1" / "openpra_quantum_real_bd_inventory_summary_v1.json"
SEED_DIR = REPO_ROOT / "_work" / "openpra_quantum_simulator_validation_v1_real_exhaust_ac"
OUT_DIR = REPO_ROOT / "_work" / "openpra_quantum_simulator_validation_v1_real_with_d"
PREP_ROOT = REPO_ROOT / "_work" / "openpra_quantum_real_preparation_v1_real_d"
ROLLUP_OUT = OUT_DIR / "_rollup"
SUMMARY_DIR = REPO_ROOT / "_work" / "openpra_quantum_real_d_representative_v1"

GEN_PREP = REPO_ROOT / "tools" / "quantum_integration" / "openpra_quantum_generate_preparation_from_clqubo_export_v1.js"
CASE_RUNNER = REPO_ROOT / "tools" / "quantum_integration" / "openpra_quantum_simulator_validation_case_runner_v1.js"
ROLLUP = REPO_ROOT / "tools" / "quantum_integration" / "openpra_quantum_simulator_validation_rollup_v1.js"

SHOTS = 8192
SAMPLING_MODE = "synthetic_exact_mcs"
MAX_PER_ROOT_GATE = 2


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


def case_label_for(model_id: str, subtree_id: str) -> str:
    return f"{sanitize_token(model_id)}__{sanitize_token(subtree_id)}"


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


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


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


def choose_cases() -> list[SelectedCase]:
    inventory = load_json(INVENTORY_JSON)
    real_d_candidates = inventory.get("realDCandidates", [])
    existing = existing_case_labels(OUT_DIR)

    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in real_d_candidates:
        grouped[row["root_gate_id"]].append(row)

    selected: list[SelectedCase] = []
    PREP_ROOT.mkdir(parents=True, exist_ok=True)

    for root_gate_id in sorted(grouped):
        picked = 0
        for row in grouped[root_gate_id]:
            if picked >= MAX_PER_ROOT_GATE:
                break

            case_label = case_label_for(row["model_id"], row["subtree_id"])
            if case_label in existing:
                continue

            export_path = EXPORT_DIR / row["export_file"]
            prep_dir = PREP_ROOT / export_path.stem
            if prep_dir.exists():
                shutil.rmtree(prep_dir)

            prep_path = build_preparation(export_path, prep_dir)
            prep = load_json(prep_path)

            selected.append(
                SelectedCase(
                    export_file=row["export_file"],
                    model_id=prep["modelId"],
                    subtree_id=prep["subtreeId"],
                    root_gate_id=prep["rootGateId"],
                    topology_class=prep["topologyClass"],
                    preparation_artifact_path=str(prep_path),
                    case_label=case_label,
                )
            )
            existing.add(case_label)
            picked += 1

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


def main() -> None:
    run_cmd(["npx", "nx", "build", "quantum-readiness"])

    seed_workspace()
    selected = choose_cases()
    run_validation(selected)
    rollup = reroll()

    SUMMARY_DIR.mkdir(parents=True, exist_ok=True)

    summary = {
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "scriptVersion": SCRIPT_VERSION,
        "inventoryJson": str(INVENTORY_JSON),
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
    }

    summary_path = SUMMARY_DIR / "openpra_quantum_real_d_representative_summary_v1.json"
    write_json(summary_path, summary)

    memo_lines = [
        "OpenPRA Quantum Real D Representative Expansion Summary v1",
        "",
        f"Generated at UTC: {summary['generatedAtUtc']}",
        f"Script version: {SCRIPT_VERSION}",
        "",
        f"Selected count: {summary['selectedCount']}",
        f"Topology counts after expansion: {summary['topologyCountsAfterExpansion']}",
        f"Primary mode counts after expansion: {summary['primaryModeCountsAfterExpansion']}",
        f"All exact after expansion: {summary['allExactAfterExpansion']}",
        f"Operator attention count after expansion: {summary['operatorAttentionCountAfterExpansion']}",
        "",
        "Selected cases:",
        "",
    ]

    if selected:
        for case in selected:
            memo_lines.append(
                f"{case.export_file} | {case.model_id} | {case.subtree_id} | "
                f"{case.root_gate_id} | {case.topology_class} | {case.case_label}"
            )
    else:
        memo_lines.append("No new real D cases were added.")

    memo_lines.extend(
        [
            "",
            f"Rollup JSON: {summary['rollupPath']}",
            f"Summary JSON: {summary_path}",
            "",
        ]
    )

    memo_path = SUMMARY_DIR / "OPENPRA_QUANTUM_REAL_D_REPRESENTATIVE_MEMO_v1.txt"
    memo_path.write_text("\n".join(memo_lines), encoding="utf-8")

    print(memo_path)
    print(summary_path)


if __name__ == "__main__":
    main()
