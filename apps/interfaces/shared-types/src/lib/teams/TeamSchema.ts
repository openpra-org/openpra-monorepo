import { z } from "zod";

const TeamRoleSchema = z.enum(["admin", "member", "pending"]);
type TeamRole = z.infer<typeof TeamRoleSchema>;

const TeamVisibilitySchema = z.enum(["public", "private"]);
type TeamVisibility = z.infer<typeof TeamVisibilitySchema>;

const TeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  organization: z.string(),
  description: z.string(),
  visibility: TeamVisibilitySchema,
  adminUsername: z.string(),
  memberCount: z.number().int().nonnegative(),
  role: TeamRoleSchema.nullable(),
});
type Team = z.infer<typeof TeamSchema>;

const CreateTeamRequestSchema = z.object({
  name: z.string().trim().min(3, "Team name must be at least 3 characters").max(120),
  organization: z.string().trim().max(120).default(""),
  description: z.string().trim().max(300, "Description must be 300 characters or fewer").default(""),
  visibility: TeamVisibilitySchema.default("private"),
});
type CreateTeamRequest = z.infer<typeof CreateTeamRequestSchema>;

const MyTeamsResponseSchema = z.object({
  teams: z.array(TeamSchema),
});
type MyTeamsResponse = z.infer<typeof MyTeamsResponseSchema>;

const AvailableTeamsResponseSchema = z.object({
  teams: z.array(TeamSchema),
});
type AvailableTeamsResponse = z.infer<typeof AvailableTeamsResponseSchema>;

export {
  TeamRoleSchema,
  TeamVisibilitySchema,
  TeamSchema,
  CreateTeamRequestSchema,
  MyTeamsResponseSchema,
  AvailableTeamsResponseSchema,
};
export type {
  TeamRole,
  TeamVisibility,
  Team,
  CreateTeamRequest,
  MyTeamsResponse,
  AvailableTeamsResponse,
};
