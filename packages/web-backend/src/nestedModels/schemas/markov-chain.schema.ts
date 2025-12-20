import { Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { NestedModel } from './templateSchema/nested-model.schema';

/**
 * Nested model representing a Markov Chain technical element.
 */
@Schema({ versionKey: false })
export class MarkovChain extends NestedModel {}

/** Mongoose document type for MarkovChain. */
export type MarkovChainDocument = MarkovChain & Document;
/** Mongoose schema for MarkovChain. */
export const MarkovChainSchema = SchemaFactory.createForClass(MarkovChain);
