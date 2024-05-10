import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";

@Schema({ versionKey: false })
export class FailureModesAndEffectsAnalyses extends NestedModel {}

export type FailureModesAndEffectsAnalysesDocument =
  FailureModesAndEffectsAnalyses & Document;
export const FailureModesAndEffectsAnalysesSchema =
  SchemaFactory.createForClass(FailureModesAndEffectsAnalyses);
