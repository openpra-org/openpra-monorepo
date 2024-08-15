import { Prop, Schema } from "@nestjs/mongoose";
import { Label, LabelSchema } from "../../schemas/label.schema";

export interface TypedModelJSON {
  label: Label;
  users: number[];
}

@Schema({ versionKey: false })
export class MetaTypedModel {
  @Prop({ type: LabelSchema, required: false })
  label?: Label;

  @Prop({ required: false })
  users?: number[];
}
