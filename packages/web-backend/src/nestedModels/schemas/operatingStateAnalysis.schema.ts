import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";

/**
 * Nested model representing an Operating State Analysis technical element.
 */
@Schema({ versionKey: false })
export class OperatingStateAnalysis extends NestedModel {}

/** Mongoose document type for OperatingStateAnalysis. */
export type OperatingStateAnalysisDocument = OperatingStateAnalysis & Document;
/** Mongoose schema for OperatingStateAnalysis. */
export const OperatingStateAnalysisSchema = SchemaFactory.createForClass(OperatingStateAnalysis);
