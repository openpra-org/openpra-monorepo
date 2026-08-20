import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type CampaignDocument = HydratedDocument<Campaign> & { createdAt: Date; updatedAt: Date };

@Schema({ timestamps: true, collection: "analytics_campaigns" })
export class Campaign {
  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  token!: string;

  @Prop({ type: String, required: true, index: true })
  createdBy!: string;

  @Prop({ type: String, default: "/auth?signup=1" })
  destinationPath!: string;

  @Prop({ type: Boolean, default: true, index: true })
  active!: boolean;

  @Prop({ type: Date, default: null, index: true })
  expiresAt!: Date | null;

  @Prop({ type: Number, default: 0 })
  openCount!: number;

  @Prop({ type: Number, default: 0 })
  uniqueOpenCount!: number;

  @Prop({ type: Number, default: 0 })
  signupCount!: number;

  @Prop({ type: Date, default: null })
  lastOpenedAt!: Date | null;
}

export const CampaignSchema = SchemaFactory.createForClass(Campaign);
