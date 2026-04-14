import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildOpenpraQuantumRecoveryFromCandidateDir } from "quantum-readiness";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface RecoveryHttpResponse {
  modelId: string;
  candidateRootNodeId: string;
  integrationRecommendation: {
    primaryMode: string;
    requiresOperatorAttention: boolean;
  };
  recoveryTier1ExactHardware: {
    recoveredExactCutSetCount: number;
  };
  recoveryTier3UnionSensitivity: {
    unionRecoveredCount: number;
    allRecoveredInUnion: boolean;
  };
}

interface RecoveryBatchHttpResponse {
  caseCount: number;
  exactHardwareRecoveryCaseCount: number;
  unionSensitivityRecoveryCaseCount: number;
  operatorAttentionRequiredCaseCount: number;
  cases: Array<{
    label: string;
    primaryMode: string;
  }>;
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
    candidateRootNodeId: candidateRootNodeId,
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

describe("QuantumReadiness HTTP recovery", () => {
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

  it("POST /api/quantum-readiness/recovery/candidate-dir returns a structured recovery result", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qr-http-single-"));
    const candidateDir = path.join(tempRoot, "0001_phase2b_row_test");
    fs.mkdirSync(candidateDir, { recursive: true });

    makeCandidateArtifacts(candidateDir, "phase2b_row_test", "G:GTEST");

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/recovery/candidate-dir")
      .send({ candidateDir })
      .expect(200);

    const body = response.body as RecoveryHttpResponse;

    expect(body.modelId).toBe("phase2b_row_test");
    expect(body.candidateRootNodeId).toBe("G:GTEST");
    expect(body.integrationRecommendation.primaryMode).toBe("exact_hardware_recovery");
    expect(body.integrationRecommendation.requiresOperatorAttention).toBe(false);
    expect(body.recoveryTier1ExactHardware.recoveredExactCutSetCount).toBe(2);
    expect(body.recoveryTier3UnionSensitivity.unionRecoveredCount).toBe(2);
    expect(body.recoveryTier3UnionSensitivity.allRecoveredInUnion).toBe(true);
  });

  it("POST /api/quantum-readiness/recovery/batch-root returns a batch rollup from package results", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qr-http-batch-"));
    const candidateA = path.join(tempRoot, "0001_phase2b_row_a");
    const candidateB = path.join(tempRoot, "0002_phase2b_row_b");
    fs.mkdirSync(candidateA, { recursive: true });
    fs.mkdirSync(candidateB, { recursive: true });

    makeCandidateArtifacts(candidateA, "phase2b_row_a", "G:GA");
    makeCandidateArtifacts(candidateB, "phase2b_row_b", "G:GB");
    makePackageRecoveryResult(candidateA);
    makePackageRecoveryResult(candidateB);

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/recovery/batch-root")
      .send({
        batchRoot: tempRoot,
        selectionMode: "package_result_only",
      })
      .expect(200);

    const body = response.body as RecoveryBatchHttpResponse;

    expect(body.caseCount).toBe(2);
    expect(body.exactHardwareRecoveryCaseCount).toBe(2);
    expect(body.unionSensitivityRecoveryCaseCount).toBe(0);
    expect(body.operatorAttentionRequiredCaseCount).toBe(0);
    expect(body.cases.map((row) => row.label)).toEqual(["0001_phase2b_row_a", "0002_phase2b_row_b"]);
    expect(body.cases.map((row) => row.primaryMode)).toEqual(["exact_hardware_recovery", "exact_hardware_recovery"]);
  });

  it("POST /api/quantum-readiness/recovery/candidate-dir returns 404 when the candidate directory is missing", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/recovery/candidate-dir")
      .send({
        candidateDir: "/definitely/not/a/real/candidate/dir",
      })
      .expect(404);

    expect(response.body.message).toMatch(/candidateDir does not exist/i);
  });
});
