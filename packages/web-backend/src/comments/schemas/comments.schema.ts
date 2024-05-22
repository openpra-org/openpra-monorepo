import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

interface UserActionUsername {
  username: string;
  fullname: string;
}

@Schema({ versionKey: false, _id: true })
export class Comments {
  id: string;

  @Prop()
  associated_with: string;

  @Prop()
  comments: {
    username: UserActionUsername;
    timelineAvatar: string;
    event: string;
    timestamp: string;
    actions: string;
    children: string;
  }[];
}

export type CommentsDocument = Comments & Document;
export const CommentsSchema = SchemaFactory.createForClass(Comments);
