import { z } from "zod";
import type { RcReceptorGeometry, RcSiteReceptors, RcSiteSettings } from "../../rc/site-receptors";

const finite = z.number().finite();
const coordinates = z.object({ latitude: finite.min(-90).max(90), longitude: finite.min(-180).max(180), origin: z.string().min(1).max(200) });
const increasing = z.array(finite.positive()).min(1).max(1000).refine(a => a.every((n, i) => i === 0 || n > a[i - 1]), "Distances must increase");
const anchor = z.object({ localX: finite, localY: finite, utmEasting: finite, utmNorthing: finite,
  zone: z.number().int().min(-60).max(60).refine(n => n !== 0), datum: z.number().int().min(1).max(6) });
const points = z.array(z.object({ id: z.string().min(1).max(80), x: finite, y: finite, elevationMetres: finite.optional(), hillHeightMetres: finite.optional(),
  heightMetres: finite.nonnegative().optional(), radiusMetres: finite.positive().optional(), bearingDegrees: finite.min(0).lt(360).optional() })).min(1).max(100000);
export const RcReceptorGeometrySchema: z.ZodType<RcReceptorGeometry> = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("cells"), radiiKm: increasing, sectors: z.number().int().min(1).max(360), center: coordinates.optional(), abridged: z.boolean() }),
  z.object({ kind: z.literal("points"), points, anchor }),
  z.object({ kind: z.literal("grid"), points, anchor, radiiMetres: increasing, bearingsDegrees: z.array(finite.min(0).lt(360)).min(1).max(360), originX: finite, originY: finite }),
]).superRefine((g, ctx) => {
  if (g.kind === "cells") {
    if (g.radiiKm.length * g.sectors > 100000) ctx.addIssue({ code: "custom", message: "At most 100,000 receptor cells are supported" });
  } else if (new Set(g.points.map(p => p.id)).size !== g.points.length) ctx.addIssue({ code: "custom", message: "Point identifiers must be unique" });
  if (g.kind === "grid" && (g.points.length !== g.radiiMetres.length * g.bearingsDegrees.length || new Set(g.bearingsDegrees).size !== g.bearingsDegrees.length))
    ctx.addIssue({ code: "custom", message: "Grid dimensions must match unique receptor directions" });
});
export const RcSiteSettingsSchema: z.ZodType<RcSiteSettings> = z.object({ latitude: finite.min(-90).max(90).optional(), longitude: finite.min(-180).max(180).optional(),
  releaseX: finite.optional(), releaseY: finite.optional(), receptorHeightMetres: finite.nonnegative().optional(), cellPoint: z.enum(["mid", "outer"]).optional() }).strict();
const file = z.object({ documentId: z.string().uuid(), filename: z.string().min(1).max(255), sha256: z.string().regex(/^[a-f0-9]{64}$/), size: z.number().int().positive(), uploadedAt: z.string().datetime() });
export const RcSiteReceptorsSchema: z.ZodType<RcSiteReceptors> = z.object({ revision: z.number().int().positive(), settings: RcSiteSettingsSchema,
  geometry: RcReceptorGeometrySchema.optional(), locationOrigin: z.string().max(200).optional(), locationFile: file.optional(), geometryFile: file.optional() });
