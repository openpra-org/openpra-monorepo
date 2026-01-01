import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";

/**
 * Nested model representing an Initiating Event technical element.
 */
@Schema({ versionKey: false })
export class InitiatingEvent extends NestedModel {}

/** Mongoose document type for InitiatingEvent. */
export type InitiatingEventDocument = InitiatingEvent & Document;
/** Mongoose schema for InitiatingEvent. */
export const InitiatingEventSchema = SchemaFactory.createForClass(InitiatingEvent);
