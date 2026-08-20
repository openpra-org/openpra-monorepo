import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type UsageEventDocument = HydratedDocument<UsageEvent> & { createdAt: Date };

export type UsageEventType =
  | "account_created"
  | "project_created"
  | "workbook_created"
  | "feature_used"
  | "element_time"
  | "campaign_open"
  | "admin_role_changed";

@Schema({ timestamps: true, collection: "usage_events" })
export class UsageEvent {
  @Prop({ type: String, required: true, index: true })
  type!: UsageEventType;

  @Prop({ type: String, default: null, index: true })
  userId!: string | null;

  @Prop({ type: String, default: null, index: true })
  username!: string | null;

  @Prop({ type: String, default: null, index: true })
  sessionId!: string | null;

  @Prop({ type: String, default: null, index: true })
  projectId!: string | null;

  @Prop({ type: String, default: null, index: true })
  workbookId!: string | null;

  @Prop({ type: String, default: null, index: true })
  technicalElement!: string | null;

  @Prop({ type: String, default: null, index: true })
  projectType!: string | null;

  @Prop({ type: String, default: null, index: true })
  reactorType!: string | null;

  @Prop({ type: String, default: null, index: true })
  feature!: string | null;

  @Prop({ type: Number, default: 0 })
  activeMs!: number;

  @Prop({ type: Number, default: 0 })
  idleMs!: number;

  @Prop({ type: String, default: null, index: true })
  campaignId!: string | null;

  @Prop({ type: Date, required: true })
  occurredAt!: Date;
}

export const UsageEventSchema = SchemaFactory.createForClass(UsageEvent);
UsageEventSchema.index({ occurredAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });
UsageEventSchema.index({ type: 1, occurredAt: -1 });
UsageEventSchema.index({ username: 1, occurredAt: -1 });
