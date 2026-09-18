import { z } from "zod";
import type { RcDoseInputs, RcDoseSettings, RcExposureData } from "../../rc/dose-inputs";
const positive = z.number().finite().positive(), id = positive.int(), finite = z.number().finite().nonnegative();
export const RcDoseSettingsSchema: z.ZodType<RcDoseSettings> = z.object({ integrationSeconds: positive.max(1e12), basis: z.enum(["imported", "analyst"]) }).strict();
export const RcExposureDataSchema: z.ZodType<RcExposureData> = z.object({ integrationSeconds: positive.max(1e12), blocks: z.array(z.object({ index: z.number().int().nonnegative(), records: z.record(z.string().regex(/^SE(BRRATE|CSFACT|GSHFAC|PROTIN)00[123]$/), finite) })).max(100) });
const file = z.object({ documentId: z.string().uuid(), filename: z.string().min(1).max(255), sha256: z.string().regex(/^[a-f0-9]{64}$/), size: id.max(15 * 1024 * 1024), uploadedAt: z.string().datetime() });
export const RcDoseInputsSchema: z.ZodType<RcDoseInputs> = z.object({
  revision: id, categories: z.array(z.object({ categoryId: z.string().min(1).max(255), settings: RcDoseSettingsSchema.optional(), savedForSourceRevision: id.optional(), exposure: z.object({ file, data: RcExposureDataSchema }).optional() })).max(500),
  libraries: z.array(z.object({ kind: z.enum(["inhalation", "cloudshine", "groundshine"]), file, nuclides: z.array(z.string().min(1).max(20)).min(1).max(5000), recordCount: id.max(50000) })).max(3),
}).superRefine((d, ctx) => {
  if (new Set(d.categories.map(c => c.categoryId)).size !== d.categories.length || new Set(d.libraries.map(l => l.kind)).size !== d.libraries.length) ctx.addIssue({ code: "custom", message: "Dose categories and pathway libraries must be unique" });
});
