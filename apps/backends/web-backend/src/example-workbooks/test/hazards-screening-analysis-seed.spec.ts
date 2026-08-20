import { HSA_SR_CATALOG } from "interfaces-mef-types/hazards-screening/hazards-screening-analysis";
import { validateHazardsScreeningAnalysis } from "interfaces-mef-types/hazards-screening/hazards-screening-analysis-validation";
import { HazardsScreeningAnalysisSchema } from "interfaces-mef-types/zod/hazards-screening/hazards-screening-analysis";
import { createHazardsScreeningAnalysisExample } from "../seeds/hazards-screening-analysis-seed-factory";

describe.each(["htgr", "sfr"] as const)("%s Hazards Screening Analysis example", (variant) => {
  const mef = createHazardsScreeningAnalysisExample(variant);
  it("passes the schema and review-blocking validation", () => {
    const parsed = HazardsScreeningAnalysisSchema.safeParse(mef);
    expect(parsed.success).toBe(true);
    expect(validateHazardsScreeningAnalysis(mef).filter((item) => item.severity === "ERROR")).toEqual([]);
  });
  it("has a broad inventory, complete dispositions, accepted interfaces, and full conformance", () => {
    expect(mef.hazardInventory.hazards.length).toBeGreaterThanOrEqual(35);
    expect(mef.integration.finalDispositions).toHaveLength(mef.hazardInventory.hazards.length);
    expect(mef.traceability.paths).toHaveLength(mef.hazardInventory.hazards.length);
    expect(mef.integration.interfaces.length).toBeGreaterThanOrEqual(12);
    expect(mef.integration.interfaces.every((item) => item.transferItems.length > 0)).toBe(true);
    expect(mef.integration.interfaces.flatMap((item) => item.transferItems).every((item) => item.values.length > 0)).toBe(true);
    expect(mef.integration.interfaces.find((item) => item.code === "HS-IF-POS-IN")?.transferItems).toHaveLength(6);
    expect(mef.integration.interfaces.find((item) => item.code === "HS-IF-SY-IN")?.transferItems).toHaveLength(mef.plantResponse.vulnerableSscs.length);
    expect(mef.integration.interfaces.find((item) => item.code === "HS-IF-RI-OUT")?.transferItems).toHaveLength(mef.hazardInventory.hazards.length);
    expect(mef.integration.interfaces.map((item) => item.technicalElementCode)).toEqual(expect.arrayContaining(["HR", "F", "FL"]));
    expect(mef.conformanceMatrix).toHaveLength(Object.keys(HSA_SR_CATALOG).length);
    expect(mef.conformanceMatrix.filter((item) => item.applicableToStage.includes(mef.plantStage)).every((item) => item.status === "MET")).toBe(true);
  });
});
