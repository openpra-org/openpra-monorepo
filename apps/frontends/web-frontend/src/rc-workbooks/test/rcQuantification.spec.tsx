import { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RcQuantificationPanel } from "../rcQuantification";
import { RcWorkbookProvider, useRcWorkbook, type RcWorkbookData, type RcCaseActions } from "../rcWorkbookContext";

function setup() {
  const data = { rc: { releaseCategoryToConsequence: { releaseCategoryInputs: [{ releaseCategory: "RC-1", releaseCharacteristics: {} }] }, protectiveActionParameters: {}, meteorologicalData: {}, atmosphericTransportAndDispersion: {}, dosimetry: {}, consequenceQuantification: {} }, cc: {}, nms: [] } as unknown as RcWorkbookData;
  const actions: RcCaseActions = {
    saveSnapshot: jest.fn(), saveResult: jest.fn(), readTable: jest.fn(async () => ({ columns: ["Name"], rows: [], total: 0, offset: 0, units: "" })),
    readReview: jest.fn(async () => ({ schemaVersion: 2 as const, files: [], embedded: [], excludedSteps: [], checks: [] })), readText: jest.fn(async () => ({ text: "", offset: 0, total: 0 })), readOutput: jest.fn(async () => ({ text: "", offset: 0, total: 0 })), readChoices: jest.fn(async () => ({ ids: [], total: 0 })),
  };
  const open = jest.fn();
  function TestControls() {
    const { setWeatherDraft, setResultDraft, resultDraft } = useRcWorkbook(), [show, setShow] = useState(true);
    return <><button onClick={() => setWeatherDraft({ baseRevision: 0, settings: { year: 2020 } })}>Set input draft</button><button onClick={() => setWeatherDraft(undefined)}>Clear input draft</button>
      <button onClick={() => setResultDraft({ snapshotId: "test", receptorId: "R1", trialId: "T1", doseText: "0", unit: "Sv", version: "test", reference: "retained draft", confirmed: false })}>Set result draft</button>
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
});
