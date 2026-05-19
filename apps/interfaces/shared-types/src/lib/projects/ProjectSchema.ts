import { z } from "zod";
import { ProjectStateSchema, ProjectStatusSchema, RiskModeSchema } from "./RiskMode";

const ProjectStatusMapSchema = z.record(z.string(), ProjectStatusSchema);
type ProjectStatusMap = z.infer<typeof ProjectStatusMapSchema>;

const ProjectShareRoleSchema = z.enum(["viewer", "editor"]);
type ProjectShareRole = z.infer<typeof ProjectShareRoleSchema>;

const ProjectAccessRoleSchema = z.enum(["owner", "editor", "viewer"]);
type ProjectAccessRole = z.infer<typeof ProjectAccessRoleSchema>;

const ProjectTeamShareSchema = z.object({
  teamId: z.string(),
  teamName: z.string(),
  memberCount: z.number().int().nonnegative(),
  role: ProjectShareRoleSchema,
});
type ProjectTeamShareEntry = z.infer<typeof ProjectTeamShareSchema>;

const ProjectUserShareSchema = z.object({
  username: z.string(),
  fullName: z.string(),
  role: ProjectShareRoleSchema,
});
type ProjectUserShareEntry = z.infer<typeof ProjectUserShareSchema>;

const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  mode: RiskModeSchema,
  modeLabel: z.string(),
  ownerUsername: z.string(),
  ownerFullName: z.string(),
  ownerInitials: z.string(),
  myRole: ProjectAccessRoleSchema,
  sharedTeams: z.array(ProjectTeamShareSchema),
  sharedUsers: z.array(ProjectUserShareSchema),
  status: ProjectStatusMapSchema,
  progress: z.number().min(0).max(1),
  pinned: z.boolean(),
  state: ProjectStateSchema,
  updatedAt: z.string(),
});
type Project = z.infer<typeof ProjectSchema>;

const CreateProjectRequestSchema = z.object({
  name: z.string().trim().min(3, "Project name must be at least 3 characters"),
  mode: RiskModeSchema,
});
type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;

const UpdateProjectRequestSchema = z
  .object({
    name: z.string().trim().min(3, "Project name must be at least 3 characters").optional(),
    pinned: z.boolean().optional(),
    state: ProjectStateSchema.optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.pinned !== undefined || data.state !== undefined,
    { message: "At least one field is required" },
  );
type UpdateProjectRequest = z.infer<typeof UpdateProjectRequestSchema>;

const ShareProjectWithTeamRequestSchema = z.object({
  teamId: z.string().min(1, "Team id is required"),
  role: ProjectShareRoleSchema,
});
type ShareProjectWithTeamRequest = z.infer<typeof ShareProjectWithTeamRequestSchema>;

const ShareProjectWithUserRequestSchema = z.object({
  identifier: z.string().trim().min(1, "Username or email is required"),
  role: ProjectShareRoleSchema,
});
type ShareProjectWithUserRequest = z.infer<typeof ShareProjectWithUserRequestSchema>;

const UpdateProjectShareRoleRequestSchema = z.object({
  role: ProjectShareRoleSchema,
});
type UpdateProjectShareRoleRequest = z.infer<typeof UpdateProjectShareRoleRequestSchema>;

const RecentProjectResponseSchema = z.object({
  project: ProjectSchema.nullable(),
});
type RecentProjectResponse = z.infer<typeof RecentProjectResponseSchema>;

const OwnedProjectsResponseSchema = z.object({
  projects: z.array(ProjectSchema),
});
type OwnedProjectsResponse = z.infer<typeof OwnedProjectsResponseSchema>;

const SharedProjectsResponseSchema = z.object({
  projects: z.array(ProjectSchema),
});
type SharedProjectsResponse = z.infer<typeof SharedProjectsResponseSchema>;

export {
  ProjectStatusMapSchema,
  ProjectShareRoleSchema,
  ProjectAccessRoleSchema,
  ProjectTeamShareSchema,
  ProjectUserShareSchema,
  ProjectSchema,
  CreateProjectRequestSchema,
  UpdateProjectRequestSchema,
  ShareProjectWithTeamRequestSchema,
  ShareProjectWithUserRequestSchema,
  UpdateProjectShareRoleRequestSchema,
  RecentProjectResponseSchema,
  OwnedProjectsResponseSchema,
  SharedProjectsResponseSchema,
};
export type {
  ProjectStatusMap,
  ProjectShareRole,
  ProjectAccessRole,
  ProjectTeamShareEntry,
  ProjectUserShareEntry,
  Project,
  CreateProjectRequest,
  UpdateProjectRequest,
  ShareProjectWithTeamRequest,
  ShareProjectWithUserRequest,
  UpdateProjectShareRoleRequest,
  RecentProjectResponse,
  OwnedProjectsResponse,
  SharedProjectsResponse,
};
