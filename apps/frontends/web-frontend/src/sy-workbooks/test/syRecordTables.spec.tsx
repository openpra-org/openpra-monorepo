import { fireEvent, render, screen, within } from "@testing-library/react";
import type { JSX } from "react";
import type { SystemLogicModel, SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { CcfScreen, FailuresScreen } from "../syScreens";
import { DepsScreen, IntegrityScreen, UncertScreen } from "../syScreens2";
import type { SyControlledParameterOption } from "../syWorkbookContext";

jest.mock("../SyCcfAnalysis", () => ({ SyCcfAnalysis: () => null }));
jest.mock("../SyUncertaintyAnalysis", () => ({ SyUncertaintyAnalysis: () => null }));
jest.mock("../../newly-developed-methods/shared/analysisRunHistory", () => ({ AnalysisRunHistory: () => null }));

type ScreenAnalysis = Pick<SystemsAnalysis,
  | "systemDefinitions"
  | "systemLogicModels"
  | "systemBasicEvents"
  | "systemDependencies"
  | "commonCauseFailureGroups"
  | "humanFailureEventIntegrations"
  | "componentScreeningJustifications"
  | "simultaneousUnavailabilityEvents"
  | "supportSystemSuccessCriteria"
  | "environmentalDesignBasisConsiderations"
  | "depletionModels"
  | "digitalInstrumentationAndControl"
  | "systemConfirmationRecords"
  | "uncertaintyAnalyses">;

interface MockContext {
  sy: ScreenAnalysis;
  editable: boolean;
  mutateSy: jest.Mock;
  shortOf: (id: string) => string;
  controlledParameters: SyControlledParameterOption[];
  runtime: { workbookId: string; projectId: string; revision: number; saveStatus: "saved" };
}

const CCW = "SYS-CCW";
const EPS = "SYS-EPS";
const SHORT = new Map([[CCW, "CCW"], [EPS, "EPS"]]);

const MODEL: SystemLogicModel = {
  uuid: "model-1",
  code: "FT-CCW",
  name: "Cooling fault tree",
  systemReference: CCW,
  description: "Cooling unavailable",
  modelRepresentation: "FAULT_TREE",
  topGate: { gateId: "top" },
  gates: [{ id: "top", kind: "GATE", gateType: "OR", code: "TOP", name: "Top", description: "" }],
  leafNodes: [
    { id: "leaf-a", kind: "BASIC_EVENT_REFERENCE", basicEventId: "event-a" },
    { id: "leaf-b", kind: "BASIC_EVENT_REFERENCE", basicEventId: "event-b" },
  ],
  gateInputs: [
    { id: "input-a", gateId: "top", childId: "leaf-a", order: 0 },
    { id: "input-b", gateId: "top", childId: "leaf-b", order: 1 },
  ],
  nodePositions: [],
  layout: { viewport: { x: 0, y: 0, zoom: 1 }, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" },
  implementsSrs: [],
};

function makeAnalysis(): ScreenAnalysis {
  return {
    systemDefinitions: [
      {
        uuid: CCW,
        name: "Component cooling water",
        abbreviation: "CCW",
        boundaries: [],
        successCriteriaIds: [],
        missionTimeHours: 24,
        modeledComponentsAndFailures: {},
        informationBasis: "as-designed-as-intended",
        justificationForExclusionOfComponents: ["Drain valves left out"],
        implementsSrs: [],
      },
      {
        uuid: EPS,
        name: "Electric power",
        abbreviation: "EPS",
        boundaries: [],
        successCriteriaIds: [],
        missionTimeHours: 24,
        modeledComponentsAndFailures: {},
        informationBasis: "as-designed-as-intended",
        implementsSrs: [],
      },
    ],
    systemLogicModels: [MODEL],
    systemBasicEvents: [
      { uuid: "event-a", code: "PMP-A-FS", name: "Pump A fails", eventType: "BASIC", failureMode: "FAILURE_TO_START", probability: 0.02, implementsSrs: [] },
      { uuid: "event-b", code: "PMP-B-FS", name: "Pump B fails", eventType: "BASIC", failureMode: "FAILURE_TO_START", probability: 0.02, implementsSrs: [] },
    ],
    systemDependencies: [
      { uuid: "dep-1", description: "CCW needs power", dependentSystem: CCW, supportingSystem: EPS, type: "FUNCTIONAL", details: "power", implementsSrs: [] },
      { uuid: "dep-2", description: "EPS needs cooling", dependentSystem: EPS, supportingSystem: CCW, type: "FUNCTIONAL", details: "cooling", implementsSrs: [] },
    ],
    commonCauseFailureGroups: [{
      uuid: "ccf-1",
      name: "Cooling pumps",
      description: "Same design",
      scope: "INTRASYSTEM",
      affectedComponents: [],
      affectedSystems: [CCW],
      modelType: "BETA_FACTOR",
      modelSpecificParameters: { betaFactorParameters: { beta: 0.1, totalFailureProbability: 0.02 } },
      members: { basicEvents: [{ id: "event-a" }, { id: "event-b" }] },
      implementsSrs: [],
    }],
    humanFailureEventIntegrations: [{
      uuid: "hfe-1",
      hfeReference: "HFE-CCW-RESTART",
      system: CCW,
      taskDescription: "Restart the standby pump",
      hfeType: "POST_INITIATOR",
      isTestMaintenance: false,
      implementsSrs: [],
    }],
    componentScreeningJustifications: [{ uuid: "screen-1", systemReference: CCW, componentId: "V-101", screeningCriterion: "a", quantitativeJustification: "", implementsSrs: [] }],
    simultaneousUnavailabilityEvents: [],
    supportSystemSuccessCriteria: [{ uuid: "ssc-1", systemReference: EPS, successCriteria: "One of two buses", criteriaType: "REALISTIC", supportedSystems: [CCW], implementsSrs: [] }],
    environmentalDesignBasisConsiderations: [{
      uuid: "spc-1",
      systemReference: CCW,
      components: ["P-1A", "P-1B"],
      eventSequences: ["ES-7"],
      environmentalConditions: "Pump room flooding",
      dependentFailuresIncluded: true,
      implementsSrs: [],
    }],
    depletionModels: [{
      uuid: "inv-1",
      resourceType: "battery",
      description: "Station battery",
      initialQuantity: 8,
      consumptionRate: 1,
      units: "hours",
      associatedSystem: EPS,
      missionTimeSupported: false,
      implementsSrs: [],
    }],
    digitalInstrumentationAndControl: [{
      uuid: "dic-1",
      name: "Pump controller",
      systemReference: CCW,
      description: "Starts the standby pump",
      methodology: "Failure modes and effects",
      failureModes: ["Spurious trip"],
      implementsSrs: [],
    }],
    systemConfirmationRecords: [{
      uuid: "confirm-1",
      systemReference: CCW,
      method: "WALKDOWN",
      date: "2026-09-01",
      personnelRoles: ["Systems engineer"],
      findings: "Matches drawings",
      implementsSrs: [],
    }],
    uncertaintyAnalyses: [{
      uuid: "unc-1",
      system: CCW,
      propagationMethod: "MONTE_CARLO",
      modelUncertainties: [{ uncertaintyId: "mu-1", description: "Room cooling not needed", impact: "", isQuantified: false, treatmentApproach: "Sensitivity case" }],
      parameterUncertainties: [],
      implementsSrs: [],
    }],
  };
}

let mockContext: MockContext;

jest.mock("../syWorkbookContext", () => ({
  useSyWorkbook: () => mockContext,
}));

function renderScreen(screenElement: JSX.Element, editable = true): void {
  mockContext = {
    sy: makeAnalysis(),
    editable,
    mutateSy: jest.fn(),
    shortOf: (id) => SHORT.get(id) ?? id,
    controlledParameters: [],
    runtime: { workbookId: "sy-1", projectId: "project-1", revision: 3, saveStatus: "saved" },
  };
  render(screenElement);
}

describe("SY record tables", () => {
  it("opens Step 03 records from their Edit buttons", () => {
    const openDrawer = jest.fn();
    renderScreen(<FailuresScreen openDrawer={openDrawer} />);

    const exclusions = screen.getByRole("table", { name: "Exclusions and diversion paths" });
    expect(within(exclusions).getByText("Drain valves left out")).toBeInTheDocument();
    expect(within(exclusions).getAllByText("Not recorded")).toHaveLength(3);
    fireEvent.click(within(exclusions).getByRole("button", { name: "Edit exclusions for Component cooling water" }));
    expect(openDrawer).toHaveBeenCalledWith({ kind: "exclusion", id: CCW });

    const screened = screen.getByRole("table", { name: "Screened components" });
    expect(within(screened).getByRole("cell", { name: "a" })).toBeInTheDocument();
    fireEvent.click(within(screened).getByRole("button", { name: "Edit screening V-101" }));
    expect(openDrawer).toHaveBeenCalledWith({ kind: "screening", id: "screen-1" });

    expect(screen.getByText("No simultaneous unavailability recorded.")).toBeInTheDocument();

    const placed = screen.getByRole("table", { name: "Human failure events placed in the models" });
    expect(within(placed).getByText("Post-initiator")).toBeInTheDocument();
    expect(within(placed).getByText("Typed")).toBeInTheDocument();
    fireEvent.click(within(placed).getByRole("button", { name: "Edit HFE-CCW-RESTART" }));
    expect(openDrawer).toHaveBeenCalledWith({ kind: "hfe", id: "hfe-1" });
  });

  it("lists Step 04 groups by scope", () => {
    const openDrawer = jest.fn();
    renderScreen(<CcfScreen openDrawer={openDrawer} />);

    const withinSystem = screen.getByRole("table", { name: "Common cause groups within a system" });
    expect(within(withinSystem).getByText("PMP-A-FS, PMP-B-FS")).toBeInTheDocument();
    fireEvent.click(within(withinSystem).getByRole("button", { name: "Edit Cooling pumps" }));
    expect(openDrawer).toHaveBeenCalledWith({ kind: "ccf", id: "ccf-1" });
    expect(within(screen.getByRole("region", { name: "Across systems" })).getByText("No groups defined.")).toBeInTheDocument();
  });

  it("opens Step 05 records and logic loops from their Edit buttons", () => {
    const openDrawer = jest.fn();
    renderScreen(<DepsScreen openDrawer={openDrawer} />);

    const loops = screen.getByRole("table", { name: "Logic loops" });
    expect(within(loops).getByText("CCW needs EPS for power")).toBeInTheDocument();
    expect(within(loops).getByText("Resolution required")).toBeInTheDocument();
    fireEvent.click(within(loops).getByRole("button", { name: "Edit loop CCW and EPS" }));
    expect(openDrawer).toHaveBeenCalledWith({ kind: "loop", id: `${CCW}+${EPS}` });

    fireEvent.click(screen.getByRole("button", { name: "Edit criterion for Electric power" }));
    expect(openDrawer).toHaveBeenCalledWith({ kind: "ssc", id: "ssc-1" });

    const couplings = screen.getByRole("table", { name: "Spatial and environmental couplings" });
    expect(within(couplings).getByText("P-1A, P-1B")).toBeInTheDocument();
    expect(within(couplings).getByText("In the model")).toBeInTheDocument();
    fireEvent.click(within(couplings).getByRole("button", { name: "Edit coupling for CCW" }));
    expect(openDrawer).toHaveBeenCalledWith({ kind: "spc", id: "spc-1" });

    const inventories = screen.getByRole("table", { name: "Depletable inventories" });
    expect(within(inventories).getByText("8 h")).toBeInTheDocument();
    expect(within(inventories).getByText("Mission 24 h")).toBeInTheDocument();
    expect(within(inventories).getByText("Falls short")).toBeInTheDocument();
    fireEvent.click(within(inventories).getByRole("button", { name: "Edit Station battery" }));
    expect(openDrawer).toHaveBeenCalledWith({ kind: "inv", id: "inv-1" });

    const digital = screen.getByRole("table", { name: "Digital I&C and software" });
    expect(within(digital).getByText("Spurious trip")).toBeInTheDocument();
    fireEvent.click(within(digital).getByRole("button", { name: "Edit Pump controller" }));
    expect(openDrawer).toHaveBeenCalledWith({ kind: "dic", id: "dic-1" });
  });

  it("opens Step 06 confirmation records from their Edit buttons", () => {
    const openDrawer = jest.fn();
    renderScreen(<IntegrityScreen stage="pre_operational" openDrawer={openDrawer} />);

    const records = screen.getByRole("table", { name: "Plant-fidelity confirmation" });
    expect(within(records).getByText("Systems engineer")).toBeInTheDocument();
    fireEvent.click(within(records).getByRole("button", { name: "Edit Walkdown record for CCW" }));
    expect(openDrawer).toHaveBeenCalledWith({ kind: "confirm", id: "confirm-1" });

    const nomenclature = screen.getByRole("table", { name: "Nomenclature" });
    expect(within(nomenclature).getByText("PMP-A-FS")).toBeInTheDocument();
    expect(within(nomenclature).getByText("TOP")).toBeInTheDocument();
    expect(within(nomenclature).getByText("HFE-CCW-RESTART")).toBeInTheDocument();
  });

  it("opens Step 07 model assumptions from their Edit buttons", () => {
    const openDrawer = jest.fn();
    renderScreen(<UncertScreen openDrawer={openDrawer} />);

    const assumptions = screen.getByRole("table", { name: "Model assumptions" });
    expect(within(assumptions).getByText("Sensitivity case")).toBeInTheDocument();
    expect(within(assumptions).getByText("Not recorded")).toBeInTheDocument();
    fireEvent.click(within(assumptions).getByRole("button", { name: "Edit assumption 1" }));
    expect(openDrawer).toHaveBeenCalledWith({ kind: "unc", id: "mu-1" });
  });

  it("shows View buttons and no add actions to reviewers", () => {
    renderScreen(<DepsScreen openDrawer={jest.fn()} />, false);

    expect(screen.getByRole("button", { name: "View Pump controller" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add record" })).not.toBeInTheDocument();
  });
});
