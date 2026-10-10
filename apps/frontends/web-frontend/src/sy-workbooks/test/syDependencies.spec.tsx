import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { SystemLogicModel, SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import { DependenciesScreen } from "../SyDependencies";
import { DependencyMatrix } from "../SyDependencyMatrix";
import { DrawerContent } from "../syScreens2";
import { coverageIssue, dependencyLinks, inventoryHours, linkIssues, newDependency } from "../syDependencyLinks";
import type { SyControlledParameterOption, SyLinkedInputs } from "../syWorkbookContext";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { praxisUncertainty, settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";

jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

const CCW = "SYS-CCW";
const EPS = "SYS-EPS";
const HVAC = "SYS-HVAC";
const GV = "SYS-GV";

type StepAnalysis = Pick<SystemsAnalysis,
  | "plantStage"
  | "systemDefinitions"
  | "systemLogicModels"
  | "systemBasicEvents"
  | "systemDependencies"
  | "supportSystemSuccessCriteria"
  | "supportSystemNeedAnalyses"
  | "environmentalDesignBasisConsiderations"
  | "depletionModels"
  | "initiationActuationSystems"
  | "digitalInstrumentationAndControl"
  | "preOperationalAssumptions"
  | "dependencySearchMethodology">;

interface MockContext {
  sy: StepAnalysis;
  editable: boolean;
  mutateSy: jest.Mock;
  shortOf: (id: string) => string;
  links: SyLinkedInputs;
  controlledParameters: SyControlledParameterOption[];
  controlledCcfVectors: [];
  controlledCcfFactors: [];
  runtime: { workbookId: string; projectId: string; revision: number; saveStatus: "saved" };
}

const SHORT = new Map([[CCW, "CCW"], [EPS, "EPS"], [HVAC, "HVAC"], [GV, "GV"]]);

function tree(systemReference: string, events: readonly string[], transfers: readonly { id: string; name: string; target: string }[]): SystemLogicModel {
  const top = `${systemReference}-top`;
  const leaves = [
    ...events.map((id) => ({ id: `${systemReference}-${id}`, kind: "BASIC_EVENT_REFERENCE" as const, basicEventId: id })),
    ...transfers.map((transfer) => ({ id: transfer.id, code: transfer.id, name: transfer.name, description: transfer.name, kind: "TRANSFER_REFERENCE" as const, target: { modelId: `model-${transfer.target}`, entityId: `${transfer.target}-top` } })),
  ];
  return {
    uuid: `model-${systemReference}`,
    code: `FT-${systemReference}`,
    name: `${systemReference} fault tree`,
    systemReference,
    description: "System unavailable",
    modelRepresentation: "FAULT_TREE",
    topGate: { gateId: top },
    gates: [{ id: top, kind: "GATE", gateType: "OR", code: "TOP", name: "Top", description: "" }],
    leafNodes: leaves,
    gateInputs: leaves.map((leaf, order) => ({ id: `${top}-${leaf.id}`, gateId: top, childId: leaf.id, order })),
    nodePositions: [],
    layout: { viewport: { x: 0, y: 0, zoom: 1 }, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" },
    implementsSrs: [],
  };
}

function system(uuid: string, name: string, hours: number) {
  return { uuid, name, abbreviation: SHORT.get(uuid), boundaries: [], successCriteriaIds: [], missionTime: { node: "VALUE" as const, value: { unit: "HOURS" as const, law: { family: "POINT" as const, value: hours } } }, modeledComponentsAndFailures: {}, informationBasis: "as-designed-as-intended" as const, implementsSrs: [] };
}

function makeAnalysis(): StepAnalysis {
  return {
    plantStage: "PRE_OPERATIONAL",
    systemDefinitions: [system(CCW, "Component cooling water", 24), system(EPS, "Emergency power", 24), system(HVAC, "Room cooling", 24), system(GV, "Guard vessel", 72)],
    systemLogicModels: [
      tree(CCW, ["PMP-A", "PMP-B", "CCW-HFE"], [{ id: "tr-CCW-EPS", name: "Loss of power to the pumps", target: EPS }]),
      tree(EPS, ["BAT-A", "BAT-B"], [{ id: "tr-EPS-HVAC", name: "Loss of battery room cooling", target: HVAC }]),
      tree(HVAC, ["CHL-A"], [{ id: "tr-HVAC-EPS", name: "Loss of power to the chillers", target: EPS }]),
      { ...tree(GV, [], []), modelRepresentation: "System-level", nonDetailedModelJustification: "Passive shell.", topGate: null, gates: [], leafNodes: [], gateInputs: [] },
    ],
    systemBasicEvents: [
      { uuid: "PMP-A", code: "PMP-A", name: "Pump A fails to run", eventType: "BASIC", failureMode: "FAILURE_TO_RUN", componentReference: "P-1A", probability: 0.006, implementsSrs: [] },
      { uuid: "PMP-B", code: "PMP-B", name: "Pump B fails to run", eventType: "BASIC", failureMode: "FAILURE_TO_RUN", componentReference: "P-1B", probability: 0.006, implementsSrs: [] },
      { uuid: "CCW-HFE", code: "CCW-HFE", name: "Operator fails to restart a pump", eventType: "BASIC", failureMode: "HUMAN_ERROR", probability: 0.003, implementsSrs: [] },
      { uuid: "BAT-A", code: "BAT-A", name: "Battery A fails", eventType: "BASIC", failureMode: "FAILURE_TO_RUN", probability: 0.004, implementsSrs: [] },
      { uuid: "BAT-B", code: "BAT-B", name: "Battery B fails", eventType: "BASIC", failureMode: "FAILURE_TO_RUN", probability: 0.004, implementsSrs: [] },
      { uuid: "CHL-A", code: "CHL-A", name: "Chiller A fails", eventType: "BASIC", failureMode: "FAILURE_TO_RUN", probability: 0.009, implementsSrs: [] },
    ],
    systemDependencies: [
      { uuid: "DEP-CCW-EPS", dependentSystem: CCW, supportingSystem: EPS, type: "FUNCTIONAL", details: "Power for the pump motors.", supportKind: "MOTIVE_POWER", modeledIn: "SYSTEM_MODEL", implementsSrs: [] },
      { uuid: "DEP-CCW-HVAC", dependentSystem: CCW, supportingSystem: HVAC, type: "FUNCTIONAL", details: "Pump room cooling.", supportKind: "COOLING", modeledIn: "EXCLUDED", implementsSrs: [] },
      { uuid: "DEP-HVAC-EPS", dependentSystem: HVAC, supportingSystem: EPS, type: "FUNCTIONAL", details: "Control power for the chillers.", supportKind: "CONTROL", modeledIn: "SYSTEM_MODEL", implementsSrs: [] },
    ],
    supportSystemSuccessCriteria: [{ uuid: "SSC-EPS", systemReference: EPS, successCriteria: "One bus carries the pump loads for the mission.", criteriaType: "REALISTIC", supportedSystems: [CCW], implementsSrs: [] }],
    supportSystemNeedAnalyses: [{ uuid: "NA-CCW", systemReference: CCW, analysisReference: "Pump room heat-up calculation", conditionsRepresented: ["Loss of room cooling at full power"], implementsSrs: [] }],
    environmentalDesignBasisConsiderations: [{
      uuid: "SPC-1",
      systemReference: CCW,
      components: ["P-1A", "P-1B"],
      eventSequences: [],
      environmentalConditions: "Shared pump room. A flood fails both pumps.",
      dependentFailuresIncluded: false,
      basicEventIds: ["PMP-A", "PMP-B"],
      initiatingEventIds: ["IE-FLOOD"],
      implementsSrs: [],
    }],
    depletionModels: [{ uuid: "INV-1", resourceType: "battery", description: "Station battery", initialQuantity: 4, consumptionRate: 1, units: "hours", associatedSystem: EPS, missionTimeSupported: false, basis: "Load shedding extends the duty.", implementsSrs: [] }],
    initiationActuationSystems: [{ uuid: "IA-1", name: "Pump start", systemReference: CCW, description: "Starts on low header pressure.", detailedModeling: false, implementsSrs: [] }],
    digitalInstrumentationAndControl: [{ uuid: "DIC-1", name: "Pump controller", systemReference: CCW, description: "Digital pump controller.", methodology: "Controller failure as one basic event.", failureModes: ["Spurious stop"], implementsSrs: [] }],
    preOperationalAssumptions: [{
      uuid: "PA-1",
      assumptionId: "PA-1",
      description: "The two pumps are taken as independent apart from their room.",
      influenceOnDefinition: "Dependency modeling",
      status: "OPEN",
      limitations: [],
      riskImpact: ImportanceLevel.MEDIUM,
      closureBasis: "",
      plannedClosureActions: [],
      affectedElementIds: [CCW],
      implementsSrs: [{ sr: "SY-B10", hlr: "B" }],
    }],
    dependencySearchMethodology: {
      uuid: "DSM-1",
      name: "Dependency search",
      description: "Every system checked against every other system.",
      reference: "Search procedure",
      systemsAnalyzed: [CCW, EPS, HVAC, GV],
      implementsSrs: [],
    },
  };
}

const LINKS: SyLinkedInputs = {
  scName: "SC",
  posName: "",
  esName: "ES",
  scSystems: [
    { id: "SC-CCW", systemId: CCW, name: "Cooling water", capacities: "", supports: [{ systemId: EPS, nature: "AC for the pumps." }] },
    { id: "SC-HVAC", systemId: HVAC, name: "Room cooling", capacities: "", supports: [{ systemId: CCW, nature: "Chilled water for the chiller condensers." }] },
  ],
  scMissionTimeOptions: [],
  scMissionTimeTable: new Map(),
  posStates: [],
  esSafetyFunctions: [],
  esInitiatingEvents: [{ id: "IE-FLOOD", name: "Internal flood" }, { id: "IE-LOOP", name: "Loss of offsite power" }],
};

let mockContext: MockContext;

jest.mock("../syWorkbookContext", () => ({
  useSyWorkbook: () => mockContext,
}));

function setContext(editable = true, sy: StepAnalysis = makeAnalysis()): void {
  mockContext = {
    sy,
    editable,
    mutateSy: jest.fn(),
    shortOf: (id) => SHORT.get(id) ?? id,
    links: LINKS,
    controlledParameters: [],
    controlledCcfVectors: [],
    controlledCcfFactors: [],
    runtime: { workbookId: "sy-1", projectId: "project-1", revision: 3, saveStatus: "saved" },
  };
  jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
}

async function settled(): Promise<void> {
  await act(async () => {
    await settledWithPraxis(() => undefined);
  });
}

function lastMutation(): StepAnalysis {
  const calls = mockContext.mutateSy.mock.calls;
  const mutator = calls[calls.length - 1]![0] as (draft: StepAnalysis) => StepAnalysis;
  return mutator(mockContext.sy);
}

function rowOf(table: HTMLElement, text: string): HTMLElement {
  const row = within(table).getAllByRole("row").find((candidate) => candidate.textContent?.includes(text) === true);
  if (row === undefined) throw new Error(`No row with ${text}`);
  return row;
}

describe("SY Step 05 dependency links", () => {
  it("merges tree transfers, records and Success Criteria supports into one link per pair", () => {
    const sy = makeAnalysis();
    const links = dependencyLinks(sy, LINKS);
    const ccwEps = links.find((link) => link.dependentSystem === CCW && link.supportingSystem === EPS);
    expect(ccwEps?.transfers.map((transfer) => transfer.name)).toEqual(["Loss of power to the pumps"]);
    expect(ccwEps?.records.map((record) => record.uuid)).toEqual(["DEP-CCW-EPS"]);
    expect(ccwEps?.scNature).toBe("AC for the pumps.");
    expect(links.find((link) => link.dependentSystem === HVAC && link.supportingSystem === CCW)?.records).toEqual([]);
  });

  it("flags missing transfers, missing reasons, loops, unrecorded transfers, SC-only needs and uncovered needs", () => {
    const sy = makeAnalysis();
    const all = dependencyLinks(sy, LINKS);
    const find = (dependent: string, supporting: string) => {
      const link = all.find((candidate) => candidate.dependentSystem === dependent && candidate.supportingSystem === supporting);
      if (link === undefined) throw new Error("missing link");
      return link;
    };
    expect(linkIssues(find(CCW, HVAC), find(CCW, HVAC).records[0], sy, all).map((issue) => issue.code)).toEqual(["DEP_REASON"]);
    expect(linkIssues(find(EPS, HVAC), undefined, sy, all).map((issue) => issue.code)).toEqual(["DEP_UNRECORDED", "DEP_LOOP"]);
    expect(linkIssues(find(HVAC, CCW), undefined, sy, all).map((issue) => issue.code)).toEqual(["DEP_SC_ONLY"]);
    expect(coverageIssue(find(HVAC, EPS), sy)?.message).toBe("No success criterion of EPS covers HVAC.");
    expect(coverageIssue(find(CCW, EPS), sy)).toBeNull();

    const noTransfer = { ...sy, systemLogicModels: sy.systemLogicModels.map((model) => (model.systemReference === CCW ? { ...model, leafNodes: model.leafNodes.filter((leaf) => leaf.kind !== "TRANSFER_REFERENCE") } : model)) };
    const reloaded = dependencyLinks(noTransfer, null);
    const link = reloaded.find((candidate) => candidate.dependentSystem === CCW && candidate.supportingSystem === EPS);
    expect(link === undefined ? [] : linkIssues(link, link.records[0], noTransfer, reloaded).map((issue) => issue.code)).toEqual(["DEP_NO_TRANSFER"]);
  });

  it("reads inventory durations and builds new records from a link", () => {
    expect(inventoryHours({ initialQuantity: 4, consumptionRate: 1, units: "hours" })).toBe(4);
    expect(inventoryHours({ initialQuantity: 120, consumptionRate: 5, units: "kg" })).toBe(24);
    expect(inventoryHours({ initialQuantity: 0, consumptionRate: 1, units: "hours" })).toBeNull();
    expect(newDependency({ dependentSystem: EPS, supportingSystem: HVAC, transfers: [{ dependentSystem: EPS, supportingSystem: HVAC, leafId: "tr", name: "Loss of battery room cooling" }] }, "new")).toMatchObject({
      uuid: "new",
      details: "Loss of battery room cooling",
      modeledIn: "SYSTEM_MODEL",
      type: "FUNCTIONAL",
    });
  });
});

describe("SY Step 05 dependencies screen", () => {
  beforeEach(() => setContext());

  it("reviews what one system needs, with kinds, treatments and inline problems", () => {
    const openDrawer = jest.fn();
    render(<DependenciesScreen sysId={CCW} setSysId={jest.fn()} openDrawer={openDrawer} />);

    expect(screen.getByRole("combobox", { name: "System" })).toHaveValue(CCW);
    const needs = screen.getByRole("table", { name: "Support it needs" });
    const power = rowOf(needs, "Emergency power");
    expect(within(power).getByText("Motive power")).toBeInTheDocument();
    expect(within(power).getByText("Power for the pump motors.")).toBeInTheDocument();
    expect(within(power).getByText("Transfer in the fault tree")).toBeInTheDocument();
    const cooling = rowOf(needs, "Room cooling");
    expect(within(cooling).getByText("Left out")).toBeInTheDocument();
    expect(within(cooling).getByText("Reason required.")).toHaveClass("sy-error");
    fireEvent.click(within(power).getByRole("button", { name: "Edit Emergency power support" }));
    expect(openDrawer).toHaveBeenCalledWith({ kind: "dep", id: "DEP-CCW-EPS" });

    const neededBy = screen.getByRole("table", { name: "Systems that need it" });
    expect(within(rowOf(neededBy, "Room cooling")).getByText("Success Criteria lists this support, but the model does not carry it.")).toHaveClass("sy-warn");
    expect(within(screen.getByRole("table", { name: "Support need analyses" })).getByText("Loss of room cooling at full power")).toBeInTheDocument();
    const shared = screen.getByRole("table", { name: "Shared spaces and harsh conditions" });
    expect(within(shared).getByText("Pump B fails to run")).toBeInTheDocument();
    expect(within(shared).getByText("Internal flood")).toBeInTheDocument();
    expect(within(shared).getByText("Not in the model yet.")).toHaveClass("sy-warn");
    const actuation = screen.getByRole("table", { name: "Actuation and software" });
    expect(within(actuation).getByText("Reason required for the simpler model.")).toHaveClass("sy-error");
    expect(within(actuation).getByText("Failure modes: Spurious stop")).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Independence assumptions" })).getByText("The two pumps are taken as independent apart from their room.")).toBeInTheDocument();
  });

  it("shows who relies on a support system, its criteria and its inventory", () => {
    render(<DependenciesScreen sysId={EPS} setSysId={jest.fn()} openDrawer={jest.fn()} />);

    const needs = screen.getByRole("table", { name: "Support it needs" });
    const transferOnly = rowOf(needs, "Room cooling");
    expect(within(transferOnly).getByText("Kind not recorded")).toBeInTheDocument();
    expect(within(transferOnly).getByText("The fault tree transfers to HVAC, but the kind of support is not recorded.")).toHaveClass("sy-warn");
    expect(within(transferOnly).getByText("HVAC also transfers back into EPS. Leave one direction out with a reason to break the loop.")).toHaveClass("sy-error");

    const neededBy = screen.getByRole("table", { name: "Systems that need it" });
    expect(within(rowOf(neededBy, "Room cooling")).getByText("No success criterion of EPS covers HVAC.")).toHaveClass("sy-warn");
    expect(within(rowOf(neededBy, "Component cooling water")).queryByText("No success criterion of EPS covers CCW.")).not.toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Support success criteria" })).getByText("One bus carries the pump loads for the mission.")).toBeInTheDocument();
    const inventory = screen.getByRole("table", { name: "Inventories" });
    expect(within(inventory).getByText("4 h")).toBeInTheDocument();
    expect(within(inventory).getByText("Falls short of the mission time.")).toHaveClass("sy-warn");
  });

  it("records a transfer-only need and adds records owned by the shown system", () => {
    const openDrawer = jest.fn();
    render(<DependenciesScreen sysId={EPS} setSysId={jest.fn()} openDrawer={openDrawer} />);

    fireEvent.click(within(rowOf(screen.getByRole("table", { name: "Support it needs" }), "Room cooling")).getByRole("button", { name: "Edit Room cooling support" }));
    const created = lastMutation().systemDependencies.find((record) => record.dependentSystem === EPS && record.supportingSystem === HVAC);
    expect(created).toMatchObject({ details: "Loss of battery room cooling", modeledIn: "SYSTEM_MODEL" });
    expect(openDrawer).toHaveBeenLastCalledWith({ kind: "dep", id: created?.uuid });

    fireEvent.click(screen.getByRole("button", { name: "Add inventory" }));
    const inventories = lastMutation().depletionModels ?? [];
    expect(inventories[inventories.length - 1]).toMatchObject({ associatedSystem: EPS, units: "hours", consumptionRate: 1 });

    fireEvent.click(screen.getByRole("button", { name: "Add condition" }));
    const couplings = lastMutation().environmentalDesignBasisConsiderations ?? [];
    expect(couplings[couplings.length - 1]).toMatchObject({ systemReference: EPS, basicEventIds: [], initiatingEventIds: [] });
  });

  it("lists Success Criteria supports the model does not carry", () => {
    render(<DependenciesScreen sysId={HVAC} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    const row = rowOf(screen.getByRole("table", { name: "Support it needs" }), "Component cooling water");
    expect(within(row).getByText("Chilled water for the chiller condensers.")).toBeInTheDocument();
    expect(within(row).getByText("Success Criteria lists this support, but the model does not carry it.")).toHaveClass("sy-warn");
  });

  it("explains a system without a fault tree and hides add actions from reviewers", () => {
    const { rerender } = render(<DependenciesScreen sysId={GV} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    expect(screen.getByText("This system has no fault tree, so it transfers to no support system.")).toBeInTheDocument();

    setContext(false);
    rerender(<DependenciesScreen sysId={CCW} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    expect(screen.queryByRole("button", { name: "Add support" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View Emergency power support" })).toBeInTheDocument();
  });
});

describe("SY Step 05 dependency matrix", () => {
  beforeEach(() => setContext());

  it("shows each need by kind, marks problems and opens the record", () => {
    const openDrawer = jest.fn();
    render(<DependencyMatrix openDrawer={openDrawer} />);
    const matrix = screen.getByRole("table", { name: "Dependency matrix" });
    expect(within(matrix).getByRole("button", { name: "Edit CCW needs EPS: Motive power" })).toHaveClass("sy-depmatrix__cell");
    expect(within(matrix).getByRole("button", { name: "Edit CCW needs HVAC: Cooling, left out" })).toHaveClass("sy-depmatrix__cell--error");
    expect(within(matrix).getByRole("button", { name: "Edit EPS needs HVAC: Transfer, kind not recorded" })).toHaveClass("sy-depmatrix__cell--error");
    fireEvent.click(within(matrix).getByRole("button", { name: "Edit HVAC needs EPS: Control power" }));
    expect(openDrawer).toHaveBeenCalledWith({ kind: "dep", id: "DEP-HVAC-EPS" });

    const search = screen.getByRole("table", { name: "Dependency search" });
    expect(within(search).getByText("Every system checked against every other system.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit dependency search" }));
    expect(openDrawer).toHaveBeenLastCalledWith({ kind: "method", id: "DSM-1" });
  });
});

describe("SY Step 05 dialogs", () => {
  beforeEach(() => setContext());

  it("records the kind and treatment of a dependency, and asks for a reason to leave it out", () => {
    render(<DrawerContent context={{ kind: "dep", id: "DEP-CCW-HVAC" }} onClose={jest.fn()} />);
    expect(screen.getByRole("group", { name: "Setup problems" })).toHaveTextContent("Reason required.");
    expect(screen.getByText("Base it on an engineering analysis. A recovery procedure alone is not a reason (SY-B13).")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Kind of support" }), { target: { value: "OPERATOR_INTERFACE" } });
    expect(lastMutation().systemDependencies.find((record) => record.uuid === "DEP-CCW-HVAC")).toMatchObject({ supportKind: "OPERATOR_INTERFACE", type: "HUMAN" });

    fireEvent.change(screen.getByRole("combobox", { name: "Treatment" }), { target: { value: "EVENT_SEQUENCE" } });
    expect(lastMutation().systemDependencies.find((record) => record.uuid === "DEP-CCW-HVAC")).toMatchObject({ modeledIn: "EVENT_SEQUENCE", exclusionJustification: undefined });

    const reason = screen.getByRole("textbox", { name: "Why it can be left out" });
    fireEvent.change(reason, { target: { value: "The pump motors are rated for the room heat-up." } });
    fireEvent.blur(reason);
    expect(lastMutation().systemDependencies.find((record) => record.uuid === "DEP-CCW-HVAC")?.exclusionJustification).toBe("The pump motors are rated for the room heat-up.");
  });

  it("links a support success criterion to the systems that need it", () => {
    render(<DrawerContent context={{ kind: "ssc", id: "SSC-EPS" }} onClose={jest.fn()} />);
    const serves = screen.getByRole("group", { name: "Serves" });
    fireEvent.click(within(serves).getByRole("checkbox", { name: "Room cooling" }));
    expect(lastMutation().supportSystemSuccessCriteria?.[0]?.supportedSystems).toEqual([CCW, HVAC]);
  });

  it("adds the conditions a support need analysis covers", () => {
    render(<DrawerContent context={{ kind: "need", id: "NA-CCW" }} onClose={jest.fn()} />);
    const input = screen.getByRole("textbox", { name: "Add a condition, such as an operating state or sequence" });
    fireEvent.change(input, { target: { value: "Shutdown states" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(lastMutation().supportSystemNeedAnalyses?.[0]?.conditionsRepresented).toEqual(["Loss of room cooling at full power", "Shutdown states"]);
  });

  it("picks the affected events and initiating events of a shared condition", () => {
    render(<DrawerContent context={{ kind: "spc", id: "SPC-1" }} onClose={jest.fn()} />);
    const events = screen.getByRole("group", { name: "Events it affects in CCW" });
    expect(within(events).queryByRole("checkbox", { name: "Operator fails to restart a pump" })).not.toBeInTheDocument();
    fireEvent.click(within(events).getByRole("checkbox", { name: "Pump B fails to run" }));
    expect(lastMutation().environmentalDesignBasisConsiderations?.[0]).toMatchObject({ basicEventIds: ["PMP-A"], components: ["P-1A"] });

    fireEvent.click(within(screen.getByRole("group", { name: "Initiating events" })).getByRole("checkbox", { name: "Loss of offsite power IE-LOOP" }));
    expect(lastMutation().environmentalDesignBasisConsiderations?.[0]?.initiatingEventIds).toEqual(["IE-FLOOD", "IE-LOOP"]);

    fireEvent.click(within(screen.getByRole("group", { name: "Systems it reaches" })).getByRole("checkbox", { name: "Emergency power" }));
    expect(screen.getByRole("group", { name: "Events it affects in EPS" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Beyond environmental qualification (SY-B14)" }));
    expect(lastMutation().environmentalDesignBasisConsiderations?.[0]?.beyondQualification).toBe(true);
  });

  it("edits how long an inventory lasts and why", async () => {
    const { rerender } = render(<DrawerContent context={{ kind: "inv", id: "INV-1" }} onClose={jest.fn()} />);
    await settled();
    expect(screen.getByText("Carries the 24 h mission time")).toBeInTheDocument();
    const hours = screen.getByRole("spinbutton", { name: "Lasts (hours)" });
    fireEvent.change(hours, { target: { value: "8" } });
    fireEvent.blur(hours);
    expect(lastMutation().depletionModels?.[0]).toMatchObject({ initialQuantity: 8, consumptionRate: 1, units: "hours" });

    fireEvent.click(screen.getByRole("checkbox", { name: "Does not deplete" }));
    const steady = lastMutation();
    expect(steady.depletionModels?.[0]?.initialQuantity).toBe(0);

    mockContext = { ...mockContext, sy: steady };
    rerender(<DrawerContent context={{ kind: "inv", id: "INV-1" }} onClose={jest.fn()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Does not deplete" }));
    expect(lastMutation().depletionModels?.[0]).toMatchObject({ initialQuantity: 24, consumptionRate: 1, units: "hours" });
  });

  it("asks why actuation is modeled without detail", () => {
    render(<DrawerContent context={{ kind: "act", id: "IA-1" }} onClose={jest.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Reason required");
    fireEvent.change(screen.getByRole("combobox", { name: "Modeled in detail" }), { target: { value: "yes" } });
    expect(lastMutation().initiationActuationSystems?.[0]).toMatchObject({ detailedModeling: true, justificationForNonDetailedModeling: undefined });
  });

  it("edits digital I&C lists and the dependency search", () => {
    const { unmount } = render(<DrawerContent context={{ kind: "dic", id: "DIC-1" }} onClose={jest.fn()} />);
    const mode = screen.getByRole("textbox", { name: "Add a failure mode" });
    fireEvent.change(mode, { target: { value: "Frozen output" } });
    fireEvent.keyDown(mode, { key: "Enter" });
    expect(lastMutation().digitalInstrumentationAndControl?.[0]?.failureModes).toEqual(["Spurious stop", "Frozen output"]);
    unmount();

    render(<DrawerContent context={{ kind: "method", id: "DSM-1" }} onClose={jest.fn()} />);
    const reference = screen.getByRole("textbox", { name: "Reference" });
    fireEvent.change(reference, { target: { value: "NUREG-1860" } });
    fireEvent.blur(reference);
    expect(lastMutation().dependencySearchMethodology.reference).toBe("NUREG-1860");
  });

  it("removes records with text-only actions", () => {
    const onClose = jest.fn();
    render(<DrawerContent context={{ kind: "dep", id: "DEP-CCW-EPS" }} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove dependency" }));
    expect(onClose).toHaveBeenCalled();
    expect(lastMutation().systemDependencies.map((record) => record.uuid)).toEqual(["DEP-CCW-HVAC", "DEP-HVAC-EPS"]);
  });
});
