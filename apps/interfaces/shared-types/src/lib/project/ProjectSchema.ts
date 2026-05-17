import { z } from "zod";
import { ProjectStatusSchema, RiskModeSchema } from "./RiskMode";

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
  collaborators: z.array(z.string()),
  status: ProjectStatusMapSchema,
  progress: z.number().min(0).max(1),
  updatedAt: z.string(),
});
type Project = z.infer<typeof ProjectSchema>;

const CreateProjectRequestSchema = z.object({
  name: z.string().trim().min(3, "Project name must be at least 3 characters"),
  mode: RiskModeSchema,
});
type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;

const RecentProjectResponseSchema = z.object({
  project: ProjectSchema.nullable(),
});
type RecentProjectResponse = z.infer<typeof RecentProjectResponseSchema>;

const SharedProjectsResponseSchema = z.object({
  projects: z.array(ProjectSchema),
});
type SharedProjectsResponse = z.infer<typeof SharedProjectsResponseSchema>;

export {
  ProjectStatusMapSchema,
  ProjectSchema,
  CreateProjectRequestSchema,
  RecentProjectResponseSchema,
  SharedProjectsResponseSchema,
};
export type {
  ProjectStatusMap,
  Project,
  CreateProjectRequest,
  RecentProjectResponse,
  SharedProjectsResponse,
};
