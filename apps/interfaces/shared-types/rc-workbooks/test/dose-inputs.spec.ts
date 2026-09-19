import { readFileSync } from "fs";
import { resolve } from "path";
import { decodeRcDoseText, parseRcDoseCoefficients, parseRcExposure } from "../dose-input-parser";
import { doseCoverage, inhalationRecordLabel } from "../dose-inputs";
import { parseRcSource } from "../source-term-parser";
const bytes = (name: string) => readFileSync(resolve(__dirname, "fixtures", name));
const raw = (name: string) => decodeRcDoseText(bytes(name));
const exposure = raw("MACCS-Noah-dose-settings-excerpt.inp"), inh = raw("FGR13INH.HDB"), cloud = raw("F12TIII1.EXT"), ground = raw("F12TIII3.EXT");
describe("Published dose input files", () => {
  it("reads the published duration and preserves separate exposure blocks", () => {
    const data = parseRcExposure(exposure + "\n.\nSEBRRATE002 3.0D-4\nSECSFACT002 0.9");
    expect(data.integrationSeconds).toBe(2592000); expect(data.blocks).toHaveLength(2);
    expect(data.blocks[0].records).toMatchObject({ SEBRRATE002: .000266, SECSFACT002: .75, SEGSHFAC002: .34, SEPROTIN002: .46 });
    expect(data.blocks[1].records.SECSFACT002).toBe(.9);
    expect(() => parseRcExposure(exposure + "\nSECSFACT002 0.4")).toThrow("Duplicate");
    expect(() => parseRcExposure(exposure + "\nSRENDEMP001 1")).toThrow("one emergency");
    expect(() => parseRcExposure(exposure.replace("SECSFACT002 0.75", "SECSFACT002 1.1"))).toThrow("multipliers");
    expect(() => parseRcExposure("SRENDEMP001 0")).toThrow();
  });
  it("reads all original EPA inhalation profiles, including high-LET companion records", () => {
    const records = parseRcDoseCoefficients(inh, "inhalation");
    expect(records).toHaveLength(13818);
    const cs = records.find(r => r.name === "Cs-137" && r.inhalation?.ageDays === 7300 && r.inhalation.absorption === "F")!;
    expect(cs.value).toBe("4.673E-09"); expect(cs.inhalation).toMatchObject({ amadMicrometres: 1, let: "L", components: 1, f1: "1.0E+00" });
    expect(records.filter(r => r.inhalation?.highLet)).toHaveLength(2484);
    expect(records.find(r => r.name === "Pr-147")!.inhalation!.highLet!.values).toHaveLength(31);
    expect(records.some(r => r.inhalation?.let === "H" && r.inhalation.components === 1)).toBe(true);
    expect(inhalationRecordLabel(records.find(r => r.inhalation?.ageDays === 9125)!)).toContain("25 years");
  });
  it("preserves the native external quantities and distinguishes air from ground files", () => {
    const a = parseRcDoseCoefficients(cloud, "cloudshine"), b = parseRcDoseCoefficients(ground, "groundshine");
    expect(a).toHaveLength(825); expect(b).toHaveLength(825);
    expect(a.find(r => r.name === "Cs-137")!.value).toBe("9.28E-17"); expect(b.find(r => r.name === "Cs-137")!.value).toBe("2.99E-18");
    expect(() => parseRcDoseCoefficients(ground, "cloudshine")).toThrow("F12TIII1");
    expect(() => parseRcDoseCoefficients(cloud, "inhalation")).toThrow("FGR13INH");
  });
  it("rejects malformed records, invalid metadata, duplicates and binary inputs", () => {
    const lines = inh.split(/\r?\n/), single = lines.slice(0, 3).join("\n");
    expect(() => parseRcDoseCoefficients(single.slice(0, -10), "inhalation")).toThrow("Incomplete");
    expect(() => parseRcDoseCoefficients(single + "\n" + lines[2], "inhalation")).toThrow("Duplicate");
    const badAmad = lines[2].slice(0, 12) + "-1.00" + lines[2].slice(17);
    expect(() => parseRcDoseCoefficients(lines.slice(0, 2).join("\n") + "\n" + badAmad, "inhalation")).toThrow();
    const h = lines.find(l => !l.slice(0, 32).trim() && l[32] === "H")!;
    expect(() => parseRcDoseCoefficients(lines.slice(0, 2).join("\n") + "\n" + h, "inhalation")).toThrow("Unmatched");
    expect(() => decodeRcDoseText(new Uint8Array([0, 1, 255]))).toThrow("readable");
  });
  it("checks actual source names without filling missing coefficients", () => {
    const source = parseRcSource(raw("MelMACCS-published-source-term.inp"));
    const c = doseCoverage({ revision: 1, categories: [], libraries: [{ kind: "inhalation", file: {} as never, nuclides: ["Cs-137"], recordCount: 1 }] }, source, "inhalation");
    expect(c.found).toEqual(["Cs-137"]); expect(c.total).toBe(69); expect(c.missing).toHaveLength(68);
    expect(doseCoverage(undefined, undefined, "cloudshine").total).toBe(0);
  });
});
