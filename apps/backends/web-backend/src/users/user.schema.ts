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

  @Prop({ type: String, default: null, index: true })
  organizationId!: string | null;

  @Prop({ type: String, default: null })
  passwordHash!: string | null;

  @Prop({
    type: [{ provider: String, providerUserId: String, displayName: String }],
    default: [],
  })
  connectedAccounts!: { provider: string; providerUserId: string; displayName: string }[];

  @Prop({ type: [String], default: ["member-role"] })
  roles!: string[];

  @Prop({
    type: {
      campaignId: { type: String, default: null },
      campaignName: { type: String, default: null },
      visitorId: { type: String, default: "" },
      attributedAt: { type: Date, default: null },
      _id: false,
    },
    default: null,
  })
  signupAttribution!: {
    campaignId: string;
    campaignName: string;
    visitorId: string;
    attributedAt: Date;
  } | null;

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

  @Prop({ type: String, default: null })
  signatureDataUrl!: string | null;

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

  @Prop({
    type: Object,
    default: () => ({
      enabled: false,
      secret: null,
      pendingSecret: null,
      backupCodes: [],
    }),
  })
  twoFactor!: {
    enabled: boolean;
    secret: string | null;
    pendingSecret: string | null;
    backupCodes: string[];
  };
}

export const UserSchema = SchemaFactory.createForClass(User);
