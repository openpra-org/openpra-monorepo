import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";
import { SeismicPraWorkbench } from "../seismicPraWorkbench";
import { SeismicPraWorkbookProvider, type SeismicPraLinkedInputs } from "../seismicPraWorkbookContext";

const linkedInputs: SeismicPraLinkedInputs = {
  variant: "htgr",
  posStates: [
    { id: "POS-1", name: "Full-power operation", mode: "Power operation", durationHours: 7000, materialSources: ["Reactor fuel"] },
    { id: "POS-2", name: "Refueling shutdown", mode: "Shutdown", durationHours: 720, materialSources: ["Reactor fuel", "Spent-fuel storage"] },
  ],
  ieGroups: [],
  esFamilies: [],
  scMissionTimes: [],
  sySystems: [],
  hrActions: [],
  daParameters: [],
};

function renderAnalysisBasis(inputs: SeismicPraLinkedInputs | null = linkedInputs): void {
  const mef = createSeismicPraExample("htgr");
  render(
    <MemoryRouter>
      <SeismicPraWorkbookProvider mef={mef} linkedInputs={inputs} editable mutate={jest.fn()}>
        <SeismicPraWorkbench
          persona="preparer"
          setPersona={jest.fn()}
          showPersonaPicker={false}
          headerMeta={{ projectName: "Reference project", workbookName: "Seismic PRA", workbookVersion: "1.0" }}
        />
      </SeismicPraWorkbookProvider>
    </MemoryRouter>,
  );
}

describe("Seismic PRA Step 01 analysis basis", () => {
  it("keeps section descriptions behind information controls", async () => {
    renderAnalysisBasis();

    const description = "Use this section to record why the analysis is being performed, which plant, operating states, and radioactive-material sources are included, and which risk results are required. Capability categories are checked separately for each supporting requirement in Conformance.";
    expect(screen.queryByText(description)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "About PRA scope and application" }));

    expect(screen.getByText(description)).toBeInTheDocument();
  });

  it("shows the complete MVP analysis scope in one flat editor", async () => {
    renderAnalysisBasis();

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
    ]) {
      expect(within(dialog).getByText(label)).toBeInTheDocument();
    }
    expect(within(dialog).queryByText("Capability category")).not.toBeInTheDocument();
  });

  it("confirms imported operating states and radioactive-material sources", () => {
    renderAnalysisBasis();

    expect(screen.getByText("Full-power operation · Refueling shutdown")).toBeInTheDocument();
    expect(screen.getByText("Reactor fuel · Spent-fuel storage")).toBeInTheDocument();
    expect(screen.getByText(/release-category frequency per plant-year/i)).toBeInTheDocument();
    expect(screen.getByText(/5th–95th percentile/)).toBeInTheDocument();
    expect(screen.queryByText("Pre-operational · CC-II")).not.toBeInTheDocument();
  });

  it("shows shared parameters and control points as technical tables", () => {
    renderAnalysisBasis();

    const tables = screen.getAllByRole("table");
    expect(tables[0]).toHaveTextContent("Geometric-mean horizontal SA at 1 Hz");
    expect(tables[1]).toHaveTextContent("Safety-related foundation");
    const parameterHeading = screen.getByText("Ground-motion parameters").closest(".smotionbasis__heading");
    const controlPointHeading = screen.getByText("Seismic control points").closest(".smotionbasis__heading");
    expect(parameterHeading).not.toBeNull();
    expect(controlPointHeading).not.toBeNull();
    expect(within(parameterHeading as HTMLElement).getByRole("button", { name: "Add ground-motion parameter" })).toBeInTheDocument();
    expect(within(controlPointHeading as HTMLElement).getByRole("button", { name: "Add seismic control point" })).toBeInTheDocument();
    expect(screen.getByText("Interfaces")).toBeInTheDocument();
  });

  it("explains the purpose and source of ground-motion definitions", async () => {
    renderAnalysisBasis();

    const parameterHelp = "These rows define how earthquake shaking will be measured in later calculations. Each row chooses a direction, frequency, damping value, unit, and calculation range. The analysts select these settings before running the hazard calculations; later steps calculate the actual hazard values.";
    const controlPointHelp = "These rows name the exact physical locations where earthquake motion will be defined or compared. The analyst selects them from site coordinates and existing foundation and structural drawings. Later steps calculate how the motion changes between these locations.";
    expect(screen.queryByText(parameterHelp)).not.toBeInTheDocument();
    expect(screen.queryByText(controlPointHelp)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "About ground-motion parameters" }));
    expect(screen.getByText(parameterHelp)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "About seismic control points" }));
    expect(screen.getByText(controlPointHelp)).toBeInTheDocument();
  });

  it("explains interfaces in beginner-friendly language", async () => {
    renderAnalysisBasis();

    const interfaceHelp = "Use this section to see what technical data Seismic PRA receives from earlier technical elements and what results it sends to later ones. Select a tab to inspect the actual records being transferred.";
    expect(screen.queryByText(interfaceHelp)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "About Interfaces" }));
    expect(screen.getByText(interfaceHelp)).toBeInTheDocument();
  });
});
