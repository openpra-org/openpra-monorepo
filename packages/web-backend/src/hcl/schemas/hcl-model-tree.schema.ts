import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { Document } from "mongoose";
import { FaultTree } from "../../nestedModels/schemas/fault-tree.schema";
import { EventSequenceDiagram } from "../../nestedModels/schemas/event-sequence-diagram.schema";
import { BayesianNetwork } from "../../nestedModels/schemas/bayesian-network.schema";

@Schema({ _id: false, versionKey: false })
class Model {
  @Prop({ required: false })
  id: number;

  @Prop({ required: false })
  type: string;

  @Prop({ required: false })
  model_tag: string;
}

const ModelSchema = SchemaFactory.createForClass(Model);

@Schema({
  timestamps: {
    createdAt: "date_created",
    updatedAt: "date_modified",
  },
  toJSON: {
    transform: function (doc, ret) {
      delete ret._id;
      delete ret.__v;
      delete ret.tree_name;
      delete ret.model_id;
    },
  },
  discriminatorKey: "tree_name",
})
export class HclModelTree {
  @Prop({
    type: String,
    required: false,
    enum: [FaultTree.name, EventSequenceDiagram.name, BayesianNetwork.name],
  })
  tree_name: string;

  @Prop({ required: false })
  model_id: number;

  @Prop({ required: false, unique: true })
  id: number;

  @Prop()
  title: string;

  @Prop({ required: false })
  creator: number;

  @Prop()
  description: string;

  @Prop({ type: ModelSchema, required: false })
  model: Model;

  @Prop()
  tree_type: string;

  @Prop({ default: false, required: false })
  valid: boolean;

  @Prop({ type: mongoose.Schema.Types.Map })
  tree_data;
}

export type HclModelTreeDocument = HclModelTree & Document;
export const HclModelTreeSchema = SchemaFactory.createForClass(HclModelTree);
