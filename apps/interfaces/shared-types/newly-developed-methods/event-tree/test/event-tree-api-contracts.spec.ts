import {
  EventTreeAnalysisResultSchema,
  EventTreeCreateRequestSchema,
  EventTreeCreateResultSchema,
  EventTreeExecuteRequestSchema,
  EventTreeExecuteResultSchema,
  EventTreeModelSchema,
  EventTreePatchRequestSchema,
  EventTreePatchResultSchema,
  EventTreeValidateRequestSchema,
  EventTreeValidateResultSchema,
} from "..";

const MODEL_ID = "123e4567-e89b-42d3-a456-426614174600";
const INITIATING_MODEL_ID = "123e4567-e89b-42d3-a456-426614174601";
const INITIATING_EVENT_ID = "123e4567-e89b-42d3-a456-426614174602";
const FUNCTIONAL_EVENT_ID = "123e4567-e89b-42d3-a456-426614174603";
const FAULT_TREE_MODEL_ID = "123e4567-e89b-42d3-a456-426614174604";
const TOP_GATE_ID = "123e4567-e89b-42d3-a456-426614174605";
const END_STATE_ID = "123e4567-e89b-42d3-a456-426614174606";
const SEQUENCE_ID = "123e4567-e89b-42d3-a456-426614174607";
const RUN_ID = "123e4567-e89b-42d3-a456-426614174608";

const functionalEvent = {
  id: FUNCTIONAL_EVENT_ID,
  code: "FE-RT",
  name: "Reactor trip",
  description: "Whether reactor trip succeeds.",
  order: 0,
} as const;

const sequence = {
  id: SEQUENCE_ID,
  code: "EHP-1",
  name: "Trip succeeds",
  description: "Successful trip sequence.",
  path: [{ functionalEventId: FUNCTIONAL_EVENT_ID, outcome: "SUCCESS" }],
  result: { kind: "END_STATE", endStateId: END_STATE_ID },
} as const;

const model = {
  schemaVersion: "1.0.0",
  id: MODEL_ID,
  projectId: "project-mhtgr",
  methodType: "EVENT_TREE",
  code: "ET-EHP",
  name: "Event tree EHP",
  description: "Event-tree model.",
  revision: 1,
  createdBy: "analyst-1",
  createdAt: "2026-08-20T14:00:00.000Z",
  updatedBy: "analyst-1",
  updatedAt: "2026-08-20T14:00:00.000Z",
  initiatingEvent: {
    target: { modelId: INITIATING_MODEL_ID, entityId: INITIATING_EVENT_ID },
  },
  initiatingEventFrequency: { value: 0.001 },
  functionalEvents: [functionalEvent],
  functionalEventFaultTreeLinks: [
    {
      functionalEventId: FUNCTIONAL_EVENT_ID,
      faultTreeTopGate: { modelId: FAULT_TREE_MODEL_ID, entityId: TOP_GATE_ID },
    },
  ],
  endStates: [
    {
      id: END_STATE_ID,
      code: "OK",
      name: "Safe shutdown",
      description: "Safe shutdown end state.",
    },
  ],
  sequences: [sequence],
  hclConfiguration: null,
  canvas: {
    metadata: {
      viewport: { x: 0, y: 0, zoom: 1 },
      mode: "MANUAL",
      direction: "LEFT_TO_RIGHT",
    },
    nodePositions: [{ nodeId: SEQUENCE_ID, position: { x: 200, y: 100 } }],
  },
} as const;

const queuedRun = {
  schemaVersion: "1.0.0",
  id: RUN_ID,
  modelId: MODEL_ID,
  modelRevision: 1,
  methodType: "EVENT_TREE",
  status: "QUEUED",
  requestedBy: "analyst-1",
  requestedAt: "2026-08-20T14:05:00.000Z",
  startedAt: null,
  completedAt: null,
  engine: null,
} as const;

describe("Event-tree model and create contracts", () => {
  const createRequest = {
    schemaVersion: "1.0.0",
    projectId: "project-mhtgr",
    code: "ET-EHP",
    name: "Event tree EHP",
    description: "Event-tree model.",
    createdBy: "analyst-1",
  };

  it("accepts a versioned Event Tree model and create request/result", () => {
    expect(EventTreeModelSchema.safeParse(model).success).toBe(true);
    expect(EventTreeCreateRequestSchema.safeParse(createRequest).success).toBe(true);
    expect(EventTreeCreateResultSchema.safeParse({ schemaVersion: "1.0.0", model }).success).toBe(true);
  });

  it("allows a draft without an initiating event or frequency", () => {
    expect(
      EventTreeModelSchema.safeParse({
        ...model,
        initiatingEvent: null,
        initiatingEventFrequency: null,
      }).success,
    ).toBe(true);
  });

  it.each([
    { ...createRequest, schemaVersion: "2.0.0" },
    { ...createRequest, projectId: "" },
    { ...createRequest, code: "" },
    { ...createRequest, createdBy: "   " },
    { ...createRequest, id: MODEL_ID },
  ])("rejects malformed create request %#", (candidate) => {
    expect(EventTreeCreateRequestSchema.safeParse(candidate).success).toBe(false);
  });

  it.each([
    { ...model, methodType: "FAULT_TREE" },
    { ...model, schemaVersion: "2.0.0" },
    { ...model, revision: 0 },
    { ...model, initiatingEventFrequency: { value: -0.001 } },
    { ...model, localState: true },
  ])("rejects malformed model %#", (candidate) => {
    expect(EventTreeModelSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("Event-tree patch contract", () => {
  const patchRequest = {
    schemaVersion: "1.0.0",
    modelId: MODEL_ID,
    expectedRevision: 1,
    updatedBy: "analyst-2",
    changes: { name: "Renamed event tree" },
  };

  it("accepts a typed optimistic-concurrency patch and updated result", () => {
    expect(EventTreePatchRequestSchema.safeParse(patchRequest).success).toBe(true);
    expect(
      EventTreePatchResultSchema.safeParse({
        schemaVersion: "1.0.0",
        model: { ...model, revision: 2, name: patchRequest.changes.name },
      }).success,
    ).toBe(true);
  });

  it("uses null to clear an HCL configuration", () => {
    expect(EventTreePatchRequestSchema.safeParse({ ...patchRequest, changes: { hclConfiguration: null } }).success).toBe(
      true,
    );
  });

  it.each([
    { ...patchRequest, schemaVersion: "2.0.0" },
    { ...patchRequest, modelId: "ET-1" },
    { ...patchRequest, expectedRevision: 0 },
    { ...patchRequest, updatedBy: "" },
    { ...patchRequest, changes: {} },
    { ...patchRequest, changes: { unknownField: true } },
  ])("rejects malformed patch %#", (candidate) => {
    expect(EventTreePatchRequestSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("Event-tree validation contracts", () => {
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
    validatedAt: "2026-08-20T14:04:00.000Z",
  };

  it("accepts a versioned validation request and result", () => {
    expect(EventTreeValidateRequestSchema.safeParse(validateRequest).success).toBe(true);
    expect(EventTreeValidateResultSchema.safeParse({ schemaVersion: "1.0.0", validation }).success).toBe(true);
  });

  it.each([
    { ...validateRequest, schemaVersion: "2.0.0" },
    { ...validateRequest, revision: 0 },
    { ...validateRequest, mode: "PUBLISH" },
    { ...validateRequest, requestedBy: "" },
  ])("rejects malformed validate request %#", (candidate) => {
    expect(EventTreeValidateRequestSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("Event-tree execution and analysis-result contracts", () => {
  const executeRequest = {
    schemaVersion: "1.0.0",
    modelId: MODEL_ID,
    revision: 1,
    mode: "INDEPENDENT",
    requestedBy: "analyst-1",
  };
  const analysisResult = {
    schemaVersion: "1.0.0",
    runId: RUN_ID,
    modelId: MODEL_ID,
    modelRevision: 1,
    mode: "INDEPENDENT",
    sequences: [
      {
        sequenceId: SEQUENCE_ID,
        path: sequence.path,
        result: sequence.result,
        conditionalProbability: 0.98,
        annualFrequency: 0.00098,
      },
    ],
    endStateAggregates: [{ endStateId: END_STATE_ID, annualFrequency: 0.00098 }],
    validationIssues: [],
    completedAt: "2026-08-20T14:06:00.000Z",
  };

  it.each(["INDEPENDENT", "HYBRID_CAUSAL_LOGIC"])("accepts %s execution mode", (mode) => {
    expect(EventTreeExecuteRequestSchema.safeParse({ ...executeRequest, mode }).success).toBe(true);
  });

  it("accepts a queued Event Tree run and completed sequence/end-state results", () => {
    expect(EventTreeExecuteResultSchema.safeParse({ schemaVersion: "1.0.0", run: queuedRun }).success).toBe(true);
    expect(EventTreeAnalysisResultSchema.safeParse(analysisResult).success).toBe(true);
  });

  it.each([
    { ...executeRequest, schemaVersion: "2.0.0" },
    { ...executeRequest, modelId: "ET-1" },
    { ...executeRequest, revision: 0 },
    { ...executeRequest, mode: "MARGINAL_ONLY" },
    { ...executeRequest, requestedBy: "" },
    { ...executeRequest, solverBackend: "PRAXIS" },
  ])("rejects malformed execute request %#", (candidate) => {
    expect(EventTreeExecuteRequestSchema.safeParse(candidate).success).toBe(false);
  });

  it("rejects execution metadata for a different method type", () => {
    expect(
      EventTreeExecuteResultSchema.safeParse({
        schemaVersion: "1.0.0",
        run: { ...queuedRun, methodType: "FAULT_TREE" },
      }).success,
    ).toBe(false);
  });

  it.each([
    { ...analysisResult, schemaVersion: "2.0.0" },
    { ...analysisResult, modelRevision: 0 },
    { ...analysisResult, mode: "MARGINAL_ONLY" },
    {
      ...analysisResult,
      sequences: [{ ...analysisResult.sequences[0], conditionalProbability: 1.01 }],
    },
    {
      ...analysisResult,
      sequences: [{ ...analysisResult.sequences[0], annualFrequency: -0.001 }],
    },
    {
      ...analysisResult,
      endStateAggregates: [{ endStateId: END_STATE_ID, annualFrequency: Number.NaN }],
    },
    { ...analysisResult, completedAt: "today" },
  ])("rejects malformed analysis result %#", (candidate) => {
    expect(EventTreeAnalysisResultSchema.safeParse(candidate).success).toBe(false);
  });
});
