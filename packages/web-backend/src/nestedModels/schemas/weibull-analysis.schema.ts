import { Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { NestedModel } from './templateSchema/nested-model.schema';

/**
 * Nested model representing a Weibull Analysis technical element.
 */
@Schema({ versionKey: false })
export class WeibullAnalysis extends NestedModel {}

/** Mongoose document type for WeibullAnalysis. */
export type WeibullAnalysisDocument = WeibullAnalysis & Document;
/** Mongoose schema for WeibullAnalysis. */
export const WeibullAnalysisSchema =
  SchemaFactory.createForClass(WeibullAnalysis);
