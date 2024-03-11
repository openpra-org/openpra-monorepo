import { Prop } from "@nestjs/mongoose";
import * as mongoose from "mongoose";
import { GraphNode } from "shared-types/src/lib/types/reactflowGraph/GraphNode";
import { GraphEdge } from "shared-types/src/lib/types/reactflowGraph/GraphEdge";
import { Document } from "mongoose";

export class BaseGraph {
  @Prop({ unique: true, required: true })
  id: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId })
  _id: mongoose.Types.ObjectId;

  @Prop()
  nodes: GraphNode<object>[];

  @Prop()
  edges: GraphEdge[];
}
export type BaseGraphDocument = BaseGraph & Document;
