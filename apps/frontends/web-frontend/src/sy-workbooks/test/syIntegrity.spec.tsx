import { fireEvent, render, screen, within } from "@testing-library/react";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { carriesUncertainExpression, type SyDocumentation, type SystemBasicEvent, type SystemLogicModel } from "interfaces-mef-types/sy/systems-analysis";
import { IntegrityScreen, NamingScheme } from "../SyIntegrity";
import { DrawerContent } from "../syScreens2";
import {
  boundaryRows,
  confirmationIssues,
  designatorIssues,
  integrityErrors,
  moduleIssues,
  namingRows,
  schemeIssues,
  type IntegrityAnalysis,
} from "../syIntegrityChecks";
import type {
  SyControlledComponentBoundaryOption,
  SyControlledFailureModeOption,
  SyControlledParameterOption,
} from "../syWorkbookContext";

const CCW = "SYS-CCW";
const EPS = "SYS-EPS";
const GV = "SYS-GV";

type Fixture = IntegrityAnalysis & { documentation: Pick<SyDocumentation, "nomenclatureConventions"> };

interface MockContext {
  sy: Fixture;
  editable: boolean;
  mutateSy: jest.Mock;
  shortOf: (id: string) => string;
  controlledParameters: SyControlledParameterOption[];
  controlledComponentBoundaries: SyControlledComponentBoundaryOption[];
  controlledFailureModes: SyControlledFailureModeOption[];
  runtime: { workbookId: string; projectId: string; revision: number; saveStatus: "saved" };
}

const SHORT = new Map([[CCW, "CCW"], [EPS, "EPS"], [GV, "GV"]]);

function point(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value } } };
}

function linked(entityId: string): UncertainExpression {
  return { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId } };
}

const PARAMETERS: SyControlledParameterOption[] = [
  { workbookId: "da-1", workbookName: "DA", parameterId: "DA-PMP", parameterName: "Pump fails to run", unit: "PROBABILITY", estimate: point(0.006), failureModeId: "FM-FTR", failureModeName: "Fails to run", componentBoundaryId: "CB-PMP" },
  { workbookId: "da-1", workbookName: "DA", parameterId: "DA-HX", parameterName: "Heat exchanger fouled", unit: "PROBABILITY", estimate: point(0.002), failureModeId: "FM-PLG", failureModeName: "Plugged or fouled" },
  { workbookId: "da-1", workbookName: "DA", parameterId: "DA-VLV", parameterName: "Valve fails to open", unit: "PROBABILITY", estimate: point(0.001), failureModeId: "FM-FTO", failureModeName: "Fails to open", componentBoundaryId: "CB-VLV" },
  { workbookId: "da-1", workbookName: "DA", parameterId: "DA-BAT", parameterName: "Battery fails", unit: "PROBABILITY", estimate: point(0.004), failureModeId: "FM-FTR", failureModeName: "Fails to run", componentBoundaryId: "CB-BAT" },
];

const BOUNDARIES: SyControlledComponentBoundaryOption[] = [
  { workbookId: "da-1", workbookName: "DA", boundaryId: "CB-PMP", name: "Cooling-water pump", systemId: CCW, description: "", includedItems: ["Pump and motor", "Local breaker"], excludedItems: ["Heat exchanger"], boundaryBasis: "Industry pump boundary." },
  { workbookId: "da-1", workbookName: "DA", boundaryId: "CB-VLV", name: "Discharge valve", systemId: CCW, description: "", includedItems: ["Valve and operator"], excludedItems: [], boundaryBasis: "Industry valve boundary." },
  { workbookId: "da-1", workbookName: "DA", boundaryId: "CB-BAT", name: "Battery bank", systemId: EPS, description: "", includedItems: ["Battery cells"], excludedItems: [], boundaryBasis: "Industry battery boundary." },
];

const FAILURE_MODES: SyControlledFailureModeOption[] = [
  { workbookId: "da-1", workbookName: "DA", failureModeId: "FM-FTR", name: "Fails to run" },
  { workbookId: "da-1", workbookName: "DA", failureModeId: "FM-FTO", name: "Fails to open" },
  { workbookId: "da-1", workbookName: "DA", failureModeId: "FM-FTC", name: "Fails to close" },
  { workbookId: "da-1", workbookName: "DA", failureModeId: "FM-PLG", name: "Plugged or fouled" },
];

function tree(systemReference: string, events: readonly string[]): SystemLogicModel {
  const top = `${systemReference}-top`;
  const leaves = events.map((id) => ({ id: `${systemReference}-${id}`, kind: "BASIC_EVENT_REFERENCE" as const, basicEventId: id }));
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

function system(uuid: string, name: string) {
  return { uuid, name, abbreviation: SHORT.get(uuid), boundaries: [], successCriteriaIds: [], missionTime: { node: "VALUE" as const, value: { unit: "HOURS" as const, law: { family: "POINT" as const, value: 24 } } }, modeledComponentsAndFailures: {}, informationBasis: "as-designed-as-intended" as const, implementsSrs: [] };
}

function event(uuid: string, code: string, name: string, failureMode: string, extra: Partial<SystemBasicEvent> = {}): SystemBasicEvent {
  const value = carriesUncertainExpression(failureMode) ? { expression: point(0.001) } : { probability: 0.001 };
  return { uuid, code, name, eventType: "BASIC", failureMode, ...value, implementsSrs: [], ...extra };
}

function makeAnalysis(): Fixture {
  return {
    plantStage: "PRE_OPERATIONAL",
    capabilityCategory: "CC-II",
    systemDefinitions: [system(CCW, "Component cooling water"), system(EPS, "Emergency power"), system(GV, "Guard vessel")],
    systemLogicModels: [
      tree(CCW, ["PMP-A", "PMP-B", "HX-A", "VLV", "STR", "CCW-HFE", "CCW-TM"]),
      tree(EPS, ["BAT-A", "BAT-B", "PMP-A"]),
      { ...tree(GV, []), modelRepresentation: "System-level", nonDetailedModelJustification: "Passive shell.", topGate: null, gates: [], leafNodes: [], gateInputs: [] },
    ],
    systemBasicEvents: [
      event("PMP-A", "CCW-PMP-A-FR", "Pump A fails to run", "FAILURE_TO_RUN", { expression: linked("DA-PMP") }),
      event("PMP-B", "CCW-PMP-B-FR", "Pump B fails to run", "FAILURE_TO_RUN", { expression: linked("DA-PMP") }),
      event("HX-A", "CCW-HXA-BLK", "Heat exchanger A fouled", "FAILURE_TO_RUN", { expression: linked("DA-HX") }),
      event("VLV", "CCW-VLV-FC", "Discharge valve fails to open", "FAILURE_TO_START", { expression: linked("DA-VLV") }),
      event("STR", "CCW-STR-PLG", "Strainer plugged", "FAILURE_TO_RUN"),
      event("CCW-HFE", "CCW-HFE", "Operator fails to restart a pump", "HUMAN_ERROR"),
      event("CCW-TM", "CCW-TR-TM", "One train in maintenance", "TEST_MAINTENANCE"),
      event("BAT-A", "EPS-BAT-A-FR", "Battery A fails", "FAILURE_TO_RUN", { expression: linked("DA-BAT") }),
      event("BAT-B", "DC-BAT-B-FR", "Battery B fails", "FAILURE_TO_RUN", { expression: linked("DA-BAT") }),
    ],
    systemConfirmationRecords: [{ uuid: "CR-CCW", systemReference: CCW, method: "DESIGN_REVIEW", date: "2026-09-01", personnelRoles: ["Systems engineer"], findings: "Matches the drawings.", implementsSrs: [{ sr: "SY-A6", hlr: "A" }] }],
    modelValidations: [{
      uuid: "LOD-CCW",
      name: "Level of detail",
      description: "Two pump trains with their heat exchangers.",
      systemReference: CCW,
      techniques: ["Compared with the cooling-water design description"],
      results: "Component-level detail matches the data.",
      issuesIdentified: ["Pump room cooling not modeled yet"],
      implementsSrs: [{ sr: "SY-A9", hlr: "A" }, { sr: "SY-A11", hlr: "A" }],
    }],
    componentBoundaryReviews: [
      { uuid: "CBR-PMP", systemReference: CCW, componentBoundaryRef: "CB-PMP", status: "MATCHES", implementsSrs: [{ sr: "SY-A12", hlr: "A" }] },
      { uuid: "CBR-VLV", systemReference: CCW, componentBoundaryRef: "CB-VLV", status: "OPEN", implementsSrs: [{ sr: "SY-A12", hlr: "A" }] },
      { uuid: "CBR-OLD", systemReference: CCW, componentBoundaryRef: "CB-OLD", status: "NOT_VERIFIED", note: "Old strainer boundary.", implementsSrs: [{ sr: "SY-A12", hlr: "A" }, { sr: "SY-A13", hlr: "A" }] },
    ],
    modularizationRecords: [{
      uuid: "MOD-CCW",
      moduleId: "Pump train",
      systemReference: CCW,
      representedComponentIds: ["Pump", "Motor"],
      basicEventIds: ["PMP-A", "PMP-B"],
      avoidsMixedRecoveryPotential: true,
      avoidsEventsRequiredByOtherSystems: true,
      justification: "Each train is restored as one unit.",
      implementsSrs: [{ sr: "SY-A14", hlr: "A" }],
    }],
    nomenclatureDesignators: [
      { uuid: "NOM-CCW", designator: "CCW", kind: "SYSTEM", meaning: "Component cooling water", systemReference: CCW },
      { uuid: "NOM-EPS", designator: "EPS", kind: "SYSTEM", meaning: "Emergency power", systemReference: EPS },
      { uuid: "NOM-FR", designator: "FR", kind: "FAILURE_MODE", meaning: "Fails to run", failureModeRefs: ["FM-FTR"] },
      { uuid: "NOM-FC", designator: "FC", kind: "FAILURE_MODE", meaning: "Fails to close", failureModeRefs: ["FM-FTC"] },
      { uuid: "NOM-PLG", designator: "PLG", kind: "FAILURE_MODE", meaning: "Plugged or fouled", failureModeRefs: ["FM-PLG"] },
      { uuid: "NOM-HFE", designator: "HFE", kind: "EVENT_TYPE", meaning: "Human failure event", eventType: "HUMAN_ERROR" },
      { uuid: "NOM-TM", designator: "TM", kind: "EVENT_TYPE", meaning: "Out of service for test or maintenance", eventType: "TEST_MAINTENANCE" },
    ],
    documentation: { nomenclatureConventions: "Codes read system, component and failure mode." },
  };
}

let mockContext: MockContext;

jest.mock("../syWorkbookContext", () => ({
  useSyWorkbook: () => mockContext,
}));

function setContext(editable = true, sy: Fixture = makeAnalysis()): void {
  mockContext = {
    sy,
    editable,
    mutateSy: jest.fn(),
    shortOf: (id) => SHORT.get(id) ?? id,
    controlledParameters: PARAMETERS,
    controlledComponentBoundaries: BOUNDARIES,
    controlledFailureModes: FAILURE_MODES,
    runtime: { workbookId: "sy-1", projectId: "project-1", revision: 3, saveStatus: "saved" },
  };
}

function lastMutation(): Fixture {
  const calls = mockContext.mutateSy.mock.calls;
  const mutator = calls[calls.length - 1]![0] as (draft: Fixture) => Fixture;
  return mutator(mockContext.sy);
}

function rowOf(table: HTMLElement, text: string): HTMLElement {
  const row = within(table).getAllByRole("row").find((candidate) => candidate.textContent?.includes(text) === true);
  if (row === undefined) throw new Error(`No row with ${text}`);
  return row;
}

function codes(items: readonly { code: string }[]): string[] {
  return items.map((item) => item.code);
}

describe("SY Step 06 checks", () => {
  it("groups component events by their DA boundary and flags what is missing", () => {
    const sy = makeAnalysis();
    const rows = boundaryRows(sy, CCW, PARAMETERS, BOUNDARIES);
    const byKey = new Map(rows.map((row) => [row.key, row]));
    expect(byKey.get("boundary:da-1:CB-PMP")?.events.map((item) => item.uuid)).toEqual(["PMP-A", "PMP-B"]);
    expect(byKey.get("boundary:da-1:CB-PMP")?.issues).toEqual([]);
    expect(codes(byKey.get("boundary:da-1:CB-VLV")?.issues ?? [])).toEqual(["BOUNDARY_OPEN", "BOUNDARY_NOTE"]);
    expect(byKey.get("parameter:da-1:DA-HX")?.issues[0]?.message).toBe("DA has no component boundary for Heat exchanger fouled.");
    expect(codes(byKey.get("review:CBR-OLD")?.issues ?? [])).toEqual(["BOUNDARY_UNUSED"]);
    expect(byKey.get("unlinked")?.events.map((item) => item.uuid)).toEqual(["STR"]);
    expect(boundaryRows(sy, EPS, PARAMETERS, BOUNDARIES)[0]?.issues[0]?.message).toBe("Not reviewed against the data boundary yet.");

    const operational = { ...sy, plantStage: "OPERATIONAL" as const, componentBoundaryReviews: [{ uuid: "CBR-PMP", systemReference: CCW, componentBoundaryRef: "CB-PMP", status: "NOT_VERIFIED" as const, note: "No plant data.", implementsSrs: [] }] };
    expect(codes(boundaryRows(operational, CCW, PARAMETERS, BOUNDARIES)[0]?.issues ?? [])).toEqual(["BOUNDARY_VERIFY"]);
    expect(boundaryRows(sy, CCW, [], []).map((row) => row.key)).toEqual(["review:CBR-PMP", "review:CBR-VLV", "review:CBR-OLD"]);
  });

  it("checks each event code against the naming scheme and the DA failure mode", () => {
    const sy = makeAnalysis();
    const issues = new Map(namingRows(sy, CCW, PARAMETERS).map((row) => [row.event.uuid, codes(row.issues)]));
    expect(issues.get("PMP-A")).toEqual([]);
    expect(issues.get("HX-A")).toEqual(["NAME_MODE"]);
    expect(issues.get("VLV")).toEqual(["NAME_DATA"]);
    expect(issues.get("CCW-HFE")).toEqual([]);
    expect(issues.get("CCW-TM")).toEqual([]);
    expect(namingRows(sy, CCW, PARAMETERS).find((row) => row.event.uuid === "VLV")?.issues[0]?.message).toBe("FC means fails to close, but its DA estimate is fails to open.");
    expect(namingRows(sy, EPS, PARAMETERS).find((row) => row.event.uuid === "BAT-B")?.issues[0]?.message).toBe("Starts with DC, not the system code EPS.");

    const broken = {
      ...sy,
      systemBasicEvents: sy.systemBasicEvents.map((item) => (item.uuid === "CCW-HFE" ? { ...item, code: "CCW-OPER-RST" } : item.uuid === "CCW-TM" ? { ...item, code: "CCW-TM-TRAIN" } : item.uuid === "STR" ? { ...item, code: "CCW-PMP-A-FR" } : item)),
    };
    const brokenIssues = new Map(namingRows(broken, CCW, PARAMETERS).map((row) => [row.event.uuid, row.issues.map((item) => item.message)]));
    expect(brokenIssues.get("CCW-HFE")).toEqual(["Should carry HFE."]);
    expect(brokenIssues.get("CCW-TM")).toEqual(["Should end in TM."]);
    expect(brokenIssues.get("STR")).toEqual(["Same code as Pump A fails to run."]);
  });

  it("keeps one designator per failure mode and one code per system", () => {
    const sy = makeAnalysis();
    const names = new Map(FAILURE_MODES.map((mode) => [mode.failureModeId, mode.name]));
    const doubled = {
      ...sy,
      nomenclatureDesignators: [
        ...(sy.nomenclatureDesignators ?? []),
        { uuid: "NOM-RUN", designator: "RUN", kind: "FAILURE_MODE" as const, meaning: "Runs out", failureModeRefs: ["FM-FTR"] },
        { uuid: "NOM-CW", designator: "CW", kind: "SYSTEM" as const, meaning: "Cooling water", systemReference: CCW },
        { uuid: "NOM-BAD", designator: "F-S", kind: "FAILURE_MODE" as const, meaning: "", failureModeRefs: [] },
      ],
    };
    const find = (uuid: string) => {
      const designator = doubled.nomenclatureDesignators.find((candidate) => candidate.uuid === uuid);
      if (designator === undefined) throw new Error("missing designator");
      return designator;
    };
    expect(designatorIssues(doubled, find("NOM-RUN"), names).map((item) => item.message)).toEqual(["Fails to run also carries FR. One failure mode takes one designator."]);
    expect(designatorIssues(doubled, find("NOM-CW"), names).map((item) => item.message)).toEqual(["Component cooling water also has the code CCW."]);
    expect(codes(designatorIssues(doubled, find("NOM-BAD"), names))).toEqual(["DESIGNATOR_HYPHEN", "DESIGNATOR_MEANING", "DESIGNATOR_MODES"]);
    expect(designatorIssues(sy, find("NOM-FR"), names)).toEqual([]);

    const noHuman = { ...sy, nomenclatureDesignators: (sy.nomenclatureDesignators ?? []).filter((designator) => designator.uuid !== "NOM-HFE") };
    expect(schemeIssues(noHuman).map((item) => item.message)).toEqual(["No designator for human failure events."]);
  });

  it("checks supercomponents against recovery potential and shared use", () => {
    const sy = makeAnalysis();
    const record = sy.modularizationRecords?.[0];
    if (record === undefined) throw new Error("missing module");
    expect(moduleIssues(sy, record).map((item) => item.message)).toEqual(["CCW-PMP-A-FR is also in the Emergency power fault tree."]);
    expect(codes(moduleIssues(sy, { ...record, basicEventIds: ["PMP-B"], avoidsMixedRecoveryPotential: false, justification: " " }))).toEqual(["MODULE_RECOVERY", "MODULE_BASIS"]);
  });

  it("asks for plant confirmation that fits the stage and category", () => {
    const sy = makeAnalysis();
    expect(confirmationIssues(sy, EPS).map((item) => item.message)).toEqual(["Not confirmed against the plant yet."]);
    expect(confirmationIssues(sy, CCW)).toEqual([]);
    const operational = { ...sy, plantStage: "OPERATIONAL" as const };
    expect(codes(confirmationIssues(operational, CCW))).toEqual(["CONFIRM_STAFF", "CONFIRM_WALKDOWN"]);
    const walked = { ...operational, systemConfirmationRecords: [{ uuid: "CR-W", systemReference: CCW, method: "WALKDOWN" as const, date: "2026-09-02", personnelRoles: ["Operator"], findings: "As built.", implementsSrs: [] }] };
    expect(confirmationIssues(walked, CCW)).toEqual([]);
  });

  it("counts only errors toward the step being complete", () => {
    const messages = integrityErrors(makeAnalysis()).map((item) => item.message);
    expect(messages).toContain("Emergency power is not confirmed against the plant.");
    expect(messages).toContain("Guard vessel has no level of detail record.");
    expect(messages).toContain("BLK is not a failure mode designator.");
    expect(messages).toContain("What differs is not recorded.");
    expect(messages).not.toContain("Not reviewed against the data boundary yet.");
  });
});

describe("SY Step 06 screen", () => {
  beforeEach(() => setContext());

  it("reviews one system's confirmation, detail, boundaries, supercomponents and naming", () => {
    const openDrawer = jest.fn();
    render(<IntegrityScreen sysId={CCW} setSysId={jest.fn()} openDrawer={openDrawer} />);

    const confirmation = screen.getByRole("table", { name: "Confirmation against the plant" });
    expect(within(confirmation).getByText("Systems engineer")).toBeInTheDocument();
    fireEvent.click(within(confirmation).getByRole("button", { name: "Edit Design review record" }));
    expect(openDrawer).toHaveBeenLastCalledWith({ kind: "confirm", id: "CR-CCW" });

    const detail = screen.getByRole("table", { name: "Level of detail" });
    expect(within(detail).getByText("Open: Pump room cooling not modeled yet")).toHaveClass("sy-warn");
    fireEvent.click(within(detail).getByRole("button", { name: "Edit level of detail review 1" }));
    expect(openDrawer).toHaveBeenLastCalledWith({ kind: "detail", id: "LOD-CCW" });

    const bounds = screen.getByRole("table", { name: "Component boundaries" });
    const pump = rowOf(bounds, "Cooling-water pump");
    expect(within(pump).getByText("CCW-PMP-A-FR, CCW-PMP-B-FR")).toBeInTheDocument();
    expect(within(pump).getByText("Includes: Pump and motor, Local breaker")).toBeInTheDocument();
    expect(within(pump).getByText("Matches the data")).toBeInTheDocument();
    expect(within(rowOf(bounds, "Discharge valve")).getByText("What differs is not recorded.")).toHaveClass("sy-error");
    expect(within(rowOf(bounds, "CCW-STR-PLG")).queryByRole("button")).not.toBeInTheDocument();
    fireEvent.click(within(pump).getByRole("button", { name: "Edit Cooling-water pump review" }));
    expect(openDrawer).toHaveBeenLastCalledWith({ kind: "cbound", id: "CBR-PMP" });

    const modules = screen.getByRole("table", { name: "Supercomponents" });
    expect(within(modules).getByText("CCW-PMP-A-FR is also in the Emergency power fault tree.")).toHaveClass("sy-error");
    fireEvent.click(within(modules).getByRole("button", { name: "Edit Pump train" }));
    expect(openDrawer).toHaveBeenLastCalledWith({ kind: "module", id: "MOD-CCW" });

    const naming = screen.getByRole("table", { name: "Naming" });
    expect(within(naming).queryByText("CCW-PMP-A-FR")).not.toBeInTheDocument();
    expect(within(rowOf(naming, "CCW-HXA-BLK")).getByText("BLK is not a failure mode designator.")).toHaveClass("sy-error");
    fireEvent.click(within(naming).getByRole("button", { name: "Edit CCW-VLV-FC" }));
    expect(openDrawer).toHaveBeenLastCalledWith({ kind: "be", id: "VLV" });
  });

  it("creates a review when an unreviewed boundary is opened and adds records for the shown system", () => {
    const openDrawer = jest.fn();
    render(<IntegrityScreen sysId={EPS} setSysId={jest.fn()} openDrawer={openDrawer} />);

    expect(screen.getByText("Not confirmed against the design intent yet.")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("table", { name: "Component boundaries" })).getByRole("button", { name: "Edit Battery bank review" }));
    const reviews = lastMutation().componentBoundaryReviews ?? [];
    expect(reviews[reviews.length - 1]).toMatchObject({ systemReference: EPS, componentBoundaryRef: "CB-BAT", status: "MATCHES" });
    expect(openDrawer).toHaveBeenLastCalledWith({ kind: "cbound", id: reviews[reviews.length - 1]?.uuid });

    fireEvent.click(screen.getByRole("button", { name: "Add record" }));
    const records = lastMutation().systemConfirmationRecords ?? [];
    expect(records[records.length - 1]).toMatchObject({ systemReference: EPS, method: "DESIGN_REVIEW", implementsSrs: [{ sr: "SY-A6", hlr: "A" }] });

    fireEvent.click(screen.getByRole("button", { name: "Add review" }));
    const details = lastMutation().modelValidations ?? [];
    expect(details[details.length - 1]).toMatchObject({ systemReference: EPS, implementsSrs: [{ sr: "SY-A9", hlr: "A" }, { sr: "SY-A11", hlr: "A" }] });

    fireEvent.click(screen.getByRole("button", { name: "Add supercomponent" }));
    const modules = lastMutation().modularizationRecords ?? [];
    expect(modules[modules.length - 1]).toMatchObject({ systemReference: EPS, basicEventIds: [], implementsSrs: [{ sr: "SY-A14", hlr: "A" }] });
  });

  it("explains a system-level model and hides add actions from reviewers", () => {
    const { rerender } = render(<IntegrityScreen sysId={GV} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    expect(screen.getByText("This system has a system-level model, so it has no component boundaries to check.")).toBeInTheDocument();
    expect(screen.getByText("A system-level model has no supercomponents.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add supercomponent" })).not.toBeInTheDocument();

    setContext(false);
    rerender(<IntegrityScreen sysId={CCW} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    expect(screen.queryByRole("button", { name: "Add record" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View Design review record" })).toBeInTheDocument();
  });
});

describe("SY Step 06 naming scheme", () => {
  beforeEach(() => setContext());

  it("lists the codes and designators and adds new ones", () => {
    const openDrawer = jest.fn();
    render(<NamingScheme openDrawer={openDrawer} />);

    expect(screen.getByText("Codes read system, component and failure mode.")).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "System codes" })).getByText("Emergency power")).toBeInTheDocument();
    const modes = screen.getByRole("table", { name: "Failure mode designators" });
    expect(within(rowOf(modes, "PLG")).getByText("Plugged or fouled", { selector: "span" })).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Event type designators" })).getByText("Out of service for test or maintenance")).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("region", { name: "Failure mode designators" })).getByRole("button", { name: "Add designator" }));
    const designators = lastMutation().nomenclatureDesignators ?? [];
    expect(designators[designators.length - 1]).toMatchObject({ kind: "FAILURE_MODE", designator: "", failureModeRefs: [] });
    expect(openDrawer).toHaveBeenLastCalledWith({ kind: "naming", id: designators[designators.length - 1]?.uuid });

    fireEvent.click(screen.getByRole("button", { name: "Edit naming convention" }));
    expect(openDrawer).toHaveBeenLastCalledWith({ kind: "convention", id: "convention" });
  });
});

describe("SY Step 06 dialogs", () => {
  beforeEach(() => setContext());

  it("records how a system was confirmed and who took part", () => {
    const onClose = jest.fn();
    render(<DrawerContent context={{ kind: "confirm", id: "CR-CCW" }} onClose={onClose} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Method" }), { target: { value: "DISCUSSIONS" } });
    expect(lastMutation().systemConfirmationRecords?.[0]?.method).toBe("DISCUSSIONS");

    const role = screen.getByRole("textbox", { name: "Add a role, such as systems analyst or plant operator" });
    fireEvent.change(role, { target: { value: "Designer" } });
    fireEvent.keyDown(role, { key: "Enter" });
    expect(lastMutation().systemConfirmationRecords?.[0]?.personnelRoles).toEqual(["Systems engineer", "Designer"]);

    fireEvent.click(screen.getByRole("button", { name: "Remove record" }));
    expect(onClose).toHaveBeenCalled();
    expect(lastMutation().systemConfirmationRecords).toEqual([]);
  });

  it("reviews a component boundary against the data", () => {
    render(<DrawerContent context={{ kind: "cbound", id: "CBR-VLV" }} onClose={jest.fn()} />);
    expect(screen.getByText("CCW-VLV-FC · Discharge valve fails to open")).toBeInTheDocument();
    expect(screen.getByText("Valve and operator")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Setup problems" })).toHaveTextContent("What differs is not recorded.");

    fireEvent.change(screen.getByRole("combobox", { name: "Review" }), { target: { value: "NOT_VERIFIED" } });
    expect(lastMutation().componentBoundaryReviews?.find((review) => review.uuid === "CBR-VLV")).toMatchObject({
      status: "NOT_VERIFIED",
      implementsSrs: [{ sr: "SY-A12", hlr: "A" }, { sr: "SY-A13", hlr: "A" }],
    });

    const note = screen.getByRole("textbox", { name: "What differs" });
    fireEvent.change(note, { target: { value: "The model adds the actuator breaker." } });
    fireEvent.blur(note);
    expect(lastMutation().componentBoundaryReviews?.find((review) => review.uuid === "CBR-VLV")?.note).toBe("The model adds the actuator breaker.");
  });

  it("picks the events a supercomponent stands for and records its SY-A14 checks", () => {
    render(<DrawerContent context={{ kind: "module", id: "MOD-CCW" }} onClose={jest.fn()} />);
    const events = screen.getByRole("group", { name: "Events that stand for it" });
    expect(within(events).queryByRole("checkbox", { name: "CCW-HFE" })).not.toBeInTheDocument();
    fireEvent.click(within(events).getByRole("checkbox", { name: "CCW-PMP-A-FR" }));
    expect(lastMutation().modularizationRecords?.[0]?.basicEventIds).toEqual(["PMP-B"]);

    fireEvent.click(screen.getByRole("checkbox", { name: "Its components share one recovery potential" }));
    expect(lastMutation().modularizationRecords?.[0]?.avoidsMixedRecoveryPotential).toBe(false);
  });

  it("edits designators with their DA failure modes and systems", () => {
    const { unmount } = render(<DrawerContent context={{ kind: "naming", id: "NOM-FC" }} onClose={jest.fn()} />);
    fireEvent.click(within(screen.getByRole("group", { name: "DA failure modes" })).getByRole("checkbox", { name: "Fails to open" }));
    expect(lastMutation().nomenclatureDesignators?.find((designator) => designator.uuid === "NOM-FC")?.failureModeRefs).toEqual(["FM-FTC", "FM-FTO"]);
    const code = screen.getByRole("textbox", { name: "Designator" });
    fireEvent.change(code, { target: { value: " fcl " } });
    fireEvent.blur(code);
    expect(lastMutation().nomenclatureDesignators?.find((designator) => designator.uuid === "NOM-FC")?.designator).toBe("FCL");
    unmount();

    render(<DrawerContent context={{ kind: "naming", id: "NOM-EPS" }} onClose={jest.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "System" }), { target: { value: GV } });
    expect(lastMutation().nomenclatureDesignators?.find((designator) => designator.uuid === "NOM-EPS")).toMatchObject({ systemReference: GV, meaning: "Guard vessel" });
  });

  it("edits the naming convention and the level of detail checks", () => {
    const { unmount } = render(<DrawerContent context={{ kind: "convention", id: "convention" }} onClose={jest.fn()} />);
    const convention = screen.getByRole("textbox", { name: "How event codes are built" });
    fireEvent.change(convention, { target: { value: "System, component, mode." } });
    fireEvent.blur(convention);
    expect(lastMutation().documentation.nomenclatureConventions).toBe("System, component, mode.");
    unmount();

    render(<DrawerContent context={{ kind: "detail", id: "LOD-CCW" }} onClose={jest.fn()} />);
    const check = screen.getByRole("textbox", { name: "Add a check, such as a design document or a cut set review" });
    fireEvent.change(check, { target: { value: "Dominant cut set review" } });
    fireEvent.keyDown(check, { key: "Enter" });
    expect(lastMutation().modelValidations?.[0]?.techniques).toEqual(["Compared with the cooling-water design description", "Dominant cut set review"]);
  });
});
