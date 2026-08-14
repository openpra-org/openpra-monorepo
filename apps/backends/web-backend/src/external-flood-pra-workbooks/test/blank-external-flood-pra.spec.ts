import { EXTERNAL_FLOOD_PRA_SR_CATALOG, EXTERNAL_FLOOD_STEP_DEFINITIONS } from "interfaces-mef-types/external-flood/external-flood-pra";
import { validateExternalFloodPra } from "interfaces-mef-types/external-flood/external-flood-pra-validation";
import { ExternalFloodPRASchema } from "interfaces-mef-types/zod/external-flood/external-flood-pra";
import { createExternalFloodPraSeed } from "../../example-workbooks/seeds/external-flood-pra-seed-factory";
import { createBlankExternalFloodPra } from "../blank-external-flood-pra";

describe("External Flood PRA workbook model", () => {
  it("creates a parseable blank workbook with 23 analyst steps and all SRs", () => {
    const blank = createBlankExternalFloodPra("XF workbook", "analyst");
    expect(ExternalFloodPRASchema.safeParse(blank).success).toBe(true);
    expect(EXTERNAL_FLOOD_STEP_DEFINITIONS).toHaveLength(23);
    expect(Object.keys(EXTERNAL_FLOOD_PRA_SR_CATALOG)).toHaveLength(109);
    expect(blank.conformanceMatrix).toHaveLength(109);
  });

  it.each(["HTGR", "SFR"] as const)("provides a complete parseable %s example", (variant) => {
    const seed = createExternalFloodPraSeed(variant);
    const parsed = ExternalFloodPRASchema.safeParse(seed);
    if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n"));
    expect(validateExternalFloodPra(seed).filter((item) => item.severity === "ERROR")).toEqual([]);
    expect(seed.analysisBasis.interfaces.map((item) => `${item.direction}:${item.technicalElementCode}`)).toEqual([
      "INPUT:HS", "INPUT:POS", "INPUT:IE", "INPUT:ES", "INPUT:SC", "INPUT:SY", "INPUT:HR", "INPUT:DA", "INPUT:FL", "INPUT:S", "INPUT:W", "OUTPUT:ESQ", "OUTPUT:RI",
    ]);
    expect(seed.analysisBasis.interfaces.every((item) => item.transferItems.length >= 4)).toBe(true);
    expect(seed.analysisBasis.interfaces.flatMap((item) => item.transferItems)).toHaveLength(65);
    expect(seed.analysisBasis.interfaces.every((item) => item.transferItems.every((transfer) => transfer.values.length === item.columns.length))).toBe(true);
    expect(seed.analysisBasis.interfaces.some((item) => item.technicalElementCode === "F" || item.technicalElementCode === "O")).toBe(false);
    expect(seed.humanReliabilityAnalysis.humanActions.length).toBeGreaterThanOrEqual(4);
  });
});
