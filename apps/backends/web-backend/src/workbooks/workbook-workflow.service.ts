import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, isValidObjectId } from "mongoose";
import { ProjectsService } from "../projects/projects.service";
import { Workbook, type WorkbookDocument } from "./workbook.schema";
import { WorkbookSignoff, type WorkbookSignoffDocument, type WorkbookSignoffRole } from "./workbook-signoff.schema";
import { WorkbookRolesService, type WorkbookRoleName } from "./workbook-roles.service";
import { WorkbookElementRegistry } from "./workbook-element-registry";

interface MefShape {
  workflowState: string;
  workflowHistory: { state: string; enteredAt: string; exitedAt?: string; actor: string; note?: string }[];
  internalReviewComments?: { comments?: { authorId?: string; resolved?: boolean }[] };
}

interface ActingUser {
  username: string;
}

export interface WorkbookSignoffEntry {
  username: string;
  role: WorkbookSignoffRole;
  signedAt: string;
}

export interface WorkbookRoleHolderStatus {
  role: WorkbookSignoffRole;
  username: string;
  fullName: string;
  designation: string | null;
  signedAt: string | null;
  signatureDataUrl: string | null;
}

export interface WorkbookWorkflowStatus {
  workflowState: string;
  preparers: string[];
  coPreparers: string[];
  reviewers: string[];
  approvers: string[];
  roleHolders: WorkbookRoleHolderStatus[];
  signoffs: WorkbookSignoffEntry[];
  myPendingSignoff: WorkbookSignoffRole | null;
  allReviewersSigned: boolean;
}

@Injectable()
export class WorkbookWorkflowService {
  constructor(
    @InjectModel(Workbook.name) private readonly workbookModel: Model<WorkbookDocument>,
    @InjectModel(WorkbookSignoff.name) private readonly signoffModel: Model<WorkbookSignoffDocument>,
    private readonly projectsService: ProjectsService,
    private readonly rolesService: WorkbookRolesService,
    private readonly registry: WorkbookElementRegistry,
  ) {}

  private async requireWorkbook(workbookId: string): Promise<WorkbookDocument> {
    if (!isValidObjectId(workbookId)) throw new NotFoundException("Workbook not found");
    const wb = await this.workbookModel.findById(workbookId).exec();
    if (!wb) throw new NotFoundException("Workbook not found");
    return wb;
  }

  private async loadAuthorize(workbookId: string, acting: ActingUser): Promise<{ wb: WorkbookDocument; mef: MefShape; myRoles: WorkbookRoleName[] }> {
    const wb = await this.requireWorkbook(workbookId);
    await this.projectsService.resolveAccess(wb.projectId, acting);
    const adapter = this.registry.get(wb.elementCode);
    const loaded = await adapter.load(workbookId);
    if (loaded === null) throw new NotFoundException("Workbook content not found");
    const myRoles = await this.rolesService.resolveEffectiveRoles(workbookId, acting.username);
    return { wb, mef: loaded.mef as MefShape, myRoles };
  }

  private async assignedUsernames(workbookId: string, role: WorkbookRoleName): Promise<string[]> {
    return this.rolesService.assignedUsernamesFor(workbookId, role);
  }

  private async transition(wb: WorkbookDocument, mef: MefShape, nextState: string, actor: string, note: string): Promise<unknown> {
    const now = new Date().toISOString();
    const history = mef.workflowHistory ?? [];
    if (history.length > 0) {
      const last = history[history.length - 1];
      if (last.exitedAt === undefined) last.exitedAt = now;
    }
    history.push({ state: nextState, enteredAt: now, actor, note });
    mef.workflowState = nextState;
    mef.workflowHistory = history;
    return this.registry.get(wb.elementCode).save(wb.id, mef);
  }

  async status(workbookId: string, acting: ActingUser): Promise<WorkbookWorkflowStatus> {
    const { mef, myRoles } = await this.loadAuthorize(workbookId, acting);
    const [preparers, coPreparers, reviewers, approvers, signoffs, holderInfos] = await Promise.all([
      this.assignedUsernames(workbookId, "preparer"),
      this.assignedUsernames(workbookId, "co_preparer"),
      this.assignedUsernames(workbookId, "reviewer"),
      this.assignedUsernames(workbookId, "approver"),
      this.signoffModel.find({ workbookId }).sort({ createdAt: 1 }).exec(),
      this.rolesService.enrichedRoleHolders(workbookId),
    ]);
    const signedAtByKey = new Map<string, string>();
    const sigDataByKey = new Map<string, string | null>();
    for (const s of signoffs) {
      const key = `${s.role}::${s.username}`;
      signedAtByKey.set(key, s.createdAt.toISOString());
      sigDataByKey.set(key, s.signatureDataUrl ?? null);
    }
    const roleHolders: WorkbookRoleHolderStatus[] = holderInfos.map((h) => ({
      role: h.role,
      username: h.username,
      fullName: h.fullName,
      designation: h.designation,
      signedAt: signedAtByKey.get(`${h.role}::${h.username}`) ?? null,
      signatureDataUrl: sigDataByKey.get(`${h.role}::${h.username}`) ?? null,
    }));

    const allReviewersSigned = reviewers.length > 0 && reviewers.every((u) => signoffs.some((s) => s.username === u && s.role === "reviewer"));

    let myPending: WorkbookSignoffRole | null = null;
    if (mef.workflowState === "INTERNAL_TECHNICAL_REVIEW") {
      if (myRoles.includes("reviewer") && !signoffs.some((s) => s.username === acting.username && s.role === "reviewer")) myPending = "reviewer";
    } else if (mef.workflowState === "INTERNAL_APPROVAL") {
      const allApproversSigned = approvers.length === 0 || approvers.every((u) => signoffs.some((s) => s.username === u && s.role === "approver"));
      if (!allApproversSigned) {
        if (myRoles.includes("approver") && !signoffs.some((s) => s.username === acting.username && s.role === "approver")) myPending = "approver";
      } else {
        if (myRoles.includes("co_preparer") && !signoffs.some((s) => s.username === acting.username && s.role === "co_preparer")) myPending = "co_preparer";
        else if (myRoles.includes("preparer") && !signoffs.some((s) => s.username === acting.username && s.role === "preparer")) myPending = "preparer";
      }
    }

    return {
      workflowState: mef.workflowState,
      preparers,
      coPreparers,
      reviewers,
      approvers,
      roleHolders,
      signoffs: signoffs.map((s) => ({ username: s.username, role: s.role, signedAt: s.createdAt.toISOString() })),
      myPendingSignoff: myPending,
      allReviewersSigned,
    };
  }

  private unresolvedCommentsAuthoredBy(mef: MefShape, username: string): number {
    const comments = mef.internalReviewComments?.comments ?? [];
    return comments.filter((c) => c.authorId === username && c.resolved !== true).length;
  }

  private async maybeAdvanceFromInternalApproval(wb: WorkbookDocument, mef: MefShape, workbookId: string, actor: string): Promise<unknown> {
    const approvers = await this.assignedUsernames(workbookId, "approver");
    const preparers = await this.assignedUsernames(workbookId, "preparer");
    const coPreparers = await this.assignedUsernames(workbookId, "co_preparer");
    const signoffs = await this.signoffModel.find({ workbookId, role: { $in: ["approver", "preparer", "co_preparer"] } }).exec();
    const allApproversSigned = approvers.every((u) => signoffs.some((s) => s.username === u && s.role === "approver"));
    const allPreparersSigned = preparers.every((u) => signoffs.some((s) => s.username === u && s.role === "preparer"));
    const allCoPreparersSigned = coPreparers.every((u) => signoffs.some((s) => s.username === u && s.role === "co_preparer"));
    if (allApproversSigned && allPreparersSigned && allCoPreparersSigned) {
      return this.transition(wb, mef, "FINAL", actor, "All signoffs collected; workbook finalized");
    }
    return mef;
  }

  async signAs(workbookId: string, role: WorkbookSignoffRole, acting: ActingUser, signatureDataUrl?: string): Promise<unknown> {
    if (role === "reviewer") return this.signReview(workbookId, acting, signatureDataUrl);
    if (role === "approver") return this.signApproval(workbookId, acting, signatureDataUrl);
    const { wb, mef, myRoles } = await this.loadAuthorize(workbookId, acting);
    if (role === "preparer" && !myRoles.includes("preparer")) throw new ForbiddenException("You are not a preparer on this workbook");
    if (role === "co_preparer" && !myRoles.includes("co_preparer")) throw new ForbiddenException("You are not a co-preparer on this workbook");
    if (mef.workflowState !== "INTERNAL_APPROVAL") throw new BadRequestException("Preparer signoffs are collected during internal approval");
    const existing = await this.signoffModel.findOne({ workbookId, username: acting.username, role }).exec();
    if (existing) throw new BadRequestException(`You already signed off as ${role}`);
    await this.signoffModel.create({ workbookId, username: acting.username, role, workflowState: mef.workflowState, signatureDataUrl: signatureDataUrl ?? null });
    return this.maybeAdvanceFromInternalApproval(wb, mef, workbookId, acting.username);
  }

  async submitForReview(workbookId: string, acting: ActingUser): Promise<unknown> {
    const { wb, mef, myRoles } = await this.loadAuthorize(workbookId, acting);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only a preparer can submit the workbook for review");
    if (mef.workflowState !== "DRAFT" && mef.workflowState !== "REVISION_REQUIRED") {
      throw new BadRequestException(`Cannot submit for review from state ${mef.workflowState}`);
    }
    const reviewBlockers = this.registry.get(wb.elementCode).validateForReview?.(mef) ?? [];
    if (reviewBlockers.length > 0) {
      throw new BadRequestException(`Resolve ${reviewBlockers.length} workbook validation blocker${reviewBlockers.length === 1 ? "" : "s"} before review: ${reviewBlockers.slice(0, 3).join(" ")}`);
    }
    const reviewers = await this.assignedUsernames(workbookId, "reviewer");
    if (reviewers.length === 0) throw new BadRequestException("Assign at least one reviewer before submitting");
    await this.signoffModel.deleteMany({ workbookId }).exec();
    return this.transition(wb, mef, "INTERNAL_TECHNICAL_REVIEW", acting.username, "Submitted for internal technical review");
  }

  async signReview(workbookId: string, acting: ActingUser, signatureDataUrl?: string): Promise<unknown> {
    const { mef, myRoles } = await this.loadAuthorize(workbookId, acting);
    if (!myRoles.includes("reviewer")) throw new ForbiddenException("You are not a reviewer on this workbook");
    if (mef.workflowState !== "INTERNAL_TECHNICAL_REVIEW") throw new BadRequestException("Workbook is not in internal technical review");
    const openMine = this.unresolvedCommentsAuthoredBy(mef, acting.username);
    if (openMine > 0) throw new BadRequestException(`You have ${openMine} unresolved comment${openMine === 1 ? "" : "s"} to address before signing`);
    const existing = await this.signoffModel.findOne({ workbookId, username: acting.username, role: "reviewer" }).exec();
    if (existing) throw new BadRequestException("You already signed off as a reviewer");
    await this.signoffModel.create({ workbookId, username: acting.username, role: "reviewer", workflowState: mef.workflowState, signatureDataUrl: signatureDataUrl ?? null });
    return mef;
  }

  async signApproval(workbookId: string, acting: ActingUser, signatureDataUrl?: string): Promise<unknown> {
    const { wb, mef, myRoles } = await this.loadAuthorize(workbookId, acting);
    if (!myRoles.includes("approver")) throw new ForbiddenException("You are not an approver on this workbook");
    if (mef.workflowState !== "INTERNAL_APPROVAL") throw new BadRequestException("Approver signoff is collected during internal approval");
    const openMine = this.unresolvedCommentsAuthoredBy(mef, acting.username);
    if (openMine > 0) throw new BadRequestException(`You have ${openMine} unresolved comment${openMine === 1 ? "" : "s"} to address before signing`);
    const existing = await this.signoffModel.findOne({ workbookId, username: acting.username, role: "approver" }).exec();
    if (existing) throw new BadRequestException("You already signed off as an approver");
    await this.signoffModel.create({ workbookId, username: acting.username, role: "approver", workflowState: mef.workflowState, signatureDataUrl: signatureDataUrl ?? null });
    return this.maybeAdvanceFromInternalApproval(wb, mef, workbookId, acting.username);
  }

  async submitToApprover(workbookId: string, acting: ActingUser): Promise<unknown> {
    const { wb, mef, myRoles } = await this.loadAuthorize(workbookId, acting);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only a preparer can submit to the approver");
    if (mef.workflowState !== "INTERNAL_TECHNICAL_REVIEW") throw new BadRequestException("Can only submit to approver during internal technical review");
    const reviewers = await this.assignedUsernames(workbookId, "reviewer");
    if (reviewers.length === 0) throw new BadRequestException("Assign at least one reviewer before submitting to the approver");
    const reviewerSignoffs = await this.signoffModel.find({ workbookId, role: "reviewer" }).exec();
    const allReviewersSigned = reviewers.every((u) => reviewerSignoffs.some((s) => s.username === u));
    if (!allReviewersSigned) throw new BadRequestException("All reviewers must sign before submitting to the approver");
    const approvers = await this.assignedUsernames(workbookId, "approver");
    if (approvers.length === 0) throw new BadRequestException("Assign at least one approver before submitting");
    return this.transition(wb, mef, "INTERNAL_APPROVAL", acting.username, "All reviewers signed; submitted to approver for final approval");
  }

  async requestRevision(workbookId: string, note: string, acting: ActingUser): Promise<unknown> {
    const { wb, mef, myRoles } = await this.loadAuthorize(workbookId, acting);
    if (!myRoles.includes("reviewer") && !myRoles.includes("approver")) {
      throw new ForbiddenException("Only reviewers or approvers can request revision");
    }
    if (mef.workflowState !== "INTERNAL_TECHNICAL_REVIEW" && mef.workflowState !== "INTERNAL_APPROVAL") {
      throw new BadRequestException("Revision can only be requested during review or approval");
    }
    await this.signoffModel.deleteMany({ workbookId }).exec();
    return this.transition(wb, mef, "REVISION_REQUIRED", acting.username, note.length > 0 ? note : "Revision requested");
  }

  async awaitingMe(acting: ActingUser): Promise<{ workbookId: string; projectId: string; workflowState: string; pendingAction: string }[]> {
    const rolesByWorkbook = await this.rolesService.workbookIdsAssignedTo(acting.username);
    if (rolesByWorkbook.size === 0) return [];
    const workbookIds = Array.from(rolesByWorkbook.keys());
    const wbs = await this.workbookModel.find({ _id: { $in: workbookIds.filter((id) => isValidObjectId(id)) } }).exec();
    const signoffs = await this.signoffModel.find({ workbookId: { $in: workbookIds }, username: acting.username }).exec();
    const out: { workbookId: string; projectId: string; workflowState: string; pendingAction: string }[] = [];
    for (const wb of wbs) {
      const id = wb.id as string;
      const myRoles = rolesByWorkbook.get(id) ?? [];
      const adapter = this.registry.tryGet(wb.elementCode);
      if (adapter === undefined) continue;
      const loaded = await adapter.load(id);
      if (loaded === null) continue;
      const state = (loaded.mef as MefShape).workflowState;
      if (state === "INTERNAL_TECHNICAL_REVIEW") {
        if (myRoles.includes("reviewer") && !signoffs.some((s) => s.workbookId === id && s.role === "reviewer")) {
          out.push({ workbookId: id, projectId: wb.projectId, workflowState: state, pendingAction: "Review and sign" });
        }
        continue;
      }
      if (state === "INTERNAL_APPROVAL") {
        const approverSigned = signoffs.some((s) => s.workbookId === id && s.role === "approver");
        if (!approverSigned) {
          if (myRoles.includes("approver") && !signoffs.some((s) => s.workbookId === id && s.role === "approver")) {
            out.push({ workbookId: id, projectId: wb.projectId, workflowState: state, pendingAction: "Approve and sign" });
            continue;
          }
        } else {
          if (myRoles.includes("co_preparer") && !signoffs.some((s) => s.workbookId === id && s.role === "co_preparer")) {
            out.push({ workbookId: id, projectId: wb.projectId, workflowState: state, pendingAction: "Sign as co-preparer" });
            continue;
          }
          if (myRoles.includes("preparer") && !signoffs.some((s) => s.workbookId === id && s.role === "preparer")) {
            out.push({ workbookId: id, projectId: wb.projectId, workflowState: state, pendingAction: "Sign as preparer" });
          }
        }
      }
    }
    return out;
  }
}
