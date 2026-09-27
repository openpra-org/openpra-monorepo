import { z } from "zod";
import type { RcConsequenceMetric, RcMetricReceptor, RcMetricStatistics } from "../../rc/metrics";

const positive = z.number().finite().positive();
const text = z.string().max(4000);

export const RcMetricQuantitySchema = z.enum([
  "INDIVIDUAL_DOSE",
  "INDIVIDUAL_EARLY_FATALITY_RISK",
  "INDIVIDUAL_LATENT_CANCER_FATALITY_RISK",
  "POPULATION_DOSE",
  "LAND_CONTAMINATION_AREA",
  "ECONOMIC_COST",
  "CUSTOM",
]);

export const RcMetricReceptorSchema: z.ZodType<RcMetricReceptor> = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("EAB_MAXIMUM") }).strict(),
  z.object({ kind: z.literal("DISTANCE_PROFILE") }).strict(),
  z.object({ kind: z.literal("AVERAGE_BEYOND_EAB"), distanceKm: positive.max(1000).optional() }).strict(),
  z.object({ kind: z.literal("WITHIN_RADIUS"), radiusKm: positive.max(2000).optional() }).strict(),
  z.object({ kind: z.literal("OTHER"), description: text }).strict(),
]);

const distinct = (values: number[]) => new Set(values).size === values.length;

export const RcMetricStatisticsSchema: z.ZodType<RcMetricStatistics> = z.object({
  mean: z.boolean(),
  percentiles: z.array(z.number().gt(0).lt(100)).max(20).refine(distinct, "Percentiles must be unique"),
  exceedanceThresholds: z.array(positive).max(20).refine(distinct, "Thresholds must be unique"),
}).strict();

export const RcConsequenceMetricSchema: z.ZodType<RcConsequenceMetric> = z.object({
  id: z.string().min(1).max(40),
  name: z.string().max(200),
  quantity: RcMetricQuantitySchema,
  customUnit: z.string().max(60).optional(),
  receptor: RcMetricReceptorSchema,
  window: z.object({ seconds: positive.max(1e10), start: z.enum(["RELEASE_ONSET", "PLUME_ARRIVAL"]) }).strict().optional(),
  protectiveActionsCredited: z.boolean(),
  statistics: RcMetricStatisticsSchema,
  criterion: text,
  basis: text,
}).strict();

export const RcConsequenceMetricsSchema = z.array(RcConsequenceMetricSchema).max(40)
  .refine((metrics) => new Set(metrics.map((metric) => metric.id)).size === metrics.length, "Metric identifiers must be unique");
