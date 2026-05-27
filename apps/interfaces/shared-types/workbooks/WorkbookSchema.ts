import { z } from "zod";

const WorkbookStatusSchema = z.enum(["draft", "in-progress", "complete"]);
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

const UpdateWorkbookRequestSchema = z
  .object({
    name: z.string().trim().min(1, "Workbook name is required").optional(),
    status: WorkbookStatusSchema.optional(),
  })
  .refine((data) => data.name !== undefined || data.status !== undefined, {
    message: "At least one field is required",
  });
type UpdateWorkbookRequest = z.infer<typeof UpdateWorkbookRequestSchema>;

const WorkbookListResponseSchema = z.object({
  workbooks: z.array(WorkbookSchema),
});
type WorkbookListResponse = z.infer<typeof WorkbookListResponseSchema>;

export {
  WorkbookStatusSchema,
  WorkbookSchema,
  CreateWorkbookRequestSchema,
  UpdateWorkbookRequestSchema,
  WorkbookListResponseSchema,
};
export type { WorkbookStatus, Workbook, CreateWorkbookRequest, UpdateWorkbookRequest, WorkbookListResponse };
