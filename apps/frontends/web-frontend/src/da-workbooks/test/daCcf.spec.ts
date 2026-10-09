import type { CcfParameterEstimation, DataAnalysis, DaCcfGroupNeed, DaRecordSet, DaSource, DaSourceEntry } from "interfaces-mef-types/da/data-analysis";
import type { CcfFactorModel, UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { DA_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed-htgr";
import { DA_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed";
import { SY_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/sy-seed-htgr";
import { SY_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/sy-seed";
import { daImportNeeds } from "../daSelectors";
import { lawSummary } from "../daLaws";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { praxisUncertainty, settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";
import { allFail, ccfComplete, ccfFindings, ccfResult, ccfTemplates, pointCoefficients, withCcf, withTestingFlipped } from "../daCcf";

jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

beforeEach(() => {
  jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
});

function close(actual: number | undefined, expected: number, tolerance = 1e-6): void {
  expect(actual).toBeDefined();
  expect(Math.abs((actual ?? 0) - expected) / Math.abs(expected)).toBeLessThan(tolerance);
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

function fraction(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "FRACTION", law: { family: "POINT", value } } };
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
    implementsSrs: [],
    ...next,
  };
}

function analysis(estimates: CcfParameterEstimation[], next: Partial<DataAnalysis> = {}): DataAnalysis {
  const parameter = { uuid: "DA-P-1", name: "Pump fails to start", parameterType: "PROBABILITY" as const, estimate: { node: "VALUE" as const, value: { unit: "PROBABILITY" as const, law: { family: "POINT" as const, value: 0.002 } } }, quantificationModel: "DEMAND_PROBABILITY" as const, valueMode: "TYPED" as const, implementsSrs: [] };
  return { ...DA_ANALYSIS_HTGR, parameters: [parameter], sources: [SOURCE], recordSets: [RECORDS], ccfParameterEstimations: estimates, dataNeeds: undefined, ...next };
}

function checks(da: DataAnalysis): Promise<string[]> {
  return settledWithPraxis(() => ccfFindings(da).map((finding) => `${finding.severity}:${finding.check}:${finding.item}`));
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

  it("lists the templates that have every alpha factor for a group size", () => {
    const templates = ccfTemplates("SRC-T", ENTRIES);
    expect(templates.map((template) => [template.code, template.sizes])).toEqual([["PRIOR", [2]], ["ALL-MDP-FS", [3]]]);
    expect(templates[1]?.failureMode).toBe("Fail to start");
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
    const typed = withTestingFlipped(estimate({ method: "TYPED", factors: fixedAlphas([0.98, 0.01, 0.01], "STAGGERED") }), "NON_STAGGERED");
    expect(typeof typed === "string" ? typed : typed.factors).toEqual(fixedAlphas([0.98, 0.01, 0.01], "NON_STAGGERED"));
  });
});

describe("common cause checks", () => {
  it("stores the Dirichlet and leaves typed factors alone", async () => {
    const typed = estimate({ uuid: "DA-CCF-2", method: "TYPED", factors: fixedAlphas([0, 0, 1], "STAGGERED"), estimateReason: "One shared image" });
    const synced = await settledWithPraxis(() => withCcf(analysis([estimate({}), typed])));
    expect(concentrationsOf(synced.ccfParameterEstimations?.[0]?.factors)).toEqual(TEMPLATE);
    expect(synced.ccfParameterEstimations?.[1]).toBe(typed);
    expect(await settledWithPraxis(() => withCcf(synced))).toBe(synced);
    expect(await settledWithPraxis(() => ccfComplete(synced))).toBe(true);
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

  it("checks typed factors for range, size, model and testing", async () => {
    const coarse = estimate({ method: "TYPED", factors: { model: "BETA_FACTOR", beta: fraction(0.05) }, isRiskSignificant: true, estimateReason: "Old value" });
    expect(await checks(analysis([coarse]))).toContain("error:Model too coarse:DA-CCF-1");
    const wide = estimate({ method: "TYPED", factors: { model: "BETA_FACTOR", beta: { node: "VALUE", value: { unit: "FRACTION", law: { family: "LOGNORMAL", mean: 0.3, errorFactor: 10, level: 0.95 } } } }, estimateReason: "Judgment" });
    expect(await checks(analysis([wide]))).toContain("error:Out of range:DA-CCF-1");
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

describe("examples", () => {
  it("keeps both examples stable and in step with Systems Analysis", async () => {
    const options = { SY: [], IE: [], HRA: [], POS: [], SC: [], ESQ: [] };
    for (const [da, sy] of [[DA_ANALYSIS_HTGR, SY_ANALYSIS_HTGR], [DA_ANALYSIS, SY_ANALYSIS]] as const) {
      expect(await settledWithPraxis(() => withCcf(da))).toBe(da);
      const linked: DataAnalysis = { ...da, dataNeeds: daImportNeeds(da, { options, sy, scExamples: [] }, "2026-10-04T00:00:00.000Z") };
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
