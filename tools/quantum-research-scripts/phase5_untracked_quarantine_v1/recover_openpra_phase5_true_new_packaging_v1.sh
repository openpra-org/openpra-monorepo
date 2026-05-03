#!/usr/bin/env bash
set -euo pipefail

cd /mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo

SRC_TRUE="_work/openpra_phase5_true_new_structure_tranche_v1/20260414_030403Z/selected_tuned_exports"
MAT_TRUE="_work/openpra_phase5_true_new_structure_tranche_v1/20260414_030403Z/materialized_full_exports_for_packaging"

rm -rf "${MAT_TRUE}"
mkdir -p "${MAT_TRUE}"

python3 - <<'PY'
import json
import re
from pathlib import Path

src = Path("_work/openpra_phase5_true_new_structure_tranche_v1/20260414_030403Z/selected_tuned_exports")
dst = Path("_work/openpra_phase5_true_new_structure_tranche_v1/20260414_030403Z/materialized_full_exports_for_packaging")

required = {
    "status",
    "encodingFamily",
    "nBasic",
    "nVarsTotal",
    "penaltyP",
    "topGate",
    "vars",
    "qubo",
    "ising",
}

def find_full_model(obj):
    if isinstance(obj, dict):
        maybe = obj.get("fullClQuboModel")
        if isinstance(maybe, dict):
            return maybe
        for value in obj.values():
            found = find_full_model(value)
            if found is not None:
                return found
    elif isinstance(obj, list):
        for value in obj:
            found = find_full_model(value)
            if found is not None:
                return found
    return None

written = 0
missed = 0

for p in sorted(src.glob("**/*_clqubo_export.json")):
    data = json.loads(p.read_text(encoding="utf-8"))
    candidates = data.get("clQuboCandidates", [])

    print()
    print(f"==== {p.name} ====")
    print(f"candidate_count={len(candidates) if isinstance(candidates, list) else 'INVALID'}")

    if not isinstance(candidates, list) or not candidates:
        print("NO_CANDIDATES_FOUND")
        missed += 1
        continue

    for i, cand in enumerate(candidates, start=1):
        if not isinstance(cand, dict):
            print(f"candidate_{i}: INVALID_CANDIDATE_OBJECT")
            missed += 1
            continue

        full_model = find_full_model(cand)
        if not isinstance(full_model, dict):
            print(f"candidate_{i}: NO_FULL_MODEL_FOUND")
            missed += 1
            continue

        missing = sorted(required - set(full_model.keys()))
        if missing:
            print(f"candidate_{i}: FULL_MODEL_PRESENT_BUT_MISSING_KEYS={missing}")
            missed += 1
            continue

        out = dict(cand)
        out["fullClQuboModel"] = full_model
        out["sourceFormat"] = data.get("sourceFormat")
        out["modelId"] = data.get("modelId")
        out["modelName"] = data.get("modelName")
        out["moduleVersion"] = data.get("moduleVersion")
        out["exportSliceVersion"] = data.get("exportSliceVersion")
        out["generatedAt"] = data.get("generatedAt")
        out["tuned_parameter_application"] = data.get("tuned_parameter_application")

        stem = re.sub(r"_clqubo_export$", "", p.stem)
        out_name = f"{stem}__cand{i:04d}_materialized_clqubo_export.json"
        out_path = dst / out_name
        out_path.write_text(json.dumps(out, indent=2, sort_keys=True), encoding="utf-8")

        print(f"candidate_{i}: WROTE {out_path.name}")
        written += 1

print()
print(f"written={written}")
print(f"missed={missed}")

if written == 0:
    raise SystemExit(
        "No materialized exports were created. "
        "The selected tranche files do not contain embedded fullClQuboModel objects."
    )
PY

echo
echo "===== MATERIALIZED EXPORTS ====="
find "${MAT_TRUE}" -maxdepth 1 -type f | sort

python3 tools/quantum_research_scripts/phase4/package_openpra_phase4_reference_artifacts_v1.py \
  --tuned-run "${MAT_TRUE}"

PACKAGE_RUN="$(ls -1dt _work/openpra_phase4_reference_artifact_packages_v1/*/ | head -n 1)"

echo
echo "PACKAGE_RUN=${PACKAGE_RUN}"
echo
echo "===== PACKAGE SUMMARY ====="
sed -n '1,220p' "${PACKAGE_RUN}/90_phase4_reference_artifact_package_summary.json"

python3 tools/quantum_research_scripts/phase4/validate_openpra_phase4_reference_artifacts_v1.py \
  --package-run "${PACKAGE_RUN}"

VALIDATION_RUN="$(ls -1dt _work/openpra_phase4_reference_artifact_validation_v1/*/ | head -n 1)"

echo
echo "VALIDATION_RUN=${VALIDATION_RUN}"
echo
echo "===== VALIDATION SUMMARY ====="
sed -n '1,220p' "${VALIDATION_RUN}/90_phase4_reference_artifact_validation_summary.json"

python3 tools/quantum_research_scripts/phase5/openpra_phase5_prepare_real_candidate_batch_v1.py \
  --package-run "${PACKAGE_RUN}" \
  --target-count 2 \
  --max-basic-event-count 8 \
  --allowed-topology-classes "D"

PHASE5_BATCH_RUN="$(ls -1dt _work/openpra_phase5_real_candidate_batch_v1/*/ | head -n 1)"

echo
echo "PHASE5_BATCH_RUN=${PHASE5_BATCH_RUN}"
echo
echo "===== PHASE 5 REAL BATCH SUMMARY ====="
sed -n '1,220p' "${PHASE5_BATCH_RUN}/90_phase5_real_candidate_batch_summary.json"

echo
echo "===== PHASE 5 REAL BATCH MANIFEST ====="
sed -n '1,120p' "${PHASE5_BATCH_RUN}/91_phase5_real_candidate_manifest.csv"
