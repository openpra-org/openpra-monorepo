import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { TypedModel } from "./templateSchema/typed-model.schema";
import { MetaTypedModel } from "./meta-typed-model.schema";

@Schema({ versionKey: false })
export class InternalEvents extends TypedModel {
  @Prop({ default: [] })
  parentIds: number[];
}

export type InternalEventsDocument = InternalEvents & Document;
export const InternalEventsSchema = SchemaFactory.createForClass(InternalEvents);
export class InternalEventsMetadata extends MetaTypedModel {}
