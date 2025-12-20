import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Label, LabelSchema } from '../../schemas/label.schema';

export interface TypedModelJSON {
  label: Label;
  users: number[];
}

/**
 * Base typed model document definition shared across model collections.
 * Contains a unique id, user access list, and a label.
 */
@Schema({ versionKey: false })
export class TypedModel {
  @Prop({ required: true, unique: true })
  id: number;

  @Prop({ type: LabelSchema, required: false })
  label: Label;

  @Prop()
  users: number[];
}

/**
 * Mongoose document type for the TypedModel class.
 */
export type TypedModelDocument = TypedModel & Document;
/**
 * Mongoose schema for the TypedModel class.
 */
export const TypedModelSchema = SchemaFactory.createForClass(TypedModel);
