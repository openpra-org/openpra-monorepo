import { DistributionType } from "interfaces-mef-types/core/events";
import { betaFromMoments, constrainedNoninformative } from "../daEstimates";

describe("restoration estimate helpers", () => {
  it("keeps a mean in a constrained noninformative prior", () => {
    expect(constrainedNoninformative(90.5 / 785000, "RATE")).toEqual({ type: DistributionType.GAMMA, shape: 0.5, rate: 0.5 / (90.5 / 785000) });
    expect(constrainedNoninformative(0.01, "PROBABILITY")).toEqual({ type: DistributionType.BETA, alpha: 0.5, betaParam: 49.5 });
    expect(constrainedNoninformative(1, "PROBABILITY")).toBeUndefined();
  });

  it("matches a beta to a mean and variance", () => {
    const beta = betaFromMoments(0.1, 0.0009);
    if (beta?.type !== DistributionType.BETA) throw new Error("A beta is expected.");
    expect(beta.alpha / (beta.alpha + beta.betaParam)).toBeCloseTo(0.1, 12);
    expect((beta.alpha * beta.betaParam) / ((beta.alpha + beta.betaParam) ** 2 * (beta.alpha + beta.betaParam + 1))).toBeCloseTo(0.0009, 12);
    expect(betaFromMoments(0.1, 1)).toBeUndefined();
  });
});
