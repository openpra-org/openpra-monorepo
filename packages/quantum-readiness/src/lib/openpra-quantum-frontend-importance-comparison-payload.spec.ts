import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { buildOpenPraQuantumFrontendImportanceComparisonPayload } from "./openpra-quantum-frontend-importance-comparison-payload";

function writeJson(rootDirectoryPath: string, relativePath: string, value: unknown): void {
  const targetPath = path.join(rootDirectoryPath, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(value, null, 2));
}

describe("buildOpenPraQuantumFrontendImportanceComparisonPayload", () => {
  it("builds a frontend importance comparison payload", () => {
    const rootDirectoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-importance-comparison-"));

    writeJson(rootDirectoryPath, "prep/preparation_artifact_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      topologyClass: "C",
      basicEventCount: 8,
    });

    writeJson(rootDirectoryPath, "provider/provider_execution_request_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      backendName: "ibm_marrakesh",
      status: "completed",
    });

    writeJson(rootDirectoryPath, "importance/importance_comparison_report_v1.json", {
      caseLabel: "phase2b_row_0905",
      subtreeId: "phase2b_row_0905",
      rootGateId: "G:G939",
      boundednessStatement:
        "These importance measures are computed from quantum-recovered MCS and validated at screening-level significance.",
      comparisonStatistics: {
        rawSpearman: 0.488,
        birnbaumSpearman: 0.438,
        fvSpearman: 0.236,
        topEventAbsoluteError: 7.5e-7,
        disagreementCount: 2,
        maxDeviation: 0.12,
      },
      requiresOperatorAttention: true,
    });

    const result = buildOpenPraQuantumFrontendImportanceComparisonPayload({
      rootDirectoryPath,
      subtreeId: "phase2b_row_0905",
      scriptVersion: "quantum-readiness.frontendImportanceComparisonPayload.spec",
    });

    expect(result.target.subtreeId).toBe("phase2b_row_0905");
    expect(result.summary.topologyClass).toBe("C");
    expect(result.summary.providerBackendName).toBe("ibm_marrakesh");
    expect(result.summary.rawSpearman).toBe(0.488);
    expect(result.summary.birnbaumSpearman).toBe(0.438);
    expect(result.summary.fvSpearman).toBe(0.236);
    expect(result.summary.requiresOperatorAttention).toBe(true);
    expect(result.comparison?.topEventAbsoluteError).toBe(7.5e-7);
    expect(result.interpretation.strongestMeasure).toBe("RAW");
    expect(result.interpretation.weakestMeasure).toBe("FV");
    expect(result.interpretation.recommendation).toBe("review_required");
    expect(result.provenance.matchedArtifactPaths.length).toBe(3);
  });

  it("throws when the root directory path is missing", () => {
    expect(() =>
      buildOpenPraQuantumFrontendImportanceComparisonPayload({
        rootDirectoryPath: "",
      }),
    ).toThrow("rootDirectoryPath is required.");
  });
});
