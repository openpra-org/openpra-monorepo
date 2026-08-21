import {
  BayesianNetworkChanceNodeSchema,
  BayesianNetworkConditionalProbabilityTableSchema,
  BayesianNetworkDirectedEdgeSchema,
  BayesianNetworkEvidenceConfigurationSchema,
  BayesianNetworkMarginalResultSchema,
  BayesianNetworkNodeSchema,
  BayesianNetworkNodePositionSchema,
  BayesianNetworkParentReferenceSchema,
  BayesianNetworkQueryRequestSchema,
} from "..";

const NODE_ID = "123e4567-e89b-42d3-a456-426614174300";
const FALSE_STATE_ID = "123e4567-e89b-42d3-a456-426614174301";
const TRUE_STATE_ID = "123e4567-e89b-42d3-a456-426614174302";
const UNKNOWN_STATE_ID = "123e4567-e89b-42d3-a456-426614174303";
const PARENT_NODE_ID = "123e4567-e89b-42d3-a456-426614174304";
const PARENT_STATE_ID = "123e4567-e89b-42d3-a456-426614174305";
const EDGE_ID = "123e4567-e89b-42d3-a456-426614174306";
const ROW_ID = "123e4567-e89b-42d3-a456-426614174307";

const nodeIdentity = {
  id: NODE_ID,
  code: "N-PUMP-STATE",
  name: "Pump state",
  description: "Discrete state of the pump.",
  kind: "CHANCE_NODE" as const,
};

const falseState = { id: FALSE_STATE_ID, code: "AVAILABLE", name: "Available" };
const trueState = { id: TRUE_STATE_ID, code: "FAILED", name: "Failed" };
const unknownState = { id: UNKNOWN_STATE_ID, code: "UNKNOWN", name: "Unknown" };

describe("Bayesian-network discrete chance-node contracts", () => {
  it("accepts a binary chance node", () => {
    expect(BayesianNetworkChanceNodeSchema.safeParse({ ...nodeIdentity, states: [falseState, trueState] }).success).toBe(
      true,
    );
  });

  it("accepts a chance node with more than two discrete states", () => {
    expect(
      BayesianNetworkChanceNodeSchema.safeParse({
        ...nodeIdentity,
        states: [falseState, trueState, unknownState],
      }).success,
    ).toBe(true);
  });

  it.each([{ states: [] }, { states: [falseState] }])(
    "rejects a chance node with fewer than two states",
    ({ states }) => {
      expect(BayesianNetworkChanceNodeSchema.safeParse({ ...nodeIdentity, states }).success).toBe(false);
    },
  );

  it.each([
    { ...nodeIdentity, id: "N-PUMP-STATE", states: [falseState, trueState] },
    { ...nodeIdentity, kind: "DECISION_NODE", states: [falseState, trueState] },
    { ...nodeIdentity, states: [{ ...falseState, id: "AVAILABLE" }, trueState] },
    { ...nodeIdentity, states: [{ ...falseState, code: "   " }, trueState] },
    { ...nodeIdentity, states: [{ ...falseState, probability: 0.9 }, trueState] },
    { ...nodeIdentity, states: [falseState, trueState], continuous: true },
  ])("rejects malformed or unsupported chance node %#", (node) => {
    expect(BayesianNetworkChanceNodeSchema.safeParse(node).success).toBe(false);
  });
});

describe("initial Bayesian-network node scope", () => {
  const chanceNode = { ...nodeIdentity, states: [falseState, trueState] };

  it("exposes a chance-node-only public node schema", () => {
    expect(BayesianNetworkNodeSchema.safeParse(chanceNode).success).toBe(true);
  });

  it.each(["DECISION_NODE", "UTILITY_NODE", "DETERMINISTIC_NODE"])("rejects unsupported %s nodes", (kind) => {
    expect(BayesianNetworkNodeSchema.safeParse({ ...chanceNode, kind }).success).toBe(false);
  });

  it.each([
    { ...chanceNode, valueType: "CONTINUOUS", distribution: "NORMAL" },
    { ...chanceNode, timeSlice: 1 },
    { ...chanceNode, deterministicExpression: "PARENT_A && PARENT_B" },
    { ...chanceNode, utilityValues: [0, 1] },
    { ...chanceNode, decisions: ["MAINTAIN", "WAIT"] },
  ])("rejects unsupported node behavior %#", (node) => {
    expect(BayesianNetworkNodeSchema.safeParse(node).success).toBe(false);
  });
});

describe("Bayesian-network graph and CPT contracts", () => {
  const values = [
    { stateId: FALSE_STATE_ID, probability: 0.98 },
    { stateId: TRUE_STATE_ID, probability: 0.02 },
  ];
  const rootTable = {
    nodeId: NODE_ID,
    parents: [],
    rows: [{ id: ROW_ID, parentStates: [], values }],
  };
  const conditionalTable = {
    nodeId: NODE_ID,
    parents: [{ nodeId: PARENT_NODE_ID, order: 0 }],
    rows: [
      {
        id: ROW_ID,
        parentStates: [{ parentNodeId: PARENT_NODE_ID, stateId: PARENT_STATE_ID }],
        values,
      },
    ],
  };

  it("accepts a stable directed edge", () => {
    expect(
      BayesianNetworkDirectedEdgeSchema.safeParse({
        id: EDGE_ID,
        parentNodeId: PARENT_NODE_ID,
        childNodeId: NODE_ID,
      }).success,
    ).toBe(true);
  });

  it("records explicit non-negative parent order", () => {
    expect(BayesianNetworkParentReferenceSchema.safeParse({ nodeId: PARENT_NODE_ID, order: 0 }).success).toBe(true);
    expect(BayesianNetworkParentReferenceSchema.safeParse({ nodeId: PARENT_NODE_ID, order: 2 }).success).toBe(true);
  });

  it("accepts root and conditional CPT shapes", () => {
    expect(BayesianNetworkConditionalProbabilityTableSchema.safeParse(rootTable).success).toBe(true);
    expect(BayesianNetworkConditionalProbabilityTableSchema.safeParse(conditionalTable).success).toBe(true);
  });

  it.each([0, 0.5, 1])("accepts CPT boundary/value probability %s", (probability) => {
    const candidate = {
      ...rootTable,
      rows: [
        {
          ...rootTable.rows[0],
          values: [values[0], { ...values[1], probability }],
        },
      ],
    };
    expect(BayesianNetworkConditionalProbabilityTableSchema.safeParse(candidate).success).toBe(true);
  });

  it("records finite canvas coordinates by stable node UUID", () => {
    expect(BayesianNetworkNodePositionSchema.safeParse({ nodeId: NODE_ID, position: { x: 120, y: -40 } }).success).toBe(
      true,
    );
  });

  it.each([
    { id: "EDGE-1", parentNodeId: PARENT_NODE_ID, childNodeId: NODE_ID },
    { id: EDGE_ID, parentNodeId: "PARENT", childNodeId: NODE_ID },
    { id: EDGE_ID, parentNodeId: PARENT_NODE_ID, childNodeId: "CHILD" },
    { id: EDGE_ID, parentNodeId: PARENT_NODE_ID, childNodeId: NODE_ID, directed: true },
  ])("rejects malformed directed edge %#", (edge) => {
    expect(BayesianNetworkDirectedEdgeSchema.safeParse(edge).success).toBe(false);
  });

  it.each([
    { nodeId: PARENT_NODE_ID, order: -1 },
    { nodeId: PARENT_NODE_ID, order: 1.5 },
    { nodeId: "PARENT", order: 0 },
    { nodeId: PARENT_NODE_ID, order: 0, name: "Parent" },
  ])("rejects malformed parent reference %#", (parent) => {
    expect(BayesianNetworkParentReferenceSchema.safeParse(parent).success).toBe(false);
  });

  it.each([
    {
      ...rootTable,
      rows: [{ ...rootTable.rows[0], values: [values[0]] }],
    },
    {
      ...rootTable,
      rows: [{ ...rootTable.rows[0], values: [values[0], { ...values[1], probability: -0.01 }] }],
    },
    {
      ...rootTable,
      rows: [{ ...rootTable.rows[0], values: [values[0], { ...values[1], probability: 1.01 }] }],
    },
    {
      ...conditionalTable,
      rows: [
        {
          ...conditionalTable.rows[0],
          parentStates: [{ parentNodeId: "PARENT", stateId: PARENT_STATE_ID }],
        },
      ],
    },
    { ...rootTable, nodeId: "NODE" },
    { ...rootTable, normalized: true },
  ])("rejects malformed CPT %#", (table) => {
    expect(BayesianNetworkConditionalProbabilityTableSchema.safeParse(table).success).toBe(false);
  });

  it.each([
    { nodeId: "NODE", position: { x: 0, y: 0 } },
    { nodeId: NODE_ID, position: { x: Number.NaN, y: 0 } },
    { nodeId: NODE_ID, position: { x: 0, y: 0 }, label: "Pump" },
  ])("rejects malformed node position %#", (position) => {
    expect(BayesianNetworkNodePositionSchema.safeParse(position).success).toBe(false);
  });
});

describe("Bayesian-network evidence, query, and marginal contracts", () => {
  const evidence = {
    observations: [{ nodeId: PARENT_NODE_ID, stateId: PARENT_STATE_ID }],
  };
  const query = {
    evidence,
    queryNodeIds: [NODE_ID],
  };
  const marginal = {
    nodeId: NODE_ID,
    values: [
      { stateId: FALSE_STATE_ID, probability: 0.8 },
      { stateId: TRUE_STATE_ID, probability: 0.2 },
    ],
  };

  it("accepts empty and observed evidence configurations", () => {
    expect(BayesianNetworkEvidenceConfigurationSchema.safeParse({ observations: [] }).success).toBe(true);
    expect(BayesianNetworkEvidenceConfigurationSchema.safeParse(evidence).success).toBe(true);
  });

  it("accepts a query with one or more unique target nodes", () => {
    expect(BayesianNetworkQueryRequestSchema.safeParse(query).success).toBe(true);
    expect(
      BayesianNetworkQueryRequestSchema.safeParse({ ...query, queryNodeIds: [NODE_ID, PARENT_NODE_ID] }).success,
    ).toBe(true);
  });

  it("accepts a normalized binary marginal", () => {
    expect(BayesianNetworkMarginalResultSchema.safeParse(marginal).success).toBe(true);
  });

  it("accepts a normalized multistate marginal within floating-point tolerance", () => {
    expect(
      BayesianNetworkMarginalResultSchema.safeParse({
        nodeId: NODE_ID,
        values: [
          { stateId: FALSE_STATE_ID, probability: 0.1 },
          { stateId: TRUE_STATE_ID, probability: 0.2 },
          { stateId: UNKNOWN_STATE_ID, probability: 0.7000000001 },
        ],
      }).success,
    ).toBe(true);
  });

  it.each([
    { observations: [{ nodeId: "PARENT", stateId: PARENT_STATE_ID }] },
    { observations: [{ nodeId: PARENT_NODE_ID, stateId: "FAILED" }] },
    {
      observations: [
        { nodeId: PARENT_NODE_ID, stateId: PARENT_STATE_ID },
        { nodeId: PARENT_NODE_ID, stateId: UNKNOWN_STATE_ID },
      ],
    },
    { observations: [], likelihood: 1 },
  ])("rejects malformed or conflicting evidence %#", (candidate) => {
    expect(BayesianNetworkEvidenceConfigurationSchema.safeParse(candidate).success).toBe(false);
  });

  it.each([
    { ...query, queryNodeIds: [] },
    { ...query, queryNodeIds: ["NODE"] },
    { ...query, queryNodeIds: [NODE_ID, NODE_ID] },
    { ...query, backend: "TENSORBAYES" },
  ])("rejects malformed query %#", (candidate) => {
    expect(BayesianNetworkQueryRequestSchema.safeParse(candidate).success).toBe(false);
  });

  it.each([
    { ...marginal, nodeId: "NODE" },
    { ...marginal, values: [marginal.values[0]] },
    {
      ...marginal,
      values: [marginal.values[0], { ...marginal.values[1], probability: -0.01 }],
    },
    {
      ...marginal,
      values: [marginal.values[0], { ...marginal.values[1], probability: 0.1 }],
    },
    { ...marginal, normalized: true },
  ])("rejects malformed marginal %#", (candidate) => {
    expect(BayesianNetworkMarginalResultSchema.safeParse(candidate).success).toBe(false);
  });
});
