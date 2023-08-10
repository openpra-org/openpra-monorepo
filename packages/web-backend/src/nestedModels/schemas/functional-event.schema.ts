import { Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { NestedModel } from './templateSchema/nested-model.schema';

@Schema({ versionKey: false })
export class FunctionalEvent extends NestedModel{
}

export type FunctionalEventDocument = FunctionalEvent & Document;
export const FunctionalEventSchema = SchemaFactory.createForClass(FunctionalEvent);