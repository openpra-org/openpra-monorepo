#!/usr/bin/env bash
set -euo pipefail

cd /mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo

STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
OUTBASE="_work/openpra_phase5_true_new_materialized_package_v1/${STAMP}"
FLAT_DIR="${OUTBASE}/flat_materialized_exports"
mkdir -p "${FLAT_DIR}"

PHASE4_PACKAGE_PY="./tools/quantum_research_scripts/phase4/package_openpra_phase4_reference_artifacts_v1.py"
PHASE4_VALIDATE_PY="./tools/quantum_research_scripts/phase4/validate_openpra_phase4_reference_artifacts_v1.py"
PHASE5_BATCH_PY="./tools/quantum_research_scripts/phase5/openpra_phase5_prepare_real_candidate_batch_v1.py"

for p in "${PHASE4_PACKAGE_PY}" "${PHASE4_VALIDATE_PY}" "${PHASE5_BATCH_PY}"; do
  test -f "${p}" || { echo "Missing required script: ${p}" >&2; exit 1; }
done

python3 - <<'PY'
import json
import re
from pathlib import Path

repo = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")
selected_root = repo / "_work/openpra_phase5_true_new_structure_tranche_v1/20260414_030403Z/selected_tuned_exports"
outbase = repo / next(
    p.name for p in sorted((repo / "_work/openpra_phase5_true_new_materialized_package_v1").iterdir(), reverse=True)
    if p.is_dir()
)
flat_dir = outbase / "flat_materialized_exports"
flat_dir.mkdir(parents=True, exist_ok=True)

targets = [
    {
        "model_id": "phase2b_row_9683",
        "root": "G:G1465",
        "subdir_pattern": "*phase2b_row_9683_G_G1465",
        "outfile": "0044_real_case_row9683_clqubo_export.json",
    },
    {
        "model_id": "phase2b_row_4228",
        "root": "G:G303",
        "subdir_pattern": "*phase2b_row_4228_G_G303",
        "outfile": "0117_real_case_row4228_clqubo_export.json",
    },
]

def contains_exact_string(obj, target: str) -> bool:
    if isinstance(obj, dict):
        return any(contains_exact_string(v, target) for v in obj.values())
    if isinstance(obj, list):
        return any(contains_exact_string(v, target) for v in obj)
    return obj == target

def walk_dict_nodes(obj, path=()):
    if isinstance(obj, dict):
        yield path, obj
        for k, v in obj.items():
            yield from walk_dict_nodes(v, path + (str(k),))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk_dict_nodes(v, path + (f"[{i}]",))

summary = []

for t in targets:
    matches = sorted(selected_root.glob(f"**/{t['subdir_pattern']}/*_clqubo_export.json"))
    if len(matches) != 1:
        raise SystemExit(
            f"Expected exactly 1 selected source JSON for {t['model_id']} {t['root']}, found {len(matches)}"
        )

    src = matches[0]
    data = json.loads(src.read_text(encoding="utf-8"))

    candidates = data.get("clQuboCandidates")
    if not isinstance(candidates, list) or not candidates:
        raise SystemExit(f"{src} does not contain a usable clQuboCandidates list")

    candidate_hits = []
    for idx, cand in enumerate(candidates, start=1):
        hit_model = contains_exact_string(cand, t["model_id"])
        hit_root = contains_exact_string(cand, t["root"])
        if hit_model or hit_root:
            candidate_hits.append((idx, cand, hit_model, hit_root))

    if len(candidate_hits) != 1:
        raise SystemExit(
            f"{src.name}: expected exactly 1 matching candidate for {t['model_id']} {t['root']}, "
            f"found {len(candidate_hits)}"
        )

    cand_idx, selected_candidate, hit_model, hit_root = candidate_hits[0]

    full_model_hits = []
    for path, node in walk_dict_nodes(data):
        full_model = node.get("fullClQuboModel")
        if isinstance(full_model, dict):
            node_hit_model = contains_exact_string(node, t["model_id"])
            node_hit_root = contains_exact_string(node, t["root"])
            full_model_hits.append(
                {
                    "path": list(path),
                    "node": node,
                    "fullClQuboModel": full_model,
                    "hit_model": node_hit_model,
                    "hit_root": node_hit_root,
                }
            )

    targeted_full_model_hits = [h for h in full_model_hits if h["hit_model"] or h["hit_root"]]

    if len(targeted_full_model_hits) == 1:
        selected_full_model = targeted_full_model_hits[0]["fullClQuboModel"]
        selected_full_model_path = targeted_full_model_hits[0]["path"]
    elif len(full_model_hits) == 1:
        selected_full_model = full_model_hits[0]["fullClQuboModel"]
        selected_full_model_path = full_model_hits[0]["path"]
    else:
        raise SystemExit(
            f"{src.name}: could not unambiguously choose a fullClQuboModel node "
            f"(targeted={len(targeted_full_model_hits)}, total={len(full_model_hits)})"
        )

    out = dict(selected_candidate)
    out["fullClQuboModel"] = selected_full_model

    for k in [
        "modelId",
        "modelName",
        "moduleVersion",
        "sourceFormat",
        "generatedAt",
        "exportSliceVersion",
        "tuned_parameter_application",
        "totalCandidateSubtrees",
        "totalQuantumTractableCandidates",
    ]:
        if k in data:
            out[k] = data[k]

    out_path = flat_dir / t["outfile"]
    out_path.write_text(json.dumps(out, indent=2, sort_keys=True), encoding="utf-8")

    summary.append(
        {
            "source_file": str(src.relative_to(repo)),
            "materialized_file": str(out_path.relative_to(repo)),
            "model_id": t["model_id"],
            "root": t["root"],
            "selected_candidate_index": cand_idx,
            "selected_full_model_path": selected_full_model_path,
            "candidate_match_model": hit_model,
            "candidate_match_root": hit_root,
            "top_level_keys_written": sorted(out.keys()),
        }
    )

summary_path = outbase / "90_materialization_summary.json"
summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

print("MATERIALIZATION_SUMMARY=" + str(summary_path.relative_to(repo)))
for row in summary:
    print(row["materialized_file"])
PY

echo
echo "===== MATERIALIZED EXPORTS ====="
find "${FLAT_DIR}" -maxdepth 1 -type f | sort

echo
echo "===== MATERIALIZATION SUMMARY ====="
sed -n '1,260p' "${OUTBASE}/90_materialization_summary.json"

python3 "${PHASE4_PACKAGE_PY}" --tuned-run "${FLAT_DIR}"

PACKAGE_RUN="$(ls -1dt _work/openpra_phase4_reference_artifact_packages_v1/*/ | head -n 1)"
test -f "${PACKAGE_RUN}/90_phase4_reference_artifact_package_summary.json"

echo
echo "PACKAGE_RUN=${PACKAGE_RUN}"
echo
echo "===== PACKAGE SUMMARY ====="
sed -n '1,260p' "${PACKAGE_RUN}/90_phase4_reference_artifact_package_summary.json"

python3 "${PHASE4_VALIDATE_PY}" --package-run "${PACKAGE_RUN}"

VALIDATION_RUN="$(ls -1dt _work/openpra_phase4_reference_artifact_validation_v1/*/ | head -n 1)"
test -f "${VALIDATION_RUN}/90_phase4_reference_artifact_validation_summary.json"

echo
echo "VALIDATION_RUN=${VALIDATION_RUN}"
echo
echo "===== VALIDATION SUMMARY ====="
sed -n '1,260p' "${VALIDATION_RUN}/90_phase4_reference_artifact_validation_summary.json"

python3 "${PHASE5_BATCH_PY}" \
  --package-run "${PACKAGE_RUN}" \
  --target-count 2 \
  --max-basic-event-count 8 \
  --allowed-topology-classes "D"

PHASE5_BATCH_RUN="$(ls -1dt _work/openpra_phase5_real_candidate_batch_v1/*/ | head -n 1)"
test -f "${PHASE5_BATCH_RUN}/90_phase5_real_candidate_batch_summary.json"
test -f "${PHASE5_BATCH_RUN}/91_phase5_real_candidate_manifest.csv"

echo
echo "PHASE5_BATCH_RUN=${PHASE5_BATCH_RUN}"
echo
echo "===== PHASE 5 BATCH SUMMARY ====="
sed -n '1,260p' "${PHASE5_BATCH_RUN}/90_phase5_real_candidate_batch_summary.json"

echo
echo "===== PHASE 5 BATCH MANIFEST ====="
sed -n '1,120p' "${PHASE5_BATCH_RUN}/91_phase5_real_candidate_manifest.csv"
