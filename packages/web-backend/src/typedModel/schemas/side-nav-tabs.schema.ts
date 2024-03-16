import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import ActionProps from "shared-types/src/lib/props/collab/ActionProps";

@Schema({versionKey: false })
class SideNavChild {
  @Prop({ required: false })
  label: string;

  @Prop({ required: false })
  iconType: string;

  @Prop({ required: false })
  pinned: boolean;

  @Prop({ required: false })
  visible: boolean;

  @Prop({ required: false })
  navigateTo: string;

  // @Prop({ required: false })
  // _id: string;
}

@Schema({versionKey: false })
export class SideNavTab {
  @Prop({ required: false })
  title: string;

  @Prop({ required: false })
  navigateTo: string;

  @Prop({ type: [SideNavChild], required: false })
  children: {
    label: string;
    iconType: string;
    pinned: boolean;
    visible: boolean;
    navigateTo: string;
    // _id: string;
  }[];

  @Prop({ required: false })
  pinned: boolean;

  @Prop({ required: false })
  visible: boolean;


  // @Prop({ required: false })
  // _id: string;
}

@Schema({versionKey: false })
export class UserSideNavPreferences {
  @Prop({required: false})
  user: string;

  @Prop({type: [SideNavTab], required: false})
  preferences: {
    title: string,
    navigateTo: string,
    children: [SideNavChild],
    pinned: boolean,
    visible: boolean,
  }[];
}

export type SideNavTabsDocument = SideNavTab & Document;

export const SideNavTabSchema = SchemaFactory.createForClass(SideNavTab);

export type UserSideNavTabsDocument = UserSideNavPreferences & Document;

export const UserSideNavTabSchema = SchemaFactory.createForClass(UserSideNavPreferences);
