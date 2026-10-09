import { DistributionType } from "interfaces-mef-types/core/events";
import { distributionCdf, distributionDensity, distributionMean, distributionQuantile, judgmentComponent, normalCdf, poolJudgments, scaleDistribution, type LogComponent } from "../daDistributions";

function close(actual: number | undefined, expected: number, tolerance = 1e-3): void {
  expect(actual).toBeDefined();
  expect(Math.abs((actual ?? 0) - expected) / Math.abs(expected)).toBeLessThan(tolerance);
}

describe("distribution math", () => {
  it("matches reference densities and cumulative probabilities", () => {
    const beta = { type: DistributionType.BETA as const, alpha: 0.638, betaParam: 3380 };
    const gamma = { type: DistributionType.GAMMA as const, shape: 1.26, rate: 7.17e6 };
    const lognormal = { type: DistributionType.LOGNORMAL as const, median: 1.126e-5, errorFactor: 10 };
    const normal = { type: DistributionType.NORMAL as const, mean: 0.0151, stdDev: 0.00704 };
    close(distributionDensity(beta, 1e-4), 2535.424209712059);
    close(distributionCdf(beta, 1e-4), 0.4909392681563966);
    close(distributionDensity(gamma, 1e-7), 3549815.839936974);
    close(distributionCdf(gamma, 1e-7), 0.3945879010017213);
    close(distributionDensity(lognormal, 3e-5), 7435.183468152738);
    close(distributionCdf(lognormal, 3e-5), 0.758043066729928);
    close(distributionDensity(normal, 0.02), 44.47755843638533);
    close(distributionCdf(normal, 0.02), 0.7567927015915814);
    expect(distributionDensity({ type: DistributionType.POINT_ESTIMATE, value: 1e-3 }, 1e-3)).toBeUndefined();
    expect(distributionCdf({ type: DistributionType.POINT_ESTIMATE, value: 1e-3 }, 2e-3)).toBe(1);
  });

  it("matches published and reference percentiles", () => {
    const pumpRun = { type: DistributionType.GAMMA, shape: 1.655, rate: 3.649e5 } as const;
    close(distributionMean(pumpRun), 4.5355e-6);
    close(distributionQuantile(pumpRun, 0.05), 6.2109e-7);
    close(distributionQuantile(pumpRun, 0.95), 1.14355e-5);
    const pumpStart = { type: DistributionType.BETA, alpha: 0.881, betaParam: 394.2 } as const;
    close(distributionQuantile(pumpStart, 0.05), 8.17507e-5);
    close(distributionQuantile(pumpStart, 0.95), 6.98019e-3);
    const valveClose = { type: DistributionType.BETA, alpha: 0.638, betaParam: 3380 } as const;
    close(distributionQuantile(valveClose, 0.05), 2.29596e-6);
    close(distributionQuantile(valveClose, 0.5), 1.03619e-4);
    close(distributionQuantile(valveClose, 0.95), 6.64159e-4);
    const jeffreys = { type: DistributionType.GAMMA, shape: 0.5, rate: 6.22e6 } as const;
    close(distributionQuantile(jeffreys, 0.05), 3.16088e-10);
    close(distributionQuantile(jeffreys, 0.95), 3.08799e-7);
    close(normalCdf(1), 0.841345, 1e-6);
    close(normalCdf(-2.5), 0.00620967, 1e-5);
  });

  it("matches reference Weibull and exponential values", () => {
    const weibull = { type: DistributionType.WEIBULL, scale: 2, shape: 1.5, location: 0 } as const;
    close(distributionMean(weibull), 1.805490585901867);
    close(distributionQuantile(weibull, 0.05), 0.2761025331125684);
    close(distributionQuantile(weibull, 0.95), 4.156221275069113);
    close(distributionCdf(weibull, 1), 0.29781149867344037);
    close(distributionDensity(weibull, 1), 0.37239168821942203);
    const shifted = { type: DistributionType.WEIBULL, scale: 1.3, shape: 0.7, location: 0.25 } as const;
    close(distributionMean(shifted), 1.8955705578744686);
    close(distributionQuantile(shifted, 0.5), 1.0201071468377738);
    close(distributionCdf(shifted, 1), 0.49360007971749176);
    close(distributionDensity(shifted, 1), 0.3215977066061188);
    expect(distributionDensity(shifted, 0.2)).toBe(0);
    const exponential = { type: DistributionType.EXPONENTIAL, failureRate: 0.5 } as const;
    close(distributionMean(exponential), 2);
    close(distributionQuantile(exponential, 0.05), 0.10258658877510107);
    close(distributionQuantile(exponential, 0.95), 5.99146454710798);
    close(distributionCdf(exponential, 1), 0.3934693402873666);
    close(distributionDensity(exponential, 1), 0.3032653298563167);
    close(distributionMean(scaleDistribution(weibull, 3) ?? weibull), 3 * 1.805490585901867);
    close(distributionMean(scaleDistribution(exponential, 3) ?? exponential), 6);
  });

  it("scales a distribution and keeps its shape", () => {
    expect(scaleDistribution({ type: DistributionType.GAMMA, shape: 2.5, rate: 360 }, 2)).toEqual({ type: DistributionType.GAMMA, shape: 2.5, rate: 180 });
    expect(scaleDistribution({ type: DistributionType.LOGNORMAL, median: 1e-5, errorFactor: 3 }, 10)).toEqual({ type: DistributionType.LOGNORMAL, median: 1e-4, errorFactor: 3 });
    const beta = scaleDistribution({ type: DistributionType.BETA, alpha: 1.2, betaParam: 15.9 }, 2);
    close(beta === undefined ? undefined : distributionMean(beta), 2 * (1.2 / 17.1));
    expect(scaleDistribution({ type: DistributionType.BETA, alpha: 1.2, betaParam: 15.9 }, 20)).toBeUndefined();
  });

  it("pools expert judgments", () => {
    const parts = [judgmentComponent(1e-3, 3e-3, 1e-2, 1), judgmentComponent(5e-4, 2e-3, 8e-3, 1), judgmentComponent(2e-3, 5e-3, 2e-2, 1)].filter((part): part is LogComponent => part !== undefined);
    const linear = poolJudgments(parts, "LINEAR");
    close(linear?.mean, 4.35778e-3);
    close(linear?.p05, 7.51258e-4);
    close(linear?.median, 3.17769e-3);
    close(linear?.p95, 1.18813e-2);
    close(linear === undefined ? undefined : distributionMean(linear.distribution), 4.35778e-3);
    const logarithmic = poolJudgments(parts, "LOGARITHMIC");
    close(logarithmic?.mean, 4.29639e-3);
    close(logarithmic?.median, 3.26925e-3);
    close(logarithmic?.p95, 1.10282e-2);
    expect(judgmentComponent(3e-3, 2e-3, 1e-2, 1)).toBeUndefined();
  });
});
