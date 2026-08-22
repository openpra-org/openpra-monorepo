import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type EsqWorkbookDocument = HydratedDocument<EsqWorkbook> & { createdAt: Date; updatedAt: Date };

@Schema({ timestamps: true, collection: "esq_workbooks", minimize: false })
export class EsqWorkbook {
  @Prop({ type: String, required: true, unique: true, index: true })
  workbookId!: string;

  @Prop({ type: String, required: true, index: true })
  projectId!: string;

  @Prop({ type: String, required: true, index: true })
  ownerUsername!: string;

  @Prop({ type: Object, required: true })
  mef!: unknown;

  @Prop({ type: Number, required: true, default: 1, min: 1 })
  revision!: number;

  @Prop({ type: String, required: false, default: null })
  previousMefJson!: string | null;
}

export const EsqWorkbookSchema = SchemaFactory.createForClass(EsqWorkbook);
