import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

@Schema()
class Model_Data {
    @Prop()
    bayesian_networks: number[];

    @Prop()
    event_trees: number[];

    @Prop()
    fault_trees: number[];

    @Prop()
    init_events: number[];
}

@Schema({ timestamps: {
        createdAt: 'date_created',
        updatedAt: 'date_modified'
}})
export class HclModel {
    @Prop({ required: false, unique: true })
    id: number;

    @Prop({ required: false })
    creator: number;

    @Prop()
    title: string;

    @Prop()
    description: string;

    @Prop()
    assigned_users: number[];

    @Prop({ required: false })
    type: string;

    @Prop({ required: false })
    overview_tree: number;

    @Prop({ required: false })
    tag: string;

    @Prop({ type: mongoose.Schema.Types.Map, required: false })
    model_data: Model_Data;

    @Prop({ type: mongoose.Schema.Types.Map, required: false })
    actions;

    @Prop({ type: mongoose.Schema.Types.Map, required: false })
    results;

    @Prop({ type: mongoose.Schema.Types.Map, required: false })
    instances;
};

export type HclModelDocument = HclModel & Document;
export const HclModelSchema = SchemaFactory.createForClass(HclModel);