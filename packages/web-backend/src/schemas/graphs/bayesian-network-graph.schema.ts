import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { BaseGraph } from "./base-graph.schema";

@Schema({ versionKey: false })
export class BayesianNetworkGraph extends BaseGraph {
  @Prop({ type: String, unique: true, required: true })
  bayesianNetworkId: string;
}

export type BayesianNetworkGraphDocument = BayesianNetworkGraph & Document;
export const BayesianNetworkGraphSchema = SchemaFactory.createForClass(BayesianNetworkGraph);
