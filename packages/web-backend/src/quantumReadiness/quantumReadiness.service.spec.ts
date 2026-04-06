import { Test, TestingModule } from "@nestjs/testing";
import type { FaultTreeGraph } from "shared-types";

import { GraphModelService } from "../graphModels/graphModel.service";
import { QuantumReadinessService } from "./quantumReadiness.service";

describe("QuantumReadinessService", () => {
  let service: QuantumReadinessService;
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock };

  beforeEach(async () => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuantumReadinessService,
        {
          provide: GraphModelService,
          useValue: graphModelServiceMock
        }
      ]
    }).compile();

    service = module.get<QuantumReadinessService>(QuantumReadinessService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("runs graph readiness analysis end to end", () => {
    const graph: FaultTreeGraph = {
      faultTreeId: "backend_ft_1",
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

    const result = service.analyzeFaultTreeGraph(graph, "Backend Integration Graph");

    expect(result.normalizedFaultTree.id).toBe("backend_ft_1");
    expect(result.normalizedFaultTree.topNodeId).toBe("TOP");
    expect(result.report.summary.totalCandidateSubtrees).toBe(1);
    expect(result.report.summary.totalQuantumTractableCandidates).toBe(1);
    expect(result.summaryMarkdown).toContain("# Quantum Readiness Summary");
  });

  it("allows analysis options to tighten readiness limits", () => {
    const graph: FaultTreeGraph = {
      faultTreeId: "backend_ft_2",
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

    const result = service.analyzeFaultTreeGraph(graph, "Backend Tight Limit", {
      analysis: {
        maxBasicEvents: 2
      }
    });

    expect(result.report.summary.totalCandidateSubtrees).toBe(1);
    expect(result.report.summary.totalQuantumTractableCandidates).toBe(0);
    expect(result.report.candidates[0]?.quantumTractable).toBe(false);
  });

  it("retrieves a stored graph by id and analyzes it", async () => {
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

    const result = await service.analyzeFaultTreeGraphById("stored_ft_1", "Stored Graph");

    expect(graphModelServiceMock.getFaultTreeGraph).toHaveBeenCalledWith("stored_ft_1");
    expect(result.normalizedFaultTree.id).toBe("stored_ft_1");
    expect(result.report.summary.totalCandidateSubtrees).toBe(1);
  });

  it("throws when no stored graph nodes are found", async () => {
    graphModelServiceMock.getFaultTreeGraph.mockResolvedValue({
      faultTreeId: "missing_ft",
      nodes: [],
      edges: []
    });

    await expect(service.analyzeFaultTreeGraphById("missing_ft")).rejects.toThrow(
      "No fault tree graph found for faultTreeId missing_ft."
    );
  });
});
