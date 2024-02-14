import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { Label, LabelSchema } from "../../../schemas/label.schema";

export type TypedModelJSON = {
  label: Label;
  users: number[];
};

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

export type TypedModelDocument = TypedModel & Document;
export const TypedModelSchema = SchemaFactory.createForClass(TypedModel);
