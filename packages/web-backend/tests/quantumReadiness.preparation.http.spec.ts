import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";
import {
  cloneOpenPraFixture,
  openPraNormalizedCase1,
  openPraNormalizedCase2UnsupportedNot,
} from "../src/quantumReadiness/openPraFaultTreeGraph.fixtures";

interface PreparationHttpResponse {
  modelId: string;
  modelName: string;
  sourceFormat: string;
  totalCandidateSubtrees: number;
  totalQuantumTractableCandidates: number;
  topologyClassCounts?: {
    A: number;
    B: number;
    C: number;
    D: number;
    unclassified: number;
  };
  requirementsMatrixMatchedCandidateIds?: string[];
  recommendedExecutionPriorityCandidateIds?: string[];
  preparationCandidates: Array<{
    candidateRootNodeId: string;
    orderedBasicEventIds: string[];
    orderedGateNodeIds: string[];
    orderedSubtreeNodeIds: string[];
    candidateRootGateType?: string;
    topologyClassification?: {
      topologyClass: string;
      classificationRuleVersion: string;
    };
    requirementsAssessment?: {
      requiredQubits: number;
      matrixEntryMatched: boolean;
      preferredDepthP: number;
      avoidRL1: boolean;
      preferredAlgorithm: string;
      executionPriority: string;
      matrixEntry?: {
        topologyClass: string;
        nBasic: number;
        requiredQubits: number;
        estimatedDepthP1: number;
        estimatedDepthP2: number;
        thresholdStatus: string;
        evidenceTier: string;
      };
      hardwareCompatibility: Array<{
        platformId: string;
        platformLabel: string;
        publishedQubitCount: number;
        qubitFit: boolean;
      }>;
    };
  }>;
}

describe("QuantumReadiness preparation HTTP", () => {
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

  it("POST /api/quantum-readiness/fault-tree-graph/preparation exports tractable preparation candidates", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/fault-tree-graph/preparation")
      .send({
        graph: cloneOpenPraFixture(openPraNormalizedCase1),
        modelName: "HTTP Preparation Graph",
      })
      .expect(200);

    const body = response.body as PreparationHttpResponse;

    expect(body.modelId).toBe("openpra_graph_case_1");
    expect(body.totalCandidateSubtrees).toBe(2);
    expect(body.totalQuantumTractableCandidates).toBe(2);
    expect(body.preparationCandidates.map((candidate) => candidate.candidateRootNodeId)).toEqual(["G1", "TOP"]);

    const top = body.preparationCandidates.find((candidate) => candidate.candidateRootNodeId === "TOP");

    expect(top?.orderedBasicEventIds).toEqual(["A", "B", "C"]);
    expect(top?.orderedGateNodeIds).toEqual(["G1", "TOP"]);
  });

  it("POST /api/quantum-readiness/fault-tree-graph/preparation accepts top-level analysis and returns requirements matrix fields for the existing toy case", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/fault-tree-graph/preparation")
      .send({
        graph: cloneOpenPraFixture(openPraNormalizedCase1),
        modelName: "HTTP Preparation Graph With Requirements",
        analysis: {
          includeRequirementsMatrix: true,
        },
      })
      .expect(200);

    const body = response.body as PreparationHttpResponse;

    expect(body.modelId).toBe("openpra_graph_case_1");
    expect(body.topologyClassCounts).toEqual({
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      unclassified: 2,
    });
    expect(body.requirementsMatrixMatchedCandidateIds).toEqual([]);
    expect(body.recommendedExecutionPriorityCandidateIds).toEqual([]);

    expect(body.preparationCandidates.map((candidate) => candidate.candidateRootNodeId)).toEqual(["G1", "TOP"]);

    for (const candidate of body.preparationCandidates) {
      expect(candidate.topologyClassification?.topologyClass).toBe("unclassified");
      expect(candidate.requirementsAssessment?.requiredQubits).toBeGreaterThan(0);
      expect(candidate.requirementsAssessment?.matrixEntryMatched).toBe(false);
      expect(candidate.requirementsAssessment?.preferredDepthP).toBe(1);
      expect(candidate.requirementsAssessment?.avoidRL1).toBe(true);
      expect(candidate.requirementsAssessment?.preferredAlgorithm).toBe("QAOA+");
      expect(candidate.requirementsAssessment?.executionPriority).toBe("unknown");
      expect(candidate.requirementsAssessment?.hardwareCompatibility).toHaveLength(4);
    }
  });

  it("POST /api/quantum-readiness/fault-tree-graph/preparation returns a positive A5 matrix hit for the synthetic verification graph", async () => {
    const syntheticTopologyA5Graph = {
      faultTreeId: "synthetic_topology_a_n5_case",
      nodes: [
        {
          id: "TOP",
          type: "gate",
          position: { x: 0, y: 0 },
          data: {
            label: { name: "Top Gate" },
            gateType: "OR",
            isTop: true,
          },
        },
        {
          id: "G1",
          type: "gate",
          position: { x: -150, y: 100 },
          data: {
            label: { name: "Gate 1" },
            gateType: "AND",
          },
        },
        {
          id: "G2",
          type: "gate",
          position: { x: 0, y: 100 },
          data: {
            label: { name: "Gate 2" },
            gateType: "AND",
          },
        },
        {
          id: "E",
          type: "basicEvent",
          position: { x: 150, y: 100 },
          data: {
            label: { name: "Basic Event E" },
          },
        },
        {
          id: "A",
          type: "basicEvent",
          position: { x: -200, y: 200 },
          data: {
            label: { name: "Basic Event A" },
          },
        },
        {
          id: "B",
          type: "basicEvent",
          position: { x: -100, y: 200 },
          data: {
            label: { name: "Basic Event B" },
          },
        },
        {
          id: "C",
          type: "basicEvent",
          position: { x: -50, y: 200 },
          data: {
            label: { name: "Basic Event C" },
          },
        },
        {
          id: "D",
          type: "basicEvent",
          position: { x: 50, y: 200 },
          data: {
            label: { name: "Basic Event D" },
          },
        },
      ],
      edges: [
        {
          id: "e1",
          source: "TOP",
          target: "G1",
          type: "default",
          data: {},
          animated: false,
        },
        {
          id: "e2",
          source: "TOP",
          target: "G2",
          type: "default",
          data: {},
          animated: false,
        },
        {
          id: "e3",
          source: "TOP",
          target: "E",
          type: "default",
          data: {},
          animated: false,
        },
        {
          id: "e4",
          source: "G1",
          target: "A",
          type: "default",
          data: {},
          animated: false,
        },
        {
          id: "e5",
          source: "G1",
          target: "B",
          type: "default",
          data: {},
          animated: false,
        },
        {
          id: "e6",
          source: "G2",
          target: "C",
          type: "default",
          data: {},
          animated: false,
        },
        {
          id: "e7",
          source: "G2",
          target: "D",
          type: "default",
          data: {},
          animated: false,
        },
      ],
    };

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/fault-tree-graph/preparation")
      .send({
        graph: syntheticTopologyA5Graph,
        modelName: "Synthetic Topology A5 HTTP Graph",
        analysis: {
          includeRequirementsMatrix: true,
        },
      })
      .expect(200);

    const body = response.body as PreparationHttpResponse;

    expect(body.modelId).toBe("synthetic_topology_a_n5_case");
    expect(body.totalCandidateSubtrees).toBe(3);
    expect(body.totalQuantumTractableCandidates).toBe(3);
    expect(body.topologyClassCounts).toEqual({
      A: 1,
      B: 0,
      C: 0,
      D: 0,
      unclassified: 2,
    });
    expect(body.requirementsMatrixMatchedCandidateIds).toEqual(["TOP"]);
    expect(body.recommendedExecutionPriorityCandidateIds).toEqual(["TOP"]);
    expect(body.preparationCandidates.map((candidate) => candidate.candidateRootNodeId)).toEqual(["G1", "G2", "TOP"]);

    const top = body.preparationCandidates.find((candidate) => candidate.candidateRootNodeId === "TOP");

    expect(top?.topologyClassification?.topologyClass).toBe("A");
    expect(top?.requirementsAssessment?.matrixEntryMatched).toBe(true);
    expect(top?.requirementsAssessment?.matrixEntry).toEqual({
      topologyClass: "A",
      nBasic: 5,
      requiredQubits: 5,
      estimatedDepthP1: 305,
      estimatedDepthP2: 514,
      thresholdStatus: "favorable",
      evidenceTier: "projected",
    });
    expect(top?.requirementsAssessment?.preferredDepthP).toBe(1);
    expect(top?.requirementsAssessment?.avoidRL1).toBe(true);
    expect(top?.requirementsAssessment?.preferredAlgorithm).toBe("QAOA+");
    expect(top?.requirementsAssessment?.executionPriority).toBe("high");
    expect(top?.requirementsAssessment?.hardwareCompatibility).toHaveLength(4);

    for (const row of top?.requirementsAssessment?.hardwareCompatibility ?? []) {
      expect(row.qubitFit).toBe(true);
    }

    const g1 = body.preparationCandidates.find((candidate) => candidate.candidateRootNodeId === "G1");
    const g2 = body.preparationCandidates.find((candidate) => candidate.candidateRootNodeId === "G2");

    expect(g1?.requirementsAssessment?.matrixEntryMatched).toBe(false);
    expect(g1?.requirementsAssessment?.executionPriority).toBe("unknown");
    expect(g2?.requirementsAssessment?.matrixEntryMatched).toBe(false);
    expect(g2?.requirementsAssessment?.executionPriority).toBe("unknown");
  });

  it("POST /api/quantum-readiness/fault-tree-graph/preparation exports no candidates for unsupported NOT", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/fault-tree-graph/preparation")
      .send({
        graph: cloneOpenPraFixture(openPraNormalizedCase2UnsupportedNot),
        modelName: "HTTP Preparation Unsupported Graph",
      })
      .expect(200);

    const body = response.body as PreparationHttpResponse;

    expect(body.modelId).toBe("openpra_graph_case_2");
    expect(body.totalCandidateSubtrees).toBe(1);
    expect(body.totalQuantumTractableCandidates).toBe(0);
    expect(body.preparationCandidates).toEqual([]);
  });

  it("POST /api/quantum-readiness/fault-tree-graph/by-id/preparation exports stored preparation candidates", async () => {
    graphModelServiceMock.getFaultTreeGraph.mockResolvedValue(cloneOpenPraFixture(openPraNormalizedCase1));

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/fault-tree-graph/by-id/preparation")
      .send({
        faultTreeId: "openpra_graph_case_1",
        modelName: "Stored HTTP Preparation Graph",
      })
      .expect(200);

    const body = response.body as PreparationHttpResponse;

    expect(graphModelServiceMock.getFaultTreeGraph).toHaveBeenCalledWith("openpra_graph_case_1");
    expect(body.modelId).toBe("openpra_graph_case_1");
    expect(body.totalQuantumTractableCandidates).toBe(2);
    expect(body.preparationCandidates.map((candidate) => candidate.candidateRootNodeId)).toEqual(["G1", "TOP"]);
  });
});
