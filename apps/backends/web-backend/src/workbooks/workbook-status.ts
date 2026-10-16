import { isValidObjectId, type Connection } from "mongoose";
import { WorkbookStatusSchema, type WorkbookStatus } from "interfaces-shared-types";
import { Workbook } from "./workbook.schema";

function workbookStatusOf(workflowState: string | undefined): WorkbookStatus {
  if (workflowState === "INTERNAL_TECHNICAL_REVIEW" || workflowState === "INTERNAL_APPROVAL") return "in-review";
  if (workflowState === "REVISION_REQUIRED") return "revision-required";
  if (workflowState === "FINAL") return "approved";
  return "draft";
}

function knownWorkbookStatus(status: string | undefined): WorkbookStatus {
  const parsed = WorkbookStatusSchema.safeParse(status);
  return parsed.success ? parsed.data : "draft";
}

async function recordWorkbookStatus(connection: Connection, workbookId: string, workflowState: string | undefined): Promise<void> {
  if (!isValidObjectId(workbookId)) return;
  await connection
    .model<Workbook>(Workbook.name)
    .updateOne({ _id: workbookId }, { $set: { status: workbookStatusOf(workflowState), statusSynced: true } }, { timestamps: false })
    .exec();
}

export { knownWorkbookStatus, recordWorkbookStatus, workbookStatusOf };
