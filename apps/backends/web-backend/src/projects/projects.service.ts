import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, isValidObjectId } from "mongoose";
import {
  type CreateProjectRequest,
  type OwnedProjectsResponse,
  type Project as ProjectDto,
  type ProjectAccessRole,
  type ProjectShareRole,
  type ProjectTeamShareEntry,
  type ProjectUserShareEntry,
  type RecentProjectResponse,
  type RiskMode,
  type SharedProjectsResponse,
  type UpdateProjectRequest,
  type WorkbookShareAccess,
  type WorkbookShareEntry,
  type WorkbookSharesResponse,
  riskModeLabel,
} from "interfaces-shared-types";
import { User, type UserDocument } from "../users/user.schema";
import { Team, type TeamDocument } from "../teams/team.schema";
import { Project, type ProjectCollaborator, type ProjectDocument } from "./project.schema";
import { EventBus } from "../events/event-bus";
import { AnalyticsService } from "../analytics/analytics.service";

function computeInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const NEW_PROJECT_MODE: RiskMode = "full-scope";

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

function scopeOf(entry: ProjectCollaborator): string | null {
  return entry.workbookId ?? null;
}

function casualAccessOf(doc: ProjectDocument, username: string, workbookId: string | undefined): WorkbookShareAccess | null {
  let best: WorkbookShareAccess | null = null;
  for (const entry of doc.collaborators) {
    if (entry.username !== username) continue;
    const scope = scopeOf(entry);
    if (scope !== null && scope !== workbookId) continue;
    if (entry.access === "edit") return "edit";
    best = "view";
  }
  return best;
}

function casualRole(doc: ProjectDocument, viewer: string): ProjectAccessRole | null {
  let best: ProjectAccessRole | null = null;
  for (const entry of doc.collaborators) {
    if (entry.username !== viewer) continue;
    const role: ProjectAccessRole = scopeOf(entry) === null && entry.access === "edit" ? "editor" : "viewer";
    if (best === null || rolePriority(role) > rolePriority(best)) best = role;
  }
  return best;
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
  const casual = casualRole(doc, viewer);
  if (casual !== null && (best === null || rolePriority(casual) > rolePriority(best))) best = casual;
  return best;
}

function toDto(doc: ProjectDocument, viewer: string, maps: ResolverMaps): ProjectDto {
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
    pinned: doc.pinned,
    state: doc.state === "archived" ? "archived" : "active",
    pageLayout: doc.pageLayout ?? "modern",
    version: doc.version ?? 1,
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
    private readonly eventBus: EventBus,
    @Optional() private readonly analytics?: AnalyticsService,
  ) {}

  async createProject(payload: CreateProjectRequest, acting: ActingUser): Promise<ProjectDto> {
    const owner = await this.userModel.findOne({ username: acting.username }).lean();
    if (!owner) throw new NotFoundException("Acting user not found");
    const created = await this.projectModel.create({
      name: payload.name,
      mode: NEW_PROJECT_MODE,
      ownerUsername: owner.username,
      ownerFullName: owner.fullName,
      sharedTeams: [],
      sharedUsers: [],
      pinned: false,
      state: "active",
      pageLayout: payload.pageLayout ?? "modern",
    });
    try {
      await this.analytics?.recordProjectCreated({
        userId: String(owner._id),
        username: owner.username,
        projectId: String(created._id),
        projectType: NEW_PROJECT_MODE,
      });
    } catch (error) {
      console.error("Could not record project analytics", error);
    }
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
          { "collaborators.username": acting.username },
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

  async resolveAccess(id: string, acting: ActingUser, workbookId?: string): Promise<{ doc: ProjectDocument; role: ProjectAccessRole }> {
    if (!isValidObjectId(id)) throw new NotFoundException("Project not found");
    const doc = await this.projectModel.findById(id).exec();
    if (!doc) throw new NotFoundException("Project not found");
    const maps = await this.buildSharedMaps(acting.username);
    const role = computeRole(doc, acting.username, maps.myTeamIds);
    if (role === null) throw new NotFoundException("Project not found");
    if (role === "viewer" && workbookId !== undefined && casualAccessOf(doc, acting.username, workbookId) === "edit") {
      return { doc, role: "editor" };
    }
    return { doc, role };
  }

  async casualAccess(id: string, username: string, workbookId?: string): Promise<WorkbookShareAccess | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await this.projectModel.findById(id).exec();
    if (!doc) return null;
    return casualAccessOf(doc, username, workbookId);
  }

  async projectCollaborators(id: string, acting: ActingUser): Promise<WorkbookSharesResponse> {
    const { doc } = await this.resolveAccess(id, acting);
    return this.sharesResponse(doc, null, doc.ownerUsername === acting.username, acting.username);
  }

  async shareProjectCasually(id: string, identifier: string, access: WorkbookShareAccess, acting: ActingUser): Promise<WorkbookSharesResponse> {
    const doc = await this.findOwned(id, acting);
    const target = await this.upsertCollaborator(doc, null, identifier, access, acting);
    if (target !== null) {
      await this.eventBus.emit({ type: "project.collaborator_added", projectId: id, projectName: doc.name, actor: acting.username, target, access });
    }
    return this.sharesResponse(doc, null, true, acting.username);
  }

  async updateProjectCollaborator(id: string, username: string, access: WorkbookShareAccess, acting: ActingUser): Promise<WorkbookSharesResponse> {
    const doc = await this.findOwned(id, acting);
    await this.changeCollaborator(doc, null, username, access);
    return this.sharesResponse(doc, null, true, acting.username);
  }

  async removeProjectCollaborator(id: string, username: string, acting: ActingUser): Promise<WorkbookSharesResponse> {
    const doc = await this.findOwned(id, acting);
    await this.dropCollaborator(doc, null, username);
    return this.sharesResponse(doc, null, true, acting.username);
  }

  async workbookShares(projectId: string, workbookId: string, canShare: boolean, acting: ActingUser): Promise<WorkbookSharesResponse> {
    const { doc } = await this.resolveAccess(projectId, acting, workbookId);
    return this.sharesResponse(doc, workbookId, canShare, acting.username);
  }

  async shareWorkbookCasually(projectId: string, workbookId: string, identifier: string, access: WorkbookShareAccess, acting: ActingUser): Promise<{ projectName: string; target: string | null; shares: WorkbookSharesResponse }> {
    const doc = await this.findExisting(projectId);
    const target = await this.upsertCollaborator(doc, workbookId, identifier, access, acting);
    return { projectName: doc.name, target, shares: await this.sharesResponse(doc, workbookId, true, acting.username) };
  }

  async updateWorkbookCollaborator(projectId: string, workbookId: string, username: string, access: WorkbookShareAccess, acting: ActingUser): Promise<WorkbookSharesResponse> {
    const doc = await this.findExisting(projectId);
    await this.changeCollaborator(doc, workbookId, username, access);
    return this.sharesResponse(doc, workbookId, true, acting.username);
  }

  async removeWorkbookCollaborator(projectId: string, workbookId: string, username: string, acting: ActingUser): Promise<WorkbookSharesResponse> {
    const doc = await this.findExisting(projectId);
    await this.dropCollaborator(doc, workbookId, username);
    return this.sharesResponse(doc, workbookId, true, acting.username);
  }

  async forgetWorkbookCollaborators(projectId: string, workbookId: string): Promise<void> {
    if (!isValidObjectId(projectId)) return;
    await this.projectModel.updateOne({ _id: projectId }, { $pull: { collaborators: { workbookId } } }).exec();
  }

  private async findExisting(id: string): Promise<ProjectDocument> {
    if (!isValidObjectId(id)) throw new NotFoundException("Project not found");
    const doc = await this.projectModel.findById(id).exec();
    if (!doc) throw new NotFoundException("Project not found");
    return doc;
  }

  private async sharesResponse(doc: ProjectDocument, workbookId: string | null, canShare: boolean, username: string): Promise<WorkbookSharesResponse> {
    const own = doc.collaborators.find((entry) => entry.username === username && scopeOf(entry) === workbookId);
    const myAccess = workbookId === null ? own?.access ?? null : casualAccessOf(doc, username, workbookId);
    return { canShare, myAccess, entries: canShare ? await this.collaboratorEntries(doc, workbookId) : [] };
  }

  private async collaboratorEntries(doc: ProjectDocument, workbookId: string | null): Promise<WorkbookShareEntry[]> {
    const scoped = doc.collaborators.filter((entry) => scopeOf(entry) === workbookId);
    if (scoped.length === 0) return [];
    const users = await this.userModel.find({ username: { $in: scoped.map((entry) => entry.username) } }, { username: 1, fullName: 1 }).lean();
    const names = new Map(users.map((user) => [user.username, user.fullName]));
    return scoped.map((entry) => ({
      username: entry.username,
      fullName: names.get(entry.username) ?? entry.username,
      access: entry.access,
      sharedBy: entry.sharedBy,
      sharedAt: new Date(entry.sharedAt).toISOString(),
    }));
  }

  private async upsertCollaborator(doc: ProjectDocument, workbookId: string | null, identifier: string, access: WorkbookShareAccess, acting: ActingUser): Promise<string | null> {
    const resolved = await this.resolveByIdentifier(identifier);
    if (resolved.username === doc.ownerUsername) throw new BadRequestException("The project owner already has access");
    if (resolved.username === acting.username) throw new BadRequestException("You already have access");
    const existing = doc.collaborators.find((entry) => entry.username === resolved.username && scopeOf(entry) === workbookId);
    if (existing !== undefined) {
      existing.access = access;
      doc.markModified("collaborators");
      await doc.save();
      return null;
    }
    doc.collaborators.push({ username: resolved.username, access, workbookId, sharedBy: acting.username, sharedAt: new Date() });
    doc.markModified("collaborators");
    await doc.save();
    return resolved.username;
  }

  private async changeCollaborator(doc: ProjectDocument, workbookId: string | null, username: string, access: WorkbookShareAccess): Promise<void> {
    const entry = doc.collaborators.find((candidate) => candidate.username === username && scopeOf(candidate) === workbookId);
    if (entry === undefined) throw new NotFoundException("It is not shared with that user");
    entry.access = access;
    doc.markModified("collaborators");
    await doc.save();
  }

  private async dropCollaborator(doc: ProjectDocument, workbookId: string | null, username: string): Promise<void> {
    const before = doc.collaborators.length;
    doc.collaborators = doc.collaborators.filter((entry) => !(entry.username === username && scopeOf(entry) === workbookId));
    if (doc.collaborators.length === before) throw new NotFoundException("It is not shared with that user");
    doc.markModified("collaborators");
    await doc.save();
  }

  async updateProject(id: string, payload: UpdateProjectRequest, acting: ActingUser): Promise<ProjectDto> {
    const doc = await this.findOwned(id, acting);
    if (payload.name !== undefined) doc.name = payload.name;
    if (payload.pinned !== undefined) doc.pinned = payload.pinned;
    if (payload.state !== undefined) doc.state = payload.state;
    if (payload.pageLayout !== undefined) doc.pageLayout = payload.pageLayout;
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
      pinned: false,
      state: "active",
      pageLayout: original.pageLayout ?? "modern",
    });
    return toDto(created, acting.username, await this.buildMaps([created], acting.username));
  }

  async deleteProject(id: string, acting: ActingUser): Promise<void> {
    const doc = await this.findOwned(id, acting);
    const name = doc.name;
    await doc.deleteOne();
    await this.eventBus.emit({ type: "project.deleted", projectId: id, projectName: name, actor: acting.username });
  }

  async shareWithTeam(id: string, teamId: string, role: ProjectShareRole, acting: ActingUser): Promise<ProjectDto> {
    const doc = await this.findOwned(id, acting);
    const team = await this.assertTeamAffiliation(teamId, acting.username);
    if (doc.sharedTeams.some((s) => s.teamId === teamId)) {
      throw new ConflictException("Project is already shared with that team");
    }
    doc.sharedTeams.push({ teamId, role });
    doc.markModified("sharedTeams");
    await doc.save();
    const teamMembers = Array.from(new Set([team.adminUsername, ...team.members]));
    await this.eventBus.emit({
      type: "project.shared_team",
      projectId: id,
      projectName: doc.name,
      actor: acting.username,
      teamId,
      teamName: team.name,
      role,
      teamMembers,
    });
    return toDto(doc, acting.username, await this.buildMaps([doc], acting.username));
  }

  async unshareFromTeam(id: string, teamId: string, acting: ActingUser): Promise<void> {
    const doc = await this.findOwned(id, acting);
    const before = doc.sharedTeams.length;
    doc.sharedTeams = doc.sharedTeams.filter((s) => s.teamId !== teamId);
    if (doc.sharedTeams.length === before) throw new NotFoundException("Project is not shared with that team");
    doc.markModified("sharedTeams");
    await doc.save();
    const team = await this.teamModel.findById(teamId).lean();
    await this.eventBus.emit({
      type: "project.unshared_team",
      projectId: id,
      projectName: doc.name,
      actor: acting.username,
      teamId,
      teamName: team?.name ?? "(deleted team)",
    });
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
    await this.eventBus.emit({
      type: "project.shared_user",
      projectId: id,
      projectName: doc.name,
      actor: acting.username,
      target: resolved.username,
      role,
    });
    return toDto(doc, acting.username, await this.buildMaps([doc], acting.username));
  }

  async unshareFromUser(id: string, username: string, acting: ActingUser): Promise<void> {
    const doc = await this.findOwned(id, acting);
    const before = doc.sharedUsers.length;
    doc.sharedUsers = doc.sharedUsers.filter((s) => s.username !== username);
    if (doc.sharedUsers.length === before) throw new NotFoundException("Project is not shared with that user");
    doc.markModified("sharedUsers");
    await doc.save();
    await this.eventBus.emit({
      type: "project.unshared_user",
      projectId: id,
      projectName: doc.name,
      actor: acting.username,
      target: username,
    });
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

  private async assertTeamAffiliation(teamId: string, username: string): Promise<TeamDocument> {
    if (!isValidObjectId(teamId)) throw new NotFoundException("Team not found");
    const team = await this.teamModel.findById(teamId).exec();
    if (!team) throw new NotFoundException("Team not found");
    const isMember = team.adminUsername === username || team.members.includes(username);
    if (!isMember) throw new ForbiddenException("You are not a member of that team");
    return team;
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
