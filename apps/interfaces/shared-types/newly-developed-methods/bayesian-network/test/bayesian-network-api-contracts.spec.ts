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
  modelId: MODEL_ID,
  code: "BN-PUMP",
  name: "Pump Bayesian network",
  description: "Pump causal model.",
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
  xdslMetadata: {
    rootAttributes: { version: "1.0", id: "BN-PUMP", numsamples: "1000" },
    extensionsXml: '<extensions><genie name="Pump"><submodel id="SM-PUMP"><node id="N-PUMP-STATE"/></submodel></genie></extensions>',
    nodeIdentifiers: [{ nodeId: NODE_ID, sourceId: "N-PUMP-STATE" }],
  },
} as const;

const query = {
  evidence: { observations: [] },
  queryNodeIds: [NODE_ID],
};

const queuedRun = {
  schemaVersion: "1.0.0",
  id: RUN_ID,
  owner: { workbookId: "esq-workbook", workbookRevision: 1, modelId: MODEL_ID },
  sourceWorkbooks: [{ workbookId: "esq-workbook", workbookRevision: 1 }],
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
    modelId: MODEL_ID,
    code: "BN-PUMP",
    name: "Pump Bayesian network",
    description: "Pump causal model.",
  };

  it("accepts a versioned Bayesian-network model and create request/result", () => {
    expect(BayesianNetworkModelSchema.safeParse(model).success).toBe(true);
    expect(BayesianNetworkCreateRequestSchema.safeParse(createRequest).success).toBe(true);
    expect(
      BayesianNetworkCreateResultSchema.safeParse({ schemaVersion: "1.0.0", workbookRevision: 2, model }).success,
    ).toBe(true);
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
    { ...createRequest, modelId: "BN-1" },
    { ...createRequest, name: "" },
    { ...createRequest, projectId: "project-mhtgr" },
    { ...createRequest, createdBy: "analyst-1" },
    { ...createRequest, id: MODEL_ID },
  ])("rejects malformed create request %#", (candidate) => {
    expect(BayesianNetworkCreateRequestSchema.safeParse(candidate).success).toBe(false);
  });

  it.each([
    { ...model, methodType: "BAYESIAN_NETWORK" },
    { ...model, schemaVersion: "2.0.0" },
    { ...model, revision: 0 },
    { ...model, id: MODEL_ID },
    { ...model, projectId: "project-mhtgr" },
    { ...model, nodes: [{ ...node, kind: "UTILITY_NODE" }] },
    {
      ...model,
      xdslMetadata: {
        ...model.xdslMetadata,
        nodeIdentifiers: [model.xdslMetadata.nodeIdentifiers[0], model.xdslMetadata.nodeIdentifiers[0]],
      },
    },
    { ...model, localState: true },
  ])("rejects malformed model %#", (candidate) => {
    expect(BayesianNetworkModelSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("Bayesian-network patch contract", () => {
  const patchRequest = {
    schemaVersion: "1.0.0",
    modelId: MODEL_ID,
    expectedWorkbookRevision: 1,
    changes: { name: "Renamed pump network" },
  };

  it("accepts a typed optimistic-concurrency patch and updated result", () => {
    expect(BayesianNetworkPatchRequestSchema.safeParse(patchRequest).success).toBe(true);
    expect(
      BayesianNetworkPatchResultSchema.safeParse({
        schemaVersion: "1.0.0",
        workbookRevision: 2,
        model: { ...model, name: patchRequest.changes.name },
      }).success,
    ).toBe(true);
  });

  it("accepts preserved XDSL metadata in a patch", () => {
    expect(BayesianNetworkPatchRequestSchema.safeParse({
      ...patchRequest,
      changes: { xdslMetadata: model.xdslMetadata },
    }).success).toBe(true);
  });

  it.each([
    { ...patchRequest, schemaVersion: "2.0.0" },
    { ...patchRequest, modelId: "BN-1" },
    { ...patchRequest, expectedWorkbookRevision: 0 },
    { ...patchRequest, expectedRevision: 1 },
    { ...patchRequest, updatedBy: "analyst-2" },
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
    workbookRevision: 1,
    mode: "ANALYSIS_READY",
  };
  const validation = {
    schemaVersion: "1.0.0",
    owner: { workbookId: "esq-workbook", workbookRevision: 1, modelId: MODEL_ID },
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
    { ...validateRequest, workbookRevision: 0 },
    { ...validateRequest, revision: 1 },
    { ...validateRequest, mode: "PUBLISH" },
    { ...validateRequest, requestedBy: "analyst-1" },
  ])("rejects malformed validate request %#", (candidate) => {
    expect(BayesianNetworkValidateRequestSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("Bayesian-network execution and completed-result contracts", () => {
  const executeRequest = {
    schemaVersion: "1.0.0",
    modelId: MODEL_ID,
    workbookRevision: 1,
    query,
  };
  const analysisResult = {
    schemaVersion: "1.0.0",
    runId: RUN_ID,
    owner: { workbookId: "esq-workbook", workbookRevision: 1, modelId: MODEL_ID },
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
    { ...executeRequest, workbookRevision: 0 },
    { ...executeRequest, revision: 1 },
    { ...executeRequest, requestedBy: "analyst-1" },
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
    { ...analysisResult, owner: { ...analysisResult.owner, workbookRevision: 0 } },
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
