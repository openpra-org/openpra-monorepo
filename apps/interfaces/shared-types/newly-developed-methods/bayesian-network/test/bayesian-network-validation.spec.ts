import {
  AnalysisReadyValidationOutcomeSchema,
  DraftValidationOutcomeSchema,
  ValidationIssueSchema,
} from "../../shared";
import type { HclEventBinding } from "../../hybrid-causal-logic";
import type { BayesianNetworkEvidenceConfiguration, BayesianNetworkModel, BayesianNetworkNodeState } from "..";
import {
  validateBayesianNetworkCpts,
  validateBayesianNetworkAnalysisReady,
  validateBayesianNetworkDraft,
  validateBayesianNetworkEvidence,
  validateBayesianNetworkGraph,
  validateBayesianNetworkHclBindings,
  validateBayesianNetworkIdentity,
  validateBayesianNetworkModel,
  validateBayesianNetworkNodeStateCount,
} from "..";

const MODEL_ID = "123e4567-e89b-42d3-a456-426614174500";
const CAUSE_NODE_ID = "123e4567-e89b-42d3-a456-426614174501";
const EFFECT_NODE_ID = "123e4567-e89b-42d3-a456-426614174502";
const CAUSE_FALSE_STATE_ID = "123e4567-e89b-42d3-a456-426614174503";
const CAUSE_TRUE_STATE_ID = "123e4567-e89b-42d3-a456-426614174504";
const EFFECT_FALSE_STATE_ID = "123e4567-e89b-42d3-a456-426614174505";
const EFFECT_TRUE_STATE_ID = "123e4567-e89b-42d3-a456-426614174506";
const CAUSE_UNKNOWN_STATE_ID = "123e4567-e89b-42d3-a456-426614174507";
const EDGE_CAUSE_EFFECT_ID = "123e4567-e89b-42d3-a456-426614174508";
const EDGE_EFFECT_CAUSE_ID = "123e4567-e89b-42d3-a456-426614174509";
const MISSING_NODE_ID = "123e4567-e89b-42d3-a456-426614174510";
const EDGE_EFFECT_OTHER_ID = "123e4567-e89b-42d3-a456-426614174511";
const EDGE_OTHER_CAUSE_ID = "123e4567-e89b-42d3-a456-426614174512";
const CAUSE_ROOT_ROW_ID = "123e4567-e89b-42d3-a456-426614174513";
const EFFECT_ROOT_ROW_ID = "123e4567-e89b-42d3-a456-426614174514";
const EFFECT_CAUSE_FALSE_ROW_ID = "123e4567-e89b-42d3-a456-426614174515";
const EFFECT_CAUSE_TRUE_ROW_ID = "123e4567-e89b-42d3-a456-426614174516";
const MISSING_STATE_ID = "123e4567-e89b-42d3-a456-426614174517";
const HCL_BINDING_ID = "123e4567-e89b-42d3-a456-426614174518";
const FT_MODEL_ID = "123e4567-e89b-42d3-a456-426614174519";
const FT_BASIC_EVENT_ID = "123e4567-e89b-42d3-a456-426614174520";
const OTHER_BN_MODEL_ID = "123e4567-e89b-42d3-a456-426614174521";

const model: BayesianNetworkModel = {
  schemaVersion: "1.0.0",
  id: MODEL_ID,
  projectId: "project-mhtgr",
  methodType: "BAYESIAN_NETWORK",
  code: "BN-HCL",
  name: "HCL Bayesian network",
  description: "Bayesian network used to test identity validation.",
  revision: 1,
  createdBy: "analyst@example.com",
  createdAt: "2026-08-20T16:00:00.000Z",
  updatedBy: "analyst@example.com",
  updatedAt: "2026-08-20T16:00:00.000Z",
  nodes: [
    {
      id: CAUSE_NODE_ID,
      code: "CAUSE",
      name: "Cause",
      description: "Causal state.",
      kind: "CHANCE_NODE",
      states: [
        { id: CAUSE_FALSE_STATE_ID, code: "FALSE", name: "False" },
        { id: CAUSE_TRUE_STATE_ID, code: "TRUE", name: "True" },
      ],
    },
    {
      id: EFFECT_NODE_ID,
      code: "EFFECT",
      name: "Effect",
      description: "Effect state.",
      kind: "CHANCE_NODE",
      states: [
        { id: EFFECT_FALSE_STATE_ID, code: "FALSE", name: "False" },
        { id: EFFECT_TRUE_STATE_ID, code: "TRUE", name: "True" },
      ],
    },
  ],
  edges: [],
  conditionalProbabilityTables: [
    {
      nodeId: CAUSE_NODE_ID,
      parents: [],
      rows: [
        {
          id: CAUSE_ROOT_ROW_ID,
          parentStates: [],
          values: [
            { stateId: CAUSE_FALSE_STATE_ID, probability: 0.5 },
            { stateId: CAUSE_TRUE_STATE_ID, probability: 0.5 },
          ],
        },
      ],
    },
    {
      nodeId: EFFECT_NODE_ID,
      parents: [],
      rows: [
        {
          id: EFFECT_ROOT_ROW_ID,
          parentStates: [],
          values: [
            { stateId: EFFECT_FALSE_STATE_ID, probability: 0.6 },
            { stateId: EFFECT_TRUE_STATE_ID, probability: 0.4 },
          ],
        },
      ],
    },
  ],
  nodePositions: [],
  layout: {
    viewport: { x: 0, y: 0, zoom: 1 },
    mode: "MANUAL",
    direction: "LEFT_TO_RIGHT",
  },
};

describe("Bayesian-network identity validation", () => {
  it("accepts unique node identities and states that are unique within their node", () => {
    expect(validateBayesianNetworkIdentity(model)).toEqual([]);
    expect(validateBayesianNetworkModel(model)).toEqual([]);
  });

  it("reports duplicate node ids against the later node", () => {
    const issues = validateBayesianNetworkIdentity({
      ...model,
      nodes: [model.nodes[0], { ...model.nodes[1], id: CAUSE_NODE_ID }],
    });

    expect(issues).toEqual([
      expect.objectContaining({
        code: "BN_DUPLICATE_NODE_ID",
        entityId: CAUSE_NODE_ID,
        fieldPath: ["nodes", 1, "id"],
      }),
    ]);
  });

  it("treats node codes as case-insensitively unique", () => {
    const issues = validateBayesianNetworkIdentity({
      ...model,
      nodes: [model.nodes[0], { ...model.nodes[1], code: " cause " }],
    });

    expect(issues).toEqual([
      expect.objectContaining({
        code: "BN_DUPLICATE_NODE_CODE",
        entityId: EFFECT_NODE_ID,
        fieldPath: ["nodes", 1, "code"],
      }),
    ]);
  });

  it("reports duplicate state ids within a node", () => {
    const causeNode = model.nodes[0];
    const issues = validateBayesianNetworkIdentity({
      ...model,
      nodes: [
        {
          ...causeNode,
          states: [causeNode.states[0], { ...causeNode.states[1], id: CAUSE_FALSE_STATE_ID }],
        },
        model.nodes[1],
      ],
    });

    expect(issues).toEqual([
      expect.objectContaining({
        code: "BN_DUPLICATE_STATE_ID",
        entityId: CAUSE_FALSE_STATE_ID,
        fieldPath: ["nodes", 0, "states", 1, "id"],
      }),
    ]);
  });

  it("treats state codes as case-insensitively unique within a node", () => {
    const causeNode = model.nodes[0];
    const issues = validateBayesianNetworkIdentity({
      ...model,
      nodes: [
        {
          ...causeNode,
          states: [causeNode.states[0], { ...causeNode.states[1], code: " false " }],
        },
        model.nodes[1],
      ],
    });

    expect(issues).toEqual([
      expect.objectContaining({
        code: "BN_DUPLICATE_STATE_CODE",
        entityId: CAUSE_TRUE_STATE_ID,
        fieldPath: ["nodes", 0, "states", 1, "code"],
      }),
    ]);
  });

  it("scopes state identity to each node", () => {
    const effectNode = model.nodes[1];
    expect(
      validateBayesianNetworkIdentity({
        ...model,
        nodes: [
          model.nodes[0],
          {
            ...effectNode,
            states: [
              { ...effectNode.states[0], id: CAUSE_FALSE_STATE_ID, code: "FALSE" },
              { ...effectNode.states[1], id: CAUSE_TRUE_STATE_ID, code: "TRUE" },
            ],
          },
        ],
      }),
    ).toEqual([]);
  });

  it("emits schema-valid, addressable issues for every duplicate identity", () => {
    const causeNode = model.nodes[0];
    const issues = validateBayesianNetworkModel({
      ...model,
      nodes: [
        causeNode,
        {
          ...causeNode,
          states: [causeNode.states[0], causeNode.states[0]],
        },
      ],
    });

    expect(issues.filter((issue) => issue.code.startsWith("BN_DUPLICATE_")).map((issue) => issue.code)).toEqual([
      "BN_DUPLICATE_NODE_ID",
      "BN_DUPLICATE_NODE_CODE",
      "BN_DUPLICATE_STATE_ID",
      "BN_DUPLICATE_STATE_CODE",
    ]);
    expect(issues.every((issue) => ValidationIssueSchema.safeParse(issue).success)).toBe(true);
  });
});

describe("Bayesian-network node-state-count validation", () => {
  const withCauseStates = (states: BayesianNetworkNodeState[]): BayesianNetworkModel =>
    ({
      ...model,
      nodes: [{ ...model.nodes[0], states }, model.nodes[1]],
    }) as unknown as BayesianNetworkModel;

  it("accepts nodes with exactly two or more states", () => {
    expect(validateBayesianNetworkNodeStateCount(model)).toEqual([]);
    expect(
      validateBayesianNetworkNodeStateCount(
        withCauseStates([
          ...model.nodes[0].states,
          { id: CAUSE_UNKNOWN_STATE_ID, code: "UNKNOWN", name: "Unknown" },
        ]),
      ),
    ).toEqual([]);
  });

  it.each([{ states: [] }, { states: [model.nodes[0].states[0]] }])(
    "reports a node with fewer than two states",
    ({ states }) => {
      expect(validateBayesianNetworkNodeStateCount(withCauseStates(states))).toEqual([
        expect.objectContaining({
          code: "BN_NODE_STATES_MINIMUM",
          entityId: CAUSE_NODE_ID,
          fieldPath: ["nodes", 0, "states"],
        }),
      ]);
    },
  );

  it("includes the state-count finding in aggregate validation", () => {
    expect(validateBayesianNetworkModel(withCauseStates([]))).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "BN_NODE_STATES_MINIMUM" })]),
    );
  });

  it("emits a schema-valid issue addressed to the affected node's states", () => {
    const [issue] = validateBayesianNetworkNodeStateCount(withCauseStates([]));
    expect(ValidationIssueSchema.safeParse(issue).success).toBe(true);
  });
});

describe("Bayesian-network graph validation", () => {
  const causeToEffect: BayesianNetworkModel["edges"][number] = {
    id: EDGE_CAUSE_EFFECT_ID,
    parentNodeId: CAUSE_NODE_ID,
    childNodeId: EFFECT_NODE_ID,
  };
  const effectToCause: BayesianNetworkModel["edges"][number] = {
    id: EDGE_EFFECT_CAUSE_ID,
    parentNodeId: EFFECT_NODE_ID,
    childNodeId: CAUSE_NODE_ID,
  };

  it("accepts an acyclic graph and a CPT parent backed by its directed edge", () => {
    expect(
      validateBayesianNetworkGraph({
        ...model,
        edges: [causeToEffect],
        conditionalProbabilityTables: [
          { nodeId: EFFECT_NODE_ID, parents: [{ nodeId: CAUSE_NODE_ID, order: 0 }], rows: [] },
        ],
      }),
    ).toEqual([]);
  });

  it("reports dangling edge parent and child references", () => {
    expect(
      validateBayesianNetworkGraph({
        ...model,
        edges: [
          { ...causeToEffect, parentNodeId: MISSING_NODE_ID },
          { ...effectToCause, childNodeId: MISSING_NODE_ID },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        code: "BN_EDGE_PARENT_NOT_FOUND",
        entityId: MISSING_NODE_ID,
        fieldPath: ["edges", 0, "parentNodeId"],
      }),
      expect.objectContaining({
        code: "BN_EDGE_CHILD_NOT_FOUND",
        entityId: MISSING_NODE_ID,
        fieldPath: ["edges", 1, "childNodeId"],
      }),
    ]);
  });

  it("reports edge endpoints that ambiguously resolve to duplicate nodes", () => {
    expect(
      validateBayesianNetworkGraph({
        ...model,
        nodes: [model.nodes[0], model.nodes[0], model.nodes[1], model.nodes[1]],
        edges: [causeToEffect],
      }),
    ).toEqual([
      expect.objectContaining({
        code: "BN_EDGE_PARENT_AMBIGUOUS",
        fieldPath: ["edges", 0, "parentNodeId"],
      }),
      expect.objectContaining({
        code: "BN_EDGE_CHILD_AMBIGUOUS",
        fieldPath: ["edges", 0, "childNodeId"],
      }),
    ]);
  });

  it("rejects a self-cycle", () => {
    expect(
      validateBayesianNetworkGraph({
        ...model,
        edges: [{ ...causeToEffect, childNodeId: CAUSE_NODE_ID }],
      }),
    ).toEqual([
      expect.objectContaining({
        code: "BN_DIRECTED_CYCLE",
        entityId: EDGE_CAUSE_EFFECT_ID,
        fieldPath: ["edges", 0],
      }),
    ]);
  });

  it("reports every edge in a multi-node directed cycle", () => {
    const issues = validateBayesianNetworkGraph({ ...model, edges: [causeToEffect, effectToCause] });
    expect(issues.map((issue) => issue.code)).toEqual(["BN_DIRECTED_CYCLE", "BN_DIRECTED_CYCLE"]);
    expect(issues.map((issue) => issue.entityId)).toEqual([EDGE_CAUSE_EFFECT_ID, EDGE_EFFECT_CAUSE_ID]);
  });

  it("reports an edge only once when it participates in overlapping cycles", () => {
    const otherNode = { ...model.nodes[0], id: MISSING_NODE_ID, code: "OTHER-CAUSE" };
    const issues = validateBayesianNetworkGraph({
      ...model,
      nodes: [...model.nodes, otherNode],
      edges: [
        causeToEffect,
        effectToCause,
        { id: EDGE_EFFECT_OTHER_ID, parentNodeId: EFFECT_NODE_ID, childNodeId: MISSING_NODE_ID },
        { id: EDGE_OTHER_CAUSE_ID, parentNodeId: MISSING_NODE_ID, childNodeId: CAUSE_NODE_ID },
      ],
    });

    expect(issues.map((issue) => issue.entityId)).toEqual([
      EDGE_CAUSE_EFFECT_ID,
      EDGE_EFFECT_CAUSE_ID,
      EDGE_EFFECT_OTHER_ID,
      EDGE_OTHER_CAUSE_ID,
    ]);
  });

  it("does not mistake a converging acyclic graph for a cycle", () => {
    const thirdNode = {
      ...model.nodes[0],
      id: MISSING_NODE_ID,
      code: "OTHER-CAUSE",
    };
    expect(
      validateBayesianNetworkGraph({
        ...model,
        nodes: [...model.nodes, thirdNode],
        edges: [causeToEffect, { ...effectToCause, parentNodeId: MISSING_NODE_ID, childNodeId: EFFECT_NODE_ID }],
      }),
    ).toEqual([]);
  });

  it("reports dangling and ambiguous CPT parent references", () => {
    expect(
      validateBayesianNetworkGraph({
        ...model,
        nodes: [model.nodes[0], model.nodes[0], model.nodes[1]],
        conditionalProbabilityTables: [
          {
            nodeId: EFFECT_NODE_ID,
            parents: [
              { nodeId: MISSING_NODE_ID, order: 0 },
              { nodeId: CAUSE_NODE_ID, order: 1 },
            ],
            rows: [],
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        code: "BN_CPT_PARENT_NOT_FOUND",
        fieldPath: ["conditionalProbabilityTables", 0, "parents", 0, "nodeId"],
      }),
      expect.objectContaining({
        code: "BN_CPT_PARENT_AMBIGUOUS",
        fieldPath: ["conditionalProbabilityTables", 0, "parents", 1, "nodeId"],
      }),
    ]);
  });

  it("requires every resolved CPT parent to have a matching directed edge", () => {
    expect(
      validateBayesianNetworkGraph({
        ...model,
        conditionalProbabilityTables: [
          { nodeId: EFFECT_NODE_ID, parents: [{ nodeId: CAUSE_NODE_ID, order: 0 }], rows: [] },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        code: "BN_CPT_PARENT_EDGE_REQUIRED",
        entityId: CAUSE_NODE_ID,
        fieldPath: ["conditionalProbabilityTables", 0, "parents", 0, "nodeId"],
      }),
    ]);
  });

  it("includes graph findings in aggregate validation", () => {
    expect(
      validateBayesianNetworkModel({ ...model, edges: [{ ...causeToEffect, childNodeId: MISSING_NODE_ID }] }),
    ).toEqual([expect.objectContaining({ code: "BN_EDGE_CHILD_NOT_FOUND" })]);
  });

  it("emits schema-valid, addressable issues for parent references and cycles", () => {
    const issues = validateBayesianNetworkGraph({
      ...model,
      edges: [causeToEffect, effectToCause],
      conditionalProbabilityTables: [
        { nodeId: EFFECT_NODE_ID, parents: [{ nodeId: MISSING_NODE_ID, order: 0 }], rows: [] },
      ],
    });
    expect(issues.every((issue) => ValidationIssueSchema.safeParse(issue).success)).toBe(true);
  });
});

describe("Bayesian-network CPT validation", () => {
  const causeToEffect: BayesianNetworkModel["edges"][number] = {
    id: EDGE_CAUSE_EFFECT_ID,
    parentNodeId: CAUSE_NODE_ID,
    childNodeId: EFFECT_NODE_ID,
  };
  const conditionalEffectTable: BayesianNetworkModel["conditionalProbabilityTables"][number] = {
    nodeId: EFFECT_NODE_ID,
    parents: [{ nodeId: CAUSE_NODE_ID, order: 0 }],
    rows: [
      {
        id: EFFECT_CAUSE_FALSE_ROW_ID,
        parentStates: [{ parentNodeId: CAUSE_NODE_ID, stateId: CAUSE_FALSE_STATE_ID }],
        values: [
          { stateId: EFFECT_FALSE_STATE_ID, probability: 0.8 },
          { stateId: EFFECT_TRUE_STATE_ID, probability: 0.2 },
        ],
      },
      {
        id: EFFECT_CAUSE_TRUE_ROW_ID,
        parentStates: [{ parentNodeId: CAUSE_NODE_ID, stateId: CAUSE_TRUE_STATE_ID }],
        values: [
          { stateId: EFFECT_FALSE_STATE_ID, probability: 0.1 },
          { stateId: EFFECT_TRUE_STATE_ID, probability: 0.9 },
        ],
      },
    ],
  };
  const conditionalModel: BayesianNetworkModel = {
    ...model,
    edges: [causeToEffect],
    conditionalProbabilityTables: [model.conditionalProbabilityTables[0], conditionalEffectTable],
  };

  it("accepts complete root and conditional tables with normalized rows", () => {
    expect(validateBayesianNetworkCpts(model)).toEqual([]);
    expect(validateBayesianNetworkCpts(conditionalModel)).toEqual([]);
  });

  it("requires exactly one CPT per node", () => {
    expect(
      validateBayesianNetworkCpts({
        ...model,
        conditionalProbabilityTables: [model.conditionalProbabilityTables[0]],
      }),
    ).toEqual([
      expect.objectContaining({
        code: "BN_CPT_REQUIRED",
        entityId: EFFECT_NODE_ID,
        fieldPath: ["conditionalProbabilityTables"],
      }),
    ]);

    expect(
      validateBayesianNetworkCpts({
        ...model,
        conditionalProbabilityTables: [
          ...model.conditionalProbabilityTables,
          model.conditionalProbabilityTables[0],
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        code: "BN_CPT_DUPLICATE",
        entityId: CAUSE_NODE_ID,
        fieldPath: ["conditionalProbabilityTables", 2, "nodeId"],
      }),
    ]);
  });

  it("reports dangling and ambiguous CPT node references", () => {
    expect(
      validateBayesianNetworkCpts({
        ...model,
        conditionalProbabilityTables: [
          ...model.conditionalProbabilityTables,
          { ...model.conditionalProbabilityTables[0], nodeId: MISSING_NODE_ID },
        ],
      }).map((issue) => issue.code),
    ).toEqual(["BN_CPT_NODE_NOT_FOUND"]);

    expect(
      validateBayesianNetworkCpts({
        ...model,
        nodes: [model.nodes[0], model.nodes[0], model.nodes[1]],
      }).map((issue) => issue.code),
    ).toEqual(["BN_CPT_NODE_AMBIGUOUS"]);
  });

  it("requires CPT parent declarations to match incoming edges", () => {
    expect(validateBayesianNetworkCpts({ ...model, edges: [causeToEffect] })).toEqual([
      expect.objectContaining({
        code: "BN_CPT_PARENT_MISSING",
        entityId: EDGE_CAUSE_EFFECT_ID,
        fieldPath: ["conditionalProbabilityTables", 1, "parents"],
      }),
    ]);
  });

  it("defers row dimensions until an unresolved CPT parent is repaired", () => {
    expect(
      validateBayesianNetworkModel({
        ...model,
        conditionalProbabilityTables: [
          model.conditionalProbabilityTables[0],
          {
            ...conditionalEffectTable,
            parents: [{ nodeId: MISSING_NODE_ID, order: 0 }],
            rows: [],
          },
        ],
      }).map((issue) => issue.code),
    ).toEqual(["BN_CPT_PARENT_NOT_FOUND"]);
  });

  it("requires unique, contiguous parent ordering", () => {
    expect(
      validateBayesianNetworkCpts({
        ...conditionalModel,
        conditionalProbabilityTables: [
          model.conditionalProbabilityTables[0],
          { ...conditionalEffectTable, parents: [{ nodeId: CAUSE_NODE_ID, order: 1 }], rows: [] },
        ],
      }).map((issue) => issue.code),
    ).toEqual(["BN_CPT_PARENT_ORDER_INVALID"]);

    expect(
      validateBayesianNetworkCpts({
        ...conditionalModel,
        conditionalProbabilityTables: [
          model.conditionalProbabilityTables[0],
          {
            ...conditionalEffectTable,
            parents: [
              { nodeId: CAUSE_NODE_ID, order: 0 },
              { nodeId: CAUSE_NODE_ID, order: 1 },
            ],
            rows: [],
          },
        ],
      }).map((issue) => issue.code),
    ).toEqual(["BN_CPT_DUPLICATE_PARENT"]);
  });

  it("requires one row for every parent-state combination", () => {
    expect(
      validateBayesianNetworkCpts({
        ...model,
        conditionalProbabilityTables: [{ ...model.conditionalProbabilityTables[0], rows: [] }, model.conditionalProbabilityTables[1]],
      }).map((issue) => issue.code),
    ).toEqual(["BN_CPT_ROW_COUNT_MISMATCH"]);

    expect(
      validateBayesianNetworkCpts({
        ...conditionalModel,
        conditionalProbabilityTables: [
          model.conditionalProbabilityTables[0],
          { ...conditionalEffectTable, rows: [conditionalEffectTable.rows[0]] },
        ],
      }).map((issue) => issue.code),
    ).toEqual(["BN_CPT_ROW_COUNT_MISMATCH"]);
  });

  it("validates each row's declared-parent state selections", () => {
    const validateFirstRow = (parentStates: typeof conditionalEffectTable.rows[number]["parentStates"]) =>
      validateBayesianNetworkCpts({
        ...conditionalModel,
        conditionalProbabilityTables: [
          model.conditionalProbabilityTables[0],
          {
            ...conditionalEffectTable,
            rows: [{ ...conditionalEffectTable.rows[0], parentStates }, conditionalEffectTable.rows[1]],
          },
        ],
      }).map((issue) => issue.code);

    expect(validateFirstRow([])).toEqual(["BN_CPT_ROW_PARENT_STATES_INCOMPLETE"]);
    expect(
      validateFirstRow([
        conditionalEffectTable.rows[0].parentStates[0],
        conditionalEffectTable.rows[0].parentStates[0],
      ]),
    ).toEqual(["BN_CPT_ROW_PARENT_DUPLICATE"]);
    expect(
      validateFirstRow([
        ...conditionalEffectTable.rows[0].parentStates,
        { parentNodeId: MISSING_NODE_ID, stateId: MISSING_STATE_ID },
      ]),
    ).toEqual(["BN_CPT_ROW_PARENT_UNEXPECTED"]);
    expect(validateFirstRow([{ parentNodeId: CAUSE_NODE_ID, stateId: MISSING_STATE_ID }])).toEqual([
      "BN_CPT_ROW_PARENT_STATE_INVALID",
    ]);
  });

  it("rejects duplicate parent-state combinations", () => {
    expect(
      validateBayesianNetworkCpts({
        ...conditionalModel,
        conditionalProbabilityTables: [
          model.conditionalProbabilityTables[0],
          {
            ...conditionalEffectTable,
            rows: [
              conditionalEffectTable.rows[0],
              {
                ...conditionalEffectTable.rows[1],
                parentStates: conditionalEffectTable.rows[0].parentStates,
              },
            ],
          },
        ],
      }).map((issue) => issue.code),
    ).toEqual(["BN_CPT_DUPLICATE_PARENT_COMBINATION"]);
  });

  it("requires each row to assign every target-node state exactly once", () => {
    const firstRow = conditionalEffectTable.rows[0];
    expect(
      validateBayesianNetworkCpts({
        ...conditionalModel,
        conditionalProbabilityTables: [
          model.conditionalProbabilityTables[0],
          {
            ...conditionalEffectTable,
            rows: [
              {
                ...firstRow,
                values: [firstRow.values[0], { ...firstRow.values[1], stateId: EFFECT_FALSE_STATE_ID }],
              },
              conditionalEffectTable.rows[1],
            ],
          },
        ],
      }).map((issue) => issue.code),
    ).toEqual(["BN_CPT_VALUE_STATES_MISMATCH"]);
  });

  it("rejects non-finite and out-of-range CPT probabilities", () => {
    const firstRow = conditionalEffectTable.rows[0];
    const issues = validateBayesianNetworkCpts({
      ...conditionalModel,
      conditionalProbabilityTables: [
        model.conditionalProbabilityTables[0],
        {
          ...conditionalEffectTable,
          rows: [
            {
              ...firstRow,
              values: [
                { ...firstRow.values[0], probability: Number.NaN },
                { ...firstRow.values[1], probability: 1.1 },
              ],
            },
            conditionalEffectTable.rows[1],
          ],
        },
      ],
    });
    expect(issues.map((issue) => issue.code)).toEqual([
      "BN_CPT_PROBABILITY_INVALID",
      "BN_CPT_PROBABILITY_INVALID",
    ]);
  });

  it("requires row probabilities to sum to one within floating-point tolerance", () => {
    const firstRow = conditionalEffectTable.rows[0];
    const withProbabilities = (falseProbability: number, trueProbability: number) => ({
      ...conditionalModel,
      conditionalProbabilityTables: [
        model.conditionalProbabilityTables[0],
        {
          ...conditionalEffectTable,
          rows: [
            {
              ...firstRow,
              values: [
                { ...firstRow.values[0], probability: falseProbability },
                { ...firstRow.values[1], probability: trueProbability },
              ],
            },
            conditionalEffectTable.rows[1],
          ],
        },
      ],
    } as BayesianNetworkModel);

    expect(validateBayesianNetworkCpts(withProbabilities(0.3, 0.7000000001))).toEqual([]);
    expect(validateBayesianNetworkCpts(withProbabilities(0.3, 0.6))).toEqual([
      expect.objectContaining({
        code: "BN_CPT_ROW_NOT_NORMALIZED",
        entityId: EFFECT_CAUSE_FALSE_ROW_ID,
        fieldPath: ["conditionalProbabilityTables", 1, "rows", 0, "values"],
      }),
    ]);
  });

  it("includes CPT findings in aggregate validation", () => {
    expect(
      validateBayesianNetworkModel({
        ...model,
        conditionalProbabilityTables: [
          { ...model.conditionalProbabilityTables[0], rows: [] },
          model.conditionalProbabilityTables[1],
        ],
      }).map((issue) => issue.code),
    ).toEqual(["BN_CPT_ROW_COUNT_MISMATCH"]);
  });

  it("emits schema-valid, addressable CPT issues", () => {
    const issues = validateBayesianNetworkCpts({
      ...conditionalModel,
      conditionalProbabilityTables: [
        model.conditionalProbabilityTables[0],
        {
          ...conditionalEffectTable,
          rows: [
            {
              ...conditionalEffectTable.rows[0],
              parentStates: [{ parentNodeId: CAUSE_NODE_ID, stateId: MISSING_STATE_ID }],
            },
            conditionalEffectTable.rows[1],
          ],
        },
      ],
    });
    expect(issues.every((issue) => ValidationIssueSchema.safeParse(issue).success)).toBe(true);
  });
});

describe("Bayesian-network evidence validation", () => {
  const evidence: BayesianNetworkEvidenceConfiguration = {
    observations: [
      { nodeId: CAUSE_NODE_ID, stateId: CAUSE_TRUE_STATE_ID },
      { nodeId: EFFECT_NODE_ID, stateId: EFFECT_FALSE_STATE_ID },
    ],
  };

  it("accepts empty evidence and states that belong to each observed node", () => {
    expect(validateBayesianNetworkEvidence(model, { observations: [] })).toEqual([]);
    expect(validateBayesianNetworkEvidence(model, evidence)).toEqual([]);
  });

  it("reports dangling and ambiguous evidence node references", () => {
    expect(
      validateBayesianNetworkEvidence(model, {
        observations: [{ nodeId: MISSING_NODE_ID, stateId: MISSING_STATE_ID }],
      }),
    ).toEqual([
      expect.objectContaining({
        code: "BN_EVIDENCE_NODE_NOT_FOUND",
        entityId: MISSING_NODE_ID,
        fieldPath: ["evidence", "observations", 0, "nodeId"],
      }),
    ]);

    expect(
      validateBayesianNetworkEvidence(
        { ...model, nodes: [model.nodes[0], model.nodes[0], model.nodes[1]] },
        { observations: [evidence.observations[0]] },
      ),
    ).toEqual([expect.objectContaining({ code: "BN_EVIDENCE_NODE_AMBIGUOUS" })]);
  });

  it("reports evidence states that are absent or ambiguous within their node", () => {
    expect(
      validateBayesianNetworkEvidence(model, {
        observations: [{ nodeId: CAUSE_NODE_ID, stateId: MISSING_STATE_ID }],
      }),
    ).toEqual([
      expect.objectContaining({
        code: "BN_EVIDENCE_STATE_NOT_FOUND",
        entityId: MISSING_STATE_ID,
        fieldPath: ["evidence", "observations", 0, "stateId"],
      }),
    ]);

    const causeNode = model.nodes[0];
    expect(
      validateBayesianNetworkEvidence(
        {
          ...model,
          nodes: [
            { ...causeNode, states: [causeNode.states[0], causeNode.states[0]] },
            model.nodes[1],
          ],
        },
        { observations: [{ nodeId: CAUSE_NODE_ID, stateId: CAUSE_FALSE_STATE_ID }] },
      ),
    ).toEqual([expect.objectContaining({ code: "BN_EVIDENCE_STATE_AMBIGUOUS" })]);
  });

  it("rejects multiple evidence observations for the same node", () => {
    expect(
      validateBayesianNetworkEvidence(model, {
        observations: [
          { nodeId: CAUSE_NODE_ID, stateId: CAUSE_FALSE_STATE_ID },
          { nodeId: CAUSE_NODE_ID, stateId: CAUSE_TRUE_STATE_ID },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        code: "BN_EVIDENCE_NODE_DUPLICATE",
        entityId: CAUSE_NODE_ID,
        fieldPath: ["evidence", "observations", 1, "nodeId"],
      }),
    ]);
  });

  it("includes supplied evidence findings in aggregate validation", () => {
    expect(
      validateBayesianNetworkModel(model, {
        evidence: { observations: [{ nodeId: EFFECT_NODE_ID, stateId: MISSING_STATE_ID }] },
      }),
    ).toEqual([expect.objectContaining({ code: "BN_EVIDENCE_STATE_NOT_FOUND" })]);
    expect(validateBayesianNetworkModel(model)).toEqual([]);
  });

  it("emits schema-valid, addressable evidence issues", () => {
    const issues = validateBayesianNetworkEvidence(model, {
      observations: [
        { nodeId: MISSING_NODE_ID, stateId: MISSING_STATE_ID },
        { nodeId: MISSING_NODE_ID, stateId: MISSING_STATE_ID },
      ],
    });
    expect(issues.every((issue) => ValidationIssueSchema.safeParse(issue).success)).toBe(true);
  });
});

describe("Bayesian-network HCL true-state validation", () => {
  const binding: HclEventBinding = {
    id: HCL_BINDING_ID,
    faultTreeBasicEvent: { modelId: FT_MODEL_ID, entityId: FT_BASIC_EVENT_ID },
    bayesianNetworkNode: { modelId: MODEL_ID, entityId: CAUSE_NODE_ID },
    trueStateIds: [CAUSE_TRUE_STATE_ID],
  };

  it("accepts a non-empty proper subset of the bound node's states", () => {
    expect(validateBayesianNetworkHclBindings(model, [binding])).toEqual([]);

    const causeNode = model.nodes[0];
    expect(
      validateBayesianNetworkHclBindings(
        {
          ...model,
          nodes: [
            {
              ...causeNode,
              states: [
                ...causeNode.states,
                { id: CAUSE_UNKNOWN_STATE_ID, code: "UNKNOWN", name: "Unknown" },
              ],
            },
            model.nodes[1],
          ],
        },
        [{ ...binding, trueStateIds: [CAUSE_FALSE_STATE_ID, CAUSE_TRUE_STATE_ID] }],
      ),
    ).toEqual([]);
  });

  it("requires the binding to reference the supplied BN model", () => {
    expect(
      validateBayesianNetworkHclBindings(model, [
        { ...binding, bayesianNetworkNode: { ...binding.bayesianNetworkNode, modelId: OTHER_BN_MODEL_ID } },
      ]),
    ).toEqual([
      expect.objectContaining({
        code: "BN_HCL_MODEL_MISMATCH",
        entityId: HCL_BINDING_ID,
        fieldPath: ["bindings", 0, "bayesianNetworkNode", "modelId"],
      }),
    ]);
  });

  it("reports dangling and ambiguous bound-node references", () => {
    expect(
      validateBayesianNetworkHclBindings(model, [
        { ...binding, bayesianNetworkNode: { modelId: MODEL_ID, entityId: MISSING_NODE_ID } },
      ]),
    ).toEqual([
      expect.objectContaining({
        code: "BN_HCL_NODE_NOT_FOUND",
        entityId: MISSING_NODE_ID,
        fieldPath: ["bindings", 0, "bayesianNetworkNode", "entityId"],
      }),
    ]);

    expect(
      validateBayesianNetworkHclBindings(
        { ...model, nodes: [model.nodes[0], model.nodes[0], model.nodes[1]] },
        [binding],
      ),
    ).toEqual([expect.objectContaining({ code: "BN_HCL_NODE_AMBIGUOUS" })]);
  });

  it("requires a non-empty, duplicate-free true-state selection", () => {
    expect(
      validateBayesianNetworkHclBindings(model, [
        { ...binding, trueStateIds: [] } as unknown as HclEventBinding,
      ]),
    ).toEqual([expect.objectContaining({ code: "BN_HCL_TRUE_STATES_REQUIRED" })]);

    expect(
      validateBayesianNetworkHclBindings(model, [
        { ...binding, trueStateIds: [CAUSE_TRUE_STATE_ID, CAUSE_TRUE_STATE_ID] },
      ]),
    ).toEqual([
      expect.objectContaining({
        code: "BN_HCL_TRUE_STATE_DUPLICATE",
        entityId: HCL_BINDING_ID,
        fieldPath: ["bindings", 0, "trueStateIds", 1],
      }),
    ]);
  });

  it("reports true states that are absent or ambiguous within the bound node", () => {
    expect(validateBayesianNetworkHclBindings(model, [{ ...binding, trueStateIds: [MISSING_STATE_ID] }])).toEqual([
      expect.objectContaining({
        code: "BN_HCL_TRUE_STATE_NOT_FOUND",
        entityId: MISSING_STATE_ID,
        fieldPath: ["bindings", 0, "trueStateIds", 0],
      }),
    ]);

    const causeNode = model.nodes[0];
    expect(
      validateBayesianNetworkHclBindings(
        {
          ...model,
          nodes: [
            { ...causeNode, states: [causeNode.states[0], causeNode.states[0]] },
            model.nodes[1],
          ],
        },
        [{ ...binding, trueStateIds: [CAUSE_FALSE_STATE_ID] }],
      ),
    ).toEqual([expect.objectContaining({ code: "BN_HCL_TRUE_STATE_AMBIGUOUS" })]);
  });

  it("rejects a true-state selection containing every state of the bound node", () => {
    expect(
      validateBayesianNetworkHclBindings(model, [
        { ...binding, trueStateIds: [CAUSE_FALSE_STATE_ID, CAUSE_TRUE_STATE_ID] },
      ]),
    ).toEqual([
      expect.objectContaining({
        code: "BN_HCL_TRUE_STATES_CANNOT_INCLUDE_ALL",
        entityId: HCL_BINDING_ID,
        fieldPath: ["bindings", 0, "trueStateIds"],
      }),
    ]);
  });

  it("includes supplied HCL binding findings in aggregate validation", () => {
    expect(
      validateBayesianNetworkModel(model, {
        hclBindings: [{ ...binding, trueStateIds: [CAUSE_FALSE_STATE_ID, CAUSE_TRUE_STATE_ID] }],
      }),
    ).toEqual([expect.objectContaining({ code: "BN_HCL_TRUE_STATES_CANNOT_INCLUDE_ALL" })]);
  });

  it("emits schema-valid, addressable HCL true-state issues", () => {
    const issues = validateBayesianNetworkHclBindings(model, [
      { ...binding, trueStateIds: [MISSING_STATE_ID] },
    ]);
    expect(issues.every((issue) => ValidationIssueSchema.safeParse(issue).success)).toBe(true);
  });
});

describe("Bayesian-network validation policy integration", () => {
  const validatedAt = "2026-08-20T18:00:00.000Z";
  const incompleteModel: BayesianNetworkModel = { ...model, conditionalProbabilityTables: [] };

  it("reports an incomplete BN draft without preventing it from being saved", () => {
    const outcome = validateBayesianNetworkDraft(incompleteModel, validatedAt);
    expect(outcome.saveAllowed).toBe(true);
    expect(outcome.validation.valid).toBe(false);
    expect(outcome.validation.issues.map((issue) => issue.code)).toEqual(["BN_CPT_REQUIRED", "BN_CPT_REQUIRED"]);
    expect(DraftValidationOutcomeSchema.safeParse(outcome).success).toBe(true);
  });

  it("blocks analysis-ready quantification for the same incomplete BN", () => {
    const outcome = validateBayesianNetworkAnalysisReady(incompleteModel, validatedAt);
    expect(outcome.quantificationAllowed).toBe(false);
    expect(outcome.validation.valid).toBe(false);
    expect(outcome.validation.issues.map((issue) => issue.code)).toEqual(["BN_CPT_REQUIRED", "BN_CPT_REQUIRED"]);
    expect(AnalysisReadyValidationOutcomeSchema.safeParse(outcome).success).toBe(true);
  });

  it("allows analysis-ready quantification for a complete valid BN", () => {
    const outcome = validateBayesianNetworkAnalysisReady(model, validatedAt);
    expect(outcome.quantificationAllowed).toBe(true);
    expect(outcome.validation.valid).toBe(true);
    expect(outcome.validation.issues).toEqual([]);
  });

  it("applies evidence and HCL binding context to policy decisions", () => {
    const binding: HclEventBinding = {
      id: HCL_BINDING_ID,
      faultTreeBasicEvent: { modelId: FT_MODEL_ID, entityId: FT_BASIC_EVENT_ID },
      bayesianNetworkNode: { modelId: MODEL_ID, entityId: CAUSE_NODE_ID },
      trueStateIds: [CAUSE_FALSE_STATE_ID, CAUSE_TRUE_STATE_ID],
    };
    const outcome = validateBayesianNetworkAnalysisReady(model, validatedAt, {
      evidence: { observations: [{ nodeId: EFFECT_NODE_ID, stateId: MISSING_STATE_ID }] },
      hclBindings: [binding],
    });

    expect(outcome.quantificationAllowed).toBe(false);
    expect(outcome.validation.issues.map((issue) => issue.code)).toEqual([
      "BN_EVIDENCE_STATE_NOT_FOUND",
      "BN_HCL_TRUE_STATES_CANNOT_INCLUDE_ALL",
    ]);
  });
});
