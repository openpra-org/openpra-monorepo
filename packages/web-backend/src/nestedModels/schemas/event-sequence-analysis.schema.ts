import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";

/**
 * Nested model representing an Event Sequence Analysis technical element.
 */
@Schema({ versionKey: false })
export class EventSequenceAnalysis extends NestedModel {}

/** Mongoose document type for EventSequenceAnalysis. */
export type EventSequenceAnalysisDocument = EventSequenceAnalysis & Document;
/** Mongoose schema for EventSequenceAnalysis. */
export const EventSequenceAnalysisSchema = SchemaFactory.createForClass(EventSequenceAnalysis);
