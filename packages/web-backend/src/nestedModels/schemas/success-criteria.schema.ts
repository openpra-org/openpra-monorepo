import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";

@Schema({ versionKey: false })
export class SuccessCriteria extends NestedModel {}

export type SuccessCriteriaDocument = SuccessCriteria & Document;
export const SuccessCriteriaSchema = SchemaFactory.createForClass(SuccessCriteria);
