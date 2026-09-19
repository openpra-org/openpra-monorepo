type QuantificationTimeUnit = "SECOND" | "MINUTE" | "HOUR" | "DAY" | "YEAR";

interface QuantificationDuration {
  value: number;
  unit: QuantificationTimeUnit;
}

interface QuantificationRate {
  value: number;
  unit: QuantificationTimeUnit;
}

// LINEAR is retained only to read saved workbooks/results that require review.
// It must never be evaluated or selected for a new failure-rate input.
type FailureRateConversionModel = "EXPONENTIAL" | "LINEAR";

type FaultTreeBasicEventQuantificationBasis =
  | { kind: "PROBABILITY" }
  | {
      kind: "FAILURE_RATE";
      failureRate: QuantificationRate;
      missionTime: QuantificationDuration;
      conversion: FailureRateConversionModel;
    };

type EventFrequencyUnit =
  | "PER_SECOND"
  | "PER_MINUTE"
  | "PER_HOUR"
  | "PER_DAY"
  | "PER_YEAR";

type AnnualizationBasis = "CALENDAR_YEAR" | "PLANT_YEAR" | "REACTOR_YEAR" | "CRITICAL_YEAR";

interface AnnualizationConvention {
  basis: AnnualizationBasis;
  hoursPerYear: number;
}

interface AnnualizedFrequencyInput {
  value: number;
  unit: EventFrequencyUnit;
  annualization: AnnualizationConvention;
}

const DEFAULT_HOURS_PER_YEAR = 8_760;

const DEFAULT_ANNUALIZATION_CONVENTION: AnnualizationConvention = {
  basis: "PLANT_YEAR",
  hoursPerYear: DEFAULT_HOURS_PER_YEAR,
};

const HOURS_PER_TIME_UNIT: Record<QuantificationTimeUnit, number> = {
  SECOND: 1 / 3_600,
  MINUTE: 1 / 60,
  HOUR: 1,
  DAY: 24,
  YEAR: DEFAULT_HOURS_PER_YEAR,
};

const FAILURE_RATE_CONVERSION_REVIEW_REQUIRED =
  "This failure-rate conversion is no longer supported. Review the rate and mission time, then select exponential conversion.";

function requiresFailureRateConversionReview(basis?: FaultTreeBasicEventQuantificationBasis): boolean {
  return basis?.kind === "FAILURE_RATE" && basis.conversion !== "EXPONENTIAL";
}

function failureRateToProbability(
  basis: Extract<FaultTreeBasicEventQuantificationBasis, { kind: "FAILURE_RATE" }>,
): number {
  if (requiresFailureRateConversionReview(basis)) throw new Error(FAILURE_RATE_CONVERSION_REVIEW_REQUIRED);
  const rateHours = HOURS_PER_TIME_UNIT[basis.failureRate.unit];
  const missionHours = basis.missionTime.value * HOURS_PER_TIME_UNIT[basis.missionTime.unit];
  const exposure = basis.failureRate.value * missionHours / rateHours;
  // HCL_MH uq/basic_event_models.py::calc_probability, type 3.
  return 1 - Math.exp(-exposure);
}

function annualizeFrequency(
  value: number,
  unit: EventFrequencyUnit,
  annualization: AnnualizationConvention = DEFAULT_ANNUALIZATION_CONVENTION,
): number {
  if (unit === "PER_YEAR") return value;
  const occurrencesPerHour: Record<EventFrequencyUnit, number> = {
    PER_SECOND: 3_600,
    PER_MINUTE: 60,
    PER_HOUR: 1,
    PER_DAY: 1 / 24,
    PER_YEAR: 0,
  };
  return value * occurrencesPerHour[unit] * annualization.hoursPerYear;
}

export {
  DEFAULT_ANNUALIZATION_CONVENTION,
  FAILURE_RATE_CONVERSION_REVIEW_REQUIRED,
  requiresFailureRateConversionReview,
  annualizeFrequency,
  failureRateToProbability,
};
export type {
  AnnualizationBasis,
  AnnualizationConvention,
  AnnualizedFrequencyInput,
  EventFrequencyUnit,
  FailureRateConversionModel,
  FaultTreeBasicEventQuantificationBasis,
  QuantificationDuration,
  QuantificationRate,
  QuantificationTimeUnit,
};
