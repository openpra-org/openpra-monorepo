import { useEffect, useSyncExternalStore } from "react";
import {
  canonicalJson,
  expressionReferences,
  parameterReferenceKey,
  type UncertainExpression,
  type UncertainParameter,
  type UncertainUnit,
  type UncertainValue,
} from "interfaces-mef-types/core/uncertainty";
import type {
  UncertaintyExpressionSummary,
  UncertaintyFailure,
  UncertaintyLawSummary,
  UncertaintyOperation,
  UncertaintyOperationResult,
  UncertaintyRequest,
  UncertaintySampling,
} from "interfaces-shared-types/newly-developed-methods/shared";
import { ApiError } from "../../api/client";
import { evaluateResolved } from "./uncertaintyLinks";

type UncertaintyState<T> = { status: "pending" } | { status: "ready"; value: T } | { status: "failed"; error: string };

type UncertaintyAnswer = Exclude<UncertaintyOperationResult, UncertaintyFailure>;

interface LawQuery {
  value: UncertainValue;
  probabilities: readonly number[];
  curveProbabilities: readonly number[];
}

interface ExpressionQuery {
  expression: UncertainExpression;
  unit: UncertainUnit;
  probabilities: readonly number[];
  sampling?: UncertaintySampling;
  parameters: readonly UncertainParameter[];
}

const PENDING = { status: "pending" } as const;

const BUSY_STATUS = 503;

const BUSY_RETRY_MS = 1000;

const laws = new Map<string, UncertaintyState<UncertaintyLawSummary>>();
const expressions = new Map<string, UncertaintyState<UncertaintyExpressionSummary>>();
const operations = new Map<string, UncertaintyState<UncertaintyAnswer>>();
const lawQueue = new Map<string, LawQuery>();
const expressionQueue = new Map<string, ExpressionQuery>();
const operationQueue = new Map<string, UncertaintyOperation>();
const listeners = new Set<() => void>();
let version = 0;
let scheduled = false;
let inFlight = 0;

function notify(): void {
  version += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function currentVersion(): number {
  return version;
}

function failure<T>(error: Error | string): UncertaintyState<T> {
  return { status: "failed", error: typeof error === "string" ? error : error.message };
}

function settle<T extends { id: string }>(target: Map<string, UncertaintyState<T>>, keys: readonly string[], answers: readonly (T | UncertaintyFailure)[]): void {
  keys.forEach((key, index) => {
    const answer = answers.find((entry) => entry.id === String(index));
    if (answer === undefined) target.set(key, { status: "failed", error: "PRAXIS gave no answer for this query." });
    else if ("error" in answer) target.set(key, { status: "failed", error: answer.error });
    else target.set(key, { status: "ready", value: answer });
  });
}

interface Batch {
  laws: [string, LawQuery][];
  expressions: [string, ExpressionQuery][];
  operations: [string, UncertaintyOperation][];
}

function queued(): boolean {
  return lawQueue.size > 0 || expressionQueue.size > 0 || operationQueue.size > 0;
}

function schedule(delay = 0): void {
  if (scheduled) return;
  scheduled = true;
  setTimeout(flush, delay);
}

function joins(table: Map<string, UncertainParameter>, parameters: readonly UncertainParameter[]): boolean {
  return parameters.every((parameter) => {
    const known = table.get(parameterReferenceKey(parameter.reference));
    return known === undefined || canonicalJson(known) === canonicalJson(parameter);
  });
}

function takeBatch(): { batch: Batch; parameters: UncertainParameter[] } {
  const table = new Map<string, UncertainParameter>();
  const taken: [string, ExpressionQuery][] = [];
  for (const entry of expressionQueue.entries()) {
    if (!joins(table, entry[1].parameters)) continue;
    entry[1].parameters.forEach((parameter) => table.set(parameterReferenceKey(parameter.reference), parameter));
    taken.push(entry);
  }
  taken.forEach(([key]) => expressionQueue.delete(key));
  const batch: Batch = { laws: [...lawQueue.entries()], expressions: taken, operations: [...operationQueue.entries()] };
  lawQueue.clear();
  operationQueue.clear();
  const parameters = [...table.values()].sort((left, right) => parameterReferenceKey(left.reference).localeCompare(parameterReferenceKey(right.reference)));
  return { batch, parameters };
}

function requeue(batch: Batch): void {
  batch.laws.forEach(([key, query]) => lawQueue.set(key, query));
  batch.expressions.forEach(([key, query]) => expressionQueue.set(key, query));
  batch.operations.forEach(([key, operation]) => operationQueue.set(key, operation));
}

function fail(batch: Batch, error: Error): void {
  batch.laws.forEach(([key]) => laws.set(key, failure(error)));
  batch.expressions.forEach(([key]) => expressions.set(key, failure(error)));
  batch.operations.forEach(([key]) => operations.set(key, failure(error)));
}

function finished(): void {
  inFlight -= 1;
  notify();
  if (queued()) schedule();
}

function send(batch: Batch, parameters: UncertainParameter[]): Promise<void> {
  const request: UncertaintyRequest = {
    parameters,
    laws: batch.laws.map(([, query], index) => ({ id: String(index), value: query.value, probabilities: [...query.probabilities], curveProbabilities: [...query.curveProbabilities] })),
    expressions: batch.expressions.map(([, query], index) => ({
      id: String(index),
      expression: query.expression,
      unit: query.unit,
      probabilities: [...query.probabilities],
      ...(query.sampling === undefined ? {} : { sampling: query.sampling }),
    })),
    operations: batch.operations.map(([, operation], index) => ({ id: String(index), operation })),
  };
  inFlight += 1;
  return evaluateResolved(request)
    .then(
      (response) => {
        settle(laws, batch.laws.map(([key]) => key), response.laws);
        settle(expressions, batch.expressions.map(([key]) => key), response.expressions);
        settle(operations, batch.operations.map(([key]) => key), response.operations);
      },
      (error: Error) => {
        if (error instanceof ApiError && error.status === BUSY_STATUS) {
          requeue(batch);
          schedule(BUSY_RETRY_MS);
          return;
        }
        fail(batch, error);
      },
    )
    .then(finished);
}

function flush(): void {
  scheduled = false;
  if (inFlight > 0 || !queued()) return;
  const { batch, parameters } = takeBatch();
  void send(batch, parameters);
}

function lawKey(query: LawQuery): string {
  return canonicalJson(query);
}

function expressionKey(query: ExpressionQuery): string {
  return canonicalJson(query);
}

function operationKey(operation: UncertaintyOperation): string {
  return canonicalJson(operation);
}

function requestLaw(query: LawQuery): void {
  const key = lawKey(query);
  if (laws.has(key)) return;
  laws.set(key, PENDING);
  lawQueue.set(key, query);
  schedule();
}

function requestExpression(query: ExpressionQuery): void {
  const key = expressionKey(query);
  if (expressions.has(key)) return;
  expressions.set(key, PENDING);
  expressionQueue.set(key, query);
  schedule();
}

function requestOperation(operation: UncertaintyOperation): void {
  const key = operationKey(operation);
  if (operations.has(key)) return;
  operations.set(key, PENDING);
  operationQueue.set(key, operation);
  schedule();
}

function peekOperation(operation: UncertaintyOperation): UncertaintyState<UncertaintyAnswer> {
  return operations.get(operationKey(operation)) ?? PENDING;
}

function peekLaw(query: LawQuery): UncertaintyState<UncertaintyLawSummary> {
  return laws.get(lawKey(query)) ?? PENDING;
}

function uncertaintyVersion(): number {
  return version;
}

function uncertaintyIdle(): boolean {
  return !scheduled && inFlight === 0 && lawQueue.size === 0 && expressionQueue.size === 0 && operationQueue.size === 0;
}

function peekExpression(query: ExpressionQuery): UncertaintyState<UncertaintyExpressionSummary> {
  return expressions.get(expressionKey(query)) ?? PENDING;
}

function parametersFor(expressionsUsed: readonly UncertainExpression[], table: ReadonlyMap<string, UncertainParameter>): UncertainParameter[] {
  const kept = new Map<string, UncertainParameter>();
  const pending = expressionsUsed.flatMap(expressionReferences);
  while (pending.length > 0) {
    const reference = pending.pop();
    if (reference === undefined) break;
    const key = parameterReferenceKey(reference);
    if (kept.has(key)) continue;
    const parameter = table.get(key);
    if (parameter === undefined) continue;
    kept.set(key, parameter);
    pending.push(...expressionReferences(parameter.expression));
  }
  return [...kept.values()].sort((left, right) => parameterReferenceKey(left.reference).localeCompare(parameterReferenceKey(right.reference)));
}

function useUncertaintyVersion(): number {
  return useSyncExternalStore(subscribe, currentVersion, currentVersion);
}

function useLawSummaries(queries: readonly LawQuery[]): UncertaintyState<UncertaintyLawSummary>[] {
  useUncertaintyVersion();
  const keys = queries.map(lawKey);
  useEffect(() => {
    queries.forEach(requestLaw);
  }, [queries]);
  return keys.map((key) => laws.get(key) ?? PENDING);
}

function useExpressionSummaries(queries: readonly ExpressionQuery[]): UncertaintyState<UncertaintyExpressionSummary>[] {
  useUncertaintyVersion();
  const keys = queries.map(expressionKey);
  useEffect(() => {
    queries.forEach(requestExpression);
  }, [queries]);
  return keys.map((key) => expressions.get(key) ?? PENDING);
}

function useOperationResults(queries: readonly UncertaintyOperation[]): UncertaintyState<UncertaintyAnswer>[] {
  useUncertaintyVersion();
  const keys = queries.map(operationKey);
  useEffect(() => {
    queries.forEach(requestOperation);
  }, [queries]);
  return keys.map((key) => operations.get(key) ?? PENDING);
}

export {
  parametersFor,
  peekExpression,
  peekLaw,
  peekOperation,
  requestExpression,
  requestLaw,
  requestOperation,
  uncertaintyIdle,
  uncertaintyVersion,
  useExpressionSummaries,
  useLawSummaries,
  useOperationResults,
  useUncertaintyVersion,
  type ExpressionQuery,
  type LawQuery,
  type UncertaintyAnswer,
  type UncertaintyState,
};
