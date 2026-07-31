import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";
import { SelResponseScreen } from "../seismicPraScreens";
import { SeismicPraWorkbookProvider, type SeismicPraVariant } from "../seismicPraWorkbookContext";

beforeAll(() => {
  if (globalThis.structuredClone === undefined) {
    globalThis.structuredClone = <T,>(value: T): T =>
      JSON.parse(JSON.stringify(value)) as T;
  }
});

function renderPlantDemand(variant: SeismicPraVariant = "htgr"): ReturnType<typeof createSeismicPraExample> {
  const mef = createSeismicPraExample(variant);
  render(
    <SeismicPraWorkbookProvider
      mef={mef}
      linkedInputs={null}
      editable
      mutate={jest.fn()}
    >
      <SelResponseScreen />
    </SeismicPraWorkbookProvider>,
  );
  return mef;
}

describe("Seismic PRA Step 06 plant seismic demand", () => {
  it.each(["htgr", "sfr"] as const)(
    "shows the complete plant-demand workflow and reactor-specific records for %s",
    (variant) => {
      const mef = renderPlantDemand(variant);
      const response = mef.seismicFragilityAnalysis.seismicResponseAnalysis;

      for (const heading of [
        "Response setup",
        "Reference earthquakes and input motions",
        "Structural models",
        "Soil-structure interaction",
        "Plant response demands",
        "Response convergence",
      ]) {
        expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
      }

      expect(screen.queryByRole("heading", { name: "Seismic equipment list" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Hazard curves" })).not.toBeInTheDocument();
      expect(screen.getAllByText(response.referenceEarthquakes[0]!.name).length).toBeGreaterThan(0);
      expect(screen.getAllByText(response.structuralModels[0]!.name).length).toBeGreaterThan(0);
      expect(screen.getAllByText(response.responseResults[0]!.name).length).toBeGreaterThan(0);
      expect(screen.getAllByText(response.probabilisticSimulations[0]!.name).length).toBeGreaterThan(0);

      const foundationTable = screen.getByRole("table", { name: "Foundation input motion" });
      for (const input of mef.seismicHazardAnalysis.responseSpectraEvaluation.foundationInputResponseSpectra) {
        expect(within(foundationTable).getByText(input.name)).toBeInTheDocument();
      }

      const assignmentTable = screen.getByRole("table", { name: "SEL demand assignments" });
      const applicableEquipment =
        mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment
          .equipment.filter((item) => item.disposition !== "REMOVED_FROM_MODEL");
      for (const item of applicableEquipment) {
        const row = within(assignmentTable).getByText(item.name).closest("tr");
        expect(row).not.toBeNull();
        expect(within(row as HTMLElement).queryByText("Missing")).not.toBeInTheDocument();
      }
    },
  );

  it("keeps beginner guidance behind the question-mark control", async () => {
    renderPlantDemand();
    const explanation = "This section shows how hard the earthquake shakes each plant location. The center curve is the median demand; the surrounding band shows plausible lower and upper demand after response uncertainty is included.";

    expect(screen.queryByText(explanation)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "About Plant response demands" }));
    expect(screen.getByText(explanation)).toBeInTheDocument();
  });

  it("keeps add actions with their records and removes generic basis controls", () => {
    renderPlantDemand();

    for (const [captionName, actionName] of [
      ["Reference earthquakes", "Add reference earthquake"],
      ["Structural models", "Add structural model"],
      ["Scaling checks", "Add scaling check"],
      ["Response results", "Add response result"],
    ] as const) {
      const table = screen.getByRole("table", { name: captionName });
      const captionRow = table.parentElement?.querySelector(".stable__caption-row");
      expect(captionRow).not.toBeNull();
      expect(within(captionRow as HTMLElement).getByRole("button", { name: actionName })).toBeInTheDocument();
    }

    for (const [sectionName, actionName] of [
      ["Soil-structure interaction", "Add SSI analysis"],
      ["Response convergence", "Add simulation"],
    ] as const) {
      const section = screen.getByRole("heading", { name: sectionName }).closest(".ssection");
      const sectionHeader = section?.querySelector(".ssection__head");
      expect(sectionHeader).not.toBeNull();
      expect(within(sectionHeader as HTMLElement).getByRole("button", { name: actionName })).toBeInTheDocument();
    }

    expect(screen.getByRole("button", { name: "Edit response setup" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Edit .*basis$/i })).not.toBeInTheDocument();
  });

  it("opens each record in one flat editor", async () => {
    const mef = renderPlantDemand();
    const earthquake = mef.seismicFragilityAnalysis.seismicResponseAnalysis.referenceEarthquakes[0]!;

    await userEvent.click(screen.getAllByText(earthquake.name)[0]!);
    const dialog = screen.getByRole("dialog", { name: earthquake.name });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(within(dialog).getByLabelText("Annual exceedance frequency")).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^Horizontal input suites/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Vertical input suite")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Range justification")).toBeInTheDocument();
    expect(dialog.querySelector(".sstructured__navlist")).toBeNull();

    await userEvent.click(within(dialog).getByRole("button", { name: "Close editor" }));
    const scaling = mef.seismicFragilityAnalysis.seismicResponseAnalysis.scalingEvaluations[0]!;
    await userEvent.click(screen.getByText(scaling.name));
    const scalingDialog = screen.getByRole("dialog", { name: scaling.name });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(scalingDialog.querySelector(".sstructured__navlist")).toBeNull();
  });
});
