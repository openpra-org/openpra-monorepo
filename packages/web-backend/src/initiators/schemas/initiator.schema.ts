import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ versionKey: false, timestamps: true })
export class Initiator {
  @Prop({ unique: true })
  name: string;

  @Prop()
  group: string[];

  @Prop()
  sources: string[];

  @Prop()
  state: string;

  @Prop({default: new Map()})
  customAttributes: Map<string, string | number>
}

export type InitiatorDocument = Initiator & Document;
export const InitiatorSchema = SchemaFactory.createForClass(Initiator);
