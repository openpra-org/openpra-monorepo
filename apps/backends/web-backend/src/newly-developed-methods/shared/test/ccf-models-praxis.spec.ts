import { execute } from "praxis-node";
import {
  parameterReferenceKey,
  type CcfFactorModel,
  type Law,
  type UncertainExpression,
  type UncertainUnit,
  type UncertainVector,
  type UncertainVectorParameter,
} from "interfaces-mef-types/core/uncertainty";
import type { FaultTreeGate, FaultTreeGateInput, FaultTreeLeafNode } from "interfaces-mef-types/modeling/fault-tree";
import type { WorkbookParameterReference } from "interfaces-mef-types/modeling/references";
import type { CommonCauseFailureGroup, SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { SystemsAnalysisSchema } from "interfaces-mef-types/zod/sy/systems-analysis";
import { FaultTreeExecuteRequestSchema } from "interfaces-shared-types/newly-developed-methods/fault-tree";
import type { UncertaintySamplingMethod } from "interfaces-shared-types/newly-developed-methods/shared";
import { createBlankSy } from "../../../sy-workbooks/blank-sy";
import { adaptSyFaultTreeSnapshot } from "../praxis-snapshot-adapters";
import { combineFaultTrees } from "../workbook-analysis-runs.service";

interface UncertaintyResult {
  mean: number;
  standardError: number;
  sampleCount: number;
}

interface NativeAnswer {
  result?: { topEventProbability?: number; uncertainty?: UncertaintyResult };
  error?: { message: string };
}

interface GroupSpec {
  id: string;
  members: string[];
  factors: CcfFactorModel;
  total?: UncertainExpression;
}

const MODEL_ID = "30000000-0000-4000-8000-000000000001";
const TOP_ID = "30000000-0000-4000-8000-000000000002";
const TRIALS = 40_000;

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

function eventId(group: string, index: number): string {
  return `${group}-member-${index + 1}`;
}

function memberIds(group: string, size: number): string[] {
  return Array.from({ length: size }, (_, index) => eventId(group, index));
}

function gate(id: string, gateType: "AND" | "OR" | "K_OF_N", k?: number): FaultTreeGate {
  const base = { id, kind: "GATE" as const, code: id.toUpperCase(), name: id, description: "" };
  return gateType === "K_OF_N" ? { ...base, gateType, k: k ?? 1 } : { ...base, gateType };
}

function groupOf(spec: GroupSpec): CommonCauseFailureGroup {
  return {
    uuid: spec.id,
    name: spec.id,
    description: "",
    scope: "INTRASYSTEM",
    affectedComponents: [],
    affectedSystems: ["system-1"],
    factors: spec.factors,
    ...(spec.total === undefined ? {} : { total: spec.total }),
    members: { basicEvents: spec.members.map((id) => ({ id })) },
    implementsSrs: [],
  };
}

function tree(top: FaultTreeGate, groups: GroupSpec[], memberValue: UncertainExpression): SystemsAnalysis {
  const events = groups.flatMap((group) => group.members);
  const leafNodes: FaultTreeLeafNode[] = events.map((id) => ({ id: `leaf-${id}`, kind: "BASIC_EVENT_REFERENCE", basicEventId: id }));
  const gateInputs: FaultTreeGateInput[] = leafNodes.map((leaf, order) => ({ id: `input-${leaf.id}`, gateId: top.id, childId: leaf.id, order }));
  return SystemsAnalysisSchema.parse({
    ...createBlankSy("SY", "analyst"),
    systemLogicModels: [{
      uuid: MODEL_ID,
      code: "FT-CCF",
      name: "Common cause model check",
      systemReference: "system-1",
      description: "",
      modelRepresentation: "FAULT_TREE",
      topGate: { gateId: top.id },
      gates: [top],
      leafNodes,
      gateInputs,
      nodePositions: [],
      layout: { viewport: { x: 0, y: 0, zoom: 1 }, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" },
      implementsSrs: [],
    }],
    systemBasicEvents: events.map((id) => ({ uuid: id, code: id, name: id, eventType: "BASIC", failureMode: "FAILURE_TO_START", expression: memberValue, implementsSrs: [] })),
    commonCauseFailureGroups: groups.map(groupOf),
  });
}

function kOfN(group: GroupSpec, k: number): SystemsAnalysis {
  const total = group.total ?? point("PROBABILITY", 0.01);
  return tree(gate(TOP_ID, "K_OF_N", k), [group], total);
}

function run(sy: SystemsAnalysis, calculationType: "PROBABILITY" | "UNCERTAINTY", samplingMethod: UncertaintySamplingMethod = "MONTE_CARLO", vectors: UncertainVectorParameter[] = []): NativeAnswer["result"] {
  const sources = new Map(vectors.map((vector) => [parameterReferenceKey(vector.reference), vector]));
  const adapted = adaptSyFaultTreeSnapshot({ workbookId: "sy-1", workbookRevision: 1, mef: sy }, MODEL_ID, { vectors: sources });
  const bundle = combineFaultTrees(`ccf-${calculationType}-${samplingMethod}`, [adapted]);
  const request = FaultTreeExecuteRequestSchema.parse({
    schemaVersion: "1.0.0",
    modelId: MODEL_ID,
    workbookRevision: 1,
    calculationType,
    workflow: "MANUAL",
    settings: { algorithm: "BDD", approximation: "EXACT", variableOrder: "DFS", reorderBudgetSeconds: 60, expandCcf: true, numTrials: TRIALS, seed: 2026, samplingMethod },
  });
  const answer: NativeAnswer = JSON.parse(execute(JSON.stringify({
    schemaVersion: "1.0.0",
    request: {
      schemaVersion: "1.0.0",
      methodType: "FAULT_TREE",
      modelId: MODEL_ID,
      revision: 1,
      requestedBy: "analyst",
      calculationType: request.calculationType,
      workflow: request.workflow,
      settings: request.settings,
    },
    modelSnapshots: bundle.modelSnapshots,
    resources: { faultTreeBasicEventCatalogue: bundle.resource },
  })));
  if (answer.error !== undefined) throw new Error(answer.error.message);
  return answer.result;
}

function top(sy: SystemsAnalysis): number {
  const value = run(sy, "PROBABILITY")?.topEventProbability;
  if (value === undefined) throw new Error("PRAXIS returned no top event probability.");
  return value;
}

function sampled(sy: SystemsAnalysis, samplingMethod: UncertaintySamplingMethod, vectors: UncertainVectorParameter[] = []): UncertaintyResult {
  const value = run(sy, "UNCERTAINTY", samplingMethod, vectors)?.uncertainty;
  if (value === undefined) throw new Error("PRAXIS returned no uncertainty result.");
  return value;
}

function relative(actual: number, expected: number): number {
  return Math.abs(actual / expected - 1);
}

const ALPHAS_8 = [400, 6, 3, 2, 1.5, 1, 0.8, 0.7];

const POINT_CASES: [string, GroupSpec, number, number][] = [
  ["beta factor at 3 members", { id: "beta3", members: memberIds("beta3", 3), factors: { model: "BETA_FACTOR", beta: point("FRACTION", 0.1) }, total: point("PROBABILITY", 0.01) }, 2, 0.001241300458],
  ["MGL with 2 factors at 4 members", { id: "mgl4", members: memberIds("mgl4", 4), factors: { model: "MGL", factors: [point("FRACTION", 0.05), point("FRACTION", 0.4)] }, total: point("PROBABILITY", 0.02) }, 2, 0.0038398491229693957],
  ["MGL with 5 factors at 6 members", { id: "mgl6", members: memberIds("mgl6", 6), factors: { model: "MGL", factors: [0.0103, 0.581, 0.544, 0.435, 0.266].map((value) => point("FRACTION", value)) }, total: point("PROBABILITY", 0.02) }, 3, 0.00036495887700997416],
  ["non-staggered alpha factor at 3 members", { id: "alphaNon3", members: memberIds("alphaNon3", 3), factors: { model: "ALPHA_FACTOR", testing: "NON_STAGGERED", alphas: fixed([0.95, 0.03, 0.02]) }, total: point("PROBABILITY", 0.01) }, 2, 0.0016359162262407875],
  ["staggered alpha factor at 3 members", { id: "alphaStag3", members: memberIds("alphaStag3", 3), factors: { model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: fixed([0.95, 0.03, 0.02]) }, total: point("PROBABILITY", 0.01) }, 2, 0.000918702936330337],
  ["phi factor at 3 members", { id: "phi3", members: memberIds("phi3", 3), factors: { model: "PHI_FACTOR", phis: fixed([0.9, 0.07, 0.03]) }, total: point("PROBABILITY", 0.01) }, 2, 0.0026388635901459564],
  ["non-staggered Dirichlet alpha factor at 8 members", { id: "alphaNon8", members: memberIds("alphaNon8", 8), factors: { model: "ALPHA_FACTOR", testing: "NON_STAGGERED", alphas: dirichlet(ALPHAS_8) }, total: point("PROBABILITY", 0.03) }, 4, 0.003437164424207464],
  ["binomial failure rate at 4 members", {
    id: "bfr4",
    members: memberIds("bfr4", 4),
    factors: { model: "BINOMIAL_FAILURE_RATE", independent: point("PROBABILITY", 0.004), nonLethalShock: point("PROBABILITY", 0.002), componentFailure: point("FRACTION", 0.3), lethalShock: point("PROBABILITY", 0.0001) },
  }, 2, 0.0009017699766336327],
];

const SAMPLED_CASES: [string, GroupSpec, number, number, number][] = [
  ["beta factor with a beta law", { id: "beta3s", members: memberIds("beta3s", 3), factors: { model: "BETA_FACTOR", beta: betaLaw(2, 18) }, total: point("PROBABILITY", 0.05) }, 2, 0.010895122811970633, 0.0024499381007417865],
  ["MGL with a beta law on beta", { id: "mgl3s", members: memberIds("mgl3s", 3), factors: { model: "MGL", factors: [betaLaw(2, 18), point("FRACTION", 0.3)] }, total: point("PROBABILITY", 0.05) }, 2, 0.012611483098049468, 0.0035606562161108854],
  ["non-staggered Dirichlet alpha factor", { id: "alphaNon3s", members: memberIds("alphaNon3s", 3), factors: { model: "ALPHA_FACTOR", testing: "NON_STAGGERED", alphas: dirichlet([20, 3, 2]) }, total: point("PROBABILITY", 0.05) }, 2, 0.025663349875331816, 0.005999321829737213],
  ["staggered Dirichlet alpha factor", { id: "alphaStag3s", members: memberIds("alphaStag3s", 3), factors: { model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: dirichlet([20, 3, 2]) }, total: point("PROBABILITY", 0.05) }, 2, 0.017588955503324243, 0.004288692127015675],
  ["Dirichlet phi factor", { id: "phi3s", members: memberIds("phi3s", 3), factors: { model: "PHI_FACTOR", phis: dirichlet([20, 3, 2]) }, total: point("PROBABILITY", 0.05) }, 2, 0.026412483721554518, 0.008661309561950789],
  ["binomial failure rate with a beta law on p", {
    id: "bfr3s",
    members: memberIds("bfr3s", 3),
    factors: { model: "BINOMIAL_FAILURE_RATE", independent: point("PROBABILITY", 0.004), nonLethalShock: point("PROBABILITY", 0.01), componentFailure: betaLaw(3, 7), lethalShock: point("PROBABILITY", 0.0002) },
  }, 2, 0.002643180463896287, 0.0017129078711912563],
];

const SHARED: WorkbookParameterReference = { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "VEC-CCF-DEM-2" };
const OTHER: WorkbookParameterReference = { ...SHARED, entityId: "VEC-CCF-RATE-2" };
const SHARED_LAW = { family: "DIRICHLET" as const, concentrations: [3, 2] };

function pairs(first: WorkbookParameterReference, second: WorkbookParameterReference): SystemsAnalysis {
  const group = (id: string, reference: WorkbookParameterReference): GroupSpec => ({
    id,
    members: memberIds(id, 2),
    factors: { model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: { node: "PARAMETER", reference } },
    total: point("PROBABILITY", 0.2),
  });
  return tree(gate(TOP_ID, "AND"), [group("pumps", first), group("valves", second)], point("PROBABILITY", 0.2));
}

describe("common cause models through an SY fault tree and PRAXIS", () => {
  it.each(POINT_CASES)("matches the hand value of the %s", (_, group, k, expected) => {
    expect(relative(top(kOfN(group, k)), expected)).toBeLessThan(1e-12);
  });

  it.each(SAMPLED_CASES)("samples the %s and matches its exact mean", (_, group, k, mean, deviation) => {
    for (const method of ["MONTE_CARLO", "LATIN_HYPERCUBE"] as const) {
      const result = sampled(kOfN(group, k), method);
      expect(result.sampleCount).toBe(TRIALS);
      expect(Math.abs(result.mean - mean)).toBeLessThan(5 * deviation / Math.sqrt(TRIALS));
    }
  });

  it("draws one vector per trial for two groups that link one DA vector", () => {
    const vectors: UncertainVectorParameter[] = [{ reference: SHARED, vector: SHARED_LAW }, { reference: OTHER, vector: SHARED_LAW }];
    const sharedMean = 0.01000472380952381;
    const independentMean = 0.00904129306122449;
    const deviation = 0.00649054601429999;
    const error = deviation / Math.sqrt(TRIALS);
    const adapted = adaptSyFaultTreeSnapshot({ workbookId: "sy-1", workbookRevision: 1, mef: pairs(SHARED, SHARED) }, MODEL_ID, { vectors: new Map(vectors.map((vector) => [parameterReferenceKey(vector.reference), vector])) });
    expect(adapted.basicEventCatalogue.uncertaintyVectors).toEqual([vectors[0]]);
    expect(relative(run(pairs(SHARED, SHARED), "PROBABILITY", "MONTE_CARLO", vectors)?.topEventProbability ?? 0, 0.008695189504000002)).toBeLessThan(1e-12);
    for (const method of ["MONTE_CARLO", "LATIN_HYPERCUBE"] as const) {
      const shared = sampled(pairs(SHARED, SHARED), method, vectors);
      expect(Math.abs(shared.mean - sharedMean)).toBeLessThan(5 * error);
      expect(Math.abs(shared.mean - independentMean)).toBeGreaterThan(15 * error);
      const separate = sampled(pairs(SHARED, OTHER), method, vectors);
      expect(Math.abs(separate.mean - independentMean)).toBeLessThan(5 * error);
    }
  });
});
