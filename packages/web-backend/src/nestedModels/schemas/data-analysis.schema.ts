import { Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { NestedModel } from './templateSchema/nested-model.schema';

@Schema({ versionKey: false })
export class DataAnalysis extends NestedModel{
}

export type DataAnalysisDocument = DataAnalysis & Document;
export const DataAnalysisSchema = SchemaFactory.createForClass(DataAnalysis);