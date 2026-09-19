import { z } from "zod";
import type { RcCaseRecords, RcLinkedResultValues } from "../../rc/case-records";
const text = z.string().trim().min(1).max(255), count = z.number().int().nonnegative(), positive = z.number().finite().positive();
const file = z.object({ documentId: z.string().uuid(), filename: text, sha256: z.string().regex(/^[a-f0-9]{64}$/), size: positive.int().max(50 * 1024 * 1024), uploadedAt: z.string().datetime() });
export const RcLinkedResultValuesSchema: z.ZodType<RcLinkedResultValues> = z.object({
  snapshotId: z.string().uuid(), receptorId: text, trialId: text, dose: z.number().finite().nonnegative(), unit: z.enum(["Sv", "mSv", "µSv"]), version: text, reference: text, confirmed: z.literal(true),
}).strict();
export const RcCaseRecordsSchema: z.ZodType<RcCaseRecords> = z.object({
  revision: positive.int(),
  snapshots: z.array(z.object({ id: z.string().uuid(), label: text, categoryId: text, file, inputHash: z.string().regex(/^[a-f0-9]{64}$/), createdBy: text,
    reviewItems: count, inventoryCount: count, receptorCount: count, trialCount: count, integrationSeconds: positive.max(1e12).optional() })).max(100),
  results: z.array(z.object({ snapshotId: z.string().uuid(), receptorId: text, trialId: text, dose: z.number().finite().nonnegative(), unit: z.enum(["Sv", "mSv", "µSv"]), version: text, reference: text, confirmed: z.literal(true),
    id: z.string().uuid(), file, integrationSeconds: positive.max(1e12), recordedBy: text, valueSource: z.literal("transcribed") })).max(1000),
}).superRefine((v, ctx) => {
  if (new Set(v.snapshots.map(s => s.id)).size !== v.snapshots.length || new Set(v.results.map(r => r.id)).size !== v.results.length || v.results.some(r => !v.snapshots.some(s => s.id === r.snapshotId)))
    ctx.addIssue({ code: "custom", message: "Case and result IDs must be unique; each result must link to a saved snapshot" });
});
