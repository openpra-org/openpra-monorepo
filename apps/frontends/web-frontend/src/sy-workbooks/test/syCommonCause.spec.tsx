import { fireEvent, render, screen, within } from "@testing-library/react";
import type { CommonCauseFailureGroup, SystemLogicModel, SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { CommonCauseScreen } from "../SyCommonCause";
import { DrawerContent } from "../syScreens2";
import type { SyControlledCcfEstimateOption } from "../syWorkbookContext";

const CCW = "SYS-CCW";
const EPS = "SYS-EPS";
const GV = "SYS-GV";

type StepAnalysis = Pick<SystemsAnalysis,
  | "systemDefinitions"
  | "systemLogicModels"
  | "systemBasicEvents"
  | "commonCauseFailureGroups">;

interface MockContext {
  sy: StepAnalysis;
  editable: boolean;
  mutateSy: jest.Mock;
  shortOf: (id: string) => string;
  controlledCcfEstimates: SyControlledCcfEstimateOption[];
  runtime: { workbookId: string; projectId: string; revision: number; saveStatus: "saved" };
}

const mockCcfAnalysis = jest.fn();

jest.mock("../SyCcfAnalysis", () => ({
  SyCcfAnalysis: (props: { currentModelId: string }) => {
    mockCcfAnalysis(props);
    return null;
  },
}));

function tree(uuid: string, systemReference: string, eventIds: readonly string[]): SystemLogicModel {
  return {
    uuid,
    code: `FT-${systemReference}`,
    name: `${systemReference} fault tree`,
    systemReference,
    description: "System unavailable",
    modelRepresentation: "FAULT_TREE",
    topGate: { gateId: `${uuid}-top` },
    gates: [{ id: `${uuid}-top`, kind: "GATE", gateType: "OR", code: "TOP", name: "Top", description: "" }],
    leafNodes: eventIds.map((id) => ({ id: `${uuid}-${id}`, kind: "BASIC_EVENT_REFERENCE" as const, basicEventId: id })),
    gateInputs: eventIds.map((id, order) => ({ id: `${uuid}-input-${id}`, gateId: `${uuid}-top`, childId: `${uuid}-${id}`, order })),
    nodePositions: [],
    layout: { viewport: { x: 0, y: 0, zoom: 1 }, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" },
    implementsSrs: [],
  };
}

const SYSTEM_LEVEL: SystemLogicModel = {
  ...tree("model-gv", GV, []),
  modelRepresentation: "System-level",
  nonDetailedModelJustification: "Passive shell.",
  topGate: null,
  gates: [],
};

const PUMPS: CommonCauseFailureGroup = {
  uuid: "ccf-pumps",
  name: "Cooling pumps",
  description: "Three pumps of one make on one maintenance schedule.",
  scope: "INTRASYSTEM",
  affectedComponents: ["P-A", "P-B", "P-C"],
  affectedSystems: [CCW],
  modelType: "ALPHA_FACTOR",
  modelSpecificParameters: { alphaFactorParameters: { alphaFactors: { alpha1: 0.97912, alpha2: 0.0126, alpha3: 0.00828 }, totalFailureProbability: 0.006 } },
  dataAnalysisCCFParameterRef: "DA-CCF-1",
  members: { basicEvents: [{ id: "PMP-A-FR" }, { id: "PMP-B-FR" }, { id: "PMP-C-FR" }] },
  groupSelectionBasis: "Three pumps of one make on one maintenance schedule.",
  defenseMechanisms: ["Staggered testing"],
  sharedCauseFactors: { hardwareDesign: true, maintenance: true },
  implementsSrs: [],
};

const BATTERIES: CommonCauseFailureGroup = {
  uuid: "ccf-batt",
  name: "Station batteries",
  description: "Two batteries in one room.",
  scope: "INTERSYSTEM",
  affectedComponents: ["BAT-A", "BAT-B"],
  affectedSystems: [EPS, CCW],
  modelType: "BETA_FACTOR",
  modelSpecificParameters: { betaFactorParameters: { beta: 0.05, totalFailureProbability: 0.004 } },
  members: { basicEvents: [{ id: "BAT-A-FR" }, { id: "BAT-B-FR" }] },
  groupSelectionBasis: "Two batteries in one room.",
  sharedCauseFactors: { environment: true, otherFactors: ["One charger vendor"] },
  dataSources: [{ reference: "NUREG/CR-5497", description: "Generic beta", dataType: "generic" }],
  implementsSrs: [],
};

const VALVES: CommonCauseFailureGroup = {
  uuid: "ccf-valves",
  name: "Discharge valves",
  description: "Two valves of one make.",
  scope: "INTRASYSTEM",
  affectedComponents: [],
  affectedSystems: [CCW],
  modelType: "BETA_FACTOR",
  modelSpecificParameters: { betaFactorParameters: { beta: 0.1, totalFailureProbability: 0.002 } },
  dataAnalysisCCFParameterRef: "DA-CCF-2",
  members: { basicEvents: [{ id: "VLV-A-FO" }, { id: "VLV-B-FO" }] },
  groupSelectionBasis: "Two valves of one make.",
  implementsSrs: [],
};

function makeAnalysis(groups: CommonCauseFailureGroup[] = [PUMPS, BATTERIES, VALVES]): StepAnalysis {
  return {
    systemDefinitions: [
      { uuid: CCW, name: "Component cooling water", abbreviation: "CCW", boundaries: [], successCriteriaIds: [], modeledComponentsAndFailures: {}, informationBasis: "as-designed-as-intended", implementsSrs: [] },
      { uuid: EPS, name: "Emergency power", abbreviation: "EPS", boundaries: [], successCriteriaIds: [], modeledComponentsAndFailures: {}, informationBasis: "as-designed-as-intended", implementsSrs: [] },
      { uuid: GV, name: "Guard vessel", abbreviation: "GV", boundaries: [], successCriteriaIds: [], modeledComponentsAndFailures: {}, informationBasis: "as-designed-as-intended", implementsSrs: [] },
    ],
    systemLogicModels: [
      tree("model-ccw", CCW, ["PMP-A-FR", "PMP-B-FR", "PMP-C-FR", "VLV-A-FO", "VLV-B-FO", "CCW-HFE", "CCW-TM-A"]),
      tree("model-eps", EPS, ["BAT-A-FR", "BAT-B-FR"]),
      SYSTEM_LEVEL,
    ],
    systemBasicEvents: [
      { uuid: "PMP-A-FR", code: "PMP-A-FR", name: "Pump A fails to run", eventType: "BASIC", failureMode: "FAILURE_TO_RUN", probability: 0.006, implementsSrs: [] },
      { uuid: "PMP-B-FR", code: "PMP-B-FR", name: "Pump B fails to run", eventType: "BASIC", failureMode: "FAILURE_TO_RUN", probability: 0.006, implementsSrs: [] },
      { uuid: "PMP-C-FR", code: "PMP-C-FR", name: "Pump C fails to run", eventType: "BASIC", failureMode: "FAILURE_TO_RUN", probability: 0.006, implementsSrs: [] },
      { uuid: "VLV-A-FO", code: "VLV-A-FO", name: "Valve A fails to open", eventType: "BASIC", failureMode: "FAILURE_TO_OPEN", probability: 0.002, implementsSrs: [] },
      { uuid: "VLV-B-FO", code: "VLV-B-FO", name: "Valve B fails to open", eventType: "BASIC", failureMode: "FAILURE_TO_OPEN", probability: 0.003, implementsSrs: [] },
      { uuid: "CCW-HFE", code: "CCW-HFE", name: "Operator fails to restart the pump", eventType: "BASIC", failureMode: "HUMAN_ERROR", probability: 0.003, implementsSrs: [] },
      { uuid: "CCW-TM-A", code: "CCW-TM-A", name: "Train A in maintenance", eventType: "BASIC", failureMode: "TEST_MAINTENANCE", probability: 0.004, implementsSrs: [] },
      { uuid: "BAT-A-FR", code: "BAT-A-FR", name: "Battery A fails", eventType: "BASIC", failureMode: "FAILURE_TO_RUN", probability: 0.004, componentReference: "BAT-A", implementsSrs: [] },
      { uuid: "BAT-B-FR", code: "BAT-B-FR", name: "Battery B fails", eventType: "BASIC", failureMode: "FAILURE_TO_RUN", probability: 0.004, componentReference: "BAT-B", implementsSrs: [] },
    ],
    commonCauseFailureGroups: groups,
  };
}

const ESTIMATES: SyControlledCcfEstimateOption[] = [
  {
    workbookId: "da-1",
    workbookName: "DA Workbook 1",
    estimateId: "DA-CCF-1",
    groupReference: "ccf-pumps",
    modelType: "ALPHA_FACTOR",
    parameters: { alpha1: 0.97912, alpha2: 0.0126, alpha3: 0.00828 },
    source: "Generic rate alpha factors, groups of three",
    riskSignificant: true,
  },
  {
    workbookId: "da-1",
    workbookName: "DA Workbook 1",
    estimateId: "DA-CCF-3",
    groupReference: "ccf-batt",
    modelType: "BETA_FACTOR",
    parameters: { beta: 0.0079 },
    riskSignificant: false,
  },
];

let mockContext: MockContext;

jest.mock("../syWorkbookContext", () => ({
  useSyWorkbook: () => mockContext,
}));

function setContext(editable = true, groups?: CommonCauseFailureGroup[]): void {
  mockContext = {
    sy: makeAnalysis(groups),
    editable,
    mutateSy: jest.fn(),
    shortOf: (id) => (id === CCW ? "CCW" : id === EPS ? "EPS" : id === GV ? "GV" : id),
    controlledCcfEstimates: ESTIMATES,
    runtime: { workbookId: "sy-1", projectId: "project-1", revision: 3, saveStatus: "saved" },
  };
}

function lastMutation(): StepAnalysis {
  const calls = mockContext.mutateSy.mock.calls;
  const mutator = calls[calls.length - 1]![0] as (draft: StepAnalysis) => StepAnalysis;
  return mutator(mockContext.sy);
}

function groupAfterMutation(id: string): CommonCauseFailureGroup | undefined {
  return lastMutation().commonCauseFailureGroups.find((group) => group.uuid === id);
}

describe("SY Step 04 common cause", () => {
  beforeEach(() => {
    setContext();
    mockCcfAnalysis.mockClear();
  });

  it("reviews one system's groups with member names, shared causes and DA parameters", () => {
    const openDrawer = jest.fn();
    render(<CommonCauseScreen sysId={CCW} setSysId={jest.fn()} openDrawer={openDrawer} />);

    expect(screen.getByRole("combobox", { name: "System" })).toHaveValue(CCW);
    const withinSystem = screen.getByRole("table", { name: "Within this system" });
    const pumps = within(withinSystem).getAllByRole("row")[1]!;
    expect(within(pumps).getByText("Pump C fails to run")).toBeInTheDocument();
    expect(within(pumps).getByText("Same maintenance and test practice")).toBeInTheDocument();
    expect(within(pumps).getByText("Alpha factor")).toBeInTheDocument();
    expect(within(pumps).getByText((_, element) => element?.classList.contains("sy-review-factors") === true && element.textContent === "α1 0.97912 · α2 0.0126 · α3 0.00828")).toBeInTheDocument();
    expect(within(pumps).getByText("DA DA-CCF-1 · DA Workbook 1")).toBeInTheDocument();
    expect(within(pumps).getByText("6.0E-3")).toBeInTheDocument();
    fireEvent.click(within(withinSystem).getByRole("button", { name: "Edit Cooling pumps" }));
    expect(openDrawer).toHaveBeenCalledWith({ kind: "ccf", id: "ccf-pumps" });

    const across = screen.getByRole("table", { name: "Across systems" });
    expect(within(across).getByText("Affects EPS, CCW")).toBeInTheDocument();
    expect(within(across).getByText("One charger vendor")).toBeInTheDocument();
    expect(within(across).getByText("Typed · NUREG/CR-5497")).toBeInTheDocument();
    expect(within(across).getByText("Link the parameter estimate from Data Analysis.")).toHaveClass("sy-warn");
    expect(mockCcfAnalysis).toHaveBeenCalledWith({ currentModelId: "model-ccw" });
  });

  it("shows setup problems on the row", () => {
    render(<CommonCauseScreen sysId={CCW} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    const valves = within(screen.getByRole("table", { name: "Within this system" })).getAllByRole("row")[2]!;
    expect(within(valves).getByText("The member events carry different probabilities (2.0E-3, 3.0E-3). Give every member the same probability in Step 02.")).toHaveClass("sy-error");
    expect(within(valves).getByText("The linked DA estimate DA-CCF-2 is not in the linked DA workbook.")).toHaveClass("sy-warn");
  });

  it("adds an empty group owned by the shown system", () => {
    const openDrawer = jest.fn();
    render(<CommonCauseScreen sysId={EPS} setSysId={jest.fn()} openDrawer={openDrawer} />);
    expect(screen.getByText("No common cause group within this system.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add group across systems" }));
    const groups = lastMutation().commonCauseFailureGroups;
    const added = groups[groups.length - 1];
    expect(added).toMatchObject({ scope: "INTERSYSTEM", affectedSystems: [EPS], name: "", members: { basicEvents: [] } });
    expect(added?.modelSpecificParameters).toBeUndefined();
    expect(openDrawer).toHaveBeenLastCalledWith({ kind: "ccf", id: added?.uuid });
  });

  it("explains a system-level model and hides reviewer actions", () => {
    const { rerender } = render(<CommonCauseScreen sysId={GV} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    expect(screen.getAllByText("This system uses a system-level model, so it has no component events to group.")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Add group within this system" })).not.toBeInTheDocument();
    expect(mockCcfAnalysis).not.toHaveBeenCalled();

    setContext(false);
    rerender(<CommonCauseScreen sysId={CCW} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    expect(screen.queryByRole("button", { name: "Add group within this system" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View Cooling pumps" })).toBeInTheDocument();
  });

  it("links a DA estimate, copies its model and writes Qₜ from the members", () => {
    render(<DrawerContent context={{ kind: "ccf", id: "ccf-batt" }} onClose={jest.fn()} />);
    expect(screen.getByRole("spinbutton", { name: "Beta" })).toHaveValue(0.05);
    const source = screen.getByRole("combobox", { name: "DA common cause estimate" });
    const option = within(source).getByRole("option", { name: "DA Workbook 1 · DA-CCF-3 for ccf-batt · Beta factor β 0.0079" });
    fireEvent.change(source, { target: { value: option.getAttribute("value") } });

    expect(groupAfterMutation("ccf-batt")).toMatchObject({
      dataAnalysisCCFParameterRef: "DA-CCF-3",
      modelType: "BETA_FACTOR",
      modelSpecificParameters: { betaFactorParameters: { beta: 0.0079, totalFailureProbability: 0.004 } },
      dataSources: undefined,
    });
  });

  it("hides typed factors once a DA estimate is linked", () => {
    render(<DrawerContent context={{ kind: "ccf", id: "ccf-pumps" }} onClose={jest.fn()} />);
    expect(screen.queryByRole("combobox", { name: "Model" })).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: "Alpha 1" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Member events in CCW" })).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Member events in CCW" })).queryByText("Operator fails to restart the pump")).not.toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Member events in CCW" })).queryByText("Train A in maintenance")).not.toBeInTheDocument();
  });

  it("keeps members, components and Qₜ in step", () => {
    const pair: CommonCauseFailureGroup = {
      ...BATTERIES,
      uuid: "ccf-pair",
      name: "Battery pair",
      scope: "INTRASYSTEM",
      affectedSystems: [EPS],
      affectedComponents: [],
      members: { basicEvents: [{ id: "BAT-A-FR" }] },
      modelSpecificParameters: { betaFactorParameters: { beta: 0.05, totalFailureProbability: 0.001 } },
    };
    setContext(true, [pair]);
    render(<DrawerContent context={{ kind: "ccf", id: "ccf-pair" }} onClose={jest.fn()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Battery B fails 4.0E-3" }));

    expect(groupAfterMutation("ccf-pair")).toMatchObject({
      members: { basicEvents: [{ id: "BAT-A-FR" }, { id: "BAT-B-FR" }] },
      affectedComponents: ["BAT-A", "BAT-B"],
      modelSpecificParameters: { betaFactorParameters: { beta: 0.05, totalFailureProbability: 0.004 } },
    });
  });

  it("edits typed factors, shared causes, defenses and coupled systems", () => {
    render(<DrawerContent context={{ kind: "ccf", id: "ccf-batt" }} onClose={jest.fn()} />);
    const beta = screen.getByRole("spinbutton", { name: "Beta" });
    fireEvent.change(beta, { target: { value: "0.08" } });
    fireEvent.blur(beta);
    expect(groupAfterMutation("ccf-batt")?.modelSpecificParameters).toEqual({ betaFactorParameters: { beta: 0.08, totalFailureProbability: 0.004 } });

    fireEvent.change(screen.getByRole("combobox", { name: "Model" }), { target: { value: "ALPHA_FACTOR" } });
    expect(groupAfterMutation("ccf-batt")?.modelSpecificParameters).toEqual({ alphaFactorParameters: { alphaFactors: { alpha1: 0.95, alpha2: 0.05 }, totalFailureProbability: 0.004 } });

    fireEvent.click(screen.getByRole("checkbox", { name: "Same manufacturer" }));
    expect(groupAfterMutation("ccf-batt")?.sharedCauseFactors).toEqual({ environment: true, manufacturer: true, otherFactors: ["One charger vendor"] });

    const defense = screen.getByRole("textbox", { name: "Add a defense" });
    fireEvent.change(defense, { target: { value: "Staggered equalize charging" } });
    fireEvent.keyDown(defense, { key: "Enter" });
    expect(groupAfterMutation("ccf-batt")?.defenseMechanisms).toEqual(["Staggered equalize charging"]);

    fireEvent.click(within(screen.getByRole("group", { name: "Coupled systems" })).getByRole("checkbox", { name: "Guard vessel" }));
    expect(groupAfterMutation("ccf-batt")?.affectedSystems).toEqual([EPS, CCW, GV]);
  });

  it("offers the fixes for a stale Qₜ and drifted DA values", () => {
    const stale: CommonCauseFailureGroup = {
      ...PUMPS,
      modelSpecificParameters: { alphaFactorParameters: { alphaFactors: { alpha1: 0.95, alpha2: 0.035, alpha3: 0.015 }, totalFailureProbability: 0.008 } },
    };
    setContext(true, [stale]);
    render(<DrawerContent context={{ kind: "ccf", id: "ccf-pumps" }} onClose={jest.fn()} />);
    const problems = screen.getByRole("group", { name: "Setup problems" });
    expect(within(problems).getByText("Qₜ 8.0E-3 does not match the member events (6.0E-3).")).toBeInTheDocument();
    expect(within(problems).getByText("The model or factors differ from DA estimate DA-CCF-1.")).toBeInTheDocument();

    fireEvent.click(within(problems).getByRole("button", { name: "Use the member probability" }));
    expect(groupAfterMutation("ccf-pumps")?.modelSpecificParameters?.alphaFactorParameters?.totalFailureProbability).toBe(0.006);

    fireEvent.click(within(problems).getByRole("button", { name: "Apply the DA values" }));
    expect(groupAfterMutation("ccf-pumps")?.modelSpecificParameters).toEqual({
      alphaFactorParameters: { alphaFactors: { alpha1: 0.97912, alpha2: 0.0126, alpha3: 0.00828 }, totalFailureProbability: 0.006 },
    });
  });

  it("removes a group with a text-only action", () => {
    const onClose = jest.fn();
    render(<DrawerContent context={{ kind: "ccf", id: "ccf-valves" }} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove group" }));
    expect(onClose).toHaveBeenCalled();
    expect(lastMutation().commonCauseFailureGroups.map((group) => group.uuid)).toEqual(["ccf-pumps", "ccf-batt"]);
  });
});
