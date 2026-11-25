import { Logger } from "@nestjs/common";
import { getConnectionToken, getModelToken, MongooseModule } from "@nestjs/mongoose";
import { Test, type TestingModule } from "@nestjs/testing";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { Connection, Model } from "mongoose";
import { esqStableId } from "interfaces-mef-types/esq/esq-run-inputs";
import { EventSequenceAnalysisSchema } from "interfaces-mef-types/zod/es/event-sequence-analysis";
import { EventSequenceQuantificationSchema } from "interfaces-mef-types/zod/esq/event-sequence-quantification";
import { HclUncertaintySettingsSchema } from "interfaces-mef-types/zod/modeling";
import { SystemsAnalysisSchema } from "interfaces-mef-types/zod/sy/systems-analysis";
import { stringifyJson } from "interfaces-shared-types/json";
import { DaWorkbook, DaWorkbookSchema } from "../../da-workbooks/da-workbook.schema";
import { createBlankEs } from "../../es-workbooks/blank-es";
import { EsWorkbook, EsWorkbookSchema, type EsWorkbookDocument } from "../../es-workbooks/es-workbook.schema";
import { createBlankEsq } from "../../esq-workbooks/blank-esq";
import { normalizeEsqMef } from "../../esq-workbooks/esq-mef-normalize";
import { EsqWorkbook, EsqWorkbookSchema, type EsqWorkbookDocument } from "../../esq-workbooks/esq-workbook.schema";
import { createExampleDependencyEventTree, createExampleDependencyNetwork, createExampleHclConfiguration, EXAMPLE_DEPENDENCY_IDS } from "../../example-workbooks/seeds/dependency-model-seed";
import { ExternalFloodPraWorkbook, ExternalFloodPraWorkbookSchema } from "../../external-flood-pra-workbooks/external-flood-pra-workbook.schema";
import { HighWindsPraWorkbook, HighWindsPraWorkbookSchema } from "../../high-winds-pra-workbooks/high-winds-pra-workbook.schema";
import { HrWorkbook, HrWorkbookSchema } from "../../hr-workbooks/hr-workbook.schema";
import { IeWorkbook, IeWorkbookSchema } from "../../ie-workbooks/ie-workbook.schema";
import { InternalFirePraWorkbook, InternalFirePraWorkbookSchema } from "../../internal-fire-pra-workbooks/internal-fire-pra-workbook.schema";
import { InternalFloodPraWorkbook, InternalFloodPraWorkbookSchema } from "../../internal-flood-pra-workbooks/internal-flood-pra-workbook.schema";
import { AnalysisRunRecord, AnalysisRunRecordSchema } from "../../newly-developed-methods/shared/analysis-run-record.schema";
import { UncertaintyService } from "../../newly-developed-methods/shared/uncertainty.service";
import { OtherHazardsPraWorkbook, OtherHazardsPraWorkbookSchema } from "../../other-hazards-pra-workbooks/other-hazards-pra-workbook.schema";
import { stripNulls } from "../../pos-workbooks/mef-normalize";
import { SeismicPraWorkbook, SeismicPraWorkbookSchema } from "../../seismic-pra-workbooks/seismic-pra-workbook.schema";
import { createBlankSy } from "../../sy-workbooks/blank-sy";
import { SyWorkbook, SyWorkbookSchema, type SyWorkbookDocument } from "../../sy-workbooks/sy-workbook.schema";
import { EsNetworkMigrationService } from "../es-network-migration.service";
import { SY_NETWORK_MIGRATION_ID, SyNetworkMigrationService } from "../sy-network-migration.service";
import { field, isRecord, jsonRecordOf, type Json, type JsonRecord } from "../uncertainty-migration-json";
import { BACKUP_COLLECTION, MIGRATIONS_COLLECTION, UNCERTAINTY_MIGRATION_ID, UncertaintyMigrationService } from "../uncertainty-migration.service";

const OWNER = "migration-tester";
const PROJECT = "project-networks";
const SY = "sy-wb";
const ESQ = "esq-wb";
const ES = "es-wb";
const IDS = EXAMPLE_DEPENDENCY_IDS;
const COLLECTIONS: readonly string[] = ["sy_workbooks", "esq_workbooks", "es_workbooks", BACKUP_COLLECTION, MIGRATIONS_COLLECTION];

const WORKBOOK_MODELS = [
  { name: SyWorkbook.name, schema: SyWorkbookSchema },
  { name: EsqWorkbook.name, schema: EsqWorkbookSchema },
  { name: EsWorkbook.name, schema: EsWorkbookSchema },
];

const CHECKED_MODELS = [
  ...WORKBOOK_MODELS,
  { name: DaWorkbook.name, schema: DaWorkbookSchema },
  { name: HrWorkbook.name, schema: HrWorkbookSchema },
  { name: IeWorkbook.name, schema: IeWorkbookSchema },
  { name: SeismicPraWorkbook.name, schema: SeismicPraWorkbookSchema },
  { name: InternalFirePraWorkbook.name, schema: InternalFirePraWorkbookSchema },
  { name: InternalFloodPraWorkbook.name, schema: InternalFloodPraWorkbookSchema },
  { name: HighWindsPraWorkbook.name, schema: HighWindsPraWorkbookSchema },
  { name: ExternalFloodPraWorkbook.name, schema: ExternalFloodPraWorkbookSchema },
  { name: OtherHazardsPraWorkbook.name, schema: OtherHazardsPraWorkbookSchema },
  { name: AnalysisRunRecord.name, schema: AnalysisRunRecordSchema },
];

const OLD_UNCERTAINTY = {
  sampleCount: 200,
  seed: 7,
  basicEventSampler: "LHS",
  basicEventDistributions: [{
    faultTreeBasicEvent: { referenceType: "FAULT_TREE_BASIC_EVENT", workbookId: SY, entityId: IDS.basicEventAPlaceholder },
    distribution: { family: "BETA", alpha: 2, beta: 98 },
  }],
  cptRowDistributions: [{
    bayesianNetworkNode: { referenceType: "BAYESIAN_NETWORK_NODE", workbookId: SY, modelId: IDS.network, entityId: IDS.latentNode },
    cptRowId: IDS.latentRow,
    prior: { family: "DIRICHLET", alpha: [49, 1] },
  }],
  cptGenerators: [],
};

function asJson(value: object): JsonRecord {
  const parsed = jsonRecordOf(stringifyJson(value));
  if (parsed === undefined) throw new Error("Expected a JSON object.");
  return parsed;
}

function record(value: Json | undefined): JsonRecord {
  if (!isRecord(value)) throw new Error("Expected a JSON object.");
  return value;
}

function records(value: Json | undefined): JsonRecord[] {
  if (!Array.isArray(value)) throw new Error("Expected a JSON array.");
  return value.map(record);
}

function configurationOf(networkOwner: string, uncertainty?: JsonRecord): JsonRecord {
  const seed = asJson(createExampleHclConfiguration());
  return {
    ...seed,
    bayesianNetwork: { workbookId: networkOwner, modelId: IDS.network },
    faultTrees: [{ workbookId: SY, modelId: IDS.faultTreePlaceholder }],
    bindings: records(field(seed, "bindings")).map((binding) => ({
      ...binding,
      faultTreeBasicEvent: { ...record(field(binding, "faultTreeBasicEvent")), workbookId: SY },
      bayesianNetworkNode: { ...record(field(binding, "bayesianNetworkNode")), workbookId: networkOwner },
    })),
    solverSettings: { ...record(field(seed, "solverSettings")), ...(uncertainty === undefined ? {} : { uncertainty }) },
  };
}

function syMef(uncertainty?: JsonRecord): JsonRecord {
  return { ...asJson(createBlankSy("SY Workbook", OWNER)), dependencyBayesianNetworks: [asJson(createExampleDependencyNetwork())], dependencyHclConfigurations: [configurationOf(SY, uncertainty)] };
}

function esqMef(overrides: JsonRecord = {}): JsonRecord {
  return { ...asJson(createBlankEsq("ESQ Workbook", OWNER)), linkedWorkbooks: { SY }, ...overrides };
}

function linkedTree(): JsonRecord {
  const tree = asJson(createExampleDependencyEventTree());
  const events = record(field(tree, "functionalEvents"));
  const event = record(field(events, IDS.functionalEvent));
  const linked = { ...event, networkNode: { bayesianNetworkNode: { referenceType: "BAYESIAN_NETWORK_NODE", workbookId: SY, modelId: IDS.network, entityId: IDS.divisionANode }, trueStateIds: [IDS.divisionAFailed] } };
  return { ...tree, functionalEvents: { ...events, [IDS.functionalEvent]: Object.fromEntries(Object.entries(linked).filter(([key]) => key !== "faultTreeTopEvent")) } };
}

function esMef(trees: JsonRecord[]): JsonRecord {
  return { ...asJson(createBlankEs("ES Workbook", OWNER)), linkedWorkbooks: { SY }, eventTrees: trees };
}

function nodeRule(): JsonRecord {
  return {
    id: esqStableId(`node-link:RPS:${IDS.eventTree}`),
    treeIds: [IDS.eventTree],
    groupIds: [],
    stateIds: [],
    target: { kind: "NETWORK_NODE", node: { workbookId: ESQ, modelId: IDS.network, nodeId: IDS.divisionANode }, trueStateIds: [IDS.divisionAFailed] },
    reason: "",
  };
}

function runOfRecord(configurationOwner: string): JsonRecord {
  return {
    run: { runId: "run-1", revision: 2, at: "2026-11-01T00:00:00.000Z", inputs: "inputs", calculation: "EXACT", logic: { flags: true, loopBreaks: "AS_SET", exclusions: true, expandCcf: false }, hcl: { workbookId: configurationOwner, modelId: IDS.hclConfiguration, treeIds: [] } },
    families: [],
  };
}

function importedModel(): JsonRecord {
  return {
    importedAt: "2026-11-01T00:00:00.000Z",
    sources: [{ element: "SY", workbookId: SY, workbookName: "SY Workbook" }],
    trees: [{ id: IDS.eventTree, code: "ET-DEP", name: "Dependency tree", initiatorId: "IEG-1", functionIds: ["RPS"], transferEntry: false }],
    sequences: [],
    families: [],
    functions: [{
      id: "RPS",
      name: "Reactor protection succeeds",
      treeIds: [IDS.eventTree],
      esLinks: [],
      nodeLinks: [{ treeId: IDS.eventTree, node: { workbookId: SY, modelId: IDS.network, nodeId: IDS.divisionANode }, trueStateIds: [IDS.divisionAFailed], label: "RPS-DIV-A" }],
    }],
    tops: [],
    initiators: [],
    states: [],
    events: [],
    ccfGroups: [],
    parameters: [],
    humanEvents: [],
  };
}

describe("SyNetworkMigrationService", () => {
  let mongo: MongoMemoryServer;
  let moduleRef: TestingModule;
  let service: SyNetworkMigrationService;
  let connection: Connection;
  let syModel: Model<SyWorkbookDocument>;
  let esqModel: Model<EsqWorkbookDocument>;
  let esModel: Model<EsWorkbookDocument>;
  let warnings: jest.SpyInstance;
  let errors: jest.SpyInstance;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    moduleRef = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(mongo.getUri()), MongooseModule.forFeature(WORKBOOK_MODELS)],
      providers: [EsNetworkMigrationService, SyNetworkMigrationService],
    }).compile();
    service = moduleRef.get(SyNetworkMigrationService);
    connection = moduleRef.get<Connection>(getConnectionToken());
    syModel = moduleRef.get<Model<SyWorkbookDocument>>(getModelToken(SyWorkbook.name));
    esqModel = moduleRef.get<Model<EsqWorkbookDocument>>(getModelToken(EsqWorkbook.name));
    esModel = moduleRef.get<Model<EsWorkbookDocument>>(getModelToken(EsWorkbook.name));
  }, 120_000);

  afterAll(async () => {
    await moduleRef.close();
    await mongo.stop();
  }, 120_000);

  beforeEach(async () => {
    warnings = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    errors = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    for (const name of COLLECTIONS) await connection.collection(name).deleteMany({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function warned(): string[] {
    return warnings.mock.calls.map(([message]) => String(message));
  }

  async function stored<T>(model: Model<T>, workbookId: string): Promise<{ revision: number; mef: JsonRecord; previous?: JsonRecord }> {
    const found = await model.findOne({ workbookId }).lean<{ revision?: number; mef?: object; previousMefJson?: string | null }>().exec();
    if (found === null || found.mef === undefined) throw new Error(`No workbook ${workbookId}.`);
    const previous = typeof found.previousMefJson === "string" ? jsonRecordOf(found.previousMefJson) : undefined;
    return { revision: found.revision ?? 1, mef: asJson(found.mef), ...(previous === undefined ? {} : { previous }) };
  }

  async function backups(): Promise<{ workbookId: string; collection: string; migration: string; document: JsonRecord }[]> {
    const found = await connection.collection(BACKUP_COLLECTION).find({}, { sort: { backedUpAt: 1, _id: 1 } }).toArray();
    return found.map((backup) => ({ workbookId: String(backup["workbookId"]), collection: String(backup["collection"]), migration: String(backup["migration"]), document: asJson(backup["document"]) }));
  }

  async function everything(): Promise<JsonRecord[]> {
    const found = await Promise.all(COLLECTIONS.map((name) => connection.collection(name).find({}, { sort: { _id: 1 } }).toArray()));
    return found.flat().map((document) => asJson(document));
  }

  async function expectNothingLeftToDo(): Promise<void> {
    const before = await everything();
    const logged = warned();
    expect(await service.run()).toBe(0);
    expect(await everything()).toEqual(before);
    expect(warned()).toEqual(logged);
  }

  it("moves the networks of an SY workbook into every ESQ workbook that links it", async () => {
    await syModel.create({ workbookId: SY, projectId: PROJECT, ownerUsername: OWNER, revision: 4, mef: syMef() });
    await esqModel.create({ workbookId: ESQ, projectId: PROJECT, ownerUsername: OWNER, revision: 2, mef: esqMef({ bayesianNetworks: [{ ...asJson(createExampleDependencyNetwork()), code: "STALE" }], solve: runOfRecord(SY) }) });
    await esqModel.create({ workbookId: "esq-second", projectId: "project-other", ownerUsername: OWNER, mef: esqMef() });
    await esqModel.create({ workbookId: "esq-unlinked", projectId: PROJECT, ownerUsername: OWNER, mef: esqMef({ linkedWorkbooks: { SY: "sy-other" } }) });

    expect(await service.run()).toBe(1);

    const sy = await stored<SyWorkbookDocument>(syModel, SY);
    expect(sy.revision).toBe(5);
    expect(sy.mef).not.toHaveProperty("dependencyBayesianNetworks");
    expect(sy.mef).not.toHaveProperty("dependencyHclConfigurations");
    expect(SystemsAnalysisSchema.safeParse(stripNulls(sy.mef)).success).toBe(true);
    for (const [workbookId, revision] of [[ESQ, 3], ["esq-second", 2]] as const) {
      const esq = await stored<EsqWorkbookDocument>(esqModel, workbookId);
      expect(esq.revision).toBe(revision);
      expect(esq.mef["bayesianNetworks"]).toEqual([asJson(createExampleDependencyNetwork())]);
      expect(esq.mef["hclConfigurations"]).toEqual([configurationOf(workbookId)]);
      expect(EventSequenceQuantificationSchema.safeParse(normalizeEsqMef(esq.mef)).success).toBe(true);
    }
    expect((await stored<EsqWorkbookDocument>(esqModel, ESQ)).mef["solve"]).toMatchObject({ run: { hcl: { workbookId: ESQ, modelId: IDS.hclConfiguration } } });
    const untouched = await stored<EsqWorkbookDocument>(esqModel, "esq-unlinked");
    expect(untouched.revision).toBe(1);
    expect(untouched.mef["hclConfigurations"]).toEqual([]);
    const kept = await backups();
    expect(kept.map((backup) => `${backup.collection}:${backup.workbookId}`)).toEqual([`esq_workbooks:${ESQ}`, "esq_workbooks:esq-second", `sy_workbooks:${SY}`]);
    expect(kept.every((backup) => backup.migration === SY_NETWORK_MIGRATION_ID)).toBe(true);
    expect(record(field(kept[2]?.document ?? {}, "mef"))["dependencyHclConfigurations"]).toEqual([configurationOf(SY)]);
    expect(field(kept[2]?.document ?? {}, "revision")).toBe(4);
    expect(warned()).toEqual([]);
  });

  it("copies to the ESQ workbooks of the project when none links the SY workbook and warns when there is none", async () => {
    await syModel.create({ workbookId: SY, projectId: PROJECT, ownerUsername: OWNER, mef: syMef() });
    await syModel.create({ workbookId: "sy-alone", projectId: "project-empty", ownerUsername: OWNER, mef: syMef() });
    await esqModel.create({ workbookId: ESQ, projectId: PROJECT, ownerUsername: OWNER, mef: esqMef({ linkedWorkbooks: { SY: "example-sy-htgr" } }) });
    await esqModel.create({ workbookId: "esq-elsewhere", projectId: "project-other", ownerUsername: OWNER, mef: esqMef({ linkedWorkbooks: {} }) });

    expect(await service.run()).toBe(2);

    expect((await stored<EsqWorkbookDocument>(esqModel, ESQ)).mef["hclConfigurations"]).toEqual([configurationOf(ESQ)]);
    expect((await stored<EsqWorkbookDocument>(esqModel, "esq-elsewhere")).mef["hclConfigurations"]).toEqual([]);
    const alone = await stored<SyWorkbookDocument>(syModel, "sy-alone");
    expect(alone.revision).toBe(2);
    expect(alone.mef).not.toHaveProperty("dependencyBayesianNetworks");
    expect(alone.mef).not.toHaveProperty("dependencyHclConfigurations");
    expect(warned()).toEqual(["SY workbook sy-alone had dependency networks and its project has no ESQ workbook to hold them. They were removed. The backup keeps them."]);
    expect((await backups()).map((backup) => backup.workbookId)).toEqual([ESQ, SY, "sy-alone"]);
  });

  it("keeps the SY copy for the next start when an ESQ workbook changes during the move", async () => {
    await syModel.create({ workbookId: SY, projectId: PROJECT, ownerUsername: OWNER, mef: syMef() });
    await esqModel.create({ workbookId: ESQ, projectId: PROJECT, ownerUsername: OWNER, revision: 6, mef: esqMef() });
    const kept = connection.collection(BACKUP_COLLECTION);
    const keep = kept.insertOne.bind(kept);
    jest.spyOn(kept, "insertOne").mockImplementationOnce(async (backup) => {
      await connection.collection("esq_workbooks").updateOne({ workbookId: ESQ }, { $set: { revision: 7 } });
      return keep(backup);
    });

    expect(await service.run()).toBe(0);

    expect((await stored<SyWorkbookDocument>(syModel, SY)).mef["dependencyHclConfigurations"]).toEqual([configurationOf(SY)]);
    expect((await stored<SyWorkbookDocument>(syModel, SY)).revision).toBe(1);
    expect((await stored<EsqWorkbookDocument>(esqModel, ESQ)).mef["hclConfigurations"]).toEqual([]);
    expect(warned()).toEqual([`SY workbook ${SY} kept its dependency networks. ESQ workbook ${ESQ} changed during the move. They move at the next start.`]);

    expect(await service.run()).toBe(1);
    expect((await stored<SyWorkbookDocument>(syModel, SY)).mef).not.toHaveProperty("dependencyHclConfigurations");
    expect((await stored<EsqWorkbookDocument>(esqModel, ESQ)).revision).toBe(8);
    expect((await stored<EsqWorkbookDocument>(esqModel, ESQ)).mef["hclConfigurations"]).toEqual([configurationOf(ESQ)]);
  });

  it("turns node links into rules, strips drawn trees and prior contents, and strips ES", async () => {
    const drawn = { ...linkedTree(), uuid: "drawn-tree" };
    const esq = esqMef({ model: importedModel(), modelDecisions: { typedTrees: [drawn] } });
    await esqModel.create({ workbookId: ESQ, projectId: PROJECT, ownerUsername: OWNER, revision: 3, mef: esq, previousMefJson: stringifyJson(esq) });
    const orphan = { ...linkedTree(), uuid: "tree-never-imported", label: "ORPHAN" };
    await esModel.create({ workbookId: ES, projectId: PROJECT, ownerUsername: OWNER, revision: 2, mef: esMef([linkedTree(), orphan]), previousMefJson: stringifyJson(esMef([linkedTree()])) });
    await esModel.create({ workbookId: "es-plain", projectId: PROJECT, ownerUsername: OWNER, mef: esMef([asJson(createExampleDependencyEventTree())]) });

    expect(await service.run()).toBe(2);

    const converted = await stored<EsqWorkbookDocument>(esqModel, ESQ);
    expect(converted.revision).toBe(4);
    for (const part of [converted.mef, converted.previous ?? {}]) {
      expect(record(field(part, "modelDecisions"))["functionLinks"]).toEqual([{ functionId: "RPS", rules: [nodeRule()] }]);
      expect(stringifyJson(part)).not.toContain("nodeLinks");
      expect(stringifyJson(part)).not.toContain("networkNode");
      expect(EventSequenceQuantificationSchema.safeParse(normalizeEsqMef(part)).success).toBe(true);
    }
    const stripped = await stored<EsWorkbookDocument>(esModel, ES);
    expect(stripped.revision).toBe(3);
    for (const part of [stripped.mef, stripped.previous ?? {}]) {
      expect(stringifyJson(part)).not.toContain("networkNode");
      expect(EventSequenceAnalysisSchema.safeParse(stripNulls(part)).success).toBe(true);
    }
    expect(records(field(stripped.mef, "eventTrees"))).toHaveLength(2);
    expect((await stored<EsWorkbookDocument>(esModel, "es-plain")).revision).toBe(1);
    expect(warned()).toEqual([`ES workbook ${ES}. Functional event RPS in event tree ORPHAN lost its network node link. No ESQ workbook had imported it.`]);
    expect((await backups()).map((backup) => `${backup.collection}:${backup.workbookId}`)).toEqual([`esq_workbooks:${ESQ}`, `es_workbooks:${ES}`]);
  });

  it("gives the networks to the live and the prior contents of an ESQ workbook in one write", async () => {
    await syModel.create({ workbookId: SY, projectId: PROJECT, ownerUsername: OWNER, mef: syMef() });
    await esqModel.create({ workbookId: ESQ, projectId: PROJECT, ownerUsername: OWNER, revision: 5, mef: esqMef(), previousMefJson: stringifyJson(esqMef({ model: importedModel(), solve: runOfRecord(SY) })) });

    expect(await service.run()).toBe(1);

    const esq = await stored<EsqWorkbookDocument>(esqModel, ESQ);
    expect(esq.revision).toBe(6);
    for (const part of [esq.mef, esq.previous ?? {}]) {
      expect(part["bayesianNetworks"]).toEqual([asJson(createExampleDependencyNetwork())]);
      expect(part["hclConfigurations"]).toEqual([configurationOf(ESQ)]);
      expect(EventSequenceQuantificationSchema.safeParse(normalizeEsqMef(part)).success).toBe(true);
    }
    expect(record(field(esq.previous ?? {}, "modelDecisions"))["functionLinks"]).toEqual([{ functionId: "RPS", rules: [nodeRule()] }]);
    expect(esq.previous?.["solve"]).toEqual(runOfRecord(ESQ));
    expect(stringifyJson(esq.previous)).not.toContain("nodeLinks");
    const kept = await backups();
    expect(kept.map((backup) => `${backup.collection}:${backup.workbookId}`)).toEqual([`esq_workbooks:${ESQ}`, `sy_workbooks:${SY}`]);
    expect(field(kept[0]?.document ?? {}, "revision")).toBe(5);
    expect(warned()).toEqual([]);
    await expectNothingLeftToDo();
  });

  it("moves networks that only the prior contents of an SY workbook hold", async () => {
    const blank = asJson(createBlankSy("SY Workbook", OWNER));
    const live = { ...blank, dependencyBayesianNetworks: [], dependencyHclConfigurations: [] };
    const prior = stringifyJson({ ...blank, dependencyBayesianNetworks: [asJson(createExampleDependencyNetwork())], dependencyHclConfigurations: [configurationOf(SY)] });
    await syModel.create({ workbookId: SY, projectId: PROJECT, ownerUsername: OWNER, revision: 3, mef: live, previousMefJson: prior });
    await syModel.create({ workbookId: "sy-alone", projectId: "project-empty", ownerUsername: OWNER, mef: blank, previousMefJson: prior });
    await syModel.create({ workbookId: "sy-empty", projectId: PROJECT, ownerUsername: OWNER, mef: live, previousMefJson: stringifyJson(live) });
    await esqModel.create({ workbookId: ESQ, projectId: PROJECT, ownerUsername: OWNER, mef: esqMef(), previousMefJson: stringifyJson(esqMef({ model: importedModel() })) });

    expect(await service.run()).toBe(2);

    const sy = await stored<SyWorkbookDocument>(syModel, SY);
    expect(sy.revision).toBe(4);
    expect(sy.mef).toEqual(live);
    expect(sy.previous).toEqual(blank);
    expect(SystemsAnalysisSchema.safeParse(stripNulls(sy.previous ?? {})).success).toBe(true);
    const esq = await stored<EsqWorkbookDocument>(esqModel, ESQ);
    expect(esq.revision).toBe(2);
    for (const part of [esq.mef, esq.previous ?? {}]) {
      expect(part["bayesianNetworks"]).toEqual([asJson(createExampleDependencyNetwork())]);
      expect(part["hclConfigurations"]).toEqual([configurationOf(ESQ)]);
    }
    expect(record(field(esq.previous ?? {}, "modelDecisions"))["functionLinks"]).toEqual([{ functionId: "RPS", rules: [nodeRule()] }]);
    const alone = await stored<SyWorkbookDocument>(syModel, "sy-alone");
    expect(alone.revision).toBe(2);
    expect(alone.mef).toEqual(blank);
    expect(alone.previous).toEqual(blank);
    expect(await stored<SyWorkbookDocument>(syModel, "sy-empty")).toEqual({ revision: 1, mef: live, previous: live });
    expect(warned()).toEqual(["SY workbook sy-alone had dependency networks and its project has no ESQ workbook to hold them. They were removed. The backup keeps them."]);
    const kept = await backups();
    expect(kept.map((backup) => `${backup.collection}:${backup.workbookId}`)).toEqual([`esq_workbooks:${ESQ}`, `sy_workbooks:${SY}`, "sy_workbooks:sy-alone"]);
    for (const backup of kept.slice(1)) {
      expect(jsonRecordOf(String(field(backup.document, "previousMefJson")))?.["dependencyHclConfigurations"]).toEqual([configurationOf(SY)]);
    }
    await expectNothingLeftToDo();
  });

  it("lets an SY live entry win over a prior entry with the same model id and replaces the ESQ entry", async () => {
    const network = asJson(createExampleDependencyNetwork());
    const priorOnlyNetwork = { ...network, modelId: "network-prior-only", code: "PRIOR-ONLY" };
    const priorOnly = (owner: string): JsonRecord => ({ ...configurationOf(owner), modelId: "configuration-prior-only", code: "PRIOR-ONLY", bayesianNetwork: { workbookId: owner, modelId: "network-prior-only" } });
    const prior = {
      ...asJson(createBlankSy("SY Workbook", OWNER)),
      dependencyBayesianNetworks: [{ ...network, code: "PRIOR" }, priorOnlyNetwork],
      dependencyHclConfigurations: [{ ...configurationOf(SY), code: "PRIOR" }, priorOnly(SY)],
    };
    const ownNetwork = { ...network, modelId: "network-own", code: "OWN" };
    await syModel.create({ workbookId: SY, projectId: PROJECT, ownerUsername: OWNER, revision: 7, mef: syMef(), previousMefJson: stringifyJson(prior) });
    await esqModel.create({
      workbookId: ESQ,
      projectId: PROJECT,
      ownerUsername: OWNER,
      mef: esqMef({ bayesianNetworks: [{ ...network, code: "STALE" }], hclConfigurations: [{ ...configurationOf(ESQ), code: "STALE" }] }),
      previousMefJson: stringifyJson(esqMef({ bayesianNetworks: [{ ...network, code: "STALE" }, ownNetwork] })),
    });

    expect(await service.run()).toBe(1);

    const esq = await stored<EsqWorkbookDocument>(esqModel, ESQ);
    expect(esq.revision).toBe(2);
    expect(esq.mef["bayesianNetworks"]).toEqual([priorOnlyNetwork, network]);
    expect(esq.previous?.["bayesianNetworks"]).toEqual([ownNetwork, priorOnlyNetwork, network]);
    for (const part of [esq.mef, esq.previous ?? {}]) expect(part["hclConfigurations"]).toEqual([priorOnly(ESQ), configurationOf(ESQ)]);
    const sy = await stored<SyWorkbookDocument>(syModel, SY);
    expect(sy.revision).toBe(8);
    for (const part of [sy.mef, sy.previous ?? {}]) {
      expect(part).not.toHaveProperty("dependencyBayesianNetworks");
      expect(part).not.toHaveProperty("dependencyHclConfigurations");
      expect(SystemsAnalysisSchema.safeParse(stripNulls(part)).success).toBe(true);
    }
    expect((await backups()).map((backup) => `${backup.collection}:${backup.workbookId}`)).toEqual([`esq_workbooks:${ESQ}`, `sy_workbooks:${SY}`]);
    expect(warned()).toEqual([]);
    await expectNothingLeftToDo();
  });

  it("does nothing on a second start", async () => {
    await syModel.create({ workbookId: SY, projectId: PROJECT, ownerUsername: OWNER, mef: syMef() });
    await esqModel.create({ workbookId: ESQ, projectId: PROJECT, ownerUsername: OWNER, mef: esqMef({ model: importedModel() }) });
    await esModel.create({ workbookId: ES, projectId: PROJECT, ownerUsername: OWNER, mef: esMef([linkedTree()]) });

    expect(await service.run()).toBe(2);
    const first = { sy: await stored<SyWorkbookDocument>(syModel, SY), esq: await stored<EsqWorkbookDocument>(esqModel, ESQ), es: await stored<EsWorkbookDocument>(esModel, ES) };
    expect([first.sy.revision, first.esq.revision, first.es.revision]).toEqual([2, 2, 2]);
    const kept = (await backups()).length;

    expect(await service.run()).toBe(0);
    expect({ sy: await stored<SyWorkbookDocument>(syModel, SY), esq: await stored<EsqWorkbookDocument>(esqModel, ESQ), es: await stored<EsWorkbookDocument>(esModel, ES) }).toEqual(first);
    expect(await backups()).toHaveLength(kept);
    expect(warned()).toEqual([]);
  });

  it("runs after the ES move in one start and lets the backend start when it fails", async () => {
    const binding = { id: "binding-functional-event", faultTreeBasicEvent: { referenceType: "FAULT_TREE_BASIC_EVENT", workbookId: ES, entityId: IDS.basicEventAPlaceholder }, bayesianNetworkNode: { referenceType: "BAYESIAN_NETWORK_NODE", workbookId: ES, modelId: IDS.network, entityId: IDS.divisionANode }, trueStateIds: [IDS.divisionAFailed] };
    const held = { ...configurationOf(ES), faultTrees: [], bindings: [binding] };
    await esModel.create({ workbookId: ES, projectId: PROJECT, ownerUsername: OWNER, mef: { ...esMef([asJson(createExampleDependencyEventTree())]), dependencyBayesianNetworks: [asJson(createExampleDependencyNetwork())], dependencyHclConfigurations: [held] } });
    await syModel.create({ workbookId: SY, projectId: PROJECT, ownerUsername: OWNER, mef: asJson(createBlankSy("SY Workbook", OWNER)) });
    await esqModel.create({ workbookId: ESQ, projectId: PROJECT, ownerUsername: OWNER, mef: esqMef() });

    await service.onModuleInit();

    expect((await stored<EsWorkbookDocument>(esModel, ES)).mef).not.toHaveProperty("dependencyBayesianNetworks");
    expect((await stored<SyWorkbookDocument>(syModel, SY)).mef).not.toHaveProperty("dependencyBayesianNetworks");
    expect((await stored<SyWorkbookDocument>(syModel, SY)).revision).toBe(3);
    const esq = await stored<EsqWorkbookDocument>(esqModel, ESQ);
    expect(esq.mef["bayesianNetworks"]).toEqual([asJson(createExampleDependencyNetwork())]);
    expect(esq.mef["hclConfigurations"]).toMatchObject([{ modelId: IDS.hclConfiguration, bayesianNetwork: { workbookId: ESQ, modelId: IDS.network }, bindings: [] }]);
    expect((await backups()).map((backup) => backup.migration)).toEqual(["es-networks-to-sy-2026-10", "es-networks-to-sy-2026-10", SY_NETWORK_MIGRATION_ID, SY_NETWORK_MIGRATION_ID]);
    expect(errors).not.toHaveBeenCalled();

    for (const model of [esModel, syModel]) {
      jest.spyOn(model, "find").mockImplementation(() => {
        throw new Error("The database went away");
      });
    }
    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(errors.mock.calls.map(([message]) => String(message))).toEqual([
      "The ES network move stopped. The database went away. The backend starts anyway.",
      "The dependency network move to ESQ stopped. The database went away. The backend starts anyway.",
    ]);
  });

  it("finishes before the stored workbook check, which then converts the moved uncertainty laws", async () => {
    const started = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(mongo.getUri()), MongooseModule.forFeature(CHECKED_MODELS)],
      providers: [EsNetworkMigrationService, SyNetworkMigrationService, UncertaintyMigrationService, { provide: UncertaintyService, useValue: { evaluate: jest.fn().mockRejectedValue(new Error("not needed")) } }],
    }).compile();
    const app = started.createNestApplication();
    await syModel.create({ workbookId: SY, projectId: PROJECT, ownerUsername: OWNER, mef: syMef(OLD_UNCERTAINTY) });
    await esqModel.create({ workbookId: ESQ, projectId: PROJECT, ownerUsername: OWNER, mef: esqMef() });
    const order: string[] = [];
    const esMove = started.get(EsNetworkMigrationService);
    const syMove = started.get(SyNetworkMigrationService);
    const check = started.get(UncertaintyMigrationService);
    const runEsMove = esMove.run.bind(esMove);
    const runSyMove = syMove.run.bind(syMove);
    const runCheck = check.run.bind(check);
    jest.spyOn(esMove, "run").mockImplementation(async () => {
      order.push("ES to SY started");
      const moved = await runEsMove();
      order.push("ES to SY finished");
      return moved;
    });
    jest.spyOn(syMove, "run").mockImplementation(async () => {
      order.push("SY to ESQ started");
      const changed = await runSyMove();
      order.push("SY to ESQ finished");
      return changed;
    });
    jest.spyOn(check, "run").mockImplementation(async () => {
      order.push("stored workbook check started");
      const summary = await runCheck();
      order.push("stored workbook check finished");
      return summary;
    });

    try {
      await app.init();
    } finally {
      await app.close();
    }

    expect(order).toEqual(["ES to SY started", "ES to SY finished", "SY to ESQ started", "SY to ESQ finished", "stored workbook check started", "stored workbook check finished"]);
    const [configuration] = records((await stored<EsqWorkbookDocument>(esqModel, ESQ)).mef["hclConfigurations"]);
    const uncertainty = HclUncertaintySettingsSchema.parse(field(record(field(configuration ?? {}, "solverSettings")), "uncertainty"));
    expect(uncertainty).toMatchObject({
      sampleCount: 200,
      seed: 7,
      sampler: "LHS",
      basicEvents: [{ faultTreeBasicEvent: { workbookId: SY, entityId: IDS.basicEventAPlaceholder }, expression: { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "BETA", alpha: 2, beta: 98 } } } }],
      cptRows: [{ bayesianNetworkNode: { workbookId: ESQ, modelId: IDS.network, entityId: IDS.latentNode }, cptRowId: IDS.latentRow, row: { node: "VALUE", law: { family: "DIRICHLET", concentrations: [49, 1] } } }],
    });
    expect((await stored<SyWorkbookDocument>(syModel, SY)).mef).not.toHaveProperty("dependencyHclConfigurations");
    const migrations = (await connection.collection(BACKUP_COLLECTION).find({ workbookId: ESQ }, { sort: { backedUpAt: 1, _id: 1 } }).toArray()).map((backup) => String(backup["migration"]));
    expect(migrations).toEqual([SY_NETWORK_MIGRATION_ID, UNCERTAINTY_MIGRATION_ID]);
  }, 120_000);
});
