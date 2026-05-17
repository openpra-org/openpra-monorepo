import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import type { ProjectStatus, RiskMode, ProjectStatusMap } from "interfaces-shared-types";

export type ProjectDocument = HydratedDocument<Project>;

@Schema({ timestamps: true, collection: "projects" })
export class Project {
  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, required: true })
  mode!: RiskMode;

  @Prop({ type: String, required: true, index: true })
  ownerUsername!: string;

  @Prop({ type: String, required: true })
  ownerFullName!: string;

  @Prop({ type: [String], default: [], index: true })
  collaborators!: string[];

  @Prop({ type: Object, required: true })
  status!: Record<string, ProjectStatus>;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);

export type { ProjectStatusMap };
