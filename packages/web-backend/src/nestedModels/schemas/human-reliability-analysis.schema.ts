import { Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { NestedModel } from './templateSchema/nested-model.schema';

/**
 * Nested model representing a Human Reliability Analysis technical element.
 */
@Schema({ versionKey: false })
export class HumanReliabilityAnalysis extends NestedModel {}

/** Mongoose document type for HumanReliabilityAnalysis. */
export type HumanReliabilityAnalysisDocument = HumanReliabilityAnalysis &
  Document;
/** Mongoose schema for HumanReliabilityAnalysis. */
export const HumanReliabilityAnalysisSchema = SchemaFactory.createForClass(
  HumanReliabilityAnalysis,
);
