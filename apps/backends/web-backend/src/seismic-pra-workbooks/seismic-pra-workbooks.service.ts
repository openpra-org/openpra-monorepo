import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { SeismicPRASchema } from "interfaces-mef-types/zod/seismic/seismic-pra";
import { ExampleWorkbooksService } from "../example-workbooks/example-workbooks.service";
import { ProjectsService } from "../projects/projects.service";
import { healMef } from "../pos-workbooks/mef-heal";
import { stripNulls } from "../pos-workbooks/mef-normalize";
import { WorkbookRolesService, type WorkbookRoleName } from "../workbooks/workbook-roles.service";
import { WorkbookSignoff, type WorkbookSignoffDocument } from "../workbooks/workbook-signoff.schema";
import { Workbook, type WorkbookDocument } from "../workbooks/workbook.schema";
import { createBlankSeismicPra } from "./blank-seismic-pra";
import { SeismicPraDocumentsService } from "./seismic-pra-documents.service";
import { SeismicPraWorkbook, type SeismicPraWorkbookDocument } from "./seismic-pra-workbook.schema";

export interface SeismicPraWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  mef: unknown;
  myRoles: WorkbookRoleName[];
  hasPreviousMef: boolean;
  updatedAt: string;
}

interface ActingUser { username: string }

function toResponse(doc: SeismicPraWorkbookDocument, myRoles: WorkbookRoleName[]): SeismicPraWorkbookResponse {
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
export class SeismicPraWorkbooksService {
  constructor(
    @InjectModel(SeismicPraWorkbook.name) private readonly workbookModel: Model<SeismicPraWorkbookDocument>,
    @InjectModel(Workbook.name) private readonly baseWorkbookModel: Model<WorkbookDocument>,
    @InjectModel(WorkbookSignoff.name) private readonly signoffModel: Model<WorkbookSignoffDocument>,
    private readonly projectsService: ProjectsService,
    private readonly exampleWorkbooksService: ExampleWorkbooksService,
    private readonly rolesService: WorkbookRolesService,
    private readonly documentsService: SeismicPraDocumentsService,
  ) {}

  private loadMyRoles(workbookId: string, username: string): Promise<WorkbookRoleName[]> {
    return this.rolesService.resolveEffectiveRoles(workbookId, username);
  }

  /**
   * Workbooks created before the Seismic PRA adapter existed have a base workbook
   * record but no element-specific document. Materialize the blank MEF lazily so
   * those workbooks open normally instead of becoming orphaned placeholders.
   */
  private async findOrInitialize(workbookId: string, acting: ActingUser): Promise<SeismicPraWorkbookDocument> {
    const existing = await this.workbookModel.findOne({ workbookId }).exec();
    if (existing) return existing;

    const baseWorkbook = await this.baseWorkbookModel.findOne({ _id: workbookId, elementCode: "S" }).exec();
    if (!baseWorkbook) throw new NotFoundException("Seismic PRA workbook not found");
    await this.projectsService.resolveAccess(baseWorkbook.projectId, acting);

    try {
      const initialized = await this.workbookModel.create({
        workbookId,
        projectId: baseWorkbook.projectId,
        ownerUsername: baseWorkbook.ownerUsername,
        mef: createBlankSeismicPra(baseWorkbook.name, baseWorkbook.ownerUsername),
      });
      await this.rolesService.createInitialPreparer(workbookId, baseWorkbook.ownerUsername);
      return initialized;
    } catch (error: unknown) {
      // A concurrent first request may have created the unique workbook record.
      const initialized = await this.workbookModel.findOne({ workbookId }).exec();
      if (initialized) return initialized;
      throw error;
    }
  }

  async findOne(workbookId: string, acting: ActingUser): Promise<SeismicPraWorkbookResponse> {
    const doc = await this.findOrInitialize(workbookId, acting);
    await this.projectsService.resolveAccess(doc.projectId, acting);
    return toResponse(doc, await this.loadMyRoles(workbookId, acting.username));
  }

  async replaceMef(workbookId: string, mef: unknown, acting: ActingUser): Promise<SeismicPraWorkbookResponse> {
    const doc = await this.findOrInitialize(workbookId, acting);
    const { role } = await this.projectsService.resolveAccess(doc.projectId, acting);
    if (role === "viewer") throw new ForbiddenException("You cannot edit this Seismic PRA workbook");
    const parsed = SeismicPRASchema.safeParse(stripNulls(mef));
    if (!parsed.success) throw new ForbiddenException(`Invalid Seismic PRA workbook payload: ${parsed.error.message}`);
    doc.mef = parsed.data;
    await doc.save();
    return toResponse(doc, await this.loadMyRoles(workbookId, acting.username));
  }

  async loadExample(workbookId: string, acting: ActingUser, exampleId?: string): Promise<SeismicPraWorkbookResponse> {
    const doc = await this.findOrInitialize(workbookId, acting);
    await this.projectsService.resolveAccess(doc.projectId, acting);
    const myRoles = await this.loadMyRoles(workbookId, acting.username);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only preparers can load the example");
    const state = (doc.mef as { workflowState?: string }).workflowState ?? "DRAFT";
    if (state !== "DRAFT" && state !== "REVISION_REQUIRED") throw new ForbiddenException(`Cannot overwrite a workbook in state ${state}`);
    const example = await this.exampleWorkbooksService.getSeismicPraBundle(exampleId);
    const parsed = SeismicPRASchema.safeParse(stripNulls(example.seismicPra.mef));
    if (!parsed.success) throw new ForbiddenException(`Example MEF failed validation: ${parsed.error.message}`);
    doc.previousMefJson = JSON.stringify(doc.mef);
    doc.mef = {
      ...parsed.data,
      workflowState: "DRAFT",
      workflowHistory: [{ state: "DRAFT", enteredAt: new Date().toISOString(), actor: acting.username, note: "Loaded from example workbook" }],
    };
    await doc.save();
    await this.signoffModel.deleteMany({ workbookId }).exec();
    await this.documentsService.removeAllForWorkbook(workbookId);
    return toResponse(doc, myRoles);
  }

  async unloadExample(workbookId: string, acting: ActingUser): Promise<SeismicPraWorkbookResponse> {
    const doc = await this.findOrInitialize(workbookId, acting);
    await this.projectsService.resolveAccess(doc.projectId, acting);
    const myRoles = await this.loadMyRoles(workbookId, acting.username);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only preparers can unload the example");
    if (typeof doc.previousMefJson !== "string" || doc.previousMefJson.length === 0) throw new ForbiddenException("This workbook has no prior contents to restore");
    const state = (doc.mef as { workflowState?: string }).workflowState ?? "DRAFT";
    if (state !== "DRAFT" && state !== "REVISION_REQUIRED") throw new ForbiddenException(`Cannot unload from state ${state}`);
    const restored: unknown = JSON.parse(doc.previousMefJson);
    const restoredObj = restored as { name?: string; owner?: string };
    const healed = healMef(restored, createBlankSeismicPra(restoredObj.name ?? "Seismic PRA Workbook", restoredObj.owner ?? acting.username));
    const parsed = SeismicPRASchema.safeParse(healed);
    if (!parsed.success) throw new ForbiddenException(`Stored prior MEF failed validation: ${parsed.error.message}`);
    doc.mef = parsed.data;
    doc.previousMefJson = null;
    await doc.save();
    return toResponse(doc, myRoles);
  }
}
