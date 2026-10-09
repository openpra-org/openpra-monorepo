import { useMemo } from "react";
import type { UncertainExpression, UncertainParameter } from "interfaces-mef-types/core/uncertainty";
import type { FaultTreeBasicEvent } from "interfaces-mef-types/modeling";
import { evaluateResolved, unresolvedLink } from "../shared/uncertaintyLinks";
import { parametersFor, useExpressionSummaries, type ExpressionQuery } from "../shared/useUncertainty";

type ParameterTable = ReadonlyMap<string, UncertainParameter>;

type BasicEventPoint = { status: "pending" } | { status: "ready"; point: number } | { status: "failed"; error: string };

interface PointEntry {
  key: string;
  expression: UncertainExpression;
}

const NO_PARAMETERS: ParameterTable = new Map();

const PENDING: BasicEventPoint = { status: "pending" };

function pointQuery(expression: UncertainExpression, table: ParameterTable): ExpressionQuery {
  return { expression, unit: "PROBABILITY", probabilities: [], parameters: parametersFor([expression], table) };
}

function useBasicEventPoints(entries: readonly PointEntry[], table: ParameterTable = NO_PARAMETERS): Map<string, BasicEventPoint> {
  const unresolved = useMemo(() => new Map(entries.flatMap((entry) => {
    const error = unresolvedLink(entry.expression, "PROBABILITY", table);
    return error === undefined ? [] : [[entry.key, error] as const];
  })), [entries, table]);
  const resolvable = useMemo(() => entries.filter((entry) => !unresolved.has(entry.key)), [entries, unresolved]);
  const queries = useMemo(() => resolvable.map((entry) => pointQuery(entry.expression, table)), [resolvable, table]);
  const states = useExpressionSummaries(queries);
  const points = new Map<string, BasicEventPoint>([...unresolved].map(([key, error]) => [key, { status: "failed", error }]));
  resolvable.forEach((entry, index) => {
    const state = states[index];
    if (state === undefined || state.status === "pending") points.set(entry.key, PENDING);
    else if (state.status === "failed") points.set(entry.key, { status: "failed", error: state.error });
    else points.set(entry.key, { status: "ready", point: state.value.point });
  });
  return points;
}

function storedPoint(event: FaultTreeBasicEvent | undefined, points: ReadonlyMap<string, BasicEventPoint>): BasicEventPoint {
  if (event === undefined) return { status: "failed", error: "The basic event is missing." };
  if (event.probability.expression !== undefined) return points.get(event.id) ?? PENDING;
  return Number.isFinite(event.probability.value)
    ? { status: "ready", point: event.probability.value }
    : { status: "failed", error: "This basic event has no value yet." };
}

function pointText(point: BasicEventPoint): string {
  if (point.status === "pending") return "…";
  if (point.status === "failed") return "—";
  return point.point.toExponential(1);
}

async function withImportedPoints(events: readonly FaultTreeBasicEvent[], table: ParameterTable = NO_PARAMETERS): Promise<FaultTreeBasicEvent[]> {
  const open = events.flatMap((event) => (Number.isNaN(event.probability.value) && event.probability.expression !== undefined ? [{ event, expression: event.probability.expression }] : []));
  if (open.length === 0) return [...events];
  const response = await evaluateResolved({
    parameters: parametersFor(open.map((entry) => entry.expression), table),
    laws: [],
    operations: [],
    expressions: open.map((entry, index) => ({ id: String(index), expression: entry.expression, unit: "PROBABILITY", probabilities: [] })),
  });
  const points = new Map<string, number>();
  for (const result of response.expressions) {
    const entry = open[Number(result.id)];
    if (entry === undefined) continue;
    if (!("point" in result)) throw new Error(`The value of ${entry.event.code} could not be evaluated. ${result.error}`);
    points.set(entry.event.id, result.point);
  }
  return events.map((event) => {
    if (!Number.isNaN(event.probability.value) || event.probability.expression === undefined) return event;
    const point = points.get(event.id);
    if (point === undefined) throw new Error(`The value of ${event.code} could not be evaluated.`);
    return { ...event, probability: { ...event.probability, value: point } };
  });
}

export { pointText, storedPoint, useBasicEventPoints, withImportedPoints, type BasicEventPoint, type ParameterTable, type PointEntry };
