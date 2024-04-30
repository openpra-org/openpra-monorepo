import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ versionKey: false })
export class Comments {
  @Prop()
  _id: string;

  @Prop()
  associated_with: string;

  @Prop()
  comments: string[];
}

export type CommentsDocument = Comments & Document;
export const CommentsSchema = SchemaFactory.createForClass(Comments);
