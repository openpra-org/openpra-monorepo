import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { GraphNode } from "shared-types/src/lib/types/faultTreeGraph/GraphNode";
import { GraphEdge } from "shared-types/src/lib/types/faultTreeGraph/GraphEdge";


@Schema({ _id: false, versionKey: false })
export class FaultTreeGraph {
  @Prop()
  id: string

  @Prop({ type: String, unique: true, required: true })
  faultTreeId: string;

  @Prop()
  nodes: GraphNode[];

  @Prop()
  edges: GraphEdge[];
}

export type FaultTreeGraphDocument = FaultTreeGraph & Document;
export const FaultTreeGraphSchema =
  SchemaFactory.createForClass(FaultTreeGraph)
