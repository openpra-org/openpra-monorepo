import { createHash, randomUUID } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { getConnectionToken, getModelToken, MongooseModule } from "@nestjs/mongoose";
import { Test, type TestingModule } from "@nestjs/testing";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { Connection, Model } from "mongoose";
import { execute } from "praxis-node";
import { UncertainExpressionSchema } from "interfaces-mef-types/zod/core/uncertainty";
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
  UNCERTAINTY_MIGRATION_FLAG,
  UNCERTAINTY_MIGRATION_ID,
  UncertaintyMigrationService,
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

function syHclMef(): JsonRecord {
  const sy = fixture("sy-hcl");
  const configuration = records(field(sy, "dependencyHclConfigurations"))[0] ?? {};
  return { ...sy, dependencyHclConfigurations: [{ ...configuration, solverSettings: { ...record(field(configuration, "solverSettings")), uncertainty: fixture("hcl-sy-uncertainty") } }] };
}

class InProcessUncertainty {
  calls = 0;

  evaluate(body: UncertaintyRequest): Promise<UncertaintyResponse> {
    this.calls += 1;
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
  const praxis = new InProcessUncertainty();
  const flag = process.env[UNCERTAINTY_MIGRATION_FLAG];

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
    if (flag === undefined) delete process.env[UNCERTAINTY_MIGRATION_FLAG];
    else process.env[UNCERTAINTY_MIGRATION_FLAG] = flag;
    await moduleRef.close();
    await mongo.stop();
  }, 120_000);

  beforeEach(async () => {
    process.env[UNCERTAINTY_MIGRATION_FLAG] = "true";
    praxis.calls = 0;
    for (const name of [...WORKBOOK_COLLECTIONS, "method_analysis_runs", BACKUP_COLLECTION, MIGRATIONS_COLLECTION]) {
      await connection.collection(name).deleteMany({});
    }
  });

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

  async function rawDocuments(): Promise<string> {
    const all = await Promise.all([...WORKBOOK_COLLECTIONS, "method_analysis_runs"].map((name) => connection.collection(name).find({}, { sort: { _id: 1 } }).toArray()));
    return stringifyJson(all) ?? "";
  }

  it("waits for the opt-in flag", async () => {
    await seedProject();
    const before = await rawDocuments();
    delete process.env[UNCERTAINTY_MIGRATION_FLAG];
    await service.onApplicationBootstrap();
    process.env[UNCERTAINTY_MIGRATION_FLAG] = "false";
    await service.onApplicationBootstrap();
    expect(await rawDocuments()).toBe(before);
    expect(await connection.collection(MIGRATIONS_COLLECTION).countDocuments()).toBe(0);
    expect(await connection.collection(BACKUP_COLLECTION).countDocuments()).toBe(0);
  }, 120_000);

  it("converts every stored workbook, keeps revisions and timestamps, and backs up the originals", async () => {
    await seedProject();
    const before = await syModel.findOne({ workbookId: "sy-wb" }).lean<{ revision: number; updatedAt: Date }>().exec();
    const ieBefore = await ieModel.findOne({ workbookId: "ie-wb" }).lean<{ updatedAt: Date }>().exec();
    await service.onApplicationBootstrap();

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
      const next = records(field(linked, "systemBasicEvents")).find((candidate) => field(candidate, "uuid") === field(event, "uuid")) ?? {};
      expect(UncertainExpressionSchema.parse(field(next, "expression"))).toEqual({ node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-wb", entityId: field(record(field(event, "controlledDataSource")), "entityId") } });
    }
    const systemTime = (mef: JsonRecord, id: string): Json | undefined => field(records(field(mef, "systemDefinitions")).find((candidate) => field(candidate, "uuid") === id) ?? {}, "missionTime");
    expect(systemTime(linked, "SYS-SCS")).toEqual({ node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "sc-wb", entityId: "MT-PLOFC" } });
    expect(systemTime(linked, "SYS-RPS")).toEqual({ node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 24 } } });
    const group = records(field(linked, "commonCauseFailureGroups")).find((candidate) => field(candidate, "uuid") === "CCF-RPS-DIV") ?? {};
    expect(field(group, "factors")).toEqual({ model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: { node: "VALUE", law: { family: "DIRICHLET", concentrations: [880.1, 12.01] } } });
    const legacy = await storedMef<SyWorkbookDocument>(syModel, "sy-sfr-wb");
    expect(systemTime(legacy, "SYS-GUARD")).toEqual({ node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "sc-sfr-wb", entityId: "MT-RCB" } });
    for (const event of records(field(fixture("sy-sfr"), "systemBasicEvents")).filter(component)) {
      const next = records(field(legacy, "systemBasicEvents")).find((candidate) => field(candidate, "uuid") === field(event, "uuid")) ?? {};
      expect(UncertainExpressionSchema.parse(field(next, "expression"))).toEqual({ node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-sfr-wb", entityId: field(event, "dataAnalysisBasicEventRef") } });
    }

    const da = await storedMef<DaWorkbookDocument>(daModel, "da-wb");
    const fitted = records(field(records(field(da, "sources")).find((source) => field(source, "id") === "SRC-TYPED") ?? {}, "entries"))[0] ?? {};
    expect(record(field(fitted, "law"))).toMatchObject({ family: "LOGNORMAL", level: 0.95 });
    expect(praxis.calls).toBe(2);
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

    const recorded = await connection.collection(MIGRATIONS_COLLECTION).findOne({ completedAt: { $exists: true } });
    expect(recorded?.["_id"]).toBe(UNCERTAINTY_MIGRATION_ID);
  }, 120_000);

  it("changes nothing on a second run", async () => {
    await seedProject();
    await service.onApplicationBootstrap();
    const migrated = await rawDocuments();
    const backups = await connection.collection(BACKUP_COLLECTION).countDocuments();
    expect((await service.run()).applied).toBe(false);
    await connection.collection(MIGRATIONS_COLLECTION).deleteMany({});
    const again = await service.run();
    expect(again.workbooks.map((tally) => tally.collection)).toEqual(WORKBOOK_COLLECTIONS);
    expect(again.workbooks.map((tally) => tally.converted)).toEqual(WORKBOOK_COLLECTIONS.map(() => 0));
    expect(again.runs.moved).toBe(0);
    expect(await rawDocuments()).toBe(migrated);
    expect(await connection.collection(BACKUP_COLLECTION).countDocuments()).toBe(backups);
  }, 120_000);

  it("moves stored runs that fail the current schemas and keeps the rest", async () => {
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

    expect(summary.runs).toEqual({ read: 6, kept: 1, moved: 5 });
    const live = await connection.collection("method_analysis_runs").find({}).toArray();
    expect(live.map((run) => run["id"])).toEqual([kept]);
    const moved = await connection.collection(BACKUP_COLLECTION).find({ collection: "method_analysis_runs" }).toArray();
    expect(moved.map((backup) => backup["runId"]).sort()).toEqual([stale, batch, scenario, tree, hcl].sort());
    expect(moved.every((backup) => typeof backup["workbookId"] === "string" && typeof backup["reason"] === "string")).toBe(true);
    expect(String(moved.find((backup) => backup["runId"] === hcl)?.["reason"])).toContain("uncertainty settings do not parse");
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
      const before = await connection.collection("sy_workbooks").findOne({ workbookId: "sy-large" });
      const oldKey = asJson(before?.["modelPayloadReferences"]);
      expect(field(record(field(oldKey, "mef")), "format")).toBe("json-gzip-v1");

      const summary = await service.run();

      expect(summary.workbooks.find((tally) => tally.collection === "sy_workbooks")?.converted).toBe(1);
      expect(summary.workbooks.find((tally) => tally.collection === "es_workbooks")?.converted).toBe(1);
      const after = await connection.collection("sy_workbooks").findOne({ workbookId: "sy-large" });
      const newKey = asJson(after?.["modelPayloadReferences"]);
      expect(field(record(field(newKey, "mef")), "key")).not.toBe(field(record(field(oldKey, "mef")), "key"));
      expect(objects.has(String(field(record(field(oldKey, "mef")), "key")))).toBe(true);
      expect(syIssue(await storedMef<SyWorkbookDocument>(syModel, "sy-large"))).toBeUndefined();
      expect(esIssue(await storedMef<EsWorkbookDocument>(esModel, "es-large"))).toBeUndefined();
      const backup = await connection.collection(BACKUP_COLLECTION).findOne({ workbookId: "sy-large" });
      expect(field(asJson(backup?.["document"]), "modelPayloadReferences")).toEqual(oldKey);
    } finally {
      put.mockRestore();
      get.mockRestore();
    }
  }, 120_000);

  it("fails loudly and records nothing when a converted document does not parse", async () => {
    await seedProject();
    await syModel.create({ workbookId: "sy-broken", projectId: PROJECT_ID, ownerUsername: OWNER, mef: without(fixture("sy-hcl"), ["systemDefinitions"]) });
    const before = await rawDocuments();

    await expect(service.run()).rejects.toThrow("sy_workbooks sy-broken mef does not parse after conversion");

    expect(await rawDocuments()).toBe(before);
    expect(await connection.collection(MIGRATIONS_COLLECTION).countDocuments()).toBe(0);
    expect(await connection.collection(BACKUP_COLLECTION).countDocuments()).toBe(0);
  }, 120_000);

  it("writes nothing when a stored value has no exact contract form", async () => {
    await seedProject();
    const odd = { ...records(field(fixture("da-records"), "ccfParameterEstimations"))[0], uuid: "DA-CCF-45", modelType: "OTHER_EQUIVALENT" };
    await daModel.create({ workbookId: "da-odd", projectId: PROJECT_ID, ownerUsername: OWNER, mef: { ...fixture("da-hcl"), ccfParameterEstimations: [odd] } });
    const before = await rawDocuments();

    await expect(service.run()).rejects.toThrow("da_workbooks da-odd mef: DA common cause estimate DA-CCF-45 uses the OTHER_EQUIVALENT model, which has no exact factor model in the contract.");

    expect(await rawDocuments()).toBe(before);
    expect(await connection.collection(BACKUP_COLLECTION).countDocuments()).toBe(0);
  }, 120_000);

  it("stops when an SC workbook changes between reading and writing", async () => {
    await seedSc("sc-wb", "sc-htgr");
    const backups = connection.collection(BACKUP_COLLECTION);
    const insert = backups.insertOne.bind(backups);
    const spy = jest.spyOn(backups, "insertOne").mockImplementation(async (document, options) => {
      const result = await insert(document, options);
      await connection.collection("sc_workbooks").updateOne({ workbookId: "sc-wb" }, { $set: { updatedAt: new Date("2030-01-01T00:00:00.000Z") } });
      return result;
    });
    try {
      await expect(service.run()).rejects.toThrow("sc_workbooks sc-wb changed during the migration. Run the migration again.");
      const stored = await connection.collection("sc_workbooks").findOne({ workbookId: "sc-wb" });
      expect(field(records(field(asJson(stored?.["mef"]), "missionTimes"))[0] ?? {}, "missionTimeHours")).toBe(24);
      expect(await connection.collection(MIGRATIONS_COLLECTION).countDocuments()).toBe(0);
    } finally {
      spy.mockRestore();
    }
  }, 120_000);

  it("stops when a workbook without revisions changes between reading and writing", async () => {
    await ieModel.create({ workbookId: "ie-wb", projectId: PROJECT_ID, ownerUsername: OWNER, mef: ieMef() });
    const backups = connection.collection(BACKUP_COLLECTION);
    const insert = backups.insertOne.bind(backups);
    const spy = jest.spyOn(backups, "insertOne").mockImplementation(async (document, options) => {
      const result = await insert(document, options);
      await connection.collection("ie_workbooks").updateOne({ workbookId: "ie-wb" }, { $set: { updatedAt: new Date("2030-01-01T00:00:00.000Z") } });
      return result;
    });
    try {
      await expect(service.run()).rejects.toThrow("ie_workbooks ie-wb changed during the migration. Run the migration again.");
      const stored = await ieModel.findOne({ workbookId: "ie-wb" }).lean<{ mef: object }>().exec();
      expect(field(records(field(asJson(stored?.mef), "initiatingEventGroups"))[0] ?? {}, "meanFrequency")).toBeDefined();
      expect(await connection.collection(MIGRATIONS_COLLECTION).countDocuments()).toBe(0);
    } finally {
      spy.mockRestore();
    }
  }, 120_000);
});
