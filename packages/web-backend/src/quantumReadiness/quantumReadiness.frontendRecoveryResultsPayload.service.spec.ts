import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { QuantumReadinessService } from "./quantumReadiness.service";

function writeJson(rootDirectoryPath: string, relativePath: string, value: unknown): void {
  const targetPath = path.join(rootDirectoryPath, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(value, null, 2));
}

describe("QuantumReadinessService frontend recovery results payload", () => {
  it("returns the recovery results payload through the service method", () => {
    const rootDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-service-frontend-recovery-results-"));

    writeJson(rootDirectoryPath, "recovery/openpra_recovery_ladder_result_v1.json", {
      caseLabel: "phase2b_row_0698",
      subtreeId: "phase2b_row_0698",
      rootGateId: "G:G348",
      primaryMode: "union_sensitivity_recovery",
      requiresOperatorAttention: false,
      exactReferenceCutSetCount: 2,
      tier1RecoveredExactCutSetCount: 1,
      unionRecoveredCount: 2,
      unionAllRecovered: true,
    });

    const result = QuantumReadinessService.prototype.getFrontendRecoveryResultsPayload.call(
      {} as QuantumReadinessService,
      {
        rootDirectoryPath,
        subtreeId: "phase2b_row_0698",
        scriptVersion: "quantumReadiness.frontendRecoveryResultsPayload.service.spec",
      },
    );

    expect(result.target.subtreeId).toBe("phase2b_row_0698");
    expect(result.summary.primaryMode).toBe("union_sensitivity_recovery");
    expect(result.summary.unionAllRecovered).toBe(true);
  });
});
