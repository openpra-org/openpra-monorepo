import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";
import {
  RiskIntegrationBaselineScreen,
} from "../seismicPraScreens";
import { SeismicPraWorkbench } from "../seismicPraWorkbench";
import {
  SeismicPraWorkbookProvider,
  type SeismicPraVariant,
} from "../seismicPraWorkbookContext";

beforeAll(() => {
  if (globalThis.structuredClone === undefined) {
    globalThis.structuredClone = <T,>(value: T): T =>
      JSON.parse(JSON.stringify(value)) as T;
  }
});

function renderRiskIntegration(
  variant: SeismicPraVariant = "htgr",
): ReturnType<typeof createSeismicPraExample> {
  const mef = createSeismicPraExample(variant);
  render(
    <SeismicPraWorkbookProvider
      mef={mef}
      linkedInputs={null}
      editable
      mutate={jest.fn()}
    >
      <RiskIntegrationBaselineScreen />
    </SeismicPraWorkbookProvider>,
  );
  return mef;
}

describe("Seismic PRA Step 13 risk integration", () => {
  it.each(["htgr", "sfr"] as const)(
    "shows the complete final handoff and baseline for %s",
    (variant) => {
      const mef = renderRiskIntegration(variant);
      const distinctReleaseCategories = new Set(
        mef.seismicPlantResponseAnalysis.quantification
          .eventSequenceFamilyQuantifications
          .filter((family) =>
            family.releaseCategoryRef !== "RC-NO-RELEASE")
          .map((family) => family.releaseCategoryRef ?? "UNASSIGNED"),
      ).size;
      const expectedRows = new Map<string, number>([
        ["Plant-level seismic result", 1],
        ["Release-outcome handoff", distinctReleaseCategories],
        ["Risk Integration handoff", 1],
        ["Decision records", 8],
        ["Risk traceability paths", 7],
        ["Automated release checks", 5],
        ["Controlled baseline", 1],
        ["Controlled documentation", 4],
      ]);

      for (const heading of [
        "Seismic risk package",
        "Risk-informed actions",
        "Traceability and validation",
        "Controlled baseline",
      ]) {
        expect(screen.getByRole("heading", { name: heading }))
          .toBeInTheDocument();
      }

      for (const [caption, rowCount] of expectedRows) {
        const table = screen.getByRole("table", { name: caption });
        expect(within(table).getAllByRole("row")).toHaveLength(rowCount + 1);
        expect(table).toHaveStyle({ tableLayout: "fixed" });
      }

      expect(screen.queryByText("HLR-SPR-F")).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Produce the draft" }))
        .not.toBeInTheDocument();
    },
  );

  it.each(["htgr", "sfr"] as const)(
    "transfers the actual Step 11 release result for %s",
    (variant) => {
      const mef = renderRiskIntegration(variant);
      const expectedMean =
        mef.seismicPlantResponseAnalysis.quantification
          .eventSequenceFamilyQuantifications
          .filter((family) =>
            family.releaseCategoryRef !== "RC-NO-RELEASE")
          .reduce((sum, family) =>
            sum + (family.meanFrequency ?? family.pointEstimateFrequency), 0);
      const result = mef.riskIntegrationBaseline.result;
      const row = within(screen.getByRole("table", {
        name: "Plant-level seismic result",
      })).getAllByRole("row")[1]!;

      expect(result.aggregateReleaseFamilyMeanFrequency)
        .toBeCloseTo(expectedMean, 10);
      expect(result.plantOperatingStateRefs.length).toBeGreaterThan(0);
      expect(result.unitRefs.length).toBeGreaterThan(0);
      expect(result.radioactiveMaterialSourceRefs.length).toBeGreaterThan(0);
      expect(result.initiatingEventRefs.length).toBeGreaterThan(0);
      expect(result.status).toBe("READY_FOR_RISK_INTEGRATION");
      expect(result.overlapTreatment).toMatch(
        /fire.*flood.*liquefaction.*external flooding/i,
      );
      expect(result.crossHazardIntegrationBasis).toMatch(
        /does not invent an all-hazard total/i,
      );
      expect(row).toHaveTextContent(expectedMean.toExponential(3));
      expect(row).toHaveTextContent("Ready for risk integration");
    },
  );

  it("uses reactor-specific technical decisions and forwards plant-level evaluations", () => {
    const htgr = createSeismicPraExample("htgr").riskIntegrationBaseline;
    const sfr = createSeismicPraExample("sfr").riskIntegrationBaseline;

    expect(htgr.decisions.some((decision) =>
      /RCCS|helium/i.test(
        `${decision.name} ${decision.action} ${decision.basis}`,
      ))).toBe(true);
    expect(sfr.decisions.some((decision) =>
      /sodium|air cooler/i.test(
        `${decision.name} ${decision.action} ${decision.basis}`,
      ))).toBe(true);

    for (const baseline of [htgr, sfr]) {
      const forwarded = baseline.decisions.filter((decision) =>
        decision.decisionType === "DEFENSE_IN_DEPTH_INPUT"
        || decision.decisionType === "SSC_CLASSIFICATION_INPUT");
      expect(forwarded).toHaveLength(2);
      expect(forwarded.every((decision) =>
        decision.disposition === "FORWARD_TO_PLANT_PROCESS")).toBe(true);
      expect(forwarded.every((decision) =>
        /plant-level|does not assign/i.test(decision.basis))).toBe(true);
    }
  });

  it.each(["htgr", "sfr"] as const)(
    "provides complete evidence-to-decision traceability for %s",
    (variant) => {
      const integration =
        createSeismicPraExample(variant).riskIntegrationBaseline;

      expect(integration.traceabilityPaths).toHaveLength(7);
      expect(integration.traceabilityPaths.every((path) =>
        path.status === "PASS"
        && path.openItems.length === 0
        && path.riskIntegrationResultRef
          === integration.result.riskIntegrationResultRef
        && path.decisionRefs.length > 0)).toBe(true);
      expect(integration.traceabilityPaths.some((path) =>
        path.evidenceRefs.length > 0
        && path.hazardRefs.length > 0
        && path.sscRefs.length > 0
        && path.failureMechanismRefs.length > 0
        && path.fragilityRefs.length > 0
        && path.plantModelRefs.length > 0
        && path.eventSequenceRefs.length > 0)).toBe(true);
    },
  );

  it.each(["htgr", "sfr"] as const)(
    "loads an explicitly limited controlled example baseline for %s",
    (variant) => {
      const baseline =
        createSeismicPraExample(variant).riskIntegrationBaseline.baseline;

      expect(baseline.controlledDocumentRefs).toHaveLength(4);
      expect(baseline.peerReviewStatus).toBe("COMPLETE");
      expect(baseline.approvalStatus).toBe("APPROVED");
      expect(baseline.releaseStatus).toBe("CONTROLLED");
      expect(baseline.scopeLimitations.join(" ")).toMatch(
        /illustrative.*pre-operational.*synthetic/i,
      );
    },
  );

  it("keeps explanations behind question marks and details beside entry names", async () => {
    const mef = renderRiskIntegration();
    const decision = mef.riskIntegrationBaseline.decisions[0]!;

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", {
      name: "About Risk-informed actions",
    }));
    expect(screen.getByRole("note")).toHaveTextContent(
      "Each record turns a calculated seismic insight into one owned action",
    );
    expect(screen.getByRole("note")).toHaveTextContent("For example");

    expect(screen.queryByText(decision.action, { exact: false }))
      .not.toBeInTheDocument();
    const entryHelp = screen.getByRole("button", {
      name: `Technical basis for ${decision.name}`,
    });
    expect(entryHelp.closest(".sentryname")?.querySelector("strong"))
      .toHaveTextContent(decision.name);
    await userEvent.click(entryHelp);
    expect(screen.getByText(decision.action, { exact: false }))
      .toBeInTheDocument();
  });

  it("opens all Step 13 records in flat editors", async () => {
    renderRiskIntegration();

    await userEvent.click(screen.getByRole("button", {
      name: "Edit handoff",
    }));
    let dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Release-family mean frequency"))
      .toBeInTheDocument();
    expect(within(dialog).getByText("Plant operating state references"))
      .toBeInTheDocument();
    expect(dialog.querySelector(".sstructured__navlist")).toBeNull();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    await userEvent.click(within(dialog).getByRole("button", {
      name: "Close editor",
    }));

    await userEvent.click(screen.getByRole("button", {
      name: "Add decision",
    }));
    dialog = screen.getByRole("dialog", {
      name: "New risk-informed action",
    });
    expect(within(dialog).getByLabelText("Decision type"))
      .toBeInTheDocument();
    expect(within(dialog).getByText("Risk-driver references"))
      .toBeInTheDocument();
    expect(dialog.querySelector(".sstructured__navlist")).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", {
      name: "Close editor",
    }));

    await userEvent.click(screen.getByRole("button", {
      name: "Add trace path",
    }));
    dialog = screen.getByRole("dialog", {
      name: "New risk traceability path",
    });
    expect(within(dialog).getByText("Failure mechanisms"))
      .toBeInTheDocument();
    expect(within(dialog).getByText("Decision records"))
      .toBeInTheDocument();
    expect(dialog.querySelector(".sstructured__navlist")).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", {
      name: "Close editor",
    }));

    await userEvent.click(screen.getByRole("button", {
      name: "Edit baseline",
    }));
    dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Configuration-control record"))
      .toBeInTheDocument();
    expect(within(dialog).getByText("Application limitations"))
      .toBeInTheDocument();
    expect(dialog.querySelector(".sstructured__navlist")).toBeNull();
  });

  it("restores Draft, Review, and Approval after the 13 technical steps", () => {
    const mef = createSeismicPraExample("htgr");
    render(
      <MemoryRouter>
        <SeismicPraWorkbookProvider
          mef={mef}
          linkedInputs={null}
          editable
          mutate={jest.fn()}
        >
          <SeismicPraWorkbench
            persona="reviewer"
            setPersona={jest.fn()}
            showPersonaPicker={false}
            headerMeta={{
              projectName: "Reference project",
              workbookName: "Seismic PRA",
              workbookVersion: "1.0",
            }}
          />
        </SeismicPraWorkbookProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText("/ 16 steps")).toBeInTheDocument();
    expect(screen.getByRole("heading", {
      name: "Internal technical review",
    })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "All review comments" }))
      .toBeInTheDocument();
    expect(screen.getByText("Draft", { selector: ".srail__step-name" }))
      .toBeInTheDocument();
    expect(screen.getByText("Review", { selector: ".srail__step-name" }))
      .toBeInTheDocument();
    expect(screen.getByText("Approval", { selector: ".srail__step-name" }))
      .toBeInTheDocument();

    const conformance = screen.getByLabelText("Conformance checklist");
    expect(within(conformance).getByRole("heading", { name: "Conformance" }))
      .toBeInTheDocument();
    expect(within(conformance).getByText(/%$/, {
      selector: ".posdock__gauge-text",
    })).toBeInTheDocument();
    expect(within(conformance).getByText(/\d+ of \d+ ready/))
      .toBeInTheDocument();
    expect(within(conformance).getByText(
      /\d+ attention(?: · \d+ blocked)? · \d+ N\/A/,
    ))
      .toBeInTheDocument();
    expect(within(conformance).queryByText("SR capability assignments"))
      .not.toBeInTheDocument();
    expect(within(conformance).queryByText("Why these items?"))
      .not.toBeInTheDocument();
  });
});
