import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";
import { SiteHazardModelScreen } from "../seismicPraScreens";
import { SeismicPraWorkbookProvider, type SeismicPraVariant } from "../seismicPraWorkbookContext";

function renderSiteHazard(variant: SeismicPraVariant = "htgr"): ReturnType<typeof createSeismicPraExample> {
  const mef = createSeismicPraExample(variant);
  render(
    <SeismicPraWorkbookProvider
      mef={mef}
      linkedInputs={null}
      editable
      mutate={jest.fn()}
    >
      <SiteHazardModelScreen />
    </SeismicPraWorkbookProvider>,
  );
  return mef;
}

describe("Seismic PRA Step 05 site seismic-hazard model", () => {
  it.each(["htgr", "sfr"] as const)(
    "shows the complete reactor-specific hazard workflow for %s",
    (variant) => {
      const mef = renderSiteHazard(variant);
      const sha = mef.seismicHazardAnalysis;

      for (const heading of [
        "PSHA basis",
        "Seismic source model",
        "Ground-motion models",
        "Local site response",
        "Hazard results",
        "Secondary seismic hazards",
      ]) {
        expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
      }

      for (const source of sha.sourceCharacterization.earthquakeSources) {
        expect(screen.getAllByText(source.name).length).toBeGreaterThan(0);
      }
      for (const model of sha.groundMotionCharacterization.predictionModels) {
        expect(screen.getAllByText(model.name).length).toBeGreaterThan(0);
      }
      for (const profile of sha.siteResponseAnalysis.profiles) {
        expect(screen.getAllByText(profile.name).length).toBeGreaterThan(0);
      }
      for (const hazard of sha.secondaryHazardEvaluation.hazards) {
        expect(screen.getAllByText(hazard.name).length).toBeGreaterThan(0);
      }

      expect(screen.getByText(
        `${sha.earthScienceInputs.earthquakeCatalog.events.length} event records · ${sha.earthScienceInputs.earthquakeCatalog.magnitudeScales.join(", ")}`,
      )).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Closest distance" })).toBeInTheDocument();
      expect(screen.getAllByRole("columnheader", { name: "Weight" })).toHaveLength(2);
      expect(screen.getByRole("columnheader", { name: "Median amplification" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "1E-4 motion" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Retained output" })).toBeInTheDocument();
    },
  );

  it("keeps the beginner explanation behind the question-mark control", async () => {
    renderSiteHazard();
    const explanation = "This section identifies the faults and distributed seismic zones that can produce damaging motion at the site. Each source needs geometry, distance, magnitude recurrence, and uncertainty treatment.";

    expect(screen.queryByText(explanation)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "About Seismic source model" }));
    expect(screen.getByText(explanation)).toBeInTheDocument();
  });

  it("removes the PSHA-basis editor and keeps the flat catalog editor", async () => {
    renderSiteHazard();

    expect(screen.queryByRole("button", { name: /^Edit PSHA basis$/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit earthquake catalog" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    const catalogDialog = screen.getByRole("dialog", { name: "Earthquake catalog" });
    expect(catalogDialog).toBeInTheDocument();
    expect(within(catalogDialog).getByText("Catalog coverage")).toBeInTheDocument();
    expect(within(catalogDialog).getByText("Catalog processing")).toBeInTheDocument();
    expect(within(catalogDialog).getByText("Imported event records")).toBeInTheDocument();
  });

  it("keeps top-level add actions in section headers and site-response adds in their existing captions", () => {
    renderSiteHazard();
    for (const [sectionName, actionName] of [
      ["Seismic source model", "Add seismic source"],
      ["Ground-motion models", "Add ground-motion model"],
      ["Secondary seismic hazards", "Add secondary hazard"],
    ] as const) {
      const section = screen.getByRole("heading", { name: sectionName }).closest(".ssection");
      const sectionHeader = section?.querySelector(".ssection__head");
      expect(sectionHeader).not.toBeNull();
      expect(within(sectionHeader as HTMLElement).getByRole("button", { name: actionName })).toBeInTheDocument();
    }
    for (const [captionName, actionName] of [
      ["Site profiles", "Add site profile"],
      ["Amplification calculations", "Add response calculation"],
    ] as const) {
      const caption = screen.getByText(captionName, { selector: ".stable__caption" });
      const captionRow = caption.closest(".stable__caption-row");
      expect(captionRow).not.toBeNull();
      expect(within(captionRow as HTMLElement).getByRole("button", { name: actionName })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: /^Edit .*basis$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Source-model method" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Model selection" })).not.toBeInTheDocument();
  });

  it("keeps source geometry, recurrence, and ground-motion details in single drawers", async () => {
    const mef = renderSiteHazard();
    const source = mef.seismicHazardAnalysis.sourceCharacterization.earthquakeSources[0]!;
    const groundMotionModel = mef.seismicHazardAnalysis.groundMotionCharacterization.predictionModels[0]!;

    await userEvent.click(screen.getByText(source.name));
    const sourceDialog = screen.getByRole("dialog", { name: source.name });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(within(sourceDialog).getByText("Geometry")).toBeInTheDocument();
    expect(within(sourceDialog).getByText("Magnitude and recurrence")).toBeInTheDocument();
    expect(sourceDialog.querySelector(".sstructured__navlist")).toBeNull();

    await userEvent.click(within(sourceDialog).getByRole("button", { name: "Add magnitude-frequency model" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(sourceDialog.querySelector(".sstructured__navlist")).toBeNull();
    await userEvent.click(within(sourceDialog).getByRole("button", { name: "Close editor" }));

    await userEvent.click(screen.getByText(groundMotionModel.name));
    const modelDialog = screen.getByRole("dialog", { name: groundMotionModel.name });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(within(modelDialog).getByText("Applicability range")).toBeInTheDocument();
    expect(within(modelDialog).getByText("Motion definition and variability")).toBeInTheDocument();
    expect(within(modelDialog).getByText("Selection evidence")).toBeInTheDocument();
    expect(modelDialog.querySelector(".sstructured__navlist")).toBeNull();
  });
});
