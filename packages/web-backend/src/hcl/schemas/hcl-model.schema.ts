import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { Action, ActionSchema } from "./action.schema";

@Schema({ _id: false, versionKey: false })
class Model_Data {
  @Prop({ required: false })
  bayesian_networks: number[];

  @Prop({ required: false })
  event_trees: number[];

  @Prop({ required: false })
  fault_trees: number[];

  @Prop({ required: false })
  init_events: number[];
}

const ModelDataSchema = SchemaFactory.createForClass(Model_Data);

@Schema({ minimize: false, _id: false, versionKey: false })
class Instances {}

const InstancesSchema = SchemaFactory.createForClass(Instances);

@Schema({
  timestamps: {
    createdAt: "date_created",
    updatedAt: "date_modified",
  },
  toJSON: {
    transform: function (doc, ret) {
      delete ret._id;
    },
  },
  versionKey: false,
})
export class HclModel {
  @Prop({ required: false })
  id: number;

  @Prop({ required: false })
  creator: number;

  @Prop()
  title: string;

  @Prop()
  description: string;

  @Prop()
  assigned_users: number[];

  @Prop({ required: false })
  overview_tree: number;

  @Prop({ default: "CO", required: false })
  tag: string;

  @Prop({ required: false })
  path: string;

  @Prop({ default: "hcl", required: false })
  type: string;

  @Prop({ type: ModelDataSchema, required: false })
  model_data: Model_Data;

  @Prop({ type: [{ type: ActionSchema }], required: false })
  actions: Action[];

  @Prop({ default: [], required: false })
  results: string[];

  @Prop({ type: [{ type: InstancesSchema }], default: [], required: false })
  instances: Instances[];
}

export type HclModelDocument = HclModel & Document;
export const HclModelSchema = SchemaFactory.createForClass(HclModel);
