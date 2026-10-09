import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type { HumanFailureEventReference, WorkbookParameterReference } from "interfaces-mef-types/modeling/references";
import {
  parameterReferenceKey,
  type UncertainExpression,
  type UncertainParameter,
  type UncertainValue,
  type UncertainVectorParameter,
} from "interfaces-mef-types/core/uncertainty";
import { legacyExpression } from "interfaces-mef-types/core/legacy-uncertainty-adapter";
import type { HclUncertaintySettings } from "interfaces-mef-types/modeling/hybrid-causal-logic";
import { LoadCapacityModelSnapshotSchema } from "interfaces-shared-types/newly-developed-methods/load-capacity";
import { createBlankSy } from "../../../sy-workbooks/blank-sy";
import {
  WorkbookPraxisAdapterError,
  adaptEsEventTreeSnapshot,
  adaptEsqBayesianNetworkSnapshot,
  adaptLoadCapacitySnapshot,
  adaptSyBayesianNetworkSnapshot,
  adaptEsqHclSnapshot,
  adaptSyFaultTreeSnapshot,
  collectEsEventTreeReferences,
  collectHclUncertaintyReferences,
  collectLoadCapacityReferences,
  collectSyFaultTreeReferences,
  faultTreeControlledDataSourceKey,
  type PraxisModelSnapshot,
} from "../praxis-snapshot-adapters";

const probability = (value: number): UncertainExpression => ({
  node: "VALUE",
  value: { unit: "PROBABILITY", law: { family: "POINT", value } },
});

const daReference = (entityId: string): WorkbookParameterReference => ({
  referenceType: "WORKBOOK_PARAMETER",
  workbookId: "da-1",
  entityId,
});

const reading = (entityId: string): UncertainExpression => ({ node: "PARAMETER", reference: daReference(entityId) });

const valued = (unit: UncertainValue["unit"], value: number): UncertainExpression => ({
  node: "VALUE",
  value: { unit, law: { family: "POINT", value } },
});

const vectorTable = (entries: UncertainVectorParameter[]): ReadonlyMap<string, UncertainVectorParameter> =>
  new Map(entries.map((entry) => [parameterReferenceKey(entry.reference), entry]));

const estimate = (entityId: string, value: UncertainValue): UncertainParameter => ({
  reference: daReference(entityId),
  expression: { node: "VALUE", value },
});

const parameterTable = (entries: UncertainParameter[]): ReadonlyMap<string, UncertainParameter> =>
  new Map(entries.map((entry) => [parameterReferenceKey(entry.reference), entry]));

const syMef: SystemsAnalysis = {
  ...createBlankSy("SY", "analyst"),
  systemLogicModels: [
    {
      uuid: "ft-1",
      code: "FT-1",
      name: "Fault tree",
      systemReference: "system-1",
      description: "Fault tree",
      modelRepresentation: "Fault tree",
      topGate: { gateId: "top" },
      gates: [
        { id: "top", code: "TOP", name: "Top gate", description: "Top gate", kind: "GATE", gateType: "AND" },
        { id: "or-gate", code: "OR-1", name: "Backup gate", description: "Backup gate", kind: "GATE", gateType: "OR" },
      ],
      leafNodes: [
        { id: "leaf-a", kind: "BASIC_EVENT_REFERENCE", basicEventId: "be-a" },
        { id: "leaf-b", kind: "BASIC_EVENT_REFERENCE", basicEventId: "be-b" },
      ],
      gateInputs: [
        { id: "top:leaf-a:0", gateId: "top", childId: "leaf-a", order: 0 },
        { id: "top:or-gate:1", gateId: "top", childId: "or-gate", order: 1 },
        { id: "or-gate:leaf-b:0", gateId: "or-gate", childId: "leaf-b", order: 0 },
      ],
      nodePositions: [],
      layout: {
        viewport: { x: 0, y: 0, zoom: 1 },
        mode: "AUTOMATIC",
        direction: "TOP_TO_BOTTOM",
      },
      implementsSrs: [],
    },
  ],
  systemBasicEvents: [
    { uuid: "be-a", code: "BE-A", name: "Event A", eventType: "BASIC", expression: probability(0.2), implementsSrs: [] },
    {
      uuid: "be-b",
      code: "BE-B",
      name: "Event B",
      description: "Backup",
      eventType: "BASIC",
      expression: probability(0.1),
      implementsSrs: [],
    },
  ],
};

type SyLogicModel = SystemsAnalysis["systemLogicModels"][number];

const syLogicModel = (
  uuid: string,
  topGateId: string,
  gates: SyLogicModel["gates"],
  leafNodes: SyLogicModel["leafNodes"],
  gateInputs: SyLogicModel["gateInputs"],
  nodePositions: SyLogicModel["nodePositions"] = [],
): SyLogicModel => ({
  uuid,
  code: uuid.toUpperCase(),
  name: uuid,
  systemReference: `system:${uuid}`,
  description: uuid,
  modelRepresentation: "Fault tree",
  topGate: { gateId: topGateId },
  gates,
  leafNodes,
  gateInputs,
  nodePositions,
  layout: {
    viewport: { x: 0, y: 0, zoom: 1 },
    mode: "AUTOMATIC",
    direction: "TOP_TO_BOTTOM",
  },
  implementsSrs: [],
});

const gate = (id: string, gateType: "AND" | "OR" = "OR"): SyLogicModel["gates"][number] => ({
  id,
  code: id.toUpperCase(),
  name: id,
  description: id,
  kind: "GATE",
  gateType,
});

const transfer = (
  id: string,
  modelId: string,
  entityId: string,
): SyLogicModel["leafNodes"][number] => ({
  id,
  code: id.toUpperCase(),
  name: id,
  description: id,
  kind: "TRANSFER_REFERENCE",
  target: { modelId, entityId },
});

const expectSyAdapterError = (
  mef: SystemsAnalysis,
  expectedCode: WorkbookPraxisAdapterError["code"],
): WorkbookPraxisAdapterError => {
  try {
    adaptSyFaultTreeSnapshot({ workbookId: "sy-1", workbookRevision: 1, mef }, "root");
  } catch (error) {
    expect(error).toBeInstanceOf(WorkbookPraxisAdapterError);
    expect(error).toMatchObject({ code: expectedCode });
    return error as WorkbookPraxisAdapterError;
  }
  throw new Error(`Expected adapter error '${expectedCode}'`);
};

const esqMef = {
  bayesianNetworks: [
    {
      modelId: "bn-1",
      code: "BN-1",
      name: "Network",
      description: "Network description",
      nodes: [
        {
          id: "node-1",
          code: "N1",
          name: "Node",
          states: [
            { id: "false", name: "False" },
            { id: "true", name: "True" },
          ],
          position: { x: 0, y: 0 },
        },
      ],
      edges: [],
      conditionalProbabilityTables: [
        {
          nodeId: "node-1",
          parents: [],
          rows: [
            {
              id: "root-row",
              parentStates: [],
              values: [
                { stateId: "false", probability: 0.7 },
                { stateId: "true", probability: 0.3 },
              ],
            },
          ],
        },
      ],
      layout: {
        viewport: { x: 0, y: 0, zoom: 1 },
        mode: "MANUAL",
        direction: "TOP_TO_BOTTOM",
      },
    },
  ],
  hclConfigurations: [
    {
      modelId: "hcl-1",
      code: "HCL-1",
      name: "HCL",
      description: "HCL description",
      bayesianNetwork: { workbookId: "esq-1", modelId: "bn-1" },
      faultTrees: [
        { workbookId: "sy-1", modelId: "ft-1" },
        { workbookId: "sy-1", modelId: "ft-2" },
      ],
      bindings: [
        {
          id: "binding-1",
          faultTreeBasicEvent: {
            referenceType: "FAULT_TREE_BASIC_EVENT_CATALOGUE",
            workbookId: "sy-1",
            entityId: "be-a",
          },
          bayesianNetworkNode: {
            referenceType: "BAYESIAN_NETWORK_NODE",
            workbookId: "esq-1",
            modelId: "bn-1",
            entityId: "node-1",
          },
          trueStateIds: ["true"],
        },
      ],
      baseEvidence: { observations: [] },
      solverSettings: {
        variableOrder: null,
        foldConstants: true,
        spliceNullGates: true,
      },
    },
  ],
} as EventSequenceQuantification;

const esMef = {
  eventTrees: [
    {
      uuid: "et-1",
      name: "Event tree",
      initiatingEventId: "initiator-1",
      initiatingEventFrequency: { expression: valued("PER_YEAR", 0.01) },
      functionalEvents: {
        second: {
          uuid: "fe-2",
          name: "Second",
          order: 2,
          faultTreeTopEvent: {
            referenceType: "FAULT_TREE_TOP_EVENT",
            workbookId: "sy-1",
            modelId: "ft-2",
            entityId: "top-2",
          },
        },
        first: {
          uuid: "fe-1",
          name: "First",
          order: 1,
          faultTreeTopEvent: {
            referenceType: "FAULT_TREE_TOP_EVENT",
            workbookId: "sy-1",
            modelId: "ft-1",
            entityId: "top-1",
          },
        },
      },
      sequences: {
        success: {
          uuid: "sequence-success",
          name: "Success",
          endState: "SAFE",
          functionalEventStates: { "fe-1": "SUCCESS", "fe-2": "SUCCESS" },
        },
        failure: {
          uuid: "sequence-failure",
          name: "Failure",
          endState: "DAMAGE",
          functionalEventStates: { "fe-1": "FAILURE", "fe-2": "SUCCESS" },
        },
      },
      branches: {},
      initialState: { branchId: "initial" },
      implementsSrs: [],
    },
  ],
} as EventSequenceAnalysis;

describe("workbook MEF to PRAXIS snapshot adapters", () => {
  it("flattens a SY fault tree and resolves its workbook basic-event catalogue", () => {
    const source = { workbookId: "sy-1", workbookRevision: 7, mef: syMef };
    const before = structuredClone(syMef);

    const adapted = adaptSyFaultTreeSnapshot(source, "ft-1");

    expect(adapted.modelSnapshot).toMatchObject({
      id: "ft-1",
      projectId: "sy-1",
      methodType: "FAULT_TREE",
      revision: 7,
      topGate: { gateId: "top" },
    });
    expect(adapted.modelSnapshot["gates"]).toEqual([
      expect.objectContaining({ id: "top", gateType: "AND" }),
      expect.objectContaining({ id: "or-gate", gateType: "OR" }),
    ]);
    expect(adapted.modelSnapshot["gateInputs"]).toHaveLength(3);
    expect(adapted.basicEventCatalogue).toEqual({
      projectId: "sy-1",
      basicEvents: [
        { id: "be-a", expression: probability(0.2) },
        { id: "be-b", expression: probability(0.1) },
      ],
      commonCauseFailureGroups: [],
      uncertaintyParameters: [],
      uncertaintyVectors: [],
    });
    expect(adapted.parameterReferences).toEqual([]);
    expect(adapted.vectorReferences).toEqual([]);
    expect(adapted.legacyReferences).toEqual([]);
    expect(syMef).toEqual(before);
  });

  it("carries applicable CCF groups and ignores SY uncertainty settings", () => {
    const mef = structuredClone(syMef);
    mef.commonCauseFailureGroups = [{
      uuid: "ccf-1",
      name: "Shared support",
      description: "Shared support failure",
      scope: "INTRASYSTEM",
      affectedComponents: [],
      affectedSystems: ["system-1"],
      factors: { model: "BETA_FACTOR", beta: valued("FRACTION", 0.1) },
      total: probability(0.2),
      members: { basicEvents: [{ id: "be-a" }, { id: "be-b" }] },
      implementsSrs: [],
    }];
    mef.uncertaintyAnalyses = [{
      uuid: "uncertainty-1",
      system: "system-1",
      propagationMethod: "MONTE_CARLO",
      numberOfSamples: 2_000,
      randomSeed: 847,
      modelUncertainties: [],
      implementsSrs: [],
    }];

    const adapted = adaptSyFaultTreeSnapshot({ workbookId: "sy-1", workbookRevision: 7, mef }, "ft-1");
    expect(adapted.basicEventCatalogue.commonCauseFailureGroups).toEqual([{
      id: "ccf-1",
      members: ["be-a", "be-b"],
      factors: { model: "BETA_FACTOR", beta: valued("FRACTION", 0.1) },
      total: probability(0.2),
    }]);
    expect(adapted.basicEventCatalogue.uncertaintyParameters).toEqual([]);
    expect(adapted.basicEventCatalogue.uncertaintyVectors).toEqual([]);
    mef.commonCauseFailureGroups[0]!.members = { basicEvents: [{ id: "be-a" }, { id: "be-outside" }] };
    expect(adaptSyFaultTreeSnapshot({ workbookId: "sy-1", workbookRevision: 7, mef }, "ft-1").basicEventCatalogue.commonCauseFailureGroups).toEqual([]);
    mef.commonCauseFailureGroups[0]!.members = { basicEvents: [] };
    expect(adaptSyFaultTreeSnapshot({ workbookId: "sy-1", workbookRevision: 7, mef }, "ft-1").basicEventCatalogue.commonCauseFailureGroups).toEqual([]);
    mef.commonCauseFailureGroups[0]!.members = { basicEvents: [{ id: "be-a" }] };
    expect(() => adaptSyFaultTreeSnapshot({ workbookId: "sy-1", workbookRevision: 7, mef }, "ft-1"))
      .toThrow(expect.objectContaining({ code: "SY_CCF_GROUP_TOO_SMALL", details: { groupId: "ccf-1" } }));
  });

  it("sends DA estimates as parameters and keeps the CCF total the group holds", () => {
    const mef = structuredClone(syMef);
    const reference = daReference("parameter-a");
    const parameter = estimate("parameter-a", {
      unit: "PROBABILITY",
      law: { family: "BETA", alpha: 2, beta: 8, lower: 0, upper: 1 },
    });
    mef.systemBasicEvents[0] = { ...mef.systemBasicEvents[0]!, expression: reading("parameter-a") };
    const source = { workbookId: "sy-1", workbookRevision: 7, mef };
    expect(() => adaptSyFaultTreeSnapshot(source, "ft-1"))
      .toThrow(expect.objectContaining({ code: "UNCERTAINTY_PARAMETER_UNRESOLVED", details: { reference } }));
    const options = { parameters: parameterTable([parameter]) };
    const single = adaptSyFaultTreeSnapshot(source, "ft-1", options);
    expect(single.basicEventCatalogue.basicEvents).toEqual([
      { id: "be-a", expression: reading("parameter-a") },
      { id: "be-b", expression: probability(0.1) },
    ]);
    expect(single.basicEventCatalogue.uncertaintyParameters).toEqual([parameter]);
    expect(single.parameterReferences).toEqual([reference]);
    mef.systemBasicEvents[1] = { ...mef.systemBasicEvents[1]!, expression: reading("parameter-a") };
    mef.commonCauseFailureGroups = [{
      uuid: "ccf-1", name: "Shared support", description: "Shared support failure", scope: "INTRASYSTEM",
      affectedComponents: [], affectedSystems: ["system-1"],
      factors: { model: "MGL", factors: [valued("FRACTION", 0.1), valued("FRACTION", 0.3)] },
      total: probability(0.2),
      members: { basicEvents: [{ id: "be-a" }, { id: "be-b" }] }, implementsSrs: [],
    }];
    expect(adaptSyFaultTreeSnapshot(source, "ft-1", options).basicEventCatalogue.commonCauseFailureGroups).toEqual([{
      id: "ccf-1",
      members: ["be-a", "be-b"],
      factors: { model: "MGL", factors: [valued("FRACTION", 0.1), valued("FRACTION", 0.3)] },
      total: probability(0.2),
    }]);
    mef.commonCauseFailureGroups[0]!.total = reading("parameter-a");
    const shared = adaptSyFaultTreeSnapshot(source, "ft-1", options);
    expect(shared.basicEventCatalogue.commonCauseFailureGroups[0]?.total).toEqual(reading("parameter-a"));
    expect(shared.basicEventCatalogue.uncertaintyParameters).toEqual([parameter]);
  });

  it("builds parameter and vector tables for every CCF factor reference", () => {
    const mef = structuredClone(syMef);
    const beta = estimate("beta-a", { unit: "FRACTION", law: { family: "BETA", alpha: 1, beta: 19, lower: 0, upper: 1 } });
    const alphas: UncertainVectorParameter = {
      reference: daReference("alphas-a"),
      vector: { family: "DIRICHLET", concentrations: [880.1, 12.01] },
    };
    mef.commonCauseFailureGroups = [
      {
        uuid: "ccf-beta", name: "Beta group", description: "", scope: "INTRASYSTEM",
        affectedComponents: [], affectedSystems: ["system-1"],
        factors: { model: "BETA_FACTOR", beta: reading("beta-a") },
        total: probability(0.2),
        members: { basicEvents: [{ id: "be-a" }, { id: "be-b" }] }, implementsSrs: [],
      },
      {
        uuid: "ccf-alpha", name: "Alpha group", description: "", scope: "INTRASYSTEM",
        affectedComponents: [], affectedSystems: ["system-1"],
        factors: { model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: { node: "PARAMETER", reference: daReference("alphas-a") } },
        total: probability(0.2),
        members: { basicEvents: [{ id: "be-a" }, { id: "be-b" }] }, implementsSrs: [],
      },
    ];
    const source = { workbookId: "sy-1", workbookRevision: 7, mef };
    expect(collectSyFaultTreeReferences(source, "ft-1")).toEqual({
      parameterReferences: [daReference("beta-a")],
      vectorReferences: [daReference("alphas-a")],
      legacyReferences: [],
    });
    expect(() => adaptSyFaultTreeSnapshot(source, "ft-1", { parameters: parameterTable([beta]) }))
      .toThrow(expect.objectContaining({ code: "UNCERTAINTY_PARAMETER_UNRESOLVED", details: { reference: daReference("alphas-a") } }));
    const adapted = adaptSyFaultTreeSnapshot(source, "ft-1", {
      parameters: parameterTable([beta]),
      vectors: vectorTable([alphas]),
    });
    expect(adapted.basicEventCatalogue.commonCauseFailureGroups.map((group) => group.factors)).toEqual([
      { model: "BETA_FACTOR", beta: reading("beta-a") },
      { model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: { node: "PARAMETER", reference: daReference("alphas-a") } },
    ]);
    expect(adapted.basicEventCatalogue.uncertaintyParameters).toEqual([beta]);
    expect(adapted.basicEventCatalogue.uncertaintyVectors).toEqual([alphas]);
    expect(adapted.vectorReferences).toEqual([daReference("alphas-a")]);
  });

  it("collects component and legacy references and resolves legacy values without the cached SY value", () => {
    const mef = structuredClone(syMef);
    const daLegacy: WorkbookParameterReference = daReference("parameter-hep");
    const hraLegacy: HumanFailureEventReference = {
      referenceType: "HUMAN_FAILURE_EVENT",
      workbookId: "hr-1",
      entityId: "hfe-b",
      quantificationId: "hep-b",
    };
    mef.systemBasicEvents[0] = {
      uuid: "be-a",
      code: "BE-A",
      name: "Event A",
      eventType: "BASIC",
      failureMode: "HUMAN_ERROR",
      probability: 0.99,
      controlledDataSource: daLegacy,
      implementsSrs: [],
    };
    mef.systemBasicEvents[1] = {
      uuid: "be-b",
      code: "BE-B",
      name: "Event B",
      eventType: "BASIC",
      failureMode: "HUMAN_ERROR",
      controlledDataSource: hraLegacy,
      implementsSrs: [],
    };
    mef.systemBasicEvents.push({ uuid: "be-c", code: "BE-C", name: "Event C", eventType: "BASIC", expression: reading("parameter-c"), implementsSrs: [] });
    mef.systemLogicModels[0]!.leafNodes.push({ id: "leaf-c", kind: "BASIC_EVENT_REFERENCE", basicEventId: "be-c" });
    mef.systemLogicModels[0]!.gateInputs.push({ id: "or-gate:leaf-c:1", gateId: "or-gate", childId: "leaf-c", order: 1 });
    const source = { workbookId: "sy-1", workbookRevision: 7, mef };

    expect(collectSyFaultTreeReferences(source, "ft-1")).toEqual({
      parameterReferences: [daReference("parameter-c")],
      vectorReferences: [],
      legacyReferences: [daLegacy, hraLegacy],
    });
    const parameters = parameterTable([estimate("parameter-c", { unit: "PROBABILITY", law: { family: "POINT", value: 0.01 } })]);
    expect(() => adaptSyFaultTreeSnapshot(source, "ft-1", { parameters })).toThrow(
      "SY basic event 'BE-A' could not resolve controlled DA parameter 'da-1:parameter-hep'",
    );
    expect(() => adaptSyFaultTreeSnapshot(source, "ft-1", {
      parameters,
      legacyValues: new Map([[faultTreeControlledDataSourceKey(daLegacy), 0.35]]),
    })).toThrow("SY basic event 'BE-B' could not resolve controlled HRA quantification 'hr-1:hfe-b'");
    const adapted = adaptSyFaultTreeSnapshot(source, "ft-1", {
      parameters,
      legacyValues: new Map([
        [faultTreeControlledDataSourceKey(daLegacy), 0.35],
        [faultTreeControlledDataSourceKey(hraLegacy), 0.004],
      ]),
    });
    expect(adapted.basicEventCatalogue.basicEvents).toEqual([
      { id: "be-a", expression: legacyExpression("PROBABILITY", 0.35) },
      { id: "be-b", expression: legacyExpression("PROBABILITY", 0.004) },
      { id: "be-c", expression: reading("parameter-c") },
    ]);
    expect(adapted.legacyReferences).toEqual([daLegacy, hraLegacy]);
  });

  it("refuses a component event with no expression with an addressable error", () => {
    const mef = structuredClone(syMef);
    mef.systemBasicEvents[0] = {
      uuid: "be-a",
      code: "BE-A",
      name: "Event A",
      eventType: "BASIC",
      probability: 0.2,
      quantificationBasis: {
        kind: "FAILURE_RATE", conversion: "LINEAR",
        failureRate: { value: .001, unit: "HOUR" }, missionTime: { value: 100, unit: "HOUR" },
      },
      implementsSrs: [],
    };
    const original = structuredClone(mef);
    const source = { workbookId: "sy-1", workbookRevision: 7, mef };
    expect(() => adaptSyFaultTreeSnapshot(source, "ft-1"))
      .toThrow(expect.objectContaining({ code: "SY_BASIC_EVENT_VALUE_MISSING", details: { basicEventId: "be-a" } }));
    expect(collectSyFaultTreeReferences(source, "ft-1")).toEqual({ parameterReferences: [], vectorReferences: [], legacyReferences: [] });
    expect(mef).toEqual(original);
  });

  it("sends a mission model over a DA rate with the rate estimate as a parameter", () => {
    const mef = structuredClone(syMef);
    const mission: UncertainExpression = {
      node: "MODEL",
      model: {
        form: "MISSION",
        rate: reading("rate-a"),
        missionTime: { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 24 } } },
      },
    };
    const rate = estimate("rate-a", { unit: "PER_HOUR", law: { family: "POINT", value: 2e-5 } });
    mef.systemBasicEvents[0] = { ...mef.systemBasicEvents[0]!, expression: mission };
    const adapted = adaptSyFaultTreeSnapshot(
      { workbookId: "sy-1", workbookRevision: 7, mef },
      "ft-1",
      { parameters: parameterTable([rate]) },
    );
    expect(adapted.basicEventCatalogue.basicEvents[0]).toEqual({ id: "be-a", expression: mission });
    expect(adapted.basicEventCatalogue.uncertaintyParameters).toEqual([rate]);
  });

  it("keeps a per-year rate and a mission time in hours in their own units", () => {
    const mef = structuredClone(syMef);
    const mission: UncertainExpression = {
      node: "MODEL",
      model: {
        form: "MISSION",
        rate: reading("loop-a"),
        missionTime: { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 24 } } },
      },
    };
    const frequency = estimate("loop-a", { unit: "PER_YEAR", law: { family: "GAMMA", shape: 1.5, rate: 50 } });
    mef.systemBasicEvents[0] = { ...mef.systemBasicEvents[0]!, expression: mission };
    const adapted = adaptSyFaultTreeSnapshot(
      { workbookId: "sy-1", workbookRevision: 7, mef },
      "ft-1",
      { parameters: parameterTable([frequency]) },
    );
    expect(adapted.basicEventCatalogue.basicEvents[0]?.expression).toEqual(mission);
    expect(adapted.basicEventCatalogue.uncertaintyParameters).toEqual([frequency]);
  });

  it("resolves nested parameter references and names the one it cannot resolve", () => {
    const mef = structuredClone(syMef);
    const scaled: UncertainParameter = {
      reference: daReference("demand-a"),
      expression: {
        node: "OPERATION",
        operation: "MULTIPLY",
        operands: [reading("demand-b"), { node: "VALUE", value: { unit: "FACTOR", law: { family: "POINT", value: 2 } } }],
      },
    };
    const generic = estimate("demand-b", {
      unit: "PROBABILITY",
      law: { family: "TRUNCATED", law: { family: "LOGNORMAL", mean: 1e-3, errorFactor: 3, level: 0.95 }, lower: null, upper: 1 },
    });
    mef.systemBasicEvents[0] = { ...mef.systemBasicEvents[0]!, expression: reading("demand-a") };
    const source = { workbookId: "sy-1", workbookRevision: 7, mef };
    expect(() => adaptSyFaultTreeSnapshot(source, "ft-1", { parameters: parameterTable([scaled]) }))
      .toThrow(expect.objectContaining({ code: "UNCERTAINTY_PARAMETER_UNRESOLVED", details: { reference: daReference("demand-b") } }));
    const adapted = adaptSyFaultTreeSnapshot(source, "ft-1", { parameters: parameterTable([scaled, generic]) });
    expect(adapted.basicEventCatalogue.uncertaintyParameters).toEqual([scaled, generic]);
    expect(adapted.parameterReferences).toEqual([daReference("demand-a"), daReference("demand-b")]);
    expect(collectSyFaultTreeReferences(source, "ft-1").parameterReferences).toEqual([daReference("demand-a")]);
  });

  it.each([false, true])("expands 6,000 nested gates without call-stack recursion (transfers: %s)", (transfers) => {
    const depth = 6_000;
    const mef = structuredClone(syMef);
    const chainGates = Array.from({ length: depth }, (_, i) => gate(`g${i}`));
    const chainInputs = chainGates.map(({ id }, i) => ({
      id: `input${i}`,
      gateId: id,
      childId: i === depth - 1 ? "leaf" : transfers ? `transfer${i}` : `g${i + 1}`,
      order: 0,
    }));
    const leaf = { id: "leaf", kind: "BASIC_EVENT_REFERENCE" as const, basicEventId: "be-a" };
    const modelId = (i: number): string => i === 0 ? "root" : `model${i}`;
    mef.systemLogicModels = transfers
      ? chainGates.map((entry, i) => syLogicModel(
        modelId(i), entry.id, [entry],
        i === depth - 1 ? [leaf] : [transfer(`transfer${i}`, modelId(i + 1), `g${i + 1}`)],
        [chainInputs[i]],
      ))
      : [syLogicModel("root", "g0", chainGates, [leaf], chainInputs)];

    const adapted = adaptSyFaultTreeSnapshot({ workbookId: "sy-1", workbookRevision: 1, mef }, "root");
    const gates = adapted.modelSnapshot["gates"] as Array<{ id: string; name: string }>;
    expect(gates.map(({ name }) => name)).toEqual(chainGates.map(({ name }) => name));
    expect(new Set(gates.map(({ id }) => id)).size).toBe(depth);
    expect(adapted.modelSnapshot["gateInputs"]).toHaveLength(depth);
    expect(adapted.modelSnapshot["leafNodes"]).toHaveLength(1);
    expect(adapted.basicEventCatalogue.basicEvents).toEqual([{ id: "be-a", expression: probability(0.2) }]);

    if (transfers) {
      const last = mef.systemLogicModels[depth - 1];
      last.leafNodes = [transfer("back", "root", "g0")];
      last.gateInputs[0].childId = "back";
    } else {
      mef.systemLogicModels[0].gateInputs[depth - 1].childId = "g0";
    }
    const error = expectSyAdapterError(mef, transfers ? "SY_FAULT_TREE_TRANSFER_CYCLE" : "SY_FAULT_TREE_GRAPH_CYCLE");
    const cycle = error.details["cycle"] as Array<{ modelId: string; gateId: string }>;
    expect(cycle).toHaveLength(depth + 1);
    expect(cycle[0]).toEqual({ modelId: "root", gateId: "g0" });
    expect(cycle[depth - 1]).toEqual({ modelId: transfers ? modelId(depth - 1) : "root", gateId: `g${depth - 1}` });
    expect(cycle[depth]).toEqual(cycle[0]);
  }, 30_000);

  it("inlines transfer subgraphs while preserving shared gates and basic events", () => {
    const mef = structuredClone(syMef);
    mef.systemBasicEvents.push({
      uuid: "be-c",
      code: "BE-C",
      name: "Event C",
      eventType: "BASIC",
      expression: probability(0.05),
      implementsSrs: [],
    });
    mef.systemLogicModels = [
      syLogicModel(
        "root",
        "root-top",
        [gate("root-top"), gate("left", "AND"), gate("right", "AND")],
        [
          { id: "root-ref-a", kind: "BASIC_EVENT_REFERENCE", basicEventId: "be-a" },
          transfer("transfer-left", "middle", "middle-top"),
          transfer("transfer-right", "middle", "middle-top"),
        ],
        [
          { id: "root:a", gateId: "root-top", childId: "root-ref-a", order: 0 },
          { id: "root:left", gateId: "root-top", childId: "left", order: 1 },
          { id: "root:right", gateId: "root-top", childId: "right", order: 2 },
          { id: "left:transfer", gateId: "left", childId: "transfer-left", order: 0 },
          { id: "right:transfer", gateId: "right", childId: "transfer-right", order: 0 },
        ],
      ),
      syLogicModel(
        "middle",
        "middle-top",
        [gate("middle-top", "AND")],
        [
          { id: "middle-ref-b", kind: "BASIC_EVENT_REFERENCE", basicEventId: "be-b" },
          transfer("transfer-child", "child", "child-top"),
        ],
        [
          { id: "middle:b", gateId: "middle-top", childId: "middle-ref-b", order: 0 },
          {
            id: "middle:transfer",
            gateId: "middle-top",
            childId: "transfer-child",
            order: 1,
          },
        ],
      ),
      syLogicModel(
        "child",
        "child-top",
        [gate("child-top", "AND")],
        [
          { id: "child-ref-a", kind: "BASIC_EVENT_REFERENCE", basicEventId: "be-a" },
          { id: "child-ref-c", kind: "BASIC_EVENT_REFERENCE", basicEventId: "be-c" },
        ],
        [
          { id: "child:a", gateId: "child-top", childId: "child-ref-a", order: 0 },
          { id: "child:c", gateId: "child-top", childId: "child-ref-c", order: 1 },
        ],
        [
          { nodeId: "child-top", position: { x: 20, y: 30 } },
          { nodeId: "child-ref-c", position: { x: 40, y: 50 } },
        ],
      ),
    ];
    const before = structuredClone(mef);

    const adapted = adaptSyFaultTreeSnapshot(
      { workbookId: "sy-1", workbookRevision: 8, mef },
      "root",
    );
    const gates = adapted.modelSnapshot["gates"] as Array<{ id: string; name: string }>;
    const leaves = adapted.modelSnapshot["leafNodes"] as Array<{
      id: string;
      kind: string;
      basicEventId?: string;
    }>;
    const inputs = adapted.modelSnapshot["gateInputs"] as Array<{
      id: string;
      gateId: string;
      childId: string;
      order: number;
    }>;

    expect(gates.map(({ name }) => name)).toEqual([
      "root-top",
      "left",
      "middle-top",
      "child-top",
      "right",
    ]);
    const middleTopId = gates.find(({ name }) => name === "middle-top")?.id;
    const childTopId = gates.find(({ name }) => name === "child-top")?.id;
    expect(middleTopId).toMatch(/^[0-9a-f-]{36}$/);
    expect(childTopId).toMatch(/^[0-9a-f-]{36}$/);
    expect(middleTopId).not.toBe("middle-top");
    expect(childTopId).not.toBe("child-top");
    expect(new Set(gates.map(({ id }) => id)).size).toBe(5);
    expect(leaves.every(({ kind }) => kind !== "TRANSFER_REFERENCE")).toBe(true);
    expect(inputs.filter(({ childId }) => childId === middleTopId).map(({ id }) => id)).toEqual([
      "left:transfer",
      "right:transfer",
    ]);
    expect(inputs).toContainEqual(
      expect.objectContaining({ gateId: middleTopId, childId: childTopId, order: 1 }),
    );
    expect(adapted.basicEventCatalogue.basicEvents).toEqual([
      { id: "be-a", expression: probability(0.2) },
      { id: "be-b", expression: probability(0.1) },
      { id: "be-c", expression: probability(0.05) },
    ]);
    const childReferenceC = leaves.find(({ basicEventId }) => basicEventId === "be-c");
    expect(adapted.modelSnapshot["nodePositions"]).toEqual([
      { nodeId: childTopId, position: { x: 20, y: 30 } },
      { nodeId: childReferenceC?.id, position: { x: 40, y: 50 } },
    ]);
    const adaptedAgain = adaptSyFaultTreeSnapshot(
      { workbookId: "sy-1", workbookRevision: 8, mef },
      "root",
    );
    expect(adaptedAgain.modelSnapshot["gates"]).toEqual(adapted.modelSnapshot["gates"]);
    expect(adaptedAgain.modelSnapshot["gateInputs"]).toEqual(
      adapted.modelSnapshot["gateInputs"],
    );
    expect(mef).toEqual(before);
  });

  it.each([
    ["missing model", "SY_FAULT_TREE_TRANSFER_MODEL_NOT_FOUND" as const],
    ["ambiguous model", "SY_FAULT_TREE_TRANSFER_MODEL_AMBIGUOUS" as const],
    ["missing gate", "SY_FAULT_TREE_TRANSFER_GATE_NOT_FOUND" as const],
    ["ambiguous gate", "SY_FAULT_TREE_TRANSFER_GATE_AMBIGUOUS" as const],
  ])("rejects a %s transfer target with a structured error", (scenario, expectedCode) => {
    const mef = structuredClone(syMef);
    const targetModelId = scenario === "missing model" ? "missing" : "target";
    mef.systemLogicModels = [
      syLogicModel(
        "root",
        "root-top",
        [gate("root-top")],
        [transfer("transfer", targetModelId, "target-gate")],
        [{ id: "root:transfer", gateId: "root-top", childId: "transfer", order: 0 }],
      ),
    ];
    if (scenario !== "missing model") {
      const target = syLogicModel(
        "target",
        scenario === "missing gate" ? "some-gate" : "target-gate",
        scenario === "missing gate"
          ? [gate("some-gate")]
          : scenario === "ambiguous gate"
            ? [gate("target-gate"), gate("target-gate")]
            : [gate("target-gate")],
        [],
        [],
      );
      mef.systemLogicModels.push(target);
      if (scenario === "ambiguous model") {
        mef.systemLogicModels.push(structuredClone(target));
      }
    }

    const error = expectSyAdapterError(mef, expectedCode);
    expect(error.details).toMatchObject({ matchCount: expect.any(Number) });
  });

  it("namespaces model-local ids and rejects only true collisions within a model", () => {
    const sharedGateId = "00000000-0000-4000-8000-000000000001";
    const sharedInputId = "00000000-0000-4000-8000-000000000002";
    const sharedNodeIds = structuredClone(syMef);
    sharedNodeIds.systemLogicModels = [
      syLogicModel(
        "root",
        sharedGateId,
        [gate(sharedGateId)],
        [transfer("transfer", "target", sharedGateId)],
        [{ id: "root:transfer", gateId: sharedGateId, childId: "transfer", order: 0 }],
      ),
      syLogicModel("target", sharedGateId, [gate(sharedGateId)], [], []),
    ];
    const nodeAdapted = adaptSyFaultTreeSnapshot(
      { workbookId: "sy-1", workbookRevision: 1, mef: sharedNodeIds },
      "root",
    );
    const expandedGates = nodeAdapted.modelSnapshot["gates"] as Array<{ id: string }>;
    expect(expandedGates).toHaveLength(2);
    expect(expandedGates[0]?.id).toBe(sharedGateId);
    expect(expandedGates[1]?.id).not.toBe(sharedGateId);
    expect(
      (nodeAdapted.modelSnapshot["gateInputs"] as Array<{ childId: string }>)[0]?.childId,
    ).toBe(expandedGates[1]?.id);

    const sharedInputIds = structuredClone(syMef);
    sharedInputIds.systemLogicModels = [
      syLogicModel(
        "root",
        "root-top",
        [gate("root-top")],
        [transfer("transfer", "target", "target-top")],
        [{ id: sharedInputId, gateId: "root-top", childId: "transfer", order: 0 }],
      ),
      syLogicModel(
        "target",
        "target-top",
        [gate("target-top")],
        [{ id: "target-ref", kind: "BASIC_EVENT_REFERENCE", basicEventId: "be-a" }],
        [{ id: sharedInputId, gateId: "target-top", childId: "target-ref", order: 0 }],
      ),
    ];
    const inputAdapted = adaptSyFaultTreeSnapshot(
      { workbookId: "sy-1", workbookRevision: 1, mef: sharedInputIds },
      "root",
    );
    const expandedInputs = inputAdapted.modelSnapshot["gateInputs"] as Array<{ id: string }>;
    expect(expandedInputs).toHaveLength(2);
    expect(new Set(expandedInputs.map(({ id }) => id)).size).toBe(2);
    expect(expandedInputs.some(({ id }) => id === sharedInputId)).toBe(true);

    const localNodeCollision = structuredClone(syMef);
    localNodeCollision.systemLogicModels = [
      syLogicModel(
        "root",
        "duplicate",
        [gate("duplicate")],
        [transfer("duplicate", "root", "duplicate")],
        [{ id: "input", gateId: "duplicate", childId: "duplicate", order: 0 }],
      ),
    ];
    expectSyAdapterError(localNodeCollision, "SY_FAULT_TREE_NODE_ID_COLLISION");

    const localInputCollision = structuredClone(syMef);
    localInputCollision.systemLogicModels = [
      syLogicModel(
        "root",
        "root-top",
        [gate("root-top")],
        [
          { id: "ref-a", kind: "BASIC_EVENT_REFERENCE", basicEventId: "be-a" },
          { id: "ref-b", kind: "BASIC_EVENT_REFERENCE", basicEventId: "be-b" },
        ],
        [
          { id: "duplicate", gateId: "root-top", childId: "ref-a", order: 0 },
          { id: "duplicate", gateId: "root-top", childId: "ref-b", order: 1 },
        ],
      ),
    ];
    expectSyAdapterError(localInputCollision, "SY_FAULT_TREE_GATE_INPUT_ID_COLLISION");
  });

  it("rejects recursive transfer cycles with the complete gate path", () => {
    const mef = structuredClone(syMef);
    mef.systemLogicModels = [
      syLogicModel(
        "root",
        "root-top",
        [gate("root-top")],
        [transfer("to-target", "target", "target-top")],
        [{ id: "root:target", gateId: "root-top", childId: "to-target", order: 0 }],
      ),
      syLogicModel(
        "target",
        "target-top",
        [gate("target-top")],
        [transfer("to-root", "root", "root-top")],
        [{ id: "target:root", gateId: "target-top", childId: "to-root", order: 0 }],
      ),
    ];

    const error = expectSyAdapterError(mef, "SY_FAULT_TREE_TRANSFER_CYCLE");
    expect(error.details).toEqual({
      cycle: [
        { modelId: "root", gateId: "root-top" },
        { modelId: "target", gateId: "target-top" },
        { modelId: "root", gateId: "root-top" },
      ],
    });
  });

  it("adds solver identity to an ESQ-owned Bayesian network without mutating it", () => {
    const before = structuredClone(esqMef.bayesianNetworks[0]);
    const adapted = adaptEsqBayesianNetworkSnapshot(
      { workbookId: "esq-1", workbookRevision: 4, mef: esqMef },
      "bn-1",
    );

    expect(adapted).toMatchObject({
      id: "bn-1",
      methodType: "BAYESIAN_NETWORK",
      revision: 4,
      nodes: [{ id: "node-1" }],
    });
    expect(esqMef.bayesianNetworks[0]).toEqual(before);
  });

  describe.each(["SY", "ESQ"])("%s Bayesian graph execution validation", (host) => {
    const network = () => {
      const bn = structuredClone(esqMef.bayesianNetworks[0]);
      bn.nodes.push({ ...structuredClone(bn.nodes[0]), id: "node-2", code: "N2" });
      bn.edges = [{ id: "edge-1", parentNodeId: "node-1", childNodeId: "node-2" }];
      bn.conditionalProbabilityTables.push({
        nodeId: "node-2", parents: [{ nodeId: "node-1", order: 0 }],
        rows: ["false", "true"].map((stateId) => ({
          id: stateId, parentStates: [{ parentNodeId: "node-1", stateId }],
          values: [{ stateId: "false", probability: 0.8 }, { stateId: "true", probability: 0.2 }],
        })),
      });
      return bn;
    };
    const adapt = (bn: ReturnType<typeof network>) => host === "SY"
      ? adaptSyBayesianNetworkSnapshot({ workbookId: "sy-1", workbookRevision: 1, mef: { ...syMef, dependencyBayesianNetworks: [bn] } }, "bn-1")
      : adaptEsqBayesianNetworkSnapshot({ workbookId: "esq-1", workbookRevision: 1, mef: { ...esqMef, bayesianNetworks: [bn] } }, "bn-1");

    it("preserves a valid graph, parent order and probabilities", () => {
      const bn = network(), before = structuredClone(bn);
      expect(adapt(bn)).toMatchObject(bn);
      expect(bn).toEqual(before);
    });
    it.each(["missing", "extra", "reversed", "duplicate", "dangling", "self-cycle", "edge-cycle"])(
      "rejects %s edges without repairing the input", (kind) => {
        const bn = network();
        if (kind === "missing") bn.edges = [];
        if (kind === "extra") { bn.conditionalProbabilityTables[1].parents = []; bn.conditionalProbabilityTables[1].rows = [bn.conditionalProbabilityTables[0].rows[0]]; }
        if (kind === "reversed") bn.edges[0] = { ...bn.edges[0], parentNodeId: "node-2", childNodeId: "node-1" };
        if (kind === "duplicate") bn.edges.push({ ...bn.edges[0], id: "edge-2" });
        if (kind === "dangling") bn.edges[0].parentNodeId = "missing";
        if (kind === "self-cycle") bn.edges.push({ id: "edge-2", parentNodeId: "node-1", childNodeId: "node-1" });
        if (kind === "edge-cycle") bn.edges.push({ id: "edge-2", parentNodeId: "node-2", childNodeId: "node-1" });
        const before = structuredClone(bn);
        expect(() => adapt(bn)).toThrow(WorkbookPraxisAdapterError);
        expect(bn).toEqual(before);
      },
    );
  });

  it("normalizes an ES event tree, typed FT links, sequence paths, and optional HCL link", () => {
    const adapted = adaptEsEventTreeSnapshot(
      { workbookId: "es-1", workbookRevision: 3, mef: esMef },
      "et-1",
      { workbookId: "esq-1", modelId: "hcl-1" },
    );

    expect(adapted).toMatchObject({
      id: "et-1",
      methodType: "EVENT_TREE",
      revision: 3,
      initiatingEventFrequency: { expression: valued("PER_YEAR", 0.01) },
      hclConfiguration: { configuration: { modelId: "hcl-1" } },
    });
    expect(adapted["initiatingEventFrequency"]).toEqual({ expression: valued("PER_YEAR", 0.01) });
    expect(adapted["functionalEvents"]).toEqual([
      { id: "fe-1", name: "First", order: 0 },
      { id: "fe-2", name: "Second", order: 1 },
    ]);
    expect(adapted["functionalEventFaultTreeLinks"]).toEqual([
      { functionalEventId: "fe-1", faultTreeTopGate: { modelId: "ft-1", entityId: "top-1" } },
      { functionalEventId: "fe-2", faultTreeTopGate: { modelId: "ft-2", entityId: "top-2" } },
    ]);
    expect(adapted["sequences"]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "sequence-failure",
          path: [
            { functionalEventId: "fe-1", outcome: "FAILURE" },
            { functionalEventId: "fe-2", outcome: "SUCCESS" },
          ],
        }),
      ]),
    );
  });

  it("preserves bypassed functional-event outcomes in the solver snapshot", () => {
    const bypassedMef = structuredClone(esMef);
    const tree = bypassedMef.eventTrees?.[0];
    expect(tree).toBeDefined();
    Object.values(tree!.sequences).forEach((sequence) => {
      sequence.functionalEventStates = {
        ...sequence.functionalEventStates,
        "fe-1": "BYPASSED",
      };
    });
    const bypassedEvent = Object.values(tree!.functionalEvents).find((event) => event.uuid === "fe-1");
    expect(bypassedEvent).toBeDefined();
    delete bypassedEvent!.faultTreeTopEvent;

    const adapted = adaptEsEventTreeSnapshot(
      { workbookId: "es-1", workbookRevision: 3, mef: bypassedMef },
      "et-1",
    );

    expect(adapted["functionalEventFaultTreeLinks"]).toEqual([
      { functionalEventId: "fe-2", faultTreeTopGate: { modelId: "ft-2", entityId: "top-2" } },
    ]);
    expect((adapted["sequences"] as Array<{ path: Array<{ functionalEventId: string; outcome: string }> }>)
      .every((candidate) => candidate.path[0]?.outcome === "BYPASSED")).toBe(true);
  });

  it("normalizes workbook-owned event-tree transfers to destination trees", () => {
    const transferringMef = structuredClone(esMef);
    const tree = transferringMef.eventTrees?.[0];
    expect(tree).toBeDefined();
    const sequence = Object.values(tree!.sequences)[0]!;
    sequence.endState = undefined;
    tree!.transfers = {
      [sequence.uuid]: {
        targetEventTreeId: "target-tree",
      },
    };

    const adapted = adaptEsEventTreeSnapshot(
      { workbookId: "es-1", workbookRevision: 3, mef: transferringMef },
      tree!.uuid,
    );

    expect(adapted["sequences"]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: sequence.uuid,
        result: {
          kind: "TRANSFER",
          target: { modelId: "target-tree" },
        },
      }),
    ]));
  });

  it("omits saved uncertainty before validating its contents on probability runs", () => {
    const mef = structuredClone(esqMef);
    const settings = mef.hclConfigurations[0]!.solverSettings;
    settings.uncertainty = { sampleCount: 10, seed: 42, sampler: "MC", basicEvents: [], cptRows: [],
      cptGenerators: [{ generator: { kind: "UNREVIEWED" } }] };
    const before = structuredClone(mef);
    const source = { workbookId: "esq-1", workbookRevision: 9, mef };
    expect(adaptEsqHclSnapshot(source, "hcl-1")["solverSettings"]).not.toHaveProperty("uncertainty");
    expect(adaptEsqHclSnapshot(source, "hcl-1", "PROBABILITY")["solverSettings"]).not.toHaveProperty("uncertainty");
    expect(() => adaptEsqHclSnapshot(source, "hcl-1", "UNCERTAINTY")).toThrow("Invalid uncertainty settings");
    expect(mef).toEqual(before);
    delete settings.uncertainty;
    expect(() => adaptEsqHclSnapshot(source, "hcl-1", "UNCERTAINTY")).toThrow("requires saved uncertainty settings");
  });

  it("normalizes workbook-scoped HCL targets for each declared fault tree", () => {
    const adapted = adaptEsqHclSnapshot(
      { workbookId: "esq-1", workbookRevision: 9, mef: esqMef },
      "hcl-1",
    );

    expect(adapted).toMatchObject({
      id: "hcl-1",
      methodType: "HYBRID_CAUSAL_LOGIC",
      revision: 9,
      bayesianNetwork: { modelId: "bn-1" },
      faultTrees: [
        { faultTree: { modelId: "ft-1" } },
        { faultTree: { modelId: "ft-2" } },
      ],
    });
    expect(adapted["bindings"]).toEqual([
      expect.objectContaining({
        id: "binding-1:ft-1",
        faultTreeBasicEvent: { modelId: "ft-1", entityId: "be-a" },
      }),
      expect.objectContaining({
        id: "binding-1:ft-2",
        faultTreeBasicEvent: { modelId: "ft-2", entityId: "be-a" },
      }),
    ]);
  });

  it("limits HCL bindings to fault trees that contain the mapped basic event", () => {
    const adapted = adaptEsqHclSnapshot(
      { workbookId: "esq-1", workbookRevision: 9, mef: esqMef },
      "hcl-1",
      "PROBABILITY",
      new Map([
        ["ft-1", new Set(["be-a"])],
        ["ft-2", new Set(["be-b"])],
      ]),
    );

    expect(adapted["bindings"]).toEqual([
      expect.objectContaining({
        id: "binding-1:ft-1",
        faultTreeBasicEvent: { modelId: "ft-1", entityId: "be-a" },
      }),
    ]);
  });

  const ids: Record<string, string> = {
    "bn-1": "b8fcb955-7ed8-54dc-8547-b21211f35650",
    "node-1": "726a04e3-a685-5681-ac94-efe34c05944e",
    "ft-1": "0635ed46-91fc-51be-a5c5-02f675f3fb9b",
    "ft-2": "6e27ca94-9ebe-55a9-bf56-162c41b9be23",
    "hcl-1": "be2caff7-2730-5de2-9525-fc1564e9e73c",
    "binding-1": "5203677c-c86d-5f43-a921-9e817289a2b5",
    "be-a": "0ebcb518-bea9-5522-be37-9aca09222c3c",
    "be-b": "1e86ecf0-df01-5bde-8d0c-39df2d5947d1",
    "false": "dcd6ab13-3645-5ece-90c0-8a4e6fcb808a",
    "true": "7ae29d4a-ad3d-5579-9252-1060b79fba57",
    "root-row": "d3f8ce23-70e1-5d1c-8a57-c7f5f76fb893",
    "row-1": "769c6a5d-266d-5653-8444-e46aadeff59b",
  };
  const uncertaintyFixture = (): EventSequenceQuantification =>
    JSON.parse(JSON.stringify(esqMef, (_key, value) => typeof value === "string"
      ? value === "FAULT_TREE_BASIC_EVENT_CATALOGUE" ? "FAULT_TREE_BASIC_EVENT" : ids[value] ?? value
      : value)) as EventSequenceQuantification;
  const node = {
    referenceType: "BAYESIAN_NETWORK_NODE" as const,
    workbookId: "esq-1",
    modelId: ids["bn-1"]!,
    entityId: ids["node-1"]!,
  };
  const nativeNode = { modelId: ids["bn-1"]!, entityId: ids["node-1"]! };
  const adaptUncertainty = (
    settings: HclUncertaintySettings,
    sources: Parameters<typeof adaptEsqHclSnapshot>[5] = {},
  ): PraxisModelSnapshot => {
    const mef = uncertaintyFixture();
    mef.hclConfigurations[0]!.solverSettings.uncertainty = settings;
    return adaptEsqHclSnapshot(
      { workbookId: "esq-1", workbookRevision: 9, mef },
      ids["hcl-1"]!,
      "UNCERTAINTY",
      undefined,
      undefined,
      sources,
    );
  };

  it.each(["MC", "LHS"] as const)("adapts %s basic-event overrides and CPT rows with their parameter tables", (sampler) => {
    const override = estimate("override-b", { unit: "PROBABILITY", law: { family: "BETA", alpha: 2, beta: 18, lower: 0, upper: 1 } });
    const row: UncertainVectorParameter = { reference: daReference("row-prior"), vector: { family: "DIRICHLET", concentrations: [80, 20] } };
    const settings: HclUncertaintySettings = {
      sampleCount: 500,
      seed: 2026,
      sampler,
      basicEvents: [{
        faultTreeBasicEvent: { referenceType: "FAULT_TREE_BASIC_EVENT", workbookId: "sy-1", entityId: ids["be-b"]! },
        expression: reading("override-b"),
      }],
      cptRows: [
        { bayesianNetworkNode: node, cptRowId: ids["row-1"]!, row: { node: "PARAMETER", reference: daReference("row-prior") } },
        { bayesianNetworkNode: node, cptRowId: ids["root-row"]!, row: { node: "VALUE", law: { family: "DIRICHLET", concentrations: [7, 3] } } },
      ],
      cptGenerators: [],
    };
    const mef = uncertaintyFixture();
    mef.hclConfigurations[0]!.solverSettings.uncertainty = settings;
    expect(collectHclUncertaintyReferences(mef.hclConfigurations[0]!, "UNCERTAINTY")).toEqual({
      parameterReferences: [daReference("override-b")],
      vectorReferences: [daReference("row-prior")],
    });
    expect(collectHclUncertaintyReferences(mef.hclConfigurations[0]!, "PROBABILITY")).toEqual({
      parameterReferences: [],
      vectorReferences: [],
    });
    expect(() => adaptUncertainty(settings, { parameters: parameterTable([override]) }))
      .toThrow(expect.objectContaining({ code: "UNCERTAINTY_PARAMETER_UNRESOLVED", details: { reference: daReference("row-prior") } }));
    expect(adaptUncertainty(settings, { parameters: parameterTable([override]), vectors: vectorTable([row]) })["solverSettings"]).toEqual({
      variableOrder: null,
      foldConstants: true,
      spliceNullGates: true,
      uncertainty: {
        sampleCount: 500,
        seed: 2026,
        sampler,
        basicEvents: [{ faultTreeBasicEvent: { entityId: ids["be-b"] }, expression: reading("override-b") }],
        cptRows: [
          { bayesianNetworkNode: nativeNode, cptRowId: ids["row-1"], row: { node: "PARAMETER", reference: daReference("row-prior") } },
          { bayesianNetworkNode: nativeNode, cptRowId: ids["root-row"], row: { node: "VALUE", law: { family: "DIRICHLET", concentrations: [7, 3] } } },
        ],
        cptGenerators: [],
        uncertaintyParameters: [override],
        uncertaintyVectors: [row],
      },
    });
  });

  it("rejects the removed sampler alias, clip setting and prior fields", () => {
    const base = { sampleCount: 100, seed: 42, sampler: "LHS", basicEvents: [], cptRows: [], cptGenerators: [] };
    const drafts = [
      { ...base, sampler: undefined, basicEventSampler: "LHS" },
      { ...base, cptProbabilityClipEpsilon: 0.01 },
      { ...base, basicEventDistributions: [] },
      { ...base, cptRows: [{ bayesianNetworkNode: node, cptRowId: ids["row-1"], prior: { family: "DIRICHLET", alpha: [8, 2] } }] },
      { ...base, cptRows: [{ bayesianNetworkNode: node, cptRowId: ids["row-1"], equivalentSampleSize: 100 }] },
    ];
    for (const draft of drafts) {
      const mef = uncertaintyFixture();
      Object.assign(mef.hclConfigurations[0]!.solverSettings, { uncertainty: draft });
      expect(() => adaptEsqHclSnapshot({ workbookId: "esq-1", workbookRevision: 9, mef }, ids["hcl-1"]!, "UNCERTAINTY"))
        .toThrow("Invalid uncertainty settings");
    }
  });

  it.each(["SEISMIC_FRAGILITY", "SEISMIC_PGA_BINS"] as const)("flattens %s generators with their node and parameter tables", (kind) => {
    const a = "123e4567-e89b-42d3-a456-426614174702", b = "123e4567-e89b-42d3-a456-426614174703";
    const median = estimate("median-a", { unit: "QUANTITY", law: { family: "LOGNORMAL", mean: 0.52, errorFactor: 1.4, level: 0.95 } });
    const frequency = estimate("bin-a", { unit: "PER_YEAR", law: { family: "LOGNORMAL", mean: 0.011, errorFactor: 2, level: 0.95 } });
    const generator = kind === "SEISMIC_FRAGILITY"
      ? {
          kind, pgaParentId: a, trueStateId: a, falseStateId: b,
          median: reading("median-a"), randomness: valued("FACTOR", 0.3),
          demands: [{ stateId: a, demand: 0.5 }, { stateId: b, demand: 0 }],
        }
      : {
          kind, noneStateId: b, missionTime: valued("YEARS", 1), conversion: "LINEAR" as const,
          bins: [{ stateId: a, frequency: reading("bin-a") }],
        };
    const settings: HclUncertaintySettings = {
      sampleCount: 513, seed: 42, sampler: "LHS", basicEvents: [], cptRows: [],
      cptGenerators: [{ bayesianNetworkNode: node, generator }],
    };
    const parameter = kind === "SEISMIC_FRAGILITY" ? median : frequency;
    expect(adaptUncertainty(settings, { parameters: parameterTable([parameter]) })["solverSettings"]).toEqual({
      variableOrder: null,
      foldConstants: true,
      spliceNullGates: true,
      uncertainty: {
        sampleCount: 513, seed: 42, sampler: "LHS", basicEvents: [], cptRows: [],
        cptGenerators: [{ ...generator, bayesianNetworkNode: nativeNode }],
        uncertaintyParameters: [parameter],
        uncertaintyVectors: [],
      },
    });
    expect(() => adaptUncertainty(settings)).toThrow(`Parameter 'da-1:${kind === "SEISMIC_FRAGILITY" ? "median-a" : "bin-a"}' could not be resolved`);
    const invented = { ...settings, cptGenerators: [{ bayesianNetworkNode: node, generator: { ...generator, kind: "INVENTED_GENERATOR" } }] };
    expect(() => adaptUncertainty(invented as HclUncertaintySettings)).toThrow("Invalid uncertainty settings");
  });

  it("collects initiator references and keeps the annualization of an event tree", () => {
    const mef = structuredClone(esMef);
    const tree = mef.eventTrees![0]!;
    tree.initiatingEventFrequency = {
      expression: {
        node: "OPERATION",
        operation: "MULTIPLY",
        operands: [reading("loop-a"), valued("FACTOR", 2)],
      },
      annualization: { basis: "CRITICAL_YEAR", hoursPerYear: 7_000 },
    };
    const source = { workbookId: "es-1", workbookRevision: 3, mef };
    expect(collectEsEventTreeReferences(source, ["et-1"])).toEqual({
      parameterReferences: [daReference("loop-a")],
      vectorReferences: [],
    });
    expect(adaptEsEventTreeSnapshot(source, "et-1")["initiatingEventFrequency"]).toEqual(tree.initiatingEventFrequency);
    delete tree.initiatingEventFrequency;
    expect(collectEsEventTreeReferences(source, ["et-1"])).toEqual({ parameterReferences: [], vectorReferences: [] });
    expect(() => adaptEsEventTreeSnapshot(source, "et-1")).toThrow("has no initiating-event frequency");
  });

  it("builds a load and capacity snapshot with the tables its fields reach", () => {
    const shared = estimate("capacity-mean", {
      unit: "QUANTITY",
      law: { family: "NORMAL", mean: 1800, standardDeviation: 20 },
    });
    const input = {
      id: "cell-1",
      revision: 4,
      load: { law: { family: "NORMAL" as const, mean: 1500, standardDeviation: 50 }, fields: [] },
      capacity: {
        law: { family: "NORMAL" as const, mean: 1800, standardDeviation: 60 },
        fields: [{ field: "mean", value: reading("capacity-mean") }],
      },
      unit: "degC",
    };
    expect(collectLoadCapacityReferences(input)).toEqual({ parameterReferences: [daReference("capacity-mean")], vectorReferences: [] });
    expect(() => adaptLoadCapacitySnapshot(input))
      .toThrow(expect.objectContaining({ code: "UNCERTAINTY_PARAMETER_UNRESOLVED" }));
    const snapshot = adaptLoadCapacitySnapshot(input, { parameters: parameterTable([shared]) });
    expect(snapshot).toEqual({
      id: "cell-1",
      methodType: "LOAD_CAPACITY",
      revision: 4,
      load: input.load,
      capacity: input.capacity,
      unit: "degC",
      uncertaintyParameters: [shared],
      uncertaintyVectors: [],
    });
    expect(LoadCapacityModelSnapshotSchema.safeParse(snapshot).success).toBe(true);
    const { unit: _unit, ...withoutUnit } = input;
    expect(adaptLoadCapacitySnapshot(withoutUnit, { parameters: parameterTable([shared]) })).not.toHaveProperty("unit");
  });

  it("fails deterministically when a requested workbook model cannot be resolved", () => {
    expect(() =>
      adaptSyFaultTreeSnapshot(
        { workbookId: "sy-1", workbookRevision: 1, mef: syMef },
        "missing",
      ),
    ).toThrow(WorkbookPraxisAdapterError);
    expect(() =>
      adaptEsqBayesianNetworkSnapshot(
        { workbookId: "esq-1", workbookRevision: 1, mef: esqMef },
        "missing",
      ),
    ).toThrow("ESQ Bayesian network 'missing' was not found");
  });
});
