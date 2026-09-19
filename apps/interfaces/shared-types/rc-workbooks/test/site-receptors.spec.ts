import { readFileSync } from "fs";
import { resolve } from "path";
import { parseRcReceptorGeometry, parseRcSiteCoordinates } from "../site-receptor-parser";
import { evaluatedReceptor, receptorCount, siteReceptorIssues } from "../site-receptors";

const fixture = (name: string) => readFileSync(resolve(__dirname, "fixtures", name), "utf8");
const secpop = fixture("SecPop-Noah-published-site-excerpt.txt");
const points = fixture("ANCH_MIXED_CrossZone.ROU");
const grid = fixture("AERMAP_NAD27_DEM.REC");
describe("Real site/receptor file contracts", () => {
  it("imports 14 bands and 64 sectors without treating partial population records as complete data", () => {
    const g = parseRcReceptorGeometry(secpop);
    expect(g.kind).toBe("cells"); expect(receptorCount(g)).toBe(896);
    if (g.kind !== "cells") throw new Error("Expected cells");
    expect(g.abridged).toBe(true); expect(g.radiiKm[0]).toBe(0.746);
    expect(g.center).toMatchObject({ latitude: 35.310276, longitude: -93.23194 });
    const settings = { latitude: 35.31028, longitude: -93.23194, cellPoint: "mid" as const, receptorHeightMetres: 1.5 };
    expect(siteReceptorIssues(settings, g)).toEqual([]);
    expect(evaluatedReceptor(g, settings, 0)).toMatchObject({ id: "S01R01", distanceMetres: 373, bearingDegrees: 0, heightMetres: 1.5 });
    expect(evaluatedReceptor(g, settings, 32 * 14 + 9)).toMatchObject({ id: "S33R10", distanceMetres: 36210.25, bearingDegrees: 180 });
    expect(evaluatedReceptor(g, { ...settings, cellPoint: "outer" }, 0).distanceMetres).toBe(746);
    expect(siteReceptorIssues({ ...settings, longitude: -94 }, g).join()).toContain("grid center");
  });
  it("keeps AERMAP ground/hill elevations separate from an absent receptor height", () => {
    const g = parseRcReceptorGeometry(points);
    expect(g.kind).toBe("points"); expect(receptorCount(g)).toBe(13);
    if (g.kind === "cells") throw new Error("Expected points");
    expect(g.points[0]).toMatchObject({ x: 341140, y: 6785439, elevationMetres: 22.95, hillHeightMetres: 25 });
    expect(g.points[0].heightMetres).toBeUndefined(); expect(g.anchor).toMatchObject({ zone: 6, datum: 4 });
    expect(siteReceptorIssues({ latitude: 61, longitude: -150, releaseX: 341140, releaseY: 6785339 }, g).join()).toContain("receptor height");
    expect(evaluatedReceptor(g, { latitude: 61, longitude: -150, releaseX: 341140, releaseY: 6785339, receptorHeightMetres: 1.5 }, 0))
      .toMatchObject({ distanceMetres: 100, bearingDegrees: 0, bearingReference: "grid_north", heightMetres: 1.5, elevationMetres: 22.95 });
  });
  it("expands the real 5-radius, 36-direction polar grid and preserves its terrain arrays", () => {
    const g = parseRcReceptorGeometry(grid);
    expect(g.kind).toBe("grid"); expect(receptorCount(g)).toBe(180);
    if (g.kind !== "grid") throw new Error("Expected grid");
    expect(g.points[0]).toMatchObject({ id: "D1R1", radiusMetres: 100, bearingDegrees: 10, elevationMetres: 120.3, hillHeightMetres: 141 });
    expect(g.points[0].x).toBeCloseTo(17.3648178); expect(g.points[0].y).toBeCloseTo(98.4807753);
    expect(g.points[179]).toMatchObject({ id: "D36R5", bearingDegrees: 0, elevationMetres: 126.3 });
    expect(g.points[179].heightMetres).toBeUndefined();
    const flagged = parseRcReceptorGeometry(points.replace("22.95      25.00", "22.95      25.00 2.0"));
    if (flagged.kind === "cells") throw new Error("Expected points");
    expect(flagged.points[0].heightMetres).toBe(2);
  });
  it("parses signed MACCS coordinates, including explicit zero; translates SecPop west-positive east longitudes", () => {
    expect(parseRcSiteCoordinates(fixture("MACCS-Noah-site-coordinates-excerpt.txt"))).toMatchObject({ latitude: 35.31028, longitude: -93.23194 });
    expect(parseRcSiteCoordinates("M1LATITUD01 0\nM1LONGITU01 0")).toMatchObject({ latitude: 0, longitude: 0 });
    expect(parseRcSiteCoordinates(secpop.replace("Longitude: 93.23194", "Longitude: -20"))).toMatchObject({ longitude: 20 });
    expect(() => parseRcSiteCoordinates("M1LATITUD01 95\nM1LONGITU01 -90")).toThrow();
    expect(() => parseRcSiteCoordinates("M1LATITUD01 35\nM1LATITUD01 36\nM1LONGITU01 -90")).toThrow(/Duplicate/);
  });
  it("rejects malformed geometry rather than importing a partial set", () => {
    expect(() => parseRcReceptorGeometry(secpop.replace("14 SPATIAL", "15 SPATIAL"))).toThrow();
    expect(() => parseRcReceptorGeometry(secpop.replace("64 WIND", "999 WIND"))).toThrow();
    expect(() => parseRcReceptorGeometry(grid.replace("36     10.    10.", "36     10.    360."))).toThrow();
    expect(() => parseRcReceptorGeometry(grid.replace(/.*POL1\s+HILL\s+36[^\r\n]+/, ""))).toThrow(/HILL/);
    expect(() => parseRcReceptorGeometry(points.replace("ELEVUNIT METERS", "ELEVUNIT FEET"))).toThrow(/metres/);
    expect(() => parseRcReceptorGeometry(points + "\nDISCPOLR SOURCE 100 20")).toThrow();
  });
});
