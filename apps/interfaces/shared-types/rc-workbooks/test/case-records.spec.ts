import type { RcCaseData } from "interfaces-mef-types/rc/case-records";
import { caseChecks, caseReceptorIds, caseTable, caseTrialId } from "../case-records";
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
    const page = caseTable(c, "receptors", 895); expect(page.rows).toEqual([["S64R14", 13500, 354.375, 1.5]]);
    c.site.settings.cellPoint = undefined; expect(caseTable(c, "receptors", 0).total).toBe(0);
  });
  it("labels weather IDs and preserves unknown directions without inventing wind sectors", () => {
    const c = base(), r = { day: 365, period: 24, windSector: 2, windSpeedMetresPerSecond: 5, stabilityClass: "D" as const, rainCode: 0, rainMillimetresPerHour: 0, original: "test" };
    expect(caseTrialId(r)).toBe("D365P24");
    expect(caseTable(c, "weather", 0, [r]).rows[0]).toEqual(["D365P24", 5, null, "D"]);
    c.weather = { revision: 1, settings: { windSectors: 16 } };
    expect(caseTable(c, "weather", 0, [r]).rows[0][2]).toBe(22.5);
  });
  it("treats a weather collection request as a request rather than available records", () => {
    const c = base(); c.weather = { revision: 1, settings: {}, collectionRequest: { status: "prepared", latitude: 0, longitude: 0, start: "2020-01-01", end: "2020-01-02", preparedAt: "2020-01-01T00:00:00Z" } };
    expect(caseTable(c, "weather", 0).total).toBe(0);
    expect(caseChecks(c).find(v => v.key === "links")!.items.join(" ")).toContain("No weather records");
  });
});
