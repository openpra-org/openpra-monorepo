import { Prop, Schema } from "@nestjs/mongoose";

@Schema({
  minimize: false,
  timestamps: {
    createdAt: 'account_created',
    updatedAt: 'last_login'
  },
  toJSON: {
    transform: function(doc, ret) {
      delete ret._id;
      delete ret.password;
    }
  },
  versionKey: false
})
export default class User {
  @Prop({ required: false })
  id: number;

  @Prop()
  firstName: string;

  @Prop()
  lastName: string;

  @Prop()
  username: string;

  @Prop()
  email: string;

  @Prop()
  password: string;

  @Prop({ type: RecentlyAccessedSchema, required: false })
  recently_accessed: Recently_Accessed;

  @Prop({ type: PreferencesSchema, required: false })
  preferences: Preferences;

  @Prop({ type: PermissionsSchema, default: {}, required: false })
  permissions: Permissions;
}
