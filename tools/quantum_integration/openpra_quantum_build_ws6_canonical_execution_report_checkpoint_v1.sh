#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
OUT_ROOT="$REPO_ROOT/_work/openpra_quantum_ws6_canonical_execution_report_checkpoint_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
RUN_DIR="$OUT_ROOT/OPENPRA_QUANTUM_WS6_CANONICAL_EXECUTION_REPORT_CHECKPOINT_v1_${STAMP}"
TAR_PATH="${RUN_DIR}.tar.gz"
SHA_PATH="${TAR_PATH}.sha256"

mkdir -p "$RUN_DIR"/{package_specs,backend_specs,http_tests,notes}

cp -a "$REPO_ROOT/packages/quantum-readiness/src/lib/openpra-quantum-ws6-canonical-execution-report.spec.ts" "$RUN_DIR/package_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.ws6CanonicalExecutionReport.service.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.ws6CanonicalExecutionReport.controller.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/tests/quantumReadiness.ws6CanonicalExecutionReport.http.spec.ts" "$RUN_DIR/http_tests/"

COMMIT_HASH="$(git -C "$REPO_ROOT" rev-parse HEAD)"
BRANCH_NAME="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"

python3 - <<'PY' "$RUN_DIR" "$COMMIT_HASH" "$BRANCH_NAME"
from pathlib import Path
import json
import sys
from datetime import datetime, timezone

run_dir = Path(sys.argv[1])
commit_hash = sys.argv[2]
branch_name = sys.argv[3]

summary = {
    "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
    "checkpointName": "OPENPRA_QUANTUM_WS6_CANONICAL_EXECUTION_REPORT_CHECKPOINT_v1",
    "branch": branch_name,
    "commit": commit_hash,
    "routesCovered": [
        "/execution/provider-bridge/canonical-report",
        "/execution/provider-bridge/canonical-report/load-latest",
    ],
    "interpretation": (
        "Chunk J adds the canonical WS6 execution report for the locked acceptance "
        "pair and exposes report generation and loading through the backend."
    ),
}

(run_dir / "notes" / "openpra_quantum_ws6_canonical_execution_report_checkpoint_summary_v1.json").write_text(
    json.dumps(summary, indent=2) + "\n",
    encoding="utf-8",
)

memo = f"""OpenPRA Quantum WS6 Canonical Execution Report Checkpoint Memo v1

Generated at UTC: {summary["generatedAtUtc"]}
Branch: {summary["branch"]}
Commit: {summary["commit"]}

Routes covered
- /execution/provider-bridge/canonical-report
- /execution/provider-bridge/canonical-report/load-latest

Interpretation
{summary["interpretation"]}
"""

(run_dir / "notes" / "OPENPRA_QUANTUM_WS6_CANONICAL_EXECUTION_REPORT_CHECKPOINT_MEMO_v1.txt").write_text(
    memo,
    encoding="utf-8",
)
PY

tar -C "$OUT_ROOT" -czf "$TAR_PATH" "$(basename "$RUN_DIR")"
sha256sum "$TAR_PATH" > "$SHA_PATH"

echo "$RUN_DIR"
echo "$TAR_PATH"
echo "$SHA_PATH"
