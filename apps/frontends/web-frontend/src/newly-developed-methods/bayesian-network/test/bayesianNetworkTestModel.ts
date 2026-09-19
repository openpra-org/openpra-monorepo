import type { BayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";

const TEST_ID = {
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

function testBayesianNetworkModel(): BayesianNetworkModel {
  return {
    modelId: TEST_ID.model,
    code: "BN-TEST",
    name: "Test network",
    description: "",
    nodes: [
      {
        id: TEST_ID.a,
        kind: "CHANCE_NODE",
        code: "A",
        name: "Cause",
        description: "",
        states: [
          { id: TEST_ID.aFalse, code: "FALSE", name: "False" },
          { id: TEST_ID.aTrue, code: "TRUE", name: "True" },
        ],
      },
      {
        id: TEST_ID.b,
        kind: "CHANCE_NODE",
        code: "B",
        name: "Effect",
        description: "",
        states: [
          { id: TEST_ID.bFalse, code: "FALSE", name: "False" },
          { id: TEST_ID.bTrue, code: "TRUE", name: "True" },
        ],
      },
    ],
    edges: [],
    conditionalProbabilityTables: [
      {
        nodeId: TEST_ID.a,
        parents: [],
        rows: [{
          id: TEST_ID.aRow,
          parentStates: [],
          values: [
            { stateId: TEST_ID.aFalse, probability: 0.8 },
            { stateId: TEST_ID.aTrue, probability: 0.2 },
          ],
        }],
      },
      {
        nodeId: TEST_ID.b,
        parents: [],
        rows: [{
          id: TEST_ID.bRow,
          parentStates: [],
          values: [
            { stateId: TEST_ID.bFalse, probability: 0.5 },
            { stateId: TEST_ID.bTrue, probability: 0.5 },
          ],
        }],
      },
    ],
    nodePositions: [
      { nodeId: TEST_ID.a, position: { x: 40, y: 40 } },
      { nodeId: TEST_ID.b, position: { x: 300, y: 40 } },
    ],
    layout: {
      viewport: { x: 0, y: 0, zoom: 1 },
      mode: "AUTOMATIC",
      direction: "LEFT_TO_RIGHT",
    },
  };
}

export { TEST_ID, testBayesianNetworkModel };
