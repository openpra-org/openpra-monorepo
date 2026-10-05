import type { DataAnalysis, DataAnalysisParameter, DaEvidence } from "interfaces-mef-types/da/data-analysis";
import { DA_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed-htgr";
import { DA_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed";
import { failureFindings, failureParameters, parameterEstimate, withEstimates } from "../daFailures";

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

function checks(da: DataAnalysis): string[] {
  return failureFindings(da).map((finding) => `${finding.severity}:${finding.check}:${finding.item}`);
}

describe("component failure estimates", () => {
  it("keeps both examples in step with their inputs, with notes only", () => {
    for (const da of [DA_ANALYSIS_HTGR, DA_ANALYSIS]) {
      expect(withEstimates(da)).toBe(da);
      expect(failureFindings(da).filter((finding) => finding.severity !== "note")).toEqual([]);
      expect(failureParameters(da).every((parameter) => parameter.valueMode === "CALCULATED" && parameter.value !== undefined)).toBe(true);
    }
    close(parameterOf(DA_ANALYSIS_HTGR, "DA-BE-205").value, 2.3231949896163585e-4, 1e-9);
    close(parameterOf(DA_ANALYSIS, "DA-BE-082").value, 2.8596371520024487e-4, 1e-9);
    const circulator = parameterEstimate(DA_ANALYSIS_HTGR, parameterOf(DA_ANALYSIS_HTGR, "DA-BE-205"));
    expect(circulator.terms).toEqual([{ kind: "POISSON", failures: 2, exposure: 253886 }]);
    expect(circulator.computation).toBe("CONJUGATE");
    expect(circulator.output?.fit).toBe("RARE_EVENT");
    const module = parameterEstimate(DA_ANALYSIS, parameterOf(DA_ANALYSIS, "DA-BE-082"));
    expect(module.computation).toBe("NUMERICAL");
    close(module.terms[0]?.exposure, 975000 / 1095);
  });

  it("counts judged records and recomputes the stored estimate when a judgment changes", () => {
    const changed = withEstimates(withRecord(DA_ANALYSIS_HTGR, "R-12", { judgment: "FAILURE" }));
    const estimate = parameterEstimate(changed, parameterOf(changed, "DA-BE-205"));
    expect(estimate.terms[0]?.failures).toBe(3);
    const rate = 0.5 / (90.5 / 785000);
    const a = 3.5;
    const b = rate + 253886;
    close(parameterOf(changed, "DA-BE-205").value, 1 - (b / (b + 24)) ** a, 1e-4);
    const unexplained = withRecord(DA_ANALYSIS_HTGR, "R-03", { judgment: "OPEN" });
    expect(checks(unexplained)).toContain("warning:Not judged:RS-01");
    const repeat = withRecord(DA_ANALYSIS_HTGR, "R-05", { judgment: "REPEAT", repeatOf: undefined });
    expect(checks(repeat)).toContain("error:Repeat of what:RS-01 · R-05");
  });

  it("flags a conflicting prior, unused evidence and evidence counted twice", () => {
    const published = withParameter(DA_ANALYSIS_HTGR, "DA-BE-205", { priorForm: undefined, priorFormReason: undefined, estimateReason: undefined });
    expect(checks(published)).toContain("warning:Prior and evidence conflict:DA-BE-205");
    const unused = withParameter(DA_ANALYSIS_HTGR, "DA-BE-205", { estimateMethod: "PRIOR" });
    expect(checks(unused)).toContain("error:Evidence not used:DA-BE-205");
    const module = parameterOf(DA_ANALYSIS, "DA-BE-082");
    const twice: DaEvidence = { id: "EV-2", origin: "TECHNOLOGY", failuresFrom: "TYPED", exposureFrom: "TYPED", failures: 0, exposure: 1e5, unit: "HOURS", hoursPerDemand: 1095, sourceId: "SRC-04", entryId: "SCR-FA-I", boundary: "SAME", reason: "Test", included: true };
    const doubled = withParameter(DA_ANALYSIS, "DA-BE-082", { evidence: [...(module.evidence ?? []), twice] });
    expect(checks(doubled)).toContain("error:Counted twice:DA-BE-082");
    const population = withParameter(DA_ANALYSIS, "DA-BE-082", { estimateMethod: "POPULATION" });
    expect(checks(population)).toContain("error:Cannot estimate:DA-BE-082");
  });

  it("turns hours into demands for a per-demand parameter and refuses demands for a rate", () => {
    const circulator = parameterOf(DA_ANALYSIS_HTGR, "DA-BE-205");
    const demands = withParameter(DA_ANALYSIS_HTGR, "DA-BE-205", { evidence: (circulator.evidence ?? []).map((item) => ({ ...item, exposureFrom: "TYPED" as const, unit: "DEMANDS" as const })) });
    const estimate = parameterEstimate(demands, parameterOf(demands, "DA-BE-205"));
    expect(estimate.evidence[0]?.problem).toBe("Failures in demands cannot update a rate per hour.");
    expect(checks(demands)).toContain("error:Evidence incomplete:DA-BE-205");
  });

  it("totals planned demands over the data window for plant records, and limits old data", () => {
    const operating: DataAnalysis = {
      ...DA_ANALYSIS_HTGR,
      plantStage: "OPERATIONAL",
      dataPlan: { ...DA_ANALYSIS_HTGR.dataPlan, dataWindowStart: "2019-01-01", dataWindowEnd: "2025-01-01" },
      demandCounts: (DA_ANALYSIS_HTGR.demandCounts ?? []).map((row) => ({ ...row, basis: "ANNUALIZED_PLAN" as const })),
    };
    const plant: DaEvidence = { id: "EV-1", origin: "PLANT_RECORDS", failuresFrom: "TYPED", exposureFrom: "DEMANDS_AND_HOURS", failures: 1, boundary: "SAME", reason: "This plant's own valve strokes", included: true };
    const valve = withParameter(operating, "DA-BE-213", { estimateMethod: "BAYES", evidence: [plant] });
    const estimate = parameterEstimate(valve, parameterOf(valve, "DA-BE-213"));
    const years = (Date.parse("2025-01-01") - Date.parse("2019-01-01")) / (365.25 * 24 * 3600 * 1000);
    close(estimate.terms[0]?.exposure, 13 * years);
    expect(estimate.terms[0]?.kind).toBe("BINOMIAL");
    expect(checks(valve)).toContain("warning:Annualized plan:DM-09");
    const discarded: DataAnalysis = { ...DA_ANALYSIS_HTGR, dataModificationAdjustments: (DA_ANALYSIS_HTGR.dataModificationAdjustments ?? []).map((change) => (change.uuid === "DMOD-1" ? { ...change, pastDataDisposition: "DISCARDED" as const } : change)) };
    expect(checks(discarded)).toContain("warning:Before a design change:RS-01 · R-14");
  });

  it("checks typed estimates for a distribution and a basis", () => {
    const typed = withParameter(DA_ANALYSIS_HTGR, "DA-BE-207", { valueMode: "TYPED", estimateMethod: undefined, uncertainty: undefined, estimateReason: undefined });
    const found = checks(typed);
    expect(found).toContain("warning:No uncertainty:DA-BE-207");
    expect(found).toContain("warning:No basis:DA-BE-207");
    expect(withEstimates(typed)).toBe(typed);
  });
});
