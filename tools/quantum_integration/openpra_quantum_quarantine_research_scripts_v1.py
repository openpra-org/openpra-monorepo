#!/usr/bin/env python3
from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path.cwd()

RESEARCH_ROOT = REPO_ROOT / "tools" / "quantum-research-scripts"
PHASE5_ROOT = RESEARCH_ROOT / "phase5_untracked_quarantine_v1"
MISC_ROOT = RESEARCH_ROOT / "misc_untracked_quarantine_v1"

MOVE_MAP = {
    "20260415_004659Z": MISC_ROOT / "20260415_004659Z",
    "scripts/build_openpra_phase5_step1_composite_bundle_v1.sh": PHASE5_ROOT / "build_openpra_phase5_step1_composite_bundle_v1.sh",
    "scripts/build_openpra_phase5_true_new_synthetic_package_and_batch_v1.sh": PHASE5_ROOT / "build_openpra_phase5_true_new_synthetic_package_and_batch_v1.sh",
    "scripts/checkpoint_openpra_phase5_two_case_ready_state_v1.sh": PHASE5_ROOT / "checkpoint_openpra_phase5_two_case_ready_state_v1.sh",
    "scripts/extract_openpra_phase5_missing_event_values_from_xml_v1.sh": PHASE5_ROOT / "extract_openpra_phase5_missing_event_values_from_xml_v1.sh",
    "scripts/extract_openpra_phase5_true_new_target_candidates_v1.sh": PHASE5_ROOT / "extract_openpra_phase5_true_new_target_candidates_v1.sh",
    "scripts/find_openpra_phase5_missing_probabilities_v1.sh": PHASE5_ROOT / "find_openpra_phase5_missing_probabilities_v1.sh",
    "scripts/find_openpra_phase5_true_new_full_sources_v1.sh": PHASE5_ROOT / "find_openpra_phase5_true_new_full_sources_v1.sh",
    "scripts/freeze_openpra_phase5_two_case_local_execution_v1.sh": PHASE5_ROOT / "freeze_openpra_phase5_two_case_local_execution_v1.sh",
    "scripts/harvest_openpra_phase5_g303_probabilities_from_existing_batches_v1.sh": PHASE5_ROOT / "harvest_openpra_phase5_g303_probabilities_from_existing_batches_v1.sh",
    "scripts/inspect_openpra_phase5_true_new_slice_shapes_v1.sh": PHASE5_ROOT / "inspect_openpra_phase5_true_new_slice_shapes_v1.sh",
    "scripts/inventory_openpra_phase5_runtime_bundle_dirs_v1.sh": PHASE5_ROOT / "inventory_openpra_phase5_runtime_bundle_dirs_v1.sh",
    "scripts/materialize_openpra_phase5_true_new_exports_and_package_v1.sh": PHASE5_ROOT / "materialize_openpra_phase5_true_new_exports_and_package_v1.sh",
    "scripts/materialize_openpra_phase5_true_new_exports_by_full_model_v1.sh": PHASE5_ROOT / "materialize_openpra_phase5_true_new_exports_by_full_model_v1.sh",
    "scripts/patch_openpra_phase5_missing_probabilities_from_xml_probe_v1.sh": PHASE5_ROOT / "patch_openpra_phase5_missing_probabilities_from_xml_probe_v1.sh",
    "scripts/populate_openpra_phase5_counts_from_staged_qpy_v1.sh": PHASE5_ROOT / "populate_openpra_phase5_counts_from_staged_qpy_v1.sh",
    "scripts/probe_openpra_phase5_runtime_bundle_sources_v1.sh": PHASE5_ROOT / "probe_openpra_phase5_runtime_bundle_sources_v1.sh",
    "scripts/probe_openpra_phase5_upstream_probability_sources_v1.sh": PHASE5_ROOT / "probe_openpra_phase5_upstream_probability_sources_v1.sh",
    "scripts/recover_openpra_phase5_true_new_packaging_v1.sh": PHASE5_ROOT / "recover_openpra_phase5_true_new_packaging_v1.sh",
    "scripts/resume_openpra_phase5_true_new_probability_and_rawcounts_v1.sh": PHASE5_ROOT / "resume_openpra_phase5_true_new_probability_and_rawcounts_v1.sh",
    "scripts/search_openpra_phase5_missing_probabilities_text_only_v1.sh": PHASE5_ROOT / "search_openpra_phase5_missing_probabilities_text_only_v1.sh",
    "scripts/search_openpra_phase5_missing_probabilities_with_grep_v1.sh": PHASE5_ROOT / "search_openpra_phase5_missing_probabilities_with_grep_v1.sh",
    "scripts/stage_openpra_phase5_exact_runtime_assets_v1.sh": PHASE5_ROOT / "stage_openpra_phase5_exact_runtime_assets_v1.sh",
    "tools/quantum_integration/openpra_quantum_build_step2_windows_transfer_bundle_v1.sh": MISC_ROOT / "openpra_quantum_build_step2_windows_transfer_bundle_v1.sh",
    "tools/quantum_integration/openpra_quantum_build_total_mirror_bundle_v1.sh": MISC_ROOT / "openpra_quantum_build_total_mirror_bundle_v1.sh",
    "tools/quantum_integration/openpra_quantum_create_handoff_bundle_v1.sh": MISC_ROOT / "openpra_quantum_create_handoff_bundle_v1.sh",
    "tools/quantum_integration/openpra_quantum_importance_comparison_write_pass1_v1.sh": MISC_ROOT / "openpra_quantum_importance_comparison_write_pass1_v1.sh",
    "tools/quantum_integration/openpra_quantum_workflow_handoff_audit_pass9_v1.sh": MISC_ROOT / "openpra_quantum_workflow_handoff_audit_pass9_v1.sh",
    "tools/quantum_integration/openpra_quantum_workflow_release_bundle_pass7_v1.sh": MISC_ROOT / "openpra_quantum_workflow_release_bundle_pass7_v1.sh",
    "tools/quantum_integration/openpra_quantum_workflow_release_manifest_pass6_v1.sh": MISC_ROOT / "openpra_quantum_workflow_release_manifest_pass6_v1.sh",
}

README_TEXT = """# Quantum Research Scripts Quarantine

This directory contains research-oriented scripts and ad hoc helper assets that are not part of the production package tree.

## Why this directory exists

The OpenPRA Quantum Integration Plan v2 requires standalone research scripts to be isolated from production package code so the repository can remain auditable and easier to review.

These files are retained for provenance, reconstruction support, and research traceability. They should not be treated as production API or package code without separate review and promotion.

## Current quarantine groups

- `phase5_untracked_quarantine_v1`
  - Phase 5 recovery and packaging helper scripts that were previously loose under the top-level `scripts/` directory

- `misc_untracked_quarantine_v1`
  - Ancillary handoff, bundle, mirror, transfer, and audit helpers that were previously loose under `tools/quantum_integration/`
  - Includes the stray timestamped `20260415_004659Z` directory when present

## Promotion rule

A quarantined research script may be promoted later only if:
1. its purpose is documented,
2. it has tests or acceptance checks appropriate to its role,
3. it is versioned intentionally, and
4. it is explicitly moved into a supported package or maintained tools area by a later commit.
"""

def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

def move_path(src: Path, dst: Path) -> dict:
    if not src.exists():
        return {
            "source": src.relative_to(REPO_ROOT).as_posix(),
            "destination": dst.relative_to(REPO_ROOT).as_posix(),
            "status": "missing",
        }

    ensure_parent(dst)
    shutil.move(str(src), str(dst))
    return {
        "source": src.relative_to(REPO_ROOT).as_posix(),
        "destination": dst.relative_to(REPO_ROOT).as_posix(),
        "status": "moved",
    }

def main() -> None:
    RESEARCH_ROOT.mkdir(parents=True, exist_ok=True)
    PHASE5_ROOT.mkdir(parents=True, exist_ok=True)
    MISC_ROOT.mkdir(parents=True, exist_ok=True)

    readme_path = RESEARCH_ROOT / "README.md"
    readme_path.write_text(README_TEXT, encoding="utf-8")

    results = []
    for src_rel, dst_path in MOVE_MAP.items():
        src_path = REPO_ROOT / src_rel
        results.append(move_path(src_path, dst_path))

    report = {
        "artifact_name": "openpra_quantum_quarantine_research_scripts_v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "repo_root": str(REPO_ROOT),
        "moves": results,
    }

    report_path = RESEARCH_ROOT / "openpra_quantum_quarantine_research_scripts_v1_report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    moved_count = sum(1 for item in results if item["status"] == "moved")
    missing_count = sum(1 for item in results if item["status"] == "missing")

    print(str(readme_path))
    print(str(report_path))
    print(f"moved_count={moved_count}")
    print(f"missing_count={missing_count}")

if __name__ == "__main__":
    main()
