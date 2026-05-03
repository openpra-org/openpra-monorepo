#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
AUDIT_BASE = REPO_ROOT / "_work" / "openpra_quantum_project_workstream_audit_v1"
OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_project_workstream_manual_disposition_v1"


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


MANUAL_DISPOSITIONS = {
    "WS1": {
        "final_status": "closed",
        "basis": "Audit certified closed.",
    },
    "WS2": {
        "final_status": "unresolved",
        "basis": "No evidence found in repo audit. Needs explicit plan level disposition before claiming closure.",
    },
    "WS3": {
        "final_status": "unresolved",
        "basis": "No evidence found in repo audit. Needs explicit plan level disposition before claiming closure.",
    },
    "WS4": {
        "final_status": "closed",
        "basis": "Baseline completion freeze and holdout adjudication freeze are both present.",
    },
    "WS5": {
        "final_status": "closed",
        "basis": "Canonical bounded report track has commit, checkpoint evidence, tests, and build success; backend completion path is explicitly described as already advanced in the authoritative handoff.",
    },
    "WS6": {
        "final_status": "closed",
        "basis": "Canonical execution report track is explicitly described as already advanced in the authoritative handoff and has repo evidence through the WS6 canonical execution report track.",
    },
    "WS7": {
        "final_status": "open",
        "basis": "Frontend payload chain is strong, but authoritative handoff still lists actual user experience, provider execution maturity, broader validation, and release documentation as remaining major work.",
    },
}


def main() -> None:
    audit_dir = latest_dir(AUDIT_BASE, "OPENPRA_PROJECT_WORKSTREAM_AUDIT_v1_*")
    audit_summary_csv = audit_dir / "CONTROL" / "openpra_project_workstream_audit_summary_v1.csv"
    audit_json = audit_dir / "CONTROL" / "openpra_project_workstream_audit_v1.json"

    if not audit_summary_csv.exists():
        raise RuntimeError(f"Missing audit summary: {audit_summary_csv}")
    if not audit_json.exists():
        raise RuntimeError(f"Missing audit json: {audit_json}")

    audit_rows = load_csv_dicts(audit_summary_csv)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    out_dir = OUT_BASE / f"OPENPRA_PROJECT_WORKSTREAM_MANUAL_DISPOSITION_v1_{stamp}"
    control_dir = out_dir / "CONTROL"
    manifests_dir = out_dir / "MANIFESTS"
    control_dir.mkdir(parents=True, exist_ok=True)
    manifests_dir.mkdir(parents=True, exist_ok=True)

    disposition_rows = []
    final_counts = {
        "closed": 0,
        "open": 0,
        "unresolved": 0,
    }

    for row in audit_rows:
        wsid = row["workstream_id"]
        disposition = MANUAL_DISPOSITIONS.get(
            wsid,
            {
                "final_status": "unresolved",
                "basis": "No manual disposition provided.",
            },
        )
        final_status = disposition["final_status"]
        if final_status not in final_counts:
            final_counts[final_status] = 0
        final_counts[final_status] += 1

        disposition_rows.append(
            [
                wsid,
                row["description"],
                row["status"],
                final_status,
                row["artifact_count"],
                row["git_hit_count"],
                row["latest_git_hit"],
                disposition["basis"],
            ]
        )

    disposition_csv = control_dir / "openpra_project_workstream_manual_disposition_v1.csv"
    write_csv(
        disposition_csv,
        [
            "workstream_id",
            "description",
            "audit_status",
            "final_status",
            "artifact_count",
            "git_hit_count",
            "latest_git_hit",
            "manual_disposition_basis",
        ],
        disposition_rows,
    )

    summary_json = control_dir / "openpra_project_workstream_manual_disposition_v1.json"
    write_json(
        summary_json,
        {
            "artifact_name": "OPENPRA_PROJECT_WORKSTREAM_MANUAL_DISPOSITION_v1",
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "source_audit_dir": audit_dir.relative_to(REPO_ROOT).as_posix(),
            "counts": final_counts,
        },
    )

    memo_md = control_dir / "openpra_project_workstream_manual_disposition_memo_v1.md"
    memo_md.write_text(
        "\n".join(
            [
                "# OpenPRA Project Workstream Manual Disposition v1",
                "",
                f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}",
                f"Source audit: {audit_dir.relative_to(REPO_ROOT).as_posix()}",
                "",
                f"Closed workstreams: {final_counts.get('closed', 0)}",
                f"Open workstreams: {final_counts.get('open', 0)}",
                f"Unresolved workstreams: {final_counts.get('unresolved', 0)}",
                "",
                "Disposition summary:",
                "- WS1 closed",
                "- WS4 closed",
                "- WS5 closed",
                "- WS6 closed",
                "- WS7 open",
                "- WS2 unresolved",
                "- WS3 unresolved",
                "",
                "Decision:",
                "Do not claim whole project 100 percent complete until WS7 is closed and WS2 and WS3 are explicitly resolved.",
            ]
        ) + "\n",
        encoding="utf-8",
    )

    manifest_json = manifests_dir / "openpra_project_workstream_manual_disposition_manifest_v1.json"
    manifest_files = [disposition_csv, summary_json, memo_md]
    manifest_payload = {
        "artifact_name": "OPENPRA_PROJECT_WORKSTREAM_MANUAL_DISPOSITION_MANIFEST_v1",
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

    manifest_sha = manifests_dir / "openpra_project_workstream_manual_disposition_manifest_v1.json.sha256"
    manifest_sha.write_text(
        f"{sha256_file(manifest_json)}  {manifest_json.name}\n",
        encoding="utf-8",
    )

    print(str(out_dir))
    print(str(disposition_csv))
    print(str(summary_json))
    print(str(memo_md))
    print(str(manifest_json))
    print(str(manifest_sha))
    print(f"closed_count={final_counts.get('closed', 0)}")
    print(f"open_count={final_counts.get('open', 0)}")
    print(f"unresolved_count={final_counts.get('unresolved', 0)}")


if __name__ == "__main__":
    main()
