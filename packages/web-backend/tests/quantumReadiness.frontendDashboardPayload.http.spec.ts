import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

describe("quantumReadiness.frontendDashboardPayload.http", () => {
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

  it("builds and loads the frontend dashboard payload through HTTP routes", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-frontend-dashboard-http-"));
    const seedRoot = path.join(tempDir, "seed_state");
    const bootstrapRoot = path.join(tempDir, "bootstrap_packet");
    const dashboardRoot = path.join(tempDir, "dashboard_payload");

    fs.mkdirSync(seedRoot, { recursive: true });
    fs.mkdirSync(bootstrapRoot, { recursive: true });

    fs.writeFileSync(
      path.join(seedRoot, "frontend_seed_state_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T23:10:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: seedRoot,
          frontendWorkspaceSnapshotRootDirectoryPath: "/workspace",
          readyForFrontend: true,
          readinessStatus: "ready",
          badge: {
            label: "Frontend ready",
            tone: "success",
          },
          widgets: [
            {
              id: "readiness",
              title: "Frontend readiness",
              value: "Ready",
              subtitle: "3 tracked cases",
              status: "ready",
              notes: ["WS5 cases: 3", "WS6 cases: 2"],
            },
            {
              id: "ws5",
              title: "WS5 bounded coverage",
              value: "3 cases",
              subtitle: "All bounded checks matched",
              status: "complete",
              notes: ["Operator attention count: 0"],
            },
          ],
          caseTableRows: [
            {
              caseLabel: "phase2b_row_0698__G_G348",
              topologyClass: "A",
              displayStatus: "ready",
              showInFrontend: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_0905__G_G939",
              topologyClass: "C",
              displayStatus: "ready",
              showInFrontend: true,
              boundednessMatches: true,
              ws6ExecutionStatus: "completed",
              ws6HasResult: true,
            },
            {
              caseLabel: "phase2b_row_1037__G_G348",
              topologyClass: "A",
              displayStatus: "partial",
              showInFrontend: true,
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

    fs.writeFileSync(
      path.join(bootstrapRoot, "frontend_bootstrap_packet_summary_v1.json"),
      JSON.stringify(
        {
          generatedAtUtc: "2026-04-17T23:05:00.000Z",
          scriptVersion: "test",
          rootDirectoryPath: bootstrapRoot,
          frontendSeedStateRootDirectoryPath: seedRoot,
          frontendWorkspaceSnapshotRootDirectoryPath: "/workspace",
          readyForFrontend: true,
          readinessStatus: "ready",
          headerBadgeLabel: "Frontend ready",
          widgetCount: 2,
          caseRowCount: 3,
          nav: [
            {
              id: "overview",
              label: "Overview",
              enabled: true,
              count: 2,
            },
            {
              id: "cases",
              label: "Cases",
              enabled: true,
              count: 3,
            },
            {
              id: "workspace",
              label: "Workspace",
              enabled: true,
              count: 2,
            },
          ],
          widgetTitles: ["Frontend readiness", "WS5 bounded coverage"],
          readyCaseCount: 2,
          partialCaseCount: 1,
          blockedCaseCount: 0,
        },
        null,
        2,
      ) + "\n",
      (encoding = "utf8"),
    );

    const built = await request(app.getHttpServer())
      .post("/frontend-dashboard-payload")
      .send({
        rootDirectoryPath: dashboardRoot,
        frontendBootstrapPacketRootDirectoryPath: bootstrapRoot,
        frontendSeedStateRootDirectoryPath: seedRoot,
        scriptVersion: "quantumReadiness.frontendDashboardPayload.http.spec",
      })
      .expect(200);

    expect(built.body.summary.readyForFrontend).toBe(true);
    expect(built.body.summary.header.badgeLabel).toBe("Frontend ready");
    expect(fs.existsSync(built.body.summaryPath)).toBe(true);

    const loaded = await request(app.getHttpServer())
      .post("/frontend-dashboard-payload/load-latest")
      .send({
        rootDirectoryPath: dashboardRoot,
      })
      .expect(200);

    expect(loaded.body.summary.totals.widgetCount).toBe(2);
    expect(loaded.body.summary.totals.caseRowCount).toBe(3);
    expect(loaded.body.summary.nav).toHaveLength(3);
  });
});
