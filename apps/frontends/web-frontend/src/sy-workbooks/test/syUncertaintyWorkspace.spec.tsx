import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type { FaultTreeAnalysisResult, FaultTreeExecuteResult } from "interfaces-shared-types/newly-developed-methods/fault-tree";
import { SyUncertaintyAnalysis } from "../SyUncertaintyAnalysis";
import { getSyFaultTreeResult, runSyFaultTree, validateSyFaultTree } from "../syWorkbookApi";

jest.mock("../../newly-developed-methods/shared/useAnalysisSourceGuard", () => ({ useAnalysisSourceGuard: () => ({ sourceEpoch: 0, sourceWarning: null, sourceChanges: new Map() }) }));
jest.mock("../syWorkbookApi", () => ({ getSyFaultTreeResult: jest.fn(), runSyFaultTree: jest.fn(), validateSyFaultTree: jest.fn() }));

const linked: UncertainExpression = { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-workbook", entityId: "da-param" } };
const typed: UncertainExpression = { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value: 0.02 } } };
let sy = {
  systemDefinitions: [{ uuid: "system-1", name: "Cooling", abbreviation: "CLG" }],
  systemLogicModels: [{ uuid: "model-1", code: "FT-CLG", name: "Cooling fault tree", systemReference: "system-1", topGate: { gateId: "top" },
    leafNodes: [{ id: "leaf-a", kind: "BASIC_EVENT_REFERENCE", basicEventId: "event-a" }] }],
  systemBasicEvents: [{ uuid: "event-a", code: "PMP-A-FS", name: "Pump A fails", eventType: "BASIC", failureMode: "FAILURE_TO_START", expression: linked }],
  commonCauseFailureGroups: [], uncertaintyAnalyses: [],
} as unknown as SystemsAnalysis;
const initialSy = structuredClone(sy);
const ESTIMATE: UncertainExpression = { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "BETA", alpha: 2, beta: 98, lower: 0, upper: 1 } } };
let controlledParameters = [{ workbookId: "da-workbook", workbookName: "DA estimates", parameterId: "da-param", parameterName: "Pump failure", unit: "PROBABILITY" as const, estimate: ESTIMATE }];

jest.mock("../syWorkbookContext", () => ({ useSyWorkbook: () => ({
  sy, controlledParameters, editable: true, shortOf: () => "CLG",
  runtime: { workbookId: "sy-workbook", projectId: "project", revision: 12, saveStatus: "saved" },
}) }));

const timestamp = "2026-09-21T12:00:00.000Z";
const mockedRun = jest.mocked(runSyFaultTree);
const mockedResult = jest.mocked(getSyFaultTreeResult);
const mockedValidate = jest.mocked(validateSyFaultTree);
function execution(id = "run-unc", modelId = "model-1"): FaultTreeExecuteResult {
  return { schemaVersion: "1.0.0", run: { schemaVersion: "1.0.0", id, owner: { workbookId: "sy-workbook", modelId, workbookRevision: 12 },
    sourceWorkbooks: [{ workbookId: "sy-workbook", workbookRevision: 12 }], methodType: "FAULT_TREE", status: "SUCCEEDED", requestedBy: "analyst", requestedAt: timestamp,
    startedAt: timestamp, completedAt: timestamp, engine: { name: "PRAXIS", version: "1" }, failure: null } };
}
function result(): FaultTreeAnalysisResult {
  return { schemaVersion: "1.0.0", runId: "run-unc", owner: { workbookId: "sy-workbook", modelId: "model-1", workbookRevision: 12 },
    topGateId: "top", topEventProbability: 0.02, validationIssues: [], completedAt: timestamp,
    uncertainty: { mean: 0.021, standardDeviation: 0.004, standardError: 0.000126, sampleCount: 4, seed: 9, samplingMethod: "LATIN_HYPERCUBE",
      samples: [0.018, 0.02, 0.022, 0.024],
      quantiles: [0.05, 0.25, 0.5, 0.75, 0.95].map((probability) => ({ probability, value: 0.02 })) } };
}

describe("SY Step 07 linked uncertainty analysis", () => {
  beforeEach(() => {
    sy = structuredClone(initialSy);
    controlledParameters = [{ workbookId: "da-workbook", workbookName: "DA estimates", parameterId: "da-param", parameterName: "Pump failure", unit: "PROBABILITY", estimate: ESTIMATE }];
    jest.clearAllMocks();
    mockedValidate.mockResolvedValue({ schemaVersion: "1.0.0", validation: { valid: true, issues: [] } });
  });

  it("offers Direct BDD as the one enabled uncertainty algorithm", () => {
    render(<SyUncertaintyAnalysis />);
    const algorithm = screen.getByRole("combobox", { name: "Uncertainty algorithm" });
    expect(algorithm).toBeEnabled();
    expect(algorithm).toHaveValue("BDD");
    expect(within(algorithm).getAllByRole("option").map((option) => option.textContent)).toEqual(["Direct BDD"]);
    expect(within(screen.getByRole("combobox", { name: "Uncertainty sampling method" })).getAllByRole("option").map((option) => option.textContent)).toEqual(["Monte Carlo", "Latin hypercube"]);
  });

  it("runs uncertainty with the chosen sampling and shows the summary and the samples", async () => {
    mockedRun.mockResolvedValue(execution());
    mockedResult.mockResolvedValue(result());
    render(<SyUncertaintyAnalysis />);
    fireEvent.change(screen.getByRole("combobox", { name: "Uncertainty sampling method" }), { target: { value: "LATIN_HYPERCUBE" } });
    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Uncertainty samples" }), { target: { value: "1000" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Uncertainty seed" }), { target: { value: "9" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Run uncertainty" })); });
    expect(mockedRun).toHaveBeenCalledWith("sy-workbook", "model-1", 12, expect.objectContaining({
      calculationType: "UNCERTAINTY", settings: expect.objectContaining({ numTrials: 1000, seed: 9, expandCcf: true, samplingMethod: "LATIN_HYPERCUBE" }),
    }), expect.any(Function));
    await waitFor(() => expect(screen.getByRole("region", { name: "Uncertainty results" })).toBeInTheDocument());
    const card = screen.getByRole("article", { name: "Uncertainty result for CLG · FT-CLG · Cooling fault tree" });
    const values = within(card).getByRole("table", { name: "Summary values for CLG · FT-CLG · Cooling fault tree" });
    expect(within(values).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Point estimate", "5th percentile", "Median", "Mean", "95th percentile"]);
    expect(within(values).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["2.000E-2", "2.000E-2", "2.000E-2", "2.100E-2", "2.000E-2"]);
    expect(card).toHaveTextContent("4 Latin hypercube samples · seed 9 · standard deviation 4.000E-3 · standard error of the mean 1.260E-4");
    expect(within(card).getByRole("img", { name: /^Distribution of the sampled top event probability/ })).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Cumulative" }));
    expect(within(card).getByRole("button", { name: "Cumulative" })).toHaveAttribute("aria-pressed", "true");
    expect(within(card).getByRole("img", { name: /^Cumulative share of samples/ })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Fault tree" })).not.toBeInTheDocument();
  });

  it("shows a batch one fault tree at a time, picked from the Fault tree dropdown above the result", async () => {
    sy.systemDefinitions.push({ ...sy.systemDefinitions[0]!, uuid: "system-2", name: "Reactor protection", abbreviation: "RPS" });
    sy.systemLogicModels.push({ ...sy.systemLogicModels[0]!, uuid: "model-2", code: "RPS-TOP", name: "Reactor trip fault tree", systemReference: "system-2",
      leafNodes: [{ id: "leaf-r", kind: "BASIC_EVENT_REFERENCE", basicEventId: "event-r" }] });
    sy.systemBasicEvents.push({ ...sy.systemBasicEvents[0]!, uuid: "event-r", code: "RLY-K1-FO", name: "Trip relay fails to open", expression: ESTIMATE });
    const second: FaultTreeAnalysisResult = { ...result(), runId: "run-two", owner: { ...result().owner, modelId: "model-2" }, topEventProbability: 3e-6,
      uncertainty: { ...result().uncertainty!, mean: 3.4e-6, samples: [0, 1e-6, 3e-6, 9e-6], quantiles: [0.05, 0.25, 0.5, 0.75, 0.95].map((probability) => ({ probability, value: probability * 1e-5 })) } };
    mockedRun.mockResolvedValueOnce(execution()).mockResolvedValueOnce(execution("run-two", "model-2"));
    mockedResult.mockResolvedValueOnce(result()).mockResolvedValueOnce(second);
    render(<SyUncertaintyAnalysis />);
    fireEvent.click(screen.getByRole("radio", { name: "Batch" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Run uncertainty batch" })); });
    await waitFor(() => expect(within(screen.getByRole("combobox", { name: "Fault tree" })).getAllByRole("option")).toHaveLength(2));
    expect(mockedRun).toHaveBeenNthCalledWith(1, "sy-workbook", "model-1", 12, expect.objectContaining({ calculationType: "UNCERTAINTY", workflow: "BATCH" }), expect.any(Function));
    expect(mockedRun).toHaveBeenNthCalledWith(2, "sy-workbook", "model-2", 12, expect.objectContaining({ calculationType: "UNCERTAINTY", workflow: "BATCH" }), expect.any(Function));
    const results = screen.getByRole("region", { name: "Uncertainty results" });
    const picker = within(results).getByRole("combobox", { name: "Fault tree" });
    expect(within(picker).getAllByRole("option").map((option) => option.textContent)).toEqual(["CLG · FT-CLG · Cooling fault tree", "RPS · RPS-TOP · Reactor trip fault tree"]);
    expect(picker).toHaveValue("model-1");
    expect(within(results).getAllByRole("article").map((article) => article.getAttribute("aria-label"))).toEqual(["Uncertainty result for CLG · FT-CLG · Cooling fault tree"]);
    expect(picker.compareDocumentPosition(within(results).getByRole("article")) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    fireEvent.change(picker, { target: { value: "model-2" } });
    expect(within(results).getAllByRole("article").map((article) => article.getAttribute("aria-label"))).toEqual(["Uncertainty result for RPS · RPS-TOP · Reactor trip fault tree"]);
    const card = within(results).getByRole("article", { name: "Uncertainty result for RPS · RPS-TOP · Reactor trip fault tree" });
    expect(within(within(card).getByRole("table", { name: "Summary values for RPS · RPS-TOP · Reactor trip fault tree" })).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["3.000E-6", "5.000E-7", "5.000E-6", "3.400E-6", "9.500E-6"]);
    expect(card).toHaveTextContent("1 uncertain input · 4 Latin hypercube samples");
    expect(within(card).getByText("1 sample is exactly 0 and not drawn on the log scale.")).toBeInTheDocument();
  });

  it("withholds a run until every component event has a value and one value is uncertain", () => {
    sy.systemBasicEvents.push({ uuid: "event-b", code: "PMP-B-FS", name: "Pump B fails", failureMode: "FAILURE_TO_START" } as SystemsAnalysis["systemBasicEvents"][number]);
    sy.systemLogicModels[0]!.leafNodes.push({ id: "leaf-b", kind: "BASIC_EVENT_REFERENCE", basicEventId: "event-b" });
    const { unmount } = render(<SyUncertaintyAnalysis />);
    expect(screen.getByRole("button", { name: "Run uncertainty" })).toBeDisabled();
    expect(screen.getByText("PMP-B-FS: No value yet. Set it in Step 02.")).toBeInTheDocument();
    unmount();
    sy.systemBasicEvents[1] = { ...sy.systemBasicEvents[1]!, expression: typed } as SystemsAnalysis["systemBasicEvents"][number];
    render(<SyUncertaintyAnalysis />);
    expect(screen.getByRole("button", { name: "Run uncertainty" })).toBeEnabled();
  });
});
