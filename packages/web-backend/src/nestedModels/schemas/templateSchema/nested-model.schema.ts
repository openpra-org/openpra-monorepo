import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Label, LabelSchema } from '../../../schemas/label.schema';

@Schema({ _id: false, versionKey: false })
export class NestedModel {
  
    @Prop({required: true, unique: true})
    id: number;

    @Prop(({ type: LabelSchema, required: false }))
    label: Label

    @Prop()
    parentIds: number[]

}

export type TypedModelDocument = NestedModel & Document;
export const TypedModelSchema = SchemaFactory.createForClass(NestedModel);