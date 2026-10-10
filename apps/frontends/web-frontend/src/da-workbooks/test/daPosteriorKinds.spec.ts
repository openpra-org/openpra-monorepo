import type { DataAnalysis, DataAnalysisParameter, DaEvidence, DaFrequencyPart, DaSource, DaSourceUse } from "interfaces-mef-types/da/data-analysis";
import { holdsEstimate } from "interfaces-mef-types/da/data-analysis";
import { DA_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed-htgr";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { praxisUncertainty, settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";
import { parameterEstimate } from "../daFailures";
import { frequencyEstimate, frequencyFindings } from "../daFrequencies";
import { elicitationLaw, lawSummary, parameterPriorLaw, quantileOf, sourceUseLaw } from "../daLaws";
import { recordCount } from "../daEvidenceChecks";

jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

beforeEach(() => {
  jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
});

const SOURCE: DaSource = {
  id: "S-T",
  name: "Test source",
  kind: "GENERIC_NUCLEAR",
  origin: "OTHER_NUCLEAR",
  covers: "Test",
  boundaryConvention: "Test",
  failureCounting: "Test",
  quality: "Test",
  reference: "Test",
  entries: [
    { id: "E-1", component: "Pump", failureMode: "Fail to start", quantity: "PER_DEMAND", law: { family: "BETA", alpha: 0.5, beta: 99.5, lower: 0, upper: 1 } },
    { id: "E-2", component: "Pump", failureMode: "Fail to start", quantity: "PER_DEMAND", law: { family: "BETA", alpha: 1, beta: 99, lower: 0, upper: 1 } },
    { id: "E-3", component: "Pump", failureMode: "Fail to run", quantity: "PER_HOUR", law: { family: "POINT", value: 1e-3 } },
  ],
};

function use(id: string, entryId: string, extra: Partial<DaSourceUse> = {}): DaSourceUse {
  return { id, sourceId: "S-T", entryId, verdict: "APPLIES", boundary: "SAME", reason: "Test", ...extra };
}

function evidence(id: string, extra: Partial<DaEvidence>): DaEvidence {
  return { id, origin: "TECHNOLOGY", failuresFrom: "TYPED", exposureFrom: "TYPED", boundary: "SAME", reason: "Test", included: true, ...extra };
}

function analysis(parameter: DataAnalysisParameter): DataAnalysis {
  return { ...DA_ANALYSIS_HTGR, parameters: [parameter], sources: [SOURCE], elicitations: [], recordSets: [], dataNeeds: undefined };
}

function component(extra: Partial<DataAnalysisParameter>): DataAnalysisParameter {
  return { uuid: "P-T", name: "Test", parameterType: "PROBABILITY", quantificationModel: "DEMAND_PROBABILITY", valueMode: "CALCULATED", sourceUses: [use("U-1", "E-1")], priorUseId: "U-1", implementsSrs: [], ...extra };
}

describe("posterior kinds in Steps 05 and 08", () => {
  it("gives Step 08 empirical Bayes and the shared homogeneity check", async () => {
    const events = [evidence("EV-1", { failures: 0, exposure: 100, unit: "YEARS" }), evidence("EV-2", { failures: 20, exposure: 10, unit: "YEARS" })];
    const part = (method: DaFrequencyPart["method"]): DaFrequencyPart => ({ id: "P1", label: "Whole group", per: "CALENDAR_YEAR", priorForm: "JEFFREYS", method, evidence: events });
    const frequency = (method: DaFrequencyPart["method"]): DataAnalysisParameter => ({ uuid: "F-T", name: "Test", parameterType: "FREQUENCY", quantificationModel: "FREQUENCY", valueMode: "CALCULATED", sourceUses: [], frequency: { parts: [part(method)] }, implementsSrs: [] });
    const updated = analysis(frequency("BAYES"));
    const findings = await settledWithPraxis(() => frequencyFindings(updated));
    expect(findings.map((finding) => finding.check)).toContain("Sets differ");
    const pooled = frequency("EMPIRICAL_BAYES");
    expect(frequencyEstimate(analysis(pooled), pooled).parts[0]?.posterior).toEqual({ family: "EMPIRICAL_BAYES", evidence: [{ likelihood: "POISSON", failures: 0, exposure: 100 }, { likelihood: "POISSON", failures: 20, exposure: 10 }], target: null });
  });
  it("updates a human error probability like a demand probability", async () => {
    expect(holdsEstimate("HUMAN_ERROR")).toBe(true);
    const parameter = component({ parameterType: "HUMAN_ERROR_PROBABILITY", quantificationModel: "HUMAN_ERROR", estimateMethod: "BAYES", evidence: [evidence("EV-1", { failures: 1, exposure: 20, unit: "DEMANDS" })] });
    const da = analysis(parameter);
    const estimate = await settledWithPraxis(() => parameterEstimate(da, parameter));
    expect(estimate.terms).toEqual([{ likelihood: "BINOMIAL", failures: 1, exposure: 20 }]);
    const law = estimate.posterior;
    if (law === undefined) throw new Error(estimate.problem);
    const summary = await settledWithPraxis(() => lawSummary("PROBABILITY", law));
    if (summary.status !== "ready") throw new Error("PRAXIS gave no summary.");
    expect(summary.value.mean).toBeCloseTo(1.5 / 120, 8);
  });

  it("turns standby test demands into standby demand evidence", () => {
    const parameter = component({ parameterType: "FAILURE_RATE", quantificationModel: "STANDBY_RATE", sourceUses: [use("U-1", "E-3")], estimateMethod: "BAYES", evidence: [evidence("EV-1", { failures: 1, exposure: 50, unit: "DEMANDS", testIntervalHours: 720, standbyDemand: "RANDOM" })] });
    expect(parameterEstimate(analysis(parameter), parameter).terms).toEqual([{ likelihood: "STANDBY_DEMAND", demand: "RANDOM", failures: 1, exposure: 50, testInterval: 720 }]);
  });

  it("keeps several possible counts as uncertain count evidence", () => {
    const parameter = component({ estimateMethod: "BAYES", evidence: [evidence("EV-1", { failuresFrom: "UNCERTAIN", failureOutcomes: [{ value: 0, weight: 0.3 }, { value: 1, weight: 0.7 }], exposure: 40, unit: "DEMANDS" })] });
    expect(parameterEstimate(analysis(parameter), parameter).terms).toEqual([{ likelihood: "UNCERTAIN_COUNT", count: "BINOMIAL", outcomes: [{ value: 0, weight: 0.3 }, { value: 1, weight: 0.7 }], exposure: 40 }]);
    const half = [{ value: 0, weight: 1 }, { value: 1, weight: 1 }];
    const counted = recordCount([{ id: "R-1", description: "", judgment: "FAILURE" }, { id: "R-2", description: "", judgment: "FAILURE", countOutcomes: half }, { id: "R-3", description: "", judgment: "FAILURE", countOutcomes: half }]);
    expect(counted).toEqual({ failures: 2, outcomes: [{ value: 1, weight: 0.25 }, { value: 2, weight: 0.5 }, { value: 3, weight: 0.25 }] });
  });

  it("mixes several prior sources by weight", async () => {
    const parameter = component({ sourceUses: [use("U-1", "E-1"), use("U-2", "E-2")], priorParts: [{ useId: "U-1", weight: 3 }, { useId: "U-2", weight: 1 }] });
    const prior = await settledWithPraxis(() => parameterPriorLaw(analysis(parameter), parameter));
    if (prior.status !== "ready") throw new Error("No mixture.");
    const law = prior.value.law;
    expect(law.family === "MIXTURE" ? law.components.map((part) => part.weight) : []).toEqual([3, 1]);
    const summary = await settledWithPraxis(() => lawSummary("PROBABILITY", law));
    if (summary.status !== "ready") throw new Error("PRAXIS gave no summary.");
    expect(summary.value.mean).toBeCloseTo((3 * 0.005 + 0.01) / 4, 8);
  });

  it("multiplies a factor law into a scaled source", async () => {
    const scaled = use("U-1", "E-3", { verdict: "SCALED", factors: [{ id: "F-1", name: "Service", nominal: 1, low: 0.5, high: 4, basis: "Test" }] });
    const state = await settledWithPraxis(() => sourceUseLaw(analysis(component({ sourceUses: [scaled] })), scaled));
    if (state.status !== "ready" || state.value.law.family !== "PRODUCT") throw new Error("No product law.");
    const law = state.value.law;
    expect(law.factors[0]).toEqual({ family: "POINT", value: 1e-3 });
    const summary = await settledWithPraxis(() => lawSummary("PER_HOUR", law));
    if (summary.status !== "ready") throw new Error("PRAXIS gave no summary.");
    [[0.05, 5e-4], [0.5, 1e-3], [0.95, 4e-3]].forEach(([probability = 0, value = 1]) => expect((quantileOf(summary.value, probability) ?? 0) / value).toBeCloseTo(1, 9));
  });

  it("fits each expert's three percentiles with a metalog", async () => {
    const law = elicitationLaw({ id: "EJ-1", issue: "", objective: "", quantity: "PER_DEMAND", importance: "LOW", complexity: "LOW", structure: "SINGLE_EVALUATOR", experts: [{ id: "X-1", name: "A", role: "EVALUATOR", outside: false, expertise: "", p05: 1e-4, median: 1e-3, p95: 2e-2, acceptsResponsibility: true }], pooling: "LINEAR", integrator: "A", responsibility: "INTEGRATOR" });
    if (law.status !== "ready") throw new Error("No judgment law.");
    expect(law.law).toEqual({ family: "METALOG", points: [{ probability: 0.05, value: 1e-4 }, { probability: 0.5, value: 1e-3 }, { probability: 0.95, value: 2e-2 }], lower: 0, upper: 1 });
    const summary = await settledWithPraxis(() => lawSummary("PROBABILITY", law.law));
    if (summary.status !== "ready") throw new Error("PRAXIS gave no summary.");
    expect(quantileOf(summary.value, 0.5)).toBeCloseTo(1e-3, 9);
    expect(quantileOf(summary.value, 0.95)).toBeCloseTo(2e-2, 9);
  });

  it("builds empirical Bayes over the chosen sets and a loglinear trend", () => {
    const sets = [evidence("EV-1", { failures: 2, exposure: 1e4, unit: "HOURS" }), evidence("EV-2", { failures: 5, exposure: 2e4, unit: "HOURS" })];
    const pooled = component({ parameterType: "FAILURE_RATE", quantificationModel: "RUNNING_RATE", sourceUses: [use("U-1", "E-3")], estimateMethod: "EMPIRICAL_BAYES", populationTargetId: "EV-2", evidence: sets });
    expect(parameterEstimate(analysis(pooled), pooled).posterior).toEqual({ family: "EMPIRICAL_BAYES", evidence: [{ likelihood: "POISSON", failures: 2, exposure: 1e4 }, { likelihood: "POISSON", failures: 5, exposure: 2e4 }], target: 1 });
    const trend = component({ parameterType: "FAILURE_RATE", quantificationModel: "RUNNING_RATE", sourceUses: [use("U-1", "E-3")], estimateMethod: "TREND", trend: { failuresFrom: "TYPED", bins: [{ year: 2020, failures: 4, exposure: 8760 }, { year: 2021, failures: 2, exposure: 8760 }], at: 2022 } });
    expect(parameterEstimate(analysis(trend), trend).posterior).toEqual({ family: "TREND", bins: [{ time: 2020, failures: 4, exposure: 8760 }, { time: 2021, failures: 2, exposure: 8760 }], at: 2022 });
  });

});
