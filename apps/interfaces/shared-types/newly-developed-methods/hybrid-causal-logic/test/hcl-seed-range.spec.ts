import { HclUncertaintySeedSchema, HclUncertaintySettingsSchema } from "interfaces-mef-types/zod/modeling";
import { HclUncertaintySummarySchema } from "../hcl-results";

const settings = { sampleCount: 31, sampler: "MC", basicEventDistributions: [], cptRowDistributions: [] };
const summary = { sampleCount: 31, mean: .2, standardDeviation: .1, minimum: 0, percentile05: .05, median: .2, percentile95: .4, maximum: .5 };

it.each([0, 1, 42, 2 ** 32 - 1, 2 ** 32, 2 ** 32 + 1, 2 ** 48 + 123, Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER])(
  "retains exact seed %s across settings, JSON and result contracts", (seed) => {
    expect(HclUncertaintySeedSchema.parse(seed)).toBe(seed);
    const input = HclUncertaintySettingsSchema.parse(JSON.parse(JSON.stringify({ ...settings, seed })));
    expect(input.seed).toBe(seed);
    expect(HclUncertaintySummarySchema.parse({ ...summary, seed }).seed).toBe(seed);
  },
);

it.each([-1, .5, Number.MAX_SAFE_INTEGER + 1, Number.MAX_SAFE_INTEGER + 2, Infinity, NaN, "4294967296", null])(
  "rejects invalid or inexact numeric seed %s", (seed) => {
    expect(HclUncertaintySeedSchema.safeParse(seed).success).toBe(false);
    expect(HclUncertaintySettingsSchema.safeParse({ ...settings, seed }).success).toBe(false);
    expect(HclUncertaintySummarySchema.safeParse({ ...summary, seed }).success).toBe(false);
  },
);
