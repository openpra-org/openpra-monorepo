import {
  parameterReferenceKey,
  type UncertainExpression,
  type UncertainParameter,
  type UncertainUnit,
} from "interfaces-mef-types/core/uncertainty";
import { evaluateUncertainty } from "./uncertaintyApi";
import { parametersFor } from "./useUncertainty";

interface PointEntry {
  key: string;
  expression: UncertainExpression;
  unit: UncertainUnit;
}

interface EstimateRecord {
  uuid: string;
  estimate?: UncertainExpression;
}

function workbookParameterTable(workbookId: string, records: readonly EstimateRecord[]): Map<string, UncertainParameter> {
  const table = new Map<string, UncertainParameter>();
  for (const record of records) {
    if (record.estimate === undefined) continue;
    const parameter: UncertainParameter = { reference: { referenceType: "WORKBOOK_PARAMETER", workbookId, entityId: record.uuid }, expression: record.estimate };
    table.set(parameterReferenceKey(parameter.reference), parameter);
  }
  return table;
}

function estimateUnit(expression: UncertainExpression): UncertainUnit | undefined {
  if (expression.node === "VALUE") return expression.value.unit;
  if (expression.node === "MODEL") return "PROBABILITY";
  return undefined;
}

async function pointsOf(entries: readonly PointEntry[], table: ReadonlyMap<string, UncertainParameter>): Promise<Map<string, number>> {
  const points = new Map<string, number>();
  if (entries.length === 0) return points;
  const response = await evaluateUncertainty({
    parameters: parametersFor(entries.map((entry) => entry.expression), table),
    laws: [],
    operations: [],
    expressions: entries.map((entry, index) => ({ id: String(index), expression: entry.expression, unit: entry.unit, probabilities: [] })),
  });
  for (const result of response.expressions) {
    if (!("point" in result)) continue;
    const entry = entries[Number(result.id)];
    if (entry !== undefined) points.set(entry.key, result.point);
  }
  return points;
}

export { estimateUnit, pointsOf, workbookParameterTable, type EstimateRecord, type PointEntry };
