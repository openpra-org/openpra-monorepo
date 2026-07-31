import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";
import { BaselinePraScreen } from "../seismicPraScreens";
import { SeismicPraWorkbookProvider, type SeismicPraLinkedInputs, type SeismicPraVariant } from "../seismicPraWorkbookContext";

function linkedInputs(variant: SeismicPraVariant): SeismicPraLinkedInputs {
  const isSfr = variant === "sfr";
  return {
    variant,
    posStates: [{ id: "POS-01", name: isSfr ? "SFR full power" : "HTGR full power", mode: "POWER", durationHours: 7000, materialSources: ["Reactor fuel"] }],
    ieGroups: [{ id: "IE-01", name: isSfr ? "Loss of forced circulation" : "Loss of forced cooling", meanFrequency: 0.02, applicableStates: ["POS-01"], riskImportance: "High" }],
    esFamilies: [{ id: "ESF-01", name: "Heat-removal sequence family", endState: "Successful mitigation", memberCount: 8 }],
    scMissionTimes: [{ id: "SC-01", eventSequence: "ES-01", hours: 72, riskSignificant: true }],
    sySystems: [{ id: "SY-01", name: isSfr ? "Decay heat removal system" : "Reactor cavity cooling system", missionTimeHours: 72, applicableStates: ["POS-01"], basicEventCount: 12 }],
    hrActions: [{ id: "HFE-01", name: "Establish alternate heat removal", timing: "30 minutes", affectedSystems: ["SY-01"], humanErrorProbability: 0.04 }],
    daParameters: [{ id: "DA-01", name: "Heat-removal train failure", parameterType: "PROBABILITY", value: 0.01, basicEvent: "BE-01", system: "SY-01" }],
  };
}

function renderBaseline(variant: SeismicPraVariant = "htgr", mutate = jest.fn()): ReturnType<typeof jest.fn> {
  const mef = createSeismicPraExample(variant);
  render(
    <SeismicPraWorkbookProvider mef={mef} linkedInputs={linkedInputs(variant)} editable mutate={mutate}>
      <BaselinePraScreen />
    </SeismicPraWorkbookProvider>,
  );
  return mutate;
}

describe("Seismic PRA Step 03 baseline PRA and seismic changes", () => {
  it("shows the exact baseline configuration, imported scope, seismic changes, and open interfaces", () => {
    renderBaseline("htgr");

    expect(screen.getByRole("heading", { name: "Baseline PRA version" })).toBeInTheDocument();
    expect(screen.getAllByText("MHTGR PRA model basis").length).toBeGreaterThan(0);
    expect(screen.getByText("DOE-HTGR-86-011")).toBeInTheDocument();
    expect(screen.getByText("Reference only")).toBeInTheDocument();

    const posRow = screen.getAllByText("Plant operating states")
      .map((entry) => entry.closest("tr"))
      .find((row) => row !== null && within(row).queryByText("HTGR full power") !== null);
    expect(posRow).not.toBeNull();
    expect(within(posRow as HTMLElement).getByText("1")).toBeInTheDocument();
    expect(within(posRow as HTMLElement).getByText("HTGR full power")).toBeInTheDocument();

    expect(screen.getByText("Random initiating events")).toBeInTheDocument();
    expect(screen.getAllByText("Modified").length).toBeGreaterThan(0);
    expect(screen.getAllByText("New").length).toBeGreaterThan(0);
    expect(screen.getByText("Executable MHTGR PRA database, software version, and reproducible run package")).toBeInTheDocument();
  });

  it("keeps explanations behind help controls", async () => {
    renderBaseline();
    const explanation = "This is the exact PRA model used as the starting point. Freezing its version prevents later model changes from silently changing the Seismic PRA. A report marked reference only helps define the model, but an executable model and reproducible run package are still needed.";

    expect(screen.queryByText(explanation)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "About Baseline PRA version" }));
    expect(screen.getByText(explanation)).toBeInTheDocument();
  });

  it("shows the unavailable-input message without a decorative symbol", () => {
    const mef = createSeismicPraExample("htgr");
    render(
      <SeismicPraWorkbookProvider mef={mef} linkedInputs={null} editable mutate={jest.fn()}>
        <BaselinePraScreen />
      </SeismicPraWorkbookProvider>,
    );

    expect(screen.getByText("Baseline inputs unavailable")).toBeInTheDocument();
    expect(screen.queryByText("◇")).not.toBeInTheDocument();
  });

  it("opens one flat baseline editor with all baseline controls", async () => {
    const mutate = renderBaseline();
    await userEvent.click(screen.getByRole("button", { name: "Edit baseline version" }));

    const dialog = screen.getByRole("dialog", { name: "Baseline PRA version" });
    for (const label of [
      "Model name",
      "Model reference",
      "Source evidence",
      "Revision",
      "Freeze date",
      "Configuration status",
      "Fire, flood, external-hazard, and risk-integration model references",
      "Open inputs",
    ]) {
      expect(within(dialog).getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByRole("dialog")).toHaveLength(1);

    await userEvent.clear(within(dialog).getByLabelText("Model name"));
    await userEvent.type(within(dialog).getByLabelText("Model name"), "Controlled HTGR baseline");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save baseline" }));
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("opens each seismic-change record in one flat editor", async () => {
    renderBaseline("sfr");
    await userEvent.click(screen.getByText("Random initiating events"));

    const dialog = screen.getByRole("dialog", { name: "Random initiating events" });
    for (const label of ["Baseline area", "Technical element", "Treatment", "Status", "Owner", "Source record references", "Seismic change"]) {
      expect(within(dialog).getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("uses a frozen executable baseline for the SFR example", () => {
    renderBaseline("sfr");
    expect(screen.getByText("Generic SFR baseline internal-events PRA")).toBeInTheDocument();
    expect(
      screen.getAllByText("PRA-SFR-BASELINE-2026.1").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Frozen")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Open inputs" })).not.toBeInTheDocument();
  });

  it("hydrates examples saved before the Step 03 baseline fields existed", () => {
    const legacyExample = createSeismicPraExample("htgr");
    legacyExample.baselinePra = {
      modelName: "",
      modelReference: "",
      sourceEvidenceRef: "",
      revision: "",
      freezeDate: "",
      freezeStatus: "WORKING",
      modelBoundary: "",
      nonSeismicHazardModelRefs: [],
      recordTreatments: [],
      unresolvedInterfaces: [],
    };

    render(
      <SeismicPraWorkbookProvider
        mef={legacyExample}
        linkedInputs={linkedInputs("htgr")}
        editable
        mutate={jest.fn()}
      >
        <BaselinePraScreen />
      </SeismicPraWorkbookProvider>,
    );

    expect(screen.getByText("MHTGR PRA model basis")).toBeInTheDocument();
    expect(screen.getByText("Seismic SSC failure logic")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Executable MHTGR PRA database, software version, and reproducible run package",
      ),
    ).toBeInTheDocument();
  });
});
