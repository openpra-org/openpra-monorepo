import { Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { NestedModel } from './templateSchema/nested-model.schema';

/**
 * Nested model representing a Bayesian Estimation technical element.
 */
@Schema({ versionKey: false })
export class BayesianEstimation extends NestedModel {}

/** Mongoose document type for BayesianEstimation. */
export type BayesianEstimationDocument = BayesianEstimation & Document;
/** Mongoose schema for BayesianEstimation. */
export const BayesianEstimationSchema =
  SchemaFactory.createForClass(BayesianEstimation);
