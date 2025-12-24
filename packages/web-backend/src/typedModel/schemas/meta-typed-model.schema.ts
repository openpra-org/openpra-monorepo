import { Prop, Schema } from '@nestjs/mongoose';
import { Label, LabelSchema } from '../../schemas/label.schema';

/**
 * JSON shape for the lightweight TypedModel metadata projection.
 */
export interface TypedModelJSON {
  label: Label;
  users: number[];
}

/**
 * Lightweight metadata projection for typed models.
 * Exposes label and users fields.
 */
@Schema({ versionKey: false })
export class MetaTypedModel {
  @Prop({ type: LabelSchema, required: false })
  label: Label;

  @Prop()
  users: number[];
}
