import {
  FaultTreeAnalysisResultSchema,
  FaultTreeBasicEventCatalogueCreateRequestSchema,
  FaultTreeBasicEventCataloguePatchRequestSchema,
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

const basicEvent = {
  id: BASIC_EVENT_ID,
  code: "BE-PUMP-A",
  name: "Pump A fails",
  description: "Pump A fails on demand.",
  probability: { value: 0.1 },
} as const;

const model = {
  modelId: MODEL_ID,
  code: "FT-REACTOR-TRIP",
  name: "Reactor trip fault tree",
  description: "Reactor trip failure logic.",
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
  owner: { workbookId: "sy-workbook", workbookRevision: 1, modelId: MODEL_ID },
  sourceWorkbooks: [{ workbookId: "sy-workbook", workbookRevision: 1 }],
  methodType: "FAULT_TREE",
  status: "QUEUED",
  requestedBy: "analyst-1",
  requestedAt: "2026-08-20T12:05:00.000Z",
  startedAt: null,
  completedAt: null,
  engine: null,
} as const;

describe("fault-tree basic-event catalogue API contracts", () => {
  const createRequest = {
    schemaVersion: "1.0.0",
    basicEvents: [basicEvent],
  };
  const patchRequest = {
    schemaVersion: "1.0.0",
    expectedWorkbookRevision: 1,
    basicEvents: [{ ...basicEvent, probability: { value: 0.2 } }],
  };

  it("accepts versioned create and revisioned patch requests", () => {
    expect(FaultTreeBasicEventCatalogueCreateRequestSchema.safeParse(createRequest).success).toBe(true);
    expect(FaultTreeBasicEventCataloguePatchRequestSchema.safeParse(patchRequest).success).toBe(true);
  });

  it.each([
    { ...createRequest, projectId: "project-mhtgr" },
    { ...createRequest, createdBy: "analyst-1" },
    { ...createRequest, basicEvents: [{ ...basicEvent, probability: { value: 1.01 } }] },
    { ...patchRequest, expectedWorkbookRevision: 0 },
    { ...patchRequest, expectedRevision: 1 },
    { ...patchRequest, updatedBy: "analyst-1" },
  ])("rejects malformed catalogue request %#", (candidate) => {
    const schema = "expectedWorkbookRevision" in candidate
      ? FaultTreeBasicEventCataloguePatchRequestSchema
      : FaultTreeBasicEventCatalogueCreateRequestSchema;
    expect(schema.safeParse(candidate).success).toBe(false);
  });
});

describe("fault-tree model and create contracts", () => {
  const createRequest = {
    schemaVersion: "1.0.0",
    modelId: MODEL_ID,
    code: "FT-REACTOR-TRIP",
    name: "Reactor trip fault tree",
    description: "Reactor trip failure logic.",
  };

  it("accepts a versioned fault-tree model and create request/result", () => {
    expect(FaultTreeModelSchema.safeParse(model).success).toBe(true);
    expect(FaultTreeCreateRequestSchema.safeParse(createRequest).success).toBe(true);
    expect(
      FaultTreeCreateResultSchema.safeParse({ schemaVersion: "1.0.0", workbookRevision: 2, model }).success,
    ).toBe(true);
  });

  it("allows a draft model without a selected top gate", () => {
    expect(FaultTreeModelSchema.safeParse({ ...model, topGate: null }).success).toBe(true);
  });

  it.each([
    { ...createRequest, schemaVersion: "2.0.0" },
    { ...createRequest, modelId: "FT-1" },
    { ...createRequest, code: "" },
    { ...createRequest, projectId: "project-mhtgr" },
    { ...createRequest, createdBy: "analyst-1" },
    { ...createRequest, id: MODEL_ID },
  ])("rejects malformed create request %#", (candidate) => {
    expect(FaultTreeCreateRequestSchema.safeParse(candidate).success).toBe(false);
  });

  it.each([
    { ...model, projectId: "project-mhtgr" },
    { ...model, schemaVersion: "2.0.0" },
    { ...model, revision: 0 },
    { ...model, id: MODEL_ID },
    { ...model, methodType: "FAULT_TREE" },
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
    expectedWorkbookRevision: 1,
    changes: { name: "Renamed reactor trip tree" },
  };

  it("accepts a typed optimistic-concurrency patch and updated model result", () => {
    expect(FaultTreePatchRequestSchema.safeParse(patchRequest).success).toBe(true);
    expect(
      FaultTreePatchResultSchema.safeParse({
        schemaVersion: "1.0.0",
        workbookRevision: 2,
        model: { ...model, name: patchRequest.changes.name },
      }).success,
    ).toBe(true);
  });

  it("uses null to clear the top gate while preserving omission semantics", () => {
    expect(FaultTreePatchRequestSchema.safeParse({ ...patchRequest, changes: { topGate: null } }).success).toBe(true);
  });

  it.each([
    { ...patchRequest, schemaVersion: "2.0.0" },
    { ...patchRequest, modelId: "FT-1" },
    { ...patchRequest, expectedWorkbookRevision: 0 },
    { ...patchRequest, expectedRevision: 1 },
    { ...patchRequest, updatedBy: "analyst-2" },
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
    workbookRevision: 1,
    mode: "ANALYSIS_READY",
  };
  const validation = {
    schemaVersion: "1.0.0",
    owner: { workbookId: "sy-workbook", workbookRevision: 1, modelId: MODEL_ID },
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
    { ...validateRequest, workbookRevision: 0 },
    { ...validateRequest, revision: 1 },
    { ...validateRequest, mode: "PUBLISH" },
    { ...validateRequest, requestedBy: "analyst-1" },
  ])("rejects malformed validate request %#", (candidate) => {
    expect(FaultTreeValidateRequestSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("fault-tree execution and analysis-result contracts", () => {
  const executeRequest = {
    schemaVersion: "1.0.0",
    modelId: MODEL_ID,
    workbookRevision: 1,
  };
  const analysisResult = {
    schemaVersion: "1.0.0",
    runId: RUN_ID,
    owner: { workbookId: "sy-workbook", workbookRevision: 1, modelId: MODEL_ID },
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
    { ...executeRequest, workbookRevision: 0 },
    { ...executeRequest, revision: 1 },
    { ...executeRequest, requestedBy: "analyst-1" },
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
