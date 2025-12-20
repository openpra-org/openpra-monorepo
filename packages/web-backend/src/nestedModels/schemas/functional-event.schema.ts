import { Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { NestedModel } from './templateSchema/nested-model.schema';

/**
 * Nested model representing a Functional Event technical element.
 */
@Schema({ versionKey: false })
export class FunctionalEvent extends NestedModel {}

/** Mongoose document type for FunctionalEvent. */
export type FunctionalEventDocument = FunctionalEvent & Document;
/** Mongoose schema for FunctionalEvent. */
export const FunctionalEventSchema =
  SchemaFactory.createForClass(FunctionalEvent);
