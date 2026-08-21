import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import {
  type MethodModelSchemaVersion,
  type MethodType,
  type NewlyDevelopedMethodModel,
  MethodTypeSchema,
} from "interfaces-shared-types/newly-developed-methods";

type MethodModelRecordDocument = HydratedDocument<MethodModelRecord>;

@Schema({ collection: "method_models", id: false, versionKey: false })
class MethodModelRecord {
  @Prop({ type: String, required: true, unique: true, index: true })
  id!: string;

  @Prop({ type: String, required: true, index: true })
  projectId!: string;

  @Prop({ type: String, required: true, enum: MethodTypeSchema.options, index: true })
  methodType!: MethodType;

  @Prop({ type: String, required: true })
  code!: string;

  @Prop({ type: String, required: true })
  normalizedCode!: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, required: true })
  description!: string;

  @Prop({ type: String, required: true })
  schemaVersion!: MethodModelSchemaVersion;

  @Prop({ type: Number, required: true })
  revision!: number;

  @Prop({ type: String, required: true })
  createdBy!: string;

  @Prop({ type: Date, required: true })
  createdAt!: Date;

  @Prop({ type: String, required: true })
  updatedBy!: string;

  @Prop({ type: Date, required: true })
  updatedAt!: Date;

  @Prop({ type: Object, required: true })
  model!: NewlyDevelopedMethodModel;
}

const MethodModelRecordSchema = SchemaFactory.createForClass(MethodModelRecord);

MethodModelRecordSchema.index({ projectId: 1, methodType: 1, updatedAt: -1 });
MethodModelRecordSchema.index(
  { projectId: 1, methodType: 1, normalizedCode: 1 },
  { unique: true },
);

export { MethodModelRecord, MethodModelRecordSchema };
export type { MethodModelRecordDocument };
