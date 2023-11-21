import { Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";

@Schema({ versionKey: false })
export class MechanisticSourceTerm extends NestedModel {}

export type MechanisticSourceTermDocument = MechanisticSourceTerm & Document;
export const MechanisticSourceTermSchema = SchemaFactory.createForClass(
  MechanisticSourceTerm,
);
