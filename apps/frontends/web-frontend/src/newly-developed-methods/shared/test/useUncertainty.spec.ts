import type { UncertainExpression, UncertainParameter } from "interfaces-mef-types/core/uncertainty";
import type { UncertaintyRequest, UncertaintyResponse } from "interfaces-shared-types/newly-developed-methods/shared";
import { ApiError } from "../../../api/client";
import { evaluateUncertainty } from "../uncertaintyApi";
import { peekExpression, peekLaw, requestExpression, requestLaw, type ExpressionQuery, type LawQuery } from "../useUncertainty";
import { praxisUncertainty, settledWithPraxis } from "./praxisUncertainty";

jest.mock("../uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

const sent: UncertaintyRequest[] = [];
let open = 0;
let widest = 0;

function counted(request: UncertaintyRequest): Promise<UncertaintyResponse> {
  sent.push(request);
  open += 1;
  widest = Math.max(widest, open);
  return praxisUncertainty(request).finally(() => {
    open -= 1;
  });
}

function parameter(entityId: string, value: number): UncertainParameter {
  return {
    reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da", entityId },
    expression: { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value } } },
  };
}

function reference(entityId: string): UncertainExpression {
  return { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da", entityId } };
}

function law(alpha: number): LawQuery {
  return { value: { unit: "PROBABILITY", law: { family: "BETA", alpha, beta: 20, lower: 0, upper: 1 } }, probabilities: [0.5], curveProbabilities: [] };
}

function expression(entityId: string, parameters: UncertainParameter[]): ExpressionQuery {
  return { expression: reference(entityId), unit: "PROBABILITY", probabilities: [], parameters };
}

beforeEach(() => {
  sent.length = 0;
  open = 0;
  widest = 0;
  jest.mocked(evaluateUncertainty).mockImplementation(counted);
});

describe("uncertainty store", () => {
  it("keeps one request in flight and merges parameter tables that agree", async () => {
    const pump = parameter("pump", 0.01);
    const valve = parameter("valve", 0.02);
    const queries = [expression("pump", [pump]), expression("valve", [valve]), expression("pump", [parameter("pump", 0.03)])];
    requestLaw(law(1.5));
    requestLaw(law(2.5));
    queries.forEach(requestExpression);
    const points = await settledWithPraxis(() => queries.map((query) => peekExpression(query)));
    expect(widest).toBe(1);
    expect(sent).toHaveLength(2);
    expect(sent[0]?.laws).toHaveLength(2);
    expect(sent[0]?.expressions).toHaveLength(2);
    expect(sent[0]?.parameters.map((entry) => entry.reference.entityId)).toEqual(["pump", "valve"]);
    expect(sent[1]?.expressions).toHaveLength(1);
    expect(points.map((point) => (point.status === "ready" ? point.value.point : Number.NaN))).toEqual([0.01, 0.02, 0.03]);
    expect(peekLaw(law(1.5)).status).toBe("ready");
  });

  it("asks again when PRAXIS is busy instead of failing the queries", async () => {
    jest.mocked(evaluateUncertainty).mockImplementationOnce(() => Promise.reject(new ApiError("PRAXIS is busy; retry when an active run finishes", 503)));
    requestLaw(law(3.5));
    const summary = await settledWithPraxis(() => peekLaw(law(3.5)));
    expect(summary.status).toBe("ready");
    expect(sent).toHaveLength(1);
  });

  it("fails the queries on any other error", async () => {
    jest.mocked(evaluateUncertainty).mockImplementationOnce(() => Promise.reject(new ApiError("The law is not valid", 400)));
    requestLaw(law(4.5));
    const summary = await settledWithPraxis(() => peekLaw(law(4.5)));
    expect(summary).toEqual({ status: "failed", error: "The law is not valid" });
  });
});
