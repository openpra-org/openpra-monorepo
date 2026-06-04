import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import * as mongoose from "mongoose";
import { Document } from "mongoose";
@Schema({ versionKey: false })
export class FaultTreeGraph {
  @Prop({ type: String, unique: true, required: true })
  id: string;
  @Prop({ type: mongoose.Schema.Types.ObjectId })
  _id: mongoose.Types.ObjectId;
  @Prop({ type: String, unique: true, required: true })
  faultTreeId: string;
  @Prop({ type: String, required: false })
  topEventId: string;
  @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
  nodes: Record<string, object>;
}
export type FaultTreeGraphDocument = FaultTreeGraph & Document;
export const FaultTreeGraphSchema = SchemaFactory.createForClass(FaultTreeGraph);
