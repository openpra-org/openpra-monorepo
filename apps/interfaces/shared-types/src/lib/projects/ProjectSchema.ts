import { z } from "zod";
import { ProjectStateSchema, ProjectStatusSchema, RiskModeSchema } from "./RiskMode";

const ProjectStatusMapSchema = z.record(z.string(), ProjectStatusSchema);
type ProjectStatusMap = z.infer<typeof ProjectStatusMapSchema>;

const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  mode: RiskModeSchema,
  modeLabel: z.string(),
  ownerUsername: z.string(),
  ownerFullName: z.string(),
  ownerInitials: z.string(),
  ownerTeamId: z.string().nullable(),
  ownerTeamName: z.string().nullable(),
  collaborators: z.array(z.string()),
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
  ownerTeamId: z.string().min(1).nullable().optional(),
});
type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;

const TransferProjectToTeamRequestSchema = z.object({
  teamId: z.string().min(1, "Team id is required"),
});
type TransferProjectToTeamRequest = z.infer<typeof TransferProjectToTeamRequestSchema>;

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
  ProjectSchema,
  CreateProjectRequestSchema,
  UpdateProjectRequestSchema,
  TransferProjectToTeamRequestSchema,
  RecentProjectResponseSchema,
  OwnedProjectsResponseSchema,
  SharedProjectsResponseSchema,
};
export type {
  ProjectStatusMap,
  Project,
  CreateProjectRequest,
  UpdateProjectRequest,
  TransferProjectToTeamRequest,
  RecentProjectResponse,
  OwnedProjectsResponse,
  SharedProjectsResponse,
};
