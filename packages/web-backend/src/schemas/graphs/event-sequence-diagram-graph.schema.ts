import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { BaseGraph } from "./base-graph.schema";

@Schema({ versionKey: false })
export class EventSequenceDiagramGraph extends BaseGraph {
  @Prop({ type: String, unique: true, required: true })
  eventSequenceId: string;
}

export type EventSequenceDiagramGraphDocument = EventSequenceDiagramGraph & Document;
export const EventSequenceDiagramGraphSchema = SchemaFactory.createForClass(EventSequenceDiagramGraph);
