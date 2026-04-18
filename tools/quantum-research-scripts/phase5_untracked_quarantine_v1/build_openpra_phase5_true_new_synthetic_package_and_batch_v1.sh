#!/usr/bin/env bash
set -euo pipefail

cd /mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo

STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
PACKAGE_RUN="_work/openpra_phase4_reference_artifact_packages_v1/${STAMP}"

AUTHOR_SCRIPTS="_work/openpra_phase5_authoritative_project_bundle_v1/PHASE5_AUTHORITATIVE_PROJECT_BUNDLE_v1_20260412_200026Z/scripts"

pick_script() {
  for candidate in "$@"; do
    if [ -f "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

PHASE5_BATCH_PY="$(pick_script \
  "./tools/quantum_research_scripts/phase5/openpra_phase5_prepare_real_candidate_batch_v1.py" \
  "${AUTHOR_SCRIPTS}/openpra_phase5_prepare_real_candidate_batch_v1.py")"

INIT_INPUTS_PY="$(pick_script \
  "./tools/quantum_research_scripts/phase5/openpra_phase5_initialize_candidate_inputs_v1.py" \
  "${AUTHOR_SCRIPTS}/openpra_phase5_initialize_candidate_inputs_v1.py")"

BUILD_LEDGER_PY="$(pick_script \
  "./tools/quantum_research_scripts/phase5/openpra_phase5_build_probability_master_ledger_v1.py" \
  "${AUTHOR_SCRIPTS}/openpra_phase5_build_probability_master_ledger_v1.py")"

INGEST_DEC6_PY="$(pick_script \
  "./tools/quantum_research_scripts/phase5/openpra_phase5_ingest_probabilities_from_dec6_csv_v1.py" \
  "${AUTHOR_SCRIPTS}/openpra_phase5_ingest_probabilities_from_dec6_csv_v1.py")"

APPLY_MASTER_PY="$(pick_script \
  "./tools/quantum_research_scripts/phase5/openpra_phase5_apply_master_probability_values_v1.py" \
  "${AUTHOR_SCRIPTS}/openpra_phase5_apply_master_probability_values_v1.py")"

INIT_RAW_COUNTS_PY="$(pick_script \
  "./tools/quantum_research_scripts/phase5/openpra_phase5_initialize_raw_counts_templates_v1.py" \
  "${AUTHOR_SCRIPTS}/openpra_phase5_initialize_raw_counts_templates_v1.py")"

for p in \
  "${PHASE5_BATCH_PY}" \
  "${INIT_INPUTS_PY}" \
  "${BUILD_LEDGER_PY}" \
  "${INGEST_DEC6_PY}" \
  "${APPLY_MASTER_PY}" \
  "${INIT_RAW_COUNTS_PY}"
do
  test -f "${p}" || { echo "Missing required script: ${p}" >&2; exit 1; }
done

mkdir -p "${PACKAGE_RUN}"
export PACKAGE_RUN

python3 - <<'PY'
import csv
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

repo = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")
package_run = repo / os.environ["PACKAGE_RUN"]

targets = [
    {
        "ordinal": 1,
        "label": "row9683_GG1465",
        "model_id": "phase2b_row_9683",
        "root": "G:G1465",
        "candidate_index": 5,
        "source_glob": "_work/openpra_phase5_true_new_structure_tranche_v1/20260414_030403Z/selected_tuned_exports/**/0044_real_case_row9683_clqubo_export.json",
    },
    {
        "ordinal": 2,
        "label": "row4228_GG303",
        "model_id": "phase2b_row_4228",
        "root": "G:G303",
        "candidate_index": 4,
        "source_glob": "_work/openpra_phase5_true_new_structure_tranche_v1/20260414_030403Z/selected_tuned_exports/**/0117_real_case_row4228_clqubo_export.json",
    },
]

def utc_now_iso():
    return datetime.now(timezone.utc).isoformat()

def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def write_json(path: Path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

summary_cases = []

for item in targets:
    matches = sorted(repo.glob(item["source_glob"]))
    if len(matches) != 1:
        raise SystemExit(
            f"Expected exactly 1 source export for {item['label']}, found {len(matches)}"
        )

    src = matches[0]
    src_payload = json.loads(src.read_text(encoding="utf-8"))
    candidates = src_payload.get("clQuboCandidates", [])
    idx0 = item["candidate_index"] - 1
    if not isinstance(candidates, list) or idx0 < 0 or idx0 >= len(candidates):
        raise SystemExit(
            f"Bad candidate index for {item['label']}: {item['candidate_index']}"
        )

    cand = candidates[idx0]

    if cand.get("modelId") != item["model_id"]:
        raise SystemExit(
            f"{item['label']}: modelId mismatch: {cand.get('modelId')} != {item['model_id']}"
        )
    if cand.get("candidateRootNodeId") != item["root"]:
        raise SystemExit(
            f"{item['label']}: candidateRootNodeId mismatch: {cand.get('candidateRootNodeId')} != {item['root']}"
        )

    ordered_basic_event_ids = cand.get("orderedBasicEventIds", [])
    if not isinstance(ordered_basic_event_ids, list) or not ordered_basic_event_ids:
        raise SystemExit(f"{item['label']}: missing orderedBasicEventIds")

    frozen = cand.get("frozenMcsReference", {})
    requirements = cand.get("requirementsAssessment", {})
    topology = cand.get("topologyClassification", {})
    qaoa_recipe = cand.get("qaoaCircuitRecipe", {})

    basic_event_count = len(ordered_basic_event_ids)
    required_qubits = requirements.get("requiredQubits")
    topology_class = topology.get("topologyClass")
    minimal_cut_set_count = frozen.get("minimalCutSetCount")
    tuned_selection = qaoa_recipe.get("tunedParameterSelection", {})

    case_dir = package_run / f"{item['ordinal']:04d}"
    case_dir.mkdir(parents=True, exist_ok=False)

    package_metadata = {
        "generated_at": utc_now_iso(),
        "script_version": "phase4-reference-artifact-packager-v3-synthetic-slice-adapter-v1",
        "model_id": cand.get("modelId"),
        "model_name": cand.get("modelName"),
        "candidate_root_node_id": cand.get("candidateRootNodeId"),
        "topology_class": topology_class,
        "required_qubits": required_qubits,
        "basic_event_count": basic_event_count,
        "minimal_cut_set_count": minimal_cut_set_count,
        "statevector_verification_eligible": bool(cand.get("statevectorVerificationPlan", {}).get("eligible")),
        "full_cl_qubo_model_present": False,
        "full_cl_qubo_n_vars_total": None,
        "full_cl_qubo_penalty_p": None,
        "full_cl_qubo_top_gate": str(cand.get("candidateRootNodeId", "")).split(":", 1)[-1] if cand.get("candidateRootNodeId") else None,
        "paper10_compatible_qubo_model_written": False,
        "tuned_parameter_application": {
            "script_version": tuned_selection.get("script_version"),
            "applied_at": utc_now_iso(),
            "resolved_mode": tuned_selection.get("resolved_mode"),
            "selection_label": tuned_selection.get("selection_label"),
            "selection_source": tuned_selection.get("selection_source"),
            "source_sweep_run": tuned_selection.get("source_sweep_run"),
            "beta": tuned_selection.get("beta"),
            "gamma": tuned_selection.get("gamma"),
        },
        "source_export_file": str(src.resolve()),
        "synthetic_package_bridge": True,
        "synthetic_package_reason": "selected_true_new_candidate_slice_has_no_fullClQuboModel",
    }

    frozen_payload = {
        "generated_at": utc_now_iso(),
        "script_version": "phase4-reference-artifact-packager-v3-synthetic-slice-adapter-v1",
        "model_id": cand.get("modelId"),
        "candidate_root_node_id": cand.get("candidateRootNodeId"),
        "frozen_mcs_reference": frozen,
    }

    source_export_payload = {
        "generated_at": utc_now_iso(),
        "script_version": "phase4-reference-artifact-packager-v3-synthetic-slice-adapter-v1",
        "modelId": src_payload.get("modelId", cand.get("modelId")),
        "modelName": src_payload.get("modelName", cand.get("modelName")),
        "moduleVersion": src_payload.get("moduleVersion", cand.get("moduleVersion")),
        "sourceFormat": "synthetic_package_source_export_from_candidate_slice_v1",
        "exportSliceVersion": src_payload.get("exportSliceVersion", cand.get("exportSliceVersion")),
        "synthetic_package_bridge": True,
        "original_selected_export": str(src.resolve()),
        "original_candidate_index": item["candidate_index"],
        "clQuboCandidates": [cand],
    }

    qaoa_recipe_payload = qaoa_recipe

    circuit_summary_payload = {
        "generated_at": utc_now_iso(),
        "script_version": "phase4-reference-artifact-packager-v3-synthetic-slice-adapter-v1",
        "model_id": cand.get("modelId"),
        "candidate_root_node_id": cand.get("candidateRootNodeId"),
        "qubit_count": qaoa_recipe.get("qubitCount"),
        "depth_p": qaoa_recipe.get("depthP"),
        "circuit_family": qaoa_recipe.get("circuitFamily"),
        "generation_mode": qaoa_recipe.get("generationMode"),
        "measurement_basis": qaoa_recipe.get("measurementBasis"),
        "qpy_present": False,
        "note": "Synthetic summary from selected candidate slice.",
    }

    write_json(case_dir / f"{item['ordinal']:04d}_package_metadata.json", package_metadata)
    write_json(case_dir / f"{item['ordinal']:04d}_frozen_mcs_reference.json", frozen_payload)
    write_json(case_dir / f"{item['ordinal']:04d}_source_export.json", source_export_payload)
    write_json(case_dir / f"{item['ordinal']:04d}_qaoa_recipe.json", qaoa_recipe_payload)
    write_json(case_dir / f"{item['ordinal']:04d}_circuit_summary.json", circuit_summary_payload)

    summary_cases.append(
        {
            "package_case_id": f"{item['ordinal']:04d}",
            "model_id": cand.get("modelId"),
            "candidate_root_node_id": cand.get("candidateRootNodeId"),
            "topology_class": topology_class,
            "basic_event_count": basic_event_count,
            "required_qubits": required_qubits,
            "minimal_cut_set_count": minimal_cut_set_count,
            "ordered_basic_event_ids_count": len(ordered_basic_event_ids),
            "source_selected_export": str(src.relative_to(repo)),
            "selected_candidate_index": item["candidate_index"],
        }
    )

manifest = {}
for path in sorted(package_run.rglob("*")):
    if path.is_file():
        manifest[str(path.relative_to(package_run))] = sha256_file(path)

sha_path = package_run / "SHA256SUMS.txt"
with sha_path.open("w", encoding="utf-8") as handle:
    for rel, digest in sorted(manifest.items()):
        handle.write(f"{digest}  {rel}\n")
manifest["SHA256SUMS.txt"] = sha256_file(sha_path)

summary = {
    "generated_at": utc_now_iso(),
    "script_version": "phase4-reference-artifact-packager-v3-synthetic-slice-adapter-v1",
    "package_run": str(package_run),
    "case_count": len(summary_cases),
    "synthetic_package_bridge": True,
    "reason": "Selected true new slice exports do not contain fullClQuboModel but do contain all fields needed for Phase 5 batch preparation.",
    "cases": summary_cases,
}

with (package_run / "90_phase4_reference_artifact_package_summary.json").open("w", encoding="utf-8") as handle:
    json.dump(summary, handle, indent=2)
    handle.write("\n")

with (package_run / "91_phase4_reference_artifact_manifest.csv").open("w", encoding="utf-8", newline="") as handle:
    writer = csv.DictWriter(
        handle,
        fieldnames=[
            "package_case_id",
            "model_id",
            "candidate_root_node_id",
            "topology_class",
            "basic_event_count",
            "required_qubits",
            "minimal_cut_set_count",
            "ordered_basic_event_ids_count",
            "source_selected_export",
            "selected_candidate_index",
        ],
    )
    writer.writeheader()
    for row in summary_cases:
        writer.writerow(row)

with (package_run / "00_manifest.json").open("w", encoding="utf-8") as handle:
    json.dump(manifest, handle, indent=2)
    handle.write("\n")

print(f"PACKAGE_RUN={package_run.relative_to(repo)}")
PY

test -f "${PACKAGE_RUN}/90_phase4_reference_artifact_package_summary.json"
test -f "${PACKAGE_RUN}/91_phase4_reference_artifact_manifest.csv"

echo
echo "PACKAGE_RUN=${PACKAGE_RUN}"
echo
echo "===== SYNTHETIC PACKAGE SUMMARY ====="
sed -n '1,260p' "${PACKAGE_RUN}/90_phase4_reference_artifact_package_summary.json"

echo
echo "===== SYNTHETIC PACKAGE MANIFEST ====="
sed -n '1,120p' "${PACKAGE_RUN}/91_phase4_reference_artifact_manifest.csv"

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

python3 "${INIT_INPUTS_PY}" --batch-run "${PHASE5_BATCH_RUN}"
test -f "${PHASE5_BATCH_RUN}/94_phase5_input_readiness_summary.json"

python3 "${BUILD_LEDGER_PY}" --batch-run "${PHASE5_BATCH_RUN}"
LEDGER_RUN="${PHASE5_BATCH_RUN}/99_phase5_probability_master_ledger_v1"
test -f "${LEDGER_RUN}/phase5_probability_master_ledger_summary.json"
test -f "${LEDGER_RUN}/phase5_probability_master_ledger.csv"

python3 "${INGEST_DEC6_PY}" --batch-run "${PHASE5_BATCH_RUN}" --ledger-run "${LEDGER_RUN}"
test -f "${LEDGER_RUN}/phase5_probability_ingest_from_dec6_summary.json"

python3 "${APPLY_MASTER_PY}" --batch-run "${PHASE5_BATCH_RUN}" --ledger-run "${LEDGER_RUN}"
test -f "${LEDGER_RUN}/phase5_probability_fanout_summary.json"

python3 "${INIT_RAW_COUNTS_PY}" --batch-run "${PHASE5_BATCH_RUN}"
test -f "${PHASE5_BATCH_RUN}/97_phase5_raw_counts_readiness_summary.json"

echo
echo "===== INPUT READINESS SUMMARY ====="
sed -n '1,220p' "${PHASE5_BATCH_RUN}/94_phase5_input_readiness_summary.json"

echo
echo "===== PROBABILITY LEDGER SUMMARY ====="
sed -n '1,220p' "${LEDGER_RUN}/phase5_probability_master_ledger_summary.json"

echo
echo "===== DEC6 INGEST SUMMARY ====="
sed -n '1,220p' "${LEDGER_RUN}/phase5_probability_ingest_from_dec6_summary.json"

echo
echo "===== PROBABILITY FANOUT SUMMARY ====="
sed -n '1,220p' "${LEDGER_RUN}/phase5_probability_fanout_summary.json"

echo
echo "===== RAW COUNTS READINESS SUMMARY ====="
sed -n '1,220p' "${PHASE5_BATCH_RUN}/97_phase5_raw_counts_readiness_summary.json"

echo
echo "===== PER CASE STATUS CHECK ====="
python3 - <<'PY'
import json
from pathlib import Path

repo = Path("/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo")
batch_root = sorted((repo / "_work/openpra_phase5_real_candidate_batch_v1").glob("*"), reverse=True)[0]

for case_dir in sorted([p for p in batch_root.iterdir() if p.is_dir() and p.name[:4].isdigit()]):
    meta = json.loads((case_dir / "package_metadata.json").read_text(encoding="utf-8"))
    probs = json.loads((case_dir / "probabilities.json").read_text(encoding="utf-8"))
    qmcs = json.loads((case_dir / "quantum_recovered_mcs.json").read_text(encoding="utf-8"))
    raw = json.loads((case_dir / "raw_counts.json").read_text(encoding="utf-8"))
    print()
    print(case_dir.name)
    print("  model_id =", meta["model_id"])
    print("  candidate_root_node_id =", meta["candidate_root_node_id"])
    print("  topology_class =", meta.get("topology_class"))
    print("  basic_event_count =", meta.get("basic_event_count"))
    print("  probabilities_status =", probs.get("status"))
    print("  populated_probability_count =", sum(1 for v in probs.get("probabilities", {}).values() if isinstance(v, (int, float))))
    print("  quantum_mcs_status =", qmcs.get("status"))
    print("  quantum_mcs_count =", len(qmcs.get("basicEventIdSets", [])))
    print("  raw_counts_status =", raw.get("status"))
    print("  raw_counts_entry_count =", len(raw.get("counts", {})))
PY
