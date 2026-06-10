import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type HrWorkbookDocument = HydratedDocument<HrWorkbook> & { createdAt: Date; updatedAt: Date };

@Schema({ timestamps: true, collection: "hr_workbooks", minimize: false })
export class HrWorkbook {
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

export const HrWorkbookSchema = SchemaFactory.createForClass(HrWorkbook);
