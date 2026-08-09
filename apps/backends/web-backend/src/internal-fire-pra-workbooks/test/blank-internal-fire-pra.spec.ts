import { INTERNAL_FIRE_PRA_SR_CATALOG, INTERNAL_FIRE_STEP_DEFINITIONS } from "interfaces-mef-types/internal-fire/internal-fire-pra";
import { validateInternalFirePra } from "interfaces-mef-types/internal-fire/internal-fire-pra-validation";
import { InternalFirePRASchema } from "interfaces-mef-types/zod/internal-fire/internal-fire-pra";
import { validateInternalFirePra } from "interfaces-mef-types/internal-fire/internal-fire-pra-validation";
import { INTERNAL_FIRE_PRA_ANALYSIS } from "../../example-workbooks/seeds/internal-fire-pra-seed";
import { INTERNAL_FIRE_PRA_ANALYSIS_SFR } from "../../example-workbooks/seeds/internal-fire-pra-seed-sfr";
import { createBlankInternalFirePra } from "../blank-internal-fire-pra";

describe("Internal Fire PRA foundation", () => {
  it("creates a schema-valid semantic blank workbook", () => {
    const mef = createBlankInternalFirePra("Internal Fire PRA", "analyst");
    expect(InternalFirePRASchema.safeParse(mef).success).toBe(true);
    expect(mef.type).toBe("internal-fire-pra");
    expect(mef.plantStage).toBe("PRE_OPERATIONAL");
    expect(mef.plantBoundaryAndPartitioning.physicalAnalysisUnits).toEqual([]);
    expect(validateInternalFirePra(mef).some((item) => item.code === "FPP-001")).toBe(true);
  });

  it("defines the complete 18-step workflow and all 165 Internal Fire SRs", () => {
    expect(INTERNAL_FIRE_STEP_DEFINITIONS).toHaveLength(18);
    expect(Object.keys(INTERNAL_FIRE_PRA_SR_CATALOG)).toHaveLength(165);
    expect(Object.values(INTERNAL_FIRE_PRA_SR_CATALOG).every((entry) => entry.description.length > 20)).toBe(true);
  });

  it.each([["HTGR", INTERNAL_FIRE_PRA_ANALYSIS], ["SFR", INTERNAL_FIRE_PRA_ANALYSIS_SFR]])("provides a complete %s seeded analysis", (_name, mef) => {
    expect(InternalFirePRASchema.safeParse(mef).success).toBe(true);
    expect(validateInternalFirePra(mef).filter((item) => item.severity === "ERROR")).toEqual([]);
    expect(mef.conformanceMatrix.filter((item) => item.status === "PENDING_REVIEW")).toHaveLength(0);
    expect(mef.eventSequenceQuantification.riskContributors.length).toBeGreaterThanOrEqual(12);
  });
});
