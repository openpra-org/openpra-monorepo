import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import type { WorkbookStatus } from "interfaces-shared-types";
import type { WorkbookSignedAgainst } from "interfaces-shared-types/workbooks";

export type WorkbookDocument = HydratedDocument<Workbook> & { createdAt: Date; updatedAt: Date };

@Schema({ timestamps: true, collection: "workbooks" })
export class Workbook {
  @Prop({ type: String, required: true, index: true })
  projectId!: string;

  @Prop({ type: String, required: true, index: true })
  elementCode!: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, default: "draft" })
  status!: WorkbookStatus;

  @Prop({ type: Boolean })
  statusSynced?: boolean;

  @Prop({ type: Number, default: 1 })
  version!: number;

  @Prop({ type: String, required: true })
  ownerUsername!: string;

  @Prop({ type: String, required: true })
  ownerFullName!: string;

  @Prop({ type: Object, default: null })
  signedAgainst?: WorkbookSignedAgainst | null;
}

export const WorkbookSchema = SchemaFactory.createForClass(Workbook);
