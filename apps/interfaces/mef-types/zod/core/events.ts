import { z } from "zod";
import { DistributionType, FrequencyUnit } from "../../core/events";
import { NamedSchema, UniqueSchema } from "./meta";

export const FrequencySchema = z.number();

export const DistributionTypeSchema = z.enum(DistributionType);

export const FrequencyUnitSchema = z.enum(FrequencyUnit);

export const FrequencyWithDistributionSchema = z.object({
  value: FrequencySchema,
  units: FrequencyUnitSchema,
  distribution: z
    .object({
      type: DistributionTypeSchema,
      parameters: z.array(z.number()),
    })
    .optional(),
  source: z.string().optional(),
});

export const BaseEventSchema = z.object({
  ...UniqueSchema.shape,
  ...NamedSchema.shape,
  description: z.string().optional(),
});

export const BasicEventSchema = z.object({
  ...BaseEventSchema.shape,
  eventType: z.literal("BASIC"),
});

export const FunctionalEventSchema = z.object({
  ...BaseEventSchema.shape,
  eventType: z.literal("FUNCTIONAL"),
});

export const TopEventSchema = z.object({
  ...FunctionalEventSchema.shape,
  eventSubType: z.literal("TOP"),
});

export const InitiatingEventSchema = z.object({
  ...BaseEventSchema.shape,
  eventType: z.literal("INITIATING"),
  frequency: z.union([FrequencySchema, FrequencyWithDistributionSchema]),
});
