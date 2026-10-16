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
  it("shows section titles without help controls", () => {
    renderAnalysisBasis();

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    for (const title of ["PRA scope and application", "Ground-motion definition"]) {
      const heading = screen.getByRole("heading", { name: title }).closest(".ssection__heading");
      expect(heading).not.toBeNull();
      expect(within(heading as HTMLElement).queryAllByRole("button")).toHaveLength(0);
      expect(screen.queryByRole("button", { name: `About ${title}` })).not.toBeInTheDocument();
    }
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

  it("shows ground-motion subsection titles without help controls", () => {
    renderAnalysisBasis();

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    for (const [title, helpName] of [
      ["Ground-motion parameters", "About ground-motion parameters"],
      ["Seismic control points", "About seismic control points"],
    ] as const) {
      const heading = screen.getByRole("heading", { name: title }).closest(".smotionbasis__heading-title");
      expect(heading).not.toBeNull();
      expect(within(heading as HTMLElement).queryAllByRole("button")).toHaveLength(0);
      expect(screen.queryByRole("button", { name: helpName })).not.toBeInTheDocument();
    }
  });

  it("shows the Interfaces title without a help control", () => {
    renderAnalysisBasis();

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    const heading = screen.getByRole("heading", { name: "Interfaces" }).closest(".ssection__heading");
    expect(heading).not.toBeNull();
    expect(within(heading as HTMLElement).queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "About Interfaces" })).not.toBeInTheDocument();
  });
});
