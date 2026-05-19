import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, isValidObjectId } from "mongoose";
import {
  type CreateProjectRequest,
  type OwnedProjectsResponse,
  type Project as ProjectDto,
  type ProjectAccessRole,
  type ProjectShareRole,
  type ProjectStatus,
  type ProjectStatusMap,
  type ProjectTeamShareEntry,
  type ProjectUserShareEntry,
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

interface TeamLookup {
  name: string;
  memberCount: number;
}

interface ResolverMaps {
  teamById: Map<string, TeamLookup>;
  userByUsername: Map<string, string>;
  myTeamIds: Set<string>;
}

function rolePriority(role: ProjectAccessRole): number {
  if (role === "owner") return 3;
  if (role === "editor") return 2;
  return 1;
}

function computeRole(doc: ProjectDocument, viewer: string, myTeamIds: Set<string>): ProjectAccessRole | null {
  if (doc.ownerUsername === viewer) return "owner";
  let best: ProjectAccessRole | null = null;
  const userShare = doc.sharedUsers.find((s) => s.username === viewer);
  if (userShare) best = userShare.role;
  for (const ts of doc.sharedTeams) {
    if (!myTeamIds.has(ts.teamId)) continue;
    if (best === null || rolePriority(ts.role) > rolePriority(best)) best = ts.role;
  }
  return best;
}

function toDto(doc: ProjectDocument, viewer: string, maps: ResolverMaps): ProjectDto {
  const status = doc.status;
  const mode = doc.mode;
  const updatedAt = (doc as ProjectDocument & { updatedAt?: Date }).updatedAt ?? new Date();
  const sharedTeams: ProjectTeamShareEntry[] = doc.sharedTeams.map((s) => {
    const t = maps.teamById.get(s.teamId);
    return {
      teamId: s.teamId,
      teamName: t?.name ?? "(deleted team)",
      memberCount: t?.memberCount ?? 0,
      role: s.role,
    };
  });
  const sharedUsers: ProjectUserShareEntry[] = doc.sharedUsers.map((s) => ({
    username: s.username,
    fullName: maps.userByUsername.get(s.username) ?? s.username,
    role: s.role,
  }));
  const myRole = computeRole(doc, viewer, maps.myTeamIds) ?? "viewer";
  return {
    id: String(doc._id),
    name: doc.name,
    mode,
    modeLabel: riskModeLabel(mode),
    ownerUsername: doc.ownerUsername,
    ownerFullName: doc.ownerFullName,
    ownerInitials: computeInitials(doc.ownerFullName),
    myRole,
    sharedTeams,
    sharedUsers,
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

interface ResolvedUser {
  username: string;
  fullName: string;
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
    const initialStatus: Record<string, ProjectStatus> = {};
    for (const el of elementsForMode(payload.mode)) initialStatus[el.code] = "not-started";
    const created = await this.projectModel.create({
      name: payload.name,
      mode: payload.mode,
      ownerUsername: owner.username,
      ownerFullName: owner.fullName,
      sharedTeams: [],
      sharedUsers: [],
      status: initialStatus,
      pinned: false,
      state: "active",
    });
    return toDto(created, acting.username, await this.buildMaps([created], acting.username));
  }

  async getRecentProject(acting: ActingUser): Promise<RecentProjectResponse> {
    const doc = await this.projectModel
      .findOne({ ownerUsername: acting.username })
      .sort({ updatedAt: -1 })
      .exec();
    if (doc === null) return { project: null };
    return { project: toDto(doc, acting.username, await this.buildMaps([doc], acting.username)) };
  }

  async getOwnedProjects(acting: ActingUser): Promise<OwnedProjectsResponse> {
    const docs = await this.projectModel
      .find({ ownerUsername: acting.username })
      .sort({ updatedAt: -1 })
      .exec();
    const maps = await this.buildMaps(docs, acting.username);
    return { projects: docs.map((d) => toDto(d, acting.username, maps)) };
  }

  async getSharedProjects(acting: ActingUser): Promise<SharedProjectsResponse> {
    const maps = await this.buildSharedMaps(acting.username);
    const docs = await this.projectModel
      .find({
        ownerUsername: { $ne: acting.username },
        $or: [
          { "sharedUsers.username": acting.username },
          { "sharedTeams.teamId": { $in: Array.from(maps.myTeamIds) } },
        ],
      })
      .sort({ updatedAt: -1 })
      .exec();
    await this.populateMaps(docs, maps);
    return { projects: docs.map((d) => toDto(d, acting.username, maps)) };
  }

  async getProject(id: string, acting: ActingUser): Promise<ProjectDto> {
    if (!isValidObjectId(id)) throw new NotFoundException("Project not found");
    const doc = await this.projectModel.findById(id).exec();
    if (!doc) throw new NotFoundException("Project not found");
    const maps = await this.buildMaps([doc], acting.username);
    const role = computeRole(doc, acting.username, maps.myTeamIds);
    if (role === null) throw new NotFoundException("Project not found");
    return toDto(doc, acting.username, maps);
  }

  async updateProject(id: string, payload: UpdateProjectRequest, acting: ActingUser): Promise<ProjectDto> {
    const doc = await this.findOwned(id, acting);
    if (payload.name !== undefined) doc.name = payload.name;
    if (payload.pinned !== undefined) doc.pinned = payload.pinned;
    if (payload.state !== undefined) doc.state = payload.state;
    await doc.save();
    return toDto(doc, acting.username, await this.buildMaps([doc], acting.username));
  }

  async duplicateProject(id: string, acting: ActingUser): Promise<ProjectDto> {
    const original = await this.findOwned(id, acting);
    const created = await this.projectModel.create({
      name: `${original.name} (copy)`,
      mode: original.mode,
      ownerUsername: original.ownerUsername,
      ownerFullName: original.ownerFullName,
      sharedTeams: [],
      sharedUsers: [],
      status: { ...original.status },
      pinned: false,
      state: "active",
    });
    return toDto(created, acting.username, await this.buildMaps([created], acting.username));
  }

  async deleteProject(id: string, acting: ActingUser): Promise<void> {
    const doc = await this.findOwned(id, acting);
    await doc.deleteOne();
  }

  async shareWithTeam(id: string, teamId: string, role: ProjectShareRole, acting: ActingUser): Promise<ProjectDto> {
    const doc = await this.findOwned(id, acting);
    await this.assertTeamAffiliation(teamId, acting.username);
    if (doc.sharedTeams.some((s) => s.teamId === teamId)) {
      throw new ConflictException("Project is already shared with that team");
    }
    doc.sharedTeams.push({ teamId, role });
    doc.markModified("sharedTeams");
    await doc.save();
    return toDto(doc, acting.username, await this.buildMaps([doc], acting.username));
  }

  async unshareFromTeam(id: string, teamId: string, acting: ActingUser): Promise<void> {
    const doc = await this.findOwned(id, acting);
    const before = doc.sharedTeams.length;
    doc.sharedTeams = doc.sharedTeams.filter((s) => s.teamId !== teamId);
    if (doc.sharedTeams.length === before) throw new NotFoundException("Project is not shared with that team");
    doc.markModified("sharedTeams");
    await doc.save();
  }

  async updateTeamShareRole(id: string, teamId: string, role: ProjectShareRole, acting: ActingUser): Promise<ProjectDto> {
    const doc = await this.findOwned(id, acting);
    const entry = doc.sharedTeams.find((s) => s.teamId === teamId);
    if (!entry) throw new NotFoundException("Project is not shared with that team");
    entry.role = role;
    doc.markModified("sharedTeams");
    await doc.save();
    return toDto(doc, acting.username, await this.buildMaps([doc], acting.username));
  }

  async shareWithUser(id: string, identifier: string, role: ProjectShareRole, acting: ActingUser): Promise<ProjectDto> {
    const doc = await this.findOwned(id, acting);
    const resolved = await this.resolveByIdentifier(identifier);
    if (resolved.username === doc.ownerUsername) {
      throw new BadRequestException("You already own this project");
    }
    if (doc.sharedUsers.some((s) => s.username === resolved.username)) {
      throw new ConflictException("Project is already shared with that user");
    }
    doc.sharedUsers.push({ username: resolved.username, role });
    doc.markModified("sharedUsers");
    await doc.save();
    return toDto(doc, acting.username, await this.buildMaps([doc], acting.username));
  }

  async unshareFromUser(id: string, username: string, acting: ActingUser): Promise<void> {
    const doc = await this.findOwned(id, acting);
    const before = doc.sharedUsers.length;
    doc.sharedUsers = doc.sharedUsers.filter((s) => s.username !== username);
    if (doc.sharedUsers.length === before) throw new NotFoundException("Project is not shared with that user");
    doc.markModified("sharedUsers");
    await doc.save();
  }

  async updateUserShareRole(id: string, username: string, role: ProjectShareRole, acting: ActingUser): Promise<ProjectDto> {
    const doc = await this.findOwned(id, acting);
    const entry = doc.sharedUsers.find((s) => s.username === username);
    if (!entry) throw new NotFoundException("Project is not shared with that user");
    entry.role = role;
    doc.markModified("sharedUsers");
    await doc.save();
    return toDto(doc, acting.username, await this.buildMaps([doc], acting.username));
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

  private async resolveByIdentifier(identifier: string): Promise<ResolvedUser> {
    const normalized = identifier.trim().toLowerCase();
    const user = await this.userModel
      .findOne({ $or: [{ username: identifier.trim() }, { email: normalized }] })
      .lean();
    if (!user) throw new NotFoundException(`No user found for "${identifier}"`);
    return { username: user.username, fullName: user.fullName };
  }

  private async buildMaps(docs: ProjectDocument[], viewer: string): Promise<ResolverMaps> {
    const maps = await this.buildSharedMaps(viewer);
    await this.populateMaps(docs, maps);
    return maps;
  }

  private async buildSharedMaps(viewer: string): Promise<ResolverMaps> {
    const myTeams = await this.teamModel
      .find({ $or: [{ adminUsername: viewer }, { members: viewer }] })
      .lean();
    const myTeamIds = new Set(myTeams.map((t) => String(t._id)));
    return { teamById: new Map(), userByUsername: new Map(), myTeamIds };
  }

  private async populateMaps(docs: ProjectDocument[], maps: ResolverMaps): Promise<void> {
    const teamIds = new Set<string>();
    const usernames = new Set<string>();
    for (const d of docs) {
      for (const t of d.sharedTeams) teamIds.add(t.teamId);
      for (const u of d.sharedUsers) usernames.add(u.username);
    }
    if (teamIds.size > 0) {
      const teams = await this.teamModel.find({ _id: { $in: Array.from(teamIds) } }).lean();
      for (const t of teams) {
        maps.teamById.set(String(t._id), { name: t.name, memberCount: t.members.length });
      }
    }
    if (usernames.size > 0) {
      const users = await this.userModel.find({ username: { $in: Array.from(usernames) } }).lean();
      for (const u of users) maps.userByUsername.set(u.username, u.fullName);
    }
  }
}
