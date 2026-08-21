import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import {
  type AnalysisEngineMetadata,
  type AnalysisRunSchemaVersion,
  type AnalysisRunStatus,
  type AnalysisRunFailure,
  type MethodAnalysisResult,
  type MethodModelExecuteRequest,
  type MethodType,
  type NewlyDevelopedMethodModel,
  AnalysisRunStatusSchema,
  MethodTypeSchema,
} from "interfaces-shared-types/newly-developed-methods";

type AnalysisRunRecordDocument = HydratedDocument<AnalysisRunRecord>;

@Schema({ collection: "method_analysis_runs", id: false, versionKey: false })
class AnalysisRunRecord {
  @Prop({ type: String, required: true, unique: true, index: true })
  id!: string;

  @Prop({ type: String, required: true, index: true })
  projectId!: string;

  @Prop({ type: String, required: true, index: true })
  modelId!: string;

  @Prop({ type: Number, required: true })
  modelRevision!: number;

  @Prop({ type: String, required: true, enum: MethodTypeSchema.options, index: true })
  methodType!: MethodType;

  @Prop({ type: String, required: true, enum: AnalysisRunStatusSchema.options, index: true })
  status!: AnalysisRunStatus;

  @Prop({ type: String, required: true })
  schemaVersion!: AnalysisRunSchemaVersion;

  @Prop({ type: String, required: true })
  requestedBy!: string;

  @Prop({ type: Date, required: true })
  requestedAt!: Date;

  @Prop({ type: Date, default: null })
  startedAt!: Date | null;

  @Prop({ type: Date, default: null })
  completedAt!: Date | null;

  @Prop({ type: Object, default: null })
  engine!: AnalysisEngineMetadata | null;

  @Prop({ type: Object, default: null })
  failure!: AnalysisRunFailure | null;

  @Prop({ type: Object, required: true })
  request!: MethodModelExecuteRequest;

  @Prop({ type: [Object], required: true })
  modelSnapshots!: NewlyDevelopedMethodModel[];

  @Prop({ type: Object, required: true })
  resources!: Record<string, unknown>;

  @Prop({ type: Object, default: null })
  result!: MethodAnalysisResult | null;
}

const AnalysisRunRecordSchema = SchemaFactory.createForClass(AnalysisRunRecord);

AnalysisRunRecordSchema.index({ projectId: 1, modelId: 1, requestedAt: -1 });

export { AnalysisRunRecord, AnalysisRunRecordSchema };
export type { AnalysisRunRecordDocument };
