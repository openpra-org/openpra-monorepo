import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { Label, LabelSchema } from "../../schemas/label.schema";

export interface TypedModelJSON {
  label: Label;
  users: number[];
}

@Schema({ versionKey: false })
export class TypedModel {
  @Prop({ required: true, unique: true })
  id: number;

  @Prop({ type: LabelSchema, required: false })
  label: Label;

  @Prop()
  users: number[];
}

export type TypedModelDocument = TypedModel & Document;
export const TypedModelSchema = SchemaFactory.createForClass(TypedModel);
