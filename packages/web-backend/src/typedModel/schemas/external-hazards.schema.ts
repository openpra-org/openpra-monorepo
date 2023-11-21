import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { TypedModel } from "./templateSchema/typed-model.schema";

@Schema({ versionKey: false })
export class ExternalHazards extends TypedModel {}

export type ExternalHazardsDocument = ExternalHazards & Document;
export const ExternalHazardsSchema =
  SchemaFactory.createForClass(ExternalHazards);
