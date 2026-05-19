import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, collection: "users" })
export class User {
  @Prop({ required: true, unique: true, index: true })
  username!: string;

  @Prop({ required: true, unique: true, index: true, lowercase: true })
  email!: string;

  @Prop({ required: true })
  fullName!: string;

  @Prop({ default: "" })
  organization!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ type: [String], default: ["member-role"] })
  roles!: string[];

  @Prop({ type: String, default: null })
  resetTokenHash!: string | null;

  @Prop({ type: Date, default: null })
  resetTokenExpiresAt!: Date | null;

  @Prop({ type: String, default: "" })
  title!: string;

  @Prop({ type: String, default: "" })
  bio!: string;

  @Prop({ type: String, default: "" })
  altEmail!: string;

  @Prop({ type: String, default: "" })
  phone!: string;

  @Prop({ type: String, default: "" })
  linkedin!: string;

  @Prop({ type: String, default: null })
  avatarKey!: string | null;

  @Prop({ type: String, default: null })
  coverKey!: string | null;

  @Prop({
    type: Object,
    default: () => ({
      notify: {
        projectShared: true,
        teamInvite: true,
        runFinished: true,
        quantErrors: true,
      },
    }),
  })
  prefs!: {
    notify: {
      projectShared: boolean;
      teamInvite: boolean;
      runFinished: boolean;
      quantErrors: boolean;
    };
  };
}

export const UserSchema = SchemaFactory.createForClass(User);
