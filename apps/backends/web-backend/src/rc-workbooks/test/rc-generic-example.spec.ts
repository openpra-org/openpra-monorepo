import request from "supertest";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { RadiologicalConsequenceAnalysisSchema } from "interfaces-mef-types/zod/rc/radiological-consequence-analysis";
import { caseChecks, currentRcCase } from "interfaces-shared-types/rc-workbooks/case-records";
import { rcSourceTermFromMs } from "interfaces-shared-types/rc-workbooks/ms-source-term";
import { rcQuantificationChecks, rcScopeChecks, rcSubElementChecks, type RcStepLinks } from "interfaces-shared-types/rc-workbooks/step-checks";
import { ExampleWorkbooksService } from "../../example-workbooks/example-workbooks.service";
import { RC_ANALYSIS_HTGR } from "../../example-workbooks/seeds/rc-seed-htgr";
import { MS_ANALYSIS_HTGR } from "../../example-workbooks/seeds/ms-seed-htgr";
import { ES_ANALYSIS_HTGR } from "../../example-workbooks/seeds/es-seed-htgr";
import { createSourceTermTestApp } from "./source-term-test-app";

const esLinks = (): RcStepLinks => ({ es: { workbookId: "example-es-htgr", families: ES_ANALYSIS_HTGR.eventSequenceFamilies.map((family) => ({
  uuid: family.uuid, name: family.name, releaseCategoryIds: family.releaseCategoryIds ?? [], memberSequenceIds: family.memberSequenceIds })) } });
const clone = (): RadiologicalConsequenceAnalysis => structuredClone({ ...RC_ANALYSIS_HTGR, linkedWorkbooks: { ES: "example-es-htgr" } });

describe("Generic HTGR consequence example", () => {
  let t: Awaited<ReturnType<typeof createSourceTermTestApp>>;
  const root = "/rc-workbooks/rc-test", http = () => t.app.getHttpServer();
  beforeAll(async () => { t = await createSourceTermTestApp(); }, 60000);
  afterAll(async () => { await t.close(); });
  beforeEach(async () => {
    await t.reset();
    jest.spyOn(t.app.get(ExampleWorkbooksService), "getRcBundle").mockResolvedValue({ rc: { slug: "rc-generic-2", kind: "RC", mef: RC_ANALYSIS_HTGR, updatedAt: "2026-06-16T12:00:00Z" } } as Awaited<ReturnType<ExampleWorkbooksService["getRcBundle"]>>);
  });
  afterEach(() => { jest.restoreAllMocks(); });

  it("builds each category from the MS source term with its families, bounding member and structured inputs", () => {
    expect(RadiologicalConsequenceAnalysisSchema.safeParse(RC_ANALYSIS_HTGR).success).toBe(true);
    const categories = RC_ANALYSIS_HTGR.releaseCategoryToConsequence.releaseCategoryInputs;
    expect(categories.map((c) => [c.releaseCategory, c.sourceTerm?.msSource?.sourceTermId, c.boundingMember?.sequenceId, (c.eventSequenceFamilyReferences ?? []).map((f) => f.entityId).join(",")])).toEqual([
      ["RC-1", "ST-3", "EHP-4", "ESF-EARLY,ESF-ATWS"], ["RC-2", "ST-2", "EHP-3", "ESF-LATE"], ["RC-3", "ST-1", "EHP-P02-3", "ESF-LEAK"],
    ]);
    const definition = MS_ANALYSIS_HTGR.sourceTermDefinitions.find((entry) => entry.uuid === "ST-3")!;
    expect(categories[0].sourceTerm!.values).toEqual(rcSourceTermFromMs(definition, MS_ANALYSIS_HTGR.sourceInventories.filter((entry) => ["SRC-H1", "SRC-H2"].includes(entry.uuid))).values);
    expect(categories[0].releaseCharacteristics.radionuclideGroupFractions?.find((row) => row.group === "H-3")?.fraction).toBeCloseTo(0.15, 12);
    const geometry = RC_ANALYSIS_HTGR.protectiveActionParameters.siteAndReceptors?.geometry;
    expect(geometry?.kind === "cells" && [geometry.radiiKm, geometry.sectors]).toEqual([[0.425, 2.034344, 6, 16.51844, 80], 16]);
    const people = geometry?.kind === "cells" ? (geometry.populationByCell ?? []).reduce((sum, count) => sum + count, 0) : 0;
    expect(Math.abs(people - 100 * Math.PI * (80 ** 2 - 0.425 ** 2))).toBeLessThan(40);
    const velocities = RC_ANALYSIS_HTGR.atmosphericTransportAndDispersion.transportInputs!.categories[0].settings!.groupVelocities;
    expect(velocities.filter((group) => group.velocity === 0).map((group) => group.name)).toEqual(["Xe-133", "Kr-85", "H-3"]);
    expect(velocities.filter((group) => group.velocity !== 0).every((group) => group.velocity === 0.003 && group.basis === "analyst")).toBe(true);
    expect(RC_ANALYSIS_HTGR.dosimetry.doseInputs!.libraries.map((library) => library.kind)).toEqual(["inhalation", "cloudshine", "groundshine"]);
    expect(RC_ANALYSIS_HTGR.healthEffects.earlyHealthEffects).toHaveLength(3);
    expect(RC_ANALYSIS_HTGR.healthEffects.latentHealthEffects).toHaveLength(8);
  });

  it("records one illustrative result per category and metric and copies it to every family", () => {
    const records = RC_ANALYSIS_HTGR.consequenceQuantification.caseRecords!;
    expect(records.snapshots.map((snapshot) => [snapshot.label, snapshot.categoryId])).toEqual([["Case 01", "RC-1"], ["Case 02", "RC-2"], ["Case 03", "RC-3"]]);
    expect(records.results).toHaveLength(12);
    const dose = records.results.find((result) => result.categoryId === "RC-1" && result.metricId === "RCM-01")!;
    expect(dose.statistics).toEqual({ mean: 0.0125, percentiles: [{ percentile: 5, value: 0.003333 }, { percentile: 50, value: 0.01 }, { percentile: 95, value: 0.03 }], exceedances: [{ threshold: 0.001, probability: 0.9997 }] });
    const families = RC_ANALYSIS_HTGR.consequenceQuantification.eventSequenceConsequences;
    expect(families.map((row) => [row.eventSequenceFamily, row.releaseCategoryReference, row.origin, row.riskSignificance])).toEqual([
      ["ESF-EARLY", "RC-1", "CATEGORY_RESULT", "HIGH"], ["ESF-ATWS", "RC-1", "CATEGORY_RESULT", "HIGH"], ["ESF-LATE", "RC-2", "CATEGORY_RESULT", "MEDIUM"], ["ESF-LEAK", "RC-3", "CATEGORY_RESULT", "LOW"],
    ]);
    expect(families[1].consequenceResults).toEqual(families[0].consequenceResults);
    const checks = rcSubElementChecks(RC_ANALYSIS_HTGR);
    expect(checks.RCQ).toEqual([]);
    expect(checks.RCHE).toEqual([]);
    expect(checks.RCRE).toEqual(["Link the Event Sequence Analysis workbook that defines the release categories."]);
    expect(checks.RCAD).toEqual([]);
    expect(checks.RCDO).toEqual([]);
  });

  it("checks the family map, bounding members and RI measures against the linked workbooks", () => {
    expect(rcScopeChecks(clone(), esLinks())).toEqual([]);
    const moved = clone(), categories = moved.releaseCategoryToConsequence.releaseCategoryInputs;
    categories[1].eventSequenceFamilyReferences = [categories[0].eventSequenceFamilyReferences![1]];
    categories[0].boundingMember = { sequenceId: "EHP-3", basis: "" };
    const items = rcScopeChecks(moved, { ...esLinks(), riMeasures: ["Individual dose at boundary", "Land contamination area"] });
    expect([...items].sort()).toEqual([
      "ESF-ATWS (Unprotected (failure-to-trip) transients) is in more than one release category.",
      "ESF-LATE (Heat removal lost, delayed filtered release) releases into RC-2 in the ES workbook but is in no release category here.",
      "No metric supplies the RI measure \"Land contamination area\".",
      "RC-1: EHP-3 is not a member of the category's families.",
      "RC-1: state why EHP-3 bounds the category.",
      "RC-2: EHP-3 is not a member of the category's families.",
    ]);
  });

  it("flags stale results and hand-typed family values without a reason", () => {
    const changed = clone();
    changed.releaseCategoryToConsequence.releaseCategoryInputs[0].sourceTerm!.revision = 2;
    changed.consequenceQuantification.eventSequenceConsequences[1] = { ...changed.consequenceQuantification.eventSequenceConsequences[1], origin: "OVERRIDE", overrideReason: " " };
    const items = rcQuantificationChecks(changed);
    expect(items.filter((item) => item.includes("changed after"))).toHaveLength(4);
    expect(items).toContain("ESF-ATWS: give the reason for the hand-typed values.");
  });

  it("loads with workbook-local libraries, snapshots and readable outputs", async () => {
    const mef: RadiologicalConsequenceAnalysis = (await request(http()).post(`${root}/load-example`).send({ example: "htgr" }).expect(200)).body.mef;
    const records = mef.consequenceQuantification.caseRecords!;
    expect(records.snapshots.map((snapshot) => snapshot.label)).toEqual(["Case 01", "Case 02", "Case 03"]);
    expect(records.results).toHaveLength(12);
    expect(t.storage.size).toBe(11);
    expect(records.results.every((result) => records.snapshots.some((snapshot) => snapshot.id === result.snapshotId && snapshot.categoryId === result.categoryId))).toBe(true);
    const output = (await request(http()).get(`${root}/case-records/results/${records.results[0].id}/output`).expect(200)).body.text;
    expect(output).toContain("No consequence code produced them.");
    const source = mef.releaseCategoryToConsequence.releaseCategoryInputs[0].sourceTerm!.revision;
    expect(mef.atmosphericTransportAndDispersion.transportInputs!.categories.every((category) => category.savedForSourceRevision === source)).toBe(true);
    expect(caseChecks(currentRcCase(mef, "RC-1")).find((check) => check.key === "transport")!.items.join(" ")).not.toContain("current source");
    expect(mef.consequenceQuantification.eventSequenceConsequences).toHaveLength(4);
    expect(rcQuantificationChecks(mef)).toEqual([]);
  });
  it("accepts edits after loading and moves a family's copied result with it", async () => {
    const mef: RadiologicalConsequenceAnalysis = (await request(http()).post(`${root}/load-example`).send({ example: "htgr" }).expect(200)).body.mef;
    const categories = mef.releaseCategoryToConsequence.releaseCategoryInputs;
    const [early, atws] = categories[0].eventSequenceFamilyReferences!;
    const next: RadiologicalConsequenceAnalysis = (await request(http()).patch(root).send({ operations: [
      { op: "replace", path: ["releaseCategoryToConsequence", "releaseCategoryInputs", 0, "eventSequenceFamilyReferences"], value: [early] },
      { op: "replace", path: ["releaseCategoryToConsequence", "releaseCategoryInputs", 1, "eventSequenceFamilyReferences"], value: [...categories[1].eventSequenceFamilyReferences!, atws] },
    ] }).expect(200)).body.mef;
    const rows = next.consequenceQuantification.eventSequenceConsequences;
    const moved = rows.find((row) => row.eventSequenceFamily === "ESF-ATWS")!;
    expect(moved).toMatchObject({ uuid: "RCQ-ESF-ATWS", releaseCategoryReference: "RC-2", origin: "CATEGORY_RESULT", riskSignificance: "HIGH" });
    expect(moved.consequenceResults).toEqual(rows.find((row) => row.eventSequenceFamily === "ESF-LATE")!.consequenceResults);
  });
});
