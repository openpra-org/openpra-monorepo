import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ versionKey: false })
export class UserCounter {
  @Prop({ required: false })
  _id?: string;

  @Prop({ required: false, unique: true })
  seq?: number;
}

export type UserCounterDocument = UserCounter & Document;
export const UserCounterSchema = SchemaFactory.createForClass(UserCounter);
