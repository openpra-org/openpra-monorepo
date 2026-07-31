import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";
import { PlantConfigurationScreen } from "../seismicPraScreens";
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

function renderPlantConfiguration(
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
      <PlantConfigurationScreen />
    </SeismicPraWorkbookProvider>,
  );
  return mef;
}

describe("Seismic PRA Step 07 plant configuration and final SEL", () => {
  it.each(["htgr", "sfr"] as const)(
    "shows complete, reactor-specific configuration coverage for %s",
    (variant) => {
      const mef = renderPlantConfiguration(variant);
      const investigations =
        mef.seismicFragilityAnalysis.plantInvestigations;
      const equipment =
        mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment
          .equipment.filter((item) =>
            item.disposition !== "REMOVED_FROM_MODEL");

      for (const heading of [
        "Plant investigations",
        "Final SEL confirmations",
        "Seismic interactions",
        "Seismic fire and flood sources",
        "Operator access and indications",
        "Open findings and data gaps",
      ]) {
        expect(screen.getByRole("heading", { name: heading }))
          .toBeInTheDocument();
      }

      expect(screen.queryByRole("heading", { name: "Fragility screening" }))
        .not.toBeInTheDocument();
      expect(screen.queryByText("Ruggedness bases")).not.toBeInTheDocument();
      expect(screen.queryByText("Threshold methods")).not.toBeInTheDocument();

      const investigationTable =
        screen.getByRole("table", { name: "Investigation program" });
      expect(investigations).toHaveLength(6);
      for (const investigation of investigations) {
        expect(within(investigationTable).getByText(investigation.name))
          .toBeInTheDocument();
      }

      const finalSelTable = screen.getByRole("table", {
        name: "SEL configuration and demand reconciliation",
      });
      for (const item of equipment) {
        const row = within(finalSelTable).getByText(item.name).closest("tr");
        expect(row).not.toBeNull();
        expect(within(row as HTMLElement).getByText("Ready"))
          .toBeInTheDocument();
        expect(within(row as HTMLElement).queryByText("Missing"))
          .not.toBeInTheDocument();
      }
    },
  );

  it.each(["htgr", "sfr"] as const)(
    "shows each finding once in its technical subsection for %s",
    (variant) => {
      const mef = renderPlantConfiguration(variant);
      const findings = mef.seismicFragilityAnalysis.plantInvestigations
        .flatMap((investigation) => investigation.findings);
      const interactionTypes = new Set([
        "INTERACTION",
        "FALLING_HAZARD",
        "CLEARANCE",
        "DIFFERENTIAL_DISPLACEMENT",
      ]);
      const sourceTypes = new Set(["FLOOD_SOURCE", "FIRE_SOURCE"]);
      const interactionTable =
        screen.getByRole("table", { name: "Interaction findings" });
      const sourceTable = screen.getByRole("table", {
        name: "Fire and flood source findings",
      });
      const vulnerabilityTable =
        screen.getByRole("table", { name: "Vulnerability findings" });

      for (const finding of findings) {
        const expectedTable = interactionTypes.has(finding.findingType)
          ? interactionTable
          : sourceTypes.has(finding.findingType)
            ? sourceTable
            : vulnerabilityTable;
        const otherTables = [
          interactionTable,
          sourceTable,
          vulnerabilityTable,
        ].filter((table) => table !== expectedTable);
        expect(within(expectedTable).getByText(finding.name))
          .toBeInTheDocument();
        for (const table of otherTables) {
          expect(within(table).queryByText(finding.name))
            .not.toBeInTheDocument();
        }
      }
    },
  );

  it("keeps beginner guidance behind question-mark controls", async () => {
    renderPlantConfiguration();
    const explanation = "This is the final checklist for each seismic equipment list item. An item is ready when its configuration and load path were reviewed, Step 06 assigned its earthquake demand, and its credible failure modes are defined.";

    expect(screen.queryByText(explanation)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", {
      name: "About Final SEL confirmations",
    }));
    expect(screen.getByText(explanation)).toBeInTheDocument();
  });

  it("shows operator routes, controls, communications, lighting, and indications", () => {
    renderPlantConfiguration();
    const operatorTable =
      screen.getByRole("table", { name: "Operator configuration checks" });
    const operatorRow = within(operatorTable).getByText(
      "Spatial interaction and operator-access review",
    ).closest("tr");

    for (const feature of [
      "Routes",
      "Action stations",
      "Controls",
      "Communications",
      "Lighting",
      "Indications",
    ]) {
      expect(within(operatorRow as HTMLElement).getByText(
        new RegExp(`\\b${feature}\\b`),
      )).toBeInTheDocument();
    }
  });

  it("keeps add actions with their subsections and opens one flat editor", async () => {
    renderPlantConfiguration();

    for (const [caption, action] of [
      ["Investigation program", "Add investigation"],
      ["Interaction findings", "Add interaction"],
      ["Fire and flood source findings", "Add fire or flood source"],
      ["Vulnerability findings", "Add finding"],
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

    await userEvent.click(screen.getByRole("button", { name: "Add finding" }));
    const dialog = screen.getByRole("dialog", {
      name: "New vulnerability finding",
    });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(within(dialog).getByLabelText("Investigation"))
      .toBeInTheDocument();
    expect(within(dialog).getByLabelText("Finding name"))
      .toBeInTheDocument();
    expect(within(dialog).getByLabelText("Affected function or operator action"))
      .toBeInTheDocument();
    expect(dialog.querySelector(".sstructured__navlist")).toBeNull();
  });
});
