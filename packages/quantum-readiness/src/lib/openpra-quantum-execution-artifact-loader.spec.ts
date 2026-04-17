import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildOpenPraQuantumExecutionRecordServiceStub } from "./openpra-quantum-execution-record-service-stub";
import { loadLatestOpenPraQuantumExecutionArtifacts } from "./openpra-quantum-execution-artifact-loader";

describe("openpra-quantum-execution-artifact-loader", () => {
  it("loads the latest execution artifacts by case label", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws6-loader-"));

    buildOpenPraQuantumExecutionRecordServiceStub({
      rootDirectoryPath: tempDir,
      executionRecord: {
        subtreeId: "G:G348",
        providerName: "ibm_runtime",
        backendName: "ibm_torino",
        jobId: "job-0698",
        shots: 8192,
        resilienceLevel: 0,
        status: "submitted",
        provenanceManifestPath: "/provenance/ws6/job-0698.json",
        submittedAtUtc: "2026-04-17T17:03:17.743Z",
        caseLabel: "phase2b_row_0698__G_G348",
      },
      executionResult: {
        jobId: "job-0698",
        status: "completed",
        rawCountsArtifactPath: "/raw-counts/phase2b_row_0698__G_G348.json",
        recoveryArtifactPath: "/recovery/phase2b_row_0698__G_G348.json",
        provenanceManifestPath: "/provenance/ws6/job-0698.json",
        completedAtUtc: "2026-04-17T17:05:00.000Z",
        failureReason: null,
      },
      inputArtifactPaths: [],
      scriptVersion: "execution-artifact-loader.spec",
    });

    const loaded = loadLatestOpenPraQuantumExecutionArtifacts({
      rootDirectoryPath: tempDir,
      caseLabel: "phase2b_row_0698__G_G348",
    });

    expect(loaded.executionRecord.caseLabel).toBe("phase2b_row_0698__G_G348");
    expect(loaded.executionResult?.status).toBe("completed");
    expect(fs.existsSync(loaded.executionRecordPath)).toBe(true);
    expect(fs.existsSync(loaded.provenanceManifestPath ?? "")).toBe(true);
  });
});
