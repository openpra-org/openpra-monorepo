import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ versionKey: false })
export class InitiatingEventGroup {
  @Prop({ unique: true })
  name: string;

  @Prop()
  initiatingEvents: string[];
}

export type InitiatingEventGroupDocument = InitiatingEventGroup & Document;
export const InitiatingEventGroupSchema = SchemaFactory.createForClass(InitiatingEventGroup);
