import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false, versionKey: false })
export class Label {
    @Prop({ required: false })
    name: string;

    @Prop({ required: false })
    description: string;
}

export const LabelSchema = SchemaFactory.createForClass(Label);