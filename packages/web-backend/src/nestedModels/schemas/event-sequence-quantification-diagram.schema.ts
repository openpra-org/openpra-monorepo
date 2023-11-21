import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";

@Schema({ versionKey: false })
export class EventSequenceQuantificationDiagram extends NestedModel {}

export type EventSequenceQuantificationDiagramDocument =
  EventSequenceQuantificationDiagram & Document;
export const EventSequenceQuantificationDiagramSchema =
  SchemaFactory.createForClass(EventSequenceQuantificationDiagram);
