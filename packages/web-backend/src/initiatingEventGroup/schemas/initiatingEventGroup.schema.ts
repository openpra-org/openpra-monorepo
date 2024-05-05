import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ versionKey: false, timestamps: true})
export class InitiatingEventGroup {
  @Prop({ unique: true })
  name: string;

  @Prop()
  initiatingEvents: string[];

  @Prop()
  state: string;
}

export type InitiatingEventGroupDocument = InitiatingEventGroup & Document;
export const InitiatingEventGroupSchema =
  SchemaFactory.createForClass(InitiatingEventGroup);
