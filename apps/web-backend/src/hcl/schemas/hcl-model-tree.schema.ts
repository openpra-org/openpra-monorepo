import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

@Schema()
export class Model {
    @Prop()
    id: number;

    @Prop()
    type: string;

    @Prop()
    model_tag: string;
}


@Schema({ timestamps: {
        createdAt: 'date_created',
        updatedAt: 'date_modified'
}})
export class HclModelTree {
    @Prop({ required: false })
    model_id: string;

    @Prop({ required: false, unique: true })
    id: number;

    @Prop()
    title: string;

    @Prop({ required: false })
    creator: number;

    @Prop()
    description:string;

    @Prop({ type: mongoose.Schema.Types.Map, required: false })
    model: Model;

    @Prop()
    tree_type:string;

    @Prop({ required: false })
    valid: boolean;

    @Prop({ type: mongoose.Schema.Types.Map })
    tree_data;
}

export type HclModelTreeDocument = HclModelTree & Document;
export const HclModelTreeSchema = SchemaFactory.createForClass(HclModelTree);
