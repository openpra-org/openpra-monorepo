import {
  canonicalJson,
  expressionReferences,
  parameterReferenceKey,
  type AleatoryVariable,
  type Law,
  type UncertainExpression,
  type UncertainParameter,
  type UncertainUnit,
} from "../core/uncertainty";
import { holdsEstimate } from "../da/data-analysis";
import type {
  EsqBarrierWork,
  EsqCell,
  EsqCellSide,
  EsqFragility,
  EventSequenceQuantification,
} from "./event-sequence-quantification";
import { esqStableId } from "./esq-run-inputs";

type EsqSideName = "load" | "capacity";

type EsqResolvedSide =
  | { kind: "VARIABLE"; variable: AleatoryVariable }
  | { kind: "FRAGILITY"; fragility: EsqFragility };

interface EsqResolvedCell {
  load: EsqResolvedSide;
  capacity: EsqResolvedSide;
  parameters: UncertainParameter[];
}

type EsqSideResult = { side: EsqResolvedSide; problem?: undefined } | { side?: undefined; problem: string };

type EsqCellResult = { cell: EsqResolvedCell; problem?: undefined } | { cell?: undefined; problem: string };

const FIELD_UNITS: ReadonlySet<UncertainUnit> = new Set<UncertainUnit>(["QUANTITY", "FACTOR", "FRACTION", "PROBABILITY"]);

const SIDE_LABELS: Record<EsqSideName, string> = { load: "load", capacity: "capacity" };

function numericNames(record: object, prefix: string): string[] {
  return Object.entries(record).flatMap(([name, value]) => (typeof value === "number" ? [`${prefix}${name}`] : []));
}

function lawFieldNames(law: Law): string[] {
  if (law.family === "TRUNCATED") return [...numericNames(law, ""), ...numericNames(law.law, "law.")];
  return numericNames(law, "");
}

function lawFieldValue(law: Law, field: string): number | undefined {
  const [holder, name] = field.startsWith("law.") && law.family === "TRUNCATED" ? [law.law, field.slice("law.".length)] : [law, field];
  const entry = Object.entries(holder).find(([key]) => key === name);
  return entry !== undefined && typeof entry[1] === "number" ? entry[1] : undefined;
}

function daReferenceProblem(esq: EventSequenceQuantification, expressions: readonly UncertainExpression[], label: string, table: Map<string, UncertainParameter>): string | undefined {
  const workbookId = esq.linkedWorkbooks?.DA?.trim();
  const pending = expressions.flatMap(expressionReferences);
  while (pending.length > 0) {
    const reference = pending.pop();
    if (reference === undefined) break;
    const key = parameterReferenceKey(reference);
    if (table.has(key)) continue;
    if (workbookId === undefined || reference.workbookId.trim() !== workbookId) return `The ${label} reads ${reference.entityId} from a workbook that Step 01 does not link as DA.`;
    const parameter = esq.model?.parameters.find((entry) => entry.id === reference.entityId.trim());
    if (parameter === undefined) return `The ${label} reads DA parameter ${reference.entityId}, which the Step 02 import does not hold.`;
    if (!holdsEstimate(parameter.quantificationModel) || parameter.estimate === undefined) return `The ${label} reads ${parameter.name}, which has no estimate in DA.`;
    table.set(key, { reference, expression: parameter.estimate });
    pending.push(...expressionReferences(parameter.estimate));
  }
  return undefined;
}

function variableProblem(variable: AleatoryVariable, label: string): string | undefined {
  const names = lawFieldNames(variable.law);
  const seen: string[] = [];
  for (const entry of variable.fields) {
    if (!names.includes(entry.field)) return `The ${label} law has no field ${entry.field} to make uncertain.`;
    if (seen.includes(entry.field)) return `The ${label} makes ${entry.field} uncertain twice.`;
    seen.push(entry.field);
    if (entry.value.node === "VALUE" && !FIELD_UNITS.has(entry.value.value.unit)) {
      return `The ${label} field ${entry.field} is typed per time or in time units. Type it as a quantity in the cell unit.`;
    }
  }
  return undefined;
}

function fragilityProblem(fragility: EsqFragility, label: string): string | undefined {
  if (!(Number.isFinite(fragility.median) && fragility.median > 0)) return `The ${label} fragility needs a median above zero.`;
  if (!(Number.isFinite(fragility.betaR) && fragility.betaR >= 0) || !(Number.isFinite(fragility.betaU) && fragility.betaU >= 0)) {
    return `The ${label} fragility needs randomness and uncertainty betas of zero or more.`;
  }
  return undefined;
}

function resolveSide(esq: EventSequenceQuantification, side: EsqCellSide | undefined, name: EsqSideName, table: Map<string, UncertainParameter>): EsqSideResult {
  const label = SIDE_LABELS[name];
  if (side === undefined) return { problem: `The cell has no ${label}.` };
  if (side.source === "FRAGILITY") {
    const problem = fragilityProblem(side.fragility, label);
    return problem === undefined ? { side: { kind: "FRAGILITY", fragility: side.fragility } } : { problem };
  }
  if (side.source === "DA") {
    const parameter = esq.model?.parameters.find((entry) => entry.id === side.parameterId);
    if (parameter === undefined) return { problem: `The ${label} takes ${side.parameterId}, which the Step 02 import does not hold.` };
    if (!holdsEstimate(parameter.quantificationModel) || parameter.estimate === undefined) return { problem: `The ${label} takes ${parameter.name}, which has no estimate in DA.` };
    if (parameter.estimate.node !== "VALUE") return { problem: `The ${label} takes ${parameter.name}, whose DA estimate is not one law.` };
    return { side: { kind: "VARIABLE", variable: { law: parameter.estimate.value.law, fields: [] } } };
  }
  const problem = variableProblem(side.variable, label) ?? daReferenceProblem(esq, side.variable.fields.map((entry) => entry.value), label, table);
  return problem === undefined ? { side: { kind: "VARIABLE", variable: side.variable } } : { problem };
}

function resolveCell(cell: EsqCell, esq: EventSequenceQuantification): EsqCellResult {
  const table = new Map<string, UncertainParameter>();
  const load = resolveSide(esq, cell.load, "load", table);
  if (load.problem !== undefined) return { problem: load.problem };
  const capacity = resolveSide(esq, cell.capacity, "capacity", table);
  if (capacity.problem !== undefined) return { problem: capacity.problem };
  const parameters = [...table.values()].sort((left, right) => parameterReferenceKey(left.reference).localeCompare(parameterReferenceKey(right.reference)));
  return { cell: { load: load.side, capacity: capacity.side, parameters } };
}

function cellInputsKey(cell: EsqCell): string {
  return canonicalJson({ load: cell.load, capacity: cell.capacity, unit: cell.unit });
}

function cellRunValue(cell: EsqCell): number | undefined {
  const run = cell.run;
  if (run === undefined) return undefined;
  return run.mean ?? run.point;
}

function cellRunExpression(cell: EsqCell): UncertainExpression | undefined {
  const run = cell.run;
  if (run === undefined) return undefined;
  const law: Law = run.law ?? { family: "POINT", value: run.point };
  return { node: "VALUE", value: { unit: "PROBABILITY", law } };
}

function cellExpressionOfRecord(cell: EsqCell): UncertainExpression | undefined {
  if (cell.ofRecord === "TYPED") return cell.typed?.expression;
  if (cell.ofRecord === "RUN") return cellRunExpression(cell);
  return undefined;
}

function cellRunStale(cell: EsqCell): boolean {
  return cell.run !== undefined && cell.run.inputs !== cellInputsKey(cell);
}

function esqCellRunId(cellId: string): string {
  return esqStableId(`cell:${cellId}`);
}

function barrierWorkOf(esq: EventSequenceQuantification): EsqBarrierWork {
  return esq.barrierWork ?? {};
}

function cellOf(esq: EventSequenceQuantification, cellId: string): EsqCell | undefined {
  return barrierWorkOf(esq).cells?.find((cell) => cell.id === cellId);
}

export {
  barrierWorkOf,
  cellExpressionOfRecord,
  cellInputsKey,
  cellOf,
  cellRunExpression,
  cellRunStale,
  cellRunValue,
  esqCellRunId,
  lawFieldNames,
  lawFieldValue,
  resolveCell,
  resolveSide,
  type EsqCellResult,
  type EsqResolvedCell,
  type EsqResolvedSide,
  type EsqSideName,
  type EsqSideResult,
};
