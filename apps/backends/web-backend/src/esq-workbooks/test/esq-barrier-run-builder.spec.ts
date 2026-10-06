import type { EsqCell, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { DistributionType } from "interfaces-mef-types/core/events";
import { esqCellRunId } from "interfaces-mef-types/esq/esq-barrier-inputs";
import { createBlankEsq } from "../blank-esq";
import { buildEsqCellRun } from "../esq-barrier-run-builder";
import { EsqRunBuildError } from "../esq-model-run-builder";

const Z95 = 1.6448536269514722;

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
    load: { distribution: { type: DistributionType.NORMAL, mean: 1500, stdDev: 50 }, basis: "Heat-up runs." },
    capacity: { distribution: { type: DistributionType.NORMAL, mean: 1800, stdDev: 60 }, basis: "Heating tests." },
    use: "SPLIT_FRACTION",
    ...extra,
  };
}

function workbook(cells: EsqCell[]): EventSequenceQuantification {
  const esq = createBlankEsq("ESQ", "analyst");
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
      { id: "P-WIN", name: "Window", parameterType: "OTHER", valueType: "POINT_ESTIMATE", value: 33.35, distribution: { type: DistributionType.LOGNORMAL, median: 33.35, errorFactor: 1.287 } },
      { id: "P-RATE", name: "Rate", parameterType: "FAILURE_RATE", valueType: "MEAN", value: 1e-5 },
    ],
    humanEvents: [],
  };
  esq.barrierWork = { cells };
  return esq;
}

function buildError(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof EsqRunBuildError) return error.message;
    throw error;
  }
  throw new Error("expected an ESQ run build error");
}

describe("ESQ load and capacity run builder", () => {
  it("writes a typed cell as a load-capacity snapshot with trimmed correlation keys", () => {
    const esq = workbook([cell("BC-1", {
      load: { distribution: { type: DistributionType.NORMAL, mean: 1500, stdDev: 50 }, uncertain: [{ parameter: "mean", distribution: { type: DistributionType.NORMAL, mean: 1500, stdDev: 20 }, correlationKey: " decay heat " }], basis: "" },
      capacity: { distribution: { type: DistributionType.NORMAL, mean: 1800, stdDev: 60 }, uncertain: [{ parameter: "stdDev", distribution: { type: DistributionType.UNIFORM, lower: 40, upper: 80 }, correlationKey: "  " }], basis: "" },
    })]);
    const run = buildEsqCellRun({ esq, cellId: "BC-1", esqRevision: 6 });
    expect(run.modelId).toBe(esqCellRunId("BC-1"));
    expect(run.snapshot).toEqual({
      id: esqCellRunId("BC-1"),
      methodType: "LOAD_CAPACITY",
      revision: 6,
      unit: "C",
      load: { distribution: { type: "normal", mean: 1500, stdDev: 50 }, uncertainParameters: [{ parameter: "mean", distribution: { type: "normal", mean: 1500, stdDev: 20 }, correlationKey: "decay heat" }] },
      capacity: { distribution: { type: "normal", mean: 1800, stdDev: 60 }, uncertainParameters: [{ parameter: "stdDev", distribution: { type: "uniform", lower: 40, upper: 80 } }] },
    });
  });

  it("takes a side from DA and turns a fragility into a lognormal with an uncertain median", () => {
    const esq = workbook([
      cell("BC-1", { unit: "h", capacity: { parameterId: "P-WIN", basis: "" }, load: { distribution: { type: DistributionType.POINT_ESTIMATE, value: 48 }, basis: "" } }),
      cell("BC-2", { unit: "", hazardGroup: "Seismic events", load: { distribution: { type: DistributionType.UNIFORM, lower: 0.5, upper: 1 }, basis: "" }, capacity: { fragility: { median: 2.08, betaR: 0.23, betaU: 0.3 }, basis: "" } }),
    ]);
    expect(buildEsqCellRun({ esq, cellId: "BC-1", esqRevision: 2 }).snapshot["capacity"]).toEqual({ distribution: { type: "lognormal", median: 33.35, errorFactor: 1.287 }, uncertainParameters: [] });
    const hazard = buildEsqCellRun({ esq, cellId: "BC-2", esqRevision: 2 }).snapshot;
    expect(hazard["unit"]).toBeUndefined();
    expect(hazard["capacity"]).toEqual({
      distribution: { type: "lognormal", median: 2.08, errorFactor: Math.exp(Z95 * 0.23) },
      uncertainParameters: [{ parameter: "median", distribution: { type: "lognormal", median: 2.08, errorFactor: Math.exp(Z95 * 0.3) } }],
    });
  });

  it("names the problem before a run", () => {
    const esq = workbook([
      cell("BC-1", { capacity: { parameterId: "P-RATE", basis: "" } }),
      cell("BC-2", { load: { distribution: { type: DistributionType.UNIFORM, lower: 10, upper: 5 }, basis: "" } }),
    ]);
    expect(buildError(() => buildEsqCellRun({ esq, cellId: "BC-9", esqRevision: 1 }))).toBe("Cell BC-9 is not in Step 04.");
    expect(buildError(() => buildEsqCellRun({ esq, cellId: "BC-1", esqRevision: 1 }))).toBe("BC-1: Capacity takes P-RATE, which has no distribution PRAXIS can integrate.");
    expect(buildError(() => buildEsqCellRun({ esq, cellId: "BC-2", esqRevision: 1 }))).toBe("BC-2: Load has its upper bound below the lower bound.");
  });
});
