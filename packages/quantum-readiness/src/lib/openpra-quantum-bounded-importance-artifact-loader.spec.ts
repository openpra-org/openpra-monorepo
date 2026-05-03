import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { SCREENING_LEVEL_BOUNDEDNESS_STATEMENT } from "./openpra-quantum-bounded-importance-contract";
import { buildOpenPraQuantumBoundedImportanceServiceFacade } from "./openpra-quantum-bounded-importance-service-facade";
import { loadLatestOpenPraQuantumBoundedImportanceArtifacts } from "./openpra-quantum-bounded-importance-artifact-loader";

describe("openpra-quantum-bounded-importance-artifact-loader", () => {
  it("loads the latest bounded importance artifact by case label", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws5-loader-"));

    const expectedResponse = {
      subtreeId: "G:G348",
      topologyClass: "A" as const,
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
      provenanceManifestPath: "/provenance/ws5/phase2b_row_0698__G_G348.json",
      sourceRecoveryArtifactPath: "/recovery/phase2b_row_0698__G_G348.json",
      generatedAtUtc: "2026-04-17T17:03:17.743Z",
      caseLabel: "phase2b_row_0698__G_G348",
    };

    buildOpenPraQuantumBoundedImportanceServiceFacade({
      rootDirectoryPath: tempDir,
      inputArtifactPaths: [],
      scriptVersion: "bounded-importance-loader.spec",
      ...expectedResponse,
      expectedResponse,
    });

    const loaded = loadLatestOpenPraQuantumBoundedImportanceArtifacts({
      rootDirectoryPath: tempDir,
      caseLabel: "phase2b_row_0698__G_G348",
    });

    expect(loaded.response.caseLabel).toBe("phase2b_row_0698__G_G348");
    expect(loaded.response.boundednessStatement).toBe(SCREENING_LEVEL_BOUNDEDNESS_STATEMENT);
    expect(fs.existsSync(loaded.responsePath)).toBe(true);
    expect(fs.existsSync(loaded.provenanceManifestPath ?? "")).toBe(true);
  });
});
