import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";

/**
 * Nested model representing an Event Sequence Quantification Diagram technical element.
 */
@Schema({ versionKey: false })
export class EventSequenceQuantificationDiagram extends NestedModel {}

/** Mongoose document type for EventSequenceQuantificationDiagram. */
export type EventSequenceQuantificationDiagramDocument = EventSequenceQuantificationDiagram & Document;
/** Mongoose schema for EventSequenceQuantificationDiagram. */
export const EventSequenceQuantificationDiagramSchema = SchemaFactory.createForClass(
  EventSequenceQuantificationDiagram,
);
