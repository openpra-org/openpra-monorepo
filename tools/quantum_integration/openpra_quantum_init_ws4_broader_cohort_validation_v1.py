#!/usr/bin/env python3
from __future__ import annotations

import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_broader_cohort_validation_v1"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def write_csv(path: Path, header: list[str], rows: list[list[str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)


def main() -> None:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    out_dir = OUT_BASE / f"OPENPRA_WS4_BROADER_COHORT_VALIDATION_v1_{stamp}"

    control_dir = out_dir / "CONTROL"
    inputs_dir = out_dir / "INPUTS"
    reports_dir = out_dir / "REPORTS"
    manifests_dir = out_dir / "MANIFESTS"
    logs_dir = out_dir / "LOGS"

    for d in [control_dir, inputs_dir, reports_dir, manifests_dir, logs_dir]:
        d.mkdir(parents=True, exist_ok=True)

    readme_path = out_dir / "README.md"
    write_text(
        readme_path,
        "\n".join(
            [
                "# OpenPRA WS4 Broader Cohort Validation v1",
                "",
                "This workspace initializes the broader cohort validation workstream from the OpenPRA Quantum Integration Plan v2.",
                "",
                "Intent:",
                "1. define a 30 to 50 case broader validation cohort",
                "2. stratify across topology classes A, B, C, D when available",
                "3. include size categories n = 5, 6, 8",
                "4. validate preparation outputs across the cohort",
                "5. validate recovery either from existing execution data or synthetic counts",
                "",
                "Subdirectories:",
                "- CONTROL",
                "- INPUTS",
                "- REPORTS",
                "- MANIFESTS",
                "- LOGS",
                "",
                f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}",
            ]
        )
        + "\n",
    )

    control_payload = {
        "artifact_name": "OPENPRA_WS4_BROADER_COHORT_VALIDATION_CONTROL_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "repo_root": str(REPO_ROOT),
        "plan_alignment": {
            "workstream": 4,
            "title": "Broader Cohort Validation",
            "target_total_cases_min": 30,
            "target_total_cases_max": 50,
            "minimum_topology_classes": 3,
            "target_topology_classes": ["A", "B", "C", "D"],
            "target_size_categories": [5, 6, 8],
            "target_min_cases_per_topology_when_available": 5,
        },
        "validation_rules": {
            "run_preparation_service": True,
            "run_statevector_verification_for_eligible_cases": True,
            "run_recovery_service_on_existing_execution_cases": True,
            "run_synthetic_counts_recovery_for_non_execution_cases": True,
            "synthetic_recovery_expected_exact": True,
        },
        "acceptance_gate": {
            "cohort_size_at_least_30": False,
            "preparation_success_rate_at_least_95_percent": False,
            "all_verification_eligible_cases_pass_statevector_gate": False,
            "synthetic_recovery_exact_for_all_synthetic_cases": False,
            "validation_report_written": False,
        },
        "status": {
            "selection_manifest_started": False,
            "selection_manifest_finalized": False,
            "preparation_runs_started": False,
            "recovery_runs_started": False,
            "summary_report_started": False,
        },
    }
    control_path = control_dir / "openpra_ws4_broader_cohort_validation_control_v1.json"
    write_json(control_path, control_payload)

    selection_header = [
        "case_id",
        "phase2b_row_id",
        "root_gate_id",
        "topology_class",
        "n_basic",
        "has_existing_execution_data",
        "selection_bucket",
        "selection_rationale",
        "preparation_status",
        "recovery_status",
        "notes",
    ]
    selection_rows = [
        [
            "example_case_001",
            "phase2b_row_example",
            "G:G000",
            "A",
            "5",
            "false",
            "A_n5",
            "template placeholder row",
            "pending",
            "pending",
            "replace with real cohort row",
        ]
    ]
    selection_csv_path = inputs_dir / "openpra_ws4_broader_cohort_selection_template_v1.csv"
    write_csv(selection_csv_path, selection_header, selection_rows)

    instructions_path = inputs_dir / "openpra_ws4_broader_cohort_selection_instructions_v1.md"
    write_text(
        instructions_path,
        "\n".join(
            [
                "# WS4 Broader Cohort Selection Instructions",
                "",
                "Selection targets:",
                "- total cohort between 30 and 50 cases",
                "- at least 5 cases per topology class when available",
                "- include n = 5, 6, 8 size categories",
                "- include existing execution cases where available",
                "- include non execution cases for synthetic counts validation",
                "",
                "Suggested buckets:",
                "- A_n5",
                "- A_n6",
                "- A_n8",
                "- B_n5",
                "- B_n6",
                "- B_n8",
                "- C_n5",
                "- C_n6",
                "- C_n8",
                "- D_n5",
                "- D_n6",
                "- D_n8",
                "",
                "Required fields in the CSV:",
                "- case_id",
                "- phase2b_row_id",
                "- root_gate_id",
                "- topology_class",
                "- n_basic",
                "- has_existing_execution_data",
                "- selection_bucket",
                "- selection_rationale",
                "",
                "Do not mark the cohort finalized until every selected row has a stated rationale and bucket.",
            ]
        )
        + "\n",
    )

    summary_template_path = reports_dir / "openpra_ws4_broader_cohort_validation_summary_template_v1.md"
    write_text(
        summary_template_path,
        "\n".join(
            [
                "# WS4 Broader Cohort Validation Summary Template",
                "",
                "## 1. Cohort Overview",
                "- total selected cases:",
                "- topology coverage:",
                "- size coverage:",
                "- existing execution cases:",
                "- synthetic recovery cases:",
                "",
                "## 2. Preparation Results",
                "- success count:",
                "- failure count:",
                "- success rate:",
                "- root causes for failures:",
                "",
                "## 3. Statevector Verification",
                "- eligible cases:",
                "- passed:",
                "- failed:",
                "- worst infeasible mass:",
                "",
                "## 4. Recovery Results",
                "- existing execution recovery matches:",
                "- synthetic exact recoveries:",
                "- failures and causes:",
                "",
                "## 5. Acceptance Gate Decision",
                "- cohort size gate:",
                "- preparation gate:",
                "- verification gate:",
                "- synthetic recovery gate:",
                "- report written gate:",
                "",
                "## 6. Notes",
                "",
            ]
        )
        + "\n",
    )

    run_register_path = manifests_dir / "openpra_ws4_broader_cohort_run_register_v1.json"
    write_json(
        run_register_path,
        {
            "artifact_name": "OPENPRA_WS4_BROADER_COHORT_RUN_REGISTER_v1",
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "entries": [],
        },
    )

    scaffold_files = [
        readme_path,
        control_path,
        selection_csv_path,
        instructions_path,
        summary_template_path,
        run_register_path,
    ]

    scaffold_manifest = {
        "artifact_name": "OPENPRA_WS4_BROADER_COHORT_VALIDATION_SCAFFOLD_MANIFEST_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "workspace_dir": str(out_dir),
        "files": [
            {
                "relative_path": path.relative_to(out_dir).as_posix(),
                "sha256": sha256_file(path),
                "size_bytes": path.stat().st_size,
            }
            for path in scaffold_files
        ],
    }
    scaffold_manifest_path = manifests_dir / "openpra_ws4_broader_cohort_validation_scaffold_manifest_v1.json"
    write_json(scaffold_manifest_path, scaffold_manifest)

    scaffold_manifest_sha_path = manifests_dir / "openpra_ws4_broader_cohort_validation_scaffold_manifest_v1.json.sha256"
    write_text(
        scaffold_manifest_sha_path,
        f"{sha256_file(scaffold_manifest_path)}  {scaffold_manifest_path.name}\n",
    )

    print(str(out_dir))
    print(str(control_path))
    print(str(selection_csv_path))
    print(str(scaffold_manifest_path))
    print(str(scaffold_manifest_sha_path))


if __name__ == "__main__":
    main()
