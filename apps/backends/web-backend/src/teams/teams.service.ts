import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, isValidObjectId } from "mongoose";
import type {
  AvailableTeamsResponse,
  BulkInviteResponse,
  BulkInviteResult,
  CreateTeamRequest,
  MyInvitationsResponse,
  MyTeamsResponse,
  Team as TeamDto,
  TeamDetail,
  TeamInviteEntry,
  TeamRole,
  TeamRosterEntry,
  UpdateTeamRequest,
} from "interfaces-shared-types";
import { Team, type TeamDocument, type TeamInvite } from "./team.schema";
import { User, type UserDocument } from "../users/user.schema";
import { OrgsService } from "../orgs/orgs.service";
import { EventBus } from "../events/event-bus";
import { StorageService } from "../users/storage.service";

const INVITE_TTL_DAYS = 14;
const TEAM_AVATAR_FOLDER = "team-avatars";

function computeInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function escapeForRegex(input: string): string {
  let out = "";
  for (const ch of input) {
    if (".*+?^${}()|[]\\".indexOf(ch) >= 0) out += "\\";
    out += ch;
  }
  return out;
}

function inviteExpiry(): Date {
  return new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function activeInvite(doc: TeamDocument, username: string): TeamInvite | null {
  const now = Date.now();
  const found = doc.invites.find((i) => i.username === username);
  if (!found) return null;
  return found.expiresAt.getTime() > now ? found : null;
}

function roleFor(doc: TeamDocument, username: string): TeamRole | null {
  if (doc.adminUsername === username) return "admin";
  if (doc.leads.includes(username)) return "lead";
  if (doc.members.includes(username)) return "member";
  if (activeInvite(doc, username) !== null) return "invited";
  return null;
}

function memberRoleFor(doc: TeamDocument, username: string): TeamRole | null {
  if (doc.adminUsername === username) return "admin";
  if (doc.leads.includes(username)) return "lead";
  if (doc.members.includes(username)) return "member";
  return null;
}

interface ResolvedUser {
  username: string;
  fullName: string;
}

@Injectable()
export class TeamsService implements OnModuleInit {
  constructor(
    @InjectModel(Team.name) private readonly teamModel: Model<TeamDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly orgsService: OrgsService,
    private readonly eventBus: EventBus,
    private readonly storage: StorageService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.migrateLegacyInvites();
  }

  private toDto(doc: TeamDocument, viewer: string | null): TeamDto {
    return {
      id: String(doc._id),
      name: doc.name,
      organization: doc.organization,
      description: doc.description,
      visibility: doc.visibility,
      adminUsername: doc.adminUsername,
      memberCount: doc.members.length,
      role: viewer === null ? null : roleFor(doc, viewer),
      avatarUrl: this.storage.urlForKey(doc.avatarKey),
    };
  }

  async createTeam(payload: CreateTeamRequest, username: string): Promise<TeamDto> {
    const resolved = await this.orgsService.findOrCreate(payload.organization, username);
    const created = await this.teamModel.create({
      name: payload.name,
      organization: resolved?.name ?? "",
      organizationId: resolved?.id ?? null,
      description: payload.description,
      visibility: payload.visibility,
      adminUsername: username,
      members: [username],
      leads: [],
      invites: [],
    });
    return this.toDto(created, username);
  }

  async getMyTeams(username: string): Promise<MyTeamsResponse> {
    const docs = await this.teamModel
      .find({ $or: [{ adminUsername: username }, { members: username }] })
      .sort({ updatedAt: -1 })
      .exec();
    return { teams: docs.map((d) => this.toDto(d, username)) };
  }

  async getMyInvitations(username: string): Promise<MyInvitationsResponse> {
    const docs = await this.teamModel
      .find({ invites: { $elemMatch: { username, expiresAt: { $gt: new Date() } } } })
      .sort({ updatedAt: -1 })
      .exec();
    return { teams: docs.map((d) => this.toDto(d, username)) };
  }

  async getAvailableTeams(username: string, query: string | undefined): Promise<AvailableTeamsResponse> {
    const filter: Record<string, unknown> = {
      visibility: "public",
      adminUsername: { $ne: username },
      members: { $ne: username },
      "invites.username": { $ne: username },
    };
    const q = (query ?? "").trim();
    if (q.length > 0) {
      const re = new RegExp(escapeForRegex(q), "i");
      filter.$or = [{ name: re }, { organization: re }, { description: re }];
    }
    const docs = await this.teamModel.find(filter).sort({ updatedAt: -1 }).exec();
    return { teams: docs.map((d) => this.toDto(d, username)) };
  }

  async getTeamDetail(id: string, username: string): Promise<TeamDetail> {
    const doc = await this.findById(id);
    const role = roleFor(doc, username);
    if (role === null && doc.visibility === "private") {
      throw new NotFoundException("Team not found");
    }

    const canSeeInvited = role === "admin" || role === "lead";
    const members = await this.resolveRoster(doc, doc.members);
    const activeInvites = doc.invites.filter((i) => i.expiresAt.getTime() > Date.now());
    const invited = canSeeInvited
      ? await this.resolveInvites(activeInvites)
      : role === "invited"
        ? await this.resolveInvites(activeInvites.filter((i) => i.username === username))
        : [];

    return {
      ...this.toDto(doc, username),
      members,
      invited,
    };
  }

  async joinTeam(id: string, username: string): Promise<TeamDto> {
    const doc = await this.findById(id);
    if (doc.visibility !== "public") {
      throw new NotFoundException("Team not found");
    }
    if (doc.adminUsername === username || doc.members.includes(username)) {
      throw new ConflictException("Already a member of this team");
    }
    if (activeInvite(doc, username) !== null) {
      throw new ConflictException("Open invitation pending — accept it instead");
    }
    doc.members.push(username);
    doc.invites = doc.invites.filter((i) => i.username !== username);
    doc.markModified("invites");
    await doc.save();
    await this.eventBus.emit({ type: "team.member_joined", teamId: id, teamName: doc.name, actor: username });
    return this.toDto(doc, username);
  }

  async leaveTeam(id: string, username: string): Promise<void> {
    const doc = await this.findById(id);
    if (doc.adminUsername === username) {
      throw new ForbiddenException("Admins cannot leave; transfer admin first, or delete the team");
    }
    if (!doc.members.includes(username)) {
      throw new BadRequestException("Not a member of this team");
    }
    doc.members = doc.members.filter((u) => u !== username);
    doc.leads = doc.leads.filter((u) => u !== username);
    await doc.save();
    await this.eventBus.emit({ type: "team.left", teamId: id, teamName: doc.name, actor: username });
  }

  async updateTeam(id: string, payload: UpdateTeamRequest, username: string): Promise<TeamDto> {
    const doc = await this.findAsAdmin(id, username);
    if (payload.name !== undefined) doc.name = payload.name;
    if (payload.organization !== undefined) {
      const resolved = await this.orgsService.findOrCreate(payload.organization, username);
      doc.organization = resolved?.name ?? "";
      doc.organizationId = resolved?.id ?? null;
    }
    if (payload.description !== undefined) doc.description = payload.description;
    if (payload.visibility !== undefined) doc.visibility = payload.visibility;
    await doc.save();
    return this.toDto(doc, username);
  }

  async deleteTeam(id: string, username: string): Promise<void> {
    const doc = await this.findAsAdmin(id, username);
    const avatarKey = doc.avatarKey;
    await doc.deleteOne();
    await this.storage.deleteByKey(avatarKey);
  }

  async transferAdmin(id: string, target: string, acting: string): Promise<TeamDto> {
    const doc = await this.findAsAdmin(id, acting);
    if (target === acting) throw new BadRequestException("You are already the admin");
    if (!doc.members.includes(target)) throw new BadRequestException("New admin must be an existing member");
    doc.adminUsername = target;
    if (!doc.members.includes(acting)) doc.members.push(acting);
    doc.leads = doc.leads.filter((u) => u !== target);
    await doc.save();
    await this.eventBus.emit({ type: "team.admin_transferred", teamId: id, teamName: doc.name, actor: acting, target });
    return this.toDto(doc, acting);
  }

  async promoteToLead(id: string, target: string, acting: string): Promise<TeamDto> {
    const doc = await this.findAsAdmin(id, acting);
    if (target === doc.adminUsername) throw new BadRequestException("The admin cannot also be a lead");
    if (!doc.members.includes(target)) throw new NotFoundException("User is not a member");
    if (doc.leads.includes(target)) throw new ConflictException("User is already a lead");
    doc.leads.push(target);
    await doc.save();
    await this.eventBus.emit({ type: "team.lead_promoted", teamId: id, teamName: doc.name, actor: acting, target });
    return this.toDto(doc, acting);
  }

  async demoteFromLead(id: string, target: string, acting: string): Promise<TeamDto> {
    const doc = await this.findAsAdmin(id, acting);
    if (!doc.leads.includes(target)) throw new NotFoundException("User is not a lead");
    doc.leads = doc.leads.filter((u) => u !== target);
    await doc.save();
    await this.eventBus.emit({ type: "team.lead_demoted", teamId: id, teamName: doc.name, actor: acting, target });
    return this.toDto(doc, acting);
  }

  async inviteUser(id: string, identifier: string, acting: string): Promise<TeamDto> {
    const doc = await this.findAsManager(id, acting);
    const invitee = await this.resolveByIdentifier(identifier);
    if (invitee.username === doc.adminUsername || doc.members.includes(invitee.username)) {
      throw new ConflictException("User is already a member");
    }
    if (activeInvite(doc, invitee.username) !== null) {
      throw new ConflictException("User already has an open invitation");
    }
    this.upsertInvite(doc, invitee.username, acting);
    await doc.save();
    await this.eventBus.emit({ type: "team.invited", teamId: id, teamName: doc.name, actor: acting, target: invitee.username });
    return this.toDto(doc, acting);
  }

  async bulkInvite(id: string, identifiers: string[], acting: string): Promise<BulkInviteResponse> {
    const doc = await this.findAsManager(id, acting);
    const results: BulkInviteResult[] = [];
    const invitedNow: string[] = [];
    const seen = new Set<string>();
    for (const raw of identifiers) {
      const identifier = raw.trim();
      if (identifier === "" || seen.has(identifier.toLowerCase())) continue;
      seen.add(identifier.toLowerCase());
      let invitee: ResolvedUser;
      try {
        invitee = await this.resolveByIdentifier(identifier);
      } catch {
        results.push({ identifier, status: "not-found" });
        continue;
      }
      if (invitee.username === doc.adminUsername || doc.members.includes(invitee.username)) {
        results.push({ identifier, status: "already-member" });
        continue;
      }
      if (activeInvite(doc, invitee.username) !== null) {
        results.push({ identifier, status: "already-invited" });
        continue;
      }
      this.upsertInvite(doc, invitee.username, acting);
      invitedNow.push(invitee.username);
      results.push({ identifier, status: "invited" });
    }
    if (invitedNow.length > 0) {
      await doc.save();
      for (const username of invitedNow) {
        await this.eventBus.emit({ type: "team.invited", teamId: id, teamName: doc.name, actor: acting, target: username });
      }
    }
    return { results };
  }

  async cancelInvite(id: string, target: string, acting: string): Promise<void> {
    const doc = await this.findAsManager(id, acting);
    if (!doc.invites.some((i) => i.username === target)) throw new NotFoundException("No invitation for that user");
    doc.invites = doc.invites.filter((i) => i.username !== target);
    doc.markModified("invites");
    await doc.save();
  }

  async acceptInvite(id: string, username: string): Promise<TeamDto> {
    const doc = await this.findById(id);
    const present = doc.invites.some((i) => i.username === username);
    if (!present) throw new NotFoundException("No invitation for that user");
    if (activeInvite(doc, username) === null) {
      doc.invites = doc.invites.filter((i) => i.username !== username);
      doc.markModified("invites");
      await doc.save();
      throw new BadRequestException("This invitation has expired — ask an admin to re-invite you");
    }
    doc.invites = doc.invites.filter((i) => i.username !== username);
    doc.members.push(username);
    doc.markModified("invites");
    await doc.save();
    await this.eventBus.emit({ type: "team.member_joined", teamId: id, teamName: doc.name, actor: username });
    return this.toDto(doc, username);
  }

  async declineInvite(id: string, username: string): Promise<void> {
    const doc = await this.findById(id);
    if (!doc.invites.some((i) => i.username === username)) throw new NotFoundException("No invitation for that user");
    doc.invites = doc.invites.filter((i) => i.username !== username);
    doc.markModified("invites");
    await doc.save();
  }

  async kickMember(id: string, target: string, acting: string): Promise<void> {
    const doc = await this.findAsManager(id, acting);
    if (target === doc.adminUsername) throw new ForbiddenException("Cannot remove the team admin");
    if (target === acting) throw new ForbiddenException("Use Leave team to remove yourself");
    if (doc.leads.includes(target) && doc.adminUsername !== acting) {
      throw new ForbiddenException("Only the admin can remove a lead");
    }
    if (!doc.members.includes(target)) throw new NotFoundException("User is not a member");
    doc.members = doc.members.filter((u) => u !== target);
    doc.leads = doc.leads.filter((u) => u !== target);
    await doc.save();
    await this.eventBus.emit({ type: "team.kicked", teamId: id, teamName: doc.name, actor: acting, target });
  }

  async setAvatar(id: string, file: { buffer: Buffer; mimetype: string; size: number; originalname: string }, acting: string): Promise<TeamDto> {
    const doc = await this.findAsAdmin(id, acting);
    if (!this.storage.isAllowedMime(file.mimetype)) {
      throw new BadRequestException("Only PNG, JPEG, or WebP images are allowed");
    }
    const previousKey = doc.avatarKey;
    const nextKey = await this.storage.uploadImage(TEAM_AVATAR_FOLDER, String(doc._id), {
      buffer: file.buffer,
      mimeType: file.mimetype,
      size: file.size,
      originalName: file.originalname,
    });
    doc.avatarKey = nextKey;
    await doc.save();
    await this.storage.deleteByKey(previousKey);
    return this.toDto(doc, acting);
  }

  async clearAvatar(id: string, acting: string): Promise<TeamDto> {
    const doc = await this.findAsAdmin(id, acting);
    const previousKey = doc.avatarKey;
    doc.avatarKey = null;
    await doc.save();
    await this.storage.deleteByKey(previousKey);
    return this.toDto(doc, acting);
  }

  private upsertInvite(doc: TeamDocument, username: string, invitedBy: string): void {
    const existing = doc.invites.find((i) => i.username === username);
    const expiresAt = inviteExpiry();
    if (existing) {
      existing.invitedBy = invitedBy;
      existing.expiresAt = expiresAt;
    } else {
      doc.invites.push({ username, invitedBy, expiresAt });
    }
    doc.markModified("invites");
  }

  private async findById(id: string): Promise<TeamDocument> {
    if (!isValidObjectId(id)) throw new NotFoundException("Team not found");
    const doc = await this.teamModel.findById(id).exec();
    if (!doc) throw new NotFoundException("Team not found");
    return doc;
  }

  private async findAsAdmin(id: string, username: string): Promise<TeamDocument> {
    const doc = await this.findById(id);
    if (doc.adminUsername !== username) throw new ForbiddenException("Admin only");
    return doc;
  }

  private async findAsManager(id: string, username: string): Promise<TeamDocument> {
    const doc = await this.findById(id);
    const role = memberRoleFor(doc, username);
    if (role !== "admin" && role !== "lead") throw new ForbiddenException("Admin or lead only");
    return doc;
  }

  private async resolveByIdentifier(identifier: string): Promise<ResolvedUser> {
    const normalized = identifier.trim().toLowerCase();
    const user = await this.userModel
      .findOne({ $or: [{ username: identifier.trim() }, { email: normalized }] })
      .lean();
    if (!user) throw new NotFoundException(`No user found for "${identifier}"`);
    return { username: user.username, fullName: user.fullName };
  }

  private async resolveRoster(doc: TeamDocument, usernames: string[]): Promise<TeamRosterEntry[]> {
    if (usernames.length === 0) return [];
    const users = await this.userModel.find({ username: { $in: usernames } }).lean();
    const byUsername = new Map(users.map((u) => [u.username, u]));
    return usernames.map((u) => {
      const found = byUsername.get(u);
      const fullName = found?.fullName ?? u;
      const role = roleFor(doc, u) ?? "member";
      return { username: u, fullName, initials: computeInitials(fullName), role };
    });
  }

  private async resolveInvites(invites: TeamInvite[]): Promise<TeamInviteEntry[]> {
    if (invites.length === 0) return [];
    const usernames = invites.map((i) => i.username);
    const users = await this.userModel.find({ username: { $in: usernames } }).lean();
    const byUsername = new Map(users.map((u) => [u.username, u]));
    return invites.map((i) => {
      const found = byUsername.get(i.username);
      const fullName = found?.fullName ?? i.username;
      return {
        username: i.username,
        fullName,
        initials: computeInitials(fullName),
        invitedBy: i.invitedBy,
        expiresAt: i.expiresAt.toISOString(),
      };
    });
  }

  private async migrateLegacyInvites(): Promise<void> {
    const legacy = await this.teamModel
      .find({ invited: { $exists: true, $ne: [] } })
      .lean();
    if (legacy.length === 0) return;
    const expiresAt = inviteExpiry();
    for (const team of legacy) {
      const usernames = (team as { invited?: string[] }).invited ?? [];
      const invites = usernames.map((username) => ({ username, invitedBy: team.adminUsername, expiresAt }));
      await this.teamModel.updateOne(
        { _id: team._id },
        { $set: { invites }, $unset: { invited: "" } },
      );
    }
  }
}
