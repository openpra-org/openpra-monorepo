#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


SCRIPT_VERSION = "openpra-phase5-build-integration-policy-v1"
DEFAULT_OUTPUT_ROOT = "_work/openpra_phase5_integration_policy_v1"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%SZ")


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def write_manifest(root: Path) -> Dict[str, str]:
    manifest: Dict[str, str] = {}
    for path in sorted(root.rglob("*")):
        if path.is_file():
            manifest[str(path.relative_to(root))] = sha256_file(path)

    sha_path = root / "SHA256SUMS.txt"
    with sha_path.open("w", encoding="utf-8") as f:
        for rel, digest in sorted(manifest.items()):
            f.write(f"{digest}  {rel}\n")

    manifest["SHA256SUMS.txt"] = sha256_file(sha_path)
    return manifest


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Build the canonical OpenPRA integration policy from Phase 5 recovery-ladder artifacts."
    )
    ap.add_argument("--output-root", default=DEFAULT_OUTPUT_ROOT)
    args = ap.parse_args()

    repo_root = Path.cwd().resolve()
    output_root = (repo_root / args.output_root).resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    case_paths = {
        "1037": repo_root / "_work/openpra_phase5_real_candidate_batch_v1/20260410_155058Z/0001_phase2b_row_1037/openpra_recovery_ladder_result_v1.json",
        "0698": repo_root / "_work/openpra_phase5_real_candidate_batch_v1/20260410_155058Z/0002_phase2b_row_0698/openpra_recovery_ladder_result_v1.json",
        "0905": repo_root / "_work/openpra_phase5_real_candidate_batch_v1/20260410_155058Z/0020_phase2b_row_0905/openpra_recovery_ladder_result_v1.json",
    }

    cases: Dict[str, Any] = {}
    for label, path in case_paths.items():
        if not path.exists():
            raise SystemExit(f"Missing recovery ladder artifact: {path}")
        cases[label] = load_json(path)

    observed_primary_modes = sorted(
        {cases[label]["integration_recommendation"]["primary_mode"] for label in cases}
    )

    policy = {
        "generated_at": utc_now_iso(),
        "script_version": SCRIPT_VERSION,
        "policy_name": "OpenPRA quantum recovery integration policy",
        "scope": "Post-quantum harvested count interpretation and recovery escalation",
        "inputs_required": [
            "raw_counts.json",
            "classical_reference_mcs.json",
            "ordered_basic_event_ids",
            "declared bitstring convention",
        ],
        "recovery_ladder": [
            {
                "tier": 1,
                "mode": "exact_hardware_recovery",
                "trigger": "Always run first",
                "rule": "Use declared-order exact recovery from harvested counts",
                "status_label": "primary",
            },
            {
                "tier": 2,
                "mode": "alternate_orientation_audit",
                "trigger": "Tier 1 exact recovery is incomplete",
                "rule": "Re-evaluate using reversed orientation and compare recovered exact cut sets",
                "status_label": "sensitivity",
            },
            {
                "tier": 3,
                "mode": "union_sensitivity_recovery",
                "trigger": "Tier 1 incomplete and tier 2 recovers complementary exact cut sets",
                "rule": "Return union across declared and reversed orientations, but label as sensitivity recovery rather than unambiguous exact recovery",
                "status_label": "sensitivity",
            },
            {
                "tier": 4,
                "mode": "near_miss_advisory",
                "trigger": "Missing cut sets remain or ambiguity remains material",
                "rule": "Report nearest one-bit subset, superset, and overlap states around missing reference cut sets",
                "status_label": "advisory",
            },
            {
                "tier": 5,
                "mode": "targeted_rerun",
                "trigger": "Operator attention remains required after tiers 1 through 4",
                "rule": "Rerun the same case with targeted settings rather than broad unrelated submissions",
                "status_label": "action",
            },
        ],
        "operator_attention_rule": {
            "requires_operator_attention_when": [
                "primary_mode is not exact_hardware_recovery",
                "union_sensitivity_recovery is used",
                "near_miss_advisory contains unresolved missing reference cut sets",
            ]
        },
        "output_contract": {
            "required_fields": [
                "model_id",
                "candidate_root_node_id",
                "primary_mode",
                "requires_operator_attention",
                "recommended_basicEventIdSets",
                "recommended_support_rows",
            ],
            "optional_fields": [
                "supplemental_union_only_basicEventIdSets",
                "near_miss_analysis",
            ],
        },
        "observed_case_evidence": {
            "case_count": len(cases),
            "observed_primary_modes": observed_primary_modes,
            "cases": {
                label: {
                    "model_id": cases[label]["model_id"],
                    "candidate_root_node_id": cases[label]["candidate_root_node_id"],
                    "topology_class": cases[label]["topology_class"],
                    "required_qubits": cases[label]["required_qubits"],
                    "primary_mode": cases[label]["integration_recommendation"]["primary_mode"],
                    "requires_operator_attention": cases[label]["integration_recommendation"]["requires_operator_attention"],
                    "reference_cut_set_count": cases[label]["reference_cut_set_count"],
                    "tier_1_recovered_exact_cut_set_count": cases[label]["recovery_tier_1_exact_hardware"]["recovered_exact_cut_set_count"],
                    "tier_3_all_recovered_in_union": cases[label]["recovery_tier_3_union_sensitivity"]["all_recovered_in_union"],
                }
                for label in sorted(cases.keys())
            },
        },
        "canonical_candidate_artifacts": {
            label: str(case_paths[label])
            for label in sorted(case_paths.keys())
        },
    }

    outdir = output_root / f"{utc_stamp()}_openpra_recovery_integration_policy"
    outdir.mkdir(parents=True, exist_ok=False)

    policy_path = outdir / "openpra_recovery_integration_policy_v1.json"
    write_json(policy_path, policy)

    policy_txt = "\n".join(
        [
            "OpenPRA quantum recovery integration policy",
            "",
            f"generated_at: {policy['generated_at']}",
            f"observed_case_count: {policy['observed_case_evidence']['case_count']}",
            f"observed_primary_modes: {policy['observed_case_evidence']['observed_primary_modes']}",
            "",
            "Recovery ladder:",
            "  1. exact_hardware_recovery",
            "  2. alternate_orientation_audit",
            "  3. union_sensitivity_recovery",
            "  4. near_miss_advisory",
            "  5. targeted_rerun",
            "",
            "Operator attention is required whenever the result is not an unambiguous exact hardware recovery.",
            "",
        ]
    ) + "\n"
    write_text(outdir / "openpra_recovery_integration_policy_v1.txt", policy_txt)

    candidate_policy_copy = repo_root / "_work/openpra_phase5_real_candidate_batch_v1/20260410_155058Z/openpra_recovery_integration_policy_v1.json"
    write_json(candidate_policy_copy, policy)

    manifest = write_manifest(outdir)
    write_json(outdir / "00_manifest.json", manifest)

    print(f"OUTDIR={outdir}")
    print(f"POLICY_JSON={policy_path}")
    print(f"POLICY_TXT={outdir / 'openpra_recovery_integration_policy_v1.txt'}")
    print(f"BATCH_COPY={candidate_policy_copy}")
    print(f"MANIFEST={outdir / '00_manifest.json'}")
    print(f"SHA256={outdir / 'SHA256SUMS.txt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
