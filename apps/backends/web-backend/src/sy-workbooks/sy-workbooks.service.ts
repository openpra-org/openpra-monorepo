import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { systemBasicEventToFaultTreeBasicEvent } from "interfaces-mef-types/sy/system-models";
import { SystemsAnalysisSchema } from "interfaces-mef-types/zod/sy/systems-analysis";
import {
  FaultTreeValidateRequestSchema,
  validateFaultTreeAnalysisReady,
  validateFaultTreeDraft,
} from "interfaces-shared-types/newly-developed-methods/fault-tree";
import type {
  FaultTreeModel,
  FaultTreeValidateResult,
} from "interfaces-shared-types/newly-developed-methods/fault-tree";
import { ProjectsService } from "../projects/projects.service";
import { ExampleWorkbooksService } from "../example-workbooks/example-workbooks.service";
import { WorkbookRolesService, type WorkbookRoleName } from "../workbooks/workbook-roles.service";
import { WorkbookSignoff, type WorkbookSignoffDocument } from "../workbooks/workbook-signoff.schema";
import { SyWorkbook, type SyWorkbookDocument } from "./sy-workbook.schema";
import { SyDocumentsService } from "./sy-documents.service";
import { createBlankSy } from "./blank-sy";
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

export interface SyWorkbookResponse {
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  revision: number;
  mef: SystemsAnalysis;
  myRoles: WorkbookRoleName[];
  hasPreviousMef: boolean;
  updatedAt: string;
}

interface ActingUser {
  username: string;
}

function toFaultTreeModel(model: SystemsAnalysis["systemLogicModels"][number]): FaultTreeModel {
  return {
    modelId: model.uuid,
    code: model.code,
    name: model.name,
    description: model.description,
    topGate: model.topGate,
    gates: model.gates,
    leafNodes: model.leafNodes,
    gateInputs: model.gateInputs,
    nodePositions: model.nodePositions,
    layout: model.layout,
  };
}

function toResponse(doc: SyWorkbookDocument, myRoles: WorkbookRoleName[]): SyWorkbookResponse {
  const parsed = SystemsAnalysisSchema.safeParse(stripNulls(doc.mef));
  if (!parsed.success) throw new BadRequestException(`Stored SY workbook failed validation: ${parsed.error.message}`);
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
export class SyWorkbooksService {
  constructor(
    @InjectModel(SyWorkbook.name) private readonly syWorkbookModel: Model<SyWorkbookDocument>,
    @InjectModel(WorkbookSignoff.name) private readonly signoffModel: Model<WorkbookSignoffDocument>,
    private readonly projectsService: ProjectsService,
    private readonly exampleWorkbooksService: ExampleWorkbooksService,
    private readonly rolesService: WorkbookRolesService,
    private readonly syDocumentsService: SyDocumentsService,
    private readonly modelAccessService: WorkbookModelAccessService,
    private readonly dependencyDiscoveryService: WorkbookDependencyDiscoveryService,
  ) {}

  private async loadMyRoles(workbookId: string, username: string): Promise<WorkbookRoleName[]> {
    return this.rolesService.resolveEffectiveRoles(workbookId, username);
  }

  async findOne(workbookId: string, acting: ActingUser): Promise<SyWorkbookResponse> {
    const doc = await this.syWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("SY workbook not found");
    await this.projectsService.resolveAccess(doc.projectId, acting);
    const myRoles = await this.loadMyRoles(workbookId, acting.username);
    return toResponse(doc, myRoles);
  }

  async patchMef(
    workbookId: string,
    patch: RevisionedWorkbookPatchBody,
    acting: ActingUser,
  ): Promise<SyWorkbookResponse> {
    const doc = await this.syWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("SY workbook not found");
    const { workbookRoles } = await this.modelAccessService.requireEdit({
      workbookId,
      projectId: doc.projectId,
      mef: doc.mef,
      acting,
    });
    assertExpectedWorkbookRevision(doc, patch.expectedRevision);
    const parsed = SystemsAnalysisSchema.safeParse(
      stripNulls(mergeWorkbookPatch(doc.mef, patch.operations)),
    );
    if (!parsed.success) {
      throw new BadRequestException(`Invalid SY workbook payload: ${parsed.error.message}`);
    }
    const updatedDoc = await this.syWorkbookModel
      .findOneAndUpdate(
        createWorkbookRevisionFilter(workbookId, patch.expectedRevision),
        { $set: { mef: parsed.data, revision: patch.expectedRevision + 1 } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updatedDoc) throw workbookRevisionConflict(patch.expectedRevision);
    return toResponse(updatedDoc, workbookRoles);
  }

  async validateFaultTree(
    workbookId: string,
    pathModelId: string,
    body: unknown,
    acting: ActingUser,
  ): Promise<FaultTreeValidateResult> {
    const parsedRequest = FaultTreeValidateRequestSchema.safeParse(body);
    if (!parsedRequest.success) throw new BadRequestException(parsedRequest.error.message);
    const request = parsedRequest.data;
    if (pathModelId !== request.modelId) {
      throw new BadRequestException("Route model id must match the request modelId");
    }

    const doc = await this.syWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("SY workbook not found");
    await this.projectsService.resolveAccess(doc.projectId, acting);
    assertExpectedWorkbookRevision(doc, request.workbookRevision);

    const parsedMef = SystemsAnalysisSchema.safeParse(stripNulls(doc.mef));
    if (!parsedMef.success) {
      throw new BadRequestException(`Stored SY workbook failed validation: ${parsedMef.error.message}`);
    }
    const logic = parsedMef.data.systemLogicModels.find(({ uuid }) => uuid === request.modelId);
    if (logic === undefined) throw new NotFoundException("SY fault tree not found");
    if (logic.nonDetailedModelJustification !== undefined) {
      throw new BadRequestException("System-level models cannot be validated as decomposed fault trees");
    }

    const model = toFaultTreeModel(logic);
    const faultTreeModels = parsedMef.data.systemLogicModels
      .filter(({ nonDetailedModelJustification }) => nonDetailedModelJustification === undefined)
      .map(toFaultTreeModel);
    const context = {
      basicEventCatalogue: {
        workbookId,
        basicEvents: parsedMef.data.systemBasicEvents.map(systemBasicEventToFaultTreeBasicEvent),
      },
      availableTransferTargets: parsedMef.data.systemLogicModels.flatMap((candidate) =>
        candidate.topGate === null
          ? []
          : [{ modelId: candidate.uuid, entityId: candidate.topGate.gateId }],
      ),
      faultTreeModels,
    };
    const owner = {
      workbookId,
      modelId: request.modelId,
      workbookRevision: readWorkbookRevision(doc),
    };
    const validatedAt = new Date().toISOString();
    const outcome = request.mode === "DRAFT"
      ? validateFaultTreeDraft(model, owner, validatedAt, context)
      : validateFaultTreeAnalysisReady(model, owner, validatedAt, context);

    return { schemaVersion: "1.0.0", validation: outcome.validation };
  }

  async deleteFaultTree(
    workbookId: string,
    modelId: string,
    expectedRevision: number,
    acting: ActingUser,
  ): Promise<SyWorkbookResponse> {
    const doc = await this.syWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("SY workbook not found");
    const { workbookRoles } = await this.modelAccessService.requireEdit({
      workbookId,
      projectId: doc.projectId,
      mef: doc.mef,
      acting,
    });
    assertExpectedWorkbookRevision(doc, expectedRevision);
    const mef = SystemsAnalysisSchema.parse(stripNulls(doc.mef));
    const index = mef.systemLogicModels.findIndex((model) => model.uuid === modelId);
    if (index < 0) throw new NotFoundException("SY fault tree not found");
    await this.dependencyDiscoveryService.assertModelCanBeDeleted(
      { workbookId, modelId },
      { ignoredSourcePathPrefixes: [`/systemLogicModels/${index}`] },
    );
    const nextMef = {
      ...mef,
      systemLogicModels: mef.systemLogicModels.filter((_, candidateIndex) => candidateIndex !== index),
    };
    const updatedDoc = await this.syWorkbookModel
      .findOneAndUpdate(
        createWorkbookRevisionFilter(workbookId, expectedRevision),
        { $set: { mef: nextMef, revision: expectedRevision + 1 } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updatedDoc) throw workbookRevisionConflict(expectedRevision);
    return toResponse(updatedDoc, workbookRoles);
  }

  async loadExample(workbookId: string, acting: ActingUser, exampleId?: string): Promise<SyWorkbookResponse> {
    const doc = await this.syWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("SY workbook not found");
    const expectedRevision = readWorkbookRevision(doc);
    await this.projectsService.resolveAccess(doc.projectId, acting);
    const myRoles = await this.loadMyRoles(workbookId, acting.username);
    if (!myRoles.includes("preparer") && !myRoles.includes("co_preparer")) throw new ForbiddenException("Only preparers can load the example");
    const state = (doc.mef as { workflowState?: string }).workflowState ?? "DRAFT";
    if (state !== "DRAFT" && state !== "REVISION_REQUIRED") {
      throw new ForbiddenException(`Cannot overwrite a workbook in state ${state}`);
    }
    const example = await this.exampleWorkbooksService.getSyBundle(exampleId);
    const parsed = SystemsAnalysisSchema.safeParse(stripNulls(example.sy.mef));
    if (!parsed.success) throw new ForbiddenException(`Example MEF failed validation: ${parsed.error.message}`);
    const cleaned = {
      ...parsed.data,
      workflowState: "DRAFT",
      workflowHistory: [{ state: "DRAFT", enteredAt: new Date().toISOString(), actor: acting.username, note: "Loaded from example workbook" }],
    };
    const updatedDoc = await this.syWorkbookModel
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
    await this.syDocumentsService.removeAllForWorkbook(workbookId);
    return toResponse(updatedDoc, myRoles);
  }

  async unloadExample(workbookId: string, acting: ActingUser): Promise<SyWorkbookResponse> {
    const doc = await this.syWorkbookModel.findOne({ workbookId }).exec();
    if (!doc) throw new NotFoundException("SY workbook not found");
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
    const template = createBlankSy(restoredObj.name ?? "SY Workbook", restoredObj.owner ?? acting.username);
    const healed = healMef(restored, template);
    const parsed = SystemsAnalysisSchema.safeParse(healed);
    if (!parsed.success) throw new ForbiddenException(`Stored prior MEF failed validation: ${parsed.error.message}`);
    const updatedDoc = await this.syWorkbookModel
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
