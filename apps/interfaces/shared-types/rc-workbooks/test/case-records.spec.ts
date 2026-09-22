import type { RcCaseData } from "interfaces-mef-types/rc/case-records";
import { caseChecks, caseReceptorIds, caseTable, caseTrialId, caseVersions } from "../case-records";
const base = (): RcCaseData => ({ schemaVersion: 1, categoryId: "RC-1", source: { revision: 1, values: { groups: [{ id: 1, name: "Cesium" }], inventory: [{ name: "Cs-137", activityBq: 1e9, group: 1 }], releases: [{ id: 1, startSeconds: 0, durationSeconds: 60, fractions: [.5] }] } } });
describe("Step 08 prepared case review", () => {
  it("distinguishes absent heights from explicit zero heights", () => {
    const c = base(); expect(caseTable(c, "releases", 0).rows[0]).toEqual([1, 0, 60, null]);
    expect(caseChecks(c)[0].items.join(" ")).toContain("release height");
    c.source!.values.releases[0].heightMetres = 0;
    expect(caseTable(c, "releases", 0).rows[0][3]).toBe(0); expect(caseChecks(c)[0].items).toEqual([]);
  });
  it("does not insert default deposition values before Step 04 is saved", () => {
    expect(caseTable(base(), "deposition", 0).rows[0][1]).toBeNull();
    expect(caseChecks(base()).find(c => c.key === "transport")!.items.join(" ")).toContain("Save the group deposition");
  });
  it("detects source revisions newer than saved transport and dose settings", () => {
    const c = base(); c.source!.revision = 2;
    c.transport = { revision: 1, categories: [{ categoryId: "RC-1", savedForSourceRevision: 1, settings: { decayMode: "parent", groupVelocities: [{ groupId: 1, name: "Cesium", velocity: .003, basis: "openrc_default" }] } }], decayFiles: [] };
    c.dose = { revision: 1, categories: [{ categoryId: "RC-1", savedForSourceRevision: 1, settings: { integrationSeconds: 86400, basis: "analyst" } }], libraries: [] };
    expect(caseChecks(c).find(v => v.key === "transport")!.items.join(" ")).toContain("current source");
    expect(caseChecks(c).find(v => v.key === "dose")!.items.join(" ")).toContain("current source");
  });
  it("keeps all cell IDs addressable while paging evaluation points", () => {
    const c = base(); c.site = { revision: 1, settings: { latitude: 0, longitude: 0, receptorHeightMetres: 1.5, cellPoint: "mid" }, geometry: { kind: "cells", sectors: 64, radiiKm: Array.from({ length: 14 }, (_, i) => i + 1), abridged: false } };
    expect(caseReceptorIds(c)).toHaveLength(896); expect(caseReceptorIds(c).at(-1)).toBe("S64R14");
    const page = caseTable(c, "receptors", 895); expect(page.rows).toEqual([["S64R14", 13500, 354.375, 1.5, null]]);
    c.site.settings.cellPoint = undefined; expect(caseTable(c, "receptors", 0).total).toBe(0);
  });
  it("carries population and response timing into the prepared case", () => {
    const c = base();
    c.site = { revision: 1, settings: { latitude: 0, longitude: 0, receptorHeightMetres: 1.5, cellPoint: "mid" },
      geometry: { kind: "cells", sectors: 2, radiiKm: [1], abridged: false, populationByCell: [300, 700] } };
    c.response = { protectiveActionsIncluded: [{ action: "SHELTERING", included: true, applicabilityJustification: "Study" }],
      cohortModeling: { approach: "SINGLE_COHORT", cohorts: [{ name: "Residents", description: "", populationPercent: 100, compliancePercent: 80 }] },
      responseTiming: { declarationAfterAccidentMinutes: 5, shelterStartMinutes: 10 } };
    expect(caseChecks(c).find(check => check.key === "site")!.items).toEqual([]);
    expect(caseTable(c, "receptors", 0).rows.map(row => row[4])).toEqual([300, 700]);
    expect(caseTable(c, "response", 0).rows[0]).toEqual(["Residents", 100, 1000, 80, 800, 15, null, null]);
    const version = caseVersions(c);
    c.response.responseTiming!.shelterStartMinutes = 20;
    expect(caseVersions(c)).not.toBe(version);
    c.response.cohortModeling.cohorts![0].populationPercent = 90;
    expect(caseChecks(c).find(check => check.key === "site")!.items.join(" ")).toContain("100%");
  });
  it("carries generated weather trials and their probabilities into the prepared case", () => {
    const c = base(), r = { day: 365, period: 24, windSector: 2, windSpeedMetresPerSecond: 5, stabilityClass: "D" as const, rainCode: 0, rainMillimetresPerHour: 0, original: "test" };
    expect(caseTrialId(r)).toBe("D365P24");
    const trial = { id: "D365P24", source: "file" as const, startRecordIndex: 8759, day: 365, period: 24, selectionGroup: "Fixed start", probability: 1,
      windSpeedMetresPerSecond: 5, windTowardDegrees: 22.5, stabilityClass: "D" as const, rainMillimetresPerHour: 0, mixingHeightMetres: 500 };
    expect(caseTable(c, "weather", 0, [trial]).rows[0]).toEqual(["D365P24", "Day 365, period 24", "Fixed start", 1, 5, 22.5, "D", 0, 500]);
  });
  it("treats a weather collection request as a request rather than available records", () => {
    const c = base(); c.weather = { revision: 1, settings: {}, collectionRequest: { status: "prepared", latitude: 0, longitude: 0, start: "2020-01-01", end: "2020-01-02", preparedAt: "2020-01-01T00:00:00Z" } };
    expect(caseTable(c, "weather", 0).total).toBe(0);
    expect(caseChecks(c).find(v => v.key === "links")!.items.join(" ")).toContain("No generated weather trials");
  });
  it("tracks health and economic edits in the case version and respects excluded aspects", () => {
    const c = base(); c.schemaVersion = 2;
    c.health = { healthInput: { filename: "health.inp", original: "EFATAGRP001", records: [{ cardId: "EFATAGRP001", kind: "early_fatality", effect: "Lung", organ: "Lung", values: [1, 2, 3], original: "EFATAGRP001" }] },
      earlyHealthEffects: ["Lung fatality"], latentHealthEffects: ["Cancer"], riskFactorSources: [{ source: "Body report", recognizedBody: "Body", version: "1" }],
      earlyEffectParameters: { approach: "ORGAN_SPECIFIC_DOSE_RESPONSE", description: "" }, latentEffectParameters: { approach: "ORGAN_SPECIFIC_FACTORS", description: "" }, ageGenderHomogeneous: true } as NonNullable<RcCaseData["health"]>;
    c.economy = { siteEconomyInput: { filename: "site.txt", original: "site", economicMultiplier: 1, expectedRegions: 1, regions: [], crops: [] },
      decontaminationLevels: 1, costCategories: [], costParameterEstimates: [], parameterConsistencyConfirmed: false } as NonNullable<RcCaseData["economy"]>;
    const initial = caseVersions(c);
    expect(caseTable(c, "health", 0).rows[0][1]).toBe("Lung fatality");
    expect(caseChecks(c).find(check => check.key === "economy")!.items.join(" ")).toContain("0 of 1");
    c.health.riskFactorSources[0].version = "2";
    expect(caseVersions(c)).not.toBe(initial);
    const healthVersion = caseVersions(c);
    c.economy.siteEconomyInput!.expectedRegions = 2;
    expect(caseVersions(c)).not.toBe(healthVersion);
    c.excludedSteps = ["health"];
    expect(caseChecks(c).some(check => check.key === "health")).toBe(false);
  });
});
