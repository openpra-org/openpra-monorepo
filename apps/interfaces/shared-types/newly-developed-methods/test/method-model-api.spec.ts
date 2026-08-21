import {
  MethodAnalysisRunResultSchema,
  MethodModelCreateRequestSchema,
  MethodModelExecuteRequestSchema,
  MethodModelExecuteResultSchema,
  MethodModelPatchRequestSchema,
  MethodModelValidateRequestSchema,
  NewlyDevelopedMethodModelSchema,
} from "..";

const BN_MODEL_ID = "123e4567-e89b-42d3-a456-426614174700";

const baseRequest = {
  schemaVersion: "1.0.0",
  projectId: "project-1",
  code: "MODEL-001",
  name: "Analysis model",
  description: "An editable draft.",
  createdBy: "ada",
};

describe("method-model persistence API contracts", () => {
  it.each([
    { ...baseRequest, methodType: "FAULT_TREE" },
    { ...baseRequest, methodType: "BAYESIAN_NETWORK" },
    { ...baseRequest, methodType: "EVENT_TREE" },
    {
      ...baseRequest,
      methodType: "HYBRID_CAUSAL_LOGIC",
      bayesianNetwork: { modelId: BN_MODEL_ID },
    },
  ])("accepts a typed $methodType create request", (request) => {
    expect(MethodModelCreateRequestSchema.safeParse(request).success).toBe(true);
  });

  it("requires the initial Bayesian-network reference only for HCL", () => {
    expect(
      MethodModelCreateRequestSchema.safeParse({
        ...baseRequest,
        methodType: "HYBRID_CAUSAL_LOGIC",
      }).success,
    ).toBe(false);
    expect(
      MethodModelCreateRequestSchema.safeParse({
        ...baseRequest,
        methodType: "FAULT_TREE",
        bayesianNetwork: { modelId: BN_MODEL_ID },
      }).success,
    ).toBe(false);
  });

  it("rejects unsupported methods and malformed create metadata", () => {
    expect(
      MethodModelCreateRequestSchema.safeParse({
        ...baseRequest,
        methodType: "DYNAMIC_EVENT_TREE",
      }).success,
    ).toBe(false);
    expect(
      MethodModelCreateRequestSchema.safeParse({
        ...baseRequest,
        methodType: "EVENT_TREE",
        code: " ",
      }).success,
    ).toBe(false);
  });

  it("discriminates persisted models and rejects a method/body mismatch", () => {
    const metadata = {
      ...baseRequest,
      id: "123e4567-e89b-42d3-a456-426614174701",
      methodType: "FAULT_TREE",
      revision: 1,
      createdAt: "2026-08-20T20:00:00.000Z",
      updatedBy: "ada",
      updatedAt: "2026-08-20T20:00:00.000Z",
    };
    const faultTree = {
      ...metadata,
      topGate: null,
      gates: [],
      leafNodes: [],
      gateInputs: [],
      nodePositions: [],
      layout: {
        viewport: { x: 0, y: 0, zoom: 1 },
        mode: "MANUAL",
        direction: "TOP_TO_BOTTOM",
      },
    };

    expect(NewlyDevelopedMethodModelSchema.safeParse(faultTree).success).toBe(true);
    expect(
      NewlyDevelopedMethodModelSchema.safeParse({
        ...faultTree,
        methodType: "BAYESIAN_NETWORK",
      }).success,
    ).toBe(false);
  });

  it.each([
    { methodType: "FAULT_TREE", changes: { name: "Updated FT" } },
    { methodType: "BAYESIAN_NETWORK", changes: { nodes: [] } },
    { methodType: "EVENT_TREE", changes: { sequences: [] } },
    { methodType: "HYBRID_CAUSAL_LOGIC", changes: { bindings: [] } },
  ])("accepts one changed field or structure for $methodType", ({ methodType, changes }) => {
    expect(
      MethodModelPatchRequestSchema.safeParse({
        schemaVersion: "1.0.0",
        methodType,
        modelId: "123e4567-e89b-42d3-a456-426614174701",
        expectedRevision: 1,
        updatedBy: "ada",
        changes,
      }).success,
    ).toBe(true);
  });

  it("rejects empty changes and changes from a different method", () => {
    const request = {
      schemaVersion: "1.0.0",
      methodType: "FAULT_TREE",
      modelId: "123e4567-e89b-42d3-a456-426614174701",
      expectedRevision: 1,
      updatedBy: "ada",
    };
    expect(MethodModelPatchRequestSchema.safeParse({ ...request, changes: {} }).success).toBe(false);
    expect(
      MethodModelPatchRequestSchema.safeParse({
        ...request,
        changes: { conditionalProbabilityTables: [] },
      }).success,
    ).toBe(false);
  });

  it.each([
    "FAULT_TREE",
    "BAYESIAN_NETWORK",
    "EVENT_TREE",
    "HYBRID_CAUSAL_LOGIC",
  ])("accepts draft and analysis-ready validation requests for %s", (methodType) => {
    for (const mode of ["DRAFT", "ANALYSIS_READY"]) {
      expect(
        MethodModelValidateRequestSchema.safeParse({
          schemaVersion: "1.0.0",
          methodType,
          modelId: "123e4567-e89b-42d3-a456-426614174701",
          revision: 1,
          mode,
          requestedBy: "ada",
        }).success,
      ).toBe(true);
    }
  });

  it.each([
    {
      methodType: "FAULT_TREE",
    },
    {
      methodType: "BAYESIAN_NETWORK",
      query: {
        evidence: { observations: [] },
        queryNodeIds: ["123e4567-e89b-42d3-a456-426614174702"],
      },
    },
    {
      methodType: "EVENT_TREE",
      mode: "INDEPENDENT",
    },
    {
      methodType: "HYBRID_CAUSAL_LOGIC",
      faultTreeTopGate: {
        modelId: "123e4567-e89b-42d3-a456-426614174703",
        entityId: "123e4567-e89b-42d3-a456-426614174704",
      },
    },
  ])("accepts a typed $methodType execute request", (methodFields) => {
    expect(
      MethodModelExecuteRequestSchema.safeParse({
        schemaVersion: "1.0.0",
        modelId: "123e4567-e89b-42d3-a456-426614174701",
        revision: 2,
        requestedBy: "ada",
        ...methodFields,
      }).success,
    ).toBe(true);
  });

  it("keeps method-specific execute fields on the matching method", () => {
    expect(
      MethodModelExecuteRequestSchema.safeParse({
        schemaVersion: "1.0.0",
        methodType: "FAULT_TREE",
        modelId: "123e4567-e89b-42d3-a456-426614174701",
        revision: 2,
        requestedBy: "ada",
        mode: "INDEPENDENT",
      }).success,
    ).toBe(false);
  });

  it("accepts a queued execute acknowledgement and a consistent completed result", () => {
    const queuedRun = {
      schemaVersion: "1.0.0",
      id: "123e4567-e89b-42d3-a456-426614174705",
      modelId: "123e4567-e89b-42d3-a456-426614174701",
      modelRevision: 2,
      methodType: "FAULT_TREE",
      status: "QUEUED",
      requestedBy: "ada",
      requestedAt: "2026-08-20T20:00:00.000Z",
      startedAt: null,
      completedAt: null,
      engine: null,
    };
    expect(
      MethodModelExecuteResultSchema.safeParse({
        schemaVersion: "1.0.0",
        run: queuedRun,
      }).success,
    ).toBe(true);

    const completedAt = "2026-08-20T20:01:00.000Z";
    const response = {
      run: {
        ...queuedRun,
        status: "SUCCEEDED",
        startedAt: "2026-08-20T20:00:01.000Z",
        completedAt,
        engine: { name: "PRAXIS", version: "0.1.0" },
      },
      result: {
        schemaVersion: "1.0.0",
        runId: queuedRun.id,
        modelId: queuedRun.modelId,
        modelRevision: queuedRun.modelRevision,
        topGateId: "123e4567-e89b-42d3-a456-426614174706",
        topEventProbability: 0.01,
        minimalCutSetCount: 0,
        leadingCutSets: [],
        validationIssues: [],
        completedAt,
      },
    };
    expect(MethodAnalysisRunResultSchema.safeParse(response).success).toBe(true);
    expect(
      MethodAnalysisRunResultSchema.safeParse({
        ...response,
        run: { ...response.run, methodType: "BAYESIAN_NETWORK" },
      }).success,
    ).toBe(false);
  });
});
