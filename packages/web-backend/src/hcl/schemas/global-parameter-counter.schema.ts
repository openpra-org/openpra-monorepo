import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ versionKey: false })
export class GlobalParameterCounter {
  @Prop()
  _id: string;

  @Prop({ unique: true })
  seq: number;
}

export type GlobalParameterCounterDocument = GlobalParameterCounter & Document;
export const GlobalParameterCounterSchema = SchemaFactory.createForClass(GlobalParameterCounter);
