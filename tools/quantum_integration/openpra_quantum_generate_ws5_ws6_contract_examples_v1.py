#!/usr/bin/env python3

from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime, timezone

SCRIPT_VERSION = "openpra-quantum-generate-ws5-ws6-contract-examples-v1"

REPO_ROOT = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")
MANIFEST_ROOT = REPO_ROOT / "_work" / "openpra_quantum_ws5_ws6_acceptance_manifests_v1"
OUT_ROOT = REPO_ROOT / "_work" / "openpra_quantum_ws5_ws6_contract_examples_v1"


def latest_manifest_dir() -> Path:
    candidates = sorted(MANIFEST_ROOT.iterdir(), reverse=True)
    if not candidates:
        raise FileNotFoundError("No WS5/WS6 acceptance manifest runs found.")
    return candidates[0]


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def build_ws5_example(case: dict, boundedness_statement: str) -> dict:
    subtree_id = case["subtreeId"]
    topology = case["topologyClass"]
    return {
        "subtreeId": subtree_id,
        "topologyClass": topology,
        "recoveryMode": case["primaryMode"],
        "operatorAttentionRequired": case["requiresOperatorAttention"],
        "boundednessStatement": boundedness_statement,
        "quantumImportance": [],
        "classicalBaseline": [],
        "comparisonStatistics": {
            "sharedBasicEventCount": 0,
            "fvCorrelation": None,
            "rawCorrelation": None,
            "birnbaumCorrelation": None,
            "fvMaxAbsoluteDeviation": None,
            "rawMaxAbsoluteDeviation": None,
            "birnbaumMaxAbsoluteDeviation": None,
            "disagreementCount": None,
        },
        "provenanceManifestPath": f"/provenance/ws5/{case['caseLabel']}.json",
        "sourceRecoveryArtifactPath": f"/recovery/{case['caseLabel']}.json",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "caseLabel": case["caseLabel"],
    }


def build_ws6_execution_record(case: dict, provider_name: str, backend_name: str) -> dict:
    return {
        "subtreeId": case["subtreeId"],
        "providerName": provider_name,
        "backendName": backend_name,
        "jobId": f"example::{case['caseLabel']}",
        "shots": 8192,
        "resilienceLevel": 0,
        "status": "submitted",
        "provenanceManifestPath": f"/provenance/ws6/{case['caseLabel']}.json",
        "submittedAtUtc": datetime.now(timezone.utc).isoformat(),
        "caseLabel": case["caseLabel"],
    }


def build_ws6_execution_result(case: dict) -> dict:
    return {
        "jobId": f"example::{case['caseLabel']}",
        "status": "completed",
        "rawCountsArtifactPath": f"/raw-counts/{case['caseLabel']}.json",
        "recoveryArtifactPath": f"/recovery/{case['caseLabel']}.json",
        "provenanceManifestPath": f"/provenance/ws6/{case['caseLabel']}.json",
        "completedAtUtc": datetime.now(timezone.utc).isoformat(),
        "failureReason": None,
    }


def main() -> None:
    manifest_dir = latest_manifest_dir()
    out_dir = OUT_ROOT / datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")
    out_dir.mkdir(parents=True, exist_ok=True)

    ws5_manifest = load_json(manifest_dir / "ws5_acceptance_manifest_v1.json")
    ws6_manifest = load_json(manifest_dir / "ws6_acceptance_manifest_v1.json")

    ws5_examples = []
    for case in ws5_manifest["priorityCases"]:
        ws5_examples.append(
            build_ws5_example(case, ws5_manifest["boundednessStatement"])
        )

    ws6_examples = []
    acceptance_cases = ws6_manifest["acceptanceCases"]
    provider_defaults = [
        ("ibm_runtime", "ibm_torino"),
        ("ibm_runtime", "ibm_marrakesh"),
    ]

    for idx, entry in enumerate(acceptance_cases):
        case = entry["case"]
        if case is None:
            continue
        provider_name, backend_name = provider_defaults[min(idx, len(provider_defaults) - 1)]
        ws6_examples.append(
            {
                "purpose": entry["purpose"],
                "executionRecord": build_ws6_execution_record(case, provider_name, backend_name),
                "executionResult": build_ws6_execution_result(case),
            }
        )

    write_json(out_dir / "ws5_importance_response_examples_v1.json", {"examples": ws5_examples})
    write_json(out_dir / "ws6_execution_examples_v1.json", {"examples": ws6_examples})

    summary = {
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "scriptVersion": SCRIPT_VERSION,
        "manifestDir": str(manifest_dir),
        "ws5ExampleCount": len(ws5_examples),
        "ws6ExampleCount": len(ws6_examples),
    }
    write_json(out_dir / "ws5_ws6_contract_examples_summary_v1.json", summary)

    memo = f"""OpenPRA Quantum WS5 WS6 Contract Examples Memo v1

Generated at UTC: {summary['generatedAtUtc']}
Script version: {SCRIPT_VERSION}

Source manifest directory
{summary['manifestDir']}

WS5 example count: {summary['ws5ExampleCount']}
WS6 example count: {summary['ws6ExampleCount']}

Artifacts written
- ws5_importance_response_examples_v1.json
- ws6_execution_examples_v1.json
- ws5_ws6_contract_examples_summary_v1.json
"""
    (out_dir / "OPENPRA_QUANTUM_WS5_WS6_CONTRACT_EXAMPLES_MEMO_v1.txt").write_text(
        memo,
        encoding="utf-8",
    )

    print(out_dir)
    print(out_dir / "OPENPRA_QUANTUM_WS5_WS6_CONTRACT_EXAMPLES_MEMO_v1.txt")
    print(out_dir / "ws5_ws6_contract_examples_summary_v1.json")


if __name__ == "__main__":
    main()
