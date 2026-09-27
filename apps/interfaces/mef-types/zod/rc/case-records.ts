import { z } from "zod";
import type { RcCaseRecords, RcCategoryResultValues, RcResultStatistics } from "../../rc/case-records";
import { RcMetricQuantitySchema, RcMetricStatisticsSchema } from "./metrics";
const text = z.string().trim().min(1).max(255), count = z.number().int().nonnegative(), positive = z.number().finite().positive();
const file = z.object({ documentId: z.string().uuid(), filename: text, sha256: z.string().regex(/^[a-f0-9]{64}$/), size: positive.int().max(50 * 1024 * 1024), uploadedAt: z.string().datetime() });
const distinct = (values: number[]) => new Set(values).size === values.length;
export const RcResultStatisticsSchema: z.ZodType<RcResultStatistics> = z.object({
  mean: z.number().finite().nonnegative().optional(),
  percentiles: z.array(z.object({ percentile: z.number().gt(0).lt(100), value: z.number().finite().nonnegative() }).strict()).max(20)
    .refine(rows => distinct(rows.map(row => row.percentile)), "Percentiles must be unique"),
  exceedances: z.array(z.object({ threshold: positive, probability: z.number().finite().min(0).max(1) }).strict()).max(20)
    .refine(rows => distinct(rows.map(row => row.threshold)), "Thresholds must be unique"),
}).strict().superRefine((value, ctx) => {
  const ordered = [...value.percentiles].sort((a, b) => a.percentile - b.percentile);
  if (ordered.some((row, index) => index > 0 && row.value < ordered[index - 1].value)) ctx.addIssue({ code: "custom", path: ["percentiles"], message: "Percentile values must not decrease as the percentile rises" });
  const thresholds = [...value.exceedances].sort((a, b) => a.threshold - b.threshold);
  if (thresholds.some((row, index) => index > 0 && row.probability > thresholds[index - 1].probability)) ctx.addIssue({ code: "custom", path: ["exceedances"], message: "The chance of exceeding a threshold must not rise as the threshold rises" });
});
export const RcCategoryResultValuesSchema: z.ZodType<RcCategoryResultValues> = z.object({
  snapshotId: z.string().uuid(), metricId: z.string().min(1).max(40), statistics: RcResultStatisticsSchema, version: text, reference: text, confirmed: z.literal(true),
}).strict();
const snapshotMetric = z.object({ id: z.string().min(1).max(40), name: z.string().max(200), quantity: RcMetricQuantitySchema, windowSeconds: positive.max(1e10).optional(),
  unit: z.string().max(60).optional(), statistics: RcMetricStatisticsSchema.optional() }).strict();
export const RcCaseRecordsSchema: z.ZodType<RcCaseRecords> = z.object({
  revision: positive.int(),
  snapshots: z.array(z.object({ id: z.string().uuid(), label: text, categoryId: text, file, inputHash: z.string().regex(/^[a-f0-9]{64}$/), createdBy: text,
    reviewItems: count, inventoryCount: count, receptorCount: count, trialCount: count, integrationSeconds: positive.max(1e12).optional(),
    metrics: z.array(snapshotMetric).max(40).optional(), versions: z.string().max(255).optional() })).max(100),
  results: z.array(z.object({ snapshotId: z.string().uuid(), metricId: z.string().min(1).max(40), statistics: RcResultStatisticsSchema, version: text, reference: text, confirmed: z.literal(true),
    id: z.string().uuid(), categoryId: text, unit: z.string().max(60), file, recordedBy: text, valueSource: z.literal("transcribed") })).max(1000),
}).superRefine((v, ctx) => {
  if (new Set(v.snapshots.map(s => s.id)).size !== v.snapshots.length || new Set(v.results.map(r => r.id)).size !== v.results.length
    || v.results.some(r => v.snapshots.find(s => s.id === r.snapshotId)?.categoryId !== r.categoryId))
    ctx.addIssue({ code: "custom", message: "Case and result IDs must be unique; each result must link to a saved snapshot of its release category" });
});
