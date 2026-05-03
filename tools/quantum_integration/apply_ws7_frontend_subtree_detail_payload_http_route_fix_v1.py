#!/usr/bin/env python3
from pathlib import Path

REPO_ROOT = Path.cwd()
CONTROLLER_PATH = REPO_ROOT / "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"

METHOD_BLOCK = '''
  @Get("frontend/subtree-detail-payload")
  getFrontendSubtreeDetailPayloadHttp(
    @Query("rootDirectoryPath") rootDirectoryPath: string,
    @Query("subtreeId") subtreeId?: string,
    @Query("caseLabel") caseLabel?: string,
    @Query("rootGateId") rootGateId?: string,
  ) {
    return this.quantumReadinessService.getFrontendSubtreeDetailPayload({
      rootDirectoryPath,
      subtreeId: subtreeId ?? null,
      caseLabel: caseLabel ?? null,
      rootGateId: rootGateId ?? null,
      scriptVersion: "quantumReadiness.controller.frontendSubtreeDetailPayload.http",
    });
  }

'''

GET_QUERY_IMPORT = 'import { Get, Query } from "@nestjs/common";'

def main() -> None:
    content = CONTROLLER_PATH.read_text(encoding="utf-8")

    if 'getFrontendSubtreeDetailPayloadHttp(' in content:
        print("HTTP route fix already present.")
        return

    if GET_QUERY_IMPORT not in content:
        import_anchor = 'from "@nestjs/common";'
        idx = content.find(import_anchor)
        if idx == -1:
            raise RuntimeError("Could not find Nest common import anchor in controller.")
        line_start = content.rfind("\n", 0, idx)
        if line_start == -1:
            line_start = 0
        else:
            line_start += 1
        content = content[:line_start] + GET_QUERY_IMPORT + "\n" + content[line_start:]

    markers = [
        "\n  private toHttpException(",
        "\n  private ",
        "\n}\n",
        "\n}\r\n",
    ]

    inserted = False
    for marker in markers:
        pos = content.rfind(marker)
        if pos != -1:
            content = content[:pos] + METHOD_BLOCK + content[pos:]
            inserted = True
            break

    if not inserted:
        raise RuntimeError("Could not find insertion marker in quantumReadiness.controller.ts")

    CONTROLLER_PATH.write_text(content, encoding="utf-8")
    print("Applied frontend subtree detail payload HTTP route fix successfully.")

if __name__ == "__main__":
    main()
