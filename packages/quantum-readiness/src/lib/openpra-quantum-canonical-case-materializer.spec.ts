import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { SCREENING_LEVEL_BOUNDEDNESS_STATEMENT } from "./openpra-quantum-bounded-importance-contract";
import { loadLatestOpenPraQuantumCanonicalCaseMaterializationSummary } from "./openpra-quantum-canonical-case-materialization-loader";
import { materializeOpenPraQuantumCanonicalCasePackArtifacts } from "./openpra-quantum-canonical-case-materializer";

describe("openpra-quantum-canonical-case-materializer", () => {
  it("materializes and loads the canonical WS5 and WS6 case pack", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-canonical-case-pack-"));

    const result = materializeOpenPraQuantumCanonicalCasePackArtifacts({
      rootDirectoryPath: tempDir,
      boundedImportanceResponsesByCaseLabel: {
        phase2b_row_0698__G_G348: buildBoundedResponse({
          caseLabel: "phase2b_row_0698__G_G348",
          subtreeId: "G:G348",
          topologyClass: "A",
        }),
        phase2b_row_1037__G_G348: buildBoundedResponse({
          caseLabel: "phase2b_row_1037__G_G348",
          subtreeId: "G:G348",
          topologyClass: "A",
        }),
        phase2b_row_0905__G_G939: buildBoundedResponse({
          caseLabel: "phase2b_row_0905__G_G939",
          subtreeId: "G:G939",
          topologyClass: "C",
        }),
      },
      providerRequestsByCaseLabel: {
        phase2b_row_0698__G_G348: {
          requestId: "provider-request-0698",
          subtreeId: "G:G348",
          caseLabel: "phase2b_row_0698__G_G348",
          providerName: "ibm_runtime",
          backendName: "ibm_torino",
          shots: 8192,
          resilienceLevel: 0,
          createdAtUtc: "2026-04-17T17:03:17.743Z",
          notes: "WS6 exact path request",
        },
        phase2b_row_0905__G_G939: {
          requestId: "provider-request-0905",
          subtreeId: "G:G939",
          caseLabel: "phase2b_row_0905__G_G939",
          providerName: "ibm_runtime",
          backendName: "ibm_torino",
          shots: 8192,
          resilienceLevel: 0,
          createdAtUtc: "2026-04-17T17:03:17.743Z",
          notes: "WS6 C path request",
        },
      },
      inputArtifactPaths: [],
      scriptVersion: "openpra-quantum-canonical-case-materializer.spec",
    });

    expect(result.summary.boundedImportanceResultCount).toBe(3);
    expect(result.summary.providerRequestResultCount).toBe(2);
    expect(fs.existsSync(result.summaryPath)).toBe(true);
    expect(fs.existsSync(result.manifestPath)).toBe(true);

    const loaded = loadLatestOpenPraQuantumCanonicalCaseMaterializationSummary({
      rootDirectoryPath: tempDir,
    });

    expect(loaded.summary.ws5CaseLabels).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_1037__G_G348",
      "phase2b_row_0905__G_G939",
    ]);
    expect(loaded.summary.ws6CaseLabels).toEqual(["phase2b_row_0698__G_G348", "phase2b_row_0905__G_G939"]);
  });
});

function buildBoundedResponse(input: { caseLabel: string; subtreeId: string; topologyClass: "A" | "C" }) {
  return {
    subtreeId: input.subtreeId,
    topologyClass: input.topologyClass,
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
    provenanceManifestPath: `/provenance/${input.caseLabel}.json`,
    sourceRecoveryArtifactPath: `/recovery/${input.caseLabel}.json`,
    generatedAtUtc: "2026-04-17T17:03:17.743Z",
    caseLabel: input.caseLabel,
  };
}
