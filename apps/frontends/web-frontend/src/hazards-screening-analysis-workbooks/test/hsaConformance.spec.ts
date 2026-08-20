import { createHazardsScreeningAnalysisExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/hazards-screening-analysis-seed-factory";
import { hsaConformanceItems, hsaConformanceScore } from "../hsaConformance";

describe.each(["htgr", "sfr"] as const)("%s HSA conformance", (variant) => {
  it("renders all applicable requirements as satisfied", () => {
    const score = hsaConformanceScore(hsaConformanceItems(createHazardsScreeningAnalysisExample(variant)));
    expect(score.met).toBe(score.applicable);
    expect(score.blocked).toBe(0);
  });
});
