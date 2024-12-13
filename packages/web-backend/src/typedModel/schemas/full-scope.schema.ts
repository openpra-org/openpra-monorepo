import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { TypedModel } from "./templateSchema/typed-model.schema";
import { MetaTypedModel } from "./meta-typed-model.schema";

@Schema({ versionKey: false })
export class FullScope extends TypedModel {
  @Prop({ default: [] })
  parentIds: number[];
}

export type FullScopeDocument = FullScope & Document;
export const FullScopeSchema = SchemaFactory.createForClass(FullScope);
export class FullScopeMetadata extends MetaTypedModel {}
