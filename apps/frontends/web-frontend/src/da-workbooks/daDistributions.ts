import { DistributionType, type ParameterDistribution } from "interfaces-mef-types/core/events";

const Z95 = 1.6448536269514722;

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

function lnGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  const z = x - 1;
  let sum = LANCZOS[0] ?? 0;
  for (let i = 1; i < LANCZOS.length; i += 1) sum += (LANCZOS[i] ?? 0) / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(sum);
}

function gammaSeries(a: number, x: number): number {
  let term = 1 / a;
  let sum = term;
  for (let n = 1; n < 1000; n += 1) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
}

function gammaFraction(a: number, x: number): number {
  let b = x + 1 - a;
  let c = 1 / 1e-300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 1000; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}

function gammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  return x < a + 1 ? gammaSeries(a, x) : 1 - gammaFraction(a, x);
}

function gammaQ(a: number, x: number): number {
  if (x <= 0) return 1;
  return x < a + 1 ? 1 - gammaSeries(a, x) : gammaFraction(a, x);
}

function betaContinuedFraction(x: number, a: number, b: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < 1e-300) d = 1e-300;
  d = 1 / d;
  let h = d;
  for (let m = 1; m < 1000; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return h;
}

function betaP(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (front * betaContinuedFraction(x, a, b)) / a;
  return 1 - (front * betaContinuedFraction(1 - x, b, a)) / b;
}

function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.5 * x);
  const erfc =
    t *
    Math.exp(
      -x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return z >= 0 ? 1 - erfc / 2 : erfc / 2;
}

function normalQuantile(p: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const at = (arr: number[], i: number): number => arr[i] ?? 0;
  if (p <= 0) return Number.NEGATIVE_INFINITY;
  if (p >= 1) return Number.POSITIVE_INFINITY;
  if (p < 0.02425) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((at(c, 0) * q + at(c, 1)) * q + at(c, 2)) * q + at(c, 3)) * q + at(c, 4)) * q + at(c, 5)) / ((((at(d, 0) * q + at(d, 1)) * q + at(d, 2)) * q + at(d, 3)) * q + 1);
  }
  if (p > 1 - 0.02425) return -normalQuantile(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return ((((((at(a, 0) * r + at(a, 1)) * r + at(a, 2)) * r + at(a, 3)) * r + at(a, 4)) * r + at(a, 5)) * q) / (((((at(b, 0) * r + at(b, 1)) * r + at(b, 2)) * r + at(b, 3)) * r + at(b, 4)) * r + 1);
}

function invert(cdf: (x: number) => number, p: number, lower: number, upper: number): number {
  let lo = lower;
  let hi = upper;
  for (let i = 0; i < 200; i += 1) {
    const mid = lo > 0 && hi / lo > 10 ? Math.sqrt(lo * hi) : (lo + hi) / 2;
    if (cdf(mid) < p) lo = mid;
    else hi = mid;
    if (hi - lo <= 1e-12 * hi) break;
  }
  return (lo + hi) / 2;
}

function gammaQuantile(p: number, shape: number, rate: number): number {
  const mean = shape / rate;
  let upper = mean * 10 + 10 / rate;
  while (gammaP(shape, upper * rate) < p) upper *= 10;
  return invert((x) => gammaP(shape, x * rate), p, 1e-300, upper);
}

function betaQuantile(p: number, a: number, b: number): number {
  return invert((x) => betaP(x, a, b), p, 1e-300, 1);
}

function lognormalSigma(errorFactor: number): number {
  return Math.log(errorFactor) / Z95;
}

function validDistribution(d: ParameterDistribution): boolean {
  switch (d.type) {
    case DistributionType.BETA: return d.alpha > 0 && d.betaParam > 0;
    case DistributionType.GAMMA: return d.shape > 0 && d.rate > 0;
    case DistributionType.LOGNORMAL: return d.median > 0 && d.errorFactor >= 1;
    case DistributionType.NORMAL: return d.stdDev >= 0;
    case DistributionType.UNIFORM: return d.upper >= d.lower;
    case DistributionType.WEIBULL: return d.scale > 0 && d.shape > 0 && Number.isFinite(d.location);
    case DistributionType.EXPONENTIAL: return d.failureRate > 0;
    case DistributionType.POINT_ESTIMATE: return Number.isFinite(d.value);
    default: return false;
  }
}

function distributionMean(d: ParameterDistribution): number | undefined {
  if (!validDistribution(d)) return undefined;
  switch (d.type) {
    case DistributionType.BETA: return d.alpha / (d.alpha + d.betaParam);
    case DistributionType.GAMMA: return d.shape / d.rate;
    case DistributionType.LOGNORMAL: return d.median * Math.exp(lognormalSigma(d.errorFactor) ** 2 / 2);
    case DistributionType.NORMAL: return d.mean;
    case DistributionType.UNIFORM: return (d.lower + d.upper) / 2;
    case DistributionType.WEIBULL: return d.location + d.scale * Math.exp(lnGamma(1 + 1 / d.shape));
    case DistributionType.EXPONENTIAL: return 1 / d.failureRate;
    case DistributionType.POINT_ESTIMATE: return d.value;
    default: return undefined;
  }
}

function distributionVariance(d: ParameterDistribution): number | undefined {
  if (!validDistribution(d)) return undefined;
  switch (d.type) {
    case DistributionType.BETA: {
      const total = d.alpha + d.betaParam;
      return (d.alpha * d.betaParam) / (total * total * (total + 1));
    }
    case DistributionType.GAMMA: return d.shape / (d.rate * d.rate);
    case DistributionType.LOGNORMAL: {
      const sigma = lognormalSigma(d.errorFactor);
      return d.median * d.median * Math.exp(sigma * sigma) * (Math.exp(sigma * sigma) - 1);
    }
    case DistributionType.NORMAL: return d.stdDev * d.stdDev;
    case DistributionType.UNIFORM: return (d.upper - d.lower) ** 2 / 12;
    case DistributionType.WEIBULL: return d.scale * d.scale * (Math.exp(lnGamma(1 + 2 / d.shape)) - Math.exp(2 * lnGamma(1 + 1 / d.shape)));
    case DistributionType.EXPONENTIAL: return 1 / (d.failureRate * d.failureRate);
    case DistributionType.POINT_ESTIMATE: return 0;
    default: return undefined;
  }
}

function distributionQuantile(d: ParameterDistribution, p: number): number | undefined {
  if (!validDistribution(d)) return undefined;
  switch (d.type) {
    case DistributionType.BETA: return betaQuantile(p, d.alpha, d.betaParam);
    case DistributionType.GAMMA: return gammaQuantile(p, d.shape, d.rate);
    case DistributionType.LOGNORMAL: return d.median * Math.exp(lognormalSigma(d.errorFactor) * normalQuantile(p));
    case DistributionType.NORMAL: return d.mean + d.stdDev * normalQuantile(p);
    case DistributionType.UNIFORM: return d.lower + (d.upper - d.lower) * p;
    case DistributionType.WEIBULL: return d.location + d.scale * Math.pow(-Math.log(1 - p), 1 / d.shape);
    case DistributionType.EXPONENTIAL: return -Math.log(1 - p) / d.failureRate;
    case DistributionType.POINT_ESTIMATE: return d.value;
    default: return undefined;
  }
}

function distributionDensity(d: ParameterDistribution, x: number): number | undefined {
  if (!validDistribution(d)) return undefined;
  switch (d.type) {
    case DistributionType.BETA: return x <= 0 || x >= 1 ? 0 : Math.exp((d.alpha - 1) * Math.log(x) + (d.betaParam - 1) * Math.log(1 - x) + lnGamma(d.alpha + d.betaParam) - lnGamma(d.alpha) - lnGamma(d.betaParam));
    case DistributionType.GAMMA: return x <= 0 ? 0 : Math.exp(d.shape * Math.log(d.rate) + (d.shape - 1) * Math.log(x) - d.rate * x - lnGamma(d.shape));
    case DistributionType.LOGNORMAL: {
      const sigma = lognormalSigma(d.errorFactor);
      if (!(sigma > 0)) return undefined;
      if (x <= 0) return 0;
      const z = (Math.log(x) - Math.log(d.median)) / sigma;
      return Math.exp(-(z * z) / 2) / (x * sigma * Math.sqrt(2 * Math.PI));
    }
    case DistributionType.NORMAL: {
      if (!(d.stdDev > 0)) return undefined;
      const z = (x - d.mean) / d.stdDev;
      return Math.exp(-(z * z) / 2) / (d.stdDev * Math.sqrt(2 * Math.PI));
    }
    case DistributionType.UNIFORM: return d.upper > d.lower && x >= d.lower && x <= d.upper ? 1 / (d.upper - d.lower) : 0;
    case DistributionType.WEIBULL: {
      if (x <= d.location) return 0;
      const z = (x - d.location) / d.scale;
      return (d.shape / d.scale) * Math.pow(z, d.shape - 1) * Math.exp(-Math.pow(z, d.shape));
    }
    case DistributionType.EXPONENTIAL: return x < 0 ? 0 : d.failureRate * Math.exp(-d.failureRate * x);
    default: return undefined;
  }
}

function distributionCdf(d: ParameterDistribution, x: number): number | undefined {
  if (!validDistribution(d)) return undefined;
  switch (d.type) {
    case DistributionType.BETA: return betaP(x, d.alpha, d.betaParam);
    case DistributionType.GAMMA: return gammaP(d.shape, x * d.rate);
    case DistributionType.LOGNORMAL: {
      const sigma = lognormalSigma(d.errorFactor);
      if (x <= 0) return 0;
      if (!(sigma > 0)) return x >= d.median ? 1 : 0;
      return normalCdf((Math.log(x) - Math.log(d.median)) / sigma);
    }
    case DistributionType.NORMAL: return d.stdDev > 0 ? normalCdf((x - d.mean) / d.stdDev) : x >= d.mean ? 1 : 0;
    case DistributionType.UNIFORM: return x <= d.lower ? 0 : x >= d.upper ? 1 : (x - d.lower) / (d.upper - d.lower);
    case DistributionType.WEIBULL: return x <= d.location ? 0 : 1 - Math.exp(-Math.pow((x - d.location) / d.scale, d.shape));
    case DistributionType.EXPONENTIAL: return x <= 0 ? 0 : 1 - Math.exp(-d.failureRate * x);
    case DistributionType.POINT_ESTIMATE: return x >= d.value ? 1 : 0;
    default: return undefined;
  }
}

function scaleDistribution(d: ParameterDistribution, factor: number): ParameterDistribution | undefined {
  if (!validDistribution(d) || !(factor > 0)) return undefined;
  switch (d.type) {
    case DistributionType.BETA: {
      const scaledBeta = (d.alpha + d.betaParam) / factor - d.alpha;
      return scaledBeta > 0 ? { type: DistributionType.BETA, alpha: d.alpha, betaParam: scaledBeta } : undefined;
    }
    case DistributionType.GAMMA: return { type: DistributionType.GAMMA, shape: d.shape, rate: d.rate / factor };
    case DistributionType.LOGNORMAL: return { type: DistributionType.LOGNORMAL, median: d.median * factor, errorFactor: d.errorFactor };
    case DistributionType.NORMAL: return { type: DistributionType.NORMAL, mean: d.mean * factor, stdDev: d.stdDev * factor };
    case DistributionType.UNIFORM: return { type: DistributionType.UNIFORM, lower: d.lower * factor, upper: d.upper * factor };
    case DistributionType.WEIBULL: return { type: DistributionType.WEIBULL, scale: d.scale * factor, shape: d.shape, location: d.location * factor };
    case DistributionType.EXPONENTIAL: return { type: DistributionType.EXPONENTIAL, failureRate: d.failureRate / factor };
    case DistributionType.POINT_ESTIMATE: return { type: DistributionType.POINT_ESTIMATE, value: d.value * factor };
    default: return undefined;
  }
}

function lognormalFromMean(mean: number, errorFactor: number): ParameterDistribution {
  return { type: DistributionType.LOGNORMAL, median: mean / Math.exp(lognormalSigma(errorFactor) ** 2 / 2), errorFactor };
}

interface LogComponent {
  mu: number;
  sigma: number;
  weight: number;
}

function judgmentComponent(p05: number, median: number, p95: number, weight: number): LogComponent | undefined {
  if (!(p05 > 0 && median > p05 && p95 > median && weight > 0)) return undefined;
  return { mu: Math.log(median), sigma: (Math.log(p95) - Math.log(p05)) / (2 * Z95), weight };
}

interface PooledJudgment {
  mean: number;
  p05: number;
  median: number;
  p95: number;
  distribution: ParameterDistribution;
}

function poolJudgments(parts: readonly LogComponent[], pooling: "LINEAR" | "LOGARITHMIC"): PooledJudgment | undefined {
  const total = parts.reduce((sum, part) => sum + part.weight, 0);
  if (parts.length === 0 || !(total > 0)) return undefined;
  const normalized = parts.map((part) => ({ ...part, weight: part.weight / total }));
  if (pooling === "LOGARITHMIC") {
    const precision = normalized.reduce((sum, part) => sum + part.weight / part.sigma ** 2, 0);
    const mu = normalized.reduce((sum, part) => sum + (part.weight * part.mu) / part.sigma ** 2, 0) / precision;
    const sigma = Math.sqrt(1 / precision);
    const errorFactor = Math.exp(sigma * Z95);
    const median = Math.exp(mu);
    return { mean: median * Math.exp(sigma ** 2 / 2), p05: median / errorFactor, median, p95: median * errorFactor, distribution: { type: DistributionType.LOGNORMAL, median, errorFactor } };
  }
  const mean = normalized.reduce((sum, part) => sum + part.weight * Math.exp(part.mu + part.sigma ** 2 / 2), 0);
  const cdf = (x: number): number => normalized.reduce((sum, part) => sum + part.weight * normalCdf((Math.log(x) - part.mu) / part.sigma), 0);
  const lowest = Math.min(...normalized.map((part) => Math.exp(part.mu - 8 * part.sigma)));
  const highest = Math.max(...normalized.map((part) => Math.exp(part.mu + 8 * part.sigma)));
  const p05 = invert(cdf, 0.05, lowest, highest);
  const median = invert(cdf, 0.5, lowest, highest);
  const p95 = invert(cdf, 0.95, lowest, highest);
  const sigma = (Math.log(p95) - Math.log(p05)) / (2 * Z95);
  const fitted: ParameterDistribution = { type: DistributionType.LOGNORMAL, median: mean / Math.exp(sigma ** 2 / 2), errorFactor: Math.exp(sigma * Z95) };
  return { mean, p05, median, p95, distribution: fitted };
}

function shapePoint(shape: ParameterDistribution): number | undefined {
  return shape.type === DistributionType.POINT_ESTIMATE ? shape.value : undefined;
}

export {
  betaP,
  distributionCdf,
  distributionDensity,
  distributionMean,
  distributionQuantile,
  distributionVariance,
  gammaP,
  gammaQ,
  judgmentComponent,
  lnGamma,
  lognormalFromMean,
  normalCdf,
  normalQuantile,
  poolJudgments,
  scaleDistribution,
  shapePoint,
  validDistribution,
  type LogComponent,
  type PooledJudgment,
};
