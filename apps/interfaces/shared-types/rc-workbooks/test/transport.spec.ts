import { readFileSync } from "fs";
import { resolve } from "path";
import { parseRcSource } from "../source-term-parser";
import { parseRcDecay, parseRcDeposition, parseRcDispersionReference } from "../transport-parser";
import { decayCoverage, decayParentNames, depositionFlagNotes, depositionMatchesSource, effectiveTransportSettings } from "../transport";
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

describe("Deposition flags against the removal treatments", () => {
  const data = { velocities: [0.001], groups: [{ id: 1, name: "Xe", fractions: [1], wet: false, dry: false }, { id: 2, name: "Cs", fractions: [1], wet: true, dry: true }] };
  it("follows the removal treatments and blocks only a treatment the file cannot supply", () => {
    expect(depositionFlagNotes({ wet: false, dry: true }, data)).toEqual([{ text: "The deposition file turns wet deposition on for 1 group, but the removal treatments exclude it. The calculation follows the removal treatments.", blocking: false }]);
    expect(depositionFlagNotes({ wet: true, dry: true }, { ...data, groups: [data.groups[0]] })).toEqual([
      { text: "Wet deposition is included, but the deposition file turns it off for every group.", blocking: true },
      { text: "Dry deposition is included, but the deposition file turns it off for every group.", blocking: true },
    ]);
    expect(depositionFlagNotes({ wet: true, dry: true }, data)).toEqual([]);
  });
});

describe("Standard decay library", () => {
  const library = parseRcDecay(fixture("NNDC-ENSDF-2023-04-03-standard-decay-library.txt"));
  it("keeps whole decay datasets for ground states and the lowest isomer of each parent", () => {
    expect(library).toHaveLength(86);
    const names = decayParentNames(library.map(record => record.parent));
    expect(names).toEqual(expect.arrayContaining(["H-3", "Na-22", "Na-24", "Ar-41", "Ag-110m", "Kr-85m", "Xe-135m", "Te-127m", "Te-129m", "Te-131m", "Ba-137m", "Pu-241", "Cm-244"]));
    expect(library.filter(record => record.parent.nuclide === "Ag-110").map(record => [record.parent.dataset, record.parent.ground])).toEqual([["110AG B- DECAY (249.83 D)", false], ["110AG IT DECAY (249.83 D)", false]]);
    expect(library.find(record => record.parent.nuclide === "Cs-137")?.levels.some(level => level.halfLife === "2.552 M")).toBe(true);
  });
  it("covers every radionuclide of the published source term", () => {
    const coverage = decayCoverage({ revision: 1, categories: [], decayFiles: [{ file: {} as never, parents: library.map(record => record.parent) }] }, parseRcSource(mel));
    expect(coverage.missing).toEqual([]);
    expect(coverage.found).toHaveLength(69);
  });
  it("names only the lowest isomer of a parent as metastable", () => {
    const parent = (energy: string) => ({ index: 0, nuclide: "Te-131", energy, halfLife: "1 H", ground: false, dataset: "131TE IT DECAY", daughter: "Te-131", levelCount: 0 });
    expect(decayParentNames([parent("182.258"), parent("182.265"), parent("1940.0")])).toEqual(["Te-131m", "Te-131m"]);
  });
});
