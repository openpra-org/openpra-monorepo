import { useMemo } from "react";
import type { UncertainExpression, UncertainParameter } from "interfaces-mef-types/core/uncertainty";
import type { UncertaintyExpressionSummary } from "interfaces-shared-types/newly-developed-methods/shared";
import { numberText } from "../newly-developed-methods/shared/uncertainText";
import {
  parametersFor,
  useExpressionSummaries,
  type ExpressionQuery,
  type UncertaintyState,
} from "../newly-developed-methods/shared/useUncertainty";

type HoursState = UncertaintyState<UncertaintyExpressionSummary>;

interface HoursEntry {
  key: string;
  expression: UncertainExpression;
}

const NO_PARAMETERS: ReadonlyMap<string, UncertainParameter> = new Map();

function hoursQuery(expression: UncertainExpression, table: ReadonlyMap<string, UncertainParameter>): ExpressionQuery {
  return { expression, unit: "HOURS", probabilities: [], parameters: parametersFor([expression], table) };
}

function useHoursPoints(entries: readonly HoursEntry[], table: ReadonlyMap<string, UncertainParameter> = NO_PARAMETERS): Map<string, HoursState> {
  const queries = useMemo(() => entries.map((entry) => hoursQuery(entry.expression, table)), [entries, table]);
  const states = useExpressionSummaries(queries);
  return new Map(entries.flatMap((entry, index) => {
    const state = states[index];
    return state === undefined ? [] : [[entry.key, state] as const];
  }));
}

function hoursText(state: HoursState | undefined): string {
  if (state === undefined || state.status === "pending") return "…";
  if (state.status === "failed") return state.error;
  return `${numberText(state.value.point)} h`;
}

function hoursPoint(state: HoursState | undefined): number | undefined {
  return state?.status === "ready" ? state.value.point : undefined;
}

export { hoursPoint, hoursQuery, hoursText, useHoursPoints, type HoursEntry, type HoursState };
