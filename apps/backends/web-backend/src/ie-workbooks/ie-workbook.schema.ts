import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type IeWorkbookDocument = HydratedDocument<IeWorkbook> & { createdAt: Date; updatedAt: Date };

@Schema({ timestamps: true, collection: "ie_workbooks", minimize: false })
export class IeWorkbook {
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

  @Prop({ type: String, required: false, default: null })
  linkedPosWorkbookId!: string | null;
}

export const IeWorkbookSchema = SchemaFactory.createForClass(IeWorkbook);
