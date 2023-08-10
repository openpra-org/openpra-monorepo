import { Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { NestedModel } from './templateSchema/nested-model.schema';

@Schema({ versionKey: false })
export class BayesianEstimation extends NestedModel{
}

export type BayesianEstimationDocument = BayesianEstimation & Document;
export const BayesianEstimationSchema = SchemaFactory.createForClass(BayesianEstimation);