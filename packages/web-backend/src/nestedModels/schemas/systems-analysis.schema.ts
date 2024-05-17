import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";

@Schema({ versionKey: false })
export class SystemsAnalysis extends NestedModel {}

export type SystemsAnalysisDocument = SystemsAnalysis & Document;
export const SystemsAnalysisSchema = SchemaFactory.createForClass(SystemsAnalysis);
