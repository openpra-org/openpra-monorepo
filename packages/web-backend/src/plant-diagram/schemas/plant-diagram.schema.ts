import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({
  minimize: false,
  _id: true,
  versionKey: false,
  toJSON: {
    transform: function (_doc, ret) {
      delete ret._id;
    },
  },
})
export class PlantDiagram {
  @Prop({ required: false })
  id: number;

  @Prop({ required: false })
  typedModelId: number;

  @Prop()
  title: string;

  @Prop({ default: "" })
  description: string;

  @Prop({ default: "PID" })
  diagramType: string;

  @Prop({ type: [Object], default: [] })
  nodes: {
    id: string;
    type: string;
    position: { x: number; y: number };
    data: {
      label: string;
      tagNumber: string;
      symbolType: string;
      description: string;
      service: string;
      instrumentCode: string;
      properties: Record<string, string>;
    };
  }[];

  @Prop({ type: [Object], default: [] })
  edges: {
    id: string;
    source: string;
    target: string;
    sourceHandle: string | null;
    targetHandle: string | null;
    type: string;
    data: { lineType: string; label: string };
  }[];

  @Prop({ type: Object, default: { x: 0, y: 0, zoom: 1 } })
  viewport: { x: number; y: number; zoom: number };
}

export const PlantDiagramSchema = SchemaFactory.createForClass(PlantDiagram);
export type PlantDiagramDocument = PlantDiagram & Document;
