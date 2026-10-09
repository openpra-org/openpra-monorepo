import { fireEvent, render, screen, within } from "@testing-library/react";
import type { SystemLogicModel, SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { FailureModesScreen } from "../SyFailureModes";
import { DrawerContent } from "../syScreens2";
import type { SyControlledCoincidentMaintenanceOption, SyControlledHumanFailureOption } from "../syWorkbookContext";

const CCW = "SYS-CCW";
const GV = "SYS-GV";

type StepAnalysis = Pick<SystemsAnalysis,
  | "systemDefinitions"
  | "systemLogicModels"
  | "systemBasicEvents"
  | "humanFailureEventIntegrations"
  | "componentScreeningJustifications"
  | "isolationTripConditions"
  | "simultaneousUnavailabilityEvents">;

interface MockContext {
  sy: StepAnalysis;
  editable: boolean;
  mutateSy: jest.Mock;
  shortOf: (id: string) => string;
  controlledParameters: [];
  controlledFailureModes: [];
  controlledHumanFailures: SyControlledHumanFailureOption[];
  controlledCoincidentMaintenance: SyControlledCoincidentMaintenanceOption[];
  runtime: { workbookId: string; projectId: string; revision: number; saveStatus: "saved" };
}

const TREE: SystemLogicModel = {
  uuid: "model-ccw",
  code: "FT-CCW",
  name: "Cooling fault tree",
  systemReference: CCW,
  description: "Cooling unavailable",
  modelRepresentation: "FAULT_TREE",
  topGate: { gateId: "top" },
  gates: [{ id: "top", kind: "GATE", gateType: "OR", code: "TOP", name: "Top", description: "" }],
  leafNodes: [
    { id: "leaf-pump", kind: "BASIC_EVENT_REFERENCE", basicEventId: "PMP-A-FR" },
    { id: "leaf-tm", kind: "BASIC_EVENT_REFERENCE", basicEventId: "CCW-TM-A" },
    { id: "leaf-joint", kind: "BASIC_EVENT_REFERENCE", basicEventId: "CCW-AB-TM" },
    { id: "leaf-hfe", kind: "BASIC_EVENT_REFERENCE", basicEventId: "CCW-HFE" },
    { id: "leaf-hfe-2", kind: "BASIC_EVENT_REFERENCE", basicEventId: "CCW-HFE-2" },
  ],
  gateInputs: [
    { id: "input-pump", gateId: "top", childId: "leaf-pump", order: 0 },
    { id: "input-tm", gateId: "top", childId: "leaf-tm", order: 1 },
    { id: "input-joint", gateId: "top", childId: "leaf-joint", order: 2 },
    { id: "input-hfe", gateId: "top", childId: "leaf-hfe", order: 3 },
    { id: "input-hfe-2", gateId: "top", childId: "leaf-hfe-2", order: 4 },
  ],
  nodePositions: [],
  layout: { viewport: { x: 0, y: 0, zoom: 1 }, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" },
  implementsSrs: [],
};

const SYSTEM_LEVEL: SystemLogicModel = {
  ...TREE,
  uuid: "model-gv",
  code: "SL-GV",
  name: "Guard vessel system-level model",
  systemReference: GV,
  modelRepresentation: "System-level",
  nonDetailedModelJustification: "Passive shell.",
  topGate: null,
  gates: [],
  leafNodes: [],
  gateInputs: [],
};

function makeAnalysis(): StepAnalysis {
  return {
    systemDefinitions: [
      {
        uuid: CCW,
        name: "Component cooling water",
        abbreviation: "CCW",
        boundaries: [],
        successCriteriaIds: [],
        missionTime: { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 24 } } },
        modeledComponentsAndFailures: {},
        informationBasis: "as-designed-as-intended",
        justificationForExclusionOfComponents: ["Overcooling, which helps the function."],
        flowDiversionConsiderations: ["Relief valve path, screened out under criterion a."],
        functionLossConditions: ["Hot summer water above the design limit.", "Pump room heat after a ventilation loss."],
        implementsSrs: [],
      },
      {
        uuid: GV,
        name: "Guard vessel",
        abbreviation: "GV",
        boundaries: [],
        successCriteriaIds: [],
        modeledComponentsAndFailures: {},
        informationBasis: "as-designed-as-intended",
        implementsSrs: [],
      },
    ],
    systemLogicModels: [TREE, SYSTEM_LEVEL],
    systemBasicEvents: [
      { uuid: "PMP-A-FR", code: "PMP-A-FR", name: "Pump A fails to run", eventType: "BASIC", failureMode: "FAILURE_TO_RUN", probability: 0.006, implementsSrs: [] },
      { uuid: "CCW-TM-A", code: "CCW-TM-A", name: "Train A in maintenance", eventType: "BASIC", failureMode: "TEST_MAINTENANCE", probability: 0.004, implementsSrs: [] },
      { uuid: "CCW-AB-TM", code: "CCW-AB-TM", name: "Both pumps out for a joint overhaul", eventType: "BASIC", failureMode: "TEST_MAINTENANCE", probability: 0.002, implementsSrs: [] },
      { uuid: "CCW-HFE", code: "CCW-HFE", name: "Operator fails to restart the pump", eventType: "BASIC", failureMode: "HUMAN_ERROR", probability: 0.003, attributes: [{ name: "hfeReference", value: "HR-POST-9" }], implementsSrs: [] },
      { uuid: "CCW-HFE-2", code: "CCW-HFE-2", name: "Pump A left isolated after testing", eventType: "BASIC", failureMode: "HUMAN_ERROR", probability: 0.001, implementsSrs: [] },
    ],
    humanFailureEventIntegrations: [{
      uuid: "hfi-1",
      hfeReference: "HR-POST-9",
      system: CCW,
      taskDescription: "Operator fails to restart the pump",
      hfeType: "POST_INITIATOR",
      isTestMaintenance: false,
      impact: "No cooling flow after the pump trips.",
      implementsSrs: [],
    }],
    componentScreeningJustifications: [{ uuid: "scr-1", systemReference: CCW, componentId: "Inlet manual valve transfers closed", screeningCriterion: "a", quantitativeJustification: "The ratio is 17,700, above 100.", implementsSrs: [] }],
    isolationTripConditions: [{ uuid: "itc-1", systemReference: CCW, condition: "Pump trip on low suction pressure", modeledIn: "EXCLUDED", implementsSrs: [] }],
    simultaneousUnavailabilityEvents: [{
      uuid: "su-1",
      systemReference: CCW,
      description: "Joint pump overhaul",
      componentIds: ["CCW-AB-TM"],
      plannedActivityBasis: "Once a year at power.",
      dataAnalysisRef: "CM-1",
      implementsSrs: [],
    }],
  };
}

const HUMAN_FAILURES: SyControlledHumanFailureOption[] = [{
  workbookId: "hr-1",
  workbookName: "HR Workbook 1",
  humanFailureEventId: "HR-POST-9",
  humanFailureEventName: "Fails to restart the cooling pump",
  hfeTiming: "POST_INITIATOR",
  quantificationId: "HEPQ-HR-POST-9",
  methodology: "Detailed",
  value: 0.003,
  valueKind: "MEAN",
}];

const COINCIDENT: SyControlledCoincidentMaintenanceOption[] = [{
  workbookId: "da-1",
  workbookName: "DA Workbook 1",
  recordId: "CM-1",
  description: "A joint overhaul takes both pumps out together.",
  equipment: ["Pump A", "Pump B"],
  scope: "INTRASYSTEM",
  basis: "PREOP_ASSUMPTION",
  value: 0.002,
}];

let mockContext: MockContext;

jest.mock("../syWorkbookContext", () => ({
  useSyWorkbook: () => mockContext,
}));

function setContext(editable = true): void {
  mockContext = {
    sy: makeAnalysis(),
    editable,
    mutateSy: jest.fn(),
    shortOf: (id) => (id === CCW ? "CCW" : id === GV ? "GV" : id),
    controlledParameters: [],
    controlledFailureModes: [],
    controlledHumanFailures: HUMAN_FAILURES,
    controlledCoincidentMaintenance: COINCIDENT,
    runtime: { workbookId: "sy-1", projectId: "project-1", revision: 3, saveStatus: "saved" },
  };
}

function lastMutation(): StepAnalysis {
  const calls = mockContext.mutateSy.mock.calls;
  const mutator = calls[calls.length - 1]![0] as (draft: StepAnalysis) => StepAnalysis;
  return mutator(mockContext.sy);
}

describe("SY Step 03 failure modes", () => {
  beforeEach(() => setContext());

  it("reviews one system's failure behavior, screening, signals, outages and human events", () => {
    const openDrawer = jest.fn();
    render(<FailureModesScreen sysId={CCW} setSysId={jest.fn()} openDrawer={openDrawer} />);

    expect(screen.getByRole("combobox", { name: "System" })).toHaveValue(CCW);
    const behavior = screen.getByRole("table", { name: "Failure behavior" });
    expect(within(behavior).getByText("Overcooling, which helps the function.")).toBeInTheDocument();
    expect(within(behavior).getAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Edit failure behavior" }));
    expect(openDrawer).toHaveBeenCalledWith({ kind: "behavior", id: CCW });

    const screened = screen.getByRole("table", { name: "Screened out" });
    expect(within(screened).getByText("100 times below the train's leading failure")).toBeInTheDocument();
    expect(within(screened).getByText("Criterion a")).toBeInTheDocument();

    const signals = screen.getByRole("table", { name: "Isolation and trip signals" });
    expect(within(signals).getByText("Left out")).toBeInTheDocument();
    expect(within(signals).getByText("Reason required")).toBeInTheDocument();

    const outages = screen.getByRole("table", { name: "Out of service together" });
    expect(within(outages).getByText("Both pumps out for a joint overhaul")).toBeInTheDocument();
    expect(within(outages).getByText("A joint overhaul takes both pumps out together.")).toBeInTheDocument();
    expect(within(outages).getByText("DA Workbook 1 · 2.0E-3")).toBeInTheDocument();

    const human = screen.getByRole("table", { name: "Human failure events" });
    const rows = within(human).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(within(rows[1]!).getByText("Fails to restart the cooling pump")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Post-initiator")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("No cooling flow after the pump trips.")).toBeInTheDocument();
    expect(within(rows[2]!).getAllByText("Not recorded").length).toBeGreaterThan(0);
    fireEvent.click(within(human).getByRole("button", { name: "Edit CCW-HFE" }));
    expect(openDrawer).toHaveBeenCalledWith({ kind: "hfe", id: "CCW-HFE" });
  });

  it("adds screening, signal and outage records to the shown system", () => {
    const openDrawer = jest.fn();
    render(<FailureModesScreen sysId={CCW} setSysId={jest.fn()} openDrawer={openDrawer} />);

    fireEvent.click(screen.getByRole("button", { name: "Add screened item" }));
    const screenedRecords = lastMutation().componentScreeningJustifications ?? [];
    const screenedRecord = screenedRecords[screenedRecords.length - 1];
    expect(screenedRecord).toMatchObject({ systemReference: CCW, screeningCriterion: "a" });
    expect(openDrawer).toHaveBeenLastCalledWith({ kind: "screening", id: screenedRecord?.uuid });

    fireEvent.click(screen.getByRole("button", { name: "Add signal" }));
    const signals = lastMutation().isolationTripConditions ?? [];
    expect(signals[signals.length - 1]).toMatchObject({ systemReference: CCW, modeledIn: "SYSTEM_MODEL" });

    fireEvent.click(screen.getByRole("button", { name: "Add record" }));
    const outages = lastMutation().simultaneousUnavailabilityEvents ?? [];
    expect(outages[outages.length - 1]).toMatchObject({ systemReference: CCW, componentIds: [] });
  });

  it("switches systems and explains what a system-level model cannot hold", () => {
    const setSysId = jest.fn();
    const { rerender } = render(<FailureModesScreen sysId={CCW} setSysId={setSysId} openDrawer={jest.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "System" }), { target: { value: GV } });
    expect(setSysId).toHaveBeenCalledWith(GV);

    rerender(<FailureModesScreen sysId={GV} setSysId={setSysId} openDrawer={jest.fn()} />);
    expect(screen.getAllByText("This system uses a system-level model, so it has no basic events.")).toHaveLength(2);
    expect(screen.getByText("Nothing screened out of this system.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add record" })).not.toBeInTheDocument();
  });

  it("hides the add actions from reviewers", () => {
    setContext(false);
    render(<FailureModesScreen sysId={CCW} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    expect(screen.queryByRole("button", { name: "Add screened item" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View failure behavior" })).toBeInTheDocument();
  });

  it("edits the failure behavior lists", () => {
    render(<DrawerContent context={{ kind: "behavior", id: CCW }} onClose={jest.fn()} />);
    const input = screen.getByRole("textbox", { name: "Add a condition" });
    fireEvent.change(input, { target: { value: "Pump motor overload at low voltage." } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(lastMutation().systemDefinitions[0]?.functionLossConditions).toEqual([
      "Hot summer water above the design limit.",
      "Pump room heat after a ventilation loss.",
      "Pump motor overload at low voltage.",
    ]);
  });

  it("offers the standard's screening criteria in words", () => {
    render(<DrawerContent context={{ kind: "screening", id: "scr-1" }} onClose={jest.fn()} />);
    const criterion = screen.getByRole("combobox", { name: "Criterion" });
    expect(within(criterion).getByRole("option", { name: "Criterion b: The failure modes add up to less than 1 percent of the component's total failure probability and have the same effect as the modeled modes." })).toBeInTheDocument();
    fireEvent.change(criterion, { target: { value: "b" } });
    expect(lastMutation().componentScreeningJustifications?.[0]?.screeningCriterion).toBe("b");
  });

  it("requires a reason for a signal left out and clears it when modeled", () => {
    render(<DrawerContent context={{ kind: "trip", id: "itc-1" }} onClose={jest.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Reason required");
    fireEvent.change(screen.getByRole("combobox", { name: "Treatment" }), { target: { value: "SYSTEM_MODEL" } });
    expect(lastMutation().isolationTripConditions?.[0]).toMatchObject({ modeledIn: "SYSTEM_MODEL", exclusionJustification: undefined });
  });

  it("picks the tree's maintenance events and the DA coincident maintenance record", () => {
    render(<DrawerContent context={{ kind: "unavail", id: "su-1" }} onClose={jest.fn()} />);
    const events = screen.getByRole("group", { name: "Maintenance events" });
    expect(within(events).getAllByRole("checkbox")).toHaveLength(2);
    expect(within(events).getByRole("checkbox", { name: "Both pumps out for a joint overhaul CCW-AB-TM" })).toBeChecked();
    fireEvent.click(within(events).getByRole("checkbox", { name: "Train A in maintenance CCW-TM-A" }));
    expect(lastMutation().simultaneousUnavailabilityEvents?.[0]?.componentIds).toEqual(["CCW-AB-TM", "CCW-TM-A"]);

    const record = screen.getByRole("combobox", { name: "DA coincident maintenance record" });
    expect(record).toHaveValue("CM-1");
    fireEvent.change(record, { target: { value: "" } });
    expect(lastMutation().simultaneousUnavailabilityEvents?.[0]?.dataAnalysisRef).toBeUndefined();
  });

  it("links a tree human failure event to its HR event and HEP in one step", () => {
    render(<DrawerContent context={{ kind: "hfe", id: "CCW-HFE" }} onClose={jest.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Human Reliability event and HEP" }), {
      target: { value: JSON.stringify(["hr-1", "HR-POST-9", "HEPQ-HR-POST-9"]) },
    });
    const next = lastMutation();
    expect(next.systemBasicEvents.find((event) => event.uuid === "CCW-HFE")).toMatchObject({
      probability: 0.003,
      controlledDataSource: { referenceType: "HUMAN_FAILURE_EVENT", workbookId: "hr-1", entityId: "HR-POST-9", quantificationId: "HEPQ-HR-POST-9" },
    });
    expect(next.humanFailureEventIntegrations[0]).toMatchObject({
      uuid: "hfi-1",
      basicEventId: "CCW-HFE",
      hfeReference: "HR-POST-9",
      hfeSource: { referenceType: "HUMAN_FAILURE_EVENT", workbookId: "hr-1", entityId: "HR-POST-9", quantificationId: "HEPQ-HR-POST-9" },
      hfeType: "POST_INITIATOR",
    });
  });

  it("records the type of a tree event that has no integration yet", () => {
    render(<DrawerContent context={{ kind: "hfe", id: "CCW-HFE-2" }} onClose={jest.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Type" }), { target: { value: "PRE_INITIATOR" } });
    const integrations = lastMutation().humanFailureEventIntegrations;
    expect(integrations[integrations.length - 1]).toMatchObject({
      uuid: "HFI-CCW-HFE-2",
      basicEventId: "CCW-HFE-2",
      system: CCW,
      taskDescription: "Pump A left isolated after testing",
      hfeType: "PRE_INITIATOR",
    });
  });
});
