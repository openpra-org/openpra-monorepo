import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface LatestWorkflowRunByTargetHttpResponse {
  rootDir: string;
  modelId: string;
  subtreeId: string;
  latest: {
    workflowRunDir: string;
    workflowKind: string | null;
    modelId: string | null;
    subtreeId: string | null;
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

describe("QuantumReadiness HTTP latest workflow run by target", () => {
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

  it("POST /api/quantum-readiness/workflow/latest-run/by-target returns newest matching model and subtree with inspection summary", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-latest-by-target-root-"));

    const runOther = path.join(rootDir, "openpra_quantum_other_target");
    const runTargetOld = path.join(rootDir, "openpra_quantum_target_old");
    const runTargetNew = path.join(rootDir, "openpra_quantum_target_new");

    fs.mkdirSync(path.join(runOther, "artifacts", "preparation"), { recursive: true });
    fs.mkdirSync(path.join(runTargetOld, "artifacts", "preparation"), { recursive: true });
    fs.mkdirSync(path.join(runTargetNew, "artifacts", "preparation"), { recursive: true });

    writeJson(path.join(runOther, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "preparation",
      createdAtUtc: "2026-04-17T10:00:00.000Z",
      modelId: "other_model",
      subtreeId: "OTHER",
    });

    writeJson(path.join(runTargetOld, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "preparation",
      createdAtUtc: "2026-04-15T10:00:00.000Z",
      modelId: "openpra_graph_case_1",
      subtreeId: "TOP",
    });

    writeJson(path.join(runTargetNew, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "full_pipeline",
      createdAtUtc: "2026-04-16T10:00:00.000Z",
      modelId: "openpra_graph_case_1",
      subtreeId: "TOP",
    });

    writeJson(path.join(runTargetNew, "artifacts", "preparation", "openpra_quantum_preparation_bundle_v1.json"), {
      ok: true,
    });

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/workflow/latest-run/by-target")
      .send({
        rootDir,
        modelId: "openpra_graph_case_1",
        subtreeId: "TOP",
      })
      .expect(200);

    const body = response.body as LatestWorkflowRunByTargetHttpResponse;

    expect(body.modelId).toBe("openpra_graph_case_1");
    expect(body.subtreeId).toBe("TOP");
    expect(body.latest).not.toBeNull();
    expect(body.latest!.workflowRunDir).toContain("openpra_quantum_target_new");
    expect(body.latest!.modelId).toBe("openpra_graph_case_1");
    expect(body.latest!.subtreeId).toBe("TOP");
    expect(body.inspection).not.toBeNull();
    expect(body.inspection!.files.preparationBundles.length).toBe(1);
  });
});
