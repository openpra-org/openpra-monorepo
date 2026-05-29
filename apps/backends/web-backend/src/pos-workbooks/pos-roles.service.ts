import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, isValidObjectId } from "mongoose";
import { ProjectsService } from "../projects/projects.service";
import { User, type UserDocument } from "../users/user.schema";
import { Team, type TeamDocument } from "../teams/team.schema";
import { PosWorkbook, type PosWorkbookDocument } from "./pos-workbook.schema";
import { PosWorkbookRole, type PosWorkbookRoleDocument, type PosWorkbookRoleName } from "./pos-workbook-role.schema";

const VALID_ROLES: PosWorkbookRoleName[] = ["preparer", "co_preparer", "reviewer", "approver"];

export interface PosUserRoleAssignment {
  kind: "user";
  username: string;
  fullName: string;
  role: PosWorkbookRoleName;
  assignedBy: string;
  assignedAt: string;
}

export interface PosTeamRoleAssignment {
  kind: "team";
  teamId: string;
  teamName: string;
  memberCount: number;
  role: PosWorkbookRoleName;
  assignedBy: string;
  assignedAt: string;
}

export type PosRoleAssignment = PosUserRoleAssignment | PosTeamRoleAssignment;

export interface PosEligibleMember {
  username: string;
  fullName: string;
  viaTeamId?: string;
}

export interface PosEligibleTeam {
  teamId: string;
  teamName: string;
  memberCount: number;
}

export interface PosRolesResponse {
  workbookId: string;
  canManage: boolean;
  myRoles: PosWorkbookRoleName[];
  assignments: PosRoleAssignment[];
  eligibleMembers: PosEligibleMember[];
  eligibleTeams: PosEligibleTeam[];
}

interface ActingUser {
  username: string;
}

@Injectable()
export class PosRolesService {
  constructor(
    @InjectModel(PosWorkbook.name) private readonly posWorkbookModel: Model<PosWorkbookDocument>,
    @InjectModel(PosWorkbookRole.name) private readonly posRoleModel: Model<PosWorkbookRoleDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Team.name) private readonly teamModel: Model<TeamDocument>,
    private readonly projectsService: ProjectsService,
  ) {}

  private membersOf(team: TeamDocument): string[] {
    const set = new Set<string>([team.adminUsername, ...team.members, ...team.leads]);
    return Array.from(set);
  }

  async myTeamIds(username: string): Promise<string[]> {
    const teams = await this.teamModel
      .find({ $or: [{ adminUsername: username }, { members: username }, { leads: username }] }, { _id: 1 })
      .lean()
      .exec();
    return teams.map((t) => String(t._id));
  }

  async resolveEffectiveRoles(workbookId: string, username: string): Promise<PosWorkbookRoleName[]> {
    const userRoleDocs = await this.posRoleModel.find({ workbookId, username }).exec();
    const teamIds = await this.myTeamIds(username);
    const teamRoleDocs = teamIds.length > 0
      ? await this.posRoleModel.find({ workbookId, teamId: { $in: teamIds } }).exec()
      : [];
    const seen = new Set<PosWorkbookRoleName>();
    for (const d of userRoleDocs) seen.add(d.role);
    for (const d of teamRoleDocs) seen.add(d.role);
    return Array.from(seen);
  }

  private async ensureSingleApprover(workbookId: string, role: PosWorkbookRoleName): Promise<void> {
    if (role !== "approver") return;
    const existing = await this.posRoleModel.findOne({ workbookId, role: "approver" }).exec();
    if (existing !== null) throw new ConflictException("Only one approver may be assigned per workbook");
  }

  async assignedUsernamesFor(workbookId: string, role: PosWorkbookRoleName): Promise<string[]> {
    const docs = await this.posRoleModel.find({ workbookId, role }).exec();
    const usernames = new Set<string>();
    const teamIds = new Set<string>();
    for (const d of docs) {
      if (typeof d.username === "string") usernames.add(d.username);
      else if (typeof d.teamId === "string") teamIds.add(d.teamId);
    }
    if (teamIds.size > 0) {
      const teams = await this.teamModel.find({ _id: { $in: Array.from(teamIds) } }).exec();
      for (const t of teams) for (const m of this.membersOf(t)) usernames.add(m);
    }
    return Array.from(usernames);
  }

  async workbookIdsAssignedTo(username: string): Promise<Map<string, PosWorkbookRoleName[]>> {
    const teamIds = await this.myTeamIds(username);
    const docs = await this.posRoleModel
      .find({ $or: [{ username }, ...(teamIds.length > 0 ? [{ teamId: { $in: teamIds } }] : [])] })
      .exec();
    const out = new Map<string, Set<PosWorkbookRoleName>>();
    for (const d of docs) {
      const set = out.get(d.workbookId) ?? new Set<PosWorkbookRoleName>();
      set.add(d.role);
      out.set(d.workbookId, set);
    }
    const result = new Map<string, PosWorkbookRoleName[]>();
    for (const [wbId, set] of out.entries()) result.set(wbId, Array.from(set));
    return result;
  }

  async list(workbookId: string, acting: ActingUser): Promise<PosRolesResponse> {
    const wb = await this.posWorkbookModel.findOne({ workbookId }).exec();
    if (!wb) throw new NotFoundException("POS workbook not found");
    const { doc: project, role: projectRole } = await this.projectsService.resolveAccess(wb.projectId, acting);
    const canManage = wb.ownerUsername === acting.username || projectRole === "owner";

    const sharedTeamIds = project.sharedTeams.map((s) => s.teamId);
    const teamDocs = sharedTeamIds.length > 0
      ? await this.teamModel.find({ _id: { $in: sharedTeamIds } }).exec()
      : [];
    const teamById = new Map<string, TeamDocument>();
    for (const t of teamDocs) teamById.set(String(t._id), t);

    const eligibleMembers: PosEligibleMember[] = [];
    const seenUsernames = new Set<string>();
    function pushMember(username: string, viaTeamId?: string): void {
      if (seenUsernames.has(username)) return;
      seenUsernames.add(username);
      eligibleMembers.push({ username, fullName: username, viaTeamId });
    }
    pushMember(project.ownerUsername);
    for (const share of project.sharedUsers) pushMember(share.username);
    for (const ts of project.sharedTeams) {
      const t = teamById.get(ts.teamId);
      if (t === undefined) continue;
      for (const m of this.membersOf(t)) pushMember(m, ts.teamId);
    }

    const assignments = await this.posRoleModel.find({ workbookId }).sort({ createdAt: 1 }).exec();

    const userAssignmentUsernames = assignments.filter((a) => typeof a.username === "string").map((a) => a.username as string);
    const allUsernames = new Set<string>([...seenUsernames, ...userAssignmentUsernames]);
    const userDocs = await this.userModel
      .find({ username: { $in: Array.from(allUsernames) } }, { username: 1, fullName: 1 })
      .lean()
      .exec();
    const nameByUsername = new Map<string, string>();
    for (const u of userDocs) nameByUsername.set(u.username, u.fullName);
    for (const m of eligibleMembers) m.fullName = nameByUsername.get(m.username) ?? m.username;

    const assignedTeamIds = assignments.filter((a) => typeof a.teamId === "string").map((a) => a.teamId as string);
    const extraTeamIds = assignedTeamIds.filter((id) => !teamById.has(id));
    if (extraTeamIds.length > 0) {
      const extras = await this.teamModel.find({ _id: { $in: extraTeamIds } }).exec();
      for (const t of extras) teamById.set(String(t._id), t);
    }

    const myTeamIdSet = new Set<string>(await this.myTeamIds(acting.username));
    const myRolesSet = new Set<PosWorkbookRoleName>();
    for (const a of assignments) {
      if (a.username === acting.username) myRolesSet.add(a.role);
      if (a.teamId !== undefined && myTeamIdSet.has(a.teamId)) myRolesSet.add(a.role);
    }

    const assignmentResponses: PosRoleAssignment[] = assignments.map((a): PosRoleAssignment => {
      if (typeof a.username === "string") {
        return {
          kind: "user",
          username: a.username,
          fullName: nameByUsername.get(a.username) ?? a.username,
          role: a.role,
          assignedBy: a.assignedBy,
          assignedAt: a.createdAt.toISOString(),
        };
      }
      const team = a.teamId !== undefined ? teamById.get(a.teamId) : undefined;
      return {
        kind: "team",
        teamId: a.teamId ?? "",
        teamName: team?.name ?? "(deleted team)",
        memberCount: team !== undefined ? this.membersOf(team).length : 0,
        role: a.role,
        assignedBy: a.assignedBy,
        assignedAt: a.createdAt.toISOString(),
      };
    });

    const eligibleTeams: PosEligibleTeam[] = project.sharedTeams.map((ts) => {
      const t = teamById.get(ts.teamId);
      return {
        teamId: ts.teamId,
        teamName: t?.name ?? "(deleted team)",
        memberCount: t !== undefined ? this.membersOf(t).length : 0,
      };
    });

    return {
      workbookId,
      canManage,
      myRoles: Array.from(myRolesSet),
      assignments: assignmentResponses,
      eligibleMembers,
      eligibleTeams,
    };
  }

  async assignUser(workbookId: string, username: string, role: PosWorkbookRoleName, acting: ActingUser): Promise<PosRolesResponse> {
    if (!VALID_ROLES.includes(role)) throw new BadRequestException("Invalid role");
    const wb = await this.posWorkbookModel.findOne({ workbookId }).exec();
    if (!wb) throw new NotFoundException("POS workbook not found");
    const { doc: project, role: projectRole } = await this.projectsService.resolveAccess(wb.projectId, acting);
    const canManage = wb.ownerUsername === acting.username || projectRole === "owner";
    if (!canManage) throw new ForbiddenException("Only the workbook owner can assign roles");

    const directMember = project.ownerUsername === username || project.sharedUsers.some((s) => s.username === username);
    let teamMember = false;
    if (!directMember && project.sharedTeams.length > 0) {
      const teamDocs = await this.teamModel.find({ _id: { $in: project.sharedTeams.map((t) => t.teamId) } }).exec();
      teamMember = teamDocs.some((t) => this.membersOf(t).includes(username));
    }
    if (!directMember && !teamMember) throw new BadRequestException("User is not a member of this project");

    const existing = await this.posRoleModel.findOne({ workbookId, username, role }).exec();
    if (existing) throw new ConflictException("This role is already assigned to that user");
    await this.ensureSingleApprover(workbookId, role);

    await this.posRoleModel.create({ workbookId, username, role, assignedBy: acting.username });
    return this.list(workbookId, acting);
  }

  async assignTeam(workbookId: string, teamId: string, role: PosWorkbookRoleName, acting: ActingUser): Promise<PosRolesResponse> {
    if (!VALID_ROLES.includes(role)) throw new BadRequestException("Invalid role");
    if (!isValidObjectId(teamId)) throw new BadRequestException("Invalid team id");
    const wb = await this.posWorkbookModel.findOne({ workbookId }).exec();
    if (!wb) throw new NotFoundException("POS workbook not found");
    const { doc: project, role: projectRole } = await this.projectsService.resolveAccess(wb.projectId, acting);
    const canManage = wb.ownerUsername === acting.username || projectRole === "owner";
    if (!canManage) throw new ForbiddenException("Only the workbook owner can assign roles");

    const teamIsShared = project.sharedTeams.some((t) => t.teamId === teamId);
    if (!teamIsShared) throw new BadRequestException("Team is not shared with this project");

    const existing = await this.posRoleModel.findOne({ workbookId, teamId, role }).exec();
    if (existing) throw new ConflictException("This role is already assigned to that team");
    await this.ensureSingleApprover(workbookId, role);

    await this.posRoleModel.create({ workbookId, teamId, role, assignedBy: acting.username });
    return this.list(workbookId, acting);
  }

  async unassignUser(workbookId: string, username: string, role: PosWorkbookRoleName, acting: ActingUser): Promise<PosRolesResponse> {
    if (!VALID_ROLES.includes(role)) throw new BadRequestException("Invalid role");
    const wb = await this.posWorkbookModel.findOne({ workbookId }).exec();
    if (!wb) throw new NotFoundException("POS workbook not found");
    const { role: projectRole } = await this.projectsService.resolveAccess(wb.projectId, acting);
    const canManage = wb.ownerUsername === acting.username || projectRole === "owner";
    if (!canManage) throw new ForbiddenException("Only the workbook owner can remove role assignments");

    const result = await this.posRoleModel.deleteOne({ workbookId, username, role }).exec();
    if (result.deletedCount === 0) throw new NotFoundException("Role assignment not found");
    return this.list(workbookId, acting);
  }

  async unassignTeam(workbookId: string, teamId: string, role: PosWorkbookRoleName, acting: ActingUser): Promise<PosRolesResponse> {
    if (!VALID_ROLES.includes(role)) throw new BadRequestException("Invalid role");
    if (!isValidObjectId(teamId)) throw new BadRequestException("Invalid team id");
    const wb = await this.posWorkbookModel.findOne({ workbookId }).exec();
    if (!wb) throw new NotFoundException("POS workbook not found");
    const { role: projectRole } = await this.projectsService.resolveAccess(wb.projectId, acting);
    const canManage = wb.ownerUsername === acting.username || projectRole === "owner";
    if (!canManage) throw new ForbiddenException("Only the workbook owner can remove role assignments");

    const result = await this.posRoleModel.deleteOne({ workbookId, teamId, role }).exec();
    if (result.deletedCount === 0) throw new NotFoundException("Role assignment not found");
    return this.list(workbookId, acting);
  }
}
