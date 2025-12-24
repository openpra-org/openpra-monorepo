import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Label, LabelSchema } from '../../../schemas/label.schema';

/**
 * JSON shape for the embedded TypedModel payload returned by APIs.
 */
export interface TypedModelJSON {
  label: Label;
  users: number[];
}

/**
 * Common base class for typed model documents embedded in collections.
 * Includes id, label, users, and arrays of nested model references.
 */
@Schema({ _id: false, versionKey: false })
export class TypedModel {
  @Prop({ required: true, unique: true })
  id: number;

  @Prop({ type: LabelSchema, required: false })
  label: Label;

  @Prop()
  users: number[];

  @Prop()
  initiatingEvents: number[];

  @Prop()
  eventSequenceDiagrams: number[];

  @Prop()
  eventSequenceAnalysis: number[];

  @Prop()
  functionalEvents: number[];

  @Prop()
  eventTrees: number[];

  @Prop()
  faultTrees: number[];

  @Prop()
  bayesianNetworks: number[];

  @Prop()
  markovChains: number[];

  @Prop()
  bayesianEstimations: number[];

  @Prop()
  weibullAnalysis: number[];
}

/** Mongoose document type for the embedded TypedModel. */
export type TypedModelDocument = TypedModel & Document;
/** Mongoose schema for the embedded TypedModel. */
export const TypedModelSchema = SchemaFactory.createForClass(TypedModel);
