import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { randomUUID } from "node:crypto";
import type {
  CanvasLayoutMetadata,
  DraftValidationOutcome,
  AnalysisReadyValidationOutcome,
  MethodModelCreateRequest,
  MethodModelExecuteRequest,
  MethodModelExecuteResult,
  MethodAnalysisRunResult,
  AnalysisRunMetadata,
  MethodModelDependenciesResponse,
  MethodModelListResponse,
  MethodModelMetadata,
  MethodModelPatchRequest,
  MethodModelValidateRequest,
  MethodType,
  ValidationMode,
  NewlyDevelopedMethodModel,
  BayesianNetworkModel,
  EventTreeModel,
  FaultTreeModel,
  HclConfigurationModel,
} from "interfaces-shared-types/newly-developed-methods";
import {
  AnalysisRunMetadataSchema,
  CURRENT_ANALYSIS_RUN_SCHEMA_VERSION,
  MethodAnalysisRunResultSchema,
  MethodModelDependenciesResponseSchema,
  NewlyDevelopedMethodModelSchema,
  validateBayesianNetworkAnalysisReady,
  validateBayesianNetworkDraft,
  validateEventTreeAnalysisReady,
  validateEventTreeDraft,
  validateFaultTreeAnalysisReady,
  validateFaultTreeDraft,
  validateHclAnalysisReady,
  validateHclDraft,
} from "interfaces-shared-types/newly-developed-methods";
import { ProjectsService } from "../../projects/projects.service";
import { WorkbookElementRegistry } from "../../workbooks/workbook-element-registry";
import { Workbook, type WorkbookDocument } from "../../workbooks/workbook.schema";
import { AnalysisRunRecord, type AnalysisRunRecordDocument } from "./analysis-run-record.schema";
import { MethodModelRecord, type MethodModelRecordDocument } from "./method-model-record.schema";

interface ActingUser {
  username: string;
}

function defaultLayout(direction: CanvasLayoutMetadata["direction"]): CanvasLayoutMetadata {
  return {
    viewport: { x: 0, y: 0, zoom: 1 },
    mode: "MANUAL",
    direction,
  };
}

function createInitialModel(
  request: MethodModelCreateRequest,
  id: string,
  timestamp: string,
): NewlyDevelopedMethodModel {
  const metadata = {
    schemaVersion: request.schemaVersion,
    id,
    projectId: request.projectId,
    code: request.code,
    name: request.name,
    description: request.description,
    revision: 1 as const,
    createdBy: request.createdBy,
    createdAt: timestamp,
    updatedBy: request.createdBy,
    updatedAt: timestamp,
  };

  switch (request.methodType) {
    case "FAULT_TREE":
      return {
        ...metadata,
        methodType: request.methodType,
        topGate: null,
        gates: [],
        leafNodes: [],
        gateInputs: [],
        nodePositions: [],
        layout: defaultLayout("TOP_TO_BOTTOM"),
      };
    case "BAYESIAN_NETWORK":
      return {
        ...metadata,
        methodType: request.methodType,
        nodes: [],
        edges: [],
        conditionalProbabilityTables: [],
        nodePositions: [],
        layout: defaultLayout("LEFT_TO_RIGHT"),
      };
    case "EVENT_TREE":
      return {
        ...metadata,
        methodType: request.methodType,
        initiatingEvent: null,
        initiatingEventFrequency: null,
        functionalEvents: [],
        functionalEventFaultTreeLinks: [],
        endStates: [],
        sequences: [],
        hclConfiguration: null,
        canvas: {
          metadata: defaultLayout("LEFT_TO_RIGHT"),
          nodePositions: [],
        },
      };
    case "HYBRID_CAUSAL_LOGIC":
      return {
        ...metadata,
        methodType: request.methodType,
        bayesianNetwork: request.bayesianNetwork,
        faultTrees: [],
        bindings: [],
        baseEvidence: { observations: [] },
        solverSettings: {
          variableOrder: null,
          foldConstants: false,
          spliceNullGates: false,
        },
      };
  }
}

function normalizeCode(code: string): string {
  return code.trim().toLocaleUpperCase();
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11_000;
}

function escapeJsonPointerSegment(segment: string | number): string {
  return String(segment).replace(/~/g, "~0").replace(/\//g, "~1");
}

function findModelReferencePaths(
  value: unknown,
  targetModelId: string,
  path: (string | number)[] = [],
  ancestors = new WeakSet<object>(),
): string[] {
  if (typeof value !== "object" || value === null || ancestors.has(value)) {
    return [];
  }

  ancestors.add(value);
  const entries: [string | number, unknown][] = Array.isArray(value)
    ? value.map((entry, index) => [index, entry])
    : Object.entries(value);
  const referencePaths: string[] = [];

  for (const [key, entry] of entries) {
    const nextPath = [...path, key];
    if (key === "modelId" && entry === targetModelId) {
      referencePaths.push(`/${nextPath.map(escapeJsonPointerSegment).join("/")}`);
    }
    referencePaths.push(...findModelReferencePaths(entry, targetModelId, nextPath, ancestors));
  }

  ancestors.delete(value);
  return referencePaths;
}

function toMetadata(doc: MethodModelRecordDocument): MethodModelMetadata {
  return {
    id: doc.id,
    projectId: doc.projectId,
    methodType: doc.methodType,
    code: doc.code,
    name: doc.name,
    description: doc.description,
    schemaVersion: doc.schemaVersion,
    revision: doc.revision,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt.toISOString(),
    updatedBy: doc.updatedBy,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function toAnalysisRunMetadata(doc: AnalysisRunRecordDocument): AnalysisRunMetadata {
  return AnalysisRunMetadataSchema.parse({
    schemaVersion: doc.schemaVersion,
    id: doc.id,
    modelId: doc.modelId,
    modelRevision: doc.modelRevision,
    methodType: doc.methodType,
    status: doc.status,
    requestedBy: doc.requestedBy,
    requestedAt: doc.requestedAt.toISOString(),
    startedAt: doc.startedAt?.toISOString() ?? null,
    completedAt: doc.completedAt?.toISOString() ?? null,
    engine: doc.engine,
  });
}

@Injectable()
class MethodModelsService {
  constructor(
    @InjectModel(MethodModelRecord.name)
    private readonly methodModel: Model<MethodModelRecordDocument>,
    @InjectModel(AnalysisRunRecord.name)
    private readonly analysisRunModel: Model<AnalysisRunRecordDocument>,
    @InjectModel(Workbook.name)
    private readonly workbookModel: Model<WorkbookDocument>,
    private readonly projectsService: ProjectsService,
    private readonly workbookElementRegistry: WorkbookElementRegistry,
  ) {}

  async listProjectModels(
    projectId: string,
    methodType: MethodType,
    acting: ActingUser,
  ): Promise<MethodModelListResponse> {
    await this.projectsService.resolveAccess(projectId, acting);
    const docs = await this.methodModel
      .find({ projectId, methodType })
      .sort({ updatedAt: -1, id: 1 })
      .exec();

    return { models: docs.map(toMetadata) };
  }

  async createModel(
    projectId: string,
    request: MethodModelCreateRequest,
    acting: ActingUser,
  ): Promise<NewlyDevelopedMethodModel> {
    if (request.projectId !== projectId) {
      throw new BadRequestException("Request project id must match the route project id");
    }
    if (request.createdBy !== acting.username) {
      throw new BadRequestException("Creator must match the authenticated user");
    }

    const { role } = await this.projectsService.resolveAccess(projectId, acting);
    if (role === "viewer") {
      throw new ForbiddenException("You cannot create method models in this project");
    }

    const timestamp = new Date().toISOString();
    const model = createInitialModel(request, randomUUID(), timestamp);

    try {
      const created = await this.methodModel.create({
        ...model,
        normalizedCode: normalizeCode(model.code),
        createdAt: new Date(model.createdAt),
        updatedAt: new Date(model.updatedAt),
        model,
      });
      return NewlyDevelopedMethodModelSchema.parse(created.model);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException("A model with that code already exists for this method in the project");
      }
      throw error;
    }
  }

  async loadModel(
    projectId: string,
    modelId: string,
    acting: ActingUser,
  ): Promise<NewlyDevelopedMethodModel> {
    await this.projectsService.resolveAccess(projectId, acting);
    const doc = await this.findScoped(projectId, modelId);
    return NewlyDevelopedMethodModelSchema.parse(doc.model);
  }

  async patchModel(
    projectId: string,
    modelId: string,
    request: MethodModelPatchRequest,
    acting: ActingUser,
  ): Promise<NewlyDevelopedMethodModel> {
    if (request.modelId !== modelId) {
      throw new BadRequestException("Request model id must match the route model id");
    }
    if (request.updatedBy !== acting.username) {
      throw new BadRequestException("Updater must match the authenticated user");
    }

    const { role } = await this.projectsService.resolveAccess(projectId, acting);
    if (role === "viewer") {
      throw new ForbiddenException("You cannot update method models in this project");
    }

    const existing = await this.findScoped(projectId, modelId);
    if (existing.methodType !== request.methodType) {
      throw new BadRequestException("Patch method type must match the stored model");
    }
    if (existing.revision !== request.expectedRevision) {
      throw new ConflictException("Method model revision conflict");
    }

    const timestamp = new Date();
    const set: Record<string, unknown> = {
      updatedBy: acting.username,
      updatedAt: timestamp,
      "model.updatedBy": acting.username,
      "model.updatedAt": timestamp.toISOString(),
    };

    for (const [path, value] of Object.entries(request.changes)) {
      set[`model.${path}`] = value;
      if (path === "code" || path === "name" || path === "description") {
        set[path] = value;
      }
      if (path === "code") {
        set.normalizedCode = normalizeCode(value as string);
      }
    }

    try {
      const updated = await this.methodModel
        .findOneAndUpdate(
          {
            projectId,
            id: modelId,
            methodType: request.methodType,
            revision: request.expectedRevision,
          },
          {
            $set: set,
            $inc: { revision: 1, "model.revision": 1 },
          },
          { new: true, runValidators: true },
        )
        .exec();

      if (updated === null) {
        throw new ConflictException("Method model revision conflict");
      }
      return NewlyDevelopedMethodModelSchema.parse(updated.model);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException("A model with that code already exists for this method in the project");
      }
      throw error;
    }
  }

  async validateModel(
    projectId: string,
    modelId: string,
    request: MethodModelValidateRequest,
    acting: ActingUser,
  ): Promise<DraftValidationOutcome | AnalysisReadyValidationOutcome> {
    if (request.modelId !== modelId) {
      throw new BadRequestException("Request model id must match the route model id");
    }
    if (request.requestedBy !== acting.username) {
      throw new BadRequestException("Requester must match the authenticated user");
    }

    await this.projectsService.resolveAccess(projectId, acting);
    const targetDoc = await this.findScoped(projectId, modelId);
    if (targetDoc.methodType !== request.methodType) {
      throw new BadRequestException("Validation method type must match the stored model");
    }
    if (targetDoc.revision !== request.revision) {
      throw new ConflictException("Method model revision conflict");
    }

    const relatedDocs = await this.methodModel.find({ projectId }).exec();
    const relatedModels = relatedDocs.map((doc) =>
      NewlyDevelopedMethodModelSchema.parse(doc.model),
    );
    const target = NewlyDevelopedMethodModelSchema.parse(targetDoc.model);
    return this.validateModelSnapshot(
      target,
      relatedModels,
      request.mode,
      new Date().toISOString(),
    );
  }

  async createAnalysisRun(
    projectId: string,
    modelId: string,
    request: MethodModelExecuteRequest,
    acting: ActingUser,
  ): Promise<MethodModelExecuteResult> {
    if (request.modelId !== modelId) {
      throw new BadRequestException("Request model id must match the route model id");
    }
    if (request.requestedBy !== acting.username) {
      throw new BadRequestException("Requester must match the authenticated user");
    }

    const { role } = await this.projectsService.resolveAccess(projectId, acting);
    if (role === "viewer") {
      throw new ForbiddenException("You cannot run analyses in this project");
    }

    const snapshotDocs = await this.methodModel.find({ projectId }).exec();
    const modelSnapshots = snapshotDocs.map((doc) =>
      NewlyDevelopedMethodModelSchema.parse(doc.model),
    );
    const target = modelSnapshots.find((model) => model.id === modelId);
    if (target === undefined) {
      throw new NotFoundException("Method model not found");
    }
    if (target.methodType !== request.methodType) {
      throw new BadRequestException("Execution method type must match the stored model");
    }
    if (target.revision !== request.revision) {
      throw new ConflictException("Method model revision conflict");
    }

    const validation = this.validateModelSnapshot(
      target,
      modelSnapshots,
      "ANALYSIS_READY",
      new Date().toISOString(),
    );
    if (!("quantificationAllowed" in validation) || !validation.quantificationAllowed) {
      throw new BadRequestException({
        message: "Method model is not ready for analysis",
        validation,
      });
    }

    this.validateExecutionSelection(target, request, modelSnapshots);

    const run = await this.analysisRunModel.create({
      schemaVersion: CURRENT_ANALYSIS_RUN_SCHEMA_VERSION,
      id: randomUUID(),
      projectId,
      modelId,
      modelRevision: request.revision,
      methodType: request.methodType,
      status: "QUEUED",
      requestedBy: acting.username,
      requestedAt: new Date(),
      startedAt: null,
      completedAt: null,
      engine: null,
      request,
      modelSnapshots,
      result: null,
    });

    return {
      schemaVersion: request.schemaVersion,
      run: toAnalysisRunMetadata(run),
    };
  }

  async getAnalysisRun(
    projectId: string,
    modelId: string,
    runId: string,
    acting: ActingUser,
  ): Promise<AnalysisRunMetadata> {
    await this.projectsService.resolveAccess(projectId, acting);
    return toAnalysisRunMetadata(await this.findRunScoped(projectId, modelId, runId));
  }

  async getAnalysisRunResult(
    projectId: string,
    modelId: string,
    runId: string,
    acting: ActingUser,
  ): Promise<MethodAnalysisRunResult> {
    await this.projectsService.resolveAccess(projectId, acting);
    const doc = await this.findRunScoped(projectId, modelId, runId);
    const run = toAnalysisRunMetadata(doc);
    if (run.status !== "SUCCEEDED" || doc.result === null) {
      throw new ConflictException(`Analysis result is not available while the run is ${run.status}`);
    }
    return MethodAnalysisRunResultSchema.parse({ run, result: doc.result });
  }

  async findModelDependencies(
    projectId: string,
    modelId: string,
    acting: ActingUser,
  ): Promise<MethodModelDependenciesResponse> {
    await this.projectsService.resolveAccess(projectId, acting);
    await this.findScoped(projectId, modelId);
    return this.collectModelDependencies(projectId, modelId);
  }

  async deleteModel(projectId: string, modelId: string, acting: ActingUser): Promise<void> {
    const { role } = await this.projectsService.resolveAccess(projectId, acting);
    if (role === "viewer") {
      throw new ForbiddenException("You cannot delete method models in this project");
    }

    const doc = await this.findScoped(projectId, modelId);
    const dependencies = await this.collectModelDependencies(projectId, modelId);

    if (dependencies.models.length > 0 || dependencies.workbooks.length > 0) {
      throw new ConflictException({
        message: "Model cannot be deleted while models or workbooks reference it",
        dependencies,
      });
    }

    await doc.deleteOne();
  }

  private async findScoped(projectId: string, modelId: string): Promise<MethodModelRecordDocument> {
    const doc = await this.methodModel.findOne({ projectId, id: modelId }).exec();
    if (doc === null) {
      throw new NotFoundException("Method model not found");
    }
    return doc;
  }

  private async collectModelDependencies(
    projectId: string,
    modelId: string,
  ): Promise<MethodModelDependenciesResponse> {
    const [modelDocs, workbookDocs] = await Promise.all([
      this.methodModel.find({ projectId, id: { $ne: modelId } }).exec(),
      this.workbookModel.find({ projectId }).exec(),
    ]);

    const models = modelDocs
      .map((doc) => ({
        ...toMetadata(doc),
        referencePaths: findModelReferencePaths(doc.model, modelId),
      }))
      .filter((model) => model.referencePaths.length > 0)
      .sort((left, right) =>
        left.methodType.localeCompare(right.methodType) ||
        left.code.localeCompare(right.code) ||
        left.id.localeCompare(right.id),
      );

    const workbooks = (
      await Promise.all(
        workbookDocs.map(async (workbook) => {
          const adapter = this.workbookElementRegistry.tryGet(workbook.elementCode);
          if (adapter === undefined) {
            return null;
          }
          const element = await adapter.load(String(workbook._id));
          if (element === null || element.projectId !== projectId) {
            return null;
          }
          const referencePaths = findModelReferencePaths(element.mef, modelId);
          return referencePaths.length === 0
            ? null
            : {
                id: String(workbook._id),
                projectId: workbook.projectId,
                elementCode: workbook.elementCode,
                name: workbook.name,
                referencePaths,
              };
        }),
      )
    )
      .filter((workbook): workbook is NonNullable<typeof workbook> => workbook !== null)
      .sort((left, right) =>
        left.elementCode.localeCompare(right.elementCode) ||
        left.name.localeCompare(right.name) ||
        left.id.localeCompare(right.id),
      );

    return MethodModelDependenciesResponseSchema.parse({ modelId, models, workbooks });
  }

  private async findRunScoped(
    projectId: string,
    modelId: string,
    runId: string,
  ): Promise<AnalysisRunRecordDocument> {
    const doc = await this.analysisRunModel.findOne({ projectId, modelId, id: runId }).exec();
    if (doc === null) {
      throw new NotFoundException("Analysis run not found");
    }
    return doc;
  }

  private validateExecutionSelection(
    model: NewlyDevelopedMethodModel,
    request: MethodModelExecuteRequest,
    modelSnapshots: NewlyDevelopedMethodModel[],
  ): void {
    if (model.methodType !== request.methodType) {
      throw new BadRequestException("Execution method type must match the stored model");
    }

    if (model.methodType === "BAYESIAN_NETWORK" && request.methodType === "BAYESIAN_NETWORK") {
      const nodeIds = new Set(model.nodes.map((node) => node.id));
      const missingQueryNode = request.query.queryNodeIds.find((nodeId) => !nodeIds.has(nodeId));
      if (missingQueryNode !== undefined) {
        throw new BadRequestException(`Bayesian-network query node ${missingQueryNode} does not exist`);
      }
      const queryValidation = validateBayesianNetworkAnalysisReady(model, new Date().toISOString(), {
        evidence: request.query.evidence,
      });
      if (!queryValidation.quantificationAllowed) {
        throw new BadRequestException({
          message: "Bayesian-network query evidence is invalid",
          validation: queryValidation,
        });
      }
    }

    if (
      model.methodType === "EVENT_TREE" &&
      request.methodType === "EVENT_TREE" &&
      request.mode === "HYBRID_CAUSAL_LOGIC"
    ) {
      if (model.hclConfiguration === null) {
        throw new BadRequestException("HCL event-tree execution requires an HCL configuration reference");
      }
      const hclConfiguration = modelSnapshots.find(
        (snapshot) =>
          snapshot.methodType === "HYBRID_CAUSAL_LOGIC" &&
          snapshot.id === model.hclConfiguration!.configuration.modelId,
      );
      if (hclConfiguration === undefined || hclConfiguration.methodType !== "HYBRID_CAUSAL_LOGIC") {
        throw new BadRequestException("HCL event-tree execution configuration does not exist");
      }
      const hclValidation = this.validateModelSnapshot(
        hclConfiguration,
        modelSnapshots,
        "ANALYSIS_READY",
        new Date().toISOString(),
      );
      if (!("quantificationAllowed" in hclValidation) || !hclValidation.quantificationAllowed) {
        throw new BadRequestException({
          message: "HCL event-tree execution configuration is not ready for analysis",
          validation: hclValidation,
        });
      }
    }

    if (model.methodType === "HYBRID_CAUSAL_LOGIC" && request.methodType === "HYBRID_CAUSAL_LOGIC") {
      const configuredFaultTree = model.faultTrees.some(
        (faultTree) => faultTree.faultTree.modelId === request.faultTreeTopGate.modelId,
      );
      if (!configuredFaultTree) {
        throw new BadRequestException("HCL execution top gate is not part of the configuration");
      }

      const faultTree = modelSnapshots.find(
        (snapshot) =>
          snapshot.methodType === "FAULT_TREE" &&
          snapshot.id === request.faultTreeTopGate.modelId,
      );
      if (faultTree === undefined) {
        throw new BadRequestException("HCL execution fault tree does not exist in this project");
      }
      if (
        faultTree.methodType !== "FAULT_TREE" ||
        faultTree.topGate?.gateId !== request.faultTreeTopGate.entityId
      ) {
        throw new BadRequestException("HCL execution top gate does not match the referenced fault tree");
      }
    }
  }

  private validateModelSnapshot(
    target: NewlyDevelopedMethodModel,
    relatedModels: NewlyDevelopedMethodModel[],
    mode: ValidationMode,
    validatedAt: string,
  ): DraftValidationOutcome | AnalysisReadyValidationOutcome {
    const faultTrees = relatedModels.filter(
      (model): model is FaultTreeModel => model.methodType === "FAULT_TREE",
    );
    const bayesianNetworks = relatedModels.filter(
      (model): model is BayesianNetworkModel => model.methodType === "BAYESIAN_NETWORK",
    );
    const eventTrees = relatedModels.filter(
      (model): model is EventTreeModel => model.methodType === "EVENT_TREE",
    );
    const hclConfigurations = relatedModels.filter(
      (model): model is HclConfigurationModel => model.methodType === "HYBRID_CAUSAL_LOGIC",
    );

    switch (target.methodType) {
      case "FAULT_TREE": {
        const context = {
          faultTreeModels: faultTrees,
          availableTransferTargets: faultTrees.flatMap((faultTree) =>
            faultTree.gates.map((gate) => ({
              modelId: faultTree.id,
              entityId: gate.id,
            })),
          ),
        };
        return mode === "DRAFT"
          ? validateFaultTreeDraft(target, validatedAt, context)
          : validateFaultTreeAnalysisReady(target, validatedAt, context);
      }
      case "BAYESIAN_NETWORK": {
        const context = {
          hclBindings: hclConfigurations
            .filter((configuration) => configuration.bayesianNetwork.modelId === target.id)
            .flatMap((configuration) => configuration.bindings),
        };
        return mode === "DRAFT"
          ? validateBayesianNetworkDraft(target, validatedAt, context)
          : validateBayesianNetworkAnalysisReady(target, validatedAt, context);
      }
      case "EVENT_TREE": {
        const context = {
          availableFaultTreeTopGates: faultTrees.flatMap((faultTree) =>
            faultTree.topGate === null
              ? []
              : [
                  {
                    modelId: faultTree.id,
                    entityId: faultTree.topGate.gateId,
                  },
                ],
          ),
          eventTreeModels: eventTrees.filter((eventTree) => eventTree.id !== target.id),
        };
        return mode === "DRAFT"
          ? validateEventTreeDraft(target, validatedAt, context)
          : validateEventTreeAnalysisReady(target, validatedAt, context);
      }
      case "HYBRID_CAUSAL_LOGIC": {
        const context = { bayesianNetworks, faultTrees };
        return mode === "DRAFT"
          ? validateHclDraft(target, validatedAt, context)
          : validateHclAnalysisReady(target, validatedAt, context);
      }
    }
  }
}

export { MethodModelsService };
