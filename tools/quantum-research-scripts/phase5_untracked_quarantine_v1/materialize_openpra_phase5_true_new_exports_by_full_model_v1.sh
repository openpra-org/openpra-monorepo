#!/usr/bin/env bash
set -euo pipefail

cd /mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo

STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
OUTBASE="_work/openpra_phase5_true_new_materialized_by_full_model_v1/${STAMP}"
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
from pathlib import Path

repo = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")
selected_root = repo / "_work/openpra_phase5_true_new_structure_tranche_v1/20260414_030403Z/selected_tuned_exports"
outbase = repo / next(
    p.name for p in sorted((repo / "_work/openpra_phase5_true_new_materialized_by_full_model_v1").iterdir(), reverse=True)
    if p.is_dir()
)
flat_dir = outbase / "flat_materialized_exports"
flat_dir.mkdir(parents=True, exist_ok=True)

targets = [
    {
        "model_id": "phase2b_row_9683",
        "root": "G:G1465",
        "n_basic": 8,
        "subdir_pattern": "*phase2b_row_9683_G_G1465",
        "outfile": "0044_real_case_row9683_clqubo_export.json",
    },
    {
        "model_id": "phase2b_row_4228",
        "root": "G:G303",
        "n_basic": 8,
        "subdir_pattern": "*phase2b_row_4228_G_G303",
        "outfile": "0117_real_case_row4228_clqubo_export.json",
    },
]

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

    full_model_nodes = []
    for path, node in walk_dict_nodes(data):
        full_model = node.get("fullClQuboModel")
        if isinstance(full_model, dict):
            full_model_nodes.append(
                {
                    "path": list(path),
                    "node": node,
                    "topGate": full_model.get("topGate"),
                    "nBasic": full_model.get("nBasic"),
                    "nVarsTotal": full_model.get("nVarsTotal"),
                    "status": full_model.get("status"),
                    "encodingFamily": full_model.get("encodingFamily"),
                    "node_keys": sorted(node.keys()),
                    "full_model": full_model,
                }
            )

    targeted = [
        x for x in full_model_nodes
        if x["topGate"] == t["root"] and x["nBasic"] == t["n_basic"]
    ]

    if len(targeted) != 1:
        debug = {
            "source_file": str(src.relative_to(repo)),
            "target_model_id": t["model_id"],
            "target_root": t["root"],
            "target_n_basic": t["n_basic"],
            "full_model_node_count": len(full_model_nodes),
            "full_model_nodes": [
                {
                    "path": x["path"],
                    "topGate": x["topGate"],
                    "nBasic": x["nBasic"],
                    "nVarsTotal": x["nVarsTotal"],
                    "status": x["status"],
                    "encodingFamily": x["encodingFamily"],
                    "node_keys": x["node_keys"],
                }
                for x in full_model_nodes
            ],
            "targeted_match_count": len(targeted),
        }
        debug_path = outbase / f"DEBUG_{t['model_id']}_full_model_nodes.json"
        debug_path.write_text(json.dumps(debug, indent=2), encoding="utf-8")
        raise SystemExit(
            f"{src.name}: expected exactly 1 fullClQuboModel with topGate={t['root']} "
            f"and nBasic={t['n_basic']}, found {len(targeted)}. "
            f"See {debug_path.relative_to(repo)}"
        )

    selected = targeted[0]
    selected_node = selected["node"]
    selected_full_model = selected["full_model"]

    out = {k: v for k, v in selected_node.items() if k != "fullClQuboModel"}
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

    out["model_id"] = t["model_id"]
    out["candidateRootNodeId"] = t["root"]
    out["candidate_root_node_id"] = t["root"]

    out_path = flat_dir / t["outfile"]
    out_path.write_text(json.dumps(out, indent=2, sort_keys=True), encoding="utf-8")

    summary.append(
        {
            "source_file": str(src.relative_to(repo)),
            "materialized_file": str(out_path.relative_to(repo)),
            "model_id": t["model_id"],
            "root": t["root"],
            "selected_full_model_path": selected["path"],
            "selected_full_model_topGate": selected["topGate"],
            "selected_full_model_nBasic": selected["nBasic"],
            "selected_full_model_nVarsTotal": selected["nVarsTotal"],
            "selected_full_model_status": selected["status"],
            "selected_full_model_encodingFamily": selected["encodingFamily"],
            "written_top_level_keys": sorted(out.keys()),
        }
    )

summary_path = outbase / "90_materialization_by_full_model_summary.json"
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
sed -n '1,260p' "${OUTBASE}/90_materialization_by_full_model_summary.json"

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
