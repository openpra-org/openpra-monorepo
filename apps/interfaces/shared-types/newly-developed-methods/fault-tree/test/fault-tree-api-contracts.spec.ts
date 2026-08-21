import {
  FaultTreeAnalysisResultSchema,
  FaultTreeCreateRequestSchema,
  FaultTreeCreateResultSchema,
  FaultTreeExecuteRequestSchema,
  FaultTreeExecuteResultSchema,
  FaultTreeModelSchema,
  FaultTreePatchRequestSchema,
  FaultTreePatchResultSchema,
  FaultTreeValidateRequestSchema,
  FaultTreeValidateResultSchema,
} from "..";

const MODEL_ID = "123e4567-e89b-42d3-a456-426614174200";
const GATE_ID = "123e4567-e89b-42d3-a456-426614174201";
const BASIC_EVENT_ID = "123e4567-e89b-42d3-a456-426614174202";
const INPUT_ID = "123e4567-e89b-42d3-a456-426614174203";
const LEAF_ID = "123e4567-e89b-42d3-a456-426614174204";
const RUN_ID = "123e4567-e89b-42d3-a456-426614174205";

const model = {
  schemaVersion: "1.0.0",
  id: MODEL_ID,
  projectId: "project-mhtgr",
  methodType: "FAULT_TREE",
  code: "FT-REACTOR-TRIP",
  name: "Reactor trip fault tree",
  description: "Reactor trip failure logic.",
  revision: 1,
  createdBy: "analyst-1",
  createdAt: "2026-08-20T12:00:00.000Z",
  updatedBy: "analyst-1",
  updatedAt: "2026-08-20T12:00:00.000Z",
  topGate: { gateId: GATE_ID },
  gates: [
    {
      id: GATE_ID,
      code: "G-TOP",
      name: "Reactor trip failure",
      description: "Top event.",
      kind: "GATE",
      gateType: "OR",
    },
  ],
  leafNodes: [{ id: LEAF_ID, kind: "BASIC_EVENT_REFERENCE", basicEventId: BASIC_EVENT_ID }],
  gateInputs: [{ id: INPUT_ID, gateId: GATE_ID, childId: LEAF_ID, order: 0 }],
  nodePositions: [
    { nodeId: GATE_ID, position: { x: 100, y: 40 } },
    { nodeId: LEAF_ID, position: { x: 100, y: 180 } },
  ],
  layout: {
    viewport: { x: 0, y: 0, zoom: 1 },
    mode: "MANUAL",
    direction: "TOP_TO_BOTTOM",
  },
} as const;

const queuedRun = {
  schemaVersion: "1.0.0",
  id: RUN_ID,
  modelId: MODEL_ID,
  modelRevision: 1,
  methodType: "FAULT_TREE",
  status: "QUEUED",
  requestedBy: "analyst-1",
  requestedAt: "2026-08-20T12:05:00.000Z",
  startedAt: null,
  completedAt: null,
  engine: null,
} as const;

describe("fault-tree model and create contracts", () => {
  const createRequest = {
    schemaVersion: "1.0.0",
    projectId: "project-mhtgr",
    code: "FT-REACTOR-TRIP",
    name: "Reactor trip fault tree",
    description: "Reactor trip failure logic.",
    createdBy: "analyst-1",
  };

  it("accepts a versioned fault-tree model and create request/result", () => {
    expect(FaultTreeModelSchema.safeParse(model).success).toBe(true);
    expect(FaultTreeCreateRequestSchema.safeParse(createRequest).success).toBe(true);
    expect(FaultTreeCreateResultSchema.safeParse({ schemaVersion: "1.0.0", model }).success).toBe(true);
  });

  it("allows a draft model without a selected top gate", () => {
    expect(FaultTreeModelSchema.safeParse({ ...model, topGate: null }).success).toBe(true);
  });

  it.each([
    { ...createRequest, schemaVersion: "2.0.0" },
    { ...createRequest, projectId: "" },
    { ...createRequest, code: "" },
    { ...createRequest, createdBy: "   " },
    { ...createRequest, id: MODEL_ID },
  ])("rejects malformed create request %#", (candidate) => {
    expect(FaultTreeCreateRequestSchema.safeParse(candidate).success).toBe(false);
  });

  it.each([
    { ...model, methodType: "BAYESIAN_NETWORK" },
    { ...model, schemaVersion: "2.0.0" },
    { ...model, revision: 0 },
    { ...model, topGate: { gateId: "G-TOP" } },
    { ...model, localState: true },
  ])("rejects malformed model %#", (candidate) => {
    expect(FaultTreeModelSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("fault-tree patch contract", () => {
  const patchRequest = {
    schemaVersion: "1.0.0",
    modelId: MODEL_ID,
    expectedRevision: 1,
    updatedBy: "analyst-2",
    changes: { name: "Renamed reactor trip tree" },
  };

  it("accepts a typed optimistic-concurrency patch and updated model result", () => {
    expect(FaultTreePatchRequestSchema.safeParse(patchRequest).success).toBe(true);
    expect(
      FaultTreePatchResultSchema.safeParse({
        schemaVersion: "1.0.0",
        model: { ...model, revision: 2, name: patchRequest.changes.name },
      }).success,
    ).toBe(true);
  });

  it("uses null to clear the top gate while preserving omission semantics", () => {
    expect(FaultTreePatchRequestSchema.safeParse({ ...patchRequest, changes: { topGate: null } }).success).toBe(true);
  });

  it.each([
    { ...patchRequest, schemaVersion: "2.0.0" },
    { ...patchRequest, modelId: "FT-1" },
    { ...patchRequest, expectedRevision: 0 },
    { ...patchRequest, updatedBy: "" },
    { ...patchRequest, changes: {} },
    { ...patchRequest, changes: { unknownField: true } },
  ])("rejects malformed patch %#", (candidate) => {
    expect(FaultTreePatchRequestSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("fault-tree validation contracts", () => {
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
    validatedAt: "2026-08-20T12:04:00.000Z",
  };

  it("accepts versioned draft/analysis-ready requests and validation results", () => {
    expect(FaultTreeValidateRequestSchema.safeParse(validateRequest).success).toBe(true);
    expect(FaultTreeValidateRequestSchema.safeParse({ ...validateRequest, mode: "DRAFT" }).success).toBe(true);
    expect(FaultTreeValidateResultSchema.safeParse({ schemaVersion: "1.0.0", validation }).success).toBe(true);
  });

  it.each([
    { ...validateRequest, schemaVersion: "2.0.0" },
    { ...validateRequest, revision: 0 },
    { ...validateRequest, mode: "PUBLISH" },
    { ...validateRequest, requestedBy: "" },
  ])("rejects malformed validate request %#", (candidate) => {
    expect(FaultTreeValidateRequestSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("fault-tree execution and analysis-result contracts", () => {
  const executeRequest = {
    schemaVersion: "1.0.0",
    modelId: MODEL_ID,
    revision: 1,
    requestedBy: "analyst-1",
  };
  const analysisResult = {
    schemaVersion: "1.0.0",
    runId: RUN_ID,
    modelId: MODEL_ID,
    modelRevision: 1,
    topGateId: GATE_ID,
    topEventProbability: 0.02,
    minimalCutSetCount: 1,
    leadingCutSets: [
      {
        rank: 1,
        order: 1,
        probability: 0.02,
        contribution: 1,
        events: [{ basicEventId: BASIC_EVENT_ID, complemented: false }],
      },
    ],
    validationIssues: [],
    completedAt: "2026-08-20T12:06:00.000Z",
  };

  it("accepts a versioned execute request and queued run result", () => {
    expect(FaultTreeExecuteRequestSchema.safeParse(executeRequest).success).toBe(true);
    expect(FaultTreeExecuteResultSchema.safeParse({ schemaVersion: "1.0.0", run: queuedRun }).success).toBe(true);
  });

  it("accepts exact probability and leading minimal-cut-set results", () => {
    expect(FaultTreeAnalysisResultSchema.safeParse(analysisResult).success).toBe(true);
  });

  it.each([
    { ...executeRequest, schemaVersion: "2.0.0" },
    { ...executeRequest, modelId: "FT-1" },
    { ...executeRequest, revision: 0 },
    { ...executeRequest, requestedBy: "" },
    { ...executeRequest, solverBackend: "SCRAM" },
  ])("rejects malformed execute request %#", (candidate) => {
    expect(FaultTreeExecuteRequestSchema.safeParse(candidate).success).toBe(false);
  });

  it("rejects execution metadata for a different method type", () => {
    expect(
      FaultTreeExecuteResultSchema.safeParse({
        schemaVersion: "1.0.0",
        run: { ...queuedRun, methodType: "BAYESIAN_NETWORK" },
      }).success,
    ).toBe(false);
  });

  it.each([
    { ...analysisResult, schemaVersion: "2.0.0" },
    { ...analysisResult, topEventProbability: 1.01 },
    { ...analysisResult, minimalCutSetCount: 0 },
    {
      ...analysisResult,
      leadingCutSets: [{ ...analysisResult.leadingCutSets[0], order: 2 }],
    },
    {
      ...analysisResult,
      leadingCutSets: [
        {
          ...analysisResult.leadingCutSets[0],
          events: [{ basicEventId: "BE-PUMP-A", complemented: false }],
        },
      ],
    },
  ])("rejects malformed analysis result %#", (candidate) => {
    expect(FaultTreeAnalysisResultSchema.safeParse(candidate).success).toBe(false);
  });
});
