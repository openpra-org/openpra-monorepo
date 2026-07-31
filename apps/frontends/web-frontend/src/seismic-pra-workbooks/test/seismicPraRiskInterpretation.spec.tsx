import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";
import { RiskInterpretationScreen } from "../seismicPraScreens";
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

function renderRiskInterpretation(
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
      <RiskInterpretationScreen />
    </SeismicPraWorkbookProvider>,
  );
  return mef;
}

describe("Seismic PRA Step 12 risk interpretation", () => {
  it.each(["htgr", "sfr"] as const)(
    "shows the complete interpretation and refinement loop for %s",
    (variant) => {
      const mef = renderRiskInterpretation(variant);
      const expectedRows = new Map<string, number>([
        ["Ground-motion and source drivers", 8],
        [
          "Plant-model contributors",
          mef.seismicPlantResponseAnalysis.quantification
            .riskSignificantContributors.length,
        ],
        [
          "Uncertainty drivers",
          mef.seismicPlantResponseAnalysis.quantification
            .modelUncertainties.length,
        ],
        [
          "Targeted refinement actions",
          mef.riskInterpretation.refinementActions.length,
        ],
        ["Stopping criteria", 1],
        [
          "Requantification history",
          mef.riskInterpretation.quantificationIterations.length,
        ],
      ]);

      for (const heading of [
        "Risk drivers",
        "Model refinements",
        "Requantification and stability",
      ]) {
        expect(screen.getByRole("heading", { name: heading }))
          .toBeInTheDocument();
      }

      for (const [caption, rowCount] of expectedRows) {
        const table = screen.getByRole("table", { name: caption });
        expect(within(table).getAllByRole("row")).toHaveLength(rowCount + 1);
        expect(table).toHaveStyle({ tableLayout: "fixed" });
      }

      expect(screen.queryByRole("heading", {
        name: "Human action scope",
      })).not.toBeInTheDocument();
      expect(screen.queryByText("HLR-SPR-E")).not.toBeInTheDocument();
    },
  );

  it.each(["htgr", "sfr"] as const)(
    "derives dominant bins from release-family contributions for %s",
    (variant) => {
      const mef = renderRiskInterpretation(variant);
      const table = screen.getByRole("table", {
        name: "Ground-motion and source drivers",
      });
      const rows = within(table).getAllByRole("row").slice(1);
      const lastRow = rows.at(-1)!;
      const firstRow = rows[0]!;

      expect(firstRow).toHaveTextContent("PRA bin 5");
      expect(firstRow).toHaveTextContent("27.");
      expect(lastRow.cells[4]).toHaveTextContent("100.0%");

      const sourceNames =
        mef.seismicHazardAnalysis.hazardQuantification.deaggregations
          .flatMap((deaggregation) => deaggregation.sourceContributions)
          .map((source) => source.contributorName);
      expect(sourceNames.some((name) => firstRow.textContent?.includes(name)))
        .toBe(true);
    },
  );

  it.each(["htgr", "sfr"] as const)(
    "ends on the actual Step 11 mean after two stable runs for %s",
    (variant) => {
      const mef = renderRiskInterpretation(variant);
      const quant = mef.seismicPlantResponseAnalysis.quantification;
      const expectedMean = quant.eventSequenceFamilyQuantifications
        .filter((family) => family.releaseCategoryRef !== "RC-NO-RELEASE")
        .reduce((sum, family) =>
          sum + (family.meanFrequency ?? family.pointEstimateFrequency), 0);
      const runs = mef.riskInterpretation.quantificationIterations;
      const finalRun = runs.at(-1)!;
      const penultimateRun = runs.at(-2)!;

      expect(finalRun.aggregateReleaseFamilyMeanFrequency)
        .toBeCloseTo(expectedMean, 10);
      expect(finalRun.decision).toBe("ACCEPT_STABLE");
      expect(finalRun.relativeChange).toBeLessThanOrEqual(
        mef.riskInterpretation.stoppingCriteria
          .maximumAggregateFrequencyChange,
      );
      expect(finalRun.maximumFamilyRelativeChange).toBeLessThanOrEqual(
        mef.riskInterpretation.stoppingCriteria.maximumFamilyFrequencyChange,
      );
      expect(finalRun.contributorRankingStable).toBe(true);
      expect(finalRun.newRiskSignificantContributorRefs).toEqual([]);
      expect(penultimateRun.contributorRankingStable).toBe(true);
      expect(penultimateRun.newRiskSignificantContributorRefs).toEqual([]);

      const history = screen.getByRole("table", {
        name: "Requantification history",
      });
      const finalRow = within(history)
        .getByText("Final stability confirmation", { selector: "strong" })
        .closest("tr");
      expect(finalRow).toHaveTextContent(expectedMean.toExponential(3));
      expect(finalRow).toHaveTextContent("Stable");
      expect(finalRow).toHaveTextContent("Accept");
    },
  );

  it("uses reactor-specific model refinements", () => {
    const htgr = createSeismicPraExample("htgr").riskInterpretation;
    const sfr = createSeismicPraExample("sfr").riskInterpretation;

    expect(htgr.refinementActions.some((action) =>
      /RCCS|helium/i.test(`${action.name} ${action.refinement}`))).toBe(true);
    expect(sfr.refinementActions.some((action) =>
      /sodium|air cooler/i.test(`${action.name} ${action.refinement}`)))
      .toBe(true);
    expect(htgr.refinementActions.map((action) => action.technicalArea))
      .toEqual(expect.arrayContaining([
        "EVIDENCE",
        "PLANT_DEMAND",
        "FRAGILITY",
        "PLANT_RESPONSE",
        "HUMAN_RELIABILITY",
      ]));
  });

  it("keeps section explanations behind question marks and technical details beside entry names", async () => {
    const mef = renderRiskInterpretation();
    const sectionHelp =
      "A refinement is a specific technical change made because an important contributor or uncertainty can be represented more realistically. Every change must identify its driver, affected records, evidence, requantification run, result, and decision.";
    const action = mef.riskInterpretation.refinementActions[0]!;

    expect(screen.queryByText(sectionHelp)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", {
      name: "About Model refinements",
    }));
    expect(screen.getByText(sectionHelp)).toBeInTheDocument();

    expect(screen.queryByText(action.refinement, { exact: false }))
      .not.toBeInTheDocument();
    const entryHelp = screen.getByRole("button", {
      name: `Technical details for ${action.name}`,
    });
    expect(entryHelp.closest(".sentryname")?.querySelector("strong"))
      .toHaveTextContent(action.name);
    await userEvent.click(entryHelp);
    expect(screen.getByText(action.refinement, { exact: false }))
      .toBeInTheDocument();
  });

  it("opens refinement, criteria, and run fields in flat editors", async () => {
    renderRiskInterpretation();

    await userEvent.click(screen.getByRole("button", {
      name: "Add refinement",
    }));
    const refinementDialog = screen.getByRole("dialog", {
      name: "New model refinement",
    });
    expect(within(refinementDialog).getByLabelText("Technical area"))
      .toBeInTheDocument();
    expect(within(refinementDialog).getByLabelText("Refinement"))
      .toBeInTheDocument();
    expect(within(refinementDialog).getByText("Risk-driver references"))
      .toBeInTheDocument();
    expect(refinementDialog.querySelector(".sstructured__navlist")).toBeNull();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    await userEvent.click(within(refinementDialog).getByRole("button", {
      name: "Close editor",
    }));

    await userEvent.click(screen.getByRole("button", {
      name: "Edit criteria",
    }));
    const criteriaDialog = screen.getByRole("dialog", {
      name: "Refinement stopping criteria",
    });
    expect(within(criteriaDialog).getByLabelText("Maximum aggregate change"))
      .toBeInTheDocument();
    expect(within(criteriaDialog).getByLabelText(
      "Require no new risk-significant contributors",
    )).toBeInTheDocument();
    expect(criteriaDialog.querySelector(".sstructured__navlist")).toBeNull();
    await userEvent.click(within(criteriaDialog).getByRole("button", {
      name: "Close editor",
    }));

    await userEvent.click(screen.getByRole("button", { name: "Add run" }));
    const runDialog = screen.getByRole("dialog", {
      name: "New requantification run",
    });
    expect(within(runDialog).getByLabelText("Release-family mean frequency"))
      .toBeInTheDocument();
    expect(within(runDialog).getByLabelText(
      "Contributor ranking is stable",
    )).toBeInTheDocument();
    expect(runDialog.querySelector(".sstructured__navlist")).toBeNull();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });
});
