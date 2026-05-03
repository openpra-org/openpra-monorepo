import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface WorkflowRunInspectionHttpResponse {
  workflowRunDir: string;
  manifestPath: string | null;
  files: {
    preparationBundles: string[];
    preparationArtifacts: string[];
    executionArtifacts: string[];
    executionProvenance: string[];
    recoveryArtifacts: string[];
    recoveryBatchRollups: string[];
    logFiles: string[];
  };
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

describe("QuantumReadiness HTTP workflow run inspection", () => {
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

  it("POST /api/quantum-readiness/workflow/inspect-run returns a summary of workflow outputs", async () => {
    const workflowRunDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-workflow-inspect-"));

    const artifactsDir = path.join(workflowRunDir, "artifacts");
    const preparationDir = path.join(artifactsDir, "preparation");
    const executionDir = path.join(artifactsDir, "execution");
    const recoveryDir = path.join(artifactsDir, "recovery");
    const batchDir = path.join(artifactsDir, "batch");
    const logsDir = path.join(workflowRunDir, "logs");

    fs.mkdirSync(preparationDir, { recursive: true });
    fs.mkdirSync(executionDir, { recursive: true });
    fs.mkdirSync(recoveryDir, { recursive: true });
    fs.mkdirSync(batchDir, { recursive: true });
    fs.mkdirSync(logsDir, { recursive: true });

    writeJson(path.join(workflowRunDir, "openpra_quantum_workflow_run_manifest_v1.json"), { ok: true });
    writeJson(path.join(preparationDir, "openpra_quantum_preparation_bundle_v1.json"), { ok: true });
    writeJson(path.join(preparationDir, "openpra_quantum_preparation_artifact_alpha.json"), { ok: true });
    writeJson(path.join(executionDir, "openpra_quantum_execution_artifact_v1.json"), { ok: true });
    writeJson(path.join(executionDir, "openpra_quantum_execution_provenance_manifest_v1.json"), { ok: true });
    writeJson(path.join(recoveryDir, "openpra_quantum_recovery_artifact_v1.json"), { ok: true });
    writeJson(path.join(batchDir, "openpra_quantum_recovery_batch_rollup_v1.json"), { ok: true });
    fs.writeFileSync(path.join(logsDir, "run.log"), "ok\n", "utf8");

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/workflow/inspect-run")
      .send({
        workflowRunDir,
      })
      .expect(200);

    const body = response.body as WorkflowRunInspectionHttpResponse;

    expect(body.manifestPath).toContain("openpra_quantum_workflow_run_manifest_v1.json");
    expect(body.files.preparationBundles.length).toBe(1);
    expect(body.files.preparationArtifacts.length).toBe(1);
    expect(body.files.executionArtifacts.length).toBe(1);
    expect(body.files.executionProvenance.length).toBe(1);
    expect(body.files.recoveryArtifacts.length).toBe(1);
    expect(body.files.recoveryBatchRollups.length).toBe(1);
    expect(body.files.logFiles.length).toBe(1);
  });
});
