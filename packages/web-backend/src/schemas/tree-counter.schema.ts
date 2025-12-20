import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Counter document used to generate sequential ids for nested models/trees.
 */
@Schema({ versionKey: false })
export class NestedCounter {
  @Prop()
  _id: string;

  @Prop({ unique: true })
  seq: number;
}
/**
 * Mongoose document type for NestedCounter.
 */
export type NestedCounterDocument = NestedCounter & Document;
/**
 * Mongoose schema for NestedCounter.
 */
export const NestedCounterSchema = SchemaFactory.createForClass(NestedCounter);
