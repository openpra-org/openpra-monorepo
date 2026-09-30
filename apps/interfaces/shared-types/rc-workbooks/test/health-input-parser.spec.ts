import { readFileSync } from "fs";
import { resolve } from "path";
import { parseRcHealthInput, rcHealthEffectLabel } from "../health-input-parser";

const filename = "MACCS-Noah-health-settings-excerpt.inp";
const original = readFileSync(resolve(__dirname, "../../../../backends/web-backend/example-documents/RC-Published-Inputs", filename), "utf8");

describe("published health-parameter input", () => {
  it("preserves all published fatality, injury and latent cancer records", () => {
    const input = parseRcHealthInput(original, filename);
    expect(input.original).toBe(original);
    expect(input.records.filter(record => record.kind === "early_fatality")).toHaveLength(3);
    expect(input.records.filter(record => record.kind === "early_injury")).toHaveLength(7);
    expect(input.records.filter(record => record.kind === "latent_cancer")).toHaveLength(8);
    expect(input.records[0]).toMatchObject({ cardId: "EFATAGRP001", organ: "A-RED MARR", values: [5.6, 6.1, 2.3] });
    expect(rcHealthEffectLabel(input.records[0])).toBe("A-RED MARR fatality");
    expect(input.records.find(record => record.cardId === "LCANCERS001")?.values.slice(3, 5)).toEqual([0.0111, 0.0113]);
  });

  it("rejects incomplete and repeated cards", () => {
    expect(() => parseRcHealthInput("EFATAGRP001 A-LUNGS 24. 9.6", filename)).toThrow(/Incomplete/);
    expect(() => parseRcHealthInput(`${original}\nEFATAGRP001 A-LUNGS 24. 9.6 14.`, filename)).toThrow(/Duplicate/);
    expect(() => parseRcHealthInput("* No parameter cards", filename)).toThrow(/No EFATAGRP/);
  });
});
