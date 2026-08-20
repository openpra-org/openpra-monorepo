import { INTERNAL_FLOOD_PRA_SR_CATALOG, INTERNAL_FLOOD_STEP_DEFINITIONS } from "interfaces-mef-types/internal-flood/internal-flood-pra";
import { reviewBlockingInternalFloodPraDiagnostics, validateInternalFloodPra } from "interfaces-mef-types/internal-flood/internal-flood-pra-validation";
import { InternalFloodPRASchema } from "interfaces-mef-types/zod/internal-flood/internal-flood-pra";
import { createInternalFloodPraExample } from "../../example-workbooks/seeds/internal-flood-pra-seed-factory";
import { createBlankInternalFloodPra } from "../blank-internal-flood-pra";

describe("Internal Flood PRA foundation", () => {
  function analysisRecords(value: unknown): Array<{ description: string; basis: string }> {
    if (value === null || typeof value !== "object") return [];
    if (Array.isArray(value)) return value.flatMap((item) => analysisRecords(item));
    const object = value as Record<string, unknown>;
    const current = typeof object.uuid === "string" && typeof object.code === "string" && typeof object.description === "string" && typeof object.basis === "string"
      ? [{ description: object.description, basis: object.basis }]
      : [];
    return [...current, ...Object.values(object).flatMap((item) => analysisRecords(item))];
  }

  it("creates a schema-valid semantic blank workbook, 16-step workflow, and all 108 standard SR rows", () => {
    const mef = createBlankInternalFloodPra("Internal Flood PRA", "preparer");
    expect(InternalFloodPRASchema.safeParse(mef).success).toBe(true);
    expect(INTERNAL_FLOOD_STEP_DEFINITIONS).toHaveLength(16);
    expect(Object.keys(INTERNAL_FLOOD_PRA_SR_CATALOG)).toHaveLength(108);
    expect(Object.values(INTERNAL_FLOOD_PRA_SR_CATALOG).every((entry) => entry.description.length > 20)).toBe(true);
    expect(mef.conformanceMatrix).toHaveLength(108);
    expect(validateInternalFloodPra(mef).some((diagnostic) => diagnostic.severity === "ERROR")).toBe(true);
  });

  it.each(["htgr", "sfr"] as const)("provides a complete, dense %s worked example", (variant) => {
    const mef = createInternalFloodPraExample(variant);
    const records = analysisRecords(mef);
    expect(InternalFloodPRASchema.safeParse(mef).success).toBe(true);
    expect(records.length).toBeGreaterThan(260);
    expect(records.every((record) => record.description.length > 0 && record.basis.length > 0)).toBe(true);
    expect(mef.conformanceMatrix.filter((row) => row.status === "MET")).toHaveLength(107);
    expect(mef.conformanceMatrix.filter((row) => row.status === "NOT_APPLICABLE")).toHaveLength(1);
    expect(mef.integration.interfaces.map((item) => `${item.direction}:${item.technicalElementCode}`)).toEqual([
      "INPUT:POS", "INPUT:IE", "INPUT:ES", "INPUT:SC", "INPUT:SY", "INPUT:HR", "INPUT:DA", "OUTPUT:ESQ", "OUTPUT:RI",
    ]);
    expect(mef.integration.interfaces.flatMap((item) => item.transferItems).length).toBeGreaterThan(70);
    expect(mef.integration.interfaces.every((item) => item.transferItems.every((transfer) => transfer.values.length === item.columns.length))).toBe(true);
    expect(mef.integration.interfaces.every((item) => !["FLPP", "FLSO", "FLSN", "FLEV", "FLPR", "FLHR", "FLESQ"].includes(item.producer) && !["FLPP", "FLSO", "FLSN", "FLEV", "FLPR", "FLHR", "FLESQ"].includes(item.consumer))).toBe(true);
    expect(reviewBlockingInternalFloodPraDiagnostics(mef)).toHaveLength(0);
  });
});
