import { NetworkBuilderError, keyError, valueError } from "../core/errors";
import { errorFunction } from "../core/math-functions";
import {
  formatGeneral,
  hasKey,
  isMapping,
  isSequence,
  keysOf,
  replaceNonAlphanumericRuns,
  repr,
  sortedText,
  strip,
  stripCharacters,
  sum,
  text,
  toFloat,
  toInteger,
} from "../core/spec-values";
import type { SpecMapping, SpecValue } from "../core/spec-values";

interface SimpleFailedProbabilityInput {
  tHours: number;
  mu0: number;
  sigma0: number;
  method: string;
  combine: string;
  pgaState: string;
  floodState: string;
  multiplierSeismic: Map<string, number>;
  multiplierFlood: Map<string, number>;
  multiplierJoint: Map<string, number>;
}

const BOOL_STATES = ["False", "True"];

const slug = (token: string): string => {
  const cleaned = stripCharacters(replaceNonAlphanumericRuns(strip(token), "_"), "_");
  return cleaned.length > 0 ? cleaned.toLowerCase() : "x";
};

const largerOf = (first: number, second: number): number => (second > first ? second : first);

const smallerOf = (first: number, second: number): number => (second < first ? second : first);

const clampUnit = (value: number): number => smallerOf(1, largerOf(0, value));

const power = (base: number, exponent: number): number => {
  if (base === 1) return 1;
  const result = Math.pow(base, exponent);
  if (!Number.isFinite(result) && Number.isFinite(base) && Number.isFinite(exponent)) {
    throw new NetworkBuilderError("OverflowError", "(34, 'Result too large')");
  }
  return result;
};

const divide = (numerator: number, denominator: number): number => {
  if (denominator === 0) throw new NetworkBuilderError("ZeroDivisionError", "float division by zero");
  return numerator / denominator;
};

const logarithm = (value: number): number => {
  if (value <= 0) throw valueError("math domain error");
  return Math.log(value);
};

const normalCdf = (z: number): number => 0.5 * (1 + errorFunction(z / Math.sqrt(2)));

const lognormalCdfHours = (tHours: number, mu: number, sigma: number): number => {
  if (tHours <= 0) return 0;
  const z = divide(logarithm(tHours) - mu, sigma);
  return normalCdf(z);
};

const lognormalFragilityCdf = (imValue: number, theta: number, beta: number): number => {
  if (imValue <= 0) return 0;
  const z = divide(logarithm(divide(imValue, theta)), beta);
  return normalCdf(z);
};

const lookup = (mapping: Map<string, number>, key: string): number => {
  const value = mapping.get(key);
  if (value === undefined) throw keyError(key);
  return value;
};

const lookupText = (mapping: Map<string, string>, key: string): string => {
  const value = mapping.get(key);
  if (value === undefined) throw keyError(key);
  return value;
};

const pairKey = (first: string, second: string): string => JSON.stringify([first, second]);

const setsEqual = (left: Iterable<string>, right: Iterable<string>): boolean => {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size !== rightSet.size) return false;
  for (const value of leftSet) {
    if (!rightSet.has(value)) return false;
  }
  return true;
};

const unknownKeys = (mapping: SpecMapping, known: readonly string[]): string[] =>
  sortedText(keysOf(mapping).filter((key) => !known.includes(key)));

const stateProbabilities = (states: readonly string[], falseProbability: number, trueProbability: number): number[] =>
  states.map((state) => {
    if (state === "False") return falseProbability;
    if (state === "True") return trueProbability;
    throw keyError(state);
  });

const dgNonRecoveryProbability = (tHours: number, alpha: number, beta: number, betaMultiplier: number): number => {
  const betaEffective = largerOf(1e-12, beta * largerOf(1e-12, betaMultiplier));
  const q = Math.exp(-power(largerOf(1e-12, tHours) / betaEffective, alpha));
  return clampUnit(q);
};

const simpleFailedProbabilityForMultiplier = (
  tHours: number,
  mu0: number,
  sigma0: number,
  method: string,
  multiplier: number,
): number => {
  const m = largerOf(1e-12, multiplier);
  const restored =
    method === "time_multiplier" ?
      lognormalCdfHours(tHours / m, mu0, sigma0)
    : lognormalCdfHours(tHours, mu0 + logarithm(m), sigma0);
  const failed = 1 - clampUnit(restored);
  return clampUnit(failed);
};

const simpleFailedProbability = (input: SimpleFailedProbabilityInput): number => {
  const ms = lookup(input.multiplierSeismic, input.pgaState);
  const mf = lookup(input.multiplierFlood, input.floodState);
  let m: number;
  if (input.combine === "product") m = ms * mf;
  else if (input.combine === "max") m = largerOf(ms, mf);
  else m = largerOf(1e-12, ms + mf - 1);
  m *= input.multiplierJoint.get(pairKey(input.pgaState, input.floodState)) ?? 1;
  return simpleFailedProbabilityForMultiplier(input.tHours, input.mu0, input.sigma0, input.method, largerOf(1e-12, m));
};

const requireText = (raw: SpecValue, label: string): string => {
  const value = raw !== null ? strip(text(raw)) : "";
  if (value.length === 0) throw valueError(`${label} must be a non-empty string.`);
  return value;
};

const requireFloat = (raw: SpecValue, label: string): number => {
  try {
    return toFloat(raw);
  } catch (error) {
    if (error instanceof NetworkBuilderError) throw valueError(`${label} must be numeric.`);
    throw error;
  }
};

const requirePositiveFloat = (raw: SpecValue, label: string): number => {
  const value = requireFloat(raw, label);
  if (value <= 0) throw valueError(`${label} must be > 0.`);
  return value;
};

const requireProbability = (raw: SpecValue, label: string): number => {
  const value = requireFloat(raw, label);
  if (value < 0 || value > 1) throw valueError(`${label} must be in [0,1].`);
  return value;
};

const resolveListText = (raw: SpecValue, label: string, required: boolean): string[] => {
  if (raw === null) {
    if (required) throw valueError(`${label} is required.`);
    return [];
  }
  if (!isSequence(raw)) throw valueError(`${label} must be list-like.`);
  const output = raw.map((value) => strip(text(value)));
  if (output.some((value) => value.length === 0)) throw valueError(`${label} contains empty values.`);
  if (output.length !== new Set(output).size) throw valueError(`${label} contains duplicates.`);
  return output;
};

const normalizeProbabilities = (probabilities: readonly number[], label: string): number[] => {
  const total = sum(probabilities);
  if (total <= 0) throw valueError(`${label} probability sum must be > 0.`);
  const normalized = probabilities.map((probability) => probability / total);
  if (Math.abs(sum(normalized) - 1) > 1e-9) {
    throw valueError(`${label} probabilities failed normalization sanity check.`);
  }
  return normalized;
};

const resolveProbabilityVector = (raw: SpecValue, states: readonly string[], label: string): number[] => {
  if (isMapping(raw)) {
    const probabilities: number[] = [];
    for (const state of states) {
      if (!hasKey(raw, state)) throw valueError(`${label} missing state '${state}'.`);
      probabilities.push(requireProbability(raw[state], `${label}[${state}]`));
    }
    return normalizeProbabilities(probabilities, label);
  }
  if (!isSequence(raw)) throw valueError(`${label} must be list-like or state->prob mapping.`);
  const probabilities = raw.map((value) => requireProbability(value, label));
  if (probabilities.length !== states.length) {
    throw valueError(`${label} length ${probabilities.length} does not match state count ${states.length}.`);
  }
  return normalizeProbabilities(probabilities, label);
};

const resolveImByState = (parentStates: readonly string[], raw: SpecValue, label: string): Map<string, number> => {
  if (!isMapping(raw)) throw valueError(`${label} must be a state->IM mapping.`);
  const output = new Map<string, number>();
  for (const state of parentStates) {
    if (!hasKey(raw, state)) throw valueError(`${label} missing state '${state}'.`);
    const value = requireFloat(raw[state], `${label}[${state}]`);
    if (value < 0) throw valueError(`${label}[${state}] must be >= 0.`);
    output.set(state, value);
  }
  const extra = unknownKeys(raw, parentStates);
  if (extra.length > 0) throw valueError(`${label} contains unknown states: ${repr(extra)}.`);
  return output;
};

const roundToInteger = (value: number): number => {
  if (!Number.isFinite(value)) return toInteger(value);
  const lower = Math.floor(value);
  const difference = value - lower;
  if (difference < 0.5) return lower;
  if (difference > 0.5) return lower + 1;
  return lower % 2 === 0 ? lower : lower + 1;
};

const timeLabel = (tHours: number): string => {
  const rounded = roundToInteger(tHours);
  if (Math.abs(tHours - rounded) < 1e-12) return `${BigInt(rounded).toString()}h`;
  return `${formatGeneral(tHours, 6).split(".").join("p")}h`;
};

export type { SimpleFailedProbabilityInput };
export {
  BOOL_STATES,
  clampUnit,
  dgNonRecoveryProbability,
  lognormalFragilityCdf,
  largerOf,
  lookup,
  lookupText,
  pairKey,
  requireFloat,
  requirePositiveFloat,
  requireProbability,
  requireText,
  resolveImByState,
  resolveListText,
  resolveProbabilityVector,
  setsEqual,
  simpleFailedProbability,
  simpleFailedProbabilityForMultiplier,
  slug,
  stateProbabilities,
  timeLabel,
  unknownKeys,
};
