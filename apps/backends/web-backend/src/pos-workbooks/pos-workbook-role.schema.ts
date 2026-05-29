import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type PosWorkbookRoleDocument = HydratedDocument<PosWorkbookRole> & { createdAt: Date; updatedAt: Date };

export type PosWorkbookRoleName = "preparer" | "reviewer" | "approver";

@Schema({ timestamps: true, collection: "pos_workbook_roles" })
export class PosWorkbookRole {
  @Prop({ type: String, required: true, index: true })
  workbookId!: string;

  @Prop({ type: String, required: true, index: true })
  username!: string;

  @Prop({ type: String, required: true })
  role!: PosWorkbookRoleName;

  @Prop({ type: String, required: true })
  assignedBy!: string;
}

export const PosWorkbookRoleSchema = SchemaFactory.createForClass(PosWorkbookRole);

PosWorkbookRoleSchema.index({ workbookId: 1, username: 1, role: 1 }, { unique: true });
