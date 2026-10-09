import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { CcfFactorModel, UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import type { CommonCauseFailureGroup, SystemLogicModel, SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { CommonCauseScreen } from "../SyCommonCause";
import { DrawerContent } from "../syScreens2";
import type { SyControlledCcfEstimateOption, SyControlledParameterOption } from "../syWorkbookContext";

jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => jest.requireActual("./syUncertaintyPraxis"));

function point(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value } } };
}

function fraction(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "FRACTION", law: { family: "POINT", value } } };
}

const PUMP_ALPHAS: CcfFactorModel = { model: "ALPHA_FACTOR", testing: "NON_STAGGERED", alphas: { node: "VALUE", law: { family: "FIXED", values: [0.97912, 0.0126, 0.00828] } } };

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
  controlledParameters: SyControlledParameterOption[];
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
  factors: PUMP_ALPHAS,
  total: point(0.006),
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
  factors: { model: "BETA_FACTOR", beta: fraction(0.05) },
  total: point(0.004),
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
  factors: { model: "BETA_FACTOR", beta: fraction(0.1) },
  total: point(0.002),
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
      { uuid: "PMP-A-FR", code: "PMP-A-FR", name: "Pump A fails to run", eventType: "BASIC", failureMode: "FAILURE_TO_RUN", expression: point(0.006), implementsSrs: [] },
      { uuid: "PMP-B-FR", code: "PMP-B-FR", name: "Pump B fails to run", eventType: "BASIC", failureMode: "FAILURE_TO_RUN", expression: point(0.006), implementsSrs: [] },
      { uuid: "PMP-C-FR", code: "PMP-C-FR", name: "Pump C fails to run", eventType: "BASIC", failureMode: "FAILURE_TO_RUN", expression: point(0.006), implementsSrs: [] },
      { uuid: "VLV-A-FO", code: "VLV-A-FO", name: "Valve A fails to open", eventType: "BASIC", failureMode: "FAILURE_TO_OPEN", expression: point(0.002), implementsSrs: [] },
      { uuid: "VLV-B-FO", code: "VLV-B-FO", name: "Valve B fails to open", eventType: "BASIC", failureMode: "FAILURE_TO_OPEN", expression: point(0.003), implementsSrs: [] },
      { uuid: "CCW-HFE", code: "CCW-HFE", name: "Operator fails to restart the pump", eventType: "BASIC", failureMode: "HUMAN_ERROR", probability: 0.003, implementsSrs: [] },
      { uuid: "CCW-TM-A", code: "CCW-TM-A", name: "Train A in maintenance", eventType: "BASIC", failureMode: "TEST_MAINTENANCE", expression: point(0.004), implementsSrs: [] },
      { uuid: "BAT-A-FR", code: "BAT-A-FR", name: "Battery A fails", eventType: "BASIC", failureMode: "FAILURE_TO_RUN", expression: point(0.004), componentReference: "BAT-A", implementsSrs: [] },
      { uuid: "BAT-B-FR", code: "BAT-B-FR", name: "Battery B fails", eventType: "BASIC", failureMode: "FAILURE_TO_RUN", expression: point(0.004), componentReference: "BAT-B", implementsSrs: [] },
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
    factors: PUMP_ALPHAS,
    source: "Generic rate alpha factors, groups of three",
    riskSignificant: true,
  },
  {
    workbookId: "da-1",
    workbookName: "DA Workbook 1",
    estimateId: "DA-CCF-3",
    groupReference: "ccf-batt",
    factors: { model: "BETA_FACTOR", beta: fraction(0.0079) },
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
    controlledParameters: [],
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

  it("reviews one system's groups with member names, shared causes, DA factors and the Qₜ point", async () => {
    const openDrawer = jest.fn();
    render(<CommonCauseScreen sysId={CCW} setSysId={jest.fn()} openDrawer={openDrawer} />);

    expect(screen.getByRole("combobox", { name: "System" })).toHaveValue(CCW);
    const withinSystem = screen.getByRole("table", { name: "Within this system" });
    const pumps = within(withinSystem).getAllByRole("row")[1]!;
    expect(within(pumps).getByText("Pump C fails to run")).toBeInTheDocument();
    expect(within(pumps).getByText("Same maintenance and test practice")).toBeInTheDocument();
    expect(within(pumps).getByText("Alpha factor, non-staggered testing")).toBeInTheDocument();
    expect(within(pumps).getByText("α1 0.97912 · α2 0.0126 · α3 0.00828")).toHaveClass("sy-review-factors");
    expect(within(pumps).getByText("DA DA-CCF-1 · DA Workbook 1")).toBeInTheDocument();
    await waitFor(() => expect(within(pumps).getByText("6.0E-3")).toBeInTheDocument());
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
    expect(within(valves).getByText("The member events hold different values, so Qₜ stays as typed. Give every member the same value in Step 02 to take Qₜ from them.")).toHaveClass("sy-warn");
    expect(within(valves).getByText("The linked DA estimate DA-CCF-2 is not in the linked DA workbook.")).toHaveClass("sy-warn");
  });

  it("adds an empty group owned by the shown system with typed factors and an unset Qₜ", () => {
    const openDrawer = jest.fn();
    render(<CommonCauseScreen sysId={EPS} setSysId={jest.fn()} openDrawer={openDrawer} />);
    expect(screen.getByText("No common cause group within this system.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add group across systems" }));
    const groups = lastMutation().commonCauseFailureGroups;
    const added = groups[groups.length - 1];
    expect(added).toMatchObject({
      scope: "INTERSYSTEM",
      affectedSystems: [EPS],
      name: "",
      members: { basicEvents: [] },
      factors: { model: "BETA_FACTOR", beta: fraction(0.050000000000000044) },
      total: point(0),
    });
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

  it("links a DA estimate and copies its factors exactly", () => {
    render(<DrawerContent context={{ kind: "ccf", id: "ccf-batt" }} onClose={jest.fn()} />);
    const typedBeta = within(screen.getByRole("group", { name: "Beta factor" })).getByRole("textbox", { name: "Value" });
    expect(typedBeta).toHaveValue("0.05");
    const source = screen.getByRole("combobox", { name: "DA common cause estimate" });
    const option = within(source).getByRole("option", { name: "DA Workbook 1 · DA-CCF-3 for ccf-batt · Beta factor β 0.0079" });
    fireEvent.change(source, { target: { value: option.getAttribute("value") } });

    expect(groupAfterMutation("ccf-batt")).toMatchObject({
      dataAnalysisCCFParameterRef: "DA-CCF-3",
      factors: { model: "BETA_FACTOR", beta: fraction(0.0079) },
      total: point(0.004),
      dataSources: undefined,
    });
  });

  it("shows linked factors read-only", () => {
    render(<DrawerContent context={{ kind: "ccf", id: "ccf-pumps" }} onClose={jest.fn()} />);
    expect(screen.queryByRole("combobox", { name: "Model" })).not.toBeInTheDocument();
    const factors = screen.getByRole("group", { name: "Factors" });
    expect(factors).toHaveTextContent("Alpha factor, non-staggered testing");
    expect(factors).toHaveTextContent("α1 0.97912 · α2 0.0126 · α3 0.00828");
    expect(screen.getByRole("group", { name: "Member events in CCW" })).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Member events in CCW" })).queryByText("Operator fails to restart the pump")).not.toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Member events in CCW" })).queryByText("Train A in maintenance")).not.toBeInTheDocument();
  });

  it("keeps members, components, typed factors and Qₜ in step", async () => {
    const pair: CommonCauseFailureGroup = {
      ...BATTERIES,
      uuid: "ccf-pair",
      name: "Battery pair",
      scope: "INTRASYSTEM",
      affectedSystems: [EPS],
      affectedComponents: [],
      members: { basicEvents: [{ id: "BAT-A-FR" }] },
      factors: { model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: { node: "VALUE", law: { family: "FIXED", values: [1] } } },
      total: point(0.001),
    };
    setContext(true, [pair]);
    render(<DrawerContent context={{ kind: "ccf", id: "ccf-pair" }} onClose={jest.fn()} />);
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Battery B fails 4.0E-3 4.00E-3" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("checkbox", { name: "Battery B fails 4.0E-3 4.00E-3" }));

    expect(groupAfterMutation("ccf-pair")).toMatchObject({
      members: { basicEvents: [{ id: "BAT-A-FR" }, { id: "BAT-B-FR" }] },
      affectedComponents: ["BAT-A", "BAT-B"],
      factors: { model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: { node: "VALUE", law: { family: "FIXED", values: [0.95, 0.05] } } },
      total: point(0.004),
    });
  });

  it("edits typed factors, shared causes, defenses and coupled systems", () => {
    render(<DrawerContent context={{ kind: "ccf", id: "ccf-batt" }} onClose={jest.fn()} />);
    const beta = within(screen.getByRole("group", { name: "Beta factor" })).getByRole("textbox", { name: "Value" });
    fireEvent.change(beta, { target: { value: "0.08" } });
    fireEvent.blur(beta);
    expect(groupAfterMutation("ccf-batt")?.factors).toEqual({ model: "BETA_FACTOR", beta: fraction(0.08) });

    fireEvent.change(screen.getByRole("combobox", { name: "Model" }), { target: { value: "ALPHA_FACTOR" } });
    expect(groupAfterMutation("ccf-batt")?.factors).toEqual({ model: "ALPHA_FACTOR", testing: "NON_STAGGERED", alphas: { node: "VALUE", law: { family: "FIXED", values: [0.95, 0.05] } } });

    fireEvent.click(screen.getByRole("checkbox", { name: "Same manufacturer" }));
    expect(groupAfterMutation("ccf-batt")?.sharedCauseFactors).toEqual({ environment: true, manufacturer: true, otherFactors: ["One charger vendor"] });

    const defense = screen.getByRole("textbox", { name: "Add a defense" });
    fireEvent.change(defense, { target: { value: "Staggered equalize charging" } });
    fireEvent.keyDown(defense, { key: "Enter" });
    expect(groupAfterMutation("ccf-batt")?.defenseMechanisms).toEqual(["Staggered equalize charging"]);

    fireEvent.click(within(screen.getByRole("group", { name: "Coupled systems" })).getByRole("checkbox", { name: "Guard vessel" }));
    expect(groupAfterMutation("ccf-batt")?.affectedSystems).toEqual([EPS, CCW, GV]);
  });

  it("takes Qₜ from the shared member value and lets the analyst type a law when members differ", async () => {
    setContext(true);
    const { unmount } = render(<DrawerContent context={{ kind: "ccf", id: "ccf-batt" }} onClose={jest.fn()} />);
    const shared = screen.getByRole("group", { name: "Total failure probability" });
    expect(shared).toHaveTextContent("From the member value.");
    await waitFor(() => expect(within(shared).getByText("4.0E-3")).toBeInTheDocument());
    expect(within(shared).queryByRole("textbox", { name: "Value" })).not.toBeInTheDocument();
    unmount();

    render(<DrawerContent context={{ kind: "ccf", id: "ccf-valves" }} onClose={jest.fn()} />);
    const typed = screen.getByRole("group", { name: "Total failure probability" });
    const total = within(typed).getByRole("textbox", { name: "Value" });
    fireEvent.change(total, { target: { value: "0.0025" } });
    fireEvent.blur(total);
    expect(groupAfterMutation("ccf-valves")?.total).toEqual(point(0.0025));

    fireEvent.change(within(typed).getByRole("combobox", { name: "Law" }), { target: { value: "LOGNORMAL" } });
    expect(groupAfterMutation("ccf-valves")?.total).toEqual({ node: "VALUE", value: { unit: "PROBABILITY", law: { family: "LOGNORMAL", mean: 0.002, errorFactor: 3, level: 0.95 } } });
  });

  it("offers the fixes for a stale Qₜ and drifted DA factors", () => {
    const stale: CommonCauseFailureGroup = {
      ...PUMPS,
      factors: { model: "ALPHA_FACTOR", testing: "NON_STAGGERED", alphas: { node: "VALUE", law: { family: "FIXED", values: [0.95, 0.035, 0.015] } } },
      total: point(0.008),
    };
    setContext(true, [stale]);
    render(<DrawerContent context={{ kind: "ccf", id: "ccf-pumps" }} onClose={jest.fn()} />);
    const problems = screen.getByRole("group", { name: "Setup problems" });
    expect(within(problems).getByText("Qₜ differs from the value the member events share.")).toBeInTheDocument();
    expect(within(problems).getByText("The factors differ from DA estimate DA-CCF-1.")).toBeInTheDocument();

    fireEvent.click(within(problems).getByRole("button", { name: "Use the member value" }));
    expect(groupAfterMutation("ccf-pumps")?.total).toEqual(point(0.006));

    fireEvent.click(within(problems).getByRole("button", { name: "Apply the DA values" }));
    expect(groupAfterMutation("ccf-pumps")).toMatchObject({ factors: PUMP_ALPHAS, total: point(0.006) });
  });

  it("removes a group with a text-only action", () => {
    const onClose = jest.fn();
    render(<DrawerContent context={{ kind: "ccf", id: "ccf-valves" }} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove group" }));
    expect(onClose).toHaveBeenCalled();
    expect(lastMutation().commonCauseFailureGroups.map((group) => group.uuid)).toEqual(["ccf-pumps", "ccf-batt"]);
  });
});
