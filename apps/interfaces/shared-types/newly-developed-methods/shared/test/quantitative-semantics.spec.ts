import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEFAULT_ANNUALIZATION_CONVENTION,
  annualizeFrequency,
  failureRateToProbability,
  requiresFailureRateConversionReview,
} from "interfaces-mef-types/modeling";
import {
  BasicEventQuantificationTraceSchema,
  EventTreeFrequencySemanticsSchema,
} from "../quantitative-semantics";

describe("quantitative semantics", () => {
  it("keeps old inputs readable but refuses to calculate them", () => {
    const basis = {
      kind: "FAILURE_RATE" as const, conversion: "LINEAR" as const,
      failureRate: { value: .001, unit: "HOUR" as const },
      missionTime: { value: 100, unit: "HOUR" as const },
    };
    const original = structuredClone(basis);
    expect(requiresFailureRateConversionReview(basis)).toBe(true);
    expect(() => failureRateToProbability(basis)).toThrow("Review the rate and mission time");
    expect(basis).toEqual(original);
    expect(requiresFailureRateConversionReview({ ...basis, conversion: "EXPONENTIAL" })).toBe(false);
  });

  it("matches HCL_MH failure-rate source outputs, including tiny exposures", () => {
    const reference = JSON.parse(readFileSync(resolve(__dirname,
      "../../../../../solvers/praxis/tests/fixtures/hcl_mh_failure_rate/reference.json",
    ), "utf8")) as { cases: Array<{ rate: number; time: number; probability: string }> };
    for (const c of reference.cases) {
      expect(failureRateToProbability({
        kind: "FAILURE_RATE",
        failureRate: { value: c.rate, unit: "HOUR" },
        missionTime: { value: c.time, unit: "HOUR" },
        conversion: "EXPONENTIAL",
      })).toBe(Number(c.probability));
    }
  });

  it("annualizes a rate using the declared exposure", () => {
    expect(annualizeFrequency(2e-5, "PER_HOUR", {
      basis: "CRITICAL_YEAR",
      hoursPerYear: 7_000,
    })).toBeCloseTo(0.14, 15);
    expect(annualizeFrequency(0.1, "PER_YEAR", DEFAULT_ANNUALIZATION_CONVENTION)).toBe(0.1);
  });

  it("uses a 365-day default year while preserving explicit annual exposures", () => {
    expect(annualizeFrequency(1, "PER_HOUR")).toBe(8_760);
    expect(annualizeFrequency(1, "PER_DAY")).toBe(365);
    for (const basis of ["CALENDAR_YEAR", "PLANT_YEAR", "REACTOR_YEAR", "CRITICAL_YEAR"] as const) {
      expect(annualizeFrequency(0.001, "PER_HOUR", { basis, hoursPerYear: 8_000 })).toBe(8);
    }
    expect(failureRateToProbability({
      kind: "FAILURE_RATE", conversion: "EXPONENTIAL",
      failureRate: { value: 0.2, unit: "YEAR" },
      missionTime: { value: 365, unit: "DAY" },
    })).toBe(1 - Math.exp(-0.2));
    expect(failureRateToProbability({
      kind: "FAILURE_RATE", conversion: "EXPONENTIAL",
      failureRate: { value: 0.001, unit: "HOUR" },
      missionTime: { value: 1, unit: "YEAR" },
    })).toBe(1 - Math.exp(-8.76));
  });

  it("validates auditable basic-event and event-tree result semantics", () => {
    expect(BasicEventQuantificationTraceSchema.safeParse({
      basicEventId: "123e4567-e89b-42d3-a456-426614174000",
      input: {
        value: 4.798848184297884e-4,
        quantificationBasis: {
          kind: "FAILURE_RATE",
          failureRate: { value: 2e-5, unit: "HOUR" },
          missionTime: { value: 24, unit: "HOUR" },
          conversion: "EXPONENTIAL",
        },
      },
      resolvedProbability: 4.798848184297884e-4,
    }).success).toBe(true);
    expect(EventTreeFrequencySemanticsSchema.safeParse({
      initiatingEventFrequency: { value: 2e-5, unit: "PER_HOUR" },
      annualization: { basis: "CRITICAL_YEAR", hoursPerYear: 7_000 },
      annualizedInitiatingEventFrequency: { value: 0.14, unit: "PER_YEAR" },
    }).success).toBe(true);
  });
});
