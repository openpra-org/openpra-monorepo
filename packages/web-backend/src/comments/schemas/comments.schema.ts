import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

interface UserActionUsername {
  username: string;
  fullname: string;
}

@Schema({ versionKey: false })
export class Comments {
  @Prop()
  _id: string;

  @Prop()
  associated_with: string;

  @Prop()
  comments: {
    username: UserActionUsername;
    timelineAvatar: string;
    event: string;
    timestamp: string;
    actions: string;
    children: string; // Assuming markdown or HTML content will be stored as a string
  }[];
}

export type CommentsDocument = Comments & Document;
export const CommentsSchema = SchemaFactory.createForClass(Comments);
