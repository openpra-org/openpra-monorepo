import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface WorkflowReleaseBundleWriteHttpResponse {
  outputDir: string;
  bundleDir: string;
  summaryPath: string;
  manifestCopyPath: string | null;
  releaseSummaryPath: string;
  releaseManifestPath: string;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

describe("QuantumReadiness HTTP workflow release bundle write", () => {
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

  it("POST /api/quantum-readiness/release/workflow-bundle/write writes a release bundle", async () => {
    const workflowRunDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-release-bundle-run-"));
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-release-bundle-out-"));

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

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/release/workflow-bundle/write")
      .send({
        workflowRunDir,
        outputDir,
      })
      .expect(200);

    const body = response.body as WorkflowReleaseBundleWriteHttpResponse;

    expect(body.outputDir).toBe(outputDir);
    expect(fs.existsSync(body.bundleDir)).toBe(true);
    expect(fs.existsSync(body.releaseSummaryPath)).toBe(true);
    expect(fs.existsSync(body.releaseManifestPath)).toBe(true);
    expect(body.manifestCopyPath).not.toBeNull();
    expect(fs.existsSync(body.manifestCopyPath as string)).toBe(true);
  });
});
