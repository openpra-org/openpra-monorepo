import { canonicalJson, expressionReferences } from "interfaces-mef-types/core/uncertainty";
import { SystemsAnalysisSchema } from "interfaces-mef-types/zod/sy/systems-analysis";
import { SY_ANALYSIS } from "../seeds/sy-seed";
import { SY_ANALYSIS_HTGR } from "../seeds/sy-seed-htgr";
import { DA_ANALYSIS } from "../seeds/da-seed";
import { DA_ANALYSIS_HTGR } from "../seeds/da-seed-htgr";
import { reconcileExampleSyDataAnalysisReferences } from "../seeds/dependency-model-seed";

const variants = [
  { name: "SFR", sy: SY_ANALYSIS, da: DA_ANALYSIS, link: "example-da-sfr" },
  { name: "HTGR", sy: SY_ANALYSIS_HTGR, da: DA_ANALYSIS_HTGR, link: "example-da-htgr" },
] as const;

describe("example common cause groups", () => {
  it.each(variants)("copies the linked DA factors exactly in $name", ({ sy, da }) => {
    const estimates = new Map((da.ccfParameterEstimations ?? []).map((estimate) => [estimate.uuid, estimate]));
    expect(sy.commonCauseFailureGroups.length).toBeGreaterThan(0);
    for (const group of sy.commonCauseFailureGroups) {
      const estimate = estimates.get(group.dataAnalysisCCFParameterRef ?? "");
      expect(estimate?.ccfGroupReference).toBe(group.uuid);
      expect(estimate?.factors).toBeDefined();
      expect(canonicalJson(group.factors)).toBe(canonicalJson(estimate?.factors));
    }
  });

  it.each(variants)("takes each group total from the value its members share in $name", ({ sy, da, link }) => {
    const events = new Map(sy.systemBasicEvents.map((event) => [event.uuid, event]));
    for (const group of sy.commonCauseFailureGroups) {
      const members = group.members?.basicEvents ?? [];
      expect(members.length).toBeGreaterThanOrEqual(2);
      for (const member of members) expect(canonicalJson(events.get(member.id)?.expression)).toBe(canonicalJson(group.total));
      const estimate = (da.ccfParameterEstimations ?? []).find((candidate) => candidate.uuid === group.dataAnalysisCCFParameterRef);
      expect(expressionReferences(group.total)).toEqual([{ referenceType: "WORKBOOK_PARAMETER", workbookId: link, entityId: estimate?.memberParameterId }]);
    }
  });

  it.each(variants)("points the group totals at the linked DA workbook with their members in $name", ({ sy, da }) => {
    const reconciled = SystemsAnalysisSchema.parse(reconcileExampleSyDataAnalysisReferences(SystemsAnalysisSchema.parse(structuredClone(sy)), da, "real-da-workbook"));
    const events = new Map(reconciled.systemBasicEvents.map((event) => [event.uuid, event]));
    for (const group of reconciled.commonCauseFailureGroups) {
      expect(expressionReferences(group.total).map((reference) => reference.workbookId)).toEqual(["real-da-workbook"]);
      const first = group.members?.basicEvents[0];
      expect(canonicalJson(events.get(first?.id ?? "")?.expression)).toBe(canonicalJson(group.total));
    }
  });
});
