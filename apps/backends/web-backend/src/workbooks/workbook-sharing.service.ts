import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, isValidObjectId } from "mongoose";
import type { WorkbookShareAccess, WorkbookSharesResponse } from "interfaces-shared-types/workbooks";
import { ProjectsService } from "../projects/projects.service";
import { EventBus } from "../events/event-bus";
import { Workbook, type WorkbookDocument } from "./workbook.schema";
import { WorkbookRolesService } from "./workbook-roles.service";

interface ActingUser {
  username: string;
}

const WORKBOOK_ROUTES: Record<string, string> = {
  POS: "pos-workbooks",
  IE: "ie-workbooks",
  ES: "es-workbooks",
  SC: "sc-workbooks",
  SY: "sy-workbooks",
  HRA: "hr-workbooks",
  DA: "da-workbooks",
  ESQ: "esq-workbooks",
  MS: "ms-workbooks",
  RC: "rc-workbooks",
  RI: "ri-workbooks",
  S: "seismic-pra-workbooks",
  FL: "internal-flood-pra-workbooks",
  F: "internal-fire-pra-workbooks",
  HS: "hazards-screening-analysis-workbooks",
  W: "high-winds-pra-workbooks",
  XF: "external-flood-pra-workbooks",
  O: "other-hazards-pra-workbooks",
};

function workbookLink(workbook: WorkbookDocument): string {
  const route = WORKBOOK_ROUTES[workbook.elementCode];
  return route === undefined ? `/projects/${workbook.projectId}` : `/${route}/${String(workbook._id)}`;
}

@Injectable()
export class WorkbookSharingService {
  constructor(
    @InjectModel(Workbook.name) private readonly workbookModel: Model<WorkbookDocument>,
    private readonly projectsService: ProjectsService,
    private readonly rolesService: WorkbookRolesService,
    private readonly eventBus: EventBus,
  ) {}

  async list(workbookId: string, acting: ActingUser): Promise<WorkbookSharesResponse> {
    const workbook = await this.requireWorkbook(workbookId);
    return this.projectsService.workbookShares(workbook.projectId, workbookId, await this.canShare(workbook, acting), acting);
  }

  async share(workbookId: string, identifier: string, access: WorkbookShareAccess, acting: ActingUser): Promise<WorkbookSharesResponse> {
    const workbook = await this.requireSharer(workbookId, acting);
    const result = await this.projectsService.shareWorkbookCasually(workbook.projectId, workbookId, identifier, access, acting);
    if (result.target !== null) {
      await this.eventBus.emit({
        type: "workbook.collaborator_added",
        projectId: workbook.projectId,
        projectName: result.projectName,
        workbookId,
        workbookName: workbook.name,
        link: workbookLink(workbook),
        actor: acting.username,
        target: result.target,
        access,
      });
    }
    return result.shares;
  }

  async update(workbookId: string, username: string, access: WorkbookShareAccess, acting: ActingUser): Promise<WorkbookSharesResponse> {
    const workbook = await this.requireSharer(workbookId, acting);
    return this.projectsService.updateWorkbookCollaborator(workbook.projectId, workbookId, username, access, acting);
  }

  async remove(workbookId: string, username: string, acting: ActingUser): Promise<WorkbookSharesResponse> {
    const workbook = await this.requireSharer(workbookId, acting);
    return this.projectsService.removeWorkbookCollaborator(workbook.projectId, workbookId, username, acting);
  }

  async assertCanOpen(workbookId: string, acting: ActingUser): Promise<void> {
    const workbook = await this.requireWorkbook(workbookId);
    await this.projectsService.resolveAccess(workbook.projectId, acting, workbookId);
  }

  private async requireWorkbook(workbookId: string): Promise<WorkbookDocument> {
    if (!isValidObjectId(workbookId)) throw new NotFoundException("Workbook not found");
    const workbook = await this.workbookModel.findById(workbookId).exec();
    if (workbook === null) throw new NotFoundException("Workbook not found");
    return workbook;
  }

  private async requireSharer(workbookId: string, acting: ActingUser): Promise<WorkbookDocument> {
    const workbook = await this.requireWorkbook(workbookId);
    if (!(await this.canShare(workbook, acting))) throw new ForbiddenException("Only the workbook owner, the project owner or a preparer can share this workbook");
    return workbook;
  }

  private async canShare(workbook: WorkbookDocument, acting: ActingUser): Promise<boolean> {
    const { role } = await this.projectsService.resolveAccess(workbook.projectId, acting, String(workbook._id));
    if (role === "owner" || workbook.ownerUsername === acting.username) return true;
    const roles = await this.rolesService.resolveEffectiveRoles(String(workbook._id), acting.username);
    return role !== "viewer" && roles.includes("preparer");
  }
}
