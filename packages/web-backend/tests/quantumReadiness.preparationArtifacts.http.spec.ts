import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import {
  cloneOpenPraFixture,
  openPraNormalizedCase1,
  openPraNormalizedCase2UnsupportedNot,
} from "../src/quantumReadiness/openPraFaultTreeGraph.fixtures";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface PreparationArtifactBundleHttpResponse {
  schemaVersion: string;
  artifactType: string;
  modelId: string;
  totalCandidateSubtrees: number;
  totalQuantumTractableCandidates: number;
  preparationArtifacts: Array<{
    artifactType: string;
    rootGateId: string;
    subtreeId: string;
    orderedBasicEventIds: string[];
    topologyClass: string;
    clQuboEncoding: {
      exportSliceVersion: string;
    };
    statevectorVerificationResult: {
      eligible: boolean;
    };
  }>;
}

describe("QuantumReadiness HTTP preparation artifacts", () => {
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

  it("POST /api/quantum-readiness/fault-tree-graph/preparation-artifacts returns contract-shaped preparation artifacts", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/fault-tree-graph/preparation-artifacts")
      .send({
        graph: cloneOpenPraFixture(openPraNormalizedCase1),
        modelName: "HTTP Preparation Artifact Graph",
      })
      .expect(200);

    const body = response.body as PreparationArtifactBundleHttpResponse;

    expect(body.schemaVersion).toBe("1.0.0");
    expect(body.artifactType).toBe("preparation_bundle");
    expect(body.modelId).toBe("openpra_graph_case_1");
    expect(body.totalQuantumTractableCandidates).toBe(2);
    expect(body.preparationArtifacts.map((candidate) => candidate.rootGateId)).toEqual(["G1", "TOP"]);

    const top = body.preparationArtifacts.find((candidate) => candidate.rootGateId === "TOP");
    expect(top?.artifactType).toBe("preparation");
    expect(top?.subtreeId).toBe("TOP");
    expect(top?.clQuboEncoding.exportSliceVersion).toBe("phase4-bounded-clqubo-v1");
    expect(top?.orderedBasicEventIds.length).toBeGreaterThan(0);
    expect(top?.statevectorVerificationResult.eligible).toBe(true);
  });

  it("POST /api/quantum-readiness/fault-tree-graph/by-id/preparation-artifacts returns stored contract-shaped preparation artifacts", async () => {
    graphModelServiceMock.getFaultTreeGraph.mockResolvedValue(cloneOpenPraFixture(openPraNormalizedCase1));

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/fault-tree-graph/by-id/preparation-artifacts")
      .send({
        faultTreeId: "openpra_graph_case_1",
        modelName: "Stored HTTP Preparation Artifact Graph",
      })
      .expect(200);

    const body = response.body as PreparationArtifactBundleHttpResponse;

    expect(graphModelServiceMock.getFaultTreeGraph).toHaveBeenCalledWith("openpra_graph_case_1");
    expect(body.modelId).toBe("openpra_graph_case_1");
    expect(body.totalQuantumTractableCandidates).toBe(2);
    expect(body.preparationArtifacts.map((candidate) => candidate.rootGateId)).toEqual(["G1", "TOP"]);
  });

  it("POST /api/quantum-readiness/fault-tree-graph/preparation-artifacts exports no candidates for unsupported NOT", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/fault-tree-graph/preparation-artifacts")
      .send({
        graph: cloneOpenPraFixture(openPraNormalizedCase2UnsupportedNot),
        modelName: "HTTP Preparation Artifact Unsupported Graph",
      })
      .expect(200);

    const body = response.body as PreparationArtifactBundleHttpResponse;

    expect(body.modelId).toBe("openpra_graph_case_2");
    expect(body.totalCandidateSubtrees).toBe(1);
    expect(body.totalQuantumTractableCandidates).toBe(0);
    expect(body.preparationArtifacts).toEqual([]);
  });
});
