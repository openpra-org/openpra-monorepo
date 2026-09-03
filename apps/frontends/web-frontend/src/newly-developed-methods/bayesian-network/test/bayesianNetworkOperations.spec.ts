import {
  type BayesianNetworkModel,
  validateBayesianNetworkModules,
} from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import {
  addNode,
  canConnect,
  connectNodes,
  deleteNode,
  normalizeCptRow,
} from "../bayesianNetworkOperations";
import {
  compatibleBayesianNetworkModuleInputNodes,
  createBayesianNetworkModuleFromBranch,
  deleteBayesianNetworkModuleInstance,
  instantiateBayesianNetworkModule,
} from "../bayesianNetworkModules";

const ID = {
  model: "10000000-0000-4000-8000-000000000001",
  a: "10000000-0000-4000-8000-000000000002",
  aFalse: "10000000-0000-4000-8000-000000000003",
  aTrue: "10000000-0000-4000-8000-000000000004",
  aRow: "10000000-0000-4000-8000-000000000005",
  b: "10000000-0000-4000-8000-000000000006",
  bFalse: "10000000-0000-4000-8000-000000000007",
  bTrue: "10000000-0000-4000-8000-000000000008",
  bRow: "10000000-0000-4000-8000-000000000009",
} as const;

function model(): BayesianNetworkModel {
  return {
    modelId: ID.model,
    code: "BN-TEST",
    name: "Test network",
    description: "",
    nodes: [
      {
        id: ID.a,
        kind: "CHANCE_NODE",
        code: "A",
        name: "Cause",
        description: "",
        states: [
          { id: ID.aFalse, code: "FALSE", name: "False" },
          { id: ID.aTrue, code: "TRUE", name: "True" },
        ],
      },
      {
        id: ID.b,
        kind: "CHANCE_NODE",
        code: "B",
        name: "Effect",
        description: "",
        states: [
          { id: ID.bFalse, code: "FALSE", name: "False" },
          { id: ID.bTrue, code: "TRUE", name: "True" },
        ],
      },
    ],
    edges: [],
    conditionalProbabilityTables: [
      {
        nodeId: ID.a,
        parents: [],
        rows: [{
          id: ID.aRow,
          parentStates: [],
          values: [
            { stateId: ID.aFalse, probability: 0.8 },
            { stateId: ID.aTrue, probability: 0.2 },
          ],
        }],
      },
      {
        nodeId: ID.b,
        parents: [],
        rows: [{
          id: ID.bRow,
          parentStates: [],
          values: [
            { stateId: ID.bFalse, probability: 0.5 },
            { stateId: ID.bTrue, probability: 0.5 },
          ],
        }],
      },
    ],
    nodePositions: [],
    layout: {
      viewport: { x: 0, y: 0, zoom: 1 },
      mode: "AUTOMATIC",
      direction: "LEFT_TO_RIGHT",
    },
  };
}

function deterministicIds(): () => string {
  let value = 1;
  return () => `90000000-0000-4000-8000-${String(value++).padStart(12, "0")}`;
}

describe("Bayesian-network domain operations", () => {
  it("adds a discrete node with two states and a normalized prior", () => {
    const added = addNode(model());
    const node = added.model.nodes.find(({ id }) => id === added.nodeId);
    const table = added.model.conditionalProbabilityTables.find(({ nodeId }) => nodeId === added.nodeId);

    expect(node?.states).toHaveLength(2);
    expect(table?.rows).toHaveLength(1);
    expect(table?.rows[0]?.values.reduce((sum, value) => sum + value.probability, 0)).toBeCloseTo(1);
  });

  it("connects parent and child nodes and rebuilds the child CPT dimensions", () => {
    const connected = connectNodes(model(), ID.a, ID.b);
    const table = connected.conditionalProbabilityTables.find(({ nodeId }) => nodeId === ID.b);

    expect(connected.edges).toEqual([
      expect.objectContaining({ parentNodeId: ID.a, childNodeId: ID.b }),
    ]);
    expect(table?.parents).toEqual([{ nodeId: ID.a, order: 0 }]);
    expect(table?.rows).toHaveLength(2);
    expect(table?.rows.map((row) => row.parentStates[0]?.stateId)).toEqual([ID.aFalse, ID.aTrue]);
  });

  it("rejects duplicate and cyclic connections before mutation", () => {
    const connected = connectNodes(model(), ID.a, ID.b);

    expect(canConnect(connected, ID.a, ID.b)).toBe(false);
    expect(canConnect(connected, ID.b, ID.a)).toBe(false);
    expect(() => connectNodes(connected, ID.b, ID.a)).toThrow(/cycle/i);
  });

  it("normalizes only when explicitly requested", () => {
    const row = model().conditionalProbabilityTables[0]!.rows[0]!;
    const invalid = {
      ...row,
      values: row.values.map((value) => ({ ...value, probability: 0.2 })) as typeof row.values,
    };
    const normalized = normalizeCptRow(invalid);

    expect(invalid.values.reduce((sum, value) => sum + value.probability, 0)).toBeCloseTo(0.4);
    expect(normalized.values.map(({ probability }) => probability)).toEqual([0.5, 0.5]);
  });

  it("does not normalize probabilities outside the legal range", () => {
    const row = model().conditionalProbabilityTables[0]!.rows[0]!;
    const negative = {
      ...row,
      values: row.values.map((value, index) => ({
        ...value,
        probability: index === 0 ? -0.2 : value.probability,
      })) as typeof row.values,
    };
    const aboveOne = {
      ...row,
      values: row.values.map((value, index) => ({
        ...value,
        probability: index === 0 ? 1.2 : value.probability,
      })) as typeof row.values,
    };

    expect(normalizeCptRow(negative)).toBe(negative);
    expect(normalizeCptRow(aboveOne)).toBe(aboveOne);
  });

  it("deletes a node and rebuilds each affected child CPT", () => {
    const connected = connectNodes(model(), ID.a, ID.b);
    const deleted = deleteNode(connected, ID.a);
    const childTable = deleted.conditionalProbabilityTables.find(({ nodeId }) => nodeId === ID.b);

    expect(deleted.nodes.map(({ id }) => id)).toEqual([ID.b]);
    expect(deleted.edges).toEqual([]);
    expect(childTable?.parents).toEqual([]);
    expect(childTable?.rows).toHaveLength(1);
  });

  it("captures a branch as a reusable module with a typed upstream input", () => {
    const connected = connectNodes(model(), ID.a, ID.b);
    const created = createBayesianNetworkModuleFromBranch(connected, ID.b, deterministicIds());
    const template = created.model.moduleTemplates?.[0];

    expect(template).toMatchObject({
      code: "MOD-B",
      nodes: [expect.objectContaining({ code: "B" })],
      inputPorts: [expect.objectContaining({ code: "A", node: expect.objectContaining({ code: "A" }) })],
      outputPorts: [expect.objectContaining({ code: "B" })],
    });
    expect(template?.conditionalProbabilityTables[0]?.parents[0]?.nodeId).toBe(
      template?.inputPorts[0]?.node.id,
    );
  });

  it("materializes independent module nodes while preserving CPT semantics", () => {
    const connected = connectNodes(model(), ID.a, ID.b);
    const created = createBayesianNetworkModuleFromBranch(connected, ID.b, deterministicIds());
    const template = created.model.moduleTemplates![0]!;
    const port = template.inputPorts[0]!;
    const instantiated = instantiateBayesianNetworkModule(created.model, template.id, {
      code: "PUMP-TRAIN-2",
      name: "Pump train 2",
      inputBindings: [{ portId: port.id, nodeId: ID.a }],
    }, deterministicIds());
    const instance = instantiated.model.moduleInstances?.[0];
    const copiedNode = instantiated.model.nodes.find((node) => node.id === instance?.nodeMappings[0]?.nodeId);
    const copiedTable = instantiated.model.conditionalProbabilityTables.find(
      (table) => table.nodeId === copiedNode?.id,
    );

    expect(copiedNode).toMatchObject({ code: "PUMP-TRAIN-2-B", name: "Pump train 2 · Effect" });
    expect(copiedNode?.id).not.toBe(ID.b);
    expect(copiedTable?.parents).toEqual([{ nodeId: ID.a, order: 0 }]);
    expect(copiedTable?.rows.map((row) => row.values.map((value) => value.probability))).toEqual(
      connected.conditionalProbabilityTables.find((table) => table.nodeId === ID.b)?.rows
        .map((row) => row.values.map((value) => value.probability)),
    );
    expect(instantiated.outputNodeIds).toEqual([copiedNode?.id]);
    expect(validateBayesianNetworkModules(instantiated.model)).toEqual([]);
  });

  it("filters module input choices by state contract and rejects incompatible bindings", () => {
    const connected = connectNodes(model(), ID.a, ID.b);
    const created = createBayesianNetworkModuleFromBranch(connected, ID.b, deterministicIds());
    const template = created.model.moduleTemplates![0]!;
    const port = template.inputPorts[0]!;
    const incompatible = {
      ...created.model,
      nodes: created.model.nodes.map((node) => node.id === ID.a
        ? {
            ...node,
            states: [
              { ...node.states[0], code: "LOW" },
              { ...node.states[1], code: "HIGH" },
            ] as typeof node.states,
          }
        : node),
    };

    expect(compatibleBayesianNetworkModuleInputNodes(incompatible, port).map((node) => node.id)).not.toContain(ID.a);
    expect(() => instantiateBayesianNetworkModule(incompatible, template.id, {
      inputBindings: [{ portId: port.id, nodeId: ID.a }],
    }, deterministicIds())).toThrow(/requires states/i);
  });

  it("removes a module instance without touching its reusable template or source branch", () => {
    const connected = connectNodes(model(), ID.a, ID.b);
    const created = createBayesianNetworkModuleFromBranch(connected, ID.b, deterministicIds());
    const template = created.model.moduleTemplates![0]!;
    const instantiated = instantiateBayesianNetworkModule(created.model, template.id, {
      inputBindings: [{ portId: template.inputPorts[0]!.id, nodeId: ID.a }],
    }, deterministicIds());
    const instance = instantiated.model.moduleInstances![0]!;
    const removed = deleteBayesianNetworkModuleInstance(instantiated.model, instance.id);

    expect(removed.nodes.map((node) => node.id)).toEqual([ID.a, ID.b]);
    expect(removed.moduleTemplates).toHaveLength(1);
    expect(removed.moduleInstances).toEqual([]);
  });

  it("detects stale materialized module mappings before analysis", () => {
    const connected = connectNodes(model(), ID.a, ID.b);
    const created = createBayesianNetworkModuleFromBranch(connected, ID.b, deterministicIds());
    const template = created.model.moduleTemplates![0]!;
    const instantiated = instantiateBayesianNetworkModule(created.model, template.id, {
      inputBindings: [{ portId: template.inputPorts[0]!.id, nodeId: ID.a }],
    }, deterministicIds()).model;
    const stale = {
      ...instantiated,
      moduleInstances: instantiated.moduleInstances?.map((instance) => ({
        ...instance,
        nodeMappings: instance.nodeMappings.map((mapping) => ({ ...mapping, stateMappings: [] })),
      })),
    };

    expect(validateBayesianNetworkModules(stale).map((issue) => issue.code)).toContain(
      "BN_MODULE_STATE_MAPPING_MISMATCH",
    );
  });

  it("protects module-to-module input dependencies during deletion", () => {
    const ids = deterministicIds();
    const connected = connectNodes(model(), ID.a, ID.b);
    const created = createBayesianNetworkModuleFromBranch(connected, ID.b, ids);
    const template = created.model.moduleTemplates![0]!;
    const first = instantiateBayesianNetworkModule(created.model, template.id, {
      code: "FIRST",
      inputBindings: [{ portId: template.inputPorts[0]!.id, nodeId: ID.a }],
    }, ids);
    const second = instantiateBayesianNetworkModule(first.model, template.id, {
      code: "SECOND",
      inputBindings: [{ portId: template.inputPorts[0]!.id, nodeId: first.outputNodeIds[0]! }],
    }, ids);

    expect(() => deleteBayesianNetworkModuleInstance(second.model, first.instanceId)).toThrow(
      /dependent module instance SECOND/i,
    );
  });
});

export { ID, model };
