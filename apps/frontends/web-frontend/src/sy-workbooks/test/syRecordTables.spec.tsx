import { fireEvent, render, screen, within } from "@testing-library/react";
import type { JSX } from "react";
import type { SystemLogicModel, SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { IntegrityScreen, UncertScreen } from "../syScreens2";
import type { SyControlledParameterOption } from "../syWorkbookContext";

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
});
