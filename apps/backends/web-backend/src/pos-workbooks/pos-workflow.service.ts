import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { PlantOperatingStatesAnalysisSchema } from "interfaces-mef-types/zod/pos/plant-operating-states-analysis";
import { ProjectsService } from "../projects/projects.service";
import { PosWorkbook, type PosWorkbookDocument } from "./pos-workbook.schema";
import { PosWorkbookRole, type PosWorkbookRoleDocument, type PosWorkbookRoleName } from "./pos-workbook-role.schema";
import { PosWorkbookSignoff, type PosWorkbookSignoffDocument, type PosSignoffRole } from "./pos-workbook-signoff.schema";
import { stripNulls } from "./mef-normalize";

interface MefShape {
  workflowState: string;
  workflowHistory: { state: string; enteredAt: string; exitedAt?: string; actor: string; note?: string }[];
}

interface ActingUser {
  username: string;
}

export interface PosSignoffEntry {
  username: string;
  role: PosSignoffRole;
  signedAt: string;
}

export interface PosWorkflowStatus {
  workflowState: string;
  reviewers: string[];
  approvers: string[];
  signoffs: PosSignoffEntry[];
  myPendingSignoff: PosSignoffRole | null;
}

@Injectable()
export class PosWorkflowService {
  constructor(
    @InjectModel(PosWorkbook.name) private readonly posWorkbookModel: Model<PosWorkbookDocument>,
    @InjectModel(PosWorkbookRole.name) private readonly posRoleModel: Model<PosWorkbookRoleDocument>,
    @InjectModel(PosWorkbookSignoff.name) private readonly posSignoffModel: Model<PosWorkbookSignoffDocument>,
    private readonly projectsService: ProjectsService,
  ) {}

  private async loadAuthorize(workbookId: string, acting: ActingUser): Promise<{ wb: PosWorkbookDocument; myRoles: PosWorkbookRoleName[] }> {
    const wb = await this.posWorkbookModel.findOne({ workbookId }).exec();
    if (!wb) throw new NotFoundException("POS workbook not found");
    await this.projectsService.resolveAccess(wb.projectId, acting);
    const roleDocs = await this.posRoleModel.find({ workbookId, username: acting.username }).exec();
    return { wb, myRoles: roleDocs.map((d) => d.role) };
  }

  private async assignedUsernames(workbookId: string, role: PosWorkbookRoleName): Promise<string[]> {
    const docs = await this.posRoleModel.find({ workbookId, role }).exec();
    return docs.map((d) => d.username);
  }

  private async transition(wb: PosWorkbookDocument, nextState: string, actor: string, note: string): Promise<unknown> {
    const mef = wb.mef as MefShape;
    const now = new Date().toISOString();
    const history = mef.workflowHistory ?? [];
    if (history.length > 0) {
      const last = history[history.length - 1];
      if (last.exitedAt === undefined) last.exitedAt = now;
    }
    history.push({ state: nextState, enteredAt: now, actor, note });
    mef.workflowState = nextState;
    mef.workflowHistory = history;
    const parsed = PlantOperatingStatesAnalysisSchema.safeParse(stripNulls(mef));
    if (!parsed.success) throw new BadRequestException(`Invalid POS workbook payload: ${parsed.error.message}`);
    wb.mef = parsed.data;
    await wb.save();
    return parsed.data;
  }

  async status(workbookId: string, acting: ActingUser): Promise<PosWorkflowStatus> {
    const { wb, myRoles } = await this.loadAuthorize(workbookId, acting);
    const mef = wb.mef as MefShape;
    const [reviewers, approvers, signoffs] = await Promise.all([
      this.assignedUsernames(workbookId, "reviewer"),
      this.assignedUsernames(workbookId, "approver"),
      this.posSignoffModel.find({ workbookId }).sort({ createdAt: 1 }).exec(),
    ]);
    let myPending: PosSignoffRole | null = null;
    if (mef.workflowState === "INTERNAL_TECHNICAL_REVIEW" && myRoles.includes("reviewer")) {
      const already = signoffs.some((s) => s.username === acting.username && s.role === "reviewer");
      if (!already) myPending = "reviewer";
    } else if (mef.workflowState === "INTERNAL_APPROVAL" && myRoles.includes("approver")) {
      const already = signoffs.some((s) => s.username === acting.username && s.role === "approver");
      if (!already) myPending = "approver";
    }
    return {
      workflowState: mef.workflowState,
      reviewers,
      approvers,
      signoffs: signoffs.map((s) => ({ username: s.username, role: s.role, signedAt: s.createdAt.toISOString() })),
      myPendingSignoff: myPending,
    };
  }

  async submitForReview(workbookId: string, acting: ActingUser): Promise<unknown> {
    const { wb, myRoles } = await this.loadAuthorize(workbookId, acting);
    if (!myRoles.includes("preparer")) throw new ForbiddenException("Only a preparer can submit the workbook for review");
    const state = (wb.mef as MefShape).workflowState;
    if (state !== "DRAFT" && state !== "REVISION_REQUIRED") {
      throw new BadRequestException(`Cannot submit for review from state ${state}`);
    }
    const reviewers = await this.assignedUsernames(workbookId, "reviewer");
    if (reviewers.length === 0) throw new BadRequestException("Assign at least one reviewer before submitting");
    await this.posSignoffModel.deleteMany({ workbookId }).exec();
    return this.transition(wb, "INTERNAL_TECHNICAL_REVIEW", acting.username, "Submitted for internal technical review");
  }

  async signReview(workbookId: string, acting: ActingUser): Promise<unknown> {
    const { wb, myRoles } = await this.loadAuthorize(workbookId, acting);
    if (!myRoles.includes("reviewer")) throw new ForbiddenException("You are not a reviewer on this workbook");
    const state = (wb.mef as MefShape).workflowState;
    if (state !== "INTERNAL_TECHNICAL_REVIEW") throw new BadRequestException("Workbook is not in internal technical review");
    const existing = await this.posSignoffModel.findOne({ workbookId, username: acting.username, role: "reviewer" }).exec();
    if (existing) throw new BadRequestException("You already signed off as a reviewer");
    await this.posSignoffModel.create({ workbookId, username: acting.username, role: "reviewer", workflowState: state });

    const reviewers = await this.assignedUsernames(workbookId, "reviewer");
    const reviewerSignoffs = await this.posSignoffModel.find({ workbookId, role: "reviewer" }).exec();
    const allSigned = reviewers.every((u) => reviewerSignoffs.some((s) => s.username === u));
    if (allSigned) {
      const approvers = await this.assignedUsernames(workbookId, "approver");
      if (approvers.length === 0) {
        return this.transition(wb, "FINAL", acting.username, "All reviewers signed; no approvers assigned");
      }
      return this.transition(wb, "INTERNAL_APPROVAL", acting.username, "All reviewers signed; advanced to approval");
    }
    return wb.mef;
  }

  async signApproval(workbookId: string, acting: ActingUser): Promise<unknown> {
    const { wb, myRoles } = await this.loadAuthorize(workbookId, acting);
    if (!myRoles.includes("approver")) throw new ForbiddenException("You are not an approver on this workbook");
    const state = (wb.mef as MefShape).workflowState;
    if (state !== "INTERNAL_APPROVAL") throw new BadRequestException("Workbook is not in internal approval");
    const existing = await this.posSignoffModel.findOne({ workbookId, username: acting.username, role: "approver" }).exec();
    if (existing) throw new BadRequestException("You already signed off as an approver");
    await this.posSignoffModel.create({ workbookId, username: acting.username, role: "approver", workflowState: state });

    const approvers = await this.assignedUsernames(workbookId, "approver");
    const approverSignoffs = await this.posSignoffModel.find({ workbookId, role: "approver" }).exec();
    const allSigned = approvers.every((u) => approverSignoffs.some((s) => s.username === u));
    if (allSigned) {
      return this.transition(wb, "FINAL", acting.username, "All approvers signed; workbook finalized");
    }
    return wb.mef;
  }

  async requestRevision(workbookId: string, note: string, acting: ActingUser): Promise<unknown> {
    const { wb, myRoles } = await this.loadAuthorize(workbookId, acting);
    if (!myRoles.includes("reviewer") && !myRoles.includes("approver")) {
      throw new ForbiddenException("Only reviewers or approvers can request revision");
    }
    const state = (wb.mef as MefShape).workflowState;
    if (state !== "INTERNAL_TECHNICAL_REVIEW" && state !== "INTERNAL_APPROVAL") {
      throw new BadRequestException("Revision can only be requested during review or approval");
    }
    await this.posSignoffModel.deleteMany({ workbookId }).exec();
    return this.transition(wb, "REVISION_REQUIRED", acting.username, note.length > 0 ? note : "Revision requested");
  }

  async awaitingMe(acting: ActingUser): Promise<{ workbookId: string; projectId: string; workflowState: string; pendingAction: string }[]> {
    const roleDocs = await this.posRoleModel.find({ username: acting.username }).exec();
    if (roleDocs.length === 0) return [];
    const workbookIds = Array.from(new Set(roleDocs.map((d) => d.workbookId)));
    const wbs = await this.posWorkbookModel.find({ workbookId: { $in: workbookIds } }).exec();
    const signoffs = await this.posSignoffModel.find({ workbookId: { $in: workbookIds }, username: acting.username }).exec();
    const out: { workbookId: string; projectId: string; workflowState: string; pendingAction: string }[] = [];
    for (const wb of wbs) {
      const myRoles = roleDocs.filter((r) => r.workbookId === wb.workbookId).map((r) => r.role);
      const state = (wb.mef as MefShape).workflowState;
      if ((state === "DRAFT" || state === "REVISION_REQUIRED") && myRoles.includes("preparer")) {
        out.push({ workbookId: wb.workbookId, projectId: wb.projectId, workflowState: state, pendingAction: "Continue preparing draft" });
        continue;
      }
      if (state === "INTERNAL_TECHNICAL_REVIEW" && myRoles.includes("reviewer")) {
        const signed = signoffs.some((s) => s.workbookId === wb.workbookId && s.role === "reviewer");
        if (!signed) out.push({ workbookId: wb.workbookId, projectId: wb.projectId, workflowState: state, pendingAction: "Review and sign" });
        continue;
      }
      if (state === "INTERNAL_APPROVAL" && myRoles.includes("approver")) {
        const signed = signoffs.some((s) => s.workbookId === wb.workbookId && s.role === "approver");
        if (!signed) out.push({ workbookId: wb.workbookId, projectId: wb.projectId, workflowState: state, pendingAction: "Approve and sign" });
      }
    }
    return out;
  }
}
