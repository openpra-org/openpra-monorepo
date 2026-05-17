import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, isValidObjectId } from "mongoose";
import type {
  AvailableTeamsResponse,
  CreateTeamRequest,
  MyTeamsResponse,
  Team as TeamDto,
  TeamRole,
} from "interfaces-shared-types";
import { Team, type TeamDocument } from "./team.schema";

function roleFor(doc: TeamDocument, username: string): TeamRole | null {
  if (doc.adminUsername === username) return "admin";
  if (doc.members.includes(username)) return "member";
  if (doc.pending.includes(username)) return "pending";
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

@Injectable()
export class TeamsService {
  constructor(@InjectModel(Team.name) private readonly teamModel: Model<TeamDocument>) {}

  async createTeam(payload: CreateTeamRequest, username: string): Promise<TeamDto> {
    const created = await this.teamModel.create({
      name: payload.name,
      organization: payload.organization,
      description: payload.description,
      visibility: payload.visibility,
      adminUsername: username,
      members: [username],
      pending: [],
    });
    return toDto(created, username);
  }

  async getMyTeams(username: string): Promise<MyTeamsResponse> {
    const docs = await this.teamModel
      .find({ $or: [{ adminUsername: username }, { members: username }, { pending: username }] })
      .sort({ updatedAt: -1 })
      .exec();
    return { teams: docs.map((d) => toDto(d, username)) };
  }

  async getAvailableTeams(username: string, query: string | undefined): Promise<AvailableTeamsResponse> {
    const filter: Record<string, unknown> = {
      adminUsername: { $ne: username },
      members: { $ne: username },
      pending: { $ne: username },
    };
    const q = (query ?? "").trim();
    if (q.length > 0) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: re }, { organization: re }, { description: re }];
    }
    const docs = await this.teamModel.find(filter).sort({ updatedAt: -1 }).exec();
    return { teams: docs.map((d) => toDto(d, username)) };
  }

  async joinTeam(id: string, username: string): Promise<TeamDto> {
    const doc = await this.findById(id);
    if (doc.adminUsername === username || doc.members.includes(username)) {
      throw new ConflictException("Already a member of this team");
    }
    if (doc.pending.includes(username)) {
      throw new ConflictException("Join request already pending");
    }
    if (doc.visibility === "public") {
      doc.members.push(username);
    } else {
      doc.pending.push(username);
    }
    await doc.save();
    return toDto(doc, username);
  }

  async leaveTeam(id: string, username: string): Promise<void> {
    const doc = await this.findById(id);
    if (doc.adminUsername === username) {
      throw new ForbiddenException("Admins cannot leave; transfer ownership or delete the team");
    }
    const wasMember = doc.members.includes(username);
    const wasPending = doc.pending.includes(username);
    if (!wasMember && !wasPending) {
      throw new BadRequestException("Not a member of this team");
    }
    doc.members = doc.members.filter((u) => u !== username);
    doc.pending = doc.pending.filter((u) => u !== username);
    await doc.save();
  }

  private async findById(id: string): Promise<TeamDocument> {
    if (!isValidObjectId(id)) throw new NotFoundException("Team not found");
    const doc = await this.teamModel.findById(id).exec();
    if (!doc) throw new NotFoundException("Team not found");
    return doc;
  }
}
