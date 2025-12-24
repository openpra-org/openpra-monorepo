import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false, versionKey: false })
/**
 * Embedded label schema with optional name and description.
 */
export class Label {
  @Prop({ required: false })
  name: string;

  @Prop({ required: false })
  description: string;
}
/** Mongoose schema for the embedded Label. */
export const LabelSchema = SchemaFactory.createForClass(Label);
