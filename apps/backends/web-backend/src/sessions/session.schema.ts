import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type SessionDocument = HydratedDocument<Session>;

@Schema({ timestamps: true, collection: "sessions" })
export class Session {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, unique: true, index: true })
  jti!: string;

  @Prop({ default: "" })
  userAgent!: string;

  @Prop({ default: "" })
  ip!: string;

  @Prop({ type: Date, default: () => new Date() })
  lastSeenAt!: Date;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
