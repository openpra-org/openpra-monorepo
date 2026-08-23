import type { BayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import {
  addNode,
  canConnect,
  connectNodes,
  deleteNode,
  normalizeCptRow,
} from "../bayesianNetworkOperations";

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

  it("deletes a node and rebuilds each affected child CPT", () => {
    const connected = connectNodes(model(), ID.a, ID.b);
    const deleted = deleteNode(connected, ID.a);
    const childTable = deleted.conditionalProbabilityTables.find(({ nodeId }) => nodeId === ID.b);

    expect(deleted.nodes.map(({ id }) => id)).toEqual([ID.b]);
    expect(deleted.edges).toEqual([]);
    expect(childTable?.parents).toEqual([]);
    expect(childTable?.rows).toHaveLength(1);
  });
});

export { ID, model };
