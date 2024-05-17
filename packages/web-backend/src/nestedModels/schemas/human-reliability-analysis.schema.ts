import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";

@Schema({ versionKey: false })
export class HumanReliabilityAnalysis extends NestedModel {}

export type HumanReliabilityAnalysisDocument = HumanReliabilityAnalysis & Document;
export const HumanReliabilityAnalysisSchema = SchemaFactory.createForClass(HumanReliabilityAnalysis);
