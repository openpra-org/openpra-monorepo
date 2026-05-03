import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.canonicalProgramReport.http", () => {
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

  it("builds and loads the canonical program report through HTTP routes", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-program-report-http-"));
    const boundedReportRoot = path.join(tempDir, "bounded_report");
    const ws6ReportRoot = path.join(tempDir, "ws6_report");
    const programReportRoot = path.join(tempDir, "program_report");

    fs.mkdirSync(boundedReportRoot, { recursive: true });
    fs.mkdirSync(ws6ReportRoot, { recursive: true });

    fs.writeFileSync(
      path.join(boundedReportRoot, "canonical_bounded_report_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:00:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: boundedReportRoot,
          sourceBoundedImportanceRootDirectoryPath: "/source/bounded",
          caseLabels: ["phase2b_row_0698__G_G348", "phase2b_row_1037__G_G348", "phase2b_row_0905__G_G939"],
          topologyCounts: { A: 2, C: 1 },
          totalCases: 3,
          boundednessAllMatch: true,
          operatorAttentionCount: 0,
          rows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              subtreeId: "G:G348",
              topologyClass: "A",
              recoveryMode: "exact_hardware_recovery",
              operatorAttentionRequired: false,
              boundednessMatches: true,
              responsePath: "/responses/0698.json",
              provenanceManifestPath: "/responses/0698.manifest.json",
            },
            {
              caseLabel: "phase2b_row_1037__G_G348",
              subtreeId: "G:G348",
              topologyClass: "A",
              recoveryMode: "exact_hardware_recovery",
              operatorAttentionRequired: false,
              boundednessMatches: true,
              responsePath: "/responses/1037.json",
              provenanceManifestPath: "/responses/1037.manifest.json",
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              subtreeId: "G:G939",
              topologyClass: "C",
              recoveryMode: "exact_hardware_recovery",
              operatorAttentionRequired: false,
              boundednessMatches: true,
              responsePath: "/responses/0905.json",
              provenanceManifestPath: "/responses/0905.manifest.json",
            },
          ],
        },
        null,
        2,
      ) + "\n",
      (encoding = "utf8"),
    );

    fs.writeFileSync(
      path.join(ws6ReportRoot, "ws6_canonical_execution_report_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:00:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: ws6ReportRoot,
          sourceExecutionArtifactsRootDirectoryPath: "/source/ws6",
          caseLabels: ["phase2b_row_0698__G_G348", "phase2b_row_0905__G_G939"],
          topologyCounts: { A: 1, C: 1 },
          totalCases: 2,
          completedCount: 2,
          failedCount: 0,
          missingResultCount: 0,
          allCompleted: true,
          rows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              subtreeId: "G:G348",
              topologyClass: "A",
              jobId: "provider-request-0698",
              executionStatus: "completed",
              resultStatus: "completed",
              hasExecutionResult: true,
              rawCountsArtifactPath: "/raw-counts/0698.json",
              recoveryArtifactPath: "/recovery/0698.json",
              provenanceManifestPath: "/execution/0698.manifest.json",
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              subtreeId: "G:G939",
              topologyClass: "C",
              jobId: "provider-request-0905",
              executionStatus: "completed",
              resultStatus: "completed",
              hasExecutionResult: true,
              rawCountsArtifactPath: "/raw-counts/0905.json",
              recoveryArtifactPath: "/recovery/0905.json",
              provenanceManifestPath: "/execution/0905.manifest.json",
            },
          ],
        },
        null,
        2,
      ) + "\n",
      (encoding = "utf8"),
    );

    const built = await request(app.getHttpServer())
      .post("/canonical-program-report")
      .send({
        rootDirectoryPath: programReportRoot,
        boundedReportRootDirectoryPath: boundedReportRoot,
        ws6ExecutionReportRootDirectoryPath: ws6ReportRoot,
        scriptVersion: "quantumReadiness.canonicalProgramReport.http.spec",
      })
      .expect(200);

    expect(built.body.summary.totalUnionCases).toBe(3);
    expect(built.body.summary.readyForFrontend).toBe(true);
    expect(fs.existsSync(built.body.summaryPath)).toBe(true);

    const loaded = await request(app.getHttpServer())
      .post("/canonical-program-report/load-latest")
      .send({
        rootDirectoryPath: programReportRoot,
      })
      .expect(200);

    expect(loaded.body.summary.totalWs5Cases).toBe(3);
    expect(loaded.body.summary.totalWs6Cases).toBe(2);
    expect(loaded.body.summary.readyForFrontend).toBe(true);
  });
});
