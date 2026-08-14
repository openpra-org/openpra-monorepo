import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createOtherHazardsPraSeed } from "../../../../../backends/web-backend/src/example-workbooks/seeds/other-hazards-pra-seed-factory";
import { OtherHazardsPraStepScreen } from "../otherHazardsPraStepScreen";
import { OtherHazardsPraWorkbookProvider } from "../otherHazardsPraWorkbookContext";
import {
  OtherHazardsApprovalScreen,
  OtherHazardsDraftScreen,
  OtherHazardsReviewScreen,
} from "../otherHazardsPraWorkflowScreens";

function renderStep(stepId = "analysis-basis"): HTMLElement {
  const result = render(
    <OtherHazardsPraWorkbookProvider
      mef={createOtherHazardsPraSeed("HTGR")}
      editable
      mutate={jest.fn()}
    >
      <OtherHazardsPraStepScreen stepId={stepId} />
    </OtherHazardsPraWorkbookProvider>,
  );
  return result.container;
}

describe("Other Hazards PRA presentation", () => {
  it("uses the established Step 01 layout and one flat editor", async () => {
    const container = renderStep();
    for (const heading of [
      "PRA analysis and scope",
      "Site basis",
      "Analysis scope records",
      "Baseline PRA",
      "PRA applications",
      "Interfaces",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    expect(container.querySelector(".flreadout, .flquality, .flcheck, .flworkflow-card__metrics")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Edit analysis scope" }));
    const dialog = screen.getByRole("dialog", { name: "PRA analysis and scope" });
    expect(within(dialog).getByText("PRA scope")).toBeInTheDocument();
    expect(within(dialog).getByText("Capability category")).toBeInTheDocument();
    expect(dialog.querySelector("aside aside, .sstructured__navlist")).toBeNull();
  });

  it("shows only external technical-element interfaces with realistic record transfers", async () => {
    renderStep();
    const laneCodes = Array.from(document.querySelectorAll(".poshandoff__tile-code"), (node) =>
      node.textContent?.replace(/\s+/g, " ").trim(),
    );
    expect(laneCodes).toEqual([
      "HS",
      "POS",
      "IE",
      "ES",
      "SC",
      "SY",
      "HR",
      "DA",
      "F",
      "FL",
      "XF",
      "S",
      "W",
      "ESQ",
      "MS",
      "RC",
      "RI",
      "CC",
    ]);
    expect(screen.queryByText(/OHA .* OFR/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add interface" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("HS").closest("button") as HTMLButtonElement);
    expect(screen.getByText(/HS-HTGR-O-TOX .* Chlorine rail release/)).toBeInTheDocument();
    expect(screen.getByText(/HS-HTGR-O-IMPACT .* Aircraft impact/)).toBeInTheDocument();
    expect(screen.getByText(/HS-HTGR-O-AIRBORNE .* Volcanic ash loading/)).toBeInTheDocument();
    const interfaceTable = screen.getByRole("columnheader", { name: "Retained hazard" }).closest("table");
    expect(interfaceTable).not.toBeNull();
    expect(within(interfaceTable as HTMLTableElement).queryByRole("columnheader", { name: "Status" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit interface" })).not.toBeInTheDocument();
    expect(screen.queryByText("Transfer basis")).not.toBeInTheDocument();
    expect(screen.queryByText("Standard requirements")).not.toBeInTheDocument();
  });

  it.each(["HTGR", "SFR"] as const)("populates all %s interface lanes at record level", (variant) => {
    const interfaces = createOtherHazardsPraSeed(variant).analysisBasis.interfaces;
    expect(interfaces).toHaveLength(18);
    expect(interfaces.map((item) => item.technicalElementCode)).toEqual([
      "HS",
      "POS",
      "IE",
      "ES",
      "SC",
      "SY",
      "HR",
      "DA",
      "F",
      "FL",
      "XF",
      "S",
      "W",
      "ESQ",
      "MS",
      "RC",
      "RI",
      "CC",
    ]);
    for (const item of interfaces) {
      expect(item.transferItems).toHaveLength(3);
      expect(item.transferItems.every((transfer) => transfer.values.length === item.columns.length)).toBe(
        true,
      );
      expect(item.transferItems.every((transfer) => transfer.destinationRefs.length > 0)).toBe(true);
      expect(item.transferItems.every((transfer) => transfer.evidenceRefs.length >= 3)).toBe(true);
      expect(item.transferItems.flatMap((transfer) => transfer.values).join(" ")).not.toContain(
        "controlled baseline",
      );
      expect(item.consistent).toBe(true);
      expect(item.openItems).toEqual([]);
    }
  });

  it("renders every technical step without stat or coverage panels", () => {
    for (const stepId of [
      "site-evidence",
      "retained-hazards",
      "source-characterization",
      "frequency-analysis",
      "secondary-hazards",
      "hazard-curves",
      "preliminary-response",
      "investigation",
      "fragility-basis",
      "fragility-analysis",
      "scenarios",
      "plant-response",
      "human-reliability",
      "quantification",
      "risk-interpretation",
      "risk-integration",
      "technical-closure",
    ]) {
      const { container, unmount } = render(
        <OtherHazardsPraWorkbookProvider
          mef={createOtherHazardsPraSeed("HTGR")}
          editable
          mutate={jest.fn()}
        >
          <OtherHazardsPraStepScreen stepId={stepId} />
        </OtherHazardsPraWorkbookProvider>,
      );
      expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("table").length).toBeGreaterThan(0);
      expect(screen.queryByRole("heading", { name: "Coverage verification" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Method and documentation" })).not.toBeInTheDocument();
      expect(
        container.querySelector(".flreadout, .flquality, .flcheck, .flworkflow-card__metrics"),
      ).toBeNull();
      unmount();
    }
  });

  it("renders a complete Human Reliability step", () => {
    renderStep("human-reliability");
    for (const heading of [
      "Other Hazards human actions",
      "Human failure events",
      "Hazard performance contexts",
      "HEP estimates",
      "Action confirmations",
      "Recovery assessments",
      "HRA dependencies",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    expect(screen.queryByText("Step configuration unavailable")).not.toBeInTheDocument();
  });

  it("uses the Seismic-style refinement stopping-criteria table and flat editor", async () => {
    renderStep("risk-integration");

    const table = screen.getByRole("table", { name: "Refinement stopping criteria" });
    for (const header of [
      "Aggregate change",
      "Family change",
      "Contributor rank shift",
      "Stable runs",
      "New contributors",
    ]) {
      expect(within(table).getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    expect(within(table).getByText("≤ 5.0%")).toBeInTheDocument();
    expect(within(table).getByText("2 consecutive")).toBeInTheDocument();
    expect(within(table).getByText("None allowed")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Edit criteria" }));
    const dialog = screen.getByRole("dialog", { name: "Refinement stopping criteria" });
    expect(within(dialog).getByLabelText("Maximum aggregate change")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Require no new risk-significant contributors")).toBeInTheDocument();
    expect(dialog.querySelector(".sstructured__navlist")).toBeNull();
  });

  it("uses the POS-style draft, review, and approval screens", () => {
    const mef = createOtherHazardsPraSeed("HTGR");
    const draft = render(
      <OtherHazardsPraWorkbookProvider
        mef={mef}
        editable
        mutate={jest.fn()}
      >
        <OtherHazardsDraftScreen />
      </OtherHazardsPraWorkbookProvider>,
    );
    expect(screen.getByRole("heading", { name: "Conformance check" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download draft (.docx)" })).toBeInTheDocument();
    draft.unmount();

    const review = render(
      <OtherHazardsPraWorkbookProvider
        mef={mef}
        editable={false}
        mutate={jest.fn()}
      >
        <OtherHazardsReviewScreen persona="reviewer" />
      </OtherHazardsPraWorkbookProvider>,
    );
    expect(screen.getByRole("heading", { name: "All review comments" })).toBeInTheDocument();
    review.unmount();

    render(
      <OtherHazardsPraWorkbookProvider
        mef={mef}
        editable={false}
        mutate={jest.fn()}
      >
        <OtherHazardsApprovalScreen persona="approver" />
      </OtherHazardsPraWorkbookProvider>,
    );
    expect(screen.getByRole("heading", { name: "Your comments" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What is being attested" })).toBeInTheDocument();
    expect(screen.getByText("Configuration snapshot")).toBeInTheDocument();
  });
});
