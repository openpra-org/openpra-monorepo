import { DistributionType, type ParameterDistribution } from "./events";
import { lawWithinUnit, type Law, type UncertainExpression, type UncertainUnit, type UncertainValue } from "./uncertainty";

const LEGACY_LEVEL = 0.95;

const LEGACY_Z95 = 1.6448536269514722;

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function legacyLognormalMean(median: number, errorFactor: number): number {
  const sigma = Math.log(errorFactor) / LEGACY_Z95;
  return median * Math.exp((sigma * sigma) / 2);
}

function legacyLaw(distribution: ParameterDistribution): Law | undefined {
  switch (distribution.type) {
    case DistributionType.BETA:
      return finitePositive(distribution.alpha) && finitePositive(distribution.betaParam)
        ? { family: "BETA", alpha: distribution.alpha, beta: distribution.betaParam, lower: 0, upper: 1 }
        : undefined;
    case DistributionType.GAMMA:
      return finitePositive(distribution.shape) && finitePositive(distribution.rate)
        ? { family: "GAMMA", shape: distribution.shape, rate: distribution.rate }
        : undefined;
    case DistributionType.LOGNORMAL:
      if (!finitePositive(distribution.median) || !Number.isFinite(distribution.errorFactor) || distribution.errorFactor < 1) return undefined;
      return distribution.errorFactor === 1
        ? { family: "POINT", value: distribution.median }
        : { family: "LOGNORMAL", mean: legacyLognormalMean(distribution.median, distribution.errorFactor), errorFactor: distribution.errorFactor, level: LEGACY_LEVEL };
    case DistributionType.NORMAL:
      if (!Number.isFinite(distribution.mean) || !Number.isFinite(distribution.stdDev) || distribution.stdDev < 0) return undefined;
      return distribution.stdDev === 0
        ? { family: "POINT", value: distribution.mean }
        : { family: "NORMAL", mean: distribution.mean, standardDeviation: distribution.stdDev };
    case DistributionType.UNIFORM:
      return Number.isFinite(distribution.lower) && Number.isFinite(distribution.upper) && distribution.lower < distribution.upper
        ? { family: "UNIFORM", lower: distribution.lower, upper: distribution.upper }
        : undefined;
    case DistributionType.EXPONENTIAL:
      return finitePositive(distribution.failureRate) ? { family: "GAMMA", shape: 1, rate: distribution.failureRate } : undefined;
    case DistributionType.WEIBULL:
      return finitePositive(distribution.scale) && finitePositive(distribution.shape) && Number.isFinite(distribution.location)
        ? { family: "WEIBULL", scale: distribution.scale, shape: distribution.shape, location: distribution.location }
        : undefined;
    case DistributionType.POINT_ESTIMATE:
      return Number.isFinite(distribution.value) ? { family: "POINT", value: distribution.value } : undefined;
    default:
      return undefined;
  }
}

function legacyValue(unit: UncertainUnit, law: Law): UncertainValue {
  return { unit, law: lawWithinUnit(unit, law) };
}

function legacyExpression(unit: UncertainUnit, point: number, errorFactor?: number): UncertainExpression {
  const law: Law = errorFactor !== undefined && Number.isFinite(errorFactor) && errorFactor > 1 && finitePositive(point)
    ? { family: "LOGNORMAL", mean: point, errorFactor, level: LEGACY_LEVEL }
    : { family: "POINT", value: point };
  return { node: "VALUE", value: legacyValue(unit, law) };
}

function legacyDistributionExpression(unit: UncertainUnit, distribution: ParameterDistribution): UncertainExpression | undefined {
  const law = legacyLaw(distribution);
  return law === undefined ? undefined : { node: "VALUE", value: legacyValue(unit, law) };
}

function legacyUpperPercentile(point: number, errorFactor: number): number {
  const sigma = Math.log(errorFactor) / LEGACY_Z95;
  return point * Math.exp(LEGACY_Z95 * sigma - (sigma * sigma) / 2);
}

export { legacyDistributionExpression, legacyExpression, legacyLaw, legacyUpperPercentile, legacyValue };
