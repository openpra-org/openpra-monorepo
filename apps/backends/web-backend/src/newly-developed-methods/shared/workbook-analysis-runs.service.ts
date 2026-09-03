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
import type { WorkbookBayesianNetwork, WorkbookHclConfiguration } from "interfaces-mef-types/modeling";
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
  HclEventTreeBatchExecuteRequestSchema,
  HclExecuteRequestSchema,
  HclFaultTreeBatchExecuteRequestSchema,
  HclBatchExecuteResultSchema,
  HclHazardConvolutionResultSchema,
  HclQuantificationResultSchema,
  createImmutableAnalysisRunContext,
  hclTargetKey,
  resolveHclBatchTargetRelevance,
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
  HclEventTreeBatchExecuteRequest,
  HclExecuteRequest,
  HclFaultTreeBatchExecuteRequest,
  HclBatchExecuteResult,
  HclHazardConvolutionResult,
  HclBatchFaultTreeTarget,
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
  adaptSyBayesianNetworkSnapshot,
  adaptSyHclSnapshot,
  adaptSyFaultTreeSnapshot,
  collectSyFaultTreeControlledDataSources,
  faultTreeControlledDataSourceKey,
  WorkbookPraxisAdapterError,
} from "./praxis-snapshot-adapters";
import type { ResolvedControlledDataSourceValue } from "./praxis-snapshot-adapters";
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

interface HclBatchRunContext {
  evidenceScenarioIds: string[];
  varyingEvidenceNodeIds: string[];
  affectedBayesianNetworkNodeIds: string[];
  relevantBindingIds: string[];
  targetKey: string;
  targetEvidenceNodeIds: string[];
  hazardGrid?: {
    name: string;
    hazardNodeIds: string[];
    annualFrequencyScale: {
      value: number;
      unit: string;
      annualization: { basis: string; hoursPerYear: number };
    };
    normalizeWeights: boolean;
  };
}

type HclConfigurationOwner =
  | LoadedWorkbook<EventSequenceQuantification>
  | LoadedWorkbook<SystemsAnalysis>;

interface LoadedHclSources {
  configuration: WorkbookHclConfiguration;
  configurationOwner: HclConfigurationOwner;
  bayesian: HclConfigurationOwner;
  faultTrees: Array<{ source: LoadedWorkbook<SystemsAnalysis>; modelId: string }>;
}

interface HclPreparedBatchScenario {
  scenarioId: string;
  scenarioCode: string;
  scenarioName: string;
  runId: string;
  request: Record<string, unknown>;
  trace: AnalysisRunTrace;
}

interface ExecutedHclBatch {
  runs: HclBatchExecuteResult["runs"];
  hazardConvolution?: HclHazardConvolutionResult;
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

const crossReferenceKey = (reference: WorkbookCrossReference): string =>
  JSON.stringify(Object.fromEntries(Object.entries(reference).sort(([left], [right]) => left.localeCompare(right))));

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

  private async resolveDaControlledDataSource(
    reference: Extract<WorkbookCrossReference, { referenceType: "WORKBOOK_PARAMETER" }>,
    projectId: string,
  ): Promise<LoadedWorkbook<DataAnalysis>> {
    try {
      return await this.loadDa(reference.workbookId);
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
    }

    const candidates = await this.daWorkbookModel
      .find({
        projectId,
        "mef.parameters": { $elemMatch: { uuid: reference.entityId } },
      })
      .select({ workbookId: 1 })
      .limit(2)
      .exec();
    if (candidates.length === 0) {
      throw new BadRequestException(
        `DA parameter '${reference.entityId}' points to missing workbook '${reference.workbookId}', and no matching DA parameter exists in this project`,
      );
    }
    if (candidates.length > 1) {
      throw new BadRequestException(
        `DA parameter '${reference.entityId}' points to missing workbook '${reference.workbookId}', and multiple matching DA workbooks exist in this project; relink the parameter`,
      );
    }
    return this.loadDa(candidates[0]!.workbookId);
  }

  private async resolveHrControlledDataSource(
    reference: Extract<WorkbookCrossReference, { referenceType: "HUMAN_FAILURE_EVENT" }>,
    projectId: string,
  ): Promise<LoadedWorkbook<HumanReliabilityAnalysis>> {
    try {
      return await this.loadHr(reference.workbookId);
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
    }

    const candidates = await this.hrWorkbookModel
      .find({
        projectId,
        "mef.humanFailureEvents": { $elemMatch: { uuid: reference.entityId } },
        "mef.hepQuantifications": {
          $elemMatch: {
            uuid: reference.quantificationId,
            hfeId: reference.entityId,
          },
        },
      })
      .select({ workbookId: 1 })
      .limit(2)
      .exec();
    if (candidates.length === 0) {
      throw new BadRequestException(
        `HRA event '${reference.entityId}' points to missing workbook '${reference.workbookId}', and no matching HRA quantification exists in this project`,
      );
    }
    if (candidates.length > 1) {
      throw new BadRequestException(
        `HRA event '${reference.entityId}' points to missing workbook '${reference.workbookId}', and multiple matching HRA workbooks exist in this project; relink the event`,
      );
    }
    return this.loadHr(candidates[0]!.workbookId);
  }

  private async resolveFaultTreeControlledDataSources(
    faultTrees: Array<{ source: LoadedWorkbook<SystemsAnalysis>; modelId: string }>,
  ): Promise<{
    values: ReadonlyMap<string, ResolvedControlledDataSourceValue>;
    sources: LoadedWorkbook<unknown>[];
    references: WorkbookCrossReference[];
  }> {
    const referencedSources = faultTrees.flatMap(({ source, modelId }) =>
      adaptOrThrow(() => collectSyFaultTreeControlledDataSources(source, modelId))
        .map((reference) => ({ reference, projectId: source.projectId })),
    );
    const uniqueReferences = new Map<string, (typeof referencedSources)[number]>();
    for (const referencedSource of referencedSources) {
      const key = faultTreeControlledDataSourceKey(referencedSource.reference);
      const existing = uniqueReferences.get(key);
      if (existing !== undefined && existing.projectId !== referencedSource.projectId) {
        throw new BadRequestException(
          `Controlled data source '${referencedSource.reference.workbookId}:${referencedSource.reference.entityId}' is referenced from multiple projects`,
        );
      }
      uniqueReferences.set(key, referencedSource);
    }
    const daWorkbooks = new Map<string, LoadedWorkbook<DataAnalysis>>();
    const hrWorkbooks = new Map<string, LoadedWorkbook<HumanReliabilityAnalysis>>();
    const resolvedDaWorkbookIds = new Map<string, LoadedWorkbook<DataAnalysis>>();
    const resolvedHrWorkbookIds = new Map<string, LoadedWorkbook<HumanReliabilityAnalysis>>();
    const resolvedReferences = new Map<string, WorkbookCrossReference>();
    for (const [key, { reference, projectId }] of uniqueReferences) {
      const requestedWorkbookKey = `${projectId}:${reference.workbookId}`;
      if (reference.referenceType === "WORKBOOK_PARAMETER") {
        const workbook = resolvedDaWorkbookIds.get(requestedWorkbookKey)
          ?? await this.resolveDaControlledDataSource(reference, projectId);
        resolvedDaWorkbookIds.set(requestedWorkbookKey, workbook);
        daWorkbooks.set(key, workbook);
        resolvedReferences.set(key, { ...reference, workbookId: workbook.workbookId });
      } else {
        const workbook = resolvedHrWorkbookIds.get(requestedWorkbookKey)
          ?? await this.resolveHrControlledDataSource(reference, projectId);
        resolvedHrWorkbookIds.set(requestedWorkbookKey, workbook);
        hrWorkbooks.set(key, workbook);
        resolvedReferences.set(key, { ...reference, workbookId: workbook.workbookId });
      }
    }

    const values = new Map<string, ResolvedControlledDataSourceValue>();
    const probabilityParameterTypes = new Set([
      "PROBABILITY",
      "UNAVAILABILITY",
      "HUMAN_ERROR_PROBABILITY",
    ]);
    for (const [key, { reference }] of uniqueReferences) {
      if (reference.referenceType === "WORKBOOK_PARAMETER") {
        const workbook = daWorkbooks.get(key)!;
        const matches = workbook.mef.parameters.filter(
          (parameter) => parameter.uuid === reference.entityId,
        );
        if (matches.length !== 1) {
          throw new BadRequestException(
            `DA parameter '${reference.workbookId}:${reference.entityId}' resolved ${matches.length} times; expected exactly once`,
          );
        }
        const parameter = matches[0]!;
        if (!probabilityParameterTypes.has(parameter.parameterType) && parameter.parameterType !== "FREQUENCY") {
          throw new BadRequestException(
            `DA parameter '${reference.workbookId}:${reference.entityId}' has type '${parameter.parameterType}', which cannot control a fault-tree quantitative input`,
          );
        }
        const quantity = parameter.parameterType === "FREQUENCY" ? "FAILURE_RATE" : "PROBABILITY";
        if (
          !Number.isFinite(parameter.value)
          || parameter.value < 0
          || (quantity === "PROBABILITY" && parameter.value > 1)
        ) {
          throw new BadRequestException(
            `DA parameter '${reference.workbookId}:${reference.entityId}' must be finite and ${quantity === "PROBABILITY" ? "between zero and one" : "non-negative"}`,
          );
        }
        values.set(key, { value: parameter.value, quantity });
        continue;
      }

      const workbook = hrWorkbooks.get(key)!;
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
      values.set(key, { value: hep, quantity: "PROBABILITY" });
    }
    return {
      values,
      sources: uniqueWorkbooks([...daWorkbooks.values(), ...hrWorkbooks.values()]),
      references: [...resolvedReferences.values()],
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
      const key = crossReferenceKey(entity);
      if (!contribution.entities.some((candidate) => crossReferenceKey(candidate) === key)) {
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
        basicEventQuantifications: raw["basicEventQuantifications"],
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
        frequencySemantics: raw["frequencySemantics"],
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
      basicEventQuantifications: raw["basicEventQuantifications"],
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

  private async executeHclBatchRuns(
    owner: WorkbookModelSnapshotIdentity,
    methodType: "HYBRID_CAUSAL_LOGIC" | "EVENT_TREE",
    scenarios: HclPreparedBatchScenario[],
    sources: LoadedWorkbook<unknown>[],
    envelope: SolverEnvelope,
    resultKind: "HYBRID_CAUSAL_LOGIC" | "EVENT_TREE",
    acting: ActingUser,
  ): Promise<ExecutedHclBatch> {
    const context = createImmutableAnalysisRunContext({
      owner,
      sourceWorkbooks: uniqueWorkbooks(sources).map((source) => ({
        workbookId: source.workbookId,
        workbookRevision: source.workbookRevision,
      })),
      workbookSnapshots: this.createSnapshots(sources),
    });
    const requestedAt = new Date();
    await Promise.all(scenarios.map((scenario) => this.runModel.create({
      id: scenario.runId,
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
      request: structuredClone(scenario.request),
      workbookSnapshots: context.workbookSnapshots,
      target: scenario.trace.target,
      contributions: scenario.trace.contributions,
      result: null,
    })));

    const startedAt = new Date();
    await this.runModel.updateMany(
      { id: { $in: scenarios.map((scenario) => scenario.runId) }, status: "QUEUED" },
      { $set: { status: "RUNNING", startedAt, engine: ENGINE } },
    ).exec();
    try {
      const response = await this.praetor.execute(envelope);
      const completedAt = new Date();
      if (response.error !== undefined) {
        await this.runModel.updateMany(
          { id: { $in: scenarios.map((scenario) => scenario.runId) }, status: "RUNNING" },
          { $set: { status: "FAILED", completedAt, failure: response.error } },
        ).exec();
        return { runs: scenarios.map((scenario) => ({
          scenarioId: scenario.scenarioId,
          scenarioCode: scenario.scenarioCode,
          scenarioName: scenario.scenarioName,
          run: AnalysisRunMetadataSchema.parse({
            schemaVersion: "1.0.0",
            id: scenario.runId,
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
          }),
        })) };
      }

      const native = asRecord(response.result, "HCL batch");
      const rawBatchResults = native["batchResults"];
      if (!Array.isArray(rawBatchResults) || rawBatchResults.length !== scenarios.length) {
        throw new BadGatewayException("PRAXIS returned an invalid HCL batch result count");
      }
      const byScenarioId = new Map<string, Record<string, unknown>>();
      rawBatchResults.forEach((rawResult) => {
        const result = asRecord(rawResult, "HCL batch scenario");
        const scenarioId = result["scenarioId"];
        if (typeof scenarioId !== "string" || byScenarioId.has(scenarioId)) {
          throw new BadGatewayException("PRAXIS returned an invalid HCL batch scenario id");
        }
        byScenarioId.set(scenarioId, result);
      });

      const runs = await Promise.all(scenarios.map(async (scenario) => {
        const rawResult = byScenarioId.get(scenario.scenarioId);
        if (rawResult === undefined) {
          throw new BadGatewayException(
            `PRAXIS did not return HCL batch scenario '${scenario.scenarioId}'`,
          );
        }
        const result = this.publicResult(
          resultKind,
          rawResult,
          scenario.runId,
          owner,
          completedAt.toISOString(),
          scenario.request,
        );
        await this.runModel.updateOne(
          { id: scenario.runId, status: "RUNNING" },
          { $set: { status: "SUCCEEDED", completedAt, result, failure: null } },
        ).exec();
        return {
          scenarioId: scenario.scenarioId,
          scenarioCode: scenario.scenarioCode,
          scenarioName: scenario.scenarioName,
          run: AnalysisRunMetadataSchema.parse({
            schemaVersion: "1.0.0",
            id: scenario.runId,
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
          }),
        };
      }));
      const rawHazardConvolution = native["hazardConvolution"];
      const hazardConvolution = rawHazardConvolution === undefined
        ? undefined
        : HclHazardConvolutionResultSchema.parse(rawHazardConvolution);
      return {
        runs,
        ...(hazardConvolution === undefined ? {} : { hazardConvolution }),
      };
    } catch (error) {
      const completedAt = new Date();
      const message = error instanceof Error ? error.message : String(error);
      await this.runModel.updateMany(
        { id: { $in: scenarios.map((scenario) => scenario.runId) }, status: "RUNNING" },
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
    ownerKind: "ESQ" | "SY" = "ESQ",
  ): Promise<AnalysisRunMetadata> {
    const request = parseRequest(BayesianNetworkExecuteRequestSchema, body);
    expectPathModel(pathModelId, request.modelId);
    const owner = ownerKind === "SY" ? await this.loadSy(workbookId) : await this.loadEsq(workbookId);
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
          adaptOrThrow(() => ownerKind === "SY"
            ? adaptSyBayesianNetworkSnapshot(owner as LoadedWorkbook<SystemsAnalysis>, request.modelId)
            : adaptEsqBayesianNetworkSnapshot(owner as LoadedWorkbook<EventSequenceQuantification>, request.modelId)),
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
    owner: HclConfigurationOwner,
    modelId: string,
    dependencyConfiguration?: WorkbookModelAddress,
  ): Promise<LoadedHclSources> {
    const configurationOwner = dependencyConfiguration === undefined
      ? owner
      : await this.loadSy(dependencyConfiguration.workbookId);
    if (dependencyConfiguration !== undefined && dependencyConfiguration.modelId !== modelId) {
      throw new BadRequestException("The HCL model id must match the referenced SY dependency configuration");
    }
    const configurations = configurationOwner.hostType === "SY"
      ? (configurationOwner.mef as SystemsAnalysis).dependencyHclConfigurations ?? []
      : (configurationOwner.mef as EventSequenceQuantification).hclConfigurations;
    const configuration = configurations.find((candidate) => candidate.modelId === modelId);
    if (!configuration) {
      throw new NotFoundException(
        configurationOwner.hostType === "SY"
          ? "SY HCL dependency configuration not found"
          : "ESQ HCL configuration not found",
      );
    }
    const bayesian = configuration.bayesianNetwork.workbookId === configurationOwner.workbookId
      ? configurationOwner
      : configurationOwner.hostType === "SY"
        ? await this.loadSy(configuration.bayesianNetwork.workbookId)
        : await this.loadEsq(configuration.bayesianNetwork.workbookId);
    const byWorkbook = new Map<string, LoadedWorkbook<SystemsAnalysis>>();
    for (const reference of configuration.faultTrees) {
      if (!byWorkbook.has(reference.workbookId)) {
        byWorkbook.set(reference.workbookId, await this.loadSy(reference.workbookId));
      }
    }
    return {
      configuration,
      configurationOwner,
      bayesian,
      faultTrees: configuration.faultTrees.map((reference) => ({
        source: byWorkbook.get(reference.workbookId)!,
        modelId: reference.modelId,
      })),
    };
  }

  private adaptHclBayesianNetwork(hcl: LoadedHclSources): PraxisModelSnapshot {
    return hcl.bayesian.hostType === "SY"
      ? adaptSyBayesianNetworkSnapshot(
          hcl.bayesian as LoadedWorkbook<SystemsAnalysis>,
          hcl.configuration.bayesianNetwork.modelId,
        )
      : adaptEsqBayesianNetworkSnapshot(
          hcl.bayesian as LoadedWorkbook<EventSequenceQuantification>,
          hcl.configuration.bayesianNetwork.modelId,
        );
  }

  private adaptHclConfiguration(
    hcl: LoadedHclSources,
    faultTreeBasicEventMembership: ReadonlyMap<string, ReadonlySet<string>>,
    evidence?: WorkbookHclConfiguration["baseEvidence"],
    effectiveFaultTrees?: WorkbookModelAddress[],
  ): PraxisModelSnapshot {
    return hcl.configurationOwner.hostType === "SY"
      ? adaptSyHclSnapshot(
          hcl.configurationOwner as LoadedWorkbook<SystemsAnalysis>,
          hcl.configuration.modelId,
          faultTreeBasicEventMembership,
          evidence,
          effectiveFaultTrees,
        )
      : adaptEsqHclSnapshot(
          hcl.configurationOwner as LoadedWorkbook<EventSequenceQuantification>,
          hcl.configuration.modelId,
          faultTreeBasicEventMembership,
          evidence,
        );
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

  private hclBatchFaultTreeTargets(
    faultTrees: Array<{ source: LoadedWorkbook<SystemsAnalysis>; modelId: string }>,
  ): HclBatchFaultTreeTarget[] {
    return faultTrees.map(({ source, modelId }) => {
      const model = source.mef.systemLogicModels.find((candidate) => candidate.uuid === modelId);
      if (model === undefined) throw new NotFoundException(`SY fault-tree model '${modelId}' was not found`);
      return {
        workbookId: source.workbookId,
        modelId,
        topGateId: model.topGate?.gateId ?? null,
        gates: model.gates.map((gate) => gate.gateType === "K_OF_N"
          ? { id: gate.id, gateType: gate.gateType, k: gate.k }
          : { id: gate.id, gateType: gate.gateType }),
        leafNodes: model.leafNodes.map((leaf) => {
          if (leaf.kind === "BASIC_EVENT_REFERENCE") {
            return { id: leaf.id, kind: leaf.kind, basicEventId: leaf.basicEventId };
          }
          if (leaf.kind === "HOUSE_EVENT") {
            return { id: leaf.id, kind: leaf.kind, state: leaf.state };
          }
          if (leaf.kind === "TRANSFER_REFERENCE") {
            return {
              id: leaf.id,
              kind: leaf.kind,
              target: {
                workbookId: source.workbookId,
                modelId: leaf.target.modelId,
                entityId: leaf.target.entityId,
              },
            };
          }
          return { id: leaf.id, kind: leaf.kind };
        }),
        gateInputs: model.gateInputs.map(({ gateId, childId, order }) => ({
          gateId,
          childId,
          order,
        })),
        constantBasicEventStates: Object.fromEntries(
          source.mef.systemBasicEvents.flatMap((event) =>
            event.controlledDataSource === undefined
              && (event.probability === 0 || event.probability === 1)
              ? [[event.uuid, event.probability === 1]]
              : [],
          ),
        ),
      };
    });
  }

  private hclBatchBayesianNetwork(
    source: HclConfigurationOwner,
    modelId: string,
  ): WorkbookBayesianNetwork {
    const models = source.hostType === "SY"
      ? (source.mef as SystemsAnalysis).dependencyBayesianNetworks ?? []
      : (source.mef as EventSequenceQuantification).bayesianNetworks;
    const model = models.find((candidate) => candidate.modelId === modelId);
    if (model === undefined) throw new NotFoundException(`${source.hostType} Bayesian network '${modelId}' was not found`);
    return model;
  }

  private hclBindingContributionEntities(
    owner: HclConfigurationOwner,
    configuration: WorkbookHclConfiguration,
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

  private resolveHclEvidenceScenario(
    configuration: WorkbookHclConfiguration,
    scenarioId: string | undefined,
  ): {
    scenario: NonNullable<WorkbookHclConfiguration["evidenceScenarios"]>[number];
    evidence: WorkbookHclConfiguration["baseEvidence"];
  } | null {
    if (scenarioId === undefined) return null;
    const matches = (configuration.evidenceScenarios ?? []).filter((scenario) => scenario.id === scenarioId);
    if (matches.length !== 1) {
      throw new BadRequestException(
        `Evidence scenario '${scenarioId}' resolved ${matches.length} times; expected exactly once`,
      );
    }
    const scenario = matches[0]!;
    const observations = new Map(
      configuration.baseEvidence.observations.map((observation) => [observation.nodeId, observation]),
    );
    scenario.evidence.observations.forEach((observation) => observations.set(observation.nodeId, observation));
    return {
      scenario,
      evidence: { observations: [...observations.values()] },
    };
  }

  private resolveHclHazardGrid(
    configuration: WorkbookHclConfiguration,
    requested: boolean | undefined,
  ): NonNullable<WorkbookHclConfiguration["hazardGrid"]> | null {
    if (requested !== true) return null;
    if (configuration.hazardGrid === undefined) {
      throw new BadRequestException(
        "Hazard convolution requires hazard-grid settings on the HCL configuration",
      );
    }
    return configuration.hazardGrid;
  }

  private hclEvidenceContributionEntities(
    configuration: WorkbookHclConfiguration,
    evidence: WorkbookHclConfiguration["baseEvidence"],
  ): WorkbookCrossReference[] {
    return evidence.observations.map((observation) => ({
      referenceType: "BAYESIAN_NETWORK_NODE" as const,
      workbookId: configuration.bayesianNetwork.workbookId,
      modelId: configuration.bayesianNetwork.modelId,
      entityId: observation.nodeId,
    }));
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
    batchContext: HclBatchRunContext | null = null,
    ownerKind: "ESQ" | "SY" = "ESQ",
  ): Promise<AnalysisRunMetadata> {
    const request = parseRequest(HclExecuteRequestSchema, body);
    expectPathModel(pathModelId, request.modelId);
    const owner = ownerKind === "SY" ? await this.loadSy(workbookId) : await this.loadEsq(workbookId);
    await this.authorizeOwner(owner, request.workbookRevision, acting);
    const hcl = await this.loadHclSources(owner, request.modelId);
    const evidenceScenario = this.resolveHclEvidenceScenario(
      hcl.configuration,
      request.evidenceScenarioId,
    );
    const selected = hcl.faultTrees.find(
      ({ source, modelId }) =>
        source.workbookId === request.faultTreeTopGate.workbookId &&
        modelId === request.faultTreeTopGate.modelId,
    );
    if (!selected) throw new BadRequestException("Requested fault tree is not declared by the HCL configuration");
    const controlled = await this.resolveFaultTreeControlledDataSources([selected]);
    const sources = [
      owner,
      hcl.configurationOwner,
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
        ...(hcl.configurationOwner.workbookId === owner.workbookId
          ? []
          : [{ workbookId: hcl.configurationOwner.workbookId, modelId: hcl.configuration.modelId }]),
        hcl.configuration.bayesianNetwork,
        ...hcl.faultTrees.map(({ source, modelId }) => ({
          workbookId: source.workbookId,
          modelId,
        })),
      ],
      [
        request.faultTreeTopGate,
        ...this.hclBindingContributionEntities(hcl.configurationOwner, hcl.configuration, hcl.faultTrees),
        ...this.hclEvidenceContributionEntities(
          hcl.configuration,
          evidenceScenario?.evidence ?? hcl.configuration.baseEvidence,
        ),
        ...controlled.references,
      ],
    );
    const persistedRequest = batchContext === null
      ? request as unknown as Record<string, unknown>
      : { ...request, batchContext } as unknown as Record<string, unknown>;
    return this.executeRun(
      runId,
      identity,
      "HYBRID_CAUSAL_LOGIC",
      persistedRequest,
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
          adaptOrThrow(() => this.adaptHclBayesianNetwork(hcl)),
          adaptOrThrow(() => this.adaptHclConfiguration(
            hcl,
            faultTreeBasicEventMembership,
            evidenceScenario?.evidence,
          )),
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
    batchContext: HclBatchRunContext | null = null,
  ): Promise<AnalysisRunMetadata> {
    const request = parseRequest(HclEventTreeExecuteRequestSchema, body);
    expectPathModel(pathModelId, request.modelId);
    const owner = await this.loadEsq(workbookId);
    await this.authorizeOwner(owner, request.workbookRevision, acting);
    const hcl = await this.loadHclSources(
      owner,
      request.modelId,
      request.dependencyConfiguration,
    );
    const evidenceScenario = this.resolveHclEvidenceScenario(
      hcl.configuration,
      request.evidenceScenarioId,
    );
    const eventTree = await this.loadEs(request.eventTree.workbookId);
    const eventTreeModelIds = this.eventTreeModelIds(eventTree, request.eventTree.modelId);
    const linked = await this.loadEventTreeFaultTrees(eventTree, request.eventTree.modelId);
    const declared = new Set(
      hcl.configuration.faultTrees.map((reference) => `${reference.workbookId}:${reference.modelId}`),
    );
    const undeclared = request.dependencyConfiguration === undefined ? linked.find(
      ({ source, modelId }) => !declared.has(`${source.workbookId}:${modelId}`),
    ) : undefined;
    if (undeclared) {
      throw new BadRequestException(
        `Event tree links fault tree '${undeclared.modelId}' that is not declared by the HCL configuration`,
      );
    }
    const controlled = await this.resolveFaultTreeControlledDataSources(linked);
    const sources = [
      owner,
      hcl.configurationOwner,
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
    const faultTreeBasicEventMembership = this.hclFaultTreeBasicEventMembership(linked);
    const effectiveFaultTrees = linked.map(({ source, modelId }) => ({
      workbookId: source.workbookId,
      modelId,
    }));
    const identity = { workbookId, modelId: request.modelId, workbookRevision: owner.workbookRevision };
    const persistedRequest = {
      ...request,
      mode: "HYBRID_CAUSAL_LOGIC",
      ...(batchContext === null ? {} : { batchContext }),
    } as unknown as Record<string, unknown>;
    const trace = this.createAnalysisRunTrace(
      sources,
      {
        targetType: "HCL_EVENT_TREE",
        configuration: {
          workbookId: hcl.configurationOwner.workbookId,
          workbookRevision: hcl.configurationOwner.workbookRevision,
          modelId: hcl.configuration.modelId,
        },
        eventTree: {
          workbookId: eventTree.workbookId,
          workbookRevision: eventTree.workbookRevision,
          modelId: request.eventTree.modelId,
        },
        ...(hcl.configurationOwner.workbookId === owner.workbookId
          ? {}
          : { orchestrator: identity }),
      },
      [
        { workbookId: owner.workbookId, modelId: request.modelId },
        ...(hcl.configurationOwner.workbookId === owner.workbookId
          ? []
          : [{ workbookId: hcl.configurationOwner.workbookId, modelId: hcl.configuration.modelId }]),
        hcl.configuration.bayesianNetwork,
        ...eventTreeModelIds.map((modelId) => ({ workbookId: eventTree.workbookId, modelId })),
        ...linked.map(({ source, modelId }) => ({ workbookId: source.workbookId, modelId })),
      ],
      [
        ...this.hclBindingContributionEntities(hcl.configurationOwner, hcl.configuration, linked),
        ...this.hclEvidenceContributionEntities(
          hcl.configuration,
          evidenceScenario?.evidence ?? hcl.configuration.baseEvidence,
        ),
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
                workbookId: hcl.configurationOwner.workbookId,
                modelId: hcl.configuration.modelId,
              }),
            ),
          ),
          ...faultTrees.modelSnapshots,
          adaptOrThrow(() => this.adaptHclBayesianNetwork(hcl)),
          adaptOrThrow(() => this.adaptHclConfiguration(
            hcl,
            faultTreeBasicEventMembership,
            evidenceScenario?.evidence,
            effectiveFaultTrees,
          )),
        ],
        resources: { faultTreeBasicEventCatalogue: faultTrees.resource },
      },
      "EVENT_TREE",
      acting,
      trace,
    );
  }

  async executeHclFaultTreeBatch(
    workbookId: string,
    pathModelId: string,
    body: unknown,
    acting: ActingUser,
    ownerKind: "ESQ" | "SY" = "ESQ",
  ): Promise<HclBatchExecuteResult> {
    const request = parseRequest(HclFaultTreeBatchExecuteRequestSchema, body);
    expectPathModel(pathModelId, request.modelId);
    const owner = ownerKind === "SY" ? await this.loadSy(workbookId) : await this.loadEsq(workbookId);
    await this.authorizeOwner(owner, request.workbookRevision, acting);
    const hcl = await this.loadHclSources(owner, request.modelId);
    const configuration = hcl.configuration;
    const hazardGrid = this.resolveHclHazardGrid(configuration, request.integrateHazardGrid);
    const resolvedScenarios = request.evidenceScenarioIds.map((scenarioId) =>
      this.resolveHclEvidenceScenario(configuration, scenarioId)!,
    );
    const scenarios = resolvedScenarios.map(({ scenario }) => scenario);
    const relevance = resolveHclBatchTargetRelevance({
      bayesianNetwork: this.hclBatchBayesianNetwork(
        hcl.bayesian,
        configuration.bayesianNetwork.modelId,
      ),
      baseEvidence: configuration.baseEvidence,
      scenarios,
      bindings: configuration.bindings,
      faultTrees: this.hclBatchFaultTreeTargets(hcl.faultTrees),
      eventTrees: [],
    });
    if (!relevance.faultTreeKeys.includes(hclTargetKey(request.faultTreeTopGate))) {
      if (relevance.constantMaskedFaultTreeKeys.includes(hclTargetKey(request.faultTreeTopGate))) {
        throw new BadRequestException(
          "Requested fault tree is structurally connected to varying evidence but its top event is masked by constant fault-tree logic",
        );
      }
      throw new BadRequestException(
        "Requested fault tree is not affected by evidence that varies across the selected scenarios",
      );
    }
    const targetKey = hclTargetKey(request.faultTreeTopGate);
    const batchContext: HclBatchRunContext = {
      evidenceScenarioIds: [...request.evidenceScenarioIds],
      varyingEvidenceNodeIds: relevance.varyingEvidenceNodeIds,
      affectedBayesianNetworkNodeIds: relevance.affectedBayesianNetworkNodeIds,
      relevantBindingIds: relevance.relevantBindingIds,
      targetKey,
      targetEvidenceNodeIds: relevance.faultTreeEvidenceNodeIds[targetKey] ?? [],
      ...(hazardGrid === null ? {} : { hazardGrid: structuredClone(hazardGrid) }),
    };
    const selected = hcl.faultTrees.find(
      ({ source, modelId }) =>
        source.workbookId === request.faultTreeTopGate.workbookId
        && modelId === request.faultTreeTopGate.modelId,
    );
    if (selected === undefined) {
      throw new BadRequestException("Requested fault tree is not declared by the HCL configuration");
    }
    const controlled = await this.resolveFaultTreeControlledDataSources([selected]);
    const sources = [
      owner,
      hcl.configurationOwner,
      hcl.bayesian,
      ...hcl.faultTrees.map(({ source }) => source),
      ...controlled.sources,
    ];
    await this.authorizeSources(sources, owner.workbookId, acting);
    const envelopeId = randomUUID();
    const faultTrees = combineFaultTrees(envelopeId, [
      adaptOrThrow(() =>
        adaptSyFaultTreeSnapshot(selected.source, selected.modelId, {
          controlledDataSourceValues: controlled.values,
        }),
      ),
    ]);
    const faultTreeBasicEventMembership = this.hclFaultTreeBasicEventMembership(hcl.faultTrees);
    const identity = { workbookId, modelId: request.modelId, workbookRevision: owner.workbookRevision };
    const prepared = resolvedScenarios.map(({ scenario, evidence }) => {
      const singleRequest: HclExecuteRequest = {
        schemaVersion: request.schemaVersion,
        modelId: request.modelId,
        workbookRevision: request.workbookRevision,
        faultTreeTopGate: request.faultTreeTopGate,
        evidenceScenarioId: scenario.id,
      };
      const runId = randomUUID();
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
          ...this.hclBindingContributionEntities(hcl.configurationOwner, hcl.configuration, hcl.faultTrees),
          ...this.hclEvidenceContributionEntities(hcl.configuration, evidence),
          ...controlled.references,
        ],
      );
      return {
        scenarioId: scenario.id,
        scenarioCode: scenario.code,
        scenarioName: scenario.name,
        runId,
        request: { ...singleRequest, batchContext } as unknown as Record<string, unknown>,
        trace,
      };
    });
    const executed = await this.executeHclBatchRuns(
      identity,
      "HYBRID_CAUSAL_LOGIC",
      prepared,
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
          evidenceBatch: resolvedScenarios.map(({ scenario, evidence }) => ({
            scenarioId: scenario.id,
            observations: evidence.observations,
            ...(hazardGrid === null ? {} : {
              hazardObservations: scenario.evidence.observations.filter((observation) =>
                hazardGrid.hazardNodeIds.includes(observation.nodeId)),
            }),
          })),
          ...(hazardGrid === null ? {} : {
            hazardConvolution: {
              gridName: hazardGrid.name,
              hazardNodeIds: hazardGrid.hazardNodeIds,
              annualFrequencyScale: hazardGrid.annualFrequencyScale,
              normalizeWeights: hazardGrid.normalizeWeights,
            },
          }),
        },
        modelSnapshots: [
          ...faultTrees.modelSnapshots,
          adaptOrThrow(() => this.adaptHclBayesianNetwork(hcl)),
          adaptOrThrow(() => this.adaptHclConfiguration(hcl, faultTreeBasicEventMembership)),
        ],
        resources: { faultTreeBasicEventCatalogue: faultTrees.resource },
      },
      "HYBRID_CAUSAL_LOGIC",
      acting,
    );
    if (hazardGrid !== null && executed.hazardConvolution === undefined) {
      throw new BadGatewayException("PRAXIS omitted the requested fault-tree hazard convolution");
    }
    return HclBatchExecuteResultSchema.parse({ schemaVersion: "1.0.0", ...executed });
  }

  async executeHclEventTreeBatch(
    workbookId: string,
    pathModelId: string,
    body: unknown,
    acting: ActingUser,
  ): Promise<HclBatchExecuteResult> {
    const request = parseRequest(HclEventTreeBatchExecuteRequestSchema, body);
    expectPathModel(pathModelId, request.modelId);
    const owner = await this.loadEsq(workbookId);
    await this.authorizeOwner(owner, request.workbookRevision, acting);
    const hcl = await this.loadHclSources(
      owner,
      request.modelId,
      request.dependencyConfiguration,
    );
    const configuration = hcl.configuration;
    const hazardGrid = this.resolveHclHazardGrid(configuration, request.integrateHazardGrid);
    const resolvedScenarios = request.evidenceScenarioIds.map((scenarioId) =>
      this.resolveHclEvidenceScenario(configuration, scenarioId)!,
    );
    const scenarios = resolvedScenarios.map(({ scenario }) => scenario);
    const eventTree = await this.loadEs(request.eventTree.workbookId);
    const eventTreeModelIds = this.eventTreeModelIds(eventTree, request.eventTree.modelId);
    const linked = await this.loadEventTreeFaultTrees(eventTree, request.eventTree.modelId);
    const relevance = resolveHclBatchTargetRelevance({
      bayesianNetwork: this.hclBatchBayesianNetwork(
        hcl.bayesian,
        configuration.bayesianNetwork.modelId,
      ),
      baseEvidence: configuration.baseEvidence,
      scenarios,
      bindings: configuration.bindings,
      faultTrees: this.hclBatchFaultTreeTargets(
        request.dependencyConfiguration === undefined ? hcl.faultTrees : linked,
      ),
      eventTrees: [{
        workbookId: request.eventTree.workbookId,
        modelId: request.eventTree.modelId,
        faultTrees: linked.map(({ source, modelId }) => ({ workbookId: source.workbookId, modelId })),
        transferTargets: [],
      }],
    });
    if (!relevance.eventTreeKeys.includes(hclTargetKey(request.eventTree))) {
      if (linked.some(({ source, modelId }) =>
        relevance.constantMaskedFaultTreeKeys.includes(`${source.workbookId}:${modelId}`))) {
        throw new BadRequestException(
          "Requested event tree is linked only through fault-tree targets masked by constant fault-tree logic",
        );
      }
      throw new BadRequestException(
        "Requested event tree is not affected by evidence that varies across the selected scenarios",
      );
    }
    const targetKey = hclTargetKey(request.eventTree);
    const batchContext: HclBatchRunContext = {
      evidenceScenarioIds: [...request.evidenceScenarioIds],
      varyingEvidenceNodeIds: relevance.varyingEvidenceNodeIds,
      affectedBayesianNetworkNodeIds: relevance.affectedBayesianNetworkNodeIds,
      relevantBindingIds: relevance.relevantBindingIds,
      targetKey,
      targetEvidenceNodeIds: relevance.eventTreeEvidenceNodeIds[targetKey] ?? [],
      ...(hazardGrid === null ? {} : { hazardGrid: structuredClone(hazardGrid) }),
    };
    const declared = new Set(
      hcl.configuration.faultTrees.map((reference) => `${reference.workbookId}:${reference.modelId}`),
    );
    const undeclared = request.dependencyConfiguration === undefined ? linked.find(
      ({ source, modelId }) => !declared.has(`${source.workbookId}:${modelId}`),
    ) : undefined;
    if (undeclared !== undefined) {
      throw new BadRequestException(
        `Event tree links fault tree '${undeclared.modelId}' that is not declared by the HCL configuration`,
      );
    }
    const controlled = await this.resolveFaultTreeControlledDataSources(linked);
    const sources = [
      owner,
      hcl.configurationOwner,
      hcl.bayesian,
      eventTree,
      ...linked.map(({ source }) => source),
      ...controlled.sources,
    ];
    await this.authorizeSources(sources, owner.workbookId, acting);
    const envelopeId = randomUUID();
    const faultTrees = combineFaultTrees(
      envelopeId,
      linked.map(({ source, modelId }) =>
        adaptOrThrow(() =>
          adaptSyFaultTreeSnapshot(source, modelId, {
            controlledDataSourceValues: controlled.values,
          }),
        ),
      ),
    );
    const faultTreeBasicEventMembership = this.hclFaultTreeBasicEventMembership(linked);
    const effectiveFaultTrees = linked.map(({ source, modelId }) => ({
      workbookId: source.workbookId,
      modelId,
    }));
    const identity = { workbookId, modelId: request.modelId, workbookRevision: owner.workbookRevision };
    const prepared = resolvedScenarios.map(({ scenario, evidence }) => {
      const singleRequest: HclEventTreeExecuteRequest = {
        schemaVersion: request.schemaVersion,
        modelId: request.modelId,
        workbookRevision: request.workbookRevision,
        eventTree: request.eventTree,
        ...(request.dependencyConfiguration === undefined
          ? {}
          : { dependencyConfiguration: request.dependencyConfiguration }),
        evidenceScenarioId: scenario.id,
      };
      const runId = randomUUID();
      const persistedRequest = {
        ...singleRequest,
        mode: "HYBRID_CAUSAL_LOGIC",
        batchContext,
      } as unknown as Record<string, unknown>;
      const trace = this.createAnalysisRunTrace(
        sources,
        {
          targetType: "HCL_EVENT_TREE",
          configuration: {
            workbookId: hcl.configurationOwner.workbookId,
            workbookRevision: hcl.configurationOwner.workbookRevision,
            modelId: hcl.configuration.modelId,
          },
          eventTree: {
            workbookId: eventTree.workbookId,
            workbookRevision: eventTree.workbookRevision,
            modelId: request.eventTree.modelId,
          },
          ...(hcl.configurationOwner.workbookId === owner.workbookId
            ? {}
            : { orchestrator: identity }),
        },
        [
          { workbookId: owner.workbookId, modelId: request.modelId },
          ...(hcl.configurationOwner.workbookId === owner.workbookId
            ? []
            : [{ workbookId: hcl.configurationOwner.workbookId, modelId: hcl.configuration.modelId }]),
          hcl.configuration.bayesianNetwork,
          ...eventTreeModelIds.map((modelId) => ({ workbookId: eventTree.workbookId, modelId })),
          ...linked.map(({ source, modelId }) => ({ workbookId: source.workbookId, modelId })),
        ],
        [
          ...this.hclBindingContributionEntities(hcl.configurationOwner, hcl.configuration, linked),
          ...this.hclEvidenceContributionEntities(hcl.configuration, evidence),
          ...this.eventTreeContributionEntities(eventTree, eventTreeModelIds),
          ...controlled.references,
        ],
      );
      return {
        scenarioId: scenario.id,
        scenarioCode: scenario.code,
        scenarioName: scenario.name,
        runId,
        request: persistedRequest,
        trace,
      };
    });
    const executed = await this.executeHclBatchRuns(
      identity,
      "EVENT_TREE",
      prepared,
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
          evidenceBatch: resolvedScenarios.map(({ scenario, evidence }) => ({
            scenarioId: scenario.id,
            observations: evidence.observations,
            ...(hazardGrid === null ? {} : {
              hazardObservations: scenario.evidence.observations.filter((observation) =>
                hazardGrid.hazardNodeIds.includes(observation.nodeId)),
            }),
          })),
          ...(hazardGrid === null ? {} : {
            hazardConvolution: {
              gridName: hazardGrid.name,
              hazardNodeIds: hazardGrid.hazardNodeIds,
              annualFrequencyScale: hazardGrid.annualFrequencyScale,
              normalizeWeights: hazardGrid.normalizeWeights,
            },
          }),
        },
        modelSnapshots: [
          ...eventTreeModelIds.map((eventTreeModelId) =>
            adaptOrThrow(() =>
              adaptEsEventTreeSnapshot(eventTree, eventTreeModelId, {
                workbookId: hcl.configurationOwner.workbookId,
                modelId: hcl.configuration.modelId,
              }),
            ),
          ),
          ...faultTrees.modelSnapshots,
          adaptOrThrow(() => this.adaptHclBayesianNetwork(hcl)),
          adaptOrThrow(() => this.adaptHclConfiguration(
            hcl,
            faultTreeBasicEventMembership,
            undefined,
            effectiveFaultTrees,
          )),
        ],
        resources: { faultTreeBasicEventCatalogue: faultTrees.resource },
      },
      "EVENT_TREE",
      acting,
    );
    if (hazardGrid !== null && executed.hazardConvolution === undefined) {
      throw new BadGatewayException("PRAXIS omitted the requested event-tree hazard convolution");
    }
    return HclBatchExecuteResultSchema.parse({ schemaVersion: "1.0.0", ...executed });
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
