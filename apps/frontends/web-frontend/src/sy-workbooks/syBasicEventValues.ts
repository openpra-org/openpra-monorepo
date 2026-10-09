import {
  expressionReferences,
  modelArguments,
  parameterReferenceKey,
  type UncertainExpression,
  type UncertainParameter,
  type UncertainUnit,
} from "interfaces-mef-types/core/uncertainty";
import type { DaQuantificationModel } from "interfaces-mef-types/da/data-analysis";
import type { WorkbookParameterReference } from "interfaces-mef-types/modeling/references";
import { carriesUncertainExpression, type SystemBasicEvent } from "interfaces-mef-types/sy/systems-analysis";
import type { UncertaintyExpressionSummary } from "interfaces-shared-types/newly-developed-methods/shared";
import type { ParameterOption } from "../newly-developed-methods/shared/uncertainEditor";
import {
  parametersFor,
  useExpressionSummaries,
  type ExpressionQuery,
  type UncertaintyState,
} from "../newly-developed-methods/shared/useUncertainty";
import type { SyControlledParameterOption } from "./syWorkbookContext";

type PointState = UncertaintyState<UncertaintyExpressionSummary>;

type ParameterTable = ReadonlyMap<string, UncertainParameter>;

type RateBasis = Extract<NonNullable<SystemBasicEvent["quantificationBasis"]>, { kind: "FAILURE_RATE" }>;

type OptionAddress = Pick<SyControlledParameterOption, "workbookId" | "parameterId">;

const RATE_MODELS: readonly DaQuantificationModel[] = ["RUNNING_RATE", "STANDBY_RATE"];

const HOURS_PER_UNIT: Record<RateBasis["failureRate"]["unit"], number> = {
  SECOND: 1 / 3_600,
  MINUTE: 1 / 60,
  HOUR: 1,
  DAY: 24,
  YEAR: 8_760,
};

const PENDING: PointState = { status: "pending" };

function componentUnit(model: DaQuantificationModel): UncertainUnit {
  return RATE_MODELS.includes(model) ? "PER_HOUR" : "PROBABILITY";
}

function parameterReference(option: OptionAddress): WorkbookParameterReference {
  return { referenceType: "WORKBOOK_PARAMETER", workbookId: option.workbookId, entityId: option.parameterId };
}

function optionKey(option: OptionAddress): string {
  return parameterReferenceKey({ workbookId: option.workbookId, entityId: option.parameterId });
}

function parameterTable(options: readonly SyControlledParameterOption[]): Map<string, UncertainParameter> {
  return new Map(options.map((option) => [optionKey(option), { reference: parameterReference(option), expression: option.estimate }]));
}

function valueTable(parameters: readonly SyControlledParameterOption[], missionTimes: ParameterTable): ParameterTable {
  return new Map([...parameterTable(parameters), ...missionTimes]);
}

function editorOptions(options: readonly SyControlledParameterOption[]): ParameterOption[] {
  return options.map((option) => ({ reference: parameterReference(option), label: `${option.workbookName} · ${option.parameterName}`, unit: option.unit }));
}

function parameterLabel(options: readonly SyControlledParameterOption[]): (key: string) => string {
  const names = new Map(options.map((option) => [optionKey(option), option.parameterName]));
  return (key) => names.get(key) ?? "an unavailable DA estimate";
}

function referenceKeys(expression: UncertainExpression | undefined): string[] {
  return expression === undefined ? [] : [...new Set(expressionReferences(expression).map(parameterReferenceKey))];
}

function linkedOptions(expression: UncertainExpression | undefined, options: readonly SyControlledParameterOption[]): SyControlledParameterOption[] {
  const byKey = new Map(options.map((option) => [optionKey(option), option]));
  return referenceKeys(expression).flatMap((key) => {
    const option = byKey.get(key);
    return option === undefined ? [] : [option];
  });
}

function missingReferences(expression: UncertainExpression | undefined, table: ParameterTable): string[] {
  return referenceKeys(expression).filter((key) => !table.has(key));
}

function expressionUncertain(expression: UncertainExpression, table: ParameterTable, seen: ReadonlySet<string> = new Set()): boolean {
  switch (expression.node) {
    case "VALUE":
      return expression.value.law.family !== "POINT";
    case "PARAMETER": {
      const key = parameterReferenceKey(expression.reference);
      const parameter = table.get(key);
      return parameter !== undefined && !seen.has(key) && expressionUncertain(parameter.expression, table, new Set([...seen, key]));
    }
    case "OPERATION":
      return expression.operands.some((operand) => expressionUncertain(operand, table, seen));
    case "MODEL":
      return modelArguments(expression.model).some((argument) => expressionUncertain(argument, table, seen));
  }
}

function pointExpression(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value } } };
}

function hoursExpression(hours: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: hours } } };
}

function rateBasisExpression(basis: RateBasis, missionTime: UncertainExpression | undefined): UncertainExpression {
  const rate: UncertainExpression = { node: "VALUE", value: { unit: "PER_HOUR", law: { family: "POINT", value: basis.failureRate.value / HOURS_PER_UNIT[basis.failureRate.unit] } } };
  return { node: "MODEL", model: { form: "MISSION", rate, missionTime: missionTime ?? hoursExpression(basis.missionTime.value * HOURS_PER_UNIT[basis.missionTime.unit]) } };
}

function withoutStoredValue(event: SystemBasicEvent): SystemBasicEvent {
  const { probability: _probability, quantificationBasis: _basis, controlledDataSource: _source, dataAnalysisBasicEventRef: _reference, ...rest } = event;
  return rest;
}

function withoutExpression(event: SystemBasicEvent): SystemBasicEvent {
  const { expression: _expression, ...rest } = event;
  return rest;
}

function withExpression(event: SystemBasicEvent, expression: UncertainExpression | undefined): SystemBasicEvent {
  const stripped = withoutStoredValue(withoutExpression(event));
  return expression === undefined ? stripped : { ...stripped, expression };
}

function storedExpression(event: SystemBasicEvent, missionTime: UncertainExpression | undefined): UncertainExpression | undefined {
  if (event.expression !== undefined) return event.expression;
  const basis = event.quantificationBasis;
  if (basis?.kind === "FAILURE_RATE") return rateBasisExpression(basis, missionTime);
  return event.probability !== undefined && Number.isFinite(event.probability) ? pointExpression(event.probability) : undefined;
}

function asComponentEvent(event: SystemBasicEvent, missionTime: UncertainExpression | undefined): SystemBasicEvent {
  return withExpression(event, storedExpression(event, missionTime));
}

function asNonComponentEvent(event: SystemBasicEvent): SystemBasicEvent {
  const kept = withoutExpression(event);
  const expression = event.expression;
  if (kept.probability !== undefined || expression?.node !== "VALUE" || expression.value.law.family !== "POINT") return kept;
  return { ...kept, probability: expression.value.law.value, quantificationBasis: { kind: "PROBABILITY" } };
}

function withFailureMode(event: SystemBasicEvent, failureMode: string | undefined, failureModeSource: SystemBasicEvent["failureModeSource"], missionTime: UncertainExpression | undefined): SystemBasicEvent {
  const { failureMode: _mode, failureModeSource: _source, ...rest } = event;
  const next: SystemBasicEvent = {
    ...rest,
    ...(failureMode === undefined ? {} : { failureMode }),
    ...(failureModeSource === undefined ? {} : { failureModeSource }),
  };
  const component = carriesUncertainExpression(failureMode);
  if (component === carriesUncertainExpression(event.failureMode)) return next;
  return component ? asComponentEvent(next, missionTime) : asNonComponentEvent(next);
}

function eventQuery(expression: UncertainExpression, table: ParameterTable): ExpressionQuery {
  return { expression, unit: "PROBABILITY", probabilities: [], parameters: parametersFor([expression], table) };
}

function useExpressionPoints(expressions: readonly UncertainExpression[], table: ParameterTable): PointState[] {
  const states = useExpressionSummaries(expressions.map((expression) => eventQuery(expression, table)));
  return expressions.map((_, index) => states[index] ?? PENDING);
}

function useEventPoints(events: readonly SystemBasicEvent[], table: ParameterTable): Map<string, PointState> {
  const valued = events.flatMap((event) => (carriesUncertainExpression(event.failureMode) && event.expression !== undefined ? [{ id: event.uuid, expression: event.expression }] : []));
  const states = useExpressionPoints(valued.map(({ expression }) => expression), table);
  return new Map(valued.map(({ id }, index) => [id, states[index] ?? PENDING]));
}

export {
  asComponentEvent,
  componentUnit,
  editorOptions,
  expressionUncertain,
  linkedOptions,
  missingReferences,
  optionKey,
  parameterLabel,
  parameterTable,
  pointExpression,
  useEventPoints,
  useExpressionPoints,
  valueTable,
  withExpression,
  withFailureMode,
  withoutStoredValue,
  type ParameterTable,
  type PointState,
};
