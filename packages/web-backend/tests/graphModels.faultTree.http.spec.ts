import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelController } from "../src/graphModels/graphModel.controller";
import { GraphModelService } from "../src/graphModels/graphModel.service";
import { cloneOpenPraFixture, openPraNormalizedCase1 } from "../src/quantumReadiness/openPraFaultTreeGraph.fixtures";

describe("GraphModel fault tree HTTP", () => {
  let app: INestApplication;
  let graphModelServiceMock: {
    saveFaultTreeGraph: jest.Mock;
    saveEventTreeGraph: jest.Mock;
    getEventSequenceDiagramGraph: jest.Mock;
    getFaultTreeGraph: jest.Mock;
    updateESLabel: jest.Mock;
    updateESSubgraph: jest.Mock;
    getEventTreeGraph: jest.Mock;
  };

  beforeAll(async () => {
    graphModelServiceMock = {
      saveFaultTreeGraph: jest.fn(),
      saveEventTreeGraph: jest.fn(),
      getEventSequenceDiagramGraph: jest.fn(),
      getFaultTreeGraph: jest.fn(),
      updateESLabel: jest.fn(),
      updateESSubgraph: jest.fn(),
      getEventTreeGraph: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [GraphModelController],
      providers: [
        {
          provide: GraphModelService,
          useValue: graphModelServiceMock,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/graph-models");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("POST /api/graph-models/fault-tree-graph accepts normalized OpenPRA input", async () => {
    const payload = cloneOpenPraFixture(openPraNormalizedCase1);

    graphModelServiceMock.saveFaultTreeGraph.mockResolvedValue(true);

    await request(app.getHttpServer()).post("/api/graph-models/fault-tree-graph").send(payload).expect(201);

    expect(graphModelServiceMock.saveFaultTreeGraph).toHaveBeenCalledTimes(1);
    expect(graphModelServiceMock.saveFaultTreeGraph).toHaveBeenCalledWith(payload);
  });

  it("GET /api/graph-models/fault-tree-graph returns a stored fault tree graph", async () => {
    const storedGraph = {
      faultTreeId: "stored_ft_http_1",
      nodes: [
        {
          id: "TOP",
          type: "node",
          position: { x: 0, y: 0 },
          data: {
            label: "Top Gate",
            gateType: "or",
            nodeType: "gate",
            isTop: true,
            metadata: {},
          },
        },
        {
          id: "A",
          type: "node",
          position: { x: 0, y: 100 },
          data: {
            label: "Basic Event A",
            nodeType: "basicEvent",
            isTop: false,
            metadata: {},
          },
        },
      ],
      edges: [
        {
          id: "TOP__A",
          source: "TOP",
          target: "A",
          type: "default",
          animated: false,
          data: { label: "" },
        },
      ],
    };

    graphModelServiceMock.getFaultTreeGraph.mockResolvedValue(storedGraph);

    const response = await request(app.getHttpServer())
      .get("/api/graph-models/fault-tree-graph")
      .query({ faultTreeId: "stored_ft_http_1" })
      .expect(200);

    expect(graphModelServiceMock.getFaultTreeGraph).toHaveBeenCalledTimes(1);
    expect(graphModelServiceMock.getFaultTreeGraph).toHaveBeenCalledWith("stored_ft_http_1");
    expect(response.body).toEqual(storedGraph);
  });

  it("POST /api/graph-models/fault-tree-graph returns 500 when the service throws", async () => {
    graphModelServiceMock.saveFaultTreeGraph.mockRejectedValue(new Error("boom"));

    const response = await request(app.getHttpServer())
      .post("/api/graph-models/fault-tree-graph")
      .send({
        faultTreeId: "fault_tree_error_case",
        nodes: [],
        edges: [],
      })
      .expect(500);

    expect(response.body.message).toBe("Internal server error");
    expect(response.body.statusCode).toBe(500);
  });
});
