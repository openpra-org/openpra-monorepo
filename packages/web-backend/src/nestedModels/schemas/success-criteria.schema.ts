import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";

/**
 * Nested model representing a Success Criteria technical element.
 */
@Schema({ versionKey: false })
export class SuccessCriteria extends NestedModel {}

/** Mongoose document type for SuccessCriteria. */
export type SuccessCriteriaDocument = SuccessCriteria & Document;
/** Mongoose schema for SuccessCriteria. */
export const SuccessCriteriaSchema = SchemaFactory.createForClass(SuccessCriteria);
