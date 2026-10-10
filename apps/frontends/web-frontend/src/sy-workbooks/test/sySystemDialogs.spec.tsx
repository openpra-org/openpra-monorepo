import { act, fireEvent, render, screen } from "@testing-library/react";
import type { SystemLogicModel, SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { DrawerContent } from "../syScreens2";
import type { SyLinkedInputs } from "../syWorkbookContext";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { praxisUncertainty, settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";
import { scMissionTimeOptions, scMissionTimeTable, type ScMissionTimes } from "../../sc-workbooks/scMissionTimeLinks";

jest.mock("../syWorkbookApi", () => ({
  listSyDocuments: jest.fn(() => Promise.resolve([])),
}));
jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

function hours(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value } } };
}

const SC_WORKBOOK = "sc-1";

const SC: ScMissionTimes = {
  missionTimes: [{ uuid: "MT-LOCC", eventSequenceReference: "ES-7", missionTime: hours(48), basis: "Cooling restored within 48 h.", safeStableStateAchievedWithinMissionTime: true, analysisReferences: [], implementsSrs: [] }],
  componentMissionTimes: [],
};

const SYSTEM_ID = "SYS-CCW";
const FREE_ID = "SYS-FIRE";

const TREE: SystemLogicModel = {
  uuid: "FT-CCW",
  code: "FT-CCW",
  name: "Cooling water fault tree",
  systemReference: SYSTEM_ID,
  description: "Old top event",
  modelRepresentation: "Fault tree",
  topGate: { gateId: "G1" },
  gates: [{ id: "G1", code: "G1", name: "Top", description: "", kind: "GATE", gateType: "OR" }],
  leafNodes: [],
  gateInputs: [],
  nodePositions: [],
  layout: { viewport: { x: 0, y: 0, zoom: 1 }, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" },
  implementsSrs: [],
};

function makeAnalysis(): SystemsAnalysis {
  return {
    plantStage: "PRE_OPERATIONAL",
    systemDefinitions: [
      {
        uuid: SYSTEM_ID,
        name: "Component cooling water",
        abbreviation: "CCW",
        description: "Old top event",
        boundaries: ["Two pumps"],
        successCriteriaIds: [],
        missionTime: hours(24),
        applicablePlantOperatingStates: ["POS-01"],
        alignments: [{ uuid: "align-a", name: "One pump running", systemReference: SYSTEM_ID, isNormalAlignment: true, modeled: true, implementsSrs: [] }],
        operatingProcedures: [],
        modeledComponentsAndFailures: {},
        informationBasis: "as-designed-as-intended",
        implementsSrs: [],
      },
      {
        uuid: FREE_ID,
        name: "Fire water",
        boundaries: [],
        successCriteriaIds: [],
        modeledComponentsAndFailures: {},
        informationBasis: "as-designed-as-intended",
        implementsSrs: [],
      },
    ],
    systemToSafetyFunctionMappings: [],
    systemLogicModels: [{ ...TREE }],
    systemBasicEvents: [],
    systemDependencies: [],
    componentDependencies: [],
    dependencySearchMethodology: { uuid: "dsm", name: "Dependency search", description: "", reference: "", systemsAnalyzed: [SYSTEM_ID, FREE_ID], implementsSrs: [] },
    variableSuccessCriteria: [{ uuid: "var-1", systemReference: SYSTEM_ID, plantOperatingStateId: "POS-01", successCriteriaIds: [], basis: "Both pumps", implementsSrs: [] }],
    commonCauseFailureGroups: [],
    humanFailureEventIntegrations: [],
    modelUncertainty: { uuid: "mu", name: "Model uncertainty", uncertaintySources: [], relatedAssumptions: [], reasonableAlternatives: [] },
  } as unknown as SystemsAnalysis;
}

const LINKS: SyLinkedInputs = {
  scName: "SC",
  posName: "POS",
  esName: "ES",
  scSystems: [{ id: "SSC-CCW", systemId: SYSTEM_ID, name: "Component cooling water", capacities: "Pumps: 1 of 2 · Heat removed: 4 MW", supports: [] }],
  scMissionTimeOptions: scMissionTimeOptions(SC_WORKBOOK, SC),
  scMissionTimeTable: scMissionTimeTable(SC_WORKBOOK, SC),
  posStates: [
    { id: "POS-01", name: "Full power", mode: "POWER", durationHours: 8000 },
    { id: "POS-02", name: "Cold shutdown", mode: "SHUTDOWN", durationHours: 700 },
  ],
  esSafetyFunctions: [{ id: "SF-DHR", name: "Core heat removal", supportingSystems: [] }],
  esInitiatingEvents: [],
};

const mockMutateSy = jest.fn();
let mockAnalysis = makeAnalysis();

jest.mock("../syWorkbookContext", () => ({
  useSyWorkbook: () => ({
    sy: mockAnalysis,
    links: LINKS,
    editable: true,
    mutateSy: mockMutateSy,
    shortOf: (id: string) => id,
    controlledParameters: [],
    controlledCcfVectors: [],
    controlledCcfFactors: [],
    controlledHumanFailures: [],
    controlledFailureModes: [],
    runtime: { workbookId: "sy-1", projectId: "project-1", revision: 3, saveStatus: "saved" },
  }),
}));

function applyLastMutation(): SystemsAnalysis {
  const calls = mockMutateSy.mock.calls;
  const mutator = calls[calls.length - 1]![0] as (draft: SystemsAnalysis) => SystemsAnalysis;
  return mutator(mockAnalysis);
}

function commit(element: HTMLElement, value: string): void {
  fireEvent.focus(element);
  fireEvent.change(element, { target: { value } });
  fireEvent.blur(element);
}

async function settled(): Promise<void> {
  await act(async () => {
    await settledWithPraxis(() => undefined);
  });
}

describe("SY system dialogs", () => {
  beforeEach(() => {
    mockMutateSy.mockClear();
    mockAnalysis = makeAnalysis();
    jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
  });

  it("maps a system to an ES safety function", () => {
    render(<DrawerContent context={{ kind: "system", id: FREE_ID }} onClose={jest.fn()} />);

    fireEvent.click(screen.getByRole("checkbox", { name: /SF-DHR/ }));
    expect(applyLastMutation().systemToSafetyFunctionMappings).toEqual([
      expect.objectContaining({ systemReference: FREE_ID, safetyFunctions: ["SF-DHR"] }),
    ]);
  });

  it("switches a system to a system-level model that needs a justification", () => {
    render(<DrawerContent context={{ kind: "system", id: FREE_ID }} onClose={jest.fn()} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Model depth" }), { target: { value: "SYSTEM_LEVEL" } });
    const created = applyLastMutation().systemLogicModels.find((model) => model.systemReference === FREE_ID);
    expect(created).toMatchObject({ nonDetailedModelJustification: "", topGate: null, implementsSrs: [{ sr: "SY-A9", hlr: "A" }] });
  });

  it("asks before removing a system with its fault tree and records", () => {
    const onClose = jest.fn();
    render(<DrawerContent context={{ kind: "system", id: SYSTEM_ID }} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove system" }));
    expect(screen.getByText("Removing Component cooling water also removes its fault tree and 1 other record about it.")).toBeInTheDocument();
    expect(mockMutateSy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Keep system" }));
    expect(screen.queryByRole("group", { name: "Confirm removal" })).not.toBeInTheDocument();
    expect(mockMutateSy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Remove system" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove system and records" }));
    expect(onClose).toHaveBeenCalled();
    const next = applyLastMutation();
    expect(next.systemDefinitions.map(({ uuid }) => uuid)).toEqual([FREE_ID]);
    expect(next.systemLogicModels).toEqual([]);
    expect(next.variableSuccessCriteria).toEqual([]);
    expect(next.dependencySearchMethodology.systemsAnalyzed).toEqual([FREE_ID]);
  });

  it("removes a system nothing else refers to without asking", () => {
    const onClose = jest.fn();
    render(<DrawerContent context={{ kind: "system", id: FREE_ID }} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove system" }));
    expect(onClose).toHaveBeenCalled();
    expect(applyLastMutation().systemDefinitions.map(({ uuid }) => uuid)).toEqual([SYSTEM_ID]);
  });

  it("writes the top event to the system and its fault tree", () => {
    render(<DrawerContent context={{ kind: "sysdef", id: SYSTEM_ID }} onClose={jest.fn()} />);

    commit(screen.getByRole("textbox", { name: "Top event" }), "Cooling water fails to cool the shutdown coolers");
    const next = applyLastMutation();
    expect(next.systemDefinitions[0]!.description).toBe("Cooling water fails to cool the shutdown coolers");
    expect(next.systemLogicModels[0]!.description).toBe("Cooling water fails to cool the shutdown coolers");

    commit(screen.getByRole("textbox", { name: "Value" }), "72");
    expect(applyLastMutation().systemDefinitions[0]!.missionTime).toEqual(hours(72));
  });

  it("takes the success criterion from the linked SC workbook", () => {
    render(<DrawerContent context={{ kind: "sysdef", id: SYSTEM_ID }} onClose={jest.fn()} />);

    fireEvent.change(screen.getByRole("combobox", { name: "SC record" }), { target: { value: "SSC-CCW" } });
    expect(applyLastMutation().systemDefinitions[0]).toMatchObject({ successCriteriaIds: ["SSC-CCW"], successCriterion: "Pumps: 1 of 2 · Heat removed: 4 MW" });

    fireEvent.change(screen.getByRole("combobox", { name: "SC record" }), { target: { value: "" } });
    expect(applyLastMutation().systemDefinitions[0]!.successCriteriaIds).toEqual([]);
  });

  it("fills the top event and its fault tree description from the SC record", () => {
    render(<DrawerContent context={{ kind: "sysdef", id: SYSTEM_ID }} onClose={jest.fn()} />);

    fireEvent.change(screen.getByRole("combobox", { name: "SC record" }), { target: { value: "SSC-CCW" } });
    const next = applyLastMutation();
    expect(next.systemDefinitions[0]!.description).toBe("Component cooling water fails to meet its success criterion");
    expect(next.systemLogicModels[0]!.description).toBe("Component cooling water fails to meet its success criterion");
  });

  it("links the mission time to SC and shows the PRAXIS point", async () => {
    const { rerender } = render(<DrawerContent context={{ kind: "sysdef", id: SYSTEM_ID }} onClose={jest.fn()} />);
    await settled();
    expect(screen.getByText("Point value 24 h")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Source" }), { target: { value: `${SC_WORKBOOK}:MT-LOCC` } });
    const next = applyLastMutation();
    expect(next.systemDefinitions[0]!.missionTime).toEqual({ node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: SC_WORKBOOK, entityId: "MT-LOCC" } });

    mockAnalysis = next;
    rerender(<DrawerContent context={{ kind: "sysdef", id: SYSTEM_ID }} onClose={jest.fn()} />);
    await settled();
    expect(screen.queryByRole("textbox", { name: "Value" })).not.toBeInTheDocument();
    expect(screen.getByText("Point value 48 h")).toBeInTheDocument();
  });

  it("adds and removes a typed mission time", () => {
    const { rerender } = render(<DrawerContent context={{ kind: "sysdef", id: FREE_ID }} onClose={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Add a mission time" }));
    const added = applyLastMutation().systemDefinitions[1]!.missionTime;
    expect(added).toMatchObject({ node: "VALUE", value: { unit: "HOURS", law: { family: "POINT" } } });

    mockAnalysis = applyLastMutation();
    rerender(<DrawerContent context={{ kind: "sysdef", id: FREE_ID }} onClose={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove mission time" }));
    expect(applyLastMutation().systemDefinitions[1]!.missionTime).toBeUndefined();
  });

  it("takes a variant success criterion from SC", () => {
    render(<DrawerContent context={{ kind: "variant", id: "var-1" }} onClose={jest.fn()} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Variant SC record" }), { target: { value: "SSC-CCW" } });
    expect(applyLastMutation().variableSuccessCriteria![0]).toMatchObject({ successCriteriaIds: ["SSC-CCW"], basis: "Pumps: 1 of 2 · Heat removed: 4 MW" });
  });

  it("edits and removes a success-criterion variant", () => {
    const onClose = jest.fn();
    render(<DrawerContent context={{ kind: "variant", id: "var-1" }} onClose={onClose} />);

    commit(screen.getByRole("textbox", { name: "Variant success criterion" }), "Two of two pumps at full power");
    expect(applyLastMutation().variableSuccessCriteria![0]!.basis).toBe("Two of two pumps at full power");
    fireEvent.click(screen.getByRole("button", { name: "Remove variant" }));
    expect(applyLastMutation().variableSuccessCriteria).toEqual([]);
  });

  it("asks why an alignment is not modeled", () => {
    render(<DrawerContent context={{ kind: "alignment", id: "align-a" }} onClose={jest.fn()} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Modeled in the fault tree" }));
    expect(applyLastMutation().systemDefinitions[0]!.alignments).toEqual([
      expect.objectContaining({ uuid: "align-a", modeled: false }),
    ]);
  });

  it("adds a boundary item", () => {
    render(<DrawerContent context={{ kind: "boundary", id: SYSTEM_ID }} onClose={jest.fn()} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Add boundary item" }), { target: { value: "Heat exchangers" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(applyLastMutation().systemDefinitions[0]!.boundaries).toEqual(["Two pumps", "Heat exchangers"]);
  });

  it("chooses the operating states from the linked POS workbook", () => {
    render(<DrawerContent context={{ kind: "states", id: SYSTEM_ID }} onClose={jest.fn()} />);

    fireEvent.click(screen.getByRole("checkbox", { name: /POS-02/ }));
    expect(applyLastMutation().systemDefinitions[0]!.applicablePlantOperatingStates).toEqual(["POS-01", "POS-02"]);
  });

  it("records an operating procedure", () => {
    render(<DrawerContent context={{ kind: "operations", id: SYSTEM_ID }} onClose={jest.fn()} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Add procedure" }), { target: { value: "Loss of cooling water response procedure" } });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Add procedure" }), { key: "Enter" });
    expect(applyLastMutation().systemDefinitions[0]!.operatingProcedures).toEqual(["Loss of cooling water response procedure"]);
  });
});
