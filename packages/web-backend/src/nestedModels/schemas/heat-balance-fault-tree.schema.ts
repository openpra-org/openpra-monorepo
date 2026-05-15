import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";
@Schema({ versionKey: false })
export class HeatBalanceFaultTree extends NestedModel {}
export type HeatBalanceFaultTreeDocument = HeatBalanceFaultTree & Document;
export const HeatBalanceFaultTreeSchema = SchemaFactory.createForClass(HeatBalanceFaultTree);
