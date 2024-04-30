import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({
  minimize: false,
  timestamps: {
    createdAt: "created_at",
  },
  versionKey: false,
})
export class InvitedUser {
  @Prop({ required: false })
  id: string;

  @Prop({ required: false })
  firstName: string;

  @Prop({ required: false })
  lastName: string;

  @Prop({ required: false })
  username: string;

  @Prop({ required: false })
  email: string;

  @Prop({ required: false })
  expiry: Date;

  @Prop({ required: false })
  numberOfInvites: number;
}

export type InvitedUserDocument = InvitedUser & Document;
export const InvitedUserSchema = SchemaFactory.createForClass(InvitedUser);
