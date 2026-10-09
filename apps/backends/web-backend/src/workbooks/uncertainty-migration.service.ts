import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import type { Connection, Model, Types } from "mongoose";
import { DA_SOURCE_CATALOG } from "interfaces-mef-types/da/generic-sources";
import { HumanReliabilityAnalysisSchema } from "interfaces-mef-types/zod/hr/human-reliability-analysis";
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
import { AnalysisRunRecord, type AnalysisRunRecordDocument } from "../newly-developed-methods/shared/analysis-run-record.schema";
import { UncertaintyService } from "../newly-developed-methods/shared/uncertainty.service";
import { OtherHazardsPraWorkbook, type OtherHazardsPraWorkbookDocument } from "../other-hazards-pra-workbooks/other-hazards-pra-workbook.schema";
import { stripNulls } from "../pos-workbooks/mef-normalize";
import { SeismicPraWorkbook, type SeismicPraWorkbookDocument } from "../seismic-pra-workbooks/seismic-pra-workbook.schema";
import { SyWorkbook, type SyWorkbookDocument } from "../sy-workbooks/sy-workbook.schema";
import { createWorkbookRevisionFilter, readWorkbookRevision } from "./workbook-revision";
import {
  ConversionScope,
  PraxisAnswers,
  convertDaMef,
  convertEsMef,
  convertEsqMef,
  convertHazardMef,
  convertIeMef,
  convertScMef,
  convertSyMef,
  daCcfFacts,
  daDatasetIndex,
  daIssue,
  daNeedsDatasets,
  esIssue,
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
  openQuestions,
  questionRequest,
  recordAnswers,
  scIssue,
  scMissionTimeIds,
  syCcfFacts,
  syIssue,
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

const UNCERTAINTY_MIGRATION_ID = "uncertainty-contract-2026-10";

const UNCERTAINTY_MIGRATION_FLAG = "RUN_UNCERTAINTY_MIGRATION";

const MIGRATIONS_COLLECTION = "migrations";

const BACKUP_COLLECTION = "legacy_workbook_backups";

const RUNS_COLLECTION = "method_analysis_runs";

const SC_COLLECTION = "sc_workbooks";

const MAX_PRAXIS_ROUNDS = 4;

const EMPTY_DATASETS: DaDatasetIndex = new Map();

const DATASET_DIRECTORIES: readonly string[] = [
  join(process.cwd(), "apps", "interfaces", "mef-types", "da"),
  join(process.cwd(), "..", "..", "interfaces", "mef-types", "da"),
  join(__dirname, "..", "..", "..", "..", "interfaces", "mef-types", "da"),
  join(__dirname, "..", "..", "..", "..", "apps", "interfaces", "mef-types", "da"),
];

type WorkbookElement = "SC" | "DA" | "SY" | "ESQ" | "IE" | "ES" | "HAZARD";

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

interface WorkbookAccess {
  element: WorkbookElement;
  collection: string;
  ids(): Promise<Types.ObjectId[]>;
  read(id: Types.ObjectId): Promise<StoredWorkbook | null>;
  original(id: Types.ObjectId): Promise<object | null>;
  update(record: StoredWorkbook, changes: object): Promise<number>;
}

interface StoredSnapshot {
  hostType?: string;
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

interface MigrationRecord {
  _id: string;
  completedAt: Date;
  summary: UncertaintyMigrationSummary;
}

interface ConvertedWorkbook {
  mef?: JsonRecord;
  mefChanged: boolean;
  previous?: string;
  previousChanged: boolean;
  issues: string[];
}

interface WorkbookTally {
  collection: string;
  read: number;
  converted: number;
}

interface RunTally {
  read: number;
  kept: number;
  moved: number;
}

interface UncertaintyMigrationSummary {
  applied: boolean;
  praxisAnswers: number;
  workbooks: WorkbookTally[];
  runs: RunTally;
}

interface MutableLookups {
  daParameters: Map<string, ReadonlyMap<string, DaParameterFacts>>;
  daCcf: Map<string, ReadonlyMap<string, DaCcfFacts>>;
  syCcf: Map<string, ReadonlyMap<string, SyCcfFacts>>;
  scMissionTimes: Map<string, ReadonlySet<string>>;
  scProjects: Map<string, string[]>;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function groupOf(row: RunRow): string {
  return row.batchId ?? row.id;
}

function emptyLookups(): MutableLookups {
  return { daParameters: new Map(), daCcf: new Map(), syCcf: new Map(), scMissionTimes: new Map(), scProjects: new Map() };
}

function asJson(value: object | null | undefined): JsonRecord | undefined {
  return jsonRecordOf(stringifyJson(value ?? null));
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
      return outcomeIssue(HumanReliabilityAnalysisSchema.safeParse(stripNulls(mef)));
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
    async ids() {
      const rows = await model.find({}, { _id: 1 }).sort({ _id: 1 }).lean<{ _id: Types.ObjectId }[]>().exec();
      return rows.map((row) => row._id);
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
    async ids() {
      const rows = await documents().find({}, { projection: { _id: 1 }, sort: { _id: 1 } }).toArray();
      return rows.map((row) => row._id);
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
    if (process.env[UNCERTAINTY_MIGRATION_FLAG] !== "true") {
      this.logger.log(`The uncertainty contract migration is pending. Set ${UNCERTAINTY_MIGRATION_FLAG}=true and restart the backend to run it.`);
      return;
    }
    await this.run();
  }

  async run(): Promise<UncertaintyMigrationSummary> {
    try {
      return await this.migrate();
    } finally {
      this.datasets = undefined;
    }
  }

  private async migrate(): Promise<UncertaintyMigrationSummary> {
    const migrations = this.connection.collection<MigrationRecord>(MIGRATIONS_COLLECTION);
    if ((await migrations.findOne({ _id: UNCERTAINTY_MIGRATION_ID })) !== null) {
      this.logger.log("The uncertainty contract migration already ran.");
      return { applied: false, praxisAnswers: 0, workbooks: [], runs: { read: 0, kept: 0, moved: 0 } };
    }
    this.logger.log("The uncertainty contract migration started.");
    const answers = await this.settleAnswers();
    const lookups = await this.validate(answers);
    const workbooks: WorkbookTally[] = [];
    for (const access of this.accesses) workbooks.push(await this.writeWorkbooks(access, answers, lookups));
    const runs = await this.migrateRuns();
    const summary: UncertaintyMigrationSummary = { applied: true, praxisAnswers: answers.answered(), workbooks, runs };
    await migrations.insertOne({ _id: UNCERTAINTY_MIGRATION_ID, completedAt: new Date(), summary });
    for (const tally of workbooks) {
      this.logger.log(`${tally.collection}: ${tally.read} read, ${tally.converted} converted and backed up.`);
    }
    this.logger.log(`${RUNS_COLLECTION}: ${runs.read} read, ${runs.kept} kept, ${runs.moved} moved to ${BACKUP_COLLECTION}.`);
    this.logger.log(`PRAXIS answered ${answers.answered()} law questions.`);
    this.logger.log("The uncertainty contract migration finished.");
    return summary;
  }

  private loadDatasets(): DaDatasetIndex {
    if (this.datasets !== undefined) return this.datasets;
    const first = DA_SOURCE_CATALOG[0]?.dataset ?? "";
    const directory = DATASET_DIRECTORIES.find((candidate) => existsSync(join(candidate, first)));
    if (directory === undefined) {
      throw new Error("The DA datasets were not found. Run the migration from the repository root.");
    }
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

  private previousOf(record: StoredWorkbook): JsonRecord | undefined {
    const text = record.previousMefJson;
    if (typeof text !== "string" || text.length === 0) return undefined;
    try {
      return jsonRecordOf(text);
    } catch {
      this.logger.warn(`Workbook ${record.workbookId} keeps its previous MEF because it is not valid JSON.`);
      return undefined;
    }
  }

  private convertMef(element: WorkbookElement, mef: JsonRecord, record: StoredWorkbook, lookups: MigrationLookups, scope: ConversionScope): JsonRecord {
    switch (element) {
      case "SC":
        return convertScMef(mef, scope);
      case "DA":
        return convertDaMef(mef, { workbookId: record.workbookId, datasets: this.datasetsFor(mef) }, scope);
      case "SY":
        return convertSyMef(mef, lookups, scope, record.projectId);
      case "ESQ":
        return convertEsqMef(mef, lookups, scope);
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
      case "IE":
        return previousIeIssue(mef, owner);
      case "ES":
        return previousEsIssue(mef, owner);
      case "HAZARD":
        return hazardIssue(mef);
    }
  }

  private convertWorkbook(access: WorkbookAccess, record: StoredWorkbook, answers: PraxisAnswers, lookups: MigrationLookups): ConvertedWorkbook {
    const issues: string[] = [];
    const text = stringifyJson(record.mef ?? null);
    const stored = jsonRecordOf(text);
    let converted: ConvertedWorkbook = { mefChanged: false, previousChanged: false, issues };
    if (stored === undefined) {
      issues.push(`${access.collection} ${record.workbookId} holds no MEF object.`);
    } else {
      const scope = new ConversionScope(answers, `${access.collection} ${record.workbookId} mef`);
      const mef = this.convertMef(access.element, stored, record, lookups, scope);
      issues.push(...scope.issues);
      const issue = this.mefIssue(access.element, mef);
      if (issue !== undefined) issues.push(`${access.collection} ${record.workbookId} mef does not parse after conversion. ${issue}`);
      converted = { ...converted, mef, mefChanged: jsonTextOf(mef) !== text };
    }
    const previous = this.previousOf(record);
    if (previous !== undefined) {
      const scope = new ConversionScope(answers, `${access.collection} ${record.workbookId} previousMefJson`);
      const mef = this.convertMef(access.element, previous, record, lookups, scope);
      issues.push(...scope.issues);
      const issue = this.previousIssue(access.element, mef, record.ownerUsername);
      if (issue !== undefined) issues.push(`${access.collection} ${record.workbookId} previousMefJson does not parse after conversion. ${issue}`);
      const next = jsonTextOf(mef);
      converted = { ...converted, previous: next, previousChanged: next !== jsonTextOf(previous) };
    }
    return converted;
  }

  private remember(access: WorkbookAccess, record: StoredWorkbook, converted: ConvertedWorkbook, lookups: MutableLookups): void {
    const mef = converted.mef;
    const original = asJson(record.mef);
    if (mef === undefined || original === undefined) return;
    if (access.element === "SC") {
      lookups.scMissionTimes.set(record.workbookId, scMissionTimeIds(mef));
      lookups.scProjects.set(record.projectId, [...(lookups.scProjects.get(record.projectId) ?? []), record.workbookId]);
    } else if (access.element === "DA") {
      const facts = parsedDaFacts(mef);
      if (facts !== undefined) lookups.daParameters.set(record.workbookId, facts);
      lookups.daCcf.set(record.workbookId, daCcfFacts(original, mef));
    } else if (access.element === "SY") {
      lookups.syCcf.set(record.workbookId, syCcfFacts(original, mef));
    }
  }

  private async pass(answers: PraxisAnswers): Promise<{ lookups: MigrationLookups; issues: string[] }> {
    const lookups = emptyLookups();
    const issues: string[] = [];
    for (const access of this.accesses) {
      for (const id of await access.ids()) {
        const record = await access.read(id);
        if (record === null) continue;
        const converted = this.convertWorkbook(access, record, answers, lookups);
        issues.push(...converted.issues);
        this.remember(access, record, converted, lookups);
      }
    }
    return { lookups, issues };
  }

  private async settleAnswers(): Promise<PraxisAnswers> {
    const answers = new PraxisAnswers();
    for (let round = 0; round < MAX_PRAXIS_ROUNDS; round += 1) {
      await this.pass(answers);
      if (openQuestions(answers) === 0) return answers;
      await this.ask(answers.questions(), answers);
    }
    throw new Error(`The uncertainty contract migration stopped. PRAXIS questions were still open after ${MAX_PRAXIS_ROUNDS} rounds. Nothing was written.`);
  }

  private async ask(questions: PraxisQuestions, answers: PraxisAnswers): Promise<void> {
    recordAnswers(questions, await this.uncertaintyService.evaluate(questionRequest(questions)), answers);
    const open = openQuestions(answers);
    if (open > 0) throw new Error(`The uncertainty contract migration stopped. PRAXIS left ${open} questions unanswered. Nothing was written.`);
  }

  private async validate(answers: PraxisAnswers): Promise<MigrationLookups> {
    const { lookups, issues } = await this.pass(answers);
    const open = openQuestions(answers);
    if (open > 0) issues.push(`PRAXIS left ${open} questions unanswered.`);
    if (issues.length > 0) {
      for (const issue of issues) this.logger.error(issue);
      throw new Error(`The uncertainty contract migration stopped. ${issues.length} problems were found in the converted documents. Nothing was written. The first problem is this. ${issues[0]}`);
    }
    return lookups;
  }

  private async writeWorkbooks(access: WorkbookAccess, answers: PraxisAnswers, lookups: MigrationLookups): Promise<WorkbookTally> {
    let read = 0;
    let converted = 0;
    for (const id of await access.ids()) {
      const record = await access.read(id);
      if (record === null) continue;
      read += 1;
      const result = this.convertWorkbook(access, record, answers, lookups);
      if (result.issues.length > 0) {
        throw new Error(`The uncertainty contract migration stopped. ${result.issues[0]}`);
      }
      if (!result.mefChanged && !result.previousChanged) continue;
      const original = await access.original(record._id);
      if (original === null) throw new Error(`${access.collection} ${record.workbookId} disappeared during the migration.`);
      await this.connection.collection(BACKUP_COLLECTION).insertOne({
        migration: UNCERTAINTY_MIGRATION_ID,
        collection: access.collection,
        workbookId: record.workbookId,
        projectId: record.projectId,
        backedUpAt: new Date(),
        document: original,
      });
      const changes = {
        ...(result.mefChanged && result.mef !== undefined ? { mef: result.mef } : {}),
        ...(result.previousChanged && result.previous !== undefined ? { previousMefJson: result.previous } : {}),
      };
      if ((await access.update(record, changes)) !== 1) {
        throw new Error(`${access.collection} ${record.workbookId} changed during the migration. Run the migration again.`);
      }
      converted += 1;
    }
    return { collection: access.collection, read, converted };
  }

  private async migrateRuns(): Promise<RunTally> {
    const rows = await this.runModel.find({}, { _id: 1, id: 1, batchId: 1 }).sort({ _id: 1 }).lean<RunRow[]>().exec();
    const failing = new Map<string, string>();
    const owners = new Map<string, string>();
    for (const row of rows) {
      const run = await this.runModel.findOne({ _id: row._id }).lean<StoredRun>().exec();
      if (run === null) continue;
      const owner = run.owner?.workbookId;
      if (owner !== undefined) owners.set(row.id, owner);
      const issue = runIssue(run);
      if (issue !== undefined && !failing.has(groupOf(row))) failing.set(groupOf(row), issue);
    }
    let moved = 0;
    for (const row of rows) {
      const reason = failing.get(groupOf(row));
      if (reason === undefined) continue;
      const original = await this.runModel.collection.findOne({ _id: row._id });
      if (original === null) continue;
      await this.connection.collection(BACKUP_COLLECTION).insertOne({
        migration: UNCERTAINTY_MIGRATION_ID,
        collection: RUNS_COLLECTION,
        runId: row.id,
        workbookId: owners.get(row.id) ?? null,
        reason,
        backedUpAt: new Date(),
        document: original,
      });
      await this.runModel.collection.deleteOne({ _id: row._id });
      moved += 1;
    }
    if (moved > 0) this.logger.warn(`${moved} stored analysis runs fail the current schemas. They moved to ${BACKUP_COLLECTION}.`);
    return { read: rows.length, kept: rows.length - moved, moved };
  }
}

export { BACKUP_COLLECTION, MIGRATIONS_COLLECTION, UNCERTAINTY_MIGRATION_FLAG, UNCERTAINTY_MIGRATION_ID, runIssue };
export type { UncertaintyMigrationSummary };
