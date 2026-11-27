import { z } from "zod";

const WorkbookShareAccessSchema = z.enum(["edit", "view"]);
type WorkbookShareAccess = z.infer<typeof WorkbookShareAccessSchema>;

const WorkbookShareEntrySchema = z.object({
  username: z.string(),
  fullName: z.string(),
  access: WorkbookShareAccessSchema,
  sharedBy: z.string(),
  sharedAt: z.string(),
});
type WorkbookShareEntry = z.infer<typeof WorkbookShareEntrySchema>;

const WorkbookSharesResponseSchema = z.object({
  canShare: z.boolean(),
  myAccess: WorkbookShareAccessSchema.nullable(),
  entries: z.array(WorkbookShareEntrySchema),
});
type WorkbookSharesResponse = z.infer<typeof WorkbookSharesResponseSchema>;

const WorkbookShareRequestSchema = z
  .object({
    identifier: z.string().trim().min(1, "Username or email is required").max(320),
    access: WorkbookShareAccessSchema,
  })
  .strict();
type WorkbookShareRequest = z.infer<typeof WorkbookShareRequestSchema>;

const WorkbookShareAccessRequestSchema = z.object({ access: WorkbookShareAccessSchema }).strict();
type WorkbookShareAccessRequest = z.infer<typeof WorkbookShareAccessRequestSchema>;

const WorkbookLiveEventSchema = z.object({
  workbookId: z.string(),
  seq: z.number().int().nonnegative(),
  actor: z.string(),
  clientId: z.string().nullable(),
  at: z.string(),
});
type WorkbookLiveEvent = z.infer<typeof WorkbookLiveEventSchema>;

const WORKBOOK_CLIENT_HEADER = "x-workbook-client";
const WORKBOOK_SEEN_HEADER = "x-workbook-seen";
const WORKBOOK_SEQ_HEADER = "x-workbook-seq";
const WORKBOOK_ID_HEADER = "x-workbook-id";

function workbookIdOfPath(path: string): string | null {
  const segments = (path.split("?")[0] ?? "").split("/");
  for (let index = 1; index < segments.length; index += 1) {
    const before = segments[index - 1] ?? "";
    const workbookSegment = before === "workbooks" || (before.endsWith("-workbooks") && before !== "example-workbooks");
    const candidate = segments[index] ?? "";
    if (workbookSegment && candidate.length > 0 && !candidate.startsWith(":")) return candidate;
  }
  return null;
}

export {
  WORKBOOK_CLIENT_HEADER,
  WORKBOOK_ID_HEADER,
  WORKBOOK_SEEN_HEADER,
  WORKBOOK_SEQ_HEADER,
  WorkbookLiveEventSchema,
  WorkbookShareAccessRequestSchema,
  WorkbookShareAccessSchema,
  WorkbookShareEntrySchema,
  WorkbookShareRequestSchema,
  WorkbookSharesResponseSchema,
  workbookIdOfPath,
};
export type {
  WorkbookLiveEvent,
  WorkbookShareAccess,
  WorkbookShareAccessRequest,
  WorkbookShareEntry,
  WorkbookShareRequest,
  WorkbookSharesResponse,
};
