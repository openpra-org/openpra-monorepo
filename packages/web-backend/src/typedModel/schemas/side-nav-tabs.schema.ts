import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({ _id: false, versionKey: false })
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
}

@Schema({ _id: false, versionKey: false })
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
  }[];

  @Prop({ required: false })
  pinned: boolean;

  @Prop({ required: false })
  visible: boolean;
}

export type SideNavTabsDocument = SideNavTab & Document;

export const SideNavTabSchema = SchemaFactory.createForClass(SideNavTab);
