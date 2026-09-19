import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type RcWorkbookDocumentDocument = HydratedDocument<RcWorkbookFile> & { createdAt: Date; updatedAt: Date };

@Schema({ timestamps: true, collection: "rc_workbook_documents" })
export class RcWorkbookFile {
  @Prop({ type: Boolean, default: false })
  caseArtifactOriginal?: boolean;

  @Prop({ type: Boolean, default: false })
  sourceTermOriginal?: boolean;

  @Prop({ type: Boolean, default: false })
  siteInputOriginal?: boolean;

  @Prop({ type: Boolean, default: false })
  weatherInputOriginal?: boolean;

  @Prop({ type: Boolean, default: false })
  transportInputOriginal?: boolean;

  @Prop({ type: Boolean, default: false })
  doseInputOriginal?: boolean;

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

export const RcWorkbookFileSchema = SchemaFactory.createForClass(RcWorkbookFile);
