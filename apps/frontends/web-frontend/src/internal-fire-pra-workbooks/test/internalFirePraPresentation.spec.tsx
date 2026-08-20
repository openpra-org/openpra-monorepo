import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type JSX, useState } from "react";
import { createInternalFirePraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/internal-fire-pra-seed-factory";
import { InternalFirePraStepScreen } from "../internalFirePraStepScreen";
import { InternalFirePraWorkbookProvider } from "../internalFirePraWorkbookContext";
import { ApprovalScreen } from "../steps/approvalScreen";
import { DraftScreen } from "../steps/draftScreen";
import { ReviewScreen } from "../steps/reviewScreen";

function renderStep(stepId = "analysis-basis"): HTMLElement {
  const result = render(<InternalFirePraWorkbookProvider mef={createInternalFirePraExample("htgr")} editable mutate={jest.fn()}><InternalFirePraStepScreen stepId={stepId} /></InternalFirePraWorkbookProvider>);
  return result.container;
}

function StatefulReviewHarness(): JSX.Element {
  const [mef, setMef] = useState(() => createInternalFirePraExample("htgr"));
  return <InternalFirePraWorkbookProvider mef={mef} editable={false} mutate={(mutator) => setMef((current) => mutator(current))}><ReviewScreen persona="reviewer" /></InternalFirePraWorkbookProvider>;
}

describe("Internal Fire PRA presentation", () => {
  it("uses the Seismic Step 01 section and flat-input pattern", async () => {
    const container = renderStep();
    expect(screen.getByRole("heading", { name: "PRA analysis and scope" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Common fire-analysis inputs" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Interfaces" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Physical analysis units" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ignition-source basis" })).toBeInTheDocument();
    expect(screen.getAllByRole("table")).toHaveLength(2);
    expect(container.querySelector(".flreadout, .flquality, .flcheck, .flworkflow-card__metrics")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Edit PRA analysis and scope" }));
    const dialog = screen.getByRole("dialog", { name: "PRA analysis and scope" });
    for (const label of ["Intended application", "Purpose", "Decision supported", "Risk measures and endpoints", "Plant name", "Site", "Vendor or designer", "Reactor type", "Thermal power", "Modules or units", "PRA scope"]) expect(within(dialog).getByText(label)).toBeInTheDocument();
    expect(dialog.querySelector("aside")).toBeNull();
    expect(dialog.querySelector(".sstructured__navlist")).toBeNull();
  });

  it("shows only external technical-element interfaces", async () => {
    renderStep();
    for (const lane of ["POS → F", "IE → F", "ES → F", "SC → F", "SY → F", "HR → F", "DA → F", "F → ESQ", "F → RI"]) expect(screen.getByText(lane)).toBeInTheDocument();
    expect(screen.queryByText("FPP → FES")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("POS → F").closest("button") as HTMLButtonElement);
    expect(screen.getByText("Full-power operation")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Annual exposure" })).toBeInTheDocument();
    expect(screen.queryByText("Transfer basis")).not.toBeInTheDocument();
    expect(screen.queryByText("Standard requirements")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit Full-power operation" }));
    const transferDialog = screen.getByRole("dialog", { name: "Technical-element transfer record" });
    expect(within(transferDialog).getByText("Technical-element handoff")).toBeInTheDocument();
    expect(within(transferDialog).queryByText("Transfer basis")).not.toBeInTheDocument();
    expect(within(transferDialog).queryByText("Standard requirements")).not.toBeInTheDocument();
    expect(transferDialog.querySelector("aside")).toBeNull();
    expect(transferDialog.querySelector(".sstructured__navlist")).toBeNull();
    await userEvent.click(within(transferDialog).getByRole("button", { name: "Close editor" }));

    await userEvent.click(screen.getByText("DA → F").closest("button") as HTMLButtonElement);
    expect(screen.getByText("Electrical cabinets ignition-frequency parameter")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Uncertainty model" })).toBeInTheDocument();

    await userEvent.click(screen.getByText("F → ESQ").closest("button") as HTMLButtonElement);
    expect(screen.getByRole("columnheader", { name: "Mean frequency" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Release category" })).toBeInTheDocument();

    await userEvent.click(screen.getByText("F → RI").closest("button") as HTMLButtonElement);
    expect(screen.getByRole("columnheader", { name: "Contributor type" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "FV and RAW" })).toBeInTheDocument();
  });

  it("has no standalone coverage-verification or stat-box sections", () => {
    const container = renderStep("plant-partitioning");
    expect(screen.queryByRole("heading", { name: "Coverage verification" })).not.toBeInTheDocument();
    expect(container.querySelector(".flreadout, .flquality, .flcheck, .flworkflow-card__metrics")).toBeNull();
  });

  it("removes the repeated method-and-documentation section from every technical step", () => {
    for (const stepId of ["evidence", "plant-partitioning", "equipment-selection", "cable-selection", "qualitative-screening", "plant-response", "scenario-analysis", "ignition-frequency", "circuit-failure", "human-reliability", "quantification", "risk-interpretation", "risk-integration"]) {
      const { unmount } = render(<InternalFirePraWorkbookProvider mef={createInternalFirePraExample("htgr")} editable mutate={jest.fn()}><InternalFirePraStepScreen stepId={stepId} /></InternalFirePraWorkbookProvider>);
      expect(screen.queryByRole("heading", { name: "Method and documentation" })).not.toBeInTheDocument();
      unmount();
    }
  });

  it("uses the POS draft structure", () => {
    render(<InternalFirePraWorkbookProvider mef={createInternalFirePraExample("htgr")} editable mutate={jest.fn()}><DraftScreen /></InternalFirePraWorkbookProvider>);
    expect(screen.getByText("Generated preview · Word output")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Conformance check" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hand-off to internal review" })).toBeInTheDocument();
    expect(screen.getByText("Circuit failure analysis")).toBeInTheDocument();
  });

  it("uses the POS review structure and lets comment authors resolve findings", async () => {
    render(<StatefulReviewHarness />);
    expect(screen.getByText("In review")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "All review comments" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open (3)" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Mark resolved" }).length).toBeGreaterThan(0);
    await userEvent.click(screen.getAllByRole("button", { name: "Mark resolved" })[0]!);
    expect(screen.getByRole("button", { name: "Open (2)" })).toBeInTheDocument();
  });

  it("uses the POS approval structure and scopes the approver's comment record", () => {
    render(<InternalFirePraWorkbookProvider mef={createInternalFirePraExample("htgr")} editable={false} mutate={jest.fn()}><ApprovalScreen persona="approver" /></InternalFirePraWorkbookProvider>);
    expect(screen.getByRole("heading", { name: "Your comments" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What is being attested" })).toBeInTheDocument();
    expect(screen.getByText("Configuration snapshot")).toBeInTheDocument();
  });
});
