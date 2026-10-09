import { JSX, useCallback, useMemo, useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { EventTreeAnalysisResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import { esqEndStateRunId, esqSequenceRunId, esqTreeRunId } from "interfaces-mef-types/esq/esq-run-inputs";
import { EsqWorkbookProvider, type EsqWorkbookRuntime } from "../esqWorkbookContext";
import { LogicScreen, LogicWindows } from "../esqLogicScreen";
import { type EsqWindowContext } from "../esqModelScreen";
import { withFunctionLink, withModelImported } from "../esqModel";
import { listEsqTreeRuns, runEsqEventTree, type EsqTreeRun } from "../esqWorkbookApi";
import { linkedEsq, modelUpstream } from "./esqModelFixtures";

jest.mock("../esqWorkbookApi", () => ({
  ...jest.requireActual<typeof import("../esqWorkbookApi")>("../esqWorkbookApi"),
  listEsqTreeRuns: jest.fn(),
  runEsqEventTree: jest.fn(),
}));

const NOW = "2026-10-05T12:00:00.000Z";

const SAVED: EsqWorkbookRuntime = { workbookId: "esq-1", projectId: "p-1", revision: 4, saveStatus: "saved" };

function looped(): EventSequenceQuantification {
  const upstream = modelUpstream();
  const sy = upstream.sy;
  if (sy === undefined) throw new Error("fixture has no SY");
  sy.systemLogicModels = sy.systemLogicModels.map((model) => (model.uuid !== "M-SUP" ? model : {
    ...model,
    leafNodes: [...model.leafNodes, { id: "X-COOL", kind: "TRANSFER_REFERENCE", code: "COOL", name: "COOL", description: "", target: { modelId: "M-COOL", entityId: "G-COOL" } }],
  }));
  let esq = withModelImported(linkedEsq(), upstream, NOW);
  esq = withFunctionLink(esq, "RT", { functionId: "RT", target: { kind: "FAULT_TREE", top: { workbookId: "sy-1", modelId: "M-RPS", gateId: "G-RPS" } } });
  return withFunctionLink(esq, "COOL", { functionId: "COOL", target: { kind: "FAULT_TREE", top: { workbookId: "sy-1", modelId: "M-COOL", gateId: "G-COOL" } } });
}

function Harness({ initial, window: context, openWindow, runtime }: { initial: EventSequenceQuantification; window?: EsqWindowContext; openWindow: (ctx: EsqWindowContext) => void; runtime?: EsqWorkbookRuntime }): JSX.Element {
  const [esq, setEsq] = useState(initial);
  const upstream = useMemo(() => modelUpstream(), []);
  const mutateEsq = useCallback((mutator: (current: EventSequenceQuantification) => EventSequenceQuantification): void => setEsq((current) => mutator(current)), []);
  return (
    <EsqWorkbookProvider data={{ esq }} editable mutateEsq={mutateEsq} upstream={upstream} runtime={runtime}>
      {context === undefined ? <LogicScreen openWindow={openWindow} /> : <LogicWindows context={context} onClose={() => undefined} />}
    </EsqWorkbookProvider>
  );
}

function result(release: number): EventTreeAnalysisResult {
  return {
    schemaVersion: "1.0.0",
    runId: "00000000-0000-4000-8000-000000000001",
    owner: { workbookId: "esq-1", modelId: esqTreeRunId("ET-A"), workbookRevision: 4 },
    mode: "INDEPENDENT",
    sequences: [
      { sequenceId: esqSequenceRunId("ET-A", "A-1"), path: [], result: { kind: "END_STATE", endStateId: esqEndStateRunId("SUCCESSFUL_MITIGATION") }, conditionalProbability: 0.99, annualFrequency: 2.7 },
      { sequenceId: esqSequenceRunId("ET-A", "A-2"), path: [], result: { kind: "END_STATE", endStateId: esqEndStateRunId("RADIONUCLIDE_RELEASE") }, conditionalProbability: release / 2.7, annualFrequency: release },
    ],
    endStateAggregates: [{ endStateId: esqEndStateRunId("RADIONUCLIDE_RELEASE"), annualFrequency: release }],
    validationIssues: [],
    completedAt: NOW,
  };
}

describe("ESQ Step 03 logic screen", () => {
  afterEach(() => jest.resetAllMocks());

  it("counts each tab and blocks on an open support loop", () => {
    render(<Harness initial={looped()} openWindow={jest.fn()} />);
    expect(screen.getByRole("tab", { name: "Flags (0)" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Loops (1)" }));
    expect(screen.getByRole("table", { name: "Support loops" })).toHaveTextContent("Open");
    fireEvent.click(screen.getByRole("tab", { name: "Checks (1)" }));
    expect(screen.getByRole("table", { name: "Logic checks" })).toHaveTextContent("Loop not broken");
  });

  it("adds a flag and opens its window", () => {
    const openWindow = jest.fn();
    render(<Harness initial={looped()} openWindow={openWindow} />);
    fireEvent.click(screen.getByRole("button", { name: "Add flag" }));
    expect(openWindow).toHaveBeenCalledWith({ kind: "esqFlag", id: "FL-1" });
    expect(screen.getByRole("tab", { name: "Flags (1)" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Flags" })).toHaveTextContent("Not set");
  });

  it("sets a basic event flag for one state in its window", () => {
    const esq = looped();
    esq.logic = { flags: [{ id: "FL-1", name: "Fan lost", state: false, groupIds: [], stateIds: [], basis: "" }] };
    render(<Harness initial={esq} window={{ kind: "esqFlag", id: "FL-1" }} openWindow={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Sets"), { target: { value: "EVENT" } });
    expect(screen.getByLabelText("Basic event")).toHaveValue("E-1");
    fireEvent.change(screen.getByLabelText("Basic event"), { target: { value: "E-3" } });
    fireEvent.change(screen.getByLabelText("State"), { target: { value: "TRUE" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "POS-02" }));
    expect(screen.getByLabelText("Basic event")).toHaveValue("E-3");
    expect(screen.getByLabelText("State")).toHaveValue("TRUE");
    expect(screen.getByRole("checkbox", { name: "POS-02" })).toBeChecked();
  });

  it("cuts a support loop in its window", () => {
    const esq = looped();
    render(<Harness initial={esq} window={{ kind: "esqLoop", id: "M-COOL|M-SUP" }} openWindow={jest.fn()} />);
    expect(screen.getByText("Still a loop. Cut one more transfer.")).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "SUP-TOP to COOL-TOP" });
    fireEvent.change(within(group).getByLabelText("Transfer"), { target: { value: "FALSE" } });
    expect(screen.getByText("The loop is broken.")).toBeInTheDocument();
    expect(within(group).getByLabelText("Basis")).toBeInTheDocument();
  });

  it("runs a tree and compares it with an earlier run", async () => {
    const earlier: EsqTreeRun = { id: "run-1", requestedAt: "2026-10-05T10:00:00.000Z", revision: 3, status: "SUCCEEDED", logic: { flags: false, loopBreaks: "AS_SET", exclusions: true, expandCcf: true }, result: result(4e-3) };
    const latest: EsqTreeRun = { id: "run-2", requestedAt: "2026-10-05T11:00:00.000Z", revision: 4, status: "SUCCEEDED", logic: { flags: true, loopBreaks: "AS_SET", exclusions: true, expandCcf: true }, result: result(2e-3) };
    jest.mocked(listEsqTreeRuns).mockResolvedValueOnce([earlier]).mockResolvedValue([latest, earlier]);
    jest.mocked(runEsqEventTree).mockResolvedValue({
      schemaVersion: "1.0.0",
      run: {
        schemaVersion: "1.0.0",
        id: "run-2",
        owner: { workbookId: "esq-1", modelId: esqTreeRunId("ET-A"), workbookRevision: 4 },
        sourceWorkbooks: [{ workbookId: "esq-1", workbookRevision: 4 }],
        methodType: "EVENT_TREE",
        scope: "SINGLE",
        batchId: null,
        status: "SUCCEEDED",
        requestedBy: "analyst",
        requestedAt: latest.requestedAt,
        startedAt: latest.requestedAt,
        completedAt: latest.requestedAt,
        engine: null,
        failure: null,
      },
    });
    render(<Harness initial={looped()} openWindow={jest.fn()} runtime={SAVED} />);
    fireEvent.click(screen.getByRole("tab", { name: "Runs" }));
    expect(await screen.findByRole("table", { name: "Sequence frequencies" })).toHaveTextContent("A-2");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Run event tree" })); });
    expect(runEsqEventTree).toHaveBeenCalledWith("esq-1", "ET-A", 4, { flags: true, loopBreaks: "AS_SET", exclusions: true, expandCcf: true });
    await waitFor(() => expect(within(screen.getByLabelText("Compare with")).getAllByRole("option")).toHaveLength(2));
    fireEvent.change(screen.getByLabelText("Compare with"), { target: { value: "run-1" } });
    const table = screen.getByRole("table", { name: "Sequence frequencies" });
    expect(table).toHaveTextContent("-50%");
    expect(screen.getByRole("table", { name: "Family frequencies" })).toHaveTextContent("F-REL");
  });
});
