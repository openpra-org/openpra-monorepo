import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({ timestamps: true, collection: "audit_logs" })
export class AuditLog {
  @Prop({ type: String, required: true, index: true })
  entityKind!: "team" | "project";

  @Prop({ type: String, required: true, index: true })
  entityId!: string;

  @Prop({ type: String, required: true })
  action!: string;

  @Prop({ type: String, required: true })
  actorUsername!: string;

  @Prop({ type: String, default: "" })
  summary!: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
