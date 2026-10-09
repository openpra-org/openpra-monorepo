import { JSX, useCallback, useMemo, useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { LoadCapacityAnalysisResult } from "interfaces-shared-types/newly-developed-methods/load-capacity";
import { esqCellRunId } from "interfaces-mef-types/esq/esq-barrier-inputs";
import { EsqWorkbookProvider, type EsqWorkbookRuntime } from "../esqWorkbookContext";
import { BarrierScreen, BarrierWindows } from "../esqBarrierScreen";
import { type EsqWindowContext } from "../esqModelScreen";
import { listEsqCellRuns, runEsqBarrierCell, type EsqCellRunEntry } from "../esqWorkbookApi";
import { barrierUpstream, modeledEsq } from "./esqBarrierFixtures";

jest.mock("../esqWorkbookApi", () => ({
  ...jest.requireActual<typeof import("../esqWorkbookApi")>("../esqWorkbookApi"),
  listEsqCellRuns: jest.fn(),
  runEsqBarrierCell: jest.fn(),
}));

const SAVED: EsqWorkbookRuntime = { workbookId: "esq-1", projectId: "p-1", revision: 4, saveStatus: "saved" };

function Harness({ initial, window: context, openWindow, runtime, onChange }: { initial: EventSequenceQuantification; window?: EsqWindowContext; openWindow: (ctx: EsqWindowContext) => void; runtime?: EsqWorkbookRuntime; onChange?: (esq: EventSequenceQuantification) => void }): JSX.Element {
  const [esq, setEsq] = useState(initial);
  const upstream = useMemo(() => barrierUpstream(), []);
  const mutateEsq = useCallback((mutator: (current: EventSequenceQuantification) => EventSequenceQuantification): void => setEsq((current) => {
    const next = mutator(current);
    onChange?.(next);
    return next;
  }), [onChange]);
  return (
    <EsqWorkbookProvider data={{ esq }} editable mutateEsq={mutateEsq} upstream={upstream} runtime={runtime}>
      {context === undefined ? <BarrierScreen openWindow={openWindow} /> : <BarrierWindows context={context} onClose={() => undefined} />}
    </EsqWorkbookProvider>
  );
}

function result(): LoadCapacityAnalysisResult {
  return {
    schemaVersion: "1.0.0",
    runId: "00000000-0000-4000-8000-000000000002",
    owner: { workbookId: "esq-1", modelId: esqCellRunId("BC-1"), workbookRevision: 4 },
    completedAt: "2026-10-05T12:00:00.000Z",
    method: "POINT_LOAD",
    pointProbability: 0.9912,
    pointLoad: { family: "POINT", value: 48 },
    pointCapacity: { family: "LOGNORMAL", mean: 33.74468539677077, errorFactor: 1.287, level: 0.95 },
    unit: "h",
    uncertainty: null,
    curve: [{ load: 20, probability: 0.0004 }, { load: 48, probability: 0.9912 }],
    validationIssues: [],
  };
}

describe("ESQ Step 04 barriers screen", () => {
  afterEach(() => jest.resetAllMocks());

  it("counts each tab and shows Hazards only with an external hazard group", () => {
    const { unmount } = render(<Harness initial={modeledEsq()} openWindow={jest.fn()} />);
    expect(screen.getByRole("tab", { name: "Barriers (3)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Phenomena (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Capacity (1)" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Hazards/ })).not.toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Barriers" })).toHaveTextContent("2 · gross, localized");
    unmount();
    const esq = modeledEsq();
    const seismic: EventSequenceQuantification = { ...esq, modelIntegration: { ...esq.modelIntegration, scopeCoverage: { ...esq.modelIntegration.scopeCoverage, hazardGroups: ["Internal events", "Seismic events"] } } };
    render(<Harness initial={seismic} openWindow={jest.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Hazards (0)" }));
    expect(screen.getByRole("button", { name: "Add hazard cell" })).toBeInTheDocument();
  });

  it("adds a barrier by hand and opens its window", () => {
    const openWindow = jest.fn();
    render(<Harness initial={modeledEsq()} openWindow={openWindow} />);
    fireEvent.click(screen.getByRole("button", { name: "Add barrier" }));
    expect(openWindow).toHaveBeenCalledWith({ kind: "esqBarrier", id: "BR-1" });
    expect(screen.getByRole("tab", { name: "Barriers (4)" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Barriers" })).toHaveTextContent("By hand");
  });

  it("adds a failure mode and maps the IE barrier in the barrier window", () => {
    const onChange = jest.fn();
    render(<Harness initial={modeledEsq()} window={{ kind: "esqBarrier", id: "Primary boundary" }} openWindow={jest.fn()} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Add failure mode" }));
    const group = screen.getByRole("group", { name: "FM-3 · Gross" });
    fireEvent.change(within(group).getByLabelText("Kind"), { target: { value: "LOCALIZED" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "RCB" }));
    expect(screen.getByRole("group", { name: "FM-3 · Localized" })).toBeInTheDocument();
    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as EventSequenceQuantification;
    expect(last.barrierWork?.barriers?.find((entry) => entry.barrierId === "Primary boundary")).toMatchObject({ impactRefs: ["RCB"], modes: [{ id: "FM-3", kind: "LOCALIZED" }] });
  });

  it("edits the capacity law and makes one of its fields uncertain in the cell window", () => {
    const onChange = jest.fn();
    render(<Harness initial={modeledEsq()} window={{ kind: "esqCell", id: "BC-1" }} openWindow={jest.fn()} onChange={onChange} />);
    const capacity = screen.getByRole("group", { name: "Capacity" });
    expect(within(capacity).getByLabelText("From")).toHaveValue("typed");
    expect(within(capacity).getAllByLabelText("Law")[0]).toHaveValue("LOGNORMAL");
    expect(within(capacity).getByRole("textbox", { name: "Mean" })).toHaveValue("33.74468539677077");
    fireEvent.change(within(capacity).getAllByLabelText("Law")[0] ?? capacity, { target: { value: "NORMAL" } });
    expect(within(capacity).getByRole("textbox", { name: "Mean" })).toHaveValue("33.74468539677077");
    fireEvent.click(within(capacity).getByRole("checkbox", { name: "Mean" }));
    expect(within(capacity).getByRole("group", { name: "Mean" })).toBeInTheDocument();
    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as EventSequenceQuantification;
    expect(last.barrierWork?.cells?.[0]?.capacity).toMatchObject({
      source: "TYPED",
      variable: { law: { family: "NORMAL", mean: 33.74468539677077 }, fields: [{ field: "mean", value: { node: "VALUE", value: { unit: "QUANTITY", law: { family: "POINT", value: 33.74468539677077 } } } }] },
    });
  });

  it("types the cell value as a law and takes the load from DA", () => {
    const onChange = jest.fn();
    render(<Harness initial={modeledEsq()} window={{ kind: "esqCell", id: "BC-1" }} openWindow={jest.fn()} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Type a value" }));
    const typed = screen.getByRole("group", { name: "Typed value" });
    fireEvent.change(within(typed).getByLabelText("Law"), { target: { value: "BETA" } });
    fireEvent.change(screen.getByLabelText("Value of record"), { target: { value: "TYPED" } });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as EventSequenceQuantification;
    expect(last.barrierWork?.cells?.[0]).toMatchObject({ ofRecord: "TYPED", typed: { expression: { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "BETA" } } }, basis: "" } });
    fireEvent.change(within(screen.getByRole("group", { name: "Load · the challenge" })).getByLabelText("From"), { target: { value: "da:P-WIN" } });
    expect(screen.getByRole("group", { name: "Load · the challenge" })).toHaveTextContent("Lognormal (mean 33.7, EF 1.29)");
    const capacity = screen.getByRole("group", { name: "Capacity" });
    fireEvent.change(within(capacity).getByLabelText("From"), { target: { value: "fragility" } });
    expect(within(capacity).getByLabelText("Median capacity")).toHaveValue(1);
    fireEvent.change(within(capacity).getByLabelText("Median capacity"), { target: { value: "2.08" } });
    fireEvent.blur(within(capacity).getByLabelText("Median capacity"));
    const fragile = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as EventSequenceQuantification;
    expect(fragile.barrierWork?.cells?.[0]?.capacity).toMatchObject({ source: "FRAGILITY", fragility: { betaR: 0.25, betaU: 0.3 } });
  });

  it("runs a cell and keeps the run as the value of record", async () => {
    const run: EsqCellRunEntry = { id: "run-1", requestedAt: "2026-10-05T12:00:00.000Z", revision: 4, status: "SUCCEEDED", settings: { sampling: "LATIN_HYPERCUBE", samples: 10000, seed: 20261005, curvePoints: 41 }, result: result() };
    jest.mocked(listEsqCellRuns).mockResolvedValueOnce([]).mockResolvedValue([run]);
    jest.mocked(runEsqBarrierCell).mockResolvedValue({
      schemaVersion: "1.0.0",
      run: {
        schemaVersion: "1.0.0",
        id: "run-1",
        owner: { workbookId: "esq-1", modelId: esqCellRunId("BC-1"), workbookRevision: 4 },
        sourceWorkbooks: [{ workbookId: "esq-1", workbookRevision: 4 }],
        methodType: "LOAD_CAPACITY",
        scope: "SINGLE",
        batchId: null,
        status: "SUCCEEDED",
        requestedBy: "analyst",
        requestedAt: run.requestedAt,
        startedAt: run.requestedAt,
        completedAt: run.requestedAt,
        engine: null,
        failure: null,
      },
    });
    render(<Harness initial={modeledEsq()} openWindow={jest.fn()} runtime={SAVED} />);
    fireEvent.click(screen.getByRole("tab", { name: "Results" }));
    expect(await screen.findByText("No run of this cell yet.")).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Run cell" })); });
    expect(runEsqBarrierCell).toHaveBeenCalledWith("esq-1", "BC-1", 4, { sampling: "LATIN_HYPERCUBE", samples: 10000, seed: 20261005, curvePoints: 41 });
    expect(await screen.findByText("Capacity distribution at a point load")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Conditional failure curve" })).toHaveTextContent("9.91E-1");
    fireEvent.click(screen.getByRole("button", { name: "Use as value of record" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Value of record" })).toBeDisabled());
    const values = screen.getByRole("table", { name: "Values of record" });
    expect(values).toHaveTextContent("9.91E-1");
    expect(values).toHaveTextContent("Run");
  });
});
