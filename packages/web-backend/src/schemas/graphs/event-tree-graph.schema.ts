import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { Document } from "mongoose";
import { GraphNode } from "shared-types/src/lib/types/reactflowGraph/GraphNode";
import { GraphEdge } from "shared-types/src/lib/types/reactflowGraph/GraphEdge";
import { EventTreeData } from "shared-types/src/lib/types/reactflowGraph/graphData/EventTreeData";
import type { FunctionalEvent, EventTreeSequence } from "mef-types/lib/event-sequence-analysis/event-sequence-analysis";

/**
 * Graph persistence model for Event Tree diagrams.
 * Stores node/edge state and a unique link to its EventTree entity.
 */
@Schema({ versionKey: false })
export class EventTreeGraph {
  @Prop({ unique: true, required: true })
  id: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId })
  _id: mongoose.Types.ObjectId;

  @Prop()
  nodes: GraphNode<EventTreeData>[];

  @Prop()
  edges: GraphEdge<EventTreeData>[];

  @Prop({ type: String, unique: true, required: true })
  eventTreeId: string;

  @Prop({ type: String })
  initiatingEventId?: string;

  @Prop({ type: mongoose.Schema.Types.Mixed })
  functionalEvents?: Record<string, FunctionalEvent>;

  @Prop({ type: mongoose.Schema.Types.Mixed })
  sequences?: Record<string, EventTreeSequence>;
}
/**
 * Mongoose document type for EventTreeGraph.
 */
export type EventTreeGraphDocument = EventTreeGraph & Document;
/**
 * Mongoose schema for EventTreeGraph.
 */
export const EventTreeGraphSchema = SchemaFactory.createForClass(EventTreeGraph);
