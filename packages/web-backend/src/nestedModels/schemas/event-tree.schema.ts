import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";

/**
 * Nested model representing an Event Tree technical element.
 */
@Schema({ versionKey: false })
export class EventTree extends NestedModel {}

/** Mongoose document type for EventTree. */
export type EventTreeDocument = EventTree & Document;
/** Mongoose schema for EventTree. */
export const EventTreeSchema = SchemaFactory.createForClass(EventTree);
