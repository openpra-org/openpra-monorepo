import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type PosWorkbookDocumentDocument = HydratedDocument<PosWorkbookFile> & { createdAt: Date; updatedAt: Date };

@Schema({ timestamps: true, collection: "pos_workbook_documents" })
export class PosWorkbookFile {
  @Prop({ type: String, required: true, unique: true, index: true })
  documentId!: string;

  @Prop({ type: String, required: true, index: true })
  workbookId!: string;

  @Prop({ type: String, required: true })
  filename!: string;

  @Prop({ type: String, required: true })
  mimeType!: string;

  @Prop({ type: Number, required: true })
  size!: number;

  @Prop({ type: String, required: true })
  minioKey!: string;

  @Prop({ type: String, required: true })
  uploadedBy!: string;

  @Prop({ type: String, default: "" })
  notes!: string;
}

export const PosWorkbookFileSchema = SchemaFactory.createForClass(PosWorkbookFile);
