import { WithWorkbookSnapshots, loadWorkbookSnapshot } from "./analysis-workbook-scope";
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { praetorJobFinished, type PraetorJobState } from "interfaces-shared-types/execution/praetor-job";
import { InjectModel } from "@nestjs/mongoose";
import { randomUUID } from "crypto";
import type { Model } from "mongoose";
import type { z } from "zod";
import { EventSequenceAnalysisSchema } from "interfaces-mef-types/zod/es/event-sequence-analysis";
import { EventSequenceQuantificationSchema } from "interfaces-mef-types/zod/esq/event-sequence-quantification";
import { SystemsAnalysisSchema } from "interfaces-mef-types/zod/sy/systems-analysis";
import { DataAnalysisSchema } from "interfaces-mef-types/zod/da/data-analysis";
import { HumanReliabilityAnalysisSchema } from "interfaces-mef-types/zod/hr/human-reliability-analysis";
import { SuccessCriteriaDevelopmentSchema } from "interfaces-mef-types/zod/sc/success-criteria-development";
import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { daCcfVectorParameter, type DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import type { HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
import type { SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import type { HclEventBinding, WorkbookBayesianNetwork, WorkbookHclConfiguration } from "interfaces-mef-types/modeling";
import { HclUncertaintySettingsSchema } from "interfaces-mef-types/zod/modeling";
import {
  AnalysisRunMetadataSchema,
  AnalysisRunFailureSchema,
  AnalysisRunDetailsSchema,
  AnalysisRunProvenanceListSchema,
  AnalysisRunProvenanceSchema,
  AnalysisRunJobListSchema,
  AnalysisRunTraceSchema,
  BayesianNetworkAnalysisResultSchema,
  BayesianNetworkBatchAnalysisResultSchema,
  BayesianNetworkStoredResultSchema,
  BayesianNetworkExecuteRequestSchema,
  EsqModelRunResultSchema,
  EsqPostRunResultSchema,
  EsqImportanceRunResultSchema,
  EsqUncertaintyRunResultSchema,
  EventTreeAnalysisResultSchema,
  EventTreeExecuteRequestSchema,
  EventTreeSequenceCutSetsSchema,
  FaultTreeAnalysisResultSchema,
  FaultTreeExecuteRequestSchema,
  HclExecuteRequestSchema,
  HclFaultTreeBatchExecuteRequestSchema,
  HclBatchExecuteResultSchema,
  HclBatchCompilationStatsSchema,
  HclGenerateScenariosRequestSchema,
  HclGenerateScenariosResultSchema,
  HclHazardConvolutionResultSchema,
  HCL_HAZARD_CONVOLUTION_POINT_ONLY,
  HclQuantificationResultSchema,
  HclSampleVectorsSchema,
  LoadCapacityAnalysisResultSchema,
  WorkbookModelIdSchema,
  createImmutableAnalysisRunContext,
} from "interfaces-shared-types/newly-developed-methods";
import type {
  AnalysisRunFailure,
  AnalysisRunMetadata,
  AnalysisRunProgress,
  AnalysisRunDetails,
  AnalysisRunFreshness,
  AnalysisRunContribution,
  AnalysisRunProvenanceList,
  AnalysisRunJobList,
  AnalysisRunTarget,
  AnalysisRunTrace,
  AnalysisRunWorkbookSnapshot,
  BayesianNetworkExecuteRequest,
  EsqBarrierCellRunRequest,
  EsqEventTreeRunRequest,
  EsqModelRunHcl,
  EsqModelRunRequest,
  EsqModelRunResult,
  EsqImportanceRunRequest,
  EsqImportanceRunResult,
  EsqUncertaintyRunRequest,
  EsqUncertaintyRunResult,
  EsqSensitivityRunRequest,
  EsqPostRunRequest,
  EsqPostRunResult,
  EventTreeAnalysisResult,
  EventTreeExecuteRequest,
  FaultTreeExecuteRequest,
  HclEventTreeExecuteRequest,
  HclEventTreeBatchExecuteRequest,
  HclExecuteRequest,
  HclCalculationType,
  HclBatchInput,
  HclFaultTreeBatchExecuteRequest,
  HclRunSampling,
  HclBatchExecuteResult,
  HclGenerateScenariosResult,
  HclHazardConvolutionResult,
  HclSampleVector,
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
import { ScWorkbook, type ScWorkbookDocument } from "../../sc-workbooks/sc-workbook.schema";
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
  adaptHclConfigurationSnapshot,
  adaptSyBayesianNetworkSnapshot,
  adaptSyFaultTreeSnapshot,
  collectEsEventTreeReferences,
  collectHclUncertaintyReferences,
  collectSyFaultTreeReferences,
  humanFailureEventKey,
  resolveUncertaintyTables,
  WorkbookPraxisAdapterError,
} from "./praxis-snapshot-adapters";
import type {
  AdaptedFaultTreeSnapshot,
  CatalogueBasicEvent,
  CatalogueCcfGroup,
  FaultTreeBasicEventCatalogue,
  PraxisModelSnapshot,
  UncertaintyReferences,
  UncertaintySources,
  UncertaintyTables,
  WorkbookMefSnapshot,
} from "./praxis-snapshot-adapters";
import {
  expressionReferences,
  parameterReferenceKey,
  type UncertainExpression,
  type UncertainParameter,
  type UncertainVectorParameter,
} from "interfaces-mef-types/core/uncertainty";
import type { HumanFailureEventReference, WorkbookParameterReference } from "interfaces-mef-types/modeling/references";
import { parameterLaw } from "interfaces-mef-types/esq/esq-measure-inputs";
import { esqParameterRecord } from "interfaces-mef-types/esq/esq-run-inputs";
import type { EsqRunStandIn } from "../../esq-workbooks/esq-model-run-builder";
import { PraetorAnalysisClient, type PraetorNativeResponse } from "./praetor-analysis.client";
import { describeRunChange, jsonOf, type ChangedSource } from "./analysis-run-changes";
import { storedWorkbookRejection } from "../../workbooks/stored-workbook-format";

const TRACK_FIRST_POLL_MS = 150;
const TRACK_POLL_MS = 1_500;
const TRACK_HEARTBEAT_MS = 10_000;
const ORPHAN_SWEEP_MS = 30_000;
const ORPHAN_AFTER_MS = 120_000;
const LEGACY_ORPHAN_AFTER_MS = 30 * 60_000;
const RUN_CHANGE_CACHE = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ActingUser {
  username: string;
}

export interface LoadedWorkbook<TMef> extends WorkbookMefSnapshot<TMef> {
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
    faultTreeBasicEventCatalogue?: FaultTreeBasicEventCatalogue;
  };
}

interface FaultTreeBundle {
  modelSnapshots: PraxisModelSnapshot[];
  resource: FaultTreeBasicEventCatalogue;
}

interface FaultTreeInputs {
  parameters: ReadonlyMap<string, UncertainParameter>;
  vectors: ReadonlyMap<string, UncertainVectorParameter>;
  humanFailureEvents: ReadonlyMap<string, UncertainExpression>;
  sources: LoadedWorkbook<unknown>[];
  references: WorkbookCrossReference[];
}

interface HclBatchRunContext {
  evidenceScenarioIds: string[];
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

export type HclConfigurationOwner =
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
  batchId: string;
  runs: HclBatchExecuteResult["runs"];
  compilationReuse?: HclBatchExecuteResult["compilationReuse"];
  hazardConvolution?: HclHazardConvolutionResult;
}

export type EsqBatchSummary = EsqModelRunResult | EsqPostRunResult | EsqImportanceRunResult | EsqUncertaintyRunResult;

export interface EsqPreparedTreeRun {
  treeId: string;
  label: string;
  runId: string;
  owner: WorkbookModelSnapshotIdentity;
  request: Record<string, unknown>;
  envelope: SolverEnvelope | null;
  failure: string | null;
  models: WorkbookModelAddress[];
}

export interface EsqModelHcl {
  sources: HclConfigurationOwner[];
  configurationId: string;
  configurationWorkbookId: string;
  network: WorkbookModelAddress;
  covers: (syWorkbookId: string, syModelIds: readonly string[], standIns: readonly EsqRunStandIn[]) => boolean;
  augment: (envelope: SolverEnvelope, syWorkbookId: string, syModelIds: readonly string[], standIns: readonly EsqRunStandIn[], evidence?: WorkbookHclConfiguration["baseEvidence"]) => SolverEnvelope;
  entities: (envelope: SolverEnvelope, syWorkbookId: string, syModelIds: readonly string[], standIns: readonly EsqRunStandIn[], evidence: WorkbookHclConfiguration["baseEvidence"]) => WorkbookCrossReference[];
}

export type EsqDependencySource = HclConfigurationOwner | LoadedWorkbook<SuccessCriteriaDevelopment> | LoadedWorkbook<DataAnalysis>;

export interface EsqDependencyTreeBuild {
  rootModelId: string;
  envelope: SolverEnvelope;
  syWorkbookId: string;
  syModelIds: string[];
  standIns: EsqRunStandIn[];
  models: WorkbookModelAddress[];
  sources: EsqDependencySource[];
}

export interface EsqTreeRunOutcome {
  treeId: string;
  runId: string;
  status: "SUCCEEDED" | "FAILED";
  result: EventTreeAnalysisResult | null;
  failure: string | null;
}

type PublicResultKind = "FAULT_TREE" | "BAYESIAN_NETWORK" | "EVENT_TREE" | "HYBRID_CAUSAL_LOGIC" | "LOAD_CAPACITY";


const parseRequest = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new BadRequestException(parsed.error.message);
  return parsed.data;
};

const humanFailureExpression = (hr: HumanReliabilityAnalysis, reference: HumanFailureEventReference): UncertainExpression => {
  const events = hr.humanFailureEvents.filter((event) => event.uuid === reference.entityId);
  if (events.length !== 1) {
    throw new BadRequestException(
      `HRA human-failure event '${reference.workbookId}:${reference.entityId}' resolved ${events.length} times; expected exactly once`,
    );
  }
  const quantifications = hr.hepQuantifications.filter((quantification) => quantification.uuid === reference.quantificationId);
  const [quantification] = quantifications;
  if (quantifications.length !== 1 || quantification === undefined) {
    throw new BadRequestException(
      `HRA HEP quantification '${reference.workbookId}:${reference.quantificationId}' resolved ${quantifications.length} times; expected exactly once`,
    );
  }
  if (quantification.hfeId !== reference.entityId) {
    throw new BadRequestException(
      `HRA HEP quantification '${reference.workbookId}:${reference.quantificationId}' does not quantify human-failure event '${reference.entityId}'`,
    );
  }
  if (quantification.hep === undefined) {
    throw new BadRequestException(
      `HRA HEP quantification '${reference.workbookId}:${reference.quantificationId}' has no HEP. Give it a law or a DA link in HR.`,
    );
  }
  return quantification.hep;
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

const withRunSampling = (hcl: LoadedHclSources, sampling: HclRunSampling | undefined): LoadedHclSources => {
  if (sampling === undefined) return hcl;
  const stored = hcl.configuration.solverSettings.uncertainty;
  const laws = stored === undefined ? undefined : HclUncertaintySettingsSchema.safeParse(stored);
  if (laws !== undefined && !laws.success) {
    throw new BadRequestException(`The uncertainty laws of dependency configuration '${hcl.configuration.code}' need review in the linked SY workbook. ${laws.error.issues[0]?.message ?? ""}`.trim());
  }
  return {
    ...hcl,
    configuration: {
      ...hcl.configuration,
      solverSettings: {
        ...hcl.configuration.solverSettings,
        uncertainty: {
          ...sampling,
          basicEvents: laws?.success === true ? laws.data.basicEvents : [],
          cptRows: laws?.success === true ? laws.data.cptRows : [],
          cptGenerators: laws?.success === true ? laws.data.cptGenerators : [],
        },
      },
    },
  };
};

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const finishedStatuses: ReadonlySet<string> = new Set(["SUCCEEDED", "FAILED"]);

interface RunOutcome {
  status: "SUCCEEDED" | "FAILED" | "CANCELLED" | "SKIPPED";
  completedAt: Date;
  engine: AnalysisRunMetadata["engine"];
  failure: AnalysisRunFailure | null;
  result: object | null;
  sampleVectors?: HclSampleVector[];
}

const toRunMetadata = (run: AnalysisRunRecord | AnalysisRunRecordDocument): AnalysisRunMetadata =>
  AnalysisRunMetadataSchema.parse({
    schemaVersion: run.schemaVersion,
    id: run.id,
    owner: run.owner,
    sourceWorkbooks: run.sourceWorkbooks,
    methodType: run.methodType,
    scope: run.scope ?? "SINGLE",
    batchId: run.batchId ?? null,
    status: run.status,
    requestedBy: run.requestedBy,
    requestedAt: iso(run.requestedAt),
    startedAt: run.startedAt === null ? (finishedStatuses.has(run.status) ? iso(run.requestedAt) : null) : iso(run.startedAt),
    completedAt: run.completedAt === null ? null : iso(run.completedAt),
    engine: run.status === "QUEUED" ? null : run.engine,
    failure: run.failure,
    ...(run.progress === undefined || run.progress === null ? {} : { progress: run.progress }),
  });

const uniqueWorkbooks = <T extends LoadedWorkbook<unknown>>(values: T[]): T[] => {
  const byId = new Map<string, T>();
  values.forEach((value) => {
    const previous = byId.get(value.workbookId);
    if (previous !== undefined && (previous.hostType !== value.hostType || previous.workbookRevision !== value.workbookRevision)) {
      throw new ConflictException("A source workbook changed while preparing the run. Retry with one consistent snapshot.");
    }
    byId.set(value.workbookId, value);
  });
  return [...byId.values()];
};

const crossReferenceKey = (reference: WorkbookCrossReference): string =>
  JSON.stringify(Object.fromEntries(Object.entries(reference).sort(([left], [right]) => left.localeCompare(right))));

const mergeEntry = <T>(target: Map<string, T>, key: string, value: T, conflict: string): void => {
  const prior = target.get(key);
  if (prior !== undefined && JSON.stringify(prior) !== JSON.stringify(value)) throw new BadRequestException(conflict);
  target.set(key, value);
};

const NO_TABLES: UncertaintyTables = { uncertaintyParameters: [], uncertaintyVectors: [] };

export const combineFaultTrees = (
  runId: string,
  adapters: AdaptedFaultTreeSnapshot[],
  extra: UncertaintyTables = NO_TABLES,
): FaultTreeBundle => {
  const catalogueId = `run:${runId}`;
  const basicEvents = new Map<string, CatalogueBasicEvent>();
  const commonCauseFailureGroups = new Map<string, CatalogueCcfGroup>();
  const uncertaintyParameters = new Map<string, UncertainParameter>();
  const uncertaintyVectors = new Map<string, UncertainVectorParameter>();
  const modelSnapshots = adapters.map((adapter) => ({
    ...adapter.modelSnapshot,
    projectId: catalogueId,
  }));
  const mergeTables = (tables: UncertaintyTables): void => {
    tables.uncertaintyParameters.forEach((parameter) => {
      const key = parameterReferenceKey(parameter.reference);
      mergeEntry(uncertaintyParameters, key, parameter, `Parameter '${key}' has conflicting estimates across contributing workbooks`);
    });
    tables.uncertaintyVectors.forEach((vector) => {
      const key = parameterReferenceKey(vector.reference);
      mergeEntry(uncertaintyVectors, key, vector, `Vector parameter '${key}' has conflicting estimates across contributing workbooks`);
    });
  };
  adapters.forEach(({ basicEventCatalogue: catalogue }) => {
    catalogue.basicEvents.forEach((event) =>
      mergeEntry(basicEvents, event.id, event, `Basic event '${event.id}' has conflicting values across contributing workbooks`),
    );
    catalogue.commonCauseFailureGroups.forEach((group) =>
      mergeEntry(commonCauseFailureGroups, group.id, group, `CCF group '${group.id}' has conflicting values across contributing workbooks`),
    );
    mergeTables(catalogue);
  });
  mergeTables(extra);
  return {
    modelSnapshots,
    resource: {
      projectId: catalogueId,
      basicEvents: [...basicEvents.values()],
      commonCauseFailureGroups: [...commonCauseFailureGroups.values()],
      uncertaintyParameters: [...uncertaintyParameters.values()],
      uncertaintyVectors: [...uncertaintyVectors.values()],
    },
  };
};

@Injectable()
export class WorkbookAnalysisRunsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkbookAnalysisRunsService.name);
  private readonly runChanges = new Map<string, string | null>();
  private sweeper: NodeJS.Timeout | null = null;

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
    @InjectModel(ScWorkbook.name)
    private readonly scWorkbookModel: Model<ScWorkbookDocument>,
    private readonly accessService: WorkbookModelAccessService,
    private readonly projectsService: ProjectsService,
    private readonly praetor: PraetorAnalysisClient,
  ) {}

  private async loadSy(workbookId: string): Promise<LoadedWorkbook<SystemsAnalysis>> {
    return loadWorkbookSnapshot(`SY:${workbookId}`, async () => {
      const document = await this.syWorkbookModel.findOne({ workbookId }).exec();
      if (!document) throw new NotFoundException("SY workbook not found");
      const parsed = SystemsAnalysisSchema.safeParse(stripNulls(document.mef));
      if (!parsed.success)
        throw storedWorkbookRejection("SY", workbookId, parsed.error.message);
      return {
        hostType: "SY",
        workbookId,
        workbookRevision: readWorkbookRevision(document),
        projectId: document.projectId,
        ownerUsername: document.ownerUsername,
        mef: parsed.data,
        document,
      };
    });
  }

  private async loadEs(workbookId: string): Promise<LoadedWorkbook<EventSequenceAnalysis>> {
    return loadWorkbookSnapshot(`ES:${workbookId}`, async () => {
      const document = await this.esWorkbookModel.findOne({ workbookId }).exec();
      if (!document) throw new NotFoundException("ES workbook not found");
      const parsed = EventSequenceAnalysisSchema.safeParse(stripNulls(document.mef));
      if (!parsed.success)
        throw storedWorkbookRejection("ES", workbookId, parsed.error.message);
      return {
        hostType: "ES",
        workbookId,
        workbookRevision: readWorkbookRevision(document),
        projectId: document.projectId,
        ownerUsername: document.ownerUsername,
        mef: parsed.data,
        document,
      };
    });
  }

  private async loadEsq(workbookId: string): Promise<LoadedWorkbook<EventSequenceQuantification>> {
    return loadWorkbookSnapshot(`ESQ:${workbookId}`, async () => {
      const document = await this.esqWorkbookModel.findOne({ workbookId }).exec();
      if (!document) throw new NotFoundException("ESQ workbook not found");
      const parsed = EventSequenceQuantificationSchema.safeParse(normalizeEsqMef(document.mef));
      if (!parsed.success)
        throw storedWorkbookRejection("ESQ", workbookId, parsed.error.message);
      return {
        hostType: "ESQ",
        workbookId,
        workbookRevision: readWorkbookRevision(document),
        projectId: document.projectId,
        ownerUsername: document.ownerUsername,
        mef: parsed.data,
        document,
      };
    });
  }

  private async loadDa(workbookId: string): Promise<LoadedWorkbook<DataAnalysis>> {
    return loadWorkbookSnapshot(`DA:${workbookId}`, async () => {
      const document = await this.daWorkbookModel.findOne({ workbookId }).exec();
      if (!document) throw new NotFoundException("DA workbook not found");
      const parsed = DataAnalysisSchema.safeParse(stripNulls(document.mef));
      if (!parsed.success) {
        throw storedWorkbookRejection("DA", workbookId, parsed.error.message);
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
    });
  }

  private async loadHr(workbookId: string): Promise<LoadedWorkbook<HumanReliabilityAnalysis>> {
    return loadWorkbookSnapshot(`HRA:${workbookId}`, async () => {
      const document = await this.hrWorkbookModel.findOne({ workbookId }).exec();
      if (!document) throw new NotFoundException("HRA workbook not found");
      const parsed = HumanReliabilityAnalysisSchema.safeParse(stripNulls(document.mef));
      if (!parsed.success) {
        throw storedWorkbookRejection("HRA", workbookId, parsed.error.message);
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
    });
  }

  private async loadSc(workbookId: string): Promise<LoadedWorkbook<SuccessCriteriaDevelopment>> {
    return loadWorkbookSnapshot(`SC:${workbookId}`, async () => {
      const document = await this.scWorkbookModel.findOne({ workbookId }).exec();
      if (!document) throw new NotFoundException("SC workbook not found");
      const parsed = SuccessCriteriaDevelopmentSchema.safeParse(stripNulls(document.mef));
      if (!parsed.success) {
        throw storedWorkbookRejection("SC", workbookId, parsed.error.message);
      }
      return {
        hostType: "SC",
        workbookId,
        workbookRevision: 1,
        projectId: document.projectId,
        ownerUsername: document.ownerUsername,
        mef: parsed.data,
        document: { mef: document.mef },
      };
    });
  }

  private async resolveParameterSource(
    reference: WorkbookParameterReference,
  ): Promise<{ kind: "DA"; workbook: LoadedWorkbook<DataAnalysis> } | { kind: "SC"; workbook: LoadedWorkbook<SuccessCriteriaDevelopment> }> {
    const [da, sc] = await Promise.all([
      this.daWorkbookModel.exists({ workbookId: reference.workbookId }).exec(),
      this.scWorkbookModel.exists({ workbookId: reference.workbookId }).exec(),
    ]);
    if (da === null && sc === null) {
      throw new BadRequestException(
        `Workbook '${reference.workbookId}' is neither a DA nor an SC workbook. Relink '${reference.entityId}' explicitly before running.`,
      );
    }
    if (da === null) return { kind: "SC", workbook: await this.loadSc(reference.workbookId) };
    return { kind: "DA", workbook: await this.resolveDaControlledDataSource(reference) };
  }

  private async resolveDaControlledDataSource(
    reference: Extract<WorkbookCrossReference, { referenceType: "WORKBOOK_PARAMETER" }>,
  ): Promise<LoadedWorkbook<DataAnalysis>> {
    try {
      return await this.loadDa(reference.workbookId);
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
      throw new BadRequestException(
        `DA source workbook '${reference.workbookId}' is missing. Relink parameter '${reference.entityId}' explicitly before running.`,
      );
    }
  }

  private async resolveHrControlledDataSource(
    reference: Extract<WorkbookCrossReference, { referenceType: "HUMAN_FAILURE_EVENT" }>,
  ): Promise<LoadedWorkbook<HumanReliabilityAnalysis>> {
    try {
      return await this.loadHr(reference.workbookId);
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
      throw new BadRequestException(
        `HRA source workbook '${reference.workbookId}' is missing. Relink event '${reference.entityId}' explicitly before running.`,
      );
    }
  }

  private async resolveFaultTreeInputs(
    faultTrees: Array<{ source: LoadedWorkbook<SystemsAnalysis>; modelId: string }>,
    extra: Array<{ projectId: string; references: UncertaintyReferences }> = [],
  ): Promise<FaultTreeInputs> {
    const projectOf = new Map<string, string>();
    const claim = (key: string, projectId: string, label: string): void => {
      const existing = projectOf.get(key);
      if (existing !== undefined && existing !== projectId) {
        throw new BadRequestException(`Controlled data source '${label}' is referenced from multiple projects`);
      }
      projectOf.set(key, projectId);
    };
    const pending: WorkbookParameterReference[] = [];
    const vectorReferences = new Map<string, WorkbookParameterReference>();
    const humanReferences = new Map<string, HumanFailureEventReference>();
    const collect = (projectId: string, references: UncertaintyReferences): void => {
      for (const reference of references.parameterReferences) {
        claim(parameterReferenceKey(reference), projectId, `${reference.workbookId}:${reference.entityId}`);
        pending.push(reference);
      }
      for (const reference of references.vectorReferences) {
        const key = parameterReferenceKey(reference);
        claim(key, projectId, `${reference.workbookId}:${reference.entityId}`);
        vectorReferences.set(key, {
          referenceType: "WORKBOOK_PARAMETER",
          workbookId: reference.workbookId,
          entityId: reference.entityId,
        });
      }
    };
    for (const { source, modelId } of faultTrees) {
      const collected = adaptOrThrow(() => collectSyFaultTreeReferences(source, modelId));
      collect(source.projectId, collected);
      for (const reference of collected.humanFailureReferences) {
        const key = humanFailureEventKey(reference);
        claim(key, source.projectId, `${reference.workbookId}:${reference.entityId}`);
        humanReferences.set(key, reference);
      }
    }
    extra.forEach(({ projectId, references }) => collect(projectId, references));
    const daWorkbooks = new Map<string, LoadedWorkbook<DataAnalysis>>();
    const scWorkbooks = new Map<string, LoadedWorkbook<SuccessCriteriaDevelopment>>();
    const hrWorkbooks = new Map<string, LoadedWorkbook<HumanReliabilityAnalysis>>();
    const daFor = async (reference: WorkbookParameterReference): Promise<LoadedWorkbook<DataAnalysis>> => {
      const cached = daWorkbooks.get(reference.workbookId);
      if (cached !== undefined) return cached;
      const loaded = await this.resolveDaControlledDataSource(reference);
      daWorkbooks.set(reference.workbookId, loaded);
      return loaded;
    };
    const humanFailureEvents = new Map<string, UncertainExpression>();
    for (const [key, reference] of humanReferences) {
      const cached = hrWorkbooks.get(reference.workbookId);
      const workbook = cached ?? await this.resolveHrControlledDataSource(reference);
      hrWorkbooks.set(reference.workbookId, workbook);
      const expression = humanFailureExpression(workbook.mef, reference);
      humanFailureEvents.set(key, expression);
      for (const nested of expressionReferences(expression)) {
        claim(parameterReferenceKey(nested), workbook.projectId, `${nested.workbookId}:${nested.entityId}`);
        pending.push(nested);
      }
    }
    const sourceKinds = new Map<string, "DA" | "SC">();
    const parameterExpression = async (reference: WorkbookParameterReference): Promise<UncertainExpression> => {
      let kind = sourceKinds.get(reference.workbookId);
      if (kind === undefined) {
        const source = await this.resolveParameterSource(reference);
        kind = source.kind;
        sourceKinds.set(reference.workbookId, kind);
        if (source.kind === "SC") scWorkbooks.set(reference.workbookId, source.workbook);
        else daWorkbooks.set(reference.workbookId, source.workbook);
      }
      const scWorkbook = scWorkbooks.get(reference.workbookId);
      if (kind === "SC" && scWorkbook !== undefined) {
        const matches = [...scWorkbook.mef.missionTimes, ...(scWorkbook.mef.componentMissionTimes ?? [])].filter((entry) => entry.uuid === reference.entityId);
        const [match] = matches;
        if (matches.length !== 1 || match === undefined) {
          throw new BadRequestException(
            `SC mission time '${reference.workbookId}:${reference.entityId}' resolved ${matches.length} times; expected exactly once`,
          );
        }
        return match.missionTime;
      }
      const factor = (await daFor(reference)).mef.ccfFactors?.find((entry) => entry.id === reference.entityId);
      if (factor !== undefined) return factor.expression;
      const parameter = await daParameter(reference);
      const law = parameterLaw(esqParameterRecord(parameter));
      if (law === undefined) {
        throw new BadRequestException(
          `DA parameter '${reference.workbookId}:${reference.entityId}' has no estimate. Give it a value in DA.`,
        );
      }
      return law;
    };
    const daParameter = async (reference: WorkbookParameterReference): Promise<DataAnalysis["parameters"][number]> => {
      const workbook = await daFor(reference);
      const matches = workbook.mef.parameters.filter((parameter) => parameter.uuid === reference.entityId);
      const [match] = matches;
      if (matches.length !== 1 || match === undefined) {
        throw new BadRequestException(
          `DA parameter '${reference.workbookId}:${reference.entityId}' resolved ${matches.length} times; expected exactly once`,
        );
      }
      return match;
    };
    const daCcfVector = async (reference: WorkbookParameterReference): Promise<NonNullable<DataAnalysis["ccfVectors"]>[number]> => {
      const workbook = await daFor(reference);
      const matches = (workbook.mef.ccfVectors ?? []).filter((vector) => vector.id === reference.entityId);
      const [match] = matches;
      if (matches.length !== 1 || match === undefined) {
        throw new BadRequestException(
          `DA common cause vector '${reference.workbookId}:${reference.entityId}' resolved ${matches.length} times; expected exactly once`,
        );
      }
      return match;
    };
    const parameters = new Map<string, UncertainParameter>();
    const parameterReferences = new Map<string, WorkbookParameterReference>();
    for (let reference = pending.pop(); reference !== undefined; reference = pending.pop()) {
      const key = parameterReferenceKey(reference);
      if (parameters.has(key)) continue;
      const expression = await parameterExpression(reference);
      const qualified: WorkbookParameterReference = {
        referenceType: "WORKBOOK_PARAMETER",
        workbookId: reference.workbookId,
        entityId: reference.entityId,
      };
      parameterReferences.set(key, qualified);
      parameters.set(key, { reference: qualified, expression });
      pending.push(...expressionReferences(expression));
    }
    const vectors = new Map<string, UncertainVectorParameter>();
    for (const [key, reference] of vectorReferences) {
      vectors.set(key, daCcfVectorParameter(reference.workbookId, await daCcfVector(reference)));
    }
    return {
      parameters,
      vectors,
      humanFailureEvents,
      sources: uniqueWorkbooks([...daWorkbooks.values(), ...scWorkbooks.values(), ...hrWorkbooks.values()]),
      references: [...parameterReferences.values(), ...vectorReferences.values(), ...humanReferences.values()],
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
      projectId: source.projectId,
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
  ): object {
    const raw = asRecord(rawValue, kind.toLowerCase());
    const common = { schemaVersion: "1.0.0", runId, owner, completedAt };
    if (kind === "FAULT_TREE") {
      return FaultTreeAnalysisResultSchema.parse({
        ...common,
        topGateId: raw["topGateId"],
        topEventProbability: raw["topEventProbability"],
        ...(raw["calculationType"] === undefined ? {} : { calculationType: raw["calculationType"] }),
        ...(raw["workflow"] === undefined ? {} : { workflow: raw["workflow"] }),
        ...(raw["algorithm"] === undefined ? {} : { algorithm: raw["algorithm"] }),
        ...(raw["settings"] === undefined ? {} : { settings: raw["settings"] }),
        ...(raw["probabilityMethod"] === undefined ? {} : { probabilityMethod: raw["probabilityMethod"] }),
        ...(raw["cutSets"] === undefined ? {} : { cutSets: raw["cutSets"] }),
        ...(raw["importance"] === undefined ? {} : { importance: raw["importance"] }),
        ...(raw["uncertainty"] === undefined ? {} : { uncertainty: raw["uncertainty"] }),
        ...(raw["monteCarlo"] === undefined ? {} : { monteCarlo: raw["monteCarlo"] }),
        ...(raw["sil"] === undefined ? {} : { sil: raw["sil"] }),
        basicEventQuantifications: raw["basicEventQuantifications"],
        validationIssues: raw["validationIssues"] ?? [],
      });
    }
    if (kind === "BAYESIAN_NETWORK") {
      if (Array.isArray(raw["scenarios"])) {
        return BayesianNetworkBatchAnalysisResultSchema.parse({
          ...common,
          queryNodeIds: raw["queryNodeIds"],
          scenarios: raw["scenarios"].map((value: unknown) => {
            const row = asRecord(value, "Bayesian scenario");
            return {
              ...row,
              result:
                row["result"] === null ?
                  null
                : {
                    ...asRecord(row["result"], "Bayesian scenario result"),
                    ...common,
                  },
            };
          }),
          diagnostics: raw["diagnostics"],
        });
      }
      return BayesianNetworkAnalysisResultSchema.parse({
        ...common,
        evidence: raw["evidence"],
        marginals: raw["marginals"],
        validationIssues: raw["validationIssues"] ?? [],
      });
    }
    if (kind === "LOAD_CAPACITY") {
      return LoadCapacityAnalysisResultSchema.parse({
        ...common,
        method: raw["method"],
        pointProbability: raw["pointProbability"],
        pointLoad: raw["pointLoad"],
        pointCapacity: raw["pointCapacity"],
        unit: raw["unit"] ?? null,
        uncertainty: raw["uncertainty"] ?? null,
        curve: raw["curve"],
        validationIssues: raw["validationIssues"] ?? [],
      });
    }
    if (kind === "EVENT_TREE") {
      return EventTreeAnalysisResultSchema.parse({
        ...common,
        mode: raw["mode"],
        sequences: this.probabilitySequences(raw["sequences"]),
        endStateAggregates: raw["endStateAggregates"],
        frequencySemantics: raw["frequencySemantics"],
        ...(raw["compilationReuse"] === undefined ? {} : { compilationReuse: raw["compilationReuse"] }),
        ...(raw["cutSetAnalysis"] === undefined ? {} : { cutSetAnalysis: raw["cutSetAnalysis"] }),
        ...(raw["families"] === undefined ? {} : { families: raw["families"] }),
        ...(raw["importance"] === undefined ? {} : { importance: raw["importance"] }),
        ...(raw["sampling"] === undefined ? {} : { sampling: raw["sampling"] }),
        ...(raw["monteCarlo"] === undefined ? {} : { monteCarlo: raw["monteCarlo"] }),
        validationIssues: raw["validationIssues"] ?? [],
      });
    }
    const hclResult: Record<string, unknown> = {
      ...common,
      faultTreeTopGate: request["faultTreeTopGate"],
      probability: raw["probability"],
      bddNodes: raw["bddNodes"],
      bddVariables: raw["bddVariables"],
      variableOrder: raw["variableOrder"],
      bridge: raw["bridge"],
      ...(raw["compilationReuse"] === undefined ? {} : { compilationReuse: raw["compilationReuse"] }),
      junctionTree: raw["junctionTree"],
      basicEventQuantifications: raw["basicEventQuantifications"],
      validationIssues: raw["validationIssues"] ?? [],
    };
    if (raw["uncertainty"] != null) hclResult["uncertainty"] = raw["uncertainty"];
    return HclQuantificationResultSchema.parse(hclResult);
  }

  private withoutUnavailableAnalyses(value: unknown): Record<string, unknown> {
    const result = { ...asRecord(value, "analysis result") };
    delete result["minimalCutSetCount"];
    delete result["leadingCutSets"];
    if (result["calculationType"] === undefined || result["algorithm"] === undefined) {
      delete result["cutSets"];
      delete result["importance"];
    }
    return result;
  }

  private probabilitySequences(value: unknown): unknown {
    return Array.isArray(value) ? value.map((sequence) => this.eventTreeSequence(sequence)) : value;
  }

  private eventTreeSequence(value: unknown): Record<string, unknown> {
    const result = this.withoutUnavailableAnalyses(value);
    const cutSets = EventTreeSequenceCutSetsSchema.safeParse(asRecord(value, "event-tree sequence")["cutSets"]);
    if (cutSets.success) result["cutSets"] = cutSets.data;
    return result;
  }

  onModuleInit(): void {
    this.sweeper = setInterval(() => {
      void this.sweepOrphans().catch((error: Error) => this.logger.error(`Run sweep failed: ${error.message}`));
    }, ORPHAN_SWEEP_MS);
    this.sweeper.unref();
  }

  onModuleDestroy(): void {
    if (this.sweeper !== null) clearInterval(this.sweeper);
  }

  private async sweepOrphans(): Promise<void> {
    const now = Date.now();
    const stale = await this.runModel
      .find({
        status: { $in: ["QUEUED", "RUNNING"] },
        $or: [
          { trackedAt: { $lt: new Date(now - ORPHAN_AFTER_MS) } },
          { trackedAt: null, requestedAt: { $lt: new Date(now - LEGACY_ORPHAN_AFTER_MS) } },
        ],
      })
      .select({ id: 1, praetorJobs: 1 })
      .lean()
      .exec();
    for (const run of stale) {
      await Promise.all((run.praetorJobs ?? []).map((jobId) => this.praetor.cancel(jobId).catch(() => undefined)));
      await this.failRuns([run.id], {
        kind: "BACKEND",
        code: "RUN_INTERRUPTED",
        message: "The server stopped following this run before it finished, for example after a restart. Run it again.",
        details: {},
      });
    }
  }

  private queuedProgress(unit: AnalysisRunProgress["unit"], total: number): AnalysisRunProgress {
    return { stage: "QUEUED", unit, completed: 0, total, queuedJobs: null, workers: null };
  }

  private transportFailure(error: Error | string): AnalysisRunFailure {
    const message = error instanceof Error ? error.message : error;
    return { kind: "TRANSPORT", code: "PRAETOR_UNAVAILABLE", message, details: {} };
  }

  private async metadataOf(id: string): Promise<AnalysisRunMetadata> {
    const record = await this.runModel.findOne({ id }).exec();
    if (record === null) throw new NotFoundException(`Analysis run ${id} was not found`);
    return toRunMetadata(record);
  }

  private async markStarted(ids: readonly string[]): Promise<void> {
    await this.runModel
      .updateMany({ id: { $in: [...ids] }, status: "QUEUED" }, { $set: { status: "RUNNING", startedAt: new Date() } })
      .exec();
  }

  private async finishRuns(ids: readonly string[], outcome: RunOutcome): Promise<void> {
    const active = { id: { $in: [...ids] }, status: { $in: ["QUEUED", "RUNNING"] } };
    if (outcome.status === "SUCCEEDED" || outcome.status === "FAILED") {
      await this.runModel.updateMany({ ...active, startedAt: null }, { $set: { startedAt: outcome.completedAt } }).exec();
    }
    await this.runModel
      .updateMany(active, {
        $set: {
          status: outcome.status,
          completedAt: outcome.completedAt,
          engine: outcome.status === "CANCELLED" || outcome.status === "SKIPPED" ? null : outcome.engine,
          failure: outcome.status === "FAILED" ? outcome.failure : null,
          result: outcome.status === "SUCCEEDED" || outcome.status === "SKIPPED" ? outcome.result : null,
          ...(outcome.status === "SUCCEEDED" && outcome.sampleVectors !== undefined ? { sampleVectors: outcome.sampleVectors } : {}),
          progress: null,
        },
      })
      .exec();
  }

  private keptSamples(result: PraetorNativeResponse["result"]): { sampleVectors?: HclSampleVector[] } {
    const vectors = result?.["sampleVectors"];
    if (vectors === undefined) return {};
    const parsed = HclSampleVectorsSchema.safeParse(vectors);
    if (!parsed.success) throw new BadGatewayException("PRAXIS returned invalid sample vectors");
    return { sampleVectors: parsed.data };
  }

  private async failRuns(ids: readonly string[], failure: AnalysisRunFailure): Promise<void> {
    await this.finishRuns(ids, { status: "FAILED", completedAt: new Date(), engine: null, failure, result: null });
  }

  private async jobResponse(jobId: string, state: PraetorJobState): Promise<PraetorNativeResponse> {
    if (state.status === "CANCELLED") {
      return {
        schemaVersion: "1.0.0",
        error: { kind: "EXECUTION_ERROR", code: "RUN_CANCELLED", message: "The run was cancelled before PRAXIS finished it.", details: { jobId } },
      };
    }
    return this.praetor.result(jobId);
  }

  private track(ids: readonly string[], jobs: () => readonly string[], work: () => Promise<void>): void {
    void work().catch(async (error: Error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Run ${ids[0] ?? ""} failed while it was followed: ${message}`);
      await Promise.all(jobs().map((jobId) => this.praetor.cancel(jobId).catch(() => undefined)));
      await this.failRuns(ids, { kind: "BACKEND", code: "RUN_FOLLOW_FAILED", message: `The server could not finish this run: ${message}`, details: {} }).catch(
        (stored: Error) => this.logger.error(`Run ${ids[0] ?? ""} failure could not be stored: ${stored.message}`),
      );
    });
  }

  private async followJobs(input: {
    progressId: string;
    ids: () => readonly string[];
    jobs: readonly string[];
    unit: AnalysisRunProgress["unit"];
    total: number;
    completed: () => number;
    onFinished: (jobId: string, state: PraetorJobState) => Promise<void>;
  }): Promise<void> {
    const pending = new Set(input.jobs);
    let started = false;
    let beat = 0;
    let pause = TRACK_FIRST_POLL_MS;
    while (pending.size > 0) {
      const states = await Promise.all([...pending].map((jobId) => this.praetor.state(jobId)));
      let queuedJobs: number | null = null;
      let workers: number | null = null;
      for (const state of states) {
        queuedJobs = state.queuedJobs ?? queuedJobs;
        workers = state.workers ?? workers;
        if (!started && state.status !== "QUEUED") {
          started = true;
          await this.markStarted(input.ids());
        }
        if (praetorJobFinished(state.status)) {
          pending.delete(state.jobId);
          await input.onFinished(state.jobId, state);
        }
      }
      const now = Date.now();
      if (now - beat >= TRACK_HEARTBEAT_MS) {
        beat = now;
        await this.runModel
          .updateMany({ id: { $in: [...input.ids()] }, status: { $in: ["QUEUED", "RUNNING"] } }, { $set: { trackedAt: new Date(now) } })
          .exec();
      }
      const progress: AnalysisRunProgress = {
        stage: started ? "RUNNING" : "QUEUED",
        unit: input.unit,
        completed: input.completed(),
        total: input.total,
        queuedJobs,
        workers,
      };
      await this.runModel
        .updateOne({ id: input.progressId, status: { $in: ["QUEUED", "RUNNING"] } }, { $set: { progress } })
        .exec();
      if (pending.size > 0) {
        await delay(pause);
        pause = Math.min(TRACK_POLL_MS, Math.round(pause * 1.5));
      }
    }
  }

  async cancelRun(hostType: WorkbookMethodHostType, workbookId: string, runId: string, acting: ActingUser): Promise<AnalysisRunMetadata> {
    const { run } = await this.readAuthorizedRun(hostType, workbookId, runId, acting);
    if (run.status !== "QUEUED" && run.status !== "RUNNING") return this.metadataOf(runId);
    const children = await this.runModel.find({ batchId: run.id, status: { $in: ["QUEUED", "RUNNING"] } }).select({ id: 1 }).lean().exec();
    await Promise.all((run.praetorJobs ?? []).map((jobId) => this.praetor.cancel(jobId).catch(() => undefined)));
    await this.finishRuns([run.id, ...children.map((child) => child.id)], { status: "CANCELLED", completedAt: new Date(), engine: null, failure: null, result: null });
    return this.metadataOf(runId);
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
      nativeRequest: structuredClone(envelope),
      scope: "SINGLE",
      workbookSnapshots: context.workbookSnapshots,
      target: trace?.target ?? null,
      contributions: trace?.contributions ?? null,
      result: null,
      praetorJobs: [runId],
      trackedAt: requestedAt,
      progress: this.queuedProgress("JOB", 1),
    });
    try {
      await this.praetor.submit(envelope, { jobId: runId });
    } catch (error) {
      await this.failRuns([runId], this.transportFailure(error instanceof Error ? error : String(error)));
      return this.metadataOf(runId);
    }
    let finished = 0;
    this.track([runId], () => [runId], async () => {
      await this.followJobs({
        progressId: runId,
        ids: () => [runId],
        jobs: [runId],
        unit: "JOB",
        total: 1,
        completed: () => finished,
        onFinished: async (jobId, state) => {
          finished = 1;
          const response = await this.jobResponse(jobId, state);
          const completedAt = new Date();
          const engine = response.engine ?? null;
          if (response.error !== undefined) {
            await this.finishRuns([runId], { status: "FAILED", completedAt, engine, failure: response.error, result: null });
            return;
          }
          const result = this.publicResult(resultKind, response.result, runId, owner, completedAt.toISOString(), request);
          await this.finishRuns([runId], { status: "SUCCEEDED", completedAt, engine, failure: null, result, ...this.keptSamples(response.result) });
        },
      });
    });
    return this.metadataOf(runId);
  }

  private async executeHclBatchRuns(
    owner: WorkbookModelSnapshotIdentity,
    methodType: "HYBRID_CAUSAL_LOGIC" | "EVENT_TREE",
    scenarios: HclPreparedBatchScenario[],
    sources: LoadedWorkbook<unknown>[],
    envelope: SolverEnvelope,
    resultKind: "HYBRID_CAUSAL_LOGIC" | "EVENT_TREE",
    acting: ActingUser,
    hazardRequested: boolean,
  ): Promise<ExecutedHclBatch> {
    const context = createImmutableAnalysisRunContext({
      owner,
      sourceWorkbooks: uniqueWorkbooks(sources).map((source) => ({
        workbookId: source.workbookId,
        workbookRevision: source.workbookRevision,
      })),
      workbookSnapshots: this.createSnapshots(sources),
    });
    const batchId = randomUUID();
    const requestedAt = new Date();
    const shared = {
      schemaVersion: "1.0.0",
      ...context,
      methodType,
      status: "QUEUED",
      requestedBy: acting.username,
      requestedAt,
      startedAt: null,
      completedAt: null,
      engine: null,
      failure: null,
      result: null,
      trackedAt: requestedAt,
    };
    const batchTrace = this.createAnalysisRunTrace(
      sources,
      scenarios[0]!.trace.target,
      scenarios.flatMap((row) => row.trace.contributions.flatMap((source) => source.models)),
      scenarios.flatMap((row) => row.trace.contributions.flatMap((source) => source.entities)),
    );
    const ids = [batchId, ...scenarios.map((row) => row.runId)];
    await this.runModel.insertMany([
      {
        ...shared,
        id: batchId,
        scope: "BATCH",
        batchId: null,
        request: structuredClone(envelope.request),
        nativeRequest: structuredClone(envelope),
        praetorJobs: [batchId],
        progress: this.queuedProgress("JOB", 1),
        ...batchTrace,
      },
      ...scenarios.map((row) => ({
        ...shared,
        id: row.runId,
        scope: "SCENARIO",
        batchId,
        request: structuredClone(row.request),
        nativeRequest: null,
        ...row.trace,
      })),
    ]);
    const current = async (): Promise<ExecutedHclBatch> => ({
      batchId,
      runs: await Promise.all(
        scenarios.map(async (row) => ({
          scenarioId: row.scenarioId,
          scenarioCode: row.scenarioCode,
          scenarioName: row.scenarioName,
          run: await this.metadataOf(row.runId),
        })),
      ),
    });
    try {
      await this.praetor.submit(envelope, { jobId: batchId });
    } catch (error) {
      await this.failRuns(ids, this.transportFailure(error instanceof Error ? error : String(error)));
      return current();
    }
    let finished = 0;
    this.track(ids, () => [batchId], async () => {
      await this.followJobs({
        progressId: batchId,
        ids: () => ids,
        jobs: [batchId],
        unit: "JOB",
        total: 1,
        completed: () => finished,
        onFinished: async (jobId, state) => {
          finished = 1;
          const response = await this.jobResponse(jobId, state);
          const engine = response.engine ?? null;
          const completedAt = new Date();
          if (response.error !== undefined) {
            await this.finishRuns(ids, { status: "FAILED", completedAt, engine, failure: response.error, result: null });
            return;
          }
          const native = asRecord(response.result, "HCL batch");
          const compilationReuse =
            native["compilationReuse"] === undefined ?
              undefined
            : HclBatchCompilationStatsSchema.parse(native["compilationReuse"]);
          if (
            compilationReuse !== undefined &&
            (resultKind === "EVENT_TREE") !== "sequenceBddCompilations" in compilationReuse
          ) {
            throw new BadGatewayException("PRAXIS returned compilation counts for the wrong target kind");
          }
          const hazardConvolution =
            native["hazardConvolution"] === undefined ?
              undefined
            : HclHazardConvolutionResultSchema.parse(native["hazardConvolution"]);
          if (hazardRequested && hazardConvolution === undefined) {
            throw new BadGatewayException("PRAXIS omitted the requested hazard convolution");
          }
          const rawRows = native["batchResults"];
          if (!Array.isArray(rawRows) || rawRows.length !== scenarios.length)
            throw new BadGatewayException("PRAXIS returned an invalid dependency batch result count");
          const byId = new Map<string, Record<string, unknown>>();
          for (const rawRow of rawRows) {
            const row = asRecord(rawRow, "HCL batch scenario");
            if (typeof row["scenarioId"] !== "string" || byId.has(row["scenarioId"]))
              throw new BadGatewayException("PRAXIS returned an invalid dependency batch scenario id");
            byId.set(row["scenarioId"], row);
          }
          const outcomes: { runId: string; outcome: RunOutcome }[] = [];
          for (const row of scenarios) {
            const raw = byId.get(row.scenarioId);
            if (raw === undefined) throw new BadGatewayException(`PRAXIS omitted dependency scenario '${row.scenarioId}'`);
            if (raw["status"] === "FAILED") {
              if (hazardConvolution !== undefined) {
                throw new BadGatewayException("PRAXIS returned an incomplete hazard convolution");
              }
              const failure = AnalysisRunFailureSchema.parse(raw["failure"]);
              if (Object.keys(raw).some((key) => !["scenarioId", "status", "failure"].includes(key))) {
                throw new BadGatewayException("PRAXIS returned result fields for a failed dependency scenario");
              }
              outcomes.push({ runId: row.runId, outcome: { status: "FAILED", completedAt, engine, failure, result: null } });
              continue;
            }
            const skipped = raw["status"] === "skipped_zero_weight";
            if (
              skipped &&
              !hazardConvolution?.rows.some(
                (bin) => bin.scenarioId === row.scenarioId && bin.status === "skipped_zero_weight" && bin.rawWeight === 0,
              )
            ) {
              throw new BadGatewayException("PRAXIS skipped a scenario without a zero hazard weight");
            }
            if (raw["status"] !== undefined && !skipped)
              throw new BadGatewayException("PRAXIS returned an unknown dependency scenario status");
            const result =
              skipped ? null : (
                this.publicResult(
                  resultKind,
                  { ...raw, ...(compilationReuse === undefined ? {} : { compilationReuse }) },
                  row.runId,
                  owner,
                  completedAt.toISOString(),
                  row.request,
                )
              );
            outcomes.push({
              runId: row.runId,
              outcome: {
                status: skipped ? "SKIPPED" : "SUCCEEDED",
                completedAt,
                engine,
                failure: null,
                result,
                ...(skipped ? {} : this.keptSamples(raw)),
              },
            });
          }
          for (const { runId, outcome } of outcomes) await this.finishRuns([runId], outcome);
          const runs = (await current()).runs;
          const complete = HclBatchExecuteResultSchema.parse({
            schemaVersion: "1.0.0",
            batchId,
            runs,
            ...(compilationReuse === undefined ? {} : { compilationReuse }),
            ...(hazardConvolution === undefined ? {} : { hazardConvolution }),
          });
          await this.finishRuns([batchId], { status: "SUCCEEDED", completedAt, engine, failure: null, result: complete });
        },
      });
    });
    return current();
  }

  @WithWorkbookSnapshots()
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
    const controlled = await this.resolveFaultTreeInputs(selectedFaultTrees);
    await this.authorizeSources(controlled.sources, owner.workbookId, acting);
    const runId = randomUUID();
    const faultTrees = combineFaultTrees(runId, [
      adaptOrThrow(() =>
        adaptSyFaultTreeSnapshot(owner, request.modelId, controlled),
      ),
    ]);
    const identity = { workbookId, modelId: request.modelId, workbookRevision: owner.workbookRevision };
    const solverRequest = {
      schemaVersion: request.schemaVersion,
      methodType: "FAULT_TREE",
      modelId: request.modelId,
      revision: owner.workbookRevision,
      requestedBy: acting.username,
      calculationType: request.calculationType,
      workflow: request.workflow,
      settings: request.settings,
    };
    return this.executeRun(
      runId,
      identity,
      "FAULT_TREE",
      request.calculationType === "UNCERTAINTY"
        ? { ...request, uncertaintyInputSource: "DA" }
        : request as unknown as Record<string, unknown>,
      [owner, ...controlled.sources],
      {
        schemaVersion: "1.0.0",
        request: solverRequest,
        modelSnapshots: faultTrees.modelSnapshots,
        resources: { faultTreeBasicEventCatalogue: faultTrees.resource },
      },
      "FAULT_TREE",
      acting,
      this.createAnalysisRunTrace(
        [owner, ...controlled.sources],
        { targetType: "FAULT_TREE", model: identity },
        [{ workbookId, modelId: request.modelId }],
        controlled.references,
      ),
    );
  }

  @WithWorkbookSnapshots()
  async executeBayesianNetwork(
    workbookId: string,
    pathModelId: string,
    body: unknown,
    acting: ActingUser,
    ownerKind: "ESQ" | "SY" = "ESQ",
  ): Promise<AnalysisRunMetadata> {
    const request = parseRequest(BayesianNetworkExecuteRequestSchema, body);
    const evidence =
      "scenarios" in request.query ?
        request.query.scenarios.flatMap((scenario) => scenario.evidence.observations)
      : request.query.evidence.observations;
    const evidenceNodeIds = [...new Set(evidence.map((observation) => observation.nodeId))];
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
        evidenceNodeIds,
      },
      [{ workbookId, modelId: request.modelId }],
      [
        ...request.query.queryNodeIds.map((entityId) => ({
          referenceType: "BAYESIAN_NETWORK_NODE" as const,
          workbookId,
          modelId: request.modelId,
          entityId,
        })),
        ...evidenceNodeIds.map((entityId) => ({
          referenceType: "BAYESIAN_NETWORK_NODE" as const,
          workbookId,
          modelId: request.modelId,
          entityId,
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
          adaptOrThrow(() =>
            ownerKind === "SY" ?
              adaptSyBayesianNetworkSnapshot(owner as LoadedWorkbook<SystemsAnalysis>, request.modelId)
            : adaptEsqBayesianNetworkSnapshot(owner as LoadedWorkbook<EventSequenceQuantification>, request.modelId),
          ),
        ],
        resources: {},
      },
      "BAYESIAN_NETWORK",
      acting,
      trace,
    );
  }

  private eventTreeModelIds(source: LoadedWorkbook<EventSequenceAnalysis>, modelId: string): string[] {
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
    const refs = Object.values(tree.functionalEvents).flatMap((event) => {
      if (!event.faultTreeTopEvent) {
        if (event.networkNode !== undefined) throw new BadRequestException(`Functional event '${event.label ?? event.name}' links to a network node. Quantify it in ESQ with dependencies.`);
        throw new BadRequestException(`Functional event '${event.uuid}' has no typed fault-tree top-event reference`);
      }
      return [{
        workbookId: event.faultTreeTopEvent.workbookId,
        modelId: event.faultTreeTopEvent.modelId,
      }];
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
      ...new Map(references.map((reference) => [`${reference.workbookId}:${reference.modelId}`, reference])).values(),
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

  async executePreparedEventTreeRun(input: {
    runId: string;
    owner: WorkbookModelSnapshotIdentity;
    request: EsqEventTreeRunRequest;
    sources: Array<LoadedWorkbook<EventSequenceQuantification> | LoadedWorkbook<SystemsAnalysis> | LoadedWorkbook<SuccessCriteriaDevelopment> | LoadedWorkbook<DataAnalysis>>;
    envelope: SolverEnvelope;
    models: WorkbookModelAddress[];
    acting: ActingUser;
  }): Promise<AnalysisRunMetadata> {
    return this.executeRun(
      input.runId,
      input.owner,
      "EVENT_TREE",
      { ...input.request, logic: { ...input.request.logic } },
      input.sources,
      input.envelope,
      "EVENT_TREE",
      input.acting,
      this.createAnalysisRunTrace(input.sources, { targetType: "EVENT_TREE", model: input.owner }, input.models, []),
    );
  }

  async executePreparedLoadCapacityRun(input: {
    runId: string;
    owner: WorkbookModelSnapshotIdentity;
    request: EsqBarrierCellRunRequest;
    sources: Array<LoadedWorkbook<EventSequenceQuantification> | LoadedWorkbook<DataAnalysis>>;
    envelope: SolverEnvelope;
    acting: ActingUser;
  }): Promise<AnalysisRunMetadata> {
    return this.executeRun(
      input.runId,
      input.owner,
      "LOAD_CAPACITY",
      { ...input.request, settings: { ...input.request.settings } },
      input.sources,
      input.envelope,
      "LOAD_CAPACITY",
      input.acting,
      this.createAnalysisRunTrace(
        input.sources,
        { targetType: "LOAD_CAPACITY", model: input.owner },
        [{ workbookId: input.owner.workbookId, modelId: input.owner.modelId }],
        [],
      ),
    );
  }

  async loadEsqModelHcl(
    owner: LoadedWorkbook<EventSequenceQuantification>,
    address: EsqModelRunHcl,
    acting: ActingUser,
  ): Promise<EsqModelHcl> {
    const hcl = await this.loadHclSources(owner, address.modelId, address.workbookId === owner.workbookId ? undefined : { workbookId: address.workbookId, modelId: address.modelId });
    return this.esqModelHcl(owner, hcl, acting, "PROBABILITY");
  }

  private async esqModelHcl(
    owner: LoadedWorkbook<EventSequenceQuantification>,
    hcl: LoadedHclSources,
    acting: ActingUser,
    calculationType: HclCalculationType,
  ): Promise<EsqModelHcl> {
    if (hcl.configurationOwner.hostType !== "SY") throw new BadRequestException("Pick a dependency configuration from the linked SY workbook.");
    const sources: HclConfigurationOwner[] = [hcl.configurationOwner, hcl.bayesian, ...hcl.faultTrees.map(({ source }) => source)];
    await this.authorizeSources(sources, owner.workbookId, acting);
    const controlled = await this.resolveFaultTreeInputs([], this.hclReferences(hcl, calculationType));
    const network = adaptOrThrow(() => this.adaptHclBayesianNetwork(hcl));
    const declared = new Set(hcl.configuration.faultTrees.map((reference) => `${reference.workbookId}:${reference.modelId}`));
    const effectiveOf = (syWorkbookId: string, syModelIds: readonly string[], standIns: readonly EsqRunStandIn[]): WorkbookModelAddress[] => [
      ...syModelIds.map((modelId) => ({ workbookId: syWorkbookId, modelId })),
      ...standIns.map((standIn) => ({ workbookId: owner.workbookId, modelId: standIn.modelId })),
    ];
    const withStandIns = (standIns: readonly EsqRunStandIn[]): LoadedHclSources => (standIns.length === 0 ? hcl : {
      ...hcl,
      configuration: {
        ...hcl.configuration,
        faultTrees: [...hcl.configuration.faultTrees, ...standIns.map((standIn) => ({ workbookId: owner.workbookId, modelId: standIn.modelId }))],
        bindings: [...hcl.configuration.bindings, ...standIns.map((standIn): HclEventBinding => ({
          id: standIn.eventId,
          faultTreeBasicEvent: { referenceType: "FAULT_TREE_BASIC_EVENT", workbookId: owner.workbookId, entityId: standIn.eventId },
          bayesianNetworkNode: { referenceType: "BAYESIAN_NETWORK_NODE", workbookId: standIn.node.workbookId, modelId: standIn.node.modelId, entityId: standIn.node.nodeId },
          trueStateIds: standIn.trueStateIds,
        }))],
      },
    });
    const membershipOf = (envelope: SolverEnvelope): ReadonlyMap<string, ReadonlySet<string>> =>
      this.hclFaultTreeBasicEventMembership(envelope.modelSnapshots.filter((snapshot) => snapshot["methodType"] === "FAULT_TREE"));
    return {
      sources,
      configurationId: hcl.configuration.modelId,
      configurationWorkbookId: hcl.configurationOwner.workbookId,
      network: { workbookId: hcl.configuration.bayesianNetwork.workbookId, modelId: hcl.configuration.bayesianNetwork.modelId },
      covers: (syWorkbookId, syModelIds, standIns) => standIns.length > 0 || syModelIds.some((modelId) => declared.has(`${syWorkbookId}:${modelId}`)),
      augment: (envelope, syWorkbookId, syModelIds, standIns, evidence) => {
        const effective = effectiveOf(syWorkbookId, syModelIds, standIns);
        const configuration = adaptOrThrow(() => this.adaptHclConfiguration(withStandIns(standIns), calculationType, membershipOf(envelope), controlled, evidence, effective));
        return {
          ...envelope,
          request: { ...envelope.request, mode: "HYBRID_CAUSAL_LOGIC", calculationType, ...(calculationType === "UNCERTAINTY" ? { keepSamples: true } : {}) },
          modelSnapshots: [
            ...envelope.modelSnapshots.map((snapshot) => (snapshot["methodType"] === "EVENT_TREE"
              ? { ...snapshot, hclConfiguration: { configuration: { modelId: hcl.configuration.modelId } } }
              : snapshot)),
            network,
            configuration,
          ],
        };
      },
      entities: (envelope, syWorkbookId, syModelIds, standIns, evidence) => [
        ...this.hclBindingContributionEntities(hcl.configurationOwner, hcl.configuration, effectiveOf(syWorkbookId, syModelIds, standIns), membershipOf(envelope)),
        ...standIns.map((standIn) => ({ referenceType: "BAYESIAN_NETWORK_NODE" as const, workbookId: standIn.node.workbookId, modelId: standIn.node.modelId, entityId: standIn.node.nodeId })),
        ...this.hclEvidenceContributionEntities(hcl.configuration, evidence),
      ],
    };
  }

  private coveredDependencyTree(hcl: EsqModelHcl, tree: EsqDependencyTreeBuild): EsqDependencyTreeBuild {
    if (!hcl.covers(tree.syWorkbookId, tree.syModelIds, tree.standIns)) {
      throw new BadRequestException("The dependency configuration does not cover this event tree. Pick a configuration whose fault trees or network nodes it uses.");
    }
    return tree;
  }

  private esqDependencyTrace(
    owner: LoadedWorkbook<EventSequenceQuantification>,
    hcl: LoadedHclSources,
    identity: WorkbookModelSnapshotIdentity,
    tree: EsqDependencyTreeBuild,
    sources: EsqDependencySource[],
    entities: WorkbookCrossReference[],
  ): AnalysisRunTrace {
    return this.createAnalysisRunTrace(
      sources,
      {
        targetType: "HCL_EVENT_TREE",
        configuration: {
          workbookId: hcl.configurationOwner.workbookId,
          workbookRevision: hcl.configurationOwner.workbookRevision,
          modelId: hcl.configuration.modelId,
        },
        eventTree: { workbookId: owner.workbookId, workbookRevision: owner.workbookRevision, modelId: tree.rootModelId },
        orchestrator: identity,
      },
      [
        { workbookId: owner.workbookId, modelId: identity.modelId },
        { workbookId: hcl.configurationOwner.workbookId, modelId: hcl.configuration.modelId },
        hcl.configuration.bayesianNetwork,
        ...tree.models,
      ],
      entities,
    );
  }

  @WithWorkbookSnapshots()
  async executeEsqDependencyRun(input: {
    owner: LoadedWorkbook<EventSequenceQuantification>;
    request: HclEventTreeExecuteRequest;
    treeId: string;
    acting: ActingUser;
    build: (hcl: EsqModelHcl) => Promise<EsqDependencyTreeBuild>;
  }): Promise<AnalysisRunMetadata> {
    const { owner, request, acting } = input;
    const loaded = await this.loadHclSources(owner, request.modelId, request.dependencyConfiguration);
    const scenario = this.resolveHclEvidenceScenario(loaded.configuration, request.evidenceScenarioId);
    const hcl = await this.esqModelHcl(owner, withRunSampling(loaded, request.sampling), acting, request.calculationType);
    const tree = this.coveredDependencyTree(hcl, await input.build(hcl));
    const evidence = scenario?.evidence ?? loaded.configuration.baseEvidence;
    const envelope = hcl.augment(tree.envelope, tree.syWorkbookId, tree.syModelIds, tree.standIns, scenario?.evidence);
    const sources = [...tree.sources, ...hcl.sources];
    const identity = { workbookId: owner.workbookId, modelId: request.modelId, workbookRevision: owner.workbookRevision };
    const entities = hcl.entities(envelope, tree.syWorkbookId, tree.syModelIds, tree.standIns, evidence);
    return this.executeRun(
      randomUUID(),
      identity,
      "EVENT_TREE",
      { ...request, mode: "HYBRID_CAUSAL_LOGIC" },
      sources,
      envelope,
      "EVENT_TREE",
      acting,
      this.esqDependencyTrace(owner, loaded, identity, tree, sources, entities),
    );
  }

  @WithWorkbookSnapshots()
  async executeEsqDependencyBatch(input: {
    owner: LoadedWorkbook<EventSequenceQuantification>;
    request: HclEventTreeBatchExecuteRequest;
    treeId: string;
    acting: ActingUser;
    build: (hcl: EsqModelHcl) => Promise<EsqDependencyTreeBuild>;
  }): Promise<HclBatchExecuteResult> {
    const { owner, request, acting } = input;
    const loaded = await this.loadHclSources(owner, request.modelId, request.dependencyConfiguration);
    const configuration = this.resolveHclBatchConfiguration(loaded, request.evidenceScenarioIds, request.batchInput);
    const hazardGrid = this.resolveHclHazardGrid(configuration, request.integrateHazardGrid, request.calculationType);
    const scenarios = request.evidenceScenarioIds.flatMap((scenarioId) => {
      const resolved = this.resolveHclEvidenceScenario(configuration, scenarioId);
      return resolved === null ? [] : [resolved];
    });
    const hcl = await this.esqModelHcl(owner, withRunSampling(loaded, request.sampling), acting, request.calculationType);
    const tree = this.coveredDependencyTree(hcl, await input.build(hcl));
    const augmented = hcl.augment(tree.envelope, tree.syWorkbookId, tree.syModelIds, tree.standIns);
    const envelope: SolverEnvelope = {
      ...augmented,
      request: {
        ...augmented.request,
        evidenceBatch: scenarios.map(({ scenario, evidence }) => ({
          scenarioId: scenario.id,
          observations: evidence.observations,
          ...(hazardGrid === null ? {} : {
            hazardObservations: scenario.evidence.observations.filter((observation) => hazardGrid.hazardNodeIds.includes(observation.nodeId)),
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
    };
    const sources = [...tree.sources, ...hcl.sources];
    const identity = { workbookId: owner.workbookId, modelId: request.modelId, workbookRevision: owner.workbookRevision };
    const batchContext: HclBatchRunContext = {
      evidenceScenarioIds: [...request.evidenceScenarioIds],
      ...(hazardGrid === null ? {} : { hazardGrid: structuredClone(hazardGrid) }),
    };
    const prepared: HclPreparedBatchScenario[] = scenarios.map(({ scenario, evidence }) => ({
      scenarioId: scenario.id,
      scenarioCode: scenario.code,
      scenarioName: scenario.name,
      runId: randomUUID(),
      request: {
        schemaVersion: request.schemaVersion,
        calculationType: request.calculationType,
        modelId: request.modelId,
        workbookRevision: request.workbookRevision,
        eventTree: request.eventTree,
        ...(request.dependencyConfiguration === undefined ? {} : { dependencyConfiguration: request.dependencyConfiguration }),
        ...(request.sampling === undefined ? {} : { sampling: structuredClone(request.sampling) }),
        evidenceScenarioId: scenario.id,
        mode: "HYBRID_CAUSAL_LOGIC",
        batchContext,
        evidenceScenario: structuredClone(scenario),
        effectiveEvidence: structuredClone(evidence),
      },
      trace: this.esqDependencyTrace(owner, loaded, identity, tree, sources, hcl.entities(envelope, tree.syWorkbookId, tree.syModelIds, tree.standIns, evidence)),
    }));
    const executed = await this.executeHclBatchRuns(identity, "EVENT_TREE", prepared, sources, envelope, "EVENT_TREE", acting, hazardGrid !== null);
    return HclBatchExecuteResultSchema.parse({ schemaVersion: "1.0.0", ...executed });
  }

  private treeFailureMessage(failures: readonly { label: string; failure: string | null }[], total: number, verb: string): string {
    const shown = failures.slice(0, 3).map((entry) => `${entry.label}: ${entry.failure ?? "no reason given"}`).join(" · ");
    const more = failures.length > 3 ? ` · and ${failures.length - 3} more (see each event tree in the run details)` : "";
    return `${failures.length} of ${total} event trees ${verb}. ${shown}${more}`;
  }

  private batchSummary(made: EsqBatchSummary): EsqBatchSummary {
    if (made.kind === "ESQ_MODEL_RUN") return EsqModelRunResultSchema.parse(made);
    if (made.kind === "ESQ_POST_RUN") return EsqPostRunResultSchema.parse(made);
    if (made.kind === "ESQ_IMPORTANCE_RUN") return EsqImportanceRunResultSchema.parse(made);
    return EsqUncertaintyRunResultSchema.parse(made);
  }

  async executeEsqBatch(input: {
    owner: WorkbookModelSnapshotIdentity;
    request: EsqModelRunRequest | EsqPostRunRequest | EsqImportanceRunRequest | EsqUncertaintyRunRequest | EsqSensitivityRunRequest;
    sources: Array<LoadedWorkbook<EventSequenceQuantification> | LoadedWorkbook<SystemsAnalysis> | LoadedWorkbook<SuccessCriteriaDevelopment> | LoadedWorkbook<DataAnalysis> | HclConfigurationOwner>;
    trees: EsqPreparedTreeRun[];
    summarize: (batchId: string, completedAt: string, outcomes: EsqTreeRunOutcome[]) => EsqBatchSummary;
    stored?: (result: EventTreeAnalysisResult) => EventTreeAnalysisResult;
    acting: ActingUser;
  }): Promise<AnalysisRunMetadata> {
    const context = createImmutableAnalysisRunContext({
      owner: input.owner,
      sourceWorkbooks: uniqueWorkbooks(input.sources).map((source) => ({
        workbookId: source.workbookId,
        workbookRevision: source.workbookRevision,
      })),
      workbookSnapshots: this.createSnapshots(input.sources),
    });
    const batchId = randomUUID();
    const requestedAt = new Date();
    const unbuilt = input.trees.filter((tree) => tree.envelope === null);
    const jobs = unbuilt.length > 0 ? [] : input.trees.map((tree) => tree.runId);
    const shared = {
      schemaVersion: "1.0.0",
      sourceWorkbooks: context.sourceWorkbooks,
      workbookSnapshots: context.workbookSnapshots,
      methodType: "EVENT_TREE",
      status: "QUEUED",
      requestedBy: input.acting.username,
      requestedAt,
      startedAt: null,
      completedAt: null,
      engine: null,
      failure: null,
      result: null,
      trackedAt: requestedAt,
    };
    const ids = [batchId, ...input.trees.map((tree) => tree.runId)];
    await this.runModel.insertMany([
      {
        ...shared,
        owner: context.owner,
        id: batchId,
        scope: "BATCH",
        batchId: null,
        request: structuredClone({ ...input.request }),
        nativeRequest: null,
        praetorJobs: jobs,
        progress: this.queuedProgress("EVENT_TREE", input.trees.length),
        ...this.createAnalysisRunTrace(
          input.sources,
          { targetType: "EVENT_TREE", model: input.owner },
          input.trees.flatMap((tree) => tree.models),
          [],
        ),
      },
      ...input.trees.map((tree) => ({
        ...shared,
        owner: tree.owner,
        id: tree.runId,
        scope: "SCENARIO",
        batchId,
        request: structuredClone(tree.request),
        nativeRequest: tree.envelope === null ? null : structuredClone(tree.envelope),
        ...this.createAnalysisRunTrace(input.sources, { targetType: "EVENT_TREE", model: tree.owner }, tree.models, []),
      })),
    ]);
    if (unbuilt.length > 0) {
      const completedAt = new Date();
      for (const tree of unbuilt) {
        await this.finishRuns([tree.runId], {
          status: "FAILED",
          completedAt,
          engine: null,
          failure: { kind: "VALIDATION", code: "ESQ_RUN_BUILD", message: tree.failure ?? "This event tree could not be built.", details: {} },
          result: null,
        });
      }
      await this.finishRuns(
        input.trees.filter((tree) => tree.envelope !== null).map((tree) => tree.runId),
        { status: "CANCELLED", completedAt, engine: null, failure: null, result: null },
      );
      await this.finishRuns([batchId], {
        status: "FAILED",
        completedAt,
        engine: null,
        failure: {
          kind: "VALIDATION",
          code: "ESQ_MODEL_RUN_FAILED",
          message: this.treeFailureMessage(unbuilt.map((tree) => ({ label: tree.label, failure: tree.failure })), input.trees.length, "could not be built"),
          details: {},
        },
        result: null,
      });
      return this.metadataOf(batchId);
    }
    try {
      for (const tree of input.trees) {
        if (tree.envelope !== null) await this.praetor.submit(tree.envelope, { jobId: tree.runId });
      }
    } catch (error) {
      await Promise.all(jobs.map((jobId) => this.praetor.cancel(jobId).catch(() => undefined)));
      await this.failRuns(ids, this.transportFailure(error instanceof Error ? error : String(error)));
      return this.metadataOf(batchId);
    }
    this.logger.log(`Run ${batchId} sent ${String(jobs.length)} event tree job${jobs.length === 1 ? "" : "s"} to PRAETOR`);
    const byRun = new Map(input.trees.map((tree) => [tree.runId, tree]));
    const outcomes = new Map<string, EsqTreeRunOutcome>();
    const status: { engine: AnalysisRunMetadata["engine"] } = { engine: null };
    this.track(ids, () => jobs, async () => {
      await this.followJobs({
        progressId: batchId,
        ids: () => ids,
        jobs,
        unit: "EVENT_TREE",
        total: input.trees.length,
        completed: () => outcomes.size,
        onFinished: async (jobId, state) => {
          const tree = byRun.get(jobId);
          if (tree === undefined) throw new Error(`PRAETOR reported job ${jobId}, which belongs to no event tree of this run.`);
          const response = await this.jobResponse(jobId, state);
          const engine = response.engine ?? null;
          status.engine = engine ?? status.engine;
          const completedAt = new Date();
          if (response.error !== undefined) {
            outcomes.set(tree.treeId, { treeId: tree.treeId, runId: tree.runId, status: "FAILED", result: null, failure: response.error.message });
            await this.finishRuns([tree.runId], { status: "FAILED", completedAt, engine, failure: response.error, result: null });
            return;
          }
          const result = EventTreeAnalysisResultSchema.parse(
            this.publicResult("EVENT_TREE", response.result, tree.runId, tree.owner, completedAt.toISOString(), tree.request),
          );
          outcomes.set(tree.treeId, { treeId: tree.treeId, runId: tree.runId, status: "SUCCEEDED", result, failure: null });
          await this.finishRuns([tree.runId], {
            status: "SUCCEEDED",
            completedAt,
            engine,
            failure: null,
            result: input.stored === undefined ? result : input.stored(result),
          });
        },
      });
      const ordered = input.trees.map((tree): EsqTreeRunOutcome => outcomes.get(tree.treeId) ?? {
        treeId: tree.treeId,
        runId: tree.runId,
        status: "FAILED",
        result: null,
        failure: "PRAXIS did not report this event tree.",
      });
      const labels = new Map(input.trees.map((tree) => [tree.treeId, tree.label]));
      const failed = ordered.filter((outcome) => outcome.status === "FAILED");
      if (failed.length > 0) {
        await this.finishRuns([batchId], {
          status: "FAILED",
          completedAt: new Date(),
          engine: status.engine,
          failure: {
            kind: "EXECUTION_ERROR",
            code: "ESQ_MODEL_RUN_FAILED",
            message: this.treeFailureMessage(failed.map((outcome) => ({ label: labels.get(outcome.treeId) ?? outcome.treeId, failure: outcome.failure })), ordered.length, "failed"),
            details: {},
          },
          result: null,
        });
        return;
      }
      const completedAt = new Date();
      const summary = this.batchSummary(input.summarize(batchId, completedAt.toISOString(), ordered));
      await this.finishRuns([batchId], { status: "SUCCEEDED", completedAt, engine: status.engine, failure: null, result: summary });
    });
    return this.metadataOf(batchId);
  }

  @WithWorkbookSnapshots()
  async executeEventTree(
    workbookId: string,
    pathModelId: string,
    body: unknown,
    acting: ActingUser,
  ): Promise<AnalysisRunMetadata> {
    const request = parseRequest(EventTreeExecuteRequestSchema, body);
    expectPathModel(pathModelId, request.modelId);
    if (request.mode !== "INDEPENDENT") {
      throw new BadRequestException("Use the integration-workbook dependency route for dependency event tree runs");
    }
    const owner = await this.loadEs(workbookId);
    await this.authorizeOwner(owner, request.workbookRevision, acting);
    const eventTreeModelIds = this.eventTreeModelIds(owner, request.modelId);
    const linked = await this.loadEventTreeFaultTrees(owner, request.modelId);
    const initiators = adaptOrThrow(() => collectEsEventTreeReferences(owner, eventTreeModelIds));
    const controlled = await this.resolveFaultTreeInputs(linked, [{ projectId: owner.projectId, references: initiators }]);
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
          adaptSyFaultTreeSnapshot(source, modelId, controlled),
        ),
      ),
      adaptOrThrow(() => resolveUncertaintyTables(initiators, controlled)),
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
          expandCcf: true,
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
      this.createAnalysisRunTrace(
        [owner, ...linked.map(({ source }) => source), ...controlled.sources],
        { targetType: "EVENT_TREE", model: identity },
        [
          ...eventTreeModelIds.map((modelId) => ({ workbookId, modelId })),
          ...linked.map(({ source, modelId }) => ({ workbookId: source.workbookId, modelId })),
        ],
        [...this.eventTreeContributionEntities(owner, eventTreeModelIds), ...controlled.references],
      ),
    );
  }

  private async loadHclSources(
    owner: HclConfigurationOwner,
    modelId: string,
    dependencyConfiguration?: WorkbookModelAddress,
  ): Promise<LoadedHclSources> {
    const configurationOwner =
      dependencyConfiguration === undefined ? owner : await this.loadDependencyOwner(dependencyConfiguration.workbookId);
    if (dependencyConfiguration !== undefined && dependencyConfiguration.modelId !== modelId) {
      throw new BadRequestException("The configuration id must match the referenced dependency configuration");
    }
    const configurations =
      configurationOwner.hostType === "SY" ?
        ((configurationOwner.mef as SystemsAnalysis).dependencyHclConfigurations ?? [])
      : (configurationOwner.mef as EventSequenceQuantification).hclConfigurations;
    const configuration = configurations.find((candidate) => candidate.modelId === modelId);
    if (!configuration) {
      throw new NotFoundException(`${configurationOwner.hostType} dependency configuration not found`);
    }
    const bayesian =
      configuration.bayesianNetwork.workbookId === configurationOwner.workbookId ? configurationOwner
      : configurationOwner.hostType === "SY" ? await this.loadSy(configuration.bayesianNetwork.workbookId)
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

  private async loadDependencyOwner(workbookId: string): Promise<HclConfigurationOwner> {
    const fromSy = await this.syWorkbookModel.exists({ workbookId }).exec();
    if (fromSy === null) throw new BadRequestException("Pick a dependency configuration from the linked SY workbook.");
    return this.loadSy(workbookId);
  }

  private adaptHclBayesianNetwork(hcl: LoadedHclSources): PraxisModelSnapshot {
    return hcl.bayesian.hostType === "SY" ?
        adaptSyBayesianNetworkSnapshot(
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
    calculationType: HclCalculationType,
    faultTreeBasicEventMembership: ReadonlyMap<string, ReadonlySet<string>>,
    sources: UncertaintySources,
    evidence?: WorkbookHclConfiguration["baseEvidence"],
    effectiveFaultTrees?: WorkbookModelAddress[],
  ): PraxisModelSnapshot {
    this.validateHclBindingReferences(hcl, faultTreeBasicEventMembership, effectiveFaultTrees);
    return hcl.configurationOwner.hostType === "SY" ?
        adaptHclConfigurationSnapshot(
          hcl.configurationOwner,
          hcl.configuration,
          calculationType,
          faultTreeBasicEventMembership,
          evidence,
          effectiveFaultTrees,
          sources,
        )
      : adaptEsqHclSnapshot(
          hcl.configurationOwner as LoadedWorkbook<EventSequenceQuantification>,
          hcl.configuration.modelId,
          calculationType,
          faultTreeBasicEventMembership,
          evidence,
          sources,
        );
  }

  private hclReferences(
    hcl: LoadedHclSources,
    calculationType: HclCalculationType,
  ): Array<{ projectId: string; references: UncertaintyReferences }> {
    return [{
      projectId: hcl.configurationOwner.projectId,
      references: adaptOrThrow(() => collectHclUncertaintyReferences(hcl.configuration, calculationType)),
    }];
  }

  private validateHclBindingReferences(
    hcl: LoadedHclSources,
    selectedMemberships: ReadonlyMap<string, ReadonlySet<string>>,
    effectiveFaultTrees = hcl.configuration.faultTrees,
  ): void {
    const memberships = new Map(selectedMemberships);
    for (const binding of hcl.configuration.bindings) {
      const target = binding.faultTreeBasicEvent;
      if (effectiveFaultTrees.some((tree) => tree.workbookId === target.workbookId &&
        selectedMemberships.get(tree.modelId)?.has(target.entityId))) continue;

      const candidates = hcl.faultTrees.filter(({ source }) => source.workbookId === target.workbookId);
      if (candidates.length === 0) {
        throw new BadRequestException(`Dependency binding '${binding.id}' references undeclared FT workbook '${target.workbookId}'`);
      }
      const events = candidates[0].source.mef.systemBasicEvents.filter((event) => event.uuid === target.entityId);
      if (events.length !== 1) {
        throw new BadRequestException(`Dependency binding '${binding.id}' must resolve to exactly one basic event '${target.entityId}' in FT workbook '${target.workbookId}'`);
      }
      const resolved = candidates.some(({ source, modelId }) => {
        if (!memberships.has(modelId)) {
          const { modelSnapshot } = adaptSyFaultTreeSnapshot(source, modelId, { collectOnly: true });
          memberships.set(modelId, this.hclFaultTreeBasicEventMembership([modelSnapshot]).get(modelId)!);
        }
        return memberships.get(modelId)!.has(target.entityId);
      });
      if (!resolved) {
        throw new BadRequestException(`Dependency binding '${binding.id}' references basic event '${target.entityId}' that is not reachable in any configured fault tree`);
      }
    }
  }

  private hclFaultTreeBasicEventMembership(snapshots: PraxisModelSnapshot[]): ReadonlyMap<string, ReadonlySet<string>> {
    return new Map(
      snapshots.map((model) => [
        model.id,
        new Set(
          (model["leafNodes"] as Array<{ kind: string; basicEventId: string }>)
            .filter((leaf) => leaf.kind === "BASIC_EVENT_REFERENCE")
            .map((leaf) => leaf.basicEventId),
        ),
      ]),
    );
  }

  private hclBayesianNetwork(source: HclConfigurationOwner, modelId: string): WorkbookBayesianNetwork {
    const models =
      source.hostType === "SY" ?
        ((source.mef as SystemsAnalysis).dependencyBayesianNetworks ?? [])
      : (source.mef as EventSequenceQuantification).bayesianNetworks;
    const model = models.find((candidate) => candidate.modelId === modelId);
    if (model === undefined)
      throw new NotFoundException(`${source.hostType} Bayesian network '${modelId}' was not found`);
    return model;
  }

  private hclBindingContributionEntities(
    owner: HclConfigurationOwner,
    configuration: WorkbookHclConfiguration,
    faultTrees: WorkbookModelAddress[],
    memberships: ReadonlyMap<string, ReadonlySet<string>>,
  ): WorkbookCrossReference[] {
    return configuration.bindings.flatMap((binding) => {
      const belongsToIncludedTree = faultTrees.some(
        ({ workbookId, modelId }) =>
          workbookId === binding.faultTreeBasicEvent.workbookId &&
          memberships.get(modelId)?.has(binding.faultTreeBasicEvent.entityId) === true,
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

  private resolveHclBatchConfiguration(
    hcl: LoadedHclSources,
    scenarioIds: string[],
    input?: HclBatchInput,
  ): WorkbookHclConfiguration {
    const { hazardGrid: _savedGrid, ...saved } = hcl.configuration;
    const configuration = input === undefined ? hcl.configuration : { ...saved, ...input };
    const model = this.hclBayesianNetwork(hcl.bayesian, configuration.bayesianNetwork.modelId);
    for (const row of input?.evidenceScenarios ?? []) {
      for (const observation of row.evidence.observations) {
        const node = model.nodes.find((candidate) => candidate.id === observation.nodeId);
        if (!node?.states.some((state) => state.id === observation.stateId)) {
          throw new BadRequestException(`Scenario '${row.code}' contains an unknown BN node or state`);
        }
      }
    }
    for (const id of scenarioIds) {
      const resolved = this.resolveHclEvidenceScenario(configuration, id)!;
      if (!resolved.scenario.enabled) throw new BadRequestException(`Evidence scenario '${id}' is disabled`);
    }
    return configuration;
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
    calculationType: HclCalculationType,
  ): NonNullable<WorkbookHclConfiguration["hazardGrid"]> | null {
    if (requested !== true) return null;
    if (calculationType === "UNCERTAINTY") {
      throw new BadRequestException(HCL_HAZARD_CONVOLUTION_POINT_ONLY);
    }
    if (configuration.hazardGrid === undefined) {
      throw new BadRequestException("Hazard convolution requires hazard-grid settings on the dependency configuration");
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
        ...(functionalEvent.faultTreeTopEvent === undefined ? [] : [functionalEvent.faultTreeTopEvent]),
      ]);
    });
  }

  @WithWorkbookSnapshots()
  async executeHclFaultTree(
    workbookId: string,
    pathModelId: string,
    body: unknown,
    acting: ActingUser,
    ownerKind: "ESQ" | "SY" = "ESQ",
  ): Promise<AnalysisRunMetadata> {
    const request = parseRequest(HclExecuteRequestSchema, body);
    expectPathModel(pathModelId, request.modelId);
    const owner = ownerKind === "SY" ? await this.loadSy(workbookId) : await this.loadEsq(workbookId);
    await this.authorizeOwner(owner, request.workbookRevision, acting);
    const hcl = await this.loadHclSources(owner, request.modelId);
    const evidenceScenario = this.resolveHclEvidenceScenario(hcl.configuration, request.evidenceScenarioId);
    const selected = hcl.faultTrees.find(
      ({ source, modelId }) =>
        source.workbookId === request.faultTreeTopGate.workbookId && modelId === request.faultTreeTopGate.modelId,
    );
    if (!selected) throw new BadRequestException("Requested fault tree is not declared by the dependency configuration");
    const controlled = await this.resolveFaultTreeInputs([selected], this.hclReferences(hcl, request.calculationType));
    const sources = [
      owner,
      hcl.configurationOwner,
      hcl.bayesian,
      ...hcl.faultTrees.map(({ source }) => source),
      ...controlled.sources,
    ];
    await this.authorizeSources(sources, owner.workbookId, acting);
    const runId = randomUUID();
    const faultTrees = combineFaultTrees(runId, [
      adaptOrThrow(() =>
        adaptSyFaultTreeSnapshot(selected.source, selected.modelId, controlled),
      ),
    ]);
    const faultTreeBasicEventMembership = this.hclFaultTreeBasicEventMembership(faultTrees.modelSnapshots);
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
        ...(hcl.configurationOwner.workbookId === owner.workbookId ?
          []
        : [{ workbookId: hcl.configurationOwner.workbookId, modelId: hcl.configuration.modelId }]),
        hcl.configuration.bayesianNetwork,
        ...hcl.faultTrees.map(({ source, modelId }) => ({
          workbookId: source.workbookId,
          modelId,
        })),
      ],
      [
        request.faultTreeTopGate,
        ...this.hclBindingContributionEntities(
          hcl.configurationOwner,
          hcl.configuration,
          hcl.faultTrees.map(({ source, modelId }) => ({ workbookId: source.workbookId, modelId })),
          faultTreeBasicEventMembership,
        ),
        ...this.hclEvidenceContributionEntities(
          hcl.configuration,
          evidenceScenario?.evidence ?? hcl.configuration.baseEvidence,
        ),
      ],
    );
    const persistedRequest = request as unknown as Record<string, unknown>;
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
          calculationType: request.calculationType,
          methodType: "HYBRID_CAUSAL_LOGIC",
          modelId: request.modelId,
          revision: owner.workbookRevision,
          requestedBy: acting.username,
          faultTreeTopGate: {
            modelId: request.faultTreeTopGate.modelId,
            entityId: request.faultTreeTopGate.entityId,
          },
          ...(request.calculationType === "UNCERTAINTY" ? { keepSamples: true } : {}),
        },
        modelSnapshots: [
          ...faultTrees.modelSnapshots,
          adaptOrThrow(() => this.adaptHclBayesianNetwork(hcl)),
          adaptOrThrow(() =>
            this.adaptHclConfiguration(
              hcl,
              request.calculationType,
              faultTreeBasicEventMembership,
              controlled,
              evidenceScenario?.evidence,
            ),
          ),
        ],
        resources: { faultTreeBasicEventCatalogue: faultTrees.resource },
      },
      "HYBRID_CAUSAL_LOGIC",
      acting,
      trace,
    );
  }

  @WithWorkbookSnapshots()
  async generateHclScenarios(
    workbookId: string,
    pathModelId: string,
    body: unknown,
    acting: ActingUser,
    ownerKind: "ESQ" | "SY" = "ESQ",
  ): Promise<HclGenerateScenariosResult> {
    const request = parseRequest(HclGenerateScenariosRequestSchema, body);
    expectPathModel(pathModelId, request.modelId);
    const owner = ownerKind === "SY" ? await this.loadSy(workbookId) : await this.loadEsq(workbookId);
    await this.authorizeOwner(owner, request.workbookRevision, acting);
    const hcl = await this.loadHclSources(owner, request.modelId, request.dependencyConfiguration);
    await this.authorizeSources([hcl.configurationOwner, hcl.bayesian], owner.workbookId, acting);
    const response = await this.praetor.execute({
      schemaVersion: "1.0.0",
      request: {
        schemaVersion: "1.0.0",
        methodType: "HYBRID_CAUSAL_LOGIC",
        operation: "GENERATE_SCENARIOS",
        modelId: request.modelId,
        revision: owner.workbookRevision,
        requestedBy: acting.username,
        bayesianNetworkModelId: hcl.configuration.bayesianNetwork.modelId,
        spec: request.spec,
      },
      modelSnapshots: [adaptOrThrow(() => this.adaptHclBayesianNetwork(hcl))],
      resources: {},
    });
    if (response.error !== undefined) throw new BadRequestException(response.error.message);
    const native = asRecord(response.result, "hazard sweep");
    if (!Array.isArray(native["scenarios"])) throw new BadGatewayException("PRAXIS returned invalid hazard scenarios");
    return HclGenerateScenariosResultSchema.parse({
      schemaVersion: "1.0.0",
      scenarios: native["scenarios"].map((raw) => {
        const row = asRecord(raw, "hazard scenario");
        if (typeof row["label"] !== "string") throw new BadGatewayException("Invalid hazard scenario label");
        return {
          id: randomUUID(),
          code: row["scenarioId"],
          name: row["label"].slice(0, 200),
          enabled: row["enabled"],
          evidence: {
            observations: Object.entries(asRecord(row["evidence"], "hazard evidence")).map(([nodeId, stateId]) => ({
              nodeId,
              stateId,
            })),
          },
        };
      }),
    });
  }

  @WithWorkbookSnapshots()
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
    const configuration = this.resolveHclBatchConfiguration(hcl, request.evidenceScenarioIds, request.batchInput);
    const hazardGrid = this.resolveHclHazardGrid(configuration, request.integrateHazardGrid, request.calculationType);
    const resolvedScenarios = request.evidenceScenarioIds.map(
      (scenarioId) => this.resolveHclEvidenceScenario(configuration, scenarioId)!,
    );
    const batchContext: HclBatchRunContext = {
      evidenceScenarioIds: [...request.evidenceScenarioIds],
      ...(hazardGrid === null ? {} : { hazardGrid: structuredClone(hazardGrid) }),
    };
    const selected = hcl.faultTrees.find(
      ({ source, modelId }) =>
        source.workbookId === request.faultTreeTopGate.workbookId && modelId === request.faultTreeTopGate.modelId,
    );
    if (selected === undefined) {
      throw new BadRequestException("Requested fault tree is not declared by the dependency configuration");
    }
    const controlled = await this.resolveFaultTreeInputs([selected], this.hclReferences(hcl, request.calculationType));
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
        adaptSyFaultTreeSnapshot(selected.source, selected.modelId, controlled),
      ),
    ]);
    const faultTreeBasicEventMembership = this.hclFaultTreeBasicEventMembership(faultTrees.modelSnapshots);
    const identity = { workbookId, modelId: request.modelId, workbookRevision: owner.workbookRevision };
    const prepared = resolvedScenarios.map(({ scenario, evidence }) => {
      const singleRequest: HclExecuteRequest = {
        schemaVersion: request.schemaVersion,
        calculationType: request.calculationType,
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
          ...this.hclBindingContributionEntities(
            hcl.configurationOwner,
            hcl.configuration,
            hcl.faultTrees.map(({ source, modelId }) => ({ workbookId: source.workbookId, modelId })),
            faultTreeBasicEventMembership,
          ),
          ...this.hclEvidenceContributionEntities(hcl.configuration, evidence),
        ],
      );
      return {
        scenarioId: scenario.id,
        scenarioCode: scenario.code,
        scenarioName: scenario.name,
        runId,
        request: {
          ...singleRequest,
          batchContext,
          evidenceScenario: structuredClone(scenario),
          effectiveEvidence: structuredClone(evidence),
        } as unknown as Record<string, unknown>,
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
          calculationType: request.calculationType,
          methodType: "HYBRID_CAUSAL_LOGIC",
          modelId: request.modelId,
          revision: owner.workbookRevision,
          requestedBy: acting.username,
          faultTreeTopGate: {
            modelId: request.faultTreeTopGate.modelId,
            entityId: request.faultTreeTopGate.entityId,
          },
          ...(request.calculationType === "UNCERTAINTY" ? { keepSamples: true } : {}),
          evidenceBatch: resolvedScenarios.map(({ scenario, evidence }) => ({
            scenarioId: scenario.id,
            observations: evidence.observations,
            ...(hazardGrid === null ?
              {}
            : {
                hazardObservations: scenario.evidence.observations.filter((observation) =>
                  hazardGrid.hazardNodeIds.includes(observation.nodeId),
                ),
              }),
          })),
          ...(hazardGrid === null ?
            {}
          : {
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
          adaptOrThrow(() => this.adaptHclConfiguration(hcl, request.calculationType, faultTreeBasicEventMembership, controlled)),
        ],
        resources: { faultTreeBasicEventCatalogue: faultTrees.resource },
      },
      "HYBRID_CAUSAL_LOGIC",
      acting,
      hazardGrid !== null,
    );
    return HclBatchExecuteResultSchema.parse({ schemaVersion: "1.0.0", ...executed });
  }

  private async currentWorkbook(hostType: WorkbookMethodHostType, workbookId: string) {
    const model = (hostType === "SY" ? this.syWorkbookModel
    : hostType === "ES" ? this.esWorkbookModel
    : hostType === "ESQ" ? this.esqWorkbookModel
    : hostType === "DA" ? this.daWorkbookModel
    : hostType === "SC" ? this.scWorkbookModel
    : this.hrWorkbookModel) as unknown as Model<{ projectId: string; revision?: number }>;
    return model.findOne({ workbookId }).select({ projectId: 1, revision: 1 }).lean().exec();
  }

  private async authorizeRunOwner(
    hostType: WorkbookMethodHostType,
    workbookId: string,
    acting: ActingUser,
  ): Promise<void> {
    const workbook = await this.currentWorkbook(hostType, workbookId);
    if (workbook === null) throw new NotFoundException("Workbook not found");
    await this.projectsService.resolveAccess(workbook.projectId, acting);
  }

  private async inspectSources(
    run: AnalysisRunRecord,
    acting: ActingUser,
    cache = new Map<string, ReturnType<WorkbookAnalysisRunsService["currentWorkbook"]>>(),
  ): Promise<AnalysisRunFreshness> {
    const sources = await Promise.all(
      run.sourceWorkbooks.map(async (saved) => {
        const snapshot = run.workbookSnapshots?.find((item) => item.identity.workbookId === saved.workbookId);
        if (snapshot === undefined) throw new NotFoundException("Run source permissions cannot be verified");
        if (snapshot.projectId !== undefined) await this.projectsService.resolveAccess(snapshot.projectId, acting);
        if (saved.workbookId.startsWith("example-")) {
          return {
            workbookId: saved.workbookId,
            savedRevision: saved.workbookRevision,
            currentRevision: saved.workbookRevision,
            status: "CURRENT" as const,
          };
        }
        const key = `${snapshot.hostType}:${saved.workbookId}`;
        let pending = cache.get(key);
        if (pending === undefined) {
          pending = this.currentWorkbook(snapshot.hostType, saved.workbookId);
          cache.set(key, pending);
        }
        const current = await pending;
        if (current === null) {
          if (snapshot.projectId === undefined)
            throw new NotFoundException("Run source permissions cannot be verified");
          return {
            workbookId: saved.workbookId,
            savedRevision: saved.workbookRevision,
            currentRevision: null,
            status: "MISSING" as const,
          };
        }
        await this.projectsService.resolveAccess(current.projectId, acting);
        const revision = readWorkbookRevision(current);
        return {
          workbookId: saved.workbookId,
          savedRevision: saved.workbookRevision,
          currentRevision: revision,
          status: revision === saved.workbookRevision ? ("CURRENT" as const) : ("CHANGED" as const),
        };
      }),
    );
    if (sources.length === 0) return { status: "UNKNOWN", sources };
    const moved = sources.filter((source) => source.status !== "CURRENT");
    if (moved.length === 0) return { status: "CURRENT", sources };
    const change = await this.inputChange(run, moved);
    return change === null ? { status: "CURRENT", sources } : { status: "STALE", sources, change };
  }

  private async inputChange(run: AnalysisRunRecord, moved: AnalysisRunFreshness["sources"]): Promise<string | null> {
    const key = `${run.id}|${moved.map((source) => `${source.workbookId}@${String(source.currentRevision)}`).join(",")}`;
    const known = this.runChanges.get(key);
    if (known !== undefined) return known;
    let change: string | null;
    try {
      change = describeRunChange(run.contributions ?? null, await this.changedSources(run, moved));
    } catch (error) {
      this.logger.warn(`Run ${run.id} inputs could not be compared: ${error instanceof Error ? error.message : String(error)}`);
      const first = run.workbookSnapshots?.find((snapshot) => snapshot.identity.workbookId === moved[0]?.workbookId);
      change = `The ${first?.hostType ?? "source"} workbook changed after this run.`;
    }
    this.runChanges.set(key, change);
    if (this.runChanges.size > RUN_CHANGE_CACHE) {
      const oldest = this.runChanges.keys().next().value;
      if (oldest !== undefined) this.runChanges.delete(oldest);
    }
    return change;
  }

  private hasMef(snapshot: AnalysisRunWorkbookSnapshot): boolean {
    return typeof snapshot.mef === "object" && snapshot.mef !== null;
  }

  private async savedSnapshots(run: AnalysisRunRecord): Promise<AnalysisRunWorkbookSnapshot[]> {
    const snapshots = run.workbookSnapshots ?? [];
    if (snapshots.every((snapshot) => this.hasMef(snapshot))) return snapshots;
    const stored = await this.runModel.findOne({ id: run.id }).select({ id: 1, workbookSnapshots: 1 }).lean().exec();
    return stored?.workbookSnapshots ?? snapshots;
  }

  private parsedSy(mef: AnalysisRunWorkbookSnapshot["mef"]): SystemsAnalysis | null {
    const parsed = SystemsAnalysisSchema.safeParse(stripNulls(mef));
    return parsed.success ? parsed.data : null;
  }

  private async currentSource(
    hostType: WorkbookMethodHostType,
    workbookId: string,
  ): Promise<{ mef: object; sy: SystemsAnalysis | null } | null> {
    try {
      if (hostType === "SY") {
        const loaded = await this.loadSy(workbookId);
        return { mef: loaded.mef, sy: loaded.mef };
      }
      const loaded =
        hostType === "ES" ? await this.loadEs(workbookId)
        : hostType === "ESQ" ? await this.loadEsq(workbookId)
        : hostType === "DA" ? await this.loadDa(workbookId)
        : hostType === "SC" ? await this.loadSc(workbookId)
        : await this.loadHr(workbookId);
      return { mef: loaded.mef, sy: null };
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }

  private async changedSources(run: AnalysisRunRecord, moved: AnalysisRunFreshness["sources"]): Promise<ChangedSource[]> {
    const snapshots = await this.savedSnapshots(run);
    const sources: ChangedSource[] = [];
    for (const entry of moved) {
      const snapshot = snapshots.find((item) => item.identity.workbookId === entry.workbookId);
      if (snapshot === undefined || !this.hasMef(snapshot)) continue;
      const loaded = entry.status === "MISSING" ? null : await this.currentSource(snapshot.hostType, entry.workbookId);
      sources.push({
        hostType: snapshot.hostType,
        workbookId: entry.workbookId,
        saved: jsonOf(snapshot.mef),
        current: loaded === null ? null : jsonOf(loaded.mef),
        savedSy: snapshot.hostType === "SY" ? this.parsedSy(snapshot.mef) : null,
        currentSy: loaded?.sy ?? null,
      });
    }
    return sources;
  }

  private async readAuthorizedRun(
    hostType: WorkbookMethodHostType,
    workbookId: string,
    runId: string,
    acting: ActingUser,
    modelId?: string,
  ) {
    await this.authorizeRunOwner(hostType, workbookId, acting);
    const run = await this.runModel
      .findOne({
        id: runId,
        "owner.workbookId": workbookId,
        ...(modelId === undefined ? {} : { "owner.modelId": modelId }),
      })
      .exec();
    if (
      run === null ||
      run.workbookSnapshots?.find((source) => source.identity.workbookId === workbookId)?.hostType !== hostType
    ) {
      throw new NotFoundException("Analysis run not found");
    }
    const freshness = await this.inspectSources(run, acting);
    return { run, metadata: AnalysisRunMetadataSchema.parse({ ...toRunMetadata(run), freshness }) };
  }

  async listRunProvenance(
    hostType: WorkbookMethodHostType,
    workbookId: string,
    acting: ActingUser,
    cursor?: string,
    modelId?: string,
  ): Promise<AnalysisRunProvenanceList> {
    await this.authorizeRunOwner(hostType, workbookId, acting);
    if (modelId !== undefined && !WorkbookModelIdSchema.safeParse(modelId).success) {
      throw new BadRequestException("Invalid analysis-history model filter");
    }
    let before: { requestedAt: Date; id: string } | undefined;
    if (cursor !== undefined) {
      try {
        const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
        if (
          typeof value.date !== "string" ||
          !Number.isFinite(Date.parse(value.date)) ||
          typeof value.id !== "string" ||
          !/^[0-9a-f-]{36}$/i.test(value.id)
        )
          throw new Error();
        before = { requestedAt: new Date(value.date), id: value.id };
      } catch {
        throw new BadRequestException("Invalid analysis-history cursor");
      }
    }
    const records = await this.runModel
      .find({
        "owner.workbookId": workbookId,
        scope: { $ne: "SCENARIO" },
        ...(modelId === undefined ? {} : { "owner.modelId": modelId }),
        ...(before === undefined ?
          {}
        : {
            $or: [
              { requestedAt: { $lt: before.requestedAt } },
              { requestedAt: before.requestedAt, id: { $lt: before.id } },
            ],
          }),
      })
      .sort({ requestedAt: -1, id: -1 })
      .limit(26)
      .setOptions({ modelPayloadMetadataOnly: true })
      .exec();
    const page = records.slice(0, 25);
    const cache = new Map<string, ReturnType<WorkbookAnalysisRunsService["currentWorkbook"]>>();
    const visible = await Promise.all(
      page.map(async (record) => {
        try {
          if (
            record.workbookSnapshots?.find((source) => source.identity.workbookId === workbookId)?.hostType !== hostType
          )
            return null;
          const freshness = await this.inspectSources(record, acting, cache);
          return AnalysisRunProvenanceSchema.parse({
            run: { ...toRunMetadata(record), freshness },
            target: record.target ?? null,
            contributions: record.contributions ?? null,
          });
        } catch (error) {
          if (error instanceof NotFoundException || error instanceof ForbiddenException) return null;
          throw error;
        }
      }),
    );
    const last = page[page.length - 1];
    return AnalysisRunProvenanceListSchema.parse({
      schemaVersion: "1.0.0",
      runs: visible.filter((row) => row !== null),
      nextCursor:
        records.length > 25 && last !== undefined ?
          Buffer.from(JSON.stringify({ date: iso(last.requestedAt), id: last.id })).toString("base64url")
        : null,
    });
  }

  async listAnalysisJobs(
    hostType: WorkbookMethodHostType,
    workbookId: string,
    acting: ActingUser,
  ): Promise<AnalysisRunJobList> {
    await this.authorizeRunOwner(hostType, workbookId, acting);
    const records = await this.runModel
      .find({
        "owner.workbookId": workbookId,
        scope: { $ne: "SCENARIO" },
        status: { $in: ["QUEUED", "RUNNING"] },
      })
      .sort({ requestedAt: 1, id: 1 })
      .limit(50)
      .setOptions({ modelPayloadMetadataOnly: true })
      .exec();
    return AnalysisRunJobListSchema.parse({
      schemaVersion: "1.0.0",
      jobs: records
        .filter((record) => record.workbookSnapshots?.find((source) => source.identity.workbookId === workbookId)?.hostType === hostType)
        .map((record) => {
          const calculationType = record.request?.["calculationType"];
          const calculation = record.request?.["calculation"];
          const named = typeof calculationType === "string" && calculationType.trim().length > 0 ? calculationType
            : record.request?.["hcl"] !== undefined ? "HCL"
            : typeof calculation === "string" && calculation.trim().length > 0 ? calculation
            : null;
          return { run: toRunMetadata(record), calculationType: named };
        }),
    });
  }

  async getRun(
    hostType: WorkbookMethodHostType,
    workbookId: string,
    modelId: string | undefined,
    runId: string,
    acting: ActingUser,
  ): Promise<AnalysisRunMetadata> {
    return (await this.readAuthorizedRun(hostType, workbookId, runId, acting, modelId)).metadata;
  }

  private storedResult(run: AnalysisRunRecord): unknown {
    if (run.status !== "SUCCEEDED" || run.result === null) return null;
    if (run.scope === "BATCH") {
      const batch = asRecord(run.result, "batch");
      if (batch["kind"] === "ESQ_MODEL_RUN") return EsqModelRunResultSchema.parse(batch);
      if (batch["kind"] === "ESQ_POST_RUN") return EsqPostRunResultSchema.parse(batch);
      if (batch["kind"] === "ESQ_IMPORTANCE_RUN") return EsqImportanceRunResultSchema.parse(batch);
      if (batch["kind"] === "ESQ_UNCERTAINTY_RUN") return EsqUncertaintyRunResultSchema.parse(batch);
      return HclBatchExecuteResultSchema.parse(batch);
    }
    if (run.methodType === "FAULT_TREE")
      return FaultTreeAnalysisResultSchema.parse(this.withoutUnavailableAnalyses(run.result));
    if (run.methodType === "BAYESIAN_NETWORK") return BayesianNetworkStoredResultSchema.parse(run.result);
    if (run.methodType === "LOAD_CAPACITY") return LoadCapacityAnalysisResultSchema.parse(run.result);
    if (run.methodType === "EVENT_TREE") {
      const result = asRecord(run.result, "event-tree result");
      return EventTreeAnalysisResultSchema.parse({
        ...result,
        sequences: this.probabilitySequences(result["sequences"]),
      });
    }
    return HclQuantificationResultSchema.parse(this.withoutUnavailableAnalyses(run.result));
  }

  async getResult(
    hostType: WorkbookMethodHostType,
    workbookId: string,
    modelId: string,
    runId: string,
    acting: ActingUser,
  ): Promise<unknown> {
    const { run } = await this.readAuthorizedRun(hostType, workbookId, runId, acting, modelId);
    const result = this.storedResult(run);
    if (result === null)
      throw new ConflictException(`Analysis result is unavailable while run status is ${run.status}`);
    return result;
  }

  async getOwnerSnapshot(
    hostType: WorkbookMethodHostType,
    workbookId: string,
    runId: string,
    acting: ActingUser,
  ): Promise<AnalysisRunWorkbookSnapshot["mef"]> {
    const { run } = await this.readAuthorizedRun(hostType, workbookId, runId, acting);
    const snapshot = (await this.savedSnapshots(run)).find((item) => item.identity.workbookId === workbookId);
    if (snapshot === undefined || !this.hasMef(snapshot)) throw new NotFoundException("This run keeps no copy of its workbook");
    return snapshot.mef;
  }

  async getSampleVectors(
    hostType: WorkbookMethodHostType,
    workbookId: string,
    runId: string,
    acting: ActingUser,
  ): Promise<HclSampleVector[]> {
    const { run } = await this.readAuthorizedRun(hostType, workbookId, runId, acting);
    if (run.status !== "SUCCEEDED") throw new ConflictException(`Samples are unavailable while run status is ${run.status}`);
    const stored = await this.runModel.findOne({ id: run.id }).select({ id: 1, sampleVectors: 1 }).lean().exec();
    const parsed = HclSampleVectorsSchema.safeParse(stored?.sampleVectors);
    if (!parsed.success) throw new NotFoundException("This run kept no samples");
    return parsed.data;
  }

  async getRunDetails(
    hostType: WorkbookMethodHostType,
    workbookId: string,
    runId: string,
    acting: ActingUser,
  ): Promise<AnalysisRunDetails> {
    const { run, metadata } = await this.readAuthorizedRun(hostType, workbookId, runId, acting);
    let nativeRequest = run.nativeRequest ?? null;
    if (run.scope === "SCENARIO" && run.batchId !== null && nativeRequest === null) {
      const parent = await this.readAuthorizedRun(hostType, workbookId, run.batchId, acting);
      nativeRequest = parent.run.nativeRequest ?? null;
    }
    const children =
      run.scope === "BATCH" ?
        await this.runModel
          .find({ batchId: run.id, "owner.workbookId": workbookId, scope: "SCENARIO" })
          .sort({ requestedAt: 1, id: 1 })
          .exec()
      : undefined;
    const members =
      children === undefined ? undefined : (
        await Promise.all(
          children.map(async (child) => ({
            run: { ...toRunMetadata(child), freshness: await this.inspectSources(child, acting) },
            result: this.storedResult(child),
          })),
        )
      );
    return AnalysisRunDetailsSchema.parse({
      run: metadata,
      target: run.target ?? null,
      contributions: run.contributions ?? null,
      request: run.request,
      nativeRequest,
      workbookSnapshots: run.workbookSnapshots,
      result: this.storedResult(run),
      ...(members === undefined ? {} : { members }),
    });
  }
}

export type { SolverEnvelope };
