import { execute } from "praxis-node";
import type { EsqCell, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { esqCellRunId } from "interfaces-mef-types/esq/esq-barrier-inputs";
import type { AleatoryVariable, Law, UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import {
  UncertaintyResponseSchema,
  type UncertaintyRequest,
  type UncertaintyResponse,
} from "interfaces-shared-types/newly-developed-methods/shared";
import { createBlankEsq } from "../blank-esq";
import { buildEsqCellRun, type EsqUncertaintyEvaluator } from "../esq-barrier-run-builder";
import { EsqRunBuildError } from "../esq-model-run-builder";

interface NativeAnswer {
  result?: Record<string, number | string | boolean | object | null>;
  error?: { message: string };
}

const DA = "da-workbook";

function nativeResult(request: object): Record<string, number | string | boolean | object | null> {
  const answer: NativeAnswer = JSON.parse(execute(JSON.stringify(request)));
  if (answer.error !== undefined) throw new Error(answer.error.message);
  return answer.result ?? {};
}

const praxis: EsqUncertaintyEvaluator = (request: UncertaintyRequest): Promise<UncertaintyResponse> => {
  const result = { ...nativeResult({ schemaVersion: "1.0.0", request: { schemaVersion: "1.0.0", methodType: "UNCERTAINTY", ...request }, modelSnapshots: [] }) };
  delete result["methodType"];
  return Promise.resolve(UncertaintyResponseSchema.parse(result));
};

function quantity(law: Law): UncertainExpression {
  return { node: "VALUE", value: { unit: "QUANTITY", law } };
}

function cell(id: string, extra: Partial<EsqCell>): EsqCell {
  return {
    id,
    barrierId: "Fuel coating",
    modeId: "FM-1",
    familyId: "F-REL",
    mechanismIds: [],
    variable: "Peak fuel temperature",
    unit: " C ",
    basis: "REALISTIC",
    load: { source: "TYPED", variable: { law: { family: "NORMAL", mean: 1500, standardDeviation: 50 }, fields: [] }, basis: "Heat-up runs." },
    capacity: { source: "TYPED", variable: { law: { family: "NORMAL", mean: 1800, standardDeviation: 60 }, fields: [] }, basis: "Heating tests." },
    use: "SPLIT_FRACTION",
    ...extra,
  };
}

function workbook(cells: EsqCell[]): EventSequenceQuantification {
  const esq = createBlankEsq("ESQ", "analyst");
  esq.linkedWorkbooks = { DA };
  esq.model = {
    importedAt: "2026-10-05T12:00:00.000Z",
    sources: [],
    trees: [],
    sequences: [],
    families: [],
    functions: [],
    tops: [],
    initiators: [],
    states: [],
    events: [],
    ccfGroups: [],
    parameters: [
      { id: "P-WIN", name: "Window", parameterType: "OTHER", quantificationModel: "OTHER_PROBABILITY", estimate: quantity({ family: "LOGNORMAL", mean: 33.74468539677077, errorFactor: 1.287, level: 0.95 }) },
      { id: "P-HEAT", name: "Decay heat factor", parameterType: "OTHER", quantificationModel: "OTHER_PROBABILITY", estimate: { node: "VALUE", value: { unit: "FACTOR", law: { family: "UNIFORM", lower: 0.9, upper: 1.1 } } } },
      { id: "P-RATE", name: "Rate", parameterType: "FAILURE_RATE", valueType: "MEAN", value: 1e-5 },
      { id: "P-MIX", name: "Mixed", parameterType: "OTHER", quantificationModel: "OTHER_PROBABILITY", estimate: { node: "OPERATION", operation: "MULTIPLY", operands: [quantity({ family: "POINT", value: 2 }), quantity({ family: "POINT", value: 3 })] } },
    ],
    humanEvents: [],
  };
  esq.barrierWork = { cells };
  return esq;
}

async function buildError(run: () => Promise<object>): Promise<string> {
  try {
    await run();
  } catch (error) {
    if (error instanceof EsqRunBuildError) return error.message;
    throw error;
  }
  throw new Error("expected an ESQ run build error");
}

function loadCapacity(snapshot: object): Record<string, number | string | boolean | object | null> {
  return nativeResult({
    schemaVersion: "1.0.0",
    request: { schemaVersion: "1.0.0", methodType: "LOAD_CAPACITY", modelId: "CELL", revision: 1, requestedBy: "analyst", settings: { sampling: "LATIN_HYPERCUBE", samples: 400, seed: 7, curvePoints: 5 } },
    modelSnapshots: [{ ...snapshot, id: "CELL", revision: 1 }],
    resources: {},
  });
}

function pointOf(expression: UncertainExpression): number {
  const result = nativeResult({ schemaVersion: "1.0.0", request: { schemaVersion: "1.0.0", methodType: "UNCERTAINTY", expressions: [{ id: "x", expression, unit: "PROBABILITY" }] }, modelSnapshots: [] });
  const answers = result["expressions"];
  if (!Array.isArray(answers)) throw new Error("PRAXIS gave no expressions.");
  const [first] = answers;
  if (typeof first !== "object" || first === null || !("point" in first) || typeof first.point !== "number") throw new Error("PRAXIS gave no point.");
  return first.point;
}

describe("ESQ load and capacity run builder", () => {
  it("writes typed sides as aleatory variables and shares a linked field through one parameter", async () => {
    const shared: UncertainExpression = { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: DA, entityId: "P-HEAT" } };
    const load: AleatoryVariable = { law: { family: "NORMAL", mean: 1500, standardDeviation: 50 }, fields: [{ field: "mean", value: { node: "OPERATION", operation: "MULTIPLY", operands: [quantity({ family: "POINT", value: 1500 }), shared] } }] };
    const esq = workbook([cell("BC-1", {
      load: { source: "TYPED", variable: load, basis: "" },
      capacity: { source: "TYPED", variable: { law: { family: "NORMAL", mean: 1800, standardDeviation: 60 }, fields: [{ field: "standardDeviation", value: quantity({ family: "UNIFORM", lower: 40, upper: 80 }) }] }, basis: "" },
    })]);
    const run = await buildEsqCellRun({ esq, cellId: "BC-1", esqRevision: 6 }, praxis);
    expect(run.modelId).toBe(esqCellRunId("BC-1"));
    expect(run.snapshot).toEqual({
      id: esqCellRunId("BC-1"),
      methodType: "LOAD_CAPACITY",
      revision: 6,
      unit: "C",
      load,
      capacity: { law: { family: "NORMAL", mean: 1800, standardDeviation: 60 }, fields: [{ field: "standardDeviation", value: quantity({ family: "UNIFORM", lower: 40, upper: 80 }) }] },
      uncertaintyParameters: [{ reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: DA, entityId: "P-HEAT" }, expression: { node: "VALUE", value: { unit: "FACTOR", law: { family: "UNIFORM", lower: 0.9, upper: 1.1 } } } }],
      uncertaintyVectors: [],
    });
    const result = loadCapacity(run.snapshot);
    expect(result["method"]).toBe("CLOSED_FORM_NORMAL");
    expect(result["uncertainty"]).toMatchObject({ samples: 400, law: { family: "TABULATED", scale: "LINEAR" } });
  });

  it("takes a side from DA and fits a fragility in PRAXIS", async () => {
    const esq = workbook([
      cell("BC-1", { unit: "h", capacity: { source: "DA", parameterId: "P-WIN", basis: "" }, load: { source: "TYPED", variable: { law: { family: "POINT", value: 24 }, fields: [] }, basis: "" } }),
      cell("BC-2", { unit: "", hazardGroup: "Seismic events", load: { source: "TYPED", variable: { law: { family: "POINT", value: 0.75 }, fields: [] }, basis: "" }, capacity: { source: "FRAGILITY", fragility: { median: 2.08, betaR: 0.23, betaU: 0.3 }, basis: "" } }),
      cell("BC-3", { unit: "g", load: { source: "TYPED", variable: { law: { family: "POINT", value: 1.5 }, fields: [] }, basis: "" }, capacity: { source: "FRAGILITY", fragility: { median: 2.08, betaR: 0.23, betaU: 0 }, basis: "" } }),
    ]);
    const window = await buildEsqCellRun({ esq, cellId: "BC-1", esqRevision: 2 }, praxis);
    expect(window.snapshot["capacity"]).toEqual({ law: { family: "LOGNORMAL", mean: 33.74468539677077, errorFactor: 1.287, level: 0.95 }, fields: [] });
    const hazard = (await buildEsqCellRun({ esq, cellId: "BC-2", esqRevision: 2 }, praxis)).snapshot;
    expect(hazard["unit"]).toBeUndefined();
    const capacity = hazard["capacity"];
    expect(capacity).toMatchObject({ law: { family: "LOGNORMAL", level: 0.95 }, fields: [{ field: "mean" }] });
    const field = typeof capacity === "object" && capacity !== null && "fields" in capacity && Array.isArray(capacity.fields) ? capacity.fields[0] : undefined;
    const scaled: UncertainExpression | undefined = field?.value;
    const median = scaled?.node === "OPERATION" ? scaled.operands[0] : undefined;
    if (median === undefined) throw new Error("The fragility gave no uncertain median.");
    const sampled = loadCapacity(hazard);
    expect(sampled["method"]).toBe("POINT_LOAD");
    const plugIn = pointOf({ node: "MODEL", model: { form: "FRAGILITY", median, randomness: quantity({ family: "POINT", value: 0.23 }), demand: quantity({ family: "POINT", value: 0.75 }) } });
    expect(Math.abs(Number(sampled["pointProbability"]) - plugIn) / plugIn).toBeLessThan(1e-12);
    const fixed = (await buildEsqCellRun({ esq, cellId: "BC-3", esqRevision: 2 }, praxis)).snapshot;
    expect(fixed["capacity"]).toMatchObject({ fields: [] });
    const exact = pointOf({ node: "MODEL", model: { form: "FRAGILITY", median: quantity({ family: "POINT", value: 2.08 }), randomness: quantity({ family: "POINT", value: 0.23 }), demand: quantity({ family: "POINT", value: 1.5 }) } });
    const point = loadCapacity(fixed)["pointProbability"];
    expect(typeof point).toBe("number");
    expect(Math.abs(Number(point) - exact) / exact).toBeLessThan(1e-12);
  });

  it("names the problem before a run", async () => {
    const esq = workbook([
      cell("BC-1", { capacity: { source: "DA", parameterId: "P-RATE", basis: "" } }),
      cell("BC-2", { load: { source: "TYPED", variable: { law: { family: "UNIFORM", lower: 5, upper: 10 }, fields: [{ field: "median", value: quantity({ family: "POINT", value: 7 }) }] }, basis: "" } }),
      cell("BC-3", { capacity: { source: "DA", parameterId: "P-MIX", basis: "" } }),
      cell("BC-4", { load: { source: "TYPED", variable: { law: { family: "POINT", value: 40 }, fields: [{ field: "value", value: { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 40 } } } }] }, basis: "" } }),
      cell("BC-5", { capacity: undefined }),
      cell("BC-6", { load: { source: "TYPED", variable: { law: { family: "POINT", value: 40 }, fields: [{ field: "value", value: { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "other", entityId: "P-HEAT" } } }] }, basis: "" } }),
    ]);
    expect(await buildError(() => buildEsqCellRun({ esq, cellId: "BC-9", esqRevision: 1 }, praxis))).toBe("Cell BC-9 is not in Step 04.");
    expect(await buildError(() => buildEsqCellRun({ esq, cellId: "BC-1", esqRevision: 1 }, praxis))).toBe("BC-1: The capacity takes Rate, which has no estimate in DA.");
    expect(await buildError(() => buildEsqCellRun({ esq, cellId: "BC-2", esqRevision: 1 }, praxis))).toBe("BC-2: The load law has no field median to make uncertain.");
    expect(await buildError(() => buildEsqCellRun({ esq, cellId: "BC-3", esqRevision: 1 }, praxis))).toBe("BC-3: The capacity takes Mixed, whose DA estimate is not one law.");
    expect(await buildError(() => buildEsqCellRun({ esq, cellId: "BC-4", esqRevision: 1 }, praxis))).toBe("BC-4: The load field value is typed per time or in time units. Type it as a quantity in the cell unit.");
    expect(await buildError(() => buildEsqCellRun({ esq, cellId: "BC-5", esqRevision: 1 }, praxis))).toBe("BC-5: The cell has no capacity.");
    expect(await buildError(() => buildEsqCellRun({ esq, cellId: "BC-6", esqRevision: 1 }, praxis))).toBe("BC-6: The load reads P-HEAT from a workbook that Step 01 does not link as DA.");
  });
});
