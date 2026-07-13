import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { RiskIntegrationSchema } from "interfaces-mef-types/zod/ri/risk-integration";
import { ProjectsService } from "../projects/projects.service";
import { ExampleWorkbooksService } from "../example-workbooks/example-workbooks.service";
import { WorkbookRolesService, type WorkbookRoleName } from "../workbooks/workbook-roles.service";
import { WorkbookSignoff, type WorkbookSignoffDocument } from "../workbooks/workbook-signoff.schema";
import { RiWorkbook, type RiWorkbookDocument } from "./ri-workbook.schema";
import { RiDocumentsService } from "./ri-documents.service";
import { createBlankRi } from "./blank-ri";
import { stripNulls } from "../pos-workbooks/mef-normalize";
import { healMef } from "../pos-workbooks/mef-heal";

export interface RiWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  mef: unknown;
  myRoles: WorkbookRoleName[];
  hasPreviousMef: boolean;
  updatedAt: string;
}

interface ActingUser {
  username: string;
}

function toResponse(doc: RiWorkbookDocument, myRoles: WorkbookRoleName[]): RiWorkbookResponse {
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
export class RiWorkbooksService {
  constructor(
    @InjectModel(RiWorkbook.name) private readonly riWorkbookModel: Model<RiWorkbookDocument>,
    @InjectModel(WorkbookSignoff.name) private readonly signoffModel: Model<WorkbookSignoffDocument>,
    private readonly projectsService: ProjectsService,
    private readonly exampleWorkbooksService: ExampleWorkbooksService,
    private readonly rolesService: WorkbookRolesService,
    private readonly riDocumentsService: RiDocumentsService,
  ) {}

  private async loadMyRoles(workbookId: string, username: string): Promise<WorkbookRoleName[]> {
    return this.rolesService.resolveEffectiveRoles(workbookId, username);
  }

  async findOne(workbookId: string, acting: ActingUser): Promise<RiWorkbookResponse> {
    const doc = await this.riWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("RI workbook not found");
    await this.projectsService.resolveAccess(doc.projectId, acting);
    const myRoles = await this.loadMyRoles(workbookId, acting.username);
    return toResponse(doc, myRoles);
  }

  async replaceMef(workbookId: string, mef: unknown, acting: ActingUser): Promise<RiWorkbookResponse> {
    const doc = await this.riWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("RI workbook not found");
    const { role } = await this.projectsService.resolveAccess(doc.projectId, acting);
    if (role === "viewer") throw new ForbiddenException("You cannot edit this RI workbook");
    const parsed = RiskIntegrationSchema.safeParse(stripNulls(mef));
    if (!parsed.success) {
      throw new ForbiddenException(`Invalid RI workbook payload: ${parsed.error.message}`);
    }
    doc.mef = parsed.data;
    await doc.save();
    const myRoles = await this.loadMyRoles(workbookId, acting.username);
    return toResponse(doc, myRoles);
  }

  async loadExample(workbookId: string, acting: ActingUser, exampleId?: string): Promise<RiWorkbookResponse> {
    const doc = await this.riWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("RI workbook not found");
    await this.projectsService.resolveAccess(doc.projectId, acting);
    const myRoles = await this.loadMyRoles(workbookId, acting.username);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only preparers can load the example");
    const state = (doc.mef as { workflowState?: string }).workflowState ?? "DRAFT";
    if (state !== "DRAFT" && state !== "REVISION_REQUIRED") {
      throw new ForbiddenException(`Cannot overwrite a workbook in state ${state}`);
    }
    const example = await this.exampleWorkbooksService.getRiBundle(exampleId);
    const parsed = RiskIntegrationSchema.safeParse(stripNulls(example.ri.mef));
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
    await this.riDocumentsService.removeAllForWorkbook(workbookId);
    return toResponse(doc, myRoles);
  }

  async unloadExample(workbookId: string, acting: ActingUser): Promise<RiWorkbookResponse> {
    const doc = await this.riWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("RI workbook not found");
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
    const template = createBlankRi(restoredObj.name ?? "RI Workbook", restoredObj.owner ?? acting.username);
    const healed = healMef(restored, template);
    const parsed = RiskIntegrationSchema.safeParse(healed);
    if (!parsed.success) throw new ForbiddenException(`Stored prior MEF failed validation: ${parsed.error.message}`);
    doc.mef = parsed.data;
    doc.previousMefJson = null;
    await doc.save();
    return toResponse(doc, myRoles);
  }
}
