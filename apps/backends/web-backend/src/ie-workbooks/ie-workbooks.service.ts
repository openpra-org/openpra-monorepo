import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { InitiatingEventsAnalysisSchema } from "interfaces-mef-types/zod/ie/initiating-event-analysis";
import { ProjectsService } from "../projects/projects.service";
import { ExampleWorkbooksService } from "../example-workbooks/example-workbooks.service";
import { WorkbookRolesService, type WorkbookRoleName } from "../workbooks/workbook-roles.service";
import { WorkbookSignoff, type WorkbookSignoffDocument } from "../workbooks/workbook-signoff.schema";
import { IeWorkbook, type IeWorkbookDocument } from "./ie-workbook.schema";
import { IeDocumentsService } from "./ie-documents.service";
import { createBlankIe } from "./blank-ie";
import { stripNulls } from "../pos-workbooks/mef-normalize";
import { healMef } from "../pos-workbooks/mef-heal";

export interface IeWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  mef: unknown;
  myRoles: WorkbookRoleName[];
  hasPreviousMef: boolean;
  linkedPosWorkbookId: string | null;
  updatedAt: string;
}

interface ActingUser {
  username: string;
}

function toResponse(doc: IeWorkbookDocument, myRoles: WorkbookRoleName[]): IeWorkbookResponse {
  return {
    workbookId: doc.workbookId,
    projectId: doc.projectId,
    ownerUsername: doc.ownerUsername,
    mef: doc.mef,
    myRoles,
    hasPreviousMef: typeof doc.previousMefJson === "string" && doc.previousMefJson.length > 0,
    linkedPosWorkbookId: typeof doc.linkedPosWorkbookId === "string" ? doc.linkedPosWorkbookId : null,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

@Injectable()
export class IeWorkbooksService {
  constructor(
    @InjectModel(IeWorkbook.name) private readonly ieWorkbookModel: Model<IeWorkbookDocument>,
    @InjectModel(WorkbookSignoff.name) private readonly signoffModel: Model<WorkbookSignoffDocument>,
    private readonly projectsService: ProjectsService,
    private readonly exampleWorkbooksService: ExampleWorkbooksService,
    private readonly ieDocumentsService: IeDocumentsService,
    private readonly rolesService: WorkbookRolesService,
  ) {}

  private async loadMyRoles(workbookId: string, username: string): Promise<WorkbookRoleName[]> {
    return this.rolesService.resolveEffectiveRoles(workbookId, username);
  }

  async findOne(workbookId: string, acting: ActingUser): Promise<IeWorkbookResponse> {
    const doc = await this.ieWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("IE workbook not found");
    await this.projectsService.resolveAccess(doc.projectId, acting);
    const myRoles = await this.loadMyRoles(workbookId, acting.username);
    return toResponse(doc, myRoles);
  }

  async replaceMef(workbookId: string, mef: unknown, acting: ActingUser): Promise<IeWorkbookResponse> {
    const doc = await this.ieWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("IE workbook not found");
    const { role } = await this.projectsService.resolveAccess(doc.projectId, acting);
    if (role === "viewer") throw new ForbiddenException("You cannot edit this IE workbook");
    const parsed = InitiatingEventsAnalysisSchema.safeParse(stripNulls(mef));
    if (!parsed.success) {
      throw new ForbiddenException(`Invalid IE workbook payload: ${parsed.error.message}`);
    }
    doc.mef = parsed.data;
    await doc.save();
    const myRoles = await this.loadMyRoles(workbookId, acting.username);
    return toResponse(doc, myRoles);
  }

  async loadExample(workbookId: string, acting: ActingUser): Promise<IeWorkbookResponse> {
    const doc = await this.ieWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("IE workbook not found");
    await this.projectsService.resolveAccess(doc.projectId, acting);
    const myRoles = await this.loadMyRoles(workbookId, acting.username);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only preparers can load the example");
    const state = (doc.mef as { workflowState?: string }).workflowState ?? "DRAFT";
    if (state !== "DRAFT" && state !== "REVISION_REQUIRED") {
      throw new ForbiddenException(`Cannot overwrite a workbook in state ${state}`);
    }
    const example = await this.exampleWorkbooksService.getIeBundle();
    const parsed = InitiatingEventsAnalysisSchema.safeParse(stripNulls(example.ie.mef));
    if (!parsed.success) throw new ForbiddenException(`Example MEF failed validation: ${parsed.error.message}`);
    const cleaned = {
      ...parsed.data,
      workflowState: "DRAFT",
      workflowHistory: [{ state: "DRAFT", enteredAt: new Date().toISOString(), actor: acting.username, note: "Loaded from example workbook" }],
    };
    doc.previousMefJson = JSON.stringify(doc.mef);
    doc.mef = cleaned;
    await doc.save();
    await this.signoffModel.deleteMany({ workbookId }).exec();
    await this.ieDocumentsService.removeAllForWorkbook(workbookId);
    return toResponse(doc, myRoles);
  }

  async unloadExample(workbookId: string, acting: ActingUser): Promise<IeWorkbookResponse> {
    const doc = await this.ieWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("IE workbook not found");
    await this.projectsService.resolveAccess(doc.projectId, acting);
    const myRoles = await this.loadMyRoles(workbookId, acting.username);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only preparers can unload the example");
    if (typeof doc.previousMefJson !== "string" || doc.previousMefJson.length === 0) {
      throw new ForbiddenException("This workbook has no prior contents to restore");
    }
    const state = (doc.mef as { workflowState?: string }).workflowState ?? "DRAFT";
    if (state !== "DRAFT" && state !== "REVISION_REQUIRED") {
      throw new ForbiddenException(`Cannot unload from state ${state}`);
    }
    const restored: unknown = JSON.parse(doc.previousMefJson);
    const restoredObj = restored as { name?: string; owner?: string };
    const template = createBlankIe(restoredObj.name ?? "IE Workbook", restoredObj.owner ?? acting.username);
    const healed = healMef(restored, template);
    const parsed = InitiatingEventsAnalysisSchema.safeParse(healed);
    if (!parsed.success) throw new ForbiddenException(`Stored prior MEF failed validation: ${parsed.error.message}`);
    doc.mef = parsed.data;
    doc.previousMefJson = null;
    await doc.save();
    return toResponse(doc, myRoles);
  }
}
