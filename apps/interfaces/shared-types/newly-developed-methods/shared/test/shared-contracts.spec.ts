import {
  AnalysisRunMetadataSchema,
  AnalysisReadyValidationOutcomeSchema,
  CanvasLayoutMetadataSchema,
  createDraftValidationOutcome,
  createAnalysisReadyValidationOutcome,
  DraftValidationOutcomeSchema,
  MethodEntityReferenceSchema,
  MethodModelIdentitySchema,
  MethodModelMetadataSchema,
  MethodModelListResponseSchema,
  MethodModelReferenceSchema,
  MethodTypeSchema,
  ValidationIssueSchema,
  ValidationResultSchema,
} from "..";

const MODEL_ID = "123e4567-e89b-42d3-a456-426614174000";
const ENTITY_ID = "123e4567-e89b-42d3-a456-426614174001";
const RUN_ID = "123e4567-e89b-42d3-a456-426614174002";

const identity = {
  id: MODEL_ID,
  projectId: "project-1",
  methodType: "FAULT_TREE" as const,
  code: "FT-001",
  name: "Reactor trip failure",
  description: "Fails to trip when demanded.",
};

const metadata = {
  ...identity,
  schemaVersion: "1.0.0" as const,
  revision: 1,
  createdBy: "analyst-1",
  createdAt: "2026-08-20T19:30:00.000Z",
  updatedBy: "analyst-1",
  updatedAt: "2026-08-20T19:30:00.000Z",
};

describe("shared method-model contracts", () => {
  it.each(MethodTypeSchema.options)("accepts the %s method type", (methodType) => {
    expect(MethodModelIdentitySchema.safeParse({ ...identity, methodType }).success).toBe(true);
  });

  it.each([
    { ...identity, id: "FT-001" },
    { ...identity, projectId: "   " },
    { ...identity, methodType: "CONTINUOUS_BN" },
    { ...identity, code: "   " },
    { ...identity, name: "   " },
  ])("rejects invalid model identity %#", (candidate) => {
    expect(MethodModelIdentitySchema.safeParse(candidate).success).toBe(false);
  });

  it("requires the current schema version, a positive revision, owners, and ISO timestamps", () => {
    expect(MethodModelMetadataSchema.safeParse(metadata).success).toBe(true);
    expect(MethodModelMetadataSchema.safeParse({ ...metadata, schemaVersion: "2.0.0" }).success).toBe(false);
    expect(MethodModelMetadataSchema.safeParse({ ...metadata, revision: 0 }).success).toBe(false);
    expect(MethodModelMetadataSchema.safeParse({ ...metadata, updatedBy: " " }).success).toBe(false);
    expect(MethodModelMetadataSchema.safeParse({ ...metadata, updatedAt: "today" }).success).toBe(false);
  });

  it("defines the metadata-only response used to list project models by method type", () => {
    expect(MethodModelListResponseSchema.safeParse({ models: [metadata] }).success).toBe(true);
    expect(MethodModelListResponseSchema.safeParse({ models: [{ ...metadata, methodType: "DYNAMIC_EVENT_TREE" }] }).success).toBe(
      false,
    );
    expect(MethodModelListResponseSchema.safeParse({ models: [metadata], total: 1 }).success).toBe(false);
  });

  it("validates reusable canvas metadata", () => {
    const layout = {
      viewport: { x: 100, y: -20, zoom: 1.25 },
      mode: "MANUAL",
      direction: "TOP_TO_BOTTOM",
    };
    expect(CanvasLayoutMetadataSchema.safeParse(layout).success).toBe(true);
    expect(CanvasLayoutMetadataSchema.safeParse({ ...layout, viewport: { ...layout.viewport, zoom: 0 } }).success).toBe(false);
    expect(CanvasLayoutMetadataSchema.safeParse({ ...layout, direction: "DIAGONAL" }).success).toBe(false);
  });

  it("allows only UUID keys in strict stable references", () => {
    expect(MethodModelReferenceSchema.safeParse({ modelId: MODEL_ID }).success).toBe(true);
    expect(MethodEntityReferenceSchema.safeParse({ modelId: MODEL_ID, entityId: ENTITY_ID }).success).toBe(true);
    expect(MethodModelReferenceSchema.safeParse({ modelId: "FT-001" }).success).toBe(false);
    expect(MethodModelReferenceSchema.safeParse({ modelId: MODEL_ID, name: "Renamed FT" }).success).toBe(false);
    expect(MethodEntityReferenceSchema.safeParse({ modelId: MODEL_ID, entityId: "BE-PUMP-A" }).success).toBe(false);
    expect(MethodEntityReferenceSchema.safeParse({ modelId: MODEL_ID, entityId: ENTITY_ID, code: "BE-1" }).success).toBe(false);
  });
});

describe("shared validation contracts", () => {
  const warning = {
    code: "FT_NODE_LABEL_MISSING",
    severity: "WARNING" as const,
    message: "Add a label",
    entityId: ENTITY_ID,
    fieldPath: ["nodes", 0, "label"],
  };
  const result = {
    schemaVersion: "1.0.0",
    modelId: MODEL_ID,
    revision: 2,
    mode: "DRAFT",
    valid: true,
    issues: [warning],
    validatedAt: "2026-08-20T19:45:00.000Z",
  };

  it("accepts warnings without invalidating the model", () => {
    expect(ValidationResultSchema.safeParse(result).success).toBe(true);
  });

  it("requires valid=false when an error issue exists", () => {
    const error = { ...warning, severity: "ERROR" };
    expect(ValidationResultSchema.safeParse({ ...result, issues: [error] }).success).toBe(false);
    expect(ValidationResultSchema.safeParse({ ...result, valid: false, issues: [error] }).success).toBe(true);
  });

  it.each([
    { ...warning, code: "bad-code" },
    { ...warning, entityId: "BE-PUMP-A" },
    { ...warning, fieldPath: ["nodes", -1] },
    { ...warning, message: "   " },
  ])("rejects malformed validation issue %#", (issue) => {
    expect(ValidationResultSchema.safeParse({ ...result, issues: [issue] }).success).toBe(false);
  });

  it("requires every issue to identify an entity and an addressable field path", () => {
    expect(ValidationIssueSchema.safeParse(warning).success).toBe(true);
    expect(ValidationIssueSchema.safeParse({ ...warning, fieldPath: [] }).success).toBe(true);
    expect(
      ValidationIssueSchema.safeParse({
        code: warning.code,
        severity: warning.severity,
        message: warning.message,
        fieldPath: warning.fieldPath,
      }).success,
    ).toBe(false);
    expect(
      ValidationIssueSchema.safeParse({
        code: warning.code,
        severity: warning.severity,
        message: warning.message,
        entityId: warning.entityId,
      }).success,
    ).toBe(false);
  });

  it.each([
    { ...warning, nodeId: ENTITY_ID },
    { ...warning, field: "label" },
    { ...warning, fieldPath: ["nodes", 0, ""] },
    { ...warning, fieldPath: ["nodes", 1.5, "label"] },
  ])("rejects ambiguous or malformed issue targeting %#", (issue) => {
    expect(ValidationIssueSchema.safeParse(issue).success).toBe(false);
  });

  it("reports draft errors without preventing the model from being saved", () => {
    const error = { ...warning, severity: "ERROR" as const };
    const outcome = createDraftValidationOutcome({
      modelId: MODEL_ID,
      revision: 2,
      issues: [error],
      validatedAt: "2026-08-20T19:45:00.000Z",
    });

    expect(outcome.validation).toMatchObject({
      mode: "DRAFT",
      valid: false,
      issues: [error],
    });
    expect(outcome.saveAllowed).toBe(true);
    expect(DraftValidationOutcomeSchema.safeParse(outcome).success).toBe(true);
  });

  it("keeps warning-only and issue-free drafts valid and saveable", () => {
    for (const issues of [[warning], []]) {
      const outcome = createDraftValidationOutcome({
        modelId: MODEL_ID,
        revision: 2,
        issues,
        validatedAt: "2026-08-20T19:45:00.000Z",
      });

      expect(outcome.validation.valid).toBe(true);
      expect(outcome.saveAllowed).toBe(true);
    }
  });

  it.each([
    { validation: result, saveAllowed: false },
    { validation: { ...result, mode: "ANALYSIS_READY" }, saveAllowed: true },
    { validation: result, saveAllowed: true, blockReason: "Incomplete model" },
  ])("rejects a draft outcome that could block or misrepresent saving %#", (outcome) => {
    expect(DraftValidationOutcomeSchema.safeParse(outcome).success).toBe(false);
  });

  it("blocks quantification when strict analysis-ready validation reports an error", () => {
    const error = { ...warning, severity: "ERROR" as const };
    const outcome = createAnalysisReadyValidationOutcome({
      modelId: MODEL_ID,
      revision: 2,
      issues: [error],
      validatedAt: "2026-08-20T19:46:00.000Z",
    });

    expect(outcome.validation).toMatchObject({
      mode: "ANALYSIS_READY",
      valid: false,
      issues: [error],
    });
    expect(outcome.quantificationAllowed).toBe(false);
    expect(AnalysisReadyValidationOutcomeSchema.safeParse(outcome).success).toBe(true);
  });

  it("allows quantification after warning-only or clean analysis-ready validation", () => {
    for (const issues of [[warning], []]) {
      const outcome = createAnalysisReadyValidationOutcome({
        modelId: MODEL_ID,
        revision: 2,
        issues,
        validatedAt: "2026-08-20T19:46:00.000Z",
      });

      expect(outcome.validation.valid).toBe(true);
      expect(outcome.quantificationAllowed).toBe(true);
    }
  });

  it.each([
    {
      validation: { ...result, mode: "ANALYSIS_READY", valid: true },
      quantificationAllowed: false,
    },
    {
      validation: {
        ...result,
        mode: "ANALYSIS_READY",
        valid: false,
        issues: [{ ...warning, severity: "ERROR" }],
      },
      quantificationAllowed: true,
    },
    { validation: result, quantificationAllowed: true },
  ])("rejects an inconsistent analysis-ready quantification decision %#", (outcome) => {
    expect(AnalysisReadyValidationOutcomeSchema.safeParse(outcome).success).toBe(false);
  });
});

describe("shared analysis-run contracts", () => {
  const base = {
    schemaVersion: "1.0.0",
    id: RUN_ID,
    modelId: MODEL_ID,
    modelRevision: 3,
    methodType: "FAULT_TREE",
    requestedBy: "analyst-1",
    requestedAt: "2026-08-20T19:45:00.000Z",
  };
  const engine = { name: "PRAXIS", version: "0.1.0" };
  const failure = {
    kind: "SOLVER_ERROR",
    code: "PRAXIS_LOGIC",
    message: "The solver rejected the model.",
    details: { gateId: "G-1" },
  };

  it.each([
    { ...base, status: "QUEUED", startedAt: null, completedAt: null, engine: null },
    {
      ...base,
      status: "RUNNING",
      startedAt: "2026-08-20T19:46:00.000Z",
      completedAt: null,
      engine,
    },
    {
      ...base,
      status: "SUCCEEDED",
      startedAt: "2026-08-20T19:46:00.000Z",
      completedAt: "2026-08-20T19:47:00.000Z",
      engine,
    },
    {
      ...base,
      status: "FAILED",
      startedAt: "2026-08-20T19:46:00.000Z",
      completedAt: "2026-08-20T19:47:00.000Z",
      engine,
      failure,
    },
    {
      ...base,
      status: "CANCELLED",
      startedAt: null,
      completedAt: "2026-08-20T19:47:00.000Z",
      engine: null,
    },
  ])("accepts a valid $status lifecycle", (run) => {
    expect(AnalysisRunMetadataSchema.safeParse(run).success).toBe(true);
  });

  it.each([
    { ...base, status: "QUEUED", startedAt: null, completedAt: null, engine },
    { ...base, status: "RUNNING", startedAt: null, completedAt: null, engine },
    {
      ...base,
      status: "SUCCEEDED",
      startedAt: "2026-08-20T19:46:00.000Z",
      completedAt: null,
      engine,
    },
    {
      ...base,
      status: "FAILED",
      startedAt: "2026-08-20T19:46:00.000Z",
      completedAt: "2026-08-20T19:44:00.000Z",
      engine,
      failure,
    },
    {
      ...base,
      status: "FAILED",
      startedAt: "2026-08-20T19:46:00.000Z",
      completedAt: "2026-08-20T19:47:00.000Z",
      engine,
    },
    {
      ...base,
      status: "SUCCEEDED",
      startedAt: "2026-08-20T19:46:00.000Z",
      completedAt: "2026-08-20T19:47:00.000Z",
      engine,
      failure,
    },
  ])("rejects an invalid $status lifecycle", (run) => {
    expect(AnalysisRunMetadataSchema.safeParse(run).success).toBe(false);
  });
});
