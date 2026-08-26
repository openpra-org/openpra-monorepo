import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { DataAnalysisSchema } from "interfaces-mef-types/zod/da/data-analysis";
import { ProjectsService } from "../projects/projects.service";
import { ExampleWorkbooksService } from "../example-workbooks/example-workbooks.service";
import { WorkbookRolesService, type WorkbookRoleName } from "../workbooks/workbook-roles.service";
import { WorkbookSignoff, type WorkbookSignoffDocument } from "../workbooks/workbook-signoff.schema";
import { DaWorkbook, type DaWorkbookDocument } from "./da-workbook.schema";
import { DaDocumentsService } from "./da-documents.service";
import { createBlankDa } from "./blank-da";
import { stripNulls } from "../pos-workbooks/mef-normalize";
import { healMef } from "../pos-workbooks/mef-heal";
import { mergeWorkbookPatch } from "../workbooks/workbook-mef-patch";
import type { RevisionedWorkbookPatchBody } from "interfaces-shared-types/workbooks";
import {
  assertExpectedWorkbookRevision,
  createWorkbookRevisionFilter,
  readWorkbookRevision,
  workbookRevisionConflict,
} from "../workbooks/workbook-revision";

export interface DaWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  revision: number;
  mef: unknown;
  myRoles: WorkbookRoleName[];
  hasPreviousMef: boolean;
  updatedAt: string;
}

interface ActingUser {
  username: string;
}

function toResponse(doc: DaWorkbookDocument, myRoles: WorkbookRoleName[]): DaWorkbookResponse {
  return {
    workbookId: doc.workbookId,
    projectId: doc.projectId,
    ownerUsername: doc.ownerUsername,
    revision: readWorkbookRevision(doc),
    mef: doc.mef,
    myRoles,
    hasPreviousMef: typeof doc.previousMefJson === "string" && doc.previousMefJson.length > 0,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

@Injectable()
export class DaWorkbooksService {
  constructor(
    @InjectModel(DaWorkbook.name) private readonly daWorkbookModel: Model<DaWorkbookDocument>,
    @InjectModel(WorkbookSignoff.name) private readonly signoffModel: Model<WorkbookSignoffDocument>,
    private readonly projectsService: ProjectsService,
    private readonly exampleWorkbooksService: ExampleWorkbooksService,
    private readonly rolesService: WorkbookRolesService,
    private readonly daDocumentsService: DaDocumentsService,
  ) {}

  private async loadMyRoles(workbookId: string, username: string): Promise<WorkbookRoleName[]> {
    return this.rolesService.resolveEffectiveRoles(workbookId, username);
  }

  async findOne(workbookId: string, acting: ActingUser): Promise<DaWorkbookResponse> {
    const doc = await this.daWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("DA workbook not found");
    await this.projectsService.resolveAccess(doc.projectId, acting);
    const myRoles = await this.loadMyRoles(workbookId, acting.username);
    return toResponse(doc, myRoles);
  }

  async patchMef(workbookId: string, patch: RevisionedWorkbookPatchBody, acting: ActingUser): Promise<DaWorkbookResponse> {
    const doc = await this.daWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("DA workbook not found");
    const { role } = await this.projectsService.resolveAccess(doc.projectId, acting);
    if (role === "viewer") throw new ForbiddenException("You cannot edit this DA workbook");
    assertExpectedWorkbookRevision(doc, patch.expectedRevision);
    const current = DataAnalysisSchema.safeParse(stripNulls(doc.mef));
    if (!current.success) {
      throw new BadRequestException(`Stored DA workbook failed validation: ${current.error.message}`);
    }
    const parsed = DataAnalysisSchema.safeParse(stripNulls(mergeWorkbookPatch(current.data, patch.operations)));
    if (!parsed.success) {
      throw new BadRequestException(`Invalid DA workbook payload: ${parsed.error.message}`);
    }
    const updatedDoc = await this.daWorkbookModel
      .findOneAndUpdate(
        createWorkbookRevisionFilter(workbookId, patch.expectedRevision),
        { $set: { mef: parsed.data, revision: patch.expectedRevision + 1 } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updatedDoc) throw workbookRevisionConflict(patch.expectedRevision);
    const myRoles = await this.loadMyRoles(workbookId, acting.username);
    return toResponse(updatedDoc, myRoles);
  }

  async loadExample(workbookId: string, acting: ActingUser, exampleId?: string): Promise<DaWorkbookResponse> {
    const doc = await this.daWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("DA workbook not found");
    const expectedRevision = readWorkbookRevision(doc);
    await this.projectsService.resolveAccess(doc.projectId, acting);
    const myRoles = await this.loadMyRoles(workbookId, acting.username);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only preparers can load the example");
    const state = (doc.mef as { workflowState?: string }).workflowState ?? "DRAFT";
    if (state !== "DRAFT" && state !== "REVISION_REQUIRED") {
      throw new ForbiddenException(`Cannot overwrite a workbook in state ${state}`);
    }
    const example = await this.exampleWorkbooksService.getDaBundle(exampleId);
    const parsed = DataAnalysisSchema.safeParse(stripNulls(example.da.mef));
    if (!parsed.success) throw new ForbiddenException(`Example MEF failed validation: ${parsed.error.message}`);
    const cleaned = {
      ...parsed.data,
      workflowState: "DRAFT",
      workflowHistory: [{ state: "DRAFT", enteredAt: new Date().toISOString(), actor: acting.username, note: "Loaded from example workbook" }],
    };
    const updatedDoc = await this.daWorkbookModel
      .findOneAndUpdate(
        createWorkbookRevisionFilter(workbookId, expectedRevision),
        { $set: { previousMefJson: JSON.stringify(doc.mef), mef: cleaned, revision: expectedRevision + 1 } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updatedDoc) throw workbookRevisionConflict(expectedRevision);
    await this.signoffModel.deleteMany({ workbookId }).exec();
    await this.daDocumentsService.removeAllForWorkbook(workbookId);
    return toResponse(updatedDoc, myRoles);
  }

  async unloadExample(workbookId: string, acting: ActingUser): Promise<DaWorkbookResponse> {
    const doc = await this.daWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("DA workbook not found");
    const expectedRevision = readWorkbookRevision(doc);
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
    const template = createBlankDa(restoredObj.name ?? "DA Workbook", restoredObj.owner ?? acting.username);
    const healed = healMef(restored, template);
    const parsed = DataAnalysisSchema.safeParse(healed);
    if (!parsed.success) throw new ForbiddenException(`Stored prior MEF failed validation: ${parsed.error.message}`);
    const updatedDoc = await this.daWorkbookModel
      .findOneAndUpdate(
        createWorkbookRevisionFilter(workbookId, expectedRevision),
        { $set: { mef: parsed.data, previousMefJson: null, revision: expectedRevision + 1 } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updatedDoc) throw workbookRevisionConflict(expectedRevision);
    return toResponse(updatedDoc, myRoles);
  }
}
