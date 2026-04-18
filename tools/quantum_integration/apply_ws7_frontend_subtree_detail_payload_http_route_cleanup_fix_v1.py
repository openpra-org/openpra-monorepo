#!/usr/bin/env python3
from pathlib import Path
import re

REPO_ROOT = Path.cwd()
CONTROLLER_PATH = REPO_ROOT / "packages/web-backend/src/quantumReadiness/quantumReadiness.controller.ts"

CLEAN_METHOD_BLOCK = '''
  @Get("frontend/subtree-detail-payload")
  @Get("frontend/subtreeDetailPayload")
  @Get("frontendSubtreeDetailPayload")
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

def remove_existing_subtree_detail_route_noise(content: str) -> str:
    lines = content.splitlines()

    filtered = []
    skip_mode = False
    brace_depth = 0

    for line in lines:
        stripped = line.strip()

        if not skip_mode:
            if stripped == '@Get("frontend/subtree-detail-payload")':
                continue
            if stripped == '@Get("frontend/subtreeDetailPayload")':
                continue
            if stripped == '@Get("frontendSubtreeDetailPayload")':
                continue
            if "getFrontendSubtreeDetailPayloadHttp(" in stripped:
                skip_mode = True
                brace_depth = line.count("{") - line.count("}")
                continue

            filtered.append(line)
        else:
            brace_depth += line.count("{") - line.count("}")
            if brace_depth <= 0 and stripped == "}":
                skip_mode = False
            continue

    return "\n".join(filtered) + "\n"

def insert_clean_method(content: str) -> str:
    markers = [
        "\n  @Get(\"frontend/seed-state\")",
        "\n  getFrontendSeedState(",
        "\n  @Get(\"frontend/dashboard-payload\")",
        "\n  getFrontendDashboardPayload(",
        "\n  private toHttpException(",
        "\n  private ",
        "\n}\n",
        "\n}\r\n",
    ]

    for marker in markers:
        pos = content.find(marker)
        if pos != -1:
            return content[:pos] + CLEAN_METHOD_BLOCK + content[pos:]

    raise RuntimeError("Could not find safe insertion marker in quantumReadiness.controller.ts")

def main() -> None:
    content = CONTROLLER_PATH.read_text(encoding="utf-8")

    cleaned = remove_existing_subtree_detail_route_noise(content)
    updated = insert_clean_method(cleaned)

    CONTROLLER_PATH.write_text(updated, encoding="utf-8")
    print("Applied frontend subtree detail payload HTTP route cleanup fix successfully.")

if __name__ == "__main__":
    main()
