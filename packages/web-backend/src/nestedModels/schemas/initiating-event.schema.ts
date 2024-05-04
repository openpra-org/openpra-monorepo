import { Schema, SchemaFactory, Prop } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { NestedModel } from "./templateSchema/nested-model.schema";

@Schema({ versionKey: false, timestamps: true})
export class InitiatingEvent extends NestedModel {
  @Prop()
  tripParameters: string[];

  @Prop()
  radioNuclideBarriers: string[];

  @Prop()
  modularImpact: string[];

  @Prop()
  definition: string;

  @Prop()
  initiatingEventGroup: string[];
}

export type InitiatingEventDocument = InitiatingEvent & Document;
export const InitiatingEventSchema =
  SchemaFactory.createForClass(InitiatingEvent);
