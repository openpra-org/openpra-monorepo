import { fireEvent, render, screen } from "@testing-library/react";
import { createExternalFloodPraSeed } from "../../../../../backends/web-backend/src/example-workbooks/seeds/external-flood-pra-seed-factory";
import { ExternalFloodPraStepScreen } from "../externalFloodPraStepScreen";
import { ExternalFloodPraWorkbookProvider } from "../externalFloodPraWorkbookContext";

function show(stepId: string): void {
  render(<ExternalFloodPraWorkbookProvider mef={createExternalFloodPraSeed("HTGR")} editable mutate={() => undefined}><ExternalFloodPraStepScreen stepId={stepId} /></ExternalFloodPraWorkbookProvider>);
}

describe("External Flood PRA presentation", () => {
  it("uses the analysis-basis layout and technical-element interface cards", () => {
    show("analysis-basis");
    expect(screen.getByText("PRA analysis and scope")).toBeInTheDocument();
    expect(screen.getByText("Interfaces")).toBeInTheDocument();
    expect(screen.getByText("Hazards Screening Analysis")).toBeInTheDocument();
    expect(screen.getByText("Risk Integration")).toBeInTheDocument();
  });

  it("shows comprehensive source-specific records inside an interface tile", () => {
    show("analysis-basis");
    fireEvent.click(screen.getByRole("button", { name: /S → XF Seismic PRA/ }));
    expect(screen.getByText("Earthquake-induced Lake Sterling dam failure")).toBeInTheDocument();
    expect(screen.getByText("Seismic deformation of south levee")).toBeInTheDocument();
    expect(screen.getByText("Seismic damage to permanent flood barriers")).toBeInTheDocument();
    expect(screen.getByText("Joint treatment")).toBeInTheDocument();
  });

  it("renders complete human-reliability sections", () => {
    show("human-reliability");
    for (const title of ["External-flood human actions", "Human failure events", "Flood performance contexts", "Flood HEP estimates", "Action confirmations", "Recovery assessments", "HRA dependencies"]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it("renders hazard, fragility, scenario, and integration records", () => {
    show("hazard-integration");
    expect(screen.getByText("Integrated flood hazard curves")).toBeInTheDocument();
    show("fragility");
    expect(screen.getByText("Conditional flood fragility curves")).toBeInTheDocument();
    show("scenarios");
    expect(screen.getByText("Scenario timelines")).toBeInTheDocument();
    show("risk-integration");
    expect(screen.getByText("End-to-end traceability")).toBeInTheDocument();
  });
});
