import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({
  toJSON: {
    transform: function (doc, ret: any) {
      delete ret._id;
      delete ret.model_id;
    },
  },
  versionKey: false,
})
export class GlobalParameter {
  @Prop({ unique: false })
  model_id: number;

  @Prop({ unique: true })
  pk: number;

  @Prop()
  parameter_name: string;

  @Prop({ required: false })
  parameter_type: string;

  @Prop()
  double_value: number;

  @Prop({ required: false })
  string_value: string;
}

export type GlobalParameterDocument = GlobalParameter & Document;
export const GlobalParameterSchema = SchemaFactory.createForClass(GlobalParameter);
