import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";

/**
 * Nested model representing a Mechanistic Source Term technical element.
 */
@Schema({ versionKey: false })
export class MechanisticSourceTerm extends NestedModel {}

/** Mongoose document type for MechanisticSourceTerm. */
export type MechanisticSourceTermDocument = MechanisticSourceTerm & Document;
/** Mongoose schema for MechanisticSourceTerm. */
export const MechanisticSourceTermSchema = SchemaFactory.createForClass(MechanisticSourceTerm);
