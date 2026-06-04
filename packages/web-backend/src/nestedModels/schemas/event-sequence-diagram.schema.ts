import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";
@Schema({ versionKey: false })
export class EventSequenceDiagram extends NestedModel {}
export type EventSequenceDiagramDocument = EventSequenceDiagram & Document;
export const EventSequenceDiagramSchema = SchemaFactory.createForClass(EventSequenceDiagram);
