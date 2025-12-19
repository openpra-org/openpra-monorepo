import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";

/**
 * Nested model representing a Data Analysis technical element.
 */
@Schema({ versionKey: false })
export class DataAnalysis extends NestedModel {}

/** Mongoose document type for DataAnalysis. */
export type DataAnalysisDocument = DataAnalysis & Document;
/** Mongoose schema for DataAnalysis. */
export const DataAnalysisSchema = SchemaFactory.createForClass(DataAnalysis);
