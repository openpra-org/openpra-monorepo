import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { PlantOperatingStatesAnalysisSchema } from "interfaces-mef-types/zod/pos/plant-operating-states-analysis";
import { ProjectsService } from "../projects/projects.service";
import { PosWorkbook, type PosWorkbookDocument } from "./pos-workbook.schema";
import { type PosWorkbookRoleName } from "./pos-workbook-role.schema";
import { PosWorkbookSignoff, type PosWorkbookSignoffDocument, type PosSignoffRole } from "./pos-workbook-signoff.schema";
import { PosRolesService } from "./pos-roles.service";
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
  preparers: string[];
  coPreparers: string[];
  reviewers: string[];
  approvers: string[];
  signoffs: PosSignoffEntry[];
  myPendingSignoff: PosSignoffRole | null;
}

@Injectable()
export class PosWorkflowService {
  constructor(
    @InjectModel(PosWorkbook.name) private readonly posWorkbookModel: Model<PosWorkbookDocument>,
    @InjectModel(PosWorkbookSignoff.name) private readonly posSignoffModel: Model<PosWorkbookSignoffDocument>,
    private readonly projectsService: ProjectsService,
    private readonly posRolesService: PosRolesService,
  ) {}

  private async loadAuthorize(workbookId: string, acting: ActingUser): Promise<{ wb: PosWorkbookDocument; myRoles: PosWorkbookRoleName[] }> {
    const wb = await this.posWorkbookModel.findOne({ workbookId }).exec();
    if (!wb) throw new NotFoundException("POS workbook not found");
    await this.projectsService.resolveAccess(wb.projectId, acting);
    const myRoles = await this.posRolesService.resolveEffectiveRoles(workbookId, acting.username);
    return { wb, myRoles };
  }

  private async assignedUsernames(workbookId: string, role: PosWorkbookRoleName): Promise<string[]> {
    return this.posRolesService.assignedUsernamesFor(workbookId, role);
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
    const [preparers, coPreparers, reviewers, approvers, signoffs] = await Promise.all([
      this.assignedUsernames(workbookId, "preparer"),
      this.assignedUsernames(workbookId, "co_preparer"),
      this.assignedUsernames(workbookId, "reviewer"),
      this.assignedUsernames(workbookId, "approver"),
      this.posSignoffModel.find({ workbookId }).sort({ createdAt: 1 }).exec(),
    ]);
    let myPending: PosSignoffRole | null = null;
    if (mef.workflowState === "INTERNAL_TECHNICAL_REVIEW") {
      if (myRoles.includes("approver") && !signoffs.some((s) => s.username === acting.username && s.role === "approver")) myPending = "approver";
      else if (myRoles.includes("reviewer") && !signoffs.some((s) => s.username === acting.username && s.role === "reviewer")) myPending = "reviewer";
    } else if (mef.workflowState === "INTERNAL_APPROVAL") {
      if (myRoles.includes("co_preparer") && !signoffs.some((s) => s.username === acting.username && s.role === "co_preparer")) myPending = "co_preparer";
      else if (myRoles.includes("preparer") && !signoffs.some((s) => s.username === acting.username && s.role === "preparer")) myPending = "preparer";
    }
    return {
      workflowState: mef.workflowState,
      preparers,
      coPreparers,
      reviewers,
      approvers,
      signoffs: signoffs.map((s) => ({ username: s.username, role: s.role, signedAt: s.createdAt.toISOString() })),
      myPendingSignoff: myPending,
    };
  }

  private async unresolvedCommentsAuthoredBy(wb: PosWorkbookDocument, username: string): Promise<number> {
    const mef = wb.mef as MefShape & { internalReviewComments?: { comments?: { authorId?: string; resolved?: boolean }[] } };
    const comments = mef.internalReviewComments?.comments ?? [];
    return comments.filter((c) => c.authorId === username && c.resolved !== true).length;
  }

  private async maybeAdvanceFromTechnicalReview(wb: PosWorkbookDocument, workbookId: string, actor: string): Promise<unknown> {
    const reviewers = await this.assignedUsernames(workbookId, "reviewer");
    const approvers = await this.assignedUsernames(workbookId, "approver");
    const signoffs = await this.posSignoffModel.find({ workbookId, role: { $in: ["reviewer", "approver"] } }).exec();
    const allReviewersSigned = reviewers.every((u) => signoffs.some((s) => s.username === u && s.role === "reviewer"));
    const allApproversSigned = approvers.every((u) => signoffs.some((s) => s.username === u && s.role === "approver"));
    if (allReviewersSigned && allApproversSigned) {
      const preparers = await this.assignedUsernames(workbookId, "preparer");
      const coPreparers = await this.assignedUsernames(workbookId, "co_preparer");
      const authorsLeft = preparers.length + coPreparers.length;
      if (authorsLeft === 0) {
        return this.transition(wb, "FINAL", actor, "All reviewers and approver signed; no preparer signoffs required");
      }
      return this.transition(wb, "INTERNAL_APPROVAL", actor, "All reviewers and approver signed; awaiting preparer signoffs");
    }
    return wb.mef;
  }

  private async maybeAdvanceFromInternalApproval(wb: PosWorkbookDocument, workbookId: string, actor: string): Promise<unknown> {
    const preparers = await this.assignedUsernames(workbookId, "preparer");
    const coPreparers = await this.assignedUsernames(workbookId, "co_preparer");
    const expected = new Set<string>([...preparers, ...coPreparers]);
    if (expected.size === 0) {
      return this.transition(wb, "FINAL", actor, "Workbook finalized; no preparer signoffs required");
    }
    const signoffs = await this.posSignoffModel.find({ workbookId, role: { $in: ["preparer", "co_preparer"] } }).exec();
    const signed = new Set<string>(signoffs.map((s) => s.username));
    const allSigned = Array.from(expected).every((u) => signed.has(u));
    if (allSigned) {
      return this.transition(wb, "FINAL", actor, "All preparer and co-preparer signoffs collected; workbook finalized");
    }
    return wb.mef;
  }

  async signAs(workbookId: string, role: PosSignoffRole, acting: ActingUser): Promise<unknown> {
    if (role === "reviewer") return this.signReview(workbookId, acting);
    if (role === "approver") return this.signApproval(workbookId, acting);
    const { wb, myRoles } = await this.loadAuthorize(workbookId, acting);
    if (role === "preparer" && !myRoles.includes("preparer")) throw new ForbiddenException("You are not a preparer on this workbook");
    if (role === "co_preparer" && !myRoles.includes("co_preparer")) throw new ForbiddenException("You are not a co-preparer on this workbook");
    const state = (wb.mef as MefShape).workflowState;
    if (state !== "INTERNAL_APPROVAL") throw new BadRequestException("Preparer signoffs are collected during internal approval");
    const existing = await this.posSignoffModel.findOne({ workbookId, username: acting.username, role }).exec();
    if (existing) throw new BadRequestException(`You already signed off as ${role}`);
    await this.posSignoffModel.create({ workbookId, username: acting.username, role, workflowState: state });
    return this.maybeAdvanceFromInternalApproval(wb, workbookId, acting.username);
  }

  async submitForReview(workbookId: string, acting: ActingUser): Promise<unknown> {
    const { wb, myRoles } = await this.loadAuthorize(workbookId, acting);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only a preparer can submit the workbook for review");
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
    const openMine = await this.unresolvedCommentsAuthoredBy(wb, acting.username);
    if (openMine > 0) throw new BadRequestException(`You have ${openMine} unresolved comment${openMine === 1 ? "" : "s"} to address before signing`);
    const existing = await this.posSignoffModel.findOne({ workbookId, username: acting.username, role: "reviewer" }).exec();
    if (existing) throw new BadRequestException("You already signed off as a reviewer");
    await this.posSignoffModel.create({ workbookId, username: acting.username, role: "reviewer", workflowState: state });
    return this.maybeAdvanceFromTechnicalReview(wb, workbookId, acting.username);
  }

  async signApproval(workbookId: string, acting: ActingUser): Promise<unknown> {
    const { wb, myRoles } = await this.loadAuthorize(workbookId, acting);
    if (!myRoles.includes("approver")) throw new ForbiddenException("You are not an approver on this workbook");
    const state = (wb.mef as MefShape).workflowState;
    if (state !== "INTERNAL_TECHNICAL_REVIEW") throw new BadRequestException("Approver signoff is collected during internal technical review");
    const openMine = await this.unresolvedCommentsAuthoredBy(wb, acting.username);
    if (openMine > 0) throw new BadRequestException(`You have ${openMine} unresolved comment${openMine === 1 ? "" : "s"} to address before signing`);
    const existing = await this.posSignoffModel.findOne({ workbookId, username: acting.username, role: "approver" }).exec();
    if (existing) throw new BadRequestException("You already signed off as an approver");
    await this.posSignoffModel.create({ workbookId, username: acting.username, role: "approver", workflowState: state });
    return this.maybeAdvanceFromTechnicalReview(wb, workbookId, acting.username);
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
    const rolesByWorkbook = await this.posRolesService.workbookIdsAssignedTo(acting.username);
    if (rolesByWorkbook.size === 0) return [];
    const workbookIds = Array.from(rolesByWorkbook.keys());
    const wbs = await this.posWorkbookModel.find({ workbookId: { $in: workbookIds } }).exec();
    const signoffs = await this.posSignoffModel.find({ workbookId: { $in: workbookIds }, username: acting.username }).exec();
    const out: { workbookId: string; projectId: string; workflowState: string; pendingAction: string }[] = [];
    for (const wb of wbs) {
      const myRoles = rolesByWorkbook.get(wb.workbookId) ?? [];
      const state = (wb.mef as MefShape).workflowState;
      if (state === "INTERNAL_TECHNICAL_REVIEW") {
        if (myRoles.includes("approver") && !signoffs.some((s) => s.workbookId === wb.workbookId && s.role === "approver")) {
          out.push({ workbookId: wb.workbookId, projectId: wb.projectId, workflowState: state, pendingAction: "Approve and sign" });
          continue;
        }
        if (myRoles.includes("reviewer") && !signoffs.some((s) => s.workbookId === wb.workbookId && s.role === "reviewer")) {
          out.push({ workbookId: wb.workbookId, projectId: wb.projectId, workflowState: state, pendingAction: "Review and sign" });
        }
        continue;
      }
      if (state === "INTERNAL_APPROVAL") {
        if (myRoles.includes("co_preparer") && !signoffs.some((s) => s.workbookId === wb.workbookId && s.role === "co_preparer")) {
          out.push({ workbookId: wb.workbookId, projectId: wb.projectId, workflowState: state, pendingAction: "Sign as co-preparer" });
          continue;
        }
        if (myRoles.includes("preparer") && !signoffs.some((s) => s.workbookId === wb.workbookId && s.role === "preparer")) {
          out.push({ workbookId: wb.workbookId, projectId: wb.projectId, workflowState: state, pendingAction: "Sign as preparer" });
        }
      }
    }
    return out;
  }
}
