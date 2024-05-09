import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ versionKey: false, timestamps: true })
export class ModelViewColumn {
  @Prop({ unique: true })
  name: string;

  @Prop({default:"string"})
  type: string

  @Prop()
  dropdownOptions: []

}

export type ModelViewColumnDocument = ModelViewColumn & Document;
export const ModelViewColumnSchema = SchemaFactory.createForClass(ModelViewColumn);
