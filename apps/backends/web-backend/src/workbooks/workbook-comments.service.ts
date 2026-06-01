import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, isValidObjectId } from "mongoose";
import { randomUUID } from "crypto";
import { ProjectsService } from "../projects/projects.service";
import { Workbook, type WorkbookDocument } from "./workbook.schema";
import { WorkbookRolesService, type WorkbookRoleName } from "./workbook-roles.service";
import { WorkbookElementRegistry } from "./workbook-element-registry";

const VALID_SEVERITIES = ["MAJOR", "MINOR", "OBSERVATION"] as const;
type CommentSeverity = (typeof VALID_SEVERITIES)[number];

export interface AddCommentBody {
  text: string;
  severity?: CommentSeverity;
  associatedSr?: string;
  associatedField?: string;
}

export interface UpdateCommentBody {
  resolved?: boolean;
  resolution?: string;
}

interface ActingUser {
  username: string;
}

interface MefShape {
  internalReviewComments: {
    comments: {
      uuid: string;
      authorRole: string;
      authorId: string;
      createdAt: string;
      text: string;
      resolved: boolean;
      severity?: CommentSeverity;
      associatedSr?: string;
      associatedField?: string;
      resolution?: string;
      resolvedAt?: string;
      resolvedBy?: string;
    }[];
    openCount: number;
    resolvedCount: number;
  };
}

function pickAuthorRole(roles: WorkbookRoleName[]): "INTERNAL_REVIEWER" | "INTERNAL_APPROVER" {
  if (roles.includes("approver")) return "INTERNAL_APPROVER";
  return "INTERNAL_REVIEWER";
}

@Injectable()
export class WorkbookCommentsService {
  constructor(
    @InjectModel(Workbook.name) private readonly workbookModel: Model<WorkbookDocument>,
    private readonly projectsService: ProjectsService,
    private readonly rolesService: WorkbookRolesService,
    private readonly registry: WorkbookElementRegistry,
  ) {}

  private async loadAndAuthorize(workbookId: string, acting: ActingUser): Promise<{ wb: WorkbookDocument; mef: MefShape; myRoles: WorkbookRoleName[] }> {
    if (!isValidObjectId(workbookId)) throw new NotFoundException("Workbook not found");
    const wb = await this.workbookModel.findById(workbookId).exec();
    if (!wb) throw new NotFoundException("Workbook not found");
    await this.projectsService.resolveAccess(wb.projectId, acting);
    const loaded = await this.registry.get(wb.elementCode).load(workbookId);
    if (loaded === null) throw new NotFoundException("Workbook content not found");
    const myRoles = await this.rolesService.resolveEffectiveRoles(workbookId, acting.username);
    return { wb, mef: loaded.mef as MefShape, myRoles };
  }

  private recount(mef: MefShape): void {
    let open = 0;
    let resolved = 0;
    for (const c of mef.internalReviewComments.comments) {
      if (c.resolved) resolved += 1;
      else open += 1;
    }
    mef.internalReviewComments.openCount = open;
    mef.internalReviewComments.resolvedCount = resolved;
  }

  async addComment(workbookId: string, body: AddCommentBody, acting: ActingUser): Promise<unknown> {
    if (typeof body.text !== "string" || body.text.trim().length === 0) throw new BadRequestException("Comment text is required");
    const { wb, mef, myRoles } = await this.loadAndAuthorize(workbookId, acting);
    if (!myRoles.includes("reviewer") && !myRoles.includes("approver")) {
      throw new ForbiddenException("Only reviewers and approvers can post comments");
    }
    if (body.severity !== undefined && !VALID_SEVERITIES.includes(body.severity)) {
      throw new BadRequestException("Invalid severity");
    }
    mef.internalReviewComments.comments.push({
      uuid: randomUUID(),
      authorRole: pickAuthorRole(myRoles),
      authorId: acting.username,
      createdAt: new Date().toISOString(),
      text: body.text.trim(),
      resolved: false,
      severity: body.severity,
      associatedSr: body.associatedSr,
      associatedField: body.associatedField,
    });
    this.recount(mef);
    return this.registry.get(wb.elementCode).save(workbookId, mef);
  }

  async updateComment(workbookId: string, commentUuid: string, body: UpdateCommentBody, acting: ActingUser): Promise<unknown> {
    const { wb, mef, myRoles } = await this.loadAndAuthorize(workbookId, acting);
    if (!myRoles.includes("reviewer") && !myRoles.includes("approver")) {
      throw new ForbiddenException("Only reviewers and approvers can update comments");
    }
    const target = mef.internalReviewComments.comments.find((c) => c.uuid === commentUuid);
    if (target === undefined) throw new NotFoundException("Comment not found");
    if (body.resolved !== undefined) {
      target.resolved = body.resolved;
      if (body.resolved) {
        target.resolvedAt = new Date().toISOString();
        target.resolvedBy = acting.username;
        if (body.resolution !== undefined) target.resolution = body.resolution;
      } else {
        target.resolvedAt = undefined;
        target.resolvedBy = undefined;
      }
    } else if (body.resolution !== undefined) {
      target.resolution = body.resolution;
    }
    this.recount(mef);
    return this.registry.get(wb.elementCode).save(workbookId, mef);
  }
}
