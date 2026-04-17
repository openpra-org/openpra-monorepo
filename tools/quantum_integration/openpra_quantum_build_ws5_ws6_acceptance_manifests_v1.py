#!/usr/bin/env python3

from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime, timezone

SCRIPT_VERSION = "openpra-quantum-build-ws5-ws6-acceptance-manifests-v1"

REPO_ROOT = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")
OUT_ROOT = REPO_ROOT / "_work" / "openpra_quantum_ws5_ws6_acceptance_manifests_v1"
STAMP = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
RUN_DIR = OUT_ROOT / STAMP

ROLLUP_PATH = REPO_ROOT / "_work" / "openpra_quantum_simulator_validation_v1_real_with_d" / "_rollup" / "openpra_quantum_simulator_validation_rollup_v1.json"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    RUN_DIR.mkdir(parents=True, exist_ok=True)

    rollup = load_json(ROLLUP_PATH)
    case_rows = rollup["caseRows"]

    by_label = {row["caseLabel"]: row for row in case_rows}

    # Canonical WS5 overlap cases and WS6 acceptance pair
    ws5_priority_labels = [
        "phase2b_row_0698__G_G348",
        "phase2b_row_1037__G_G348",
        "phase2b_row_0905__G_G939",
    ]

    ws6_acceptance_labels = [
        "phase2b_row_0698__G_G348",
        "phase2b_row_0905__G_G939",
    ]

    ws5_cases = [by_label[label] for label in ws5_priority_labels if label in by_label]
    ws6_cases = [by_label[label] for label in ws6_acceptance_labels if label in by_label]

    ws5_manifest = {
        "artifactType": "ws5_acceptance_manifest",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "scriptVersion": SCRIPT_VERSION,
        "sourceRollupPath": str(ROLLUP_PATH),
        "goal": (
            "Bounded importance API parity and boundedness validation on canonical overlap cases."
        ),
        "boundednessStatement": (
            "These importance measures are computed from quantum-recovered MCS and validated at "
            "screening-level significance. They are not suitable for regulatory-grade risk "
            "quantification without independent verification."
        ),
        "requiredApiResponseFields": [
            "subtreeId",
            "topologyClass",
            "recoveryMode",
            "operatorAttentionRequired",
            "boundednessStatement",
            "quantumImportance",
            "classicalBaseline",
            "comparisonStatistics",
            "provenanceManifestPath",
        ],
        "acceptanceChecks": [
            "FV/RAW/Birnbaum match bounded reference outputs on overlapping validated cases",
            "comparison statistics are populated and stable",
            "boundedness statement present on every response",
            "topology and recovery provenance present on every response",
        ],
        "priorityCases": ws5_cases,
    }

    ws6_manifest = {
        "artifactType": "ws6_acceptance_manifest",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "scriptVersion": SCRIPT_VERSION,
        "sourceRollupPath": str(ROLLUP_PATH),
        "goal": (
            "Provider bridge acceptance on one exact A-path case and one harder C-path case."
        ),
        "defaultExecutionPolicy": {
            "resilienceLevel": 0,
            "statusFlow": ["submitted", "running", "completed", "failed"],
            "resultCollectionMode": "recovery-compatible raw counts",
        },
        "requiredExecutionRecordFields": [
            "subtreeId",
            "providerName",
            "backendName",
            "jobId",
            "shots",
            "resilienceLevel",
            "status",
            "provenanceManifestPath",
        ],
        "requiredResultFields": [
            "jobId",
            "status",
            "rawCountsArtifactPath",
            "recoveryArtifactPath",
            "provenanceManifestPath",
        ],
        "acceptanceChecks": [
            "job submission succeeds",
            "raw counts are collected in recovery-compatible format",
            "recovery service consumes results without manual repair",
            "prepare -> execute -> recover succeeds on at least 2 cases",
        ],
        "acceptanceCases": [
            {
                "purpose": "exact_path",
                "case": ws6_cases[0] if len(ws6_cases) >= 1 else None,
            },
            {
                "purpose": "c_path",
                "case": ws6_cases[1] if len(ws6_cases) >= 2 else None,
            },
        ],
    }

    summary = {
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "scriptVersion": SCRIPT_VERSION,
        "sourceRollupPath": str(ROLLUP_PATH),
        "boundedBaseline": {
            "totalCases": rollup["counts"]["totalCases"],
            "topologyCounts": rollup["counts"]["topologyCounts"],
            "primaryModeCounts": rollup["counts"]["primaryModeCounts"],
            "allExact": rollup["counts"]["allExact"],
            "operatorAttentionCount": rollup["counts"]["operatorAttentionCount"],
        },
        "ws5PriorityCaseLabels": [row["caseLabel"] for row in ws5_cases],
        "ws6AcceptanceCaseLabels": [
            entry["case"]["caseLabel"] if entry["case"] else None
            for entry in ws6_manifest["acceptanceCases"]
        ],
        "interpretation": (
            "WS5 should start from bounded importance parity on the canonical overlap cohort. "
            "WS6 should start from one exact A-path case and one harder C-path case."
        ),
    }

    memo = f"""OpenPRA Quantum WS5 WS6 Acceptance Manifests Memo v1

Generated at UTC: {summary['generatedAtUtc']}
Script version: {SCRIPT_VERSION}

Current bounded baseline
Total cases: {summary['boundedBaseline']['totalCases']}
Topology counts: {summary['boundedBaseline']['topologyCounts']}
Primary mode counts: {summary['boundedBaseline']['primaryModeCounts']}
All exact: {summary['boundedBaseline']['allExact']}
Operator attention count: {summary['boundedBaseline']['operatorAttentionCount']}

WS5 start point
Use the canonical overlap cohort for bounded importance parity:
{chr(10).join(f"  - {label}" for label in summary['ws5PriorityCaseLabels'])}

WS6 start point
Use the two-case acceptance pair:
{chr(10).join(f"  - {label}" for label in summary['ws6AcceptanceCaseLabels'])}

Interpretation
WS5 should now move into bounded importance parity implementation.
WS6 should now move into provider-bridge execution record and result collection implementation.

Artifacts written in this run
- ws5_acceptance_manifest_v1.json
- ws6_acceptance_manifest_v1.json
- ws5_ws6_acceptance_summary_v1.json
- OPENPRA_QUANTUM_WS5_WS6_ACCEPTANCE_MANIFESTS_MEMO_v1.txt
"""

    write_json(RUN_DIR / "ws5_acceptance_manifest_v1.json", ws5_manifest)
    write_json(RUN_DIR / "ws6_acceptance_manifest_v1.json", ws6_manifest)
    write_json(RUN_DIR / "ws5_ws6_acceptance_summary_v1.json", summary)
    (RUN_DIR / "OPENPRA_QUANTUM_WS5_WS6_ACCEPTANCE_MANIFESTS_MEMO_v1.txt").write_text(
        memo, encoding="utf-8"
    )

    print(RUN_DIR)
    print(RUN_DIR / "OPENPRA_QUANTUM_WS5_WS6_ACCEPTANCE_MANIFESTS_MEMO_v1.txt")
    print(RUN_DIR / "ws5_ws6_acceptance_summary_v1.json")


if __name__ == "__main__":
    main()
