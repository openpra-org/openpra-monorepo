import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({
  minimize: false,
  _id: true,
  versionKey: false,
  toJSON: {
    transform: function (doc, ret) {
      delete ret._id;
      delete ret.password;
    },
  },
})
export class Fmea {
  @Prop({ required: false })
  id: number;

  @Prop()
  title: string;

  @Prop()
  description: string;

  //prop of type array named columns which containing strings
  @Prop({ default: [] })
  columns: {
    id: string;
    name: string;
    type: string;
    dropdownOptions: {
      number: number;
      description: string;
    }[];
  }[];

  @Prop()
  rows: {
    id: string;
    row_data: Record<string, string>;
  }[];
}

export const FmeaSchema = SchemaFactory.createForClass(Fmea);
export type FmeaDocument = Fmea & Document;
