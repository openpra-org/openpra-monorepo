#!/usr/bin/env bash
set -euo pipefail

ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
DEFAULT_BATCH_ROOT="${ROOT}/_work/openpra_phase5_real_candidate_batch_v1/20260410_155058Z"
BATCH_ROOT="${1:-${DEFAULT_BATCH_ROOT}}"
SELECTION_MODE="legacy_validated_only"

cd "${ROOT}"

OUTROOT="${ROOT}/_work/openpra_phase5_package_final_integration_tranche_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
OUTDIR="${OUTROOT}/${STAMP}"

mkdir -p "${OUTDIR}"

echo "ROOT=${ROOT}"
echo "BATCH_ROOT=${BATCH_ROOT}"
echo "SELECTION_MODE=${SELECTION_MODE}"
echo "OUTDIR=${OUTDIR}"
echo ""

npx nx test quantum-readiness --skip-nx-cache
npx nx build quantum-readiness --skip-nx-cache

node scripts/openpra_phase5_package_batch_cli_v1.cjs \
  --batch-root "${BATCH_ROOT}" \
  --selection-mode "${SELECTION_MODE}"

node scripts/openpra_phase5_validate_package_recovery_on_real_candidates_v1.cjs

BATCH_RUN="$(ls -1dt _work/openpra_phase5_package_batch_cli_v1/*/ | head -n 1)"
VALIDATE_RUN="$(ls -1dt _work/openpra_phase5_validate_package_recovery_on_real_candidates_v1/*/ | head -n 1)"

export ROOT
export BATCH_ROOT
export OUTDIR
export BATCH_RUN
export VALIDATE_RUN
export SELECTION_MODE

python3 - <<'PY'
import json
import os
import pathlib
import shutil
import hashlib
from datetime import datetime, timezone

root = pathlib.Path(os.environ["ROOT"])
batch_root = pathlib.Path(os.environ["BATCH_ROOT"])
outdir = pathlib.Path(os.environ["OUTDIR"])
batch_run = pathlib.Path(os.environ["BATCH_RUN"])
validate_run = pathlib.Path(os.environ["VALIDATE_RUN"])
selection_mode = os.environ["SELECTION_MODE"]

batch_json = root / batch_run / "openpra_package_recovery_batch_rollup_v1.json"
batch_txt = root / batch_run / "openpra_package_recovery_batch_rollup_v1.txt"
validate_json = root / validate_run / "validation_rollup.json"
validate_txt = root / validate_run / "validation_rollup.txt"

if not batch_json.exists():
    raise SystemExit(f"Missing batch rollup json: {batch_json}")
if not validate_json.exists():
    raise SystemExit(f"Missing validation rollup json: {validate_json}")

shutil.copy2(batch_json, outdir / "openpra_package_recovery_batch_rollup_v1.json")
if batch_txt.exists():
    shutil.copy2(batch_txt, outdir / "openpra_package_recovery_batch_rollup_v1.txt")
shutil.copy2(validate_json, outdir / "validation_rollup.json")
if validate_txt.exists():
    shutil.copy2(validate_txt, outdir / "validation_rollup.txt")

batch = json.loads(batch_json.read_text(encoding="utf-8"))
validate = json.loads(validate_json.read_text(encoding="utf-8"))

summary = {
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "scriptVersion": "openpra-phase5-package-final-integration-tranche-v1",
    "batchRoot": str(batch_root),
    "selectionMode": selection_mode,
    "batchRun": str(batch_run),
    "validateRun": str(validate_run),
    "packageBatchRollupPath": str(batch_json),
    "semanticValidationPath": str(validate_json),
    "caseCount": batch["caseCount"],
    "exactHardwareRecoveryCaseCount": batch["exactHardwareRecoveryCaseCount"],
    "unionSensitivityRecoveryCaseCount": batch["unionSensitivityRecoveryCaseCount"],
    "operatorAttentionRequiredCaseCount": batch["operatorAttentionRequiredCaseCount"],
    "allCasesSemanticParityMatch": validate["allCasesSemanticParityMatch"],
    "allCasesStructuralMatchIgnoringGeneratedAt": validate["allCasesStructuralMatchIgnoringGeneratedAt"],
    "cases": batch["cases"],
}

summary_json = outdir / "final_integration_summary.json"
summary_txt = outdir / "final_integration_summary.txt"

summary_json.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

lines = []
lines.append("OpenPRA Phase 5 final package integration tranche")
lines.append("")
lines.append(f"generated_at: {summary['generatedAt']}")
lines.append(f"batch_root: {summary['batchRoot']}")
lines.append(f"selection_mode: {summary['selectionMode']}")
lines.append(f"case_count: {summary['caseCount']}")
lines.append(f"exact_hardware_recovery_case_count: {summary['exactHardwareRecoveryCaseCount']}")
lines.append(f"union_sensitivity_recovery_case_count: {summary['unionSensitivityRecoveryCaseCount']}")
lines.append(f"operator_attention_required_case_count: {summary['operatorAttentionRequiredCaseCount']}")
lines.append(f"all_cases_semantic_parity_match: {summary['allCasesSemanticParityMatch']}")
lines.append(f"all_cases_structural_match_ignoring_generated_at: {summary['allCasesStructuralMatchIgnoringGeneratedAt']}")
lines.append("")
for row in summary["cases"]:
    lines.append(
        f"{row['label']}  model={row['modelId']}  primary_mode={row['primaryMode']}  "
        f"tier1={row['tier1RecoveredExactCutSetCount']}/{row['referenceCutSetCount']}  "
        f"union={row['unionRecoveredCount']}/{row['referenceCutSetCount']}  "
        f"attention={row['requiresOperatorAttention']}"
    )
lines.append("")
summary_txt.write_text("\n".join(lines), encoding="utf-8")

files = []
for path in sorted(outdir.rglob("*")):
    if path.is_file():
        files.append(path)

def sha256(p: pathlib.Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()

sha_lines = []
manifest = {}
for file_path in files:
    rel = file_path.relative_to(outdir).as_posix()
    digest = sha256(file_path)
    sha_lines.append(f"{digest}  {rel}")
    manifest[rel] = digest

sha_path = outdir / "SHA256SUMS.txt"
sha_path.write_text("\n".join(sha_lines) + "\n", encoding="utf-8")
manifest["SHA256SUMS.txt"] = sha256(sha_path)

(outdir / "00_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
PY

echo ""
echo "FINAL_OUTDIR=${OUTDIR}"
echo ""
echo "===== FINAL INTEGRATION SUMMARY TXT ====="
sed -n '1,220p' "${OUTDIR}/final_integration_summary.txt"
echo ""
echo "===== FINAL INTEGRATION SUMMARY JSON ====="
sed -n '1,260p' "${OUTDIR}/final_integration_summary.json"
