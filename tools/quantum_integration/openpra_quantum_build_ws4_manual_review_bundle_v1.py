#!/usr/bin/env python3
from __future__ import annotations

import csv
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()
GITIGNORE_PATH = REPO_ROOT / ".gitignore"

IGNORE_MARKER = "/_work/openpra_quantum_ws4_manual_review_bundle_v1/"
IGNORE_BLOCK = """
/_work/openpra_quantum_ws4_manual_review_bundle_v1/
"""

OUT_BASE = REPO_ROOT / "_work" / "openpra_quantum_ws4_manual_review_bundle_v1"

PATH_PATTERNS = {
    "scaffold_dir": "_work/openpra_quantum_ws4_broader_cohort_validation_v1/OPENPRA_WS4_BROADER_COHORT_VALIDATION_v1_*",
    "inventory_dir": "_work/openpra_quantum_ws4_candidate_source_inventory_v1/OPENPRA_WS4_CANDIDATE_SOURCE_INVENTORY_v1_*",
    "shortlist_dir": "_work/openpra_quantum_ws4_source_shortlist_v1/OPENPRA_WS4_SOURCE_SHORTLIST_v1_*",
    "tier1_slate_dir": "_work/openpra_quantum_ws4_tier1_review_slate_v1/OPENPRA_WS4_TIER1_REVIEW_SLATE_v1_*",
    "source_pack_dir": "_work/openpra_quantum_ws4_tier1_source_pack_v1/OPENPRA_WS4_TIER1_SOURCE_PACK_v1_*",
    "inspection_digest_dir": "_work/openpra_quantum_ws4_tier1_inspection_digest_v1/OPENPRA_WS4_TIER1_INSPECTION_DIGEST_v1_*",
    "selection_seed_dir": "_work/openpra_quantum_ws4_selection_seed_v1/OPENPRA_WS4_SELECTION_SEED_v1_*",
}


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


def latest_matching_dir(pattern: str) -> Path:
    matches = sorted(REPO_ROOT.glob(pattern))
    if not matches:
        raise RuntimeError(f"No directory found for pattern: {pattern}")
    return matches[-1]


def copy_if_exists(src: Path, dst: Path) -> bool:
    if not src.exists():
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    return True


def main() -> None:
    gitignore_updated = ensure_gitignore_block()

    latest_dirs = {
        key: latest_matching_dir(pattern)
        for key, pattern in PATH_PATTERNS.items()
    }

    source_pack_dir = latest_dirs["source_pack_dir"]
    selection_seed_dir = latest_dirs["selection_seed_dir"]
    inspection_digest_dir = latest_dirs["inspection_digest_dir"]

    seed_json_path = selection_seed_dir / "openpra_ws4_selection_seed_v1.json"
    promoted_json_path = inspection_digest_dir / "openpra_ws4_tier1_promoted_candidates_v1.json"
    source_pack_json_path = source_pack_dir / "openpra_ws4_tier1_source_pack_v1.json"

    if not seed_json_path.exists():
        raise RuntimeError(f"Missing selection seed JSON: {seed_json_path}")
    if not promoted_json_path.exists():
        raise RuntimeError(f"Missing promoted candidates JSON: {promoted_json_path}")
    if not source_pack_json_path.exists():
        raise RuntimeError(f"Missing source pack JSON: {source_pack_json_path}")

    seed_payload = json.loads(seed_json_path.read_text(encoding="utf-8"))
    seed_rows = seed_payload.get("rows", [])

    promoted_payload = json.loads(promoted_json_path.read_text(encoding="utf-8"))
    promoted_rows = promoted_payload.get("rows", [])

    source_pack_payload = json.loads(source_pack_json_path.read_text(encoding="utf-8"))
    packed_entries = source_pack_payload.get("copied_entries", [])

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    out_dir = OUT_BASE / f"OPENPRA_WS4_MANUAL_REVIEW_BUNDLE_v1_{stamp}"
    inputs_dir = out_dir / "INPUTS"
    review_dir = out_dir / "REVIEW"
    packed_sources_dir = out_dir / "PACKED_SOURCES"
    manifests_dir = out_dir / "MANIFESTS"

    for d in [inputs_dir, review_dir, packed_sources_dir, manifests_dir]:
        d.mkdir(parents=True, exist_ok=True)

    # Copy key chain outputs into a single review bundle
    chain_files = [
        latest_dirs["scaffold_dir"] / "CONTROL" / "openpra_ws4_broader_cohort_validation_control_v1.json",
        latest_dirs["scaffold_dir"] / "INPUTS" / "openpra_ws4_broader_cohort_selection_template_v1.csv",
        latest_dirs["inventory_dir"] / "openpra_ws4_candidate_source_inventory_top50_v1.csv",
        latest_dirs["shortlist_dir"] / "openpra_ws4_source_shortlist_v1.csv",
        latest_dirs["tier1_slate_dir"] / "openpra_ws4_tier1_review_slate_v1.csv",
        source_pack_json_path,
        inspection_digest_dir / "openpra_ws4_tier1_inspection_digest_v1.csv",
        promoted_json_path,
        selection_seed_dir / "openpra_ws4_selection_seed_v1.csv",
        seed_json_path,
    ]

    copied_input_files = []
    for src in chain_files:
        if not src.exists():
            continue
        dst = inputs_dir / src.name
        copy_if_exists(src, dst)
        copied_input_files.append(dst)

    # Copy packed sources into one place
    source_pack_root = source_pack_dir / "PACKED_SOURCES"
    packed_source_files = []
    if source_pack_root.exists():
        for src in sorted(source_pack_root.rglob("*")):
            if not src.is_file():
                continue
            rel = src.relative_to(source_pack_root)
            dst = packed_sources_dir / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            packed_source_files.append(dst)

    # Build source acceptance review CSV
    source_review_csv = review_dir / "openpra_ws4_source_acceptance_review_v1.csv"
    with source_review_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "seed_rank",
                "relative_path",
                "bucket",
                "source_role",
                "expected_content",
                "priority",
                "adjusted_score",
                "inspection_score",
                "selection_status",
                "usable_for_cohort",
                "expected_case_yield_estimate",
                "topology_classes_observed",
                "size_categories_observed",
                "has_existing_execution_data",
                "promote_to_cohort_manifest",
                "manual_notes",
            ]
        )
        for row in seed_rows:
            writer.writerow(
                [
                    row.get("seed_rank", ""),
                    row.get("relative_path", ""),
                    row.get("bucket", ""),
                    row.get("source_role", ""),
                    row.get("expected_content", ""),
                    row.get("priority", ""),
                    row.get("adjusted_score", ""),
                    row.get("inspection_score", ""),
                    "pending_manual_review",
                    "unknown",
                    "",
                    "",
                    "",
                    "",
                    "no",
                    "",
                ]
            )

    # Build cohort selection manifest template CSV
    cohort_manifest_csv = review_dir / "openpra_ws4_cohort_selection_manifest_v1.csv"
    with cohort_manifest_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "selection_rank",
                "case_id",
                "phase2b_row_id",
                "subtree_id",
                "root_gate_id",
                "topology_class",
                "n_basic",
                "source_relative_path",
                "has_existing_execution_data",
                "selection_bucket",
                "selection_rationale",
                "preparation_status",
                "statevector_status",
                "recovery_mode",
                "recovery_status",
                "notes",
            ]
        )

    # Build promoted source index CSV
    promoted_index_csv = review_dir / "openpra_ws4_promoted_source_index_v1.csv"
    with promoted_index_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "rank",
                "relative_path",
                "bucket",
                "file_type",
                "adjusted_score",
                "inspection_score",
                "recommendation",
                "signal_hits",
            ]
        )
        for row in promoted_rows:
            writer.writerow(
                [
                    row.get("rank", ""),
                    row.get("relative_path", ""),
                    row.get("bucket", ""),
                    row.get("file_type", ""),
                    row.get("adjusted_score", ""),
                    row.get("inspection_score", ""),
                    row.get("recommendation", ""),
                    ";".join(row.get("signal_hits", [])),
                ]
            )

    # README
    readme_path = out_dir / "README.md"
    readme_lines = [
        "# OpenPRA WS4 Manual Review Bundle v1",
        "",
        f"Generated at UTC: {datetime.now(timezone.utc).isoformat()}",
        f".gitignore updated: {gitignore_updated}",
        f"Seed source count: {len(seed_rows)}",
        f"Promoted source count: {len(promoted_rows)}",
        f"Packed source file count: {len(packed_source_files)}",
        "",
        "Contents:",
        "- INPUTS: copied outputs from the consolidated WS4 chain",
        "- PACKED_SOURCES: top source files copied into one place for review",
        "- REVIEW/openpra_ws4_source_acceptance_review_v1.csv",
        "- REVIEW/openpra_ws4_cohort_selection_manifest_v1.csv",
        "- REVIEW/openpra_ws4_promoted_source_index_v1.csv",
        "",
        "Recommended workflow:",
        "1. Open REVIEW/openpra_ws4_source_acceptance_review_v1.csv",
        "2. For each source, mark usable_for_cohort as yes or no",
        "3. Record topology classes, size categories, and expected case yield",
        "4. For usable sources, extract real case rows into REVIEW/openpra_ws4_cohort_selection_manifest_v1.csv",
        "5. Aim for a final cohort of 30 to 50 cases, stratified across topology classes and n = 5, 6, 8 when available",
        "",
        "Latest chain sources used:",
    ]
    for key in sorted(latest_dirs):
        readme_lines.append(f"- {key}: {latest_dirs[key].relative_to(REPO_ROOT).as_posix()}")
    readme_path.write_text("\n".join(readme_lines) + "\n", encoding="utf-8")

    # Manifest
    manifest_path = manifests_dir / "openpra_ws4_manual_review_bundle_manifest_v1.json"
    manifest_payload = {
        "artifact_name": "OPENPRA_WS4_MANUAL_REVIEW_BUNDLE_MANIFEST_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "files": [],
    }

    manifest_files = [
        readme_path,
        source_review_csv,
        cohort_manifest_csv,
        promoted_index_csv,
    ]
    manifest_files.extend(copied_input_files)
    manifest_files.extend(packed_source_files)

    for p in manifest_files:
        manifest_payload["files"].append(
            {
                "relative_path": p.relative_to(out_dir).as_posix(),
                "sha256": sha256_file(p),
                "size_bytes": p.stat().st_size,
            }
        )

    manifest_path.write_text(json.dumps(manifest_payload, indent=2), encoding="utf-8")

    manifest_sha_path = manifests_dir / "openpra_ws4_manual_review_bundle_manifest_v1.json.sha256"
    manifest_sha_path.write_text(
        f"{sha256_file(manifest_path)}  {manifest_path.name}\n",
        encoding="utf-8",
    )

    print(str(out_dir))
    print(str(source_review_csv))
    print(str(cohort_manifest_csv))
    print(str(promoted_index_csv))
    print(str(manifest_path))
    print(str(manifest_sha_path))
    print(f"seed_count={len(seed_rows)}")
    print(f"promoted_count={len(promoted_rows)}")
    print(f"packed_source_file_count={len(packed_source_files)}")
    print(f"gitignore_updated={gitignore_updated}")


if __name__ == "__main__":
    main()
