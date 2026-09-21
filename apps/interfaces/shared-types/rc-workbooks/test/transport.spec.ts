import { readFileSync } from "fs";
import { resolve } from "path";
import { parseRcSource } from "../source-term-parser";
import { parseRcDecay, parseRcDeposition, parseRcDispersionReference } from "../transport-parser";
import { decayCoverage, depositionMatchesSource, effectiveTransportSettings } from "../transport";
const fixture = (name: string) => readFileSync(resolve(__dirname, "fixtures", name), "utf8");
const mel = fixture("MelMACCS-published-source-term.inp"), doe = fixture("MACCS2-DOE-published-dispersion.inp"), cs = fixture("NNDC-ENSDF-Cs137-decay.txt");
describe("Published transport input files", () => {
  it("preserves MelMACCS bin velocities, fractions and flags separately from OpenRC settings", () => {
    const data = parseRcDeposition(mel), source = parseRcSource(mel), settings = effectiveTransportSettings(source, undefined, data);
    expect(data.velocities).toHaveLength(10); expect(data.groups).toHaveLength(10);
    expect(data.velocities[0]).toBe(0.00078771);
    expect(data.groups[0]).toMatchObject({ name: "Xe", wet: false, dry: false });
    expect(data.groups[1].fractions.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 2);
    expect(settings.groupVelocities[0]).toMatchObject({ velocity: 0, basis: "noble_gas" });
    expect(settings.groupVelocities[1]).toMatchObject({ name: "Cs", basis: "source_file" });
    expect(settings.groupVelocities[1].velocity).toBeCloseTo(data.groups[1].fractions.reduce((sum, fraction, index) => sum + fraction * data.velocities[index], 0));
    expect(depositionMatchesSource(data, source)).toBe(true);
    source.groups[1].name = "Changed";
    expect(depositionMatchesSource(data, source)).toBe(false);
  });
  it("rejects inconsistent bin counts, missing fractions, duplicates and unknown groups", () => {
    expect(() => parseRcDeposition(mel.replace(/DDNPSGRP001\s+10/, "DDNPSGRP001 9"))).toThrow();
    expect(() => parseRcDeposition(mel.replace(/^RDPSDIST002.*\r?\n/m, ""))).toThrow();
    expect(() => parseRcDeposition(mel + "\nDDVDEPOS001 1")).toThrow("Duplicate");
    expect(() => parseRcDeposition(mel + "\nRDPSDIST099 1")).toThrow("unknown");
  });
  it("reads the six published power-law rows without applying them to OpenRC", () => {
    const data = parseRcDispersionReference(doe);
    expect(data.sigmaYA).toHaveLength(6); expect(data.sidewaysScale).toBe(1); expect(data.verticalScale).toBe(1.27);
    expect(() => parseRcDispersionReference(doe.replace(/NUM_DIST001\s+0/, "NUM_DIST001 1"))).toThrow("power-law");
    expect(() => parseRcDispersionReference(doe.replace(/^DPCZSIGA001.*\r?\n/m, ""))).toThrow();
  });
  it("reads Cs-137 parent, daughter levels and raw normalization without counting Ba-137m as a ground parent", () => {
    const records = parseRcDecay(cs);
    expect(records).toHaveLength(1);
    expect(records[0].parent).toMatchObject({ nuclide: "Cs-137", halfLife: "30.08 Y", ground: true, daughter: "Ba-137", levelCount: 3 });
    expect(records[0].normalization).toHaveLength(2);
    expect(records[0].levels.some(l => l.halfLife === "2.552 M" && l.betaFeeding === "94.7")).toBe(true);
    const coverage = decayCoverage({ revision: 1, categories: [], decayFiles: [{ file: {} as never, parents: records.map(r => r.parent) }] }, parseRcSource(mel));
    expect(coverage.found).toEqual(["Cs-137"]); expect(coverage.total).toBe(69);
    expect(coverage.missing).toContain("Ba-137m");
    expect(() => parseRcDecay("not ENSDF")).toThrow();
  });
  it("reads full mass-chain files and preserves multiple P records within one dataset", () => {
    const records = parseRcDecay(fixture("NNDC-ENSDF-2023-04-03-mass-137.txt"));
    expect(records.length).toBeGreaterThan(10);
    expect(records.some(d => !d.parent.ground)).toBe(true);
    expect(records.every((d, i) => d.parent.index === i && d.parent.levelCount === d.levels.length)).toBe(true);
    const parent = cs.split(/\r?\n/).find(l => l.slice(5, 8) === "  P")!;
    // A synthetic second parent exercises the ENSDF multi-parent record format.
    const second = parent.slice(0, 8) + "2" + "100.0     " + parent.slice(19);
    const multi = parseRcDecay(cs.replace(parent, parent + "\n" + second));
    expect(multi).toHaveLength(2); expect(multi[1].parent.ground).toBe(false);
    expect(multi[0].levels).toEqual(multi[1].levels);
  });
  it("retains analyst values only for matching groups and enforces zero for actual noble gases", () => {
    const source = parseRcSource(mel), deposition = parseRcDeposition(mel), saved = effectiveTransportSettings(source, undefined, deposition);
    saved.groupVelocities[0].velocity = 9; saved.groupVelocities[1] = { ...saved.groupVelocities[1], velocity: .006, basis: "analyst" }; saved.decayMode = "ingrowth";
    const next = effectiveTransportSettings(source, saved);
    expect(next.groupVelocities[0].velocity).toBe(0); expect(next.groupVelocities[1].velocity).toBe(.006); expect(next.decayMode).toBe("ingrowth");
    source.groups[1].name = "New";
    expect(effectiveTransportSettings(source, saved, deposition).groupVelocities[1].velocity).toBeNaN();
    expect(effectiveTransportSettings(undefined).groupVelocities).toEqual([]);
  });
});
