import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { Document } from "mongoose";
import { Action, ActionSchema } from "../../hcl/schemas/action.schema";

@Schema({ minimize: false, _id: false, versionKey: false })
class Instances {}

const InstancesSchema = SchemaFactory.createForClass(Instances);

@Schema({ minimize: false, _id: false, versionKey: false })
class Models {
  @Prop({ required: false })
  id: number;

  @Prop({ required: false })
  creator: number;

  @Prop({ required: false })
  title: string;

  @Prop({ required: false })
  description: string;

  @Prop({ required: false })
  assigned_users: number[];

  @Prop({ type: mongoose.Schema.Types.Date, required: false })
  date_created: Date;

  @Prop({ type: mongoose.Schema.Types.Date, required: false })
  date_modified: Date;

  @Prop({ required: false })
  type: string;

  @Prop({ required: false })
  path: string;

  @Prop({ type: [{ type: ActionSchema }], required: false })
  actions: Action[];

  @Prop({ type: [{ type: InstancesSchema }], required: false })
  instances: Instances[];
}

const ModelsSchema = SchemaFactory.createForClass(Models);

@Schema({ minimize: false, _id: false, versionKey: false })
class Subsystems {}

const SubsystemsSchema = SchemaFactory.createForClass(Subsystems);

@Schema({ minimize: false, _id: false, versionKey: false })
class Projects {}

const ProjectsSchema = SchemaFactory.createForClass(Projects);

@Schema({ minimize: false, _id: false, versionKey: false })
class Recently_Accessed {
  @Prop({ type: [{ type: ModelsSchema }], required: false })
  models: Models[];

  @Prop({ type: [{ type: SubsystemsSchema }], required: false })
  subsystems: Subsystems[];

  @Prop({ type: [{ type: ProjectsSchema }], required: false })
  projects: Projects[];
}

const RecentlyAccessedSchema = SchemaFactory.createForClass(Recently_Accessed);

@Schema({ minimize: false, _id: false, versionKey: false })
class Configurations {}

const ConfigurationsSchema = SchemaFactory.createForClass(Configurations);

@Schema({ minimize: false, _id: false, versionKey: false })
class QuantificationConfigurations {
  @Prop({ type: ConfigurationsSchema, required: false })
  configurations: Configurations;

  @Prop({ required: false })
  currentlySelected: string;
}

const QuantificationConfigurationsSchema = SchemaFactory.createForClass(
  QuantificationConfigurations,
);

@Schema({ minimize: false, _id: false, versionKey: false })
class Preferences {
  @Prop({ required: false })
  theme: string;

  @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
  nodeIdsVisible: boolean | string;

  @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
  outlineVisible: boolean | string;

  @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
  node_value_visible: boolean | string;

  @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
  nodeDescriptionEnabled: boolean | string;

  @Prop({ type: mongoose.Schema.Types.Mixed, required: false })
  pageBreaksVisible: boolean | string;

  @Prop({ type: QuantificationConfigurationsSchema, required: false })
  quantificationConfigurations: QuantificationConfigurations;
}

const PreferencesSchema = SchemaFactory.createForClass(Preferences);

@Schema({ minimize: false, _id: false, versionKey: false })
class Permissions {}

const PermissionsSchema = SchemaFactory.createForClass(Permissions);

@Schema({
  minimize: false,
  timestamps: {
    createdAt: "account_created",
    updatedAt: "last_login",
  },
  toJSON: {
    transform: function (doc, ret) {
      delete ret._id;
      delete ret.password;
    },
  },
  versionKey: false,
})
export class User {
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

  @Prop({ type: Date, default: Date.now() })
  last_login: Date;
}

export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User);
