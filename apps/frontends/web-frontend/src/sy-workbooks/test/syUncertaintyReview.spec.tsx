import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { UncertainExpression, UncertainParameter } from "interfaces-mef-types/core/uncertainty";
import type { SensitivityStudy } from "interfaces-mef-types/core/shared-patterns";
import { carriesUncertainExpression, type SystemBasicEvent, type SystemLogicModel } from "interfaces-mef-types/sy/systems-analysis";
import { PlantUncertainty, UncertaintyScreen } from "../SyUncertaintyReview";
import { DrawerContent } from "../syScreens2";
import { linkExampleEvents, linkExampleGroups } from "../syLinks";
import {
  coverageIssues,
  inputRows,
  runReadiness,
  studyIssues,
  uncertaintyErrors,
  withSystemAnalysis,
  type UncertaintyAnalysis,
} from "../syUncertainty";
import type { SyControlledParameterOption } from "../syWorkbookContext";

const NO_SC: ReadonlyMap<string, UncertainParameter> = new Map();

jest.mock("../SyUncertaintyAnalysis", () => ({ SyUncertaintyAnalysis: ({ selectedModelId }: { selectedModelId?: string }) => `Run for ${selectedModelId ?? "none"}` }));
jest.mock("../../newly-developed-methods/shared/analysisRunHistory", () => ({ AnalysisRunHistory: () => null }));
jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => jest.requireActual("./syUncertaintyPraxis"));

const CCW = "SYS-CCW";
const EPS = "SYS-EPS";
const GV = "SYS-GV";

type Fixture = UncertaintyAnalysis & Required<Pick<UncertaintyAnalysis, "sensitivityStudies">>;

interface MockContext {
  sy: Fixture;
  editable: boolean;
  mutateSy: jest.Mock;
  shortOf: (id: string) => string;
  controlledParameters: SyControlledParameterOption[];
  controlledCcfVectors: [];
  controlledCcfFactors: [];
  runtime: { workbookId: string; projectId: string; revision: number; saveStatus: "saved" };
}

const SHORT = new Map([[CCW, "CCW"], [EPS, "EPS"], [GV, "GV"]]);

function point(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value } } };
}

function linked(entityId: string, workbookId = "da-1"): UncertainExpression {
  return { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId, entityId } };
}

const PARAMETERS: SyControlledParameterOption[] = [
  { workbookId: "da-1", workbookName: "DA", parameterId: "DA-PMP", parameterName: "Pump fails to run", unit: "PROBABILITY", estimate: { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "BETA", alpha: 1, beta: 499, lower: 0, upper: 1 } } } },
  { workbookId: "da-1", workbookName: "DA", parameterId: "DA-HX", parameterName: "Heat exchanger fouled", unit: "PROBABILITY", estimate: point(0.001) },
  { workbookId: "da-1", workbookName: "DA", parameterId: "DA-BAT", parameterName: "Battery fails", unit: "PROBABILITY", estimate: { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "LOGNORMAL", mean: 0.004, errorFactor: 3, level: 0.95 } } } },
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
  const value = carriesUncertainExpression(failureMode) ? { expression: point(0.002) } : { probability: 0.002 };
  return { uuid, code, name, eventType: "BASIC", failureMode, ...value, implementsSrs: [], ...extra };
}

function study(uuid: string, tested: string, ranges: Record<string, [number, number]>, results?: string): SensitivityStudy {
  return { uuid, name: `Study ${uuid}`, description: "Sweep the train count.", variedParameters: Object.keys(ranges), parameterRanges: ranges, results, modelUncertaintyId: tested, implementsSrs: [] };
}

function makeAnalysis(): Fixture {
  return {
    systemDefinitions: [system(CCW, "Component cooling water"), system(EPS, "Emergency power"), system(GV, "Guard vessel")],
    systemLogicModels: [
      tree(CCW, ["PMP-A", "PMP-B", "HX-A", "CCW-TM", "CCW-HFE"]),
      tree(EPS, ["BAT-A", "BAT-B"]),
      { ...tree(GV, []), modelRepresentation: "System-level", nonDetailedModelJustification: "Passive shell.", topGate: null, gates: [], leafNodes: [], gateInputs: [] },
    ],
    systemBasicEvents: [
      event("PMP-A", "CCW-PMP-A-FR", "Pump A fails to run", "FAILURE_TO_RUN", { expression: linked("DA-PMP") }),
      event("PMP-B", "CCW-PMP-B-FR", "Pump B fails to run", "FAILURE_TO_RUN", { expression: linked("DA-PMP") }),
      event("HX-A", "CCW-HXA-PLG", "Heat exchanger A fouled", "FAILURE_TO_RUN", { expression: linked("DA-HX") }),
      event("CCW-TM", "CCW-TR-TM", "One train in maintenance", "TEST_MAINTENANCE"),
      event("CCW-HFE", "CCW-HFE", "Operator fails to restart a pump", "HUMAN_ERROR", { dataAnalysisBasicEventRef: "HR-POST-001" }),
      event("BAT-A", "EPS-BAT-A-FR", "Battery A fails", "FAILURE_TO_RUN", { expression: linked("DA-BAT") }),
      event("BAT-B", "EPS-BAT-B-FR", "Battery B fails", "FAILURE_TO_RUN"),
    ],
    commonCauseFailureGroups: [{
      uuid: "CCF-PMP",
      name: "Cooling-water pumps",
      description: "Two pumps of one make.",
      scope: "INTRASYSTEM",
      affectedComponents: ["P-A", "P-B"],
      affectedSystems: [CCW],
      factors: { model: "BETA_FACTOR", beta: { node: "VALUE", value: { unit: "FRACTION", law: { family: "POINT", value: 0.05 } } } },
      total: linked("DA-PMP"),
      members: { basicEvents: [{ id: "PMP-A" }, { id: "PMP-B" }] },
      implementsSrs: [],
    }],
    uncertaintyAnalyses: [{
      uuid: "SUA-CCW",
      system: CCW,
      propagationMethod: "MONTE_CARLO",
      modelUncertainties: [
        { uncertaintyId: "MU-1", description: "Both pumps are needed at full power.", impact: "A one-pump criterion would cut CCW failure.", isQuantified: true, treatmentApproach: "Tested in the train count study." },
        { uncertaintyId: "MU-2", description: " ", impact: "", isQuantified: false, treatmentApproach: "" },
      ],
      ccfUncertainties: [{ uncertaintyId: "CU-1", ccfGroupId: "CCF-PMP", description: "Generic beta factor of 0.05.", impact: "Stronger coupling raises the pump term." }],
      dependencyUncertainties: [
        { uncertaintyId: "DU-1", supportingSystem: EPS, description: "Power reaches both pumps through one transfer.", impact: "A single bus fault is not modeled." },
        { uncertaintyId: "DU-2", description: "Both pumps share one room.", impact: "A room flood fails both pumps." },
      ],
      implementsSrs: [{ sr: "SY-A32", hlr: "A" }, { sr: "SY-B16", hlr: "B" }],
    }],
    sensitivityStudies: [
      study("SS-1", "MU-1", { "Train count": [1, 2] }, "Two trains halve the failure paths."),
      study("SS-2", "MU-X", { "Pump beta": [0.02, 0.1] }, "Moves CCW failure by 3 percent."),
    ],
    modelUncertainty: {
      uuid: "mu-1",
      name: "Model uncertainty",
      uncertaintySources: [{ source: "Generic pump data applied to the plant pumps", impact: "Shifts every pump estimate.", applicableElements: [CCW, EPS] }],
      relatedAssumptions: [{ assumption: "", basis: "", applicableElements: [] }],
      reasonableAlternatives: [],
    },
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
    controlledCcfVectors: [],
    controlledCcfFactors: [],
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

function modelOf(sy: Fixture, systemId: string): SystemLogicModel {
  const model = sy.systemLogicModels.find((candidate) => candidate.systemReference === systemId);
  if (model === undefined) throw new Error("missing model");
  return model;
}

describe("SY Step 07 checks", () => {
  it("tells why a fault tree can or cannot run an uncertainty analysis", () => {
    const sy = makeAnalysis();
    expect(runReadiness(sy, modelOf(sy, CCW), PARAMETERS, NO_SC).state).toBe("READY");

    const unset = { ...sy, systemBasicEvents: sy.systemBasicEvents.map((item) => (item.uuid === "PMP-B" ? { ...item, expression: undefined } : item)) };
    expect(runReadiness(unset, modelOf(unset, CCW), PARAMETERS, NO_SC)).toMatchObject({ state: "NEEDS_FIX", message: "CCW-PMP-B-FR: No value yet. Set it in Step 02." });

    const split = { ...sy, systemBasicEvents: sy.systemBasicEvents.map((item) => (item.uuid === "PMP-B" ? { ...item, expression: linked("DA-BAT") } : item)) };
    const mixed = runReadiness(split, modelOf(split, CCW), PARAMETERS, NO_SC);
    expect(mixed.state).toBe("READY");
    expect(mixed.inputs.find((input) => input.event.uuid === "PMP-A")?.issues).toEqual([]);
    expect(runReadiness(sy, modelOf(sy, EPS), [], NO_SC).state).toBe("NO_INPUTS");
  });

  it("points example events at the linked DA workbook and leaves human failure references alone", () => {
    const sy = makeAnalysis();
    const hours: UncertainExpression = { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 24 } } };
    const example = {
      ...sy,
      systemBasicEvents: sy.systemBasicEvents.map((item) => {
        if (item.uuid === "PMP-B") return { ...item, expression: linked("DA-PMP", "example-da-htgr") };
        if (item.uuid === "HX-A") return { ...item, expression: { node: "MODEL" as const, model: { form: "MISSION" as const, rate: linked("DA-RUN", "example-da-htgr"), missionTime: hours } } };
        return item;
      }),
    };
    const parameters = [
      { uuid: "DA-PMP", name: "Pump", parameterType: "PROBABILITY" as const, quantificationModel: "DEMAND_PROBABILITY" as const, estimate: point(0.0021), implementsSrs: [] },
      { uuid: "DA-RUN", name: "Exchanger", parameterType: "FAILURE_RATE" as const, quantificationModel: "RUNNING_RATE" as const, estimate: { node: "VALUE" as const, value: { unit: "PER_HOUR" as const, law: { family: "POINT" as const, value: 1e-5 } } }, implementsSrs: [] },
    ];
    const events = linkExampleEvents(example, "da-example", { parameters });
    expect(events.find((item) => item.uuid === "PMP-B")?.expression).toEqual(linked("DA-PMP", "da-example"));
    expect(events.find((item) => item.uuid === "HX-A")?.expression).toEqual({ node: "MODEL", model: { form: "MISSION", rate: linked("DA-RUN", "da-example"), missionTime: hours } });
    expect(events.find((item) => item.uuid === "PMP-A")?.expression).toEqual(linked("DA-PMP", "da-example"));
    expect(events.find((item) => item.uuid === "BAT-A")?.expression).toEqual(linked("DA-BAT"));
    expect(events.find((item) => item.uuid === "BAT-B")?.expression).toEqual(point(0.002));
    expect(events.find((item) => item.uuid === "CCW-HFE")?.dataAnalysisBasicEventRef).toBe("HR-POST-001");
    expect(events.find((item) => item.uuid === "CCW-HFE")).not.toHaveProperty("expression");

    const groups = linkExampleGroups({ commonCauseFailureGroups: example.commonCauseFailureGroups.map((group) => ({ ...group, total: linked("DA-PMP", "example-da-htgr") })) }, "da-example", { parameters });
    expect(groups[0]?.total).toEqual(linked("DA-PMP", "da-example"));
    expect(linkExampleGroups({ commonCauseFailureGroups: [{ ...example.commonCauseFailureGroups[0]!, total: linked("DA-BAT", "example-da-htgr") }] }, "da-example", { parameters })[0]?.total).toEqual(linked("DA-BAT", "example-da-htgr"));
  });

  it("lists each component input with its issues", () => {
    const sy = makeAnalysis();
    const rows = inputRows(sy, CCW, PARAMETERS, NO_SC);
    expect(rows.map((row) => [row.event.uuid, row.uncertain, row.issues.map((item) => item.code)])).toEqual([
      ["PMP-A", true, []],
      ["PMP-B", true, []],
      ["HX-A", false, []],
      ["CCW-TM", false, []],
    ]);
    expect(inputRows(sy, EPS, [], NO_SC).find((row) => row.event.uuid === "BAT-A")?.issues[0]?.message).toBe("It links a value that is not in the linked DA or SC workbook.");
  });

  it("checks coverage, studies and plant-wide items", () => {
    const sy = makeAnalysis();
    expect(coverageIssues(sy, EPS).map((item) => item.code)).toEqual(["COVERAGE_MODEL"]);
    const uncovered = { ...sy, commonCauseFailureGroups: [...sy.commonCauseFailureGroups, { ...sy.commonCauseFailureGroups[0]!, uuid: "CCF-HX", name: "Heat exchangers" }] };
    expect(coverageIssues(uncovered, CCW).map((item) => item.message)).toEqual(["No uncertainty recorded for the Heat exchangers group (SY-B16)."]);
    expect(studyIssues(sy, sy.sensitivityStudies[0]!)).toEqual([]);
    expect(studyIssues(sy, sy.sensitivityStudies[1]!).map((item) => item.code)).toEqual(["STUDY_SOURCE"]);
    expect(studyIssues(sy, study("SS-3", "MU-1", { "Train count": [2, 1] })).map((item) => item.code)).toEqual(["STUDY_RANGE", "STUDY_RESULT"]);

    const errors = uncertaintyErrors(sy).map((item) => item.message);
    expect(errors).toContain("Emergency power has no model uncertainty recorded.");
    expect(errors).toContain("Say what the source is.");
    expect(errors).toContain("Pick the source it tests.");
    expect(errors).toContain("Say what is assumed.");

    const added = withSystemAnalysis(sy as Parameters<typeof withSystemAnalysis>[0], EPS, (analysis) => analysis);
    expect(added.uncertaintyAnalyses?.find((analysis) => analysis.system === EPS)).toMatchObject({ propagationMethod: "MONTE_CARLO", implementsSrs: [{ sr: "SY-A32", hlr: "A" }, { sr: "SY-B16", hlr: "B" }] });
  });
});

describe("SY Step 07 screen", () => {
  beforeEach(() => setContext());

  it("reviews one system's inputs, uncertainty sources and studies", async () => {
    const openDrawer = jest.fn();
    render(<UncertaintyScreen sysId={CCW} setSysId={jest.fn()} openDrawer={openDrawer} />);

    const inputs = screen.getByRole("table", { name: "Input values" });
    expect(within(rowOf(inputs, "CCW-PMP-A-FR")).getByText("Pump fails to run")).toBeInTheDocument();
    expect(within(rowOf(inputs, "CCW-PMP-A-FR")).getByText("Sampled in runs")).toBeInTheDocument();
    expect(within(rowOf(inputs, "CCW-HXA-PLG")).getByText("Fixed value")).toBeInTheDocument();
    await waitFor(() => expect(within(rowOf(inputs, "CCW-HXA-PLG")).getByText("1.0E-3")).toBeInTheDocument());
    expect(within(inputs).queryByText("CCW-HFE")).not.toBeInTheDocument();
    fireEvent.click(within(inputs).getByRole("button", { name: "Edit CCW-PMP-B-FR" }));
    expect(openDrawer).toHaveBeenLastCalledWith({ kind: "be", id: "PMP-B" });

    const sources = screen.getByRole("table", { name: "Model uncertainty" });
    expect(within(rowOf(sources, "Both pumps are needed")).getByText("Tested in Study SS-1")).toBeInTheDocument();
    expect(within(sources).getByText("Say what the source is.")).toHaveClass("sy-error");
    fireEvent.click(within(sources).getByRole("button", { name: "Edit source 1" }));
    expect(openDrawer).toHaveBeenLastCalledWith({ kind: "unc", id: "MU-1" });

    const coupling = screen.getByRole("table", { name: "Common cause and dependency uncertainty" });
    expect(within(rowOf(coupling, "Cooling-water pumps")).getByText("Common cause group")).toBeInTheDocument();
    expect(within(coupling).getByText("Shared space or condition")).toBeInTheDocument();
    fireEvent.click(within(coupling).getByRole("button", { name: "Edit Emergency power uncertainty" }));
    expect(openDrawer).toHaveBeenLastCalledWith({ kind: "udep", id: "DU-1" });
    fireEvent.click(within(coupling).getByRole("button", { name: "Edit Cooling-water pumps uncertainty" }));
    expect(openDrawer).toHaveBeenLastCalledWith({ kind: "uccf", id: "CU-1" });

    const studies = screen.getByRole("table", { name: "Sensitivity studies" });
    expect(within(studies).getByText("Train count: 1 to 2")).toBeInTheDocument();
    expect(within(studies).queryByText("Study SS-2")).not.toBeInTheDocument();
    fireEvent.click(within(studies).getByRole("button", { name: "Edit Study SS-1" }));
    expect(openDrawer).toHaveBeenLastCalledWith({ kind: "sens", id: "SS-1" });

    expect(screen.getByText("Run for model-SYS-CCW")).toBeInTheDocument();
  });

  it("adds records to the shown system", () => {
    const openDrawer = jest.fn();
    render(<UncertaintyScreen sysId={EPS} setSysId={jest.fn()} openDrawer={openDrawer} />);

    expect(screen.getByRole("button", { name: "Add study" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Add common cause item" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add source" }));
    const created = lastMutation().uncertaintyAnalyses?.find((analysis) => analysis.system === EPS);
    expect(created?.modelUncertainties).toHaveLength(1);
    expect(openDrawer).toHaveBeenLastCalledWith({ kind: "unc", id: created?.modelUncertainties[0]?.uncertaintyId });

    fireEvent.click(screen.getByRole("button", { name: "Add dependency item" }));
    expect(lastMutation().uncertaintyAnalyses?.find((analysis) => analysis.system === EPS)?.dependencyUncertainties).toHaveLength(1);
  });

  it("adds a common cause item and a study on a system that has sources", () => {
    const openDrawer = jest.fn();
    render(<UncertaintyScreen sysId={CCW} setSysId={jest.fn()} openDrawer={openDrawer} />);
    fireEvent.click(screen.getByRole("button", { name: "Add common cause item" }));
    const ccf = lastMutation().uncertaintyAnalyses?.[0]?.ccfUncertainties ?? [];
    expect(ccf[ccf.length - 1]).toMatchObject({ ccfGroupId: "CCF-PMP", description: "" });

    fireEvent.click(screen.getByRole("button", { name: "Add study" }));
    const studies = lastMutation().sensitivityStudies;
    expect(studies[studies.length - 1]).toMatchObject({ modelUncertaintyId: "MU-1", variedParameters: [] });
  });

  it("explains a system-level model and hides add actions from reviewers", () => {
    const { rerender } = render(<UncertaintyScreen sysId={GV} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    expect(screen.getByText("A system-level model has no basic events to sample.")).toBeInTheDocument();
    expect(screen.queryByText(/Run for/)).not.toBeInTheDocument();

    setContext(false);
    rerender(<UncertaintyScreen sysId={CCW} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    expect(screen.queryByRole("button", { name: "Add source" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View source 1" })).toBeInTheDocument();
  });
});

describe("SY Step 07 plant-wide uncertainty", () => {
  beforeEach(() => setContext());

  it("lists the plant-wide items and adds new ones", () => {
    const openDrawer = jest.fn();
    render(<PlantUncertainty openDrawer={openDrawer} />);
    const sources = screen.getByRole("table", { name: "Sources across systems" });
    expect(within(sources).getByText("CCW, EPS")).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Related assumptions" })).getByText("Say what is assumed.")).toHaveClass("sy-error");
    expect(screen.getByRole("region", { name: "Reasonable alternatives" })).toHaveTextContent("None recorded yet.");

    fireEvent.click(within(screen.getByRole("region", { name: "Sources across systems" })).getByRole("button", { name: "Add source" }));
    expect(lastMutation().modelUncertainty.uncertaintySources).toHaveLength(2);
    expect(openDrawer).toHaveBeenLastCalledWith({ kind: "puc", id: "sources:1" });
  });
});

describe("SY Step 07 dialogs", () => {
  beforeEach(() => setContext());

  it("edits a model uncertainty source and removes it with its studies", () => {
    const onClose = jest.fn();
    render(<DrawerContent context={{ kind: "unc", id: "MU-1" }} onClose={onClose} />);
    const effect = screen.getByRole("textbox", { name: "Effect on the results" });
    fireEvent.change(effect, { target: { value: "A one-pump criterion halves the failure paths." } });
    fireEvent.blur(effect);
    expect(lastMutation().uncertaintyAnalyses?.[0]?.modelUncertainties[0]?.impact).toBe("A one-pump criterion halves the failure paths.");
    fireEvent.change(screen.getByRole("combobox", { name: "Quantified" }), { target: { value: "no" } });
    expect(lastMutation().uncertaintyAnalyses?.[0]?.modelUncertainties[0]?.isQuantified).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Remove source" }));
    expect(onClose).toHaveBeenCalled();
    const after = lastMutation();
    expect(after.uncertaintyAnalyses?.[0]?.modelUncertainties.map((item) => item.uncertaintyId)).toEqual(["MU-2"]);
    expect(after.sensitivityStudies.map((item) => item.uuid)).toEqual(["SS-2"]);
  });

  it("edits common cause and dependency items", () => {
    const { unmount } = render(<DrawerContent context={{ kind: "uccf", id: "CU-1" }} onClose={jest.fn()} />);
    expect(screen.getByRole("combobox", { name: "Common cause group" })).toHaveValue("CCF-PMP");
    const source = screen.getByRole("textbox", { name: "Source" });
    fireEvent.change(source, { target: { value: "Plant-specific beta factor pending." } });
    fireEvent.blur(source);
    expect(lastMutation().uncertaintyAnalyses?.[0]?.ccfUncertainties?.[0]?.description).toBe("Plant-specific beta factor pending.");
    unmount();

    render(<DrawerContent context={{ kind: "udep", id: "DU-2" }} onClose={jest.fn()} />);
    expect(screen.getByRole("combobox", { name: "Support" })).toHaveValue("");
    fireEvent.change(screen.getByRole("combobox", { name: "Support" }), { target: { value: EPS } });
    expect(lastMutation().uncertaintyAnalyses?.[0]?.dependencyUncertainties?.[1]?.supportingSystem).toBe(EPS);
  });

  it("edits a sensitivity study's source and varied parameters", () => {
    render(<DrawerContent context={{ kind: "sens", id: "SS-1" }} onClose={jest.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Source it tests" }), { target: { value: "DU-2" } });
    expect(lastMutation().sensitivityStudies[0]?.modelUncertaintyId).toBe("DU-2");

    const high = screen.getByRole("spinbutton", { name: "Train count high" });
    fireEvent.change(high, { target: { value: "3" } });
    fireEvent.blur(high);
    expect(lastMutation().sensitivityStudies[0]?.parameterRanges).toEqual({ "Train count": [1, 3] });

    const name = screen.getByRole("textbox", { name: "Varied parameter 1" });
    fireEvent.change(name, { target: { value: "Pumps credited" } });
    fireEvent.blur(name);
    expect(lastMutation().sensitivityStudies[0]).toMatchObject({ variedParameters: ["Pumps credited"], parameterRanges: { "Pumps credited": [1, 2] } });

    const add = screen.getByRole("textbox", { name: "Add a varied parameter" });
    fireEvent.change(add, { target: { value: "Room temperature" } });
    fireEvent.keyDown(add, { key: "Enter" });
    expect(lastMutation().sensitivityStudies[0]).toMatchObject({ variedParameters: ["Train count", "Room temperature"], parameterRanges: { "Train count": [1, 2], "Room temperature": [0, 0] } });

    fireEvent.click(screen.getByRole("button", { name: "Remove varied parameter 1" }));
    expect(lastMutation().sensitivityStudies[0]).toMatchObject({ variedParameters: [], parameterRanges: {} });
  });

  it("edits and removes a plant-wide item", () => {
    const onClose = jest.fn();
    render(<DrawerContent context={{ kind: "puc", id: "sources:0" }} onClose={onClose} />);
    fireEvent.click(within(screen.getByRole("group", { name: "Applies to" })).getByRole("checkbox", { name: "Guard vessel" }));
    expect(lastMutation().modelUncertainty.uncertaintySources[0]?.applicableElements).toEqual([CCW, EPS, GV]);
    fireEvent.click(screen.getByRole("button", { name: "Remove item" }));
    expect(onClose).toHaveBeenCalled();
    expect(lastMutation().modelUncertainty.uncertaintySources).toEqual([]);
  });
});
