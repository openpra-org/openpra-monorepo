import { Schema, SchemaFactory, Prop } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { TypedModel } from "./templateSchema/typed-model.schema";

@Schema({ versionKey: false })
export class InternalHazards extends TypedModel {
  @Prop({ default: [] })
  parentIds: number[];
}

export type InternalHazardsDocument = InternalHazards & Document;
export const InternalHazardsSchema =
  SchemaFactory.createForClass(InternalHazards);
