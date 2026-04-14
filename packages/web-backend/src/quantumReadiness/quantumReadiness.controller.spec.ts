import { Test, TestingModule } from "@nestjs/testing";
import type { FaultTreeGraph } from "shared-types";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessController } from "./quantumReadiness.controller";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessController", () => {
  let controller: QuantumReadinessController;
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock };

  beforeEach(async () => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        QuantumReadinessService,
        {
          provide: GraphModelService,
          useValue: graphModelServiceMock,
        },
      ],
    }).compile();

    controller = module.get<QuantumReadinessController>(QuantumReadinessController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("runs controller level graph readiness analysis", () => {
    const graph: FaultTreeGraph = {
      faultTreeId: "controller_ft_1",
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
          position: { x: -100, y: 100 },
          data: {
            label: { name: "Basic Event A" },
          },
        },
        {
          id: "B",
          type: "basicEvent",
          position: { x: 100, y: 100 },
          data: {
            label: { name: "Basic Event B" },
          },
        },
      ],
      edges: [
        {
          id: "e1",
          source: "TOP",
          target: "A",
          type: "default",
          data: {},
          animated: false,
        },
        {
          id: "e2",
          source: "TOP",
          target: "B",
          type: "default",
          data: {},
          animated: false,
        },
      ],
    };

    const result = controller.analyzeFaultTreeGraph({
      graph,
      modelName: "Controller Graph",
    });

    expect(result.normalizedFaultTree.id).toBe("controller_ft_1");
    expect(result.normalizedFaultTree.topNodeId).toBe("TOP");
    expect(result.report.summary.totalCandidateSubtrees).toBe(1);
    expect(result.report.summary.totalQuantumTractableCandidates).toBe(1);
    expect(result.summaryMarkdown).toContain("# Quantum Readiness Summary");
  });

  it("exports preparation payloads for a tractable controller level graph", () => {
    const graph: FaultTreeGraph = {
      faultTreeId: "controller_ft_prep_1",
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
          position: { x: -100, y: 100 },
          data: {
            label: { name: "Basic Event A" },
          },
        },
        {
          id: "B",
          type: "basicEvent",
          position: { x: 100, y: 100 },
          data: {
            label: { name: "Basic Event B" },
          },
        },
      ],
      edges: [
        {
          id: "e1",
          source: "TOP",
          target: "A",
          type: "default",
          data: {},
          animated: false,
        },
        {
          id: "e2",
          source: "TOP",
          target: "B",
          type: "default",
          data: {},
          animated: false,
        },
      ],
    };

    const result = controller.analyzeFaultTreeGraphPreparation({
      graph,
      modelName: "Controller Preparation Graph",
    });

    expect(result.modelId).toBe("controller_ft_prep_1");
    expect(result.totalCandidateSubtrees).toBe(1);
    expect(result.totalQuantumTractableCandidates).toBe(1);
    expect(result.preparationCandidates).toHaveLength(1);
    expect(result.preparationCandidates[0]?.candidateRootNodeId).toBe("TOP");
    expect(result.preparationCandidates[0]?.orderedBasicEventIds).toEqual(["A", "B"]);
  });

  it("accepts top-level analysis overrides and surfaces topology classification", () => {
    const graph: FaultTreeGraph = {
      faultTreeId: "controller_ft_topology_1",
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
          position: { x: -100, y: 100 },
          data: {
            label: { name: "Basic Event A" },
          },
        },
        {
          id: "B",
          type: "basicEvent",
          position: { x: 100, y: 100 },
          data: {
            label: { name: "Basic Event B" },
          },
        },
      ],
      edges: [
        {
          id: "e1",
          source: "TOP",
          target: "A",
          type: "default",
          data: {},
          animated: false,
        },
        {
          id: "e2",
          source: "TOP",
          target: "B",
          type: "default",
          data: {},
          animated: false,
        },
      ],
    };

    const result = controller.analyzeFaultTreeGraph({
      graph,
      modelName: "Controller Topology Graph",
      analysis: {
        includeTopologyClassification: true,
      },
    });

    expect(result.report.summary.topologyClassCounts).toEqual({
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      unclassified: 1,
    });
    expect(result.report.candidates[0]?.topologyClassification?.topologyClass).toBe("unclassified");
    expect(result.summaryMarkdown).toContain("Topology Class Counts:");
  });

  it("accepts top-level analysis overrides for preparation exports", () => {
    const graph: FaultTreeGraph = {
      faultTreeId: "controller_ft_topology_prep_1",
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
          position: { x: -100, y: 100 },
          data: {
            label: { name: "Basic Event A" },
          },
        },
        {
          id: "B",
          type: "basicEvent",
          position: { x: 100, y: 100 },
          data: {
            label: { name: "Basic Event B" },
          },
        },
      ],
      edges: [
        {
          id: "e1",
          source: "TOP",
          target: "A",
          type: "default",
          data: {},
          animated: false,
        },
        {
          id: "e2",
          source: "TOP",
          target: "B",
          type: "default",
          data: {},
          animated: false,
        },
      ],
    };

    const result = controller.analyzeFaultTreeGraphPreparation({
      graph,
      modelName: "Controller Preparation Topology Graph",
      analysis: {
        includeTopologyClassification: true,
      },
    });

    expect(result.topologyClassCounts).toEqual({
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      unclassified: 1,
    });
    expect(result.preparationCandidates[0]?.topologyClassification?.topologyClass).toBe("unclassified");
  });

  it("returns excluded result when analysis options are tighter", () => {
    const graph: FaultTreeGraph = {
      faultTreeId: "controller_ft_2",
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
          position: { x: -100, y: 100 },
          data: {
            label: { name: "Basic Event A" },
          },
        },
        {
          id: "B",
          type: "basicEvent",
          position: { x: 0, y: 100 },
          data: {
            label: { name: "Basic Event B" },
          },
        },
        {
          id: "C",
          type: "basicEvent",
          position: { x: 100, y: 100 },
          data: {
            label: { name: "Basic Event C" },
          },
        },
      ],
      edges: [
        {
          id: "e1",
          source: "TOP",
          target: "A",
          type: "default",
          data: {},
          animated: false,
        },
        {
          id: "e2",
          source: "TOP",
          target: "B",
          type: "default",
          data: {},
          animated: false,
        },
        {
          id: "e3",
          source: "TOP",
          target: "C",
          type: "default",
          data: {},
          animated: false,
        },
      ],
    };

    const result = controller.analyzeFaultTreeGraph({
      graph,
      modelName: "Controller Tight Limit",
      options: {
        analysis: {
          maxBasicEvents: 2,
        },
      },
    });

    expect(result.report.summary.totalCandidateSubtrees).toBe(1);
    expect(result.report.summary.totalQuantumTractableCandidates).toBe(0);
    expect(result.report.candidates[0]?.quantumTractable).toBe(false);
  });

  it("runs controller level graph readiness analysis by id", async () => {
    graphModelServiceMock.getFaultTreeGraph.mockResolvedValue({
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
          data: {},
          animated: false,
        },
      ],
    });

    const result = await controller.analyzeFaultTreeGraphById({
      faultTreeId: "stored_ft_1",
      modelName: "Stored Graph",
    });

    expect(graphModelServiceMock.getFaultTreeGraph).toHaveBeenCalledWith("stored_ft_1");
    expect(result.normalizedFaultTree.id).toBe("stored_ft_1");
    expect(result.report.summary.totalCandidateSubtrees).toBe(1);
  });

  it("exports preparation payloads by id", async () => {
    graphModelServiceMock.getFaultTreeGraph.mockResolvedValue({
      faultTreeId: "stored_ft_prep_1",
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
          position: { x: -100, y: 100 },
          data: {
            label: { name: "Basic Event A" },
          },
        },
        {
          id: "B",
          type: "basicEvent",
          position: { x: 100, y: 100 },
          data: {
            label: { name: "Basic Event B" },
          },
        },
      ],
      edges: [
        {
          id: "e1",
          source: "TOP",
          target: "A",
          type: "default",
          data: {},
          animated: false,
        },
        {
          id: "e2",
          source: "TOP",
          target: "B",
          type: "default",
          data: {},
          animated: false,
        },
      ],
    });

    const result = await controller.analyzeFaultTreeGraphByIdPreparation({
      faultTreeId: "stored_ft_prep_1",
      modelName: "Stored Preparation Graph",
    });

    expect(graphModelServiceMock.getFaultTreeGraph).toHaveBeenCalledWith("stored_ft_prep_1");
    expect(result.modelId).toBe("stored_ft_prep_1");
    expect(result.totalQuantumTractableCandidates).toBe(1);
    expect(result.preparationCandidates).toHaveLength(1);
    expect(result.preparationCandidates[0]?.candidateRootNodeId).toBe("TOP");
    expect(result.preparationCandidates[0]?.orderedBasicEventIds).toEqual(["A", "B"]);
  });
});
