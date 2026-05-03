import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SCREENING_LEVEL_BOUNDEDNESS_STATEMENT } from "quantum-readiness";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessController } from "./quantumReadiness.controller";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessController canonical materialization", () => {
  let controller: QuantumReadinessController;
  let service: QuantumReadinessService;
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock };

  beforeEach(() => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn(),
    };

    service = new QuantumReadinessService(graphModelServiceMock as unknown as GraphModelService);

    controller = new QuantumReadinessController(service);
  });

  it("materializes and loads canonical case artifacts through the controller", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-canonical-controller-"));

    const result = controller.materializeCanonicalCasePackArtifacts({
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
        phase2b_row_0698__G_G348: buildProviderRequest({
          requestId: "provider-request-0698",
          subtreeId: "G:G348",
          caseLabel: "phase2b_row_0698__G_G348",
        }),
        phase2b_row_0905__G_G939: buildProviderRequest({
          requestId: "provider-request-0905",
          subtreeId: "G:G939",
          caseLabel: "phase2b_row_0905__G_G939",
        }),
      },
      inputArtifactPaths: [],
      scriptVersion: "quantumReadiness.canonicalMaterialization.controller.spec",
    });

    expect(result.summary.boundedImportanceResultCount).toBe(3);
    expect(fs.existsSync(result.summaryPath)).toBe(true);

    const loaded = controller.loadLatestCanonicalCaseMaterializationSummary({
      rootDirectoryPath: tempDir,
    });

    expect(loaded.summary.ws5CaseLabels).toHaveLength(3);
    expect(loaded.summary.ws6CaseLabels).toHaveLength(2);
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

function buildProviderRequest(input: { requestId: string; subtreeId: string; caseLabel: string }) {
  return {
    requestId: input.requestId,
    subtreeId: input.subtreeId,
    caseLabel: input.caseLabel,
    providerName: "ibm_runtime",
    backendName: "ibm_torino",
    shots: 8192,
    resilienceLevel: 0,
    createdAtUtc: "2026-04-17T17:03:17.743Z",
    notes: "Canonical WS6 request",
  };
}
