import {
  DEFAULT_ANNUALIZATION_CONVENTION,
  annualizeFrequency,
  failureRateToProbability,
} from "interfaces-mef-types/modeling";
import {
  BasicEventQuantificationTraceSchema,
  EventTreeFrequencySemanticsSchema,
} from "../quantitative-semantics";

describe("quantitative semantics", () => {
  it("converts a failure rate over mission time with the exponential model", () => {
    expect(failureRateToProbability({
      kind: "FAILURE_RATE",
      failureRate: { value: 2e-5, unit: "HOUR" },
      missionTime: { value: 24, unit: "HOUR" },
      conversion: "EXPONENTIAL",
    })).toBeCloseTo(4.798848184297884e-4, 15);
  });

  it("annualizes a rate using the declared exposure", () => {
    expect(annualizeFrequency(2e-5, "PER_HOUR", {
      basis: "CRITICAL_YEAR",
      hoursPerYear: 7_000,
    })).toBeCloseTo(0.14, 15);
    expect(annualizeFrequency(0.1, "PER_YEAR", DEFAULT_ANNUALIZATION_CONVENTION)).toBe(0.1);
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
