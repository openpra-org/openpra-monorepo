import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ versionKey: false })
export class ModelCounter {
    @Prop()
    _id: string;

    @Prop({ unique: true })
    seq: number;
}

export type ModelCounterDocument = ModelCounter & Document;
export const ModelCounterSchema = SchemaFactory.createForClass(ModelCounter);