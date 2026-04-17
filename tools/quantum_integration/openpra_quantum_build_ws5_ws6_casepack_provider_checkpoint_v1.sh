#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
OUT_ROOT="$REPO_ROOT/_work/openpra_quantum_ws5_ws6_casepack_provider_checkpoint_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
RUN_DIR="$OUT_ROOT/OPENPRA_QUANTUM_WS5_WS6_CASEPACK_PROVIDER_CHECKPOINT_v1_${STAMP}"
TAR_PATH="${RUN_DIR}.tar.gz"
SHA_PATH="${TAR_PATH}.sha256"

mkdir -p "$RUN_DIR"/{package_specs,backend_specs,http_tests,notes}

cp -a "$REPO_ROOT/packages/quantum-readiness/src/lib/openpra-quantum-canonical-case-pack.spec.ts" "$RUN_DIR/package_specs/"
cp -a "$REPO_ROOT/packages/quantum-readiness/src/lib/openpra-quantum-provider-request-store.spec.ts" "$RUN_DIR/package_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.casePackProvider.service.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/src/quantumReadiness/quantumReadiness.casePackProvider.controller.spec.ts" "$RUN_DIR/backend_specs/"
cp -a "$REPO_ROOT/packages/web-backend/tests/quantumReadiness.canonicalCasePack.http.spec.ts" "$RUN_DIR/http_tests/"
cp -a "$REPO_ROOT/packages/web-backend/tests/quantumReadiness.providerRequest.http.spec.ts" "$RUN_DIR/http_tests/"

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
    "checkpointName": "OPENPRA_QUANTUM_WS5_WS6_CASEPACK_PROVIDER_CHECKPOINT_v1",
    "branch": branch_name,
    "commit": commit_hash,
    "routesCovered": [
        "/canonical-case-pack/summary",
        "/execution/provider-request",
        "/execution/provider-request/load-latest",
    ],
    "interpretation": (
        "Chunk E adds canonical case pack foundation and provider request persistence "
        "for the next WS5 and WS6 implementation stage."
    ),
}

(run_dir / "notes" / "openpra_quantum_ws5_ws6_casepack_provider_checkpoint_summary_v1.json").write_text(
    json.dumps(summary, indent=2) + "\n",
    encoding="utf-8",
)

memo = f"""OpenPRA Quantum WS5 WS6 Case Pack Provider Checkpoint Memo v1

Generated at UTC: {summary["generatedAtUtc"]}
Branch: {summary["branch"]}
Commit: {summary["commit"]}

Routes covered
- /canonical-case-pack/summary
- /execution/provider-request
- /execution/provider-request/load-latest

Interpretation
{summary["interpretation"]}
"""

(run_dir / "notes" / "OPENPRA_QUANTUM_WS5_WS6_CASEPACK_PROVIDER_CHECKPOINT_MEMO_v1.txt").write_text(
    memo,
    encoding="utf-8",
)
PY

tar -C "$OUT_ROOT" -czf "$TAR_PATH" "$(basename "$RUN_DIR")"
sha256sum "$TAR_PATH" > "$SHA_PATH"

echo "$RUN_DIR"
echo "$TAR_PATH"
echo "$SHA_PATH"
