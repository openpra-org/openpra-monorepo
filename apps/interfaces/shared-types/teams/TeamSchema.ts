import { z } from "zod";

const TeamRoleSchema = z.enum(["admin", "lead", "member", "invited"]);
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
  avatarUrl: z.string().nullable(),
});
type Team = z.infer<typeof TeamSchema>;

const TeamRosterEntrySchema = z.object({
  username: z.string(),
  fullName: z.string(),
  initials: z.string(),
  role: TeamRoleSchema,
});
type TeamRosterEntry = z.infer<typeof TeamRosterEntrySchema>;

const TeamInviteEntrySchema = z.object({
  username: z.string(),
  fullName: z.string(),
  initials: z.string(),
  invitedBy: z.string(),
  expiresAt: z.string(),
});
type TeamInviteEntry = z.infer<typeof TeamInviteEntrySchema>;

const TeamDetailSchema = TeamSchema.extend({
  members: z.array(TeamRosterEntrySchema),
  invited: z.array(TeamInviteEntrySchema),
});
type TeamDetail = z.infer<typeof TeamDetailSchema>;

const CreateTeamRequestSchema = z.object({
  name: z.string().trim().min(3, "Team name must be at least 3 characters").max(120),
  organization: z.string().trim().max(120).default(""),
  description: z.string().trim().max(300, "Description must be 300 characters or fewer").default(""),
  visibility: TeamVisibilitySchema.default("private"),
});
type CreateTeamRequest = z.infer<typeof CreateTeamRequestSchema>;

const UpdateTeamRequestSchema = z
  .object({
    name: z.string().trim().min(3, "Team name must be at least 3 characters").max(120).optional(),
    organization: z.string().trim().max(120).optional(),
    description: z.string().trim().max(300, "Description must be 300 characters or fewer").optional(),
    visibility: TeamVisibilitySchema.optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "At least one field is required",
  });
type UpdateTeamRequest = z.infer<typeof UpdateTeamRequestSchema>;

const InviteToTeamRequestSchema = z.object({
  identifier: z.string().trim().min(1, "Username or email is required"),
});
type InviteToTeamRequest = z.infer<typeof InviteToTeamRequestSchema>;

const BulkInviteToTeamRequestSchema = z.object({
  identifiers: z.array(z.string().trim().min(1)).min(1, "At least one identifier is required").max(100),
});
type BulkInviteToTeamRequest = z.infer<typeof BulkInviteToTeamRequestSchema>;

const BulkInviteResultSchema = z.object({
  identifier: z.string(),
  status: z.enum(["invited", "already-member", "already-invited", "not-found"]),
});
type BulkInviteResult = z.infer<typeof BulkInviteResultSchema>;

const BulkInviteResponseSchema = z.object({
  results: z.array(BulkInviteResultSchema),
});
type BulkInviteResponse = z.infer<typeof BulkInviteResponseSchema>;

const TransferTeamAdminRequestSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
});
type TransferTeamAdminRequest = z.infer<typeof TransferTeamAdminRequestSchema>;

const MyTeamsResponseSchema = z.object({
  teams: z.array(TeamSchema),
});
type MyTeamsResponse = z.infer<typeof MyTeamsResponseSchema>;

const AvailableTeamsResponseSchema = z.object({
  teams: z.array(TeamSchema),
});
type AvailableTeamsResponse = z.infer<typeof AvailableTeamsResponseSchema>;

const MyInvitationsResponseSchema = z.object({
  teams: z.array(TeamSchema),
});
type MyInvitationsResponse = z.infer<typeof MyInvitationsResponseSchema>;

export {
  TeamRoleSchema,
  TeamVisibilitySchema,
  TeamSchema,
  TeamRosterEntrySchema,
  TeamInviteEntrySchema,
  TeamDetailSchema,
  CreateTeamRequestSchema,
  UpdateTeamRequestSchema,
  InviteToTeamRequestSchema,
  BulkInviteToTeamRequestSchema,
  BulkInviteResultSchema,
  BulkInviteResponseSchema,
  TransferTeamAdminRequestSchema,
  MyTeamsResponseSchema,
  AvailableTeamsResponseSchema,
  MyInvitationsResponseSchema,
};
export type {
  TeamRole,
  TeamVisibility,
  Team,
  TeamRosterEntry,
  TeamInviteEntry,
  TeamDetail,
  CreateTeamRequest,
  UpdateTeamRequest,
  InviteToTeamRequest,
  BulkInviteToTeamRequest,
  BulkInviteResult,
  BulkInviteResponse,
  TransferTeamAdminRequest,
  MyTeamsResponse,
  AvailableTeamsResponse,
  MyInvitationsResponse,
};
