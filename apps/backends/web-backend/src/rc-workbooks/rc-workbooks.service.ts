import { RcPublishedExampleService } from "./rc-published-example.service";
import { RC_PUBLISHED_SLUG } from "../example-workbooks/seeds/rc-published-inputs-seed";
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { isDeepStrictEqual } from "util";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { withSourceTermSummary } from "interfaces-shared-types/rc-workbooks/source-term-summary";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { RadiologicalConsequenceAnalysisSchema } from "interfaces-mef-types/zod/rc/radiological-consequence-analysis";
import { ProjectsService } from "../projects/projects.service";
import { ExampleWorkbooksService } from "../example-workbooks/example-workbooks.service";
import { WorkbookRolesService, type WorkbookRoleName } from "../workbooks/workbook-roles.service";
import { WorkbookSignoff, type WorkbookSignoffDocument } from "../workbooks/workbook-signoff.schema";
import { RcWorkbook, type RcWorkbookDocument } from "./rc-workbook.schema";
import { RcDocumentsService } from "./rc-documents.service";
import { createBlankRc } from "./blank-rc";
import { stripNulls } from "../pos-workbooks/mef-normalize";
import { healMef } from "../pos-workbooks/mef-heal";
import { mergeWorkbookPatch } from "../workbooks/workbook-mef-patch";

export interface RcWorkbookResponse {
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

function toResponse(doc: RcWorkbookDocument, myRoles: WorkbookRoleName[]): RcWorkbookResponse {
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
export class RcWorkbooksService {
  constructor(
    @InjectModel(RcWorkbook.name) private readonly rcWorkbookModel: Model<RcWorkbookDocument>,
    @InjectModel(WorkbookSignoff.name) private readonly signoffModel: Model<WorkbookSignoffDocument>,
    private readonly projectsService: ProjectsService,
    private readonly exampleWorkbooksService: ExampleWorkbooksService,
    private readonly rolesService: WorkbookRolesService,
    private readonly rcDocumentsService: RcDocumentsService,
    private readonly publishedExample: RcPublishedExampleService,
  ) {}

  private async loadMyRoles(workbookId: string, username: string): Promise<WorkbookRoleName[]> {
    return this.rolesService.resolveEffectiveRoles(workbookId, username);
  }

  async findOne(workbookId: string, acting: ActingUser): Promise<RcWorkbookResponse> {
    const doc = await this.rcWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("RC workbook not found");
    await this.projectsService.resolveAccess(doc.projectId, acting);
    const myRoles = await this.loadMyRoles(workbookId, acting.username);
    return toResponse(doc, myRoles);
  }

  async patchMef(workbookId: string, operations: unknown, acting: ActingUser): Promise<RcWorkbookResponse> {
    const doc = await this.rcWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("RC workbook not found");
    const { role } = await this.projectsService.resolveAccess(doc.projectId, acting);
    if (role === "viewer") throw new ForbiddenException("You cannot edit this RC workbook");
    const parsed = RadiologicalConsequenceAnalysisSchema.safeParse(stripNulls(mergeWorkbookPatch(doc.mef, operations)));
    if (!parsed.success) {
      throw new ForbiddenException(`Invalid RC workbook payload: ${parsed.error.message}`);
    }
    const myRoles = await this.loadMyRoles(workbookId, acting.username);
    const before = stripNulls(doc.mef) as RadiologicalConsequenceAnalysis;
    if (!isDeepStrictEqual(before.consequenceQuantification.caseRecords, parsed.data.consequenceQuantification.caseRecords))
      throw new ConflictException("Use the case-record endpoints to change snapshots or linked results");
    if (!isDeepStrictEqual(before.dosimetry.doseInputs, parsed.data.dosimetry.doseInputs))
      throw new ConflictException("Use the dose-input endpoints to change saved inputs");
    if (!isDeepStrictEqual(before.atmosphericTransportAndDispersion.transportInputs, parsed.data.atmosphericTransportAndDispersion.transportInputs))
      throw new ConflictException("Transport inputs must be saved using the atmospheric dispersion editor. Reload if they changed");
    if (!isDeepStrictEqual(before.meteorologicalData.weatherInputs, parsed.data.meteorologicalData.weatherInputs))
      throw new ConflictException("Weather inputs must be saved using the meteorology editor. Reload if they changed");
    if (!isDeepStrictEqual(before.protectiveActionParameters.siteAndReceptors, parsed.data.protectiveActionParameters.siteAndReceptors))
      throw new ConflictException("Site inputs must be saved using the site and receptor editor. Reload if they changed");
    if (!isDeepStrictEqual(before.protectiveActionParameters.earlyResponseModel, parsed.data.protectiveActionParameters.earlyResponseModel))
      throw new ConflictException("Response inputs must be saved using the early-response editor. Reload if they changed");
    if (before.workflowState !== parsed.data.workflowState) throw new ForbiddenException("Use the workbook review actions to change workflow state");
    const oldCategories = before.releaseCategoryToConsequence.releaseCategoryInputs;
    const nextCategories = parsed.data.releaseCategoryToConsequence.releaseCategoryInputs;
    if (new Set(nextCategories.map((c) => c.releaseCategory)).size !== nextCategories.length)
      throw new ForbiddenException("Release category identifiers must be unique");
    if (!isDeepStrictEqual(oldCategories, nextCategories)) {
      if (!myRoles.some((r) => r === "preparer" || r === "co_preparer") || !["DRAFT", "REVISION_REQUIRED"].includes(before.workflowState ?? "DRAFT"))
        throw new ForbiddenException("Only preparers can edit source terms in a draft workbook");
      for (const category of nextCategories) {
        const previous = oldCategories.find((c) => c.releaseCategory === category.releaseCategory);
        if (!isDeepStrictEqual(previous?.sourceTerm, category.sourceTerm))
          throw new ConflictException("Source data must be saved using the source-term editor. Reload if it changed");
      }
    }
    parsed.data.releaseCategoryToConsequence.releaseCategoryInputs = nextCategories.map(withSourceTermSummary);
    doc.mef = JSON.parse(JSON.stringify(parsed.data));
    try { await doc.save(); } catch (error) {
      if (error instanceof Error && error.name === "VersionError") throw new ConflictException("The workbook changed. Reload before saving");
      throw error;
    }
    return toResponse(doc, myRoles);
  }

  async loadExample(workbookId: string, acting: ActingUser, exampleId?: string): Promise<RcWorkbookResponse> {
    const doc = await this.rcWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("RC workbook not found");
    await this.projectsService.resolveAccess(doc.projectId, acting);
    const myRoles = await this.loadMyRoles(workbookId, acting.username);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only preparers can load the example");
    const state = (doc.mef as { workflowState?: string }).workflowState ?? "DRAFT";
    if (state !== "DRAFT" && state !== "REVISION_REQUIRED") {
      throw new ForbiddenException(`Cannot overwrite a workbook in state ${state}`);
    }
    const example = await this.exampleWorkbooksService.getRcBundle(exampleId);
    const parsed = RadiologicalConsequenceAnalysisSchema.safeParse(stripNulls(example.rc.mef));
    if (!parsed.success) throw new ForbiddenException(`Example MEF failed validation: ${parsed.error.message}`);
    const prepared = example.rc.slug === RC_PUBLISHED_SLUG ? await this.publishedExample.prepare(workbookId, parsed.data, doc.__v + 1, acting) : undefined;
    const cleaned = {
      ...(prepared?.mef ?? parsed.data),
      workflowState: "DRAFT",
      workflowHistory: [{ state: "DRAFT", enteredAt: new Date().toISOString(), actor: acting.username, note: "Loaded from example workbook" }],
    };
    doc.previousMefJson = JSON.stringify(doc.mef);
    doc.mef = JSON.parse(JSON.stringify(cleaned));
    try { await doc.save(); } catch (error) {
      if (prepared) await this.publishedExample.rollback(workbookId, prepared.created);
      if (error instanceof Error && error.name === "VersionError") throw new ConflictException("The workbook changed. Reload before loading the example");
      throw error;
    }
    await this.signoffModel.deleteMany({ workbookId }).exec();
    await this.rcDocumentsService.removeAllForWorkbook(workbookId, true);
    return toResponse(doc, myRoles);
  }

  async unloadExample(workbookId: string, acting: ActingUser): Promise<RcWorkbookResponse> {
    const doc = await this.rcWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("RC workbook not found");
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
    const template = createBlankRc(restoredObj.name ?? "RC Workbook", restoredObj.owner ?? acting.username);
    const healed = healMef(restored, template);
    const parsed = RadiologicalConsequenceAnalysisSchema.safeParse(healed);
    if (!parsed.success) throw new ForbiddenException(`Stored prior MEF failed validation: ${parsed.error.message}`);
    doc.mef = parsed.data;
    doc.previousMefJson = null;
    await doc.save();
    return toResponse(doc, myRoles);
  }
}
