import type { EsqCell, EsqLogic, EsqModel, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { SystemBasicEvent, SystemLogicModel, SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type { FaultTreeGate, FaultTreeGateInput, FaultTreeLeafNode } from "interfaces-mef-types/modeling/fault-tree";
import { esqEndStateRunId, esqFunctionRunId, esqSequenceRunId, esqTreeRunId } from "interfaces-mef-types/esq/esq-run-inputs";
import { esqIndependentEventId, esqJointEventId, esqRecoveryEventId } from "interfaces-mef-types/esq/esq-post-inputs";
import type { EsqEventTreeRunLogic } from "interfaces-shared-types/newly-developed-methods";
import { DistributionType } from "interfaces-mef-types/core/events";
import { createBlankEsq } from "../blank-esq";
import { createBlankSy } from "../../sy-workbooks/blank-sy";
import { buildEsqEventTreeRun, EsqRunBuildError, type EsqRunBuild } from "../esq-model-run-builder";
import { caseOverridesFor } from "../esq-measure-run-builder";

const FT_A = "1a000000-0000-4000-8000-000000000001";
const FT_B = "1b000000-0000-4000-8000-000000000002";
const FT_C = "1c000000-0000-4000-8000-000000000003";
const E1 = "e1000000-0000-4000-8000-000000000001";
const E2 = "e2000000-0000-4000-8000-000000000002";
const E3 = "e3000000-0000-4000-8000-000000000003";
const P2 = "p2000000-0000-4000-8000-000000000002";
const P3 = "p3000000-0000-4000-8000-000000000003";

const AS_SET: EsqEventTreeRunLogic = { flags: true, loopBreaks: "AS_SET", exclusions: true, expandCcf: true };

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
    basicEvent(E1, "E1", { probability: 0.1 }),
    basicEvent(E2, "E2", { probability: 0.5, controlledDataSource: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: P2 } }),
    basicEvent(E3, "E3", {
      quantificationBasis: { kind: "FAILURE_RATE", failureRate: { value: 1e-3, unit: "HOUR" }, missionTime: { value: 24, unit: "HOUR" }, conversion: "EXPONENTIAL" },
      controlledDataSource: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: P3 },
    }),
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
    initiators: [{ id: "IE1", name: "Loss of flow", stateIds: ["S1"], meanFrequency: 2 }],
    states: [{ id: "S1", name: "Power operation", hours: 8000 }],
    events: [
      { id: E1, code: "E1", name: "E1", heldBy: "TYPED", value: 0.12, valueUnit: "PROBABILITY" },
      { id: E2, code: "E2", name: "E2", heldBy: "DA", holderId: P2 },
      { id: E3, code: "E3", name: "E3", heldBy: "DA", holderId: P3 },
    ],
    ccfGroups: [],
    parameters: [
      { id: P2, name: "Pump fails to start", parameterType: "PROBABILITY", value: 0.05, valueType: "MEAN" },
      { id: P3, name: "Pump fails to run", parameterType: "FAILURE_RATE", value: 2e-3, valueType: "MEAN" },
    ],
    humanEvents: [],
  };
}

function workbook(logic: EsqLogic = { loopBreaks: [{ fromModelId: FT_C, toModelId: FT_B, state: false, basis: "Cooling does not need its own support." }] }): EventSequenceQuantification {
  const esq = createBlankEsq("ESQ", "analyst");
  esq.model = snapshot();
  esq.modelDecisions = { functionLinks: [{ functionId: "F3", target: { kind: "SPLIT_FRACTION", value: 0.3 } }] };
  esq.logic = logic;
  return esq;
}

function build(esq: EventSequenceQuantification, logic: EsqEventTreeRunLogic = AS_SET, sy: SystemsAnalysis = systems()): EsqRunBuild {
  return buildEsqEventTreeRun({ esq, treeId: "T1", sy, syWorkbookId: "sy-1", syRevision: 4, esqWorkbookId: "esq-1", esqRevision: 7, logic });
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

function catalogueValue(run: EsqRunBuild, eventId: string): number | undefined {
  for (const entry of run.faultTrees) {
    const events = entry.basicEventCatalogue["basicEvents"] as { id: string; probability: { value: number } }[];
    const event = events.find((candidate) => candidate.id === eventId);
    if (event !== undefined) return event.probability.value;
  }
  return undefined;
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
    expect(run.frequency).toBe(2);
    expect(run.eventTreeModelIds).toEqual([esqTreeRunId("T1"), esqTreeRunId("T2")]);
    expect(run.syModelIds).toEqual([FT_A, FT_B]);
    const [root, target] = run.eventTreeSnapshots;
    expect(root?.["initiatingEventFrequency"]).toEqual({ value: 2, unit: "PER_YEAR" });
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
  });

  it("links a split fraction to a one-event fault tree with its probability", () => {
    const run = build(workbook());
    expect(run.splitFractionModelIds).toHaveLength(1);
    const split = run.faultTrees.find((entry) => entry.modelSnapshot.id === run.splitFractionModelIds[0]);
    expect(split?.basicEventCatalogue["basicEvents"]).toEqual([expect.objectContaining({ code: "SF-F3", probability: { value: 0.3 } })]);
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
      load: { distribution: { type: DistributionType.POINT_ESTIMATE, value: 48 }, basis: "Window." },
      capacity: { distribution: { type: DistributionType.LOGNORMAL, median: 33.35, errorFactor: 1.287 }, basis: "Runs." },
      use: "SPLIT_FRACTION",
    };
    const splitValue = (run: EsqRunBuild): unknown => run.faultTrees.find((entry) => entry.modelSnapshot.id === run.splitFractionModelIds[0])?.basicEventCatalogue["basicEvents"];
    esq.barrierWork = { cells: [{ ...cell, typed: { value: 0.25, basis: "Hand calculation." }, ofRecord: "TYPED" }] };
    expect(splitValue(build(esq))).toEqual([expect.objectContaining({ code: "SF-F3", probability: { value: 0.25 } })]);
    esq.barrierWork = { cells: [{ ...cell, run: { runId: "run-1", revision: 6, at: "2026-10-05T12:00:00.000Z", method: "POINT_LOAD", inputs: "", point: 0.9912, mean: 0.98 }, ofRecord: "RUN" }] };
    expect(splitValue(build(esq))).toEqual([expect.objectContaining({ probability: { value: 0.98 } })]);
    esq.barrierWork = { cells: [cell] };
    expect(buildError(() => build(esq))).toBe("The split fraction of Recovery in ET-T1 takes cell BC-1, which has no value of record. Run it or type a value in Step 04.");
    esq.barrierWork = {};
    expect(buildError(() => build(esq))).toBe("The split fraction of Recovery in ET-T1 takes cell BC-1, which Step 04 no longer has.");
  });

  it("takes values from the snapshot and DA parameters instead of the live SY values", () => {
    const run = build(workbook());
    expect(catalogueValue(run, E1)).toBe(0.12);
    expect(catalogueValue(run, E2)).toBe(0.05);
    expect(catalogueValue(run, E3)).toBeCloseTo(1 - Math.exp(-2e-3 * 24), 15);
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
    expect(catalogueValue(run, E1)).toBeUndefined();
  });

  it("sets the failed events of a sensitivity case TRUE even with flags off", () => {
    const run = buildEsqEventTreeRun({ esq: workbook(), treeId: "T1", sy: systems(), syWorkbookId: "sy-1", syRevision: 4, esqWorkbookId: "esq-1", esqRevision: 7, logic: { ...AS_SET, flags: false }, failedEventIds: [E1] });
    expect(faultTree(run, FT_A).leafNodes).toContainEqual(expect.objectContaining({ id: "a-e1", kind: "HOUSE_EVENT", state: true }));
    expect(catalogueValue(run, E1)).toBeUndefined();
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
    sy.systemBasicEvents.push(basicEvent("e4000000-0000-4000-8000-000000000004", "E4", { probability: 0.2 }));
    sy.systemLogicModels[0]?.leafNodes.push(eventLeaf("a-e4", "e4000000-0000-4000-8000-000000000004"));
    sy.systemLogicModels[0]?.gateInputs.push({ id: "ga:a-e4", gateId: "ga", childId: "a-e4", order: 3 });
    expect(buildError(() => build(workbook(), AS_SET, sy))).toBe("The SY fault tree FT-A changed after the Step 02 import. Re-import the model in Step 02.");
  });

  it("carries a common cause group into every fault tree catalogue when its members sit in different trees", () => {
    const sy = systems();
    sy.commonCauseFailureGroups = [{
      uuid: "ccf-pumps",
      name: "Pumps",
      description: "",
      scope: "INTERSYSTEM",
      affectedComponents: [],
      affectedSystems: [],
      members: { basicEvents: [{ id: E1 }, { id: E2 }] },
      modelType: "BETA_FACTOR",
      modelSpecificParameters: { betaFactorParameters: { beta: 0.1, totalFailureProbability: 0.02 } },
      implementsSrs: [],
    }];
    const esq = workbook();
    if (esq.model !== undefined) esq.model.ccfGroups = [{ id: "ccf-pumps", name: "Pumps", systemIds: [], memberIds: [E1, E2], modelType: "BETA_FACTOR", totalProbability: 0.03 }];
    const run = build(esq, AS_SET, sy);
    for (const modelId of [FT_A, FT_B]) {
      const tree = run.faultTrees.find((entry) => entry.modelSnapshot.id === modelId);
      expect(tree?.basicEventCatalogue["commonCauseFailureGroups"]).toEqual([
        { id: "ccf-pumps", members: [E1, E2], model: { kind: "BETA_FACTOR", beta: 0.1 }, totalFailureProbability: 0.03 },
      ]);
    }
  });

  it("sends a tree only the case overrides that its build holds", () => {
    const sy = systems();
    sy.commonCauseFailureGroups = [{
      uuid: "ccf-pumps",
      name: "Pumps",
      description: "",
      scope: "INTERSYSTEM",
      affectedComponents: [],
      affectedSystems: [],
      members: { basicEvents: [{ id: E1 }, { id: E2 }] },
      modelType: "BETA_FACTOR",
      modelSpecificParameters: { betaFactorParameters: { beta: 0.1, totalFailureProbability: 0.02 } },
      implementsSrs: [],
    }];
    const esq = workbook();
    if (esq.model !== undefined) esq.model.ccfGroups = [{ id: "ccf-pumps", name: "Pumps", systemIds: [], memberIds: [E1, E2], modelType: "BETA_FACTOR", totalProbability: 0.03 }];
    const run = build(esq, AS_SET, sy);
    const overrides = { events: [{ id: E1, probability: 1 }, { id: "e-absent", probability: 1 }], ccfGroups: [{ id: "ccf-pumps", probability: 1 }, { id: "ccf-absent", probability: 1 }] };
    expect(caseOverridesFor(overrides, run)).toEqual({ events: [{ id: E1, probability: 1 }], ccfGroups: [{ id: "ccf-pumps", probability: 1 }] });
    expect(caseOverridesFor({ events: [{ id: "e-absent", probability: 1 }], ccfGroups: [{ id: "ccf-absent", probability: 1 }] }, run)).toBeUndefined();
    expect(caseOverridesFor(undefined, run)).toBeUndefined();
  });

  it("refuses a probability bound to a failure rate", () => {
    const esq = workbook();
    esq.modelDecisions = { ...esq.modelDecisions, valueBindings: [{ eventId: E1, heldBy: "DA", holderId: P3, reason: "Test." }] };
    expect(buildError(() => build(esq))).toBe("SY models E1 with a probability, but its value is a rate. Bind it to a probability.");
  });

  it("names what is missing before a run", () => {
    const blank = createBlankEsq("ESQ", "analyst");
    expect(buildError(() => build(blank))).toBe("Import the model in Step 02 before running.");
    expect(buildError(() => buildEsqEventTreeRun({ esq: workbook(), treeId: "T2", sy: systems(), syWorkbookId: "sy-1", syRevision: 4, esqWorkbookId: "esq-1", esqRevision: 7, logic: AS_SET })))
      .toBe("ET-T2 is entered by transfer. Run the tree that transfers into it.");
    const unlinked = workbook();
    unlinked.modelDecisions = {};
    expect(buildError(() => build(unlinked))).toBe("Recovery in ET-T1 is not linked. Link it in Step 02.");
    const noFrequency = workbook();
    if (noFrequency.model !== undefined) noFrequency.model.initiators = [];
    expect(buildError(() => build(noFrequency))).toBe("ET-T1 has no initiator frequency. Complete the Initiators tab of Step 02.");
  });

  describe("Step 06 post-processing as logic", () => {
    function humanWorkbook(): EventSequenceQuantification {
      const esq = workbook();
      const model = esq.model;
      if (model === undefined) throw new Error("fixture has no model");
      model.humanEvents = [
        { id: "H1", name: "Operator fails to restart", timing: "POST_INITIATOR", value: 0.12, riskSignificant: true, distributionGiven: false },
        { id: "H2", name: "Operator fails to align", timing: "PRE_INITIATOR", value: 0.05, riskSignificant: false, distributionGiven: false },
      ];
      model.events = model.events.map((event) => (event.id === E1 ? { ...event, heldBy: "HRA" as const, holderId: "H1" } : event.id === E2 ? { ...event, heldBy: "HRA" as const, holderId: "H2" } : event));
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

    it("writes a credited recovery as the event AND its non-recovery", () => {
      const esq = humanWorkbook();
      esq.postWork = { recoveries: [{ id: "REC-1", groupIds: [], stateIds: [], credited: true, basis: "Remote panel." }] };
      const run = build(esq);
      expect(gateOf(run, FT_A, "a-e1")?.gateType).toBe("AND");
      expect(childEvents(run, FT_A, "a-e1")).toEqual([E1, esqRecoveryEventId("REC-1")].sort());
      expect(catalogueValue(run, esqRecoveryEventId("REC-1"))).toBe(0.2);
      expect(run.humanEventIds).toEqual([E1, E2, esqRecoveryEventId("REC-1")].sort());
      expect(run.nominal[esqRecoveryEventId("REC-1")]).toBe(0.2);
      expect(run.nominal[E1]).toBe(0.12);
      expect(gateOf(build(esq, { ...AS_SET, recovery: false }), FT_A, "a-e1")).toBeUndefined();
      const uncredited = humanWorkbook();
      uncredited.postWork = { recoveries: [{ id: "REC-1", groupIds: [], stateIds: [], credited: false, basis: "" }] };
      expect(gateOf(build(uncredited), FT_A, "a-e1")).toBeUndefined();
      const infeasible = humanWorkbook();
      const record = infeasible.model?.recoveries?.[0];
      if (record !== undefined) record.feasibility = { ...record.feasibility, crew: false };
      infeasible.postWork = { recoveries: [{ id: "REC-1", groupIds: [], stateIds: [], credited: true, basis: "" }] };
      expect(gateOf(build(infeasible), FT_A, "a-e1")).toBeUndefined();
      const elsewhere = humanWorkbook();
      elsewhere.postWork = { recoveries: [{ id: "REC-1", groupIds: ["IE9"], stateIds: [], credited: true, basis: "" }] };
      expect(gateOf(build(elsewhere), FT_A, "a-e1")).toBeUndefined();
    });

    it("writes a dependent pair as a joint event shared by independent parts", () => {
      const esq = humanWorkbook();
      esq.postWork = { combinations: [{ id: "HC-1", eventIds: [E1, E2], ofRecord: "TYPED", typed: { joint: 0.03, source: "Hand assessment." }, groupIds: [], stateIds: [], basis: "Same crew." }] };
      const run = build(esq);
      const joint = esqJointEventId("HC-1");
      for (const [modelId, leafId, eventId] of [[FT_A, "a-e1", E1], [FT_A, "a-e2", E2], [FT_B, "b-e2", E2]] as const) {
        expect(gateOf(run, modelId, leafId)?.gateType).toBe("OR");
        expect(childEvents(run, modelId, leafId)).toEqual([esqIndependentEventId(eventId), joint].sort());
      }
      const g = (0.03 - 0.12 * 0.05) / (1 + 0.03 - 0.12 - 0.05);
      expect(catalogueValue(run, joint)).toBeCloseTo(g, 14);
      expect(catalogueValue(run, esqIndependentEventId(E1))).toBeCloseTo((0.12 - g) / (1 - g), 14);
      expect(catalogueValue(run, esqIndependentEventId(E2))).toBeCloseTo((0.05 - g) / (1 - g), 14);
      expect(gateOf(build(esq, { ...AS_SET, dependency: false }), FT_A, "a-e1")).toBeUndefined();
      const above = humanWorkbook();
      above.postWork = { combinations: [{ id: "HC-1", eventIds: [E1, E2], ofRecord: "TYPED", typed: { joint: 0.2, source: "" }, groupIds: [], stateIds: [], basis: "" }] };
      expect(buildError(() => build(above))).toBe("HC-1: The joint HEP 0.200 exceeds a member HEP of 0.0500. Fix it in Step 06.");
    });

    it("raises every HEP and skips the dependencies for the combination search", () => {
      const esq = humanWorkbook();
      esq.postWork = {
        recoveries: [{ id: "REC-1", groupIds: [], stateIds: [], credited: true, basis: "" }],
        combinations: [{ id: "HC-1", eventIds: [E1, E2], ofRecord: "TYPED", typed: { joint: 0.03, source: "" }, groupIds: [], stateIds: [], basis: "" }],
      };
      const run = buildEsqEventTreeRun({ esq, treeId: "T1", sy: systems(), syWorkbookId: "sy-1", syRevision: 4, esqWorkbookId: "esq-1", esqRevision: 7, logic: AS_SET, raisedHep: 0.8 });
      expect(catalogueValue(run, E1)).toBe(0.8);
      expect(catalogueValue(run, E2)).toBe(0.8);
      expect(catalogueValue(run, esqRecoveryEventId("REC-1"))).toBe(0.8);
      expect(catalogueValue(run, esqJointEventId("HC-1"))).toBeUndefined();
      expect(run.nominal[E2]).toBe(0.05);
    });
  });
});

