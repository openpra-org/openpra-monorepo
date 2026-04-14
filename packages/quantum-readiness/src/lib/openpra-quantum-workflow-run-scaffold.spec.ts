import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildOpenpraQuantumWorkflowRunScaffold } from "./openpra-quantum-workflow-run-scaffold";

describe("openpra-quantum-workflow-run-scaffold", () => {
  it("creates a workflow run directory tree and manifest", () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-workflow-run-root-"));

    const result = buildOpenpraQuantumWorkflowRunScaffold({
      rootDir,
      modelId: "phase2b_row_0001",
      subtreeId: "TOP",
      workflowKind: "full_pipeline",
      requestedBy: "jest:test",
      notes: ["proof"],
    });

    expect(fs.existsSync(result.workflowRunDir)).toBe(true);
    expect(fs.existsSync(result.manifestPath)).toBe(true);
    expect(fs.existsSync(result.directories.artifacts)).toBe(true);
    expect(fs.existsSync(result.directories.preparation)).toBe(true);
    expect(fs.existsSync(result.directories.execution)).toBe(true);
    expect(fs.existsSync(result.directories.recovery)).toBe(true);
    expect(fs.existsSync(result.directories.batch)).toBe(true);
    expect(fs.existsSync(result.directories.logs)).toBe(true);
  });
});
