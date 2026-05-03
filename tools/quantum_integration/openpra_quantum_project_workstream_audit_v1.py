#!/usr/bin/env python3
from __future__ import annotations

import csv
import glob
import json
import hashlib
import subprocess
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_project_workstream_audit_v1"

WORKSTREAMS = [
    {
        "workstream_id": "WS1",
        "description": "WS1 acceptance closeout and artifact hygiene",
        "artifact_globs": [
            "_work/openpra_quantum_ws1_acceptance_closeout_v1/OPENPRA_WS1_ACCEPTANCE_CLOSEOUT_v1_*",
            "tools/quantum_integration/*ws1*",
        ],
        "git_grep_terms": ["ws1", "close ws1", "acceptance closeout"],
        "explicit_closure_requirements": [
            "_work/openpra_quantum_ws1_acceptance_closeout_v1/OPENPRA_WS1_ACCEPTANCE_CLOSEOUT_v1_*",
        ],
    },
    {
        "workstream_id": "WS2",
        "description": "WS2 evidence scan from repo history and generated artifacts",
        "artifact_globs": [
            "_work/*ws2*",
            "tools/quantum_integration/*ws2*",
        ],
        "git_grep_terms": ["ws2", "workstream 2"],
        "explicit_closure_requirements": [],
    },
    {
        "workstream_id": "WS3",
        "description": "WS3 evidence scan from repo history and generated artifacts",
        "artifact_globs": [
            "_work/*ws3*",
            "tools/quantum_integration/*ws3*",
        ],
        "git_grep_terms": ["ws3", "workstream 3"],
        "explicit_closure_requirements": [],
    },
    {
        "workstream_id": "WS4",
        "description": "WS4 review clean baseline plus holdout adjudication",
        "artifact_globs": [
            "_work/openpra_quantum_ws4_completion_freeze_v1/OPENPRA_WS4_COMPLETION_FREEZE_v1_*",
            "_work/openpra_quantum_ws4_holdout_adjudication_freeze_v1/OPENPRA_WS4_HOLDOUT_ADJUDICATION_FREEZE_v1_*",
            "tools/quantum_integration/*ws4*",
        ],
        "git_grep_terms": ["ws4", "freeze ws4", "holdout adjudication", "review clean"],
        "explicit_closure_requirements": [
            "_work/openpra_quantum_ws4_completion_freeze_v1/OPENPRA_WS4_COMPLETION_FREEZE_v1_*",
            "_work/openpra_quantum_ws4_holdout_adjudication_freeze_v1/OPENPRA_WS4_HOLDOUT_ADJUDICATION_FREEZE_v1_*",
        ],
    },
    {
        "workstream_id": "WS5",
        "description": "WS5 evidence scan from repo history and generated artifacts",
        "artifact_globs": [
            "_work/*ws5*",
            "tools/quantum_integration/*ws5*",
        ],
        "git_grep_terms": ["ws5", "workstream 5"],
        "explicit_closure_requirements": [],
    },
    {
        "workstream_id": "WS6",
        "description": "WS6 originally outside critical path, now included in completion audit",
        "artifact_globs": [
            "_work/*ws6*",
            "tools/quantum_integration/*ws6*",
        ],
        "git_grep_terms": ["ws6", "workstream 6", "outside critical path"],
        "explicit_closure_requirements": [],
    },
    {
        "workstream_id": "WS7",
        "description": "WS7 frontend and backend payload chain and closeout evidence",
        "artifact_globs": [
            "_work/*ws7*",
            "tools/quantum_integration/*ws7*",
            "tools/quantum_integration/*frontend*",
            "tools/quantum_integration/*payload*",
        ],
        "git_grep_terms": ["ws7", "frontend", "payload", "execution mode selection", "subtree detail"],
        "explicit_closure_requirements": [],
    },
]


def run_git_log_search(terms: list[str]) -> list[str]:
    results: list[str] = []
    seen: set[str] = set()

    for term in terms:
        try:
            proc = subprocess.run(
                [
                    "git",
                    "log",
                    "--oneline",
                    "--decorate=short",
                    "--all",
                    "--grep",
                    term,
                    "-i",
                ],
                cwd=REPO_ROOT,
                capture_output=True,
                text=True,
                check=False,
            )
        except Exception:
            continue

        for line in proc.stdout.splitlines():
            line = line.strip()
            if line and line not in seen:
                seen.add(line)
                results.append(line)

    return results


def expand_globs(patterns: list[str]) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    for pattern in patterns:
        full_pattern = str(REPO_ROOT / pattern)
        for match in sorted(glob.glob(full_pattern)):
            rel = str(Path(match).relative_to(REPO_ROOT))
            if rel not in seen:
                seen.add(rel)
                found.append(rel)
    return found


def requirement_satisfied(pattern: str) -> bool:
    full_pattern = str(REPO_ROOT / pattern)
    return len(glob.glob(full_pattern)) > 0


def main() -> None:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    out_dir = OUT_BASE / f"OPENPRA_PROJECT_WORKSTREAM_AUDIT_v1_{stamp}"
    control_dir = out_dir / "CONTROL"
    manifests_dir = out_dir / "MANIFESTS"
    control_dir.mkdir(parents=True, exist_ok=True)
    manifests_dir.mkdir(parents=True, exist_ok=True)

    rows: list[list[str]] = []
    audit_records: list[dict] = []

    fully_closed_count = 0
    manual_review_count = 0
    no_evidence_count = 0

    for ws in WORKSTREAMS:
        artifact_matches = expand_globs(ws["artifact_globs"])
        git_matches = run_git_log_search(ws["git_grep_terms"])

        explicit_requirements = ws["explicit_closure_requirements"]
        explicit_ok = True
        for req in explicit_requirements:
            if not requirement_satisfied(req):
                explicit_ok = False
                break

        if explicit_requirements and explicit_ok:
            status = "closed"
        elif artifact_matches or git_matches:
            status = "manual_review_required"
        else:
            status = "no_evidence_found"

        if status == "closed":
            fully_closed_count += 1
        elif status == "manual_review_required":
            manual_review_count += 1
        else:
            no_evidence_count += 1

        latest_git = git_matches[0] if git_matches else ""
        artifact_count = len(artifact_matches)
        git_hit_count = len(git_matches)

        rows.append(
            [
                ws["workstream_id"],
                ws["description"],
                status,
                str(artifact_count),
                str(git_hit_count),
                latest_git,
            ]
        )

        audit_records.append(
            {
                "workstream_id": ws["workstream_id"],
                "description": ws["description"],
                "status": status,
                "artifact_count": artifact_count,
                "git_hit_count": git_hit_count,
                "latest_git_hit": latest_git,
                "artifact_matches": artifact_matches,
                "git_matches": git_matches,
                "explicit_closure_requirements": explicit_requirements,
                "explicit_requirements_satisfied": explicit_ok,
            }
        )

    summary_csv = control_dir / "openpra_project_workstream_audit_summary_v1.csv"
    with summary_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "workstream_id",
                "description",
                "status",
                "artifact_count",
                "git_hit_count",
                "latest_git_hit",
            ]
        )
        writer.writerows(rows)

    audit_json = control_dir / "openpra_project_workstream_audit_v1.json"
    audit_payload = {
        "artifact_name": "OPENPRA_PROJECT_WORKSTREAM_AUDIT_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "repo_root": str(REPO_ROOT),
        "summary": {
            "closed_count": fully_closed_count,
            "manual_review_required_count": manual_review_count,
            "no_evidence_found_count": no_evidence_count,
        },
        "records": audit_records,
    }
    audit_json.write_text(json.dumps(audit_payload, indent=2), encoding="utf-8")

    memo_md = control_dir / "openpra_project_workstream_audit_memo_v1.md"
    memo_lines = [
        "# OpenPRA Project Workstream Audit v1",
        "",
        f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}",
        "",
        "Interpretation rule:",
        "- closed means explicit closure requirements were found",
        "- manual_review_required means some evidence exists but the script cannot honestly certify 100 percent closure by itself",
        "- no_evidence_found means the repo scan did not find enough evidence to judge the workstream",
        "",
        f"Closed count: {fully_closed_count}",
        f"Manual review required count: {manual_review_count}",
        f"No evidence found count: {no_evidence_count}",
        "",
        "Important note:",
        "This audit is designed to prevent us from overclaiming completion.",
    ]
    memo_md.write_text("\n".join(memo_lines) + "\n", encoding="utf-8")

    manifest_json = manifests_dir / "openpra_project_workstream_audit_manifest_v1.json"
    manifest_payload = {
        "artifact_name": "OPENPRA_PROJECT_WORKSTREAM_AUDIT_MANIFEST_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "files": [],
    }
    for p in [summary_csv, audit_json, memo_md]:
        manifest_payload["files"].append(
            {
                "relative_path": p.relative_to(out_dir).as_posix(),
                "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
                "size_bytes": p.stat().st_size,
            }
        )
    manifest_json.write_text(json.dumps(manifest_payload, indent=2), encoding="utf-8")

    manifest_sha = manifests_dir / "openpra_project_workstream_audit_manifest_v1.json.sha256"
    manifest_sha.write_text(
        f"{hashlib.sha256(manifest_json.read_bytes()).hexdigest()}  {manifest_json.name}\n",
        encoding="utf-8",
    )

    print(str(out_dir))
    print(str(summary_csv))
    print(str(audit_json))
    print(str(memo_md))
    print(str(manifest_json))
    print(str(manifest_sha))
    print(f"closed_count={fully_closed_count}")
    print(f"manual_review_required_count={manual_review_count}")
    print(f"no_evidence_found_count={no_evidence_count}")


if __name__ == "__main__":
    main()
