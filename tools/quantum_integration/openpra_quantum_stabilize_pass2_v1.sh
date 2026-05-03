#!/usr/bin/env bash
set -euo pipefail

SCRIPT_VERSION="1.0.1"
UTC_NOW="$(date -u +"%Y%m%d_%H%M%SZ")"
UTC_ISO="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${REPO_ROOT}" ]]; then
  echo "ERROR: This script must be run inside the OpenPRA git repository."
  exit 1
fi

cd "${REPO_ROOT}"

REPORT_DIR="artifacts/quantum_integration/stabilize_pass2_${UTC_NOW}"
mkdir -p "${REPORT_DIR}"

detect_nx_runner() {
  if [[ -x "./node_modules/.bin/nx" ]]; then
    printf "%s\n" "./node_modules/.bin/nx"
    return 0
  fi

  if command -v npx >/dev/null 2>&1; then
    if npx --no-install nx --version >/dev/null 2>&1; then
      printf "%s\n" "npx --no-install nx"
      return 0
    fi
  fi

  return 1
}

run_with_log() {
  local label="$1"
  local command_string="$2"
  local log_file="$3"
  local status_file="$4"

  if bash -lc "${command_string}" > "${log_file}" 2>&1; then
    echo "PASS" > "${status_file}"
  else
    echo "FAIL" > "${status_file}"
  fi

  {
    echo "===== ${label} ====="
    echo "Command: ${command_string}"
    echo
    cat "${log_file}"
  } > "${log_file}.wrapped"
  mv "${log_file}.wrapped" "${log_file}"
}

echo "==> Capturing environment diagnostics"
{
  echo "scriptVersion=${SCRIPT_VERSION}"
  echo "createdAtUtc=${UTC_ISO}"
  echo "repoRoot=${REPO_ROOT}"
  echo "pwd=$(pwd)"
  echo
  echo "[node]"
  if command -v node >/dev/null 2>&1; then
    command -v node
    node --version
  else
    echo "node not found"
  fi
  echo
  echo "[npm]"
  if command -v npm >/dev/null 2>&1; then
    command -v npm
    npm --version
  else
    echo "npm not found"
  fi
  echo
  echo "[npx]"
  if command -v npx >/dev/null 2>&1; then
    command -v npx
    npx --version
  else
    echo "npx not found"
  fi
  echo
  echo "[pnpm command presence only]"
  if command -v pnpm >/dev/null 2>&1; then
    command -v pnpm
  else
    echo "pnpm not found"
  fi
  echo
  echo "[yarn command presence only]"
  if command -v yarn >/dev/null 2>&1; then
    command -v yarn
  else
    echo "yarn not found"
  fi
  echo
  echo "[local nx]"
  if [[ -x "./node_modules/.bin/nx" ]]; then
    echo "./node_modules/.bin/nx exists"
    ./node_modules/.bin/nx --version || true
  else
    echo "local nx binary not found"
  fi
  echo
  echo "[npx no install nx]"
  if command -v npx >/dev/null 2>&1; then
    if npx --no-install nx --version >/dev/null 2>&1; then
      echo "npx --no-install nx is usable"
      npx --no-install nx --version || true
    else
      echo "npx --no-install nx not usable"
    fi
  else
    echo "npx not found"
  fi
  echo
  echo "[node_modules]"
  if [[ -d "./node_modules" ]]; then
    echo "node_modules present"
  else
    echo "node_modules missing"
  fi
} > "${REPORT_DIR}/environment_diagnostics.txt"

echo "==> Detecting nx runner"
NX_RUNNER="$(detect_nx_runner || true)"
if [[ -z "${NX_RUNNER}" ]]; then
  echo "NO_NX_RUNNER" > "${REPORT_DIR}/nx_runner.txt"
  cat > "${REPORT_DIR}/stabilize_pass2_summary.txt" <<EOF
OpenPRA quantum stabilization pass 2 completed.

scriptVersion: ${SCRIPT_VERSION}
createdAtUtc: ${UTC_ISO}
repositoryRoot: ${REPO_ROOT}

Result:
- no usable nx runner detected without network side effects

See:
- ${REPORT_DIR}/environment_diagnostics.txt
EOF

  echo
  echo "DONE"
  echo "No usable nx runner detected without network side effects."
  echo "See: ${REPORT_DIR}/environment_diagnostics.txt"
  exit 0
fi

printf "%s\n" "${NX_RUNNER}" > "${REPORT_DIR}/nx_runner.txt"

echo "==> Running quantum-readiness tests"
run_with_log \
  "nx test quantum-readiness" \
  "${NX_RUNNER} test quantum-readiness" \
  "${REPORT_DIR}/nx_test_quantum_readiness.log" \
  "${REPORT_DIR}/nx_test_quantum_readiness.status"

echo "==> Running web-backend tests"
run_with_log \
  "nx test web-backend" \
  "${NX_RUNNER} test web-backend" \
  "${REPORT_DIR}/nx_test_web_backend.log" \
  "${REPORT_DIR}/nx_test_web_backend.status"

echo "==> Running quantum-readiness build"
run_with_log \
  "nx build quantum-readiness" \
  "${NX_RUNNER} build quantum-readiness" \
  "${REPORT_DIR}/nx_build_quantum_readiness.log" \
  "${REPORT_DIR}/nx_build_quantum_readiness.status"

echo "==> Capturing git status after stabilization pass 2"
git status --short > "${REPORT_DIR}/git_status_short_after_stabilize_pass2.txt"
git diff --stat > "${REPORT_DIR}/git_diff_stat_after_stabilize_pass2.txt" || true

echo "==> Writing summary"
cat > "${REPORT_DIR}/stabilize_pass2_summary.txt" <<EOF
OpenPRA quantum stabilization pass 2 completed.

scriptVersion: ${SCRIPT_VERSION}
createdAtUtc: ${UTC_ISO}
repositoryRoot: ${REPO_ROOT}
nxRunner: ${NX_RUNNER}

Outputs:
- ${REPORT_DIR}/environment_diagnostics.txt
- ${REPORT_DIR}/nx_runner.txt
- ${REPORT_DIR}/nx_test_quantum_readiness.status
- ${REPORT_DIR}/nx_test_quantum_readiness.log
- ${REPORT_DIR}/nx_test_web_backend.status
- ${REPORT_DIR}/nx_test_web_backend.log
- ${REPORT_DIR}/nx_build_quantum_readiness.status
- ${REPORT_DIR}/nx_build_quantum_readiness.log
- ${REPORT_DIR}/git_status_short_after_stabilize_pass2.txt
EOF

echo
echo "DONE"
echo "Report directory: ${REPORT_DIR}"
echo "Nx runner: ${NX_RUNNER}"
echo "Quantum-readiness test status: $(cat "${REPORT_DIR}/nx_test_quantum_readiness.status")"
echo "Web-backend test status: $(cat "${REPORT_DIR}/nx_test_web_backend.status")"
echo "Quantum-readiness build status: $(cat "${REPORT_DIR}/nx_build_quantum_readiness.status")"
