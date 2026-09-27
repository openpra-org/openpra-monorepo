import { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RcQuantificationPanel } from "../rcQuantification";
import { RcWorkbookProvider, useRcWorkbook, type RcWorkbookData, type RcCaseActions } from "../rcWorkbookContext";

const snapshotFile = { documentId: "00000000-0000-4000-8000-000000000001", filename: "Case-01-inputs.json", sha256: "a".repeat(64), size: 10, uploadedAt: "2026-09-24T00:00:00.000Z" };
const snapshotSummary = { label: "Case 01", categoryId: "RC-1", file: snapshotFile, inputHash: "b".repeat(64), createdBy: "analyst", reviewItems: 0, inventoryCount: 1, receptorCount: 1, trialCount: 1 };
function setup(caseRecords?: object) {
  const data = { rc: { releaseCategoryToConsequence: { releaseCategoryInputs: [{ releaseCategory: "RC-1", releaseCharacteristics: {} }] }, protectiveActionParameters: {}, meteorologicalData: {}, atmosphericTransportAndDispersion: {}, dosimetry: {}, consequenceQuantification: { caseRecords } }, cc: {}, nms: [] } as unknown as RcWorkbookData;
  const actions: RcCaseActions = {
    saveSnapshot: jest.fn(), saveResult: jest.fn(async () => ({ revision: 2, snapshots: [], results: [] })), removeResult: jest.fn(async () => ({ revision: 2, snapshots: [], results: [] })),
    readTable: jest.fn(async () => ({ columns: ["Name"], rows: [], total: 0, offset: 0, units: "" })),
    readReview: jest.fn(async () => ({ schemaVersion: 2 as const, files: [], embedded: [], excludedSteps: [], checks: [] })), readText: jest.fn(async () => ({ text: "", offset: 0, total: 0 })), readOutput: jest.fn(async () => ({ text: "", offset: 0, total: 0 })),
  };
  const open = jest.fn();
  function TestControls() {
    const { setWeatherDraft, setResultDraft, resultDraft } = useRcWorkbook(), [show, setShow] = useState(true);
    return <><button onClick={() => setWeatherDraft({ baseRevision: 0, settings: { year: 2020 } })}>Set input draft</button><button onClick={() => setWeatherDraft(undefined)}>Clear input draft</button>
      <button onClick={() => setResultDraft({ snapshotId: "test", metricId: "", mean: "0", percentiles: {}, exceedances: {}, version: "test", reference: "retained draft", confirmed: false })}>Set result draft</button>
      <button onClick={() => setShow(!show)}>Toggle panel</button><output aria-label="Retained reference">{resultDraft?.reference}</output>{show && <RcQuantificationPanel onOpenStep={open} />}</>;
  }
  render(<RcWorkbookProvider data={data} editable mutateRc={jest.fn()} caseRecords={actions}><TestControls /></RcWorkbookProvider>);
  return { actions, open };
}
describe("Step 08 local input handling", () => {
  it("blocks snapshot saving until outstanding input drafts are resolved", async () => {
    const { actions } = setup();
    fireEvent.click(screen.getByRole("tab", { name: "Prepared inputs" }));
    await waitFor(() => expect(actions.readTable).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Save input snapshot" })).toBeEnabled();
    fireEvent.click(screen.getByText("Set input draft"));
    expect(screen.getByRole("button", { name: "Save input snapshot" })).toBeDisabled();
    expect(screen.getByText(/Steps 01 to 05 contain unsaved edits/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Clear input draft"));
    expect(screen.getByRole("button", { name: "Save input snapshot" })).toBeEnabled();
  });
  it("retains an output draft when the Quantification panel is remounted", () => {
    setup(); fireEvent.click(screen.getByText("Set result draft")); fireEvent.click(screen.getByText("Toggle panel")); fireEvent.click(screen.getByText("Toggle panel"));
    expect(screen.getByLabelText("Retained reference")).toHaveTextContent("retained draft");
  });
  it("keeps review links and keyboard tabs connected to their existing sections", () => {
    const { open } = setup(); fireEvent.click(screen.getByRole("button", { name: "01. Source term" })); expect(open).toHaveBeenCalledWith("handoff");
    const checks = screen.getByRole("tab", { name: "Case & checks" }); checks.focus(); fireEvent.keyDown(checks, { key: "End" });
    expect(screen.getByRole("tab", { name: "Results" })).toHaveFocus(); expect(screen.getByRole("tab", { name: "Results" })).toHaveAttribute("aria-selected", "true");
  });
  const doseMetric = { id: "RCM-01", name: "30-day dose at the EAB", quantity: "INDIVIDUAL_DOSE", windowSeconds: 2592000, unit: "Sv", statistics: { mean: true, percentiles: [5, 95], exceedanceThresholds: [0.001] } };
  const riskMetric = { id: "RCM-02", name: "Early fatality risk within 1 mile of the EAB", quantity: "INDIVIDUAL_EARLY_FATALITY_RISK", windowSeconds: 345600, unit: "per event", statistics: { mean: true, percentiles: [], exceedanceThresholds: [] } };
  const snapshotId = "00000000-0000-4000-8000-000000000002";
  const withSnapshot = (results: object[] = []) => ({ revision: 1, results, snapshots: [{ ...snapshotSummary, id: snapshotId, metrics: [doseMetric, riskMetric] }] });
  const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
  it("offers every snapshot metric and asks for exactly the statistics it names", () => {
    setup(withSnapshot());
    fireEvent.click(screen.getByRole("tab", { name: "Results" }));
    const metric = screen.getByRole("combobox", { name: "Consequence metric" });
    expect(metric).toHaveValue("RCM-01");
    expect(screen.getByRole("option", { name: "30-day dose at the EAB · 30 days" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Early fatality risk within 1 mile of the EAB · 96 hours" })).toBeInTheDocument();
    expect(screen.getByLabelText("Mean (Sv)")).toBeInTheDocument();
    expect(screen.getByLabelText("5th percentile (Sv)")).toBeInTheDocument();
    expect(screen.getByLabelText("95th percentile (Sv)")).toBeInTheDocument();
    expect(screen.getByLabelText("Chance of exceeding 0.001 Sv (100 mrem) (0 to 1)")).toBeInTheDocument();
    fireEvent.change(metric, { target: { value: "RCM-02" } });
    expect(screen.getByLabelText("Mean (per event)")).toBeInTheDocument();
    expect(screen.queryByLabelText("5th percentile (Sv)")).not.toBeInTheDocument();
  });
  it("saves a complete result with its output file and flags percentiles out of order", async () => {
    const { actions } = setup(withSnapshot());
    fireEvent.click(screen.getByRole("tab", { name: "Results" }));
    const text = "TEST FIXTURE ONLY\nmean 0.01\n", file = new File([text], "run.out", { type: "text/plain" });
    Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode(text).buffer });
    fireEvent.change(screen.getByLabelText("Output file"), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByLabelText("Selected output preview")).toHaveTextContent("TEST FIXTURE ONLY"));
    type("Mean (Sv)", "0.01"); type("5th percentile (Sv)", "0.05"); type("95th percentile (Sv)", "0.03"); type("Chance of exceeding 0.001 Sv (100 mrem) (0 to 1)", "0.9");
    type("Code and version", "code 1.0"); type("Calculation reference", "Run 7");
    fireEvent.click(screen.getByRole("checkbox", { name: /These values come from the selected output/ }));
    expect(screen.getByText("Percentile values must not decrease as the percentile rises")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save result" })).toBeDisabled();
    type("5th percentile (Sv)", "0.003");
    expect(screen.getByRole("button", { name: "Save result" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Save result" }));
    await waitFor(() => expect(actions.saveResult).toHaveBeenCalledWith(1, { snapshotId, metricId: "RCM-01", version: "code 1.0", reference: "Run 7", confirmed: true,
      statistics: { mean: 0.01, percentiles: [{ percentile: 5, value: 0.003 }, { percentile: 95, value: 0.03 }], exceedances: [{ threshold: 0.001, probability: 0.9 }] } }, file));
  });
  it("lists saved results with their statistics and removes one", async () => {
    const result = { id: "00000000-0000-4000-8000-000000000009", snapshotId, categoryId: "RC-1", metricId: "RCM-01", unit: "Sv", version: "code 1.0", reference: "Run 7", confirmed: true,
      statistics: { mean: 0.01, percentiles: [{ percentile: 5, value: 0.003 }, { percentile: 95, value: 0.03 }], exceedances: [{ threshold: 0.001, probability: 0.9 }] },
      file: { ...snapshotFile, documentId: "00000000-0000-4000-8000-000000000008", filename: "run.out" }, recordedBy: "analyst", valueSource: "transcribed" };
    const { actions } = setup(withSnapshot([result]));
    fireEvent.click(screen.getByRole("tab", { name: "Results" }));
    expect(screen.getByText("RC-1 · 30-day dose at the EAB")).toBeInTheDocument();
    expect(screen.getByText("Mean 0.01 Sv · 5th percentile 0.003 Sv · 95th percentile 0.03 Sv · Chance of exceeding 0.001 Sv: 0.9")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove result" }));
    await waitFor(() => expect(actions.removeResult).toHaveBeenCalledWith(1, result.id));
  });
  it("asks for a new snapshot when the selected one predates metrics", () => {
    setup({ revision: 1, results: [], snapshots: [{ ...snapshotSummary, id: "00000000-0000-4000-8000-000000000003", integrationSeconds: 2592000 }] });
    fireEvent.click(screen.getByRole("tab", { name: "Results" }));
    expect(screen.getByText(/This snapshot predates consequence metrics/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save result" })).toBeDisabled();
  });
});
