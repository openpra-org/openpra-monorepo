import { z } from "zod";
import type {
  AnnualizationConvention,
  AnnualizedFrequencyInput,
  FaultTreeBasicEventQuantificationBasis,
  QuantificationDuration,
  QuantificationRate,
} from "../../modeling/quantitative-semantics";

const QuantificationTimeUnitSchema = z.enum(["SECOND", "MINUTE", "HOUR", "DAY", "YEAR"]);

const QuantificationDurationSchema = z
  .object({
    value: z.number().positive("Duration must be greater than zero"),
    unit: QuantificationTimeUnitSchema,
  })
  .strict();

const QuantificationRateSchema = z
  .object({
    value: z.number().nonnegative("Rate cannot be negative"),
    unit: QuantificationTimeUnitSchema,
  })
  .strict();

const FailureRateConversionModelSchema = z.enum(["EXPONENTIAL", "LINEAR"]);

const FaultTreeBasicEventQuantificationBasisSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("PROBABILITY") }).strict(),
  z
    .object({
      kind: z.literal("FAILURE_RATE"),
      failureRate: QuantificationRateSchema,
      missionTime: QuantificationDurationSchema,
      conversion: FailureRateConversionModelSchema,
    })
    .strict(),
]);

const EventFrequencyUnitSchema = z.enum([
  "PER_SECOND",
  "PER_MINUTE",
  "PER_HOUR",
  "PER_DAY",
  "PER_YEAR",
]);

const AnnualizationBasisSchema = z.enum([
  "CALENDAR_YEAR",
  "PLANT_YEAR",
  "REACTOR_YEAR",
  "CRITICAL_YEAR",
]);

const AnnualizationConventionSchema = z
  .object({
    basis: AnnualizationBasisSchema,
    hoursPerYear: z.number().positive("Annualization hours must be greater than zero"),
  })
  .strict();

const AnnualizedFrequencyInputSchema = z
  .object({
    value: z.number().nonnegative("Frequency cannot be negative"),
    unit: EventFrequencyUnitSchema,
    annualization: AnnualizationConventionSchema,
  })
  .strict();

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _AssertDuration = Expect<Equal<z.infer<typeof QuantificationDurationSchema>, QuantificationDuration>>;
type _AssertRate = Expect<Equal<z.infer<typeof QuantificationRateSchema>, QuantificationRate>>;
type _AssertBasicEventBasis = Expect<
  Equal<z.infer<typeof FaultTreeBasicEventQuantificationBasisSchema>, FaultTreeBasicEventQuantificationBasis>
>;
type _AssertAnnualization = Expect<
  Equal<z.infer<typeof AnnualizationConventionSchema>, AnnualizationConvention>
>;
type _AssertAnnualizedFrequency = Expect<
  Equal<z.infer<typeof AnnualizedFrequencyInputSchema>, AnnualizedFrequencyInput>
>;

export {
  AnnualizationBasisSchema,
  AnnualizationConventionSchema,
  AnnualizedFrequencyInputSchema,
  EventFrequencyUnitSchema,
  FailureRateConversionModelSchema,
  FaultTreeBasicEventQuantificationBasisSchema,
  QuantificationDurationSchema,
  QuantificationRateSchema,
  QuantificationTimeUnitSchema,
};
