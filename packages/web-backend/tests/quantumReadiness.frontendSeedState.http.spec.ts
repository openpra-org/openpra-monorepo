import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.frontendSeedState.http", () => {
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

  it("builds and loads the frontend seed state through HTTP routes", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-seed-http-"));
    const workspaceSnapshotRoot = path.join(tempDir, "workspace_snapshot");
    const seedRoot = path.join(tempDir, "seed_state");

    fs.mkdirSync(workspaceSnapshotRoot, { recursive: true });

    fs.writeFileSync(
      path.join(workspaceSnapshotRoot, "frontend_workspace_snapshot_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T22:50:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: workspaceSnapshotRoot,
          frontendSummaryRootDirectoryPath: "/frontend_summary",
          canonicalProgramReportRootDirectoryPath: "/program_report",
          readyForFrontend: true,
          readinessStatus: "ready",
          cards: [
            {
              id: "readiness",
              title: "Frontend readiness",
              status: "ready",
              primaryValue: "Ready",
              secondaryValue: "3 tracked cases",
              notes: ["WS5 cases: 3", "WS6 cases: 2"],
            },
            {
              id: "ws5",
              title: "WS5 bounded coverage",
              status: "complete",
              primaryValue: "3 cases",
              secondaryValue: "All bounded checks matched",
              notes: ["Operator attention count: 0"],
            },
            {
              id: "ws6",
              title: "WS6 execution coverage",
              status: "complete",
              primaryValue: "2 cases",
              secondaryValue: "All execution cases completed",
              notes: ["Missing result count: 0"],
            },
            {
              id: "topology",
              title: "Topology mix",
              status: "complete",
              primaryValue: "A:2 C:1",
              secondaryValue: "3 union cases",
              notes: ["WS5 ready: true", "WS6 ready: true"],
            },
          ],
          caseRows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              topologyClass: "A",
              showInFrontend: true,
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              topologyClass: "C",
              showInFrontend: true,
              inWs5BoundedReport: true,
              inWs6ExecutionReport: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_1037__G_G348",
              topologyClass: "A",
              showInFrontend: true,
              inWs5BoundedReport: true,
              inWs6ExecutionReport: false,
              boundednessMatches: true,
              ws6ExecutionStatus: null,
              ws6HasResult: null,
            },
          ],
        },
        null,
        2,
      ) + "\n",
      (encoding = "utf8"),
    );

    const built = await request(app.getHttpServer())
      .post("/frontend-seed-state")
      .send({
        rootDirectoryPath: seedRoot,
        frontendWorkspaceSnapshotRootDirectoryPath: workspaceSnapshotRoot,
        scriptVersion: "quantumReadiness.frontendSeedState.http.spec",
      })
      .expect(200);

    expect(built.body.summary.readyForFrontend).toBe(true);
    expect(built.body.summary.badge.label).toBe("Frontend ready");
    expect(fs.existsSync(built.body.summaryPath)).toBe(true);

    const loaded = await request(app.getHttpServer())
      .post("/frontend-seed-state/load-latest")
      .send({
        rootDirectoryPath: seedRoot,
      })
      .expect(200);

    expect(loaded.body.summary.readinessStatus).toBe("ready");
    expect(loaded.body.summary.caseTableRows).toHaveLength(3);
  });
});
