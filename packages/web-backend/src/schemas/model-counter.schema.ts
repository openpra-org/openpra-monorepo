import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

/**
 * Counter document used to generate sequential ids for top-level models.
 */
@Schema({ versionKey: false })
export class ModelCounter {
  @Prop()
  _id: string;

  @Prop({ unique: true })
  seq: number;
}
/**
 * Mongoose document type for ModelCounter.
 */
export type ModelCounterDocument = ModelCounter & Document;
/**
 * Mongoose schema for ModelCounter.
 */
export const ModelCounterSchema = SchemaFactory.createForClass(ModelCounter);
