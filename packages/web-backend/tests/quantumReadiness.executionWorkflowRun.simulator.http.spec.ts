import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface ExecutionWorkflowRunHttpResponse {
  workflowRun: {
    workflowRunDir: string;
    manifestPath: string;
    directories: {
      execution: string;
    };
  };
  executionWrite: {
    executionArtifactPath: string;
    provenanceManifestPath: string;
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
    modelName: "HTTP Simulator Execution Graph",
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

describe("QuantumReadiness HTTP execution workflow run through simulator mode", () => {
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

  it("POST /api/quantum-readiness/workflow/execution-run writes simulator-backed execution artifacts", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-execution-simulator-root-"));
    const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-execution-simulator-artifact-"));
    const sourcePreparationArtifactId = "preparation:http_exec_sim_1:TOP:abc";
    const preparationArtifactPath = makePreparationArtifactFile(
      artifactDir,
      "http_exec_sim_1",
      "TOP",
      sourcePreparationArtifactId,
    );

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/workflow/execution-run")
      .send({
        rootDir,
        inputMode: "simulator_local",
        modelId: "http_exec_sim_1",
        subtreeId: "TOP",
        sourcePreparationArtifactId,
        preparationArtifactPath,
        shots: 7,
        samplingMode: "synthetic_exact_mcs",
      })
      .expect(200);

    const body = response.body as ExecutionWorkflowRunHttpResponse;

    expect(fs.existsSync(body.workflowRun.workflowRunDir)).toBe(true);
    expect(fs.existsSync(body.workflowRun.manifestPath)).toBe(true);
    expect(fs.existsSync(body.workflowRun.directories.execution)).toBe(true);
    expect(fs.existsSync(body.executionWrite.executionArtifactPath)).toBe(true);
    expect(fs.existsSync(body.executionWrite.provenanceManifestPath)).toBe(true);

    const executionArtifact = JSON.parse(fs.readFileSync(body.executionWrite.executionArtifactPath, "utf8")) as {
      providerType: string;
      executionMode: string;
      shots: number;
      sourcePreparationArtifactId: string;
      rawCounts: Record<string, number>;
    };

    expect(executionArtifact.providerType).toBe("simulator");
    expect(executionArtifact.executionMode).toBe("simulator_local_bounded");
    expect(executionArtifact.shots).toBe(7);
    expect(executionArtifact.sourcePreparationArtifactId).toBe(sourcePreparationArtifactId);
    expect(executionArtifact.rawCounts).toEqual({
      "011": 4,
      "100": 3,
    });
  });
});
