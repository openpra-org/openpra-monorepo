import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { randomUUID } from "crypto";
import { PlantOperatingStatesAnalysisSchema } from "interfaces-mef-types/zod/pos/plant-operating-states-analysis";
import { ProjectsService } from "../projects/projects.service";
import { PosWorkbook, type PosWorkbookDocument } from "./pos-workbook.schema";
import { PosWorkbookRole, type PosWorkbookRoleDocument, type PosWorkbookRoleName } from "./pos-workbook-role.schema";
import { PosRolesService } from "./pos-roles.service";
import { stripNulls } from "./mef-normalize";

const VALID_SEVERITIES = ["MAJOR", "MINOR", "OBSERVATION"] as const;
type CommentSeverity = (typeof VALID_SEVERITIES)[number];

interface AddCommentBody {
  text: string;
  severity?: CommentSeverity;
  associatedSr?: string;
  associatedField?: string;
}

interface UpdateCommentBody {
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

function pickAuthorRole(roles: PosWorkbookRoleName[]): "INTERNAL_REVIEWER" | "INTERNAL_APPROVER" {
  if (roles.includes("approver")) return "INTERNAL_APPROVER";
  return "INTERNAL_REVIEWER";
}

@Injectable()
export class PosCommentsService {
  constructor(
    @InjectModel(PosWorkbook.name) private readonly posWorkbookModel: Model<PosWorkbookDocument>,
    @InjectModel(PosWorkbookRole.name) private readonly posRoleModel: Model<PosWorkbookRoleDocument>,
    private readonly projectsService: ProjectsService,
    private readonly posRolesService: PosRolesService,
  ) {}

  private async loadMyRoles(workbookId: string, username: string): Promise<PosWorkbookRoleName[]> {
    return this.posRolesService.resolveEffectiveRoles(workbookId, username);
  }

  private async loadAndAuthorize(workbookId: string, acting: ActingUser): Promise<{ wb: PosWorkbookDocument; myRoles: PosWorkbookRoleName[] }> {
    const wb = await this.posWorkbookModel.findOne({ workbookId }).exec();
    if (!wb) throw new NotFoundException("POS workbook not found");
    await this.projectsService.resolveAccess(wb.projectId, acting);
    const myRoles = await this.loadMyRoles(workbookId, acting.username);
    return { wb, myRoles };
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

  private async persist(wb: PosWorkbookDocument, mef: MefShape): Promise<unknown> {
    const parsed = PlantOperatingStatesAnalysisSchema.safeParse(stripNulls(mef));
    if (!parsed.success) throw new BadRequestException(`Invalid POS workbook payload: ${parsed.error.message}`);
    wb.mef = parsed.data;
    await wb.save();
    return parsed.data;
  }

  async addComment(workbookId: string, body: AddCommentBody, acting: ActingUser): Promise<unknown> {
    if (typeof body.text !== "string" || body.text.trim().length === 0) throw new BadRequestException("Comment text is required");
    const { wb, myRoles } = await this.loadAndAuthorize(workbookId, acting);
    if (!myRoles.includes("reviewer") && !myRoles.includes("approver")) {
      throw new ForbiddenException("Only reviewers and approvers can post comments");
    }
    const mef = wb.mef as MefShape;
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
    return this.persist(wb, mef);
  }

  async updateComment(workbookId: string, commentUuid: string, body: UpdateCommentBody, acting: ActingUser): Promise<unknown> {
    const { wb, myRoles } = await this.loadAndAuthorize(workbookId, acting);
    if (!myRoles.includes("reviewer") && !myRoles.includes("approver")) {
      throw new ForbiddenException("Only reviewers and approvers can update comments");
    }
    const mef = wb.mef as MefShape;
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
    return this.persist(wb, mef);
  }
}
