import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import {
  WorkbookPraxisAdapterError,
  adaptEsEventTreeSnapshot,
  adaptEsqBayesianNetworkSnapshot,
  adaptEsqHclSnapshot,
  adaptSyFaultTreeSnapshot,
} from "../praxis-snapshot-adapters";

const syMef = {
  systemLogicModels: [
    {
      uuid: "ft-1",
      faultTree: {
        id: "top",
        type: "AND",
        name: "Top gate",
        children: [
          { id: "leaf-a", type: "BE", basicEventId: "be-a" },
          {
            id: "or-gate",
            type: "OR",
            name: "Backup gate",
            children: [{ id: "leaf-b", type: "BE", basicEventId: "be-b" }],
          },
        ],
      },
    },
  ],
  systemBasicEvents: [
    { uuid: "be-a", name: "Event A", probability: 0.2 },
    { uuid: "be-b", name: "Event B", description: "Backup", probability: 0.1 },
  ],
} as SystemsAnalysis;

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
