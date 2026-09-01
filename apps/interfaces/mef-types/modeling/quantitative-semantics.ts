type QuantificationTimeUnit = "SECOND" | "MINUTE" | "HOUR" | "DAY" | "YEAR";

interface QuantificationDuration {
  value: number;
  unit: QuantificationTimeUnit;
}

interface QuantificationRate {
  value: number;
  unit: QuantificationTimeUnit;
}

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

const DEFAULT_ANNUALIZATION_CONVENTION: AnnualizationConvention = {
  basis: "PLANT_YEAR",
  hoursPerYear: 8_766,
};

const HOURS_PER_TIME_UNIT: Record<QuantificationTimeUnit, number> = {
  SECOND: 1 / 3_600,
  MINUTE: 1 / 60,
  HOUR: 1,
  DAY: 24,
  YEAR: 8_766,
};

function failureRateToProbability(
  basis: Extract<FaultTreeBasicEventQuantificationBasis, { kind: "FAILURE_RATE" }>,
): number {
  const rateHours = HOURS_PER_TIME_UNIT[basis.failureRate.unit];
  const missionHours = basis.missionTime.value * HOURS_PER_TIME_UNIT[basis.missionTime.unit];
  const exposure = basis.failureRate.value * missionHours / rateHours;
  return basis.conversion === "LINEAR"
    ? Math.min(exposure, 1)
    : -Math.expm1(-exposure);
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
