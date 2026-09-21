import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { DistributionType } from "interfaces-mef-types/core/events";
import {
  WorkbookPraxisAdapterError,
  adaptEsEventTreeSnapshot,
  adaptEsqBayesianNetworkSnapshot,
  adaptSyBayesianNetworkSnapshot,
  adaptEsqHclSnapshot,
  adaptSyFaultTreeSnapshot,
  collectSyFaultTreeControlledDataSources,
  workbookParameterReferenceKey,
} from "../praxis-snapshot-adapters";

const syMef = {
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
    { uuid: "be-a", code: "BE-A", name: "Event A", probability: 0.2 },
    {
      uuid: "be-b",
      code: "BE-B",
      name: "Event B",
      description: "Backup",
      probability: 0.1,
    },
  ],
} as SystemsAnalysis;

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
      initiatingEventFrequency: { value: 0.01 },
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
    expect(adapted.basicEventCatalogue["basicEvents"]).toEqual([
      expect.objectContaining({ id: "be-a", probability: { value: 0.2 } }),
      expect.objectContaining({ id: "be-b", probability: { value: 0.1 } }),
    ]);
    expect(syMef).toEqual(before);
  });

  it("carries applicable CCF groups and basic-event uncertainty into the native catalogue", () => {
    const mef = structuredClone(syMef);
    mef.commonCauseFailureGroups = [{
      uuid: "ccf-1",
      name: "Shared support",
      description: "Shared support failure",
      scope: "INTRASYSTEM",
      affectedComponents: [],
      affectedSystems: ["system-1"],
      modelType: "BETA_FACTOR",
      modelSpecificParameters: {
        betaFactorParameters: { beta: 0.1, totalFailureProbability: 0.2 },
      },
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
      parameterUncertainties: [{
        parameterId: "be-a",
        distributionType: DistributionType.BETA,
        distributionParameters: { alpha: 2, beta: 18 },
        basis: "Posterior uncertainty",
      }],
      implementsSrs: [],
    }];

    const adapted = adaptSyFaultTreeSnapshot({ workbookId: "sy-1", workbookRevision: 7, mef }, "ft-1");
    expect(adapted.basicEventCatalogue["commonCauseFailureGroups"]).toEqual([{
      id: "ccf-1",
      members: ["be-a", "be-b"],
      model: { kind: "BETA_FACTOR", beta: 0.1 },
      totalFailureProbability: 0.2,
    }]);
    expect(adapted.basicEventCatalogue["uncertaintyInputs"]).toEqual([{
      basicEventId: "be-a",
      distributionType: "beta",
      parameters: { alpha: 2, beta: 18 },
    }]);
  });

  it("discovers and resolves typed DA-controlled probabilities without using the cached SY value", () => {
    const mef = structuredClone(syMef);
    const reference = {
      referenceType: "WORKBOOK_PARAMETER" as const,
      workbookId: "da-1",
      entityId: "parameter-a",
    };
    mef.systemBasicEvents[0] = {
      ...mef.systemBasicEvents[0]!,
      probability: 0.99,
      controlledDataSource: reference,
    };
    const source = { workbookId: "sy-1", workbookRevision: 7, mef };

    expect(collectSyFaultTreeControlledDataSources(source, "ft-1")).toEqual([reference]);
    expect(() => adaptSyFaultTreeSnapshot(source, "ft-1")).toThrow(
      "could not resolve controlled DA parameter",
    );
    const adapted = adaptSyFaultTreeSnapshot(source, "ft-1", {
      controlledDataSourceValues: new Map([[workbookParameterReferenceKey(reference), 0.35]]),
    });
    expect(adapted.basicEventCatalogue["basicEvents"]).toEqual([
      expect.objectContaining({
        id: "be-a",
        probability: { value: 0.35, controlledDataSource: reference },
      }),
      expect.objectContaining({ id: "be-b", probability: { value: 0.1 } }),
    ]);
  });

  it("rejects saved FT linear conversion with an addressable review error", () => {
    const mef = structuredClone(syMef);
    mef.systemBasicEvents[0] = { ...mef.systemBasicEvents[0]!, quantificationBasis: {
      kind: "FAILURE_RATE", conversion: "LINEAR",
      failureRate: { value: .001, unit: "HOUR" }, missionTime: { value: 100, unit: "HOUR" },
    } };
    const original = structuredClone(mef);
    expect(() => adaptSyFaultTreeSnapshot({ workbookId: "sy-1", workbookRevision: 7, mef }, "ft-1"))
      .toThrow(expect.objectContaining({ code: "SY_FAILURE_RATE_CONVERSION_REVIEW_REQUIRED", details: { basicEventId: "be-a" } }));
    expect(mef).toEqual(original);
  });

  it("resolves a DA-controlled failure rate and derives its mission probability", () => {
    const mef = structuredClone(syMef);
    const reference = {
      referenceType: "WORKBOOK_PARAMETER" as const,
      workbookId: "da-1",
      entityId: "rate-a",
    };
    mef.systemBasicEvents[0] = {
      ...mef.systemBasicEvents[0]!,
      probability: 0,
      quantificationBasis: {
        kind: "FAILURE_RATE",
        failureRate: { value: 0, unit: "HOUR" },
        missionTime: { value: 24, unit: "HOUR" },
        conversion: "EXPONENTIAL",
      },
      controlledDataSource: reference,
    };
    const adapted = adaptSyFaultTreeSnapshot(
      { workbookId: "sy-1", workbookRevision: 7, mef },
      "ft-1",
      {
        controlledDataSourceValues: new Map([[
          workbookParameterReferenceKey(reference),
          { value: 2e-5, quantity: "FAILURE_RATE" },
        ]]),
      },
    );
    const events = adapted.basicEventCatalogue["basicEvents"] as Array<Record<string, unknown>>;
    expect(events[0]).toEqual(expect.objectContaining({
      id: "be-a",
      probability: expect.objectContaining({
        value: 0.0004798848184297544, // HCL_MH calculation type 3.
        quantificationBasis: {
          kind: "FAILURE_RATE",
          failureRate: { value: 2e-5, unit: "HOUR" },
          missionTime: { value: 24, unit: "HOUR" },
          conversion: "EXPONENTIAL",
        },
      }),
    }));
  });

  it("rejects a controlled source whose quantity does not match the basic-event basis", () => {
    const mef = structuredClone(syMef);
    const reference = {
      referenceType: "WORKBOOK_PARAMETER" as const,
      workbookId: "da-1",
      entityId: "rate-a",
    };
    mef.systemBasicEvents[0] = {
      ...mef.systemBasicEvents[0]!,
      controlledDataSource: reference,
    };
    expect(() => adaptSyFaultTreeSnapshot(
      { workbookId: "sy-1", workbookRevision: 7, mef },
      "ft-1",
      {
        controlledDataSourceValues: new Map([[
          workbookParameterReferenceKey(reference),
          { value: 2e-5, quantity: "FAILURE_RATE" },
        ]]),
      },
    )).toThrow("expects a probability source");
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
    expect(adapted.basicEventCatalogue["basicEvents"]).toEqual([
      expect.objectContaining({ id: "be-a", probability: { value: 0.2 } }),
    ]);

    // A back edge at the same depth must still produce a structured cycle error.
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
      probability: 0.05,
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
    expect(adapted.basicEventCatalogue["basicEvents"]).toEqual([
      expect.objectContaining({ id: "be-a", probability: { value: 0.2 } }),
      expect.objectContaining({ id: "be-b", probability: { value: 0.1 } }),
      expect.objectContaining({ id: "be-c", probability: { value: 0.05 } }),
    ]);
    expect(
      (adapted.basicEventCatalogue["basicEvents"] as Array<{ id: string }>).filter(
        ({ id }) => id === "be-a",
      ),
    ).toHaveLength(1);
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
      initiatingEventFrequency: { value: 0.01 },
      hclConfiguration: { configuration: { modelId: "hcl-1" } },
    });
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
    settings.uncertainty = { sampleCount: 10, seed: 42, basicEventDistributions: [], cptRowDistributions: [],
      cptGenerators: [{ generator: { family: "UNREVIEWED" } }] } as unknown as NonNullable<typeof settings.uncertainty>;
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

  // Execution validation uses real workbook identities and current references.
  const uncertaintyFixture = () => {
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
    "row-1": "769c6a5d-266d-5653-8444-e46aadeff59b"
};
    return JSON.parse(JSON.stringify(esqMef, (_key, value) => typeof value === "string"
      ? value === "FAULT_TREE_BASIC_EVENT_CATALOGUE" ? "FAULT_TREE_BASIC_EVENT" : ids[value] ?? value
      : value)) as EventSequenceQuantification;
  };

  it.each(([undefined, "MC", "LHS"] as const).flatMap((sampler) => (["BETA", "DIRICHLET"] as const).map((family) => [sampler, family] as const)))("adapts CPT priors with sampler %s / %s into the PRAXIS HCL snapshot", (sampler, family) => {
    const prior = family === "BETA" ? { family, alpha: 2, beta: 8, trueStateId: "123e4567-e89b-42d3-a456-426614174702" } as const : { family, alpha: [80, 20] };
    const mef = uncertaintyFixture();
    mef.hclConfigurations[0]!.solverSettings.uncertainty = {
      sampleCount: 500,
      seed: 2026,
      sampler: sampler,
      cptProbabilityClipEpsilon: 0.01,
      basicEventDistributions: [{
        faultTreeBasicEvent: {
          referenceType: "FAULT_TREE_BASIC_EVENT",
          workbookId: "sy-1",
          entityId: "1e86ecf0-df01-5bde-8d0c-39df2d5947d1",
        },
        distribution: { family: "BETA", alpha: 2, beta: 18 },
      }],
      cptRowDistributions: [{
        bayesianNetworkNode: {
          referenceType: "BAYESIAN_NETWORK_NODE",
          workbookId: "esq-1",
          modelId: "b8fcb955-7ed8-54dc-8547-b21211f35650",
          entityId: "726a04e3-a685-5681-ac94-efe34c05944e",
        },
        cptRowId: "769c6a5d-266d-5653-8444-e46aadeff59b",
        prior,
      }],
    };

    const adapted = adaptEsqHclSnapshot(
      { workbookId: "esq-1", workbookRevision: 9, mef },
      "be2caff7-2730-5de2-9525-fc1564e9e73c",
      "UNCERTAINTY",
    );

    expect(adapted["solverSettings"]).toMatchObject({
      uncertainty: {
        sampleCount: 500,
        seed: 2026,
        sampler: sampler ?? "MC",
        cptProbabilityClipEpsilon: 0.01,
        basicEventDistributions: [{
          faultTreeBasicEvent: { entityId: "1e86ecf0-df01-5bde-8d0c-39df2d5947d1" },
          distribution: { family: "BETA", alpha: 2, beta: 18 },
        }],
        cptRowDistributions: [{
          bayesianNetworkNode: { modelId: "b8fcb955-7ed8-54dc-8547-b21211f35650", entityId: "726a04e3-a685-5681-ac94-efe34c05944e" },
          cptRowId: "769c6a5d-266d-5653-8444-e46aadeff59b",
          prior,
        }],
      },
    });
  });

  it("normalizes the old FT sampler spelling without losing LHS", () => {
    const mef = uncertaintyFixture();
    mef.hclConfigurations[0]!.solverSettings.uncertainty = Object.assign({ sampleCount: 100, seed: 42, basicEventDistributions: [], cptRowDistributions: [] }, { basicEventSampler: "LHS" });
    const adapted = adaptEsqHclSnapshot({ workbookId: "esq-1", workbookRevision: 9, mef }, "be2caff7-2730-5de2-9525-fc1564e9e73c", "UNCERTAINTY");
    expect(adapted["solverSettings"]).toMatchObject({ uncertainty: { sampler: "LHS" } });
    expect(JSON.stringify(adapted["solverSettings"])).not.toContain("basicEventSampler");
  });

  it.each(["seismic_fragility", "seismic_pga_bins"] as const)("transports %s generator parameters unchanged", (type) => {
    const a = "123e4567-e89b-42d3-a456-426614174702", b = "123e4567-e89b-42d3-a456-426614174703";
    const generator = type === "seismic_fragility"
      ? { type, pgaParentId: a, theta: .5, betaR: .3, betaU: .2, trueStateId: a, falseStateId: b, pgaCenters: [{ stateId: a, value: .5 }, { stateId: b, value: 0 }] }
      : { type, noneStateId: b, missionTime: 1, frequencyToProbability: "linear" as const, bins: [{ stateId: a, medianFrequency: .01, errorFactor95: 2 }] };
    const mef = uncertaintyFixture();
    mef.hclConfigurations[0]!.solverSettings.uncertainty = { sampleCount: 513, seed: 42, sampler: "LHS", basicEventDistributions: [], cptRowDistributions: [], cptGenerators: [{ bayesianNetworkNode: { referenceType: "BAYESIAN_NETWORK_NODE", workbookId: "esq-1", modelId: "b8fcb955-7ed8-54dc-8547-b21211f35650", entityId: "726a04e3-a685-5681-ac94-efe34c05944e" }, generator }] };
    const adapted = adaptEsqHclSnapshot({ workbookId: "esq-1", workbookRevision: 9, mef }, "be2caff7-2730-5de2-9525-fc1564e9e73c", "UNCERTAINTY");
    expect(adapted["solverSettings"]).toMatchObject({ uncertainty: { sampler: "LHS", cptGenerators: [{ bayesianNetworkNode: { modelId: "b8fcb955-7ed8-54dc-8547-b21211f35650", entityId: "726a04e3-a685-5681-ac94-efe34c05944e" }, generator }] } });
    Object.assign(generator, { type: "invented_generator" });
    expect(() => adaptEsqHclSnapshot({ workbookId: "esq-1", workbookRevision: 9, mef }, "be2caff7-2730-5de2-9525-fc1564e9e73c", "UNCERTAINTY")).toThrow("Invalid uncertainty settings");
  });

  it("rejects an ESS-only CPT row before creating an executable snapshot", () => {
    const mef = uncertaintyFixture();
    const legacy = { sampleCount: 100, seed: 42, basicEventDistributions: [], cptRowDistributions: [{
      bayesianNetworkNode: { referenceType: "BAYESIAN_NETWORK_NODE", workbookId: "esq-1", modelId: "b8fcb955-7ed8-54dc-8547-b21211f35650", entityId: "726a04e3-a685-5681-ac94-efe34c05944e" },
      cptRowId: "769c6a5d-266d-5653-8444-e46aadeff59b", equivalentSampleSize: 100,
    }] };
    Object.assign(mef.hclConfigurations[0]!.solverSettings, { uncertainty: legacy });
    expect(() => adaptEsqHclSnapshot({ workbookId: "esq-1", workbookRevision: 9, mef }, "be2caff7-2730-5de2-9525-fc1564e9e73c", "UNCERTAINTY")).toThrow("Invalid uncertainty settings");
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
