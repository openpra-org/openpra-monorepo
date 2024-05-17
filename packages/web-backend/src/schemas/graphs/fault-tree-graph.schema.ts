import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { BaseGraph } from "./base-graph.schema";

@Schema({ versionKey: false })
export class FaultTreeGraph extends BaseGraph {
  @Prop({ type: String, unique: true, required: true })
  faultTreeId: string;
}

export type FaultTreeGraphDocument = FaultTreeGraph & Document;
export const FaultTreeGraphSchema = SchemaFactory.createForClass(FaultTreeGraph);
