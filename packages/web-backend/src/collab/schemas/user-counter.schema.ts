import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ versionKey: false })
export class UserCounter {
    @Prop()
    _id: string;

    @Prop({ unique: true })
    seq: number;
}

export type UserCounterDocument = UserCounter & Document;
export const UserCounterSchema = SchemaFactory.createForClass(UserCounter);