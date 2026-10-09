import { createHash, randomUUID } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { Logger } from "@nestjs/common";
import { getConnectionToken, getModelToken, MongooseModule } from "@nestjs/mongoose";
import { Test, type TestingModule } from "@nestjs/testing";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { Connection, Model } from "mongoose";
import { execute } from "praxis-node";
import { UncertainExpressionSchema } from "interfaces-mef-types/zod/core/uncertainty";
import { EventSequenceAnalysisSchema } from "interfaces-mef-types/zod/es/event-sequence-analysis";
import { SystemsAnalysisSchema } from "interfaces-mef-types/zod/sy/systems-analysis";
import { stringifyJson } from "interfaces-shared-types/json";
import {
  UncertaintyResponseSchema,
  type UncertaintyRequest,
  type UncertaintyResponse,
} from "interfaces-shared-types/newly-developed-methods/shared";
import { DaWorkbook, DaWorkbookSchema, type DaWorkbookDocument } from "../../da-workbooks/da-workbook.schema";
import { createBlankEs } from "../../es-workbooks/blank-es";
import { EsWorkbook, EsWorkbookSchema, type EsWorkbookDocument } from "../../es-workbooks/es-workbook.schema";
import { EsqWorkbook, EsqWorkbookSchema, type EsqWorkbookDocument } from "../../esq-workbooks/esq-workbook.schema";
import { ExternalFloodPraWorkbook, ExternalFloodPraWorkbookSchema } from "../../external-flood-pra-workbooks/external-flood-pra-workbook.schema";
import { HighWindsPraWorkbook, HighWindsPraWorkbookSchema } from "../../high-winds-pra-workbooks/high-winds-pra-workbook.schema";
import { createBlankIe } from "../../ie-workbooks/blank-ie";
import { IeWorkbook, IeWorkbookSchema, type IeWorkbookDocument } from "../../ie-workbooks/ie-workbook.schema";
import { InternalFirePraWorkbook, InternalFirePraWorkbookSchema } from "../../internal-fire-pra-workbooks/internal-fire-pra-workbook.schema";
import { InternalFloodPraWorkbook, InternalFloodPraWorkbookSchema } from "../../internal-flood-pra-workbooks/internal-flood-pra-workbook.schema";
import {
  AnalysisRunRecord,
  AnalysisRunRecordSchema,
  type AnalysisRunRecordDocument,
} from "../../newly-developed-methods/shared/analysis-run-record.schema";
import { UncertaintyService } from "../../newly-developed-methods/shared/uncertainty.service";
import { OtherHazardsPraWorkbook, OtherHazardsPraWorkbookSchema } from "../../other-hazards-pra-workbooks/other-hazards-pra-workbook.schema";
import { stripNulls } from "../../pos-workbooks/mef-normalize";
import { createBlankSc } from "../../sc-workbooks/blank-sc";
import { SeismicPraWorkbook, SeismicPraWorkbookSchema, type SeismicPraWorkbookDocument } from "../../seismic-pra-workbooks/seismic-pra-workbook.schema";
import { INLINE_PAYLOAD_BYTES, modelPayloadStore } from "../../storage/model-payload-store";
import { SyWorkbook, SyWorkbookSchema, type SyWorkbookDocument } from "../../sy-workbooks/sy-workbook.schema";
import {
  ConversionScope,
  PraxisAnswers,
  convertSyMef,
  daIssue,
  esIssue,
  esqIssue,
  field,
  hazardIssue,
  ieIssue,
  isRecord,
  jsonRecordOf,
  previousEsIssue,
  previousScIssue,
  previousSyIssue,
  scIssue,
  syIssue,
  without,
  type Json,
  type JsonRecord,
} from "../uncertainty-migration";
import {
  BACKUP_COLLECTION,
  MIGRATIONS_COLLECTION,
  UNCERTAINTY_MIGRATION_ID,
  UncertaintyMigrationService,
  type UncertaintyConversionSummary,
  type WorkbookTally,
} from "../uncertainty-migration.service";

const FIXTURES = jsonRecordOf(readFileSync(join(__dirname, "uncertainty-migration-fixtures.json"), "utf8"));

const PROJECT_ID = "project-uncertainty";

const OWNER = "migration-tester";

const WORKBOOK_COLLECTIONS: readonly string[] = [
  "sc_workbooks",
  "da_workbooks",
  "sy_workbooks",
  "esq_workbooks",
  "ie_workbooks",
  "es_workbooks",
  "seismic_pra_workbooks",
  "internal_fire_pra_workbooks",
  "internal_flood_pra_workbooks",
  "high_winds_pra_workbooks",
  "external_flood_pra_workbooks",
  "other_hazards_pra_workbooks",
];

const COMPONENT_VALUE_MESSAGE = "A component basic event keeps its value in the expression field";

type PraxisMode = "LIVE" | "DOWN" | "HANG";

function record(value: Json | undefined): JsonRecord {
  if (!isRecord(value)) throw new Error("Expected a JSON object.");
  return value;
}

function records(value: Json | undefined): JsonRecord[] {
  if (!Array.isArray(value)) throw new Error("Expected a JSON array.");
  return value.map(record);
}

function fixture(name: string): JsonRecord {
  return record(field(record(FIXTURES ?? null), name));
}

function asJson(value: object | null | undefined): JsonRecord {
  return record(jsonRecordOf(stringifyJson(value ?? null)) ?? null);
}

function byId(values: Json | undefined, key: string, id: string): JsonRecord {
  const found = records(values).find((candidate) => field(candidate, key) === id);
  if (found === undefined) throw new Error(`No record ${id}.`);
  return found;
}

function component(event: JsonRecord): boolean {
  const mode = field(event, "failureMode");
  return mode !== "HUMAN_ERROR" && mode !== "COMMON_CAUSE_FAILURE";
}

function scMef(name: string): JsonRecord {
  return { ...asJson(createBlankSc("SC Workbook", OWNER)), ...fixture(name) };
}

function ieMef(): JsonRecord {
  return { ...asJson(createBlankIe("IE Workbook", OWNER)), ...fixture("ie-records") };
}

function esMef(): JsonRecord {
  return { ...asJson(createBlankEs("ES Workbook", OWNER)), eventTrees: [fixture("es-event-tree")] };
}

function hazardMef(): JsonRecord {
  return { name: "Seismic PRA Workbook", owner: OWNER, hazardConditionedModels: fixture("hazard-models") };
}

function withHclSettings(sy: JsonRecord): JsonRecord {
  const configuration = records(field(fixture("sy-hcl"), "dependencyHclConfigurations"))[0] ?? {};
  const settings = { ...configuration, solverSettings: { ...record(field(configuration, "solverSettings")), uncertainty: fixture("hcl-sy-uncertainty") } };
  return { ...sy, dependencyHclConfigurations: [settings], dependencyBayesianNetworks: field(fixture("sy-hcl"), "dependencyBayesianNetworks") ?? [] };
}

function syHclMef(): JsonRecord {
  return withHclSettings(fixture("sy-hcl"));
}

function issuesOf(outcome: { success: boolean; error?: { issues: readonly { path: readonly PropertyKey[]; message: string }[] } }): string[] {
  return (outcome.error?.issues ?? []).map((issue) => `${issue.path.map(String).join(".")}: ${issue.message}`);
}

class InProcessUncertainty {
  calls = 0;
  mode: PraxisMode = "LIVE";

  evaluate(body: UncertaintyRequest): Promise<UncertaintyResponse> {
    this.calls += 1;
    if (this.mode === "DOWN") return Promise.reject(new Error("Unable to reach Praetor: fetch failed"));
    if (this.mode === "HANG") return new Promise<UncertaintyResponse>(() => undefined);
    const answer: Json = JSON.parse(execute(JSON.stringify({
      schemaVersion: "1.0.0",
      request: { schemaVersion: "1.0.0", methodType: "UNCERTAINTY", ...body },
      modelSnapshots: [],
    })));
    return Promise.resolve(UncertaintyResponseSchema.parse(without(record(field(record(answer), "result")), ["methodType"])));
  }
}

const CUSTOM_SOURCE = {
  id: "SRC-TYPED",
  name: "Typed vendor figures",
  kind: "GENERIC_NUCLEAR",
  origin: "OTHER_NUCLEAR",
  covers: "Vendor figures typed by the analyst",
  boundaryConvention: "",
  failureCounting: "",
  quality: "",
  reference: "",
  entries: [{ id: "V-FIT", component: "Circulator", failureMode: "Fails to run", quantity: "PER_HOUR", median: 0.0000075, p95: 0.000024 }],
};

function storedRun(workbookId: string, mef: JsonRecord, scope: "SINGLE" | "BATCH" | "SCENARIO", id: string, batchId: string | null, hostType = "SY"): JsonRecord {
  const at = new Date("2026-09-15T10:00:00.000Z");
  return {
    id,
    schemaVersion: "1.0.0",
    owner: { workbookId, modelId: randomUUID(), workbookRevision: 1 },
    sourceWorkbooks: [{ workbookId, workbookRevision: 1 }],
    methodType: hostType === "ES" ? "EVENT_TREE" : "FAULT_TREE",
    status: "FAILED",
    requestedBy: OWNER,
    requestedAt: at.toISOString(),
    startedAt: at.toISOString(),
    completedAt: at.toISOString(),
    engine: null,
    failure: { kind: "EXECUTION_ERROR", code: "PRAXIS_FAILED", message: "The solver stopped.", details: {} },
    scope,
    batchId,
    nativeRequest: null,
    request: { modelId: "model" },
    workbookSnapshots: [{ hostType, projectId: PROJECT_ID, identity: { workbookId, workbookRevision: 1 }, mef }],
    target: null,
    contributions: null,
    result: null,
  };
}

function tallyOf(summary: UncertaintyConversionSummary, collection: string): WorkbookTally {
  const tally = summary.workbooks.find((candidate) => candidate.collection === collection);
  if (tally === undefined) throw new Error(`No tally for ${collection}.`);
  return tally;
}

function totals(summary: UncertaintyConversionSummary): { current: number; converted: number; left: number } {
  return summary.workbooks.reduce((sum, tally) => ({ current: sum.current + tally.current, converted: sum.converted + tally.converted, left: sum.left + tally.left }), { current: 0, converted: 0, left: 0 });
}

describe("UncertaintyMigrationService", () => {
  let mongo: MongoMemoryServer;
  let moduleRef: TestingModule;
  let service: UncertaintyMigrationService;
  let connection: Connection;
  let syModel: Model<SyWorkbookDocument>;
  let daModel: Model<DaWorkbookDocument>;
  let esqModel: Model<EsqWorkbookDocument>;
  let ieModel: Model<IeWorkbookDocument>;
  let esModel: Model<EsWorkbookDocument>;
  let seismicModel: Model<SeismicPraWorkbookDocument>;
  let runModel: Model<AnalysisRunRecordDocument>;
  let warnings: jest.SpyInstance;
  let errors: jest.SpyInstance;
  const praxis = new InProcessUncertainty();

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongo.getUri()),
        MongooseModule.forFeature([
          { name: SyWorkbook.name, schema: SyWorkbookSchema },
          { name: DaWorkbook.name, schema: DaWorkbookSchema },
          { name: EsqWorkbook.name, schema: EsqWorkbookSchema },
          { name: IeWorkbook.name, schema: IeWorkbookSchema },
          { name: EsWorkbook.name, schema: EsWorkbookSchema },
          { name: SeismicPraWorkbook.name, schema: SeismicPraWorkbookSchema },
          { name: InternalFirePraWorkbook.name, schema: InternalFirePraWorkbookSchema },
          { name: InternalFloodPraWorkbook.name, schema: InternalFloodPraWorkbookSchema },
          { name: HighWindsPraWorkbook.name, schema: HighWindsPraWorkbookSchema },
          { name: ExternalFloodPraWorkbook.name, schema: ExternalFloodPraWorkbookSchema },
          { name: OtherHazardsPraWorkbook.name, schema: OtherHazardsPraWorkbookSchema },
          { name: AnalysisRunRecord.name, schema: AnalysisRunRecordSchema },
        ]),
      ],
      providers: [UncertaintyMigrationService, { provide: UncertaintyService, useValue: praxis }],
    }).compile();
    service = moduleRef.get(UncertaintyMigrationService);
    connection = moduleRef.get<Connection>(getConnectionToken());
    syModel = moduleRef.get<Model<SyWorkbookDocument>>(getModelToken(SyWorkbook.name));
    daModel = moduleRef.get<Model<DaWorkbookDocument>>(getModelToken(DaWorkbook.name));
    esqModel = moduleRef.get<Model<EsqWorkbookDocument>>(getModelToken(EsqWorkbook.name));
    ieModel = moduleRef.get<Model<IeWorkbookDocument>>(getModelToken(IeWorkbook.name));
    esModel = moduleRef.get<Model<EsWorkbookDocument>>(getModelToken(EsWorkbook.name));
    seismicModel = moduleRef.get<Model<SeismicPraWorkbookDocument>>(getModelToken(SeismicPraWorkbook.name));
    runModel = moduleRef.get<Model<AnalysisRunRecordDocument>>(getModelToken(AnalysisRunRecord.name));
  }, 120_000);

  afterAll(async () => {
    await moduleRef.close();
    await mongo.stop();
  }, 120_000);

  beforeEach(async () => {
    praxis.calls = 0;
    praxis.mode = "LIVE";
    warnings = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    errors = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    for (const name of [...WORKBOOK_COLLECTIONS, "method_analysis_runs", BACKUP_COLLECTION, MIGRATIONS_COLLECTION]) {
      await connection.collection(name).deleteMany({});
    }
  });

  afterEach(() => {
    warnings.mockRestore();
    errors.mockRestore();
  });

  function warned(): string[] {
    return warnings.mock.calls.map(([message]) => String(message));
  }

  function leftLines(): string[] {
    return warned().filter((line) => line.includes(" was left as stored. "));
  }

  async function seedSc(workbookId: string, name: string): Promise<void> {
    const at = new Date("2026-09-20T08:00:00.000Z");
    await connection.collection("sc_workbooks").insertOne({ workbookId, projectId: PROJECT_ID, ownerUsername: OWNER, mef: scMef(name), previousMefJson: stringifyJson(scMef(name)), createdAt: at, updatedAt: at });
  }

  async function seedProject(): Promise<void> {
    await seedSc("sc-wb", "sc-htgr");
    await seedSc("sc-sfr-wb", "sc-sfr");
    const daHtgr = fixture("da-htgr");
    const typed = { ...records(field(daHtgr, "parameters"))[0], uuid: "DA-TYPED-1", valueMode: "TYPED" };
    const typedCcf = records(field(fixture("da-records"), "ccfParameterEstimations"));
    await daModel.create({ workbookId: "da-wb", projectId: PROJECT_ID, ownerUsername: OWNER, revision: 4, mef: { ...daHtgr, sources: [...records(field(daHtgr, "sources")), CUSTOM_SOURCE], parameters: [...records(field(daHtgr, "parameters")), typed], ccfParameterEstimations: [...records(field(daHtgr, "ccfParameterEstimations")), ...typedCcf] } });
    await daModel.create({ workbookId: "da-sfr-wb", projectId: PROJECT_ID, ownerUsername: OWNER, revision: 2, mef: fixture("da-sfr") });
    await daModel.create({ workbookId: "da-hcl-wb", projectId: PROJECT_ID, ownerUsername: OWNER, mef: fixture("da-hcl") });
    await syModel.create({ workbookId: "sy-wb", projectId: PROJECT_ID, ownerUsername: OWNER, revision: 5, mef: fixture("sy-htgr"), previousMefJson: stringifyJson(fixture("sy-hcl")) });
    await syModel.create({ workbookId: "sy-sfr-wb", projectId: PROJECT_ID, ownerUsername: OWNER, revision: 3, mef: { ...fixture("sy-sfr"), linkedWorkbooks: { DA: "da-sfr-wb" } } });
    await syModel.create({ workbookId: "sy-hcl-wb", projectId: PROJECT_ID, ownerUsername: OWNER, mef: syHclMef() });
    const run = { runId: "UQ-1", revision: 1, at: "2026-09-01T00:00:00.000Z", inputs: "x", logic: { flags: true, loopBreaks: "AS_SET", exclusions: true, expandCcf: false }, trials: 100, seed: 1, method: "MONTE_CARLO", correlation: "SHARED", families: [{ familyId: "F-1", point: 1e-6, mean: 2e-6, standardDeviation: 3e-6, p05: 1e-7, p50: 1e-6, p95: 6e-6 }] };
    const esqHtgr = fixture("esq-htgr");
    await esqModel.create({ workbookId: "esq-wb", projectId: PROJECT_ID, ownerUsername: OWNER, revision: 7, mef: { ...esqHtgr, linkedWorkbooks: { ...record(field(esqHtgr, "linkedWorkbooks")), DA: "da-wb", SY: "sy-wb" }, uncertaintyWork: { ...record(field(esqHtgr, "uncertaintyWork")), run } } });
    const esqSfr = fixture("esq-sfr");
    await esqModel.create({ workbookId: "esq-sfr-wb", projectId: PROJECT_ID, ownerUsername: OWNER, mef: { ...esqSfr, linkedWorkbooks: { ...record(field(esqSfr, "linkedWorkbooks")), DA: "da-sfr-wb", SY: "sy-sfr-wb" } } });
    await esqModel.create({ workbookId: "esq-hcl-wb", projectId: PROJECT_ID, ownerUsername: OWNER, mef: { ...fixture("esq-hcl"), ...fixture("hcl-esq") } });
    await ieModel.create({ workbookId: "ie-wb", projectId: PROJECT_ID, ownerUsername: OWNER, mef: ieMef(), previousMefJson: stringifyJson(ieMef()) });
    await esModel.create({ workbookId: "es-wb", projectId: PROJECT_ID, ownerUsername: OWNER, revision: 6, mef: esMef(), previousMefJson: stringifyJson(esMef()) });
    await seismicModel.create({ workbookId: "seismic-wb", projectId: PROJECT_ID, ownerUsername: OWNER, mef: hazardMef() });
  }

  async function storedMef<T>(model: Model<T>, workbookId: string): Promise<JsonRecord> {
    const stored = await model.findOne({ workbookId }).lean<{ mef: object }>().exec();
    return asJson(stored?.mef);
  }

  async function rawWorkbook(collection: string, workbookId: string): Promise<string> {
    return stringifyJson(await connection.collection(collection).findOne({ workbookId })) ?? "";
  }

  async function rawDocuments(): Promise<string> {
    const all = await Promise.all([...WORKBOOK_COLLECTIONS, "method_analysis_runs"].map((name) => connection.collection(name).find({}, { sort: { _id: 1 } }).toArray()));
    return stringifyJson(all) ?? "";
  }

  it("converts every stored workbook at startup, keeps revisions and timestamps, and backs up the originals", async () => {
    await seedProject();
    const before = await syModel.findOne({ workbookId: "sy-wb" }).lean<{ revision: number; updatedAt: Date }>().exec();
    const ieBefore = await ieModel.findOne({ workbookId: "ie-wb" }).lean<{ updatedAt: Date }>().exec();
    await service.onApplicationBootstrap();

    expect(leftLines()).toEqual([]);
    for (const workbookId of ["sc-wb", "sc-sfr-wb"]) {
      const stored = await connection.collection("sc_workbooks").findOne({ workbookId });
      expect(scIssue(asJson(stored?.["mef"]))).toBeUndefined();
      expect(previousScIssue(record(jsonRecordOf(String(stored?.["previousMefJson"])) ?? null), OWNER)).toBeUndefined();
      expect(stored?.["updatedAt"]).toEqual(new Date("2026-09-20T08:00:00.000Z"));
    }
    for (const workbookId of ["sy-wb", "sy-sfr-wb", "sy-hcl-wb"]) expect(syIssue(await storedMef<SyWorkbookDocument>(syModel, workbookId))).toBeUndefined();
    for (const workbookId of ["da-wb", "da-sfr-wb", "da-hcl-wb"]) expect(daIssue(await storedMef<DaWorkbookDocument>(daModel, workbookId))).toBeUndefined();
    for (const workbookId of ["esq-wb", "esq-sfr-wb", "esq-hcl-wb"]) expect(esqIssue(await storedMef<EsqWorkbookDocument>(esqModel, workbookId))).toBeUndefined();
    expect(ieIssue(await storedMef<IeWorkbookDocument>(ieModel, "ie-wb"))).toBeUndefined();
    expect(esIssue(await storedMef<EsWorkbookDocument>(esModel, "es-wb"))).toBeUndefined();
    expect(hazardIssue(await storedMef<SeismicPraWorkbookDocument>(seismicModel, "seismic-wb"))).toBeUndefined();

    const after = await syModel.findOne({ workbookId: "sy-wb" }).lean<{ revision: number; updatedAt: Date; previousMefJson: string }>().exec();
    expect(after?.revision).toBe(5);
    expect(after?.updatedAt.toISOString()).toBe(before?.updatedAt.toISOString());
    expect(previousSyIssue(record(jsonRecordOf(after?.previousMefJson) ?? null), OWNER)).toBeUndefined();
    const ieAfter = await ieModel.findOne({ workbookId: "ie-wb" }).lean<{ updatedAt: Date; previousMefJson: string }>().exec();
    expect(ieAfter?.updatedAt.toISOString()).toBe(ieBefore?.updatedAt.toISOString());
    expect(ieIssue(record(jsonRecordOf(ieAfter?.previousMefJson) ?? null))).toBeUndefined();
    const esAfter = await esModel.findOne({ workbookId: "es-wb" }).lean<{ revision: number; previousMefJson: string }>().exec();
    expect(esAfter?.revision).toBe(6);
    expect(previousEsIssue(record(jsonRecordOf(esAfter?.previousMefJson) ?? null), OWNER)).toBeUndefined();

    const linked = await storedMef<SyWorkbookDocument>(syModel, "sy-wb");
    for (const event of records(field(fixture("sy-htgr"), "systemBasicEvents")).filter(component)) {
      const next = byId(field(linked, "systemBasicEvents"), "uuid", String(field(event, "uuid")));
      expect(UncertainExpressionSchema.parse(field(next, "expression"))).toEqual({ node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-wb", entityId: field(record(field(event, "controlledDataSource")), "entityId") } });
    }
    const systemTime = (mef: JsonRecord, id: string): Json | undefined => field(byId(field(mef, "systemDefinitions"), "uuid", id), "missionTime");
    expect(systemTime(linked, "SYS-SCS")).toEqual({ node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "sc-wb", entityId: "MT-PLOFC" } });
    expect(systemTime(linked, "SYS-RPS")).toEqual({ node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 24 } } });
    expect(field(byId(field(linked, "commonCauseFailureGroups"), "uuid", "CCF-RPS-DIV"), "factors")).toEqual({ model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: { node: "VALUE", law: { family: "DIRICHLET", concentrations: [880.1, 12.01] } } });
    const legacy = await storedMef<SyWorkbookDocument>(syModel, "sy-sfr-wb");
    expect(systemTime(legacy, "SYS-GUARD")).toEqual({ node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "sc-sfr-wb", entityId: "MT-RCB" } });
    for (const event of records(field(fixture("sy-sfr"), "systemBasicEvents")).filter(component)) {
      const next = byId(field(legacy, "systemBasicEvents"), "uuid", String(field(event, "uuid")));
      expect(UncertainExpressionSchema.parse(field(next, "expression"))).toEqual({ node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-sfr-wb", entityId: field(event, "dataAnalysisBasicEventRef") } });
    }

    const da = await storedMef<DaWorkbookDocument>(daModel, "da-wb");
    const fitted = records(field(byId(field(da, "sources"), "id", "SRC-TYPED"), "entries"))[0] ?? {};
    expect(record(field(fitted, "law"))).toMatchObject({ family: "LOGNORMAL", level: 0.95 });
    expect(praxis.calls).toBeGreaterThan(0);
    const tree = records(field(await storedMef<EsWorkbookDocument>(esModel, "es-wb"), "eventTrees"))[0] ?? {};
    expect(field(record(field(tree, "initiatingEventFrequency")), "expression")).toEqual({ node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-wb", entityId: "DA-IE-01" } });

    const backups = await connection.collection(BACKUP_COLLECTION).find({ collection: "sy_workbooks" }).toArray();
    expect(backups.map((backup) => backup["workbookId"]).sort()).toEqual(["sy-hcl-wb", "sy-sfr-wb", "sy-wb"]);
    const original = asJson(backups.find((backup) => backup["workbookId"] === "sy-wb")?.["document"]);
    expect(records(field(record(field(original, "mef")), "systemBasicEvents")).filter(component).every((event) => typeof field(event, "probability") === "number")).toBe(true);
    const counts = await Promise.all(["sc_workbooks", "da_workbooks", "esq_workbooks", "ie_workbooks", "es_workbooks", "seismic_pra_workbooks"].map((name) => connection.collection(BACKUP_COLLECTION).countDocuments({ collection: name })));
    expect(counts).toEqual([2, 3, 3, 1, 1, 1]);
    const scBackup = asJson((await connection.collection(BACKUP_COLLECTION).findOne({ collection: "sc_workbooks", workbookId: "sc-wb" }))?.["document"]);
    expect(field(records(field(record(field(scBackup, "mef")), "missionTimes"))[0] ?? {}, "missionTimeHours")).toBe(24);
    const ieBackup = asJson((await connection.collection(BACKUP_COLLECTION).findOne({ collection: "ie_workbooks" }))?.["document"]);
    expect(field(records(field(record(field(ieBackup, "mef")), "initiatingEventGroups"))[0] ?? {}, "meanFrequency")).toBeDefined();

    const audits = await connection.collection(MIGRATIONS_COLLECTION).find({ migration: UNCERTAINTY_MIGRATION_ID }).toArray();
    expect(audits).toHaveLength(1);
    const summary = record(field(asJson(audits[0]), "summary"));
    expect(records(field(summary, "workbooks")).map((tally) => [field(tally, "collection"), field(tally, "converted"), field(tally, "left")])).toEqual(
      WORKBOOK_COLLECTIONS.map((collection) => [collection, [2, 3, 3, 3, 1, 1, 1][WORKBOOK_COLLECTIONS.indexOf(collection)] ?? 0, 0]),
    );
  }, 120_000);

  it("changes nothing on a second start and does not ask PRAXIS again", async () => {
    await seedProject();
    await service.onApplicationBootstrap();
    const converted = await rawDocuments();
    const backups = await connection.collection(BACKUP_COLLECTION).countDocuments();
    const calls = praxis.calls;

    const again = await service.run();

    expect(praxis.calls).toBe(calls);
    expect(totals(again)).toEqual({ current: 14, converted: 0, left: 0 });
    expect(again.workbooks.map((tally) => tally.collection)).toEqual(WORKBOOK_COLLECTIONS);
    expect(again.runs).toMatchObject({ read: 0, moved: 0 });
    expect(await rawDocuments()).toBe(converted);
    expect(await connection.collection(BACKUP_COLLECTION).countDocuments()).toBe(backups);
    expect(await connection.collection(MIGRATIONS_COLLECTION).countDocuments({ migration: UNCERTAINTY_MIGRATION_ID })).toBe(2);
    expect(leftLines()).toEqual([]);
  }, 120_000);

  it("converts the stored shapes behind the reported load errors", async () => {
    await seedProject();
    const sy = fixture("sy-htgr");
    const controlled = records(field(sy, "systemBasicEvents")).findIndex((event) => component(event) && isRecord(field(event, "controlledDataSource")));
    const ref = String(field(record(field(records(field(sy, "systemBasicEvents"))[controlled] ?? {}, "controlledDataSource")), "entityId"));
    const typedRate = { uuid: "RATE-1", code: "RATE-1", name: "Typed rate", eventType: "BASIC", failureMode: "FAILURE_TO_RUN", probability: 0.0011, quantificationBasis: { kind: "FAILURE_RATE", failureRate: { value: 12, unit: "DAY" }, missionTime: { value: 12, unit: "HOUR" }, conversion: "EXPONENTIAL" }, repairModeled: false, implementsSrs: [] };
    const legacyRef = { uuid: "LEGACY-1", code: "LEGACY-1", name: "Legacy DA reference", eventType: "BASIC", failureMode: "FAILURE_TO_START", probability: 0.002, dataAnalysisBasicEventRef: ref, repairModeled: false, implementsSrs: [] };
    const reported = { ...sy, linkedWorkbooks: { DA: "da-wb" }, systemBasicEvents: [...records(field(sy, "systemBasicEvents")), typedRate, legacyRef] };
    await syModel.create({ workbookId: "sy-reported", projectId: PROJECT_ID, ownerUsername: OWNER, revision: 2, mef: reported });
    const valueTree = { ...fixture("es-event-tree"), uuid: "ET-VALUE", initiatingEventFrequency: { value: 0.02 } };
    await esModel.create({ workbookId: "es-reported", projectId: PROJECT_ID, ownerUsername: OWNER, revision: 2, mef: { ...esMef(), eventTrees: [...records(field(esMef(), "eventTrees")), valueTree] } });

    const events = records(field(reported, "systemBasicEvents"));
    const index = (id: string): number => events.findIndex((event) => field(event, "uuid") === id);
    const syBefore = issuesOf(SystemsAnalysisSchema.safeParse(stripNulls(reported)));
    expect(syBefore).toEqual(expect.arrayContaining([
      `systemBasicEvents.${index("RATE-1")}.probability: ${COMPONENT_VALUE_MESSAGE}`,
      `systemBasicEvents.${index("RATE-1")}.quantificationBasis: ${COMPONENT_VALUE_MESSAGE}`,
      `systemBasicEvents.${index("LEGACY-1")}.dataAnalysisBasicEventRef: ${COMPONENT_VALUE_MESSAGE}`,
      `systemBasicEvents.${controlled}.controlledDataSource: ${COMPONENT_VALUE_MESSAGE}`,
      `systemBasicEvents.${controlled}.probability: ${COMPONENT_VALUE_MESSAGE}`,
    ]));
    expect(syBefore.filter((issue) => issue.startsWith("commonCauseFailureGroups.0.factors") || issue.startsWith("commonCauseFailureGroups.0.total"))).toHaveLength(2);
    const esBefore = issuesOf(EventSequenceAnalysisSchema.safeParse(stripNulls({ ...esMef(), eventTrees: [valueTree] })));
    expect(esBefore.some((issue) => issue.startsWith("eventTrees.0.initiatingEventFrequency.expression: "))).toBe(true);
    expect(esBefore.some((issue) => issue.startsWith("eventTrees.0.initiatingEventFrequency: ") && issue.includes("value"))).toBe(true);

    await service.onApplicationBootstrap();

    expect(leftLines()).toEqual([]);
    const sySaved = await storedMef<SyWorkbookDocument>(syModel, "sy-reported");
    expect(syIssue(sySaved)).toBeUndefined();
    expect(field(byId(field(sySaved, "systemBasicEvents"), "uuid", "RATE-1"), "expression")).toEqual({ node: "MODEL", model: { form: "MISSION", rate: { node: "VALUE", value: { unit: "PER_HOUR", law: { family: "POINT", value: 0.5 } } }, missionTime: { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 12 } } } } });
    expect(field(byId(field(sySaved, "systemBasicEvents"), "uuid", "LEGACY-1"), "expression")).toEqual({ node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-wb", entityId: ref } });
    for (const group of records(field(sySaved, "commonCauseFailureGroups"))) {
      expect(field(group, "factors")).toBeDefined();
      expect(UncertainExpressionSchema.safeParse(field(group, "total")).success).toBe(true);
    }
    const esSaved = await storedMef<EsWorkbookDocument>(esModel, "es-reported");
    expect(esIssue(esSaved)).toBeUndefined();
    expect(byId(field(esSaved, "eventTrees"), "uuid", "ET-VALUE")["initiatingEventFrequency"]).toEqual({ expression: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POINT", value: 0.02 } } } });
  }, 120_000);

  it("converts workbooks saved between the first and second contract passes", async () => {
    await seedProject();
    await service.onApplicationBootstrap();
    const daFull = await storedMef<DaWorkbookDocument>(daModel, "da-wb");
    const syFull = await storedMef<SyWorkbookDocument>(syModel, "sy-wb");
    const esqFull = await storedMef<EsqWorkbookDocument>(esqModel, "esq-wb");
    const daOld = record(asJson((await connection.collection(BACKUP_COLLECTION).findOne({ collection: "da_workbooks", workbookId: "da-wb" }))?.["document"])["mef"]);
    const esqOld = record(asJson((await connection.collection(BACKUP_COLLECTION).findOne({ collection: "esq_workbooks", workbookId: "esq-wb" }))?.["document"])["mef"]);
    const syOld = fixture("sy-htgr");

    const oldParameter = (id: Json | undefined): JsonRecord => byId(field(daOld, "parameters"), "uuid", String(id));
    const daParameters = records(field(daFull, "parameters")).map((parameter) => {
      const old = oldParameter(field(parameter, "uuid"));
      if (field(parameter, "quantificationModel") === "FREQUENCY") return old;
      return field(old, "missionTimeHours") === undefined ? parameter : { ...parameter, missionTimeHours: field(old, "missionTimeHours") ?? null };
    });
    const oldEntries = new Map(records(field(daOld, "sources")).flatMap((source) => records(field(source, "entries")).map((entry) => [`${String(field(source, "id"))}/${String(field(entry, "id"))}`, entry] as const)));
    const daSources = records(field(daFull, "sources")).map((source) => ({
      ...source,
      entries: records(field(source, "entries")).map((entry) => (field(entry, "quantity") === "PER_YEAR" ? oldEntries.get(`${String(field(source, "id"))}/${String(field(entry, "id"))}`) ?? entry : entry)),
    }));
    const daBetween = {
      ...daFull,
      sources: daSources,
      parameters: daParameters,
      ccfParameterEstimations: field(daOld, "ccfParameterEstimations") ?? [],
    };
    expect(daIssue(daBetween)).toBeDefined();
    const syBetween = { ...syFull, commonCauseFailureGroups: field(syOld, "commonCauseFailureGroups") ?? [], systemDefinitions: field(syOld, "systemDefinitions") ?? [] };
    expect(syIssue(syBetween)).toBeDefined();
    const esqOldModel = record(field(esqOld, "model"));
    const esqModelFull = record(field(esqFull, "model"));
    const frequencyIds = new Set(records(field(esqModelFull, "parameters")).filter((parameter) => field(parameter, "quantificationModel") === "FREQUENCY").map((parameter) => String(field(parameter, "id"))));
    expect(frequencyIds.size).toBeGreaterThan(0);
    const oldParts = Object.fromEntries(["modelDecisions", "barrierWork"].flatMap((key) => (field(esqOld, key) === undefined ? [] : [[key, field(esqOld, key) ?? null]])));
    const esqBetween = {
      ...esqFull,
      model: {
        ...esqModelFull,
        trees: field(esqOldModel, "trees") ?? [],
        initiators: field(esqOldModel, "initiators") ?? [],
        ccfGroups: field(esqOldModel, "ccfGroups") ?? [],
        events: records(field(esqModelFull, "events")).map((event) => {
          const hours = field(byId(field(esqOldModel, "events"), "id", String(field(event, "id"))), "missionTimeHours");
          return hours === undefined || field(event, "expression") === undefined ? event : { ...event, missionTimeHours: hours };
        }),
        parameters: records(field(esqModelFull, "parameters")).map((parameter) => (frequencyIds.has(String(field(parameter, "id"))) ? { ...byId(field(esqOldModel, "parameters"), "id", String(field(parameter, "id"))), quantificationModel: "FREQUENCY" } : parameter)),
      },
      ...oldParts,
    };
    expect(esqIssue(esqBetween)).toBeDefined();
    await daModel.updateOne({ workbookId: "da-wb" }, { $set: { mef: daBetween } });
    await syModel.updateOne({ workbookId: "sy-wb" }, { $set: { mef: syBetween } });
    await esqModel.updateOne({ workbookId: "esq-wb" }, { $set: { mef: esqBetween } });

    const summary = await service.run();

    expect(leftLines()).toEqual([]);
    expect([tallyOf(summary, "da_workbooks").converted, tallyOf(summary, "sy_workbooks").converted, tallyOf(summary, "esq_workbooks").converted]).toEqual([1, 1, 1]);
    expect(await storedMef<DaWorkbookDocument>(daModel, "da-wb")).toEqual(daFull);
    expect(await storedMef<SyWorkbookDocument>(syModel, "sy-wb")).toEqual(syFull);
    expect(await storedMef<EsqWorkbookDocument>(esqModel, "esq-wb")).toEqual(esqFull);
  }, 120_000);

  it("converts what it can in a mixed database, leaves the rest untouched with one log line each, and still starts", async () => {
    await seedProject();
    await syModel.create({ workbookId: "sy-broken", projectId: PROJECT_ID, ownerUsername: OWNER, mef: without(fixture("sy-hcl"), ["systemDefinitions"]) });
    const odd = { ...records(field(fixture("da-records"), "ccfParameterEstimations"))[0], uuid: "DA-CCF-45", modelType: "OTHER_EQUIVALENT" };
    await daModel.create({ workbookId: "da-odd", projectId: PROJECT_ID, ownerUsername: OWNER, mef: { ...fixture("da-hcl"), ccfParameterEstimations: [odd] } });
    await syModel.create({ workbookId: "sy-on-odd", projectId: PROJECT_ID, ownerUsername: OWNER, mef: { ...fixture("sy-sfr"), linkedWorkbooks: { DA: "da-odd" } } });
    const untouched = await Promise.all([rawWorkbook("sy_workbooks", "sy-broken"), rawWorkbook("da_workbooks", "da-odd"), rawWorkbook("sy_workbooks", "sy-on-odd")]);

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();

    expect(leftLines().sort()).toEqual([
      "da_workbooks da-odd was left as stored. mef: DA common cause estimate DA-CCF-45 uses the OTHER_EQUIVALENT model, which has no exact factor model in the contract.",
      "sy_workbooks sy-broken was left as stored. mef does not parse after conversion. systemDefinitions: Invalid input: expected array, received undefined",
      "sy_workbooks sy-on-odd was left as stored. It links workbook da-odd, which could not be converted.",
    ]);
    expect(await Promise.all([rawWorkbook("sy_workbooks", "sy-broken"), rawWorkbook("da_workbooks", "da-odd"), rawWorkbook("sy_workbooks", "sy-on-odd")])).toEqual(untouched);
    expect(await connection.collection(BACKUP_COLLECTION).countDocuments({ workbookId: { $in: ["sy-broken", "da-odd", "sy-on-odd"] } })).toBe(0);
    for (const workbookId of ["sy-wb", "sy-sfr-wb", "sy-hcl-wb"]) expect(syIssue(await storedMef<SyWorkbookDocument>(syModel, workbookId))).toBeUndefined();
    for (const workbookId of ["da-wb", "da-sfr-wb", "da-hcl-wb"]) expect(daIssue(await storedMef<DaWorkbookDocument>(daModel, workbookId))).toBeUndefined();
    for (const workbookId of ["esq-wb", "esq-sfr-wb", "esq-hcl-wb"]) expect(esqIssue(await storedMef<EsqWorkbookDocument>(esqModel, workbookId))).toBeUndefined();
    const audit = await connection.collection(MIGRATIONS_COLLECTION).findOne({ migration: UNCERTAINTY_MIGRATION_ID });
    const tallies = records(field(record(field(asJson(audit), "summary")), "workbooks"));
    expect(byId(tallies, "collection", "sy_workbooks")).toMatchObject({ read: 5, current: 0, converted: 3, left: 2 });
    expect(byId(tallies, "collection", "da_workbooks")).toMatchObject({ read: 4, current: 0, converted: 3, left: 1 });

    warnings.mockClear();
    const again = await service.run();
    expect(totals(again)).toMatchObject({ converted: 0, left: 3 });
    expect(leftLines()).toHaveLength(3);
  }, 120_000);

  it("keeps the backend starting when the check itself stops", async () => {
    await seedProject();
    const rows = jest.spyOn(connection, "collection").mockImplementation(() => {
      throw new Error("The database went away.");
    });
    try {
      await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    } finally {
      rows.mockRestore();
    }
    expect(errors.mock.calls.map(([message]) => String(message))).toEqual(["The stored workbook check stopped. The database went away. The backend starts anyway."]);
  }, 120_000);

  it("bounds every PRAXIS wait, leaves the records that need an answer, and converts them at the next start", async () => {
    await seedSc("sc-wb", "sc-htgr");
    await daModel.create({ workbookId: "da-wb", projectId: PROJECT_ID, ownerUsername: OWNER, revision: 4, mef: fixture("da-htgr") });
    await daModel.create({ workbookId: "da-fit", projectId: PROJECT_ID, ownerUsername: OWNER, mef: { ...fixture("da-hcl"), sources: [...records(field(fixture("da-hcl"), "sources")), CUSTOM_SOURCE] } });
    await syModel.create({ workbookId: "sy-wb", projectId: PROJECT_ID, ownerUsername: OWNER, revision: 5, mef: withHclSettings(fixture("sy-htgr")) });
    await ieModel.create({ workbookId: "ie-wb", projectId: PROJECT_ID, ownerUsername: OWNER, mef: ieMef() });
    praxis.mode = "HANG";
    const started = Date.now();

    const first = await service.run({ praxisWaitMs: 200 });

    expect(Date.now() - started).toBeLessThan(30_000);
    expect(praxis.calls).toBe(1);
    expect(warned().filter((line) => line.startsWith("PRAXIS did not answer."))).toEqual(["PRAXIS did not answer. No answer came within 0.2 seconds. Workbooks that need its answers stay as stored until the next start."]);
    const left = leftLines().sort();
    expect(left).toHaveLength(3);
    expect(left[0]).toBe("da_workbooks da-fit was left as stored. mef: PRAXIS could not form the lognormal law of DA source entry V-FIT. PRAXIS did not answer. No answer came within 0.2 seconds.");
    expect(left[1]).toBe("ie_workbooks ie-wb was left as stored. mef: PRAXIS could not form the lognormal law of IE data source DS-1. PRAXIS did not answer. No answer came within 0.2 seconds.");
    expect(left[2]?.startsWith("sy_workbooks sy-wb was left as stored. mef: PRAXIS could not form the lognormal law of SY HCL configuration ")).toBe(true);
    expect(tallyOf(first, "da_workbooks")).toMatchObject({ converted: 1, left: 1 });
    expect(tallyOf(first, "sc_workbooks")).toMatchObject({ converted: 1, left: 0 });
    expect(daIssue(await storedMef<DaWorkbookDocument>(daModel, "da-wb"))).toBeUndefined();
    expect(await connection.collection(BACKUP_COLLECTION).countDocuments({ workbookId: { $in: ["da-fit", "sy-wb", "ie-wb"] } })).toBe(0);

    praxis.mode = "LIVE";
    warnings.mockClear();
    const second = await service.run();

    expect(leftLines()).toEqual([]);
    expect(tallyOf(second, "da_workbooks")).toMatchObject({ current: 1, converted: 1, left: 0 });
    expect(tallyOf(second, "sy_workbooks")).toMatchObject({ converted: 1, left: 0 });
    expect(tallyOf(second, "ie_workbooks")).toMatchObject({ converted: 1, left: 0 });
    const sy = await storedMef<SyWorkbookDocument>(syModel, "sy-wb");
    expect(syIssue(sy)).toBeUndefined();
    expect(field(byId(field(sy, "commonCauseFailureGroups"), "uuid", "CCF-RPS-DIV"), "factors")).toEqual({ model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: { node: "VALUE", law: { family: "DIRICHLET", concentrations: [880.1, 12.01] } } });

    praxis.mode = "DOWN";
    await daModel.create({ workbookId: "da-down", projectId: PROJECT_ID, ownerUsername: OWNER, mef: { ...fixture("da-hcl"), sources: [...records(field(fixture("da-hcl"), "sources")), CUSTOM_SOURCE] } });
    warnings.mockClear();
    const third = await service.run();
    expect(tallyOf(third, "da_workbooks")).toMatchObject({ left: 1 });
    expect(warned().filter((line) => line.startsWith("PRAXIS did not answer."))).toEqual(["PRAXIS did not answer. Unable to reach Praetor: fetch failed. Workbooks that need its answers stay as stored until the next start."]);
  }, 120_000);

  it("moves stored runs that fail the current schemas, keeps the rest, and checks each run once", async () => {
    const current = convertSyMef(fixture("sy-hcl"), { daParameters: new Map(), daCcf: new Map(), syCcf: new Map(), scMissionTimes: new Map(), scProjects: new Map() }, new ConversionScope(new PraxisAnswers(), "test"), PROJECT_ID);
    const old = fixture("sy-htgr");
    const kept = randomUUID();
    const stale = randomUUID();
    const batch = randomUUID();
    const scenario = randomUUID();
    const tree = randomUUID();
    const hcl = randomUUID();
    await runModel.create(storedRun("sy-wb", current, "SINGLE", kept, null));
    await runModel.create(storedRun("sy-wb", old, "SINGLE", stale, null));
    await runModel.create(storedRun("sy-wb", current, "BATCH", batch, null));
    await runModel.create(storedRun("sy-wb", old, "SCENARIO", scenario, batch));
    await runModel.create(storedRun("es-wb", esMef(), "SINGLE", tree, null, "ES"));
    const configuration = records(field(current, "dependencyHclConfigurations"))[0] ?? {};
    const staleSettings = { ...current, dependencyHclConfigurations: [{ ...configuration, solverSettings: { ...record(field(configuration, "solverSettings")), uncertainty: fixture("hcl-sy-uncertainty") } }] };
    await runModel.create(storedRun("sy-hcl-wb", staleSettings, "SINGLE", hcl, null));

    const summary = await service.run();

    expect(summary.runs).toMatchObject({ read: 6, kept: 1, moved: 5 });
    const live = await connection.collection("method_analysis_runs").find({}).toArray();
    expect(live.map((run) => run["id"])).toEqual([kept]);
    const moved = await connection.collection(BACKUP_COLLECTION).find({ collection: "method_analysis_runs" }).toArray();
    expect(moved.map((backup) => backup["runId"]).sort()).toEqual([stale, batch, scenario, tree, hcl].sort());
    expect(moved.every((backup) => typeof backup["workbookId"] === "string" && typeof backup["reason"] === "string")).toBe(true);
    expect(String(moved.find((backup) => backup["runId"] === hcl)?.["reason"])).toContain("uncertainty settings do not parse");

    const again = await service.run();
    expect(again.runs).toMatchObject({ read: 0, kept: 0, moved: 0 });
    const later = randomUUID();
    await runModel.create(storedRun("sy-wb", old, "SINGLE", later, null));
    const third = await service.run();
    expect(third.runs).toMatchObject({ read: 1, kept: 0, moved: 1 });
  }, 120_000);

  it("converts workbook payloads held in MinIO and keeps the old object for the backup", async () => {
    const objects = new Map<string, string>();
    const put = jest.spyOn(modelPayloadStore, "put").mockImplementation((value) => {
      const text = stringifyJson(value);
      if (text === undefined || Buffer.byteLength(text) < INLINE_PAYLOAD_BYTES) return Promise.resolve(undefined);
      const sha256 = createHash("sha256").update(text).digest("hex");
      const key = `v1/${sha256}.json.gz`;
      objects.set(key, text);
      return Promise.resolve({ format: "json-gzip-v1", key, sha256, bytes: Buffer.byteLength(text) });
    });
    const get = jest.spyOn(modelPayloadStore, "get").mockImplementation(({ key }) => {
      const text = objects.get(key);
      if (text === undefined) return Promise.reject(new Error("Missing object"));
      const value: Json = JSON.parse(text);
      return Promise.resolve(value);
    });
    try {
      await syModel.create({ workbookId: "sy-large", projectId: PROJECT_ID, ownerUsername: OWNER, revision: 2, mef: { ...fixture("sy-htgr"), praScope: "Full scope. ".repeat(110_000) } });
      await esModel.create({ workbookId: "es-large", projectId: PROJECT_ID, ownerUsername: OWNER, revision: 3, mef: { ...esMef(), praScope: "Full scope. ".repeat(110_000) } });
      await esqModel.create({ workbookId: "esq-large", projectId: PROJECT_ID, ownerUsername: OWNER, revision: 2, mef: { ...fixture("esq-htgr"), linkedWorkbooks: { ...record(field(fixture("esq-htgr"), "linkedWorkbooks")), SY: "sy-large" }, praScope: "Full scope. ".repeat(110_000) } });
      const before = await connection.collection("sy_workbooks").findOne({ workbookId: "sy-large" });
      const oldKey = asJson(before?.["modelPayloadReferences"]);
      expect(field(record(field(oldKey, "mef")), "format")).toBe("json-gzip-v1");

      const summary = await service.run();

      expect(tallyOf(summary, "sy_workbooks").converted).toBe(1);
      expect(tallyOf(summary, "es_workbooks").converted).toBe(1);
      expect(tallyOf(summary, "esq_workbooks").converted).toBe(1);
      const after = await connection.collection("sy_workbooks").findOne({ workbookId: "sy-large" });
      const newKey = asJson(after?.["modelPayloadReferences"]);
      expect(field(record(field(newKey, "mef")), "key")).not.toBe(field(record(field(oldKey, "mef")), "key"));
      expect(objects.has(String(field(record(field(oldKey, "mef")), "key")))).toBe(true);
      expect(syIssue(await storedMef<SyWorkbookDocument>(syModel, "sy-large"))).toBeUndefined();
      expect(esIssue(await storedMef<EsWorkbookDocument>(esModel, "es-large"))).toBeUndefined();
      const backup = await connection.collection(BACKUP_COLLECTION).findOne({ workbookId: "sy-large" });
      expect(field(asJson(backup?.["document"]), "modelPayloadReferences")).toEqual(oldKey);
      const esqFirst = await storedMef<EsqWorkbookDocument>(esqModel, "esq-large");
      expect(records(field(record(field(esqFirst, "model")), "ccfGroups")).some((group) => field(group, "factors") !== undefined)).toBe(true);

      await esqModel.updateOne({ workbookId: "esq-large" }, { $set: { mef: { ...fixture("esq-htgr"), linkedWorkbooks: { ...record(field(fixture("esq-htgr"), "linkedWorkbooks")), SY: "sy-large" }, praScope: "Full scope. ".repeat(110_000) } } });
      const fromBackup = await service.run();
      expect(tallyOf(fromBackup, "esq_workbooks").converted).toBe(1);
      expect(await storedMef<EsqWorkbookDocument>(esqModel, "esq-large")).toEqual(esqFirst);
    } finally {
      put.mockRestore();
      get.mockRestore();
    }
  }, 120_000);

  it("leaves an SC workbook that changes between reading and writing and converts it at the next start", async () => {
    await seedSc("sc-wb", "sc-htgr");
    const backups = connection.collection(BACKUP_COLLECTION);
    const insert = backups.insertOne.bind(backups);
    const spy = jest.spyOn(backups, "insertOne").mockImplementation(async (document, options) => {
      const result = await insert(document, options);
      await connection.collection("sc_workbooks").updateOne({ workbookId: "sc-wb" }, { $set: { updatedAt: new Date("2030-01-01T00:00:00.000Z") } });
      return result;
    });
    try {
      const summary = await service.run();
      expect(tallyOf(summary, "sc_workbooks")).toMatchObject({ converted: 0, left: 1 });
      expect(leftLines()).toEqual(["sc_workbooks sc-wb was left as stored. It changed while it was being converted. It converts at the next start."]);
      const stored = await connection.collection("sc_workbooks").findOne({ workbookId: "sc-wb" });
      expect(field(records(field(asJson(stored?.["mef"]), "missionTimes"))[0] ?? {}, "missionTimeHours")).toBe(24);
    } finally {
      spy.mockRestore();
    }
    const next = await service.run();
    expect(tallyOf(next, "sc_workbooks")).toMatchObject({ converted: 1, left: 0 });
  }, 120_000);

  it("leaves a workbook without revisions that changes between reading and writing", async () => {
    await ieModel.create({ workbookId: "ie-wb", projectId: PROJECT_ID, ownerUsername: OWNER, mef: ieMef() });
    const backups = connection.collection(BACKUP_COLLECTION);
    const insert = backups.insertOne.bind(backups);
    const spy = jest.spyOn(backups, "insertOne").mockImplementation(async (document, options) => {
      const result = await insert(document, options);
      await connection.collection("ie_workbooks").updateOne({ workbookId: "ie-wb" }, { $set: { updatedAt: new Date("2030-01-01T00:00:00.000Z") } });
      return result;
    });
    try {
      const summary = await service.run();
      expect(tallyOf(summary, "ie_workbooks")).toMatchObject({ converted: 0, left: 1 });
      const stored = await ieModel.findOne({ workbookId: "ie-wb" }).lean<{ mef: object }>().exec();
      expect(field(records(field(asJson(stored?.mef), "initiatingEventGroups"))[0] ?? {}, "meanFrequency")).toBeDefined();
    } finally {
      spy.mockRestore();
    }
  }, 120_000);
});
