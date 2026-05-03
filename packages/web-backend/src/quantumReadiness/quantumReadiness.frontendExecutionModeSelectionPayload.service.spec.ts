import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { QuantumReadinessService } from "./quantumReadiness.service";

function writeJson(rootDirectoryPath: string, relativePath: string, value: unknown): void {
  const targetPath = path.join(rootDirectoryPath, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(value, null, 2));
}

describe("QuantumReadinessService frontend execution mode selection payload", () => {
  it("returns the execution mode selection payload through the service method", () => {
    const rootDirectoryPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "openpra-service-frontend-execution-mode-selection-"),
    );

    writeJson(rootDirectoryPath, "prep/preparation_artifact_v1.json", {
      caseLabel: "phase2b_row_0698",
      subtreeId: "phase2b_row_0698",
      rootGateId: "G:G348",
      topologyClass: "A",
      basicEventCount: 5,
      requiredQubits: 5,
      backendEligibility: {
        eligibleBackendNames: ["ibm_marrakesh"],
      },
      statevectorVerification: {
        pass: true,
      },
    });

    const result = QuantumReadinessService.prototype.getFrontendExecutionModeSelectionPayload.call(
      {} as QuantumReadinessService,
      {
        rootDirectoryPath,
        subtreeId: "phase2b_row_0698",
        scriptVersion: "quantumReadiness.frontendExecutionModeSelectionPayload.service.spec",
      },
    );

    expect(result.target.subtreeId).toBe("phase2b_row_0698");
    expect(result.summary.recommendedMode).toBe("hardware");
    expect(result.modes.hardware.available).toBe(true);
  });
});
