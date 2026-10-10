import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import type { Connection, Model, Types } from "mongoose";
import { DA_SOURCE_CATALOG } from "interfaces-mef-types/da/generic-sources";
import { HumanReliabilityAnalysisSchema } from "interfaces-mef-types/zod/hr/human-reliability-analysis";
import { createBlankHr } from "../hr-workbooks/blank-hr";
import { HrWorkbook, type HrWorkbookDocument } from "../hr-workbooks/hr-workbook.schema";
import { healMef } from "../pos-workbooks/mef-heal";
import { stringifyJson } from "interfaces-shared-types/json";
import {
  AnalysisRunDetailsSchema,
  AnalysisRunMetadataSchema,
  AnalysisRunWorkbookSnapshotsSchema,
  BayesianNetworkStoredResultSchema,
  EsqImportanceRunResultSchema,
  EsqModelRunResultSchema,
  EsqPostRunResultSchema,
  EsqUncertaintyRunResultSchema,
  EventTreeAnalysisResultSchema,
  EventTreeSequenceCutSetsSchema,
  FaultTreeAnalysisResultSchema,
  HclBatchExecuteResultSchema,
  HclQuantificationResultSchema,
  LoadCapacityAnalysisResultSchema,
} from "interfaces-shared-types/newly-developed-methods";
import { DaWorkbook, type DaWorkbookDocument } from "../da-workbooks/da-workbook.schema";
import { EsWorkbook, type EsWorkbookDocument } from "../es-workbooks/es-workbook.schema";
import { EsqWorkbook, type EsqWorkbookDocument } from "../esq-workbooks/esq-workbook.schema";
import { ExternalFloodPraWorkbook, type ExternalFloodPraWorkbookDocument } from "../external-flood-pra-workbooks/external-flood-pra-workbook.schema";
import { HighWindsPraWorkbook, type HighWindsPraWorkbookDocument } from "../high-winds-pra-workbooks/high-winds-pra-workbook.schema";
import { IeWorkbook, type IeWorkbookDocument } from "../ie-workbooks/ie-workbook.schema";
import { InternalFirePraWorkbook, type InternalFirePraWorkbookDocument } from "../internal-fire-pra-workbooks/internal-fire-pra-workbook.schema";
import { InternalFloodPraWorkbook, type InternalFloodPraWorkbookDocument } from "../internal-flood-pra-workbooks/internal-flood-pra-workbook.schema";
import { analysisRequestSignal } from "../newly-developed-methods/shared/analysis-cancellation.interceptor";
import { AnalysisRunRecord, type AnalysisRunRecordDocument } from "../newly-developed-methods/shared/analysis-run-record.schema";
import { UncertaintyService } from "../newly-developed-methods/shared/uncertainty.service";
import { OtherHazardsPraWorkbook, type OtherHazardsPraWorkbookDocument } from "../other-hazards-pra-workbooks/other-hazards-pra-workbook.schema";
import { stripNulls } from "../pos-workbooks/mef-normalize";
import { normalizeEsqMef } from "../esq-workbooks/esq-mef-normalize";
import { SeismicPraWorkbook, type SeismicPraWorkbookDocument } from "../seismic-pra-workbooks/seismic-pra-workbook.schema";
import { modelPayloadStore, type ModelPayloadReference } from "../storage/model-payload-store";
import { SyWorkbook, type SyWorkbookDocument } from "../sy-workbooks/sy-workbook.schema";
import { createWorkbookRevisionFilter, readWorkbookRevision } from "./workbook-revision";
import {
  ConversionScope,
  PraxisAnswers,
  convertDaMef,
  convertEsMef,
  convertEsqMef,
  convertHazardMef,
  convertHrMef,
  convertIeMef,
  convertScMef,
  convertSyMef,
  daCcfFacts,
  daCcfFactsWithOriginal,
  daHeldIds,
  daDatasetIndex,
  daIssue,
  daIssueAndFacts,
  daNeedsDatasets,
  esIssue,
  esqHrErrorFactors,
  esqIssue,
  field,
  hazardIssue,
  ieIssue,
  isRecord,
  jsonRecordOf,
  jsonTextOf,
  outcomeIssue,
  parsedDaFacts,
  previousDaIssue,
  previousEsIssue,
  previousEsqIssue,
  previousIeIssue,
  previousScIssue,
  previousSyIssue,
  questionRequest,
  recordAnswers,
  scIssue,
  scMissionTimeIds,
  syCcfFacts,
  syCcfFactsWithOriginal,
  syIssue,
  textField,
  without,
  type DaCcfFacts,
  type DaDatasetIndex,
  type DaParameterFacts,
  type Json,
  type JsonRecord,
  type MigrationLookups,
  type PraxisQuestions,
  type SyCcfFacts,
} from "./uncertainty-migration";
import { numberField, recordField } from "./uncertainty-migration-json";
import { failQuestions } from "./uncertainty-migration-laws";

const UNCERTAINTY_MIGRATION_ID = "uncertainty-contract-2026-10";

const MIGRATIONS_COLLECTION = "migrations";

const BACKUP_COLLECTION = "legacy_workbook_backups";

const RUNS_COLLECTION = "method_analysis_runs";

const SC_COLLECTION = "sc_workbooks";

const MAX_PRAXIS_ROUNDS = 4;

const PRAXIS_WAIT_MS = 30_000;

const EMPTY_DATASETS: DaDatasetIndex = new Map();

const DATASET_DIRECTORIES: readonly string[] = [
  join(__dirname, "da-datasets"),
  join(process.cwd(), "apps", "interfaces", "mef-types", "da"),
  join(process.cwd(), "..", "..", "interfaces", "mef-types", "da"),
  join(__dirname, "..", "..", "..", "..", "interfaces", "mef-types", "da"),
  join(__dirname, "..", "..", "..", "..", "apps", "interfaces", "mef-types", "da"),
];

type WorkbookElement = "SC" | "DA" | "SY" | "ESQ" | "HRA" | "IE" | "ES" | "HAZARD";

interface StoredWorkbook {
  _id: Types.ObjectId;
  workbookId: string;
  projectId: string;
  ownerUsername: string;
  revision?: number;
  updatedAt?: Date;
  mef?: object | null;
  previousMefJson?: string | null;
}

interface WorkbookRow {
  _id: Types.ObjectId;
  workbookId?: string;
}

interface WorkbookAccess {
  element: WorkbookElement;
  collection: string;
  rows(): Promise<WorkbookRow[]>;
  read(id: Types.ObjectId): Promise<StoredWorkbook | null>;
  original(id: Types.ObjectId): Promise<object | null>;
  update(record: StoredWorkbook, changes: object): Promise<number>;
}

interface StoredSnapshot {
  hostType?: string;
  identity?: { workbookId?: string } | null;
  mef?: object | null;
}

interface StoredRun {
  _id: Types.ObjectId;
  id: string;
  schemaVersion: string;
  owner?: { workbookId?: string } | null;
  sourceWorkbooks?: object[] | null;
  methodType: string;
  status: string;
  requestedBy: string;
  requestedAt: Date | string;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
  engine?: object | null;
  failure?: object | null;
  scope?: string | null;
  batchId?: string | null;
  nativeRequest?: object | null;
  request?: object | null;
  workbookSnapshots?: StoredSnapshot[] | null;
  target?: object | null;
  contributions?: object[] | null;
  result?: object | null;
}

interface RunRow {
  _id: Types.ObjectId;
  id: string;
  batchId?: string | null;
}

interface RawRun {
  _id: Types.ObjectId;
  id?: string;
  batchId?: string | null;
  owner?: { workbookId?: string } | null;
}

interface BackupRecord {
  migration: string;
  collection: string;
  workbookId?: string | null;
  backedUpAt: Date;
  document: object;
}

interface StoredParts {
  mef?: JsonRecord;
  mefIssue?: string;
  daFacts?: Map<string, DaParameterFacts>;
  hasPrevious: boolean;
  previous?: JsonRecord;
  previousIssue?: string;
}

interface PartResult {
  value: JsonRecord;
  changed: boolean;
  issues: string[];
  pending: number;
}

interface Attempt {
  mef?: JsonRecord;
  mefChanged: boolean;
  previous?: JsonRecord;
  previousChanged: boolean;
  issues: string[];
  pending: number;
}

interface WorkbookTally {
  collection: string;
  read: number;
  current: number;
  converted: number;
  left: number;
}

interface RunTally {
  read: number;
  kept: number;
  converted: number;
  moved: number;
  checkedThrough: Types.ObjectId | null;
}

interface UncertaintyConversionSummary {
  praxisAnswers: number;
  workbooks: WorkbookTally[];
  runs: RunTally;
}

interface AuditRecord {
  migration: string;
  startedAt: Date;
  completedAt: Date;
  summary: UncertaintyConversionSummary;
}

interface ConversionOptions {
  praxisWaitMs?: number;
}

interface MutableLookups {
  daParameters: Map<string, ReadonlyMap<string, DaParameterFacts>>;
  daCcf: Map<string, ReadonlyMap<string, DaCcfFacts>>;
  syCcf: Map<string, ReadonlyMap<string, SyCcfFacts>>;
  scMissionTimes: Map<string, ReadonlySet<string>>;
  scProjects: Map<string, string[]>;
  daHeld: Map<string, ReadonlySet<string>>;
  daProjects: Map<string, string[]>;
  hrErrorFactors: Map<string, ReadonlyMap<string, number>>;
}

interface UnresolvedOriginal {
  element: "DA" | "SY";
  collection: string;
}

interface ConversionState {
  answers: PraxisAnswers;
  lookups: MutableLookups;
  unresolved: Map<string, UnresolvedOriginal>;
  failedDa: Set<string>;
  failedSy: Set<string>;
  praxisWaitMs: number;
  praxisFailure?: string;
  backupIndexed: boolean;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function groupOf(row: RunRow): string {
  return row.batchId ?? row.id;
}

function emptyLookups(): MutableLookups {
  return { daParameters: new Map(), daCcf: new Map(), syCcf: new Map(), scMissionTimes: new Map(), scProjects: new Map(), daHeld: new Map(), daProjects: new Map(), hrErrorFactors: new Map() };
}

function withoutNulls(mef: JsonRecord): JsonRecord {
  return jsonRecordOf(stringifyJson(stripNulls(mef))) ?? mef;
}

function esqWithoutNulls(mef: JsonRecord): JsonRecord {
  return jsonRecordOf(stringifyJson(normalizeEsqMef(mef))) ?? mef;
}

function asJson(value: object | null | undefined): JsonRecord | undefined {
  return jsonRecordOf(stringifyJson(value ?? null));
}

function hrIssue(mef: JsonRecord): string | undefined {
  return outcomeIssue(HumanReliabilityAnalysisSchema.safeParse(stripNulls(mef)));
}

function previousHrIssue(mef: JsonRecord, owner: string): string | undefined {
  return outcomeIssue(HumanReliabilityAnalysisSchema.safeParse(healMef(mef, createBlankHr(textField(mef, "name") ?? "HR Workbook", textField(mef, "owner") ?? owner))));
}

function sentence(text: string): string {
  const trimmed = text.trim();
  return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
}

function previousRecord(text: string): JsonRecord | undefined {
  try {
    return jsonRecordOf(text);
  } catch {
    return undefined;
  }
}

function payloadReference(value: Json | undefined): ModelPayloadReference | undefined {
  if (!isRecord(value) || field(value, "format") !== "json-gzip-v1") return undefined;
  const key = textField(value, "key");
  const sha256 = textField(value, "sha256");
  const bytes = numberField(value, "bytes");
  return key === undefined || sha256 === undefined || bytes === undefined ? undefined : { format: "json-gzip-v1", key, sha256, bytes };
}

function collectWorkbookIds(value: Json, ids: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectWorkbookIds(item, ids);
    return;
  }
  if (!isRecord(value)) return;
  if (field(value, "referenceType") === "WORKBOOK_PARAMETER") {
    const id = textField(value, "workbookId");
    if (id !== undefined) ids.add(id);
  }
  for (const item of Object.values(value)) collectWorkbookIds(item, ids);
}

function linkedWorkbookIds(mef: JsonRecord, ids: Set<string>): void {
  for (const value of Object.values(recordField(mef, "linkedWorkbooks") ?? {})) {
    if (typeof value === "string" && value.trim().length > 0) ids.add(value.trim());
  }
  collectWorkbookIds(mef, ids);
}

function withinDeadline<T>(work: () => Promise<T>, milliseconds: number): Promise<T> {
  const signal = AbortSignal.timeout(milliseconds);
  return new Promise<T>((resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error(`No answer came within ${milliseconds / 1000} seconds.`)), { once: true });
    analysisRequestSignal.run(signal, work).then(resolve, reject);
  });
}

function withoutUnavailableAnalyses(result: JsonRecord): JsonRecord {
  const kept = without(result, ["minimalCutSetCount", "leadingCutSets"]);
  return field(result, "calculationType") === undefined || field(result, "algorithm") === undefined ? without(kept, ["cutSets", "importance"]) : kept;
}

function eventTreeSequence(sequence: Json): Json {
  if (!isRecord(sequence)) return sequence;
  const kept = withoutUnavailableAnalyses(sequence);
  const cutSets = field(sequence, "cutSets");
  return cutSets !== undefined && EventTreeSequenceCutSetsSchema.safeParse(cutSets).success ? { ...kept, cutSets } : kept;
}

function storedResultIssue(run: StoredRun, result: JsonRecord): string | undefined {
  if (run.scope === "BATCH") {
    const kind = field(result, "kind");
    if (kind === "ESQ_MODEL_RUN") return outcomeIssue(EsqModelRunResultSchema.safeParse(result));
    if (kind === "ESQ_POST_RUN") return outcomeIssue(EsqPostRunResultSchema.safeParse(result));
    if (kind === "ESQ_IMPORTANCE_RUN") return outcomeIssue(EsqImportanceRunResultSchema.safeParse(result));
    if (kind === "ESQ_UNCERTAINTY_RUN") return outcomeIssue(EsqUncertaintyRunResultSchema.safeParse(result));
    return outcomeIssue(HclBatchExecuteResultSchema.safeParse(result));
  }
  switch (run.methodType) {
    case "FAULT_TREE":
      return outcomeIssue(FaultTreeAnalysisResultSchema.safeParse(withoutUnavailableAnalyses(result)));
    case "BAYESIAN_NETWORK":
      return outcomeIssue(BayesianNetworkStoredResultSchema.safeParse(result));
    case "LOAD_CAPACITY":
      return outcomeIssue(LoadCapacityAnalysisResultSchema.safeParse(result));
    case "EVENT_TREE": {
      const sequences = field(result, "sequences");
      return outcomeIssue(EventTreeAnalysisResultSchema.safeParse({
        ...result,
        sequences: Array.isArray(sequences) ? sequences.map(eventTreeSequence) : sequences ?? null,
      }));
    }
    default:
      return outcomeIssue(HclQuantificationResultSchema.safeParse(withoutUnavailableAnalyses(result)));
  }
}

function snapshotIssue(snapshot: StoredSnapshot): string | undefined {
  const mef = asJson(snapshot.mef);
  if (mef === undefined) return "A workbook snapshot holds no MEF.";
  switch (snapshot.hostType) {
    case "SY":
      return syIssue(mef);
    case "DA":
      return daIssue(mef);
    case "ESQ":
      return esqIssue(mef);
    case "ES":
      return esIssue(mef);
    case "HRA":
      return hrIssue(mef);
    default:
      return undefined;
  }
}

function runTimes(run: StoredRun): { requestedAt: string; startedAt: string | null; completedAt: string | null } | undefined {
  try {
    return {
      requestedAt: iso(run.requestedAt),
      startedAt: run.startedAt === null ? null : iso(run.startedAt),
      completedAt: run.completedAt === null ? null : iso(run.completedAt),
    };
  } catch {
    return undefined;
  }
}

function runIssue(run: StoredRun): string | undefined {
  const times = runTimes(run);
  if (times === undefined) return "The run times do not parse.";
  const metadata = AnalysisRunMetadataSchema.safeParse({
    schemaVersion: run.schemaVersion,
    id: run.id,
    owner: run.owner,
    sourceWorkbooks: run.sourceWorkbooks,
    methodType: run.methodType,
    scope: run.scope ?? "SINGLE",
    batchId: run.batchId ?? null,
    status: run.status,
    requestedBy: run.requestedBy,
    ...times,
    engine: run.engine ?? null,
    failure: run.failure ?? null,
  });
  if (!metadata.success) return `Run metadata. ${outcomeIssue(metadata)}`;
  const snapshots = run.workbookSnapshots ?? [];
  const snapshotsIssue = outcomeIssue(AnalysisRunWorkbookSnapshotsSchema.safeParse(snapshots));
  if (snapshotsIssue !== undefined) return `Run snapshots. ${snapshotsIssue}`;
  for (const snapshot of snapshots) {
    const issue = snapshotIssue(snapshot);
    if (issue !== undefined) return `A ${snapshot.hostType ?? "workbook"} snapshot. ${issue}`;
  }
  const detailsIssue = outcomeIssue(AnalysisRunDetailsSchema.safeParse({
    run: metadata.data,
    target: run.target ?? null,
    contributions: run.contributions ?? null,
    request: run.request,
    nativeRequest: run.nativeRequest ?? null,
    workbookSnapshots: snapshots,
    result: null,
  }));
  if (detailsIssue !== undefined) return `Run details. ${detailsIssue}`;
  if (run.status !== "SUCCEEDED" || run.result === null || run.result === undefined) return undefined;
  const result = asJson(run.result);
  if (result === undefined) return "The stored result is not an object.";
  const resultIssue = storedResultIssue(run, result);
  return resultIssue === undefined ? undefined : `Stored result. ${resultIssue}`;
}

function workbookAccess<T>(element: WorkbookElement, model: Model<T>, revisioned: boolean): WorkbookAccess {
  return {
    element,
    collection: model.collection.collectionName,
    rows() {
      return model.find({}, { _id: 1, workbookId: 1 }).sort({ _id: 1 }).lean<WorkbookRow[]>().exec();
    },
    read(id) {
      return model.findOne({ _id: id }).lean<StoredWorkbook>().exec();
    },
    original(id) {
      return model.collection.findOne({ _id: id });
    },
    async update(record, changes) {
      const filter = revisioned
        ? createWorkbookRevisionFilter(record.workbookId, readWorkbookRevision(record))
        : { workbookId: record.workbookId, updatedAt: record.updatedAt ?? { $exists: false } };
      const update = await model.updateOne(filter, { $set: changes }, { timestamps: false }).exec();
      return update.matchedCount;
    },
  };
}

function collectionAccess(element: WorkbookElement, connection: Connection, collection: string): WorkbookAccess {
  const documents = () => connection.collection<StoredWorkbook>(collection);
  return {
    element,
    collection,
    rows() {
      return documents().find({}, { projection: { _id: 1, workbookId: 1 }, sort: { _id: 1 } }).toArray();
    },
    read(id) {
      return documents().findOne({ _id: id });
    },
    original(id) {
      return documents().findOne({ _id: id });
    },
    async update(record, changes) {
      const update = await documents().updateOne({ _id: record._id, updatedAt: record.updatedAt ?? { $exists: false } }, { $set: changes });
      return update.matchedCount;
    },
  };
}

@Injectable()
export class UncertaintyMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UncertaintyMigrationService.name);
  private readonly accesses: readonly WorkbookAccess[];
  private datasets?: DaDatasetIndex;

  constructor(
    @InjectModel(SyWorkbook.name)
    syWorkbookModel: Model<SyWorkbookDocument>,
    @InjectModel(DaWorkbook.name)
    daWorkbookModel: Model<DaWorkbookDocument>,
    @InjectModel(EsqWorkbook.name)
    esqWorkbookModel: Model<EsqWorkbookDocument>,
    @InjectModel(HrWorkbook.name)
    hrWorkbookModel: Model<HrWorkbookDocument>,
    @InjectModel(IeWorkbook.name)
    ieWorkbookModel: Model<IeWorkbookDocument>,
    @InjectModel(EsWorkbook.name)
    esWorkbookModel: Model<EsWorkbookDocument>,
    @InjectModel(SeismicPraWorkbook.name)
    seismicWorkbookModel: Model<SeismicPraWorkbookDocument>,
    @InjectModel(InternalFirePraWorkbook.name)
    internalFireWorkbookModel: Model<InternalFirePraWorkbookDocument>,
    @InjectModel(InternalFloodPraWorkbook.name)
    internalFloodWorkbookModel: Model<InternalFloodPraWorkbookDocument>,
    @InjectModel(HighWindsPraWorkbook.name)
    highWindsWorkbookModel: Model<HighWindsPraWorkbookDocument>,
    @InjectModel(ExternalFloodPraWorkbook.name)
    externalFloodWorkbookModel: Model<ExternalFloodPraWorkbookDocument>,
    @InjectModel(OtherHazardsPraWorkbook.name)
    otherHazardsWorkbookModel: Model<OtherHazardsPraWorkbookDocument>,
    @InjectModel(AnalysisRunRecord.name)
    private readonly runModel: Model<AnalysisRunRecordDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly uncertaintyService: UncertaintyService,
  ) {
    this.accesses = [
      collectionAccess("SC", connection, SC_COLLECTION),
      workbookAccess<DaWorkbookDocument>("DA", daWorkbookModel, true),
      workbookAccess<SyWorkbookDocument>("SY", syWorkbookModel, true),
      workbookAccess<EsqWorkbookDocument>("ESQ", esqWorkbookModel, true),
      workbookAccess<HrWorkbookDocument>("HRA", hrWorkbookModel, true),
      workbookAccess<IeWorkbookDocument>("IE", ieWorkbookModel, false),
      workbookAccess<EsWorkbookDocument>("ES", esWorkbookModel, true),
      workbookAccess<SeismicPraWorkbookDocument>("HAZARD", seismicWorkbookModel, false),
      workbookAccess<InternalFirePraWorkbookDocument>("HAZARD", internalFireWorkbookModel, false),
      workbookAccess<InternalFloodPraWorkbookDocument>("HAZARD", internalFloodWorkbookModel, false),
      workbookAccess<HighWindsPraWorkbookDocument>("HAZARD", highWindsWorkbookModel, false),
      workbookAccess<ExternalFloodPraWorkbookDocument>("HAZARD", externalFloodWorkbookModel, false),
      workbookAccess<OtherHazardsPraWorkbookDocument>("HAZARD", otherHazardsWorkbookModel, false),
    ];
  }

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.run();
    } catch (error) {
      this.logger.error(`The stored workbook check stopped. ${sentence(error instanceof Error ? error.message : String(error))} The backend starts anyway.`);
    }
  }

  async run(options: ConversionOptions = {}): Promise<UncertaintyConversionSummary> {
    const startedAt = new Date();
    const state: ConversionState = {
      answers: new PraxisAnswers(),
      lookups: emptyLookups(),
      unresolved: new Map(),
      failedDa: new Set(),
      failedSy: new Set(),
      praxisWaitMs: options.praxisWaitMs ?? PRAXIS_WAIT_MS,
      backupIndexed: false,
    };
    try {
      const workbooks: WorkbookTally[] = [];
      for (const access of this.accesses) workbooks.push(await this.convertCollection(access, state));
      const runs = await this.checkRuns(state);
      const summary: UncertaintyConversionSummary = { praxisAnswers: state.answers.answered(), workbooks, runs };
      await this.connection.collection<AuditRecord>(MIGRATIONS_COLLECTION).insertOne({ migration: UNCERTAINTY_MIGRATION_ID, startedAt, completedAt: new Date(), summary });
      this.report(summary);
      return summary;
    } finally {
      this.datasets = undefined;
    }
  }

  private report(summary: UncertaintyConversionSummary): void {
    const total = (pick: (tally: WorkbookTally) => number): number => summary.workbooks.reduce((sum, tally) => sum + pick(tally), 0);
    for (const tally of summary.workbooks) {
      if (tally.converted === 0 && tally.left === 0) continue;
      this.logger.log(`${tally.collection}: ${tally.converted} converted and backed up, ${tally.left} left as stored, ${tally.current} already current.`);
    }
    this.logger.log(`Stored workbook check finished. ${total((tally) => tally.converted)} converted, ${total((tally) => tally.left)} left as stored, ${total((tally) => tally.current)} already current. ${summary.runs.converted} analysis runs converted. ${summary.runs.moved} analysis runs moved to ${BACKUP_COLLECTION}.`);
  }

  private async convertCollection(access: WorkbookAccess, state: ConversionState): Promise<WorkbookTally> {
    const tally: WorkbookTally = { collection: access.collection, read: 0, current: 0, converted: 0, left: 0 };
    for (const row of await access.rows()) await this.processDocument(access, row, state, tally);
    return tally;
  }

  private async processDocument(access: WorkbookAccess, row: WorkbookRow, state: ConversionState, tally: WorkbookTally): Promise<void> {
    let workbookId = row.workbookId ?? `document ${row._id.toHexString()}`;
    try {
      const record = await access.read(row._id);
      if (record === null) return;
      tally.read += 1;
      workbookId = record.workbookId;
      const parts = this.partsOf(access.element, record);
      if (access.element === "SC") this.rememberScTimes(record, parts.mef, state.lookups);
      if (access.element === "ESQ") this.rememberHrErrorFactors(parts.mef, state.lookups);
      const first = this.convertParts(access, record, parts, state);
      if (first.issues.length === 0 && first.pending === 0 && !first.mefChanged && !first.previousChanged) {
        tally.current += 1;
        this.rememberCurrent(access, record, parts, state);
        return;
      }
      const issue = this.blocker(access.element, parts, state) ?? (await this.convertAndWrite(access, record, parts, first, state));
      if (issue === undefined) {
        tally.converted += 1;
        return;
      }
      tally.left += 1;
      this.leave(access, workbookId, issue, state);
    } catch (error) {
      tally.left += 1;
      this.leave(access, workbookId, `The conversion stopped. ${sentence(error instanceof Error ? error.message : String(error))}`, state);
    }
  }

  private leave(access: WorkbookAccess, workbookId: string, issue: string, state: ConversionState): void {
    this.logger.warn(`${access.collection} ${workbookId} was left as stored. ${issue}`);
    if (access.element === "DA") state.failedDa.add(workbookId);
    if (access.element === "SY") state.failedSy.add(workbookId);
  }

  private linkedIds(parts: StoredParts): Set<string> {
    const ids = new Set<string>();
    for (const mef of [parts.mef, parts.previous]) {
      if (mef !== undefined) linkedWorkbookIds(mef, ids);
    }
    return ids;
  }

  private blocker(element: WorkbookElement, parts: StoredParts, state: ConversionState): string | undefined {
    const watched = element === "SY" ? [state.failedDa] : element === "ESQ" ? [state.failedDa, state.failedSy] : [];
    if (watched.length === 0) return undefined;
    for (const id of this.linkedIds(parts)) {
      if (watched.some((failed) => failed.has(id))) return `It links workbook ${id}, which could not be converted.`;
    }
    return undefined;
  }

  private partsOf(element: WorkbookElement, record: StoredWorkbook): StoredParts {
    const parts: StoredParts = { hasPrevious: false };
    const mef = asJson(record.mef);
    if (mef !== undefined) {
      parts.mef = mef;
      if (element === "DA") {
        const checked = daIssueAndFacts(mef);
        parts.mefIssue = checked.issue;
        parts.daFacts = checked.facts;
      } else parts.mefIssue = this.mefIssue(element, mef);
    }
    const text = record.previousMefJson;
    if (typeof text === "string" && text.length > 0) {
      parts.hasPrevious = true;
      parts.previous = previousRecord(text);
      if (parts.previous !== undefined) parts.previousIssue = this.previousIssue(element, parts.previous, record.ownerUsername);
    }
    return parts;
  }

  private async convertAndWrite(access: WorkbookAccess, record: StoredWorkbook, parts: StoredParts, first: Attempt, state: ConversionState): Promise<string | undefined> {
    let attempt = first;
    if ((access.element === "SY" || access.element === "ESQ") && (await this.resolveOriginals(parts, state))) attempt = this.convertParts(access, record, parts, state);
    for (let round = 0; attempt.issues.length === 0 && attempt.pending > 0; round += 1) {
      if (round === MAX_PRAXIS_ROUNDS) return `It still waits for ${attempt.pending} PRAXIS answers after ${MAX_PRAXIS_ROUNDS} requests.`;
      await this.ask(state);
      attempt = this.convertParts(access, record, parts, state);
    }
    const issue = attempt.issues[0];
    if (issue !== undefined) return issue;
    if (!(await this.write(access, record, attempt))) return "It changed while it was being converted. It converts at the next start.";
    this.remember(access, record, parts.mef, attempt.mef ?? parts.mef, state.lookups);
    return undefined;
  }

  private convertParts(access: WorkbookAccess, record: StoredWorkbook, parts: StoredParts, state: ConversionState): Attempt {
    const attempt: Attempt = { mefChanged: false, previousChanged: false, issues: [], pending: 0 };
    if (parts.mef === undefined) attempt.issues.push("It holds no MEF object.");
    else {
      const part = this.convertPart(access, record, parts.mef, "mef", parts.mefIssue, state, (mef) => this.mefIssue(access.element, mef));
      attempt.mef = part.value;
      attempt.mefChanged = part.changed;
      attempt.issues.push(...part.issues);
      attempt.pending += part.pending;
    }
    if (!parts.hasPrevious) return attempt;
    if (parts.previous === undefined) attempt.issues.push("previousMefJson is not a JSON object.");
    else {
      const part = this.convertPart(access, record, parts.previous, "previousMefJson", parts.previousIssue, state, (mef) => this.previousIssue(access.element, mef, record.ownerUsername));
      attempt.previous = part.value;
      attempt.previousChanged = part.changed;
      attempt.issues.push(...part.issues);
      attempt.pending += part.pending;
    }
    return attempt;
  }

  private convertPart(access: WorkbookAccess, record: StoredWorkbook, source: JsonRecord, label: string, storedIssue: string | undefined, state: ConversionState, check: (mef: JsonRecord) => string | undefined): PartResult {
    const scope = new ConversionScope(state.answers, label);
    const value = this.convertMef(access.element, source, record, state.lookups, scope);
    const changed = value !== source && jsonTextOf(value) !== jsonTextOf(source);
    const issues = [...scope.issues];
    if (issues.length === 0 && scope.pending === 0) {
      const issue = changed ? check(value) : storedIssue;
      if (issue !== undefined) issues.push(`${label} does not parse${changed ? " after conversion" : ""}. ${issue}`);
    }
    return { value, changed, issues, pending: scope.pending };
  }

  private async ask(state: ConversionState): Promise<void> {
    const questions = state.answers.questions();
    const failure = state.praxisFailure ?? (await this.answer(questions, state));
    if (failure !== undefined) failQuestions(questions, failure, state.answers);
  }

  private async answer(questions: PraxisQuestions, state: ConversionState): Promise<string | undefined> {
    try {
      const response = await withinDeadline(() => this.uncertaintyService.evaluate(questionRequest(questions)), state.praxisWaitMs);
      recordAnswers(questions, response, state.answers);
      return undefined;
    } catch (error) {
      const failure = `PRAXIS did not answer. ${sentence(error instanceof Error ? error.message : String(error))}`;
      state.praxisFailure = failure;
      this.logger.warn(`${failure} Workbooks that need its answers stay as stored until the next start.`);
      return failure;
    }
  }

  private async write(access: WorkbookAccess, record: StoredWorkbook, attempt: Attempt): Promise<boolean> {
    const changes = {
      ...(attempt.mefChanged && attempt.mef !== undefined ? { mef: attempt.mef } : {}),
      ...(attempt.previousChanged && attempt.previous !== undefined ? { previousMefJson: jsonTextOf(attempt.previous) } : {}),
    };
    if (Object.keys(changes).length === 0) return false;
    const original = await access.original(record._id);
    if (original === null) return false;
    await this.connection.collection(BACKUP_COLLECTION).insertOne({
      migration: UNCERTAINTY_MIGRATION_ID,
      collection: access.collection,
      workbookId: record.workbookId,
      projectId: record.projectId,
      backedUpAt: new Date(),
      document: original,
    });
    return (await access.update(record, changes)) === 1;
  }

  private loadDatasets(): DaDatasetIndex {
    if (this.datasets !== undefined) return this.datasets;
    const first = DA_SOURCE_CATALOG[0]?.dataset ?? "";
    const directory = DATASET_DIRECTORIES.find((candidate) => existsSync(join(candidate, first)));
    if (directory === undefined) throw new Error("The DA datasets were not found next to the backend.");
    const datasets = daDatasetIndex(DA_SOURCE_CATALOG.map((source) => {
      const rows: Json = JSON.parse(readFileSync(join(directory, source.dataset), "utf8"));
      return { dataset: source.dataset, rows };
    }));
    this.datasets = datasets;
    return datasets;
  }

  private datasetsFor(mef: JsonRecord): DaDatasetIndex {
    return daNeedsDatasets(mef) ? this.loadDatasets() : EMPTY_DATASETS;
  }

  private convertMef(element: WorkbookElement, mef: JsonRecord, record: StoredWorkbook, lookups: MigrationLookups, scope: ConversionScope): JsonRecord {
    switch (element) {
      case "SC":
        return convertScMef(mef, scope);
      case "DA":
        return withoutNulls(convertDaMef(mef, { workbookId: record.workbookId, datasets: this.datasetsFor(mef) }, scope));
      case "SY":
        return withoutNulls(convertSyMef(mef, lookups, scope, record.projectId));
      case "ESQ":
        return esqWithoutNulls(convertEsqMef(mef, lookups, scope, record.projectId));
      case "HRA":
        return convertHrMef(mef, record.workbookId, lookups.hrErrorFactors);
      case "IE":
        return convertIeMef(mef, scope);
      case "ES":
        return convertEsMef(mef, scope);
      case "HAZARD":
        return convertHazardMef(mef, scope);
    }
  }

  private mefIssue(element: WorkbookElement, mef: JsonRecord): string | undefined {
    switch (element) {
      case "SC":
        return scIssue(mef);
      case "DA":
        return daIssue(mef);
      case "SY":
        return syIssue(mef);
      case "ESQ":
        return esqIssue(mef);
      case "HRA":
        return hrIssue(mef);
      case "IE":
        return ieIssue(mef);
      case "ES":
        return esIssue(mef);
      case "HAZARD":
        return hazardIssue(mef);
    }
  }

  private previousIssue(element: WorkbookElement, mef: JsonRecord, owner: string): string | undefined {
    switch (element) {
      case "SC":
        return previousScIssue(mef, owner);
      case "DA":
        return previousDaIssue(mef, owner);
      case "SY":
        return previousSyIssue(mef, owner);
      case "ESQ":
        return previousEsqIssue(mef, owner);
      case "HRA":
        return previousHrIssue(mef, owner);
      case "IE":
        return previousIeIssue(mef, owner);
      case "ES":
        return previousEsIssue(mef, owner);
      case "HAZARD":
        return hazardIssue(mef);
    }
  }

  private rememberScTimes(record: StoredWorkbook, mef: JsonRecord | undefined, lookups: MutableLookups): void {
    if (mef === undefined || lookups.scMissionTimes.has(record.workbookId)) return;
    lookups.scMissionTimes.set(record.workbookId, scMissionTimeIds(mef));
    lookups.scProjects.set(record.projectId, [...(lookups.scProjects.get(record.projectId) ?? []), record.workbookId]);
  }

  private rememberHrErrorFactors(mef: JsonRecord | undefined, lookups: MutableLookups): void {
    if (mef === undefined) return;
    const found = esqHrErrorFactors(mef);
    if (found.hrWorkbookId === undefined || found.factors.size === 0) return;
    lookups.hrErrorFactors.set(found.hrWorkbookId, new Map([...(lookups.hrErrorFactors.get(found.hrWorkbookId) ?? new Map<string, number>()), ...found.factors]));
  }

  private rememberDaHeld(record: StoredWorkbook, mef: JsonRecord, lookups: MutableLookups): void {
    if (!lookups.daHeld.has(record.workbookId)) lookups.daProjects.set(record.projectId, [...(lookups.daProjects.get(record.projectId) ?? []), record.workbookId]);
    lookups.daHeld.set(record.workbookId, daHeldIds(mef));
  }

  private rememberCurrent(access: WorkbookAccess, record: StoredWorkbook, parts: StoredParts, state: ConversionState): void {
    const mef = parts.mef;
    if (mef === undefined) return;
    if (access.element === "DA") {
      this.rememberDaHeld(record, mef, state.lookups);
      if (parts.daFacts !== undefined) state.lookups.daParameters.set(record.workbookId, parts.daFacts);
      state.lookups.daCcf.set(record.workbookId, daCcfFacts(mef, mef, record.workbookId));
      state.unresolved.set(record.workbookId, { element: "DA", collection: access.collection });
    } else if (access.element === "SY") {
      state.lookups.syCcf.set(record.workbookId, syCcfFacts(mef, mef));
      state.unresolved.set(record.workbookId, { element: "SY", collection: access.collection });
    }
  }

  private async resolveOriginals(parts: StoredParts, state: ConversionState): Promise<boolean> {
    let changed = false;
    for (const id of this.linkedIds(parts)) {
      const unresolved = state.unresolved.get(id);
      if (unresolved === undefined) continue;
      const original = await this.backupMef(unresolved.collection, id, state);
      state.unresolved.delete(id);
      if (original === undefined) continue;
      if (unresolved.element === "DA") {
        const facts = state.lookups.daCcf.get(id);
        if (facts !== undefined) state.lookups.daCcf.set(id, daCcfFactsWithOriginal(facts, original));
      } else {
        const facts = state.lookups.syCcf.get(id);
        if (facts !== undefined) state.lookups.syCcf.set(id, syCcfFactsWithOriginal(facts, original));
      }
      changed = true;
    }
    return changed;
  }

  private remember(access: WorkbookAccess, record: StoredWorkbook, original: JsonRecord | undefined, current: JsonRecord | undefined, lookups: MutableLookups): void {
    if (original === undefined || current === undefined) return;
    if (access.element === "DA") {
      this.rememberDaHeld(record, current, lookups);
      const facts = parsedDaFacts(current);
      if (facts !== undefined) lookups.daParameters.set(record.workbookId, facts);
      lookups.daCcf.set(record.workbookId, daCcfFacts(original, current, record.workbookId));
    } else if (access.element === "SY") {
      lookups.syCcf.set(record.workbookId, syCcfFacts(original, current));
    }
  }

  private async backupMef(collection: string, workbookId: string, state: ConversionState): Promise<JsonRecord | undefined> {
    const backups = this.connection.collection<BackupRecord>(BACKUP_COLLECTION);
    if (!state.backupIndexed) {
      await backups.createIndex({ collection: 1, workbookId: 1, backedUpAt: 1 });
      state.backupIndexed = true;
    }
    const [earliest] = await backups
      .find({ collection, workbookId }, { sort: { backedUpAt: 1, _id: 1 }, limit: 1, projection: { "document.mef": 1, "document.modelPayloadReferences": 1 } })
      .toArray();
    const document = earliest === undefined ? undefined : asJson(earliest.document);
    if (document === undefined) return undefined;
    const reference = payloadReference(field(recordField(document, "modelPayloadReferences") ?? {}, "mef"));
    return reference === undefined ? recordField(document, "mef") : jsonRecordOf(stringifyJson(await modelPayloadStore.get(reference)));
  }

  private async runsCheckedThrough(): Promise<Types.ObjectId | null> {
    const [latest] = await this.connection
      .collection<AuditRecord>(MIGRATIONS_COLLECTION)
      .find({ migration: UNCERTAINTY_MIGRATION_ID }, { sort: { _id: -1 }, limit: 1 })
      .toArray();
    return latest?.summary.runs.checkedThrough ?? null;
  }

  private async checkRuns(state: ConversionState): Promise<RunTally> {
    const since = await this.runsCheckedThrough();
    const rows = await this.runModel.find(since === null ? {} : { _id: { $gt: since } }, { _id: 1, id: 1, batchId: 1 }).sort({ _id: 1 }).lean<RunRow[]>().exec();
    const failing = new Map<string, string>();
    let checkedThrough = since;
    let contiguous = true;
    let converted = 0;
    for (const row of rows) {
      try {
        const run = await this.runModel.findOne({ _id: row._id }).lean<StoredRun>().exec();
        let issue = run === null ? undefined : runIssue(run);
        if (run !== null && issue !== undefined && (await this.convertRun(run, state))) {
          issue = undefined;
          converted += 1;
        }
        if (issue !== undefined && !failing.has(groupOf(row))) failing.set(groupOf(row), issue);
        if (contiguous) checkedThrough = row._id;
      } catch (error) {
        contiguous = false;
        this.logger.warn(`${RUNS_COLLECTION} run ${row.id} could not be checked. ${sentence(error instanceof Error ? error.message : String(error))} It is checked at the next start.`);
      }
    }
    const moved = new Set<string>();
    for (const [group, reason] of failing) {
      for (const id of await this.moveRuns(group, reason)) moved.add(id);
    }
    if (moved.size > 0) this.logger.warn(`${moved.size} stored analysis runs fail the current schemas. They moved to ${BACKUP_COLLECTION}.`);
    const kept = rows.filter((row) => !moved.has(row._id.toHexString())).length;
    return { read: rows.length, kept, converted, moved: moved.size, checkedThrough };
  }

  private async convertRun(run: StoredRun, state: ConversionState): Promise<boolean> {
    const snapshots: StoredSnapshot[] = [];
    let changed = false;
    for (const snapshot of run.workbookSnapshots ?? []) {
      const mef = asJson(snapshot.mef);
      if (snapshot.hostType !== "DA" || mef === undefined || daIssue(mef) === undefined) {
        snapshots.push(snapshot);
        continue;
      }
      const next = await this.convertedDaSnapshot(mef, snapshot.identity?.workbookId ?? run.owner?.workbookId ?? run.id, state);
      if (next === undefined) return false;
      snapshots.push({ ...snapshot, mef: next });
      changed = true;
    }
    if (!changed || runIssue({ ...run, workbookSnapshots: snapshots }) !== undefined) return false;
    const runs = this.connection.collection(RUNS_COLLECTION);
    const original = await runs.findOne({ _id: run._id });
    if (original === null) return false;
    await this.connection.collection(BACKUP_COLLECTION).insertOne({
      migration: UNCERTAINTY_MIGRATION_ID,
      collection: RUNS_COLLECTION,
      runId: run.id,
      workbookId: run.owner?.workbookId ?? null,
      reason: "Its DA snapshot was converted.",
      backedUpAt: new Date(),
      document: original,
    });
    return (await runs.updateOne({ _id: run._id }, { $set: { workbookSnapshots: snapshots } })).matchedCount === 1;
  }

  private async convertedDaSnapshot(mef: JsonRecord, workbookId: string, state: ConversionState): Promise<JsonRecord | undefined> {
    for (let round = 0; round <= MAX_PRAXIS_ROUNDS; round += 1) {
      const scope = new ConversionScope(state.answers, "mef");
      const value = convertDaMef(mef, { workbookId, datasets: this.datasetsFor(mef) }, scope);
      if (scope.issues.length > 0) return undefined;
      if (scope.pending === 0) return daIssue(value) === undefined ? value : undefined;
      if (round < MAX_PRAXIS_ROUNDS) await this.ask(state);
    }
    return undefined;
  }

  private async moveRuns(group: string, reason: string): Promise<string[]> {
    const runs = this.connection.collection<RawRun>(RUNS_COLLECTION);
    const moved: string[] = [];
    for (const original of await runs.find({ $or: [{ id: group }, { batchId: group }] }).toArray()) {
      await this.connection.collection(BACKUP_COLLECTION).insertOne({
        migration: UNCERTAINTY_MIGRATION_ID,
        collection: RUNS_COLLECTION,
        runId: original.id ?? null,
        workbookId: original.owner?.workbookId ?? null,
        reason,
        backedUpAt: new Date(),
        document: original,
      });
      await runs.deleteOne({ _id: original._id });
      moved.push(original._id.toHexString());
    }
    return moved;
  }
}

export { BACKUP_COLLECTION, MIGRATIONS_COLLECTION, UNCERTAINTY_MIGRATION_ID, runIssue };
export type { UncertaintyConversionSummary, WorkbookTally };
