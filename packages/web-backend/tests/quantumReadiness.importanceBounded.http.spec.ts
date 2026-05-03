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

describe("quantumReadiness.importanceBounded.http", () => {
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

  it("writes bounded importance artifacts through the HTTP route", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws5-http-"));
    const generatedAtUtc = "2026-04-17T17:03:17.743Z";

    const expectedResponse = {
      subtreeId: "G:G348",
      topologyClass: "A",
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
      generatedAtUtc,
      caseLabel: "phase2b_row_0698__G_G348",
    };

    const response = await request(app.getHttpServer())
      .post("/importance/bounded")
      .send({
        rootDirectoryPath: tempDir,
        subtreeId: expectedResponse.subtreeId,
        topologyClass: expectedResponse.topologyClass,
        recoveryMode: expectedResponse.recoveryMode,
        operatorAttentionRequired: expectedResponse.operatorAttentionRequired,
        quantumImportance: expectedResponse.quantumImportance,
        classicalBaseline: expectedResponse.classicalBaseline,
        comparisonStatistics: expectedResponse.comparisonStatistics,
        provenanceManifestPath: expectedResponse.provenanceManifestPath,
        sourceRecoveryArtifactPath: expectedResponse.sourceRecoveryArtifactPath,
        generatedAtUtc: expectedResponse.generatedAtUtc,
        caseLabel: expectedResponse.caseLabel,
        expectedResponse,
      })
      .expect(200);

    expect(response.body.stubResult.parityAgainstExpected.allChecksPass).toBe(true);
    expect(fs.existsSync(response.body.persistedArtifacts.responsePath)).toBe(true);
    expect(fs.existsSync(response.body.persistedArtifacts.provenanceManifestPath)).toBe(true);
  });

  it("returns 400 when bounded importance input is invalid", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws5-http-bad-"));
    const response = await request(app.getHttpServer())
      .post("/importance/bounded")
      .send({
        rootDirectoryPath: tempDir,
        subtreeId: "",
        topologyClass: "A",
        recoveryMode: "exact_hardware_recovery",
        operatorAttentionRequired: false,
        quantumImportance: [],
        classicalBaseline: [],
        comparisonStatistics: {
          sharedBasicEventCount: 0,
          fvCorrelation: null,
          rawCorrelation: null,
          birnbaumCorrelation: null,
          fvMaxAbsoluteDeviation: null,
          rawMaxAbsoluteDeviation: null,
          birnbaumMaxAbsoluteDeviation: null,
          disagreementCount: null,
        },
        provenanceManifestPath: "/provenance/ws5/invalid.json",
      })
      .expect(400);

    expect(String(response.body.message)).toContain("subtreeId");
  });
});
