#!/usr/bin/env python3
from __future__ import annotations

import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
GITIGNORE_PATH = REPO_ROOT / ".gitignore"

IGNORE_MARKER = "/_work/openpra_quantum_ws4_tier1_inspection_digest_v1/"
IGNORE_BLOCK = """
/_work/openpra_quantum_ws4_tier1_inspection_digest_v1/
/_work/openpra_quantum_ws4_selection_seed_v1/
"""

PROMOTED_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_tier1_inspection_digest_v1"
OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_selection_seed_v1"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def ensure_gitignore_block() -> bool:
    existing = GITIGNORE_PATH.read_text(encoding="utf-8") if GITIGNORE_PATH.exists() else ""
    if IGNORE_MARKER in existing:
        return False

    updated = existing
    if updated and not updated.endswith("\n"):
        updated += "\n"
    updated += IGNORE_BLOCK
    GITIGNORE_PATH.write_text(updated, encoding="utf-8")
    return True


def find_latest_promoted_json() -> Path:
    if not PROMOTED_BASE.exists():
        raise RuntimeError(f"Tier1 inspection base does not exist: {PROMOTED_BASE}")

    candidates = sorted(
        PROMOTED_BASE.glob(
            "OPENPRA_WS4_TIER1_INSPECTION_DIGEST_v1_*/openpra_ws4_tier1_promoted_candidates_v1.json"
        )
    )
    if not candidates:
        raise RuntimeError("No WS4 promoted candidates JSON found.")
    return candidates[-1]


def infer_source_role(relative_path: str, bucket: str, file_type: str) -> str:
    lowered = relative_path.lower()

    if bucket == "candidate_rows":
        return "direct_case_table"

    if "phase2b_row" in lowered or "row_" in lowered:
        return "row_key_source"

    if "topology" in lowered or "proof" in lowered:
        return "topology_support"

    if "executed" in lowered or "execution" in lowered or "recovery" in lowered:
        return "execution_support"

    if "preparation" in lowered or "statevector" in lowered or "validation" in lowered:
        return "preparation_support"

    if file_type == "csv":
        return "table_source"

    if file_type == "json":
        return "json_source"

    return "supporting_reference"


def infer_expected_content(relative_path: str, bucket: str) -> str:
    lowered = relative_path.lower()

    if bucket == "candidate_rows":
        return "likely_case_rows"

    if "topology" in lowered:
        return "topology_metadata"

    if "proof" in lowered:
        return "proof_case_support"

    if "executed" in lowered or "execution" in lowered:
        return "existing_execution_case_support"

    if "recovery" in lowered:
        return "recovery_case_support"

    if "statevector" in lowered or "preparation" in lowered:
        return "preparation_or_verification_support"

    return "needs_manual_review"


def infer_priority(inspection_score: int, adjusted_score: int) -> str:
    if inspection_score >= 24 or adjusted_score >= 60:
        return "tier1"
    if inspection_score >= 12 or adjusted_score >= 40:
        return "tier2"
    return "tier3"


def main() -> None:
    gitignore_updated = ensure_gitignore_block()

    promoted_json_path = find_latest_promoted_json()
    promoted_payload = json.loads(promoted_json_path.read_text(encoding="utf-8"))
    rows = promoted_payload.get("rows", [])

    seed_rows = []
    for idx, row in enumerate(rows, start=1):
        relative_path = row["relative_path"]
        bucket = row.get("bucket", "")
        file_type = row.get("file_type", "")
        inspection_score = int(row.get("inspection_score", 0))
        adjusted_score = int(row.get("adjusted_score", 0))

        seed_rows.append(
            {
                "seed_rank": idx,
                "relative_path": relative_path,
                "bucket": bucket,
                "file_type": file_type,
                "adjusted_score": adjusted_score,
                "inspection_score": inspection_score,
                "source_role": infer_source_role(relative_path, bucket, file_type),
                "expected_content": infer_expected_content(relative_path, bucket),
                "priority": infer_priority(inspection_score, adjusted_score),
                "selection_status": "pending_manual_review",
                "usable_for_cohort": "unknown",
                "expected_case_yield_estimate": "",
                "topology_classes_observed": "",
                "size_categories_observed": "",
                "has_existing_execution_data": "",
                "manual_notes": "",
            }
        )

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    out_dir = OUT_BASE / f"OPENPRA_WS4_SELECTION_SEED_v1_{stamp}"
    out_dir.mkdir(parents=True, exist_ok=True)

    seed_json_path = out_dir / "openpra_ws4_selection_seed_v1.json"
    seed_csv_path = out_dir / "openpra_ws4_selection_seed_v1.csv"
    summary_md_path = out_dir / "README.md"
    manifest_path = out_dir / "openpra_ws4_selection_seed_manifest_v1.json"
    manifest_sha_path = out_dir / "openpra_ws4_selection_seed_manifest_v1.json.sha256"

    seed_payload = {
        "artifact_name": "OPENPRA_WS4_SELECTION_SEED_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "repo_root": str(REPO_ROOT),
        "source_promoted_json": promoted_json_path.relative_to(REPO_ROOT).as_posix(),
        "gitignore_updated": gitignore_updated,
        "seed_count": len(seed_rows),
        "rows": seed_rows,
    }
    seed_json_path.write_text(json.dumps(seed_payload, indent=2), encoding="utf-8")

    with seed_csv_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "seed_rank",
                "relative_path",
                "bucket",
                "file_type",
                "adjusted_score",
                "inspection_score",
                "source_role",
                "expected_content",
                "priority",
                "selection_status",
                "usable_for_cohort",
                "expected_case_yield_estimate",
                "topology_classes_observed",
                "size_categories_observed",
                "has_existing_execution_data",
                "manual_notes",
            ]
        )
        for row in seed_rows:
            writer.writerow(
                [
                    row["seed_rank"],
                    row["relative_path"],
                    row["bucket"],
                    row["file_type"],
                    row["adjusted_score"],
                    row["inspection_score"],
                    row["source_role"],
                    row["expected_content"],
                    row["priority"],
                    row["selection_status"],
                    row["usable_for_cohort"],
                    row["expected_case_yield_estimate"],
                    row["topology_classes_observed"],
                    row["size_categories_observed"],
                    row["has_existing_execution_data"],
                    row["manual_notes"],
                ]
            )

    priority_counts = {}
    for row in seed_rows:
        priority = row["priority"]
        priority_counts[priority] = priority_counts.get(priority, 0) + 1

    lines = [
        "# OpenPRA WS4 Selection Seed v1",
        "",
        f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}",
        f"Source promoted candidates: {promoted_json_path.relative_to(REPO_ROOT).as_posix()}",
        f"Seed count: {len(seed_rows)}",
        f".gitignore updated: {gitignore_updated}",
        "",
        "Priority counts:",
    ]
    for priority in sorted(priority_counts):
        lines.append(f"- {priority}: {priority_counts[priority]}")
    lines.extend(
        [
            "",
            "Next use:",
            "1. review each seeded source file",
            "2. mark usable_for_cohort as yes or no",
            "3. record topology classes and size categories actually observed",
            "4. estimate case yield for each usable source",
            "5. promote usable rows into the final cohort selection manifest",
        ]
    )
    summary_md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    manifest_payload = {
        "artifact_name": "OPENPRA_WS4_SELECTION_SEED_MANIFEST_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "files": [],
    }
    for p in [seed_json_path, seed_csv_path, summary_md_path]:
        manifest_payload["files"].append(
            {
                "relative_path": p.relative_to(out_dir).as_posix(),
                "sha256": sha256_file(p),
                "size_bytes": p.stat().st_size,
            }
        )
    manifest_path.write_text(json.dumps(manifest_payload, indent=2), encoding="utf-8")
    manifest_sha_path.write_text(
        f"{sha256_file(manifest_path)}  {manifest_path.name}\n",
        encoding="utf-8",
    )

    print(str(out_dir))
    print(str(seed_json_path))
    print(str(seed_csv_path))
    print(str(summary_md_path))
    print(str(manifest_path))
    print(str(manifest_sha_path))
    print(f"seed_count={len(seed_rows)}")
    print(f"gitignore_updated={gitignore_updated}")


if __name__ == "__main__":
    main()
