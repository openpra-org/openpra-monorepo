import { execute } from "praxis-node";
import type { EsqModel, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { CommonCauseFailureGroup, SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type { CcfFactorModel, Law, UncertainExpression, UncertainUnit, UncertainVector, UncertainVectorParameter } from "interfaces-mef-types/core/uncertainty";
import type { FaultTreeGate } from "interfaces-mef-types/modeling/fault-tree";
import type { WorkbookParameterReference } from "interfaces-mef-types/modeling/references";
import { esqSequenceRunId } from "interfaces-mef-types/esq/esq-run-inputs";
import { FrequencyUnit } from "interfaces-mef-types/core/events";
import type { EsqEventTreeRunLogic } from "interfaces-shared-types/newly-developed-methods";
import { createBlankEsq } from "../blank-esq";
import { createBlankSy } from "../../sy-workbooks/blank-sy";
import { buildEsqEventTreeRun, type EsqRunBuild } from "../esq-model-run-builder";
import { combineFaultTrees } from "../../newly-developed-methods/shared/workbook-analysis-runs.service";

interface SequenceResult {
  sequenceId: string;
  conditionalProbability: number;
  annualFrequency: number;
}

interface FamilySamples {
  familyId: string;
  values: number[];
}

interface NativeAnswer {
  result?: { sequences: SequenceResult[]; sampling?: { trials: number; families: FamilySamples[] } };
  error?: { message: string };
}

interface TreeRun {
  failed: SequenceResult;
  samples?: number[];
}

interface GroupSpec {
  id: string;
  size: number;
  factors: CcfFactorModel;
  total?: UncertainExpression;
}

const FT = "4f000000-0000-4000-8000-000000000001";
const DA = "da-1";
const FREQUENCY = 2;
const TRIALS = 40_000;
const LOGIC: EsqEventTreeRunLogic = { flags: true, loopBreaks: "AS_SET", exclusions: true, expandCcf: true };

function lawValue(unit: UncertainUnit, law: Law): UncertainExpression {
  return { node: "VALUE", value: { unit, law } };
}

function point(unit: UncertainUnit, value: number): UncertainExpression {
  return lawValue(unit, { family: "POINT", value });
}

function fixed(values: number[]): UncertainVector {
  return { node: "VALUE", law: { family: "FIXED", values } };
}

function dirichlet(concentrations: number[]): UncertainVector {
  return { node: "VALUE", law: { family: "DIRICHLET", concentrations } };
}

function betaLaw(alpha: number, beta: number): UncertainExpression {
  return lawValue("FRACTION", { family: "BETA", alpha, beta, lower: 0, upper: 1 });
}

function members(group: GroupSpec): string[] {
  return Array.from({ length: group.size }, (_, index) => `${group.id}-member-${index + 1}`);
}

function systems(top: FaultTreeGate, groups: GroupSpec[], memberValue: UncertainExpression): SystemsAnalysis {
  const events = groups.flatMap(members);
  const sy = createBlankSy("SY", "analyst");
  sy.systemLogicModels = [{
    uuid: FT,
    code: "FT-CCF",
    name: "Common cause check",
    systemReference: "system-1",
    description: "",
    modelRepresentation: "Fault tree",
    topGate: { gateId: top.id },
    gates: [top],
    leafNodes: events.map((id) => ({ id: `leaf-${id}`, kind: "BASIC_EVENT_REFERENCE" as const, basicEventId: id })),
    gateInputs: events.map((id, order) => ({ id: `input-${id}`, gateId: top.id, childId: `leaf-${id}`, order })),
    nodePositions: [],
    layout: { viewport: { x: 0, y: 0, zoom: 1 }, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" },
    implementsSrs: [],
  }];
  sy.systemBasicEvents = events.map((id) => ({ uuid: id, code: id, name: id, eventType: "BASIC", failureMode: "FAILURE_TO_START", expression: memberValue, implementsSrs: [] }));
  sy.commonCauseFailureGroups = groups.map((group): CommonCauseFailureGroup => ({
    uuid: group.id,
    name: group.id,
    description: "",
    scope: "INTRASYSTEM",
    affectedComponents: [],
    affectedSystems: ["system-1"],
    factors: group.factors,
    ...(group.total === undefined ? {} : { total: group.total }),
    members: { basicEvents: members(group).map((id) => ({ id })) },
    implementsSrs: [],
  }));
  return sy;
}

function snapshot(sy: SystemsAnalysis, groups: GroupSpec[], memberValue: UncertainExpression, vectors: UncertainVectorParameter[]): EsqModel {
  const top = sy.systemLogicModels[0];
  return {
    importedAt: "2026-10-10T12:00:00.000Z",
    sources: [{ element: "SY", workbookId: "sy-1", workbookName: "SY" }, { element: "DA", workbookId: DA, workbookName: "DA" }],
    trees: [{ id: "T1", code: "ET-T1", name: "Loss of cooling", initiatorId: "IE1", stateId: "S1", functionIds: ["F1"], transferEntry: false }],
    sequences: [
      { id: "Q1", code: "Q1", treeId: "T1", path: { F1: "SUCCESS" }, endState: "OK" },
      { id: "Q2", code: "Q2", treeId: "T1", path: { F1: "FAILURE" }, endState: "CD" },
    ],
    families: [],
    functions: [{ id: "F1", name: "Cooling", treeIds: ["T1"], esLinks: [{ treeId: "T1", top: { workbookId: "sy-1", modelId: FT, gateId: top?.topGate?.gateId ?? "" } }] }],
    tops: [{ modelId: FT, gateId: top?.topGate?.gateId ?? "", code: "FT-CCF", name: "FT-CCF", eventIds: sy.systemBasicEvents.map((event) => event.uuid), transferModelIds: [], gates: (top?.gates ?? []).map((gate) => ({ id: gate.id, code: gate.code, name: gate.name })), houseEvents: [] }],
    initiators: [{ id: "IE1", name: "Loss of cooling", stateIds: ["S1"], frequency: { expression: point("PER_YEAR", FREQUENCY), basis: FrequencyUnit.PER_PLANT_YEAR } }],
    states: [{ id: "S1", name: "Power operation", hours: 8760 }],
    events: sy.systemBasicEvents.map((event) => ({ id: event.uuid, code: event.code, name: event.name, heldBy: "TYPED" as const, failureMode: "FAILURE_TO_START", expression: memberValue })),
    ccfGroups: groups.map((group) => ({ id: group.id, name: group.id, systemIds: ["system-1"], memberIds: members(group), factors: group.factors, ...(group.total === undefined ? {} : { total: group.total }) })),
    parameters: [],
    ...(vectors.length === 0 ? {} : { vectors }),
    humanEvents: [],
  };
}

function scenario(top: FaultTreeGate, groups: GroupSpec[], memberValue: UncertainExpression, vectors: UncertainVectorParameter[] = []): { esq: EventSequenceQuantification; sy: SystemsAnalysis } {
  const sy = systems(top, groups, memberValue);
  const esq = createBlankEsq("ESQ", "analyst");
  esq.linkedWorkbooks = { ...esq.linkedWorkbooks, DA };
  esq.model = snapshot(sy, groups, memberValue, vectors);
  return { esq, sy };
}

function kOfN(group: GroupSpec, k: number): { esq: EventSequenceQuantification; sy: SystemsAnalysis } {
  return scenario({ id: "top", kind: "GATE", gateType: "K_OF_N", k, code: "TOP", name: "Top", description: "" }, [group], group.total ?? point("PROBABILITY", 0.01));
}

function runTree(input: { esq: EventSequenceQuantification; sy: SystemsAnalysis }, sampling?: { trials: number; seed: number; method: "MONTE_CARLO" | "LATIN_HYPERCUBE" }): TreeRun {
  const build: EsqRunBuild = buildEsqEventTreeRun({ esq: input.esq, treeId: "T1", sy: input.sy, syWorkbookId: "sy-1", syRevision: 1, missionTimes: new Map(), esqWorkbookId: "esq-1", esqRevision: 1, logic: LOGIC, points: new Map() });
  const faultTrees = combineFaultTrees("esq-ccf", build.faultTrees, build.initiatorTables);
  const answer: NativeAnswer = JSON.parse(execute(JSON.stringify({
    schemaVersion: "1.0.0",
    request: {
      schemaVersion: "1.0.0",
      methodType: "EVENT_TREE",
      modelId: build.rootModelId,
      revision: 1,
      mode: "INDEPENDENT",
      requestedBy: "analyst",
      expandCcf: true,
      ...(sampling === undefined ? {} : { sampling, sequenceFamilies: { [esqSequenceRunId("T1", "Q2")]: "CD" } }),
    },
    modelSnapshots: [...build.eventTreeSnapshots, ...faultTrees.modelSnapshots],
    resources: { faultTreeBasicEventCatalogue: faultTrees.resource },
  })));
  if (answer.error !== undefined) throw new Error(answer.error.message);
  const failed = answer.result?.sequences.find((sequence) => sequence.sequenceId === esqSequenceRunId("T1", "Q2"));
  if (failed === undefined) throw new Error("PRAXIS returned no failure sequence.");
  const samples = answer.result?.sampling?.families.find((family) => family.familyId === "CD")?.values;
  return samples === undefined ? { failed } : { failed, samples };
}

function sampledMean(input: { esq: EventSequenceQuantification; sy: SystemsAnalysis }, method: "MONTE_CARLO" | "LATIN_HYPERCUBE"): number {
  const samples = runTree(input, { trials: TRIALS, seed: 2026, method }).samples ?? [];
  expect(samples).toHaveLength(TRIALS);
  return samples.reduce((sum, value) => sum + value, 0) / samples.length / FREQUENCY;
}

function relative(actual: number, expected: number): number {
  return Math.abs(actual / expected - 1);
}

const POINT_CASES: [string, GroupSpec, number, number][] = [
  ["beta factor", { id: "beta3", size: 3, factors: { model: "BETA_FACTOR", beta: point("FRACTION", 0.1) }, total: point("PROBABILITY", 0.01) }, 2, 0.001241300458],
  ["MGL", { id: "mgl4", size: 4, factors: { model: "MGL", factors: [point("FRACTION", 0.05), point("FRACTION", 0.4)] }, total: point("PROBABILITY", 0.02) }, 2, 0.0038398491229693957],
  ["non-staggered alpha factor", { id: "alphaNon3", size: 3, factors: { model: "ALPHA_FACTOR", testing: "NON_STAGGERED", alphas: fixed([0.95, 0.03, 0.02]) }, total: point("PROBABILITY", 0.01) }, 2, 0.0016359162262407875],
  ["staggered alpha factor", { id: "alphaStag3", size: 3, factors: { model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: fixed([0.95, 0.03, 0.02]) }, total: point("PROBABILITY", 0.01) }, 2, 0.000918702936330337],
  ["phi factor", { id: "phi3", size: 3, factors: { model: "PHI_FACTOR", phis: fixed([0.9, 0.07, 0.03]) }, total: point("PROBABILITY", 0.01) }, 2, 0.0026388635901459564],
  ["Dirichlet alpha factor at 8 members", { id: "alphaNon8", size: 8, factors: { model: "ALPHA_FACTOR", testing: "NON_STAGGERED", alphas: dirichlet([400, 6, 3, 2, 1.5, 1, 0.8, 0.7]) }, total: point("PROBABILITY", 0.03) }, 4, 0.003437164424207464],
  ["binomial failure rate", { id: "bfr4", size: 4, factors: { model: "BINOMIAL_FAILURE_RATE", independent: point("PROBABILITY", 0.004), nonLethalShock: point("PROBABILITY", 0.002), componentFailure: point("FRACTION", 0.3), lethalShock: point("PROBABILITY", 0.0001) } }, 2, 0.0009017699766336327],
];

const SAMPLED_CASES: [string, GroupSpec, number, number, number][] = [
  ["beta factor", { id: "beta3s", size: 3, factors: { model: "BETA_FACTOR", beta: betaLaw(2, 18) }, total: point("PROBABILITY", 0.05) }, 2, 0.010895122811970633, 0.0024499381007417865],
  ["MGL", { id: "mgl3s", size: 3, factors: { model: "MGL", factors: [betaLaw(2, 18), point("FRACTION", 0.3)] }, total: point("PROBABILITY", 0.05) }, 2, 0.012611483098049468, 0.0035606562161108854],
  ["non-staggered alpha factor", { id: "alphaNon3s", size: 3, factors: { model: "ALPHA_FACTOR", testing: "NON_STAGGERED", alphas: dirichlet([20, 3, 2]) }, total: point("PROBABILITY", 0.05) }, 2, 0.025663349875331816, 0.005999321829737213],
  ["staggered alpha factor", { id: "alphaStag3s", size: 3, factors: { model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: dirichlet([20, 3, 2]) }, total: point("PROBABILITY", 0.05) }, 2, 0.017588955503324243, 0.004288692127015675],
  ["phi factor", { id: "phi3s", size: 3, factors: { model: "PHI_FACTOR", phis: dirichlet([20, 3, 2]) }, total: point("PROBABILITY", 0.05) }, 2, 0.026412483721554518, 0.008661309561950789],
  ["binomial failure rate", { id: "bfr3s", size: 3, factors: { model: "BINOMIAL_FAILURE_RATE", independent: point("PROBABILITY", 0.004), nonLethalShock: point("PROBABILITY", 0.01), componentFailure: betaLaw(3, 7), lethalShock: point("PROBABILITY", 0.0002) } }, 2, 0.002643180463896287, 0.0017129078711912563],
];

const SHARED: WorkbookParameterReference = { referenceType: "WORKBOOK_PARAMETER", workbookId: DA, entityId: "VEC-CCF-DEM-2" };

describe("common cause models through an ESQ event tree and PRAXIS", () => {
  it.each(POINT_CASES)("matches the hand value of the %s on the failure sequence", (_, group, k, expected) => {
    const sequence = runTree(kOfN(group, k)).failed;
    expect(relative(sequence.conditionalProbability, expected)).toBeLessThan(1e-12);
    expect(relative(sequence.annualFrequency, FREQUENCY * expected)).toBeLessThan(1e-12);
  });

  it.each(SAMPLED_CASES)("samples the %s and matches its exact mean", (_, group, k, mean, deviation) => {
    for (const method of ["MONTE_CARLO", "LATIN_HYPERCUBE"] as const) {
      expect(Math.abs(sampledMean(kOfN(group, k), method) - mean)).toBeLessThan(5 * deviation / Math.sqrt(TRIALS));
    }
  });

  it("sends a DA vector two groups share and draws it once per trial", () => {
    const pair = (id: string): GroupSpec => ({ id, size: 2, factors: { model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: { node: "PARAMETER", reference: SHARED } }, total: point("PROBABILITY", 0.2) });
    const vectors: UncertainVectorParameter[] = [{ reference: SHARED, vector: { family: "DIRICHLET", concentrations: [3, 2] } }];
    const input = scenario({ id: "top", kind: "GATE", gateType: "AND", code: "TOP", name: "Top", description: "" }, [pair("pumps"), pair("valves")], point("PROBABILITY", 0.2), vectors);
    expect(relative(runTree(input).failed.conditionalProbability, 0.008695189504000002)).toBeLessThan(1e-12);
    const error = 0.00649054601429999 / Math.sqrt(TRIALS);
    for (const method of ["MONTE_CARLO", "LATIN_HYPERCUBE"] as const) {
      const mean = sampledMean(input, method);
      expect(Math.abs(mean - 0.01000472380952381)).toBeLessThan(5 * error);
      expect(Math.abs(mean - 0.00904129306122449)).toBeGreaterThan(15 * error);
    }
  });
});
