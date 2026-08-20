import { createBlankHazardsScreeningAnalysis } from "../blank-hazards-screening-analysis";
import { HSA_SR_CATALOG } from "interfaces-mef-types/hazards-screening/hazards-screening-analysis";
import { HazardsScreeningAnalysisSchema } from "interfaces-mef-types/zod/hazards-screening/hazards-screening-analysis";

describe("blank Hazards Screening Analysis", () => {
  it("conforms to the HSA MEF schema and contains the complete SR matrix", () => {
    const blank = createBlankHazardsScreeningAnalysis("HSA", "analyst");
    expect(HazardsScreeningAnalysisSchema.safeParse(blank).success).toBe(true);
    expect(blank.conformanceMatrix.map((item) => item.sr)).toEqual(Object.keys(HSA_SR_CATALOG));
  });
});
