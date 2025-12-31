import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { BaseGraph } from "./base-graph.schema";

/**
 * Graph persistence model for Fault Tree diagrams.
 * Extends BaseGraph and references the associated FaultTree id.
 */
@Schema({ versionKey: false })
export class FaultTreeGraph extends BaseGraph {
  @Prop({ type: String, unique: true, required: true })
  faultTreeId: string;
}
/**
 * Mongoose document type for FaultTreeGraph.
 */
export type FaultTreeGraphDocument = FaultTreeGraph & Document;
/**
 * Mongoose schema for FaultTreeGraph.
 */
export const FaultTreeGraphSchema = SchemaFactory.createForClass(FaultTreeGraph);
