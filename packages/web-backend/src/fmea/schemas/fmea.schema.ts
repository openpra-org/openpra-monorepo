import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type FmeaDocument = Fmea & Document;

class DropdownOption {
  @Prop({ required: false })
  number?: number;

  @Prop({ required: false })
  description?: string;
}

class Column {
  @Prop({ required: false })
  id?: string;

  @Prop({ required: false })
  name?: string;

  @Prop({ required: false })
  type?: string;

  @Prop({ required: false, default: [] })
  dropdownOptions?: DropdownOption[];
}

class Row {
  @Prop({ required: false })
  id?: number;

  @Prop({ required: false, default: () => new Map<string, string>() })
  row_data?: Map<string, string>;
}

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
  id?: number;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  description!: string;

  //prop of type array named columns which containing strings
  @Prop({ required: false, default: [] })
  columns?: Column[];

  @Prop({ required: false, default: [] })
  rows?: Row[];
}

export const FmeaSchema = SchemaFactory.createForClass(Fmea);
