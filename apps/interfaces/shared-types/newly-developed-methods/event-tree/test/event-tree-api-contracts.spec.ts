import {
  EsqImportanceRunRequestSchema,
  EsqImportanceRunResultSchema,
  EsqModelRunRequestSchema,
  EsqModelRunResultSchema,
  EsqPostRunRequestSchema,
  EsqPostRunResultSchema,
  EsqSensitivityRunRequestSchema,
  EsqUncertaintyRunRequestSchema,
  EsqUncertaintyRunResultSchema,
  EventTreeSamplingDistributionSchema,
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
  modelId: MODEL_ID,
  code: "ET-EHP",
  name: "Event tree EHP",
  description: "Event-tree model.",
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
  owner: { workbookId: "es-workbook", workbookRevision: 1, modelId: MODEL_ID },
  sourceWorkbooks: [{ workbookId: "es-workbook", workbookRevision: 1 }],
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
    modelId: MODEL_ID,
    code: "ET-EHP",
    name: "Event tree EHP",
    description: "Event-tree model.",
  };

  it("accepts a versioned Event Tree model and create request/result", () => {
    expect(EventTreeModelSchema.safeParse(model).success).toBe(true);
    expect(EventTreeCreateRequestSchema.safeParse(createRequest).success).toBe(true);
    expect(
      EventTreeCreateResultSchema.safeParse({ schemaVersion: "1.0.0", workbookRevision: 2, model }).success,
    ).toBe(true);
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
    { ...createRequest, modelId: "ET-1" },
    { ...createRequest, code: "" },
    { ...createRequest, projectId: "project-mhtgr" },
    { ...createRequest, createdBy: "analyst-1" },
    { ...createRequest, id: MODEL_ID },
  ])("rejects malformed create request %#", (candidate) => {
    expect(EventTreeCreateRequestSchema.safeParse(candidate).success).toBe(false);
  });

  it.each([
    { ...model, methodType: "EVENT_TREE" },
    { ...model, schemaVersion: "2.0.0" },
    { ...model, revision: 0 },
    { ...model, id: MODEL_ID },
    { ...model, projectId: "project-mhtgr" },
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
    expectedWorkbookRevision: 1,
    changes: { name: "Renamed event tree" },
  };

  it("accepts a typed optimistic-concurrency patch and updated result", () => {
    expect(EventTreePatchRequestSchema.safeParse(patchRequest).success).toBe(true);
    expect(
      EventTreePatchResultSchema.safeParse({
        schemaVersion: "1.0.0",
        workbookRevision: 2,
        model: { ...model, name: patchRequest.changes.name },
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
    { ...patchRequest, expectedWorkbookRevision: 0 },
    { ...patchRequest, expectedRevision: 1 },
    { ...patchRequest, updatedBy: "analyst-2" },
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
    workbookRevision: 1,
    mode: "ANALYSIS_READY",
  };
  const validation = {
    schemaVersion: "1.0.0",
    owner: { workbookId: "es-workbook", workbookRevision: 1, modelId: MODEL_ID },
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
    { ...validateRequest, workbookRevision: 0 },
    { ...validateRequest, revision: 1 },
    { ...validateRequest, mode: "PUBLISH" },
    { ...validateRequest, requestedBy: "analyst-1" },
  ])("rejects malformed validate request %#", (candidate) => {
    expect(EventTreeValidateRequestSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("Event-tree execution and analysis-result contracts", () => {
  const executeRequest = {
    schemaVersion: "1.0.0",
    modelId: MODEL_ID,
    workbookRevision: 1,
    mode: "INDEPENDENT",
  };
  const analysisResult = {
    schemaVersion: "1.0.0",
    runId: RUN_ID,
    owner: { workbookId: "es-workbook", workbookRevision: 1, modelId: MODEL_ID },
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

  it("accepts the expanded common cause events in the decision diagram order", () => {
    const diagnostics = { bdd: { nodes: 12, variables: 3, variableOrder: [SEQUENCE_ID, "CCF-RPS-DIV-mgl-1-1", "CCF-RPS-DIV-mgl-2-1"] }, bridge: null, junctionTree: null };
    expect(EventTreeAnalysisResultSchema.safeParse({ ...analysisResult, sequences: [{ ...analysisResult.sequences[0], diagnostics }] }).success).toBe(true);
    const blank = { ...diagnostics, bdd: { ...diagnostics.bdd, variableOrder: [""] } };
    expect(EventTreeAnalysisResultSchema.safeParse({ ...analysisResult, sequences: [{ ...analysisResult.sequences[0], diagnostics: blank }] }).success).toBe(false);
  });

  it.each([
    { ...executeRequest, schemaVersion: "2.0.0" },
    { ...executeRequest, modelId: "ET-1" },
    { ...executeRequest, workbookRevision: 0 },
    { ...executeRequest, revision: 1 },
    { ...executeRequest, mode: "MARGINAL_ONLY" },
    { ...executeRequest, requestedBy: "analyst-1" },
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
    { ...analysisResult, owner: { ...analysisResult.owner, workbookRevision: 0 } },
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

describe("ESQ model run contracts", () => {
  const logic = { flags: true, loopBreaks: "AS_SET", exclusions: true, expandCcf: true } as const;
  const cutSets = { basis: "FREQUENCY", cutOffs: [1e-6, 1e-7, 1e-8], quantifier: "MCUB", keep: 100 } as const;
  const exact = { schemaVersion: "1.0.0", workbookRevision: 3, logic, calculation: "EXACT" } as const;
  const sweep = [
    { cutOff: 1e-6, count: 6, probability: 2.65e-5, annualFrequency: 7.22e-5 },
    { cutOff: 1e-7, count: 14, probability: 2.77e-5, annualFrequency: 7.54e-5 },
  ];
  const items = [{ order: 2, probability: 1.2e-5, annualFrequency: 3.3e-5, basicEventIds: ["SCS-PM-A", "RCCS-STACK"] }];
  const summary = {
    schemaVersion: "1.0.0",
    kind: "ESQ_MODEL_RUN",
    runId: RUN_ID,
    owner: { workbookId: "esq-workbook", workbookRevision: 3, modelId: MODEL_ID },
    completedAt: "2026-10-05T14:06:00.000Z",
    inputs: "9f2c1a7b5e3d4c6a",
    calculation: "CUT_SETS",
    logic,
    cutSets,
    trees: [{ treeId: "ET-PLOFC", runId: RUN_ID, status: "SUCCEEDED", initiatorFrequency: 2.72, failure: null }],
    sequences: [{ treeId: "ET-PLOFC", sequenceIds: ["EHP-3"], familyId: "ESF-LATE", endState: "RELEASE", conditionalProbability: 2.77e-5, annualFrequency: 7.54e-5, cutSetCount: 14 }],
    families: [{
      familyId: "ESF-LATE",
      annualFrequency: 7.54e-5,
      sequenceCount: 1,
      cutSetCount: 14,
      sweep: sweep.map(({ cutOff, count, annualFrequency }) => ({ cutOff, count, annualFrequency })),
      states: [{ stateId: "POS-01", annualFrequency: 7.54e-5, sweep: [] }],
      cutSets: [{ treeId: "ET-PLOFC", basicEventIds: ["SCS-PM-A", "RCCS-STACK"], annualFrequency: 3.3e-5 }],
    }],
    endStates: [{ endState: "RELEASE", annualFrequency: 7.54e-5 }],
    eventCodes: { "SCS-PM-A": "SCS-PM-A" },
    peakProbability: 2.77e-5,
  } as const;

  it("accepts an exact run and a cut set run with its settings", () => {
    expect(EsqModelRunRequestSchema.safeParse(exact).success).toBe(true);
    expect(EsqModelRunRequestSchema.safeParse({ ...exact, calculation: "CUT_SETS", cutSets }).success).toBe(true);
    expect(EsqModelRunRequestSchema.safeParse({ ...exact, calculation: "CUT_SETS", cutSets: { ...cutSets, basis: "PROBABILITY", limitOrder: 4 } }).success).toBe(true);
  });

  it.each([
    { ...exact, calculation: "CUT_SETS" },
    { ...exact, cutSets },
    { ...exact, calculation: "CUT_SETS", cutSets: { ...cutSets, cutOffs: [1e-8, 1e-7] } },
    { ...exact, calculation: "CUT_SETS", cutSets: { ...cutSets, cutOffs: [1e-6, 1e-6] } },
    { ...exact, calculation: "CUT_SETS", cutSets: { ...cutSets, cutOffs: [] } },
    { ...exact, calculation: "CUT_SETS", cutSets: { ...cutSets, cutOffs: [0] } },
    { ...exact, calculation: "CUT_SETS", cutSets: { ...cutSets, basis: "PROBABILITY", cutOffs: [2] } },
    { ...exact, calculation: "CUT_SETS", cutSets: { ...cutSets, keep: 0 } },
    { ...exact, calculation: "CUT_SETS", cutSets: { ...cutSets, keep: 1001 } },
    { ...exact, calculation: "CUT_SETS", cutSets: { ...cutSets, limitOrder: 0 } },
    { ...exact, calculation: "CUT_SETS", cutSets: { ...cutSets, quantifier: "MIN_CUT" } },
    { ...exact, calculation: "SAMPLED" },
    { ...exact, treeIds: ["ET-PLOFC"] },
  ])("rejects malformed model run request %#", (candidate) => {
    expect(EsqModelRunRequestSchema.safeParse(candidate).success).toBe(false);
  });

  it("accepts sequence cut sets, family merges and the model summary", () => {
    const withCutSets = {
      schemaVersion: "1.0.0",
      runId: RUN_ID,
      owner: { workbookId: "esq-workbook", workbookRevision: 3, modelId: MODEL_ID },
      mode: "INDEPENDENT",
      sequences: [{
        sequenceId: SEQUENCE_ID,
        path: sequence.path,
        result: sequence.result,
        conditionalProbability: 2.77e-5,
        annualFrequency: 7.54e-5,
        cutSets: { count: 14, failedCount: 14, distributionByOrder: [0, 0, 8, 6], sweep, items },
      }],
      endStateAggregates: [{ endStateId: END_STATE_ID, annualFrequency: 7.54e-5 }],
      cutSetAnalysis: cutSets,
      families: [{ familyId: "ESF-LATE", sequenceIds: [SEQUENCE_ID], count: 14, sweep, items }],
      validationIssues: [],
      completedAt: "2026-10-05T14:06:00.000Z",
    };
    expect(EventTreeAnalysisResultSchema.safeParse(withCutSets).success).toBe(true);
    expect(EventTreeAnalysisResultSchema.safeParse({ ...withCutSets, families: [{ ...withCutSets.families[0], extra: 1 }] }).success).toBe(false);
    expect(EsqModelRunResultSchema.safeParse(summary).success).toBe(true);
    expect(EsqModelRunResultSchema.safeParse({ ...summary, calculation: "EXACT", cutSets: null, peakProbability: null }).success).toBe(true);
  });

  it.each([
    { ...summary, kind: "HCL_BATCH" },
    { ...summary, inputs: "" },
    { ...summary, trees: [{ ...summary.trees[0], status: "SKIPPED" }] },
    { ...summary, sequences: [{ ...summary.sequences[0], sequenceIds: [] }] },
    { ...summary, sequences: [{ ...summary.sequences[0], conditionalProbability: 1.5 }] },
    { ...summary, families: [{ ...summary.families[0], annualFrequency: -1 }] },
    { ...summary, peakProbability: 2 },
  ])("rejects malformed model summary %#", (candidate) => {
    expect(EsqModelRunResultSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("ESQ post-processing run contracts", () => {
  const logic = { flags: true, loopBreaks: "AS_SET", exclusions: true, expandCcf: true, recovery: true, dependency: false } as const;
  const search = { schemaVersion: "1.0.0", workbookRevision: 7, logic, purpose: "COMBINATIONS", cutOff: 1e-14, raisedHep: 0.8 } as const;
  const result = {
    schemaVersion: "1.0.0",
    kind: "ESQ_POST_RUN",
    runId: RUN_ID,
    owner: { workbookId: "esq-workbook", workbookRevision: 7, modelId: MODEL_ID },
    completedAt: "2026-10-05T14:06:00.000Z",
    inputs: "9f2c1a7b5e3d4c6a",
    purpose: "COMBINATIONS",
    cutOff: 1e-14,
    raisedHep: 0.8,
    logic,
    trees: [{ treeId: "ET-PLOFC", runId: RUN_ID, status: "SUCCEEDED", initiatorFrequency: 2.72, failure: null }],
    combinations: [{ eventIds: ["RCC-HFE-DMP", "SCS-HFE"], treeIds: ["ET-PLOFC"], cutSetCount: 1, nominalFrequency: 6.12e-6 }],
    deletions: [],
    eventCodes: { "SCS-HFE": "SCS-HFE" },
  } as const;

  it("accepts a combination search, a deletion check and their summary", () => {
    expect(EsqPostRunRequestSchema.safeParse(search).success).toBe(true);
    const { raisedHep: _raised, ...deletions } = search;
    expect(EsqPostRunRequestSchema.safeParse({ ...deletions, purpose: "DELETIONS" }).success).toBe(true);
    expect(EsqPostRunResultSchema.safeParse(result).success).toBe(true);
    expect(EsqPostRunResultSchema.safeParse({ ...result, purpose: "DELETIONS", raisedHep: null, combinations: [], deletions: [{ exclusionId: "EX-1", treeIds: ["ET-PLOFC"], cutSetCount: 2, nominalFrequency: 1e-9 }] }).success).toBe(true);
    expect(EsqModelRunRequestSchema.safeParse({
      schemaVersion: "1.0.0", workbookRevision: 7, logic, calculation: "CUT_SETS",
      cutSets: { basis: "FREQUENCY", cutOffs: [1e-8], quantifier: "RARE_EVENT", keep: 1, focus: [{ key: "HFE", events: ["A", "B"], minimum: 2 }] },
    }).success).toBe(true);
  });

  it.each([
    { ...search, raisedHep: undefined },
    { ...search, raisedHep: 0 },
    { ...search, raisedHep: 1.2 },
    { ...search, purpose: "DELETIONS" },
    { ...search, cutOff: 0 },
    { ...search, logic: { ...logic, recovery: "yes" } },
  ])("rejects malformed post-processing request %#", (candidate) => {
    expect(EsqPostRunRequestSchema.safeParse(candidate).success).toBe(false);
  });

  it.each([
    { ...result, kind: "ESQ_MODEL_RUN" },
    { ...result, combinations: [{ eventIds: ["SCS-HFE"], treeIds: [], cutSetCount: 1, nominalFrequency: 1e-6 }] },
    { ...result, raisedHep: 0 },
  ])("rejects malformed post-processing summary %#", (candidate) => {
    expect(EsqPostRunResultSchema.safeParse(candidate).success).toBe(false);
  });

  it("rejects focus groups whose minimum exceeds their events or that repeat an event", () => {
    const base = { schemaVersion: "1.0.0", workbookRevision: 7, logic, calculation: "CUT_SETS" } as const;
    const cutSets = { basis: "FREQUENCY", cutOffs: [1e-8], quantifier: "RARE_EVENT", keep: 1 } as const;
    expect(EsqModelRunRequestSchema.safeParse({ ...base, cutSets: { ...cutSets, focus: [{ key: "HFE", events: ["A"], minimum: 2 }] } }).success).toBe(false);
    expect(EsqModelRunRequestSchema.safeParse({ ...base, cutSets: { ...cutSets, focus: [{ key: "HFE", events: ["A", "A"], minimum: 1 }] } }).success).toBe(false);
  });
});

describe("ESQ importance, uncertainty and sensitivity run contracts", () => {
  const logic = { flags: true, loopBreaks: "AS_SET", exclusions: true, expandCcf: true, recovery: true, dependency: true } as const;
  const owner = { workbookId: "esq-workbook", workbookRevision: 7, modelId: MODEL_ID };
  const tree = { treeId: "ET-PLOFC", runId: RUN_ID, status: "SUCCEEDED", initiatorFrequency: 2.72, failure: null } as const;
  const stats = { point: 5.8e-5, mean: 7.6e-5, standardDeviation: 1.1e-4, p05: 4.8e-6, p50: 3.5e-5, p95: 2.7e-4 };
  const importance = {
    schemaVersion: "1.0.0",
    kind: "ESQ_IMPORTANCE_RUN",
    runId: RUN_ID,
    owner,
    completedAt: "2026-10-06T10:00:00.000Z",
    inputs: "9f2c1a7b5e3d4c6a",
    logic,
    trees: [tree],
    families: [{ familyId: "F-REL", base: 5.8e-5, endState: "RADIONUCLIDE_RELEASE" }],
    targets: [
      { id: "EVENT:E-1", kind: "EVENT", role: "BASIC", label: "SCS-PMP-FS", ref: "E-1", probability: 2e-3, changes: [{ familyId: "F-REL", decrease: 1.2e-5, increase: 5.9e-3 }] },
      { id: "PARAMETER:P-1", kind: "PARAMETER", role: null, label: "Pump fails to start (P-1)", ref: "P-1", probability: null, changes: [{ familyId: "F-REL", decrease: 1.2e-5, increase: 5.9e-3 }] },
    ],
    silentEventIds: ["E-9"],
  } as const;
  const uncertainty = {
    schemaVersion: "1.0.0",
    kind: "ESQ_UNCERTAINTY_RUN",
    runId: RUN_ID,
    owner,
    completedAt: "2026-10-06T10:05:00.000Z",
    inputs: "9f2c1a7b5e3d4c6a",
    logic,
    trials: 1000,
    seed: 11,
    method: "LATIN_HYPERCUBE",
    correlation: "SHARED",
    trees: [tree],
    families: [{ familyId: "F-REL", endState: "RADIONUCLIDE_RELEASE", ...stats, values: [3.5e-5, 7.1e-5] }],
    total: stats,
    keys: [{ key: "PARAMETER:P-1", label: "Pump fails to start (P-1)", source: "DA", distribution: { type: "LOGNORMAL", median: 1.2e-3, errorFactor: 5 }, events: 2 }],
    unsampled: [{ id: "INITIATOR:IE-1", label: "Loss of flow (IE-1)", reason: "The initiator frequency has no distribution. Type an error factor." }],
  } as const;

  it("accepts the three run requests and both summaries", () => {
    expect(EsqImportanceRunRequestSchema.safeParse({ schemaVersion: "1.0.0", workbookRevision: 7, logic }).success).toBe(true);
    expect(EsqUncertaintyRunRequestSchema.safeParse({ schemaVersion: "1.0.0", workbookRevision: 7, logic, trials: 10000, seed: 1, method: "MONTE_CARLO", correlation: "INDEPENDENT" }).success).toBe(true);
    expect(EsqSensitivityRunRequestSchema.safeParse({ schemaVersion: "1.0.0", workbookRevision: 7, caseId: "SC-1", logic, calculation: "EXACT" }).success).toBe(true);
    expect(EsqSensitivityRunRequestSchema.safeParse({ schemaVersion: "1.0.0", workbookRevision: 7, caseId: "SC-1", logic, calculation: "CUT_SETS", cutSets: { basis: "FREQUENCY", cutOffs: [1e-12], quantifier: "MCUB", keep: 1 } }).success).toBe(true);
    expect(EsqImportanceRunResultSchema.safeParse(importance).success).toBe(true);
    expect(EsqUncertaintyRunResultSchema.safeParse(uncertainty).success).toBe(true);
    expect(EsqUncertaintyRunResultSchema.safeParse({ ...uncertainty, total: null }).success).toBe(true);
  });

  it.each([
    { trials: 99 },
    { trials: 20001 },
    { trials: 1000.5 },
    { seed: -1 },
    { seed: 2147483648 },
    { method: "SOBOL" },
    { correlation: "PARTIAL" },
    { extra: true },
  ])("rejects malformed sampling request %#", (change) => {
    expect(EsqUncertaintyRunRequestSchema.safeParse({ schemaVersion: "1.0.0", workbookRevision: 7, logic, trials: 1000, seed: 1, method: "MONTE_CARLO", correlation: "SHARED", ...change }).success).toBe(false);
  });

  it("rejects sensitivity requests whose settings do not match the calculation", () => {
    const base = { schemaVersion: "1.0.0", workbookRevision: 7, caseId: "SC-1", logic } as const;
    expect(EsqSensitivityRunRequestSchema.safeParse({ ...base, calculation: "CUT_SETS" }).success).toBe(false);
    expect(EsqSensitivityRunRequestSchema.safeParse({ ...base, calculation: "EXACT", cutSets: { basis: "FREQUENCY", cutOffs: [1e-12], quantifier: "MCUB", keep: 1 } }).success).toBe(false);
    expect(EsqSensitivityRunRequestSchema.safeParse({ ...base, caseId: "", calculation: "EXACT" }).success).toBe(false);
  });

  it("rejects malformed summaries and distributions", () => {
    expect(EsqImportanceRunResultSchema.safeParse({ ...importance, kind: "ESQ_MODEL_RUN" }).success).toBe(false);
    expect(EsqImportanceRunResultSchema.safeParse({ ...importance, targets: [{ ...importance.targets[0], kind: "MODULE" }] }).success).toBe(false);
    expect(EsqUncertaintyRunResultSchema.safeParse({ ...uncertainty, method: "SOBOL" }).success).toBe(false);
    expect(EventTreeSamplingDistributionSchema.safeParse({ type: "UNIFORM", lower: 2, upper: 1 }).success).toBe(false);
    expect(EventTreeSamplingDistributionSchema.safeParse({ type: "LOGNORMAL", median: 1e-3, errorFactor: 0.5 }).success).toBe(false);
    expect(EventTreeSamplingDistributionSchema.safeParse({ type: "BETA", alpha: 0.5, beta: 120 }).success).toBe(true);
  });

  it("carries the importance and sampling sections of a tree run", () => {
    const parsed = EventTreeAnalysisResultSchema.safeParse({
      schemaVersion: "1.0.0",
      runId: RUN_ID,
      owner,
      mode: "INDEPENDENT",
      sequences: [],
      endStateAggregates: [],
      importance: { families: [{ familyId: "F-REL", base: 5.8e-5, events: [{ id: "E-1", decrease: 1.2e-5, increase: 5.9e-3 }], groups: [{ key: "PARAMETER:P-1", decrease: 1.2e-5, increase: 5.9e-3 }] }], variables: [{ id: "E-1", probability: 2e-3 }, { id: "CCF-1", probability: 1e-5, ccfGroupId: "G-1", ccfMembers: ["E-1", "E-2"] }] },
      sampling: { trials: 2, seed: 11, method: "MONTE_CARLO", sampledEvents: 3, families: [{ familyId: "F-REL", values: [3.5e-5, 7.1e-5] }] },
      validationIssues: [],
      completedAt: "2026-10-06T10:05:00.000Z",
    });
    expect(parsed.success).toBe(true);
  });
});
