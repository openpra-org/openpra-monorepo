import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface LatestWorkflowRunHttpResponse {
  rootDir: string;
  latest: {
    workflowRunDir: string;
    workflowKind: string | null;
    createdAtUtc: string | null;
    manifestPath: string | null;
  } | null;
  inspection: {
    manifestPath: string | null;
    files: {
      preparationBundles: string[];
    };
  } | null;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

describe("QuantumReadiness HTTP latest workflow run", () => {
  let app: INestApplication;
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock };

  beforeAll(async () => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        QuantumReadinessService,
        {
          provide: GraphModelService,
          useValue: graphModelServiceMock,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/quantum-readiness");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /api/quantum-readiness/workflow/latest-run returns newest workflow run with inspection summary", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-latest-workflow-root-"));

    const runOld = path.join(rootDir, "openpra_quantum_preparation_old");
    const runNew = path.join(rootDir, "openpra_quantum_full_pipeline_new");

    fs.mkdirSync(path.join(runOld, "artifacts", "preparation"), { recursive: true });
    fs.mkdirSync(path.join(runNew, "artifacts", "preparation"), { recursive: true });
    fs.mkdirSync(path.join(runNew, "logs"), { recursive: true });

    writeJson(path.join(runOld, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "preparation",
      createdAtUtc: "2026-04-15T10:00:00.000Z",
    });

    writeJson(path.join(runNew, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "full_pipeline",
      createdAtUtc: "2026-04-16T10:00:00.000Z",
    });

    writeJson(path.join(runNew, "artifacts", "preparation", "openpra_quantum_preparation_bundle_v1.json"), {
      ok: true,
    });

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/workflow/latest-run")
      .send({
        rootDir,
      })
      .expect(200);

    const body = response.body as LatestWorkflowRunHttpResponse;

    expect(body.latest).not.toBeNull();
    expect(body.latest!.workflowKind).toBe("full_pipeline");
    expect(body.latest!.workflowRunDir).toContain("openpra_quantum_full_pipeline_new");
    expect(body.inspection).not.toBeNull();
    expect(body.inspection!.files.preparationBundles.length).toBe(1);
  });
});
