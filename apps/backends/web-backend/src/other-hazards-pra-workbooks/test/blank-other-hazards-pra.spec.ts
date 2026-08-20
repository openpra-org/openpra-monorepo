import { OTHER_HAZARDS_PRA_SR_CATALOG, OTHER_HAZARDS_STEP_DEFINITIONS } from "interfaces-mef-types/other-hazards/other-hazards-pra";
import { validateOtherHazardsPra } from "interfaces-mef-types/other-hazards/other-hazards-pra-validation";
import { OtherHazardsPRASchema } from "interfaces-mef-types/zod/other-hazards/other-hazards-pra";
import { createBlankOtherHazardsPra } from "../blank-other-hazards-pra";
import { createOtherHazardsPraSeed } from "../../example-workbooks/seeds/other-hazards-pra-seed-factory";

describe("Other Hazards PRA foundation", () => {
  it("creates a schema-valid semantic blank workbook", () => {
    const mef = createBlankOtherHazardsPra("Other Hazards PRA", "analyst");
    const parsed = OtherHazardsPRASchema.safeParse(mef);
    if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n"));
    expect(mef.type).toBe("other-hazards-pra");
    expect(mef.plantStage).toBe("PRE_OPERATIONAL");
    expect(mef.hazardCurveAnalysis.hazardCurves).toEqual([]);
    expect(validateOtherHazardsPra(mef).some((item) => item.severity === "ERROR")).toBe(true);
  });

  it("defines the complete analyst workflow and conformance catalog", () => {
    expect(OTHER_HAZARDS_STEP_DEFINITIONS).toHaveLength(21);
    expect(Object.keys(OTHER_HAZARDS_PRA_SR_CATALOG).length).toBeGreaterThanOrEqual(45);
    expect(Object.values(OTHER_HAZARDS_PRA_SR_CATALOG).every((entry) => entry.description.length > 20)).toBe(true);
  });

  it.each(["HTGR", "SFR"] as const)("provides a complete, schema-valid %s example", (variant) => {
    const mef = createOtherHazardsPraSeed(variant);
    const parsed = OtherHazardsPRASchema.safeParse(mef);
    if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n"));
    expect(validateOtherHazardsPra(mef).filter((item) => item.severity === "ERROR")).toEqual([]);
    expect(mef.analysisBasis.interfaces.length).toBeGreaterThanOrEqual(18);
    expect(mef.analysisBasis.interfaces.every((item) => item.transferItems.length >= 3)).toBe(true);
    expect(mef.retainedHazardGroups.hazardGroups).toHaveLength(3);
    expect(mef.humanReliabilityAnalysis.humanActions.length).toBeGreaterThanOrEqual(4);
    expect(mef.conformanceMatrix.every((item) => item.status === "MET" || item.status === "NOT_APPLICABLE")).toBe(true);
  });
});
