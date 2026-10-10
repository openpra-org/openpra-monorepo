import { ccfFactorExpressions, ccfFactorVector, ccfModelTakesTotal, mapCcfFactorExpressions, type CcfFactorModel, type UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { CcfFactorModelSchema, ccfTotalAllowedByModel, ccfTotalMatchesModel } from "interfaces-mef-types/zod/core/uncertainty";
import { EsqCcfRecordSchema } from "interfaces-mef-types/zod/esq/event-sequence-quantification";
import { UncertaintyOperationQuerySchema, UncertaintyResponseSchema } from "../newly-developed-methods/shared/uncertainty-api";

const point = (unit: "PROBABILITY" | "FRACTION", value: number): UncertainExpression => ({ node: "VALUE", value: { unit, law: { family: "POINT", value } } });

const bfr: CcfFactorModel = {
  model: "BINOMIAL_FAILURE_RATE",
  independent: point("PROBABILITY", 1e-3),
  nonLethalShock: point("PROBABILITY", 2e-4),
  componentFailure: point("FRACTION", 0.15),
  lethalShock: point("PROBABILITY", 3e-6),
};

const beta: CcfFactorModel = { model: "BETA_FACTOR", beta: point("FRACTION", 0.05) };

describe("binomial failure rate contract", () => {
  it("parses the four parts and rejects a missing one", () => {
    expect(CcfFactorModelSchema.safeParse(bfr).success).toBe(true);
    const partial = { model: "BINOMIAL_FAILURE_RATE", independent: point("PROBABILITY", 1e-3), nonLethalShock: point("PROBABILITY", 2e-4), componentFailure: point("FRACTION", 0.15) };
    expect(CcfFactorModelSchema.safeParse(partial).success).toBe(false);
  });

  it("lists and maps its expressions and holds no vector", () => {
    expect(ccfFactorExpressions(bfr)).toHaveLength(4);
    expect(ccfFactorVector(bfr)).toBeUndefined();
    const doubled = mapCcfFactorExpressions(bfr, () => point("PROBABILITY", 0.5));
    expect(ccfFactorExpressions(doubled).every((expression) => expression.node === "VALUE" && expression.value.law.family === "POINT" && expression.value.law.value === 0.5)).toBe(true);
    expect(ccfModelTakesTotal(bfr)).toBe(false);
    expect(ccfModelTakesTotal(beta)).toBe(true);
  });

  it("takes a total only on the other models", () => {
    const total = point("PROBABILITY", 2e-3);
    expect(ccfTotalMatchesModel({ factors: bfr })).toBe(true);
    expect(ccfTotalMatchesModel({ factors: bfr, total })).toBe(false);
    expect(ccfTotalMatchesModel({ factors: beta, total })).toBe(true);
    expect(ccfTotalMatchesModel({ factors: beta })).toBe(false);
    expect(ccfTotalAllowedByModel({ factors: beta })).toBe(true);
    expect(ccfTotalAllowedByModel({ factors: bfr, total })).toBe(false);
    const record = { id: "G", name: "Pumps", systemIds: [], memberIds: ["A", "B"], factors: bfr };
    expect(EsqCcfRecordSchema.safeParse(record).success).toBe(true);
    expect(EsqCcfRecordSchema.safeParse({ ...record, total }).success).toBe(false);
  });
});

describe("common cause mapping operations", () => {
  it("accepts the three operations and their results", () => {
    for (const operation of [
      { kind: "CCF_IMPACT_VECTOR", groupSize: 4, multiplicities: [{ failed: 2, events: 3 }] },
      { kind: "CCF_MAP_DOWN", counts: [1, 2, 3, 4], targetSize: 2 },
      { kind: "CCF_MAP_UP", independent: 0, nonLethal: [0.5, 0.5], lethal: 0, rho: 0.1, targetSize: 4 },
    ]) {
      expect(UncertaintyOperationQuerySchema.safeParse({ id: "x", operation }).success).toBe(true);
    }
    expect(UncertaintyOperationQuerySchema.safeParse({ id: "x", operation: { kind: "CCF_MAP_UP", independent: 0, nonLethal: [1], lethal: 0, rho: 1.5, targetSize: 2 } }).success).toBe(false);
    expect(UncertaintyOperationQuerySchema.safeParse({ id: "x", operation: { kind: "CCF_MAP_DOWN", counts: [1, 2], targetSize: 1.5 } }).success).toBe(false);
    const response = {
      laws: [],
      expressions: [],
      operations: [
        { id: "rows", groupSize: 4, counts: [0, 3, 0, 0] },
        { id: "down", groupSize: 2, counts: [3.33, 5.83], noImpact: 0.83 },
      ],
    };
    expect(UncertaintyResponseSchema.safeParse(response).success).toBe(true);
  });
});
