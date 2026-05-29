import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { ProjectsService } from "../projects/projects.service";
import { User, type UserDocument } from "../users/user.schema";
import { PosWorkbook, type PosWorkbookDocument } from "./pos-workbook.schema";
import { PosWorkbookRole, type PosWorkbookRoleDocument, type PosWorkbookRoleName } from "./pos-workbook-role.schema";

const VALID_ROLES: PosWorkbookRoleName[] = ["preparer", "reviewer", "approver"];

export interface PosRoleAssignment {
  username: string;
  fullName: string;
  role: PosWorkbookRoleName;
  assignedBy: string;
  assignedAt: string;
}

export interface PosRolesResponse {
  workbookId: string;
  canManage: boolean;
  myRoles: PosWorkbookRoleName[];
  assignments: PosRoleAssignment[];
  eligibleMembers: { username: string; fullName: string }[];
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
    private readonly projectsService: ProjectsService,
  ) {}

  async myRoles(workbookId: string, username: string): Promise<PosWorkbookRoleName[]> {
    const docs = await this.posRoleModel.find({ workbookId, username }).exec();
    return docs.map((d) => d.role);
  }

  async list(workbookId: string, acting: ActingUser): Promise<PosRolesResponse> {
    const wb = await this.posWorkbookModel.findOne({ workbookId }).exec();
    if (!wb) throw new NotFoundException("POS workbook not found");
    const { doc: project, role: projectRole } = await this.projectsService.resolveAccess(wb.projectId, acting);
    const canManage = wb.ownerUsername === acting.username || projectRole === "owner";

    const eligibleUsernames = new Set<string>([project.ownerUsername]);
    for (const share of project.sharedUsers) eligibleUsernames.add(share.username);

    const assignments = await this.posRoleModel.find({ workbookId }).sort({ createdAt: 1 }).exec();
    const allUsernames = new Set<string>(eligibleUsernames);
    for (const a of assignments) allUsernames.add(a.username);

    const userDocs = await this.userModel.find({ username: { $in: Array.from(allUsernames) } }, { username: 1, fullName: 1 }).lean().exec();
    const nameByUsername = new Map<string, string>();
    for (const u of userDocs) nameByUsername.set(u.username, u.fullName);

    const myRoles = assignments.filter((a) => a.username === acting.username).map((a) => a.role);

    return {
      workbookId,
      canManage,
      myRoles,
      assignments: assignments.map((a) => ({
        username: a.username,
        fullName: nameByUsername.get(a.username) ?? a.username,
        role: a.role,
        assignedBy: a.assignedBy,
        assignedAt: a.createdAt.toISOString(),
      })),
      eligibleMembers: Array.from(eligibleUsernames).map((username) => ({
        username,
        fullName: nameByUsername.get(username) ?? username,
      })),
    };
  }

  async assign(workbookId: string, username: string, role: PosWorkbookRoleName, acting: ActingUser): Promise<PosRolesResponse> {
    if (!VALID_ROLES.includes(role)) throw new BadRequestException("Invalid role");
    const wb = await this.posWorkbookModel.findOne({ workbookId }).exec();
    if (!wb) throw new NotFoundException("POS workbook not found");
    const { doc: project, role: projectRole } = await this.projectsService.resolveAccess(wb.projectId, acting);
    const canManage = wb.ownerUsername === acting.username || projectRole === "owner";
    if (!canManage) throw new ForbiddenException("Only the workbook owner can assign roles");

    const isProjectMember = project.ownerUsername === username || project.sharedUsers.some((s) => s.username === username);
    if (!isProjectMember) throw new BadRequestException("User is not a member of this project");

    const existing = await this.posRoleModel.findOne({ workbookId, username, role }).exec();
    if (existing) throw new ConflictException("This role is already assigned to that user");

    await this.posRoleModel.create({ workbookId, username, role, assignedBy: acting.username });
    return this.list(workbookId, acting);
  }

  async unassign(workbookId: string, username: string, role: PosWorkbookRoleName, acting: ActingUser): Promise<PosRolesResponse> {
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
}
