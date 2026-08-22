import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { EventSequenceQuantificationSchema } from "interfaces-mef-types/zod/esq/event-sequence-quantification";
import { ProjectsService } from "../projects/projects.service";
import { ExampleWorkbooksService } from "../example-workbooks/example-workbooks.service";
import { WorkbookRolesService, type WorkbookRoleName } from "../workbooks/workbook-roles.service";
import { WorkbookSignoff, type WorkbookSignoffDocument } from "../workbooks/workbook-signoff.schema";
import { EsqWorkbook, type EsqWorkbookDocument } from "./esq-workbook.schema";
import { EsqDocumentsService } from "./esq-documents.service";
import { createBlankEsq } from "./blank-esq";
import { normalizeEsqMef } from "./esq-mef-normalize";
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

export interface EsqWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  revision: number;
  mef: EventSequenceQuantification;
  myRoles: WorkbookRoleName[];
  hasPreviousMef: boolean;
  updatedAt: string;
}

interface ActingUser {
  username: string;
}

function toResponse(doc: EsqWorkbookDocument, myRoles: WorkbookRoleName[]): EsqWorkbookResponse {
  const parsed = EventSequenceQuantificationSchema.safeParse(normalizeEsqMef(doc.mef));
  if (!parsed.success) throw new BadRequestException(`Stored ESQ workbook failed validation: ${parsed.error.message}`);
  return {
    workbookId: doc.workbookId,
    projectId: doc.projectId,
    ownerUsername: doc.ownerUsername,
    revision: readWorkbookRevision(doc),
    mef: parsed.data,
    myRoles,
    hasPreviousMef: typeof doc.previousMefJson === "string" && doc.previousMefJson.length > 0,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

@Injectable()
export class EsqWorkbooksService {
  constructor(
    @InjectModel(EsqWorkbook.name) private readonly esqWorkbookModel: Model<EsqWorkbookDocument>,
    @InjectModel(WorkbookSignoff.name) private readonly signoffModel: Model<WorkbookSignoffDocument>,
    private readonly projectsService: ProjectsService,
    private readonly exampleWorkbooksService: ExampleWorkbooksService,
    private readonly rolesService: WorkbookRolesService,
    private readonly esqDocumentsService: EsqDocumentsService,
    private readonly modelAccessService: WorkbookModelAccessService,
    private readonly dependencyDiscoveryService: WorkbookDependencyDiscoveryService,
  ) {}

  private async loadMyRoles(workbookId: string, username: string): Promise<WorkbookRoleName[]> {
    return this.rolesService.resolveEffectiveRoles(workbookId, username);
  }

  async findOne(workbookId: string, acting: ActingUser): Promise<EsqWorkbookResponse> {
    const doc = await this.esqWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("ESQ workbook not found");
    await this.projectsService.resolveAccess(doc.projectId, acting);
    const myRoles = await this.loadMyRoles(workbookId, acting.username);
    return toResponse(doc, myRoles);
  }

  async patchMef(
    workbookId: string,
    patch: RevisionedWorkbookPatchBody,
    acting: ActingUser,
  ): Promise<EsqWorkbookResponse> {
    const doc = await this.esqWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("ESQ workbook not found");
    const { workbookRoles } = await this.modelAccessService.requireEdit({
      workbookId,
      projectId: doc.projectId,
      mef: doc.mef,
      acting,
    });
    assertExpectedWorkbookRevision(doc, patch.expectedRevision);
    const parsed = EventSequenceQuantificationSchema.safeParse(
      normalizeEsqMef(mergeWorkbookPatch(doc.mef, patch.operations)),
    );
    if (!parsed.success) {
      throw new ForbiddenException(`Invalid ESQ workbook payload: ${parsed.error.message}`);
    }
    const updatedDoc = await this.esqWorkbookModel
      .findOneAndUpdate(
        createWorkbookRevisionFilter(workbookId, patch.expectedRevision),
        { $set: { mef: parsed.data, revision: patch.expectedRevision + 1 } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updatedDoc) throw workbookRevisionConflict(patch.expectedRevision);
    return toResponse(updatedDoc, workbookRoles);
  }

  private async deleteOwnedModel(
    workbookId: string,
    modelId: string,
    expectedRevision: number,
    acting: ActingUser,
    collection: "bayesianNetworks" | "hclConfigurations",
  ): Promise<EsqWorkbookResponse> {
    const doc = await this.esqWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("ESQ workbook not found");
    const { workbookRoles } = await this.modelAccessService.requireEdit({
      workbookId,
      projectId: doc.projectId,
      mef: doc.mef,
      acting,
    });
    assertExpectedWorkbookRevision(doc, expectedRevision);
    const mef = EventSequenceQuantificationSchema.parse(normalizeEsqMef(doc.mef));
    const index = mef[collection].findIndex((model) => model.modelId === modelId);
    if (index < 0) {
      throw new NotFoundException(
        collection === "bayesianNetworks" ? "ESQ Bayesian network not found" : "ESQ HCL configuration not found",
      );
    }
    await this.dependencyDiscoveryService.assertModelCanBeDeleted(
      { workbookId, modelId },
      { ignoredSourcePathPrefixes: [`/${collection}/${index}`] },
    );
    const nextMef = {
      ...mef,
      [collection]: mef[collection].filter((_, candidateIndex) => candidateIndex !== index),
    };
    const updatedDoc = await this.esqWorkbookModel
      .findOneAndUpdate(
        createWorkbookRevisionFilter(workbookId, expectedRevision),
        { $set: { mef: nextMef, revision: expectedRevision + 1 } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updatedDoc) throw workbookRevisionConflict(expectedRevision);
    return toResponse(updatedDoc, workbookRoles);
  }

  deleteBayesianNetwork(
    workbookId: string,
    modelId: string,
    expectedRevision: number,
    acting: ActingUser,
  ): Promise<EsqWorkbookResponse> {
    return this.deleteOwnedModel(workbookId, modelId, expectedRevision, acting, "bayesianNetworks");
  }

  deleteHclConfiguration(
    workbookId: string,
    modelId: string,
    expectedRevision: number,
    acting: ActingUser,
  ): Promise<EsqWorkbookResponse> {
    return this.deleteOwnedModel(workbookId, modelId, expectedRevision, acting, "hclConfigurations");
  }

  async loadExample(workbookId: string, acting: ActingUser, exampleId?: string): Promise<EsqWorkbookResponse> {
    const doc = await this.esqWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("ESQ workbook not found");
    const expectedRevision = readWorkbookRevision(doc);
    await this.projectsService.resolveAccess(doc.projectId, acting);
    const myRoles = await this.loadMyRoles(workbookId, acting.username);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only preparers can load the example");
    const state = (doc.mef as { workflowState?: string }).workflowState ?? "DRAFT";
    if (state !== "DRAFT" && state !== "REVISION_REQUIRED") {
      throw new ForbiddenException(`Cannot overwrite a workbook in state ${state}`);
    }
    const example = await this.exampleWorkbooksService.getEsqBundle(exampleId);
    const parsed = EventSequenceQuantificationSchema.safeParse(normalizeEsqMef(example.esq.mef));
    if (!parsed.success) throw new ForbiddenException(`Example MEF failed validation: ${parsed.error.message}`);
    const cleaned = {
      ...parsed.data,
      workflowState: "DRAFT",
      workflowHistory: [{ state: "DRAFT", enteredAt: new Date().toISOString(), actor: acting.username, note: "Loaded from example workbook" }],
    };
    const updatedDoc = await this.esqWorkbookModel
      .findOneAndUpdate(
        createWorkbookRevisionFilter(workbookId, expectedRevision),
        {
          $set: {
            previousMefJson: JSON.stringify(doc.mef),
            mef: cleaned,
            revision: expectedRevision + 1,
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updatedDoc) throw workbookRevisionConflict(expectedRevision);
    await this.signoffModel.deleteMany({ workbookId }).exec();
    await this.esqDocumentsService.removeAllForWorkbook(workbookId);
    return toResponse(updatedDoc, myRoles);
  }

  async unloadExample(workbookId: string, acting: ActingUser): Promise<EsqWorkbookResponse> {
    const doc = await this.esqWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("ESQ workbook not found");
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
    const template = createBlankEsq(restoredObj.name ?? "ESQ Workbook", restoredObj.owner ?? acting.username);
    const healed = healMef(restored, template);
    const parsed = EventSequenceQuantificationSchema.safeParse(healed);
    if (!parsed.success) throw new ForbiddenException(`Stored prior MEF failed validation: ${parsed.error.message}`);
    const updatedDoc = await this.esqWorkbookModel
      .findOneAndUpdate(
        createWorkbookRevisionFilter(workbookId, expectedRevision),
        {
          $set: {
            mef: parsed.data,
            previousMefJson: null,
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
