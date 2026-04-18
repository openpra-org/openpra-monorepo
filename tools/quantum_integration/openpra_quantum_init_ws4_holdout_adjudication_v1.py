#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
FREEZE_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_completion_freeze_v1"
OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_holdout_adjudication_v1"


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
    freeze_dir = latest_dir(FREEZE_BASE, "OPENPRA_WS4_COMPLETION_FREEZE_v1_*")
    holdouts_csv = freeze_dir / "CONTROL" / "openpra_ws4_holdouts_v1.csv"
    if not holdouts_csv.exists():
        raise RuntimeError(f"Missing holdout CSV: {holdouts_csv}")

    holdout_rows = load_csv_dicts(holdouts_csv)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    out_dir = OUT_BASE / f"OPENPRA_WS4_HOLDOUT_ADJUDICATION_v1_{stamp}"
    control_dir = out_dir / "CONTROL"
    cases_dir = out_dir / "CASES"
    manifests_dir = out_dir / "MANIFESTS"

    control_dir.mkdir(parents=True, exist_ok=True)
    cases_dir.mkdir(parents=True, exist_ok=True)
    manifests_dir.mkdir(parents=True, exist_ok=True)

    registry_rows = []
    manifest_files: list[Path] = []

    for idx, row in enumerate(holdout_rows, start=1):
        phase2b_row_id = row.get("phase2b_row_id", "").strip()
        root_gate_id = row.get("root_gate_id", "").strip()
        topology_class = row.get("topology_class", "").strip()
        n_basic = row.get("n_basic", "").strip()
        selection_bucket = row.get("selection_bucket", "").strip()
        source_relative_path = row.get("source_relative_path", "").strip()
        holdout_reason = row.get("holdout_reason", "").strip()
        followup_status = row.get("followup_status", "").strip() or "pending_followup"

        case_dir = cases_dir / f"{str(idx).zfill(3)}_{phase2b_row_id}"
        inputs_dir = case_dir / "INPUTS"
        review_dir = case_dir / "REVIEW"
        results_dir = case_dir / "RESULTS"
        logs_dir = case_dir / "LOGS"

        for d in [inputs_dir, review_dir, results_dir, logs_dir]:
            d.mkdir(parents=True, exist_ok=True)

        control_json = case_dir / "holdout_control_v1.json"
        result_json = case_dir / "holdout_result_v1.json"
        notes_md = case_dir / "adjudication_notes_v1.md"

        write_json(
            control_json,
            {
                "phase2b_row_id": phase2b_row_id,
                "root_gate_id": root_gate_id,
                "topology_class": topology_class,
                "n_basic": n_basic,
                "selection_bucket": selection_bucket,
                "source_relative_path": source_relative_path,
                "holdout_reason": holdout_reason,
                "followup_status": followup_status,
                "workspace_case_dir": case_dir.relative_to(REPO_ROOT).as_posix(),
                "status": "initialized",
            },
        )

        write_json(
            result_json,
            {
                "phase2b_row_id": phase2b_row_id,
                "adjudication_status": "pending",
                "root_gate_resolution": "",
                "bucket_resolution": "",
                "disposition": "",
                "last_updated_utc": datetime.now(timezone.utc).isoformat(),
            },
        )

        notes_md.write_text(
            "\n".join(
                [
                    f"# Holdout adjudication: {phase2b_row_id}",
                    "",
                    f"Root gate id: {root_gate_id or 'UNRESOLVED'}",
                    f"Topology class: {topology_class or 'UNRESOLVED'}",
                    f"n_basic: {n_basic or 'UNRESOLVED'}",
                    f"Selection bucket: {selection_bucket or 'UNRESOLVED'}",
                    "",
                    "## Holdout reason",
                    holdout_reason or "Not provided.",
                    "",
                    "## Evidence review",
                    "",
                    "## Adjudication decision",
                    "",
                    "## Follow on action",
                    "",
                ]
            ) + "\n",
            encoding="utf-8",
        )

        registry_rows.append(
            [
                str(idx),
                phase2b_row_id,
                root_gate_id,
                topology_class,
                n_basic,
                selection_bucket,
                source_relative_path,
                holdout_reason,
                followup_status,
                case_dir.relative_to(REPO_ROOT).as_posix(),
            ]
        )

        manifest_files.extend([control_json, result_json, notes_md])

    registry_csv = control_dir / "openpra_ws4_holdout_adjudication_registry_v1.csv"
    write_csv(
        registry_csv,
        [
            "holdout_index",
            "phase2b_row_id",
            "root_gate_id",
            "topology_class",
            "n_basic",
            "selection_bucket",
            "source_relative_path",
            "holdout_reason",
            "followup_status",
            "workspace_case_dir",
        ],
        registry_rows,
    )
    manifest_files.append(registry_csv)

    summary_json = control_dir / "openpra_ws4_holdout_adjudication_summary_v1.json"
    write_json(
        summary_json,
        {
            "artifact_name": "OPENPRA_WS4_HOLDOUT_ADJUDICATION_v1",
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "source_freeze_dir": freeze_dir.relative_to(REPO_ROOT).as_posix(),
            "holdout_count": len(holdout_rows),
            "outputs": {
                "registry_csv": registry_csv.relative_to(REPO_ROOT).as_posix(),
            },
        },
    )
    manifest_files.append(summary_json)

    memo_md = control_dir / "openpra_ws4_holdout_adjudication_memo_v1.md"
    memo_md.write_text(
        "\n".join(
            [
                "# OpenPRA WS4 Holdout Adjudication v1",
                "",
                f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}",
                f"Source freeze: {freeze_dir.relative_to(REPO_ROOT).as_posix()}",
                f"Holdout count: {len(holdout_rows)}",
                "",
                "Decision:",
                "WS4 baseline is complete and frozen. This workspace is for holdout adjudication only.",
            ]
        ) + "\n",
        encoding="utf-8",
    )
    manifest_files.append(memo_md)

    manifest_json = manifests_dir / "openpra_ws4_holdout_adjudication_manifest_v1.json"
    manifest_payload = {
        "artifact_name": "OPENPRA_WS4_HOLDOUT_ADJUDICATION_MANIFEST_v1",
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

    manifest_sha = manifests_dir / "openpra_ws4_holdout_adjudication_manifest_v1.json.sha256"
    manifest_sha.write_text(
        f"{sha256_file(manifest_json)}  {manifest_json.name}\n",
        encoding="utf-8",
    )

    print(str(out_dir))
    print(str(registry_csv))
    print(str(summary_json))
    print(str(memo_md))
    print(str(manifest_json))
    print(str(manifest_sha))
    print(f"holdout_count={len(holdout_rows)}")


if __name__ == "__main__":
    main()
