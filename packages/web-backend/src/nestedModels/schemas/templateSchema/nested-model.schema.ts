import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Label, LabelSchema } from "../../../schemas/label.schema";

/**
 * Common base for nested model documents embedded in technical elements.
 * Includes id, label, and parentIds.
 */
@Schema({ _id: false, versionKey: false })
export class NestedModel {
  @Prop({ required: true, unique: true })
  id: number;

  @Prop({ type: LabelSchema, required: false })
  label: Label;

  @Prop()
  parentIds: number[] | string[];
}

/** Mongoose document type for the embedded NestedModel. */
export type NestedModelDocument = NestedModel & Document;
/** Mongoose schema for the embedded NestedModel. */
export const NestedModelSchema = SchemaFactory.createForClass(NestedModel);
