import { Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { NestedModel } from './templateSchema/nested-model.schema';

@Schema({ versionKey: false })
export class WeibullAnalysis extends NestedModel{
}

export type WeibullAnalysisDocument = WeibullAnalysis & Document;
export const WeibullAnalysisSchema = SchemaFactory.createForClass(WeibullAnalysis);