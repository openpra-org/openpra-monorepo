import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { Label, LabelSchema } from "../../../schemas/label.schema";

export interface TypedModelJSON {
  label: Label;
  users: number[];
}

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

  @Prop()
  createdAt: Date;

  @Prop()
  lastModifiedAt: Date;
}

export type TypedModelDocument = TypedModel & Document;
export const TypedModelSchema = SchemaFactory.createForClass(TypedModel);
