import { SuccessCriteriaDevelopmentSchema } from "interfaces-mef-types/zod/sc/success-criteria-development";
import { createBlankSc } from "../blank-sc";
import { SC_ANALYSIS } from "../../example-workbooks/seeds/sc-seed";
import { SC_ANALYSIS_HTGR } from "../../example-workbooks/seeds/sc-seed-htgr";

describe("SC MEF builders", () => {
  it("creates a blank SC that conforms to the SC Zod schema", () => {
    const blank = createBlankSc("Test SC", "alice");
    const parsed = SuccessCriteriaDevelopmentSchema.safeParse(blank);
    expect(parsed.success).toBe(true);
  });

  it("starts a blank SC in DRAFT with empty collections", () => {
    const blank = createBlankSc("Test SC", "alice");
    expect(blank.workflowState).toBe("DRAFT");
    expect(blank.safetyFunctionSuccessCriteria).toHaveLength(0);
    expect(blank.endStateDefinitions).toHaveLength(0);
    expect(blank.missionTimes).toHaveLength(0);
    expect(blank.owner).toBe("alice");
  });

  it("validates the Generic-1 example seed against the SC Zod schema", () => {
    const parsed = SuccessCriteriaDevelopmentSchema.safeParse(SC_ANALYSIS);
    expect(parsed.success).toBe(true);
  });

  it("seeds success criteria, mission times, and engineering analyses", () => {
    expect(SC_ANALYSIS.safetyFunctionSuccessCriteria.length).toBe(19);
    expect(SC_ANALYSIS.missionTimes.length).toBe(5);
    expect(SC_ANALYSIS.engineeringAnalyses.length).toBe(7);
    expect(SC_ANALYSIS.endStateDefinitions.length).toBe(4);
  });

  it("validates the Generic-2 HTGR example seed against the SC Zod schema", () => {
    const parsed = SuccessCriteriaDevelopmentSchema.safeParse(SC_ANALYSIS_HTGR);
    expect(parsed.success).toBe(true);
  });

  it("seeds the HTGR example from the coupled campaign", () => {
    expect(SC_ANALYSIS_HTGR.safetyFunctionSuccessCriteria.length).toBe(273);
    expect(SC_ANALYSIS_HTGR.missionTimes.length).toBe(5);
    expect(SC_ANALYSIS_HTGR.engineeringAnalyses.length).toBe(5);
    expect(SC_ANALYSIS_HTGR.passiveSafetyFunctionCriteria.length).toBe(3);
  });
});
