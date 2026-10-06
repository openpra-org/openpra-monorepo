import {
  EsqBarrierCellRunRequestSchema,
  LoadCapacityAnalysisResultSchema,
  LoadCapacityExecuteResultSchema,
  LoadCapacityRunSettingsSchema,
} from "..";

const MODEL_ID = "123e4567-e89b-42d3-a456-426614174700";
const RUN_ID = "123e4567-e89b-42d3-a456-426614174701";

const settings = { sampling: "LATIN_HYPERCUBE", samples: 2000, seed: 20261005, curvePoints: 41 } as const;

const runRequest = {
  schemaVersion: "1.0.0",
  cellId: "CELL-TRISO-GROSS-ESF-LATE",
  workbookRevision: 4,
  settings,
} as const;

const queuedRun = {
  schemaVersion: "1.0.0",
  id: RUN_ID,
  owner: { workbookId: "esq-workbook", workbookRevision: 4, modelId: MODEL_ID },
  sourceWorkbooks: [{ workbookId: "esq-workbook", workbookRevision: 4 }],
  methodType: "LOAD_CAPACITY",
  status: "QUEUED",
  requestedBy: "analyst-1",
  requestedAt: "2026-10-05T14:00:00.000Z",
  startedAt: null,
  completedAt: null,
  engine: null,
} as const;

const uncertainty = {
  sampling: "LATIN_HYPERCUBE",
  samples: 2000,
  seed: 20261005,
  mean: 0.0123,
  standardDeviation: 0.0201,
  p05: 0.00011,
  p50: 0.0049,
  p95: 0.0511,
  minimum: 0.0000021,
  maximum: 0.31,
  largestQuadratureError: null,
} as const;

const result = {
  schemaVersion: "1.0.0",
  runId: RUN_ID,
  owner: { workbookId: "esq-workbook", workbookRevision: 4, modelId: MODEL_ID },
  completedAt: "2026-10-05T14:00:02.000Z",
  method: "CLOSED_FORM_LOGNORMAL",
  pointProbability: 0.0062,
  quadratureError: null,
  unit: "degC",
  uncertainty,
  curve: [
    { load: 1100, probability: 0.00001, mean: 0.00002, p05: 0.0000001, p50: 0.00001, p95: 0.00008 },
    { load: 1600, probability: 0.04, mean: 0.05, p05: 0.01, p50: 0.04, p95: 0.12 },
  ],
  validationIssues: [],
} as const;

describe("Load-capacity run request contracts", () => {
  it.each(["MONTE_CARLO", "LATIN_HYPERCUBE"])("accepts %s sampling", (sampling) => {
    expect(LoadCapacityRunSettingsSchema.safeParse({ ...settings, sampling }).success).toBe(true);
  });

  it("accepts a cell run request", () => {
    expect(EsqBarrierCellRunRequestSchema.safeParse(runRequest).success).toBe(true);
  });

  it.each([
    { ...settings, sampling: "SOBOL" },
    { ...settings, samples: 1 },
    { ...settings, samples: 1_000_001 },
    { ...settings, samples: 2.5 },
    { ...settings, seed: -1 },
    { ...settings, curvePoints: 1 },
    { ...settings, curvePoints: 1002 },
    { ...settings, engine: "PRAXIS" },
  ])("rejects malformed settings %#", (candidate) => {
    expect(LoadCapacityRunSettingsSchema.safeParse(candidate).success).toBe(false);
  });

  it.each([
    { ...runRequest, schemaVersion: "2.0.0" },
    { ...runRequest, cellId: "" },
    { ...runRequest, workbookRevision: 0 },
    { ...runRequest, requestedBy: "analyst-1" },
  ])("rejects malformed run request %#", (candidate) => {
    expect(EsqBarrierCellRunRequestSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("Load-capacity execution and result contracts", () => {
  it("accepts a queued run and a completed result", () => {
    expect(LoadCapacityExecuteResultSchema.safeParse({ schemaVersion: "1.0.0", run: queuedRun }).success).toBe(true);
    expect(LoadCapacityAnalysisResultSchema.safeParse(result).success).toBe(true);
  });

  it("accepts a point result without sampling, unit or band", () => {
    expect(
      LoadCapacityAnalysisResultSchema.safeParse({
        ...result,
        method: "QUADRATURE",
        quadratureError: 1.2e-15,
        unit: null,
        uncertainty: null,
        curve: [
          { load: 1100, probability: 0.00001 },
          { load: 1600, probability: 0.04 },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects execution metadata for a different method type", () => {
    expect(
      LoadCapacityExecuteResultSchema.safeParse({
        schemaVersion: "1.0.0",
        run: { ...queuedRun, methodType: "EVENT_TREE" },
      }).success,
    ).toBe(false);
  });

  it.each([
    { ...result, schemaVersion: "2.0.0" },
    { ...result, method: "SIMPSON" },
    { ...result, pointProbability: 1.01 },
    { ...result, pointProbability: -0.01 },
    { ...result, quadratureError: -1 },
    { ...result, uncertainty: { ...uncertainty, p95: 1.5 } },
    { ...result, uncertainty: { ...uncertainty, samples: 1 } },
    { ...result, curve: [result.curve[0]] },
    { ...result, curve: [{ ...result.curve[0], load: Number.NaN }, result.curve[1]] },
    { ...result, completedAt: "today" },
    { ...result, cutSets: [] },
  ])("rejects malformed result %#", (candidate) => {
    expect(LoadCapacityAnalysisResultSchema.safeParse(candidate).success).toBe(false);
  });
});
