import {
  BayesianNetworkAnalysisResultSchema,
  BayesianNetworkCreateRequestSchema,
  BayesianNetworkCreateResultSchema,
  BayesianNetworkExecuteRequestSchema,
  BayesianNetworkExecuteResultSchema,
  BayesianNetworkModelSchema,
  BayesianNetworkPatchRequestSchema,
  BayesianNetworkPatchResultSchema,
  BayesianNetworkValidateRequestSchema,
  BayesianNetworkValidateResultSchema,
} from "..";

const MODEL_ID = "123e4567-e89b-42d3-a456-426614174400";
const NODE_ID = "123e4567-e89b-42d3-a456-426614174401";
const FALSE_STATE_ID = "123e4567-e89b-42d3-a456-426614174402";
const TRUE_STATE_ID = "123e4567-e89b-42d3-a456-426614174403";
const ROW_ID = "123e4567-e89b-42d3-a456-426614174404";
const RUN_ID = "123e4567-e89b-42d3-a456-426614174405";

const node = {
  id: NODE_ID,
  code: "N-PUMP-STATE",
  name: "Pump state",
  description: "Discrete pump availability.",
  kind: "CHANCE_NODE",
  states: [
    { id: FALSE_STATE_ID, code: "AVAILABLE", name: "Available" },
    { id: TRUE_STATE_ID, code: "FAILED", name: "Failed" },
  ],
} as const;

const model = {
  schemaVersion: "1.0.0",
  id: MODEL_ID,
  projectId: "project-mhtgr",
  methodType: "BAYESIAN_NETWORK",
  code: "BN-PUMP",
  name: "Pump Bayesian network",
  description: "Pump causal model.",
  revision: 1,
  createdBy: "analyst-1",
  createdAt: "2026-08-20T13:00:00.000Z",
  updatedBy: "analyst-1",
  updatedAt: "2026-08-20T13:00:00.000Z",
  nodes: [node],
  edges: [],
  conditionalProbabilityTables: [
    {
      nodeId: NODE_ID,
      parents: [],
      rows: [
        {
          id: ROW_ID,
          parentStates: [],
          values: [
            { stateId: FALSE_STATE_ID, probability: 0.98 },
            { stateId: TRUE_STATE_ID, probability: 0.02 },
          ],
        },
      ],
    },
  ],
  nodePositions: [{ nodeId: NODE_ID, position: { x: 100, y: 100 } }],
  layout: {
    viewport: { x: 0, y: 0, zoom: 1 },
    mode: "MANUAL",
    direction: "LEFT_TO_RIGHT",
  },
} as const;

const query = {
  evidence: { observations: [] },
  queryNodeIds: [NODE_ID],
};

const queuedRun = {
  schemaVersion: "1.0.0",
  id: RUN_ID,
  modelId: MODEL_ID,
  modelRevision: 1,
  methodType: "BAYESIAN_NETWORK",
  status: "QUEUED",
  requestedBy: "analyst-1",
  requestedAt: "2026-08-20T13:05:00.000Z",
  startedAt: null,
  completedAt: null,
  engine: null,
} as const;

describe("Bayesian-network model and create contracts", () => {
  const createRequest = {
    schemaVersion: "1.0.0",
    projectId: "project-mhtgr",
    code: "BN-PUMP",
    name: "Pump Bayesian network",
    description: "Pump causal model.",
    createdBy: "analyst-1",
  };

  it("accepts a versioned Bayesian-network model and create request/result", () => {
    expect(BayesianNetworkModelSchema.safeParse(model).success).toBe(true);
    expect(BayesianNetworkCreateRequestSchema.safeParse(createRequest).success).toBe(true);
    expect(BayesianNetworkCreateResultSchema.safeParse({ schemaVersion: "1.0.0", model }).success).toBe(true);
  });

  it("allows an empty draft network", () => {
    expect(
      BayesianNetworkModelSchema.safeParse({
        ...model,
        nodes: [],
        conditionalProbabilityTables: [],
        nodePositions: [],
      }).success,
    ).toBe(true);
  });

  it.each([
    { ...createRequest, schemaVersion: "2.0.0" },
    { ...createRequest, projectId: "" },
    { ...createRequest, name: "" },
    { ...createRequest, createdBy: "   " },
    { ...createRequest, id: MODEL_ID },
  ])("rejects malformed create request %#", (candidate) => {
    expect(BayesianNetworkCreateRequestSchema.safeParse(candidate).success).toBe(false);
  });

  it.each([
    { ...model, methodType: "FAULT_TREE" },
    { ...model, schemaVersion: "2.0.0" },
    { ...model, revision: 0 },
    { ...model, nodes: [{ ...node, kind: "UTILITY_NODE" }] },
    { ...model, localState: true },
  ])("rejects malformed model %#", (candidate) => {
    expect(BayesianNetworkModelSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("Bayesian-network patch contract", () => {
  const patchRequest = {
    schemaVersion: "1.0.0",
    modelId: MODEL_ID,
    expectedRevision: 1,
    updatedBy: "analyst-2",
    changes: { name: "Renamed pump network" },
  };

  it("accepts a typed optimistic-concurrency patch and updated result", () => {
    expect(BayesianNetworkPatchRequestSchema.safeParse(patchRequest).success).toBe(true);
    expect(
      BayesianNetworkPatchResultSchema.safeParse({
        schemaVersion: "1.0.0",
        model: { ...model, revision: 2, name: patchRequest.changes.name },
      }).success,
    ).toBe(true);
  });

  it.each([
    { ...patchRequest, schemaVersion: "2.0.0" },
    { ...patchRequest, modelId: "BN-1" },
    { ...patchRequest, expectedRevision: 0 },
    { ...patchRequest, updatedBy: "" },
    { ...patchRequest, changes: {} },
    { ...patchRequest, changes: { unknownField: true } },
  ])("rejects malformed patch %#", (candidate) => {
    expect(BayesianNetworkPatchRequestSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("Bayesian-network validation contracts", () => {
  const validateRequest = {
    schemaVersion: "1.0.0",
    modelId: MODEL_ID,
    revision: 1,
    mode: "ANALYSIS_READY",
    requestedBy: "analyst-1",
  };
  const validation = {
    schemaVersion: "1.0.0",
    modelId: MODEL_ID,
    revision: 1,
    mode: "ANALYSIS_READY",
    valid: true,
    issues: [],
    validatedAt: "2026-08-20T13:04:00.000Z",
  };

  it("accepts a versioned validation request and result", () => {
    expect(BayesianNetworkValidateRequestSchema.safeParse(validateRequest).success).toBe(true);
    expect(BayesianNetworkValidateResultSchema.safeParse({ schemaVersion: "1.0.0", validation }).success).toBe(true);
  });

  it.each([
    { ...validateRequest, schemaVersion: "2.0.0" },
    { ...validateRequest, revision: 0 },
    { ...validateRequest, mode: "PUBLISH" },
    { ...validateRequest, requestedBy: "" },
  ])("rejects malformed validate request %#", (candidate) => {
    expect(BayesianNetworkValidateRequestSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("Bayesian-network execution and completed-result contracts", () => {
  const executeRequest = {
    schemaVersion: "1.0.0",
    modelId: MODEL_ID,
    revision: 1,
    requestedBy: "analyst-1",
    query,
  };
  const analysisResult = {
    schemaVersion: "1.0.0",
    runId: RUN_ID,
    modelId: MODEL_ID,
    modelRevision: 1,
    evidence: query.evidence,
    marginals: [
      {
        nodeId: NODE_ID,
        values: [
          { stateId: FALSE_STATE_ID, probability: 0.98 },
          { stateId: TRUE_STATE_ID, probability: 0.02 },
        ],
      },
    ],
    validationIssues: [],
    completedAt: "2026-08-20T13:06:00.000Z",
  };

  it("accepts a versioned execute request and queued run result", () => {
    expect(BayesianNetworkExecuteRequestSchema.safeParse(executeRequest).success).toBe(true);
    expect(BayesianNetworkExecuteResultSchema.safeParse({ schemaVersion: "1.0.0", run: queuedRun }).success).toBe(
      true,
    );
  });

  it("accepts completed normalized marginals with the applied evidence", () => {
    expect(BayesianNetworkAnalysisResultSchema.safeParse(analysisResult).success).toBe(true);
  });

  it.each([
    { ...executeRequest, schemaVersion: "2.0.0" },
    { ...executeRequest, modelId: "BN-1" },
    { ...executeRequest, revision: 0 },
    { ...executeRequest, requestedBy: "" },
    { ...executeRequest, query: { ...query, queryNodeIds: [] } },
    { ...executeRequest, backend: "TENSORBAYES" },
  ])("rejects malformed execute request %#", (candidate) => {
    expect(BayesianNetworkExecuteRequestSchema.safeParse(candidate).success).toBe(false);
  });

  it("rejects execution metadata for a different method type", () => {
    expect(
      BayesianNetworkExecuteResultSchema.safeParse({
        schemaVersion: "1.0.0",
        run: { ...queuedRun, methodType: "FAULT_TREE" },
      }).success,
    ).toBe(false);
  });

  it.each([
    { ...analysisResult, schemaVersion: "2.0.0" },
    { ...analysisResult, modelRevision: 0 },
    { ...analysisResult, completedAt: "today" },
    {
      ...analysisResult,
      marginals: [
        {
          ...analysisResult.marginals[0],
          values: [
            analysisResult.marginals[0].values[0],
            { ...analysisResult.marginals[0].values[1], probability: 0.5 },
          ],
        },
      ],
    },
    { ...analysisResult, posteriorApproximation: "MARGINAL_ONLY" },
  ])("rejects malformed analysis result %#", (candidate) => {
    expect(BayesianNetworkAnalysisResultSchema.safeParse(candidate).success).toBe(false);
  });
});
