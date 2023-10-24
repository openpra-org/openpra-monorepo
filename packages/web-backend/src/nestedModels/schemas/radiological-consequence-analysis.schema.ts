import { Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { NestedModel } from './templateSchema/nested-model.schema';

@Schema({ versionKey: false })
export class RadiologicalConsequenceAnalysis extends NestedModel{
}

export type RadiologicalConsequenceAnalysisDocument = RadiologicalConsequenceAnalysis & Document;
export const RadiologicalConsequenceAnalysisSchema = SchemaFactory.createForClass(RadiologicalConsequenceAnalysis);