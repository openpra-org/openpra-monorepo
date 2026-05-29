import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type PosWorkbookSignoffDocument = HydratedDocument<PosWorkbookSignoff> & { createdAt: Date; updatedAt: Date };

export type PosSignoffRole = "preparer" | "co_preparer" | "reviewer" | "approver";

@Schema({ timestamps: true, collection: "pos_workbook_signoffs" })
export class PosWorkbookSignoff {
  @Prop({ type: String, required: true, index: true })
  workbookId!: string;

  @Prop({ type: String, required: true, index: true })
  username!: string;

  @Prop({ type: String, required: true })
  role!: PosSignoffRole;

  @Prop({ type: String, required: true })
  workflowState!: string;
}

export const PosWorkbookSignoffSchema = SchemaFactory.createForClass(PosWorkbookSignoff);

PosWorkbookSignoffSchema.index({ workbookId: 1, username: 1, role: 1 }, { unique: true });
