#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
HOLDOUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_holdout_adjudication_v1"
OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_holdout_adjudication_freeze_v1"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def latest_dir(base: Path, pattern: str) -> Path:
    matches = sorted(base.glob(pattern))
    if not matches:
        raise RuntimeError(f"No matches under {base} for {pattern}")
    return matches[-1]


def load_csv_dicts(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_csv(path: Path, header: list[str], rows: list[list[str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main() -> None:
    holdout_dir = latest_dir(HOLDOUT_BASE, "OPENPRA_WS4_HOLDOUT_ADJUDICATION_v1_*")
    registry_csv = holdout_dir / "CONTROL" / "openpra_ws4_holdout_adjudication_registry_v1.csv"

    if not registry_csv.exists():
        raise RuntimeError(f"Missing holdout registry: {registry_csv}")

    registry_rows = load_csv_dicts(registry_csv)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    out_dir = OUT_BASE / f"OPENPRA_WS4_HOLDOUT_ADJUDICATION_FREEZE_v1_{stamp}"
    control_dir = out_dir / "CONTROL"
    manifests_dir = out_dir / "MANIFESTS"
    control_dir.mkdir(parents=True, exist_ok=True)
    manifests_dir.mkdir(parents=True, exist_ok=True)

    final_rows = []
    accepted_rows = []
    retained_rows = []

    for row in registry_rows:
        phase2b_row_id = row.get("phase2b_row_id", "").strip()
        workspace_case_dir = row.get("workspace_case_dir", "").strip()
        case_dir = REPO_ROOT / workspace_case_dir
        result_json = case_dir / "holdout_result_v1.json"

        if not result_json.exists():
            raise RuntimeError(f"Missing holdout result: {result_json}")

        result = load_json(result_json)
        adjudication_status = str(result.get("adjudication_status", "")).strip()
        root_gate_resolution = str(result.get("root_gate_resolution", "")).strip()
        bucket_resolution = str(result.get("bucket_resolution", "")).strip()
        disposition = str(result.get("disposition", "")).strip()
        recommendation_notes = str(result.get("recommendation_notes", "")).strip()

        if adjudication_status == "recommended_accept":
            final_status = "final_accept"
            final_disposition = "accept_outside_frozen_baseline"
        elif adjudication_status == "recommended_hold_out":
            final_status = "final_hold_out"
            final_disposition = "retain_holdout"
        else:
            raise RuntimeError(
                f"Holdout {phase2b_row_id} is not decision ready. adjudication_status={adjudication_status}"
            )

        out_row = [
            phase2b_row_id,
            row.get("root_gate_id", "").strip(),
            row.get("topology_class", "").strip(),
            row.get("n_basic", "").strip(),
            row.get("selection_bucket", "").strip(),
            row.get("source_relative_path", "").strip(),
            row.get("holdout_reason", "").strip(),
            adjudication_status,
            final_status,
            root_gate_resolution,
            bucket_resolution,
            disposition or final_disposition,
            recommendation_notes,
        ]
        final_rows.append(out_row)

        if final_status == "final_accept":
            accepted_rows.append(out_row)
        else:
            retained_rows.append(out_row)

    header = [
        "phase2b_row_id",
        "original_root_gate_id",
        "original_topology_class",
        "original_n_basic",
        "original_selection_bucket",
        "source_relative_path",
        "holdout_reason",
        "seeded_adjudication_status",
        "final_status",
        "root_gate_resolution",
        "bucket_resolution",
        "disposition",
        "recommendation_notes",
    ]

    final_csv = control_dir / "openpra_ws4_holdout_final_decisions_v1.csv"
    accepted_csv = control_dir / "openpra_ws4_holdout_final_accepts_v1.csv"
    retained_csv = control_dir / "openpra_ws4_holdout_final_retained_v1.csv"

    write_csv(final_csv, header, final_rows)
    write_csv(accepted_csv, header, accepted_rows)
    write_csv(retained_csv, header, retained_rows)

    summary_json = control_dir / "openpra_ws4_holdout_adjudication_freeze_v1.json"
    write_json(
        summary_json,
        {
            "artifact_name": "OPENPRA_WS4_HOLDOUT_ADJUDICATION_FREEZE_v1",
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "source_holdout_workspace": holdout_dir.relative_to(REPO_ROOT).as_posix(),
            "holdout_total": len(final_rows),
            "final_accept_count": len(accepted_rows),
            "final_retained_holdout_count": len(retained_rows),
            "outputs": {
                "final_csv": final_csv.relative_to(REPO_ROOT).as_posix(),
                "accepted_csv": accepted_csv.relative_to(REPO_ROOT).as_posix(),
                "retained_csv": retained_csv.relative_to(REPO_ROOT).as_posix(),
            },
        },
    )

    memo_md = control_dir / "openpra_ws4_holdout_adjudication_freeze_memo_v1.md"
    memo_md.write_text(
        "\n".join(
            [
                "# OpenPRA WS4 Holdout Adjudication Freeze v1",
                "",
                f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}",
                f"Source holdout workspace: {holdout_dir.relative_to(REPO_ROOT).as_posix()}",
                "",
                f"Total holdouts adjudicated: {len(final_rows)}",
                f"Final accepts outside frozen baseline: {len(accepted_rows)}",
                f"Final retained holdouts: {len(retained_rows)}",
                "",
                "Final decisions:",
                "- phase2b_row_0274 -> final_accept outside frozen baseline as D_n8",
                "- phase2b_row_4228 -> final_accept outside frozen baseline as D_n8",
                "- phase2b_row_9683 -> final_hold_out",
                "",
                "Decision:",
                "WS4 holdout adjudication is frozen. WS4 baseline remains unchanged and frozen.",
            ]
        ) + "\n",
        encoding="utf-8",
    )

    manifest_json = manifests_dir / "openpra_ws4_holdout_adjudication_freeze_manifest_v1.json"
    manifest_files = [final_csv, accepted_csv, retained_csv, summary_json, memo_md]
    manifest_payload = {
        "artifact_name": "OPENPRA_WS4_HOLDOUT_ADJUDICATION_FREEZE_MANIFEST_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "files": [],
    }
    for p in manifest_files:
        manifest_payload["files"].append(
            {
                "relative_path": p.relative_to(out_dir).as_posix(),
                "sha256": sha256_file(p),
                "size_bytes": p.stat().st_size,
            }
        )
    write_json(manifest_json, manifest_payload)

    manifest_sha = manifests_dir / "openpra_ws4_holdout_adjudication_freeze_manifest_v1.json.sha256"
    manifest_sha.write_text(
        f"{sha256_file(manifest_json)}  {manifest_json.name}\n",
        encoding="utf-8",
    )

    print(str(out_dir))
    print(str(final_csv))
    print(str(accepted_csv))
    print(str(retained_csv))
    print(str(summary_json))
    print(str(memo_md))
    print(str(manifest_json))
    print(str(manifest_sha))
    print(f"holdout_total={len(final_rows)}")
    print(f"final_accept_count={len(accepted_rows)}")
    print(f"final_retained_holdout_count={len(retained_rows)}")


if __name__ == "__main__":
    main()
