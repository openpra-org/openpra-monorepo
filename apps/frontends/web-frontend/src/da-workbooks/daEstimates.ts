import { DistributionType, type ParameterDistribution } from "interfaces-mef-types/core/events";
import {
  betaP,
  curveFromLog,
  curveMoment,
  gammaP,
  gammaQ,
  isCurve,
  lnGamma,
  normalCdf,
  scaleDistribution,
  shapeDensity,
  shapeMean,
  shapeQuantile,
  shapeVariance,
  type DaCurve,
  type DaShape,
} from "./daDistributions";

type DaScale = "PROBABILITY" | "RATE";

interface DaTerm {
  kind: "BINOMIAL" | "POISSON";
  failures: number;
  exposure: number;
}

type DaUpdatePrior = { kind: "PROPER"; shape: DaShape } | { kind: "JEFFREYS_RATE" };

type DaComputation = "CONJUGATE" | "NUMERICAL";

interface DaUpdate {
  shape: DaShape;
  computation: DaComputation;
}

interface DaSummary {
  mean: number;
  p05: number;
  median: number;
  p95: number;
}

type DaOutputFit = "EXACT" | "RARE_EVENT" | "LOGNORMAL" | "BETA";

interface DaOutput {
  shape: DaShape;
  summary: DaSummary;
  distribution: ParameterDistribution;
  fit: DaOutputFit;
  fitError?: number;
}

interface DaPredictive {
  expected: number;
  low: number;
  high: number;
}

interface DaPoolTest {
  statistic: number;
  df: number;
  p: number;
  small: boolean;
}

interface DaTrendTest {
  u: number;
  p: number;
}

interface DaPopulation {
  predictive: DaCurve;
  target?: DaCurve;
}

const Z95 = 1.6448536269514722;
const FIRST_PASS = 1601;
const SECOND_PASS = 2401;
const CURVE_POINTS = 2401;
const SPAN = 35;

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function grid(from: number, to: number, count: number): number[] {
  return Array.from({ length: count }, (_, index) => from + ((to - from) * index) / (count - 1));
}

function logLikelihood(theta: number, terms: readonly DaTerm[]): number {
  let total = 0;
  for (const term of terms) {
    if (term.kind === "BINOMIAL") {
      if (theta >= 1) return Number.NEGATIVE_INFINITY;
      total += term.failures * Math.log(theta) + (term.exposure - term.failures) * Math.log1p(-theta);
    } else total += term.failures * Math.log(theta) - theta * term.exposure;
  }
  return total;
}

function shapeRange(shape: DaShape, scale: DaScale): [number, number] | undefined {
  if (!isCurve(shape) && shape.type === DistributionType.POINT_ESTIMATE) return undefined;
  const low = shapeQuantile(shape, 1e-9);
  const high = shapeQuantile(shape, 1 - 1e-9);
  if (low === undefined || high === undefined || !Number.isFinite(high) || !(high > 0)) return undefined;
  const upper = scale === "PROBABILITY" ? Math.min(high, 1 - 1e-12) : high;
  const lower = Math.max(Number.isFinite(low) ? low : 0, upper * 1e-30, 1e-300);
  return lower < upper ? [lower, upper] : undefined;
}

function logPriorU(shape: DaShape, theta: number): number {
  const density = shapeDensity(shape, theta);
  return density === undefined || !(density > 0) ? Number.NEGATIVE_INFINITY : Math.log(density) + Math.log(theta);
}

function shapeCurve(shape: DaShape, scale: DaScale): DaCurve | undefined {
  if (isCurve(shape)) return shape;
  const range = shapeRange(shape, scale);
  if (range === undefined) return undefined;
  const us = grid(Math.log(range[0]), Math.log(range[1]), CURVE_POINTS);
  return curveFromLog(us, us.map((u) => logPriorU(shape, Math.exp(u))));
}

function totals(terms: readonly DaTerm[]): { failures: number; exposure: number } {
  return { failures: sum(terms.map((term) => term.failures)), exposure: sum(terms.map((term) => term.exposure)) };
}

function numericalUpdate(prior: DaShape, terms: readonly DaTerm[], scale: DaScale): DaCurve | undefined {
  const range = shapeRange(prior, scale);
  if (range === undefined) return undefined;
  let [low, high] = range;
  const { failures, exposure } = totals(terms);
  if (exposure > 0) {
    const reach = (failures + 40 + 8 * Math.sqrt(failures + 1)) / exposure;
    high = Math.max(high, scale === "PROBABILITY" ? Math.min(reach, 1 - 1e-12) : reach);
    if (failures > 0) low = Math.min(low, (failures / exposure) * 1e-4);
  }
  const logPosterior = (u: number): number => logPriorU(prior, Math.exp(u)) + logLikelihood(Math.exp(u), terms);
  const first = grid(Math.log(low), Math.log(high), FIRST_PASS);
  const firstValues = first.map(logPosterior);
  const top = Math.max(...firstValues.filter((value) => Number.isFinite(value)));
  if (!Number.isFinite(top)) return undefined;
  let start = firstValues.findIndex((value) => value > top - SPAN);
  let end = firstValues.length - 1;
  while (end > start && !((firstValues[end] ?? Number.NEGATIVE_INFINITY) > top - SPAN)) end -= 1;
  start = Math.max(0, start - 2);
  end = Math.min(first.length - 1, end + 2);
  const us = grid(first[start] ?? Math.log(low), first[end] ?? Math.log(high), SECOND_PASS);
  return curveFromLog(us, us.map(logPosterior));
}

function conjugateUpdate(prior: DaUpdatePrior, terms: readonly DaTerm[]): ParameterDistribution | undefined {
  const failures = sum(terms.map((term) => term.failures));
  if (prior.kind === "JEFFREYS_RATE") {
    if (terms.some((term) => term.kind !== "POISSON")) return undefined;
    const exposure = sum(terms.map((term) => term.exposure));
    return exposure > 0 ? { type: DistributionType.GAMMA, shape: 0.5 + failures, rate: exposure } : undefined;
  }
  const shape = prior.shape;
  if (isCurve(shape)) return undefined;
  if (shape.type === DistributionType.BETA && terms.every((term) => term.kind === "BINOMIAL")) {
    return { type: DistributionType.BETA, alpha: shape.alpha + failures, betaParam: shape.betaParam + sum(terms.map((term) => term.exposure - term.failures)) };
  }
  if (shape.type === DistributionType.GAMMA && terms.every((term) => term.kind === "POISSON")) {
    return { type: DistributionType.GAMMA, shape: shape.shape + failures, rate: shape.rate + sum(terms.map((term) => term.exposure)) };
  }
  return undefined;
}

function bayesUpdate(prior: DaUpdatePrior, terms: readonly DaTerm[], scale: DaScale): DaUpdate | undefined {
  if (terms.some((term) => !(term.exposure > 0) || term.failures < 0 || (term.kind === "BINOMIAL" && term.failures > term.exposure))) return undefined;
  const conjugate = conjugateUpdate(prior, terms);
  if (conjugate !== undefined) return { shape: conjugate, computation: "CONJUGATE" };
  if (prior.kind === "JEFFREYS_RATE") return undefined;
  const curve = numericalUpdate(prior.shape, terms, scale);
  return curve === undefined ? undefined : { shape: curve, computation: "NUMERICAL" };
}

function shapeSummary(shape: DaShape): DaSummary | undefined {
  const mean = shapeMean(shape);
  const p05 = shapeQuantile(shape, 0.05);
  const median = shapeQuantile(shape, 0.5);
  const p95 = shapeQuantile(shape, 0.95);
  if (mean === undefined || p05 === undefined || median === undefined || p95 === undefined) return undefined;
  return { mean, p05, median, p95 };
}

function missionCurve(rate: DaShape, hours: number): DaCurve | undefined {
  const base = shapeCurve(rate, "RATE");
  if (base === undefined || !(hours > 0)) return undefined;
  const us: number[] = [];
  const logw: number[] = [];
  for (let i = 0; i < base.us.length; i += 1) {
    const lambda = Math.exp(base.us[i] ?? 0);
    const load = lambda * hours;
    const p = -Math.expm1(-load);
    if (!(p > 0)) continue;
    const jacobian = (load * Math.exp(-load)) / p;
    const density = base.fu[i] ?? 0;
    us.push(Math.log(p));
    logw.push(density > 0 && jacobian > 0 ? Math.log(density) - Math.log(jacobian) : Number.NEGATIVE_INFINITY);
  }
  return curveFromLog(us, logw);
}

function lognormalFit(summary: DaSummary): ParameterDistribution {
  const sigma = Math.max((Math.log(summary.p95) - Math.log(summary.p05)) / (2 * Z95), 1e-9);
  return { type: DistributionType.LOGNORMAL, median: summary.mean / Math.exp((sigma * sigma) / 2), errorFactor: Math.exp(sigma * Z95) };
}

function betaFromMoments(mean: number, variance: number): ParameterDistribution | undefined {
  if (!(mean > 0 && mean < 1 && variance > 0)) return undefined;
  const common = (mean * (1 - mean)) / variance - 1;
  if (!(common > 0)) return undefined;
  return { type: DistributionType.BETA, alpha: mean * common, betaParam: (1 - mean) * common };
}

function fitError(fitted: ParameterDistribution, summary: DaSummary): number | undefined {
  const low = shapeQuantile(fitted, 0.05);
  const high = shapeQuantile(fitted, 0.95);
  if (low === undefined || high === undefined) return undefined;
  return Math.max(Math.abs(low - summary.p05) / summary.p05, Math.abs(high - summary.p95) / summary.p95);
}

function outputFor(theta: DaShape, missionHours: number | undefined): DaOutput | undefined {
  if (missionHours === undefined) {
    const summary = shapeSummary(theta);
    if (summary === undefined) return undefined;
    if (!isCurve(theta)) return { shape: theta, summary, distribution: theta, fit: "EXACT" };
    const fitted = lognormalFit(summary);
    return { shape: theta, summary, distribution: fitted, fit: "LOGNORMAL", fitError: fitError(fitted, summary) };
  }
  if (!isCurve(theta) && theta.type === DistributionType.POINT_ESTIMATE) {
    const value = -Math.expm1(-theta.value * missionHours);
    const point: ParameterDistribution = { type: DistributionType.POINT_ESTIMATE, value };
    return { shape: point, summary: { mean: value, p05: value, median: value, p95: value }, distribution: point, fit: "EXACT" };
  }
  const curve = missionCurve(theta, missionHours);
  const summary = curve === undefined ? undefined : shapeSummary(curve);
  if (curve === undefined || summary === undefined) return undefined;
  if (summary.p95 < 0.1) {
    if (!isCurve(theta)) {
      const scaled = scaleDistribution(theta, missionHours);
      if (scaled !== undefined) return { shape: curve, summary, distribution: scaled, fit: "RARE_EVENT" };
    }
    const fitted = lognormalFit(summary);
    return { shape: curve, summary, distribution: fitted, fit: "LOGNORMAL", fitError: fitError(fitted, summary) };
  }
  const variance = Math.max(0, curveMoment(curve, 2) - curve.mean * curve.mean);
  const beta = betaFromMoments(curve.mean, variance);
  if (beta === undefined) return undefined;
  return { shape: curve, summary, distribution: beta, fit: "BETA", fitError: fitError(beta, summary) };
}

function lnChoose(n: number, k: number): number {
  return lnGamma(n + 1) - lnGamma(k + 1) - lnGamma(n - k + 1);
}

function lnBeta(a: number, b: number): number {
  return lnGamma(a) + lnGamma(b) - lnGamma(a + b);
}

function betaBinomialTail(alpha: number, beta: number, n: number, upTo: number): number {
  let total = 0;
  for (let k = 0; k <= upTo; k += 1) total += Math.exp(lnChoose(n, k) + lnBeta(k + alpha, n - k + beta) - lnBeta(alpha, beta));
  return Math.min(1, total);
}

function predictive(prior: DaShape, term: DaTerm, scale: DaScale): DaPredictive | undefined {
  const mean = shapeMean(prior);
  if (mean === undefined || !(term.exposure > 0)) return undefined;
  const x = term.failures;
  const expected = mean * term.exposure;
  if (!isCurve(prior) && prior.type === DistributionType.GAMMA && term.kind === "POISSON") {
    const p = prior.rate / (prior.rate + term.exposure);
    return { expected, low: betaP(p, prior.shape, x + 1), high: x === 0 ? 1 : betaP(1 - p, x, prior.shape) };
  }
  if (!isCurve(prior) && prior.type === DistributionType.BETA && term.kind === "BINOMIAL" && term.exposure <= 1e5) {
    return { expected, low: betaBinomialTail(prior.alpha, prior.betaParam, term.exposure, x), high: x === 0 ? 1 : 1 - betaBinomialTail(prior.alpha, prior.betaParam, term.exposure, x - 1) };
  }
  const curve = shapeCurve(prior, scale);
  if (curve === undefined) return undefined;
  let low = 0;
  let high = 0;
  for (let i = 1; i < curve.us.length; i += 1) {
    const du = (curve.us[i] ?? 0) - (curve.us[i - 1] ?? 0);
    const at = (index: number): [number, number] => {
      const theta = Math.exp(curve.us[index] ?? 0);
      const weight = curve.fu[index] ?? 0;
      if (term.kind === "POISSON") {
        const m = theta * term.exposure;
        return [weight * gammaQ(x + 1, m), weight * (x === 0 ? 1 : gammaP(x, m))];
      }
      const n = term.exposure;
      if (theta >= 1) return [x >= n ? weight : 0, weight];
      return [weight * (x >= n ? 1 : betaP(1 - theta, n - x, x + 1)), weight * (x === 0 ? 1 : betaP(theta, x, n - x + 1))];
    };
    const [lowLeft, highLeft] = at(i - 1);
    const [lowRight, highRight] = at(i);
    low += ((lowLeft + lowRight) / 2) * du;
    high += ((highLeft + highRight) / 2) * du;
  }
  return { expected, low: Math.min(1, low), high: Math.min(1, high) };
}

function conflictProbability(check: DaPredictive, failures: number): number {
  return failures >= check.expected ? check.high : check.low;
}

function poolTest(terms: readonly DaTerm[]): DaPoolTest | undefined {
  if (terms.length < 2) return undefined;
  const failures = sum(terms.map((term) => term.failures));
  const exposure = sum(terms.map((term) => term.exposure));
  if (!(exposure > 0) || failures === 0) return undefined;
  const df = terms.length - 1;
  if (terms.every((term) => term.kind === "POISSON")) {
    const rate = failures / exposure;
    let statistic = 0;
    let small = false;
    for (const term of terms) {
      const expected = rate * term.exposure;
      if (expected < 5) small = true;
      statistic += expected > 0 ? (term.failures - expected) ** 2 / expected : 0;
    }
    return { statistic, df, p: gammaQ(df / 2, statistic / 2), small };
  }
  if (terms.every((term) => term.kind === "BINOMIAL")) {
    const rate = failures / exposure;
    if (rate >= 1) return undefined;
    let statistic = 0;
    let small = false;
    for (const term of terms) {
      const expectedFailures = rate * term.exposure;
      const expectedSuccesses = (1 - rate) * term.exposure;
      if (expectedFailures < 5) small = true;
      statistic += (term.failures - expectedFailures) ** 2 / expectedFailures + (term.exposure - term.failures - expectedSuccesses) ** 2 / expectedSuccesses;
    }
    return { statistic, df, p: gammaQ(df / 2, statistic / 2), small };
  }
  return undefined;
}

function laplaceTest(times: readonly number[], start: number, end: number): DaTrendTest | undefined {
  const n = times.length;
  if (n < 3 || !(end > start)) return undefined;
  const length = end - start;
  const center = sum(times.map((time) => time - start)) / n;
  const u = (center - length / 2) / (length * Math.sqrt(1 / (12 * n)));
  return { u, p: 2 * (1 - normalCdf(Math.abs(u))) };
}

function termLogLikelihood(term: DaTerm, u: number): number {
  const theta = Math.exp(u);
  if (term.kind === "BINOMIAL") {
    if (theta >= 1) return Number.NEGATIVE_INFINITY;
    return term.failures * u + (term.exposure - term.failures) * Math.log1p(-theta);
  }
  return term.failures * u - theta * term.exposure;
}

function populationUpdate(terms: readonly DaTerm[], scale: DaScale, target?: number): DaPopulation | undefined {
  if (terms.length < 2 || sum(terms.map((term) => term.failures)) === 0) return undefined;
  if (terms.some((term) => !(term.exposure > 0) || term.failures < 0 || (term.kind === "BINOMIAL" && term.failures > term.exposure))) return undefined;
  const centers = terms.map((term) => Math.log((term.failures + 0.5) / term.exposure));
  const lowCenter = Math.min(...centers);
  const highCenter = Math.max(...centers);
  const top = scale === "PROBABILITY" ? Math.min(highCenter + 14, Math.log(1 - 1e-9)) : highCenter + 14;
  const us = grid(lowCenter - 14, top, 801);
  const du = (us[1] ?? 0) - (us[0] ?? 0);
  const likelihoods = terms.map((term) => {
    const values = us.map((u) => termLogLikelihood(term, u));
    const peak = Math.max(...values.filter((value) => Number.isFinite(value)));
    return values.map((value) => (Number.isFinite(value) ? Math.exp(value - peak) : 0));
  });
  const muIndex: number[] = [];
  for (let j = 0; j < us.length; j += 1) {
    const u = us[j] ?? 0;
    if (u >= lowCenter - 5 && u <= highCenter + 5) muIndex.push(j);
  }
  const sigmas = grid(0.025, 3, 80);
  const kernels = sigmas.map((sigma) => {
    const reach = Math.min(us.length, Math.ceil((6 * sigma) / du));
    const values: number[] = [];
    for (let d = -reach; d <= reach; d += 1) values.push(Math.exp(-((d * du) ** 2) / (2 * sigma * sigma)));
    const total = sum(values);
    return { reach, values: values.map((value) => value / total) };
  });
  const logWeight: number[][] = [];
  const marginals: number[][][] = [];
  for (const kernel of kernels) {
    const rowWeights: number[] = [];
    const rowMarginals: number[][] = [];
    for (const j of muIndex) {
      let total = 0;
      const perTerm: number[] = [];
      for (const values of likelihoods) {
        let m = 0;
        const from = Math.max(-kernel.reach, -j);
        const to = Math.min(kernel.reach, values.length - 1 - j);
        for (let d = from; d <= to; d += 1) m += (values[j + d] ?? 0) * (kernel.values[d + kernel.reach] ?? 0);
        perTerm.push(m);
        total += m > 0 ? Math.log(m) : Number.NEGATIVE_INFINITY;
      }
      rowWeights.push(total);
      rowMarginals.push(perTerm);
    }
    logWeight.push(rowWeights);
    marginals.push(rowMarginals);
  }
  const peak = Math.max(...logWeight.flat().filter((value) => Number.isFinite(value)));
  if (!Number.isFinite(peak)) return undefined;
  const edge = (index: number, count: number): number => (index === 0 || index === count - 1 ? 0.5 : 1);
  const weights = logWeight.map((row, s) => row.map((value, k) => (Number.isFinite(value) ? Math.exp(value - peak) * edge(s, sigmas.length) * edge(k, muIndex.length) : 0)));
  const mixture = (weightAt: (s: number, k: number) => number): number[] => {
    const density = us.map(() => 0);
    let largest = 0;
    for (let s = 0; s < sigmas.length; s += 1) for (let k = 0; k < muIndex.length; k += 1) largest = Math.max(largest, weightAt(s, k));
    const floor = largest * 1e-13;
    for (let s = 0; s < sigmas.length; s += 1) {
      const kernel = kernels[s];
      if (kernel === undefined) continue;
      for (let k = 0; k < muIndex.length; k += 1) {
        const w = weightAt(s, k);
        if (!(w > floor)) continue;
        const j = muIndex[k] ?? 0;
        const from = Math.max(-kernel.reach, -j);
        const to = Math.min(kernel.reach, density.length - 1 - j);
        for (let d = from; d <= to; d += 1) density[j + d] = (density[j + d] ?? 0) + w * (kernel.values[d + kernel.reach] ?? 0);
      }
    }
    return density;
  };
  const toCurve = (density: readonly number[]): DaCurve | undefined => curveFromLog(us, density.map((value) => (value > 0 ? Math.log(value) : Number.NEGATIVE_INFINITY)));
  const predictiveCurve = toCurve(mixture((s, k) => weights[s]?.[k] ?? 0));
  if (predictiveCurve === undefined) return undefined;
  let weightTotal = 0;
  let meanTotal = 0;
  for (let s = 0; s < sigmas.length; s += 1) {
    const sigma = sigmas[s] ?? 0;
    for (let k = 0; k < muIndex.length; k += 1) {
      const w = weights[s]?.[k] ?? 0;
      weightTotal += w;
      meanTotal += w * Math.exp((us[muIndex[k] ?? 0] ?? 0) + (sigma * sigma) / 2);
    }
  }
  const predictiveShape: DaCurve = { ...predictiveCurve, mean: scale === "PROBABILITY" ? predictiveCurve.mean : meanTotal / weightTotal };
  if (target === undefined || target < 0 || target >= terms.length) return { predictive: predictiveShape };
  const others = mixture((s, k) => {
    const m = marginals[s]?.[k]?.[target] ?? 0;
    return m > 0 ? (weights[s]?.[k] ?? 0) / m : 0;
  });
  const own = likelihoods[target] ?? [];
  const targetCurve = toCurve(others.map((value, index) => value * (own[index] ?? 0)));
  return targetCurve === undefined ? { predictive: predictiveShape } : { predictive: predictiveShape, target: targetCurve };
}

function priorWeight(shape: DaShape, scale: DaScale): number | undefined {
  if (!isCurve(shape)) {
    if (shape.type === DistributionType.POINT_ESTIMATE) return undefined;
    if (shape.type === DistributionType.BETA && scale === "PROBABILITY") return shape.alpha + shape.betaParam;
    if (shape.type === DistributionType.GAMMA && scale === "RATE") return shape.rate;
  }
  const mean = shapeMean(shape);
  const variance = shapeVariance(shape);
  if (mean === undefined || variance === undefined || !(variance > 0) || !(mean > 0)) return undefined;
  const weight = scale === "PROBABILITY" ? (mean * (1 - mean)) / variance - 1 : mean / variance;
  return weight > 0 ? weight : undefined;
}

function peakCount(curve: DaCurve): number {
  const top = Math.max(...curve.fu);
  const peaks: number[] = [];
  for (let i = 1; i < curve.fu.length - 1; i += 1) {
    const value = curve.fu[i] ?? 0;
    if (value > (curve.fu[i - 1] ?? 0) && value >= (curve.fu[i + 1] ?? 0) && value > 0.05 * top) peaks.push(i);
  }
  let count = peaks.length > 0 ? 1 : 0;
  for (let k = 1; k < peaks.length; k += 1) {
    const left = peaks[k - 1] ?? 0;
    const right = peaks[k] ?? 0;
    const valley = Math.min(...curve.fu.slice(left, right + 1));
    if (valley < 0.8 * Math.min(curve.fu[left] ?? 0, curve.fu[right] ?? 0)) count += 1;
  }
  return count;
}

function constrainedNoninformative(mean: number, scale: DaScale): ParameterDistribution | undefined {
  if (!(mean > 0)) return undefined;
  if (scale === "RATE") return { type: DistributionType.GAMMA, shape: 0.5, rate: 0.5 / mean };
  if (!(mean < 1)) return undefined;
  return { type: DistributionType.BETA, alpha: 0.5, betaParam: (0.5 * (1 - mean)) / mean };
}

function evidenceAlone(terms: readonly DaTerm[], scale: DaScale): ParameterDistribution | undefined {
  if (terms.length === 0) return undefined;
  const failures = sum(terms.map((term) => term.failures));
  if (terms.every((term) => term.kind === "BINOMIAL")) {
    const demands = sum(terms.map((term) => term.exposure));
    return demands > 0 && failures <= demands ? { type: DistributionType.BETA, alpha: failures + 0.5, betaParam: demands - failures + 0.5 } : undefined;
  }
  if (terms.every((term) => term.kind === "POISSON")) {
    const exposure = sum(terms.map((term) => term.exposure));
    return exposure > 0 && (scale === "RATE" || failures < exposure) ? { type: DistributionType.GAMMA, shape: failures + 0.5, rate: exposure } : undefined;
  }
  return undefined;
}

export {
  bayesUpdate,
  betaFromMoments,
  conflictProbability,
  constrainedNoninformative,
  evidenceAlone,
  laplaceTest,
  lognormalFit,
  missionCurve,
  outputFor,
  peakCount,
  poolTest,
  populationUpdate,
  predictive,
  priorWeight,
  shapeCurve,
  shapeSummary,
  type DaComputation,
  type DaOutput,
  type DaOutputFit,
  type DaPoolTest,
  type DaPopulation,
  type DaPredictive,
  type DaScale,
  type DaSummary,
  type DaTerm,
  type DaTrendTest,
  type DaUpdate,
  type DaUpdatePrior,
};
