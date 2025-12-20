import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { TypedModel } from './templateSchema/typed-model.schema';

/**
 * Typed model representing Full Scope projects.
 * Extends the common TypedModel structure.
 */
@Schema({ versionKey: false })
export class FullScope extends TypedModel {
  @Prop({ default: [] })
  parentIds: number[];
}

/** Mongoose document type for FullScope. */
export type FullScopeDocument = FullScope & Document;
/** Mongoose schema for FullScope. */
export const FullScopeSchema = SchemaFactory.createForClass(FullScope);
