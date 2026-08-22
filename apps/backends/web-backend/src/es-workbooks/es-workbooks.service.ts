import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import { EventSequenceAnalysisSchema } from "interfaces-mef-types/zod/es/event-sequence-analysis";
import { ProjectsService } from "../projects/projects.service";
import { ExampleWorkbooksService } from "../example-workbooks/example-workbooks.service";
import { WorkbookRolesService, type WorkbookRoleName } from "../workbooks/workbook-roles.service";
import { WorkbookSignoff, type WorkbookSignoffDocument } from "../workbooks/workbook-signoff.schema";
import { EsWorkbook, type EsWorkbookDocument } from "./es-workbook.schema";
import { EsDocumentsService } from "./es-documents.service";
import { createBlankEs } from "./blank-es";
import { stripNulls } from "../pos-workbooks/mef-normalize";
import { healMef } from "../pos-workbooks/mef-heal";
import { mergeWorkbookPatch } from "../workbooks/workbook-mef-patch";
import { WorkbookModelAccessService } from "../workbooks/workbook-model-access.service";
import {
  assertExpectedWorkbookRevision,
  createWorkbookRevisionFilter,
  readWorkbookRevision,
  workbookRevisionConflict,
} from "../workbooks/workbook-revision";
import type { RevisionedWorkbookPatchBody } from "interfaces-shared-types/workbooks";
import { WorkbookDependencyDiscoveryService } from "../newly-developed-methods/shared/workbook-dependency-discovery.service";

export interface EsWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  revision: number;
  mef: EventSequenceAnalysis;
  myRoles: WorkbookRoleName[];
  hasPreviousMef: boolean;
  linkedPosWorkbookId: string | null;
  linkedIeWorkbookId: string | null;
  updatedAt: string;
}

interface ActingUser {
  username: string;
}

function toResponse(doc: EsWorkbookDocument, myRoles: WorkbookRoleName[]): EsWorkbookResponse {
  const parsed = EventSequenceAnalysisSchema.safeParse(stripNulls(doc.mef));
  if (!parsed.success) throw new BadRequestException(`Stored ES workbook failed validation: ${parsed.error.message}`);
  return {
    workbookId: doc.workbookId,
    projectId: doc.projectId,
    ownerUsername: doc.ownerUsername,
    revision: readWorkbookRevision(doc),
    mef: parsed.data,
    myRoles,
    hasPreviousMef: typeof doc.previousMefJson === "string" && doc.previousMefJson.length > 0,
    linkedPosWorkbookId: typeof doc.linkedPosWorkbookId === "string" ? doc.linkedPosWorkbookId : null,
    linkedIeWorkbookId: typeof doc.linkedIeWorkbookId === "string" ? doc.linkedIeWorkbookId : null,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

@Injectable()
export class EsWorkbooksService {
  constructor(
    @InjectModel(EsWorkbook.name) private readonly esWorkbookModel: Model<EsWorkbookDocument>,
    @InjectModel(WorkbookSignoff.name) private readonly signoffModel: Model<WorkbookSignoffDocument>,
    private readonly projectsService: ProjectsService,
    private readonly exampleWorkbooksService: ExampleWorkbooksService,
    private readonly rolesService: WorkbookRolesService,
    private readonly esDocumentsService: EsDocumentsService,
    private readonly modelAccessService: WorkbookModelAccessService,
    private readonly dependencyDiscoveryService: WorkbookDependencyDiscoveryService,
  ) {}

  private async loadMyRoles(workbookId: string, username: string): Promise<WorkbookRoleName[]> {
    return this.rolesService.resolveEffectiveRoles(workbookId, username);
  }

  async findOne(workbookId: string, acting: ActingUser): Promise<EsWorkbookResponse> {
    const doc = await this.esWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("ES workbook not found");
    await this.projectsService.resolveAccess(doc.projectId, acting);
    const myRoles = await this.loadMyRoles(workbookId, acting.username);
    return toResponse(doc, myRoles);
  }

  async patchMef(
    workbookId: string,
    patch: RevisionedWorkbookPatchBody,
    acting: ActingUser,
  ): Promise<EsWorkbookResponse> {
    const doc = await this.esWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("ES workbook not found");
    const { workbookRoles } = await this.modelAccessService.requireEdit({
      workbookId,
      projectId: doc.projectId,
      mef: doc.mef,
      acting,
    });
    assertExpectedWorkbookRevision(doc, patch.expectedRevision);
    const parsed = EventSequenceAnalysisSchema.safeParse(
      stripNulls(mergeWorkbookPatch(doc.mef, patch.operations)),
    );
    if (!parsed.success) {
      throw new ForbiddenException(`Invalid ES workbook payload: ${parsed.error.message}`);
    }
    const updatedDoc = await this.esWorkbookModel
      .findOneAndUpdate(
        createWorkbookRevisionFilter(workbookId, patch.expectedRevision),
        { $set: { mef: parsed.data, revision: patch.expectedRevision + 1 } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updatedDoc) throw workbookRevisionConflict(patch.expectedRevision);
    return toResponse(updatedDoc, workbookRoles);
  }

  async deleteEventTree(
    workbookId: string,
    modelId: string,
    expectedRevision: number,
    acting: ActingUser,
  ): Promise<EsWorkbookResponse> {
    const doc = await this.esWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("ES workbook not found");
    const { workbookRoles } = await this.modelAccessService.requireEdit({
      workbookId,
      projectId: doc.projectId,
      mef: doc.mef,
      acting,
    });
    assertExpectedWorkbookRevision(doc, expectedRevision);
    const mef = EventSequenceAnalysisSchema.parse(stripNulls(doc.mef));
    const eventTrees = mef.eventTrees ?? [];
    const index = eventTrees.findIndex((tree) => tree.uuid === modelId);
    if (index < 0) throw new NotFoundException("ES event tree not found");
    await this.dependencyDiscoveryService.assertModelCanBeDeleted(
      { workbookId, modelId },
      { ignoredSourcePathPrefixes: [`/eventTrees/${index}`] },
    );
    const nextMef = {
      ...mef,
      eventTrees: eventTrees.filter((_, candidateIndex) => candidateIndex !== index),
    };
    const updatedDoc = await this.esWorkbookModel
      .findOneAndUpdate(
        createWorkbookRevisionFilter(workbookId, expectedRevision),
        { $set: { mef: nextMef, revision: expectedRevision + 1 } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updatedDoc) throw workbookRevisionConflict(expectedRevision);
    return toResponse(updatedDoc, workbookRoles);
  }

  async loadExample(workbookId: string, acting: ActingUser, exampleId?: string): Promise<EsWorkbookResponse> {
    const doc = await this.esWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("ES workbook not found");
    const expectedRevision = readWorkbookRevision(doc);
    await this.projectsService.resolveAccess(doc.projectId, acting);
    const myRoles = await this.loadMyRoles(workbookId, acting.username);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only preparers can load the example");
    const state = (doc.mef as { workflowState?: string }).workflowState ?? "DRAFT";
    if (state !== "DRAFT" && state !== "REVISION_REQUIRED") {
      throw new ForbiddenException(`Cannot overwrite a workbook in state ${state}`);
    }
    const example = await this.exampleWorkbooksService.getEsBundle(exampleId);
    const parsed = EventSequenceAnalysisSchema.safeParse(stripNulls(example.es.mef));
    if (!parsed.success) throw new ForbiddenException(`Example MEF failed validation: ${parsed.error.message}`);
    const cleaned = {
      ...parsed.data,
      workflowState: "DRAFT",
      workflowHistory: [{ state: "DRAFT", enteredAt: new Date().toISOString(), actor: acting.username, note: "Loaded from example workbook" }],
    };
    const updatedDoc = await this.esWorkbookModel
      .findOneAndUpdate(
        createWorkbookRevisionFilter(workbookId, expectedRevision),
        {
          $set: {
            previousMefJson: JSON.stringify(doc.mef),
            mef: cleaned,
            linkedPosWorkbookId: "example",
            linkedIeWorkbookId: "example",
            exampleVariant: exampleId === "sfr" || exampleId === "htgr" ? exampleId : "htgr",
            revision: expectedRevision + 1,
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updatedDoc) throw workbookRevisionConflict(expectedRevision);
    await this.signoffModel.deleteMany({ workbookId }).exec();
    await this.esDocumentsService.removeAllForWorkbook(workbookId);
    return toResponse(updatedDoc, myRoles);
  }

  async unloadExample(workbookId: string, acting: ActingUser): Promise<EsWorkbookResponse> {
    const doc = await this.esWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("ES workbook not found");
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
    const template = createBlankEs(restoredObj.name ?? "ES Workbook", restoredObj.owner ?? acting.username);
    const healed = healMef(restored, template);
    const parsed = EventSequenceAnalysisSchema.safeParse(healed);
    if (!parsed.success) throw new ForbiddenException(`Stored prior MEF failed validation: ${parsed.error.message}`);
    const updatedDoc = await this.esWorkbookModel
      .findOneAndUpdate(
        createWorkbookRevisionFilter(workbookId, expectedRevision),
        {
          $set: {
            mef: parsed.data,
            previousMefJson: null,
            linkedPosWorkbookId: null,
            linkedIeWorkbookId: null,
            revision: expectedRevision + 1,
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updatedDoc) throw workbookRevisionConflict(expectedRevision);
    return toResponse(updatedDoc, myRoles);
  }
}
