import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import type { ToolId, WorkbookStatus } from "interfaces-shared-types";

export type WorkbookDocument = HydratedDocument<Workbook> & { createdAt: Date; updatedAt: Date };

@Schema({ timestamps: true, collection: "workbooks" })
export class Workbook {
  @Prop({ type: String, required: true, index: true })
  projectId!: string;

  @Prop({ type: String, required: true, index: true })
  elementCode!: string;

  @Prop({ type: String, required: true, index: true })
  toolId!: ToolId;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, default: "draft" })
  status!: WorkbookStatus;

  @Prop({ type: Number, default: 1 })
  version!: number;

  @Prop({ type: String, required: true })
  ownerUsername!: string;

  @Prop({ type: String, required: true })
  ownerFullName!: string;
}

export const WorkbookSchema = SchemaFactory.createForClass(Workbook);
