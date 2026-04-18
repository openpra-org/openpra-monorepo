#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
OPS_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_ops_bundle_v1"
OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_execution_workspace_v1"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def latest_dir(base: Path, pattern: str) -> Path:
    candidates = sorted(base.glob(pattern))
    if not candidates:
        raise RuntimeError(f"No matching directory under {base} for {pattern}")
    return candidates[-1]


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
    ops_dir = latest_dir(OPS_BASE, "OPENPRA_WS4_OPS_BUNDLE_v1_*")
    master_csv = ops_dir / "CONTROL_ROOM" / "openpra_ws4_ops_master_sheet_v1.csv"
    holdout_csv = ops_dir / "CONTROL_ROOM" / "openpra_ws4_ops_holdouts_v1.csv"

    if not master_csv.exists():
        raise RuntimeError(f"Missing ops master sheet: {master_csv}")

    master_rows = load_csv_dicts(master_csv)
    holdout_rows = load_csv_dicts(holdout_csv) if holdout_csv.exists() else []

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    out_dir = OUT_BASE / f"OPENPRA_WS4_EXECUTION_WORKSPACE_v1_{stamp}"
    cases_dir = out_dir / "CASES"
    holdouts_dir = out_dir / "HOLDOUTS"
    manifests_dir = out_dir / "MANIFESTS"
    for d in [cases_dir, holdouts_dir, manifests_dir]:
        d.mkdir(parents=True, exist_ok=True)

    registry_rows = []
    manifest_files = []

    for row in master_rows:
        selection_rank = row.get("selection_rank", "").strip()
        phase2b_row_id = row.get("phase2b_row_id", "").strip()
        case_id = row.get("case_id", "").strip() or phase2b_row_id
        root_gate_id = row.get("root_gate_id", "").strip()
        topology_class = row.get("topology_class", "").strip()
        n_basic = row.get("n_basic", "").strip()
        selection_bucket = row.get("selection_bucket", "").strip()
        source_relative_path = row.get("source_relative_path", "").strip()

        case_dir = cases_dir / f"{selection_rank.zfill(3)}_{phase2b_row_id}"
        (case_dir / "INPUTS").mkdir(parents=True, exist_ok=True)
        (case_dir / "RUNS").mkdir(parents=True, exist_ok=True)
        (case_dir / "RESULTS").mkdir(parents=True, exist_ok=True)
        (case_dir / "LOGS").mkdir(parents=True, exist_ok=True)

        control_json = case_dir / "case_control_v1.json"
        result_json = case_dir / "case_result_v1.json"
        run_log_csv = case_dir / "run_log_v1.csv"

        write_json(
            control_json,
            {
                "selection_rank": selection_rank,
                "case_id": case_id,
                "phase2b_row_id": phase2b_row_id,
                "root_gate_id": root_gate_id,
                "topology_class": topology_class,
                "n_basic": n_basic,
                "selection_bucket": selection_bucket,
                "source_relative_path": source_relative_path,
                "workspace_case_dir": case_dir.relative_to(REPO_ROOT).as_posix(),
                "status": "initialized",
            },
        )

        write_json(
            result_json,
            {
                "case_id": case_id,
                "phase2b_row_id": phase2b_row_id,
                "preparation_validation_status": "pending",
                "statevector_validation_status": "pending",
                "recovery_validation_status": "pending",
                "overall_case_status": "pending",
                "last_updated_utc": datetime.now(timezone.utc).isoformat(),
            },
        )

        write_csv(
            run_log_csv,
            [
                "timestamp_utc",
                "step",
                "status",
                "notes",
            ],
            [],
        )

        manifest_files.extend([control_json, result_json, run_log_csv])

        registry_rows.append(
            [
                selection_rank,
                case_id,
                phase2b_row_id,
                root_gate_id,
                topology_class,
                n_basic,
                selection_bucket,
                case_dir.relative_to(REPO_ROOT).as_posix(),
                "initialized",
            ]
        )

    holdout_registry_rows = []
    for idx, row in enumerate(holdout_rows, start=1):
        phase2b_row_id = row.get("phase2b_row_id", "").strip()
        holdout_dir = holdouts_dir / f"{str(idx).zfill(3)}_{phase2b_row_id}"
        holdout_dir.mkdir(parents=True, exist_ok=True)

        holdout_json = holdout_dir / "holdout_control_v1.json"
        write_json(
            holdout_json,
            {
                "phase2b_row_id": phase2b_row_id,
                "root_gate_id": row.get("root_gate_id", "").strip(),
                "topology_class": row.get("topology_class", "").strip(),
                "n_basic": row.get("n_basic", "").strip(),
                "selection_bucket": row.get("selection_bucket", "").strip(),
                "source_relative_path": row.get("source_relative_path", "").strip(),
                "holdout_reason": row.get("holdout_reason", "").strip(),
                "followup_status": row.get("followup_status", "").strip() or "pending_followup",
            },
        )
        manifest_files.append(holdout_json)

        holdout_registry_rows.append(
            [
                phase2b_row_id,
                row.get("selection_bucket", "").strip(),
                holdout_dir.relative_to(REPO_ROOT).as_posix(),
                row.get("followup_status", "").strip() or "pending_followup",
            ]
        )

    registry_csv = out_dir / "openpra_ws4_execution_registry_v1.csv"
    write_csv(
        registry_csv,
        [
            "selection_rank",
            "case_id",
            "phase2b_row_id",
            "root_gate_id",
            "topology_class",
            "n_basic",
            "selection_bucket",
            "workspace_case_dir",
            "status",
        ],
        registry_rows,
    )
    manifest_files.append(registry_csv)

    holdout_registry_csv = out_dir / "openpra_ws4_holdout_registry_v1.csv"
    write_csv(
        holdout_registry_csv,
        [
            "phase2b_row_id",
            "selection_bucket",
            "workspace_holdout_dir",
            "followup_status",
        ],
        holdout_registry_rows,
    )
    manifest_files.append(holdout_registry_csv)

    summary_json = out_dir / "openpra_ws4_execution_workspace_summary_v1.json"
    write_json(
        summary_json,
        {
            "artifact_name": "OPENPRA_WS4_EXECUTION_WORKSPACE_v1",
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "source_ops_dir": ops_dir.relative_to(REPO_ROOT).as_posix(),
            "execution_case_count": len(master_rows),
            "holdout_case_count": len(holdout_rows),
            "outputs": {
                "registry_csv": registry_csv.relative_to(REPO_ROOT).as_posix(),
                "holdout_registry_csv": holdout_registry_csv.relative_to(REPO_ROOT).as_posix(),
            },
        },
    )
    manifest_files.append(summary_json)

    memo_md = out_dir / "openpra_ws4_execution_workspace_memo_v1.md"
    memo_md.write_text(
        "\n".join(
            [
                "# OpenPRA WS4 Execution Workspace Memo v1",
                "",
                f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}",
                f"Source ops bundle: {ops_dir.relative_to(REPO_ROOT).as_posix()}",
                f"Execution case count: {len(master_rows)}",
                f"Holdout count: {len(holdout_rows)}",
                "",
                "Decision:",
                "Use this workspace as the single per-case results area for WS4 execution.",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    manifest_files.append(memo_md)

    manifest_json = manifests_dir / "openpra_ws4_execution_workspace_manifest_v1.json"
    manifest_payload = {
        "artifact_name": "OPENPRA_WS4_EXECUTION_WORKSPACE_MANIFEST_v1",
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

    manifest_sha = manifests_dir / "openpra_ws4_execution_workspace_manifest_v1.json.sha256"
    manifest_sha.write_text(
        f"{sha256_file(manifest_json)}  {manifest_json.name}\n",
        encoding="utf-8",
    )

    print(str(out_dir))
    print(str(registry_csv))
    print(str(holdout_registry_csv))
    print(str(summary_json))
    print(str(memo_md))
    print(str(manifest_json))
    print(str(manifest_sha))
    print(f"execution_case_count={len(master_rows)}")
    print(f"holdout_case_count={len(holdout_rows)}")


if __name__ == "__main__":
    main()
