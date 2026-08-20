import "@testing-library/jest-dom";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HSA_STEP_DEFINITIONS } from "interfaces-mef-types/hazards-screening/hazards-screening-analysis";
import { createHazardsScreeningAnalysisExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/hazards-screening-analysis-seed-factory";
import { HsaStepScreen } from "../hsaStepScreen";
import { HsaWorkbookProvider } from "../hsaWorkbookContext";

describe("HSA workbook presentation", () => {
  afterEach(cleanup);
  it.each(HSA_STEP_DEFINITIONS.filter((step) => !["draft", "review", "approval"].includes(step.id)).map((step) => [step.id]))("renders populated interactive sections for %s", (stepId) => {
    const { container } = render(<HsaWorkbookProvider mef={createHazardsScreeningAnalysisExample("htgr")} editable mutate={jest.fn()}><HsaStepScreen stepId={stepId} /></HsaWorkbookProvider>);
    expect(container.querySelectorAll(".flsection").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("button").length).toBeGreaterThan(0);
  });
  it("presents populated cross-technical-element interfaces in Step 01", async () => {
    const user = userEvent.setup();
    render(<HsaWorkbookProvider mef={createHazardsScreeningAnalysisExample("htgr")} editable mutate={jest.fn()}><HsaStepScreen stepId="analysis-basis" /></HsaWorkbookProvider>);
    expect(screen.getByRole("heading", { name: "Hazard-screening definition" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Site and surroundings reference features" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Candidate-hazard basis" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add site feature" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add candidate hazard" })).toBeInTheDocument();
    expect(screen.getAllByRole("table")).toHaveLength(2);
    expect(screen.queryByText("Common hazard-analysis inputs")).not.toBeInTheDocument();
    expect(screen.getByText("Interfaces")).toBeInTheDocument();
    expect(screen.getByText(/Plant Operating States Analysis/)).toBeInTheDocument();
    expect(screen.getByText(/Risk Integration/)).toBeInTheDocument();
    expect(screen.getByText(/Internal Fire PRA/)).toBeInTheDocument();
    expect(screen.getByText(/Internal Flood PRA/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /POS → HS/ }));
    expect(screen.getByText("Full power")).toBeInTheDocument();
    expect(screen.getByText("Low power")).toBeInTheDocument();
    expect(screen.getByText(/Hazards Screening Analysis receives operating-state exposure/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /HS → RI/ }));
    expect(screen.getByText(/Natural tectonic earthquake ground motion final risk-integration disposition/)).toBeInTheDocument();
  });
});
