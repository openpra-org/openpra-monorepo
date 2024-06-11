import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import * as mongoose from "mongoose";

//   @Prop()
//   id: number;
//   // @Prop({ type: mongoose.Schema.Types.ObjectId })
//   // _id: mongoose.Types.ObjectId;
//   @Prop()
//   definition: string;
//   @Prop()
//   characteristics: string;
//   @Prop()
//   processCriteriaIdentification: string;
//   @Prop()
//   controlRodInsertion: string;
//   @Prop()
//   feedwaterPump: string;
//   @Prop()
//   reactorCoolantCirculator: string;
//   @Prop()
//   others: string;

//   //  mongoose.Mixed type for dynamic columns
//   // @Prop({ type: mongoose.Schema.Types.Mixed })
//   // data: {
//   //   [key: string]: any; // This will hold each row's data
//   // };
// }

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
export class OperatingState {
  @Prop({ required: true })
  id: number;

  //prop of type array named columns which containing strings
  @Prop({
    type: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        type: {
          type: String,
          required: true,
          enum: ["text", "dropdown", "number"],
        },
        dropdownOptions: [
          {
            value: String,
            text: String,
          },
        ],
      },
    ],
    default: [],
  })
  columns: {
    id: string;
    name: string;
    type: "text" | "dropdown" | "number";
    dropdownOptions?: { value: string; text: string }[];
  }[];

  @Prop({
    type: [
      {
        id: { type: Number, required: true, unique: true },
        row_data: { type: Map, of: String },
      },
    ],
    default: [],
  })
  rows: {
    id: number;
    row_data: Map<string, string>;
  }[];
  @Prop()
  definition: string;

  @Prop()
  characteristics: string;

  @Prop()
  processCriteriaIdentification: string;

  @Prop()
  controlRodInsertion: string;

  @Prop()
  feedwaterPump: string;

  @Prop()
  reactorCoolantCirculator: string;

  @Prop()
  others: string;
}
export const OperatingStateSchema = SchemaFactory.createForClass(OperatingState);
export type OperatingStateDocument = OperatingState & mongoose.Document;
