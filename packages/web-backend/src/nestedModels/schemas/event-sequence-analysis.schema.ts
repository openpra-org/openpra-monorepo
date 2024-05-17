import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";

@Schema({ versionKey: false })
export class EventSequenceAnalysis extends NestedModel {}

export type EventSequenceAnalysisDocument = EventSequenceAnalysis & Document;
export const EventSequenceAnalysisSchema = SchemaFactory.createForClass(EventSequenceAnalysis);
