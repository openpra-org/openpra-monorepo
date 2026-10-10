import type { Law } from "interfaces-mef-types/core/uncertainty";
import { lawText } from "../uncertainText";

const LOGNORMAL: Law = { family: "LOGNORMAL", mean: 2e-3, errorFactor: 5, level: 0.95 };

describe("lawText for a cut law", () => {
  it.each([
    [null, 1, "Lognormal (mean 2.00E-3, EF 5) at most 1"],
    [1e-6, null, "Lognormal (mean 2.00E-3, EF 5) at least 1.00E-6"],
    [1e-6, 1, "Lognormal (mean 2.00E-3, EF 5) cut to [1.00E-6, 1]"],
    [null, null, "Lognormal (mean 2.00E-3, EF 5)"],
  ] as const)("writes lower %s and upper %s plainly", (lower, upper, text) => {
    expect(lawText({ family: "TRUNCATED", law: LOGNORMAL, lower, upper })).toBe(text);
  });
});
