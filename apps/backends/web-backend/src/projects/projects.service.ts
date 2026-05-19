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
import { Team, type TeamDocument } from "../teams/team.schema";
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

function toDto(doc: ProjectDocument, teamNameById: Map<string, string>): ProjectDto {
  const status = doc.status;
  const mode = doc.mode;
  const updatedAt = (doc as ProjectDocument & { updatedAt?: Date }).updatedAt ?? new Date();
  const teamId = doc.ownerTeamId ?? null;
  return {
    id: String(doc._id),
    name: doc.name,
    mode,
    modeLabel: riskModeLabel(mode),
    ownerUsername: doc.ownerUsername,
    ownerFullName: doc.ownerFullName,
    ownerInitials: computeInitials(doc.ownerFullName),
    ownerTeamId: teamId,
    ownerTeamName: teamId !== null ? (teamNameById.get(teamId) ?? null) : null,
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
    @InjectModel(Team.name) private readonly teamModel: Model<TeamDocument>,
  ) {}

  async createProject(payload: CreateProjectRequest, acting: ActingUser): Promise<ProjectDto> {
    const owner = await this.userModel.findOne({ username: acting.username }).lean();
    if (!owner) throw new NotFoundException("Acting user not found");
    const requestedTeamId = payload.ownerTeamId ?? null;
    if (requestedTeamId !== null) {
      await this.assertTeamAffiliation(requestedTeamId, acting.username);
    }
    const initialStatus: Record<string, ProjectStatus> = {};
    for (const el of elementsForMode(payload.mode)) initialStatus[el.code] = "not-started";
    const created = await this.projectModel.create({
      name: payload.name,
      mode: payload.mode,
      ownerUsername: owner.username,
      ownerFullName: owner.fullName,
      collaborators: [],
      ownerTeamId: requestedTeamId,
      status: initialStatus,
      pinned: false,
      state: "active",
    });
    const teamNameById = await this.resolveTeamNames([created]);
    return toDto(created, teamNameById);
  }

  async getRecentProject(acting: ActingUser): Promise<RecentProjectResponse> {
    const doc = await this.projectModel
      .findOne({ ownerUsername: acting.username })
      .sort({ updatedAt: -1 })
      .exec();
    if (doc === null) return { project: null };
    const teamNameById = await this.resolveTeamNames([doc]);
    return { project: toDto(doc, teamNameById) };
  }

  async getOwnedProjects(acting: ActingUser): Promise<OwnedProjectsResponse> {
    const docs = await this.projectModel
      .find({ ownerUsername: acting.username })
      .sort({ updatedAt: -1 })
      .exec();
    const teamNameById = await this.resolveTeamNames(docs);
    return { projects: docs.map((d) => toDto(d, teamNameById)) };
  }

  async getSharedProjects(acting: ActingUser): Promise<SharedProjectsResponse> {
    const docs = await this.projectModel
      .find({ collaborators: acting.username })
      .sort({ updatedAt: -1 })
      .exec();
    const teamNameById = await this.resolveTeamNames(docs);
    return { projects: docs.map((d) => toDto(d, teamNameById)) };
  }

  async updateProject(id: string, payload: UpdateProjectRequest, acting: ActingUser): Promise<ProjectDto> {
    const doc = await this.findOwned(id, acting);
    if (payload.name !== undefined) doc.name = payload.name;
    if (payload.pinned !== undefined) doc.pinned = payload.pinned;
    if (payload.state !== undefined) doc.state = payload.state;
    await doc.save();
    const teamNameById = await this.resolveTeamNames([doc]);
    return toDto(doc, teamNameById);
  }

  async transferToTeam(id: string, teamId: string, acting: ActingUser): Promise<ProjectDto> {
    const doc = await this.findOwned(id, acting);
    await this.assertTeamAffiliation(teamId, acting.username);
    doc.ownerTeamId = teamId;
    await doc.save();
    const teamNameById = await this.resolveTeamNames([doc]);
    return toDto(doc, teamNameById);
  }

  async transferToSelf(id: string, acting: ActingUser): Promise<ProjectDto> {
    const doc = await this.findOwned(id, acting);
    doc.ownerTeamId = null;
    await doc.save();
    return toDto(doc, new Map());
  }

  async duplicateProject(id: string, acting: ActingUser): Promise<ProjectDto> {
    const original = await this.findOwned(id, acting);
    const created = await this.projectModel.create({
      name: `${original.name} (copy)`,
      mode: original.mode,
      ownerUsername: original.ownerUsername,
      ownerFullName: original.ownerFullName,
      collaborators: [],
      ownerTeamId: original.ownerTeamId ?? null,
      status: { ...original.status },
      pinned: false,
      state: "active",
    });
    const teamNameById = await this.resolveTeamNames([created]);
    return toDto(created, teamNameById);
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

  private async assertTeamAffiliation(teamId: string, username: string): Promise<void> {
    if (!isValidObjectId(teamId)) throw new NotFoundException("Team not found");
    const team = await this.teamModel.findById(teamId).exec();
    if (!team) throw new NotFoundException("Team not found");
    const isMember = team.adminUsername === username || team.members.includes(username);
    if (!isMember) throw new ForbiddenException("You are not a member of that team");
  }

  private async resolveTeamNames(docs: ProjectDocument[]): Promise<Map<string, string>> {
    const ids = new Set<string>();
    for (const d of docs) {
      if (d.ownerTeamId !== null && d.ownerTeamId !== undefined) ids.add(d.ownerTeamId);
    }
    if (ids.size === 0) return new Map();
    const teams = await this.teamModel
      .find({ _id: { $in: Array.from(ids) } })
      .lean();
    const out = new Map<string, string>();
    for (const t of teams) out.set(String(t._id), t.name);
    return out;
  }
}
