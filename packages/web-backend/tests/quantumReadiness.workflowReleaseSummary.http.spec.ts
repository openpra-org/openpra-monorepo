import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface WorkflowReleaseSummaryHttpResponse {
  workflowRunDir: string;
  manifestPath: string | null;
  counts: {
    preparationBundles: number;
    preparationArtifacts: number;
    executionArtifacts: number;
    executionProvenance: number;
    recoveryArtifacts: number;
    recoveryBatchRollups: number;
    importanceComparisons: number;
    importanceReports: number;
    logFiles: number;
  };
  readiness: {
    hasPreparation: boolean;
    hasExecution: boolean;
    hasRecovery: boolean;
    hasImportanceComparison: boolean;
    hasImportanceReport: boolean;
    releaseReady: boolean;
  };
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

describe("QuantumReadiness HTTP workflow release summary", () => {
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

  it("POST /api/quantum-readiness/release/workflow-summary returns release readiness counts", async () => {
    const workflowRunDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-release-summary-"));

    writeJson(path.join(workflowRunDir, "openpra_quantum_workflow_run_manifest_v1.json"), { ok: true });

    writeJson(path.join(workflowRunDir, "artifacts", "preparation", "openpra_quantum_preparation_bundle_v1.json"), {
      ok: true,
    });

    writeJson(path.join(workflowRunDir, "artifacts", "execution", "openpra_quantum_execution_artifact_v1.json"), {
      ok: true,
    });

    writeJson(
      path.join(workflowRunDir, "artifacts", "execution", "openpra_quantum_execution_provenance_manifest_v1.json"),
      { ok: true },
    );

    writeJson(path.join(workflowRunDir, "artifacts", "recovery", "openpra_quantum_recovery_artifact_v1.json"), {
      ok: true,
    });

    writeJson(path.join(workflowRunDir, "artifacts", "recovery", "openpra_quantum_importance_comparison_v1.json"), {
      ok: true,
    });

    writeJson(
      path.join(workflowRunDir, "artifacts", "recovery", "openpra_quantum_importance_comparison_report_v1.json"),
      { ok: true },
    );

    fs.mkdirSync(path.join(workflowRunDir, "logs"), { recursive: true });
    fs.writeFileSync(path.join(workflowRunDir, "logs", "run.log"), "ok\n", "utf8");

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/release/workflow-summary")
      .send({
        workflowRunDir,
      })
      .expect(200);

    const body = response.body as WorkflowReleaseSummaryHttpResponse;

    expect(body.workflowRunDir).toBe(workflowRunDir);
    expect(body.counts.preparationBundles).toBe(1);
    expect(body.counts.executionArtifacts).toBe(1);
    expect(body.counts.executionProvenance).toBe(1);
    expect(body.counts.recoveryArtifacts).toBe(1);
    expect(body.counts.importanceComparisons).toBe(1);
    expect(body.counts.importanceReports).toBe(1);
    expect(body.counts.logFiles).toBe(1);
    expect(body.readiness.releaseReady).toBe(true);
  });
});
