import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type WorkbookRoleDocument = HydratedDocument<WorkbookRole> & { createdAt: Date; updatedAt: Date };

export type WorkbookRoleName = "preparer" | "co_preparer" | "reviewer" | "approver";

@Schema({ timestamps: true, collection: "workbook_roles" })
export class WorkbookRole {
  @Prop({ type: String, required: true, index: true })
  workbookId!: string;

  @Prop({ type: String, required: false, index: true })
  username?: string;

  @Prop({ type: String, required: false, index: true })
  teamId?: string;

  @Prop({ type: String, required: true })
  role!: WorkbookRoleName;

  @Prop({ type: String, required: false })
  designation?: string;

  @Prop({ type: String, required: true })
  assignedBy!: string;
}

export const WorkbookRoleSchema = SchemaFactory.createForClass(WorkbookRole);

WorkbookRoleSchema.index(
  { workbookId: 1, username: 1, role: 1 },
  { unique: true, partialFilterExpression: { username: { $type: "string" } } },
);
WorkbookRoleSchema.index(
  { workbookId: 1, teamId: 1, role: 1 },
  { unique: true, partialFilterExpression: { teamId: { $type: "string" } } },
);
