import { Schema, Prop, SchemaFactory } from "@nestjs/mongoose";

@Schema({ _id: false, versionKey: false })
class User {
  @Prop({ required: false })
  id: number;

  @Prop({ required: false })
  username: string;
}

const UserSchema = SchemaFactory.createForClass(User);

@Schema({
  timestamps: {
    createdAt: false,
    updatedAt: "date",
  },
  toJSON: {
    transform: function (doc, ret) {
      delete ret._id;
    },
  },
  versionKey: false,
})
export class Action {
  @Prop({ required: false })
  tree_id: number;

  @Prop({ type: UserSchema, required: false })
  user: User;

  @Prop({ required: false })
  type: string;
}

export type ActionDocument = Action & Document;
export const ActionSchema = SchemaFactory.createForClass(Action);
