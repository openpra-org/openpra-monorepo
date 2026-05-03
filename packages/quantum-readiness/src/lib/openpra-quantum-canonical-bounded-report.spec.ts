import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { SCREENING_LEVEL_BOUNDEDNESS_STATEMENT } from "./openpra-quantum-bounded-importance-contract";
import { buildOpenPraQuantumBoundedImportanceServiceFacade } from "./openpra-quantum-bounded-importance-service-facade";
import {
  buildOpenPraQuantumCanonicalBoundedReport,
  loadLatestOpenPraQuantumCanonicalBoundedReport,
} from "./openpra-quantum-canonical-bounded-report";

describe("openpra-quantum-canonical-bounded-report", () => {
  it("builds and loads a canonical bounded importance report", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-canonical-bounded-report-"));
    const sourceRoot = path.join(tempDir, "bounded_source");
    const reportRoot = path.join(tempDir, "bounded_report");

    for (const entry of [
      { caseLabel: "phase2b_row_0698__G_G348", subtreeId: "G:G348", topologyClass: "A" as const },
      { caseLabel: "phase2b_row_1037__G_G348", subtreeId: "G:G348", topologyClass: "A" as const },
      { caseLabel: "phase2b_row_0905__G_G939", subtreeId: "G:G939", topologyClass: "C" as const },
    ]) {
      const response = {
        subtreeId: entry.subtreeId,
        topologyClass: entry.topologyClass,
        recoveryMode: "exact_hardware_recovery",
        operatorAttentionRequired: false,
        boundednessStatement: SCREENING_LEVEL_BOUNDEDNESS_STATEMENT,
        quantumImportance: [
          {
            basicEventId: "BE_A",
            fussellVesely: 0.5,
            riskAchievementWorth: 2.0,
            birnbaum: 0.1,
          },
        ],
        classicalBaseline: [
          {
            basicEventId: "BE_A",
            fussellVesely: 0.5,
            riskAchievementWorth: 2.0,
            birnbaum: 0.1,
          },
        ],
        comparisonStatistics: {
          sharedBasicEventCount: 1,
          fvCorrelation: 1,
          rawCorrelation: 1,
          birnbaumCorrelation: 1,
          fvMaxAbsoluteDeviation: 0,
          rawMaxAbsoluteDeviation: 0,
          birnbaumMaxAbsoluteDeviation: 0,
          disagreementCount: 0,
        },
        provenanceManifestPath: `/provenance/${entry.caseLabel}.json`,
        sourceRecoveryArtifactPath: `/recovery/${entry.caseLabel}.json`,
        generatedAtUtc: "2026-04-17T17:03:17.743Z",
        caseLabel: entry.caseLabel,
      };

      buildOpenPraQuantumBoundedImportanceServiceFacade({
        rootDirectoryPath: sourceRoot,
        ...response,
        expectedResponse: response,
        inputArtifactPaths: [],
        scriptVersion: "openpra-quantum-canonical-bounded-report.spec",
      });
    }

    const built = buildOpenPraQuantumCanonicalBoundedReport({
      rootDirectoryPath: reportRoot,
      sourceBoundedImportanceRootDirectoryPath: sourceRoot,
      scriptVersion: "openpra-quantum-canonical-bounded-report.spec",
    });

    expect(built.summary.totalCases).toBe(3);
    expect(built.summary.boundednessAllMatch).toBe(true);
    expect(fs.existsSync(built.summaryPath)).toBe(true);
    expect(fs.existsSync(built.manifestPath)).toBe(true);

    const loaded = loadLatestOpenPraQuantumCanonicalBoundedReport({
      rootDirectoryPath: reportRoot,
    });

    expect(loaded.summary.caseLabels).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_1037__G_G348",
      "phase2b_row_0905__G_G939",
    ]);
    expect(loaded.summary.topologyCounts).toEqual({ A: 2, C: 1 });
  });
});
