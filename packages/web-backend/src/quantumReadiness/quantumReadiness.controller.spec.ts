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
      getFaultTreeGraph: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        QuantumReadinessService,
        {
          provide: GraphModelService,
          useValue: graphModelServiceMock
        }
      ]
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
    };

    const result = controller.analyzeFaultTreeGraph({
      graph,
      modelName: "Controller Graph"
    });

    expect(result.normalizedFaultTree.id).toBe("controller_ft_1");
    expect(result.normalizedFaultTree.topNodeId).toBe("TOP");
    expect(result.report.summary.totalCandidateSubtrees).toBe(1);
    expect(result.report.summary.totalQuantumTractableCandidates).toBe(1);
    expect(result.summaryMarkdown).toContain("# Quantum Readiness Summary");
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
    };

    const result = controller.analyzeFaultTreeGraph({
      graph,
      modelName: "Controller Tight Limit",
      options: {
        analysis: {
          maxBasicEvents: 2
        }
      }
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

    const result = await controller.analyzeFaultTreeGraphById({
      faultTreeId: "stored_ft_1",
      modelName: "Stored Graph"
    });

    expect(graphModelServiceMock.getFaultTreeGraph).toHaveBeenCalledWith("stored_ft_1");
    expect(result.normalizedFaultTree.id).toBe("stored_ft_1");
    expect(result.report.summary.totalCandidateSubtrees).toBe(1);
  });
});
