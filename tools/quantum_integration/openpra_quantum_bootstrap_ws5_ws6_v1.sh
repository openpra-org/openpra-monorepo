#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
OUT_ROOT="$REPO_ROOT/_work/openpra_quantum_ws5_ws6_bootstrap_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
RUN_DIR="$OUT_ROOT/$STAMP"

ROLLUP_JSON="$REPO_ROOT/_work/openpra_quantum_simulator_validation_v1_real_with_d/_rollup/openpra_quantum_simulator_validation_rollup_v1.json"

mkdir -p "$RUN_DIR"

python3 - <<'PY' "$REPO_ROOT" "$RUN_DIR" "$ROLLUP_JSON"
import json
import os
import sys
from pathlib import Path
from datetime import datetime, timezone

repo_root = Path(sys.argv[1])
run_dir = Path(sys.argv[2])
rollup_path = Path(sys.argv[3])

def find_matches(root: Path, patterns: list[str]) -> list[str]:
    hits = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        p = str(path).lower()
        if any(token in p for token in patterns):
            hits.append(str(path))
    return sorted(hits)

rollup = {}
if rollup_path.exists():
    rollup = json.loads(rollup_path.read_text(encoding="utf-8"))

counts = rollup.get("counts", {})
case_rows = rollup.get("caseRows", [])

real_a = [r for r in case_rows if r.get("caseLabel", "").startswith("phase2b_row_") and r.get("topologyClass") == "A"]
real_c = [r for r in case_rows if r.get("caseLabel", "").startswith("phase2b_row_") and r.get("topologyClass") == "C"]
real_d = [r for r in case_rows if r.get("caseLabel", "").startswith("phase2b_row_") and r.get("topologyClass") == "D"]
synthetic_b = [r for r in case_rows if r.get("caseLabel", "").startswith("synthetic_topology_") and r.get("topologyClass") == "B"]

importance_hits = find_matches(
    repo_root,
    ["importance", "birnbaum", "fussell", "fv", "raw"]
)

execution_hits = find_matches(
    repo_root,
    ["ibm", "runtime", "qiskit", "provider", "execution", "submit", "job"]
)

ws5_contract = {
    "artifactType": "ws5_api_contract",
    "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
    "boundednessStatement": (
        "These importance measures are computed from quantum-recovered MCS and "
        "validated at screening-level significance. They are not suitable for "
        "regulatory-grade risk quantification without independent verification."
    ),
    "endpoints": [
        {
            "method": "POST",
            "path": "/api/quantum/importance/:subtreeId",
            "requiredResponseFields": [
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
        }
    ],
    "acceptanceChecks": [
        "FV/RAW/Birnbaum match Paper 11 overlapping validated values",
        "comparison statistics match bounded reference outputs",
        "boundedness statement included on every response",
        "topology and recovery provenance included on every response",
    ],
}

ws6_contract = {
    "artifactType": "ws6_provider_contract",
    "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
    "defaultExecutionPolicy": {
        "resilienceLevel": 0,
        "statusFlow": ["submitted", "running", "completed", "failed"],
    },
    "endpoints": [
        {
            "method": "POST",
            "path": "/api/quantum/execute/:subtreeId",
            "requiredResponseFields": [
                "subtreeId",
                "providerName",
                "backendName",
                "jobId",
                "shots",
                "resilienceLevel",
                "status",
                "provenanceManifestPath",
            ],
        },
        {
            "method": "GET",
            "path": "/api/quantum/execute/result/:jobId",
            "requiredResponseFields": [
                "jobId",
                "status",
                "rawCountsArtifactPath",
                "recoveryArtifactPath",
                "provenanceManifestPath",
            ],
        },
    ],
    "acceptanceChecks": [
        "job submission succeeds",
        "result collection writes recovery-compatible raw counts",
        "recovery service consumes results",
        "end-to-end prepare -> execute -> recover on at least 2 cases",
    ],
    "recommendedAcceptanceCases": [
        {
            "purpose": "exact_recovery_path",
            "preferredCaseLabel": real_a[0]["caseLabel"] if real_a else None,
        },
        {
            "purpose": "nontrivial_c_path",
            "preferredCaseLabel": real_c[0]["caseLabel"] if real_c else None,
        },
    ],
}

summary = {
    "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
    "currentBoundedBaseline": {
        "totalCases": counts.get("totalCases"),
        "topologyCounts": counts.get("topologyCounts"),
        "primaryModeCounts": counts.get("primaryModeCounts"),
        "allExact": counts.get("allExact"),
        "operatorAttentionCount": counts.get("operatorAttentionCount"),
    },
    "currentSourceConclusion": {
        "realATotal": len(real_a),
        "realCTotal": len(real_c),
        "realDTotal": len(real_d),
        "syntheticBTotal": len(synthetic_b),
        "interpretation": "Current accessible source universe supports real A/C/D and synthetic B.",
    },
    "importanceAssetHitCount": len(importance_hits),
    "executionAssetHitCount": len(execution_hits),
    "recommendedWs5Start": "bounded importance API and parity harness",
    "recommendedWs6Start": "provider contract plus async execution bridge",
}

memo = f"""OpenPRA Quantum WS5 WS6 Bootstrap Memo v1

Generated at UTC: {summary['generatedAtUtc']}

Current bounded baseline
Total cases: {summary['currentBoundedBaseline']['totalCases']}
Topology counts: {summary['currentBoundedBaseline']['topologyCounts']}
Primary mode counts: {summary['currentBoundedBaseline']['primaryModeCounts']}
All exact: {summary['currentBoundedBaseline']['allExact']}
Operator attention count: {summary['currentBoundedBaseline']['operatorAttentionCount']}

Current source-lane conclusion
Real A total: {summary['currentSourceConclusion']['realATotal']}
Real C total: {summary['currentSourceConclusion']['realCTotal']}
Real D total: {summary['currentSourceConclusion']['realDTotal']}
Synthetic B total: {summary['currentSourceConclusion']['syntheticBTotal']}
Interpretation: {summary['currentSourceConclusion']['interpretation']}

WS5 start point
Build the bounded importance API around validated quantum-recovered MCS inputs and classical comparison outputs.
Keep the screening-level boundedness statement mandatory.

WS6 start point
Build the provider contract and async execution bridge in parallel.
Preferred two-case acceptance pair:
  exact path: {ws6_contract['recommendedAcceptanceCases'][0]['preferredCaseLabel']}
  C-path: {ws6_contract['recommendedAcceptanceCases'][1]['preferredCaseLabel']}

Inventory
Importance-related repo hits: {len(importance_hits)}
Execution/provider-related repo hits: {len(execution_hits)}

Artifacts written in this run
- ws5_api_contract_v1.json
- ws6_provider_contract_v1.json
- ws5_ws6_bootstrap_summary_v1.json
- OPENPRA_QUANTUM_WS5_WS6_BOOTSTRAP_MEMO_v1.txt
"""

(run_dir / "ws5_api_contract_v1.json").write_text(json.dumps(ws5_contract, indent=2) + "\n", encoding="utf-8")
(run_dir / "ws6_provider_contract_v1.json").write_text(json.dumps(ws6_contract, indent=2) + "\n", encoding="utf-8")
(run_dir / "ws5_ws6_bootstrap_summary_v1.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
(run_dir / "OPENPRA_QUANTUM_WS5_WS6_BOOTSTRAP_MEMO_v1.txt").write_text(memo, encoding="utf-8")

(run_dir / "importance_asset_hits_v1.txt").write_text("\n".join(importance_hits) + ("\n" if importance_hits else ""), encoding="utf-8")
(run_dir / "execution_asset_hits_v1.txt").write_text("\n".join(execution_hits) + ("\n" if execution_hits else ""), encoding="utf-8")

print(run_dir)
print(run_dir / "OPENPRA_QUANTUM_WS5_WS6_BOOTSTRAP_MEMO_v1.txt")
print(run_dir / "ws5_ws6_bootstrap_summary_v1.json")
PY
