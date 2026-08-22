import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type EsWorkbookDocument = HydratedDocument<EsWorkbook> & { createdAt: Date; updatedAt: Date };

@Schema({ timestamps: true, collection: "es_workbooks", minimize: false })
export class EsWorkbook {
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

  @Prop({ type: String, required: false, default: null })
  linkedPosWorkbookId!: string | null;

  @Prop({ type: String, required: false, default: null })
  linkedIeWorkbookId!: string | null;

  @Prop({ type: String, required: false, default: null })
  exampleVariant!: string | null;
}

export const EsWorkbookSchema = SchemaFactory.createForClass(EsWorkbook);
