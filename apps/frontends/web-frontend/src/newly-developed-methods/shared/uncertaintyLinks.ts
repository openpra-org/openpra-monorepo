import {
  modelArguments,
  parameterReferenceKey,
  type UncertainExpression,
  type UncertainParameter,
  type UncertainUnit,
} from "interfaces-mef-types/core/uncertainty";
import type { WorkbookParameterReference } from "interfaces-mef-types/modeling/references";
import type {
  UncertaintyExpressionQuery,
  UncertaintyFailure,
  UncertaintyRequest,
  UncertaintyResponse,
} from "interfaces-shared-types/newly-developed-methods/shared";
import { evaluateUncertainty } from "./uncertaintyApi";

interface LinkRoot {
  expression: UncertainExpression;
  missionTime: boolean;
}

interface MissingLink {
  reference: WorkbookParameterReference;
  missionTime: boolean;
}

type LinkTable = ReadonlyMap<string, UncertainParameter>;

function missingLinks(roots: readonly LinkRoot[], table: LinkTable): MissingLink[] {
  const missing = new Map<string, MissingLink>();
  const visited = new Set<string>();
  const visit = (expression: UncertainExpression, missionTime: boolean): void => {
    switch (expression.node) {
      case "VALUE":
        return;
      case "PARAMETER": {
        const key = parameterReferenceKey(expression.reference);
        const parameter = table.get(key);
        if (parameter === undefined) {
          missing.set(key, { reference: expression.reference, missionTime: missionTime || missing.get(key)?.missionTime === true });
          return;
        }
        if (visited.has(key)) return;
        visited.add(key);
        visit(parameter.expression, false);
        return;
      }
      case "OPERATION":
        expression.operands.forEach((operand) => visit(operand, missionTime));
        return;
      case "MODEL":
        if (expression.model.form === "MISSION") {
          visit(expression.model.rate, false);
          visit(expression.model.missionTime, true);
          return;
        }
        modelArguments(expression.model).forEach((argument) => visit(argument, false));
    }
  };
  roots.forEach((root) => visit(root.expression, root.missionTime));
  return [...missing.values()];
}

function missingLinkMessage(link: MissingLink): string {
  const { workbookId, entityId } = link.reference;
  return link.missionTime
    ? `Mission time ${entityId} is in SC workbook ${workbookId}, which is not loaded.`
    : `Linked value ${entityId} is in workbook ${workbookId}, which is not loaded.`;
}

function unresolvedLink(expression: UncertainExpression, unit: UncertainUnit, table: LinkTable): string | undefined {
  const [first] = missingLinks([{ expression, missionTime: unit === "HOURS" }], table);
  return first === undefined ? undefined : missingLinkMessage(first);
}

function blockedQueries(queries: readonly UncertaintyExpressionQuery[], table: LinkTable): UncertaintyFailure[] {
  return queries.flatMap((query) => {
    const error = unresolvedLink(query.expression, query.unit, table);
    return error === undefined ? [] : [{ id: query.id, error }];
  });
}

async function evaluateResolved(request: UncertaintyRequest): Promise<UncertaintyResponse> {
  const table = new Map(request.parameters.map((parameter) => [parameterReferenceKey(parameter.reference), parameter]));
  const blocked = blockedQueries(request.expressions, table);
  const parameters = request.parameters.filter((parameter) => missingLinks([{ expression: parameter.expression, missionTime: false }], table).length === 0);
  if (blocked.length === 0 && parameters.length === request.parameters.length) return evaluateUncertainty(request);
  const blockedIds = new Set(blocked.map((failure) => failure.id));
  const expressions = request.expressions.filter((query) => !blockedIds.has(query.id));
  const sent = expressions.length === 0 && request.laws.length === 0 && request.operations.length === 0
    ? { laws: [], expressions: [], operations: [] }
    : await evaluateUncertainty({ ...request, parameters, expressions });
  return { ...sent, expressions: [...sent.expressions, ...blocked] };
}

export { evaluateResolved, missingLinkMessage, missingLinks, unresolvedLink, type LinkRoot, type LinkTable, type MissingLink };
