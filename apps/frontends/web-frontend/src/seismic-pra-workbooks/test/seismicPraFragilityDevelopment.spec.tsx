import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";
import { FragilityDevelopmentScreen } from "../seismicPraScreens";
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

function renderFragilityDevelopment(
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
      <FragilityDevelopmentScreen />
    </SeismicPraWorkbookProvider>,
  );
  return mef;
}

describe("Seismic PRA Step 08 SSC screening and fragility development", () => {
  it.each(["htgr", "sfr"] as const)(
    "shows the complete screening and fragility workflow for %s",
    (variant) => {
      const mef = renderFragilityDevelopment(variant);
      const threshold = mef.seismicFragilityAnalysis.thresholdProgram;
      const results = mef.seismicFragilityAnalysis.results;
      const equipment =
        mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment
          .equipment;

      for (const heading of [
        "Screening criteria",
        "SEL fragility disposition",
        "Failure mechanisms",
        "Fragility evaluations",
        "Fragility correlation",
        "Fragility uncertainty and sensitivity",
      ]) {
        expect(screen.getByRole("heading", { name: heading }))
          .toBeInTheDocument();
      }

      expect(screen.queryByRole("heading", { name: "Response setup" }))
        .not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Plant investigations" }))
        .not.toBeInTheDocument();

      const expectedRows = [
        ["Risk-based screening targets", threshold.thresholdMethods.length],
        [
          "Inherently rugged component classes",
          threshold.inherentlyRuggedBases.length,
        ],
        ["Final screening and fragility assignments", equipment.length],
        ["Governing failure mechanisms", results.failureMechanisms.length],
        ["Capacity distributions", results.fragilityEvaluations.length],
        ["Correlation groups", results.correlationGroups.length],
        ["Fragility uncertainties", results.uncertainties.length],
        [
          "Fragility sensitivity studies",
          results.sensitivityStudies.length,
        ],
      ] as const;
      for (const [caption, rowCount] of expectedRows) {
        const table = screen.getByRole("table", { name: caption });
        expect(within(table).getAllByRole("row")).toHaveLength(rowCount + 1);
        expect(table).toHaveStyle({ tableLayout: "fixed" });
      }

      const dispositionTable = screen.getByRole("table", {
        name: "Final screening and fragility assignments",
      });
      for (const item of equipment) {
        const row = within(dispositionTable).getByText(item.name).closest("tr");
        expect(row).not.toBeNull();
        expect(within(row as HTMLElement).getByText("Ready"))
          .toBeInTheDocument();
      }
      expect(within(dispositionTable).getAllByText("Representative fragility"))
        .toHaveLength(
          results.fragilityEvaluations.filter((evaluation) =>
            !evaluation.plantSpecific).length,
        );
    },
  );

  it("keeps section help behind a question mark and entry detail beside its name", async () => {
    const mef = renderFragilityDevelopment();
    const sectionHelp = "A fragility curve converts earthquake motion into a probability of failure. The median capacity locates the curve, beta-R represents randomness, beta-U represents uncertainty in the median, and HCLPF shows the conservative lower-tail capacity.";
    const mechanism = mef.seismicFragilityAnalysis.results
      .failureMechanisms[0]!;
    const mechanismEquipment = mef.seismicPlantResponseAnalysis
      .seismicEquipmentListDevelopment.equipment.find((item) =>
        item.uuid === mechanism.sscRef)?.name ?? mechanism.sscRef;

    expect(screen.queryByText(sectionHelp)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", {
      name: "About Fragility evaluations",
    }));
    expect(screen.getByText(sectionHelp)).toBeInTheDocument();

    expect(screen.queryByText(mechanism.description, { exact: false }))
      .not.toBeInTheDocument();
    const detailButton = screen.getByRole("button", {
      name: `Technical basis for ${mechanism.name}`,
    });
    expect(detailButton.closest(".sentryname")?.querySelector("strong"))
      .toHaveTextContent(mechanismEquipment);
    await userEvent.click(detailButton);
    expect(screen.getByText(mechanism.description, { exact: false }))
      .toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the fragility distribution band and complete capacity parameters", () => {
    const mef = renderFragilityDevelopment();
    const evaluation =
      mef.seismicFragilityAnalysis.results.fragilityEvaluations[0]!;
    const table =
      screen.getByRole("table", { name: "Capacity distributions" });
    const row = within(table).getByText(evaluation.name).closest("tr");

    expect(screen.getByLabelText(
      `${evaluation.name} conditional failure distribution`,
    )).toBeInTheDocument();
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText(
      `Median ${evaluation.medianCapacity} ${evaluation.capacityUnits}`,
    )).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText(
      new RegExp(`βR ${evaluation.betaRandomness}.*βU ${evaluation.betaUncertainty}`),
    )).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText(
      new RegExp(`HCLPF ${evaluation.highConfidenceLowProbabilityOfFailureCapacity}`),
    )).toBeInTheDocument();
  });

  it("keeps every add action with its technical table", () => {
    renderFragilityDevelopment();

    for (const [caption, action] of [
      ["Risk-based screening targets", "Add threshold method"],
      ["Inherently rugged component classes", "Add ruggedness class"],
      ["Governing failure mechanisms", "Add failure mechanism"],
      ["Capacity distributions", "Add fragility"],
      ["Correlation groups", "Add correlation group"],
      ["Fragility uncertainties", "Add uncertainty"],
      ["Fragility sensitivity studies", "Add sensitivity study"],
    ] as const) {
      const table = screen.getByRole("table", { name: caption });
      const captionRow = table.parentElement?.querySelector(
        ".stable__caption-row",
      );
      expect(captionRow).not.toBeNull();
      expect(within(captionRow as HTMLElement).getByRole("button", {
        name: action,
      })).toBeInTheDocument();
    }
  });

  it("opens screening and fragility records in one flat editor", async () => {
    renderFragilityDevelopment();

    await userEvent.click(screen.getByRole("button", {
      name: "Edit screened SSC scope",
    }));
    const scopeDialog =
      screen.getByRole("dialog", { name: "Screened SSC scope" });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(within(scopeDialog).getByLabelText(
      /^Screened SSC references/,
    )).toBeInTheDocument();
    expect(scopeDialog.querySelector(".sstructured__navlist")).toBeNull();
    await userEvent.click(within(scopeDialog).getByRole("button", {
      name: "Close editor",
    }));

    await userEvent.click(screen.getByRole("button", {
      name: "Add fragility",
    }));
    const fragilityDialog = screen.getByRole("dialog", {
      name: "New fragility evaluation",
    });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(within(fragilityDialog).getByLabelText("Median capacity"))
      .toBeInTheDocument();
    expect(within(fragilityDialog).getByLabelText(/^Response results/))
      .toBeInTheDocument();
    expect(within(fragilityDialog).getByLabelText(/^Capacity evidence/))
      .toBeInTheDocument();
    expect(within(fragilityDialog).getByLabelText(/^Correlation groups/))
      .toBeInTheDocument();
    expect(within(fragilityDialog).getByLabelText(/^Sensitivity studies/))
      .toBeInTheDocument();
    expect(fragilityDialog.querySelector(".sstructured__navlist")).toBeNull();
  });
});
