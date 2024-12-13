import { Prop, Schema } from "@nestjs/mongoose";
import { Label, LabelSchema } from "../../schemas/label.schema";

export interface TypedModelJSON {
  label: Label;
  users: number[];
}

@Schema({ versionKey: false })
export class MetaTypedModel {
  @Prop({ type: LabelSchema, required: true })
  label: Label;

  @Prop()
  users: number[];
}
