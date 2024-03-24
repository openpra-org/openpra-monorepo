import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { Document } from "mongoose";
import { GraphNode } from "shared-types/src/lib/types/reactflowGraph/GraphNode";
import { GraphEdge } from "shared-types/src/lib/types/reactflowGraph/GraphEdge";
import { EventTreeData } from "shared-types/src/lib/types/reactflowGraph/graphData/EventTreeData";

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
}

export type EventTreeGraphDocument = EventTreeGraph & Document;
export const EventTreeGraphSchema =
  SchemaFactory.createForClass(EventTreeGraph);
