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
  id!: number;

  @Prop({ type: LabelSchema, required: false })
  label?: Label;

  @Prop({ required: false })
  users?: number[];

  @Prop({ required: false })
  initiatingEvents?: number[];

  @Prop({ required: false })
  eventSequenceDiagrams?: number[];

  @Prop({ required: false })
  eventSequenceAnalysis?: number[];

  @Prop({ required: false })
  functionalEvents?: number[];

  @Prop({ required: false })
  eventTrees?: number[];

  @Prop({ required: false })
  faultTrees?: number[];

  @Prop({ required: false })
  bayesianNetworks?: number[];

  @Prop({ required: false })
  markovChains?: number[];

  @Prop({ required: false })
  bayesianEstimations?: number[];

  @Prop({ required: false })
  weibullAnalysis?: number[];
}

export type TypedModelDocument = TypedModel & Document;
export const TypedModelSchema = SchemaFactory.createForClass(TypedModel);
