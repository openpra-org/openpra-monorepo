import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { buildOpenPraQuantumFrontendSubtreeDetailPayload } from "./openpra-quantum-frontend-subtree-detail-payload";

function writeJson(rootDirectoryPath: string, relativePath: string, value: unknown): void {
  const targetPath = path.join(rootDirectoryPath, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(value, null, 2));
}

describe("buildOpenPraQuantumFrontendSubtreeDetailPayload", () => {
  it("builds a subtree detail payload with preparation, provider, recovery, and importance sections", () => {
    const rootDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-subtree-detail-"));

    writeJson(rootDirectoryPath, "prep/preparation_artifact_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      topologyClass: "C",
      basicEventCount: 8,
      requiredQubits: 8,
      qaoaRecipe: {
        beta: -0.785398163,
        gamma: 1.570796327,
        p: 1,
        mixerSpec: "qaoa_plus",
      },
      clqubo: {
        objectiveKind: "constraint_level",
        variableCount: 8,
        auxiliaryVariableCount: 0,
        feasibleSubspaceSize: 1025,
      },
      backendEligibility: {
        eligibleBackendNames: ["ibm_marrakesh", "ibm_torino"],
        ineligibleBackendNames: ["simulator_emulator_placeholder"],
      },
      statevectorVerification: {
        pass: true,
        infeasibleMassUpperBound: 0,
        notes: "zero infeasible leakage",
      },
    });

    writeJson(rootDirectoryPath, "provider/provider_execution_request_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      providerName: "ibm",
      backendName: "ibm_marrakesh",
      jobId: "job-0905",
      shots: 8192,
      resilienceLevel: 0,
      status: "completed",
    });

    writeJson(rootDirectoryPath, "recovery/openpra_recovery_ladder_result_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      primaryMode: "union_sensitivity_recovery",
      requiresOperatorAttention: true,
      tier1RecoveredExactCutSetCount: 3,
      unionRecoveredCount: 4,
      unionAllRecovered: true,
      exactReferenceCutSetCount: 4,
      nearMissAdvisoryCount: 1,
    });

    writeJson(rootDirectoryPath, "importance/importance_comparison_report_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      boundednessStatement: "These importance measures are screening-level only and not regulatory-grade.",
      comparisonStatistics: {
        rawSpearman: 0.488,
        birnbaumSpearman: 0.438,
        fvSpearman: 0.236,
        topEventAbsoluteError: 7.5e-7,
      },
    });

    const result = buildOpenPraQuantumFrontendSubtreeDetailPayload({
      rootDirectoryPath,
      subtreeId: "phase2b_row_0905",
      scriptVersion: "quantum-readiness.frontendSubtreeDetailPayload.spec",
    });

    expect(result.target.subtreeId).toBe("phase2b_row_0905");
    expect(result.target.rootGateId).toBe("G:G939");
    expect(result.summary.topologyClass).toBe("C");
    expect(result.summary.basicEventCount).toBe(8);
    expect(result.summary.requiredQubits).toBe(8);
    expect(result.summary.thresholdBehavior).toBe("threshold_favorable");
    expect(result.summary.providerBackendName).toBe("ibm_marrakesh");
    expect(result.summary.recoveryPrimaryMode).toBe("union_sensitivity_recovery");
    expect(result.summary.requiresOperatorAttention).toBe(true);
    expect(result.preparation?.qaoaRecipe.depthP).toBe(1);
    expect(result.preparation?.backendEligibility.eligibleBackendNames).toEqual(["ibm_marrakesh", "ibm_torino"]);
    expect(result.recovery?.unionRecoveredCount).toBe(4);
    expect(result.importanceComparison?.rawSpearman).toBe(0.488);
    expect(result.provenance.matchedArtifactPaths.length).toBe(4);
  });

  it("throws when the root directory path is missing", () => {
    expect(() =>
      buildOpenPraQuantumFrontendSubtreeDetailPayload({
        rootDirectoryPath: "",
      }),
    ).toThrow("rootDirectoryPath is required.");
  });
});
