import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { buildOpenpraQuantumRecoveryFromCandidateDir } from "quantum-readiness";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { cloneOpenPraFixture, openPraNormalizedCase1 } from "../src/quantumReadiness/openPraFaultTreeGraph.fixtures";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface FullPipelineWorkflowByIdHttpResponse {
  workflowRun: {
    workflowRunDir: string;
    manifestPath: string;
    directories: {
      preparation: string;
      execution: string;
      recovery: string;
      batch: string;
    };
  };
  preparationWrite?: {
    bundlePath: string;
    artifactPaths: string[];
  };
  executionWrite?: {
    executionArtifactPath: string;
    provenanceManifestPath: string;
  };
  recoveryWrite?: {
    recoveryArtifactPath: string;
  };
  batchWrite?: {
    recoveryBatchRollupPath: string;
  };
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function makeCandidateArtifacts(candidateDir: string, modelId: string, candidateRootNodeId: string): void {
  writeJson(path.join(candidateDir, "package_metadata.json"), {
    model_id: modelId,
    candidate_root_node_id: candidateRootNodeId,
    topology_class: "A",
    basic_event_count: 3,
    required_qubits: 3,
  });

  writeJson(path.join(candidateDir, "raw_counts.json"), {
    model_id: modelId,
    candidate_root_node_id: candidateRootNodeId,
    topology_class: "A",
    basic_event_count: 3,
    required_qubits: 3,
    ordered_basic_event_ids: ["A", "B", "C"],
    bitstring_convention: "declared_order",
    counts: {
      "100": 50,
      "011": 30,
      "000": 20,
    },
    shots_total: 100,
  });

  writeJson(path.join(candidateDir, "classical_reference_mcs.json"), {
    modelId,
    candidateRootNodeId,
    frozenMcsReference: {
      minimalCutSetCount: 2,
      basicEventIdSets: [["A"], ["B", "C"]],
      bitstrings: ["100", "011"],
    },
  });
}

function makePackageRecoveryResult(candidateDir: string): void {
  const result = buildOpenpraQuantumRecoveryFromCandidateDir(candidateDir);
  writeJson(path.join(candidateDir, "openpra_package_recovery_result_v1.json"), result);
}

describe("QuantumReadiness HTTP full pipeline workflow run by id", () => {
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

  beforeEach(() => {
    graphModelServiceMock.getFaultTreeGraph.mockReset();
  });

  it("POST /api/quantum-readiness/workflow/full-pipeline-run/by-id creates scaffold and writes all available pipeline artifacts from stored graph", async () => {
    graphModelServiceMock.getFaultTreeGraph.mockResolvedValue(cloneOpenPraFixture(openPraNormalizedCase1));

    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-full-pipeline-by-id-root-"));

    const candidateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qr-full-pipeline-by-id-candidate-"));
    const recoveryCandidateDir = path.join(candidateRoot, "0001_phase2b_row_test");
    fs.mkdirSync(recoveryCandidateDir, { recursive: true });
    makeCandidateArtifacts(recoveryCandidateDir, "phase2b_row_test", "G:GTEST");

    const batchRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qr-full-pipeline-by-id-batch-"));
    const candidateA = path.join(batchRoot, "0001_phase2b_row_a");
    const candidateB = path.join(batchRoot, "0002_phase2b_row_b");
    fs.mkdirSync(candidateA, { recursive: true });
    fs.mkdirSync(candidateB, { recursive: true });

    makeCandidateArtifacts(candidateA, "phase2b_row_a", "G:GA");
    makeCandidateArtifacts(candidateB, "phase2b_row_b", "G:GB");
    makePackageRecoveryResult(candidateA);
    makePackageRecoveryResult(candidateB);

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/workflow/full-pipeline-run/by-id")
      .send({
        rootDir,
        faultTreeId: "openpra_graph_case_1",
        subtreeId: "TOP",
        modelName: "Full Pipeline By Id Graph",
        executionRequest: {
          modelId: "openpra_graph_case_1",
          subtreeId: "TOP",
          sourcePreparationArtifactId: "preparation:openpra_graph_case_1:TOP:abc",
          providerType: "simulator",
          providerName: "qiskit-aer",
          backendName: "aer_simulator",
          executionMode: "counts_only",
          shots: 100,
          rawCounts: {
            "000": 10,
            "011": 30,
            "100": 60,
          },
        },
        recoveryCandidateDir,
        recoveryBatch: {
          batchRoot,
          selectionMode: "package_result_only",
        },
      })
      .expect(200);

    const body = response.body as FullPipelineWorkflowByIdHttpResponse;

    expect(graphModelServiceMock.getFaultTreeGraph).toHaveBeenCalledWith("openpra_graph_case_1");

    expect(fs.existsSync(body.workflowRun.workflowRunDir)).toBe(true);
    expect(fs.existsSync(body.workflowRun.manifestPath)).toBe(true);
    expect(fs.existsSync(body.workflowRun.directories.preparation)).toBe(true);
    expect(fs.existsSync(body.workflowRun.directories.execution)).toBe(true);
    expect(fs.existsSync(body.workflowRun.directories.recovery)).toBe(true);
    expect(fs.existsSync(body.workflowRun.directories.batch)).toBe(true);

    expect(body.preparationWrite).toBeDefined();
    expect(fs.existsSync(body.preparationWrite!.bundlePath)).toBe(true);
    expect(body.preparationWrite!.artifactPaths.length).toBeGreaterThan(0);

    expect(body.executionWrite).toBeDefined();
    expect(fs.existsSync(body.executionWrite!.executionArtifactPath)).toBe(true);
    expect(fs.existsSync(body.executionWrite!.provenanceManifestPath)).toBe(true);

    expect(body.recoveryWrite).toBeDefined();
    expect(fs.existsSync(body.recoveryWrite!.recoveryArtifactPath)).toBe(true);

    expect(body.batchWrite).toBeDefined();
    expect(fs.existsSync(body.batchWrite!.recoveryBatchRollupPath)).toBe(true);
  });
});
