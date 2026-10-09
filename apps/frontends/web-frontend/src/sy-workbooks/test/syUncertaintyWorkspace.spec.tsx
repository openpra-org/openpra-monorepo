import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type { FaultTreeAnalysisResult, FaultTreeExecuteResult } from "interfaces-shared-types/newly-developed-methods/fault-tree";
import { SyUncertaintyAnalysis } from "../SyUncertaintyAnalysis";
import { getSyFaultTreeResult, runSyFaultTree, validateSyFaultTree } from "../syWorkbookApi";

jest.mock("../../newly-developed-methods/shared/useAnalysisSourceGuard", () => ({ useAnalysisSourceGuard: () => ({ sourceWarning: null }) }));
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
function execution(): FaultTreeExecuteResult {
  return { schemaVersion: "1.0.0", run: { schemaVersion: "1.0.0", id: "run-unc", owner: { workbookId: "sy-workbook", modelId: "model-1", workbookRevision: 12 },
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
    sy = structuredClone(sy);
    controlledParameters = [{ workbookId: "da-workbook", workbookName: "DA estimates", parameterId: "da-param", parameterName: "Pump failure", unit: "PROBABILITY", estimate: ESTIMATE }];
    jest.clearAllMocks();
    mockedValidate.mockResolvedValue({ schemaVersion: "1.0.0", validation: { valid: true, issues: [] } });
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
    }));
    await waitFor(() => expect(screen.getByRole("region", { name: "Uncertainty results" })).toBeInTheDocument());
    expect(screen.getByText("2.100E-2")).toBeInTheDocument();
    expect(screen.getByText("1.260E-4")).toBeInTheDocument();
    expect(screen.queryByText("Error factor")).not.toBeInTheDocument();
    expect(screen.getByText("4 Latin hypercube samples · seed 9")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show samples" }));
    const bins = screen.getByRole("table", { name: "Samples for CLG · FT-CLG · Cooling fault tree" });
    expect(within(bins).getAllByRole("row")).toHaveLength(13);
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
