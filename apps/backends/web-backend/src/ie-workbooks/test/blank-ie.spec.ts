import { InitiatingEventsAnalysisSchema } from "interfaces-mef-types/zod/ie/initiating-event-analysis";
import { FrequencyUnit } from "interfaces-mef-types/core/events";
import { ScreeningStatus } from "interfaces-mef-types/core/shared-patterns";
import type { InitiatingEventGroup } from "interfaces-mef-types/ie/initiating-event-analysis";
import { createBlankIe } from "../blank-ie";
import { IE_ANALYSIS } from "../../example-workbooks/seeds/ie-seed";
import { IE_ANALYSIS_SFR } from "../../example-workbooks/seeds/ie-seed-sfr";

function linkedByReference(group: InitiatingEventGroup): boolean {
  const link = group.controlledDataSource;
  const expression = group.frequency?.expression;
  return link !== undefined && expression?.node === "PARAMETER" && expression.reference.workbookId === link.workbookId && expression.reference.entityId === link.entityId;
}

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

  it("quantifies every group through step 09 (DA estimates linked by reference, lognormal sources)", () => {
    const quant = IE_ANALYSIS.quantifications;
    const groups = new Map(IE_ANALYSIS.initiatingEventGroups.map((g) => [g.uuid, g]));
    expect(quant.length).toBe(groups.size);
    expect(quant.every((q) => q.frequency !== undefined && q.frequency.basis === FrequencyUnit.PER_PLANT_YEAR)).toBe(true);
    expect(quant.every((q) => JSON.stringify(q.frequency) === JSON.stringify(groups.get(q.initiatorOrGroupId)?.frequency))).toBe(true);
    expect(IE_ANALYSIS.initiatingEventGroups.every(linkedByReference)).toBe(true);
    const sources = quant.flatMap((q) => q.dataSources ?? []);
    expect(sources.every((source) => {
      const expression = source.estimate ?? source.faultTreeTop;
      return expression?.node === "VALUE" && expression.value.unit === "PER_YEAR" && expression.value.law.family === "LOGNORMAL" && expression.value.law.level === 0.95;
    })).toBe(true);
  });
});

describe("Generic SFR IE example seed", () => {
  it("validates the Generic SFR example seed against the IE Zod schema", () => {
    const parsed = InitiatingEventsAnalysisSchema.safeParse(IE_ANALYSIS_SFR);
    expect(parsed.success).toBe(true);
  });

  it("is the operational EBR-II reference plant spanning the five challenge categories", () => {
    expect(IE_ANALYSIS_SFR.plantStage).toBe("OPERATIONAL");
    expect(IE_ANALYSIS_SFR.capabilityCategory).toBe("CC-II");
    expect(IE_ANALYSIS_SFR.metadata.plantIdentity?.name).toBe("Generic SFR");
    expect(IE_ANALYSIS_SFR.initiators.length).toBeGreaterThan(0);
    const categories = new Set(IE_ANALYSIS_SFR.initiators.map((i) => i.category));
    expect(categories.size).toBe(5);
  });

  it("records SFR hazard groups screened to dedicated elements, mapped to real initiators", () => {
    const hazards = IE_ANALYSIS_SFR.hazardAnalyses ?? [];
    expect(hazards.length).toBeGreaterThan(0);
    expect(hazards.every((h) => h.screeningStatus === ScreeningStatus.SCREENED_OUT)).toBe(true);
    const initiatorIds = new Set(IE_ANALYSIS_SFR.initiators.map((i) => i.uuid));
    expect(hazards.every((h) => h.inducedInitiatorIds.every((id) => initiatorIds.has(id)))).toBe(true);
    expect(hazards.some((h) => h.potentialCombinations.length > 0)).toBe(true);
  });

  it("groups the retained SFR initiators (MECE, bounded, non-masking)", () => {
    const groups = IE_ANALYSIS_SFR.initiatingEventGroups;
    expect(groups.length).toBeGreaterThan(0);
    const initiatorIds = new Set(IE_ANALYSIS_SFR.initiators.map((i) => i.uuid));
    const retained = new Set(
      IE_ANALYSIS_SFR.initiators.filter((i) => i.screeningStatus === ScreeningStatus.RETAINED).map((i) => i.uuid),
    );
    const members = groups.flatMap((g) => g.memberInitiatorIds);
    expect(new Set(members).size).toBe(members.length);
    expect(members.every((m) => initiatorIds.has(m))).toBe(true);
    expect(new Set(members)).toEqual(retained);
    expect(groups.every((g) => g.memberInitiatorIds.includes(g.boundingInitiatorId))).toBe(true);
  });

  it("screens every SFR initiator (IE-C9 gate, four not retained)", () => {
    const records = IE_ANALYSIS_SFR.screeningRecords;
    expect(records.length).toBe(IE_ANALYSIS_SFR.initiators.length);
    const initiatorIds = new Set(IE_ANALYSIS_SFR.initiators.map((i) => i.uuid));
    expect(records.every((r) => initiatorIds.has(r.initiatorOrGroupId))).toBe(true);
    const screened = records.filter((r) => !r.retained).map((r) => r.initiatorOrGroupId).sort();
    expect(screened).toEqual(["IE-12", "IE-17", "IE-22", "IE-23"]);
    expect(records.filter((r) => !r.retained).every((r) => r.criterion !== undefined)).toBe(true);
  });

  it("quantifies every SFR group (DA links by reference, typed hazards and operating-data counts)", () => {
    const quant = IE_ANALYSIS_SFR.quantifications;
    const groups = new Map(IE_ANALYSIS_SFR.initiatingEventGroups.map((g) => [g.uuid, g]));
    expect(quant.length).toBe(groups.size);
    expect(quant.every((q) => q.frequency !== undefined && JSON.stringify(q.frequency) === JSON.stringify(groups.get(q.initiatorOrGroupId)?.frequency))).toBe(true);
    const typed = IE_ANALYSIS_SFR.initiatingEventGroups.filter((g) => !linkedByReference(g)).map((g) => g.uuid);
    expect(typed).toEqual(["HZ-FIRE", "HZ-SEIS"]);
    const operating = quant.flatMap((q) => (q.dataSources ?? []).filter((source) => source.basis === "OPERATING_DATA"));
    expect(operating.length).toBeGreaterThan(0);
    expect(operating.every((source) => source.eventCount !== undefined && (source.exposureModuleYears ?? 0) > 0 && source.estimate === undefined)).toBe(true);
  });
});
