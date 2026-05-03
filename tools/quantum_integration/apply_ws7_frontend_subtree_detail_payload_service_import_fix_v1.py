#!/usr/bin/env python3
from pathlib import Path

REPO_ROOT = Path.cwd()
SERVICE_PATH = REPO_ROOT / "packages/web-backend/src/quantumReadiness/quantumReadiness.service.ts"

BAD_BLOCK = '''import {
  buildOpenPraQuantumFrontendSubtreeDetailPayload,
  OpenPraQuantumFrontendSubtreeDetailPayloadRequest,
  OpenPraQuantumFrontendSubtreeDetailPayloadResult,
} from "@openpra/quantum-readiness";
'''

GOOD_BLOCK = '''import {
  buildOpenPraQuantumFrontendSubtreeDetailPayload,
  OpenPraQuantumFrontendSubtreeDetailPayloadRequest,
  OpenPraQuantumFrontendSubtreeDetailPayloadResult,
} from "../../../quantum-readiness/src/index";
'''

def main() -> None:
    content = SERVICE_PATH.read_text(encoding="utf-8")

    if GOOD_BLOCK in content:
        print("Service import already fixed.")
        return

    if BAD_BLOCK in content:
        updated = content.replace(BAD_BLOCK, GOOD_BLOCK)
        SERVICE_PATH.write_text(updated, encoding="utf-8")
        print("Applied service import fix successfully.")
        return

    if '@openpra/quantum-readiness' in content:
        updated = content.replace('@openpra/quantum-readiness', '../../../quantum-readiness/src/index')
        SERVICE_PATH.write_text(updated, encoding="utf-8")
        print("Applied fallback service import fix successfully.")
        return

    raise RuntimeError("Did not find expected subtree detail payload import block in quantumReadiness.service.ts")

if __name__ == "__main__":
    main()
