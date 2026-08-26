import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { randomUUID } from "crypto";
import type { Model } from "mongoose";
import type { z } from "zod";
import { EventSequenceAnalysisSchema } from "interfaces-mef-types/zod/es/event-sequence-analysis";
import { EventSequenceQuantificationSchema } from "interfaces-mef-types/zod/esq/event-sequence-quantification";
import { SystemsAnalysisSchema } from "interfaces-mef-types/zod/sy/systems-analysis";
import { DataAnalysisSchema } from "interfaces-mef-types/zod/da/data-analysis";
import { HumanReliabilityAnalysisSchema } from "interfaces-mef-types/zod/hr/human-reliability-analysis";
import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type { DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import type { HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
import {
  AnalysisRunMetadataSchema,
  AnalysisRunProvenanceListSchema,
  AnalysisRunProvenanceSchema,
  AnalysisRunTraceSchema,
  BayesianNetworkAnalysisResultSchema,
  BayesianNetworkExecuteRequestSchema,
  EventTreeAnalysisResultSchema,
  EventTreeExecuteRequestSchema,
  FaultTreeAnalysisResultSchema,
  FaultTreeExecuteRequestSchema,
  HclEventTreeExecuteRequestSchema,
  HclExecuteRequestSchema,
  HclQuantificationResultSchema,
  createImmutableAnalysisRunContext,
} from "interfaces-shared-types/newly-developed-methods";
import type {
  AnalysisRunMetadata,
  AnalysisRunContribution,
  AnalysisRunProvenanceList,
  AnalysisRunTarget,
  AnalysisRunTrace,
  AnalysisRunWorkbookSnapshot,
  BayesianNetworkExecuteRequest,
  EventTreeExecuteRequest,
  FaultTreeExecuteRequest,
  HclEventTreeExecuteRequest,
  HclExecuteRequest,
  MethodType,
  WorkbookMethodHostType,
  WorkbookCrossReference,
  WorkbookModelAddress,
  WorkbookModelSnapshotIdentity,
} from "interfaces-shared-types/newly-developed-methods";
import { ProjectsService } from "../../projects/projects.service";
import { EsWorkbook, type EsWorkbookDocument } from "../../es-workbooks/es-workbook.schema";
import { EsqWorkbook, type EsqWorkbookDocument } from "../../esq-workbooks/esq-workbook.schema";
import { normalizeEsqMef } from "../../esq-workbooks/esq-mef-normalize";
import { stripNulls } from "../../pos-workbooks/mef-normalize";
import { SyWorkbook, type SyWorkbookDocument } from "../../sy-workbooks/sy-workbook.schema";
import { DaWorkbook, type DaWorkbookDocument } from "../../da-workbooks/da-workbook.schema";
import { HrWorkbook, type HrWorkbookDocument } from "../../hr-workbooks/hr-workbook.schema";
import { WorkbookModelAccessService } from "../../workbooks/workbook-model-access.service";
import {
  assertExpectedWorkbookRevision,
  readWorkbookRevision,
} from "../../workbooks/workbook-revision";
import { AnalysisRunRecord, type AnalysisRunRecordDocument } from "./analysis-run-record.schema";
import {
  adaptEsEventTreeSnapshot,
  adaptEsqBayesianNetworkSnapshot,
  adaptEsqHclSnapshot,
  adaptSyFaultTreeSnapshot,
  collectSyFaultTreeControlledDataSources,
  faultTreeControlledDataSourceKey,
  WorkbookPraxisAdapterError,
} from "./praxis-snapshot-adapters";
import type {
  AdaptedFaultTreeSnapshot,
  PraxisModelSnapshot,
  WorkbookMefSnapshot,
} from "./praxis-snapshot-adapters";
import { PraetorAnalysisClient } from "./praetor-analysis.client";

interface ActingUser {
  username: string;
}

interface LoadedWorkbook<TMef> extends WorkbookMefSnapshot<TMef> {
  hostType: WorkbookMethodHostType;
  projectId: string;
  ownerUsername: string;
  document: { revision?: number; mef: unknown };
}

interface SolverEnvelope {
  schemaVersion: "1.0.0";
  request: Record<string, unknown>;
  modelSnapshots: PraxisModelSnapshot[];
  resources: {
    faultTreeBasicEventCatalogue?: Record<string, unknown>;
  };
}

interface FaultTreeBundle {
  modelSnapshots: PraxisModelSnapshot[];
  resource: Record<string, unknown>;
}

type PublicResultKind = "FAULT_TREE" | "BAYESIAN_NETWORK" | "EVENT_TREE" | "HYBRID_CAUSAL_LOGIC";

const ENGINE = { name: "PRAXIS", version: "1.0.0" } as const;

const parseRequest = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new BadRequestException(parsed.error.message);
  return parsed.data;
};

const expectPathModel = (pathModelId: string, bodyModelId: string): void => {
  if (pathModelId !== bodyModelId) {
    throw new BadRequestException("Route model id must match the request modelId");
  }
};

const asRecord = (value: unknown, description: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BadGatewayException(`PRAXIS returned an invalid ${description} result`);
  }
  return value as Record<string, unknown>;
};

const adaptOrThrow = <T>(adapter: () => T): T => {
  try {
    return adapter();
  } catch (error) {
    if (error instanceof WorkbookPraxisAdapterError) {
      if (error.message.includes("was not found") || error.message.includes("resolved 0 times")) {
        throw new NotFoundException(error.message);
      }
      throw new BadRequestException(error.message);
    }
    throw error;
  }
};

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toRunMetadata = (run: AnalysisRunRecord | AnalysisRunRecordDocument): AnalysisRunMetadata =>
  AnalysisRunMetadataSchema.parse({
    schemaVersion: run.schemaVersion,
    id: run.id,
    owner: run.owner,
    sourceWorkbooks: run.sourceWorkbooks,
    methodType: run.methodType,
    status: run.status,
    requestedBy: run.requestedBy,
    requestedAt: iso(run.requestedAt),
    startedAt: run.startedAt === null ? null : iso(run.startedAt),
    completedAt: run.completedAt === null ? null : iso(run.completedAt),
    engine: run.engine,
    failure: run.failure,
  });

const uniqueWorkbooks = <T extends LoadedWorkbook<unknown>>(values: T[]): T[] => {
  const byId = new Map<string, T>();
  values.forEach((value) => byId.set(value.workbookId, value));
  return [...byId.values()];
};

const combineFaultTrees = (
  runId: string,
  adapters: AdaptedFaultTreeSnapshot[],
): FaultTreeBundle => {
  const catalogueId = `run:${runId}`;
  const basicEvents = new Map<string, Record<string, unknown>>();
  const modelSnapshots = adapters.map((adapter) => ({
    ...adapter.modelSnapshot,
    projectId: catalogueId,
  }));
  adapters.forEach((adapter) => {
    const catalogue = asRecord(adapter.basicEventCatalogue, "fault-tree catalogue");
    const entries = catalogue["basicEvents"];
    if (!Array.isArray(entries)) throw new BadRequestException("Fault-tree catalogue is invalid");
    entries.forEach((entry) => {
      const event = asRecord(entry, "fault-tree catalogue event");
      const id = event["id"];
      if (typeof id !== "string") throw new BadRequestException("Fault-tree event id is invalid");
      const prior = basicEvents.get(id);
      if (prior !== undefined && JSON.stringify(prior) !== JSON.stringify(event)) {
        throw new BadRequestException(
          `Basic event '${id}' has conflicting values across contributing workbooks`,
        );
      }
      basicEvents.set(id, event);
    });
  });
  return {
    modelSnapshots,
    resource: { projectId: catalogueId, basicEvents: [...basicEvents.values()] },
  };
};

@Injectable()
export class WorkbookAnalysisRunsService {
  constructor(
    @InjectModel(AnalysisRunRecord.name)
    private readonly runModel: Model<AnalysisRunRecordDocument>,
    @InjectModel(SyWorkbook.name)
    private readonly syWorkbookModel: Model<SyWorkbookDocument>,
    @InjectModel(EsWorkbook.name)
    private readonly esWorkbookModel: Model<EsWorkbookDocument>,
    @InjectModel(EsqWorkbook.name)
    private readonly esqWorkbookModel: Model<EsqWorkbookDocument>,
    @InjectModel(DaWorkbook.name)
    private readonly daWorkbookModel: Model<DaWorkbookDocument>,
    @InjectModel(HrWorkbook.name)
    private readonly hrWorkbookModel: Model<HrWorkbookDocument>,
    private readonly accessService: WorkbookModelAccessService,
    private readonly projectsService: ProjectsService,
    private readonly praetor: PraetorAnalysisClient,
  ) {}

  private async loadSy(workbookId: string): Promise<LoadedWorkbook<SystemsAnalysis>> {
    const document = await this.syWorkbookModel.findOne({ workbookId }).exec();
    if (!document) throw new NotFoundException("SY workbook not found");
    const parsed = SystemsAnalysisSchema.safeParse(stripNulls(document.mef));
    if (!parsed.success) throw new BadRequestException(`Stored SY workbook failed validation: ${parsed.error.message}`);
    return {
      hostType: "SY",
      workbookId,
      workbookRevision: readWorkbookRevision(document),
      projectId: document.projectId,
      ownerUsername: document.ownerUsername,
      mef: parsed.data,
      document,
    };
  }

  private async loadEs(workbookId: string): Promise<LoadedWorkbook<EventSequenceAnalysis>> {
    const document = await this.esWorkbookModel.findOne({ workbookId }).exec();
    if (!document) throw new NotFoundException("ES workbook not found");
    const parsed = EventSequenceAnalysisSchema.safeParse(stripNulls(document.mef));
    if (!parsed.success) throw new BadRequestException(`Stored ES workbook failed validation: ${parsed.error.message}`);
    return {
      hostType: "ES",
      workbookId,
      workbookRevision: readWorkbookRevision(document),
      projectId: document.projectId,
      ownerUsername: document.ownerUsername,
      mef: parsed.data,
      document,
    };
  }

  private async loadEsq(workbookId: string): Promise<LoadedWorkbook<EventSequenceQuantification>> {
    const document = await this.esqWorkbookModel.findOne({ workbookId }).exec();
    if (!document) throw new NotFoundException("ESQ workbook not found");
    const parsed = EventSequenceQuantificationSchema.safeParse(normalizeEsqMef(document.mef));
    if (!parsed.success) throw new BadRequestException(`Stored ESQ workbook failed validation: ${parsed.error.message}`);
    return {
      hostType: "ESQ",
      workbookId,
      workbookRevision: readWorkbookRevision(document),
      projectId: document.projectId,
      ownerUsername: document.ownerUsername,
      mef: parsed.data,
      document,
    };
  }

  private async loadDa(workbookId: string): Promise<LoadedWorkbook<DataAnalysis>> {
    const document = await this.daWorkbookModel.findOne({ workbookId }).exec();
    if (!document) throw new NotFoundException("DA workbook not found");
    const parsed = DataAnalysisSchema.safeParse(stripNulls(document.mef));
    if (!parsed.success) {
      throw new BadRequestException(`Stored DA workbook failed validation: ${parsed.error.message}`);
    }
    return {
      hostType: "DA",
      workbookId,
      workbookRevision: readWorkbookRevision(document),
      projectId: document.projectId,
      ownerUsername: document.ownerUsername,
      mef: parsed.data,
      document,
    };
  }

  private async loadHr(workbookId: string): Promise<LoadedWorkbook<HumanReliabilityAnalysis>> {
    const document = await this.hrWorkbookModel.findOne({ workbookId }).exec();
    if (!document) throw new NotFoundException("HRA workbook not found");
    const parsed = HumanReliabilityAnalysisSchema.safeParse(stripNulls(document.mef));
    if (!parsed.success) {
      throw new BadRequestException(`Stored HRA workbook failed validation: ${parsed.error.message}`);
    }
    return {
      hostType: "HRA",
      workbookId,
      workbookRevision: readWorkbookRevision(document),
      projectId: document.projectId,
      ownerUsername: document.ownerUsername,
      mef: parsed.data,
      document,
    };
  }

  private async resolveFaultTreeControlledDataSources(
    faultTrees: Array<{ source: LoadedWorkbook<SystemsAnalysis>; modelId: string }>,
  ): Promise<{
    values: ReadonlyMap<string, number>;
    sources: LoadedWorkbook<unknown>[];
    references: WorkbookCrossReference[];
  }> {
    const references = faultTrees.flatMap(({ source, modelId }) =>
      adaptOrThrow(() => collectSyFaultTreeControlledDataSources(source, modelId)),
    );
    const uniqueReferences = new Map(
      references.map((reference) => [faultTreeControlledDataSourceKey(reference), reference]),
    );
    const daWorkbooks = new Map<string, LoadedWorkbook<DataAnalysis>>();
    const hrWorkbooks = new Map<string, LoadedWorkbook<HumanReliabilityAnalysis>>();
    for (const reference of uniqueReferences.values()) {
      if (reference.referenceType === "WORKBOOK_PARAMETER") {
        if (!daWorkbooks.has(reference.workbookId)) {
          daWorkbooks.set(reference.workbookId, await this.loadDa(reference.workbookId));
        }
      } else if (!hrWorkbooks.has(reference.workbookId)) {
        hrWorkbooks.set(reference.workbookId, await this.loadHr(reference.workbookId));
      }
    }

    const values = new Map<string, number>();
    const probabilityParameterTypes = new Set([
      "PROBABILITY",
      "UNAVAILABILITY",
      "HUMAN_ERROR_PROBABILITY",
    ]);
    for (const [key, reference] of uniqueReferences) {
      if (reference.referenceType === "WORKBOOK_PARAMETER") {
        const workbook = daWorkbooks.get(reference.workbookId)!;
        const matches = workbook.mef.parameters.filter(
          (parameter) => parameter.uuid === reference.entityId,
        );
        if (matches.length !== 1) {
          throw new BadRequestException(
            `DA parameter '${reference.workbookId}:${reference.entityId}' resolved ${matches.length} times; expected exactly once`,
          );
        }
        const parameter = matches[0]!;
        if (!probabilityParameterTypes.has(parameter.parameterType)) {
          throw new BadRequestException(
            `DA parameter '${reference.workbookId}:${reference.entityId}' has type '${parameter.parameterType}', which cannot control a fault-tree probability`,
          );
        }
        if (!Number.isFinite(parameter.value) || parameter.value < 0 || parameter.value > 1) {
          throw new BadRequestException(
            `DA parameter '${reference.workbookId}:${reference.entityId}' must be finite and between zero and one`,
          );
        }
        values.set(key, parameter.value);
        continue;
      }

      const workbook = hrWorkbooks.get(reference.workbookId)!;
      const humanFailureEvents = workbook.mef.humanFailureEvents.filter(
        (event) => event.uuid === reference.entityId,
      );
      if (humanFailureEvents.length !== 1) {
        throw new BadRequestException(
          `HRA human-failure event '${reference.workbookId}:${reference.entityId}' resolved ${humanFailureEvents.length} times; expected exactly once`,
        );
      }
      const quantifications = workbook.mef.hepQuantifications.filter(
        (quantification) => quantification.uuid === reference.quantificationId,
      );
      if (quantifications.length !== 1) {
        throw new BadRequestException(
          `HRA HEP quantification '${reference.workbookId}:${reference.quantificationId}' resolved ${quantifications.length} times; expected exactly once`,
        );
      }
      const quantification = quantifications[0]!;
      if (quantification.hfeId !== reference.entityId) {
        throw new BadRequestException(
          `HRA HEP quantification '${reference.workbookId}:${reference.quantificationId}' does not quantify human-failure event '${reference.entityId}'`,
        );
      }
      const hep = quantification.meanHep ?? quantification.pointEstimateHep;
      if (hep === undefined || !Number.isFinite(hep) || hep < 0 || hep > 1) {
        throw new BadRequestException(
          `HRA HEP quantification '${reference.workbookId}:${reference.quantificationId}' must provide a finite mean or point estimate between zero and one`,
        );
      }
      values.set(key, hep);
    }
    return {
      values,
      sources: [...daWorkbooks.values(), ...hrWorkbooks.values()],
      references: [...uniqueReferences.values()],
    };
  }

  private async authorizeOwner(
    owner: LoadedWorkbook<unknown>,
    expectedRevision: number,
    acting: ActingUser,
  ): Promise<void> {
    await this.accessService.requireExecution({
      workbookId: owner.workbookId,
      projectId: owner.projectId,
      mef: owner.mef,
      acting,
    });
    assertExpectedWorkbookRevision(owner.document, expectedRevision);
  }

  private async authorizeSources(
    sources: LoadedWorkbook<unknown>[],
    ownerWorkbookId: string,
    acting: ActingUser,
  ): Promise<void> {
    await Promise.all(
      uniqueWorkbooks(sources)
        .filter((source) => source.workbookId !== ownerWorkbookId)
        .map((source) => this.projectsService.resolveAccess(source.projectId, acting)),
    );
  }

  private createSnapshots(sources: LoadedWorkbook<unknown>[]): AnalysisRunWorkbookSnapshot[] {
    return uniqueWorkbooks(sources).map((source) => ({
      hostType: source.hostType,
      identity: {
        workbookId: source.workbookId,
        workbookRevision: source.workbookRevision,
      },
      mef: structuredClone(source.mef) as unknown as Record<string, unknown>,
    }));
  }

  private createAnalysisRunTrace(
    sources: LoadedWorkbook<unknown>[],
    target: AnalysisRunTarget,
    models: WorkbookModelAddress[],
    entities: WorkbookCrossReference[],
  ): AnalysisRunTrace {
    const contributions = new Map<string, AnalysisRunContribution>();
    uniqueWorkbooks(sources).forEach((source) => {
      contributions.set(source.workbookId, {
        hostType: source.hostType,
        workbook: {
          workbookId: source.workbookId,
          workbookRevision: source.workbookRevision,
        },
        models: [],
        entities: [],
      });
    });

    models.forEach((model) => {
      const contribution = contributions.get(model.workbookId);
      if (contribution === undefined) {
        throw new BadRequestException(
          `Contributing model '${model.workbookId}:${model.modelId}' has no immutable workbook source`,
        );
      }
      if (!contribution.models.some((candidate) => candidate.modelId === model.modelId)) {
        contribution.models.push(model);
      }
    });
    entities.forEach((entity) => {
      const contribution = contributions.get(entity.workbookId);
      if (contribution === undefined) {
        throw new BadRequestException(
          `Contributing entity '${entity.workbookId}:${entity.entityId}' has no immutable workbook source`,
        );
      }
      const key = JSON.stringify(entity);
      if (!contribution.entities.some((candidate) => JSON.stringify(candidate) === key)) {
        contribution.entities.push(entity);
      }
    });

    return AnalysisRunTraceSchema.parse({
      target,
      contributions: [...contributions.values()],
    });
  }

  private publicResult(
    kind: PublicResultKind,
    rawValue: unknown,
    runId: string,
    owner: WorkbookModelSnapshotIdentity,
    completedAt: string,
    request: Record<string, unknown>,
  ): unknown {
    const raw = asRecord(rawValue, kind.toLowerCase());
    const common = { schemaVersion: "1.0.0", runId, owner, completedAt };
    if (kind === "FAULT_TREE") {
      return FaultTreeAnalysisResultSchema.parse({
        ...common,
        topGateId: raw["topGateId"],
        topEventProbability: raw["topEventProbability"],
        minimalCutSetCount: raw["minimalCutSetCount"],
        leadingCutSets: raw["leadingCutSets"],
        validationIssues: raw["validationIssues"] ?? [],
      });
    }
    if (kind === "BAYESIAN_NETWORK") {
      return BayesianNetworkAnalysisResultSchema.parse({
        ...common,
        evidence: raw["evidence"],
        marginals: raw["marginals"],
        validationIssues: raw["validationIssues"] ?? [],
      });
    }
    if (kind === "EVENT_TREE") {
      return EventTreeAnalysisResultSchema.parse({
        ...common,
        mode: raw["mode"],
        sequences: raw["sequences"],
        endStateAggregates: raw["endStateAggregates"],
        validationIssues: raw["validationIssues"] ?? [],
      });
    }
    return HclQuantificationResultSchema.parse({
      ...common,
      faultTreeTopGate: request["faultTreeTopGate"],
      probability: raw["probability"],
      bddNodes: raw["bddNodes"],
      bddVariables: raw["bddVariables"],
      variableOrder: raw["variableOrder"],
      bridge: raw["bridge"],
      junctionTree: raw["junctionTree"],
      validationIssues: raw["validationIssues"] ?? [],
    });
  }

  private async executeRun(
    runId: string,
    owner: WorkbookModelSnapshotIdentity,
    methodType: MethodType,
    request: Record<string, unknown>,
    sources: LoadedWorkbook<unknown>[],
    envelope: SolverEnvelope,
    resultKind: PublicResultKind,
    acting: ActingUser,
    trace: AnalysisRunTrace | null = null,
  ): Promise<AnalysisRunMetadata> {
    const context = createImmutableAnalysisRunContext({
      owner,
      sourceWorkbooks: uniqueWorkbooks(sources).map((source) => ({
        workbookId: source.workbookId,
        workbookRevision: source.workbookRevision,
      })),
      workbookSnapshots: this.createSnapshots(sources),
    });
    const requestedAt = new Date();
    await this.runModel.create({
      id: runId,
      schemaVersion: "1.0.0",
      owner: context.owner,
      sourceWorkbooks: context.sourceWorkbooks,
      methodType,
      status: "QUEUED",
      requestedBy: acting.username,
      requestedAt,
      startedAt: null,
      completedAt: null,
      engine: null,
      failure: null,
      request: structuredClone(request),
      workbookSnapshots: context.workbookSnapshots,
      target: trace?.target ?? null,
      contributions: trace?.contributions ?? null,
      result: null,
    });

    const startedAt = new Date();
    await this.runModel.updateOne(
      { id: runId, status: "QUEUED" },
      { $set: { status: "RUNNING", startedAt, engine: ENGINE } },
    ).exec();
    try {
      const response = await this.praetor.execute(envelope);
      const completedAt = new Date();
      if (response.error !== undefined) {
        await this.runModel.updateOne(
          { id: runId, status: "RUNNING" },
          {
            $set: {
              status: "FAILED",
              completedAt,
              failure: response.error,
            },
          },
        ).exec();
        return AnalysisRunMetadataSchema.parse({
          schemaVersion: "1.0.0",
          id: runId,
          owner,
          sourceWorkbooks: context.sourceWorkbooks,
          methodType,
          status: "FAILED",
          requestedBy: acting.username,
          requestedAt: requestedAt.toISOString(),
          startedAt: startedAt.toISOString(),
          completedAt: completedAt.toISOString(),
          engine: ENGINE,
          failure: response.error,
        });
      }
      let result: unknown;
      try {
        result = this.publicResult(
          resultKind,
          response.result,
          runId,
          owner,
          completedAt.toISOString(),
          request,
        );
      } catch (error) {
        if (error instanceof BadGatewayException) throw error;
        throw new BadGatewayException("Praetor returned an invalid native solver result");
      }
      await this.runModel.updateOne(
        { id: runId, status: "RUNNING" },
        { $set: { status: "SUCCEEDED", completedAt, result, failure: null } },
      ).exec();
      return AnalysisRunMetadataSchema.parse({
        schemaVersion: "1.0.0",
        id: runId,
        owner,
        sourceWorkbooks: context.sourceWorkbooks,
        methodType,
        status: "SUCCEEDED",
        requestedBy: acting.username,
        requestedAt: requestedAt.toISOString(),
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        engine: ENGINE,
        failure: null,
      });
    } catch (error) {
      const completedAt = new Date();
      const message = error instanceof Error ? error.message : String(error);
      await this.runModel.updateOne(
        { id: runId, status: "RUNNING" },
        {
          $set: {
            status: "FAILED",
            completedAt,
            failure: {
              kind: "TRANSPORT",
              code: "PRAETOR_FAILURE",
              message,
              details: {},
            },
          },
        },
      ).exec();
      throw error;
    }
  }

  async executeFaultTree(
    workbookId: string,
    pathModelId: string,
    body: unknown,
    acting: ActingUser,
  ): Promise<AnalysisRunMetadata> {
    const request = parseRequest(FaultTreeExecuteRequestSchema, body);
    expectPathModel(pathModelId, request.modelId);
    const owner = await this.loadSy(workbookId);
    await this.authorizeOwner(owner, request.workbookRevision, acting);
    const selectedFaultTrees = [{ source: owner, modelId: request.modelId }];
    const controlled = await this.resolveFaultTreeControlledDataSources(selectedFaultTrees);
    await this.authorizeSources(controlled.sources, owner.workbookId, acting);
    const runId = randomUUID();
    const faultTrees = combineFaultTrees(runId, [
      adaptOrThrow(() =>
        adaptSyFaultTreeSnapshot(owner, request.modelId, {
          controlledDataSourceValues: controlled.values,
        }),
      ),
    ]);
    const identity = { workbookId, modelId: request.modelId, workbookRevision: owner.workbookRevision };
    const solverRequest = {
      schemaVersion: request.schemaVersion,
      methodType: "FAULT_TREE",
      modelId: request.modelId,
      revision: owner.workbookRevision,
      requestedBy: acting.username,
    };
    return this.executeRun(
      runId,
      identity,
      "FAULT_TREE",
      request as unknown as Record<string, unknown>,
      [owner, ...controlled.sources],
      {
        schemaVersion: "1.0.0",
        request: solverRequest,
        modelSnapshots: faultTrees.modelSnapshots,
        resources: { faultTreeBasicEventCatalogue: faultTrees.resource },
      },
      "FAULT_TREE",
      acting,
    );
  }

  async executeBayesianNetwork(
    workbookId: string,
    pathModelId: string,
    body: unknown,
    acting: ActingUser,
  ): Promise<AnalysisRunMetadata> {
    const request = parseRequest(BayesianNetworkExecuteRequestSchema, body);
    expectPathModel(pathModelId, request.modelId);
    const owner = await this.loadEsq(workbookId);
    await this.authorizeOwner(owner, request.workbookRevision, acting);
    const runId = randomUUID();
    const identity = { workbookId, modelId: request.modelId, workbookRevision: owner.workbookRevision };
    const trace = this.createAnalysisRunTrace(
      [owner],
      {
        targetType: "BAYESIAN_NETWORK_QUERY",
        model: identity,
        queryNodeIds: request.query.queryNodeIds,
        evidenceNodeIds: request.query.evidence.observations.map((observation) => observation.nodeId),
      },
      [{ workbookId, modelId: request.modelId }],
      [
        ...request.query.queryNodeIds.map((entityId) => ({
          referenceType: "BAYESIAN_NETWORK_NODE" as const,
          workbookId,
          modelId: request.modelId,
          entityId,
        })),
        ...request.query.evidence.observations.map((observation) => ({
          referenceType: "BAYESIAN_NETWORK_NODE" as const,
          workbookId,
          modelId: request.modelId,
          entityId: observation.nodeId,
        })),
      ],
    );
    return this.executeRun(
      runId,
      identity,
      "BAYESIAN_NETWORK",
      request as unknown as Record<string, unknown>,
      [owner],
      {
        schemaVersion: "1.0.0",
        request: {
          schemaVersion: request.schemaVersion,
          methodType: "BAYESIAN_NETWORK",
          modelId: request.modelId,
          revision: owner.workbookRevision,
          requestedBy: acting.username,
          query: request.query,
        },
        modelSnapshots: [
          adaptOrThrow(() => adaptEsqBayesianNetworkSnapshot(owner, request.modelId)),
        ],
        resources: {},
      },
      "BAYESIAN_NETWORK",
      acting,
      trace,
    );
  }

  private eventTreeModelIds(
    source: LoadedWorkbook<EventSequenceAnalysis>,
    modelId: string,
  ): string[] {
    const ids: string[] = [];
    const pending = [modelId];
    const seen = new Set<string>();
    while (pending.length > 0) {
      const currentId = pending.shift()!;
      if (seen.has(currentId)) continue;
      const tree = source.mef.eventTrees?.find((candidate) => candidate.uuid === currentId);
      if (!tree) throw new NotFoundException(`ES event tree '${currentId}' was not found`);
      seen.add(currentId);
      ids.push(currentId);
      for (const transfer of Object.values(tree.transfers ?? {})) {
        if (!seen.has(transfer.targetEventTreeId)) pending.push(transfer.targetEventTreeId);
      }
    }
    return ids;
  }

  private eventTreeFaultTreeReferences(
    source: LoadedWorkbook<EventSequenceAnalysis>,
    modelId: string,
  ): WorkbookModelAddress[] {
    const tree = source.mef.eventTrees?.find((candidate) => candidate.uuid === modelId);
    if (!tree) throw new NotFoundException("ES event tree not found");
    const refs = Object.values(tree.functionalEvents).map((event) => {
      if (!event.faultTreeTopEvent) {
        throw new BadRequestException(
          `Functional event '${event.uuid}' has no typed fault-tree top-event reference`,
        );
      }
      return {
        workbookId: event.faultTreeTopEvent.workbookId,
        modelId: event.faultTreeTopEvent.modelId,
      };
    });
    return [...new Map(refs.map((reference) => [`${reference.workbookId}:${reference.modelId}`, reference])).values()];
  }

  private async loadEventTreeFaultTrees(
    eventTree: LoadedWorkbook<EventSequenceAnalysis>,
    modelId: string,
  ): Promise<Array<{ source: LoadedWorkbook<SystemsAnalysis>; modelId: string }>> {
    const references = this.eventTreeModelIds(eventTree, modelId).flatMap((eventTreeModelId) =>
      this.eventTreeFaultTreeReferences(eventTree, eventTreeModelId),
    );
    const uniqueReferences = [
      ...new Map(
        references.map((reference) => [`${reference.workbookId}:${reference.modelId}`, reference]),
      ).values(),
    ];
    const workbooks = new Map<string, LoadedWorkbook<SystemsAnalysis>>();
    for (const reference of uniqueReferences) {
      if (!workbooks.has(reference.workbookId)) {
        workbooks.set(reference.workbookId, await this.loadSy(reference.workbookId));
      }
    }
    return uniqueReferences.map((reference) => ({
      source: workbooks.get(reference.workbookId)!,
      modelId: reference.modelId,
    }));
  }

  async executeEventTree(
    workbookId: string,
    pathModelId: string,
    body: unknown,
    acting: ActingUser,
  ): Promise<AnalysisRunMetadata> {
    const request = parseRequest(EventTreeExecuteRequestSchema, body);
    expectPathModel(pathModelId, request.modelId);
    if (request.mode !== "INDEPENDENT") {
      throw new BadRequestException("Use the integration-workbook HCL route for HCL event-tree runs");
    }
    const owner = await this.loadEs(workbookId);
    await this.authorizeOwner(owner, request.workbookRevision, acting);
    const eventTreeModelIds = this.eventTreeModelIds(owner, request.modelId);
    const linked = await this.loadEventTreeFaultTrees(owner, request.modelId);
    const controlled = await this.resolveFaultTreeControlledDataSources(linked);
    await this.authorizeSources(
      [...linked.map(({ source }) => source), ...controlled.sources],
      owner.workbookId,
      acting,
    );
    const runId = randomUUID();
    const faultTrees = combineFaultTrees(
      runId,
      linked.map(({ source, modelId }) =>
        adaptOrThrow(() =>
          adaptSyFaultTreeSnapshot(source, modelId, {
            controlledDataSourceValues: controlled.values,
          }),
        ),
      ),
    );
    const identity = { workbookId, modelId: request.modelId, workbookRevision: owner.workbookRevision };
    return this.executeRun(
      runId,
      identity,
      "EVENT_TREE",
      request as unknown as Record<string, unknown>,
      [owner, ...linked.map(({ source }) => source), ...controlled.sources],
      {
        schemaVersion: "1.0.0",
        request: {
          schemaVersion: request.schemaVersion,
          methodType: "EVENT_TREE",
          modelId: request.modelId,
          revision: owner.workbookRevision,
          mode: request.mode,
          requestedBy: acting.username,
        },
        modelSnapshots: [
          ...eventTreeModelIds.map((eventTreeModelId) =>
            adaptOrThrow(() => adaptEsEventTreeSnapshot(owner, eventTreeModelId)),
          ),
          ...faultTrees.modelSnapshots,
        ],
        resources: { faultTreeBasicEventCatalogue: faultTrees.resource },
      },
      "EVENT_TREE",
      acting,
    );
  }

  private async loadHclSources(
    owner: LoadedWorkbook<EventSequenceQuantification>,
    modelId: string,
  ): Promise<{
    configuration: EventSequenceQuantification["hclConfigurations"][number];
    bayesian: LoadedWorkbook<EventSequenceQuantification>;
    faultTrees: Array<{ source: LoadedWorkbook<SystemsAnalysis>; modelId: string }>;
  }> {
    const configuration = owner.mef.hclConfigurations.find((candidate) => candidate.modelId === modelId);
    if (!configuration) throw new NotFoundException("ESQ HCL configuration not found");
    const bayesian =
      configuration.bayesianNetwork.workbookId === owner.workbookId
        ? owner
        : await this.loadEsq(configuration.bayesianNetwork.workbookId);
    const byWorkbook = new Map<string, LoadedWorkbook<SystemsAnalysis>>();
    for (const reference of configuration.faultTrees) {
      if (!byWorkbook.has(reference.workbookId)) {
        byWorkbook.set(reference.workbookId, await this.loadSy(reference.workbookId));
      }
    }
    return {
      configuration,
      bayesian,
      faultTrees: configuration.faultTrees.map((reference) => ({
        source: byWorkbook.get(reference.workbookId)!,
        modelId: reference.modelId,
      })),
    };
  }

  private hclFaultTreeBasicEventMembership(
    faultTrees: Array<{ source: LoadedWorkbook<SystemsAnalysis>; modelId: string }>,
  ): ReadonlyMap<string, ReadonlySet<string>> {
    return new Map(
      faultTrees.map(({ source, modelId }) => {
        const model = source.mef.systemLogicModels.find((candidate) => candidate.uuid === modelId);
        if (!model) {
          throw new NotFoundException(`SY fault-tree model '${modelId}' was not found`);
        }
        return [
          modelId,
          new Set(
            model.leafNodes
              .filter((leaf) => leaf.kind === "BASIC_EVENT_REFERENCE")
              .map((leaf) => leaf.basicEventId),
          ),
        ] as const;
      }),
    );
  }

  private hclBindingContributionEntities(
    owner: LoadedWorkbook<EventSequenceQuantification>,
    configuration: EventSequenceQuantification["hclConfigurations"][number],
    faultTrees: Array<{ source: LoadedWorkbook<SystemsAnalysis>; modelId: string }>,
  ): WorkbookCrossReference[] {
    const memberships = new Map(
      faultTrees.map(({ source, modelId }) => {
        const model = source.mef.systemLogicModels.find((candidate) => candidate.uuid === modelId);
        if (model === undefined) {
          throw new NotFoundException(`SY fault-tree model '${modelId}' was not found`);
        }
        return [
          `${source.workbookId}:${modelId}`,
          new Set(
            model.leafNodes
              .filter((leaf) => leaf.kind === "BASIC_EVENT_REFERENCE")
              .map((leaf) => leaf.basicEventId),
          ),
        ] as const;
      }),
    );

    return configuration.bindings.flatMap((binding) => {
      const belongsToIncludedTree = faultTrees.some(({ source, modelId }) =>
        source.workbookId === binding.faultTreeBasicEvent.workbookId &&
        memberships.get(`${source.workbookId}:${modelId}`)?.has(binding.faultTreeBasicEvent.entityId) === true,
      );
      if (!belongsToIncludedTree) return [];
      return [
        {
          referenceType: "HCL_BINDING" as const,
          workbookId: owner.workbookId,
          modelId: configuration.modelId,
          entityId: binding.id,
        },
        binding.faultTreeBasicEvent,
        binding.bayesianNetworkNode,
      ];
    });
  }

  private eventTreeContributionEntities(
    source: LoadedWorkbook<EventSequenceAnalysis>,
    modelIds: string[],
  ): WorkbookCrossReference[] {
    return modelIds.flatMap((modelId) => {
      const tree = source.mef.eventTrees?.find((candidate) => candidate.uuid === modelId);
      if (tree === undefined) throw new NotFoundException(`ES event tree '${modelId}' was not found`);
      return Object.values(tree.functionalEvents).flatMap((functionalEvent) => [
        {
          referenceType: "EVENT_TREE_FUNCTIONAL_EVENT" as const,
          workbookId: source.workbookId,
          modelId,
          entityId: functionalEvent.uuid,
        },
        ...(functionalEvent.faultTreeTopEvent === undefined
          ? []
          : [functionalEvent.faultTreeTopEvent]),
      ]);
    });
  }

  async executeHclFaultTree(
    workbookId: string,
    pathModelId: string,
    body: unknown,
    acting: ActingUser,
  ): Promise<AnalysisRunMetadata> {
    const request = parseRequest(HclExecuteRequestSchema, body);
    expectPathModel(pathModelId, request.modelId);
    const owner = await this.loadEsq(workbookId);
    await this.authorizeOwner(owner, request.workbookRevision, acting);
    const hcl = await this.loadHclSources(owner, request.modelId);
    const selected = hcl.faultTrees.find(
      ({ source, modelId }) =>
        source.workbookId === request.faultTreeTopGate.workbookId &&
        modelId === request.faultTreeTopGate.modelId,
    );
    if (!selected) throw new BadRequestException("Requested fault tree is not declared by the HCL configuration");
    const controlled = await this.resolveFaultTreeControlledDataSources([selected]);
    const sources = [
      owner,
      hcl.bayesian,
      ...hcl.faultTrees.map(({ source }) => source),
      ...controlled.sources,
    ];
    await this.authorizeSources(sources, owner.workbookId, acting);
    const runId = randomUUID();
    const faultTrees = combineFaultTrees(
      runId,
      [
        adaptOrThrow(() =>
          adaptSyFaultTreeSnapshot(selected.source, selected.modelId, {
            controlledDataSourceValues: controlled.values,
          }),
        ),
      ],
    );
    const faultTreeBasicEventMembership = this.hclFaultTreeBasicEventMembership(hcl.faultTrees);
    const identity = { workbookId, modelId: request.modelId, workbookRevision: owner.workbookRevision };
    const trace = this.createAnalysisRunTrace(
      sources,
      {
        targetType: "HCL_FAULT_TREE",
        configuration: identity,
        faultTreeTopEvent: {
          workbookId: request.faultTreeTopGate.workbookId,
          workbookRevision: selected.source.workbookRevision,
          modelId: request.faultTreeTopGate.modelId,
          entityId: request.faultTreeTopGate.entityId,
        },
      },
      [
        { workbookId: owner.workbookId, modelId: request.modelId },
        hcl.configuration.bayesianNetwork,
        ...hcl.faultTrees.map(({ source, modelId }) => ({
          workbookId: source.workbookId,
          modelId,
        })),
      ],
      [
        request.faultTreeTopGate,
        ...this.hclBindingContributionEntities(owner, hcl.configuration, hcl.faultTrees),
        ...controlled.references,
      ],
    );
    return this.executeRun(
      runId,
      identity,
      "HYBRID_CAUSAL_LOGIC",
      request as unknown as Record<string, unknown>,
      sources,
      {
        schemaVersion: "1.0.0",
        request: {
          schemaVersion: request.schemaVersion,
          methodType: "HYBRID_CAUSAL_LOGIC",
          modelId: request.modelId,
          revision: owner.workbookRevision,
          requestedBy: acting.username,
          faultTreeTopGate: {
            modelId: request.faultTreeTopGate.modelId,
            entityId: request.faultTreeTopGate.entityId,
          },
        },
        modelSnapshots: [
          ...faultTrees.modelSnapshots,
          adaptOrThrow(() =>
            adaptEsqBayesianNetworkSnapshot(
              hcl.bayesian,
              hcl.configuration.bayesianNetwork.modelId,
            ),
          ),
          adaptOrThrow(() =>
            adaptEsqHclSnapshot(owner, request.modelId, faultTreeBasicEventMembership),
          ),
        ],
        resources: { faultTreeBasicEventCatalogue: faultTrees.resource },
      },
      "HYBRID_CAUSAL_LOGIC",
      acting,
      trace,
    );
  }

  async executeHclEventTree(
    workbookId: string,
    pathModelId: string,
    body: unknown,
    acting: ActingUser,
  ): Promise<AnalysisRunMetadata> {
    const request = parseRequest(HclEventTreeExecuteRequestSchema, body);
    expectPathModel(pathModelId, request.modelId);
    const owner = await this.loadEsq(workbookId);
    await this.authorizeOwner(owner, request.workbookRevision, acting);
    const hcl = await this.loadHclSources(owner, request.modelId);
    const eventTree = await this.loadEs(request.eventTree.workbookId);
    const eventTreeModelIds = this.eventTreeModelIds(eventTree, request.eventTree.modelId);
    const linked = await this.loadEventTreeFaultTrees(eventTree, request.eventTree.modelId);
    const declared = new Set(
      hcl.configuration.faultTrees.map((reference) => `${reference.workbookId}:${reference.modelId}`),
    );
    const undeclared = linked.find(
      ({ source, modelId }) => !declared.has(`${source.workbookId}:${modelId}`),
    );
    if (undeclared) {
      throw new BadRequestException(
        `Event tree links fault tree '${undeclared.modelId}' that is not declared by the HCL configuration`,
      );
    }
    const controlled = await this.resolveFaultTreeControlledDataSources(linked);
    const sources = [
      owner,
      hcl.bayesian,
      eventTree,
      ...linked.map(({ source }) => source),
      ...controlled.sources,
    ];
    await this.authorizeSources(sources, owner.workbookId, acting);
    const runId = randomUUID();
    const faultTrees = combineFaultTrees(
      runId,
      linked.map(({ source, modelId }) =>
        adaptOrThrow(() =>
          adaptSyFaultTreeSnapshot(source, modelId, {
            controlledDataSourceValues: controlled.values,
          }),
        ),
      ),
    );
    const faultTreeBasicEventMembership = this.hclFaultTreeBasicEventMembership(hcl.faultTrees);
    const identity = { workbookId, modelId: request.modelId, workbookRevision: owner.workbookRevision };
    const persistedRequest = {
      ...request,
      mode: "HYBRID_CAUSAL_LOGIC",
    } as unknown as Record<string, unknown>;
    const trace = this.createAnalysisRunTrace(
      sources,
      {
        targetType: "HCL_EVENT_TREE",
        configuration: identity,
        eventTree: {
          workbookId: eventTree.workbookId,
          workbookRevision: eventTree.workbookRevision,
          modelId: request.eventTree.modelId,
        },
      },
      [
        { workbookId: owner.workbookId, modelId: request.modelId },
        hcl.configuration.bayesianNetwork,
        ...eventTreeModelIds.map((modelId) => ({ workbookId: eventTree.workbookId, modelId })),
        ...linked.map(({ source, modelId }) => ({ workbookId: source.workbookId, modelId })),
      ],
      [
        ...this.hclBindingContributionEntities(owner, hcl.configuration, linked),
        ...this.eventTreeContributionEntities(eventTree, eventTreeModelIds),
        ...controlled.references,
      ],
    );
    return this.executeRun(
      runId,
      identity,
      "EVENT_TREE",
      persistedRequest,
      sources,
      {
        schemaVersion: "1.0.0",
        request: {
          schemaVersion: request.schemaVersion,
          methodType: "EVENT_TREE",
          modelId: request.eventTree.modelId,
          revision: eventTree.workbookRevision,
          mode: "HYBRID_CAUSAL_LOGIC",
          requestedBy: acting.username,
        },
        modelSnapshots: [
          ...eventTreeModelIds.map((eventTreeModelId) =>
            adaptOrThrow(() =>
              adaptEsEventTreeSnapshot(eventTree, eventTreeModelId, {
                workbookId: owner.workbookId,
                modelId: request.modelId,
              }),
            ),
          ),
          ...faultTrees.modelSnapshots,
          adaptOrThrow(() =>
            adaptEsqBayesianNetworkSnapshot(
              hcl.bayesian,
              hcl.configuration.bayesianNetwork.modelId,
            ),
          ),
          adaptOrThrow(() =>
            adaptEsqHclSnapshot(owner, request.modelId, faultTreeBasicEventMembership),
          ),
        ],
        resources: { faultTreeBasicEventCatalogue: faultTrees.resource },
      },
      "EVENT_TREE",
      acting,
      trace,
    );
  }

  private async authorizeRunOwner(
    hostType: WorkbookMethodHostType,
    workbookId: string,
    acting: ActingUser,
  ): Promise<void> {
    const workbook =
      hostType === "SY"
        ? await this.loadSy(workbookId)
        : hostType === "ES"
          ? await this.loadEs(workbookId)
          : hostType === "ESQ"
            ? await this.loadEsq(workbookId)
            : hostType === "DA"
              ? await this.loadDa(workbookId)
              : await this.loadHr(workbookId);
    await this.projectsService.resolveAccess(workbook.projectId, acting);
  }

  async listRunProvenance(
    hostType: WorkbookMethodHostType,
    workbookId: string,
    acting: ActingUser,
  ): Promise<AnalysisRunProvenanceList> {
    await this.authorizeRunOwner(hostType, workbookId, acting);
    const records = await this.runModel.find({
      "owner.workbookId": workbookId,
      target: { $ne: null },
      contributions: { $ne: null },
    }).sort({ requestedAt: -1 }).limit(100).exec();
    return AnalysisRunProvenanceListSchema.parse({
      schemaVersion: "1.0.0",
      runs: records.map((record) => AnalysisRunProvenanceSchema.parse({
        run: toRunMetadata(record),
        target: record.target,
        contributions: record.contributions,
      })),
    });
  }

  async getRun(
    hostType: WorkbookMethodHostType,
    workbookId: string,
    modelId: string,
    runId: string,
    acting: ActingUser,
  ): Promise<AnalysisRunMetadata> {
    await this.authorizeRunOwner(hostType, workbookId, acting);
    const run = await this.runModel.findOne({
      id: runId,
      "owner.workbookId": workbookId,
      "owner.modelId": modelId,
    }).exec();
    if (!run) throw new NotFoundException("Analysis run not found");
    return toRunMetadata(run);
  }

  async getResult(
    hostType: WorkbookMethodHostType,
    workbookId: string,
    modelId: string,
    runId: string,
    acting: ActingUser,
  ): Promise<unknown> {
    await this.authorizeRunOwner(hostType, workbookId, acting);
    const run = await this.runModel.findOne({
      id: runId,
      "owner.workbookId": workbookId,
      "owner.modelId": modelId,
    }).exec();
    if (!run) throw new NotFoundException("Analysis run not found");
    if (run.status !== "SUCCEEDED" || run.result === null) {
      throw new ConflictException(`Analysis result is unavailable while run status is ${run.status}`);
    }
    if (run.methodType === "FAULT_TREE") return FaultTreeAnalysisResultSchema.parse(run.result);
    if (run.methodType === "BAYESIAN_NETWORK") return BayesianNetworkAnalysisResultSchema.parse(run.result);
    if (run.methodType === "EVENT_TREE") return EventTreeAnalysisResultSchema.parse(run.result);
    return HclQuantificationResultSchema.parse(run.result);
  }
}

export type { SolverEnvelope };
