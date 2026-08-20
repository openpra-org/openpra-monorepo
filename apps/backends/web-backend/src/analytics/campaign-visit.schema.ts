import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type CampaignVisitDocument = HydratedDocument<CampaignVisit> & { createdAt: Date; updatedAt: Date };

@Schema({ timestamps: true, collection: "analytics_campaign_visits" })
export class CampaignVisit {
  @Prop({ type: String, required: true, index: true })
  campaignId!: string;

  @Prop({ type: String, required: true, index: true })
  visitorId!: string;

  @Prop({ type: Date, required: true })
  firstOpenedAt!: Date;

  @Prop({ type: Date, required: true })
  lastOpenedAt!: Date;

  @Prop({ type: Number, default: 1 })
  openCount!: number;

  @Prop({ type: String, default: null, index: true })
  attributedUsername!: string | null;

  @Prop({ type: Date, default: null })
  attributedAt!: Date | null;
}

export const CampaignVisitSchema = SchemaFactory.createForClass(CampaignVisit);
CampaignVisitSchema.index({ campaignId: 1, visitorId: 1 }, { unique: true });

