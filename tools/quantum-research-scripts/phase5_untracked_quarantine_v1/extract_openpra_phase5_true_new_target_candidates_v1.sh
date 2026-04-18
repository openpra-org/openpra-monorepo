#!/usr/bin/env bash
set -euo pipefail

cd /mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo

STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
OUTDIR="_work/openpra_phase5_true_new_target_candidate_extract_v1/${STAMP}"
mkdir -p "${OUTDIR}"
export OUTDIR

python3 - <<'PY'
import json
import os
from pathlib import Path

repo = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")
outdir = repo / os.environ["OUTDIR"]
selected_root = repo / "_work/openpra_phase5_true_new_structure_tranche_v1/20260414_030403Z/selected_tuned_exports"

targets = [
    {
        "label": "row9683_GG1465",
        "model_id": "phase2b_row_9683",
        "root": "G:G1465",
        "subdir_pattern": "*phase2b_row_9683_G_G1465",
        "candidate_index": 5,
        "outfile": "row9683_GG1465_candidate5.json",
    },
    {
        "label": "row4228_GG303",
        "model_id": "phase2b_row_4228",
        "root": "G:G303",
        "subdir_pattern": "*phase2b_row_4228_G_G303",
        "candidate_index": 4,
        "outfile": "row4228_GG303_candidate4.json",
    },
]

def nested_keys(obj, depth=0, max_depth=3):
    if depth >= max_depth:
        return None
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            child = nested_keys(v, depth + 1, max_depth)
            out[k] = child
        return out
    if isinstance(obj, list):
        return {
            "__type__": "list",
            "__len__": len(obj),
            "__item0_keys__": sorted(obj[0].keys()) if obj and isinstance(obj[0], dict) else None,
        }
    return type(obj).__name__

summary = []

for t in targets:
    matches = sorted(selected_root.glob(f"**/{t['subdir_pattern']}/*_clqubo_export.json"))
    if len(matches) != 1:
        raise SystemExit(
            f"Expected exactly 1 source file for {t['label']}, found {len(matches)}"
        )

    src = matches[0]
    data = json.loads(src.read_text(encoding="utf-8"))
    candidates = data.get("clQuboCandidates", [])
    if not isinstance(candidates, list):
        raise SystemExit(f"{src} does not contain a usable clQuboCandidates list")

    idx0 = t["candidate_index"] - 1
    if idx0 < 0 or idx0 >= len(candidates):
        raise SystemExit(
            f"{src.name}: candidate index {t['candidate_index']} out of range for {len(candidates)} candidates"
        )

    cand = candidates[idx0]

    out_json = outdir / t["outfile"]
    out_json.write_text(json.dumps(cand, indent=2, sort_keys=True), encoding="utf-8")

    item = {
        "label": t["label"],
        "source_file": str(src.relative_to(repo)),
        "candidate_index": t["candidate_index"],
        "candidate_json": str(out_json.relative_to(repo)),
        "candidate_keys": sorted(cand.keys()),
        "candidateRootNodeId": cand.get("candidateRootNodeId"),
        "candidateRootGateType": cand.get("candidateRootGateType"),
        "modelId": cand.get("modelId"),
        "orderedBasicEventIds_count": len(cand.get("orderedBasicEventIds", [])) if isinstance(cand.get("orderedBasicEventIds"), list) else None,
        "costMatrix_keys": sorted(cand.get("costMatrix", {}).keys()) if isinstance(cand.get("costMatrix"), dict) else None,
        "variableMapping_keys": sorted(cand.get("variableMapping", {}).keys()) if isinstance(cand.get("variableMapping"), dict) else None,
        "requirementsAssessment_keys": sorted(cand.get("requirementsAssessment", {}).keys()) if isinstance(cand.get("requirementsAssessment"), dict) else None,
        "qaoaCircuitRecipe_keys": sorted(cand.get("qaoaCircuitRecipe", {}).keys()) if isinstance(cand.get("qaoaCircuitRecipe"), dict) else None,
        "topologyClassification_keys": sorted(cand.get("topologyClassification", {}).keys()) if isinstance(cand.get("topologyClassification"), dict) else None,
        "frozenMcsReference_keys": sorted(cand.get("frozenMcsReference", {}).keys()) if isinstance(cand.get("frozenMcsReference"), dict) else None,
        "mixerSpecification_keys": sorted(cand.get("mixerSpecification", {}).keys()) if isinstance(cand.get("mixerSpecification"), dict) else None,
        "statevectorVerificationPlan_keys": sorted(cand.get("statevectorVerificationPlan", {}).keys()) if isinstance(cand.get("statevectorVerificationPlan"), dict) else None,
        "costMatrix_shape": nested_keys(cand.get("costMatrix"), max_depth=3),
        "variableMapping_shape": nested_keys(cand.get("variableMapping"), max_depth=3),
        "requirementsAssessment_shape": nested_keys(cand.get("requirementsAssessment"), max_depth=3),
        "qaoaCircuitRecipe_shape": nested_keys(cand.get("qaoaCircuitRecipe"), max_depth=3),
        "topologyClassification_shape": nested_keys(cand.get("topologyClassification"), max_depth=3),
        "frozenMcsReference_shape": nested_keys(cand.get("frozenMcsReference"), max_depth=3),
        "mixerSpecification_shape": nested_keys(cand.get("mixerSpecification"), max_depth=3),
        "statevectorVerificationPlan_shape": nested_keys(cand.get("statevectorVerificationPlan"), max_depth=3),
    }
    summary.append(item)

summary_path = outdir / "90_target_candidate_summary.json"
summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

print()
print("OUTDIR=", outdir.relative_to(repo))
print("SUMMARY_JSON=", summary_path.relative_to(repo))
for item in summary:
    print()
    print("====", item["label"], "====")
    print("source_file =", item["source_file"])
    print("candidate_index =", item["candidate_index"])
    print("candidate_json =", item["candidate_json"])
    print("candidateRootNodeId =", item["candidateRootNodeId"])
    print("candidateRootGateType =", item["candidateRootGateType"])
    print("modelId =", item["modelId"])
    print("orderedBasicEventIds_count =", item["orderedBasicEventIds_count"])
    print("candidate_keys =", item["candidate_keys"])
    print("costMatrix_keys =", item["costMatrix_keys"])
    print("variableMapping_keys =", item["variableMapping_keys"])
    print("requirementsAssessment_keys =", item["requirementsAssessment_keys"])
    print("qaoaCircuitRecipe_keys =", item["qaoaCircuitRecipe_keys"])
    print("topologyClassification_keys =", item["topologyClassification_keys"])
    print("frozenMcsReference_keys =", item["frozenMcsReference_keys"])
    print("mixerSpecification_keys =", item["mixerSpecification_keys"])
    print("statevectorVerificationPlan_keys =", item["statevectorVerificationPlan_keys"])
PY

echo
echo "===== SUMMARY JSON ====="
sed -n '1,260p' "${OUTDIR}/90_target_candidate_summary.json"
