import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ versionKey: false })
export class TreeCounter {
    @Prop()
    _id: string;

    @Prop({ unique: true })
    seq: number;
}

export type TreeCounterDocument = TreeCounter & Document;
export const TreeCounterSchema = SchemaFactory.createForClass(TreeCounter);