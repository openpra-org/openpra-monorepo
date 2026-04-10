import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import * as mongoose from "mongoose";
import { Document } from "mongoose";

/**
 * Graph persistence model for Fault Tree diagrams, stored in OpenPRA MEF format.
 *
 * Nodes are stored as a free-form map keyed by the node's uuid.
 * Connectivity is embedded in each node's `inputs` array (MEF convention);
 * no separate edge collection is required.
 */
@Schema({ versionKey: false })
export class FaultTreeGraph {
  @Prop({ type: String, unique: true, required: true })
  id: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId })
  _id: mongoose.Types.ObjectId;

  /** Links this graph document to the NestedModel fault tree record */
  @Prop({ type: String, unique: true, required: true })
  faultTreeId: string;

  /** uuid of the root / top-event node within the nodes map */
  @Prop({ type: String, required: false })
  topEventId: string;

  /**
   * MEF node map: key = node uuid, value = FaultTreeNode.
   * Stored as Mixed so Mongoose does not enforce a fixed sub-schema.
   */
  @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
  nodes: Record<string, object>;
}

/** Mongoose document type for FaultTreeGraph. */
export type FaultTreeGraphDocument = FaultTreeGraph & Document;
/** Mongoose schema for FaultTreeGraph. */
export const FaultTreeGraphSchema = SchemaFactory.createForClass(FaultTreeGraph);
