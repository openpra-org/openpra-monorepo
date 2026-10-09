import type { EvidenceTerm, Law } from "interfaces-mef-types/core/uncertainty";
import type { UncertaintyOperation } from "interfaces-shared-types/newly-developed-methods/shared";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { praxisUncertainty, settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";
import { lawSummary, operationAnswer, quantileOf } from "../daLaws";

jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

beforeEach(() => {
  jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
});

function close(actual: number | undefined, expected: number, tolerance: number): void {
  expect(actual).toBeDefined();
  expect(Math.abs((actual ?? 0) - expected) / Math.abs(expected)).toBeLessThan(tolerance);
}

async function answer(operation: UncertaintyOperation): Promise<Record<string, number | boolean>> {
  const state = await settledWithPraxis(() => operationAnswer(operation));
  if (state.status !== "ready") throw new Error(state.status === "failed" ? state.error : "PRAXIS is still working.");
  const result: Record<string, number | boolean> = {};
  for (const [key, value] of Object.entries(state.value)) {
    if (typeof value === "number" || typeof value === "boolean") result[key] = value;
  }
  return result;
}

function poisson(failures: number, exposure: number): EvidenceTerm {
  return { likelihood: "POISSON", failures, exposure };
}

function binomial(failures: number, exposure: number): EvidenceTerm {
  return { likelihood: "BINOMIAL", failures, exposure };
}

describe("DA statistics in PRAXIS", () => {
  it("checks a prior against the evidence with its predictive distribution", async () => {
    const start: Law = { family: "BETA", alpha: 0.881, beta: 394.2, lower: 0, upper: 1 };
    close(Number((await answer({ kind: "PRIOR_PREDICTIVE", law: start, term: binomial(0, 80) })).atMost), 0.8497564696, 1e-6);
    const run: Law = { family: "GAMMA", shape: 1.655, rate: 3.649e5 };
    close(Number((await answer({ kind: "PRIOR_PREDICTIVE", law: run, term: poisson(1, 130000) })).atLeast), 0.3960912004, 1e-6);
    const published: Law = { family: "GAMMA", shape: 90.5, rate: 785000 };
    close(Number((await answer({ kind: "PRIOR_PREDICTIVE", law: published, term: poisson(2, 253886) })).atMost), 2.620015845e-9, 1e-6);
    const constrained: Law = { family: "GAMMA", shape: 0.5, rate: 0.5 / (90.5 / 785000) };
    close(Number((await answer({ kind: "PRIOR_PREDICTIVE", law: constrained, term: poisson(2, 253886) })).atMost), 0.2402889812, 1e-6);
    const lognormal: Law = { family: "LOGNORMAL", mean: 2.40022e-7 * 1095 * Math.exp((Math.log(3) / 1.6448536269514722) ** 2 / 2), errorFactor: 3, level: 0.95 };
    close(Number((await answer({ kind: "PRIOR_PREDICTIVE", law: lognormal, term: poisson(0, 975000 / 1095) })).atMost), 0.7617692983, 1e-4);
  });

  it("tests pooling and trend", async () => {
    const pooled = await answer({ kind: "HOMOGENEITY", terms: [poisson(2, 1e5), poisson(9, 2e5), poisson(4, 1.5e5)] });
    close(Number(pooled.statistic), 1.55, 1e-12);
    close(Number(pooled.probability), 0.460703781, 1e-8);
    expect(pooled.smallExpected).toBe(true);
    const shared = await answer({ kind: "HOMOGENEITY", terms: [binomial(1, 100), binomial(5, 200), binomial(0, 150)] });
    close(Number(shared.statistic), 4.180743243, 1e-9);
    close(Number(shared.probability), 0.1236411795, 1e-8);
    expect(shared.smallExpected).toBe(true);
    const trend = await answer({ kind: "LAPLACE_TREND", times: [0.6, 1.6, 2.5, 2.9, 3.5, 3.6, 4.2, 4.7, 7.2, 8.0, 9.4, 12.0, 12.9, 13.0, 15.6], start: 0, end: 16 });
    close(Number(trend.statistic), -1.0230011, 1e-6);
    close(Number(trend.probability), 0.3063073259, 1e-8);
  });

  it("matches an independent high-resolution solution of the population model", async () => {
    const sites = [[0, 247854], [13, 3265653], [3, 9504], [11, 1149701], [4, 220825], [0, 17966], [4, 1114484], [4, 2708559]];
    const evidence = sites.map(([failures, exposure]) => poisson(failures ?? 0, exposure ?? 1));
    const centers = evidence.map((term) => Math.log((term.failures + 0.5) / term.exposure));
    const hyper = { mu: { family: "UNIFORM" as const, lower: Math.min(...centers) - 5, upper: Math.max(...centers) + 5 }, sigma: { family: "UNIFORM" as const, lower: 0.025, upper: 3 } };
    const predictive = await settledWithPraxis(() => lawSummary("PER_HOUR", { family: "POPULATION", ...hyper, upper: null, evidence, target: null }));
    if (predictive.status !== "ready") throw new Error(predictive.status === "failed" ? predictive.error : "PRAXIS is still working.");
    close(predictive.value.mean, 0.0001133816653, 5e-3);
    close(quantileOf(predictive.value, 0.05), 1.56960431e-7, 5e-3);
    close(quantileOf(predictive.value, 0.5), 5.845798106e-6, 5e-3);
    close(quantileOf(predictive.value, 0.95), 0.0001905266298, 5e-3);
    const target = await settledWithPraxis(() => lawSummary("PER_HOUR", { family: "POPULATION", ...hyper, upper: null, evidence, target: 3 }));
    if (target.status !== "ready") throw new Error(target.status === "failed" ? target.error : "PRAXIS is still working.");
    close(target.value.mean, 9.439968107e-6, 5e-3);
    close(quantileOf(target.value, 0.05), 5.323729508e-6, 5e-3);
    close(quantileOf(target.value, 0.95), 1.45295778e-5, 5e-3);
  }, 300000);
});
