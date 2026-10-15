import { z } from "zod";

const WorkbookStatusSchema = z.enum(["draft", "in-review", "revision-required", "approved"]);
type WorkbookStatus = z.infer<typeof WorkbookStatusSchema>;

const WorkbookSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  elementCode: z.string(),
  name: z.string(),
  status: WorkbookStatusSchema,
  version: z.number().int().positive(),
  ownerUsername: z.string(),
  ownerFullName: z.string(),
  ownerInitials: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
type Workbook = z.infer<typeof WorkbookSchema>;

const CreateWorkbookRequestSchema = z.object({
  elementCode: z.string().min(1, "Element code is required"),
  name: z.string().trim().min(1, "Workbook name is required"),
});
type CreateWorkbookRequest = z.infer<typeof CreateWorkbookRequestSchema>;

const UpdateWorkbookRequestSchema = z.object({
  name: z.string().trim().min(1, "Workbook name is required"),
});
type UpdateWorkbookRequest = z.infer<typeof UpdateWorkbookRequestSchema>;

const WorkbookListResponseSchema = z.object({
  workbooks: z.array(WorkbookSchema),
});
type WorkbookListResponse = z.infer<typeof WorkbookListResponseSchema>;

const CreateProjectWorkbooksRequestSchema = z.object({
  name: z.string().trim().min(1, "Workbook name is required"),
});
type CreateProjectWorkbooksRequest = z.infer<typeof CreateProjectWorkbooksRequestSchema>;

const ProjectWorkbookFailureSchema = z.object({
  elementCode: z.string(),
  reason: z.string(),
});
type ProjectWorkbookFailure = z.infer<typeof ProjectWorkbookFailureSchema>;

const ProjectWorkbooksResultSchema = z.object({
  workbooks: z.array(WorkbookSchema),
  failed: z.array(ProjectWorkbookFailureSchema),
  unlinked: z.array(ProjectWorkbookFailureSchema),
});
type ProjectWorkbooksResult = z.infer<typeof ProjectWorkbooksResultSchema>;

export {
  WorkbookStatusSchema,
  WorkbookSchema,
  CreateWorkbookRequestSchema,
  UpdateWorkbookRequestSchema,
  WorkbookListResponseSchema,
  CreateProjectWorkbooksRequestSchema,
  ProjectWorkbookFailureSchema,
  ProjectWorkbooksResultSchema,
};
export type {
  WorkbookStatus,
  Workbook,
  CreateWorkbookRequest,
  UpdateWorkbookRequest,
  WorkbookListResponse,
  CreateProjectWorkbooksRequest,
  ProjectWorkbookFailure,
  ProjectWorkbooksResult,
};
