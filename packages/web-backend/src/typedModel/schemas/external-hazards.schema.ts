import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { TypedModel } from "./templateSchema/typed-model.schema";

/**
 * Typed model representing External Hazards projects.
 * Extends the common TypedModel structure.
 */
@Schema({ versionKey: false })
export class ExternalHazards extends TypedModel {
  @Prop({ default: [] })
  parentIds: number[];
}

/** Mongoose document type for ExternalHazards. */
export type ExternalHazardsDocument = ExternalHazards & Document;
/** Mongoose schema for ExternalHazards. */
export const ExternalHazardsSchema = SchemaFactory.createForClass(ExternalHazards);
