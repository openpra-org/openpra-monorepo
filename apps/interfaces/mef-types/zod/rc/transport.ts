import { z } from "zod";
import type { RcDepositionData, RcDispersionReference, RcTransportInputs, RcTransportSettings } from "../../rc/transport";
const finite = z.number().finite(), positive = finite.positive(), id = z.number().int().positive();
export const RcDepositionDataSchema: z.ZodType<RcDepositionData> = z.object({
  velocities: z.array(finite.min(0).max(10)).min(1).max(20),
  groups: z.array(z.object({ id, name: z.string().min(1).max(100), fractions: z.array(finite.min(0).max(1)).min(1).max(20), wet: z.boolean().optional(), dry: z.boolean().optional() })).min(1).max(100),
}).superRefine((d, ctx) => {
  if (new Set(d.groups.map(g => g.id)).size !== d.groups.length) ctx.addIssue({ code: "custom", message: "Deposition group IDs must be unique" });
  if (d.groups.some(g => g.fractions.length !== d.velocities.length || Math.abs(g.fractions.reduce((a, b) => a + b, 0) - 1) > .002))
    ctx.addIssue({ code: "custom", message: "Each group's particle-size fractions must match the bins and sum to one" });
});
export const RcDispersionReferenceSchema: z.ZodType<RcDispersionReference> = z.object({
  sigmaYA: z.array(positive).length(6), sigmaYB: z.array(positive).length(6), sigmaZA: z.array(positive).length(6), sigmaZB: z.array(positive).length(6), sidewaysScale: positive, verticalScale: positive,
});
export const RcTransportSettingsSchema: z.ZodType<RcTransportSettings> = z.object({
  groupVelocities: z.array(z.object({ groupId: id, name: z.string().min(1).max(100), velocity: finite.min(0).max(10), basis: z.enum(["openrc_default", "noble_gas", "analyst"]) }).strict()).min(1).max(100),
  decayMode: z.enum(["parent", "ingrowth"]),
}).strict().refine(v => new Set(v.groupVelocities.map(g => g.groupId)).size === v.groupVelocities.length, "Group velocities must be unique");
const file = z.object({ documentId: z.string().uuid(), filename: z.string().min(1).max(255), sha256: z.string().regex(/^[a-f0-9]{64}$/), size: id.max(12 * 1024 * 1024), uploadedAt: z.string().datetime() });
const parent = z.object({ index: z.number().int().nonnegative(), nuclide: z.string().min(1).max(20), energy: z.string().max(10), halfLife: z.string().min(1).max(10), ground: z.boolean(), dataset: z.string().max(30), daughter: z.string().min(1).max(20), levelCount: z.number().int().nonnegative().max(10000) });
export const RcTransportInputsSchema: z.ZodType<RcTransportInputs> = z.object({
  revision: id, categories: z.array(z.object({ categoryId: z.string().min(1).max(255), settings: RcTransportSettingsSchema.optional(), savedForSourceRevision: id.optional(), deposition: z.object({ file, data: RcDepositionDataSchema }).optional() })).max(500),
  dispersionReference: z.object({ file, data: RcDispersionReferenceSchema }).optional(),
  decayFiles: z.array(z.object({ file, parents: z.array(parent).min(1).max(2000) })).max(32),
}).superRefine((v, ctx) => {
  if (v.decayFiles.reduce((n, f) => n + f.parents.length, 0) > 5000) ctx.addIssue({ code: "custom", message: "Keep at most 5,000 decay parent records in this workbook" });
  if (new Set(v.categories.map(c => c.categoryId)).size !== v.categories.length) ctx.addIssue({ code: "custom", message: "Transport category IDs must be unique" });
});
