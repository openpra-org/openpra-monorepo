import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { FaultTreeAnalysisResult, FaultTreeExecuteResult } from "interfaces-shared-types/newly-developed-methods/fault-tree";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { SyCcfAnalysis } from "../SyCcfAnalysis";
import { getSyFaultTreeResult, runSyFaultTree, validateSyFaultTree } from "../syWorkbookApi";

jest.mock("../../newly-developed-methods/shared/useAnalysisSourceGuard", () => ({
  useAnalysisSourceGuard: () => ({ sourceWarning: null }),
}));
jest.mock("../syWorkbookApi", () => ({
  getSyFaultTreeResult: jest.fn(),
  runSyFaultTree: jest.fn(),
  validateSyFaultTree: jest.fn(),
}));

const sy = {
  systemDefinitions: [{ uuid: "system-1", name: "Cooling", abbreviation: "CLG", boundaries: [], successCriteriaIds: [], modeledComponentsAndFailures: {}, informationBasis: "as-built-as-operated", implementsSrs: [] }],
  systemLogicModels: [{
    uuid: "model-1", code: "FT-CLG", name: "Cooling fault tree", systemReference: "system-1", description: "Cooling unavailable", modelRepresentation: "FAULT_TREE",
    topGate: { gateId: "top" }, gates: [{ id: "top", kind: "GATE", gateType: "OR", code: "TOP", name: "Top", description: "" }],
    leafNodes: [{ id: "leaf-a", kind: "BASIC_EVENT_REFERENCE", basicEventId: "event-a" }, { id: "leaf-b", kind: "BASIC_EVENT_REFERENCE", basicEventId: "event-b" }],
    gateInputs: [{ id: "input-a", gateId: "top", childId: "leaf-a", order: 0 }, { id: "input-b", gateId: "top", childId: "leaf-b", order: 1 }],
    nodePositions: [], layout: { viewport: { x: 0, y: 0, zoom: 1 }, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" }, implementsSrs: [],
  }],
  systemBasicEvents: [
    { uuid: "event-a", code: "A", name: "A fails", eventType: "BASIC", failureMode: "FAILURE_TO_START", probability: 0.01, implementsSrs: [] },
    { uuid: "event-b", code: "B", name: "B fails", eventType: "BASIC", failureMode: "FAILURE_TO_START", probability: 0.01, implementsSrs: [] },
  ],
  commonCauseFailureGroups: [{
    uuid: "ccf-1", name: "Cooling pumps", description: "Same design", scope: "INTRASYSTEM", affectedComponents: ["A", "B"], affectedSystems: ["system-1"], modelType: "BETA_FACTOR",
    modelSpecificParameters: { betaFactorParameters: { beta: 0.1, totalFailureProbability: 0.01 } }, members: { basicEvents: [{ id: "event-a" }, { id: "event-b" }] },
    groupSelectionBasis: "Same design", dataAnalysisCCFParameterRef: "DA-1", dataSources: [{ reference: "source", description: "basis", dataType: "generic" }], implementsSrs: [],
  }],
} as unknown as SystemsAnalysis;

jest.mock("../syWorkbookContext", () => ({
  useSyWorkbook: () => ({
    sy,
    editable: true,
    runtime: { workbookId: "sy-workbook", projectId: "project", revision: 12, saveStatus: "saved" },
  }),
}));

const mockedRun = jest.mocked(runSyFaultTree);
const mockedResult = jest.mocked(getSyFaultTreeResult);
const mockedValidate = jest.mocked(validateSyFaultTree);
const timestamp = "2026-09-21T12:00:00.000Z";

function execution(id: string): FaultTreeExecuteResult {
  return {
    schemaVersion: "1.0.0",
    run: {
      schemaVersion: "1.0.0", id, owner: { workbookId: "sy-workbook", modelId: "model-1", workbookRevision: 12 },
      sourceWorkbooks: [{ workbookId: "sy-workbook", workbookRevision: 12 }], methodType: "FAULT_TREE", status: "SUCCEEDED", requestedBy: "analyst", requestedAt: timestamp,
      startedAt: timestamp, completedAt: timestamp, engine: { name: "PRAXIS", version: "1" }, failure: null,
    },
  };
}

function result(id: string, value: number): FaultTreeAnalysisResult {
  return {
    schemaVersion: "1.0.0", runId: id, owner: { workbookId: "sy-workbook", modelId: "model-1", workbookRevision: 12 }, topGateId: "top",
    topEventProbability: value, calculationType: "PROBABILITY", workflow: "MANUAL", algorithm: "BDD", probabilityMethod: "EXACT", validationIssues: [], completedAt: timestamp,
  };
}

describe("SY common cause PRAXIS analysis", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedValidate.mockResolvedValue({ schemaVersion: "1.0.0", validation: { valid: true, issues: [] } });
    mockedRun.mockResolvedValueOnce(execution("run-base")).mockResolvedValueOnce(execution("run-ccf"));
    mockedResult.mockResolvedValueOnce(result("run-base", 0.0001)).mockResolvedValueOnce(result("run-ccf", 0.001));
  });

  it("runs the same saved fault tree without and with common cause expansion", async () => {
    render(<SyCcfAnalysis />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Run CCF comparison" })); });

    expect(mockedValidate).toHaveBeenCalledWith("sy-workbook", "model-1", 12);
    expect(mockedRun).toHaveBeenNthCalledWith(1, "sy-workbook", "model-1", 12, expect.objectContaining({ settings: expect.objectContaining({ expandCcf: false }) }));
    expect(mockedRun).toHaveBeenNthCalledWith(2, "sy-workbook", "model-1", 12, expect.objectContaining({ settings: expect.objectContaining({ expandCcf: true }) }));
    await waitFor(() => expect(screen.getByRole("region", { name: "Common cause comparison results" })).toBeInTheDocument());
    expect(screen.getByText("+900.00%")).toBeInTheDocument();
    expect(screen.getByText("ccf-1")).toBeInTheDocument();
  });

  it("keeps advanced settings below the algorithm and shows controls only when they apply", () => {
    render(<SyCcfAnalysis />);
    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));

    const algorithm = screen.getByRole("combobox", { name: "Common cause algorithm" });
    const advanced = screen.getByRole("region", { name: "Advanced common cause settings" });
    expect(algorithm.compareDocumentPosition(advanced) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(screen.queryByRole("spinbutton", { name: "Common cause reorder budget seconds" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Common cause variable order" }), { target: { value: "SIFT" } });
    expect(screen.getByRole("spinbutton", { name: "Common cause reorder budget seconds" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Probability + cut sets" }));
    expect(screen.getByRole("combobox", { name: "Common cause probability method" })).toBeInTheDocument();
  });

  it("pages expanded cut sets and labels generated CCF events with the group name", async () => {
    mockedResult.mockReset();
    mockedResult
      .mockResolvedValueOnce({ ...result("run-base", 0.0001), cutSets: { primeImplicants: false, count: 1, distributionByOrder: [0, 1], items: [{ order: 1, probability: 0.0001, literals: [{ basicEventId: "event-a", negated: false }] }] } })
      .mockResolvedValueOnce({ ...result("run-ccf", 0.001), cutSets: { primeImplicants: false, count: 26, distributionByOrder: [0, 26], items: Array.from({ length: 26 }, () => ({ order: 1, probability: 0.001, literals: [{ basicEventId: "ccf-1-common", negated: false }] })) } });

    render(<SyCcfAnalysis />);
    fireEvent.click(screen.getByRole("radio", { name: "Probability + cut sets" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Run CCF comparison" })); });

    expect((await screen.findAllByText("Cooling pumps · common")).length).toBe(25);
    expect(screen.getByRole("navigation", { name: "CLG · FT-CLG · Cooling fault tree expanded cut sets pagination" })).toBeInTheDocument();
  });
});
