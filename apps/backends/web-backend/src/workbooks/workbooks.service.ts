import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, isValidObjectId } from "mongoose";
import {
  type CreateWorkbookRequest,
  type UpdateWorkbookRequest,
  type Workbook as WorkbookDto,
  type WorkbookListResponse,
  toolBelongsToElement,
} from "interfaces-shared-types";
import { User, type UserDocument } from "../users/user.schema";
import { ProjectsService } from "../projects/projects.service";
import { Workbook, type WorkbookDocument } from "./workbook.schema";

function computeInitials(fullName: string): string {
  const parts = fullName.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toDto(doc: WorkbookDocument): WorkbookDto {
  return {
    id: String(doc._id),
    projectId: doc.projectId,
    elementCode: doc.elementCode,
    toolId: doc.toolId,
    name: doc.name,
    status: doc.status,
    version: doc.version,
    ownerUsername: doc.ownerUsername,
    ownerFullName: doc.ownerFullName,
    ownerInitials: computeInitials(doc.ownerFullName),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

interface ActingUser {
  username: string;
}

@Injectable()
export class WorkbooksService {
  constructor(
    @InjectModel(Workbook.name) private readonly workbookModel: Model<WorkbookDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly projectsService: ProjectsService,
  ) {}

  async listWorkbooks(
    projectId: string,
    elementCode: string,
    toolId: string,
    acting: ActingUser,
  ): Promise<WorkbookListResponse> {
    await this.projectsService.resolveAccess(projectId, acting);
    this.assertToolInElement(toolId, elementCode);
    const docs = await this.workbookModel
      .find({ projectId, elementCode, toolId })
      .sort({ updatedAt: -1 })
      .exec();
    return { workbooks: docs.map(toDto) };
  }

  async createWorkbook(projectId: string, payload: CreateWorkbookRequest, acting: ActingUser): Promise<WorkbookDto> {
    const { role } = await this.projectsService.resolveAccess(projectId, acting);
    if (role === "viewer") throw new ForbiddenException("You cannot create workbooks in this project");
    this.assertToolInElement(payload.toolId, payload.elementCode);
    const owner = await this.userModel.findOne({ username: acting.username }).lean();
    if (!owner) throw new NotFoundException("Acting user not found");
    const created = await this.workbookModel.create({
      projectId,
      elementCode: payload.elementCode,
      toolId: payload.toolId,
      name: payload.name,
      status: "draft",
      version: 1,
      ownerUsername: owner.username,
      ownerFullName: owner.fullName,
    });
    return toDto(created);
  }

  async updateWorkbook(
    projectId: string,
    id: string,
    payload: UpdateWorkbookRequest,
    acting: ActingUser,
  ): Promise<WorkbookDto> {
    const { role } = await this.projectsService.resolveAccess(projectId, acting);
    if (role === "viewer") throw new ForbiddenException("You cannot edit workbooks in this project");
    const doc = await this.findScoped(projectId, id);
    if (payload.name !== undefined) doc.name = payload.name;
    if (payload.status !== undefined) doc.status = payload.status;
    await doc.save();
    return toDto(doc);
  }

  async deleteWorkbook(projectId: string, id: string, acting: ActingUser): Promise<void> {
    const { role } = await this.projectsService.resolveAccess(projectId, acting);
    if (role === "viewer") throw new ForbiddenException("You cannot delete workbooks in this project");
    const doc = await this.findScoped(projectId, id);
    await doc.deleteOne();
  }

  private assertToolInElement(toolId: string, elementCode: string): void {
    if (!toolBelongsToElement(toolId, elementCode)) {
      throw new BadRequestException("Tool does not belong to that technical element");
    }
  }

  private async findScoped(projectId: string, id: string): Promise<WorkbookDocument> {
    if (!isValidObjectId(id)) throw new NotFoundException("Workbook not found");
    const doc = await this.workbookModel.findById(id).exec();
    if (!doc || doc.projectId !== projectId) throw new NotFoundException("Workbook not found");
    return doc;
  }
}
