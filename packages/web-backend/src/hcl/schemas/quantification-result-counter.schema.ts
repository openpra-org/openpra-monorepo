import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ versionKey: false })
export class QuantificationResultCounter {
  @Prop()
  _id: string;

  @Prop({ unique: true })
  seq: number;
}

export type QuantificationResultCounterDocument = QuantificationResultCounter & Document;
export const QuantificationResultCounterSchema = SchemaFactory.createForClass(QuantificationResultCounter);
