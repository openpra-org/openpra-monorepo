import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

/**
 * Simple reusable label value object embedded in many documents.
 */
@Schema({ _id: false, versionKey: false })
export class Label {
  @Prop({ required: false })
  name: string;

  @Prop({ required: false })
  description: string;
}
/**
 * Mongoose schema for the embedded Label value object.
 */
export const LabelSchema = SchemaFactory.createForClass(Label);
