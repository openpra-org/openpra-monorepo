import { DistributionType, type ParameterDistribution } from "interfaces-mef-types/core/events";
import { shapeMean, shapeQuantile, type DaShape } from "../daDistributions";
import { bayesUpdate, conflictProbability, constrainedNoninformative, laplaceTest, outputFor, poolTest, populationUpdate, predictive, priorWeight } from "../daEstimates";

function close(actual: number | undefined, expected: number, tolerance = 1e-3): void {
  expect(actual).toBeDefined();
  expect(Math.abs((actual ?? 0) - expected) / Math.abs(expected)).toBeLessThan(tolerance);
}

function summaryOf(shape: DaShape | undefined): { mean?: number; p05?: number; p50?: number; p95?: number } {
  if (shape === undefined) return {};
  return { mean: shapeMean(shape), p05: shapeQuantile(shape, 0.05), p50: shapeQuantile(shape, 0.5), p95: shapeQuantile(shape, 0.95) };
}

describe("estimate engine", () => {
  it("updates the EPRI pump priors exactly and checks them against the evidence", () => {
    const start: ParameterDistribution = { type: DistributionType.BETA, alpha: 0.881, betaParam: 394.2 };
    const started = bayesUpdate({ kind: "PROPER", shape: start }, [{ kind: "BINOMIAL", failures: 0, exposure: 80 }], "PROBABILITY");
    expect(started?.computation).toBe("CONJUGATE");
    const startSummary = summaryOf(started?.shape);
    close(startSummary.mean, 0.001854420615);
    close(startSummary.p05, 6.79576863e-5);
    close(startSummary.p95, 0.005805871094);
    const startCheck = predictive(start, { kind: "BINOMIAL", failures: 0, exposure: 80 }, "PROBABILITY");
    close(startCheck?.low, 0.8497564696);
    const run: ParameterDistribution = { type: DistributionType.GAMMA, shape: 1.655, rate: 3.649e5 };
    const ran = bayesUpdate({ kind: "PROPER", shape: run }, [{ kind: "POISSON", failures: 1, exposure: 130000 }], "RATE");
    close(ran === undefined ? undefined : shapeMean(ran.shape), 5.364720145e-6);
    const runCheck = predictive(run, { kind: "POISSON", failures: 1, exposure: 130000 }, "RATE");
    close(runCheck === undefined ? undefined : conflictProbability(runCheck, 1), 0.3960912004);
    const mission = ran === undefined ? undefined : outputFor(ran.shape, 24);
    close(mission?.summary.mean, 0.0001287418737);
    close(mission?.summary.p05, 3.133122766e-5, 3e-3);
    close(mission?.summary.p95, 0.0002799619947, 3e-3);
    expect(mission?.fit).toBe("RARE_EVENT");
    const stored = mission?.distribution;
    expect(stored?.type).toBe(DistributionType.GAMMA);
    if (stored?.type === DistributionType.GAMMA) {
      close(stored.shape, 2.655, 1e-12);
      close(stored.rate, (3.649e5 + 130000) / 24, 1e-12);
    }
  });

  it("flags a narrow prior that the evidence contradicts and keeps its mean in a constrained noninformative prior", () => {
    const published: ParameterDistribution = { type: DistributionType.GAMMA, shape: 90.5, rate: 785000 };
    const evidence = { kind: "POISSON" as const, failures: 2, exposure: 253886 };
    const strict = predictive(published, evidence, "RATE");
    close(strict === undefined ? undefined : conflictProbability(strict, 2), 2.620015845e-9);
    const cni = constrainedNoninformative(90.5 / 785000, "RATE");
    expect(cni).toEqual({ type: DistributionType.GAMMA, shape: 0.5, rate: 0.5 / (90.5 / 785000) });
    const relaxed = cni === undefined ? undefined : predictive(cni, evidence, "RATE");
    close(relaxed === undefined ? undefined : conflictProbability(relaxed, 2), 0.2402889812);
    const updated = cni === undefined ? undefined : bayesUpdate({ kind: "PROPER", shape: cni }, [evidence], "RATE");
    close(updated === undefined ? undefined : shapeMean(updated.shape), 9.681553694e-6);
    expect(constrainedNoninformative(0.01, "PROBABILITY")).toEqual({ type: DistributionType.BETA, alpha: 0.5, betaParam: 49.5 });
    expect(priorWeight(published, "RATE")).toBe(785000);
    close(priorWeight({ type: DistributionType.LOGNORMAL, median: 1e-4, errorFactor: 3 }, "RATE"), 1 / (1e-4 * Math.exp((Math.log(3) / 1.6448536269514722) ** 2 / 2) * (Math.exp((Math.log(3) / 1.6448536269514722) ** 2) - 1)));
  });

  it("integrates a lognormal prior with zero failures numerically and keeps a fitted output honest", () => {
    const prior: ParameterDistribution = { type: DistributionType.LOGNORMAL, median: 2.40022e-7 * 1095, errorFactor: 3 };
    const evidence = { kind: "POISSON" as const, failures: 0, exposure: 975000 / 1095 };
    const updated = bayesUpdate({ kind: "PROPER", shape: prior }, [evidence], "PROBABILITY");
    expect(updated?.computation).toBe("NUMERICAL");
    const summary = summaryOf(updated?.shape);
    close(summary.mean, 0.0002859637148, 2e-4);
    close(summary.p05, 8.183340524e-5, 2e-3);
    close(summary.p50, 0.0002360895993, 2e-3);
    close(summary.p95, 0.0006582956426, 2e-3);
    const check = predictive(prior, evidence, "PROBABILITY");
    close(check?.low, 0.7617692983, 1e-4);
    const output = updated === undefined ? undefined : outputFor(updated.shape, undefined);
    expect(output?.fit).toBe("LOGNORMAL");
    close(output === undefined ? undefined : shapeMean(output.distribution), 0.0002859637148, 2e-4);
    const betaPoisson = bayesUpdate({ kind: "PROPER", shape: { type: DistributionType.BETA, alpha: 0.5, betaParam: 656.5 } }, [{ kind: "POISSON", failures: 1, exposure: 2000 }], "PROBABILITY");
    expect(betaPoisson?.computation).toBe("NUMERICAL");
    close(betaPoisson === undefined ? undefined : shapeMean(betaPoisson.shape), 0.0005647340038, 1e-3);
  });

  it("tests pooling and trend", () => {
    const poisson = poolTest([{ kind: "POISSON", failures: 2, exposure: 1e5 }, { kind: "POISSON", failures: 9, exposure: 2e5 }, { kind: "POISSON", failures: 4, exposure: 1.5e5 }]);
    close(poisson?.statistic, 1.55);
    close(poisson?.p, 0.460703781, 1e-5);
    expect(poisson?.small).toBe(true);
    const binomial = poolTest([{ kind: "BINOMIAL", failures: 1, exposure: 100 }, { kind: "BINOMIAL", failures: 5, exposure: 200 }, { kind: "BINOMIAL", failures: 0, exposure: 150 }]);
    close(binomial?.statistic, 4.180743243);
    close(binomial?.p, 0.1236411795, 1e-5);
    expect(binomial?.small).toBe(true);
    const trend = laplaceTest([0.6, 1.6, 2.5, 2.9, 3.5, 3.6, 4.2, 4.7, 7.2, 8.0, 9.4, 12.0, 12.9, 13.0, 15.6], 0, 16);
    close(trend?.u, -1.0230011, 1e-6);
    close(trend?.p, 0.3063073259, 1e-4);
    expect(laplaceTest([1, 2], 0, 16)).toBeUndefined();
  });

  it("matches an independent high-resolution solution of the population model", () => {
    const sites = [[0, 247854], [13, 3265653], [3, 9504], [11, 1149701], [4, 220825], [0, 17966], [4, 1114484], [4, 2708559]];
    const terms = sites.map(([failures, exposure]) => ({ kind: "POISSON" as const, failures: failures ?? 0, exposure: exposure ?? 1 }));
    const population = populationUpdate(terms, "RATE", 3);
    const predictiveSummary = summaryOf(population?.predictive);
    close(predictiveSummary.mean, 0.0001133816653, 5e-3);
    close(predictiveSummary.p05, 1.56960431e-7, 5e-3);
    close(predictiveSummary.p50, 5.845798106e-6, 5e-3);
    close(predictiveSummary.p95, 0.0001905266298, 5e-3);
    const target = summaryOf(population?.target);
    close(target.mean, 9.439968107e-6, 5e-3);
    close(target.p05, 5.323729508e-6, 5e-3);
    close(target.p95, 1.45295778e-5, 5e-3);
    expect(populationUpdate([{ kind: "POISSON", failures: 0, exposure: 1e5 }, { kind: "POISSON", failures: 0, exposure: 2e5 }], "RATE")).toBeUndefined();
  });
});
