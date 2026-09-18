import { readFileSync } from "fs";
import { resolve } from "path";
import { RcSourceTermValuesSchema } from "interfaces-mef-types/zod/rc/source-term";
import { parseRcSource, decodeRcText } from "../source-term-parser";
import { withSourceTermSummary } from "../source-term-summary";

const raw = readFileSync(resolve(__dirname, "fixtures/MelMACCS-published-source-term.inp"), "utf8");
describe("Published MelMACCS source-term import", () => {
  it("reads real inventory, groups, release timing and explicitly zero heights", () => {
    const source = parseRcSource(raw);
    expect(source.inventory).toHaveLength(69);
    expect(source.groups).toHaveLength(10);
    expect(source.releases).toHaveLength(8);
    expect(source.inventory[0]).toMatchObject({ name: "Kr-85", group: 1 });
    expect(source.releases[0]).toMatchObject({ startSeconds: 1334.1, durationSeconds: 3600.4, heightMetres: 0 });
    expect(source.releases.every((r) => r.fractions.length === 10)).toBe(true);
  });
  it("preserves missing heights and derives summaries without inventing quantities", () => {
    const values = parseRcSource(raw.replace(/^RDPLHITE001.*\r?\n/m, ""));
    expect(values.releases[0].heightMetres).toBeUndefined();
    const category = withSourceTermSummary({ releaseCategory: "RC-1", releaseCharacteristics: { importantRadionuclides: ["I-131"], releaseHeight: 42 }, sourceTerm: { revision: 1, values } });
    expect(category.releaseCharacteristics.releaseHeight).toBeUndefined();
    expect(category.releaseCharacteristics.releaseHeightDescription).toContain("Missing");
    expect(category.releaseCharacteristics.importantRadionuclides).toEqual(["I-131"]);
    expect(category.releaseCharacteristics.releasePhaseTimings![0].timeUnit).toBe("s");
  });
  it("accepts scientific D notation and wrapped fraction rows", () => {
    expect(parseRcSource(raw.replace("3.6004E+03", "3.6004D+03"))).toEqual(parseRcSource(raw));
    const wrapped = raw.replace(/(RDRELFRC001\s+\S+\s+\S+)\s+/, "$1\n ");
    expect(parseRcSource(wrapped)).toEqual(parseRcSource(raw));
  });
  it("rejects binary, truncated, duplicate and inconsistent source records", () => {
    expect(() => decodeRcText(new Uint8Array([0, 255, 1]))).toThrow("readable");
    expect(() => parseRcSource("not a source" )).toThrow();
    expect(() => parseRcSource(raw + "\nRDNUMREL001 8")).toThrow("Duplicate");
    expect(() => parseRcSource(raw.replace("RDNUMREL001 8", "RDNUMREL001 7"))).toThrow("outside");
    expect(() => parseRcSource(raw.replace(/^ISOTPGRP001.*\r?\n/m, ""))).toThrow();
  });
  it("checks edited fractions across segments, finite activity and group references", () => {
    const source = parseRcSource(raw);
    source.releases[0].fractions[0] = 0.9; source.releases[1].fractions[0] = 0.9;
    expect(RcSourceTermValuesSchema.safeParse(source).success).toBe(false);
    source.releases[0].fractions[0] = 0; source.releases[1].fractions[0] = 0;
    source.inventory[0].activityBq = Number.NaN;
    expect(RcSourceTermValuesSchema.safeParse(source).success).toBe(false);
    source.inventory[0].activityBq = 1; source.inventory[0].group = 999;
    expect(RcSourceTermValuesSchema.safeParse(source).success).toBe(false);
  });
});
