import { z } from "zod";

const OrgSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  memberCount: z.number().int().nonnegative(),
  teamCount: z.number().int().nonnegative(),
});
type OrgSummary = z.infer<typeof OrgSummarySchema>;

const OrgSearchHitSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  memberCount: z.number().int().nonnegative(),
});
type OrgSearchHit = z.infer<typeof OrgSearchHitSchema>;

const OrgSearchResponseSchema = z.object({
  orgs: z.array(OrgSearchHitSchema),
});
type OrgSearchResponse = z.infer<typeof OrgSearchResponseSchema>;

export {
  OrgSummarySchema,
  OrgSearchHitSchema,
  OrgSearchResponseSchema,
};
export type {
  OrgSummary,
  OrgSearchHit,
  OrgSearchResponse,
};
