import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface LatestWorkflowRunByKindHttpResponse {
  rootDir: string;
  workflowKind: string;
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

describe("QuantumReadiness HTTP latest workflow run by kind", () => {
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

  it("POST /api/quantum-readiness/workflow/latest-run/by-kind returns newest matching workflow kind with inspection summary", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-latest-by-kind-root-"));

    const runPrepNewer = path.join(rootDir, "openpra_quantum_preparation_newer");
    const runFullOld = path.join(rootDir, "openpra_quantum_full_pipeline_old");
    const runFullNew = path.join(rootDir, "openpra_quantum_full_pipeline_new");

    fs.mkdirSync(path.join(runPrepNewer, "artifacts", "preparation"), { recursive: true });
    fs.mkdirSync(path.join(runFullOld, "artifacts", "preparation"), { recursive: true });
    fs.mkdirSync(path.join(runFullNew, "artifacts", "preparation"), { recursive: true });

    writeJson(path.join(runPrepNewer, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "preparation",
      createdAtUtc: "2026-04-17T10:00:00.000Z",
    });

    writeJson(path.join(runFullOld, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "full_pipeline",
      createdAtUtc: "2026-04-15T10:00:00.000Z",
    });

    writeJson(path.join(runFullNew, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "full_pipeline",
      createdAtUtc: "2026-04-16T10:00:00.000Z",
    });

    writeJson(path.join(runFullNew, "artifacts", "preparation", "openpra_quantum_preparation_bundle_v1.json"), {
      ok: true,
    });

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/workflow/latest-run/by-kind")
      .send({
        rootDir,
        workflowKind: "full_pipeline",
      })
      .expect(200);

    const body = response.body as LatestWorkflowRunByKindHttpResponse;

    expect(body.workflowKind).toBe("full_pipeline");
    expect(body.latest).not.toBeNull();
    expect(body.latest!.workflowKind).toBe("full_pipeline");
    expect(body.latest!.workflowRunDir).toContain("openpra_quantum_full_pipeline_new");
    expect(body.inspection).not.toBeNull();
    expect(body.inspection!.files.preparationBundles.length).toBe(1);
  });
});
