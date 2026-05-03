import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { SCREENING_LEVEL_BOUNDEDNESS_STATEMENT } from "quantum-readiness";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.canonicalBoundedReport.http", () => {
  let app: INestApplication;
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock };

  beforeAll(async () => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        QuantumReadinessService,
        {
          provide: GraphModelService,
          useValue: graphModelServiceMock,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("builds and loads the canonical bounded report through HTTP routes", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-canonical-bounded-http-"));
    const sourceRoot = path.join(tempDir, "bounded_source");
    const reportRoot = path.join(tempDir, "bounded_report");

    for (const entry of [
      { caseLabel: "phase2b_row_0698__G_G348", subtreeId: "G:G348", topologyClass: "A" },
      { caseLabel: "phase2b_row_1037__G_G348", subtreeId: "G:G348", topologyClass: "A" },
      { caseLabel: "phase2b_row_0905__G_G939", subtreeId: "G:G939", topologyClass: "C" },
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

      await request(app.getHttpServer())
        .post("/importance/bounded")
        .send({
          rootDirectoryPath: sourceRoot,
          ...response,
          expectedResponse: response,
          inputArtifactPaths: [],
          scriptVersion: "quantumReadiness.canonicalBoundedReport.http.spec",
        })
        .expect(200);
    }

    const built = await request(app.getHttpServer())
      .post("/importance/bounded/canonical-report")
      .send({
        rootDirectoryPath: reportRoot,
        sourceBoundedImportanceRootDirectoryPath: sourceRoot,
        scriptVersion: "quantumReadiness.canonicalBoundedReport.http.spec",
      })
      .expect(200);

    expect(built.body.summary.totalCases).toBe(3);
    expect(built.body.summary.boundednessAllMatch).toBe(true);
    expect(fs.existsSync(built.body.summaryPath)).toBe(true);

    const loaded = await request(app.getHttpServer())
      .post("/importance/bounded/canonical-report/load-latest")
      .send({
        rootDirectoryPath: reportRoot,
      })
      .expect(200);

    expect(loaded.body.summary.caseLabels).toEqual([
      "phase2b_row_0698__G_G348",
      "phase2b_row_1037__G_G348",
      "phase2b_row_0905__G_G939",
    ]);
    expect(loaded.body.summary.topologyCounts).toEqual({ A: 2, C: 1 });
  });
});
