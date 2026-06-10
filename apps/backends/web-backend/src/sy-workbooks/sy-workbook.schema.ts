import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type SyWorkbookDocument = HydratedDocument<SyWorkbook> & { createdAt: Date; updatedAt: Date };

@Schema({ timestamps: true, collection: "sy_workbooks", minimize: false })
export class SyWorkbook {
  @Prop({ type: String, required: true, unique: true, index: true })
  workbookId!: string;

  @Prop({ type: String, required: true, index: true })
  projectId!: string;

  @Prop({ type: String, required: true, index: true })
  ownerUsername!: string;

  @Prop({ type: Object, required: true })
  mef!: unknown;

  @Prop({ type: String, required: false, default: null })
  previousMefJson!: string | null;
}

export const SyWorkbookSchema = SchemaFactory.createForClass(SyWorkbook);
