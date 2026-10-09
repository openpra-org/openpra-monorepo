import { DistributionType, type ParameterDistribution } from "interfaces-mef-types/core/events";

type DaScale = "PROBABILITY" | "RATE";

function betaFromMoments(mean: number, variance: number): ParameterDistribution | undefined {
  if (!(mean > 0 && mean < 1 && variance > 0)) return undefined;
  const common = (mean * (1 - mean)) / variance - 1;
  if (!(common > 0)) return undefined;
  return { type: DistributionType.BETA, alpha: mean * common, betaParam: (1 - mean) * common };
}

function constrainedNoninformative(mean: number, scale: DaScale): ParameterDistribution | undefined {
  if (!(mean > 0)) return undefined;
  if (scale === "RATE") return { type: DistributionType.GAMMA, shape: 0.5, rate: 0.5 / mean };
  if (!(mean < 1)) return undefined;
  return { type: DistributionType.BETA, alpha: 0.5, betaParam: (0.5 * (1 - mean)) / mean };
}

export { betaFromMoments, constrainedNoninformative, type DaScale };
