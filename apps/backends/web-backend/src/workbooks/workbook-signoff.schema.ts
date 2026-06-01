import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type WorkbookSignoffDocument = HydratedDocument<WorkbookSignoff> & { createdAt: Date; updatedAt: Date };

export type WorkbookSignoffRole = "preparer" | "co_preparer" | "reviewer" | "approver";

@Schema({ timestamps: true, collection: "workbook_signoffs" })
export class WorkbookSignoff {
  @Prop({ type: String, required: true, index: true })
  workbookId!: string;

  @Prop({ type: String, required: true, index: true })
  username!: string;

  @Prop({ type: String, required: true })
  role!: WorkbookSignoffRole;

  @Prop({ type: String, required: true })
  workflowState!: string;
}

export const WorkbookSignoffSchema = SchemaFactory.createForClass(WorkbookSignoff);

WorkbookSignoffSchema.index({ workbookId: 1, username: 1, role: 1 }, { unique: true });
