import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, isValidObjectId } from "mongoose";
import {
  type CreateProjectRequest,
  type OwnedProjectsResponse,
  type Project as ProjectDto,
  type ProjectStatus,
  type ProjectStatusMap,
  type RecentProjectResponse,
  type RiskMode,
  type SharedProjectsResponse,
  type UpdateProjectRequest,
  elementsForMode,
  riskModeLabel,
} from "interfaces-shared-types";
import { User, type UserDocument } from "../users/user.schema";
import { Project, type ProjectDocument } from "./project.schema";

function computeInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function computeProgress(status: ProjectStatusMap, mode: RiskMode): number {
  const elements = elementsForMode(mode);
  if (elements.length === 0) return 0;
  const baseline = elements.filter((e) => status[e.code] === "baseline").length;
  return baseline / elements.length;
}

function toDto(doc: ProjectDocument): ProjectDto {
  const status = doc.status;
  const mode = doc.mode;
  const updatedAt = (doc as ProjectDocument & { updatedAt?: Date }).updatedAt ?? new Date();
  return {
    id: String(doc._id),
    name: doc.name,
    mode,
    modeLabel: riskModeLabel(mode),
    ownerUsername: doc.ownerUsername,
    ownerFullName: doc.ownerFullName,
    ownerInitials: computeInitials(doc.ownerFullName),
    collaborators: doc.collaborators,
    status,
    progress: computeProgress(status, mode),
    pinned: doc.pinned,
    state: doc.state,
    updatedAt: updatedAt.toISOString(),
  };
}

interface ActingUser {
  username: string;
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async createProject(payload: CreateProjectRequest, acting: ActingUser): Promise<ProjectDto> {
    const owner = await this.userModel.findOne({ username: acting.username }).lean();
    if (!owner) throw new NotFoundException("Acting user not found");
    const initialStatus: Record<string, ProjectStatus> = {};
    for (const el of elementsForMode(payload.mode)) initialStatus[el.code] = "not-started";
    const created = await this.projectModel.create({
      name: payload.name,
      mode: payload.mode,
      ownerUsername: owner.username,
      ownerFullName: owner.fullName,
      collaborators: [],
      status: initialStatus,
      pinned: false,
      state: "active",
    });
    return toDto(created);
  }

  async getRecentProject(acting: ActingUser): Promise<RecentProjectResponse> {
    const doc = await this.projectModel
      .findOne({ ownerUsername: acting.username })
      .sort({ updatedAt: -1 })
      .exec();
    return { project: doc === null ? null : toDto(doc) };
  }

  async getOwnedProjects(acting: ActingUser): Promise<OwnedProjectsResponse> {
    const docs = await this.projectModel
      .find({ ownerUsername: acting.username })
      .sort({ updatedAt: -1 })
      .exec();
    return { projects: docs.map(toDto) };
  }

  async getSharedProjects(acting: ActingUser): Promise<SharedProjectsResponse> {
    const docs = await this.projectModel
      .find({ collaborators: acting.username })
      .sort({ updatedAt: -1 })
      .exec();
    return { projects: docs.map(toDto) };
  }

  async updateProject(id: string, payload: UpdateProjectRequest, acting: ActingUser): Promise<ProjectDto> {
    const doc = await this.findOwned(id, acting);
    if (payload.name !== undefined) doc.name = payload.name;
    if (payload.pinned !== undefined) doc.pinned = payload.pinned;
    if (payload.state !== undefined) doc.state = payload.state;
    await doc.save();
    return toDto(doc);
  }

  async duplicateProject(id: string, acting: ActingUser): Promise<ProjectDto> {
    const original = await this.findOwned(id, acting);
    const created = await this.projectModel.create({
      name: `${original.name} (copy)`,
      mode: original.mode,
      ownerUsername: original.ownerUsername,
      ownerFullName: original.ownerFullName,
      collaborators: [],
      status: { ...original.status },
      pinned: false,
      state: "active",
    });
    return toDto(created);
  }

  async deleteProject(id: string, acting: ActingUser): Promise<void> {
    const doc = await this.findOwned(id, acting);
    await doc.deleteOne();
  }

  private async findOwned(id: string, acting: ActingUser): Promise<ProjectDocument> {
    if (!isValidObjectId(id)) throw new NotFoundException("Project not found");
    const doc = await this.projectModel.findById(id).exec();
    if (!doc) throw new NotFoundException("Project not found");
    if (doc.ownerUsername !== acting.username) throw new ForbiddenException("Not the project owner");
    return doc;
  }
}
