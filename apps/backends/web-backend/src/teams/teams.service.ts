import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, isValidObjectId } from "mongoose";
import type {
  AvailableTeamsResponse,
  CreateTeamRequest,
  MyInvitationsResponse,
  MyTeamsResponse,
  Team as TeamDto,
  TeamDetail,
  TeamRole,
  TeamRosterEntry,
  UpdateTeamRequest,
} from "interfaces-shared-types";
import { Team, type TeamDocument } from "./team.schema";
import { User, type UserDocument } from "../users/user.schema";

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

function roleFor(doc: TeamDocument, username: string): TeamRole | null {
  if (doc.adminUsername === username) return "admin";
  if (doc.members.includes(username)) return "member";
  if (doc.invited.includes(username)) return "invited";
  return null;
}

function toDto(doc: TeamDocument, viewer: string | null): TeamDto {
  return {
    id: String(doc._id),
    name: doc.name,
    organization: doc.organization,
    description: doc.description,
    visibility: doc.visibility,
    adminUsername: doc.adminUsername,
    memberCount: doc.members.length,
    role: viewer === null ? null : roleFor(doc, viewer),
  };
}

interface ResolvedUser {
  username: string;
  fullName: string;
}

@Injectable()
export class TeamsService {
  constructor(
    @InjectModel(Team.name) private readonly teamModel: Model<TeamDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async createTeam(payload: CreateTeamRequest, username: string): Promise<TeamDto> {
    const created = await this.teamModel.create({
      name: payload.name,
      organization: payload.organization,
      description: payload.description,
      visibility: payload.visibility,
      adminUsername: username,
      members: [username],
      invited: [],
    });
    return toDto(created, username);
  }

  async getMyTeams(username: string): Promise<MyTeamsResponse> {
    const docs = await this.teamModel
      .find({ $or: [{ adminUsername: username }, { members: username }] })
      .sort({ updatedAt: -1 })
      .exec();
    return { teams: docs.map((d) => toDto(d, username)) };
  }

  async getMyInvitations(username: string): Promise<MyInvitationsResponse> {
    const docs = await this.teamModel
      .find({ invited: username })
      .sort({ updatedAt: -1 })
      .exec();
    return { teams: docs.map((d) => toDto(d, username)) };
  }

  async getAvailableTeams(username: string, query: string | undefined): Promise<AvailableTeamsResponse> {
    const filter: Record<string, unknown> = {
      visibility: "public",
      adminUsername: { $ne: username },
      members: { $ne: username },
      invited: { $ne: username },
    };
    const q = (query ?? "").trim();
    if (q.length > 0) {
      const re = new RegExp(escapeForRegex(q), "i");
      filter.$or = [{ name: re }, { organization: re }, { description: re }];
    }
    const docs = await this.teamModel.find(filter).sort({ updatedAt: -1 }).exec();
    return { teams: docs.map((d) => toDto(d, username)) };
  }

  async getTeamDetail(id: string, username: string): Promise<TeamDetail> {
    const doc = await this.findById(id);
    const role = roleFor(doc, username);
    if (role === null && doc.visibility === "private") {
      throw new NotFoundException("Team not found");
    }

    const isAdmin = role === "admin";
    const members = await this.resolveRoster(doc.members);
    const invited = isAdmin
      ? await this.resolveRoster(doc.invited)
      : role === "invited"
        ? await this.resolveRoster([username])
        : [];

    return {
      ...toDto(doc, username),
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
    if (doc.invited.includes(username)) {
      throw new ConflictException("Open invitation pending — accept it instead");
    }
    doc.members.push(username);
    await doc.save();
    return toDto(doc, username);
  }

  async leaveTeam(id: string, username: string): Promise<void> {
    const doc = await this.findById(id);
    if (doc.adminUsername === username) {
      throw new ForbiddenException("Admins cannot leave; transfer ownership or delete the team");
    }
    if (!doc.members.includes(username)) {
      throw new BadRequestException("Not a member of this team");
    }
    doc.members = doc.members.filter((u) => u !== username);
    await doc.save();
  }

  async updateTeam(id: string, payload: UpdateTeamRequest, username: string): Promise<TeamDto> {
    const doc = await this.findAsAdmin(id, username);
    if (payload.name !== undefined) doc.name = payload.name;
    if (payload.organization !== undefined) doc.organization = payload.organization;
    if (payload.description !== undefined) doc.description = payload.description;
    if (payload.visibility !== undefined) doc.visibility = payload.visibility;
    await doc.save();
    return toDto(doc, username);
  }

  async deleteTeam(id: string, username: string): Promise<void> {
    const doc = await this.findAsAdmin(id, username);
    await doc.deleteOne();
  }

  async inviteUser(id: string, identifier: string, adminUsername: string): Promise<TeamDto> {
    const doc = await this.findAsAdmin(id, adminUsername);
    const invitee = await this.resolveByIdentifier(identifier);
    if (invitee.username === adminUsername || doc.members.includes(invitee.username)) {
      throw new ConflictException("User is already a member");
    }
    if (doc.invited.includes(invitee.username)) {
      throw new ConflictException("User already has an open invitation");
    }
    doc.invited.push(invitee.username);
    await doc.save();
    return toDto(doc, adminUsername);
  }

  async cancelInvite(id: string, target: string, adminUsername: string): Promise<void> {
    const doc = await this.findAsAdmin(id, adminUsername);
    if (!doc.invited.includes(target)) throw new NotFoundException("No invitation for that user");
    doc.invited = doc.invited.filter((u) => u !== target);
    await doc.save();
  }

  async acceptInvite(id: string, username: string): Promise<TeamDto> {
    const doc = await this.findById(id);
    if (!doc.invited.includes(username)) throw new NotFoundException("No invitation for that user");
    doc.invited = doc.invited.filter((u) => u !== username);
    doc.members.push(username);
    await doc.save();
    return toDto(doc, username);
  }

  async declineInvite(id: string, username: string): Promise<void> {
    const doc = await this.findById(id);
    if (!doc.invited.includes(username)) throw new NotFoundException("No invitation for that user");
    doc.invited = doc.invited.filter((u) => u !== username);
    await doc.save();
  }

  async kickMember(id: string, target: string, adminUsername: string): Promise<void> {
    const doc = await this.findAsAdmin(id, adminUsername);
    if (target === doc.adminUsername) throw new ForbiddenException("Cannot remove the team admin");
    if (!doc.members.includes(target)) throw new NotFoundException("User is not a member");
    doc.members = doc.members.filter((u) => u !== target);
    await doc.save();
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

  private async resolveByIdentifier(identifier: string): Promise<ResolvedUser> {
    const normalized = identifier.trim().toLowerCase();
    const user = await this.userModel
      .findOne({ $or: [{ username: identifier.trim() }, { email: normalized }] })
      .lean();
    if (!user) throw new NotFoundException(`No user found for "${identifier}"`);
    return { username: user.username, fullName: user.fullName };
  }

  private async resolveRoster(usernames: string[]): Promise<TeamRosterEntry[]> {
    if (usernames.length === 0) return [];
    const users = await this.userModel.find({ username: { $in: usernames } }).lean();
    const byUsername = new Map(users.map((u) => [u.username, u]));
    return usernames.map((u) => {
      const found = byUsername.get(u);
      const fullName = found?.fullName ?? u;
      return { username: u, fullName, initials: computeInitials(fullName) };
    });
  }
}
