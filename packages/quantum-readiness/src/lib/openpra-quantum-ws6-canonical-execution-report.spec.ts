import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createOpenPraQuantumProviderExecutionRequest } from "./openpra-quantum-provider-request-contract";
import { persistOpenPraQuantumProviderExecutionRequest } from "./openpra-quantum-provider-request-store";
import { submitOpenPraQuantumProviderBridgeRequest } from "./openpra-quantum-provider-bridge-scaffold";
import { completeOpenPraQuantumProviderBridgeSubmission } from "./openpra-quantum-provider-bridge-completion";
import {
  buildOpenPraQuantumWs6CanonicalExecutionReport,
  loadLatestOpenPraQuantumWs6CanonicalExecutionReport,
} from "./openpra-quantum-ws6-canonical-execution-report";

describe("openpra-quantum-ws6-canonical-execution-report", () => {
  it("builds and loads the WS6 canonical execution report", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws6-canonical-report-"));
    const providerRequestRoot = path.join(tempDir, "provider_requests");
    const executionArtifactsRoot = path.join(tempDir, "execution_artifacts");
    const reportRoot = path.join(tempDir, "report");

    for (const entry of [
      {
        requestId: "provider-request-0698",
        subtreeId: "G:G348",
        caseLabel: "phase2b_row_0698__G_G348",
      },
      {
        requestId: "provider-request-0905",
        subtreeId: "G:G939",
        caseLabel: "phase2b_row_0905__G_G939",
      },
    ]) {
      const providerRequest = createOpenPraQuantumProviderExecutionRequest({
        requestId: entry.requestId,
        subtreeId: entry.subtreeId,
        caseLabel: entry.caseLabel,
        providerName: "ibm_runtime",
        backendName: "ibm_torino",
        shots: 8192,
        resilienceLevel: 0,
        createdAtUtc: "2026-04-17T17:03:17.743Z",
        notes: "WS6 canonical execution report request",
      });

      persistOpenPraQuantumProviderExecutionRequest({
        rootDirectoryPath: providerRequestRoot,
        request: providerRequest,
        inputArtifactPaths: [],
        scriptVersion: "openpra-quantum-ws6-canonical-execution-report.spec",
      });

      submitOpenPraQuantumProviderBridgeRequest({
        providerRequestRootDirectoryPath: providerRequestRoot,
        executionArtifactsRootDirectoryPath: executionArtifactsRoot,
        caseLabel: entry.caseLabel,
        scriptVersion: "openpra-quantum-ws6-canonical-execution-report.spec",
      });

      completeOpenPraQuantumProviderBridgeSubmission({
        executionArtifactsRootDirectoryPath: executionArtifactsRoot,
        caseLabel: entry.caseLabel,
        rawCountsArtifactPath: `/raw-counts/${entry.caseLabel}.json`,
        recoveryArtifactPath: `/recovery/${entry.caseLabel}.json`,
        completedAtUtc: "2026-04-17T17:05:00.000Z",
        failureReason: null,
        scriptVersion: "openpra-quantum-ws6-canonical-execution-report.spec",
      });
    }

    const built = buildOpenPraQuantumWs6CanonicalExecutionReport({
      rootDirectoryPath: reportRoot,
      sourceExecutionArtifactsRootDirectoryPath: executionArtifactsRoot,
      scriptVersion: "openpra-quantum-ws6-canonical-execution-report.spec",
    });

    expect(built.summary.totalCases).toBe(2);
    expect(built.summary.completedCount).toBe(2);
    expect(built.summary.allCompleted).toBe(true);
    expect(fs.existsSync(built.summaryPath)).toBe(true);
    expect(fs.existsSync(built.manifestPath)).toBe(true);

    const loaded = loadLatestOpenPraQuantumWs6CanonicalExecutionReport({
      rootDirectoryPath: reportRoot,
    });

    expect(loaded.summary.caseLabels).toEqual(["phase2b_row_0698__G_G348", "phase2b_row_0905__G_G939"]);
    expect(loaded.summary.topologyCounts).toEqual({ A: 1, C: 1 });
  });
});
