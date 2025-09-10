import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ versionKey: false })
export class FaultTree extends Document {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  modelId: string;

  @Prop({
    type: {
      nodes: { type: [Object], required: true },
      edges: { type: [Object], required: true },
    },
    required: true,
  })
  graph: {
    nodes: object[];
    edges: object[];
  };
}

export type FaultTreeDocument = FaultTree & Document;
export const FaultTreeSchema = SchemaFactory.createForClass(FaultTree);