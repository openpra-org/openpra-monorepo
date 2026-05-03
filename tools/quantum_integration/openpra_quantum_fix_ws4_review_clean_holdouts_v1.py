#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
FREEZE_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_review_clean_freeze_v1"

HOLDS = [
    {
        "phase2b_row_id": "phase2b_row_0274",
        "root_gate_id": "",
        "topology_class": "D",
        "n_basic": "8",
        "selection_bucket": "D_n8",
        "source_relative_path": "_work/openpra_phase5_select_unique_phase4_bundle_cases_v2/20260414_023339Z/selected_phase4_bundle_cases/0002_0004_phase2b_row_0274/0004_primary_candidate_export.json",
        "holdout_reason": "not admitted in review clean freeze because root_gate_id not cleanly resolved",
    },
    {
        "phase2b_row_id": "phase2b_row_4228",
        "root_gate_id": "",
        "topology_class": "D",
        "n_basic": "8",
        "selection_bucket": "D_n8",
        "source_relative_path": "_work/openpra_phase5_real_candidate_batch_v1/20260415_015023Z/0002_phase2b_row_4228/runtime_source_primary_candidate_export.json",
        "holdout_reason": "not admitted in review clean freeze because root_gate_id not cleanly resolved and gate-path evidence is mixed",
    },
    {
        "phase2b_row_id": "phase2b_row_9683",
        "root_gate_id": "G:G1461",
        "topology_class": "",
        "n_basic": "",
        "selection_bucket": "",
        "source_relative_path": "_work/openpra_quantum_simulator_validation_v1_real/_quarantine_unclassified/phase2b_row_9683__G_G1461/00_inputs/openpra_quantum_preparation_artifact_v1.json",
        "holdout_reason": "held out because evidence conflicts across D_n8, unclassified_n8, and unclassified_n2",
    },
]


def find_latest_freeze_dir() -> Path:
    candidates = sorted(FREEZE_BASE.glob("OPENPRA_WS4_REVIEW_CLEAN_FREEZE_v1_*"))
    if not candidates:
        raise RuntimeError(f"No review clean freeze directory found under {FREEZE_BASE}")
    return candidates[-1]


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main() -> None:
    freeze_dir = find_latest_freeze_dir()

    holdout_csv = freeze_dir / "openpra_ws4_review_clean_holdouts_v1.csv"
    memo_md = freeze_dir / "openpra_ws4_review_clean_memo_v1.md"
    summary_json = freeze_dir / "openpra_ws4_review_clean_summary_v1.json"

    with holdout_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "phase2b_row_id",
                "root_gate_id",
                "topology_class",
                "n_basic",
                "selection_bucket",
                "source_relative_path",
                "holdout_reason",
            ]
        )
        for row in HOLDS:
            writer.writerow(
                [
                    row["phase2b_row_id"],
                    row["root_gate_id"],
                    row["topology_class"],
                    row["n_basic"],
                    row["selection_bucket"],
                    row["source_relative_path"],
                    row["holdout_reason"],
                ]
            )

    if summary_json.exists():
        payload = load_json(summary_json)
    else:
        payload = {}

    payload["generated_at_utc"] = datetime.now(timezone.utc).isoformat()
    payload["held_out_case_count"] = len(HOLDS)
    outputs = payload.setdefault("outputs", {})
    outputs["holdout_csv"] = holdout_csv.relative_to(REPO_ROOT).as_posix()
    write_json(summary_json, payload)

    if memo_md.exists():
        lines = memo_md.read_text(encoding="utf-8").splitlines()
        rebuilt = []
        replaced = False
        i = 0
        while i < len(lines):
            line = lines[i]
            if line.strip() == "Held out for later adjudication:":
                rebuilt.append(line)
                rebuilt.append("- phase2b_row_0274")
                rebuilt.append("- phase2b_row_4228")
                rebuilt.append("- phase2b_row_9683")
                replaced = True
                i += 1
                while i < len(lines) and lines[i].startswith("- phase2b_row_"):
                    i += 1
                continue
            rebuilt.append(line)
            i += 1

        if not replaced:
            rebuilt.extend(
                [
                    "",
                    "Held out for later adjudication:",
                    "- phase2b_row_0274",
                    "- phase2b_row_4228",
                    "- phase2b_row_9683",
                ]
            )
        memo_md.write_text("\n".join(rebuilt) + "\n", encoding="utf-8")

    print(str(freeze_dir))
    print(str(holdout_csv))
    print(str(summary_json))
    print(str(memo_md))
    print(f"held_out_case_count={len(HOLDS)}")


if __name__ == "__main__":
    main()
