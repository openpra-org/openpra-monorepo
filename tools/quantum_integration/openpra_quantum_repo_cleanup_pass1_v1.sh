#!/usr/bin/env bash
set -euo pipefail

SCRIPT_VERSION="1.0.0"
UTC_NOW="$(date -u +"%Y%m%d_%H%M%SZ")"
UTC_ISO="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${REPO_ROOT}" ]]; then
  echo "ERROR: This script must be run inside the OpenPRA git repository."
  exit 1
fi

cd "${REPO_ROOT}"

LATEST_BASELINE="$(ls -td artifacts/quantum_integration/baseline_freeze_* 2>/dev/null | head -n 1 || true)"
if [[ -z "${LATEST_BASELINE}" ]]; then
  echo "ERROR: No baseline_freeze directory found under artifacts/quantum_integration."
  exit 1
fi

INVENTORY_FILE="${LATEST_BASELINE}/candidate_research_script_inventory.txt"
if [[ ! -f "${INVENTORY_FILE}" ]]; then
  echo "ERROR: Inventory file not found: ${INVENTORY_FILE}"
  exit 1
fi

PHASE4_DIR="tools/quantum_research_scripts/phase4"
PHASE5_DIR="tools/quantum_research_scripts/phase5"
MISC_DIR="tools/quantum_research_scripts/misc"
REPORT_DIR="artifacts/quantum_integration/repo_cleanup_pass1_${UTC_NOW}"
QUARANTINE_DIR="_work/quarantine_bad_literal_names_${UTC_NOW}"
GITIGNORE_FILE=".gitignore"

mkdir -p "${PHASE4_DIR}" "${PHASE5_DIR}" "${MISC_DIR}" "${REPORT_DIR}" "${QUARANTINE_DIR}"

backup_if_exists() {
  local target="$1"
  if [[ -f "${target}" ]]; then
    cp -p "${target}" "${target}.bak.${UTC_NOW}"
  fi
}

classify_dest_dir() {
  local base="$1"
  local lower
  lower="$(printf "%s" "${base}" | tr '[:upper:]' '[:lower:]')"
  if [[ "${lower}" == *phase5* ]]; then
    printf "%s\n" "${PHASE5_DIR}"
  elif [[ "${lower}" == *phase4* ]]; then
    printf "%s\n" "${PHASE4_DIR}"
  else
    printf "%s\n" "${MISC_DIR}"
  fi
}

echo "==> Moving inventoried research era scripts"
RELOCATION_TSV="${REPORT_DIR}/research_script_relocation_map.tsv"
MOVED_LIST="${REPORT_DIR}/moved_files.txt"
SKIPPED_LIST="${REPORT_DIR}/skipped_files.txt"
: > "${RELOCATION_TSV}"
: > "${MOVED_LIST}"
: > "${SKIPPED_LIST}"

printf "source_path\tdestination_path\tstatus\n" >> "${RELOCATION_TSV}"

while IFS= read -r line; do
  [[ -z "${line}" ]] && continue
  [[ "${line}" =~ ^# ]] && continue

  src="${line}"
  if [[ ! -e "${src}" ]]; then
    printf "%s\t%s\tmissing_source\n" "${src}" "" >> "${RELOCATION_TSV}"
    printf "%s\n" "${src}" >> "${SKIPPED_LIST}"
    continue
  fi

  base="$(basename "${src}")"
  dest_dir="$(classify_dest_dir "${base}")"
  dest="${dest_dir}/${base}"

  if [[ -e "${dest}" ]]; then
    printf "%s\t%s\tdestination_exists\n" "${src}" "${dest}" >> "${RELOCATION_TSV}"
    printf "%s\n" "${src}" >> "${SKIPPED_LIST}"
    continue
  fi

  mv "${src}" "${dest}"
  printf "%s\t%s\tmoved\n" "${src}" "${dest}" >> "${RELOCATION_TSV}"
  printf "%s\n" "${dest}" >> "${MOVED_LIST}"
done < "${INVENTORY_FILE}"

echo "==> Quarantining bad literal filenames if present"
QUARANTINE_REPORT="${REPORT_DIR}/quarantined_literal_name_items.txt"
: > "${QUARANTINE_REPORT}"

for bad_name in '${MAP_CSV}' '${MAP_SUMMARY}'; do
  if [[ -e "${bad_name}" ]]; then
    mv "${bad_name}" "${QUARANTINE_DIR}/"
    printf "%s -> %s/\n" "${bad_name}" "${QUARANTINE_DIR}" >> "${QUARANTINE_REPORT}"
  fi
done

echo "==> Adding managed ignore block"
backup_if_exists "${GITIGNORE_FILE}"
touch "${GITIGNORE_FILE}"

python3 - <<'PY' "${GITIGNORE_FILE}"
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8") if path.exists() else ""

start = "# BEGIN OPENPRA QUANTUM INTEGRATION MANAGED BLOCK"
end = "# END OPENPRA QUANTUM INTEGRATION MANAGED BLOCK"

block = """# BEGIN OPENPRA QUANTUM INTEGRATION MANAGED BLOCK
# Generated scratch and environment paths for OpenPRA quantum integration work
.venv_phase4_qiskit/
_work/
artifacts/quantum_integration/
# END OPENPRA QUANTUM INTEGRATION MANAGED BLOCK
"""

if start in text and end in text:
    pre = text.split(start)[0].rstrip()
    post = text.split(end, 1)[1].lstrip("\n")
    new_text = (pre + "\n\n" + block + ("\n" + post if post else "\n")).rstrip() + "\n"
else:
    new_text = text.rstrip() + ("\n\n" if text.strip() else "") + block
    new_text = new_text.rstrip() + "\n"

path.write_text(new_text, encoding="utf-8")
PY

echo "==> Removing empty scripts directory subpaths if possible"
find scripts -type d -empty -print > "${REPORT_DIR}/empty_script_dirs_before_cleanup.txt" || true
find scripts -type d -empty -delete || true
find scripts -type d -empty -print > "${REPORT_DIR}/empty_script_dirs_after_cleanup.txt" || true

echo "==> Capturing post-cleanup status"
git status --short > "${REPORT_DIR}/git_status_short_after_cleanup.txt"
git diff --stat > "${REPORT_DIR}/git_diff_stat_after_cleanup.txt" || true

echo "==> Writing summary"
SUMMARY_FILE="${REPORT_DIR}/repo_cleanup_pass1_summary.txt"
cat > "${SUMMARY_FILE}" <<EOF
OpenPRA quantum repo cleanup pass 1 completed.

scriptVersion: ${SCRIPT_VERSION}
createdAtUtc: ${UTC_ISO}
repositoryRoot: ${REPO_ROOT}
baselineUsed: ${LATEST_BASELINE}

Primary actions:
- moved inventoried research era scripts out of scripts/ into tools/quantum_research_scripts/
- quarantined bad literal filenames if present
- added managed ignore block to .gitignore
- captured post-cleanup status

Outputs:
- relocation map: ${RELOCATION_TSV}
- moved files: ${MOVED_LIST}
- skipped files: ${SKIPPED_LIST}
- quarantine report: ${QUARANTINE_REPORT}
- status short: ${REPORT_DIR}/git_status_short_after_cleanup.txt
- diff stat: ${REPORT_DIR}/git_diff_stat_after_cleanup.txt
EOF

echo
echo "DONE"
echo "Report directory: ${REPORT_DIR}"
echo "Relocation map: ${RELOCATION_TSV}"
echo "Moved files list: ${MOVED_LIST}"
echo "Skipped files list: ${SKIPPED_LIST}"
echo "Quarantine report: ${QUARANTINE_REPORT}"
echo "Status short: ${REPORT_DIR}/git_status_short_after_cleanup.txt"
echo
echo "This pass only reorganizes research era scripts and scratch paths. It does not modify package or backend source files."
