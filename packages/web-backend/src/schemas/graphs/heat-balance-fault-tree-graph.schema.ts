import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { BaseGraph } from "./base-graph.schema";

@Schema({ versionKey: false })
export class HeatBalanceFaultTreeGraph extends BaseGraph {
  @Prop({ type: String, unique: true, required: true })
  heatBalanceFaultTreeId: string;
}

export type HeatBalanceFaultTreeGraphDocument = HeatBalanceFaultTreeGraph & Document;
export const HeatBalanceFaultTreeGraphSchema =
  SchemaFactory.createForClass(HeatBalanceFaultTreeGraph);
