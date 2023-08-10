import { Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { NestedModel } from './templateSchema/nested-model.schema';

@Schema({ versionKey: false })
export class MarkovChain extends NestedModel{
}

export type MarkovChainDocument = MarkovChain & Document;
export const MarkovChainSchema = SchemaFactory.createForClass(MarkovChain);