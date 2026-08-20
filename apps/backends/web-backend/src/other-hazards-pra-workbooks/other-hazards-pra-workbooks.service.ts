import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { synchronizeOtherHazardsPraDerivedRegisters } from "interfaces-mef-types/other-hazards/other-hazards-pra-validation";
import { OtherHazardsPRASchema } from "interfaces-mef-types/zod/other-hazards/other-hazards-pra";
import { ProjectsService } from "../projects/projects.service";
import { ExampleWorkbooksService } from "../example-workbooks/example-workbooks.service";
import { healMef } from "../pos-workbooks/mef-heal";
import { stripNulls } from "../pos-workbooks/mef-normalize";
import { mergeWorkbookPatch } from "../workbooks/workbook-mef-patch";
import { WorkbookRolesService, type WorkbookRoleName } from "../workbooks/workbook-roles.service";
import { Workbook, type WorkbookDocument } from "../workbooks/workbook.schema";
import { WorkbookSignoff, type WorkbookSignoffDocument } from "../workbooks/workbook-signoff.schema";
import { createBlankOtherHazardsPra } from "./blank-other-hazards-pra";
import { OtherHazardsPraWorkbook, type OtherHazardsPraWorkbookDocument } from "./other-hazards-pra-workbook.schema";

export interface OtherHazardsPraWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  mef: unknown;
  myRoles: WorkbookRoleName[];
  hasPreviousMef: boolean;
  updatedAt: string;
}

interface ActingUser { username: string }

function toResponse(doc: OtherHazardsPraWorkbookDocument, myRoles: WorkbookRoleName[]): OtherHazardsPraWorkbookResponse {
  return {
    workbookId: doc.workbookId,
    projectId: doc.projectId,
    ownerUsername: doc.ownerUsername,
    mef: doc.mef,
    myRoles,
    hasPreviousMef: typeof doc.previousMefJson === "string" && doc.previousMefJson.length > 0,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

@Injectable()
export class OtherHazardsPraWorkbooksService {
  constructor(
    @InjectModel(OtherHazardsPraWorkbook.name) private readonly workbookModel: Model<OtherHazardsPraWorkbookDocument>,
    @InjectModel(Workbook.name) private readonly baseWorkbookModel: Model<WorkbookDocument>,
    @InjectModel(WorkbookSignoff.name) private readonly signoffModel: Model<WorkbookSignoffDocument>,
    private readonly projectsService: ProjectsService,
    private readonly exampleWorkbooksService: ExampleWorkbooksService,
    private readonly rolesService: WorkbookRolesService,
  ) {}

  private loadMyRoles(workbookId: string, username: string): Promise<WorkbookRoleName[]> {
    return this.rolesService.resolveEffectiveRoles(workbookId, username);
  }

  private async findOrInitialize(workbookId: string, acting: ActingUser): Promise<OtherHazardsPraWorkbookDocument> {
    const existing = await this.workbookModel.findOne({ workbookId }).exec();
    if (existing) {
      const current = existing.mef as { name?: string; owner?: string };
      const healed = healMef(existing.mef, createBlankOtherHazardsPra(current.name ?? "Other Hazards PRA Workbook", current.owner ?? existing.ownerUsername));
      const parsed = OtherHazardsPRASchema.safeParse(healed);
      if (parsed.success && JSON.stringify(parsed.data) !== JSON.stringify(existing.mef)) {
        existing.mef = parsed.data;
        await existing.save();
      }
      return existing;
    }
    const baseWorkbook = await this.baseWorkbookModel.findOne({ _id: workbookId, elementCode: "O" }).exec();
    if (!baseWorkbook) throw new NotFoundException("Other Hazards PRA workbook not found");
    await this.projectsService.resolveAccess(baseWorkbook.projectId, acting);
    try {
      const initialized = await this.workbookModel.create({
        workbookId,
        projectId: baseWorkbook.projectId,
        ownerUsername: baseWorkbook.ownerUsername,
        mef: createBlankOtherHazardsPra(baseWorkbook.name, baseWorkbook.ownerUsername),
      });
      await this.rolesService.createInitialPreparer(workbookId, baseWorkbook.ownerUsername);
      return initialized;
    } catch (error: unknown) {
      const initialized = await this.workbookModel.findOne({ workbookId }).exec();
      if (initialized) return initialized;
      throw error;
    }
  }

  async findOne(workbookId: string, acting: ActingUser): Promise<OtherHazardsPraWorkbookResponse> {
    const doc = await this.findOrInitialize(workbookId, acting);
    await this.projectsService.resolveAccess(doc.projectId, acting);
    return toResponse(doc, await this.loadMyRoles(workbookId, acting.username));
  }

  async patchMef(workbookId: string, operations: unknown, acting: ActingUser): Promise<OtherHazardsPraWorkbookResponse> {
    const doc = await this.findOrInitialize(workbookId, acting);
    const { role } = await this.projectsService.resolveAccess(doc.projectId, acting);
    if (role === "viewer") throw new ForbiddenException("You cannot edit this Other Hazards PRA workbook");
    const parsed = OtherHazardsPRASchema.safeParse(stripNulls(mergeWorkbookPatch(doc.mef, operations)));
    if (!parsed.success) throw new ForbiddenException(`Invalid Other Hazards PRA workbook payload: ${parsed.error.message}`);
    doc.mef = synchronizeOtherHazardsPraDerivedRegisters(parsed.data);
    await doc.save();
    return toResponse(doc, await this.loadMyRoles(workbookId, acting.username));
  }

  async loadExample(workbookId: string, acting: ActingUser, exampleId?: string): Promise<OtherHazardsPraWorkbookResponse> {
    const doc = await this.findOrInitialize(workbookId, acting);
    await this.projectsService.resolveAccess(doc.projectId, acting);
    const myRoles = await this.loadMyRoles(workbookId, acting.username);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only preparers can load the example");
    const state = (doc.mef as { workflowState?: string }).workflowState ?? "DRAFT";
    if (state !== "DRAFT" && state !== "REVISION_REQUIRED") throw new ForbiddenException(`Cannot overwrite a workbook in state ${state}`);
    const example = await this.exampleWorkbooksService.getOtherHazardsPraBundle(exampleId);
    const parsed = OtherHazardsPRASchema.safeParse(stripNulls(example.otherHazardsPra.mef));
    if (!parsed.success) throw new ForbiddenException(`Example MEF failed validation: ${parsed.error.message}`);
    doc.previousMefJson = JSON.stringify(doc.mef);
    doc.mef = { ...synchronizeOtherHazardsPraDerivedRegisters(parsed.data), workflowState: "DRAFT", workflowHistory: [{ state: "DRAFT", enteredAt: new Date().toISOString(), actor: acting.username, note: "Loaded from example workbook" }] };
    await doc.save();
    await this.signoffModel.deleteMany({ workbookId }).exec();
    return toResponse(doc, myRoles);
  }

  async unloadExample(workbookId: string, acting: ActingUser): Promise<OtherHazardsPraWorkbookResponse> {
    const doc = await this.findOrInitialize(workbookId, acting);
    await this.projectsService.resolveAccess(doc.projectId, acting);
    const myRoles = await this.loadMyRoles(workbookId, acting.username);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only preparers can unload the example");
    if (typeof doc.previousMefJson !== "string" || doc.previousMefJson.length === 0) throw new ForbiddenException("This workbook has no prior contents to restore");
    const state = (doc.mef as { workflowState?: string }).workflowState ?? "DRAFT";
    if (state !== "DRAFT" && state !== "REVISION_REQUIRED") throw new ForbiddenException(`Cannot unload from state ${state}`);
    const restored: unknown = JSON.parse(doc.previousMefJson);
    const restoredObject = restored as { name?: string; owner?: string };
    const healed = healMef(restored, createBlankOtherHazardsPra(restoredObject.name ?? "Other Hazards PRA Workbook", restoredObject.owner ?? acting.username));
    const parsed = OtherHazardsPRASchema.safeParse(healed);
    if (!parsed.success) throw new ForbiddenException(`Stored prior MEF failed validation: ${parsed.error.message}`);
    doc.mef = parsed.data;
    doc.previousMefJson = null;
    await doc.save();
    return toResponse(doc, myRoles);
  }
}
