import { QuantumReadinessService } from "./quantumReadiness.service";
import {
  cloneOpenPraFixture,
  openPraNormalizedCase1,
  openPraNormalizedCase1NoTopNodeIdMetadata,
  openPraNormalizedCase1NoTopNodeIdStructural,
  openPraNormalizedCase2UnsupportedNot,
} from "./openPraFaultTreeGraph.fixtures";

describe("QuantumReadinessService normalized OpenPRA input", () => {
  const graphModelService = {
    getFaultTreeGraph: jest.fn(),
  };

  let service: QuantumReadinessService;

  beforeEach(() => {
    graphModelService.getFaultTreeGraph.mockReset();
    service = new QuantumReadinessService(graphModelService as never);
  });

  it("accepts normalized OpenPRA case 1 directly and finds tractable candidates", () => {
    const result = service.analyzeFaultTreeGraph(cloneOpenPraFixture(openPraNormalizedCase1));

    expect(result.normalizedFaultTree.topNodeId).toBe("TOP");
    expect(result.report.summary.totalNodes).toBe(5);
    expect(result.report.summary.totalGateNodes).toBe(2);
    expect(result.report.summary.totalBasicEventNodes).toBe(3);
    expect(result.report.summary.totalQuantumTractableCandidates).toBe(2);
    expect(result.report.summary.tractableCandidateIds).toEqual(expect.arrayContaining(["G1", "TOP"]));
  });

  it("accepts normalized OpenPRA case 2 directly and marks NOT gate as non tractable", () => {
    const result = service.analyzeFaultTreeGraph(cloneOpenPraFixture(openPraNormalizedCase2UnsupportedNot));

    expect(result.normalizedFaultTree.topNodeId).toBe("TOP");
    expect(result.report.summary.totalNodes).toBe(2);
    expect(result.report.summary.totalQuantumTractableCandidates).toBe(0);
    expect(result.report.summary.tractableCandidateIds).toEqual([]);

    expect(result.report.candidates).toHaveLength(1);
    expect(result.report.candidates[0].rootNodeId).toBe("TOP");
    expect(result.report.candidates[0].unsupportedGateTypesFound).toContain("not");
    expect(result.report.candidates[0].quantumTractable).toBe(false);
    expect(result.report.candidates[0].exclusionReasons.join(" ")).toMatch(/Unsupported gate types present: not/i);
  });

  it("infers top node from metadata when topNodeId is missing", () => {
    const result = service.analyzeFaultTreeGraph(cloneOpenPraFixture(openPraNormalizedCase1NoTopNodeIdMetadata));

    expect(result.normalizedFaultTree.topNodeId).toBe("TOP");
    expect(result.report.summary.totalNodes).toBe(5);
    expect(result.report.summary.totalQuantumTractableCandidates).toBe(2);
    expect(result.report.summary.tractableCandidateIds).toEqual(expect.arrayContaining(["G1", "TOP"]));
  });

  it("infers top node from unique root gate when topNodeId and top markers are missing", () => {
    const result = service.analyzeFaultTreeGraph(cloneOpenPraFixture(openPraNormalizedCase1NoTopNodeIdStructural));

    expect(result.normalizedFaultTree.topNodeId).toBe("TOP");
    expect(result.report.summary.totalNodes).toBe(5);
    expect(result.report.summary.totalQuantumTractableCandidates).toBe(2);
    expect(result.report.summary.tractableCandidateIds).toEqual(expect.arrayContaining(["G1", "TOP"]));
  });

  it("accepts normalized OpenPRA case 1 through the by id service seam", async () => {
    graphModelService.getFaultTreeGraph.mockResolvedValue(cloneOpenPraFixture(openPraNormalizedCase1));

    const result = await service.analyzeFaultTreeGraphById("openpra_graph_case_1");

    expect(graphModelService.getFaultTreeGraph).toHaveBeenCalledWith("openpra_graph_case_1");
    expect(result.report.summary.totalNodes).toBe(5);
    expect(result.report.summary.totalQuantumTractableCandidates).toBe(2);
    expect(result.report.summary.tractableCandidateIds).toEqual(expect.arrayContaining(["G1", "TOP"]));
  });
});
