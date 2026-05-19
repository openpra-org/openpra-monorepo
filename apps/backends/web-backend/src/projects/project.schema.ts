import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import type { ProjectShareRole, ProjectState, ProjectStatus, ProjectStatusMap, RiskMode } from "interfaces-shared-types";

export interface ProjectTeamShare {
  teamId: string;
  role: ProjectShareRole;
}

export interface ProjectUserShare {
  username: string;
  role: ProjectShareRole;
}

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

  @Prop({
    type: [{ teamId: { type: String, required: true }, role: { type: String, required: true }, _id: false }],
    default: [],
  })
  sharedTeams!: ProjectTeamShare[];

  @Prop({
    type: [{ username: { type: String, required: true }, role: { type: String, required: true }, _id: false }],
    default: [],
  })
  sharedUsers!: ProjectUserShare[];

  @Prop({ type: Object, required: true })
  status!: Record<string, ProjectStatus>;

  @Prop({ type: Boolean, default: false, index: true })
  pinned!: boolean;

  @Prop({ type: String, default: "active", index: true })
  state!: ProjectState;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);

export type { ProjectStatusMap };
