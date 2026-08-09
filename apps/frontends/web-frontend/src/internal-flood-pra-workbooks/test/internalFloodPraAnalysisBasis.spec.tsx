import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type JSX, useState } from "react";
import { createInternalFloodPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/internal-flood-pra-seed-factory";
import { InternalFloodPraStepScreen } from "../internalFloodPraStepScreen";
import { InternalFloodPraWorkbookProvider } from "../internalFloodPraWorkbookContext";
import { ApprovalScreen } from "../steps/approvalScreen";
import { DraftScreen } from "../steps/draftScreen";
import { ReviewScreen } from "../steps/reviewScreen";

function renderStep(stepId = "analysis-basis"): HTMLElement {
  const result = render(
    <InternalFloodPraWorkbookProvider mef={createInternalFloodPraExample("htgr")} editable mutate={jest.fn()}>
      <InternalFloodPraStepScreen stepId={stepId} />
    </InternalFloodPraWorkbookProvider>,
  );
  return result.container;
}

function StatefulReviewHarness(): JSX.Element {
  const [mef, setMef] = useState(() => createInternalFloodPraExample("htgr"));
  return <InternalFloodPraWorkbookProvider mef={mef} editable={false} mutate={(mutator) => setMef((current) => mutator(current))}><ReviewScreen persona="reviewer" /></InternalFloodPraWorkbookProvider>;
}

describe("Internal Flood PRA presentation", () => {
  it("matches the Seismic Step 01 section and input pattern", async () => {
    const container = renderStep();

    expect(screen.getByRole("heading", { name: "PRA scope and application" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Internal-flood definition" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Interfaces" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Flood-source parameters" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Flood-area reference locations" })).toBeInTheDocument();
    expect(screen.getAllByRole("table")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Add flood source" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add flood area" })).toBeInTheDocument();
    expect(container.querySelector(".flreadout, .flquality, .flcheck, .flworkflow-card__metrics")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Edit PRA scope and application" }));
    const dialog = screen.getByRole("dialog", { name: "PRA scope and application" });
    for (const label of [
      "Intended application",
      "Purpose",
      "Decision supported",
      "Risk measures and endpoints",
      "Plant name",
      "Site",
      "Vendor or designer",
      "Reactor type",
      "Thermal power",
      "Modules or units",
      "Integrated PRA scope",
      "Plant stage",
      "Operating states",
      "Radioactive-material sources",
    ]) expect(within(dialog).getByText(label)).toBeInTheDocument();
    expect(dialog.querySelector("aside")).toBeNull();
    expect(dialog.querySelector(".sstructured__navlist")).toBeNull();
  });

  it("does not render standalone verification or stat-summary sections", () => {
    const partitioning = renderStep("plant-partitioning");
    expect(screen.queryByRole("heading", { name: "Coverage verification" })).not.toBeInTheDocument();
    expect(partitioning.querySelector(".flreadout, .flquality, .flcheck, .flworkflow-card__metrics")).toBeNull();
  });

  it("uses external technical-element handoffs in the baseline section", () => {
    renderStep("baseline-pra");
    expect(screen.queryByRole("heading", { name: "Consistency checks" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Technical-element handoffs" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add interface" })).toBeInTheDocument();
  });

  it("shows external technical-element inputs and outputs with record-level data", async () => {
    renderStep();

    for (const lane of ["POS → FL", "IE → FL", "ES → FL", "SC → FL", "SY → FL", "HR → FL", "DA → FL", "FL → ESQ", "FL → RI"]) {
      expect(screen.getByText(lane)).toBeInTheDocument();
    }
    expect(screen.queryByText("FLPP → FLSO")).not.toBeInTheDocument();
    expect(screen.queryByText("FLSO → FLSN")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("POS → FL").closest("button") as HTMLButtonElement);
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

    await userEvent.click(screen.getByText("DA → FL").closest("button") as HTMLButtonElement);
    expect(screen.getByText("Generic pipe rupture data")).toBeInTheDocument();
    expect(screen.getByText("Automatic isolation demand failures")).toBeInTheDocument();

    await userEvent.click(screen.getByText("FL → ESQ").closest("button") as HTMLButtonElement);
    expect(screen.getByRole("columnheader", { name: "Mean frequency" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Release category" })).toBeInTheDocument();

    await userEvent.click(screen.getByText("FL → RI").closest("button") as HTMLButtonElement);
    expect(screen.getByRole("columnheader", { name: "Contributor type" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "FV and RAW" })).toBeInTheDocument();
  });

  it("does not show the stopping-basis field in risk interpretation", () => {
    renderStep("risk-interpretation");
    expect(screen.queryByText("Stopping basis")).not.toBeInTheDocument();
  });

  it("uses the POS draft structure without legacy workflow tables", () => {
    const { container } = render(<InternalFloodPraWorkbookProvider mef={createInternalFloodPraExample("htgr")} editable mutate={jest.fn()}><DraftScreen /></InternalFloodPraWorkbookProvider>);
    expect(screen.getByText("Generated preview · Word output")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Conformance check" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hand-off to internal review" })).toBeInTheDocument();
    expect(screen.getByText("Flood scenarios, consequences, and screening")).toBeInTheDocument();
    expect(container.querySelector(".flworkflow-card")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Report sections" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Draft quality checks" })).not.toBeInTheDocument();
  });

  it("uses the POS review structure and lets comment authors resolve findings", async () => {
    render(<StatefulReviewHarness />);
    expect(screen.getByText("In review")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "All review comments" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open (3)" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Mark resolved" }).length).toBeGreaterThan(0);
    await userEvent.click(screen.getAllByRole("button", { name: "Mark resolved" })[0]!);
    expect(screen.getByRole("button", { name: "Open (2)" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Review plan and roster" })).not.toBeInTheDocument();
  });

  it("uses the POS approval structure and scopes the approver's comments", () => {
    render(<InternalFloodPraWorkbookProvider mef={createInternalFloodPraExample("htgr")} editable={false} mutate={jest.fn()}><ApprovalScreen persona="approver" /></InternalFloodPraWorkbookProvider>);
    expect(screen.getByRole("heading", { name: "Your comments" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What is being attested" })).toBeInTheDocument();
    expect(screen.getByText("Configuration snapshot")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Approval readiness" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Approval signatures" })).not.toBeInTheDocument();
  });
});
