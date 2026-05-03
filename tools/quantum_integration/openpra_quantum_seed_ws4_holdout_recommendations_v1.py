#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
HOLDOUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_holdout_adjudication_v1"


RECOMMENDATIONS = {
    "phase2b_row_0274": {
        "adjudication_status": "recommended_accept",
        "root_gate_resolution": "unresolved_root_gate",
        "bucket_resolution": "D_n8",
        "disposition": "accept_outside_frozen_baseline",
        "recommendation_notes": "Accepted from expansion evidence; D_n8 supported by primary candidate export.",
    },
    "phase2b_row_4228": {
        "adjudication_status": "recommended_accept",
        "root_gate_resolution": "unresolved_root_gate_mixed_gate_path",
        "bucket_resolution": "D_n8",
        "disposition": "accept_outside_frozen_baseline",
        "recommendation_notes": "Accepted from expansion evidence; D_n8 corroborated by package metadata, probabilities, source export, and runtime source primary candidate export.",
    },
    "phase2b_row_9683": {
        "adjudication_status": "recommended_hold_out",
        "root_gate_resolution": "G:G1461",
        "bucket_resolution": "conflicted",
        "disposition": "hold_out",
        "recommendation_notes": "Keep held out because evidence conflicts across D_n8, unclassified_n8, and unclassified_n2.",
    },
}


def latest_dir(base: Path, pattern: str) -> Path:
    matches = sorted(base.glob(pattern))
    if not matches:
        raise RuntimeError(f"No matches under {base} for {pattern}")
    return matches[-1]


def load_csv_dicts(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def write_csv(path: Path, header: list[str], rows: list[list[str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main() -> None:
    holdout_dir = latest_dir(HOLDOUT_BASE, "OPENPRA_WS4_HOLDOUT_ADJUDICATION_v1_*")
    registry_csv = holdout_dir / "CONTROL" / "openpra_ws4_holdout_adjudication_registry_v1.csv"
    memo_md = holdout_dir / "CONTROL" / "openpra_ws4_holdout_adjudication_memo_v1.md"

    rows = load_csv_dicts(registry_csv)

    summary_rows = []
    for row in rows:
        phase2b_row_id = row.get("phase2b_row_id", "").strip()
        workspace_case_dir = row.get("workspace_case_dir", "").strip()
        case_dir = REPO_ROOT / workspace_case_dir
        result_json = case_dir / "holdout_result_v1.json"
        notes_md = case_dir / "adjudication_notes_v1.md"

        rec = RECOMMENDATIONS.get(phase2b_row_id)
        if rec is None:
            continue

        result_payload = load_json(result_json)
        result_payload["adjudication_status"] = rec["adjudication_status"]
        result_payload["root_gate_resolution"] = rec["root_gate_resolution"]
        result_payload["bucket_resolution"] = rec["bucket_resolution"]
        result_payload["disposition"] = rec["disposition"]
        result_payload["recommendation_notes"] = rec["recommendation_notes"]
        result_payload["last_updated_utc"] = datetime.now(timezone.utc).isoformat()
        write_json(result_json, result_payload)

        existing_notes = notes_md.read_text(encoding="utf-8")
        append_block = "\n".join(
            [
                "",
                "## Seeded recommendation",
                f"Adjudication status: {rec['adjudication_status']}",
                f"Root gate resolution: {rec['root_gate_resolution']}",
                f"Bucket resolution: {rec['bucket_resolution']}",
                f"Disposition: {rec['disposition']}",
                "",
                rec["recommendation_notes"],
                "",
            ]
        )
        if "## Seeded recommendation" not in existing_notes:
            notes_md.write_text(existing_notes + append_block, encoding="utf-8")

        summary_rows.append(
            [
                phase2b_row_id,
                rec["adjudication_status"],
                rec["root_gate_resolution"],
                rec["bucket_resolution"],
                rec["disposition"],
                rec["recommendation_notes"],
            ]
        )

    summary_csv = holdout_dir / "CONTROL" / "openpra_ws4_holdout_seeded_recommendations_v1.csv"
    write_csv(
        summary_csv,
        [
            "phase2b_row_id",
            "adjudication_status",
            "root_gate_resolution",
            "bucket_resolution",
            "disposition",
            "recommendation_notes",
        ],
        summary_rows,
    )

    memo_lines = memo_md.read_text(encoding="utf-8").rstrip() + "\n\n"
    memo_lines += "\n".join(
        [
            "Seeded recommendations:",
            "- phase2b_row_0274 -> recommended_accept outside frozen baseline as D_n8",
            "- phase2b_row_4228 -> recommended_accept outside frozen baseline as D_n8",
            "- phase2b_row_9683 -> recommended_hold_out",
            "",
        ]
    )
    memo_md.write_text(memo_lines, encoding="utf-8")

    print(str(holdout_dir))
    print(str(summary_csv))
    print(f"seeded_count={len(summary_rows)}")


if __name__ == "__main__":
    main()
