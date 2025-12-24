import { Prop } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { GraphNode } from 'shared-types/src/lib/types/reactflowGraph/GraphNode';
import { GraphEdge } from 'shared-types/src/lib/types/reactflowGraph/GraphEdge';
import { Document } from 'mongoose';

/**
 * Base shape for persisted graph documents.
 * Extended by specific graph schemas like EventTreeGraph and FaultTreeGraph.
 */
export class BaseGraph {
  @Prop({ unique: true, required: true })
  id: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId })
  _id: mongoose.Types.ObjectId;

  @Prop()
  nodes: GraphNode<object>[];

  @Prop()
  edges: GraphEdge<object>[];
}
/**
 * Mongoose document type for BaseGraph derivatives.
 */
export type BaseGraphDocument = BaseGraph & Document;
