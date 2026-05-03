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

interface FullPipelineWorkflowRunHttpResponse {
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

function makePreparationArtifactFile(
  artifactDir: string,
  modelId: string,
  subtreeId: string,
  artifactId: string,
): string {
  const artifactPath = path.join(artifactDir, `openpra_quantum_preparation_artifact_${subtreeId}.json`);

  writeJson(artifactPath, {
    schemaVersion: "1.0.0",
    artifactType: "preparation",
    artifactId,
    createdAtUtc: "2026-04-16T00:00:00.000Z",
    createdBy: "jest:test",
    inputReferences: [],
    sourceHashes: {},
    notes: [],
    modelId,
    modelName: "HTTP Simulator Full Pipeline Graph",
    sourceFormat: "openpra_fault_tree_graph",
    subtreeId,
    rootGateId: subtreeId,
    topologyClass: "A",
    orderedBasicEventIds: ["A", "B", "C"],
    variableMap: {
      x0: "A",
      x1: "B",
      x2: "C",
    },
    clQuboEncoding: {
      exportSliceVersion: "v1",
      costMatrix: [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      frozenMcsReference: {
        minimalCutSetCount: 2,
        basicEventIdSets: [["A"], ["B", "C"]],
        bitstrings: ["100", "011"],
      },
    },
    qaoaRecipe: {
      parameterDefaults: {
        beta: 0.2,
        gamma: 0.2,
      },
      initialState: {
        feasibleBasisStateBitstrings: ["100", "011"],
      },
      mixer: {
        feasibleBasisStateBitstrings: ["100", "011"],
      },
    },
    backendEligibility: [],
    statevectorVerificationResult: {
      verificationEligible: true,
      maxInfeasibleMass: 0,
    },
    moduleVersion: "jest:test",
  });

  return artifactPath;
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

describe("QuantumReadiness HTTP full pipeline workflow run through simulator mode", () => {
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

  it("POST /api/quantum-readiness/workflow/full-pipeline-run writes preparation, simulator execution, recovery, and batch artifacts", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-full-pipeline-simulator-root-"));

    const preparationArtifactDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-full-pipeline-simulator-prep-"));
    const sourcePreparationArtifactId = "preparation:http_full_sim_1:TOP:abc";
    const preparationArtifactPath = makePreparationArtifactFile(
      preparationArtifactDir,
      "http_full_sim_1",
      "TOP",
      sourcePreparationArtifactId,
    );

    const recoveryCandidateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qr-full-pipeline-simulator-candidate-"));
    const recoveryCandidateDir = path.join(recoveryCandidateRoot, "0001_http_full_sim_1");
    fs.mkdirSync(recoveryCandidateDir, { recursive: true });
    makeCandidateArtifacts(recoveryCandidateDir, "http_full_sim_1", "G:GTEST");

    const batchRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qr-full-pipeline-simulator-batch-"));
    const candidateA = path.join(batchRoot, "0001_http_full_sim_a");
    const candidateB = path.join(batchRoot, "0002_http_full_sim_b");
    fs.mkdirSync(candidateA, { recursive: true });
    fs.mkdirSync(candidateB, { recursive: true });
    makeCandidateArtifacts(candidateA, "http_full_sim_a", "G:GA");
    makeCandidateArtifacts(candidateB, "http_full_sim_b", "G:GB");
    makePackageRecoveryResult(candidateA);
    makePackageRecoveryResult(candidateB);

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/workflow/full-pipeline-run")
      .send({
        rootDir,
        modelId: "http_full_sim_1",
        subtreeId: "TOP",
        modelName: "HTTP Simulator Full Pipeline Graph",
        graph: cloneOpenPraFixture(openPraNormalizedCase1),
        executionRequest: {
          inputMode: "simulator_local",
          modelId: "http_full_sim_1",
          subtreeId: "TOP",
          sourcePreparationArtifactId,
          preparationArtifactPath,
          shots: 7,
          samplingMode: "synthetic_exact_mcs",
        },
        recoveryCandidateDir,
        recoveryBatch: {
          batchRoot,
          selectionMode: "package_result_only",
        },
      })
      .expect(200);

    const body = response.body as FullPipelineWorkflowRunHttpResponse;

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

    const executionArtifact = JSON.parse(fs.readFileSync(body.executionWrite!.executionArtifactPath, "utf8")) as {
      providerType: string;
      executionMode: string;
      shots: number;
      rawCounts: Record<string, number>;
    };

    expect(executionArtifact.providerType).toBe("simulator");
    expect(executionArtifact.executionMode).toBe("simulator_local_bounded");
    expect(executionArtifact.shots).toBe(7);
    expect(executionArtifact.rawCounts).toEqual({
      "011": 4,
      "100": 3,
    });

    expect(body.recoveryWrite).toBeDefined();
    expect(fs.existsSync(body.recoveryWrite!.recoveryArtifactPath)).toBe(true);

    expect(body.batchWrite).toBeDefined();
    expect(fs.existsSync(body.batchWrite!.recoveryBatchRollupPath)).toBe(true);
  });
});
