import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { buildOpenPraQuantumFrontendRecoveryResultsPayload } from "./openpra-quantum-frontend-recovery-results-payload";

function writeJson(rootDirectoryPath: string, relativePath: string, value: unknown): void {
  const targetPath = path.join(rootDirectoryPath, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(value, null, 2));
}

describe("buildOpenPraQuantumFrontendRecoveryResultsPayload", () => {
  it("builds a frontend recovery results payload", () => {
    const rootDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-recovery-results-"));

    writeJson(rootDirectoryPath, "prep/preparation_artifact_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      topologyClass: "C",
      basicEventCount: 8,
      requiredQubits: 8,
    });

    writeJson(rootDirectoryPath, "provider/provider_execution_request_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      backendName: "ibm_marrakesh",
      status: "completed",
    });

    writeJson(rootDirectoryPath, "recovery/openpra_recovery_ladder_result_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      primaryMode: "union_sensitivity_recovery",
      requiresOperatorAttention: true,
      exactReferenceCutSetCount: 4,
      tier1RecoveredExactCutSetCount: 3,
      unionRecoveredCount: 4,
      unionAllRecovered: true,
      nearMissAdvisoryCount: 1,
    });

    const result = buildOpenPraQuantumFrontendRecoveryResultsPayload({
      rootDirectoryPath,
      subtreeId: "phase2b_row_0905",
      scriptVersion: "quantum-readiness.frontendRecoveryResultsPayload.spec",
    });

    expect(result.target.subtreeId).toBe("phase2b_row_0905");
    expect(result.summary.topologyClass).toBe("C");
    expect(result.summary.providerBackendName).toBe("ibm_marrakesh");
    expect(result.summary.primaryMode).toBe("union_sensitivity_recovery");
    expect(result.summary.unionAllRecovered).toBe(true);
    expect(result.summary.recoveryCoverageFraction).toBe(1);
    expect(result.recovery?.nearMissAdvisoryCount).toBe(1);
    expect(result.guardrails.unionSensitivityObserved).toBe(true);
    expect(result.ladder.recommendation).toBe("review_required");
    expect(result.provenance.matchedArtifactPaths.length).toBe(3);
  });

  it("throws when the root directory path is missing", () => {
    expect(() =>
      buildOpenPraQuantumFrontendRecoveryResultsPayload({
        rootDirectoryPath: "",
      }),
    ).toThrow("rootDirectoryPath is required.");
  });
});
