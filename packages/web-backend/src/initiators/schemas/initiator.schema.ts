import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ versionKey: false })
export class Initiator {
  @Prop({ unique: true })
  name: string;

  @Prop()
  group: string[];
}

export type InitiatorDocument = Initiator & Document;
export const InitiatorSchema = SchemaFactory.createForClass(Initiator);
