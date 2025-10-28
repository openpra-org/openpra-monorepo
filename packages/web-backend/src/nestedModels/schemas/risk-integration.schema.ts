import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";

/**
 * Nested model representing a Risk Integration technical element.
 */
@Schema({ versionKey: false })
export class RiskIntegration extends NestedModel {}

/** Mongoose document type for RiskIntegration. */
export type RiskIntegrationDocument = RiskIntegration & Document;
/** Mongoose schema for RiskIntegration. */
export const RiskIntegrationSchema = SchemaFactory.createForClass(RiskIntegration);
