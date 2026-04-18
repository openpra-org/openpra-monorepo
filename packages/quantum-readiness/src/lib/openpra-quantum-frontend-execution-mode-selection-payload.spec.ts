import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { buildOpenPraQuantumFrontendExecutionModeSelectionPayload } from "./openpra-quantum-frontend-execution-mode-selection-payload";

function writeJson(rootDirectoryPath: string, relativePath: string, value: unknown): void {
  const targetPath = path.join(rootDirectoryPath, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(value, null, 2));
}

describe("buildOpenPraQuantumFrontendExecutionModeSelectionPayload", () => {
  it("builds a recommended execution mode selection payload", () => {
    const rootDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-execution-mode-selection-"));

    writeJson(rootDirectoryPath, "prep/preparation_artifact_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      topologyClass: "C",
      basicEventCount: 8,
      requiredQubits: 8,
      backendEligibility: {
        eligibleBackendNames: ["ibm_marrakesh", "ibm_torino"],
      },
      statevectorVerification: {
        pass: true,
      },
    });

    writeJson(rootDirectoryPath, "provider/provider_execution_request_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      providerName: "ibm",
      backendName: "ibm_marrakesh",
      jobId: "job-0905",
      status: "submitted",
      shots: 8192,
      resilienceLevel: 0,
    });

    writeJson(rootDirectoryPath, "recovery/recovery_result_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      primaryMode: "union_sensitivity_recovery",
      requiresOperatorAttention: true,
    });

    const result = buildOpenPraQuantumFrontendExecutionModeSelectionPayload({
      rootDirectoryPath,
      subtreeId: "phase2b_row_0905",
      scriptVersion: "quantum-readiness.frontendExecutionModeSelectionPayload.spec",
    });

    expect(result.target.subtreeId).toBe("phase2b_row_0905");
    expect(result.summary.topologyClass).toBe("C");
    expect(result.summary.recommendedMode).toBe("hardware");
    expect(result.summary.currentMode).toBe("hardware");
    expect(result.summary.providerBackendName).toBe("ibm_marrakesh");
    expect(result.summary.statevectorVerified).toBe(true);
    expect(result.guardrails.eligibleBackendNames).toEqual(["ibm_marrakesh", "ibm_torino"]);
    expect(result.guardrails.requiresOperatorAttention).toBe(true);
    expect(result.guardrails.unionSensitivityObserved).toBe(true);
    expect(result.modes.hardware.available).toBe(true);
    expect(result.selection.submissionEnabled).toBe(true);
    expect(result.provenance.matchedArtifactPaths.length).toBe(3);
  });

  it("throws when the root directory path is missing", () => {
    expect(() =>
      buildOpenPraQuantumFrontendExecutionModeSelectionPayload({
        rootDirectoryPath: "",
      }),
    ).toThrow("rootDirectoryPath is required.");
  });
});
