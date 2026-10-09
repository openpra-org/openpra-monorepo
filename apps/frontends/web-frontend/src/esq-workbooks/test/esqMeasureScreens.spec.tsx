import { JSX, useCallback, useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { esqImportanceRunId, esqUncertaintyRunId } from "interfaces-mef-types/esq/esq-measure-inputs";
import { esqSensitivityRunId } from "interfaces-mef-types/esq/esq-sensitivity-inputs";
import type { AnalysisRunMetadata } from "interfaces-shared-types/newly-developed-methods/shared";
import { EsqWorkbookProvider, type EsqWorkbookRuntime } from "../esqWorkbookContext";
import { ResultsScreen } from "../esqResultsScreen";
import { UncertScreen, UncertWindows } from "../esqUncertaintyScreen";
import { SensScreen, SensWindows } from "../esqSensitivityScreen";
import type { EsqWindowContext } from "../esqModelScreen";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { praxisUncertainty, settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";
import { HandoffScreen } from "../esqHandoffScreen";
import { importanceRecordOf, thresholdsOf, withImportance } from "../esqResults";
import { withCase } from "../esqSensitivity";
import {
  getEsqImportanceResult,
  getEsqModelRunResult,
  getEsqSensitivityResult,
  getEsqUncertaintyResult,
  runEsqImportance,
  runEsqSensitivity,
  runEsqUncertainty,
} from "../esqWorkbookApi";
import { NOW, modelSummary } from "./esqPostFixtures";
import { RELEASE, caseSummary, importanceResult, measureEsq, measureUpstream, uncertaintyResult } from "./esqMeasureFixtures";

jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

jest.mock("../esqWorkbookApi", () => ({
  ...jest.requireActual<typeof import("../esqWorkbookApi")>("../esqWorkbookApi"),
  runEsqImportance: jest.fn(),
  getEsqImportanceResult: jest.fn(),
  runEsqUncertainty: jest.fn(),
  getEsqUncertaintyResult: jest.fn(),
  runEsqSensitivity: jest.fn(),
  getEsqSensitivityResult: jest.fn(),
  getEsqModelRunResult: jest.fn(),
}));

const SAVED: EsqWorkbookRuntime = { workbookId: "esq-1", projectId: "p-1", revision: 5, saveStatus: "saved" };

type Step = "results" | "uncert" | "sens" | "handoff";

function WindowHarness({ initial, context }: { initial: EventSequenceQuantification; context: EsqWindowContext }): JSX.Element {
  const [esq, setEsq] = useState(initial);
  const [upstream] = useState(() => measureUpstream());
  const mutateEsq = useCallback((mutator: (current: EventSequenceQuantification) => EventSequenceQuantification): void => setEsq((current) => mutator(current)), []);
  return (
    <EsqWorkbookProvider data={{ esq }} editable mutateEsq={mutateEsq} upstream={upstream} runtime={SAVED}>
      {context.kind === "esqSensCase" ? <SensWindows context={context} onClose={jest.fn()} /> : <UncertWindows context={context} onClose={jest.fn()} />}
    </EsqWorkbookProvider>
  );
}

function runOf(id: string, modelId: string): { schemaVersion: "1.0.0"; run: AnalysisRunMetadata } {
  return {
    schemaVersion: "1.0.0",
    run: {
      schemaVersion: "1.0.0",
      id,
      owner: { workbookId: "esq-1", modelId, workbookRevision: 5 },
      sourceWorkbooks: [{ workbookId: "esq-1", workbookRevision: 5 }],
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

function Harness({ initial, step, onChange }: { initial: EventSequenceQuantification; step: Step; onChange: (esq: EventSequenceQuantification) => void }): JSX.Element {
  const [esq, setEsq] = useState(initial);
  const [upstream] = useState(() => measureUpstream());
  const mutateEsq = useCallback((mutator: (current: EventSequenceQuantification) => EventSequenceQuantification): void => setEsq((current) => {
    const next = mutator(current);
    onChange(next);
    return next;
  }), [onChange]);
  return (
    <EsqWorkbookProvider data={{ esq }} editable mutateEsq={mutateEsq} upstream={upstream} runtime={SAVED}>
      {step === "results" ? <ResultsScreen openWindow={jest.fn()} />
        : step === "uncert" ? <UncertScreen openWindow={jest.fn()} />
        : step === "sens" ? <SensScreen openWindow={jest.fn()} />
        : <HandoffScreen openWindow={jest.fn()} />}
    </EsqWorkbookProvider>
  );
}

function lastOf(onChange: jest.Mock): EventSequenceQuantification {
  return onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as EventSequenceQuantification;
}

async function settle(): Promise<void> {
  await act(async () => { await Promise.resolve(); });
  await act(async () => { await Promise.resolve(); });
}

async function praxis(): Promise<void> {
  await act(async () => { await settledWithPraxis(() => undefined); });
}

describe("ESQ Steps 07 to 10 screens", () => {
  beforeEach(() => {
    jest.mocked(runEsqImportance).mockReset();
    jest.mocked(getEsqImportanceResult).mockReset();
    jest.mocked(runEsqUncertainty).mockReset();
    jest.mocked(getEsqUncertaintyResult).mockReset();
    jest.mocked(runEsqSensitivity).mockReset();
    jest.mocked(getEsqSensitivityResult).mockReset();
    jest.mocked(getEsqModelRunResult).mockReset();
    jest.mocked(evaluateUncertainty).mockReset();
    jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
  });

  it("ranks importance with PRAXIS and lists the measures to four digits", async () => {
    const esq = measureEsq();
    const result = importanceResult(esq);
    jest.mocked(runEsqImportance).mockResolvedValue(runOf(result.runId, esqImportanceRunId()));
    jest.mocked(getEsqImportanceResult).mockResolvedValue(result);
    jest.mocked(getEsqModelRunResult).mockResolvedValue(modelSummary(esq, RELEASE));
    const onChange = jest.fn();
    render(<Harness initial={esq} step="results" onChange={onChange} />);
    await settle();
    expect(within(screen.getByRole("table", { name: "Cut sets" })).getByText("COOL-PMP-FS")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Importance/ }));
    fireEvent.click(screen.getByRole("button", { name: "Rank" }));
    await settle();
    expect(jest.mocked(runEsqImportance).mock.calls[0]?.slice(0, 2)).toEqual(["esq-1", 5]);
    expect(lastOf(onChange).review?.importance).toMatchObject({ runId: result.runId, base: RELEASE, silentEventIds: ["E-2"] });
    await settle();
    const table = screen.getByRole("table", { name: "Importance measures" });
    const pump = within(table).getByRole("button", { name: "COOL-PMP-FS" }).closest("tr");
    if (pump === null) throw new Error("no row");
    expect(within(pump).getByText("0.6")).toBeTruthy();
    expect(within(pump).getByText("300.4")).toBeTruthy();
  });

  it("samples with shared draws and stores the family statistics", async () => {
    const esq = withImportance(measureEsq(), importanceRecordOf(importanceResult(measureEsq()), measureEsq(), thresholdsOf(measureEsq(), undefined)));
    jest.mocked(runEsqUncertainty).mockResolvedValue(runOf("u-1", esqUncertaintyRunId()));
    jest.mocked(getEsqUncertaintyResult).mockImplementation(async () => uncertaintyResult(esq));
    const onChange = jest.fn();
    render(<Harness initial={esq} step="uncert" onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Runs" }));
    fireEvent.click(screen.getByRole("button", { name: "Sample" }));
    await settle();
    expect(jest.mocked(runEsqUncertainty).mock.calls[0]?.[3]).toEqual({ trials: 10000, seed: 1, method: "LATIN_HYPERCUBE", correlation: "SHARED" });
    expect(lastOf(onChange).uncertaintyWork?.run).toMatchObject({ trials: 1000, families: [expect.objectContaining({ familyId: "F-REL", mean: 1.3e-5, p95: 4.5e-5 })] });
    await settle();
    const keys = screen.getByRole("table", { name: "Sampled keys" });
    expect(keys).toHaveTextContent("Pump fails to start (P-1)");
    expect(keys).toHaveTextContent("Lognormal (mean 2.00E-3, EF 5) cut to [−∞, 1] · probability");
    expect(screen.getByText("1 input drew in this run. 1 input stayed at their point values.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Families/ }));
    const families = screen.getByRole("table", { name: "Family distributions" });
    expect(within(families).getAllByText("1.3E-5").length).toBeGreaterThan(0);
    fireEvent.click(within(families).getByRole("button", { name: "Show the details of F-REL" }));
    expect(families).toHaveTextContent("Standard error of the mean");
    expect(families).toHaveTextContent("6.32E-7");
  });

  it("lists the sampled inputs with their PRAXIS points and laws", async () => {
    const esq = withImportance(measureEsq(), importanceRecordOf(importanceResult(measureEsq()), measureEsq(), thresholdsOf(measureEsq(), undefined)));
    render(<Harness initial={esq} step="uncert" onChange={jest.fn()} />);
    await praxis();
    const table = screen.getByRole("table", { name: "Sampled inputs" });
    const pump = within(table).getByRole("button", { name: "Pump fails to start (P-1)" }).closest("tr");
    if (pump === null) throw new Error("no row");
    expect(pump).toHaveTextContent("2E-3");
    expect(pump).toHaveTextContent("Lognormal (mean 2.00E-3, EF 5)");
    const fan = within(table).getByRole("button", { name: "SUP-FAN-FR · Fan fails to run" }).closest("tr");
    if (fan === null) throw new Error("no row");
    expect(fan).toHaveTextContent("None, fixed at the point");
    fireEvent.click(within(pump).getByRole("button", { name: "Show the details of Pump fails to start (P-1)" }));
    await praxis();
    expect(table).toHaveTextContent("Two shared copies raise the mean");
    expect(table).toHaveTextContent("2.6×");
  });

  it("asks for a DA law on a component input and offers a typed error factor on the others", async () => {
    const esq = measureEsq();
    const { unmount } = render(<WindowHarness initial={esq} context={{ kind: "esqUncertInput", id: "PARAMETER:P-1" }} />);
    await praxis();
    expect(screen.getByText("Give the estimate a law in DA and import again in Step 02.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Error factor")).not.toBeInTheDocument();
    unmount();
    render(<WindowHarness initial={esq} context={{ kind: "esqUncertInput", id: "HFE:HFE-1" }} />);
    expect(screen.getByLabelText("Error factor")).toBeEnabled();
  });

  it("shows the expression a case changes instead of a point", () => {
    const esq = withCase(measureEsq(), "SC-1", { id: "SC-1", name: "Pump at its upper bound", kind: "PARAMETER", target: "P-1", value: 1e-2, basis: "DA upper bound." });
    render(<WindowHarness initial={esq} context={{ kind: "esqSensCase", id: "SC-1" }} />);
    expect(screen.getByText("Lognormal (mean 2.00E-3, EF 5) cut to [−∞, 1]")).toBeInTheDocument();
    expect(screen.getByText("probability")).toBeInTheDocument();
    expect(screen.getByText("A new value replaces the distribution with a point. A factor scales the whole value and keeps its distribution.")).toBeInTheDocument();
  });

  it("runs a sensitivity case beside the run of record", async () => {
    const esq = withCase(measureEsq(), "SC-1", { id: "SC-1", name: "Pump at its upper bound", kind: "PARAMETER", target: "P-1", value: 1e-2, basis: "DA upper bound." });
    jest.mocked(runEsqSensitivity).mockResolvedValue(runOf("s-1", esqSensitivityRunId("SC-1")));
    jest.mocked(getEsqSensitivityResult).mockImplementation(async () => caseSummary(esq, "SC-1", 5e-5));
    const onChange = jest.fn();
    render(<Harness initial={esq} step="sens" onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: /Cases/ }));
    fireEvent.click(screen.getByRole("button", { name: "Run all" }));
    await settle();
    expect(jest.mocked(runEsqSensitivity).mock.calls[0]?.slice(0, 5)).toEqual(["esq-1", "SC-1", 5, expect.objectContaining({ flags: true }), "CUT_SETS"]);
    expect(lastOf(onChange).sensitivityWork?.cases?.[0]?.run?.families).toEqual(expect.arrayContaining([{ familyId: "F-REL", annualFrequency: 5e-5 }]));
  });

  it("runs every pending case at one revision and saves their results together", async () => {
    let esq = withCase(measureEsq(), "SC-1", { id: "SC-1", name: "Pump at its upper bound", kind: "PARAMETER", target: "P-1", value: 1e-2, basis: "DA upper bound." });
    esq = withCase(esq, "SC-2", { id: "SC-2", name: "Pump at twice its estimate", kind: "PARAMETER", target: "P-1", factor: 2, basis: "Doubled for the test." });
    jest.mocked(runEsqSensitivity).mockImplementation(async (_workbookId, caseId) => runOf(`s-${caseId}`, esqSensitivityRunId(caseId)));
    jest.mocked(getEsqSensitivityResult).mockImplementation(async (_workbookId, caseId) => caseSummary(esq, caseId, caseId === "SC-1" ? 5e-5 : 3e-5));
    const onChange = jest.fn();
    render(<Harness initial={esq} step="sens" onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: /Cases/ }));
    fireEvent.click(screen.getByRole("button", { name: "Run 2 pending" }));
    await settle();
    await settle();
    await settle();
    expect(jest.mocked(runEsqSensitivity).mock.calls.map((call) => call.slice(1, 3))).toEqual([["SC-1", 5], ["SC-2", 5]]);
    expect(onChange).toHaveBeenCalledTimes(1);
    const runs = lastOf(onChange).sensitivityWork?.cases?.map((entry) => entry.run?.families.find((family) => family.familyId === "F-REL")?.annualFrequency);
    expect(runs).toEqual([5e-5, 3e-5]);
  });

  it("publishes the package from the ranking and the run of record", async () => {
    const base = measureEsq();
    const esq = withImportance(base, importanceRecordOf(importanceResult(base), base, thresholdsOf(base, undefined)));
    jest.mocked(getEsqImportanceResult).mockResolvedValue(importanceResult(esq));
    jest.mocked(getEsqModelRunResult).mockResolvedValue(modelSummary(esq, RELEASE));
    const onChange = jest.fn();
    render(<Harness initial={esq} step="handoff" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await settle();
    const published = lastOf(onChange);
    expect(published.handoffWork?.published).toMatchObject({ revision: 5, families: 2 });
    expect(published.importanceAnalyses?.[0]?.scope).toBe("OVERALL");
    expect(published.familyQuantifications.find((record) => record.eventSequenceFamilyRef === "F-REL")?.contributionBreakdown?.length).toBeGreaterThan(0);
  });
});
