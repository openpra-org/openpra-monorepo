import { HIGH_WINDS_PRA_SR_CATALOG, HIGH_WINDS_STEP_DEFINITIONS } from "interfaces-mef-types/high-winds/high-winds-pra";
import { validateHighWindsPra } from "interfaces-mef-types/high-winds/high-winds-pra-validation";
import { HighWindsPRASchema } from "interfaces-mef-types/zod/high-winds/high-winds-pra";
import { HIGH_WINDS_PRA_ANALYSIS } from "../../example-workbooks/seeds/high-winds-pra-seed";
import { HIGH_WINDS_PRA_ANALYSIS_SFR } from "../../example-workbooks/seeds/high-winds-pra-seed-sfr";
import { createBlankHighWindsPra } from "../blank-high-winds-pra";

describe("High Winds PRA foundation", () => {
  it("creates a schema-valid semantic blank workbook", () => {
    const mef = createBlankHighWindsPra("High Winds PRA", "analyst");
    expect(HighWindsPRASchema.safeParse(mef).success).toBe(true);
    expect(mef.type).toBe("high-winds-pra");
    expect(mef.plantStage).toBe("PRE_OPERATIONAL");
    expect(mef.hazardIntegration.hazardCurves).toEqual([]);
    expect(validateHighWindsPra(mef).some((item) => item.severity === "ERROR")).toBe(true);
  });

  it("defines the complete 21-step workflow and all 123 High Winds SRs", () => {
    expect(HIGH_WINDS_STEP_DEFINITIONS).toHaveLength(21);
    expect(Object.keys(HIGH_WINDS_PRA_SR_CATALOG)).toHaveLength(123);
    expect(Object.values(HIGH_WINDS_PRA_SR_CATALOG).every((entry) => entry.description.length > 20)).toBe(true);
  });

  it.each([["HTGR", HIGH_WINDS_PRA_ANALYSIS], ["SFR", HIGH_WINDS_PRA_ANALYSIS_SFR]])("provides a complete %s seeded analysis", (_name, mef) => {
    const parsed = HighWindsPRASchema.safeParse(mef);
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error(parsed.error.message);
    expect(validateHighWindsPra(parsed.data).filter((item) => item.severity === "ERROR")).toEqual([]);
    expect(parsed.data.conformanceMatrix.filter((item) => item.status === "PENDING_REVIEW")).toHaveLength(0);
    expect(parsed.data.analysisBasis.interfaces.length).toBeGreaterThanOrEqual(10);
    expect(parsed.data.hazardIntegration.hazardIntervals).toHaveLength(21);
    expect(parsed.data.plantInvestigationAndMissileSurvey.missileSources.length).toBeGreaterThanOrEqual(4);
  });
});
