import { Test, TestingModule } from "@nestjs/testing";

import { GraphModelController } from "./graphModel.controller";
import { GraphModelService } from "./graphModel.service";

describe("GraphModelController", () => {
  let controller: GraphModelController;

  const graphModelServiceMock = {
    saveFaultTreeGraph: jest.fn(),
    saveEventTreeGraph: jest.fn(),
    getEventSequenceDiagramGraph: jest.fn(),
    getFaultTreeGraph: jest.fn(),
    updateESLabel: jest.fn(),
    updateESSubgraph: jest.fn(),
    getEventTreeGraph: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GraphModelController],
      providers: [
        {
          provide: GraphModelService,
          useValue: graphModelServiceMock,
        },
      ],
    }).compile();

    controller = module.get<GraphModelController>(GraphModelController);
  });

  it("creates a fault tree graph from normalized OpenPRA input", async () => {
    const payload = {
      id: "openpra_graph_case_controller_1",
      topNodeId: "TOP",
      nodes: {
        TOP: {
          id: "TOP",
          label: "Top Gate",
          kind: "gate",
          gateType: "OR",
          children: ["A"],
          metadata: {
            sourceNodeType: "gate",
            sourceNodeData: {
              label: { name: "Top Gate" },
              gateType: "OR",
              isTop: true,
            },
          },
        },
        A: {
          id: "A",
          label: "Basic Event A",
          kind: "basicEvent",
          metadata: {
            sourceNodeType: "basicEvent",
            sourceNodeData: {
              label: { name: "Basic Event A" },
            },
          },
        },
      },
    };

    graphModelServiceMock.saveFaultTreeGraph.mockResolvedValue(true);

    const result = await controller.createFaultTreeGraph(payload as never);

    expect(result).toBe(true);
    expect(graphModelServiceMock.saveFaultTreeGraph).toHaveBeenCalledTimes(1);
    expect(graphModelServiceMock.saveFaultTreeGraph).toHaveBeenCalledWith(payload);
  });

  it("returns a stored fault tree graph by id", async () => {
    const storedGraph = {
      faultTreeId: "stored_ft_1",
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
          id: "A",
          type: "basicEvent",
          position: { x: 0, y: 100 },
          data: {
            label: { name: "Basic Event A" },
          },
        },
      ],
      edges: [
        {
          id: "e1",
          source: "TOP",
          target: "A",
          type: "default",
          animated: false,
          data: { label: "" },
        },
      ],
    };

    graphModelServiceMock.getFaultTreeGraph.mockResolvedValue(storedGraph);

    const result = await controller.getFaultTreeGraph("stored_ft_1");

    expect(graphModelServiceMock.getFaultTreeGraph).toHaveBeenCalledTimes(1);
    expect(graphModelServiceMock.getFaultTreeGraph).toHaveBeenCalledWith("stored_ft_1");
    expect(result).toEqual(storedGraph);
  });

  it("propagates the raw error when saveFaultTreeGraph fails", async () => {
    graphModelServiceMock.saveFaultTreeGraph.mockRejectedValue(new Error("boom"));

    await expect(
      controller.createFaultTreeGraph({
        faultTreeId: "fault_tree_error_case",
        nodes: [],
        edges: [],
      } as never),
    ).rejects.toThrow("boom");
  });

  it("creates an event tree graph through the service seam", async () => {
    const payload = {
      eventTreeId: "event_tree_1",
      nodes: [],
      edges: [],
    };

    graphModelServiceMock.saveEventTreeGraph.mockResolvedValue(true);

    const result = await controller.createEventTreeGraph(payload as never);

    expect(result).toBe(true);
    expect(graphModelServiceMock.saveEventTreeGraph).toHaveBeenCalledTimes(1);
    expect(graphModelServiceMock.saveEventTreeGraph).toHaveBeenCalledWith(payload);
  });

  it("returns an event tree graph by id", async () => {
    const storedGraph = {
      eventTreeId: "event_tree_1",
      nodes: [],
      edges: [],
    };

    graphModelServiceMock.getEventTreeGraph.mockResolvedValue(storedGraph);

    const result = await controller.getEventTreeGraph("event_tree_1");

    expect(graphModelServiceMock.getEventTreeGraph).toHaveBeenCalledWith("event_tree_1");
    expect(result).toEqual(storedGraph);
  });
});
