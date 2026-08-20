import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import type { TeamVisibility } from "interfaces-shared-types";

export interface TeamInvite {
  username: string;
  invitedBy: string;
  expiresAt: Date;
}

export type TeamDocument = HydratedDocument<Team>;

@Schema({ timestamps: true, collection: "teams" })
export class Team {
  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, default: "" })
  organization!: string;

  @Prop({ type: String, default: null, index: true })
  organizationId!: string | null;

  @Prop({ type: String, default: "" })
  description!: string;

  @Prop({ type: String, required: true, index: true })
  visibility!: TeamVisibility;

  @Prop({ type: String, required: true, index: true })
  adminUsername!: string;

  @Prop({ type: [String], default: [], index: true })
  members!: string[];

  @Prop({ type: [String], default: [], index: true })
  leads!: string[];

  @Prop({
    type: [{ username: { type: String, required: true }, invitedBy: { type: String, default: "" }, expiresAt: { type: Date, required: true }, _id: false }],
    default: [],
  })
  invites!: TeamInvite[];

  @Prop({ type: String, default: null })
  avatarKey!: string | null;
}

export const TeamSchema = SchemaFactory.createForClass(Team);
