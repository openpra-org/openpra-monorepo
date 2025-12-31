import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ versionKey: false })
/**
 * Simple counter used to generate incremental ids for global parameters.
 */
export class GlobalParameterCounter {
  @Prop()
  _id: string;

  @Prop({ unique: true })
  seq: number;
}

export type GlobalParameterCounterDocument = GlobalParameterCounter & Document;
/** Mongoose schema for GlobalParameterCounter. */
export const GlobalParameterCounterSchema = SchemaFactory.createForClass(GlobalParameterCounter);
