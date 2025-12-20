import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { TypedModel } from './templateSchema/typed-model.schema';

/**
 * Typed model representing Internal Hazards projects.
 * Extends the common TypedModel structure.
 */
@Schema({ versionKey: false })
export class InternalHazards extends TypedModel {
  @Prop({ default: [] })
  parentIds: number[];
}

/** Mongoose document type for InternalHazards. */
export type InternalHazardsDocument = InternalHazards & Document;
/** Mongoose schema for InternalHazards. */
export const InternalHazardsSchema =
  SchemaFactory.createForClass(InternalHazards);
