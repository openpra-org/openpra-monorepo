import { Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { NestedModel } from './templateSchema/nested-model.schema';

/**
 * Nested model representing a Radiological Consequence Analysis technical element.
 */
@Schema({ versionKey: false })
export class RadiologicalConsequenceAnalysis extends NestedModel {}

/** Mongoose document type for RadiologicalConsequenceAnalysis. */
export type RadiologicalConsequenceAnalysisDocument =
  RadiologicalConsequenceAnalysis & Document;
/** Mongoose schema for RadiologicalConsequenceAnalysis. */
export const RadiologicalConsequenceAnalysisSchema =
  SchemaFactory.createForClass(RadiologicalConsequenceAnalysis);
