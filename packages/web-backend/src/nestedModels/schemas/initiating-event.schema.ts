import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";

@Schema({ versionKey: false })
export class InitiatingEvent extends NestedModel {}

export type InitiatingEventDocument = InitiatingEvent & Document;
export const InitiatingEventSchema = SchemaFactory.createForClass(InitiatingEvent);
