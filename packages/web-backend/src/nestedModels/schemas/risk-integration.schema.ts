import { Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose';
import { NestedModel } from './templateSchema/nested-model.schema';

@Schema({ versionKey: false })
export class RiskIntegration extends NestedModel{
}

export type RiskIntegrationDocument = RiskIntegration & Document;
export const RiskIntegrationSchema = SchemaFactory.createForClass(RiskIntegration);