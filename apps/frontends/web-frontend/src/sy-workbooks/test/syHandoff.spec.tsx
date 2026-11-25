import { fireEvent, render, screen, within } from "@testing-library/react";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { SyHandoffScreen } from "../SyHandoff";
import type { SyLinkedInputs } from "../syWorkbookContext";

type HandoffAnalysis = Pick<SystemsAnalysis,
  | "systemDefinitions"
  | "systemLogicModels"
  | "systemBasicEvents"
  | "commonCauseFailureGroups"
  | "environmentalDesignBasisConsiderations"
  | "overCapacityConsiderations"
  | "modelUncertainty"
  | "preOperationalAssumptions">;

interface MockContext {
  sy: HandoffAnalysis;
  shortOf: (id: string) => string;
  links: SyLinkedInputs;
  controlledParameters: [];
  controlledLegacyParameters: [];
  controlledHumanFailures: [];
  controlledCcfVectors: [];
  controlledCcfFactors: [];
}

const LINKS: SyLinkedInputs = {
  scName: "",
  posName: "",
  esName: "",
  scSystems: [],
  scMissionTimeOptions: [],
  scMissionTimeTable: new Map(),
  posStates: [],
  esSafetyFunctions: [],
  esInitiatingEvents: [],
};

const ANALYSIS: HandoffAnalysis = {
  systemDefinitions: [{ uuid: "SYS-CCW", name: "Component cooling water", abbreviation: "CCW", boundaries: [], successCriteriaIds: [], modeledComponentsAndFailures: {}, informationBasis: "as-designed-as-intended", implementsSrs: [] }],
  systemLogicModels: [{
    uuid: "model-ccw",
    code: "FT-CCW",
    name: "Cooling water fault tree",
    systemReference: "SYS-CCW",
    description: "",
    modelRepresentation: "FAULT_TREE",
    topGate: { gateId: "top" },
    gates: [{ id: "top", kind: "GATE", gateType: "OR", code: "CCW-TOP", name: "Cooling water lost", description: "" }],
    leafNodes: [{ id: "leaf-pump", kind: "BASIC_EVENT_REFERENCE", basicEventId: "PMP-A" }],
    gateInputs: [{ id: "input-pump", gateId: "top", childId: "leaf-pump", order: 0 }],
    nodePositions: [],
    layout: { viewport: { x: 0, y: 0, zoom: 1 }, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" },
    implementsSrs: [],
  }],
  systemBasicEvents: [{ uuid: "PMP-A", code: "PMP-A", name: "Pump A fails", eventType: "BASIC", failureMode: "HUMAN_ERROR", probability: 0.006, implementsSrs: [] }],
  commonCauseFailureGroups: [],
  environmentalDesignBasisConsiderations: [],
  overCapacityConsiderations: [],
  modelUncertainty: { uuid: "mu", name: "Model uncertainty", uncertaintySources: [], relatedAssumptions: [], reasonableAlternatives: [] },
  preOperationalAssumptions: [],
};

const mockContext: MockContext = {
  sy: ANALYSIS,
  shortOf: (id) => (id === "SYS-CCW" ? "CCW" : id),
  links: LINKS,
  controlledParameters: [],
  controlledLegacyParameters: [],
  controlledHumanFailures: [],
  controlledCcfVectors: [],
  controlledCcfFactors: [],
};

jest.mock("../syWorkbookContext", () => ({
  useSyWorkbook: () => mockContext,
}));

describe("SY Step 08 handoff", () => {
  it("publishes systems, fault trees, basic events, common cause groups, qualification and assumptions", () => {
    render(<SyHandoffScreen />);
    const tabs = within(screen.getByRole("tablist", { name: "Handoff sections" })).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Systems", "Fault trees", "Basic events", "Common cause groups", "Qualification", "Assumptions"]);

    fireEvent.click(screen.getByRole("tab", { name: "Fault trees" }));
    const row = within(screen.getByRole("table", { name: "SY.Fault trees" })).getAllByRole("row")[1];
    expect(Array.from(row?.querySelectorAll("td") ?? []).map((cell) => cell.textContent)).toEqual(["FT-CCWCooling water fault tree", "CCW", "CCW-TOP", "1", "1", "None"]);
  });
});
