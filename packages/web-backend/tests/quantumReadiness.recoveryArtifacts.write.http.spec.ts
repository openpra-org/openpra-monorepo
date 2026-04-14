import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface RecoveryArtifactsWriteHttpResponse {
  outputDir: string;
  recoveryArtifactPath: string;
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

describe("QuantumReadiness HTTP recovery artifacts write", () => {
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

  it("POST /api/quantum-readiness/recovery/candidate-dir/write writes a recovery artifact file", async () => {
    const candidateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qr-recovery-write-candidate-"));
    const candidateDir = path.join(candidateRoot, "0001_phase2b_row_test");
    fs.mkdirSync(candidateDir, { recursive: true });
    makeCandidateArtifacts(candidateDir, "phase2b_row_test", "G:GTEST");

    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "qr-recovery-write-output-"));

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/recovery/candidate-dir/write")
      .send({
        candidateDir,
        outputDir,
      })
      .expect(200);

    const body = response.body as RecoveryArtifactsWriteHttpResponse;

    expect(fs.existsSync(body.recoveryArtifactPath)).toBe(true);
  });
});
