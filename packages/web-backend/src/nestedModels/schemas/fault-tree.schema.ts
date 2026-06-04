import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";
@Schema({ versionKey: false })
export class FaultTree extends NestedModel {}
export type FaultTreeDocument = FaultTree & Document;
export const FaultTreeSchema = SchemaFactory.createForClass(FaultTree);
