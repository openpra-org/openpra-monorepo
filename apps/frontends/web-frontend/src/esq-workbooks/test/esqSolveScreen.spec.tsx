import { JSX, useCallback, useMemo, useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { esqModelRunId, solveInputsKey } from "interfaces-mef-types/esq/esq-solve-inputs";
import type { EsqModelRunResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import { EsqWorkbookProvider, type EsqWorkbookRuntime } from "../esqWorkbookContext";
import type { EsqUpstream } from "../esqLinks";
import { SolveScreen, SolveWindows } from "../esqSolveScreen";
import { type EsqWindowContext } from "../esqModelScreen";
import { withModelImported } from "../esqModel";
import { AS_SET, MODEL_AS_SET } from "../esqLogic";
import { withRunOfRecord } from "../esqSolve";
import { getEsqModelRunResult, listEsqModelRuns, runEsqModel, type EsqModelRunEntry } from "../esqWorkbookApi";
import { linkedEsq, modelUpstream } from "./esqModelFixtures";

jest.mock("../esqWorkbookApi", () => ({
  ...jest.requireActual<typeof import("../esqWorkbookApi")>("../esqWorkbookApi"),
  listEsqModelRuns: jest.fn(),
  runEsqModel: jest.fn(),
  getEsqModelRunResult: jest.fn(),
}));

jest.mock("../esqEventTreeHclWorkspace", () => ({
  EsqEventTreeHclWorkspace: ({ mode }: { mode: string }) => jest.requireActual<typeof import("react")>("react").createElement("p", null, `Hybrid workspace ${mode}`),
}));

const NOW = "2026-10-05T12:00:00.000Z";
const LATER = "2026-10-05T13:00:00.000Z";
const RUN = "4f6c1a2e-8b3d-4c5e-9f70-1a2b3c4d5e6f";
const NEWEST = "7c6c1a2e-8b3d-4c5e-9f70-1a2b3c4d5e6f";
const SAVED: EsqWorkbookRuntime = { workbookId: "esq-1", projectId: "p-1", revision: 4, saveStatus: "saved" };
const CUT_OFFS = [1e-6, 1e-7, 1e-8, 1e-9, 1e-10, 1e-11, 1e-12, 1e-13, 1e-14];
const RELEASE = [7.22e-5, 7.54e-5, 7.6075e-5, 7.6091e-5, 7.6107e-5, 7.61085e-5, 7.610863e-5, 7.6108643e-5, 7.61086450e-5];

function importedEsq(): EventSequenceQuantification {
  return withModelImported(linkedEsq(), modelUpstream(), NOW);
}

function summaryOf(esq: EventSequenceQuantification): EsqModelRunResult {
  return {
    schemaVersion: "1.0.0",
    kind: "ESQ_MODEL_RUN",
    runId: RUN,
    owner: { workbookId: "esq-1", modelId: esqModelRunId(), workbookRevision: 4 },
    completedAt: NOW,
    inputs: solveInputsKey(esq),
    calculation: "CUT_SETS",
    logic: AS_SET,
    cutSets: { basis: "FREQUENCY", cutOffs: CUT_OFFS, quantifier: "MCUB", keep: 100 },
    trees: [
      { treeId: "ET-A", runId: "5a6c1a2e-8b3d-4c5e-9f70-1a2b3c4d5e6f", status: "SUCCEEDED", initiatorFrequency: 2.5, failure: null },
      { treeId: "ET-B", runId: "6b6c1a2e-8b3d-4c5e-9f70-1a2b3c4d5e6f", status: "SUCCEEDED", initiatorFrequency: 0.5, failure: null },
    ],
    sequences: [
      { treeId: "ET-A", sequenceIds: ["A-2"], familyId: "F-REL", endState: "RADIONUCLIDE_RELEASE", conditionalProbability: 2.8e-5, annualFrequency: 7e-5, cutSetCount: 30 },
      { treeId: "ET-A", sequenceIds: ["A-3", "T-2"], familyId: "F-REL", endState: "RADIONUCLIDE_RELEASE", conditionalProbability: 1e-6, annualFrequency: 2.5e-6, cutSetCount: 4 },
      { treeId: "ET-B", sequenceIds: ["B-2"], familyId: "F-REL", endState: "RADIONUCLIDE_RELEASE", conditionalProbability: 7e-6, annualFrequency: 3.5e-6, cutSetCount: 3 },
      { treeId: "ET-A", sequenceIds: ["A-1"], familyId: "F-OK", endState: "SUCCESSFUL_MITIGATION", conditionalProbability: 1, annualFrequency: 2.5, cutSetCount: 1 },
      { treeId: "ET-B", sequenceIds: ["B-1"], familyId: "F-OK", endState: "SUCCESSFUL_MITIGATION", conditionalProbability: 1, annualFrequency: 0.5, cutSetCount: 1 },
    ],
    families: [
      {
        familyId: "F-REL",
        annualFrequency: 7.61086450e-5,
        sequenceCount: 3,
        cutSetCount: 309,
        sweep: CUT_OFFS.map((cutOff, index) => ({ cutOff, count: index + 6, annualFrequency: RELEASE[index] ?? 0 })),
        states: [{ stateId: "POS-01", annualFrequency: 7.2e-5, sweep: CUT_OFFS.map((cutOff, index) => ({ cutOff, count: index + 4, annualFrequency: (RELEASE[index] ?? 0) * 0.95 })) }],
        cutSets: [
          { treeId: "ET-A", basicEventIds: ["E-1", "E-2"], annualFrequency: 3.3e-5 },
          { treeId: "ET-B", basicEventIds: ["E-3"], annualFrequency: 1.2e-5 },
        ],
      },
      {
        familyId: "F-OK",
        annualFrequency: 3,
        sequenceCount: 2,
        cutSetCount: 2,
        sweep: CUT_OFFS.map((cutOff) => ({ cutOff, count: 2, annualFrequency: 3 })),
        states: [],
        cutSets: [{ treeId: "ET-A", basicEventIds: [], annualFrequency: 2.5 }],
      },
    ],
    endStates: [{ endState: "RADIONUCLIDE_RELEASE", annualFrequency: 7.6e-5 }],
    eventCodes: { "E-1": "SCS-PM-A", "E-2": "RCCS-STACK", "E-3": "RPS-DIV" },
    peakProbability: 2.8e-5,
  };
}

function Harness({ initial, window: context, runtime = SAVED, upstream, onChange }: { initial: EventSequenceQuantification; window?: EsqWindowContext; runtime?: EsqWorkbookRuntime; upstream?: EsqUpstream; onChange?: (esq: EventSequenceQuantification) => void }): JSX.Element {
  const [esq, setEsq] = useState(initial);
  const linked = useMemo(() => upstream ?? modelUpstream(), [upstream]);
  const mutateEsq = useCallback((mutator: (current: EventSequenceQuantification) => EventSequenceQuantification): void => setEsq((current) => {
    const next = mutator(current);
    onChange?.(next);
    return next;
  }), [onChange]);
  return (
    <EsqWorkbookProvider data={{ esq }} editable mutateEsq={mutateEsq} upstream={linked} runtime={runtime}>
      {context === undefined ? <SolveScreen openWindow={jest.fn()} /> : <SolveWindows context={context} onClose={() => undefined} />}
    </EsqWorkbookProvider>
  );
}

describe("ESQ Step 05 solve screen", () => {
  afterEach(() => jest.resetAllMocks());

  it("counts the families and asks for their values of record", () => {
    jest.mocked(listEsqModelRuns).mockResolvedValue([]);
    render(<Harness initial={importedEsq()} runtime={{ ...SAVED, workbookId: null }} />);
    expect(screen.getByRole("tab", { name: "Families (2)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Checks (2)" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Checks (2)" }));
    expect(screen.getByRole("table", { name: "Solve checks" })).toHaveTextContent("No value of record");
    fireEvent.click(screen.getByRole("tab", { name: "Convergence" }));
    expect(screen.getByText("Runs are kept with a saved workbook.")).toBeInTheDocument();
  });

  it("runs the model with cut sets and keeps the run as the values of record", async () => {
    const esq = importedEsq();
    const entry: EsqModelRunEntry = { id: RUN, requestedAt: NOW, revision: 4, status: "SUCCEEDED" };
    jest.mocked(listEsqModelRuns).mockResolvedValueOnce([]).mockResolvedValue([entry]);
    jest.mocked(getEsqModelRunResult).mockResolvedValue(summaryOf(esq));
    jest.mocked(runEsqModel).mockResolvedValue({
      schemaVersion: "1.0.0",
      run: {
        schemaVersion: "1.0.0",
        id: RUN,
        owner: { workbookId: "esq-1", modelId: esqModelRunId(), workbookRevision: 4 },
        sourceWorkbooks: [{ workbookId: "esq-1", workbookRevision: 4 }],
        methodType: "EVENT_TREE",
        scope: "BATCH",
        batchId: null,
        status: "SUCCEEDED",
        requestedBy: "analyst",
        requestedAt: NOW,
        startedAt: NOW,
        completedAt: NOW,
        engine: null,
        failure: null,
      },
    });
    const onChange = jest.fn();
    render(<Harness initial={esq} onChange={onChange} />);
    expect(await screen.findByText("No model run yet.")).toBeInTheDocument();
    expect(screen.getByText("The run lowers the cutoff one decade at a time from 1E-6 to 1E-14 per year, 9 cutoffs from one generation of the cut sets.")).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Run model" })); });
    expect(runEsqModel).toHaveBeenCalledWith("esq-1", 4, MODEL_AS_SET, "CUT_SETS", { basis: "FREQUENCY", cutOffs: CUT_OFFS, quantifier: "MCUB", keep: 100 });
    expect(await screen.findByText(/Solved 2 of 2 event trees\./)).toBeInTheDocument();
    const families = screen.getByRole("table", { name: "Family frequencies of this run" });
    expect(families).toHaveTextContent("7.61E-5");
    expect(families).toHaveTextContent("1E-8");
    fireEvent.click(screen.getByRole("button", { name: "Use as values of record" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Values of record" })).toBeDisabled());
    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as EventSequenceQuantification;
    expect(last.solve?.run?.runId).toBe(RUN);
    expect(last.familyQuantifications.map((record) => record.eventSequenceFamilyRef)).toEqual(["F-REL", "F-OK"]);
    fireEvent.click(screen.getByRole("tab", { name: "Families (2)" }));
    expect(screen.getByRole("table", { name: "Family values of record" })).toHaveTextContent("PRAXIS run");
  });

  it("lists the run of record when the history holds none and shows its sequences, cut sets and convergence", async () => {
    const base = importedEsq();
    const summary = summaryOf(base);
    jest.mocked(listEsqModelRuns).mockResolvedValue([]);
    jest.mocked(getEsqModelRunResult).mockResolvedValue(summary);
    render(<Harness initial={withRunOfRecord(base, summary)} />);
    expect(await screen.findByText(/Solved 2 of 2 event trees\./)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /revision 4 · of record$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Values of record" })).toBeDisabled();
    fireEvent.click(screen.getByRole("tab", { name: "Sequences" }));
    const sequences = await screen.findByRole("table", { name: "Sequence frequencies" });
    expect(sequences).toHaveTextContent("A-3 to T-2");
    expect(sequences).toHaveTextContent("ET-A · POS-01");
    fireEvent.click(screen.getByRole("tab", { name: "Cut sets" }));
    const cutSets = await screen.findByRole("table", { name: "Family cut sets" });
    expect(cutSets).toHaveTextContent("SCS-PM-A · RCCS-STACK");
    expect(cutSets).toHaveTextContent("43.36%");
    fireEvent.click(screen.getByRole("tab", { name: "Convergence" }));
    const convergence = screen.getByRole("table", { name: "Convergence by family" });
    expect(within(convergence).getAllByText("1E-8")).toHaveLength(2);
    fireEvent.click(within(convergence).getByRole("button", { name: "Show the details of F-REL" }));
    expect(screen.getByRole("table", { name: "F-REL sweep" })).toHaveTextContent("4.43%");
    fireEvent.click(screen.getByRole("tab", { name: "Verification" }));
    expect(screen.getByText("No family has a typed or imported value yet. Open a family to add one beside its PRAXIS value.")).toBeInTheDocument();
  });

  it("shows the newest run before it is used and follows the run picked on any tab", async () => {
    const base = importedEsq();
    const recorded = summaryOf(base);
    const newest = summaryOf(base);
    newest.runId = NEWEST;
    newest.completedAt = LATER;
    const release = newest.families[0];
    if (release === undefined) throw new Error("fixture has no family");
    release.cutSets = [{ treeId: "ET-B", basicEventIds: ["E-3"], annualFrequency: 5e-5 }];
    release.sweep = CUT_OFFS.map((cutOff, index) => ({ cutOff, count: index + 6, annualFrequency: 7e-5 * 1.1 ** index }));
    jest.mocked(listEsqModelRuns).mockResolvedValue([
      { id: NEWEST, requestedAt: LATER, revision: 4, status: "SUCCEEDED" },
      { id: RUN, requestedAt: NOW, revision: 4, status: "SUCCEEDED" },
    ]);
    jest.mocked(getEsqModelRunResult).mockImplementation(async (_workbookId, runId) => (runId === NEWEST ? newest : recorded));
    const onChange = jest.fn();
    render(<Harness initial={withRunOfRecord(base, recorded)} onChange={onChange} />);
    expect(await screen.findByText(/Solved 2 of 2 event trees\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Cut sets" }));
    expect(await screen.findByRole("table", { name: "Family cut sets" })).toHaveTextContent("RPS-DIV");
    expect(screen.getByLabelText("Result")).toHaveValue(NEWEST);
    expect(screen.getByRole("button", { name: "Use as values of record" })).toBeEnabled();
    fireEvent.click(screen.getByRole("tab", { name: "Convergence" }));
    const sweeping = await screen.findByRole("table", { name: "Convergence by family" });
    expect(within(sweeping).getByText("Not yet")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Result"), { target: { value: RUN } });
    await waitFor(() => expect(within(screen.getByRole("table", { name: "Convergence by family" })).getAllByText("1E-8")).toHaveLength(2));
    expect(screen.getByRole("button", { name: "Values of record" })).toBeDisabled();
    fireEvent.click(screen.getByRole("tab", { name: "Cut sets" }));
    expect(screen.getByRole("table", { name: "Family cut sets" })).toHaveTextContent("SCS-PM-A · RCCS-STACK");
    fireEvent.change(screen.getByLabelText("Family"), { target: { value: "F-OK" } });
    fireEvent.change(screen.getByLabelText("Result"), { target: { value: NEWEST } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Use as values of record" })).toBeEnabled());
    expect(screen.getByLabelText("Family")).toHaveValue("F-OK");
    expect(screen.getByRole("table", { name: "Family cut sets" })).toHaveTextContent("Initiator alone");
    fireEvent.change(screen.getByLabelText("Family"), { target: { value: "F-REL" } });
    expect(screen.getByRole("table", { name: "Family cut sets" })).toHaveTextContent("RPS-DIV");
    fireEvent.click(screen.getByRole("button", { name: "Use as values of record" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Values of record" })).toBeDisabled());
    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as EventSequenceQuantification;
    expect(last.solve?.run?.runId).toBe(NEWEST);
    expect(screen.getByRole<HTMLOptionElement>("option", { name: /· of record$/ }).value).toBe(NEWEST);
  });

  it("keeps typed and imported family values and picks the value of record in the family window", () => {
    const base = importedEsq();
    const recorded = withRunOfRecord(base, summaryOf(base));
    const upstream = modelUpstream();
    const es = upstream.es;
    if (es === undefined) throw new Error("fixture has no ES");
    es.eventSequenceFamilies = es.eventSequenceFamilies.map((family) => (family.uuid === "F-REL" ? { ...family, meanFrequency: 4.323e-5 } : family));
    const onChange = jest.fn();
    render(<Harness initial={recorded} upstream={upstream} window={{ kind: "esqSolveFamily", id: "F-REL" }} onChange={onChange} />);
    const typed = screen.getByRole("group", { name: "Typed value" });
    const frequency = within(typed).getByLabelText("Frequency");
    fireEvent.focus(frequency);
    fireEvent.change(frequency, { target: { value: "7.5e-5" } });
    fireEvent.blur(frequency);
    const source = within(screen.getByRole("group", { name: "Typed value" })).getByLabelText("Source");
    fireEvent.focus(source);
    fireEvent.change(source, { target: { value: "Hand calculation" } });
    fireEvent.blur(source);
    fireEvent.click(screen.getByRole("button", { name: "Import from ES" }));
    fireEvent.change(screen.getByLabelText("Value of record"), { target: { value: "IMPORTED" } });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as EventSequenceQuantification;
    expect(last.solve?.families.find((entry) => entry.familyId === "F-REL")).toMatchObject({
      ofRecord: "IMPORTED",
      typed: { annualFrequency: 7.5e-5, source: "Hand calculation" },
      imported: { annualFrequency: 4.323e-5, element: "ES", workbookId: "es-1" },
    });
    expect(last.familyQuantifications.find((record) => record.eventSequenceFamilyRef === "F-REL")?.meanFrequency).toBe(4.323e-5);
  });

  it("shows the hybrid runs in place of the model run controls", async () => {
    jest.mocked(listEsqModelRuns).mockResolvedValue([]);
    render(<Harness initial={importedEsq()} />);
    expect(await screen.findByText("No model run yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Hybrid" }));
    expect(screen.getByText("Hybrid workspace RUNS")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run model" })).not.toBeInTheDocument();
  });
});
