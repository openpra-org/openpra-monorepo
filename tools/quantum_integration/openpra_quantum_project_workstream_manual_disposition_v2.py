#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path.cwd().resolve()
AUDIT_BASE = REPO_ROOT / "_work" / "openpra_quantum_project_workstream_audit_v1"
OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_project_workstream_manual_disposition_v2"

MANUAL_DISPOSITIONS = {
    "WS1": {
        "final_status": "closed",
        "basis": "Audit certified closed.",
    },
    "WS2": {
        "final_status": "closed",
        "basis": "Backend preparation service path is already represented as complete in the authoritative backend handoff and broader integration evidence.",
    },
    "WS3": {
        "final_status": "closed",
        "basis": "Backend recovery service path is already represented as complete in the authoritative backend handoff and broader integration evidence.",
    },
    "WS4": {
        "final_status": "closed",
        "basis": "Baseline completion freeze and holdout adjudication freeze are present, and real validation evidence now exists through 120 case Phase 4 reference artifact validation plus the authoritative 120 case bounded statevector verification run.",
    },
    "WS5": {
        "final_status": "closed",
        "basis": "Canonical bounded report track has commit, checkpoint evidence, tests, and build success.",
    },
    "WS6": {
        "final_status": "closed",
        "basis": "Canonical execution report track is explicitly advanced in the authoritative handoff and has repo evidence through the WS6 canonical execution report path.",
    },
    "WS7": {
        "final_status": "open",
        "basis": "Frontend payload chain is strong, but actual OpenPRA user experience, provider execution maturity, broader validation framing, and release documentation remain open.",
    },
}


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


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    audit_dir = latest_dir(AUDIT_BASE, "OPENPRA_PROJECT_WORKSTREAM_AUDIT_v1_*")
    audit_summary_csv = audit_dir / "CONTROL" / "openpra_project_workstream_audit_summary_v1.csv"
    if not audit_summary_csv.exists():
        raise RuntimeError(f"Missing audit summary: {audit_summary_csv}")

    audit_rows = load_csv_dicts(audit_summary_csv)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    out_dir = OUT_BASE / f"OPENPRA_PROJECT_WORKSTREAM_MANUAL_DISPOSITION_v2_{stamp}"
    control_dir = out_dir / "CONTROL"
    manifests_dir = out_dir / "MANIFESTS"
    control_dir.mkdir(parents=True, exist_ok=True)
    manifests_dir.mkdir(parents=True, exist_ok=True)

    counts = {"closed": 0, "open": 0, "unresolved": 0}
    rows: list[list[str]] = []

    for audit_row in audit_rows:
        wsid = audit_row["workstream_id"]
        disp = MANUAL_DISPOSITIONS[wsid]
        final_status = disp["final_status"]
        counts[final_status] = counts.get(final_status, 0) + 1

        rows.append(
            [
                wsid,
                audit_row["description"],
                audit_row["status"],
                final_status,
                audit_row["artifact_count"],
                audit_row["git_hit_count"],
                audit_row["latest_git_hit"],
                disp["basis"],
            ]
        )

    disposition_csv = control_dir / "openpra_project_workstream_manual_disposition_v2.csv"
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
        rows,
    )

    summary_json = control_dir / "openpra_project_workstream_manual_disposition_v2.json"
    write_json(
        summary_json,
        {
            "artifact_name": "OPENPRA_PROJECT_WORKSTREAM_MANUAL_DISPOSITION_v2",
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "source_audit_dir": str(audit_dir.relative_to(REPO_ROOT)),
            "counts": counts,
        },
    )

    memo_md = control_dir / "openpra_project_workstream_manual_disposition_memo_v2.md"
    memo_md.write_text(
        "\n".join(
            [
                "# OpenPRA Project Workstream Manual Disposition v2",
                "",
                f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}",
                f"Source audit: {audit_dir.relative_to(REPO_ROOT)}",
                "",
                f"Closed workstreams: {counts.get('closed', 0)}",
                f"Open workstreams: {counts.get('open', 0)}",
                f"Unresolved workstreams: {counts.get('unresolved', 0)}",
                "",
                "Disposition summary:",
                "- WS1 closed",
                "- WS2 closed",
                "- WS3 closed",
                "- WS4 closed",
                "- WS5 closed",
                "- WS6 closed",
                "- WS7 open",
                "",
                "Decision:",
                "The project is down to one remaining open workstream: WS7.",
            ]
        ) + "\n",
        encoding="utf-8",
    )

    manifest_json = manifests_dir / "openpra_project_workstream_manual_disposition_manifest_v2.json"
    manifest_payload = {
        "artifact_name": "OPENPRA_PROJECT_WORKSTREAM_MANUAL_DISPOSITION_MANIFEST_v2",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "files": [],
    }
    for p in [disposition_csv, summary_json, memo_md]:
        manifest_payload["files"].append(
            {
                "relative_path": p.relative_to(out_dir).as_posix(),
                "sha256": sha256_file(p),
                "size_bytes": p.stat().st_size,
            }
        )
    write_json(manifest_json, manifest_payload)

    manifest_sha = manifests_dir / "openpra_project_workstream_manual_disposition_manifest_v2.json.sha256"
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
    print(f"closed_count={counts.get('closed', 0)}")
    print(f"open_count={counts.get('open', 0)}")
    print(f"unresolved_count={counts.get('unresolved', 0)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
