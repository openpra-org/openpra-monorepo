import { WithWorkbookSnapshots, loadWorkbookSnapshot } from "./analysis-workbook-scope";
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
  AnalysisRunFailureSchema,
  AnalysisRunDetailsSchema,
  AnalysisRunProvenanceListSchema,
  AnalysisRunProvenanceSchema,
  AnalysisRunTraceSchema,
  BayesianNetworkAnalysisResultSchema,
  BayesianNetworkBatchAnalysisResultSchema,
  BayesianNetworkStoredResultSchema,
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
  HclBatchCompilationStatsSchema,
  HclGenerateScenariosRequestSchema,
  HclGenerateScenariosResultSchema,
  HclHazardConvolutionResultSchema,
  HCL_HAZARD_CONVOLUTION_POINT_ONLY,
  HclQuantificationResultSchema,
  createImmutableAnalysisRunContext,
} from "interfaces-shared-types/newly-developed-methods";
import type {
  AnalysisRunMetadata,
  AnalysisRunDetails,
  AnalysisRunFreshness,
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
  HclCalculationType,
  HclBatchInput,
  HclFaultTreeBatchExecuteRequest,
  HclBatchExecuteResult,
  HclGenerateScenariosResult,
  HclHazardConvolutionResult,
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
  batchId: string;
  runs: HclBatchExecuteResult["runs"];
  compilationReuse?: HclBatchExecuteResult["compilationReuse"];
  hazardConvolution?: HclHazardConvolutionResult;
}

type PublicResultKind = "FAULT_TREE" | "BAYESIAN_NETWORK" | "EVENT_TREE" | "HYBRID_CAUSAL_LOGIC";


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
    scope: run.scope ?? "SINGLE",
    batchId: run.batchId ?? null,
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

const combineFaultTrees = (
  runId: string,
  adapters: AdaptedFaultTreeSnapshot[],
): FaultTreeBundle => {
  const catalogueId = `run:${runId}`;
  const basicEvents = new Map<string, Record<string, unknown>>();
  const commonCauseFailureGroups = new Map<string, Record<string, unknown>>();
  const uncertaintyInputs = new Map<string, Record<string, unknown>>();
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
    const ccfEntries = catalogue["commonCauseFailureGroups"] ?? [];
    if (!Array.isArray(ccfEntries)) throw new BadRequestException("Fault-tree CCF catalogue is invalid");
    ccfEntries.forEach((entry) => {
      const group = asRecord(entry, "fault-tree CCF group");
      const id = group["id"];
      if (typeof id !== "string") throw new BadRequestException("Fault-tree CCF group id is invalid");
      const prior = commonCauseFailureGroups.get(id);
      if (prior !== undefined && JSON.stringify(prior) !== JSON.stringify(group)) {
        throw new BadRequestException(`CCF group '${id}' has conflicting values across contributing workbooks`);
      }
      commonCauseFailureGroups.set(id, group);
    });
    const uncertaintyEntries = catalogue["uncertaintyInputs"] ?? [];
    if (!Array.isArray(uncertaintyEntries)) throw new BadRequestException("Fault-tree uncertainty catalogue is invalid");
    uncertaintyEntries.forEach((entry) => {
      const input = asRecord(entry, "fault-tree uncertainty input");
      const id = input["basicEventId"];
      if (typeof id !== "string") throw new BadRequestException("Fault-tree uncertainty basic-event id is invalid");
      const prior = uncertaintyInputs.get(id);
      if (prior !== undefined && JSON.stringify(prior) !== JSON.stringify(input)) {
        throw new BadRequestException(`Basic event '${id}' has conflicting uncertainty inputs across contributing workbooks`);
      }
      uncertaintyInputs.set(id, input);
    });
  });
  return {
    modelSnapshots,
    resource: {
      projectId: catalogueId,
      basicEvents: [...basicEvents.values()],
      ...(commonCauseFailureGroups.size === 0 ? {} : { commonCauseFailureGroups: [...commonCauseFailureGroups.values()] }),
      ...(uncertaintyInputs.size === 0 ? {} : { uncertaintyInputs: [...uncertaintyInputs.values()] }),
    },
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
    return loadWorkbookSnapshot(`SY:${workbookId}`, async () => {
      const document = await this.syWorkbookModel.findOne({ workbookId }).exec();
      if (!document) throw new NotFoundException("SY workbook not found");
      const parsed = SystemsAnalysisSchema.safeParse(stripNulls(document.mef));
      if (!parsed.success)
        throw new BadRequestException(`Stored SY workbook failed validation: ${parsed.error.message}`);
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
        throw new BadRequestException(`Stored ES workbook failed validation: ${parsed.error.message}`);
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
        throw new BadRequestException(`Stored ESQ workbook failed validation: ${parsed.error.message}`);
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
    });
  }

  private async loadHr(workbookId: string): Promise<LoadedWorkbook<HumanReliabilityAnalysis>> {
    return loadWorkbookSnapshot(`HRA:${workbookId}`, async () => {
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
    });
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

  private async resolveFaultTreeControlledDataSources(
    faultTrees: Array<{ source: LoadedWorkbook<SystemsAnalysis>; modelId: string }>,
  ): Promise<{
    values: ReadonlyMap<string, ResolvedControlledDataSourceValue>;
    sources: LoadedWorkbook<unknown>[];
    references: WorkbookCrossReference[];
  }> {
    const referencedSources = faultTrees.flatMap(({ source, modelId }) =>
      adaptOrThrow(() => collectSyFaultTreeControlledDataSources(source, modelId)).map((reference) => ({
        reference,
        projectId: source.projectId,
      })),
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
    for (const [key, { reference }] of uniqueReferences) {
      if (reference.referenceType === "WORKBOOK_PARAMETER") {
        daWorkbooks.set(key, await this.resolveDaControlledDataSource(reference));
      } else {
        hrWorkbooks.set(key, await this.resolveHrControlledDataSource(reference));
      }
    }

    const values = new Map<string, ResolvedControlledDataSourceValue>();
    const probabilityParameterTypes = new Set(["PROBABILITY", "UNAVAILABILITY", "HUMAN_ERROR_PROBABILITY"]);
    for (const [key, { reference }] of uniqueReferences) {
      if (reference.referenceType === "WORKBOOK_PARAMETER") {
        const workbook = daWorkbooks.get(key)!;
        const matches = workbook.mef.parameters.filter((parameter) => parameter.uuid === reference.entityId);
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
          !Number.isFinite(parameter.value) ||
          parameter.value < 0 ||
          (quantity === "PROBABILITY" && parameter.value > 1)
        ) {
          throw new BadRequestException(
            `DA parameter '${reference.workbookId}:${reference.entityId}' must be finite and ${quantity === "PROBABILITY" ? "between zero and one" : "non-negative"}`,
          );
        }
        values.set(key, { value: parameter.value, quantity, uncertainty: parameter.uncertainty?.distribution });
        continue;
      }

      const workbook = hrWorkbooks.get(key)!;
      const humanFailureEvents = workbook.mef.humanFailureEvents.filter((event) => event.uuid === reference.entityId);
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
      references: [...uniqueReferences.values()].map(({ reference }) => reference),
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
  ): unknown {
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
    if (kind === "EVENT_TREE") {
      return EventTreeAnalysisResultSchema.parse({
        ...common,
        mode: raw["mode"],
        sequences: this.probabilitySequences(raw["sequences"]),
        endStateAggregates: raw["endStateAggregates"],
        frequencySemantics: raw["frequencySemantics"],
        ...(raw["compilationReuse"] === undefined ? {} : { compilationReuse: raw["compilationReuse"] }),
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
    // Strip retired web result fields from a copy; preserve historical run records.
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
    return Array.isArray(value) ? value.map((sequence) => this.withoutUnavailableAnalyses(sequence)) : value;
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
    });

    let engine: AnalysisRunMetadata["engine"] = null;
    const startedAt = new Date();
    await this.runModel
      .updateOne({ id: runId, status: "QUEUED" }, { $set: { status: "RUNNING", startedAt, engine } })
      .exec();
    try {
      const response = await this.praetor.execute(envelope);
      engine = response.engine ?? null;
      const completedAt = new Date();
      if (response.error !== undefined) {
        await this.runModel
          .updateOne(
            { id: runId, status: "RUNNING" },
            {
              $set: {
                engine,
                status: "FAILED",
                completedAt,
                failure: response.error,
              },
            },
          )
          .exec();
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
          engine,
          failure: response.error,
        });
      }
      let result: unknown;
      try {
        result = this.publicResult(resultKind, response.result, runId, owner, completedAt.toISOString(), request);
      } catch (error) {
        if (error instanceof BadGatewayException) throw error;
        throw new BadGatewayException("Praetor returned an invalid native solver result");
      }
      await this.runModel
        .updateOne(
          { id: runId, status: "RUNNING" },
          { $set: { status: "SUCCEEDED", completedAt, result, failure: null, engine } },
        )
        .exec();
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
        engine,
        failure: null,
      });
    } catch (error) {
      const completedAt = new Date();
      const message = error instanceof Error ? error.message : String(error);
      await this.runModel
        .updateOne(
          { id: runId, status: "RUNNING" },
          {
            $set: {
              status: "FAILED",
              engine,
              completedAt,
              failure: {
                kind: "TRANSPORT",
                code: "PRAETOR_FAILURE",
                message,
                details: {},
              },
            },
          },
        )
        .exec();
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
    };
    const batchTrace = this.createAnalysisRunTrace(
      sources,
      scenarios[0]!.trace.target,
      scenarios.flatMap((row) => row.trace.contributions.flatMap((source) => source.models)),
      scenarios.flatMap((row) => row.trace.contributions.flatMap((source) => source.entities)),
    );
    const ids = [batchId, ...scenarios.map((row) => row.runId)];
    const startedAt = new Date();
    let engine: AnalysisRunMetadata["engine"] = null;
    const metadata = (
      id: string,
      status: AnalysisRunMetadata["status"],
      completedAt: Date,
      failure: AnalysisRunMetadata["failure"] = null,
    ) =>
      AnalysisRunMetadataSchema.parse({
        schemaVersion: "1.0.0",
        id,
        owner,
        sourceWorkbooks: context.sourceWorkbooks,
        methodType,
        scope: id === batchId ? "BATCH" : "SCENARIO",
        batchId: id === batchId ? null : batchId,
        status,
        requestedBy: acting.username,
        requestedAt: requestedAt.toISOString(),
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        engine,
        failure,
      });
    try {
      await this.runModel.insertMany([
        {
          ...shared,
          id: batchId,
          scope: "BATCH",
          batchId: null,
          request: structuredClone(envelope.request),
          nativeRequest: structuredClone(envelope),
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
      await this.runModel
        .updateMany({ id: { $in: ids }, status: "QUEUED" }, { $set: { status: "RUNNING", startedAt } })
        .exec();
      const response = await this.praetor.execute(envelope);
      engine = response.engine ?? null;
      const completedAt = new Date();
      if (response.error !== undefined) {
        await this.runModel
          .updateMany(
            { id: { $in: ids }, status: "RUNNING" },
            { $set: { status: "FAILED", completedAt, engine, failure: response.error } },
          )
          .exec();
        return {
          batchId,
          runs: scenarios.map((row) => ({
            scenarioId: row.scenarioId,
            scenarioCode: row.scenarioCode,
            scenarioName: row.scenarioName,
            run: metadata(row.runId, "FAILED", completedAt, response.error),
          })),
        };
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
      if (envelope.request["hazardConvolution"] !== undefined && hazardConvolution === undefined) {
        throw new BadGatewayException("PRAXIS omitted the requested hazard convolution");
      }
      const rawRows = native["batchResults"];
      if (!Array.isArray(rawRows) || rawRows.length !== scenarios.length)
        throw new BadGatewayException("PRAXIS returned an invalid HCL batch result count");
      const byId = new Map<string, Record<string, unknown>>();
      for (const rawRow of rawRows) {
        const row = asRecord(rawRow, "HCL batch scenario");
        if (typeof row["scenarioId"] !== "string" || byId.has(row["scenarioId"]))
          throw new BadGatewayException("PRAXIS returned an invalid HCL batch scenario id");
        byId.set(row["scenarioId"], row);
      }
      // Validate every row before committing any successful result.
      const prepared = scenarios.map((row) => {
        const raw = byId.get(row.scenarioId);
        if (raw === undefined) throw new BadGatewayException(`PRAXIS omitted HCL scenario '${row.scenarioId}'`);
        if (raw["status"] === "FAILED") {
          if (hazardConvolution !== undefined) {
            throw new BadGatewayException("PRAXIS returned an incomplete hazard convolution");
          }
          const failure = AnalysisRunFailureSchema.parse(raw["failure"]);
          if (Object.keys(raw).some((key) => !["scenarioId", "status", "failure"].includes(key))) {
            throw new BadGatewayException("PRAXIS returned result fields for a failed HCL scenario");
          }
          return {
            row, status: "FAILED" as const, result: null, failure,
            metadata: metadata(row.runId, "FAILED", completedAt, failure),
          };
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
          throw new BadGatewayException("PRAXIS returned an unknown HCL scenario status");
        const status = skipped ? "SKIPPED" : "SUCCEEDED";
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
        return { row, status, result, failure: null, metadata: metadata(row.runId, status, completedAt) };
      });
      const complete = HclBatchExecuteResultSchema.parse({
        schemaVersion: "1.0.0",
        batchId,
        runs: prepared.map(({ row, metadata: run }) => ({
          scenarioId: row.scenarioId,
          scenarioCode: row.scenarioCode,
          scenarioName: row.scenarioName,
          run,
        })),
        ...(compilationReuse === undefined ? {} : { compilationReuse }),
        ...(hazardConvolution === undefined ? {} : { hazardConvolution }),
      });
      const writes = await Promise.allSettled(
        prepared.map((row) =>
          this.runModel
            .updateOne(
              { id: row.row.runId, status: "RUNNING" },
              { $set: { status: row.status, completedAt, result: row.result, failure: row.failure, engine } },
            )
            .exec(),
        ),
      );
      // Drain every write before cleanup so a late child cannot resurrect a partial batch.
      const failed = writes.find((write): write is PromiseRejectedResult => write.status === "rejected");
      if (failed !== undefined) throw failed.reason;
      await this.runModel
        .updateOne(
          { id: batchId, status: "RUNNING" },
          { $set: { status: "SUCCEEDED", completedAt, result: complete, failure: null, engine } },
        )
        .exec();
      return { ...complete, batchId };
    } catch (error) {
      const completedAt = new Date();
      await this.runModel
        .updateMany(
          { id: { $in: ids } },
          {
            $set: {
              status: "FAILED",
              startedAt,
              completedAt,
              engine,
              result: null,
              failure: {
                kind: "TRANSPORT",
                code: "PRAETOR_FAILURE",
                message: error instanceof Error ? error.message : String(error),
                details: {},
              },
            },
          },
        )
        .exec();
      throw error;
    }
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
    const controlled = await this.resolveFaultTreeControlledDataSources(selectedFaultTrees);
    await this.authorizeSources(controlled.sources, owner.workbookId, acting);
    const runId = randomUUID();
    const faultTrees = combineFaultTrees(runId, [
      adaptOrThrow(() =>
        adaptSyFaultTreeSnapshot(owner, request.modelId, {
          controlledDataSourceValues: controlled.values,
          includeControlledUncertainty: request.calculationType === "UNCERTAINTY",
          expandCcf: request.settings.expandCcf,
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
    const refs = Object.values(tree.functionalEvents).map((event) => {
      if (!event.faultTreeTopEvent) {
        throw new BadRequestException(`Functional event '${event.uuid}' has no typed fault-tree top-event reference`);
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
      dependencyConfiguration === undefined ? owner : await this.loadSy(dependencyConfiguration.workbookId);
    if (dependencyConfiguration !== undefined && dependencyConfiguration.modelId !== modelId) {
      throw new BadRequestException("The HCL model id must match the referenced SY dependency configuration");
    }
    const configurations =
      configurationOwner.hostType === "SY" ?
        ((configurationOwner.mef as SystemsAnalysis).dependencyHclConfigurations ?? [])
      : (configurationOwner.mef as EventSequenceQuantification).hclConfigurations;
    const configuration = configurations.find((candidate) => candidate.modelId === modelId);
    if (!configuration) {
      throw new NotFoundException(
        configurationOwner.hostType === "SY" ?
          "SY HCL dependency configuration not found"
        : "ESQ HCL configuration not found",
      );
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
    evidence?: WorkbookHclConfiguration["baseEvidence"],
    effectiveFaultTrees?: WorkbookModelAddress[],
  ): PraxisModelSnapshot {
    this.validateHclBindingReferences(hcl, faultTreeBasicEventMembership, effectiveFaultTrees);
    return hcl.configurationOwner.hostType === "SY" ?
        adaptSyHclSnapshot(
          hcl.configurationOwner as LoadedWorkbook<SystemsAnalysis>,
          hcl.configuration.modelId,
          calculationType,
          faultTreeBasicEventMembership,
          evidence,
          effectiveFaultTrees,
        )
      : adaptEsqHclSnapshot(
          hcl.configurationOwner as LoadedWorkbook<EventSequenceQuantification>,
          hcl.configuration.modelId,
          calculationType,
          faultTreeBasicEventMembership,
          evidence,
        );
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
        throw new BadRequestException(`HCL binding '${binding.id}' references undeclared FT workbook '${target.workbookId}'`);
      }
      const events = candidates[0].source.mef.systemBasicEvents.filter((event) => event.uuid === target.entityId);
      if (events.length !== 1) {
        throw new BadRequestException(`HCL binding '${binding.id}' must resolve to exactly one basic event '${target.entityId}' in FT workbook '${target.workbookId}'`);
      }
      // A valid binding may belong to another configured FT. Resolve it before
      // the adapter selects bindings for this run; include transfer-reached leaves.
      const resolved = candidates.some(({ source, modelId }) => {
        if (!memberships.has(modelId)) {
          const { modelSnapshot } = adaptSyFaultTreeSnapshot(source, modelId, { allowUnresolvedControlledDataSources: true });
          memberships.set(modelId, this.hclFaultTreeBasicEventMembership([modelSnapshot]).get(modelId)!);
        }
        return memberships.get(modelId)!.has(target.entityId);
      });
      if (!resolved) {
        throw new BadRequestException(`HCL binding '${binding.id}' references basic event '${target.entityId}' that is not reachable in any configured fault tree`);
      }
    }
  }

  private hclFaultTreeBasicEventMembership(snapshots: PraxisModelSnapshot[]): ReadonlyMap<string, ReadonlySet<string>> {
    // Bind against the flattened solver inputs, including leaves reached through
    // FT transfers. Direct source leaves alone silently lose those BN links.
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
    faultTrees: Array<{ source: LoadedWorkbook<SystemsAnalysis>; modelId: string }>,
    memberships: ReadonlyMap<string, ReadonlySet<string>>,
  ): WorkbookCrossReference[] {
    return configuration.bindings.flatMap((binding) => {
      const belongsToIncludedTree = faultTrees.some(
        ({ source, modelId }) =>
          source.workbookId === binding.faultTreeBasicEvent.workbookId &&
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
      throw new BadRequestException("Hazard convolution requires hazard-grid settings on the HCL configuration");
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
    if (!selected) throw new BadRequestException("Requested fault tree is not declared by the HCL configuration");
    const sources = [
      owner,
      hcl.configurationOwner,
      hcl.bayesian,
      ...hcl.faultTrees.map(({ source }) => source),
    ];
    await this.authorizeSources(sources, owner.workbookId, acting);
    const runId = randomUUID();
    const faultTrees = combineFaultTrees(runId, [
      adaptOrThrow(() =>
        adaptSyFaultTreeSnapshot(selected.source, selected.modelId, {
          allowUnresolvedControlledDataSources: true,
        }),
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
          hcl.faultTrees,
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
        },
        modelSnapshots: [
          ...faultTrees.modelSnapshots,
          adaptOrThrow(() => this.adaptHclBayesianNetwork(hcl)),
          adaptOrThrow(() =>
            this.adaptHclConfiguration(
              hcl,
              request.calculationType,
              faultTreeBasicEventMembership,
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
    const hcl = await this.loadHclSources(owner, request.modelId, request.dependencyConfiguration);
    const evidenceScenario = this.resolveHclEvidenceScenario(hcl.configuration, request.evidenceScenarioId);
    const eventTree = await this.loadEs(request.eventTree.workbookId);
    const eventTreeModelIds = this.eventTreeModelIds(eventTree, request.eventTree.modelId);
    const linked = await this.loadEventTreeFaultTrees(eventTree, request.eventTree.modelId);
    const declared = new Set(
      hcl.configuration.faultTrees.map((reference) => `${reference.workbookId}:${reference.modelId}`),
    );
    const undeclared =
      request.dependencyConfiguration === undefined ?
        linked.find(({ source, modelId }) => !declared.has(`${source.workbookId}:${modelId}`))
      : undefined;
    if (undeclared) {
      throw new BadRequestException(
        `Event tree links fault tree '${undeclared.modelId}' that is not declared by the HCL configuration`,
      );
    }
    const sources = [
      owner,
      hcl.configurationOwner,
      hcl.bayesian,
      eventTree,
      ...linked.map(({ source }) => source),
    ];
    await this.authorizeSources(sources, owner.workbookId, acting);
    const runId = randomUUID();
    const faultTrees = combineFaultTrees(
      runId,
      linked.map(({ source, modelId }) =>
        adaptOrThrow(() =>
          adaptSyFaultTreeSnapshot(source, modelId, {
            allowUnresolvedControlledDataSources: true,
          }),
        ),
      ),
    );
    const faultTreeBasicEventMembership = this.hclFaultTreeBasicEventMembership(faultTrees.modelSnapshots);
    const effectiveFaultTrees = linked.map(({ source, modelId }) => ({
      workbookId: source.workbookId,
      modelId,
    }));
    const identity = { workbookId, modelId: request.modelId, workbookRevision: owner.workbookRevision };
    const persistedRequest = {
      ...request,
      mode: "HYBRID_CAUSAL_LOGIC",
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
        ...(hcl.configurationOwner.workbookId === owner.workbookId ? {} : { orchestrator: identity }),
      },
      [
        { workbookId: owner.workbookId, modelId: request.modelId },
        ...(hcl.configurationOwner.workbookId === owner.workbookId ?
          []
        : [{ workbookId: hcl.configurationOwner.workbookId, modelId: hcl.configuration.modelId }]),
        hcl.configuration.bayesianNetwork,
        ...eventTreeModelIds.map((modelId) => ({ workbookId: eventTree.workbookId, modelId })),
        ...linked.map(({ source, modelId }) => ({ workbookId: source.workbookId, modelId })),
      ],
      [
        ...this.hclBindingContributionEntities(
          hcl.configurationOwner,
          hcl.configuration,
          linked,
          faultTreeBasicEventMembership,
        ),
        ...this.hclEvidenceContributionEntities(
          hcl.configuration,
          evidenceScenario?.evidence ?? hcl.configuration.baseEvidence,
        ),
        ...this.eventTreeContributionEntities(eventTree, eventTreeModelIds),
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
          calculationType: request.calculationType,
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
          adaptOrThrow(() =>
            this.adaptHclConfiguration(
              hcl,
              request.calculationType,
              faultTreeBasicEventMembership,
              evidenceScenario?.evidence,
              effectiveFaultTrees,
            ),
          ),
        ],
        resources: { faultTreeBasicEventCatalogue: faultTrees.resource },
      },
      "EVENT_TREE",
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
      throw new BadRequestException("Requested fault tree is not declared by the HCL configuration");
    }
    const sources = [
      owner,
      hcl.configurationOwner,
      hcl.bayesian,
      ...hcl.faultTrees.map(({ source }) => source),
    ];
    await this.authorizeSources(sources, owner.workbookId, acting);
    const envelopeId = randomUUID();
    const faultTrees = combineFaultTrees(envelopeId, [
      adaptOrThrow(() =>
        adaptSyFaultTreeSnapshot(selected.source, selected.modelId, {
          allowUnresolvedControlledDataSources: true,
        }),
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
            hcl.faultTrees,
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
          adaptOrThrow(() => this.adaptHclConfiguration(hcl, request.calculationType, faultTreeBasicEventMembership)),
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

  @WithWorkbookSnapshots()
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
    const hcl = await this.loadHclSources(owner, request.modelId, request.dependencyConfiguration);
    const configuration = this.resolveHclBatchConfiguration(hcl, request.evidenceScenarioIds, request.batchInput);
    const hazardGrid = this.resolveHclHazardGrid(configuration, request.integrateHazardGrid, request.calculationType);
    const resolvedScenarios = request.evidenceScenarioIds.map(
      (scenarioId) => this.resolveHclEvidenceScenario(configuration, scenarioId)!,
    );
    const eventTree = await this.loadEs(request.eventTree.workbookId);
    const eventTreeModelIds = this.eventTreeModelIds(eventTree, request.eventTree.modelId);
    const linked = await this.loadEventTreeFaultTrees(eventTree, request.eventTree.modelId);
    const batchContext: HclBatchRunContext = {
      evidenceScenarioIds: [...request.evidenceScenarioIds],
      ...(hazardGrid === null ? {} : { hazardGrid: structuredClone(hazardGrid) }),
    };
    const declared = new Set(
      hcl.configuration.faultTrees.map((reference) => `${reference.workbookId}:${reference.modelId}`),
    );
    const undeclared =
      request.dependencyConfiguration === undefined ?
        linked.find(({ source, modelId }) => !declared.has(`${source.workbookId}:${modelId}`))
      : undefined;
    if (undeclared !== undefined) {
      throw new BadRequestException(
        `Event tree links fault tree '${undeclared.modelId}' that is not declared by the HCL configuration`,
      );
    }
    const sources = [
      owner,
      hcl.configurationOwner,
      hcl.bayesian,
      eventTree,
      ...linked.map(({ source }) => source),
    ];
    await this.authorizeSources(sources, owner.workbookId, acting);
    const envelopeId = randomUUID();
    const faultTrees = combineFaultTrees(
      envelopeId,
      linked.map(({ source, modelId }) =>
        adaptOrThrow(() =>
          adaptSyFaultTreeSnapshot(source, modelId, {
            allowUnresolvedControlledDataSources: true,
          }),
        ),
      ),
    );
    const faultTreeBasicEventMembership = this.hclFaultTreeBasicEventMembership(faultTrees.modelSnapshots);
    const effectiveFaultTrees = linked.map(({ source, modelId }) => ({
      workbookId: source.workbookId,
      modelId,
    }));
    const identity = { workbookId, modelId: request.modelId, workbookRevision: owner.workbookRevision };
    const prepared = resolvedScenarios.map(({ scenario, evidence }) => {
      const singleRequest: HclEventTreeExecuteRequest = {
        schemaVersion: request.schemaVersion,
        calculationType: request.calculationType,
        modelId: request.modelId,
        workbookRevision: request.workbookRevision,
        eventTree: request.eventTree,
        ...(request.dependencyConfiguration === undefined ?
          {}
        : { dependencyConfiguration: request.dependencyConfiguration }),
        evidenceScenarioId: scenario.id,
      };
      const runId = randomUUID();
      const persistedRequest = {
        ...singleRequest,
        mode: "HYBRID_CAUSAL_LOGIC",
        batchContext,
        evidenceScenario: structuredClone(scenario),
        effectiveEvidence: structuredClone(evidence),
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
          ...(hcl.configurationOwner.workbookId === owner.workbookId ? {} : { orchestrator: identity }),
        },
        [
          { workbookId: owner.workbookId, modelId: request.modelId },
          ...(hcl.configurationOwner.workbookId === owner.workbookId ?
            []
          : [{ workbookId: hcl.configurationOwner.workbookId, modelId: hcl.configuration.modelId }]),
          hcl.configuration.bayesianNetwork,
          ...eventTreeModelIds.map((modelId) => ({ workbookId: eventTree.workbookId, modelId })),
          ...linked.map(({ source, modelId }) => ({ workbookId: source.workbookId, modelId })),
        ],
        [
          ...this.hclBindingContributionEntities(
            hcl.configurationOwner,
            hcl.configuration,
            linked,
            faultTreeBasicEventMembership,
          ),
          ...this.hclEvidenceContributionEntities(hcl.configuration, evidence),
          ...this.eventTreeContributionEntities(eventTree, eventTreeModelIds),
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
          calculationType: request.calculationType,
          methodType: "EVENT_TREE",
          modelId: request.eventTree.modelId,
          revision: eventTree.workbookRevision,
          mode: "HYBRID_CAUSAL_LOGIC",
          requestedBy: acting.username,
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
          adaptOrThrow(() =>
            this.adaptHclConfiguration(
              hcl,
              request.calculationType,
              faultTreeBasicEventMembership,
              undefined,
              effectiveFaultTrees,
            ),
          ),
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

  private async currentWorkbook(hostType: WorkbookMethodHostType, workbookId: string) {
    const model = (hostType === "SY" ? this.syWorkbookModel
    : hostType === "ES" ? this.esWorkbookModel
    : hostType === "ESQ" ? this.esqWorkbookModel
    : hostType === "DA" ? this.daWorkbookModel
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
        // Preserve access to a deleted source only when its original project is recorded.
        if (snapshot.projectId !== undefined) await this.projectsService.resolveAccess(snapshot.projectId, acting);
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
    return {
      status:
        sources.length === 0 ? "UNKNOWN"
        : sources.every((source) => source.status === "CURRENT") ? "CURRENT"
        : "STALE",
      sources,
    };
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
  ): Promise<AnalysisRunProvenanceList> {
    await this.authorizeRunOwner(hostType, workbookId, acting);
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
    if (run.scope === "BATCH") return HclBatchExecuteResultSchema.parse(run.result);
    if (run.methodType === "FAULT_TREE")
      return FaultTreeAnalysisResultSchema.parse(this.withoutUnavailableAnalyses(run.result));
    if (run.methodType === "BAYESIAN_NETWORK") return BayesianNetworkStoredResultSchema.parse(run.result);
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

  async getRunDetails(
    hostType: WorkbookMethodHostType,
    workbookId: string,
    runId: string,
    acting: ActingUser,
  ): Promise<AnalysisRunDetails> {
    const { run, metadata } = await this.readAuthorizedRun(hostType, workbookId, runId, acting);
    let nativeRequest = run.nativeRequest ?? null;
    if (run.scope === "SCENARIO" && run.batchId !== null) {
      const parent = await this.readAuthorizedRun(hostType, workbookId, run.batchId, acting, run.owner.modelId);
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
