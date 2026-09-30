import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RcCategoryResult } from "interfaces-mef-types/rc/case-records";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import { rcFamilyConsequences, rcResultStatisticsText, withRcFamilyConsequences } from "../family-consequences";
import { rcMetricPresets } from "../metrics";

const file = { documentId: "00000000-0000-4000-8000-000000000009", filename: "run.out", sha256: "a".repeat(64), size: 10, uploadedAt: "2026-09-01T00:00:00.000Z" };
const snapshot = (id: string, categoryId: string) => ({ id, label: "Case 01", categoryId, file, inputHash: "b".repeat(64), createdBy: "analyst", reviewItems: 0, inventoryCount: 1, receptorCount: 1, trialCount: 1 });
const result = (id: string, categoryId: string, metricId: string, mean: number): RcCategoryResult => ({ id, snapshotId: "00000000-0000-4000-8000-000000000001", categoryId, metricId, unit: "Sv",
  statistics: { mean, percentiles: [{ percentile: 5, value: mean / 3 }, { percentile: 95, value: mean * 3 }], exceedances: [{ threshold: 0.001, probability: 0.5 }] },
  version: "code 1.0", reference: "Run 1", confirmed: true, file, recordedBy: "analyst", valueSource: "transcribed" });
const family = (entityId: string) => ({ referenceType: "EVENT_SEQUENCE_FAMILY" as const, workbookId: "es-1", entityId });
const workbook = (results: RcCategoryResult[], consequences: RadiologicalConsequenceAnalysis["consequenceQuantification"]["eventSequenceConsequences"] = []) => ({
  scope: { metrics: [{ id: "RCM-01", ...rcMetricPresets[0].metric }, { id: "RCM-02", ...rcMetricPresets[1].metric, name: "" }] },
  releaseCategoryToConsequence: { releaseCategoryInputs: [
    { releaseCategory: "RC-1", sourceTermDefinitionRef: "ST-3", eventSequenceFamilyReferences: [family("ESF-EARLY"), family("ESF-ATWS")], releaseCharacteristics: {} },
    { releaseCategory: "RC-2", eventSequenceFamilyReferences: [family("ESF-LATE")], releaseCharacteristics: {} },
  ] },
  consequenceQuantification: { caseRecords: { revision: 1, snapshots: [snapshot("00000000-0000-4000-8000-000000000001", "RC-1")], results }, eventSequenceConsequences: consequences },
}) as RadiologicalConsequenceAnalysis;

describe("Family consequences from category results", () => {
  it("copies each category result to every family in the category", () => {
    const rows = rcFamilyConsequences(workbook([result("00000000-0000-4000-8000-000000000011", "RC-1", "RCM-01", 0.0125), result("00000000-0000-4000-8000-000000000012", "RC-1", "RCM-02", 0.02)]));
    expect(rows.map((row) => [row.uuid, row.eventSequenceFamily, row.releaseCategoryReference, row.sourceTermReference, row.origin])).toEqual([
      ["RCQ-ESF-EARLY", "ESF-EARLY", "RC-1", "ST-3", "CATEGORY_RESULT"],
      ["RCQ-ESF-ATWS", "ESF-ATWS", "RC-1", "ST-3", "CATEGORY_RESULT"],
    ]);
    expect(rows[0].consequenceResults).toEqual([
      { metric: "30-day dose at the EAB", meanValue: 0.0125, unit: "Sv", uncertaintyDescription: "Mean 0.0125 Sv · 5th percentile 0.004167 Sv · 95th percentile 0.0375 Sv · Chance of exceeding 0.001 Sv: 0.5" },
      { metric: "RCM-02", meanValue: 0.02, unit: "Sv", uncertaintyDescription: "Mean 0.02 Sv · 5th percentile 0.006667 Sv · 95th percentile 0.06 Sv · Chance of exceeding 0.001 Sv: 0.5" },
    ]);
    expect(rows[1].consequenceResults).toEqual(rows[0].consequenceResults);
  });
  it("uses the latest result for a metric and keeps a hand-typed override in place", () => {
    const override = { uuid: "RCQ-ESF-ATWS", eventSequenceFamily: "ESF-ATWS", eventSequenceFamilyReference: family("ESF-ATWS"), releaseCategoryReference: "RC-1",
      consequenceResults: [{ metric: "30-day dose at the EAB", meanValue: 0.009, unit: "Sv" }], origin: "OVERRIDE" as const, overrideReason: "Separate run for the failure-to-trip family." };
    const rows = rcFamilyConsequences(workbook([result("00000000-0000-4000-8000-000000000011", "RC-1", "RCM-01", 0.01), result("00000000-0000-4000-8000-000000000013", "RC-1", "RCM-01", 0.03)], [override]));
    expect(rows.map((row) => row.uuid)).toEqual(["RCQ-ESF-EARLY", "RCQ-ESF-ATWS"]);
    expect(rows[0].consequenceResults.map((row) => row.meanValue)).toEqual([0.03]);
    expect(rows[1]).toBe(override);
  });
  it("keeps the analyst's risk significance and returns the same workbook once derived", () => {
    const first = withRcFamilyConsequences(workbook([result("00000000-0000-4000-8000-000000000011", "RC-1", "RCM-01", 0.01)]));
    const marked = { ...first, consequenceQuantification: { ...first.consequenceQuantification, eventSequenceConsequences: first.consequenceQuantification.eventSequenceConsequences.map((row) => ({ ...row, riskSignificance: ImportanceLevel.HIGH })) } };
    const again = withRcFamilyConsequences(marked);
    expect(again).toBe(marked);
    expect(again.consequenceQuantification.eventSequenceConsequences.every((row) => row.riskSignificance === ImportanceLevel.HIGH)).toBe(true);
  });
  it("drops copied values when the category loses its results", () => {
    const derived = withRcFamilyConsequences(workbook([result("00000000-0000-4000-8000-000000000011", "RC-1", "RCM-01", 0.01)]));
    const cleared = withRcFamilyConsequences({ ...derived, consequenceQuantification: { ...derived.consequenceQuantification, caseRecords: { ...derived.consequenceQuantification.caseRecords!, results: [] } } });
    expect(cleared.consequenceQuantification.eventSequenceConsequences).toEqual([]);
  });
  it("describes percentiles in order and states each threshold chance", () => {
    expect(rcResultStatisticsText({ percentiles: [{ percentile: 95, value: 2 }, { percentile: 50, value: 1 }], exceedances: [] }, "person-Sv")).toBe("50th percentile 1 person-Sv · 95th percentile 2 person-Sv");
  });
});
