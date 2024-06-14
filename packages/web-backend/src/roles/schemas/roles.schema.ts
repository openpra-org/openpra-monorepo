import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, SchemaTypes } from "mongoose";

@Schema({ minimize: false, _id: false, versionKey: false })
class RawRule {
  @Prop({ required: true, type: SchemaTypes.Mixed })
  action: string | string[];

  @Prop({ required: false, type: SchemaTypes.Mixed })
  subject?: string | string[];

  @Prop({ required: false, type: SchemaTypes.Mixed })
  fields?: unknown;

  @Prop({ required: false, type: SchemaTypes.Mixed })
  conditionals?: unknown;

  @Prop({ required: false })
  inverted?: boolean;

  @Prop({ required: false })
  reason?: string;
}

@Schema({
  minimize: false,
  timestamps: {
    createdAt: "created_at",
  },
  versionKey: false,
})
export class Roles {
  @Prop({ required: false, unique: true })
  id: string;

  @Prop({ required: false })
  name: string;

  @Prop({ required: true })
  permissions: RawRule[];
}

export type RolesDocument = Roles & Document;
export const RolesSchema = SchemaFactory.createForClass(Roles);
