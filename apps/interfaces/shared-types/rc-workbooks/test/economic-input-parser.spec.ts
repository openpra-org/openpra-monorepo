import { readFileSync } from "fs";
import { resolve } from "path";
import { parseRcSiteEconomy } from "../economic-input-parser";
import { rcEconomicCostIssues } from "../economic-costs";

const filename = "SecPop-Noah-published-site-excerpt.txt";
const original = readFileSync(resolve(__dirname, "../../../../backends/web-backend/example-documents/RC-Published-Inputs", filename), "utf8");

describe("published SecPop economic input", () => {
  it("retains only the economic rows actually published in the excerpt", () => {
    const input = parseRcSiteEconomy(original, filename);
    expect(input.original).toBe(original);
    expect(input).toMatchObject({ economicMultiplier: 1.35, expectedRegions: 83 });
    expect(input.regions).toHaveLength(2);
    expect(input.regions[0]).toMatchObject({ index: 1, name: "EXCLUSION", farmFraction: 0 });
    expect(input.regions[1]).toMatchObject({ index: 83, name: "MIX_CNTY83", farmFraction: .38, dairySalesFraction: .009,
      annualFarmSalesPerHectare: 2069.1, farmlandValuePerHectare: 9628.2, nonFarmlandValuePerPerson: 469555.6 });
    expect(input.crops).toHaveLength(7);
    expect(input.crops[0]).toMatchObject({ name: "PASTURE", growingStartDay: 90, growingEndDay: 270, farmlandFraction: .41 });
  });

  it("rejects repeated, malformed, and out-of-range regional rows", () => {
    expect(() => parseRcSiteEconomy(`${original}\n 83 MIX_CNTY83 .380 .009 2069.1 9628.2 469555.6`, filename)).toThrow(/repeated/i);
    expect(() => parseRcSiteEconomy(original.replace(".380 .009", "1.380 .009"), filename)).toThrow(/Invalid/i);
    expect(() => parseRcSiteEconomy(original.replace("  83 MIX_CNTY83", "  84 MIX_CNTY83"), filename)).toThrow(/Invalid/i);
  });
});

describe("cost parameter checks", () => {
  it("requires a source and currency year for supplied monetary values", () => {
    expect(rcEconomicCostIssues([{ parameter: "Emergency evacuation", costCode: "EVACST", value: 20, dataBasis: "GENERIC_JUSTIFIED", source: "" }])).toEqual(expect.arrayContaining([expect.stringMatching(/currency year/i), expect.stringMatching(/source/i)]));
    expect(rcEconomicCostIssues([{ parameter: "Emergency evacuation", costCode: "EVACST", value: 20, currencyYear: 2020, dataBasis: "GENERIC_JUSTIFIED", source: "Published reference" }])).toEqual([]);
  });
  it("rejects duplicate level-specific inputs and values outside documented bounds", () => {
    const row = { parameter: "Dose reduction factor", costCode: "DSRFCT" as const, level: 1, value: 200, dataBasis: "GENERIC_JUSTIFIED" as const, source: "Published reference" };
    expect(rcEconomicCostIssues([row, row])).toEqual(expect.arrayContaining([expect.stringMatching(/duplicate/i), expect.stringMatching(/value must/i)]));
  });
  it("requires increasing values across decontamination levels", () => {
    const first = { parameter: "Completion time", costCode: "TIMDEC" as const, level: 1, value: 100, dataBasis: "GENERIC_JUSTIFIED" as const, source: "Published reference" };
    expect(rcEconomicCostIssues([first, { ...first, level: 2, value: 90 }], 2)).toEqual(expect.arrayContaining([expect.stringMatching(/increase/i)]));
  });
});
