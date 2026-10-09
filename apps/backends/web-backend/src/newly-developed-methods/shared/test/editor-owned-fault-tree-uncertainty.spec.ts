import { execute } from "praxis-node";
import {
  parameterReferenceKey,
  type UncertainExpression,
  type UncertainParameter,
} from "interfaces-mef-types/core/uncertainty";
import type { WorkbookParameterReference } from "interfaces-mef-types/modeling/references";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
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
  samplingMethod: UncertaintySamplingMethod;
}

interface NativeAnswer {
  result?: { topEventProbability?: number; uncertainty?: UncertaintyResult };
  error?: { message: string };
}

const MODEL_ID = "20000000-0000-4000-8000-000000000001";
const LOGNORMAL_EVENT = "20000000-0000-4000-8000-000000000007";
const MISSION_EVENT = "20000000-0000-4000-8000-000000000008";
const TRIALS = 40_000;
const LOGNORMAL_MEAN = 1e-3;
const GAMMA_SHAPE = 2;
const GAMMA_RATE = 2e5;
const MISSION_HOURS = 24;

const daRate: WorkbookParameterReference = { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "rate-pump-run" };
const scMission: WorkbookParameterReference = { referenceType: "WORKBOOK_PARAMETER", workbookId: "sc-1", entityId: "MT-1" };

const lognormal: UncertainExpression = {
  node: "VALUE",
  value: { unit: "PROBABILITY", law: { family: "TRUNCATED", law: { family: "LOGNORMAL", mean: LOGNORMAL_MEAN, errorFactor: 3, level: 0.95 }, lower: null, upper: 1 } },
};

const mission: UncertainExpression = {
  node: "MODEL",
  model: { form: "MISSION", rate: { node: "PARAMETER", reference: daRate }, missionTime: { node: "PARAMETER", reference: scMission } },
};

const parameters: ReadonlyMap<string, UncertainParameter> = new Map([
  [parameterReferenceKey(daRate), { reference: daRate, expression: { node: "VALUE", value: { unit: "PER_HOUR", law: { family: "GAMMA", shape: GAMMA_SHAPE, rate: GAMMA_RATE } } } }],
  [parameterReferenceKey(scMission), { reference: scMission, expression: { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: MISSION_HOURS } } } }],
]);

function editorOwnedTree(): SystemsAnalysis {
  return SystemsAnalysisSchema.parse({
    ...createBlankSy("SY", "analyst"),
    systemLogicModels: [{
      uuid: MODEL_ID,
      code: "FT-CUSTOM",
      name: "Fault tree built from custom basic events",
      systemReference: "system-1",
      description: "",
      modelRepresentation: "FAULT_TREE",
      topGate: { gateId: "20000000-0000-4000-8000-000000000002" },
      gates: [{ id: "20000000-0000-4000-8000-000000000002", code: "TOP", name: "Loss of cooling", description: "", kind: "GATE", gateType: "OR" }],
      leafNodes: [
        { id: "20000000-0000-4000-8000-000000000003", kind: "BASIC_EVENT_REFERENCE", basicEventId: LOGNORMAL_EVENT },
        { id: "20000000-0000-4000-8000-000000000004", kind: "BASIC_EVENT_REFERENCE", basicEventId: MISSION_EVENT },
      ],
      gateInputs: [
        { id: "20000000-0000-4000-8000-000000000005", gateId: "20000000-0000-4000-8000-000000000002", childId: "20000000-0000-4000-8000-000000000003", order: 0 },
        { id: "20000000-0000-4000-8000-000000000006", gateId: "20000000-0000-4000-8000-000000000002", childId: "20000000-0000-4000-8000-000000000004", order: 1 },
      ],
      nodePositions: [],
      layout: { viewport: { x: 0, y: 0, zoom: 1 }, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" },
      implementsSrs: [],
    }],
    systemBasicEvents: [
      { uuid: LOGNORMAL_EVENT, code: "BE-1", name: "New basic event", eventType: "BASIC", expression: lognormal, repairModeled: false, implementsSrs: [] },
      { uuid: MISSION_EVENT, code: "BE-2", name: "New basic event", eventType: "BASIC", expression: mission, repairModeled: false, implementsSrs: [] },
    ],
  });
}

function run(samplingMethod: UncertaintySamplingMethod): UncertaintyResult {
  const adapted = adaptSyFaultTreeSnapshot({ workbookId: "sy-1", workbookRevision: 1, mef: editorOwnedTree() }, MODEL_ID, { parameters });
  const bundle = combineFaultTrees(`editor-owned-${samplingMethod}`, [adapted]);
  const request = FaultTreeExecuteRequestSchema.parse({
    schemaVersion: "1.0.0",
    modelId: MODEL_ID,
    workbookRevision: 1,
    calculationType: "UNCERTAINTY",
    workflow: "MANUAL",
    settings: { algorithm: "BDD", approximation: "EXACT", variableOrder: "DFS", reorderBudgetSeconds: 60, expandCcf: false, numTrials: TRIALS, seed: 847, samplingMethod },
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
  const uncertainty = answer.result?.uncertainty;
  if (uncertainty === undefined) throw new Error("PRAXIS returned no uncertainty result.");
  return uncertainty;
}

describe("uncertainty runs of an editor-owned fault tree", () => {
  const exactMissionMean = 1 - (GAMMA_RATE / (GAMMA_RATE + MISSION_HOURS)) ** GAMMA_SHAPE;
  const exactTopMean = 1 - (1 - LOGNORMAL_MEAN) * (1 - exactMissionMean);

  it("sends each custom event's expression with its DA and SC links resolved", () => {
    const adapted = adaptSyFaultTreeSnapshot({ workbookId: "sy-1", workbookRevision: 1, mef: editorOwnedTree() }, MODEL_ID, { parameters });
    expect(adapted.basicEventCatalogue.basicEvents).toEqual([
      { id: LOGNORMAL_EVENT, expression: lognormal },
      { id: MISSION_EVENT, expression: mission },
    ]);
    expect(adapted.basicEventCatalogue.uncertaintyParameters).toEqual(expect.arrayContaining([...parameters.values()]));
    expect(adapted.basicEventCatalogue.uncertaintyParameters).toHaveLength(2);
  });

  it.each<UncertaintySamplingMethod>(["MONTE_CARLO", "LATIN_HYPERCUBE"])("samples the custom events by %s and matches the exact mean", (samplingMethod) => {
    const result = run(samplingMethod);
    expect(result).toMatchObject({ sampleCount: TRIALS, samplingMethod });
    expect(result.standardError).toBeGreaterThan(0);
    expect(Math.abs(result.mean - exactTopMean)).toBeLessThan(4 * result.standardError);
  });
});
