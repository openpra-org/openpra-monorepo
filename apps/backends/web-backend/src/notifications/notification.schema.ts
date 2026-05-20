import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true, collection: "notifications" })
export class Notification {
  @Prop({ type: String, required: true, index: true })
  recipientUsername!: string;

  @Prop({ type: String, required: true })
  type!: string;

  @Prop({ type: String, required: true })
  title!: string;

  @Prop({ type: String, default: "" })
  body!: string;

  @Prop({ type: String, default: null })
  link!: string | null;

  @Prop({ type: String, default: "" })
  actorUsername!: string;

  @Prop({ type: Date, default: null })
  readAt!: Date | null;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
