import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type MsWorkbookDocumentDocument = HydratedDocument<MsWorkbookFile> & { createdAt: Date; updatedAt: Date };

@Schema({ timestamps: true, collection: "ms_workbook_documents" })
export class MsWorkbookFile {
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
}

export const MsWorkbookFileSchema = SchemaFactory.createForClass(MsWorkbookFile);
