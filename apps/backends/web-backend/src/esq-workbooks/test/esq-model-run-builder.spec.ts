import type { EsqCell, EsqLogic, EsqModel, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { SystemBasicEvent, SystemLogicModel, SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type { FaultTreeGate, FaultTreeGateInput, FaultTreeLeafNode } from "interfaces-mef-types/modeling/fault-tree";
import type { Law, UncertainExpression, UncertainParameter, UncertainUnit } from "interfaces-mef-types/core/uncertainty";
import { legacyExpression } from "interfaces-mef-types/core/legacy-uncertainty-adapter";
import { esqEndStateRunId, esqFunctionRunId, esqSequenceRunId, esqTreeRunId } from "interfaces-mef-types/esq/esq-run-inputs";
import { esqIndependentEventId, esqJointEventId, esqRecoveryEventId } from "interfaces-mef-types/esq/esq-post-inputs";
import type { EsqEventTreeRunLogic } from "interfaces-shared-types/newly-developed-methods";
import { FrequencyUnit } from "interfaces-mef-types/core/events";
import { createBlankEsq } from "../blank-esq";
import { createBlankSy } from "../../sy-workbooks/blank-sy";
import { buildEsqEventTreeRun, EsqRunBuildError, type EsqRunBuild } from "../esq-model-run-builder";
import { caseOverridesFor, sampledBuild, type EsqSamplingTally } from "../esq-measure-run-builder";
import { sampledInputsOf } from "interfaces-mef-types/esq/esq-measure-inputs";

const FT_A = "1a000000-0000-4000-8000-000000000001";
const FT_B = "1b000000-0000-4000-8000-000000000002";
const FT_C = "1c000000-0000-4000-8000-000000000003";
const E1 = "e1000000-0000-4000-8000-000000000001";
const E2 = "e2000000-0000-4000-8000-000000000002";
const E3 = "e3000000-0000-4000-8000-000000000003";
const P2 = "p2000000-0000-4000-8000-000000000002";
const P3 = "p3000000-0000-4000-8000-000000000003";
const P4 = "p4000000-0000-4000-8000-000000000004";
const P5 = "p5000000-0000-4000-8000-000000000005";
const P6 = "p6000000-0000-4000-8000-000000000006";
const DA = "da-1";
const SC = "sc-1";
const MT = "mt-1";

const AS_SET: EsqEventTreeRunLogic = { flags: true, loopBreaks: "AS_SET", exclusions: true, expandCcf: true };

function lawValue(unit: UncertainUnit, law: Law): UncertainExpression {
  return { node: "VALUE", value: { unit, law } };
}

function point(unit: UncertainUnit, value: number): UncertainExpression {
  return lawValue(unit, { family: "POINT", value });
}

function parameter(entityId: string, workbookId: string = DA): UncertainExpression {
  return { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId, entityId } };
}

function mission(rate: UncertainExpression, hours: number): UncertainExpression {
  return { node: "MODEL", model: { form: "MISSION", rate, missionTime: point("HOURS", hours) } };
}

function estimateOf(entityId: string, expression: UncertainExpression): UncertainParameter {
  return { reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: DA, entityId }, expression };
}

const START_ESTIMATE = lawValue("PROBABILITY", { family: "BETA", alpha: 0.5, beta: 9.5, lower: 0, upper: 1 });
const RUN_ESTIMATE = lawValue("PER_HOUR", { family: "GAMMA", shape: 0.5, rate: 250 });
const GENERIC_RUN_ESTIMATE = lawValue("PER_HOUR", { family: "LOGNORMAL", mean: 3e-3, errorFactor: 5, level: 0.95 });

function gate(id: string, gateType: "AND" | "OR"): FaultTreeGate {
  return { id, kind: "GATE", gateType, code: id.toUpperCase(), name: id, description: "" };
}

function eventLeaf(id: string, basicEventId: string): FaultTreeLeafNode {
  return { id, kind: "BASIC_EVENT_REFERENCE", basicEventId };
}

function transferLeaf(id: string, modelId: string, entityId: string): FaultTreeLeafNode {
  return { id, kind: "TRANSFER_REFERENCE", code: id.toUpperCase(), name: id, description: "", target: { modelId, entityId } };
}

function inputs(gateId: string, children: string[]): FaultTreeGateInput[] {
  return children.map((childId, order) => ({ id: `${gateId}:${childId}`, gateId, childId, order }));
}

function logicModel(uuid: string, code: string, topGateId: string, gates: FaultTreeGate[], leafNodes: FaultTreeLeafNode[], gateInputs: FaultTreeGateInput[]): SystemLogicModel {
  return {
    uuid,
    code,
    name: code,
    systemReference: `system-${code}`,
    description: "",
    modelRepresentation: "Fault tree",
    topGate: { gateId: topGateId },
    gates,
    leafNodes,
    gateInputs,
    nodePositions: [],
    layout: { viewport: { x: 0, y: 0, zoom: 1 }, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" },
    implementsSrs: [],
  };
}

function basicEvent(uuid: string, code: string, extra: Partial<SystemBasicEvent>): SystemBasicEvent {
  return { uuid, code, name: code, eventType: "BASIC", implementsSrs: [], ...extra };
}

function systems(): SystemsAnalysis {
  const sy = createBlankSy("SY", "analyst");
  sy.systemLogicModels = [
    logicModel(FT_A, "FT-A", "ga", [gate("ga", "OR"), gate("ga2", "AND")], [
      eventLeaf("a-e1", E1),
      eventLeaf("a-e2", E2),
      { id: "a-h1", kind: "HOUSE_EVENT", code: "H1", name: "Normal power lost", description: "", state: false },
      eventLeaf("a-e3", E3),
    ], [...inputs("ga", ["a-e1", "a-e2", "ga2"]), ...inputs("ga2", ["a-h1", "a-e3"])]),
    logicModel(FT_B, "FT-B", "gb", [gate("gb", "OR")], [eventLeaf("b-e2", E2), transferLeaf("b-to-c", FT_C, "gc")], inputs("gb", ["b-e2", "b-to-c"])),
    logicModel(FT_C, "FT-C", "gc", [gate("gc", "OR")], [eventLeaf("c-e3", E3), transferLeaf("c-to-b", FT_B, "gb")], inputs("gc", ["c-e3", "c-to-b"])),
  ];
  sy.systemBasicEvents = [
    basicEvent(E1, "E1", { expression: point("PROBABILITY", 0.1) }),
    basicEvent(E2, "E2", { expression: point("PROBABILITY", 0.5) }),
    basicEvent(E3, "E3", { expression: mission(point("PER_HOUR", 1e-3), 24) }),
  ];
  return sy;
}

function snapshot(): EsqModel {
  return {
    importedAt: "2026-10-05T12:00:00.000Z",
    sources: [{ element: "SY", workbookId: "sy-1", workbookName: "SY" }],
    trees: [
      { id: "T1", code: "ET-T1", name: "Tree one", initiatorId: "IE1", stateId: "S1", functionIds: ["F1", "F2", "F3"], transferEntry: false },
      { id: "T2", code: "ET-T2", name: "Tree two", initiatorId: "IE1", functionIds: ["F1"], transferEntry: true },
    ],
    sequences: [
      { id: "Q1", code: "Q1", treeId: "T1", path: { F1: "SUCCESS", F2: "SUCCESS", F3: "BYPASSED" }, endState: "OK" },
      { id: "Q2", code: "Q2", treeId: "T1", path: { F1: "SUCCESS", F2: "FAILURE", F3: "SUCCESS" }, endState: "OK" },
      { id: "Q3", code: "Q3", treeId: "T1", path: { F1: "SUCCESS", F2: "FAILURE", F3: "FAILURE" }, endState: "CD" },
      { id: "Q4", code: "Q4", treeId: "T1", path: { F1: "FAILURE", F2: "BYPASSED", F3: "BYPASSED" }, transferTreeId: "T2" },
      { id: "Q5", code: "Q5", treeId: "T2", path: { F1: "SUCCESS" }, endState: "OK" },
      { id: "Q6", code: "Q6", treeId: "T2", path: { F1: "FAILURE" }, endState: "CD" },
    ],
    families: [],
    functions: [
      { id: "F1", name: "Trip", treeIds: ["T1", "T2"], esLinks: [{ treeId: "T1", top: { workbookId: "sy-1", modelId: FT_A, gateId: "ga" } }, { treeId: "T2", top: { workbookId: "sy-1", modelId: FT_A, gateId: "ga" } }] },
      { id: "F2", name: "Cooling", treeIds: ["T1"], esLinks: [{ treeId: "T1", top: { workbookId: "sy-1", modelId: FT_B, gateId: "gb" } }] },
      { id: "F3", name: "Recovery", treeIds: ["T1"], esLinks: [] },
    ],
    tops: [
      { modelId: FT_A, gateId: "ga", code: "FT-A", name: "FT-A", eventIds: [E1, E2, E3], transferModelIds: [], gates: [{ id: "ga", code: "GA", name: "ga" }, { id: "ga2", code: "GA2", name: "ga2" }], houseEvents: [{ id: "a-h1", code: "H1", name: "Normal power lost", state: false }] },
      { modelId: FT_B, gateId: "gb", code: "FT-B", name: "FT-B", eventIds: [E2], transferModelIds: [FT_C], gates: [{ id: "gb", code: "GB", name: "gb" }], houseEvents: [] },
      { modelId: FT_C, gateId: "gc", code: "FT-C", name: "FT-C", eventIds: [E3], transferModelIds: [FT_B], gates: [{ id: "gc", code: "GC", name: "gc" }], houseEvents: [] },
    ],
    initiators: [{ id: "IE1", name: "Loss of flow", stateIds: ["S1"], frequency: { expression: point("PER_YEAR", 2), basis: FrequencyUnit.PER_PLANT_YEAR } }],
    states: [{ id: "S1", name: "Power operation", hours: 8000 }],
    events: [
      { id: E1, code: "E1", name: "E1", heldBy: "TYPED", expression: point("PROBABILITY", 0.12) },
      { id: E2, code: "E2", name: "E2", heldBy: "DA", holderId: P2, expression: parameter(P2) },
      { id: E3, code: "E3", name: "E3", heldBy: "DA", holderId: P3, expression: mission(parameter(P3), 24) },
    ],
    ccfGroups: [],
    parameters: [
      { id: P2, name: "Pump fails to start", parameterType: "PROBABILITY", quantificationModel: "DEMAND_PROBABILITY", estimate: START_ESTIMATE },
      { id: P3, name: "Pump fails to run", parameterType: "FAILURE_RATE", quantificationModel: "RUNNING_RATE", estimate: RUN_ESTIMATE },
    ],
    humanEvents: [],
  };
}

function workbook(logic: EsqLogic = { loopBreaks: [{ fromModelId: FT_C, toModelId: FT_B, state: false, basis: "Cooling does not need its own support." }] }): EventSequenceQuantification {
  const esq = createBlankEsq("ESQ", "analyst");
  esq.linkedWorkbooks = { ...esq.linkedWorkbooks, DA };
  esq.model = snapshot();
  esq.modelDecisions = { functionLinks: [{ functionId: "F3", target: { kind: "SPLIT_FRACTION", value: 0.3 } }] };
  esq.logic = logic;
  return esq;
}

function build(esq: EventSequenceQuantification, logic: EsqEventTreeRunLogic = AS_SET, sy: SystemsAnalysis = systems(), missionTimes: ReadonlyMap<string, UncertainParameter> = new Map()): EsqRunBuild {
  return buildEsqEventTreeRun({ esq, treeId: "T1", sy, syWorkbookId: "sy-1", syRevision: 4, missionTimes, esqWorkbookId: "esq-1", esqRevision: 7, logic });
}

function faultTree(run: EsqRunBuild, modelId: string): { gates: FaultTreeGate[]; leafNodes: FaultTreeLeafNode[]; gateInputs: FaultTreeGateInput[] } {
  const found = run.faultTrees.find((entry) => entry.modelSnapshot.id === modelId);
  if (found === undefined) throw new Error(`missing ${modelId}`);
  const snapshotOf = found.modelSnapshot;
  return {
    gates: snapshotOf["gates"] as FaultTreeGate[],
    leafNodes: snapshotOf["leafNodes"] as FaultTreeLeafNode[],
    gateInputs: snapshotOf["gateInputs"] as FaultTreeGateInput[],
  };
}

function catalogueExpression(run: EsqRunBuild, eventId: string): UncertainExpression | undefined {
  return run.faultTrees.flatMap((entry) => entry.basicEventCatalogue.basicEvents).find((event) => event.id === eventId)?.expression;
}

function catalogueProbability(run: EsqRunBuild, eventId: string): number | undefined {
  const expression = catalogueExpression(run, eventId);
  return expression?.node === "VALUE" && expression.value.law.family === "POINT" ? expression.value.law.value : undefined;
}

function parametersOf(run: EsqRunBuild, modelId: string): UncertainParameter[] {
  const found = run.faultTrees.find((entry) => entry.modelSnapshot.id === modelId);
  return [...(found?.basicEventCatalogue.uncertaintyParameters ?? [])].sort((left, right) => left.reference.entityId.localeCompare(right.reference.entityId));
}

function withPumpGroup(sy: SystemsAnalysis): SystemsAnalysis {
  sy.commonCauseFailureGroups = [{
    uuid: "ccf-pumps",
    name: "Pumps",
    description: "",
    scope: "INTERSYSTEM",
    affectedComponents: [],
    affectedSystems: [],
    members: { basicEvents: [{ id: E1 }, { id: E2 }] },
    factors: { model: "BETA_FACTOR", beta: point("FRACTION", 0.1) },
    total: point("PROBABILITY", 0.02),
    implementsSrs: [],
  }];
  return sy;
}

function pumpGroupWorkbook(): EventSequenceQuantification {
  const esq = workbook();
  if (esq.model !== undefined) esq.model.ccfGroups = [{ id: "ccf-pumps", name: "Pumps", systemIds: [], memberIds: [E1, E2], factors: { model: "BETA_FACTOR", beta: point("FRACTION", 0.1) }, total: point("PROBABILITY", 0.03) }];
  return esq;
}

function buildError(run: () => EsqRunBuild): string {
  try {
    run();
  } catch (error) {
    if (error instanceof EsqRunBuildError) return error.message;
    throw error;
  }
  throw new Error("expected an ESQ run build error");
}

describe("ESQ event tree run builder", () => {
  it("builds the root tree and its transfer target from the Step 02 snapshot", () => {
    const run = build(workbook());
    expect(run.rootModelId).toBe(esqTreeRunId("T1"));
    expect(run.frequency).toEqual(point("PER_YEAR", 2));
    expect(run.initiatorTables).toEqual({ uncertaintyParameters: [], uncertaintyVectors: [] });
    expect(run.eventTreeModelIds).toEqual([esqTreeRunId("T1"), esqTreeRunId("T2")]);
    expect(run.syModelIds).toEqual([FT_A, FT_B]);
    const [root, target] = run.eventTreeSnapshots;
    expect(root?.["initiatingEventFrequency"]).toEqual({ expression: point("PER_YEAR", 2) });
    expect(target?.["initiatingEventFrequency"]).toEqual({ expression: point("PER_YEAR", 2) });
    expect(root?.["revision"]).toBe(7);
    expect(root?.["sequences"]).toContainEqual({
      id: esqSequenceRunId("T1", "Q4"),
      path: [
        { functionalEventId: esqFunctionRunId("F1"), outcome: "FAILURE" },
        { functionalEventId: esqFunctionRunId("F2"), outcome: "BYPASSED" },
        { functionalEventId: esqFunctionRunId("F3"), outcome: "BYPASSED" },
      ],
      result: { kind: "TRANSFER", target: { modelId: esqTreeRunId("T2") } },
    });
    expect(target?.["endStates"]).toEqual([{ id: esqEndStateRunId("OK") }, { id: esqEndStateRunId("CD") }]);
    expect(run.eventCodes).toMatchObject({ [E1]: "E1", [E2]: "E2", [E3]: "E3" });
    expect(run.values).toContainEqual({ id: E3, role: "BASIC" });
  });

  it("links a split fraction to a one-event fault tree with its probability", () => {
    const run = build(workbook());
    expect(run.splitFractionModelIds).toHaveLength(1);
    const split = run.faultTrees.find((entry) => entry.modelSnapshot.id === run.splitFractionModelIds[0]);
    const events = split?.basicEventCatalogue.basicEvents ?? [];
    expect(events).toHaveLength(1);
    expect(events[0]?.expression).toEqual(legacyExpression("PROBABILITY", 0.3));
    expect(split?.basicEventCatalogue.uncertaintyParameters).toEqual([]);
    expect(run.eventCodes[events[0]?.id ?? ""]).toBe("SF-F3");
    expect(run.values).toContainEqual({ id: events[0]?.id, role: "SPLIT", splitKey: "SPLIT:F3:0.3" });
  });

  it("takes a split fraction from the Step 04 value of record", () => {
    const esq = workbook();
    esq.modelDecisions = { functionLinks: [{ functionId: "F3", target: { kind: "SPLIT_FRACTION", cellId: "BC-1" } }] };
    const cell: EsqCell = {
      id: "BC-1",
      barrierId: "Fuel coating",
      modeId: "FM-1",
      familyId: "F-REL",
      mechanismIds: [],
      variable: "Time to the fuel limit",
      unit: "h",
      basis: "REALISTIC",
      load: { source: "TYPED", variable: { law: { family: "POINT", value: 48 }, fields: [] }, basis: "Window." },
      capacity: { source: "TYPED", variable: { law: { family: "LOGNORMAL", mean: 33.74468539677077, errorFactor: 1.287, level: 0.95 }, fields: [] }, basis: "Runs." },
      use: "SPLIT_FRACTION",
    };
    const splitCatalogue = (run: EsqRunBuild) => run.faultTrees.find((entry) => entry.modelSnapshot.id === run.splitFractionModelIds[0])?.basicEventCatalogue;
    const splitExpressions = (run: EsqRunBuild): UncertainExpression[] => (splitCatalogue(run)?.basicEvents ?? []).map((event) => event.expression);
    const typed = lawValue("PROBABILITY", { family: "BETA", alpha: 2, beta: 6, lower: 0, upper: 1 });
    esq.barrierWork = { cells: [{ ...cell, typed: { expression: typed, basis: "Hand calculation." }, ofRecord: "TYPED" }] };
    expect(splitExpressions(build(esq))).toEqual([typed]);
    esq.barrierWork = { cells: [{ ...cell, typed: { expression: parameter(P2), basis: "Same as the start." }, ofRecord: "TYPED" }] };
    expect(splitCatalogue(build(esq))?.uncertaintyParameters).toEqual([estimateOf(P2, START_ESTIMATE)]);
    const law: Law = { family: "TABULATED", points: [{ probability: 0, value: 0.97 }, { probability: 0.5, value: 0.98 }, { probability: 1, value: 0.99 }], scale: "LINEAR" };
    esq.barrierWork = { cells: [{ ...cell, run: { runId: "run-1", revision: 6, at: "2026-10-05T12:00:00.000Z", method: "POINT_LOAD", inputs: "", point: 0.9912, mean: 0.98, law }, ofRecord: "RUN" }] };
    expect(splitExpressions(build(esq))).toEqual([lawValue("PROBABILITY", law)]);
    esq.barrierWork = { cells: [{ ...cell, run: { runId: "run-1", revision: 6, at: "2026-10-05T12:00:00.000Z", method: "POINT_LOAD", inputs: "", point: 0.9912 }, ofRecord: "RUN" }] };
    expect(splitExpressions(build(esq))).toEqual([point("PROBABILITY", 0.9912)]);
    esq.barrierWork = { cells: [cell] };
    expect(buildError(() => build(esq))).toBe("The split fraction of Recovery in ET-T1 takes cell BC-1, which has no value of record. Run it or type a value in Step 04.");
    esq.barrierWork = {};
    expect(buildError(() => build(esq))).toBe("The split fraction of Recovery in ET-T1 takes cell BC-1, which Step 04 no longer has.");
  });

  it("takes values from the snapshot and DA parameters instead of the live SY values", () => {
    const run = build(workbook());
    expect(catalogueExpression(run, E1)).toEqual(point("PROBABILITY", 0.12));
    expect(catalogueExpression(run, E2)).toEqual(parameter(P2));
    expect(catalogueExpression(run, E3)).toEqual({
      node: "MODEL",
      model: {
        form: "MISSION",
        rate: parameter(P3),
        missionTime: { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 24 } } },
      },
    });
    expect(parametersOf(run, FT_A)).toEqual([estimateOf(P2, START_ESTIMATE), estimateOf(P3, RUN_ESTIMATE)]);
    expect(parametersOf(run, FT_B)).toEqual([estimateOf(P2, START_ESTIMATE), estimateOf(P3, RUN_ESTIMATE)]);
  });

  it("rebinds a rate event to another DA rate inside its SY model", () => {
    const esq = workbook();
    esq.model?.parameters.push({ id: P4, name: "Pump fails to run, generic", parameterType: "FAILURE_RATE", quantificationModel: "RUNNING_RATE", estimate: GENERIC_RUN_ESTIMATE });
    esq.modelDecisions = { ...esq.modelDecisions, valueBindings: [{ eventId: E3, heldBy: "DA", holderId: P4, reason: "Generic data." }] };
    const run = build(esq);
    expect(catalogueExpression(run, E3)).toEqual(mission(parameter(P4), 24));
    expect(parametersOf(run, FT_A)).toEqual([estimateOf(P2, START_ESTIMATE), estimateOf(P4, GENERIC_RUN_ESTIMATE)]);
  });

  it("resolves the DA parameters that a typed expression reads, through nested estimates", () => {
    const esq = workbook();
    const model = esq.model;
    if (model === undefined) throw new Error("fixture has no model");
    const scaled: UncertainExpression = { node: "OPERATION", operation: "MULTIPLY", operands: [parameter(P6), point("FACTOR", 2)] };
    model.parameters.push(
      { id: P5, name: "Pump fails to start, adjusted", parameterType: "PROBABILITY", quantificationModel: "DEMAND_PROBABILITY", estimate: scaled },
      { id: P6, name: "Pump fails to start, generic", parameterType: "PROBABILITY", quantificationModel: "DEMAND_PROBABILITY", estimate: START_ESTIMATE },
    );
    model.events = model.events.map((event) => (event.id === E1 ? { ...event, expression: parameter(P5) } : event));
    const run = build(esq);
    expect(catalogueExpression(run, E1)).toEqual(parameter(P5));
    expect(parametersOf(run, FT_A)).toEqual([
      estimateOf(P2, START_ESTIMATE),
      estimateOf(P3, RUN_ESTIMATE),
      estimateOf(P5, scaled),
      estimateOf(P6, START_ESTIMATE),
    ]);
  });

  it("refuses a DA reference that Step 01 or Step 02 does not hold", () => {
    const foreign = workbook();
    foreign.model?.events.splice(0, 1, { id: E1, code: "E1", name: "E1", heldBy: "TYPED", expression: parameter(P2, "da-2") });
    expect(buildError(() => build(foreign))).toBe(`E1 reads ${P2} from a workbook that Step 01 does not link as DA or SC.`);
    const missing = workbook();
    missing.model?.events.splice(0, 1, { id: E1, code: "E1", name: "E1", heldBy: "TYPED", expression: parameter(P6) });
    expect(buildError(() => build(missing))).toBe(`E1 reads DA parameter ${P6}, which the Step 02 import does not hold.`);
    const unlinked = workbook();
    unlinked.linkedWorkbooks = {};
    expect(buildError(() => build(unlinked))).toBe("E2 takes its value from DA, but Step 01 links no DA workbook.");
  });

  it("reads an SC mission time through the parameter table and keeps a DA rate binding beside it", () => {
    const esq = workbook();
    esq.linkedWorkbooks = { ...esq.linkedWorkbooks, SC: SC };
    const linked: UncertainExpression = { node: "MODEL", model: { form: "MISSION", rate: parameter(P3), missionTime: parameter(MT, SC) } };
    esq.model?.events.splice(2, 1, { id: E3, code: "E3", name: "E3", heldBy: "DA", holderId: P3, expression: linked });
    esq.model?.parameters.push({ id: P4, name: "Pump fails to run, generic", parameterType: "FAILURE_RATE", quantificationModel: "RUNNING_RATE", estimate: GENERIC_RUN_ESTIMATE });
    const hours = lawValue("HOURS", { family: "LOGNORMAL", mean: 24, errorFactor: 2, level: 0.95 });
    const missionTime: UncertainParameter = { reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: SC, entityId: MT }, expression: hours };
    const table = new Map([[`${SC}:${MT}`, missionTime]]);
    const run = build(esq, AS_SET, systems(), table);
    expect(catalogueExpression(run, E3)).toEqual(linked);
    expect(parametersOf(run, FT_A)).toEqual(expect.arrayContaining([estimateOf(P3, RUN_ESTIMATE), missionTime]));
    esq.modelDecisions = { ...esq.modelDecisions, valueBindings: [{ eventId: E3, heldBy: "DA", holderId: P4, reason: "Generic data." }] };
    expect(catalogueExpression(build(esq, AS_SET, systems(), table), E3)).toEqual({ node: "MODEL", model: { form: "MISSION", rate: parameter(P4), missionTime: parameter(MT, SC) } });
    expect(buildError(() => build(esq))).toBe(`E3 reads mission time ${MT}, which the linked SC workbook does not hold.`);
  });

  it("refuses a run while a support loop has no recorded break", () => {
    expect(buildError(() => build(workbook({})))).toBe("The fault trees FT-B, FT-C form a loop. Break it in the Loops tab of Step 03.");
  });

  it("replaces the broken transfer with a house event at the recorded or overridden state", () => {
    const asSet = faultTree(build(workbook()), FT_B).leafNodes;
    expect(asSet).toContainEqual(expect.objectContaining({ kind: "HOUSE_EVENT", state: false }));
    const forced = faultTree(build(workbook(), { ...AS_SET, loopBreaks: "TRUE" }), FT_B).leafNodes;
    expect(forced).toContainEqual(expect.objectContaining({ kind: "HOUSE_EVENT", state: true }));
  });

  it("sets a house event flag for the matching initiator only when flags are on", () => {
    const esq = workbook();
    esq.logic = { ...esq.logic, flags: [{ id: "FL-1", name: "Normal power available", target: { kind: "HOUSE", id: "a-h1", modelId: FT_A }, state: true, groupIds: ["IE1"], stateIds: [], basis: "IE1 keeps normal power." }] };
    expect(faultTree(build(esq), FT_A).leafNodes).toContainEqual(expect.objectContaining({ id: "a-h1", state: true }));
    expect(faultTree(build(esq, { ...AS_SET, flags: false }), FT_A).leafNodes).toContainEqual(expect.objectContaining({ id: "a-h1", state: false }));
    esq.logic.flags = [{ id: "FL-1", name: "Normal power available", target: { kind: "HOUSE", id: "a-h1", modelId: FT_A }, state: true, groupIds: ["IE9"], stateIds: [], basis: "Another initiator." }];
    expect(faultTree(build(esq), FT_A).leafNodes).toContainEqual(expect.objectContaining({ id: "a-h1", state: false }));
  });

  it("turns an event flag into a house event and drops the event from the catalogue", () => {
    const esq = workbook();
    esq.logic = { ...esq.logic, flags: [{ id: "FL-2", name: "E1 failed", target: { kind: "EVENT", id: E1 }, state: true, groupIds: [], stateIds: [], basis: "Test." }] };
    const run = build(esq);
    expect(faultTree(run, FT_A).leafNodes).toContainEqual(expect.objectContaining({ id: "a-e1", kind: "HOUSE_EVENT", state: true }));
    expect(catalogueExpression(run, E1)).toBeUndefined();
  });

  it("sets the failed events of a sensitivity case TRUE even with flags off", () => {
    const run = buildEsqEventTreeRun({ esq: workbook(), treeId: "T1", sy: systems(), syWorkbookId: "sy-1", syRevision: 4, missionTimes: new Map(), esqWorkbookId: "esq-1", esqRevision: 7, logic: { ...AS_SET, flags: false }, failedEventIds: [E1] });
    expect(faultTree(run, FT_A).leafNodes).toContainEqual(expect.objectContaining({ id: "a-e1", kind: "HOUSE_EVENT", state: true }));
    expect(catalogueExpression(run, E1)).toBeUndefined();
    expect(run.values.some((value) => value.id === E1)).toBe(false);
  });

  it("sets a gate flag by replacing the gate inputs with one house event", () => {
    const esq = workbook();
    esq.logic = { ...esq.logic, flags: [{ id: "FL-3", name: "Branch off", target: { kind: "GATE", id: "ga2", modelId: FT_A }, state: false, groupIds: [], stateIds: [], basis: "Test." }] };
    const tree = faultTree(build(esq), FT_A);
    expect(tree.gates).toContainEqual(expect.objectContaining({ id: "ga2", gateType: "OR" }));
    const children = tree.gateInputs.filter((entry) => entry.gateId === "ga2").map((entry) => entry.childId);
    expect(children).toHaveLength(1);
    expect(tree.leafNodes).toContainEqual(expect.objectContaining({ id: children[0], kind: "HOUSE_EVENT", state: false }));
  });

  it("refuses two flags that set one target TRUE and FALSE", () => {
    const esq = workbook();
    const target = { kind: "HOUSE" as const, id: "a-h1", modelId: FT_A };
    esq.logic = { ...esq.logic, flags: [
      { id: "FL-1", name: "On", target, state: true, groupIds: [], stateIds: [], basis: "A." },
      { id: "FL-2", name: "Off", target, state: false, groupIds: ["IE1"], stateIds: [], basis: "B." },
    ] };
    expect(buildError(() => build(esq))).toBe("Flags On and Off set the same target TRUE and FALSE for ET-T1.");
  });

  it("writes an exclusion as AND NOT logic on the later events", () => {
    const esq = workbook();
    esq.logic = { ...esq.logic, exclusions: [{ id: "EX-1", eventIds: [E1, E2], basis: "Never both in maintenance." }] };
    const tree = faultTree(build(esq), FT_A);
    expect(tree.gates).toContainEqual(expect.objectContaining({ id: "a-e2", gateType: "AND" }));
    const children = tree.gateInputs.filter((entry) => entry.gateId === "a-e2").map((entry) => entry.childId);
    const notGate = tree.gates.find((candidate) => candidate.gateType === "NOT" && children.includes(candidate.id));
    expect(notGate?.code).toBe("NOT-E1");
    expect(faultTree(build(esq, { ...AS_SET, exclusions: false }), FT_A).leafNodes).toContainEqual(expect.objectContaining({ id: "a-e2", kind: "BASIC_EVENT_REFERENCE" }));
  });

  it("refuses a run when SY changed after the import", () => {
    const sy = systems();
    sy.systemBasicEvents.push(basicEvent("e4000000-0000-4000-8000-000000000004", "E4", { expression: point("PROBABILITY", 0.2) }));
    sy.systemLogicModels[0]?.leafNodes.push(eventLeaf("a-e4", "e4000000-0000-4000-8000-000000000004"));
    sy.systemLogicModels[0]?.gateInputs.push({ id: "ga:a-e4", gateId: "ga", childId: "a-e4", order: 3 });
    expect(buildError(() => build(workbook(), AS_SET, sy))).toBe("The SY fault tree FT-A changed after the Step 02 import. Re-import the model in Step 02.");
  });

  it("carries a common cause group into every fault tree catalogue when its members sit in different trees", () => {
    const run = build(pumpGroupWorkbook(), AS_SET, withPumpGroup(systems()));
    const group = { id: "ccf-pumps", members: [E1, E2], factors: { model: "BETA_FACTOR", beta: point("FRACTION", 0.1) }, total: point("PROBABILITY", 0.03) };
    expect(run.ccfGroups).toEqual([group]);
    for (const modelId of [FT_A, FT_B]) {
      const tree = run.faultTrees.find((entry) => entry.modelSnapshot.id === modelId);
      expect(tree?.basicEventCatalogue.commonCauseFailureGroups).toEqual([group]);
    }
  });

  it("takes a common cause total from the expression its members share", () => {
    const esq = pumpGroupWorkbook();
    esq.modelDecisions = { ...esq.modelDecisions, valueBindings: [{ eventId: E1, heldBy: "DA", holderId: P2, reason: "Same pump design." }] };
    const run = build(esq, AS_SET, withPumpGroup(systems()));
    expect(catalogueExpression(run, E1)).toEqual(parameter(P2));
    expect(run.ccfGroups).toEqual([{ id: "ccf-pumps", members: [E1, E2], factors: { model: "BETA_FACTOR", beta: point("FRACTION", 0.1) }, total: parameter(P2) }]);
    expect(run.faultTrees.find((entry) => entry.modelSnapshot.id === FT_B)?.basicEventCatalogue.commonCauseFailureGroups).toEqual(run.ccfGroups);
  });

  it("carries the DA estimates that common cause factors and totals read, and names a group without factors", () => {
    const esq = pumpGroupWorkbook();
    if (esq.model !== undefined) {
      esq.model.parameters.push({ id: P4, name: "Pump beta", parameterType: "OTHER", quantificationModel: "OTHER_PROBABILITY", estimate: lawValue("FRACTION", { family: "BETA", alpha: 1, beta: 19, lower: 0, upper: 1 }) });
      esq.model.ccfGroups = [{ id: "ccf-pumps", name: "Pumps", systemIds: [], memberIds: [E1, E2], factors: { model: "MGL", factors: [parameter(P4)] }, total: mission(parameter(P3), 24) }];
    }
    const run = build(esq, AS_SET, withPumpGroup(systems()));
    expect(run.ccfGroups).toEqual([{ id: "ccf-pumps", members: [E1, E2], factors: { model: "MGL", factors: [parameter(P4)] }, total: mission(parameter(P3), 24) }]);
    const table = parametersOf(run, FT_B);
    expect(table).toContainEqual(estimateOf(P4, lawValue("FRACTION", { family: "BETA", alpha: 1, beta: 19, lower: 0, upper: 1 })));
    expect(table).toContainEqual(estimateOf(P3, RUN_ESTIMATE));
    const vector = pumpGroupWorkbook();
    if (vector.model !== undefined) vector.model.ccfGroups = [{ id: "ccf-pumps", name: "Pumps", systemIds: [], memberIds: [E1, E2], factors: { model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: DA, entityId: "CCF-1" } } }, total: point("PROBABILITY", 0.03) }];
    expect(buildError(() => build(vector, AS_SET, withPumpGroup(systems())))).toBe("The common cause group Pumps takes its factors from CCF-1, which the Step 02 import does not hold.");
    const bare = pumpGroupWorkbook();
    if (bare.model !== undefined) bare.model.ccfGroups = [{ id: "ccf-pumps", name: "Pumps", systemIds: [], memberIds: [E1, E2] }];
    expect(buildError(() => build(bare, AS_SET, withPumpGroup(systems())))).toBe("The common cause group Pumps has no factors in the Step 02 import. Complete it in SY and import again.");
  });

  it("scales a DA initiator frequency by the module factor and the state share and carries its estimate", () => {
    const esq = workbook();
    const frequency = lawValue("PER_YEAR", { family: "GAMMA", shape: 1.5, rate: 0.75 });
    if (esq.model !== undefined) {
      esq.model.parameters.push({ id: P5, name: "Loss of flow frequency", parameterType: "FREQUENCY", quantificationModel: "FREQUENCY", estimate: frequency });
      esq.model.states.push({ id: "S2", name: "Shutdown", hours: 2000 });
      esq.model.initiators = [{ id: "IE1", name: "Loss of flow", stateIds: ["S1", "S2"] }];
    }
    esq.modelDecisions = { ...esq.modelDecisions, initiatorChoices: [{ groupId: "IE1", source: "DA", parameterId: P5 }] };
    esq.quantificationPlan = { modulesPerPlant: { value: 4 }, frequencyBasis: { value: "PER_REACTOR_YEAR" } };
    const run = build(esq);
    expect(run.frequency).toEqual({
      node: "OPERATION",
      operation: "MULTIPLY",
      operands: [{ node: "OPERATION", operation: "MULTIPLY", operands: [parameter(P5), point("FACTOR", 0.25)] }, point("FRACTION", 0.8)],
    });
    expect(run.initiatorTables.uncertaintyParameters).toEqual([estimateOf(P5, frequency)]);
    const typed = workbook();
    typed.modelDecisions = { ...typed.modelDecisions, initiatorChoices: [{ groupId: "IE1", source: "TYPED", expression: parameter("P-ELSEWHERE", "other-da") }] };
    expect(buildError(() => build(typed))).toBe("The initiator frequency of ET-T1 reads P-ELSEWHERE from a workbook that Step 01 does not link as DA or SC.");
  });

  it("samples the initiator through its own expression and gives each use its own draw without shared draws", () => {
    const esq = workbook();
    const frequency = lawValue("PER_YEAR", { family: "GAMMA", shape: 1.5, rate: 0.75 });
    if (esq.model !== undefined) esq.model.parameters.push({ id: P5, name: "Loss of flow frequency", parameterType: "FREQUENCY", quantificationModel: "FREQUENCY", estimate: frequency });
    esq.modelDecisions = { ...esq.modelDecisions, initiatorChoices: [{ groupId: "IE1", source: "DA", parameterId: P5 }] };
    const run = build(esq);
    const root = esq.model?.trees.find((tree) => tree.id === "T1");
    if (root === undefined) throw new Error("no root tree");
    const inputs = new Map(sampledInputsOf(esq).map((input) => [input.key, input]));
    const sample = (correlation: "SHARED" | "INDEPENDENT", tally: EsqSamplingTally) => sampledBuild({ esq, build: run, root, logic: AS_SET, settings: { trials: 10, seed: 1, method: "MONTE_CARLO", correlation }, inputs, tally, esqWorkbookId: "esq-1" });
    const sharedTally: EsqSamplingTally = { used: new Map(), unsampled: new Map() };
    const shared = sample("SHARED", sharedTally);
    expect(shared.sampling).toEqual({ trials: 10, seed: 1, method: "MONTE_CARLO" });
    expect(shared.build.eventTreeSnapshots.map((snapshot) => snapshot["initiatingEventFrequency"])).toEqual([{ expression: parameter(P5) }, { expression: parameter(P5) }]);
    expect(shared.build.initiatorTables.uncertaintyParameters).toEqual([estimateOf(P5, frequency)]);
    expect(sharedTally.used.get(`PARAMETER:${P5}`)?.events).toEqual(new Set(["initiator:IE1"]));
    const independent = sample("INDEPENDENT", { used: new Map(), unsampled: new Map() });
    expect(independent.build.frequency).toEqual(parameter(`${P5}@initiator:IE1`));
    expect(independent.build.initiatorTables.uncertaintyParameters).toEqual([estimateOf(`${P5}@initiator:IE1`, frequency)]);
  });

  it("sends a tree only the case overrides that its build holds", () => {
    const run = build(pumpGroupWorkbook(), AS_SET, withPumpGroup(systems()));
    const overrides = { events: [{ id: E1, probability: 1 }, { id: "e-absent", probability: 1 }], ccfGroups: [{ id: "ccf-pumps", probability: 1 }, { id: "ccf-absent", probability: 1 }] };
    expect(caseOverridesFor(overrides, run)).toEqual({ events: [{ id: E1, probability: 1 }], ccfGroups: [{ id: "ccf-pumps", probability: 1 }] });
    expect(caseOverridesFor({ events: [{ id: "e-absent", probability: 1 }], ccfGroups: [{ id: "ccf-absent", probability: 1 }] }, run)).toBeUndefined();
    expect(caseOverridesFor(undefined, run)).toBeUndefined();
  });

  it("refuses a probability bound to a failure rate", () => {
    const esq = workbook();
    esq.modelDecisions = { ...esq.modelDecisions, valueBindings: [{ eventId: E1, heldBy: "DA", holderId: P3, reason: "Test." }] };
    expect(buildError(() => build(esq))).toBe("Pump fails to run is a rate. Bind it only to an event whose SY value is a mission or standby model of one rate.");
  });

  it("names what is missing before a run", () => {
    const blank = createBlankEsq("ESQ", "analyst");
    expect(buildError(() => build(blank))).toBe("Import the model in Step 02 before running.");
    expect(buildError(() => buildEsqEventTreeRun({ esq: workbook(), treeId: "T2", sy: systems(), syWorkbookId: "sy-1", syRevision: 4, missionTimes: new Map(), esqWorkbookId: "esq-1", esqRevision: 7, logic: AS_SET })))
      .toBe("ET-T2 is entered by transfer. Run the tree that transfers into it.");
    const unlinked = workbook();
    unlinked.modelDecisions = {};
    expect(buildError(() => build(unlinked))).toBe("Recovery in ET-T1 is not linked. Link it in Step 02.");
    const noFrequency = workbook();
    if (noFrequency.model !== undefined) noFrequency.model.initiators = [];
    expect(buildError(() => build(noFrequency))).toBe("ET-T1 has no initiator frequency. Complete the Initiators tab of Step 02.");
  });

  describe("Step 06 post-processing as logic", () => {
    function humanSystems(): SystemsAnalysis {
      const sy = systems();
      sy.systemBasicEvents = sy.systemBasicEvents.map((event) => (event.uuid === E1
        ? basicEvent(E1, "E1", { failureMode: "HUMAN_ERROR", probability: 0.1 })
        : event.uuid === E2 ? basicEvent(E2, "E2", { failureMode: "HUMAN_ERROR", probability: 0.5 }) : event));
      return sy;
    }

    function humanWorkbook(): EventSequenceQuantification {
      const esq = workbook();
      const model = esq.model;
      if (model === undefined) throw new Error("fixture has no model");
      model.humanEvents = [
        { id: "H1", name: "Operator fails to restart", timing: "POST_INITIATOR", value: 0.12, riskSignificant: true, distributionGiven: false },
        { id: "H2", name: "Operator fails to align", timing: "PRE_INITIATOR", value: 0.05, riskSignificant: false, distributionGiven: false },
      ];
      model.events = model.events.map((event) => (event.id === E1
        ? { id: E1, code: "E1", name: "E1", failureMode: "HUMAN_ERROR", heldBy: "HRA" as const, holderId: "H1" }
        : event.id === E2 ? { id: E2, code: "E2", name: "E2", failureMode: "HUMAN_ERROR", heldBy: "HRA" as const, holderId: "H2" } : event));
      model.recoveries = [{
        id: "REC-1",
        name: "Restart from the remote panel",
        hfeId: "H1",
        level: "SEQUENCE",
        sequenceIds: [],
        hep: 0.2,
        feasibility: { procedure: true, training: true, cues: true, crew: true, time: true, access: true, equipment: true },
      }];
      model.jointFloor = { id: "JHF-1", value: 1e-5, justification: "Floor." };
      return esq;
    }

    function humanBuild(esq: EventSequenceQuantification, logic: EsqEventTreeRunLogic = AS_SET): EsqRunBuild {
      return build(esq, logic, humanSystems());
    }

    function gateOf(run: EsqRunBuild, modelId: string, id: string): FaultTreeGate | undefined {
      return faultTree(run, modelId).gates.find((entry) => entry.id === id);
    }

    function childEvents(run: EsqRunBuild, modelId: string, gateId: string): string[] {
      const tree = faultTree(run, modelId);
      return tree.gateInputs.filter((input) => input.gateId === gateId).flatMap((input) => {
        const leaf = tree.leafNodes.find((entry) => entry.id === input.childId);
        return leaf?.kind === "BASIC_EVENT_REFERENCE" ? [leaf.basicEventId] : [];
      }).sort();
    }

    it("sends a human event its HEP as a legacy point", () => {
      const run = humanBuild(humanWorkbook());
      expect(catalogueExpression(run, E1)).toEqual(legacyExpression("PROBABILITY", 0.12));
      expect(catalogueExpression(run, E2)).toEqual(legacyExpression("PROBABILITY", 0.05));
      const component = humanWorkbook();
      component.modelDecisions = { ...component.modelDecisions, valueBindings: [{ eventId: E1, heldBy: "DA", holderId: P2, reason: "Test." }] };
      expect(buildError(() => humanBuild(component))).toBe("Pump fails to start is a component estimate. It cannot set E1.");
    });

    it("writes a credited recovery as the event AND its non-recovery", () => {
      const esq = humanWorkbook();
      esq.postWork = { recoveries: [{ id: "REC-1", groupIds: [], stateIds: [], credited: true, basis: "Remote panel." }] };
      const run = humanBuild(esq);
      expect(gateOf(run, FT_A, "a-e1")?.gateType).toBe("AND");
      expect(childEvents(run, FT_A, "a-e1")).toEqual([E1, esqRecoveryEventId("REC-1")].sort());
      expect(catalogueExpression(run, esqRecoveryEventId("REC-1"))).toEqual(legacyExpression("PROBABILITY", 0.2));
      expect(run.humanEventIds).toEqual([E1, E2, esqRecoveryEventId("REC-1")].sort());
      expect(run.nominal[esqRecoveryEventId("REC-1")]).toBe(0.2);
      expect(run.nominal[E1]).toBe(0.12);
      expect(gateOf(humanBuild(esq, { ...AS_SET, recovery: false }), FT_A, "a-e1")).toBeUndefined();
      const uncredited = humanWorkbook();
      uncredited.postWork = { recoveries: [{ id: "REC-1", groupIds: [], stateIds: [], credited: false, basis: "" }] };
      expect(gateOf(humanBuild(uncredited), FT_A, "a-e1")).toBeUndefined();
      const infeasible = humanWorkbook();
      const record = infeasible.model?.recoveries?.[0];
      if (record !== undefined) record.feasibility = { ...record.feasibility, crew: false };
      infeasible.postWork = { recoveries: [{ id: "REC-1", groupIds: [], stateIds: [], credited: true, basis: "" }] };
      expect(gateOf(humanBuild(infeasible), FT_A, "a-e1")).toBeUndefined();
      const elsewhere = humanWorkbook();
      elsewhere.postWork = { recoveries: [{ id: "REC-1", groupIds: ["IE9"], stateIds: [], credited: true, basis: "" }] };
      expect(gateOf(humanBuild(elsewhere), FT_A, "a-e1")).toBeUndefined();
    });

    it("writes a dependent pair as a joint event shared by independent parts", () => {
      const esq = humanWorkbook();
      esq.postWork = { combinations: [{ id: "HC-1", eventIds: [E1, E2], ofRecord: "TYPED", typed: { joint: 0.03, source: "Hand assessment." }, groupIds: [], stateIds: [], basis: "Same crew." }] };
      const run = humanBuild(esq);
      const joint = esqJointEventId("HC-1");
      for (const [modelId, leafId, eventId] of [[FT_A, "a-e1", E1], [FT_A, "a-e2", E2], [FT_B, "b-e2", E2]] as const) {
        expect(gateOf(run, modelId, leafId)?.gateType).toBe("OR");
        expect(childEvents(run, modelId, leafId)).toEqual([esqIndependentEventId(eventId), joint].sort());
      }
      const g = (0.03 - 0.12 * 0.05) / (1 + 0.03 - 0.12 - 0.05);
      expect(catalogueProbability(run, joint)).toBeCloseTo(g, 14);
      expect(catalogueProbability(run, esqIndependentEventId(E1))).toBeCloseTo((0.12 - g) / (1 - g), 14);
      expect(catalogueProbability(run, esqIndependentEventId(E2))).toBeCloseTo((0.05 - g) / (1 - g), 14);
      expect(gateOf(humanBuild(esq, { ...AS_SET, dependency: false }), FT_A, "a-e1")).toBeUndefined();
      const above = humanWorkbook();
      above.postWork = { combinations: [{ id: "HC-1", eventIds: [E1, E2], ofRecord: "TYPED", typed: { joint: 0.2, source: "" }, groupIds: [], stateIds: [], basis: "" }] };
      expect(buildError(() => humanBuild(above))).toBe("HC-1: The joint HEP 0.200 exceeds a member HEP of 0.0500. Fix it in Step 06.");
    });

    it("raises every HEP and skips the dependencies for the combination search", () => {
      const esq = humanWorkbook();
      esq.postWork = {
        recoveries: [{ id: "REC-1", groupIds: [], stateIds: [], credited: true, basis: "" }],
        combinations: [{ id: "HC-1", eventIds: [E1, E2], ofRecord: "TYPED", typed: { joint: 0.03, source: "" }, groupIds: [], stateIds: [], basis: "" }],
      };
      const run = buildEsqEventTreeRun({ esq, treeId: "T1", sy: humanSystems(), syWorkbookId: "sy-1", syRevision: 4, missionTimes: new Map(), esqWorkbookId: "esq-1", esqRevision: 7, logic: AS_SET, raisedHep: 0.8 });
      expect(catalogueExpression(run, E1)).toEqual(legacyExpression("PROBABILITY", 0.8));
      expect(catalogueExpression(run, E2)).toEqual(legacyExpression("PROBABILITY", 0.8));
      expect(catalogueExpression(run, esqRecoveryEventId("REC-1"))).toEqual(legacyExpression("PROBABILITY", 0.8));
      expect(catalogueExpression(run, esqJointEventId("HC-1"))).toBeUndefined();
      expect(run.nominal[E2]).toBe(0.05);
    });
  });
});
