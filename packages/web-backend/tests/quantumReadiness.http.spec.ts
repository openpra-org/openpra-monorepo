import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface HttpReadinessResponse {
  normalizedFaultTree: {
    id: string;
    topNodeId: string;
  };
  report: {
    summary: {
      totalCandidateSubtrees: number;
      totalQuantumTractableCandidates: number;
    };
    candidates: Array<{
      quantumTractable: boolean;
    }>;
  };
  summaryMarkdown: string;
}

describe("QuantumReadiness HTTP", () => {
  let app: INestApplication;
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock };

  beforeAll(async () => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn()
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        QuantumReadinessService,
        {
          provide: GraphModelService,
          useValue: graphModelServiceMock
        }
      ]
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

  it("POST /api/quantum-readiness/fault-tree-graph returns readiness outputs", async () => {
    const payload = {
      graph: {
        faultTreeId: "http_ft_1",
        nodes: [
          {
            id: "TOP",
            type: "gate",
            position: { x: 0, y: 0 },
            data: {
              label: { name: "Top Gate" },
              gateType: "OR",
              isTop: true
            }
          },
          {
            id: "A",
            type: "basicEvent",
            position: { x: -100, y: 100 },
            data: {
              label: { name: "Basic Event A" }
            }
          },
          {
            id: "B",
            type: "basicEvent",
            position: { x: 100, y: 100 },
            data: {
              label: { name: "Basic Event B" }
            }
          }
        ],
        edges: [
          {
            id: "e1",
            source: "TOP",
            target: "A",
            type: "default",
            data: {},
            animated: false
          },
          {
            id: "e2",
            source: "TOP",
            target: "B",
            type: "default",
            data: {},
            animated: false
          }
        ]
      },
      modelName: "HTTP Graph"
    };

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/fault-tree-graph")
      .send(payload)
      .expect(200);

    const body = response.body as HttpReadinessResponse;

    expect(body.normalizedFaultTree.id).toBe("http_ft_1");
    expect(body.normalizedFaultTree.topNodeId).toBe("TOP");
    expect(body.report.summary.totalCandidateSubtrees).toBe(1);
    expect(body.report.summary.totalQuantumTractableCandidates).toBe(1);
    expect(body.summaryMarkdown).toContain("# Quantum Readiness Summary");
  });

  it("POST /api/quantum-readiness/fault-tree-graph returns excluded result for tight limits", async () => {
    const payload = {
      graph: {
        faultTreeId: "http_ft_2",
        nodes: [
          {
            id: "TOP",
            type: "gate",
            position: { x: 0, y: 0 },
            data: {
              label: { name: "Top Gate" },
              gateType: "OR",
              isTop: true
            }
          },
          {
            id: "A",
            type: "basicEvent",
            position: { x: -100, y: 100 },
            data: {
              label: { name: "Basic Event A" }
            }
          },
          {
            id: "B",
            type: "basicEvent",
            position: { x: 0, y: 100 },
            data: {
              label: { name: "Basic Event B" }
            }
          },
          {
            id: "C",
            type: "basicEvent",
            position: { x: 100, y: 100 },
            data: {
              label: { name: "Basic Event C" }
            }
          }
        ],
        edges: [
          {
            id: "e1",
            source: "TOP",
            target: "A",
            type: "default",
            data: {},
            animated: false
          },
          {
            id: "e2",
            source: "TOP",
            target: "B",
            type: "default",
            data: {},
            animated: false
          },
          {
            id: "e3",
            source: "TOP",
            target: "C",
            type: "default",
            data: {},
            animated: false
          }
        ]
      },
      modelName: "HTTP Tight Limit",
      options: {
        analysis: {
          maxBasicEvents: 2
        }
      }
    };

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/fault-tree-graph")
      .send(payload)
      .expect(200);

    const body = response.body as HttpReadinessResponse;

    expect(body.report.summary.totalCandidateSubtrees).toBe(1);
    expect(body.report.summary.totalQuantumTractableCandidates).toBe(0);
    expect(body.report.candidates[0]?.quantumTractable).toBe(false);
  });

  it("POST /api/quantum-readiness/fault-tree-graph/by-id returns readiness outputs", async () => {
    graphModelServiceMock.getFaultTreeGraph.mockResolvedValue({
      faultTreeId: "stored_http_ft_1",
      nodes: [
        {
          id: "TOP",
          type: "gate",
          position: { x: 0, y: 0 },
          data: {
            label: { name: "Top Gate" },
            gateType: "OR",
            isTop: true
          }
        },
        {
          id: "A",
          type: "basicEvent",
          position: { x: 0, y: 100 },
          data: {
            label: { name: "Basic Event A" }
          }
        }
      ],
      edges: [
        {
          id: "e1",
          source: "TOP",
          target: "A",
          type: "default",
          data: {},
          animated: false
        }
      ]
    });

    const response = await request(app.getHttpServer())
      .post("/api/quantum-readiness/fault-tree-graph/by-id")
      .send({
        faultTreeId: "stored_http_ft_1",
        modelName: "Stored HTTP Graph"
      })
      .expect(200);

    const body = response.body as HttpReadinessResponse;

    expect(graphModelServiceMock.getFaultTreeGraph).toHaveBeenCalledWith("stored_http_ft_1");
    expect(body.normalizedFaultTree.id).toBe("stored_http_ft_1");
    expect(body.report.summary.totalCandidateSubtrees).toBe(1);
    expect(body.report.summary.totalQuantumTractableCandidates).toBe(1);
  });

  it("POST /api/quantum-readiness/fault-tree-graph/by-id returns 404 when no graph exists", async () => {
    graphModelServiceMock.getFaultTreeGraph.mockResolvedValue({
      faultTreeId: "missing_http_ft",
      nodes: [],
      edges: []
    });

    await request(app.getHttpServer())
      .post("/api/quantum-readiness/fault-tree-graph/by-id")
      .send({
        faultTreeId: "missing_http_ft"
      })
      .expect(404);
  });
});
