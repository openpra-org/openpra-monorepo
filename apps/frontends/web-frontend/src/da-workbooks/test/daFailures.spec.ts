import type { DaBasicEventNeed, DataAnalysis, DataAnalysisParameter, DaEvidence } from "interfaces-mef-types/da/data-analysis";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { DA_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed-htgr";
import { DA_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { praxisUncertainty, settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";
import { estimateSummary, failureFindings, failureParameters, parameterEstimate, withEstimates } from "../daFailures";
import { parameterPoint, parameterSpread, readyNumber } from "../daLaws";
import { linkScExamples } from "./daScExamples";

jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

const CIRCULATOR_PRIOR_RATE = 0.5 / ((90.5 / 1570000) * 2.39710255853434);

const CIRCULATOR_HOURS = 253886;

linkScExamples();

beforeEach(() => {
  jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
});

function close(actual: number | undefined, expected: number, tolerance = 1e-6): void {
  expect(actual).toBeDefined();
  expect(Math.abs((actual ?? 0) - expected) / Math.abs(expected)).toBeLessThan(tolerance);
}

function parameterOf(da: DataAnalysis, id: string): DataAnalysisParameter {
  const parameter = da.parameters.find((candidate) => candidate.uuid === id);
  if (parameter === undefined) throw new Error(id);
  return parameter;
}

function withParameter(da: DataAnalysis, id: string, next: Partial<DataAnalysisParameter>): DataAnalysis {
  return { ...da, parameters: da.parameters.map((parameter) => (parameter.uuid === id ? { ...parameter, ...next } : parameter)) };
}

function withRecord(da: DataAnalysis, recordId: string, next: Partial<NonNullable<DataAnalysis["recordSets"]>[number]["records"][number]>): DataAnalysis {
  return { ...da, recordSets: (da.recordSets ?? []).map((set) => ({ ...set, records: set.records.map((record) => (record.id === recordId ? { ...record, ...next } : record)) })) };
}

function checks(da: DataAnalysis): Promise<string[]> {
  return settledWithPraxis(() => failureFindings(da).map((finding) => `${finding.severity}:${finding.check}:${finding.item}`));
}

function missionPoint(shape: number, rate: number, hours: number): number {
  return -Math.expm1((-hours * shape) / rate);
}

describe("component failure estimates", () => {
  it("keeps both examples in step with their inputs, with notes only", async () => {
    for (const da of [DA_ANALYSIS_HTGR, DA_ANALYSIS]) {
      expect(await settledWithPraxis(() => withEstimates(da))).toBe(da);
      expect((await settledWithPraxis(() => failureFindings(da))).filter((finding) => finding.severity !== "note")).toEqual([]);
      expect(failureParameters(da).every((parameter) => parameter.valueMode === "CALCULATED" && parameter.estimate !== undefined && parameter.value === undefined)).toBe(true);
    }
    const circulator = await settledWithPraxis(() => parameterEstimate(DA_ANALYSIS_HTGR, parameterOf(DA_ANALYSIS_HTGR, "DA-BE-205")));
    expect(circulator.terms).toEqual([{ likelihood: "POISSON", failures: 2, exposure: CIRCULATOR_HOURS }]);
    expect(circulator.computation).toBe("POSTERIOR");
    expect(circulator.prior).toEqual({ family: "GAMMA", shape: 0.5, rate: expect.closeTo(CIRCULATOR_PRIOR_RATE, 9) });
    const posterior = await settledWithPraxis(() => estimateSummary(circulator));
    if (posterior?.status !== "ready") throw new Error("PRAXIS gave no posterior.");
    close(posterior.value.mean, 2.5 / (CIRCULATOR_PRIOR_RATE + CIRCULATOR_HOURS), 1e-9);
    const point = await settledWithPraxis(() => readyNumber(parameterPoint(parameterOf(DA_ANALYSIS_HTGR, "DA-BE-205"))));
    close(point, missionPoint(2.5, CIRCULATOR_PRIOR_RATE + CIRCULATOR_HOURS, 24), 1e-9);
    const spread = await settledWithPraxis(() => parameterSpread(parameterOf(DA_ANALYSIS_HTGR, "DA-BE-205")));
    if (spread?.status !== "ready") throw new Error("PRAXIS gave no spread.");
    const b = CIRCULATOR_PRIOR_RATE + CIRCULATOR_HOURS;
    expect(spread.value.sampled).toBe(true);
    close(spread.value.mean, 1 - (b / (b + 24)) ** 2.5, 5e-3);
    const module = await settledWithPraxis(() => parameterEstimate(DA_ANALYSIS, parameterOf(DA_ANALYSIS, "DA-BE-082")));
    expect(module.computation).toBe("POSTERIOR");
    close(module.terms[0]?.exposure, 975000 / 1095);
  }, 120_000);

  it("counts judged records and recomputes the stored estimate when a judgment changes", async () => {
    const changed = await settledWithPraxis(() => withEstimates(withRecord(DA_ANALYSIS_HTGR, "R-12", { judgment: "FAILURE" })));
    const estimate = parameterEstimate(changed, parameterOf(changed, "DA-BE-205"));
    expect(estimate.terms[0]?.failures).toBe(3);
    const point = await settledWithPraxis(() => readyNumber(parameterPoint(parameterOf(changed, "DA-BE-205"))));
    close(point, missionPoint(3.5, CIRCULATOR_PRIOR_RATE + CIRCULATOR_HOURS, 24), 1e-9);
    const unexplained = withRecord(DA_ANALYSIS_HTGR, "R-03", { judgment: "OPEN" });
    expect(await checks(unexplained)).toContain("warning:Not judged:RS-01");
    const repeat = withRecord(DA_ANALYSIS_HTGR, "R-05", { judgment: "REPEAT", repeatOf: undefined });
    expect(await checks(repeat)).toContain("error:Repeat of what:RS-01 · R-05");
  });

  it("flags a conflicting prior, unused evidence and evidence counted twice", async () => {
    const published = withParameter(DA_ANALYSIS_HTGR, "DA-BE-205", { priorForm: undefined, priorFormReason: undefined, estimateReason: undefined });
    expect(await checks(published)).toContain("warning:Prior and evidence conflict:DA-BE-205");
    const unused = withParameter(DA_ANALYSIS_HTGR, "DA-BE-205", { estimateMethod: "PRIOR" });
    expect(await checks(unused)).toContain("error:Evidence not used:DA-BE-205");
    const module = parameterOf(DA_ANALYSIS, "DA-BE-082");
    const twice: DaEvidence = { id: "EV-2", origin: "TECHNOLOGY", failuresFrom: "TYPED", exposureFrom: "TYPED", failures: 0, exposure: 1e5, unit: "HOURS", hoursPerDemand: 1095, sourceId: "SRC-04", entryId: "SCR-FA-I", boundary: "SAME", reason: "Test", included: true };
    const doubled = withParameter(DA_ANALYSIS, "DA-BE-082", { evidence: [...(module.evidence ?? []), twice] });
    expect(await checks(doubled)).toContain("error:Counted twice:DA-BE-082");
    const population = withParameter(DA_ANALYSIS, "DA-BE-082", { estimateMethod: "POPULATION" });
    expect(await checks(population)).toContain("error:Cannot estimate:DA-BE-082");
  });

  it("turns hours into demands for a per-demand parameter and refuses demands for a rate", async () => {
    const circulator = parameterOf(DA_ANALYSIS_HTGR, "DA-BE-205");
    const demands = withParameter(DA_ANALYSIS_HTGR, "DA-BE-205", { evidence: (circulator.evidence ?? []).map((item) => ({ ...item, exposureFrom: "TYPED" as const, unit: "DEMANDS" as const })) });
    const estimate = await settledWithPraxis(() => parameterEstimate(demands, parameterOf(demands, "DA-BE-205")));
    expect(estimate.evidence[0]?.problem).toBe("Failures in demands cannot update a rate per hour.");
    expect(await checks(demands)).toContain("error:Evidence incomplete:DA-BE-205");
  });

  it("rebuilds a calculated mission estimate on the mission time its basic events hand over", async () => {
    const link: UncertainExpression = { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "example-sc-htgr", entityId: "MT-INGRESS" } };
    const need: DaBasicEventNeed = { id: "BE-207", code: "SCS-HX-FOUL", name: "Shutdown cooler fouled", included: true, importedKind: "RUNNING", kind: "RUNNING", importedMissionTime: link, missionTime: link, parameterId: "DA-BE-207" };
    const needs = (basicEvents: DaBasicEventNeed[]): DataAnalysis["dataNeeds"] => ({ importedAt: "2026-10-09T00:00:00.000Z", sources: [], basicEvents, initiators: [], humanErrors: [], ccfGroups: [], states: [] });
    const stripped = withParameter(DA_ANALYSIS_HTGR, "DA-BE-207", { estimate: undefined });
    const recalculated = await settledWithPraxis(() => withEstimates({ ...stripped, dataNeeds: needs([need]) }));
    const estimate = parameterOf(recalculated, "DA-BE-207").estimate;
    if (estimate?.node !== "MODEL" || estimate.model.form !== "MISSION") throw new Error("DA gave no mission estimate.");
    expect(estimate.model.missionTime).toEqual(link);
    const typed = withParameter(recalculated, "DA-BE-207", { estimate: { node: "MODEL", model: { ...estimate.model, missionTime: { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 24 } } } } } });
    const linkedPoint = await settledWithPraxis(() => readyNumber(parameterPoint(parameterOf(recalculated, "DA-BE-207"))));
    const typedPoint = await settledWithPraxis(() => readyNumber(parameterPoint(parameterOf(typed, "DA-BE-207"))));
    close(linkedPoint, typedPoint ?? Number.NaN, 1e-12);
    const unmapped = { ...stripped, dataNeeds: needs([]) };
    expect((await settledWithPraxis(() => parameterEstimate(unmapped, parameterOf(unmapped, "DA-BE-207")))).problem).toBe("Map a basic event to this parameter. Its mission time sets the mission of the estimate.");
    const split = { ...stripped, dataNeeds: needs([need, { ...need, id: "BE-207B", code: "SCS-HX-FOUL-B", missionTime: { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 1 } } } }]) };
    expect((await settledWithPraxis(() => parameterEstimate(split, parameterOf(split, "DA-BE-207")))).problem).toBe("The basic events mapped to this parameter have different mission times. Align them in Step 02 or split the parameter.");
    expect(await settledWithPraxis(() => withEstimates(unmapped))).toBe(unmapped);
  });

  it("keeps the mission time a calculated estimate already links", async () => {
    const link: UncertainExpression = { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "example-sc-htgr", entityId: "MT-DLOFC" } };
    const need: DaBasicEventNeed = { id: "BE-205", code: "SCS-TRA-FR", name: "Shutdown-cooling circulator fails to run", included: true, importedKind: "RUNNING", kind: "RUNNING", importedMissionTime: link, missionTime: link, parameterId: "DA-BE-205" };
    const da: DataAnalysis = { ...DA_ANALYSIS_HTGR, dataNeeds: { importedAt: "2026-10-09T00:00:00.000Z", sources: [], basicEvents: [need], initiators: [], humanErrors: [], ccfGroups: [], states: [] } };
    expect(await settledWithPraxis(() => withEstimates(da))).toBe(da);
    const estimate = parameterOf(da, "DA-BE-205").estimate;
    expect(estimate?.node === "MODEL" && estimate.model.form === "MISSION" ? estimate.model.missionTime : undefined).toEqual({ node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "example-sc-htgr", entityId: "CMT-2" } });
  });

  it("counts a mission as the hours of its linked mission time in a per-mission update", async () => {
    const link: UncertainExpression = { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "example-sc-htgr", entityId: "MT-DLOFC" } };
    const evidence: DaEvidence[] = [
      { id: "EV-D", origin: "TECHNOLOGY", label: "Demands", failuresFrom: "TYPED", exposureFrom: "TYPED", failures: 1, exposure: 100, unit: "DEMANDS", boundary: "SAME", reason: "Start tests.", included: true },
      { id: "EV-H", origin: "TECHNOLOGY", label: "Hours", failuresFrom: "TYPED", exposureFrom: "TYPED", failures: 0, exposure: 7200, unit: "HOURS", boundary: "SAME", reason: "Run hours.", included: true },
    ];
    const need: DaBasicEventNeed = { id: "BE-207", code: "SCS-HX-FOUL", name: "Shutdown cooler fouled", included: true, importedKind: "RUNNING", kind: "RUNNING", importedMissionTime: link, missionTime: link, parameterId: "DA-BE-207" };
    const da = { ...withParameter(DA_ANALYSIS_HTGR, "DA-BE-207", { priorForm: "JEFFREYS", estimateMethod: "BAYES", evidence }), dataNeeds: { importedAt: "2026-10-09T00:00:00.000Z", sources: [], basicEvents: [need], initiators: [], humanErrors: [], ccfGroups: [], states: [] } };
    const estimate = await settledWithPraxis(() => parameterEstimate(da, parameterOf(da, "DA-BE-207")));
    expect(estimate.scale).toBe("PROBABILITY");
    expect(estimate.terms).toEqual([{ likelihood: "BINOMIAL", failures: 1, exposure: 100 }, { likelihood: "POISSON", failures: 0, exposure: 100 }]);
    expect(estimate.missionTime).toBeUndefined();
  });

  it("totals planned demands over the data window for plant records, and limits old data", async () => {
    const operating: DataAnalysis = {
      ...DA_ANALYSIS_HTGR,
      plantStage: "OPERATIONAL",
      dataPlan: { ...DA_ANALYSIS_HTGR.dataPlan, dataWindowStart: "2019-01-01", dataWindowEnd: "2025-01-01" },
      demandCounts: (DA_ANALYSIS_HTGR.demandCounts ?? []).map((row) => ({ ...row, basis: "ANNUALIZED_PLAN" as const })),
    };
    const plant: DaEvidence = { id: "EV-1", origin: "PLANT_RECORDS", failuresFrom: "TYPED", exposureFrom: "DEMANDS_AND_HOURS", failures: 1, boundary: "SAME", reason: "This plant's own valve strokes", included: true };
    const valve = withParameter(operating, "DA-BE-213", { estimateMethod: "BAYES", evidence: [plant] });
    const estimate = await settledWithPraxis(() => parameterEstimate(valve, parameterOf(valve, "DA-BE-213")));
    const years = (Date.parse("2025-01-01") - Date.parse("2019-01-01")) / (365.25 * 24 * 3600 * 1000);
    const strokes = (DA_ANALYSIS_HTGR.demandCounts ?? []).filter((row) => row.groupId === parameterOf(valve, "DA-BE-213").componentGroupRef && row.failureModeIds.includes("FM-FTC")).reduce((total, row) => total + row.count, 0);
    close(estimate.terms[0]?.exposure, strokes * years);
    expect(estimate.terms[0]?.likelihood).toBe("BINOMIAL");
    expect(await checks(valve)).toContain("warning:Annualized plan:DM-09");
    const discarded: DataAnalysis = { ...DA_ANALYSIS_HTGR, dataModificationAdjustments: (DA_ANALYSIS_HTGR.dataModificationAdjustments ?? []).map((change) => (change.uuid === "DMOD-1" ? { ...change, pastDataDisposition: "DISCARDED" as const } : change)) };
    expect(await checks(discarded)).toContain("warning:Before a design change:RS-01 · R-14");
  });

  it("checks typed estimates for a distribution and a basis", async () => {
    const typed = withParameter(DA_ANALYSIS_HTGR, "DA-BE-207", { valueMode: "TYPED", estimateMethod: undefined, estimate: { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value: 2e-4 } } }, estimateReason: undefined });
    const found = await checks(typed);
    expect(found).toContain("warning:No uncertainty:DA-BE-207");
    expect(found).toContain("warning:No basis:DA-BE-207");
    expect(await settledWithPraxis(() => withEstimates(typed))).toBe(typed);
  });
});
