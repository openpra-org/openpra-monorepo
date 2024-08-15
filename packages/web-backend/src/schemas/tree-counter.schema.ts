import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ versionKey: false })
export class NestedCounter {
  @Prop({ required: false })
  _id?: string;

  @Prop({ required: false, unique: true })
  seq?: number;
}

export type NestedCounterDocument = NestedCounter & Document;
export const NestedCounterSchema = SchemaFactory.createForClass(NestedCounter);
