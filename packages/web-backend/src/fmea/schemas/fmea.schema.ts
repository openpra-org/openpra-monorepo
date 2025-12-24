import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  minimize: false,
  _id: true,
  versionKey: false,
  toJSON: {
    transform: function (doc, ret) {
      delete ret._id;
    },
  },
})
/**
 * Failure Modes and Effects Analysis (FMEA) document.
 * Stores columns configuration and row data for an FMEA table.
 */
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
/**
 * Mongoose schema for Fmea.
 */
export const FmeaSchema = SchemaFactory.createForClass(Fmea);
/**
 * Mongoose document type for Fmea.
 */
export type FmeaDocument = Fmea & Document;
