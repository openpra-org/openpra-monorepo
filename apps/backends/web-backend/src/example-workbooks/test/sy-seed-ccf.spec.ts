import { canonicalJson, ccfFactorExpressions, ccfFactorVector, ccfModelTakesTotal, expressionReferences, parameterReferenceKey } from "interfaces-mef-types/core/uncertainty";
import { SystemsAnalysisSchema } from "interfaces-mef-types/zod/sy/systems-analysis";
import { DataAnalysisSchema } from "interfaces-mef-types/zod/da/data-analysis";
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
  it.each(variants)("parses and copies the linked DA factors exactly in $name", ({ sy, da }) => {
    expect(SystemsAnalysisSchema.safeParse(sy).success).toBe(true);
    expect(DataAnalysisSchema.safeParse(da).success).toBe(true);
    const estimates = new Map((da.ccfParameterEstimations ?? []).map((estimate) => [estimate.uuid, estimate]));
    expect(sy.commonCauseFailureGroups.length).toBeGreaterThan(0);
    for (const group of sy.commonCauseFailureGroups) {
      const estimate = estimates.get(group.dataAnalysisCCFParameterRef ?? "");
      expect(estimate?.ccfGroupReference).toBe(group.uuid);
      expect(estimate?.factors).toBeDefined();
      expect(canonicalJson(group.factors)).toBe(canonicalJson(estimate?.factors));
      expect(estimate?.groupSize).toBe(group.members?.basicEvents.length);
    }
  });

  it.each(variants)("covers every model, with a total only where the model takes one, in $name", ({ sy }) => {
    const models = new Set(sy.commonCauseFailureGroups.map((group) => group.factors.model));
    expect([...models].sort()).toEqual(["ALPHA_FACTOR", "BETA_FACTOR", "BINOMIAL_FAILURE_RATE", "MGL", "PHI_FACTOR"]);
    for (const group of sy.commonCauseFailureGroups) expect(group.total !== undefined).toBe(ccfModelTakesTotal(group.factors));
  });

  it.each(variants)("takes each group total from the value its members share in $name", ({ sy, da, link }) => {
    const events = new Map(sy.systemBasicEvents.map((event) => [event.uuid, event]));
    for (const group of sy.commonCauseFailureGroups) {
      const members = group.members?.basicEvents ?? [];
      expect(members.length).toBeGreaterThanOrEqual(2);
      const estimate = (da.ccfParameterEstimations ?? []).find((candidate) => candidate.uuid === group.dataAnalysisCCFParameterRef);
      const total = group.total;
      if (total === undefined) {
        const references = ccfFactorExpressions(group.factors).flatMap(expressionReferences).map((reference) => reference.entityId);
        if (estimate?.method === "BAYES") expect(references.every((reference) => reference.startsWith(`ccff/${estimate.uuid}/updated/`))).toBe(true);
        else expect(references).toContain(estimate?.memberParameterId);
        continue;
      }
      for (const member of members) expect(canonicalJson(events.get(member.id)?.expression)).toBe(canonicalJson(total));
      expect(expressionReferences(total)).toEqual([{ referenceType: "WORKBOOK_PARAMETER", workbookId: link, entityId: estimate?.memberParameterId }]);
    }
  });

  it.each(variants)("links alpha vectors to the vectors DA publishes and shares one between groups in $name", ({ sy, da, link }) => {
    const published = new Map((da.ccfVectors ?? []).map((vector) => [vector.id, vector]));
    const users = new Map<string, string[]>();
    for (const group of sy.commonCauseFailureGroups) {
      const vector = ccfFactorVector(group.factors);
      if (vector?.node !== "PARAMETER") continue;
      expect(vector.reference.workbookId).toBe(link);
      const held = published.get(vector.reference.entityId);
      expect(held?.groupSize).toBe(group.members?.basicEvents.length);
      users.set(parameterReferenceKey(vector.reference), [...(users.get(parameterReferenceKey(vector.reference)) ?? []), group.uuid]);
    }
    expect([...users.values()].some((groups) => groups.length >= 2)).toBe(true);
  });

  it.each(variants)("points the group links at the linked DA workbook with their members in $name", ({ sy, da }) => {
    const reconciled = SystemsAnalysisSchema.parse(reconcileExampleSyDataAnalysisReferences(SystemsAnalysisSchema.parse(structuredClone(sy)), da, "real-da-workbook"));
    const events = new Map(reconciled.systemBasicEvents.map((event) => [event.uuid, event]));
    for (const group of reconciled.commonCauseFailureGroups) {
      const vector = ccfFactorVector(group.factors);
      const references = [...(group.total === undefined ? [] : expressionReferences(group.total)), ...ccfFactorExpressions(group.factors).flatMap(expressionReferences), ...(vector?.node === "PARAMETER" ? [vector.reference] : [])];
      expect([...new Set(references.map((reference) => reference.workbookId))]).toEqual(references.length === 0 ? [] : ["real-da-workbook"]);
      const first = group.members?.basicEvents[0];
      if (group.total !== undefined) expect(canonicalJson(events.get(first?.id ?? "")?.expression)).toBe(canonicalJson(group.total));
    }
  });

  it("carries a group of eight in the SFR control rod bank", () => {
    const bank = SY_ANALYSIS.commonCauseFailureGroups.find((group) => group.uuid === "CCF-RPS-CRD");
    expect(bank?.members?.basicEvents).toHaveLength(8);
  });
});
