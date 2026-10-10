import { JSX, useCallback, useMemo, useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { esqPostRunId, esqRecoveryEventId } from "interfaces-mef-types/esq/esq-post-inputs";
import { esqModelRunId } from "interfaces-mef-types/esq/esq-solve-inputs";
import type { AnalysisRunMetadata } from "interfaces-shared-types/newly-developed-methods/shared";
import { EsqWorkbookProvider, type EsqWorkbookRuntime } from "../esqWorkbookContext";
import { PostScreen, PostWindows } from "../esqPostScreen";
import { type EsqWindowContext } from "../esqModelScreen";
import { MODEL_AS_SET } from "../esqLogic";
import { withRunOfRecord } from "../esqSolve";
import { postViewOf, withCombinationsFor, withRecoveryRule, withSearch } from "../esqPost";
import { getEsqModelRunResult, getEsqPostResult, runEsqModel, runEsqPost } from "../esqWorkbookApi";
import { MODEL_RUN, NOW, POST_RUN, modelSummary, postEsq, postSummary, postUpstream } from "./esqPostFixtures";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { praxisUncertainty, settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";

jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

jest.mock("../esqWorkbookApi", () => ({
  ...jest.requireActual<typeof import("../esqWorkbookApi")>("../esqWorkbookApi"),
  runEsqPost: jest.fn(),
  getEsqPostResult: jest.fn(),
  runEsqModel: jest.fn(),
  getEsqModelRunResult: jest.fn(),
}));

const SAVED: EsqWorkbookRuntime = { workbookId: "esq-1", projectId: "p-1", revision: 4, saveStatus: "saved" };
const NR = esqRecoveryEventId("REC-1");

function runOf(id: string, modelId: string): { schemaVersion: "1.0.0"; run: AnalysisRunMetadata } {
  return {
    schemaVersion: "1.0.0",
    run: {
      schemaVersion: "1.0.0",
      id,
      owner: { workbookId: "esq-1", modelId, workbookRevision: 4 },
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
  };
}

function credited(esq: EventSequenceQuantification): EventSequenceQuantification {
  return withRecoveryRule(esq, "REC-1", { id: "REC-1", groupIds: [], stateIds: [], credited: true, basis: "The local start is in the procedure." });
}

function assessed(): EventSequenceQuantification {
  const esq = credited(postEsq());
  const searched = withSearch(esq, postSummary(esq, [
    { eventIds: [NR, "E-3"].sort(), treeIds: ["ET-A"], cutSetCount: 1, nominalFrequency: 4e-6 },
    { eventIds: ["E-2", "E-3"], treeIds: ["ET-A", "ET-B"], cutSetCount: 2, nominalFrequency: 1.2e-7 },
  ]));
  return withCombinationsFor(searched, (postViewOf(searched)?.combinations ?? []).map((row) => row.eventIds));
}

function Harness({ initial, window: context, onChange }: { initial: EventSequenceQuantification; window?: EsqWindowContext; onChange?: (esq: EventSequenceQuantification) => void }): JSX.Element {
  const [esq, setEsq] = useState(initial);
  const upstream = useMemo(() => postUpstream(), []);
  const mutateEsq = useCallback((mutator: (current: EventSequenceQuantification) => EventSequenceQuantification): void => setEsq((current) => {
    const next = mutator(current);
    onChange?.(next);
    return next;
  }), [onChange]);
  return (
    <EsqWorkbookProvider data={{ esq }} editable mutateEsq={mutateEsq} upstream={upstream} runtime={SAVED}>
      {context === undefined ? <PostScreen openWindow={jest.fn()} /> : <PostWindows context={context} onClose={() => undefined} />}
    </EsqWorkbookProvider>
  );
}

function lastOf(onChange: jest.Mock): EventSequenceQuantification {
  return onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as EventSequenceQuantification;
}

function typeInto(field: HTMLElement, value: string): void {
  fireEvent.focus(field);
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
}

describe("ESQ Step 06 post-processing screen", () => {
  beforeEach(() => jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty));
  afterEach(() => jest.resetAllMocks());

  it("counts the sections and lists the checks", () => {
    render(<Harness initial={postEsq()} />);
    expect(screen.getByRole("tab", { name: "Recovery (2)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Checks (1)" })).toBeInTheDocument();
    expect(screen.getByText("Step 03 holds no exclusion. Add one there for basic events that cannot occur together.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Recovery (2)" }));
    const recoveries = screen.getByRole("table", { name: "Recoveries" });
    expect(recoveries).toHaveTextContent("SUP-FAN-HFE");
    expect(recoveries).toHaveTextContent("0.1");
    fireEvent.click(screen.getByRole("tab", { name: "Checks (1)" }));
    expect(screen.getByRole("table", { name: "Post-processing checks" })).toHaveTextContent("HFE combinations not searched");
  });

  it("searches with every HEP raised and assesses the combinations it finds", async () => {
    const esq = credited(postEsq());
    jest.mocked(runEsqPost).mockResolvedValue(runOf(POST_RUN, esqPostRunId()));
    jest.mocked(getEsqPostResult).mockResolvedValue(postSummary(esq, [
      { eventIds: ["E-2", "E-3"], treeIds: ["ET-A", "ET-B"], cutSetCount: 2, nominalFrequency: 1.2e-7 },
      { eventIds: [NR, "E-3"].sort(), treeIds: ["ET-A"], cutSetCount: 1, nominalFrequency: 4e-6 },
    ]));
    const onChange = jest.fn();
    render(<Harness initial={esq} onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "HFE combinations (0)" }));
    expect(screen.getByText("No search yet.")).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Search" })); });
    expect(runEsqPost).toHaveBeenCalledWith("esq-1", 4, MODEL_AS_SET, "COMBINATIONS", 1e-14, 0.8);
    expect(lastOf(onChange).postWork?.search?.findings).toHaveLength(2);
    const table = screen.getByRole("table", { name: "HFE combinations" });
    expect(within(table).getAllByText("Not assessed")).toHaveLength(2);
    expect(table).toHaveTextContent("4E-6");
    fireEvent.click(screen.getByRole("button", { name: "Assess all 2" }));
    expect(lastOf(onChange).postWork?.combinations?.map((entry) => entry.id)).toEqual(["HC-1", "HC-2"]);
    expect(within(screen.getByRole("table", { name: "HFE combinations" })).getAllByText("HR assessment")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Show the details of HC-2" }));
    expect(screen.getByRole("table", { name: "HFE combinations" })).toHaveTextContent("DEP-1 · Moderate · 1.6E-4");
  });

  it("checks the deletions of the Step 03 exclusions", async () => {
    const base = postEsq();
    const esq: EventSequenceQuantification = { ...base, logic: { exclusions: [{ id: "EX-1", eventIds: ["E-1", "E-4"], basis: "Never in test together." }] } };
    jest.mocked(runEsqPost).mockResolvedValue(runOf(POST_RUN, esqPostRunId()));
    jest.mocked(getEsqPostResult).mockResolvedValue(postSummary(esq, [], [{ exclusionId: "EX-1", treeIds: ["ET-A"], cutSetCount: 3, nominalFrequency: 2e-6 }]));
    const onChange = jest.fn();
    render(<Harness initial={esq} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Cutoff (/yr)"), { target: { value: "-12" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Check deletions" })); });
    expect(runEsqPost).toHaveBeenCalledWith("esq-1", 4, MODEL_AS_SET, "DELETIONS", 1e-12, undefined);
    expect(lastOf(onChange).postWork?.deletions?.findings).toEqual([{ exclusionId: "EX-1", treeIds: ["ET-A"], cutSetCount: 3, nominalFrequency: 2e-6 }]);
    const table = screen.getByRole("table", { name: "Exclusions and deletions" });
    expect(table).toHaveTextContent("COOL-PMP-FS · RPS-DIV-FS");
    expect(table).toHaveTextContent("2E-6");
  });

  it("credits a recovery with a typed HEP and typed feasibility", () => {
    const onChange = jest.fn();
    render(<Harness initial={postEsq()} window={{ kind: "esqPostRecovery", id: "REC-2" }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Credit"), { target: { value: "yes" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Crew" }));
    fireEvent.click(screen.getByRole("button", { name: "Type a non-recovery HEP" }));
    typeInto(within(screen.getByRole("group", { name: "Typed value" })).getByRole("textbox", { name: "Value" }), "0.3");
    typeInto(within(screen.getByRole("group", { name: "Typed value" })).getByLabelText("Source"), "Remote panel timing study");
    fireEvent.change(screen.getByLabelText("Value of record"), { target: { value: "TYPED" } });
    expect(lastOf(onChange).postWork?.recoveries?.find((rule) => rule.id === "REC-2")).toMatchObject({
      credited: true,
      ofRecord: "TYPED",
      typed: { expression: { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value: 0.3 } } }, source: "Remote panel timing study" },
      feasibility: { procedure: true, training: true, cues: true, crew: true, time: true, access: true, equipment: true },
    });
    fireEvent.click(screen.getByRole("button", { name: "Use HR feasibility" }));
    expect(lastOf(onChange).postWork?.recoveries?.find((rule) => rule.id === "REC-2")?.feasibility).toBeUndefined();
  });

  it("sets a dependence level and takes the THERP joint from the PRAXIS points of the HR laws", async () => {
    const onChange = jest.fn();
    render(<Harness initial={assessed()} window={{ kind: "esqPostCombination", id: "HC-2" }} onChange={onChange} />);
    expect(screen.getByLabelText("HR assessment")).toHaveValue("");
    expect(screen.getByRole("option", { name: "Matched · DEP-1" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Dependence level"), { target: { value: "LOW" } });
    fireEvent.change(screen.getByLabelText("Value of record"), { target: { value: "THERP" } });
    typeInto(screen.getByLabelText("Basis"), "Same crew, different cues.");
    expect(lastOf(onChange).postWork?.combinations?.find((entry) => entry.id === "HC-2")).toMatchObject({ level: "LOW", ofRecord: "THERP", basis: "Same crew, different cues." });
    await act(async () => { await settledWithPraxis(() => undefined); });
    expect(screen.getByRole("option", { name: "THERP at low · 6.9E-5" })).toBeInTheDocument();
  });

  it("runs the model without the rules and compares the families", async () => {
    const done = assessed();
    const recorded = withRunOfRecord(done, modelSummary(done, 5.8e-5));
    jest.mocked(runEsqModel).mockResolvedValue(runOf(MODEL_RUN, esqModelRunId()));
    jest.mocked(getEsqModelRunResult).mockResolvedValue(modelSummary(recorded, 7.6e-5, { ...MODEL_AS_SET, recovery: false, dependency: false }));
    const onChange = jest.fn();
    render(<Harness initial={recorded} onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Results" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Run without the rules" })); });
    expect(runEsqModel).toHaveBeenCalledWith("esq-1", 4, { ...MODEL_AS_SET, recovery: false, dependency: false }, "CUT_SETS", { basis: "FREQUENCY", cutOffs: [1e-12, 1e-13, 1e-14], quantifier: "MCUB", keep: 100, limitOrder: 4 });
    expect(lastOf(onChange).postWork?.comparison?.families).toEqual([{ familyId: "F-REL", annualFrequency: 7.6e-5 }, { familyId: "F-OK", annualFrequency: 3 }]);
    const table = screen.getByRole("table", { name: "Families with and without the rules" });
    expect(table).toHaveTextContent("7.6E-5");
    expect(table).toHaveTextContent("5.8E-5");
    expect(table).toHaveTextContent("-23.68%");
  });
});
