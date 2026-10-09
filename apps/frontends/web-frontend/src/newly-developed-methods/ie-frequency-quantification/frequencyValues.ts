import { useMemo } from "react";
import type { UncertainExpression, UncertainParameter } from "interfaces-mef-types/core/uncertainty";
import type { UncertaintyExpressionSummary, UncertaintySampling } from "interfaces-shared-types/newly-developed-methods/shared";
import {
  parametersFor,
  useExpressionSummaries,
  useLawSummaries,
  type ExpressionQuery,
  type LawQuery,
  type UncertaintyState,
} from "../shared/useUncertainty";
import { FREQUENCY_UNIT, frequencyText } from "./frequencySources";

type ParameterTable = ReadonlyMap<string, UncertainParameter>;

type FrequencyPoint = UncertaintyState<UncertaintyExpressionSummary>;

interface FrequencyEntry {
  key: string;
  expression: UncertainExpression;
}

interface FrequencySpread {
  mean: number;
  lower: number;
  upper: number;
  trials: number | null;
}

const PENDING: FrequencyPoint = { status: "pending" };

const LOWER_PROBABILITY = 0.05;

const UPPER_PROBABILITY = 0.95;

const SPREAD_PROBABILITIES: readonly number[] = [LOWER_PROBABILITY, UPPER_PROBABILITY];

const SPREAD_SAMPLING: UncertaintySampling = { method: "LATIN_HYPERCUBE", trials: 10000, seed: 1 };

const EMPTY_TABLE: ParameterTable = new Map();

function frequencyQuery(expression: UncertainExpression, table: ParameterTable): ExpressionQuery {
  return { expression, unit: FREQUENCY_UNIT, probabilities: [], parameters: parametersFor([expression], table) };
}

function useFrequencyPoints(entries: readonly FrequencyEntry[], table: ParameterTable = EMPTY_TABLE): Map<string, FrequencyPoint> {
  const queries = useMemo(() => entries.map((entry) => frequencyQuery(entry.expression, table)), [entries, table]);
  const states = useExpressionSummaries(queries);
  return new Map(entries.map((entry, index) => [entry.key, states[index] ?? PENDING]));
}

function quantile(quantiles: readonly { probability: number; value: number }[], probability: number): number | undefined {
  return quantiles.find((entry) => entry.probability === probability)?.value;
}

function spreadOf(mean: number, quantiles: readonly { probability: number; value: number }[], trials: number | null): UncertaintyState<FrequencySpread> {
  const lower = quantile(quantiles, LOWER_PROBABILITY);
  const upper = quantile(quantiles, UPPER_PROBABILITY);
  if (lower === undefined || upper === undefined) return { status: "failed", error: "PRAXIS gave no percentiles." };
  return { status: "ready", value: { mean, lower, upper, trials } };
}

function useFrequencySpread(expression: UncertainExpression | undefined, table: ParameterTable = EMPTY_TABLE): UncertaintyState<FrequencySpread> | undefined {
  const lawQueries = useMemo<LawQuery[]>(
    () => (expression?.node === "VALUE" ? [{ value: expression.value, probabilities: SPREAD_PROBABILITIES, curveProbabilities: [] }] : []),
    [expression],
  );
  const sampledQueries = useMemo<ExpressionQuery[]>(
    () => (expression === undefined || expression.node === "VALUE"
      ? []
      : [{ expression, unit: FREQUENCY_UNIT, probabilities: SPREAD_PROBABILITIES, sampling: SPREAD_SAMPLING, parameters: parametersFor([expression], table) }]),
    [expression, table],
  );
  const law = useLawSummaries(lawQueries)[0];
  const sampled = useExpressionSummaries(sampledQueries)[0];
  if (law !== undefined) return law.status === "ready" ? spreadOf(law.value.mean, law.value.quantiles, null) : law;
  if (sampled === undefined) return undefined;
  if (sampled.status !== "ready") return sampled;
  const samples = sampled.value.sampled;
  return samples === null ? { status: "failed", error: "PRAXIS gave no samples." } : spreadOf(sampled.value.point, samples.quantiles, SPREAD_SAMPLING.trials);
}

function pointValue(state: FrequencyPoint | undefined): number | undefined {
  return state?.status === "ready" ? state.value.point : undefined;
}

function pointText(state: FrequencyPoint | undefined): string {
  if (state === undefined) return "—";
  if (state.status === "pending") return "…";
  if (state.status === "failed") return "Not available";
  return frequencyText(state.value.point);
}

export {
  frequencyQuery,
  pointText,
  pointValue,
  useFrequencyPoints,
  useFrequencySpread,
  type FrequencyEntry,
  type FrequencyPoint,
  type FrequencySpread,
  type ParameterTable,
};
