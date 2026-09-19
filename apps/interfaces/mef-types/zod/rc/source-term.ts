import { z } from "zod";
import type { RcSourceTerm, RcSourceTermValues } from "../../rc/source-term";

const nonnegative = z.number().finite().nonnegative();
const identifier = z.number().int().min(1).max(999);
export const RcSourceTermValuesSchema: z.ZodType<RcSourceTermValues> = z.object({
  groups: z.array(z.object({ id: identifier, name: z.string().trim().min(1).max(80) })).min(1).max(999),
  inventory: z.array(z.object({
    name: z.string().regex(/^[A-Z][a-z]?-[1-9]\d{0,2}(?:m\d?)?$/, "Use a nuclide name such as Cs-137 or Kr-85m"),
    activityBq: nonnegative,
    group: identifier,
  })).min(1).max(5000),
  releases: z.array(z.object({
    id: identifier,
    startSeconds: nonnegative.optional(),
    durationSeconds: z.number().finite().positive().optional(),
    heightMetres: nonnegative.optional(),
    fractions: z.array(nonnegative.max(1)).min(1).max(999),
  })).min(1).max(999),
}).superRefine((source, ctx) => {
  const issue = (message: string, path: (string | number)[]) => ctx.addIssue({ code: "custom", message, path });
  for (const [key, ids] of [
    ["groups", source.groups.map((g) => g.id)],
    ["inventory", source.inventory.map((n) => n.name)],
    ["releases", source.releases.map((r) => r.id)],
  ] as const) {
    if (new Set<string | number>(ids).size !== ids.length) issue(`Duplicate ${key} identifier`, [key]);
  }
  source.inventory.forEach((n, i) => {
    if (!source.groups.some((g) => g.id === n.group)) issue("Choose a listed chemical group", ["inventory", i, "group"]);
  });
  source.releases.forEach((r, i) => {
    if (r.fractions.length !== source.groups.length) issue("Each segment needs one fraction per chemical group", ["releases", i, "fractions"]);
    const previous = source.releases[i - 1];
    if (previous?.startSeconds !== undefined && r.startSeconds !== undefined && r.startSeconds < previous.startSeconds)
      issue("Keep release segments in time order", ["releases", i, "startSeconds"]);
  });
  source.groups.forEach((g, i) => {
    if (source.releases.reduce((sum, r) => sum + (r.fractions[i] ?? 0), 0) > 1.0000001)
      issue(`${g.name}: fractions across all segments exceed 1`, ["groups", i]);
  });
});

export const RcSourceTermSchema: z.ZodType<RcSourceTerm> = z.object({
  revision: z.number().int().positive(),
  values: RcSourceTermValuesSchema,
  originalFile: z.object({
    documentId: z.string().uuid(), filename: z.string().min(1).max(255),
    sha256: z.string().regex(/^[a-f0-9]{64}$/), size: z.number().int().positive(),
    uploadedAt: z.string().datetime(),
  }).optional(),
});
