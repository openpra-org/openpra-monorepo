import { Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { NestedModel } from './templateSchema/nested-model.schema';

@Schema({ versionKey: false })
export class EventTree extends NestedModel{
}

export type EventTreeDocument = EventTree & Document;
export const EventTreeSchema = SchemaFactory.createForClass(EventTree);