import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { Document } from "mongoose";

interface UserActionUsername {
  username: string;
  fullname: string;
}

@Schema({ versionKey: false, _id: true})
export class Comments {
  // @Prop({ unique: true })
  // id: string;  @Prop({ required: true, unique: true }) // Ensure each comment has a unique ID
  @Prop({ type: mongoose.Schema.Types.ObjectId, auto: true, required: true, unique: true })
  id: mongoose.Types.ObjectId;

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
