import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type JSX, useState } from "react";
import { createHighWindsPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/high-winds-pra-seed-factory";
import { HighWindsPraStepScreen } from "../highWindsPraStepScreen";
import { HighWindsPraWorkbookProvider } from "../highWindsPraWorkbookContext";
import { HighWindsApprovalScreen, HighWindsDraftScreen, HighWindsReviewScreen } from "../highWindsPraWorkflowScreens";

function renderStep(stepId = "analysis-basis"): HTMLElement {
  const result = render(<HighWindsPraWorkbookProvider mef={createHighWindsPraExample("htgr")} editable mutate={jest.fn()}><HighWindsPraStepScreen stepId={stepId} /></HighWindsPraWorkbookProvider>);
  return result.container;
}

function StatefulReviewHarness(): JSX.Element {
  const [mef, setMef] = useState(() => createHighWindsPraExample("htgr"));
  return <HighWindsPraWorkbookProvider mef={mef} editable={false} mutate={(mutator) => setMef((current) => mutator(current))}><HighWindsReviewScreen persona="reviewer" /></HighWindsPraWorkbookProvider>;
}

describe("High Winds PRA presentation", () => {
  it("uses the established Step 01 pattern and a flat editor", async () => {
    const container = renderStep();
    for (const heading of ["PRA analysis and scope", "Site basis", "Analysis scope records", "Baseline PRA", "PRA applications", "Controlled evidence", "Interfaces"]) expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(container.querySelector(".flreadout, .flquality, .flcheck, .flworkflow-card__metrics")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Edit analysis scope" }));
    const dialog = screen.getByRole("dialog", { name: "PRA analysis and scope" });
    expect(within(dialog).getByText("PRA scope")).toBeInTheDocument();
    expect(within(dialog).getByText("Capability category")).toBeInTheDocument();
    expect(dialog.querySelector("aside")).toBeNull();
    expect(dialog.querySelector(".sstructured__navlist")).toBeNull();
  });

  it("shows only external technical-element interfaces with complete transfer data", async () => {
    renderStep();
    for (const lane of ["HS → W", "POS → W", "IE → W", "ES → W", "SC → W", "SY → W", "HR → W", "DA → W", "FL → W", "W → ESQ", "W → RI"]) expect(screen.getByText(lane)).toBeInTheDocument();
    expect(screen.queryByText("WHA → WFR")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("POS → W").closest("button") as HTMLButtonElement);
    expect(screen.getByText("POS-01-FULL-POWER · Full-power operation")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Operating state" })).toBeInTheDocument();
    expect(screen.queryByText("Transfer basis")).not.toBeInTheDocument();
    expect(screen.queryByText("Standard requirements")).not.toBeInTheDocument();
  });

  it.each(["htgr", "sfr"] as const)("populates every %s technical interface from record-level data", (variant) => {
    const mef = createHighWindsPraExample(variant);
    const expectedRows: Record<string, number> = { HS: 3, POS: 4, IE: 2, ES: 2, SC: 2, SY: 4, HR: 3, DA: 2, FL: 2, ESQ: 2, RI: 6 };

    expect(mef.analysisBasis.interfaces.map((item) => item.technicalElementCode)).toEqual(Object.keys(expectedRows));
    for (const item of mef.analysisBasis.interfaces) {
      expect(item.transferItems).toHaveLength(expectedRows[item.technicalElementCode]);
      expect(item.transferItems.every((transfer) => transfer.values.length === item.columns.length)).toBe(true);
      expect(item.transferItems.every((transfer) => transfer.destinationRefs.length > 0 && transfer.evidenceRefs.length > 0)).toBe(true);
      expect(item.consistent).toBe(true);
      expect(item.openItems).toEqual([]);
    }
  });

  it("renders complete technical sections without stat or coverage panels", () => {
    for (const stepId of ["hazard-screening", "wind-data", "straight-wind", "tropical-cyclone", "tornado", "hazard-integration", "preliminary-response", "investigation", "fragility-basis", "pressure-apc", "missile-fragility", "interaction-rain", "plant-response", "human-reliability", "quantification", "risk-interpretation", "technical-closure"]) {
      const { container, unmount } = render(<HighWindsPraWorkbookProvider mef={createHighWindsPraExample("htgr")} editable mutate={jest.fn()}><HighWindsPraStepScreen stepId={stepId} /></HighWindsPraWorkbookProvider>);
      expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("table").length).toBeGreaterThan(0);
      expect(screen.queryByRole("heading", { name: "Coverage verification" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Method and documentation" })).not.toBeInTheDocument();
      expect(container.querySelector(".flreadout, .flquality, .flcheck, .flworkflow-card__metrics")).toBeNull();
      unmount();
    }
  });

  it("renders the populated Human Reliability step through its navigation identifier", () => {
    renderStep("human-reliability");

    for (const heading of [
      "High-wind human actions",
      "Human failure events",
      "High-wind performance contexts",
      "HEP estimates",
      "Action confirmations",
      "Recovery assessments",
      "HRA dependencies",
    ]) expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();

    expect(screen.getByText("Align alternate decay heat removal")).toBeInTheDocument();
    expect(screen.getByText("Secure outage missile materials")).toBeInTheDocument();
    expect(screen.getByText("Clear debris from heat-rejection intake")).toBeInTheDocument();
    expect(screen.queryByText("Step configuration unavailable")).not.toBeInTheDocument();
  });

  it("uses the POS-style draft, review, and approval workflow", async () => {
    const draft = render(<HighWindsPraWorkbookProvider mef={createHighWindsPraExample("htgr")} editable mutate={jest.fn()}><HighWindsDraftScreen /></HighWindsPraWorkbookProvider>);
    expect(screen.getByText("Generated preview · Word output")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Conformance check" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download draft (.docx)" })).toBeInTheDocument();
    draft.unmount();

    const review = render(<StatefulReviewHarness />);
    expect(screen.getByRole("heading", { name: "All review comments" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Mark resolved" })).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Mark resolved" }));
    expect(screen.getByText("All comments resolved")).toBeInTheDocument();
    review.unmount();

    render(<HighWindsPraWorkbookProvider mef={createHighWindsPraExample("htgr")} editable={false} mutate={jest.fn()}><HighWindsApprovalScreen persona="approver" /></HighWindsPraWorkbookProvider>);
    expect(screen.getByRole("heading", { name: "Your comments" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What is being attested" })).toBeInTheDocument();
    expect(screen.getByText("Configuration snapshot")).toBeInTheDocument();
  });
});
