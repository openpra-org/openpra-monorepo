import { InitiatingEventsAnalysisSchema } from "interfaces-mef-types/zod/ie/initiating-event-analysis";
import { ScreeningStatus } from "interfaces-mef-types/core/shared-patterns";
import { createBlankIe } from "../blank-ie";
import { IE_ANALYSIS } from "../../example-workbooks/seeds/ie-seed";

describe("IE MEF builders", () => {
  it("creates a blank IE that conforms to the IE Zod schema", () => {
    const blank = createBlankIe("Test IE", "alice");
    const parsed = InitiatingEventsAnalysisSchema.safeParse(blank);
    expect(parsed.success).toBe(true);
  });

  it("starts a blank IE in DRAFT with empty collections", () => {
    const blank = createBlankIe("Test IE", "alice");
    expect(blank.workflowState).toBe("DRAFT");
    expect(blank.initiators).toHaveLength(0);
    expect(blank.initiatingEventGroups).toHaveLength(0);
    expect(blank.applicablePlantOperatingStates).toHaveLength(0);
    expect(blank.owner).toBe("alice");
  });

  it("validates the Generic HTGR example seed against the IE Zod schema", () => {
    const parsed = InitiatingEventsAnalysisSchema.safeParse(IE_ANALYSIS);
    expect(parsed.success).toBe(true);
  });

  it("builds the example seed through step 04 (scope, sources, methods, initiators)", () => {
    expect(IE_ANALYSIS.includesNonInternalHazardGroups).toBe(false);
    expect(IE_ANALYSIS.sourceMechanisms.length).toBeGreaterThan(0);
    expect((IE_ANALYSIS.searchMethods ?? []).length).toBeGreaterThan(0);
    expect(IE_ANALYSIS.initiators.length).toBeGreaterThan(0);
    const categories = new Set(IE_ANALYSIS.initiators.map((i) => i.category));
    expect(categories.size).toBe(5);
  });

  it("records hazard groups through step 06 (each screened to its dedicated element, mapped to real initiators)", () => {
    const hazards = IE_ANALYSIS.hazardAnalyses ?? [];
    expect(hazards.length).toBeGreaterThan(0);
    expect(hazards.every((h) => h.screeningStatus === ScreeningStatus.SCREENED_OUT)).toBe(true);
    const initiatorIds = new Set(IE_ANALYSIS.initiators.map((i) => i.uuid));
    expect(hazards.every((h) => h.inducedInitiatorIds.every((id) => initiatorIds.has(id)))).toBe(true);
    expect(hazards.some((h) => h.potentialCombinations.length > 0)).toBe(true);
  });

  it("groups the retained initiators through step 07 (MECE, bounded, non-masking)", () => {
    const groups = IE_ANALYSIS.initiatingEventGroups;
    expect(groups.length).toBeGreaterThan(0);
    const initiatorIds = new Set(IE_ANALYSIS.initiators.map((i) => i.uuid));
    const retained = new Set(
      IE_ANALYSIS.initiators.filter((i) => i.screeningStatus === ScreeningStatus.RETAINED).map((i) => i.uuid),
    );
    const members = groups.flatMap((g) => g.memberInitiatorIds);
    expect(new Set(members).size).toBe(members.length);
    expect(members.every((m) => initiatorIds.has(m))).toBe(true);
    expect(new Set(members)).toEqual(retained);
    expect(groups.every((g) => g.memberInitiatorIds.includes(g.boundingInitiatorId))).toBe(true);
  });

  it("screens every initiator through step 08 (IE-C9 gate, four not retained)", () => {
    const records = IE_ANALYSIS.screeningRecords;
    expect(records.length).toBe(IE_ANALYSIS.initiators.length);
    const initiatorIds = new Set(IE_ANALYSIS.initiators.map((i) => i.uuid));
    expect(records.every((r) => initiatorIds.has(r.initiatorOrGroupId))).toBe(true);
    const screened = records.filter((r) => !r.retained).map((r) => r.initiatorOrGroupId).sort();
    expect(screened).toEqual(["IE-32", "IE-35", "IE-36", "IE-37"]);
    expect(records.filter((r) => !r.retained).every((r) => r.criterion !== undefined)).toBe(true);
  });

  it("quantifies every group through step 09 (mean and lognormal uncertainty)", () => {
    const quant = IE_ANALYSIS.quantifications;
    const groupIds = new Set(IE_ANALYSIS.initiatingEventGroups.map((g) => g.uuid));
    expect(quant.length).toBe(groupIds.size);
    expect(quant.every((q) => groupIds.has(q.initiatorOrGroupId))).toBe(true);
    expect(quant.every((q) => {
      const f = q.meanFrequency;
      return (typeof f === "number" ? f : f.value) > 0;
    })).toBe(true);
    expect(IE_ANALYSIS.initiatingEventGroups.every((g) => g.meanFrequency !== undefined)).toBe(true);
  });
});
