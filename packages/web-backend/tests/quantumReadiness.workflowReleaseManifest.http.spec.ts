import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface WorkflowReleaseManifestHttpResponse {
  workflowRunDir: string;
  artifacts: {
    preparationBundles: string[];
    executionArtifacts: string[];
    executionProvenance: string[];
    recoveryArtifacts: string[];
    importanceComparisons: string[];
    importanceReports: string[];
    logFiles: string[];
  };
  releaseSummary: {
    readiness: {
      releaseReady: boolean;
    };
  };
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

describe("QuantumReadiness HTTP workflow release manifest", () => {
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

  it("POST /api/quantum-readiness/release/workflow-manifest returns release artifact paths", async () => {
    const workflowRunDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-release-manifest-"));

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
      .post("/api/quantum-readiness/release/workflow-manifest")
      .send({
        workflowRunDir,
      })
      .expect(200);

    const body = response.body as WorkflowReleaseManifestHttpResponse;

    expect(body.workflowRunDir).toBe(workflowRunDir);
    expect(body.artifacts.preparationBundles.length).toBe(1);
    expect(body.artifacts.executionArtifacts.length).toBe(1);
    expect(body.artifacts.executionProvenance.length).toBe(1);
    expect(body.artifacts.recoveryArtifacts.length).toBe(1);
    expect(body.artifacts.importanceComparisons.length).toBe(1);
    expect(body.artifacts.importanceReports.length).toBe(1);
    expect(body.artifacts.logFiles.length).toBe(1);
    expect(body.releaseSummary.readiness.releaseReady).toBe(true);
  });
});
