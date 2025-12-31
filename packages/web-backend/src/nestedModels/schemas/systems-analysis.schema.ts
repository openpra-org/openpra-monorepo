import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";

/**
 * Nested model representing a Systems Analysis technical element.
 */
@Schema({ versionKey: false })
export class SystemsAnalysis extends NestedModel {}

/** Mongoose document type for SystemsAnalysis. */
export type SystemsAnalysisDocument = SystemsAnalysis & Document;
/** Mongoose schema for SystemsAnalysis. */
export const SystemsAnalysisSchema = SchemaFactory.createForClass(SystemsAnalysis);
