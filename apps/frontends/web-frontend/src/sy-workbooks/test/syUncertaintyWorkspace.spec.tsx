import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DistributionType } from "interfaces-mef-types/core/events";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type { FaultTreeAnalysisResult, FaultTreeExecuteResult } from "interfaces-shared-types/newly-developed-methods/fault-tree";
import { SyUncertaintyParameters } from "../SyUncertaintyParameters";
import { SyUncertaintyAnalysis } from "../SyUncertaintyAnalysis";
import { getSyFaultTreeResult, runSyFaultTree, validateSyFaultTree } from "../syWorkbookApi";

jest.mock("../../newly-developed-methods/shared/useAnalysisSourceGuard", () => ({ useAnalysisSourceGuard: () => ({ sourceWarning: null }) }));
jest.mock("../syWorkbookApi", () => ({ getSyFaultTreeResult: jest.fn(), runSyFaultTree: jest.fn(), validateSyFaultTree: jest.fn() }));

const reference = { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-workbook", entityId: "da-param" };
let sy = {
  systemDefinitions: [{ uuid: "system-1", name: "Cooling", abbreviation: "CLG" }],
  systemLogicModels: [{ uuid: "model-1", code: "FT-CLG", name: "Cooling fault tree", systemReference: "system-1", topGate: { gateId: "top" },
    leafNodes: [{ id: "leaf-a", kind: "BASIC_EVENT_REFERENCE", basicEventId: "event-a" }] }],
  systemBasicEvents: [{ uuid: "event-a", code: "PMP-A-FS", name: "Pump A fails", eventType: "BASIC", failureMode: "FAILURE_TO_START", probability: 0.02,
    controlledDataSource: reference }],
  commonCauseFailureGroups: [], uncertaintyAnalyses: [],
} as unknown as SystemsAnalysis;
let controlledParameters = [{ workbookId: "da-workbook", workbookName: "DA estimates", parameterId: "da-param", parameterName: "Pump failure", parameterType: "PROBABILITY" as const, value: 0.02,
  uncertainty: { type: DistributionType.BETA, alpha: 2, betaParam: 98 } }];

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
    uncertainty: { mean: 0.021, standardDeviation: 0.004, errorFactor: 1.1, sampleCount: 1000, seed: 9,
      quantiles: [0.05, 0.25, 0.5, 0.75, 0.95].map((probability) => ({ probability, value: 0.02 })) } };
}

describe("SY Step 07 linked uncertainty analysis", () => {
  beforeEach(() => {
    sy = structuredClone(sy);
    controlledParameters = [{ workbookId: "da-workbook", workbookName: "DA estimates", parameterId: "da-param", parameterName: "Pump failure", parameterType: "PROBABILITY", value: 0.02,
      uncertainty: { type: DistributionType.BETA, alpha: 2, betaParam: 98 } }];
    jest.clearAllMocks();
    mockedValidate.mockResolvedValue({ schemaVersion: "1.0.0", validation: { valid: true, issues: [] } });
  });

  it("shows linked DA distributions without an SY editor", () => {
    render(<SyUncertaintyParameters />);
    expect(screen.getByText("DA estimates")).toBeInTheDocument();
    expect(screen.getByText("Pump failure")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add distribution" })).not.toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("runs uncertainty with CCF expansion and displays the result", async () => {
    mockedRun.mockResolvedValue(execution());
    mockedResult.mockResolvedValue(result());
    render(<SyUncertaintyAnalysis />);
    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Uncertainty samples" }), { target: { value: "1000" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Uncertainty seed" }), { target: { value: "9" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Run uncertainty" })); });
    expect(mockedRun).toHaveBeenCalledWith("sy-workbook", "model-1", 12, expect.objectContaining({
      calculationType: "UNCERTAINTY", settings: expect.objectContaining({ numTrials: 1000, seed: 9, expandCcf: true }),
    }));
    await waitFor(() => expect(screen.getByRole("region", { name: "Uncertainty results" })).toBeInTheDocument());
    expect(screen.getByText("2.100E-2")).toBeInTheDocument();
  });

  it("withholds a run when CCF expansion would discard a sampled DA member", () => {
    sy.systemBasicEvents.push({ uuid: "event-b", code: "PMP-B-FS", name: "Pump B fails", failureMode: "FAILURE_TO_START" } as SystemsAnalysis["systemBasicEvents"][number]);
    sy.systemLogicModels[0]!.leafNodes.push({ id: "leaf-b", kind: "BASIC_EVENT_REFERENCE", basicEventId: "event-b" });
    sy.commonCauseFailureGroups = [{ members: { basicEvents: [{ id: "event-a" }, { id: "event-b" }] } }] as SystemsAnalysis["commonCauseFailureGroups"];
    render(<SyUncertaintyAnalysis />);
    expect(screen.getByRole("button", { name: "Run uncertainty" })).toBeDisabled();
    expect(screen.getByText(/CCF expansion cannot propagate/)).toBeInTheDocument();
  });
});
