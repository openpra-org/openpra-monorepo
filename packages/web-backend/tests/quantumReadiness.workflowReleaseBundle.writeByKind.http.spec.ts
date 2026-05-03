import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface WorkflowReleaseBundleWriteByKindHttpResponse {
  workflowRunDir: string;
  outputDir: string;
  bundleDir: string;
  releaseSummaryPath: string;
  releaseManifestPath: string;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

describe("QuantumReadiness HTTP workflow release bundle write by kind", () => {
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

  it("POST /api/quantum-readiness/release/workflow-bundle/write/by-kind writes a bundle for the latest matching workflow kind", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-release-bundle-kind-root-"));
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-release-bundle-kind-out-"));

    const runPrep = path.join(rootDir, "openpra_quantum_preparation_old");
    const runFullOld = path.join(rootDir, "openpra_quantum_full_pipeline_old");
    const runFullNew = path.join(rootDir, "openpra_quantum_full_pipeline_new");

    for (const dir of [runPrep, runFullOld, runFullNew]) {
      fs.mkdirSync(dir, { recursive: true });
      writeJson(path.join(dir, "openpra_quantum_workflow_run_manifest_v1.json"), { ok: true });
      writeJson(path.join(dir, "artifacts", "preparation", "openpra_quantum_preparation_bundle_v1.json"), { ok: true });
      writeJson(path.join(dir, "artifacts", "execution", "openpra_quantum_execution_artifact_v1.json"), { ok: true });
      writeJson(path.join(dir, "artifacts", "execution", "openpra_quantum_execution_provenance_manifest_v1.json"), {
        ok: true,
      });
      writeJson(path.join(dir, "artifacts", "recovery", "openpra_quantum_recovery_artifact_v1.json"), { ok: true });
      writeJson(path.join(dir, "artifacts", "recovery", "openpra_quantum_importance_comparison_v1.json"), { ok: true });
      writeJson(path.join(dir, "artifacts", "recovery", "openpra_quantum_importance_comparison_report_v1.json"), {
        ok: true,
      });
    }

    writeJson(path.join(runPrep, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "preparation",
      createdAtUtc: "2026-04-15T10:00:00.000Z",
      modelId: "openpra_graph_case_1",
      subtreeId: "TOP",
    });
    writeJson(path.join(runFullOld, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "full_pipeline",
      createdAtUtc: "2026-04-15T11:00:00.000Z",
      modelId: "openpra_graph_case_1",
      subtreeId: "TOP",
    });
    writeJson(path.join(runFullNew, "openpra_quantum_workflow_run_manifest_v1.json"), {
      workflowKind: "full_pipeline",
      createdAtUtc: "2026-04-16T10:00:00.000Z",
      modelId: "openpra_graph_case_1",
      subtreeId: "TOP",
    });

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/release/workflow-bundle/write/by-kind")
      .send({
        rootDir,
        workflowKind: "full_pipeline",
        outputDir,
      })
      .expect(200);

    const body = response.body as WorkflowReleaseBundleWriteByKindHttpResponse;

    expect(body.workflowRunDir).toBe(runFullNew);
    expect(fs.existsSync(body.bundleDir)).toBe(true);
    expect(fs.existsSync(body.releaseSummaryPath)).toBe(true);
    expect(fs.existsSync(body.releaseManifestPath)).toBe(true);
  });
});
