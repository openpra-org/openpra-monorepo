import { readFileSync } from "fs";
import { resolve } from "path";
import { z } from "zod";
import { daCcfFactorParameters, daCcfVectorParameters, type CcfParameterEstimation, type DataAnalysis, type DaCcfEvidence, type DaCcfGroupNeed, type DaRecordSet, type DaSource, type DaSourceEntry } from "interfaces-mef-types/da/data-analysis";
import { DaSourceEntrySchema, DataAnalysisSchema } from "interfaces-mef-types/zod/da/data-analysis";
import { expressionReferences, type CcfFactorModel, type ParameterExpression, type UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { DA_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed-htgr";
import { DA_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed";
import { SY_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/sy-seed-htgr";
import { SY_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/sy-seed";
import { daImportNeeds } from "../daSelectors";
import { lawSummary } from "../daLaws";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { praxisUncertainty, settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";
import { allFail, ccfComplete, ccfFindings, ccfResult, choose, factorIdOf, pointCoefficients, vectorIdOf, withCcf, withTestingFlipped, type DaCcfResult } from "../daCcf";
import { ccfSurvey, rowIdsFor, sizesFit, type DaCcfSurvey } from "../daCcfRows";
import { linkScExamples } from "./daScExamples";

jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

beforeEach(() => {
  jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
});

const SELF = "da-workbook-test";

const DATASETS = resolve(__dirname, "../../../../../interfaces/mef-types/da");

const EntryList = z.array(DaSourceEntrySchema);

const loaded = new Map<string, DaSourceEntry[]>();

function dataset(file: string): DaSourceEntry[] {
  const cached = loaded.get(file);
  if (cached !== undefined) return cached;
  const entries = EntryList.parse(JSON.parse(readFileSync(resolve(DATASETS, file), "utf8")));
  loaded.set(file, entries);
  return entries;
}

function catalogSource(id: string, catalogId: string, entries: DaSourceEntry[]): DaSource {
  return { id, name: catalogId, catalogId, kind: "GENERIC_NUCLEAR", origin: "OTHER_NUCLEAR", covers: "Test", boundaryConvention: "Test", failureCounting: "Test", quality: "Test", reference: "Test", entries };
}

function close(actual: number | undefined, expected: number, tolerance = 1e-6): void {
  expect(actual).toBeDefined();
  const scale = Math.abs(expected) > 0 ? Math.abs(expected) : 1;
  expect(Math.abs((actual ?? 0) - expected) / scale).toBeLessThan(tolerance);
}

function row(id: string, a: number, b: number, failureMode: string): DaSourceEntry {
  return { id, component: "Motor-driven pump, all systems", failureMode, quantity: "PROBABILITY", table: "Test table", law: { family: "BETA", alpha: a, beta: b, lower: 0, upper: 1 } };
}

const ENTRIES: DaSourceEntry[] = [
  row("PRIOR-C2-A1", 22.4, 0.469, "Fail to start, CCCG 2, alpha 1"),
  row("PRIOR-C2-A2", 0.469, 22.4, "Fail to start, CCCG 2, alpha 2"),
  row("ALL-MDP-FS-C3-A1", 274.7, 2.932, "Fail to start, CCCG 3, alpha 1"),
  row("ALL-MDP-FS-C3-A2", 1.53, 276.1, "Fail to start, CCCG 3, alpha 2"),
  row("ALL-MDP-FS-C3-A3", 1.402, 276.2, "Fail to start, CCCG 3, alpha 3"),
  { id: "ALL-MDP-FS-C3-A2-MLE", component: "Motor-driven pump, all systems", failureMode: "Fail to start, CCCG 3, alpha 2, MLE", quantity: "PROBABILITY", law: { family: "POINT", value: 0.00311 } },
];

const SOURCE: DaSource = { id: "SRC-T", name: "Test factors", kind: "GENERIC_NUCLEAR", origin: "OTHER_NUCLEAR", covers: "Test", boundaryConvention: "Test", failureCounting: "Test", quality: "Test", reference: "Test", entries: ENTRIES };

const RECORDS: DaRecordSet = {
  id: "RS-T",
  name: "Test records",
  origin: "TECHNOLOGY",
  reference: "Test",
  records: [
    { id: "R-1", date: "1980-01", description: "Shared corrosion on all machines", judgment: "FAILURE", parameterId: "DA-P-1", reason: "Counts" },
    { id: "R-2", date: "1981-01", description: "One machine tripped", judgment: "FAILURE", parameterId: "DA-P-1", reason: "Counts" },
    { id: "R-3", date: "1982-01", description: "Drive outside the boundary on all machines", judgment: "EXCLUDED", parameterId: "DA-P-1", reason: "Outside" },
  ],
};

const TEMPLATE = [274.7, 1.53, 1.402];

const QT = 0.002;

function fraction(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "FRACTION", law: { family: "POINT", value } } };
}

function probability(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value } } };
}

function fixedAlphas(values: number[], testing: "STAGGERED" | "NON_STAGGERED"): CcfFactorModel {
  return { model: "ALPHA_FACTOR", testing, alphas: { node: "VALUE", law: { family: "FIXED", values } } };
}

function estimate(next: Partial<CcfParameterEstimation>): CcfParameterEstimation {
  return {
    uuid: "DA-CCF-1",
    ccfGroupReference: "CCF-T",
    groupSize: 3,
    memberParameterId: "DA-P-1",
    testing: "STAGGERED",
    testingReason: "Plan",
    method: "PRIOR",
    priorSourceId: "SRC-T",
    priorTemplate: "ALL-MDP-FS",
    priorReason: "Same pumps",
    parameterSource: "GENERIC",
    componentBoundaryConsistencyBasis: "Same boundary",
    estimateReason: "Basis",
    implementsSrs: [],
    ...next,
  };
}

function analysis(estimates: CcfParameterEstimation[], next: Partial<DataAnalysis> = {}): DataAnalysis {
  const parameter = { uuid: "DA-P-1", name: "Pump fails to start", parameterType: "PROBABILITY" as const, estimate: probability(QT), quantificationModel: "DEMAND_PROBABILITY" as const, valueMode: "TYPED" as const, implementsSrs: [] };
  return { ...DA_ANALYSIS_HTGR, parameters: [parameter], sources: [SOURCE], recordSets: [RECORDS], ccfParameterEstimations: estimates, ccfVectors: undefined, dataNeeds: undefined, ...next };
}

function checks(da: DataAnalysis): Promise<string[]> {
  return settledWithPraxis(() => ccfFindings(da).map((finding) => `${finding.severity}:${finding.check}:${finding.item}`));
}

function details(da: DataAnalysis, check: string): Promise<string[]> {
  return settledWithPraxis(() => ccfFindings(da).filter((finding) => finding.check === check).map((finding) => finding.detail));
}

function estimateOf(da: DataAnalysis, id: string): CcfParameterEstimation {
  const found = (da.ccfParameterEstimations ?? []).find((candidate) => candidate.uuid === id);
  if (found === undefined) throw new Error(`${id} is missing`);
  return found;
}

function concentrationsOf(factors: CcfFactorModel | undefined): number[] {
  if (factors?.model !== "ALPHA_FACTOR" || factors.alphas.node !== "VALUE" || factors.alphas.law.family !== "DIRICHLET") throw new Error("A Dirichlet alpha-factor model is expected.");
  return factors.alphas.law.concentrations;
}

function mglFromAlphas(alphas: readonly number[]): number[] {
  const tails = alphas.map((_, index) => alphas.slice(index).reduce((total, value) => total + value, 0));
  return tails.slice(1).map((tail, index) => tail / (tails[index] ?? 1));
}

async function settledResult(da: DataAnalysis, id: string): Promise<DaCcfResult> {
  return settledWithPraxis(() => ccfResult(da, estimateOf(da, id)));
}

function eachOf(result: DaCcfResult): number[] {
  return result.combinations.map((combination) => combination.each ?? Number.NaN);
}

function surveyOf(id: string, catalogId: string, file: string): { source: DaSource; survey: DaCcfSurvey } {
  const source = catalogSource(id, catalogId, dataset(file));
  return { source, survey: ccfSurvey(source, source.entries) };
}

function expressionLinks(expression: UncertainExpression): string[] {
  return expressionReferences(expression).map((reference) => reference.entityId).sort();
}

function hypergeometricDown(counts: readonly number[], to: number): number[] {
  const from = counts.length;
  return Array.from({ length: to }, (_, index) => {
    const seen = index + 1;
    return counts.reduce((total, count, at) => total + (count * choose(at + 1, seen) * choose(from - at - 1, to - seen)) / choose(from, to), 0);
  });
}

describe("common cause formulas", () => {
  it("reproduces the EPRI staggered walk-through for a group of three", () => {
    const qt = 0.002 / 0.976224;
    const coefficients = pointCoefficients(fixedAlphas([0.976224, 0.0142, 0.00961], "STAGGERED"), [0.976224, 0.0142, 0.00961], 3);
    if (typeof coefficients === "string") throw new Error(coefficients);
    close((coefficients[1] ?? 0) * qt, 1.454584193791589e-5, 1e-12);
    close((coefficients[2] ?? 0) * qt, 1.968810436948897e-5, 1e-12);
  });

  it("expands staggered alpha factors and their MGL equivalent to the same combinations", () => {
    for (const alphas of [[0.98, 0.02], [0.97, 0.02, 0.01], [0.96, 0.02, 0.015, 0.005], [0.95, 0.02, 0.012, 0.01, 0.008]]) {
      const rho = mglFromAlphas(alphas);
      const staggered = pointCoefficients(fixedAlphas(alphas, "STAGGERED"), alphas, alphas.length);
      const mgl = pointCoefficients({ model: "MGL", factors: rho.map(fraction) }, rho, alphas.length);
      if (typeof staggered === "string" || typeof mgl === "string") throw new Error("No coefficients.");
      staggered.forEach((value, index) => close(mgl[index], value, 1e-12));
    }
  });

  it("rebuilds the Dirichlet from the template marginals and keeps the staggered scheme", async () => {
    const da = analysis([estimate({})]);
    const result = await settledWithPraxis(() => ccfResult(da, estimate({})));
    expect(result.factors).toEqual({ model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: { node: "VALUE", law: { family: "DIRICHLET", concentrations: TEMPLATE } } });
    close(result.levels[0]?.mean, 274.7 / 277.632, 1e-12);
    close(result.combinations[2]?.each, 0.002 * (1.402 / 277.632), 1e-9);
  });

  it("gives each alpha the beta marginal of the Dirichlet, with the closed-form mean and variance", async () => {
    const da = analysis([estimate({})]);
    const result = await settledWithPraxis(() => ccfResult(da, estimate({})));
    const total = TEMPLATE.reduce((sum, value) => sum + value, 0);
    for (const [index, level] of result.levels.entries()) {
      const own = TEMPLATE[index] ?? 0;
      expect(level.law).toEqual({ family: "BETA", alpha: own, beta: total - own, lower: 0, upper: 1 });
      const law = level.law;
      if (law === undefined) throw new Error("No marginal.");
      const summary = await settledWithPraxis(() => lawSummary("FRACTION", law, true));
      if (summary.status !== "ready") throw new Error("PRAXIS gave no summary.");
      close(summary.value.mean, own / total, 1e-12);
      close(summary.value.standardDeviation ?? 0, Math.sqrt((own * (total - own)) / (total * total * (total + 1))), 1e-9);
      close(level.mean, own / total, 1e-12);
    }
  });

  it("rebuilds the report's own 2006 to 2020 update from the 2015 prior as an exact conjugate update", async () => {
    const events = Array.from({ length: 4 }, (_, index) => ({ id: `E-${index + 1}`, impact: [0.4494, 0.3378], included: true, reason: "Coded event" }));
    const updated = estimate({ groupSize: 2, method: "BAYES", testing: "NON_STAGGERED", priorTemplate: "PRIOR", evidence: [{ id: "EV-1", origin: "TECHNOLOGY", population: 4.75, independentFailures: 339.9, events, boundary: "SAME", reason: "Industry data", included: true }] });
    const da = analysis([updated]);
    const result = await settledWithPraxis(() => ccfResult(da, updated));
    const concentrations = concentrationsOf(result.factors);
    close(concentrations[0], 167.3133894736842, 1e-9);
    close(concentrations[1], 1.8202, 1e-9);
    close(result.levels[1]?.mean, 0.010761907233590688, 1e-9);
    close(result.levels[1]?.p05, 0.0017022971033590142, 1e-4);
    close(result.levels[1]?.p95, 0.026179147340437053, 1e-4);
    close(result.levels[1]?.prior, 0.469 / 22.869, 1e-12);
  });

  it("flips the testing scheme of the factor model for a sensitivity case", async () => {
    const staggered = estimate({});
    const flipped = withTestingFlipped(staggered, "NON_STAGGERED");
    if (typeof flipped === "string") throw new Error(flipped);
    const da = analysis([flipped]);
    const result = await settledWithPraxis(() => ccfResult(da, flipped));
    expect(result.factors?.model === "ALPHA_FACTOR" ? result.factors.testing : undefined).toBe("NON_STAGGERED");
    const total = TEMPLATE.reduce((sum, value) => sum + value, 0);
    const weighted = TEMPLATE.reduce((sum, value, index) => sum + ((index + 1) * value) / total, 0);
    const after = await settledWithPraxis(() => allFail(da, flipped));
    if (typeof after === "string" || after.status !== "ready") throw new Error("No all-fail value.");
    close(after.value, (0.002 * 3 * (1.402 / total)) / weighted, 1e-9);
    expect(withTestingFlipped(estimate({ method: "TYPED", factors: { model: "BETA_FACTOR", beta: fraction(0.05) } }), "NON_STAGGERED")).toBe("Only alpha factors depend on the testing scheme.");
    expect(withTestingFlipped(estimate({ priorKind: "MGL", priorTemplate: "ALL-MDP-FS" }), "NON_STAGGERED")).toBe("Only alpha factors depend on the testing scheme.");
    const typed = withTestingFlipped(estimate({ method: "TYPED", factors: fixedAlphas([0.98, 0.01, 0.01], "STAGGERED") }), "NON_STAGGERED");
    expect(typeof typed === "string" ? typed : typed.factors).toEqual(fixedAlphas([0.98, 0.01, 0.01], "NON_STAGGERED"));
  });
});

describe("dataset rows for common cause", () => {
  it("lists every CCF 2020 row as a set DA imports or as a row with a reason", () => {
    const { source, survey } = surveyOf("SRC-CCF", "CCF-2020", "source-ccf-2020.json");
    const used = new Set<string>();
    for (const choice of survey.choices) {
      const sizes = Array.isArray(choice.sizes) ? choice.sizes : [];
      for (const size of sizes) for (const id of rowIdsFor(choice.kind, choice.template, size, source.entries)) used.add(id);
    }
    for (const evidence of survey.evidence) for (const count of evidence.counts) used.add(count.rowId);
    const unusable = new Set(survey.unusable.map((item) => item.rowId));
    const silent = source.entries.filter((entry) => !used.has(entry.id) && !unusable.has(entry.id));
    expect(silent.map((entry) => entry.id)).toEqual([]);
    expect(survey.unusable.every((item) => item.reason.length > 0)).toBe(true);
    const reasons = new Map<string, number>();
    for (const item of survey.unusable) reasons.set(item.reason, (reasons.get(item.reason) ?? 0) + 1);
    expect([...reasons.values()].reduce((total, count) => total + count, 0)).toBe(10 + 536 + 42 + 3 + 70);
    expect(source.entries.filter((entry) => entry.quantity === "PER_YEAR").every((entry) => unusable.has(entry.id))).toBe(true);
    const kinds = new Map<string, number>();
    for (const choice of survey.choices) kinds.set(choice.kind, (kinds.get(choice.kind) ?? 0) + 1);
    expect(kinds.get("ALPHA_DIRICHLET")).toBeGreaterThan(130);
    expect(kinds.get("ALPHA_MLE")).toBeGreaterThan(130);
    expect(kinds.get("ALPHA_SUMMARY")).toBe(2);
    expect(kinds.get("MGL")).toBe(141);
    const vector = survey.evidence.find((item) => item.set === "ALL-MDP-FS-C2");
    expect(vector?.independent).toBe(143.12);
    expect(vector?.counts.map((count) => count.count)).toEqual([1.7976, 1.3512]);
  });

  it("finds the beta factors, MGL sets and alpha sets of the other reports and lists what it cannot use", () => {
    const cr4550 = surveyOf("SRC-4550", "NUREG-CR-4550", "source-nureg-cr-4550.json").survey;
    expect(cr4550.choices.filter((choice) => choice.kind === "BETA")).toHaveLength(23);
    expect(cr4550.choices.filter((choice) => choice.kind === "MGL").map((choice) => choice.template)).toEqual(["N4550-S6-MGL-RHO2-01", "N4550-S6-MGL-RHO2-005"]);
    expect(cr4550.unusable.map((item) => item.rowId).sort()).toEqual(["N4550-T6-2-1-BWRSRV-FTRC-X2", "N4550-T6-2-1-BWRSRV-FTRC-X3"]);
    const threes = cr4550.choices.filter((choice) => choice.kind === "BETA" && sizesFit(choice.sizes, 3)).map((choice) => choice.template);
    expect(threes).toContain("N4550-T6-2-1-DG-FTS-3");
    expect(threes).toContain("N4550-T6-2-1-AOV-FTO-2PLUS");
    expect(threes).not.toContain("N4550-T6-2-1-DG-FTS-2");
    const wsrc = surveyOf("SRC-WSRC", "WSRC-TR-93-262", "source-wsrc-tr-93-262.json").survey;
    expect(wsrc.choices.map((choice) => choice.template).sort()).toEqual(["AG7-BETA-DG-FTR", "AG7-BETA-DG-FTS", "AG7-BETA-GENERIC", "AG7-BETA-MOV-FTOC"]);
    const cr6890 = surveyOf("SRC-6890", "NUREG-CR-6890", "source-nureg-cr-6890.json").survey;
    expect(cr6890.choices.map((choice) => [choice.template, choice.sizes])).toEqual([["V2-T4-3-EDG-FTS", [2, 3, 4]], ["V2-T4-3-EDG-FTR", [2, 3, 4]], ["V2-T4-3-GTHT-FTS", [2, 3]], ["V2-T4-3-GTHT-FTR", [2, 3]]]);
    const ebr = surveyOf("SRC-EBR", "EBR-II-PRA", "source-ebr-ii-pra.json").survey;
    expect(ebr.choices.filter((choice) => choice.kind === "MGL").map((choice) => choice.template).sort()).toEqual(["EB-T7-36-MGL1", "EB-T7-36-MGL2", "EB-T7-36-MGL3"]);
    const betas = ebr.choices.filter((choice) => choice.kind === "BETA");
    expect(betas.every((choice) => choice.converts)).toBe(true);
    expect(betas.filter((choice) => choice.template.startsWith("EB-T7-38-"))).toHaveLength(67);
    expect(betas.filter((choice) => choice.template.startsWith("EB-T7-36-BETAN-"))).toHaveLength(5);
    expect(betas.filter((choice) => choice.template.startsWith("EA-S6214-BETA-"))).toHaveLength(3);
    expect(betas.find((choice) => choice.template === "EB-T7-38-ALL-01-RREC01QU")?.sizes).toEqual({ min: 6, max: 6 });
    const reasons = new Map(ebr.unusable.map((item) => [item.rowId, item.reason]));
    expect([...reasons.keys()].filter((id) => id.startsWith("EB-T7-37-"))).toHaveLength(56);
    expect(reasons.get("EB-T7-38-TOPHF-05-NONE")).toBe("The table lists no common cause event for this group.");
    expect(reasons.get("EA-S6216-CR-CCF")).toBe("A common cause event probability per demand, not a factor.");
    const icde = surveyOf("SRC-ICDE", "ICDE", "source-icde.json");
    const counted = new Set(icde.survey.evidence.flatMap((item) => item.counts.map((count) => count.rowId)));
    expect(icde.source.entries.filter((entry) => !counted.has(entry.id) && !icde.survey.unusable.some((item) => item.rowId === entry.id))).toEqual([]);
    expect(icde.survey.evidence.map((item) => item.set).sort()).toEqual(["ICRD-T13", "ICRD-T14-ALL", "ICRD-T14-FCIBHS", "ICRD-T14-FCIG", "ICRD-T14-FCIHHS"]);
    expect(icde.survey.evidence.find((item) => item.set === "ICRD-T14-ALL")?.counts.find((count) => count.k === 2)?.count).toBe(21);
  });
});

describe("imported and typed factors", () => {
  const ccf = (): DaSource => catalogSource("SRC-CCF", "CCF-2020", dataset("source-ccf-2020.json").filter((entry) => entry.id.startsWith("ALL-MDP-FS-") || entry.id.startsWith("CCF-PRIOR-")));
  const cr6890 = (): DaSource => catalogSource("SRC-6890", "NUREG-CR-6890", dataset("source-nureg-cr-6890.json").filter((entry) => entry.id.includes("-CCCG")));
  const cr4550 = (): DaSource => catalogSource("SRC-4550", "NUREG-CR-4550", dataset("source-nureg-cr-4550.json").filter((entry) => entry.id.startsWith("N4550-T6-2-1-") || entry.id.startsWith("N4550-S6-")));
  const wsrc = (): DaSource => catalogSource("SRC-WSRC", "WSRC-TR-93-262", dataset("source-wsrc-tr-93-262.json").filter((entry) => entry.id.startsWith("AG7-BETA-")));
  const ebr = (): DaSource => catalogSource("SRC-EBR", "EBR-II-PRA", dataset("source-ebr-ii-pra.json").filter((entry) => entry.id.startsWith("EB-T7-36-") || entry.id.startsWith("EA-S6214-")));
  const sources = (): DaSource[] => [SOURCE, ccf(), cr6890(), cr4550(), wsrc(), ebr()];
  const imported = (uuid: string, next: Partial<CcfParameterEstimation>): CcfParameterEstimation => estimate({ uuid, ...next });

  it("imports CCF 2020 alpha MLEs as fixed factors and scales a set that does not add to 1", async () => {
    const da = analysis([imported("A", { priorSourceId: "SRC-CCF", priorKind: "ALPHA_MLE", priorTemplate: "ALL-MDP-FS" })], { sources: sources() });
    const result = await settledResult(da, "A");
    const printed = ["A1", "A2", "A3"].map((order) => {
      const law = ccf().entries.find((entry) => entry.id === `ALL-MDP-FS-C3-${order}-MLE`)?.law;
      return law?.family === "POINT" ? law.value : Number.NaN;
    });
    const total = printed.reduce((sum, value) => sum + value, 0);
    const factors = result.factors;
    if (factors?.model !== "ALPHA_FACTOR" || factors.alphas.node !== "VALUE" || factors.alphas.law.family !== "FIXED") throw new Error("Fixed alphas expected.");
    factors.alphas.law.values.forEach((value, index) => close(value, (printed[index] ?? 0) / (Math.abs(total - 1) > 1e-6 ? total : 1), 1e-12));
    expect(result.imported?.rowIds).toEqual(["ALL-MDP-FS-C3-A1-MLE", "ALL-MDP-FS-C3-A2-MLE", "ALL-MDP-FS-C3-A3-MLE"]);
    close(eachOf(result)[2], QT * (factors.alphas.law.values[2] ?? 0), 1e-9);
  });

  it("scales a NUREG/CR-6890 alpha set that misses 1 and shows the original sum and the factor", async () => {
    const da = analysis([imported("A", { priorSourceId: "SRC-6890", priorKind: "ALPHA_POINTS", priorTemplate: "V2-T4-3-EDG-FTS" })], { sources: sources() });
    const result = await settledResult(da, "A");
    close(result.imported?.originalSum, 0.9997, 1e-12);
    close(result.imported?.scale, 1 / 0.9997, 1e-12);
    expect(result.levels.map((level) => level.published)).toEqual([0.981, 0.014, 0.0047]);
    close(result.levels[2]?.mean, 0.0047 / 0.9997, 1e-9);
    const notes = await details(da, "Scaled to 1");
    expect(notes).toEqual(["The printed alpha factors add to 0.9997. DA scales them by 1.0003 so they add to 1."]);
    const even = analysis([imported("A", { groupSize: 2, priorSourceId: "SRC-6890", priorKind: "ALPHA_POINTS", priorTemplate: "V2-T4-3-EDG-FTS" })], { sources: sources() });
    expect((await settledResult(even, "A")).imported?.scale).toBeUndefined();
  });

  it("imports a CCF 2020 MGL set, keeps the staggered basis and warns for non-staggered testing", async () => {
    const da = analysis([imported("M", { testing: "NON_STAGGERED", priorSourceId: "SRC-CCF", priorKind: "MGL", priorTemplate: "ALL-MDP-FS" })], { sources: sources() });
    const result = await settledResult(da, "M");
    const printed = ["BETA", "GAMMA"].map((letter) => ccf().entries.find((entry) => entry.id === `ALL-MDP-FS-C3-MGL-${letter}`)?.law);
    expect(printed.every((law) => law?.family === "BETA")).toBe(true);
    expect(result.factors).toEqual({ model: "MGL", factors: printed.map((law) => ({ node: "VALUE", value: { unit: "FRACTION", law } })) });
    expect(result.imported?.testing).toBe("STAGGERED");
    expect(result.imported?.rowIds).toEqual(["ALL-MDP-FS-C3-MGL-BETA", "ALL-MDP-FS-C3-MGL-GAMMA", "ALL-MDP-FS-C3-MGL-ONE-MINUS-BETA"]);
    expect(await checks(da)).toContain("warning:MGL assumes staggered:M");
    const beta = result.levels[0]?.mean ?? 0;
    const gamma = result.levels[1]?.mean ?? 0;
    const each = eachOf(result);
    close(each[0], QT * (1 - beta), 1e-9);
    close(each[1], (QT * beta * (1 - gamma)) / 2, 1e-9);
    close(each[2], QT * beta * gamma, 1e-9);
  });

  it("imports one MGL screening value and names the orders PRAXIS sets to zero", async () => {
    const da = analysis([imported("M", { groupSize: 4, priorSourceId: "SRC-4550", priorKind: "MGL", priorTemplate: "N4550-S6-MGL-RHO2-01" })], { sources: sources() });
    const result = await settledResult(da, "M");
    expect(result.factors).toEqual({ model: "MGL", factors: [fraction(0.1)] });
    expect(eachOf(result).slice(2)).toEqual([0, 0]);
    expect(await details(da, "Orders set to zero")).toEqual(["With 1 MGL factor for a group of 4, PRAXIS gives orders 3 and 4 no events, so they are set to zero."]);
  });

  it("imports an EBR-II MGL model for the group size", async () => {
    const da = analysis([imported("M", { groupSize: 4, priorSourceId: "SRC-EBR", priorKind: "MGL", priorTemplate: "EB-T7-36-MGL2" })], { sources: sources() });
    const result = await settledResult(da, "M");
    expect(result.factors).toEqual({ model: "MGL", factors: [fraction(0.02), fraction(0.5), fraction(0.8)] });
    close(eachOf(result)[3], QT * 0.02 * 0.5 * 0.8, 1e-12);
  });

  it("imports a beta factor given for k components as a beta factor for a group of k", async () => {
    const da = analysis([imported("B", { priorSourceId: "SRC-4550", priorKind: "BETA", priorTemplate: "N4550-T6-2-1-DG-FTS-3" })], { sources: sources() });
    const result = await settledResult(da, "B");
    expect(result.factors).toEqual({ model: "BETA_FACTOR", beta: { node: "VALUE", value: { unit: "FRACTION", law: { family: "TRUNCATED", law: { family: "LOGNORMAL", mean: 0.018, errorFactor: 3, level: 0.95 }, lower: null, upper: 1 } } } });
    expect(await details(da, "Orders set to zero")).toEqual(["The beta factor model fails one member or all 3. PRAXIS gives order 2 no events, so it is set to zero."]);
    const wrong = analysis([imported("B", { groupSize: 2, priorSourceId: "SRC-4550", priorKind: "BETA", priorTemplate: "N4550-T6-2-1-DG-FTS-3" })], { sources: sources() });
    expect((await settledResult(wrong, "B")).problem).toBe("N4550-T6-2-1-DG-FTS-3 is a beta factor for groups of 3, not for a group of 2.");
    const generic = analysis([imported("B", { groupSize: 2, priorSourceId: "SRC-WSRC", priorKind: "BETA", priorTemplate: "AG7-BETA-DG-FTS" })], { sources: sources() });
    const wsrcResult = await settledResult(generic, "B");
    expect(wsrcResult.factors?.model).toBe("BETA_FACTOR");
    close(eachOf(wsrcResult)[1], QT * 0.014642377378935626, 1e-6);
  });

  it("converts an EBR-II beta factor from Qt = (1 + b) Qs through PRAXIS", async () => {
    const da = analysis([imported("B", { groupSize: 2, priorSourceId: "SRC-EBR", priorKind: "BETA", priorTemplate: "EB-T7-36-BETAN-N2" })], { sources: sources() });
    const result = await settledResult(da, "B");
    const beta = fraction(0.1);
    expect(result.factors).toEqual({ model: "BETA_FACTOR", beta: { node: "OPERATION", operation: "DIVIDE", operands: [beta, { node: "OPERATION", operation: "ADD", operands: [{ node: "VALUE", value: { unit: "FACTOR", law: { family: "POINT", value: 1 } } }, beta] }] } });
    expect(result.imported?.conversion).toBe("ONE_PLUS_BETA");
    expect(result.levels[0]?.published).toBe(0.1);
    close(result.levels[0]?.mean, 0.1 / 1.1, 1e-12);
    close(eachOf(result)[1], (QT * 0.1) / 1.1, 1e-12);
    expect(await checks(da)).toContain("note:Beta converted:B");
    const id = factorIdOf("SRC-EBR", "EB-T7-36-BETAN-N2");
    expect(result.factor).toEqual({ id, sourceId: "SRC-EBR", rowId: "EB-T7-36-BETAN-N2", expression: { node: "VALUE", value: { unit: "FACTOR", law: { family: "POINT", value: 0.1 } } } });
    const linked = await settledWithPraxis(() => withCcf(da, SELF));
    const link: ParameterExpression = { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: SELF, entityId: id } };
    expect(estimateOf(linked, "B").factors).toEqual({ model: "BETA_FACTOR", beta: { node: "OPERATION", operation: "DIVIDE", operands: [link, { node: "OPERATION", operation: "ADD", operands: [{ node: "VALUE", value: { unit: "FACTOR", law: { family: "POINT", value: 1 } } }, link] }] } });
    expect(linked.ccfFactors?.map((factor) => factor.id)).toEqual([id]);
    expect(daCcfFactorParameters(linked, SELF)).toEqual([{ reference: link.reference, expression: result.factor?.expression }]);
    close((await settledResult(linked, "B")).levels[0]?.mean, 0.1 / 1.1, 1e-12);
    const typed = { ...estimateOf(linked, "B"), method: "TYPED" as const };
    const own = await settledResult({ ...linked, ccfParameterEstimations: [typed] }, "B");
    close(own.levels[0]?.mean, 0.1 / 1.1, 1e-12);
    const range = analysis([imported("B", { groupSize: 5, priorSourceId: "SRC-EBR", priorKind: "BETA", priorTemplate: "EA-S6214-BETA-4TO5" })], { sources: sources() });
    close((await settledResult(range, "B")).levels[0]?.mean, 0.02 / 1.02, 1e-12);
  });

  it("computes every model typed by hand", async () => {
    const typed = (uuid: string, factors: CcfFactorModel, groupSize = 3): CcfParameterEstimation => estimate({ uuid, method: "TYPED", groupSize, factors, priorSourceId: undefined, priorTemplate: undefined });
    const bfr: CcfFactorModel = { model: "BINOMIAL_FAILURE_RATE", independent: probability(1e-3), nonLethalShock: probability(2e-4), componentFailure: fraction(0.3), lethalShock: probability(1e-6) };
    const da = analysis([
      typed("ALPHA", fixedAlphas([0.95, 0.03, 0.02], "NON_STAGGERED")),
      typed("MGL", { model: "MGL", factors: [fraction(0.05), fraction(0.4)] }),
      typed("BETA", { model: "BETA_FACTOR", beta: fraction(0.05) }, 2),
      typed("PHI", { model: "PHI_FACTOR", phis: { node: "VALUE", law: { family: "FIXED", values: [0.9, 0.06, 0.04] } } }),
      typed("BFR", bfr),
    ]);
    const weighted = 0.95 + 2 * 0.03 + 3 * 0.02;
    const alpha = eachOf(await settledResult(da, "ALPHA"));
    close(alpha[0], (QT * 0.95) / weighted, 1e-12);
    close(alpha[1], (QT * 2 * 0.03) / (2 * weighted), 1e-12);
    close(alpha[2], (QT * 3 * 0.02) / weighted, 1e-12);
    const mgl = eachOf(await settledResult(da, "MGL"));
    close(mgl[1], (QT * 0.05 * 0.6) / 2, 1e-12);
    close(mgl[2], QT * 0.05 * 0.4, 1e-12);
    const beta = eachOf(await settledResult(da, "BETA"));
    close(beta[0], QT * 0.95, 1e-12);
    close(beta[1], QT * 0.05, 1e-12);
    const phi = eachOf(await settledResult(da, "PHI"));
    close(phi[2], QT * 0.04, 1e-12);
    const binomial = await settledResult(da, "BFR");
    expect(binomial.qt).toBeUndefined();
    const each = eachOf(binomial);
    close(each[0], 1e-3 + 2e-4 * 0.3 * 0.7 * 0.7, 1e-12);
    close(each[1], 2e-4 * 0.09 * 0.7, 1e-12);
    close(each[2], 2e-4 * 0.027 + 1e-6, 1e-12);
    const found = await checks(da);
    expect(found.filter((line) => line.startsWith("error:"))).toEqual([]);
    expect(found).not.toContain("warning:No total:BFR");
  });

  it("checks phi, MGL and beta factors the way PRAXIS reads them", async () => {
    const typed = (uuid: string, factors: CcfFactorModel, groupSize = 4): CcfParameterEstimation => estimate({ uuid, method: "TYPED", groupSize, factors });
    const da = analysis([
      typed("PHI", { model: "PHI_FACTOR", phis: { node: "VALUE", law: { family: "FIXED", values: [0.9, 0.06, 0.04] } } }),
      typed("MGL", { model: "MGL", factors: [fraction(0.05), fraction(0.4)] }),
      typed("LONG", { model: "MGL", factors: [fraction(0.05), fraction(0.4), fraction(0.5), fraction(0.5)] }),
      typed("BETA", { model: "BETA_FACTOR", beta: fraction(0.05) }, 5),
    ]);
    const found = await checks(da);
    expect(found).toContain("error:Cannot use:PHI");
    expect((await settledResult(da, "PHI")).problem).toBe("A group of 4 takes exactly 4 phi factors, one for each number of failed components.");
    expect(found).toContain("error:Cannot use:LONG");
    const zero = await details(da, "Orders set to zero");
    expect(zero).toEqual([
      "With 2 MGL factors for a group of 4, PRAXIS gives order 4 no events, so it is set to zero.",
      "The beta factor model fails one member or all 5. PRAXIS gives orders 2 to 4 no events, so they are set to zero.",
    ]);
  });
});

describe("shared vectors", () => {
  it("publishes one vector per template and group size and links each estimate's alphas to it", async () => {
    const first = estimate({ uuid: "DA-CCF-1", ccfGroupReference: "G-1" });
    const second = estimate({ uuid: "DA-CCF-2", ccfGroupReference: "G-2", testing: "NON_STAGGERED" });
    const pair = estimate({ uuid: "DA-CCF-3", ccfGroupReference: "G-3", groupSize: 2, priorTemplate: "PRIOR" });
    const synced = await settledWithPraxis(() => withCcf(analysis([first, second, pair]), SELF));
    const id = vectorIdOf("SRC-T", "ALPHA_DIRICHLET", "ALL-MDP-FS", 3);
    expect(synced.ccfVectors?.map((vector) => vector.id)).toEqual([id, vectorIdOf("SRC-T", "ALPHA_DIRICHLET", "PRIOR", 2)].sort());
    const link = { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: SELF, entityId: id } };
    expect(estimateOf(synced, "DA-CCF-1").factors).toEqual({ model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: link });
    expect(estimateOf(synced, "DA-CCF-2").factors).toEqual({ model: "ALPHA_FACTOR", testing: "NON_STAGGERED", alphas: link });
    expect(estimateOf(synced, "DA-CCF-1").imported?.vectorId).toBe(id);
    expect(daCcfVectorParameters(synced, SELF).find((vector) => vector.reference.entityId === id)).toEqual({ reference: link.reference, vector: { family: "DIRICHLET", concentrations: TEMPLATE } });
    expect(await settledWithPraxis(() => withCcf(synced, SELF))).toBe(synced);
    expect(await settledWithPraxis(() => withCcf(synced))).toBe(synced);
    expect(DataAnalysisSchema.safeParse(synced).success).toBe(true);
    const result = await settledResult(synced, "DA-CCF-2");
    close(result.levels[2]?.mean, 1.402 / 277.632, 1e-12);
    const typed = { ...estimateOf(synced, "DA-CCF-2"), method: "TYPED" as const };
    const kept = await settledWithPraxis(() => withCcf({ ...synced, ccfParameterEstimations: [estimateOf(synced, "DA-CCF-1"), typed] }, SELF));
    expect(kept.ccfVectors?.map((vector) => vector.id)).toEqual([id]);
    const unlinked = await settledWithPraxis(() => withCcf(analysis([first])));
    expect(concentrationsOf(estimateOf(unlinked, "DA-CCF-1").factors)).toEqual(TEMPLATE);
    expect(await checks(unlinked)).toContain("note:Shared draw not linked:DA-CCF-1");
  });

  it("stores the Dirichlet and leaves typed factors alone", async () => {
    const typed = estimate({ uuid: "DA-CCF-2", method: "TYPED", factors: fixedAlphas([0, 0, 1], "STAGGERED"), estimateReason: "One shared image" });
    const synced = await settledWithPraxis(() => withCcf(analysis([estimate({}), typed])));
    expect(concentrationsOf(synced.ccfParameterEstimations?.[0]?.factors)).toEqual(TEMPLATE);
    expect(synced.ccfParameterEstimations?.[1]).toBe(typed);
    expect(await settledWithPraxis(() => withCcf(synced))).toBe(synced);
    expect(await settledWithPraxis(() => ccfComplete(synced))).toBe(true);
  });
});

describe("events and mapping", () => {
  const ccf = (): DaSource => catalogSource("SRC-CCF", "CCF-2020", dataset("source-ccf-2020.json").filter((entry) => entry.id.startsWith("ALL-MDP-FS-C") || entry.id.startsWith("CCF-PRIOR-C")));

  function impactEvidence(set: string, size: number, independent: number, counts: number[], next: Partial<DaCcfEvidence> = {}): DaCcfEvidence {
    return { id: "EV-1", label: set, origin: "TECHNOLOGY", population: size, independentFailures: independent, counts, imported: { sourceId: "SRC-CCF", kind: "IMPACT_VECTOR", set, rowIds: [`${set}-A1`] }, events: [], boundary: "SAME", reason: "Industry data", included: true, ...next };
  }

  it("rebuilds a CCF 2020 template from its prior and its own impact vector", async () => {
    const updated = estimate({ groupSize: 2, method: "BAYES", priorSourceId: "SRC-CCF", priorKind: "ALPHA_DIRICHLET", priorTemplate: "CCF-PRIOR", evidence: [impactEvidence("ALL-MDP-FS-C2", 2, 143.12, [1.7976, 1.3512])], genericExclusionConsistencyConfirmed: true, genericExclusionConsistencyBasis: "Report rules" });
    const da = analysis([updated], { sources: [ccf()] });
    const result = await settledResult(da, "DA-CCF-1");
    const concentrations = concentrationsOf(result.factors);
    close(concentrations[0], 22.41 + 143.12 + 1.7976, 1e-12);
    close(concentrations[1], 0.4685 + 1.3512, 1e-12);
    close(concentrations[0], 167.3, 1e-3);
    close(concentrations[1], 1.82, 1e-3);
    const twice = analysis([{ ...updated, priorTemplate: "ALL-MDP-FS" }], { sources: [ccf()] });
    expect(await checks(twice)).toContain("error:Events counted twice:DA-CCF-1");
  });

  it("maps impact vectors down through PRAXIS", async () => {
    const counts = [0.3704, 0.7315, 0.7778, 0.3056, 0.2];
    const updated = estimate({ groupSize: 3, method: "BAYES", priorSourceId: "SRC-CCF", priorKind: "ALPHA_DIRICHLET", priorTemplate: "CCF-PRIOR", evidence: [impactEvidence("ALL-MDP-FS-C5", 5, 83.5, counts, { impactSize: 5 })] });
    const da = analysis([updated], { sources: [ccf()] });
    const result = await settledResult(da, "DA-CCF-1");
    expect(result.problem).toBeUndefined();
    const expected = hypergeometricDown(counts, 3);
    const mapping = result.mappings[0];
    mapping?.mapped?.forEach((value, index) => close(value, expected[index] ?? Number.NaN, 1e-12));
    const prior = [57.98, 0.8512, 0.2768];
    const posterior = concentrationsOf(result.factors);
    close(posterior[0], (prior[0] ?? 0) + (83.5 * 3) / 5 + (expected[0] ?? 0), 1e-12);
    close(posterior[1], (prior[1] ?? 0) + (expected[1] ?? 0), 1e-12);
    close(posterior[2], (prior[2] ?? 0) + (expected[2] ?? 0), 1e-12);
    const dropped = counts.reduce((total, count, at) => total + (count * choose(5 - at - 1, 3)) / choose(5, 3), 0);
    close(mapping?.noImpact, dropped, 1e-12);
    expect(await checks(da)).toContain("note:Mapped:DA-CCF-1");
  });

  it("maps counts up through PRAXIS with a typed rho and lethal shocks", async () => {
    const pair = (next: Partial<DaCcfEvidence>): CcfParameterEstimation => estimate({ groupSize: 4, method: "BAYES", priorSourceId: "SRC-CCF", priorKind: "ALPHA_DIRICHLET", priorTemplate: "CCF-PRIOR", evidence: [impactEvidence("ALL-MDP-FS-C2", 2, 0, [0, 3], { impactSize: 2, ...next })] });
    const missing = analysis([pair({})], { sources: [ccf()] });
    expect((await settledResult(missing, "DA-CCF-1")).problem).toBe("ALL-MDP-FS-C2: Type rho to map the counts up from a group of 2 to a group of 4.");
    const rho = 0.2;
    const da = analysis([pair({ mappingRho: rho, lethalShocks: 1 })], { sources: [ccf()] });
    const result = await settledResult(da, "DA-CCF-1");
    expect(result.problem).toBeUndefined();
    const shocks = 2;
    const expected = [0, shocks * (1 - rho) * (1 - rho), shocks * 2 * rho * (1 - rho), shocks * rho * rho + 1];
    result.mappings[0]?.mapped?.forEach((value, index) => close(value, expected[index] ?? Number.NaN, 1e-12));
    const prior = [90.68, 1.26, 0.4024, 0.2315];
    concentrationsOf(result.factors).forEach((value, index) => close(value, (prior[index] ?? 0) + (expected[index] ?? 0), 1e-12));
  });

  it("imports ICDE multiplicity counts as evidence and asks for the independent failures", async () => {
    const icde = catalogSource("SRC-ICDE", "ICDE", dataset("source-icde.json").filter((entry) => entry.id.startsWith("ICRD-T14-FCIHHS-")));
    const survey = ccfSurvey(icde, icde.entries);
    const choice = survey.evidence[0];
    expect(choice?.counts.filter((count) => count.count > 0).map((count) => [count.k, count.count])).toEqual([[2, 2], [3, 1]]);
    const evidence: DaCcfEvidence = { id: "EV-1", label: "CRDA", origin: "TECHNOLOGY", population: 3, independentFailures: 0, impactSize: 3, multiplicities: [{ failed: 1, events: 0 }, { failed: 2, events: 2 }, { failed: 3, events: 1 }], imported: { sourceId: "SRC-ICDE", kind: "MULTIPLICITY", set: "ICRD-T14-FCIHHS", rowIds: ["ICRD-T14-FCIHHS-C2", "ICRD-T14-FCIHHS-C3"] }, events: [], boundary: "SAME", reason: "Same drives", included: true };
    const updated = estimate({ method: "BAYES", priorSourceId: "SRC-CCF", priorKind: "ALPHA_DIRICHLET", priorTemplate: "CCF-PRIOR", evidence: [evidence] });
    const da = analysis([updated], { sources: [ccf(), icde] });
    const result = await settledResult(da, "DA-CCF-1");
    expect(result.problem).toBeUndefined();
    expect(concentrationsOf(result.factors)).toEqual([57.98, 0.8512 + 2, 0.2768 + 1]);
    const wide = analysis([estimate({ ...updated, evidence: [{ ...evidence, impactSize: 2 }] })], { sources: [ccf(), icde] });
    expect((await settledResult(wide, "DA-CCF-1")).problem).toBe("CRDA: 1 events fail 3 components, more than the 2 the counts are coded for.");
    expect(await checks(da)).toContain("warning:No independent failures:DA-CCF-1");
  });

  it("flags exclusions that differ from the independent data and counts that disagree with the records", async () => {
    const evidence = {
      id: "EV-1",
      origin: "TECHNOLOGY" as const,
      recordSetId: "RS-T",
      population: 4,
      independentFailures: 1,
      events: [
        { id: "E-1", recordId: "R-1", impact: [0, 0, 1], included: false, reason: "Left out" },
        { id: "E-2", recordId: "R-3", impact: [0, 0, 1], included: true, reason: "Counted" },
      ],
      boundary: "SAME" as const,
      reason: "Same technology",
      included: true,
    };
    const found = await checks(analysis([estimate({ method: "BAYES", evidence: [evidence] })]));
    expect(found.filter((line) => line === "warning:Exclusions differ:DA-CCF-1")).toHaveLength(2);
    expect(found).toContain("note:Independent count:DA-CCF-1");
    expect(found).toContain("warning:Exclusions not confirmed:DA-CCF-1");
    const short = { ...evidence, events: [{ id: "E-3", impact: [0, 1], included: true, reason: "Coded" }] };
    expect(await checks(analysis([estimate({ method: "BAYES", evidence: [short] })]))).toContain("error:Cannot estimate:DA-CCF-1");
  });
});

describe("common cause checks", () => {
  it("checks typed factors for range, size, model and testing", async () => {
    const coarse = estimate({ method: "TYPED", factors: { model: "BETA_FACTOR", beta: fraction(0.05) }, isRiskSignificant: true, estimateReason: "Old value" });
    expect(await checks(analysis([coarse]))).toContain("error:Model too coarse:DA-CCF-1");
    const wide = estimate({ method: "TYPED", factors: { model: "BETA_FACTOR", beta: { node: "VALUE", value: { unit: "FRACTION", law: { family: "LOGNORMAL", mean: 0.3, errorFactor: 10, level: 0.95 } } } }, estimateReason: "Judgment" });
    expect(await checks(analysis([wide]))).toContain("warning:Can leave range:DA-CCF-1");
    const outside = estimate({ method: "TYPED", factors: { model: "BETA_FACTOR", beta: { node: "VALUE", value: { unit: "FRACTION", law: { family: "UNIFORM", lower: 1.2, upper: 1.5 } } } }, estimateReason: "Judgment" });
    expect(await checks(analysis([outside]))).toContain("error:Out of range:DA-CCF-1");
    const scheme = estimate({ method: "TYPED", factors: fixedAlphas([0.98, 0.01, 0.01], "NON_STAGGERED"), estimateReason: "Typed" });
    expect(await checks(analysis([scheme]))).toContain("warning:Testing differs:DA-CCF-1");
    const short = estimate({ method: "TYPED", factors: fixedAlphas([0.98, 0.02], "STAGGERED"), estimateReason: "Typed" });
    expect(await checks(analysis([short]))).toContain("error:Cannot use:DA-CCF-1");
    const unset = estimate({ testing: undefined, testingReason: undefined, priorTemplate: "MISSING" });
    const found = await checks(analysis([unset]));
    expect(found).toContain("warning:No testing scheme:DA-CCF-1");
    expect(found).toContain("error:Cannot estimate:DA-CCF-1");
  });

  it("checks the group against what Systems Analysis imports and compares factor models exactly", async () => {
    const group = (id: string, factors: CcfFactorModel | undefined): DaCcfGroupNeed => ({ id, name: id, systemIds: [], memberIds: ["A", "B"], ...(factors === undefined ? {} : { factors }), included: true });
    const needs = {
      sources: [],
      basicEvents: [
        { id: "A", code: "A", name: "A", included: true, parameterId: "DA-P-1" },
        { id: "B", code: "B", name: "B", included: true, parameterId: "DA-P-2" },
      ],
      initiators: [],
      humanErrors: [],
      ccfGroups: [group("CCF-T", { model: "BETA_FACTOR", beta: fraction(0.05) }), group("CCF-U", undefined)],
      states: [],
    };
    const found = await checks(analysis([estimate({})], { dataNeeds: needs }));
    expect(found).toContain("error:Size differs:DA-CCF-1");
    expect(found).toContain("error:Members differ:DA-CCF-1");
    expect(found).toContain("warning:SY differs:DA-CCF-1");
    expect(found).toContain("error:No estimate:CCF-U");
    const same = { ...needs, ccfGroups: [group("CCF-T", { alphas: { law: { concentrations: TEMPLATE, family: "DIRICHLET" }, node: "VALUE" }, testing: "STAGGERED", model: "ALPHA_FACTOR" })] };
    expect(await checks(analysis([estimate({})], { dataNeeds: same }))).not.toContain("warning:SY differs:DA-CCF-1");
  });
});

describe("updated factors in the group's model form", () => {
  const mglRow = (letter: string, value: number): DaSourceEntry => ({ id: `MGL-T-C3-MGL-${letter}`, component: "Pump", failureMode: `Fail to start, MGL ${letter}`, quantity: "FACTOR", estimateType: "POINT_ESTIMATE", spread: "NONE", law: { family: "POINT", value } });
  const mglSource: DaSource = { ...SOURCE, id: "SRC-M", entries: [mglRow("BETA", 0.1), mglRow("GAMMA", 0.3)] };
  const counts: DaCcfEvidence = { id: "EV-1", origin: "TECHNOLOGY", population: 3, independentFailures: 6, counts: [0, 1, 1], events: [], boundary: "SAME", reason: "Test", included: true };
  const updated = (next: Partial<CcfParameterEstimation>): CcfParameterEstimation => estimate({ method: "BAYES", model: "MGL", priorSourceId: "SRC-M", priorKind: "MGL", priorTemplate: "MGL-T", priorWeight: 10, evidence: [counts], ...next });

  it("turns published MGL points into a Dirichlet on the alphas, adds the events and hands back MGL and beta factors", async () => {
    const da = analysis([updated({})], { sources: [SOURCE, mglSource] });
    const result = await settledResult(da, "DA-CCF-1");
    expect(result.problem).toBeUndefined();
    result.prior?.forEach((value, index) => close(value, [9, 0.7, 0.3][index] ?? Number.NaN, 1e-12));
    expect(result.posterior?.map((value) => Number(value.toFixed(12)))).toEqual([15, 1.7, 1.3]);
    close(result.levels[0]?.mean, 3 / 18, 2e-2);
    close(result.levels[1]?.mean, 1.3 / 3, 2e-2);
    const beta = await settledResult(analysis([updated({ model: "BETA_FACTOR" })], { sources: [SOURCE, mglSource] }), "DA-CCF-1");
    close(beta.levels[0]?.mean, 3 / 18, 2e-2);
  });

  it("updates a phi prior through the alpha Dirichlet and hands phi back as a weighted Dirichlet", async () => {
    const vectorId = "ccfv/DA-CCF-1/updated/C3";
    const synced = await settledWithPraxis(() => withCcf(analysis([updated({ model: "PHI_FACTOR" })], { sources: [SOURCE, mglSource] }), SELF));
    const vector = synced.ccfVectors?.find((entry) => entry.id === vectorId)?.vector;
    expect(vector?.family === "WEIGHTED_DIRICHLET" ? [vector.concentrations.map((value) => Number(value.toFixed(12))), vector.weights] : undefined).toEqual([[15, 1.7, 1.3], [1, 0.5, 1]]);
    expect(estimateOf(synced, "DA-CCF-1").factors).toEqual({ model: "PHI_FACTOR", phis: { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: SELF, entityId: vectorId } } });
    const result = await settledResult(synced, "DA-CCF-1");
    [15, 0.85, 1.3].forEach((value, index) => close(result.levels[index]?.mean, value / 17.15, 1e-12));
  });

  it("publishes the updated values as DA links so groups that share an estimate draw together", async () => {
    const alpha = estimate({ uuid: "DA-CCF-2", ccfGroupReference: "G-2", method: "BAYES", evidence: [counts] });
    const synced = await settledWithPraxis(() => withCcf(analysis([updated({}), alpha], { sources: [SOURCE, mglSource] }), SELF));
    const gammas = ["G1", "G2", "G3"].map((part) => `ccff/DA-CCF-1/updated/${part}`);
    expect(synced.ccfFactors?.filter((factor) => factor.estimateId === "DA-CCF-1").map((factor) => [factor.id, factor.expression.node === "VALUE" ? factor.expression.value.law : undefined])).toEqual(gammas.map((id, index) => [id, { family: "GAMMA", shape: [15, 1.7, 1.3][index], rate: 1 }]));
    const mgl = estimateOf(synced, "DA-CCF-1").factors;
    expect(mgl?.model === "MGL" ? mgl.factors.flatMap(expressionLinks) : []).toEqual([...gammas, ...gammas.slice(1)]);
    const vector = "ccfv/DA-CCF-2/updated/C3";
    expect(estimateOf(synced, "DA-CCF-2").factors).toEqual({ model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: SELF, entityId: vector } } });
    expect(synced.ccfVectors?.find((entry) => entry.id === vector)?.vector).toEqual({ family: "DIRICHLET", concentrations: TEMPLATE.map((value, index) => value + [6, 1, 1][index]) });
    expect(DataAnalysisSchema.safeParse(synced).success).toBe(true);
    expect(await settledWithPraxis(() => withCcf(synced, SELF))).toBe(synced);
  });

  it("updates the four binomial failure rate parts from the impact vectors with Jeffreys priors", async () => {
    const events = [[0, 1, 0], [0, 1, 0], [0, 0, 1]].map((impact, index) => ({ id: `E-${index + 1}`, impact, included: true, reason: "Coded", ...(index === 2 ? { lethal: true } : {}) }));
    const bfr = estimate({ method: "BAYES", model: "BINOMIAL_FAILURE_RATE", groupDemands: 100, priorTemplate: undefined, evidence: [{ ...counts, counts: undefined, events }] });
    const result = await settledResult(analysis([bfr]), "DA-CCF-1");
    expect(result.problem).toBeUndefined();
    expect(result.factorEntries?.map((entry) => (entry.expression.node === "VALUE" && entry.expression.value.law.family === "POSTERIOR" ? entry.expression.value.law.evidence : undefined))).toEqual([[6, 300], [2, 100], [4, 6], [1, 100]].map(([failures, exposure]) => [{ likelihood: "BINOMIAL", failures, exposure }]));
    close(result.levels[2]?.mean, 4.5 / 7, 1e-9);
    close(result.levels[3]?.mean, 1.5 / 101, 1e-9);
  });
});

describe("examples", () => {
  it("keeps both examples stable once derived and in step with Systems Analysis", async () => {
    linkScExamples();
    const options = { SY: [], IE: [], HRA: [], POS: [], SC: [], ESQ: [] };
    for (const [seed, sy] of [[DA_ANALYSIS_HTGR, SY_ANALYSIS_HTGR], [DA_ANALYSIS, SY_ANALYSIS]] as const) {
      const da = await settledWithPraxis(() => withCcf(seed));
      expect(await settledWithPraxis(() => withCcf(da))).toBe(da);
      const linked: DataAnalysis = { ...da, dataNeeds: daImportNeeds(da, { options, sy, scReferenced: [] }, "2026-10-04T00:00:00.000Z") };
      expect((await checks(linked)).filter((line) => !line.startsWith("note:"))).toEqual([]);
      expect(await settledWithPraxis(() => ccfComplete(linked))).toBe(true);
    }
    const trains = estimateOf(DA_ANALYSIS_HTGR, "DA-CCF-08");
    const updated = await settledWithPraxis(() => ccfResult(DA_ANALYSIS_HTGR, trains));
    expect(updated.counts).toEqual([0.5, 1]);
    expect(concentrationsOf(trains.factors)).toEqual([(updated.prior?.[0] ?? 0) + 0.5, (updated.prior?.[1] ?? 0) + 1]);
    close(updated.levels[1]?.prior, 0.004342697675518596, 1e-12);
    close(updated.levels[1]?.mean, 0.007266701788568117, 1e-12);
    const loops = estimateOf(DA_ANALYSIS, "DA-CCF-12");
    expect(loops.factors?.model === "ALPHA_FACTOR" ? loops.factors.testing : undefined).toBe("STAGGERED");
    expect(estimateOf(DA_ANALYSIS, "DA-CCF-21").factors).toEqual(fixedAlphas([0, 0, 0, 1], "NON_STAGGERED"));
  });
});
