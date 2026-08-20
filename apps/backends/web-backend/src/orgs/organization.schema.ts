import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type OrganizationDocument = HydratedDocument<Organization>;

@Schema({ timestamps: true, collection: "organizations" })
export class Organization {
  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  slug!: string;

  @Prop({ type: String, default: "" })
  description!: string;

  @Prop({ type: String, default: "" })
  createdBy!: string;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);
