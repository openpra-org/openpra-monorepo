import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";

@Schema({ versionKey: false })
export class OperatingStateAnalysis extends NestedModel {}

export type OperatingStateAnalysisDocument = OperatingStateAnalysis & Document;
export const OperatingStateAnalysisSchema = SchemaFactory.createForClass(OperatingStateAnalysis);
