import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { BaseGraph } from "./base-graph.schema";

@Schema({ versionKey: false })
export class EventTreeGraph extends BaseGraph {
  @Prop({ type: String, unique: true, required: true })
  eventTreeId: string;
}

export type EventTreeGraphDocument = EventTreeGraph & Document;
export const EventTreeGraphSchema =
  SchemaFactory.createForClass(EventTreeGraph);
