import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface ExecutionArtifactHttpResponse {
  executionArtifact: {
    schemaVersion: string;
    artifactType: string;
    modelId: string;
    subtreeId: string;
    sourcePreparationArtifactId: string;
    providerType: string;
    providerName: string;
    backendName: string;
    executionMode: string;
    shots: number;
    rawCounts: Record<string, number>;
  };
  provenanceManifest: {
    artifactType: string;
    relatedArtifactIds: string[];
    acceptanceGateResults: {
      hasPreparationArtifactReference: boolean;
      hasRawCounts: boolean;
      shotsMatchRawCountsTotal: boolean;
    };
  };
}

describe("QuantumReadiness HTTP execution artifacts", () => {
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

  it("POST /api/quantum-readiness/execution/artifacts/raw-counts returns contract-shaped execution and provenance artifacts", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/execution/artifacts/raw-counts")
      .send({
        modelId: "phase2b_row_0001",
        subtreeId: "TOP",
        sourcePreparationArtifactId: "preparation:phase2b_row_0001:TOP:abc",
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
      })
      .expect(200);

    const body = response.body as ExecutionArtifactHttpResponse;

    expect(body.executionArtifact.schemaVersion).toBe("1.0.0");
    expect(body.executionArtifact.artifactType).toBe("execution");
    expect(body.executionArtifact.modelId).toBe("phase2b_row_0001");
    expect(body.executionArtifact.subtreeId).toBe("TOP");
    expect(body.executionArtifact.sourcePreparationArtifactId).toBe("preparation:phase2b_row_0001:TOP:abc");
    expect(body.executionArtifact.providerType).toBe("simulator");
    expect(body.executionArtifact.providerName).toBe("qiskit-aer");
    expect(body.executionArtifact.backendName).toBe("aer_simulator");
    expect(body.executionArtifact.executionMode).toBe("counts_only");
    expect(body.executionArtifact.shots).toBe(100);
    expect(body.executionArtifact.rawCounts).toEqual({
      "000": 10,
      "011": 30,
      "100": 60,
    });

    expect(body.provenanceManifest.artifactType).toBe("provenance_manifest");
    expect(body.provenanceManifest.relatedArtifactIds).toContain(body.executionArtifact.artifactId);
    expect(body.provenanceManifest.relatedArtifactIds).toContain("preparation:phase2b_row_0001:TOP:abc");
    expect(body.provenanceManifest.acceptanceGateResults).toEqual({
      hasPreparationArtifactReference: true,
      hasRawCounts: true,
      shotsMatchRawCountsTotal: true,
    });
  });
});
