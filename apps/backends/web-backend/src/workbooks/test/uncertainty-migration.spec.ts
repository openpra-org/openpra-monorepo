import { readFileSync } from "fs";
import { join } from "path";
import { execute } from "praxis-node";
import type { Law, UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { DA_ESTIMATE_MODELS, holdsEstimate } from "interfaces-mef-types/da/data-analysis";
import { DA_SOURCE_CATALOG } from "interfaces-mef-types/da/generic-sources";
import { CcfFactorModelSchema, LawSchema, UncertainExpressionSchema } from "interfaces-mef-types/zod/core/uncertainty";
import { DaBasicEventNeedSchema, DataAnalysisParameterSchema } from "interfaces-mef-types/zod/da/data-analysis";
import { EventTreeSchema } from "interfaces-mef-types/zod/es/event-sequence-analysis";
import { HazardConditionedMethodModelsSchema } from "interfaces-mef-types/zod/hazard-conditioned-models";
import { EsqEventRecordSchema, EsqParameterRecordSchema, EsqTreeRecordSchema } from "interfaces-mef-types/zod/esq/event-sequence-quantification";
import { WorkbookHclUncertaintyConfigurationSchema } from "interfaces-mef-types/zod/modeling/workbook-models";
import { ComponentMissionTimeDefinitionSchema, MissionTimeDefinitionSchema } from "interfaces-mef-types/zod/sc/success-criteria-development";
import { SystemDefinitionSchema } from "interfaces-mef-types/zod/sy/systems-analysis";
import { stringifyJson } from "interfaces-shared-types/json";
import {
  UncertaintyResponseSchema,
  type UncertaintyRequest,
  type UncertaintyResponse,
} from "interfaces-shared-types/newly-developed-methods/shared";
import { createBlankEs } from "../../es-workbooks/blank-es";
import { DA_ANALYSIS_HTGR } from "../../example-workbooks/seeds/da-seed-htgr";
import { SY_ANALYSIS_HTGR } from "../../example-workbooks/seeds/sy-seed-htgr";
import { createBlankIe } from "../../ie-workbooks/blank-ie";
import { createBlankSc } from "../../sc-workbooks/blank-sc";
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
  daParameterFacts,
  esIssue,
  esqIssue,
  field,
  hazardIssue,
  ieIssue,
  isRecord,
  jsonRecordOf,
  jsonTextOf,
  lognormalFit,
  openQuestions,
  parsedDaFacts,
  previousEsIssue,
  previousIeIssue,
  previousScIssue,
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
  type LawOperation,
  type MigrationLookups,
  type SyCcfFacts,
} from "../uncertainty-migration";

const FIXTURES = jsonRecordOf(readFileSync(join(__dirname, "uncertainty-migration-fixtures.json"), "utf8"));

const SY_FORBIDDEN: readonly string[] = ["probability", "quantificationBasis", "controlledDataSource", "dataAnalysisBasicEventRef"];

const DATASETS_DIRECTORY = join(__dirname, "..", "..", "..", "..", "..", "interfaces", "mef-types", "da");

const ANSWERS = new PraxisAnswers();

const PROJECT_ID = "project-mission";

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

function asRecord(value: object): JsonRecord {
  return record(jsonRecordOf(stringifyJson(value)) ?? null);
}

function byId(values: Json | undefined, key: string, id: string): JsonRecord {
  const found = records(values).find((candidate) => field(candidate, key) === id);
  if (found === undefined) throw new Error(`No record ${id}.`);
  return found;
}

function evaluate(body: UncertaintyRequest): UncertaintyResponse {
  const answer: Json = JSON.parse(execute(JSON.stringify({
    schemaVersion: "1.0.0",
    request: { schemaVersion: "1.0.0", methodType: "UNCERTAINTY", ...body },
    modelSnapshots: [],
  })));
  return UncertaintyResponseSchema.parse(without(record(field(record(answer), "result")), ["methodType"]));
}

function settle<T>(convert: (scope: ConversionScope) => T): { value: T; issues: string[] } {
  for (let round = 0; round < 5; round += 1) {
    const scope = new ConversionScope(ANSWERS, "test");
    const value = convert(scope);
    if (openQuestions(ANSWERS) === 0) return { value, issues: scope.issues };
    const questions = ANSWERS.questions();
    recordAnswers(questions, evaluate(questionRequest(questions)), ANSWERS);
  }
  throw new Error("PRAXIS questions stayed open.");
}

function converted(convert: (scope: ConversionScope) => JsonRecord): JsonRecord {
  const { value, issues } = settle(convert);
  expect(issues).toEqual([]);
  return value;
}

function praxisLaw(operation: LawOperation): Law {
  const result = evaluate({ parameters: [], laws: [], expressions: [], operations: [{ id: "check", operation }] }).operations[0];
  if (result === undefined || !("law" in result)) throw new Error("PRAXIS gave no law.");
  return result.law;
}

function standardQuantile(): number {
  const summary = evaluate({
    parameters: [],
    laws: [{ id: "z", value: { unit: "QUANTITY", law: { family: "NORMAL", mean: 0, standardDeviation: 1 } }, probabilities: [0.95], curveProbabilities: [] }],
    expressions: [],
    operations: [],
  }).laws[0];
  const value = summary === undefined || "error" in summary ? undefined : summary.quantiles[0]?.value;
  if (value === undefined) throw new Error("PRAXIS gave no percentile.");
  return value;
}

function lognormalOf(median: number, errorFactor: number): Law {
  return praxisLaw(lognormalFit(null, median, [{ probability: 0.95, value: median * errorFactor }]));
}

function datasetIndex(): DaDatasetIndex {
  return daDatasetIndex(DA_SOURCE_CATALOG.map((source) => {
    const rows: Json = JSON.parse(readFileSync(join(DATASETS_DIRECTORY, source.dataset), "utf8"));
    return { dataset: source.dataset, rows };
  }));
}

function facts(mef: JsonRecord): Map<string, DaParameterFacts> {
  const parsed = parsedDaFacts(mef);
  if (parsed === undefined) throw new Error(`The DA document does not parse. ${daIssue(mef)}`);
  return parsed;
}

function eventsOf(mef: JsonRecord): JsonRecord[] {
  return records(field(mef, "systemBasicEvents"));
}

function eventById(mef: JsonRecord, id: string): JsonRecord {
  return byId(field(mef, "systemBasicEvents"), "uuid", id);
}

function component(event: JsonRecord): boolean {
  const mode = field(event, "failureMode");
  return mode !== "HUMAN_ERROR" && mode !== "COMMON_CAUSE_FAILURE";
}

function expressionOf(value: JsonRecord, key = "expression"): UncertainExpression {
  return UncertainExpressionSchema.parse(field(value, key));
}

function frequencyOf(value: JsonRecord): JsonRecord {
  return record(field(value, "frequency"));
}

function point(unit: string, value: number): JsonRecord {
  return { node: "VALUE", value: { unit, law: { family: "POINT", value } } };
}

function valued(unit: string, law: Law): JsonRecord {
  return { node: "VALUE", value: { unit, law: asRecord(law) } };
}

function truncatedAtOne(law: Law): JsonRecord {
  return { family: "TRUNCATED", law: asRecord(law), lower: null, upper: 1 };
}

function parameter(workbookId: string, entityId: string): JsonRecord {
  return { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId, entityId } };
}

function scMef(name: string): JsonRecord {
  return { ...asRecord(createBlankSc("SC Workbook", "sc-owner")), ...fixture(name) };
}

function systemOf(mef: JsonRecord, eventId: string): JsonRecord {
  const model = records(field(mef, "systemLogicModels")).find((candidate) => records(field(candidate, "leafNodes") ?? []).some((leaf) => field(leaf, "basicEventId") === eventId));
  if (model === undefined) throw new Error(`No model holds ${eventId}.`);
  return byId(field(mef, "systemDefinitions"), "uuid", String(field(model, "systemReference")));
}

function expectedMissionTime(definition: JsonRecord, scWorkbookId: string): JsonRecord {
  const reference = field(definition, "missionTimeRef");
  return typeof reference === "string" ? parameter(scWorkbookId, reference) : point("HOURS", Number(field(definition, "missionTimeHours")));
}

describe("uncertainty contract conversions", () => {
  const datasets = datasetIndex();
  const convertDa = (mef: JsonRecord, workbookId: string): JsonRecord => converted((scope) => convertDaMef(mef, { workbookId, datasets }, scope));
  const daHtgr = convertDa(fixture("da-htgr"), "da-wb");
  const daSfr = convertDa(fixture("da-sfr"), "da-sfr-wb");
  const daHcl = convertDa(fixture("da-hcl"), "da-hcl-wb");
  const daCcf = new Map<string, ReadonlyMap<string, DaCcfFacts>>([
    ["da-wb", daCcfFacts(fixture("da-htgr"), daHtgr)],
    ["da-sfr-wb", daCcfFacts(fixture("da-sfr"), daSfr)],
    ["da-hcl-wb", daCcfFacts(fixture("da-hcl"), daHcl)],
  ]);
  const syCcf = new Map<string, ReadonlyMap<string, SyCcfFacts>>();
  const scHtgr = converted((scope) => convertScMef(scMef("sc-htgr"), scope));
  const scSfr = converted((scope) => convertScMef(scMef("sc-sfr"), scope));
  const lookups: MigrationLookups = {
    daParameters: new Map([["da-wb", facts(daHtgr)], ["da-sfr-wb", facts(daSfr)], ["da-hcl-wb", facts(daHcl)]]),
    daCcf,
    syCcf,
    scMissionTimes: new Map([["sc-wb", scMissionTimeIds(scHtgr)], ["sc-sfr-wb", scMissionTimeIds(scSfr)]]),
    scProjects: new Map([[PROJECT_ID, ["sc-wb", "sc-sfr-wb"]]]),
  };
  const convertSy = (mef: JsonRecord): JsonRecord => converted((scope) => convertSyMef(mef, lookups, scope, PROJECT_ID));
  const convertEsq = (mef: JsonRecord): JsonRecord => converted((scope) => convertEsqMef(mef, lookups, scope));
  const syHtgr = convertSy(fixture("sy-htgr"));
  syCcf.set("sy-wb", syCcfFacts(fixture("sy-htgr"), syHtgr));
  const esqHtgrOld = { ...fixture("esq-htgr"), linkedWorkbooks: { ...record(field(fixture("esq-htgr"), "linkedWorkbooks")), DA: "da-wb", SY: "sy-wb" } };

  it("converts every old-shape seed fixture into documents that parse", () => {
    expect(daIssue(fixture("da-htgr"))).toBeDefined();
    expect(syIssue(fixture("sy-htgr"))).toBeDefined();
    expect(esqIssue(fixture("esq-htgr"))).toBeDefined();
    expect([daIssue(daHtgr), daIssue(daSfr), daIssue(daHcl)]).toEqual([undefined, undefined, undefined]);
    for (const name of ["sy-htgr", "sy-sfr", "sy-hcl"]) expect(syIssue(convertSy(fixture(name)))).toBeUndefined();
    for (const name of ["esq-htgr", "esq-sfr", "esq-hcl"]) expect(esqIssue(convertEsq(fixture(name)))).toBeUndefined();
    expect(esqIssue(convertEsq(esqHtgrOld))).toBeUndefined();
  });

  it("is a fixpoint on its own output", () => {
    expect(jsonTextOf(convertDa(daHtgr, "da-wb"))).toBe(jsonTextOf(daHtgr));
    expect(convertDa(daSfr, "da-sfr-wb")).toBe(daSfr);
    for (const name of ["sy-htgr", "sy-sfr", "sy-hcl"]) {
      const once = convertSy(fixture(name));
      expect(convertSy(once)).toBe(once);
    }
    for (const mef of [fixture("esq-htgr"), fixture("esq-sfr"), fixture("esq-hcl"), esqHtgrOld]) {
      const once = convertEsq(mef);
      expect(convertEsq(once)).toBe(once);
    }
  });

  it("points linked SY component events at the DA parameters they used", () => {
    const old = fixture("sy-htgr");
    const linked = eventsOf(old).filter(component);
    expect(linked.length).toBeGreaterThan(50);
    for (const event of linked) {
      const source = record(field(event, "controlledDataSource"));
      const next = eventById(syHtgr, String(field(event, "uuid")));
      expect(SY_FORBIDDEN.filter((key) => field(next, key) !== undefined)).toEqual([]);
      expect(expressionOf(next)).toEqual(parameter("da-wb", String(field(source, "entityId"))));
    }
    for (const event of eventsOf(old).filter((candidate) => !component(candidate))) {
      expect(eventById(syHtgr, String(field(event, "uuid")))).toBe(event);
    }
  });

  it("turns a legacy DA reference into a parameter of the linked DA workbook", () => {
    const old = { ...fixture("sy-sfr"), linkedWorkbooks: { DA: "da-sfr-wb" } };
    const next = convertSy(old);
    const legacy = eventsOf(old).filter((event) => component(event) && typeof field(event, "dataAnalysisBasicEventRef") === "string");
    expect(legacy.length).toBeGreaterThan(50);
    for (const event of legacy) {
      expect(expressionOf(eventById(next, String(field(event, "uuid"))))).toEqual(parameter("da-sfr-wb", String(field(event, "dataAnalysisBasicEventRef"))));
    }
    const unlinked = convertSy(fixture("sy-sfr"));
    const typed = eventById(unlinked, String(field(legacy[0] ?? {}, "uuid")));
    expect(expressionOf(typed)).toEqual(point("PROBABILITY", Number(field(legacy[0] ?? {}, "probability"))));
  });

  it("wraps a link to a DA rate in a mission or standby model and converts typed bases", () => {
    const sy = fixture("sy-htgr");
    const target = eventsOf(sy).find((event) => component(event) && field(event, "failureMode") === "FAILURE_TO_RUN");
    if (target === undefined) throw new Error("No running event in the fixture.");
    const parameterId = String(field(record(field(target, "controlledDataSource")), "entityId"));
    const withModel = (model: "RUNNING_RATE" | "STANDBY_RATE"): MigrationLookups => ({
      ...lookups,
      daParameters: new Map([...lookups.daParameters, ["da-wb", new Map([...facts(daHtgr)].map(([id, value]) => [id, id === parameterId ? { ...value, quantificationModel: model } : value]))]]),
    });
    const reference = parameter("da-wb", parameterId);
    const targetId = String(field(target, "uuid"));
    const running = converted((scope) => convertSyMef(sy, withModel("RUNNING_RATE"), scope, PROJECT_ID));
    expect(expressionOf(eventById(running, targetId))).toEqual({ node: "MODEL", model: { form: "MISSION", rate: reference, missionTime: expectedMissionTime(systemOf(sy, targetId), "sc-wb") } });
    const standby = settle((scope) => convertSyMef(sy, withModel("STANDBY_RATE"), scope, PROJECT_ID));
    const sharing = eventsOf(sy).filter((event) => component(event) && field(record(field(event, "controlledDataSource") ?? {}), "entityId") === parameterId);
    expect(sharing.length).toBeGreaterThan(0);
    expect(standby.issues).toEqual(sharing.map((event) => `test: SY basic event ${String(field(event, "uuid"))} needs a test interval for its rate model and none is stored, so it cannot be converted.`));
    expect(eventById(standby.value, targetId)).toEqual(target);

    const typedRate = { uuid: "RATE-1", code: "RATE-1", name: "Typed rate", eventType: "BASIC", failureMode: "FAILURE_TO_RUN", probability: 0.0011, quantificationBasis: { kind: "FAILURE_RATE", failureRate: { value: 12, unit: "DAY" }, missionTime: { value: 12, unit: "HOUR" }, conversion: "EXPONENTIAL" }, implementsSrs: [] };
    const typedProbability = { uuid: "PROB-1", code: "PROB-1", name: "Typed probability", eventType: "BASIC", failureMode: "FAILURE_TO_START", probability: 0.002, implementsSrs: [] };
    const ccf = { uuid: "CCF-1", code: "CCF-1", name: "Common cause", eventType: "BASIC", failureMode: "COMMON_CAUSE_FAILURE", probability: 0.0001, implementsSrs: [] };
    const analysis = { uuid: "UA-1", system: "SYS-1", propagationMethod: "MONTE_CARLO", modelUncertainties: [], implementsSrs: [], parameterUncertainties: [{ parameterId: "PROB-1", distributionType: "lognormal", distributionParameters: { median: 0.002, errorFactor: 3 }, basis: "Typed" }] };
    const typed = convertSy({ ...sy, systemBasicEvents: [...eventsOf(sy), typedRate, typedProbability, ccf], uncertaintyAnalyses: [analysis] });
    expect(expressionOf(eventById(typed, "RATE-1"))).toEqual({ node: "MODEL", model: { form: "MISSION", rate: point("PER_HOUR", 0.5), missionTime: point("HOURS", 12) } });
    expect(expressionOf(eventById(typed, "PROB-1"))).toEqual({ node: "VALUE", value: { unit: "PROBABILITY", law: { family: "TRUNCATED", law: { family: "LOGNORMAL", mean: 0.002, errorFactor: 3, level: 0.95 }, lower: null, upper: 1 } } });
    expect(eventById(typed, "CCF-1")).toEqual(ccf);
    expect(records(field(typed, "uncertaintyAnalyses")).map((entry) => field(entry, "parameterUncertainties"))).toEqual([undefined]);
    expect(syIssue(typed)).toBeUndefined();
  });

  it("links legacy fault-tree leaves and model-local events to the DA parameters they name", () => {
    const sy = fixture("sy-hcl");
    const definitions = records(field(sy, "systemDefinitions"));
    const system = String(field(definitions[0] ?? {}, "uuid"));
    const legacyModel: JsonRecord = {
      uuid: "SY-LEGACY-MODEL",
      systemReference: system,
      description: "Legacy two-train fault tree",
      modelRepresentation: "Fault tree",
      faultTree: {
        id: "LEGACY-TOP",
        type: "AND",
        name: "Both trains fail",
        children: [
          { id: "LEGACY-LEAF-A", type: "BE", name: "Train A fails to start", be: "BE-LEGACY-A", mode: "FAILURE_TO_START", source: "DA-P1", prob: "0.01" },
          { id: "LEGACY-LEAF-B", type: "BE", name: "Train B fails to run", be: "BE-LEGACY-B", mode: "FAILURE_TO_RUN", source: "DA-P2", prob: "0.02" },
        ],
      },
      basicEvents: [{ uuid: "BE-LEGACY-B", name: "Train B fails to run", eventType: "BASIC", failureMode: "FAILURE_TO_RUN", probability: 0.02, repairModeled: false, implementsSrs: [] }],
      implementsSrs: [],
    };
    const legacyLookups: MigrationLookups = {
      ...lookups,
      daParameters: new Map([["da-legacy", new Map<string, DaParameterFacts>([
        ["DA-P1", { parameterType: "PROBABILITY", quantificationModel: "DEMAND_PROBABILITY" }],
        ["DA-P2", { parameterType: "FAILURE_RATE", quantificationModel: "RUNNING_RATE" }],
      ])]]),
    };
    const timed = definitions.map((definition, index) => (index === 0 ? { ...definition, missionTimeHours: 12 } : definition));
    const old = { ...sy, linkedWorkbooks: { DA: "da-legacy" }, systemDefinitions: timed, systemLogicModels: [...records(field(sy, "systemLogicModels")), legacyModel] };
    const next = converted((scope) => convertSyMef(old, legacyLookups, scope, PROJECT_ID));
    expect(expressionOf(eventById(next, "BE-LEGACY-A"))).toEqual(parameter("da-legacy", "DA-P1"));
    const local = records(field(byId(field(next, "systemLogicModels"), "uuid", "SY-LEGACY-MODEL"), "basicEvents"))[0] ?? {};
    expect(expressionOf(local)).toEqual({ node: "MODEL", model: { form: "MISSION", rate: parameter("da-legacy", "DA-P2"), missionTime: point("HOURS", 12) } });
    expect(field(local, "probability")).toBeUndefined();
    expect(syIssue(next)).toBeUndefined();
    expect(converted((scope) => convertSyMef(next, legacyLookups, scope, PROJECT_ID))).toBe(next);

    const untimed = settle((scope) => convertSyMef({ ...old, systemDefinitions: definitions }, legacyLookups, scope, PROJECT_ID));
    expect(untimed.issues).toEqual(["test: SY basic event BE-LEGACY-B needs a mission time for its rate model and none is stored, so it cannot be converted."]);
    expect(records(field(byId(field(untimed.value, "systemLogicModels"), "uuid", "SY-LEGACY-MODEL"), "basicEvents"))[0]).toEqual(records(field(legacyModel, "basicEvents"))[0]);
  });

  it("takes built-in DA rows from the datasets and builds the rest from the old figures", () => {
    const sources = records(field(daHtgr, "sources"));
    const entries = sources.flatMap((source) => records(field(source, "entries")));
    const catalogued = entries.filter((entry) => typeof field(entry, "catalogCode") === "string" && LawSchema.safeParse(field(entry, "law")).success);
    expect(catalogued.length).toBeGreaterThan(40);
    for (const entry of catalogued) expect(field(entry, "law")).toEqual(datasets.get(String(field(entry, "catalogCode")))?.law);
    expect(entries.filter((entry) => field(entry, "distribution") !== undefined && ["PER_DEMAND", "PER_HOUR", "PER_YEAR", "PROBABILITY", "FRACTION", "FACTOR"].includes(String(field(entry, "quantity"))))).toEqual([]);
    expect(field(byId(entries, "id", "FSV-CIRC-REM"), "law")).toEqual({ family: "POSTERIOR", prior: null, evidence: [{ likelihood: "POISSON", failures: 14, exposure: 250000 }] });

    const custom: JsonRecord = {
      id: "SRC-CUSTOM",
      name: "Custom source",
      kind: "GENERIC_NUCLEAR",
      origin: "OTHER_NUCLEAR",
      covers: "Typed figures",
      boundaryConvention: "",
      failureCounting: "",
      quality: "",
      reference: "",
      entries: [
        { id: "C-FIT", component: "Pump", failureMode: "Fails to run", quantity: "PER_HOUR", median: 0.0000075, p95: 0.000024 },
        { id: "C-INTERVAL", component: "Valve", failureMode: "Fails to open", quantity: "PER_DEMAND", mean: 0.016, p05: 0.0013, p95: 0.046 },
        { id: "C-COUNTS", component: "Valve", failureMode: "Fails to close", quantity: "PER_DEMAND", failures: 2, exposure: 400 },
        { id: "C-MEAN", component: "Breaker", failureMode: "Fails to open", quantity: "PROBABILITY", mean: 0.003 },
        { id: "C-GAMMA", component: "Fan", failureMode: "Fails to run", quantity: "PER_HOUR", distribution: { type: "gamma", shape: 2, rate: 1000 } },
        { id: "C-YEAR", component: "Bus", failureMode: "Fails", quantity: "PER_YEAR", distribution: { type: "gamma", shape: 2, rate: 10 } },
        { id: "C-LOGNORMAL", component: "Damper", failureMode: "Fails to close", quantity: "PER_DEMAND", distribution: { type: "lognormal", median: 0.0004, errorFactor: 5 } },
        { id: "C-RESTORE", component: "Pump", failureMode: "Repair", quantity: "HOURS", distribution: { type: "lognormal", median: 8, errorFactor: 3 } },
      ],
    };
    const next = convertDa({ ...fixture("da-hcl"), sources: [custom] }, "da-hcl-wb");
    const entryOf = (id: string): JsonRecord => byId(field(records(field(next, "sources"))[0] ?? {}, "entries"), "id", id);
    const fitted = LawSchema.parse(field(entryOf("C-FIT"), "law"));
    expect(fitted).toEqual(praxisLaw(lognormalFit(null, 0.0000075, [{ probability: 0.95, value: 0.000024 }])));
    if (fitted.family !== "LOGNORMAL") throw new Error("The fit is not lognormal.");
    expect(fitted.errorFactor).toBeCloseTo(3.2, 10);
    expect(fitted.mean).toBeCloseTo(0.000009630454167670119, 15);
    expect(LawSchema.parse(field(entryOf("C-INTERVAL"), "law"))).toMatchObject({ family: "LOGNORMAL", mean: 0.016 });
    expect(field(entryOf("C-COUNTS"), "law")).toEqual({ family: "POSTERIOR", prior: null, evidence: [{ likelihood: "BINOMIAL", failures: 2, exposure: 400 }] });
    expect(field(entryOf("C-MEAN"), "law")).toEqual({ family: "POINT", value: 0.003 });
    expect(field(entryOf("C-GAMMA"), "law")).toEqual({ family: "GAMMA", shape: 2, rate: 1000 });
    expect(field(entryOf("C-YEAR"), "law")).toEqual({ family: "GAMMA", shape: 2, rate: 10 });
    expect(field(entryOf("C-LOGNORMAL"), "law")).toEqual(asRecord(lognormalOf(0.0004, 5)));
    expect([field(entryOf("C-RESTORE"), "law"), field(entryOf("C-RESTORE"), "distribution")]).toEqual([undefined, { type: "lognormal", median: 8, errorFactor: 3 }]);
    expect(daIssue(next)).toBeUndefined();
  });

  it("gives typed DA parameters an estimate and leaves calculated ones to DA", () => {
    const old = fixture("da-htgr");
    const parameters = records(field(old, "parameters"));
    const calculated = parameters.find((candidate) => field(candidate, "quantificationModel") === "DEMAND_PROBABILITY");
    const frequencies = parameters.filter((candidate) => field(candidate, "quantificationModel") === "FREQUENCY");
    const frequency = frequencies[0];
    if (calculated === undefined || frequency === undefined) throw new Error("The fixture lacks the needed parameters.");
    const typedDemand = { ...calculated, uuid: "TYPED-DEMAND", valueMode: "TYPED" };
    const typedRate = { ...calculated, uuid: "TYPED-RATE", valueMode: "TYPED", quantificationModel: "RUNNING_RATE", parameterType: "FAILURE_RATE", value: 0.00001, uncertainty: { distribution: { type: "gamma", shape: 0.5, rate: 50000 } } };
    const typedPoint = { ...without(calculated, ["uncertainty"]), uuid: "TYPED-POINT", valueMode: "TYPED", value: 0.004 };
    const typedMean = { ...frequency, uuid: "TYPED-MEAN", valueMode: "TYPED" };
    const typedMedian = { ...frequency, uuid: "TYPED-MEDIAN", valueMode: "TYPED", valueType: "POINT_ESTIMATE" };
    const next = convertDa({ ...old, parameters: [...parameters, typedDemand, typedRate, typedPoint, typedMean, typedMedian] }, "da-wb");
    const parameterOf = (id: string): JsonRecord => byId(field(next, "parameters"), "uuid", id);
    const distribution = record(field(record(field(calculated, "uncertainty")), "distribution"));
    expect(field(parameterOf(String(field(calculated, "uuid"))), "estimate")).toBeUndefined();
    for (const id of [String(field(calculated, "uuid")), ...frequencies.map((candidate) => String(field(candidate, "uuid")))]) {
      expect(["value", "valueType", "uncertainty", "estimate"].map((key) => field(parameterOf(id), key))).toEqual([undefined, undefined, undefined, undefined]);
    }
    expect(expressionOf(parameterOf("TYPED-DEMAND"), "estimate")).toEqual({ node: "VALUE", value: { unit: "PROBABILITY", law: { family: "BETA", alpha: field(distribution, "alpha"), beta: field(distribution, "betaParam"), lower: 0, upper: 1 } } });
    expect(expressionOf(parameterOf("TYPED-RATE"), "estimate")).toEqual({ node: "VALUE", value: { unit: "PER_HOUR", law: { family: "GAMMA", shape: 0.5, rate: 50000 } } });
    expect(expressionOf(parameterOf("TYPED-POINT"), "estimate")).toEqual(point("PROBABILITY", 0.004));
    const lognormal = record(field(record(field(frequency, "uncertainty")), "distribution"));
    expect(expressionOf(parameterOf("TYPED-MEAN"), "estimate")).toEqual({ node: "VALUE", value: { unit: "PER_YEAR", law: { family: "LOGNORMAL", mean: field(frequency, "value"), errorFactor: field(lognormal, "errorFactor"), level: 0.95 } } });
    expect(expressionOf(parameterOf("TYPED-MEDIAN"), "estimate")).toEqual(valued("PER_YEAR", lognormalOf(Number(field(lognormal, "median")), Number(field(lognormal, "errorFactor")))));
    expect(daIssue(next)).toBeUndefined();
  });

  it("copies the estimate of a DA frequency linked from IE from its stored value", () => {
    const linked = records(field(fixture("da-sfr"), "parameters")).filter((candidate) => field(candidate, "quantificationModel") === "FREQUENCY" && field(candidate, "valueMode") === "LINKED");
    expect(linked.length).toBe(2);
    for (const old of linked) {
      const next = byId(field(daSfr, "parameters"), "uuid", String(field(old, "uuid")));
      const distribution = record(field(record(field(old, "uncertainty")), "distribution"));
      expect(field(next, "valueType")).toBeUndefined();
      expect(expressionOf(next, "estimate")).toEqual({ node: "VALUE", value: { unit: "PER_YEAR", law: { family: "LOGNORMAL", mean: field(old, "value"), errorFactor: field(distribution, "errorFactor"), level: 0.95 } } });
    }
  });

  it("moves DA basic-event needs onto expressions", () => {
    const old = fixture("da-htgr");
    const held = String(field(records(field(old, "parameters"))[0] ?? {}, "uuid"));
    const needs: JsonRecord = {
      sources: [],
      initiators: [],
      humanErrors: [],
      ccfGroups: [],
      states: [],
      basicEvents: [
        { id: "N-1", code: "N-1", name: "Held by DA", failureMode: "FAILURE_TO_START", value: 0.001, valueUnit: "PROBABILITY", valueHeldBy: "DA", valueHolderId: held, included: true },
        { id: "N-2", code: "N-2", name: "Typed rate", failureMode: "FAILURE_TO_RUN", value: 0.0002, valueUnit: "PER_HOUR", importedMissionTimeHours: 72, missionTimeHours: 72, valueHeldBy: "TYPED", included: true },
        { id: "N-3", code: "N-3", name: "Operator", failureMode: "HUMAN_ERROR", value: 0.01, valueUnit: "PROBABILITY", valueHeldBy: "HRA", valueHolderId: "HFE-1", included: true },
      ],
    };
    const next = convertDa({ ...old, dataNeeds: needs }, "da-wb");
    const events = records(field(record(field(next, "dataNeeds")), "basicEvents"));
    expect(expressionOf(events[0] ?? {})).toEqual(parameter("da-wb", held));
    expect(expressionOf(events[1] ?? {})).toEqual({ node: "MODEL", model: { form: "MISSION", rate: point("PER_HOUR", 0.0002), missionTime: point("HOURS", 72) } });
    expect(events[2]).toEqual(records(field(needs, "basicEvents"))[2]);
    expect([field(events[0] ?? {}, "value"), field(events[1] ?? {}, "valueUnit")]).toEqual([undefined, undefined]);
    expect(["importedMissionTime", "missionTime", "importedMissionTimeHours", "missionTimeHours"].map((key) => field(events[1] ?? {}, key))).toEqual([point("HOURS", 72), point("HOURS", 72), undefined, undefined]);
    for (const event of events) expect(DaBasicEventNeedSchema.safeParse(event).success).toBe(true);
    expect(daIssue(next)).toBeUndefined();

    const untimed = { id: "N-4", code: "N-4", name: "Typed rate without a mission", failureMode: "FAILURE_TO_RUN", value: 0.0002, valueUnit: "PER_HOUR", valueHeldBy: "TYPED", included: true };
    const standbyNeed = { id: "N-5", code: "N-5", name: "Standby held by DA", failureMode: "FAILURE_TO_START", value: 0.0001, valueUnit: "PER_HOUR", valueHeldBy: "DA", valueHolderId: "STANDBY-1", included: true };
    const standbyParameter = { ...records(field(old, "parameters"))[0], uuid: "STANDBY-1", quantificationModel: "STANDBY_RATE", parameterType: "FAILURE_RATE" };
    const failed = settle((scope) => convertDaMef({ ...old, parameters: [...records(field(old, "parameters")), standbyParameter], dataNeeds: { ...needs, basicEvents: [untimed, standbyNeed] } }, { workbookId: "da-wb", datasets }, scope));
    expect(failed.issues).toEqual([
      "test: DA basic event need N-4 needs a mission time for its rate model and none is stored, so it cannot be converted.",
      "test: DA basic event need N-5 needs a test interval for its rate model and none is stored, so it cannot be converted.",
    ]);
    expect(records(field(record(field(failed.value, "dataNeeds")), "basicEvents"))).toEqual([untimed, standbyNeed]);
    const tested = convertDa({ ...old, parameters: [...records(field(old, "parameters")), standbyParameter], dataNeeds: { ...needs, basicEvents: [{ ...standbyNeed, testIntervalHours: 720 }] } }, "da-wb");
    expect(expressionOf(records(field(record(field(tested, "dataNeeds")), "basicEvents"))[0] ?? {})).toEqual({ node: "MODEL", model: { form: "STANDBY", rate: parameter("da-wb", "STANDBY-1"), testInterval: point("HOURS", 720) } });
  });

  it("moves DA initiator and common cause needs onto frequencies and factor models", () => {
    const data = fixture("da-records");
    const needs: JsonRecord = { sources: [], basicEvents: [], humanErrors: [], states: [], initiators: field(data, "initiatorNeeds") ?? [], ccfGroups: field(data, "ccfGroupNeeds") ?? [] };
    const next = record(field(convertDa({ ...fixture("da-htgr"), dataNeeds: needs }, "da-wb"), "dataNeeds"));
    const initiator = (id: string): JsonRecord => byId(field(next, "initiators"), "id", id);
    expect(field(initiator("IEG-01"), "frequency")).toEqual({ expression: parameter("da-wb", "DA-IE-01"), basis: "per-plant-year" });
    expect(field(initiator("IEG-08"), "frequency")).toEqual({ expression: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "LOGNORMAL", mean: 0.0145, errorFactor: 6.1, level: 0.95 } } }, basis: "per-plant-year" });
    expect(field(initiator("IEG-12"), "frequency")).toEqual({ expression: valued("PER_YEAR", lognormalOf(0.004, 10)), basis: "per-reactor-year" });
    for (const id of ["IEG-01", "IEG-08", "IEG-12"]) {
      expect(["meanFrequency", "medianFrequency", "errorFactor", "frequencyUnit"].map((key) => field(initiator(id), key))).toEqual([undefined, undefined, undefined, undefined]);
    }
    const group = (id: string): JsonRecord => byId(field(next, "ccfGroups"), "id", id);
    expect(field(group("CCF-RPS-DIV"), "factors")).toEqual({ model: "MGL", factors: [point("FRACTION", 0.013462465391039222)] });
    expect(field(group("CCF-RPS-DIV"), "total")).toEqual(point("PROBABILITY", 0.00076103500761035));
    expect(CcfFactorModelSchema.parse(field(group("CCF-RCCS-DUCT"), "factors"))).toEqual({ model: "ALPHA_FACTOR", testing: "NON_STAGGERED", alphas: { node: "VALUE", law: { family: "FIXED", values: [0.9805832898351681, 0.009684892680069099, 0.006201814393530763, 0.003530003091231979] } } });
    expect(field(group("CCF-RCCS-DUCT"), "modelType")).toBeUndefined();
  });

  it("rebuilds DA common cause estimates as the app does and converts typed factors", () => {
    for (const estimate of DA_ANALYSIS_HTGR.ccfParameterEstimations ?? []) {
      expect(field(byId(field(daHtgr, "ccfParameterEstimations"), "uuid", estimate.uuid), "factors")).toEqual(asRecord(estimate.factors ?? {}));
    }
    for (const estimate of records(field(daHtgr, "ccfParameterEstimations"))) {
      expect(["modelType", "parameters", "uncertainty"].map((key) => field(estimate, key))).toEqual([undefined, undefined, undefined]);
    }
    const typed = records(field(fixture("da-records"), "ccfParameterEstimations"));
    const next = convertDa({ ...fixture("da-htgr"), ccfParameterEstimations: [...records(field(fixture("da-htgr"), "ccfParameterEstimations")), ...typed] }, "da-wb");
    const factorsOf = (id: string): Json | undefined => field(byId(field(next, "ccfParameterEstimations"), "uuid", id), "factors");
    expect(factorsOf("DA-CCF-40")).toEqual({ model: "MGL", factors: [point("FRACTION", 0.020886043269479012), point("FRACTION", 0.3964771322620519)] });
    expect(factorsOf("DA-CCF-41")).toEqual({ model: "BETA_FACTOR", beta: point("FRACTION", 0.05) });
    expect(factorsOf("DA-CCF-42")).toEqual({ model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: { node: "VALUE", law: { family: "FIXED", values: [0.97, 0.03] } } });
    expect(daIssue(next)).toBeUndefined();

    const odd = [{ ...typed[0], uuid: "DA-CCF-43", modelType: "OTHER_EQUIVALENT" }, { ...typed[1], uuid: "DA-CCF-44", uncertainty: { distribution: { type: "beta", alpha: 1, betaParam: 19 } } }];
    const { issues } = settle((scope) => convertDaMef({ ...fixture("da-hcl"), ccfParameterEstimations: odd }, { workbookId: "da-hcl-wb", datasets }, scope));
    expect(issues).toEqual([
      "test: DA common cause estimate DA-CCF-43 uses the OTHER_EQUIVALENT model, which has no exact factor model in the contract.",
      "test: DA common cause estimate DA-CCF-44 holds an uncertainty distribution that names no factor, so it cannot be converted.",
    ]);
  });

  it("moves SY common cause groups onto factor models and member totals", () => {
    const seeded = new Map(SY_ANALYSIS_HTGR.commonCauseFailureGroups.map((group) => [group.uuid, group]));
    const groups = records(field(syHtgr, "commonCauseFailureGroups"));
    expect(groups.length).toBe(12);
    for (const group of groups) {
      const id = String(field(group, "uuid"));
      expect(["modelType", "modelSpecificParameters"].map((key) => field(group, key))).toEqual([undefined, undefined]);
      expect(field(group, "factors")).toEqual(asRecord(seeded.get(id)?.factors ?? {}));
      const total = expressionOf(group, "total");
      const members = records(field(record(field(group, "members")), "basicEvents")).map((member) => eventById(syHtgr, String(field(member, "id"))));
      expect(total).toEqual(expressionOf(members[0] ?? {}));
      expect(total.node).toBe("PARAMETER");
    }
    const old = fixture("sy-htgr");
    const changed = records(field(old, "commonCauseFailureGroups")).map((group) => (field(group, "uuid") === "CCF-RPS-DIV"
      ? { ...group, modelSpecificParameters: { mglParameters: { beta: 0.02, totalFailureProbability: 0.00076103500761035 } } }
      : group));
    const stale = convertSy({ ...old, commonCauseFailureGroups: changed });
    expect(field(byId(field(stale, "commonCauseFailureGroups"), "uuid", "CCF-RPS-DIV"), "factors")).toEqual({ model: "MGL", factors: [point("FRACTION", 0.02)] });

    const unlinked = convertSy(fixture("sy-sfr"));
    const loops = byId(field(unlinked, "commonCauseFailureGroups"), "uuid", "CCF-DRACS-LOOP");
    expect(field(loops, "factors")).toEqual({ model: "MGL", factors: [point("FRACTION", 0.020886043269479012), point("FRACTION", 0.3964771322620519)] });
    expect(syIssue(unlinked)).toBeUndefined();

    const empty = records(field(old, "commonCauseFailureGroups")).map((group) => (field(group, "uuid") === "CCF-RPS-DIV" ? without(group, ["modelSpecificParameters"]) : group));
    expect(settle((scope) => convertSyMef({ ...old, commonCauseFailureGroups: empty }, lookups, scope, PROJECT_ID)).issues).toEqual([
      "test: SY common cause group CCF-RPS-DIV holds no MGL parameters, so it has no factors to convert.",
    ]);
  });

  it("brings ESQ records onto the contract and fills old standard errors", () => {
    const work = { run: { runId: "R-1", revision: 1, at: "2026-09-01T00:00:00.000Z", inputs: "x", logic: { flags: true, loopBreaks: "AS_SET", exclusions: true, expandCcf: false }, trials: 400, seed: 1, method: "MONTE_CARLO", correlation: "SHARED", families: [{ familyId: "F-1", point: 1e-6, mean: 2e-6, standardDeviation: 4e-6, p05: 1e-7, p50: 1e-6, p95: 6e-6 }], total: { point: 1e-6, mean: 2e-6, standardDeviation: 2e-6, p05: 1e-7, p50: 1e-6, p95: 6e-6 } } };
    const old = { ...esqHtgrOld, uncertaintyWork: { ...record(field(esqHtgrOld, "uncertaintyWork")), ...work } };
    const next = convertEsq(old);
    const model = record(field(next, "model"));
    const oldEvents = records(field(record(field(old, "model")), "events"));
    for (const event of records(field(model, "events"))) {
      const before = byId(oldEvents, "id", String(field(event, "id")));
      if (!component(event)) {
        expect(without(event, ["missionTime"])).toEqual(without(before, ["missionTimeHours"]));
        expect(field(event, "missionTime")).toEqual(point("HOURS", Number(field(before, "missionTimeHours"))));
        continue;
      }
      expect(expressionOf(event)).toEqual(parameter("da-wb", String(field(before, "holderId"))));
      expect([field(event, "heldBy"), field(event, "holderId"), field(event, "value")]).toEqual(["DA", field(before, "holderId"), undefined]);
    }
    const daParameters = lookups.daParameters.get("da-wb") ?? new Map<string, DaParameterFacts>();
    for (const entry of records(field(model, "parameters"))) {
      const known = daParameters.get(String(field(entry, "id")));
      if (known?.quantificationModel === "DEMAND_PROBABILITY" || known?.quantificationModel === "FREQUENCY") {
        expect(field(entry, "quantificationModel")).toBe(known.quantificationModel);
        expect(["value", "valueType", "distribution", "p05", "p95"].map((key) => field(entry, key))).toEqual([undefined, undefined, undefined, undefined, undefined]);
      }
    }
    for (const initiator of records(field(model, "initiators"))) {
      expect(field(initiator, "frequency")).toEqual({ expression: parameter("da-wb", String(field(initiator, "holderId"))), basis: "per-plant-year" });
      expect(["meanFrequency", "medianFrequency", "errorFactor", "frequencyUnit"].map((key) => field(initiator, key))).toEqual([undefined, undefined, undefined, undefined]);
    }
    for (const entry of records(field(model, "ccfGroups"))) {
      const group = byId(field(syHtgr, "commonCauseFailureGroups"), "uuid", String(field(entry, "id")));
      expect([field(entry, "factors"), field(entry, "total"), field(entry, "modelType"), field(entry, "totalProbability")]).toEqual([field(group, "factors"), field(group, "total"), undefined, undefined]);
    }
    const run = record(field(record(field(next, "uncertaintyWork")), "run"));
    expect(field(records(field(run, "families"))[0] ?? {}, "standardError")).toBeCloseTo(0.0000002, 15);
    expect(field(record(field(run, "total")), "standardError")).toBeCloseTo(0.0000001, 15);
    expect(esqIssue(next)).toBeUndefined();

    const unlinked = convertEsq({ ...fixture("esq-sfr"), linkedWorkbooks: without(record(field(fixture("esq-sfr"), "linkedWorkbooks")), ["DA", "SY"]) });
    const typedInitiator = records(field(record(field(unlinked, "model")), "initiators"))[0] ?? {};
    expect(frequencyOf(typedInitiator)).toEqual({ expression: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "LOGNORMAL", mean: 0.79, errorFactor: 4, level: 0.95 } } }, basis: "per-plant-year" });
    const record0 = records(field(record(field(unlinked, "model")), "ccfGroups"))[0] ?? {};
    expect([field(record0, "factors"), field(record0, "total")]).toEqual([undefined, point("PROBABILITY", 0.006915089995696231)]);
  });

  it("converts typed ESQ initiator choices and barrier cells", () => {
    const data = fixture("esq-records");
    const old = fixture("esq-htgr");
    const cells = records(field(record(field(old, "barrierWork")), "cells"));
    const first = cells[0] ?? {};
    const extra = [
      { ...first, id: "BC-2", load: field(data, "daSide") ?? null, capacity: field(data, "fragilitySide") ?? null, typed: field(data, "typedCell") ?? null, ofRecord: "TYPED" },
    ];
    const mef = { ...old, modelDecisions: { ...record(field(old, "modelDecisions") ?? {}), initiatorChoices: field(data, "initiatorChoices") ?? [] }, barrierWork: { ...record(field(old, "barrierWork")), cells: [...cells, ...extra] } };
    const next = convertEsq(mef);
    const choices = records(field(record(field(next, "modelDecisions")), "initiatorChoices"));
    expect(choices[0]).toEqual({ groupId: "IEG-01", source: "TYPED", expression: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "LOGNORMAL", mean: 2.5, errorFactor: 2.3, level: 0.95 } } }, basis: "Typed from the design-stage review before the IE estimate was ready." });
    expect(choices[1]).toEqual({ groupId: "IEG-02", source: "IE" });
    const converted0 = byId(field(record(field(next, "barrierWork")), "cells"), "id", "BC-1");
    const oldLoad = record(field(first, "load"));
    expect(field(converted0, "load")).toEqual({ source: "TYPED", variable: { law: { family: "POINT", value: 24 }, fields: [] }, basis: field(oldLoad, "basis") });
    const aleatory = lognormalOf(33.35, 1.287);
    const epistemic = lognormalOf(33.35, 1.2);
    if (aleatory.family !== "LOGNORMAL" || epistemic.family !== "LOGNORMAL") throw new Error("The fits are not lognormal.");
    const meanLaw = praxisLaw({ kind: "SCALE", law: epistemic, factor: aleatory.mean / 33.35 });
    expect(field(converted0, "capacity")).toEqual({ source: "TYPED", variable: { law: asRecord(aleatory), fields: [{ field: "mean", value: valued("QUANTITY", meanLaw) }] }, basis: field(record(field(first, "capacity")), "basis") });
    expect(aleatory.errorFactor).toBeCloseTo(1.287, 12);
    expect(meanLaw).toMatchObject({ family: "LOGNORMAL", errorFactor: epistemic.errorFactor });
    if (meanLaw.family === "LOGNORMAL") expect(meanLaw.mean / epistemic.mean).toBeCloseTo(aleatory.mean / 33.35, 12);
    const converted1 = byId(field(record(field(next, "barrierWork")), "cells"), "id", "BC-2");
    expect(field(converted1, "load")).toEqual({ source: "DA", parameterId: "DA-BE-205", basis: "The circulator run time comes from the DA estimate." });
    expect(field(converted1, "capacity")).toEqual({ source: "FRAGILITY", fragility: { median: 0.9, betaR: 0.25, betaU: 0.35 }, basis: "Cavity liner capacity from the design fragility study." });
    expect(field(converted1, "typed")).toEqual({ expression: { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "TRUNCATED", law: { family: "LOGNORMAL", mean: 0.12, errorFactor: 2, level: 0.95 }, lower: null, upper: 1 } } }, basis: "Engineering judgment on the heat-up window before the SC runs finished." });
    expect(esqIssue(next)).toBeUndefined();

    const sfr = convertEsq(fixture("esq-sfr"));
    const uniform = records(field(record(field(sfr, "barrierWork")), "cells"))[0] ?? {};
    expect(field(record(field(record(field(uniform, "capacity")), "variable")), "law")).toEqual({ family: "UNIFORM", lower: 180, upper: 210 });

    const sharedKey = { parameter: "median", distribution: { type: "lognormal", median: 33.35, errorFactor: 1.2 }, correlationKey: "CORE-HEATUP" };
    const correlated = { ...first, capacity: { ...record(field(first, "capacity")), uncertain: [sharedKey] } };
    const twin = { ...correlated, id: "BC-3" };
    const { issues } = settle((scope) => convertEsqMef({ ...old, barrierWork: { ...record(field(old, "barrierWork")), cells: [correlated, twin] } }, lookups, scope));
    expect(issues).toEqual([
      "test: the median uncertainty of the capacity of ESQ barrier cell BC-1 shares the correlation key CORE-HEATUP. A shared draw needs a parameter, so it cannot be converted.",
      "test: the median uncertainty of the capacity of ESQ barrier cell BC-3 shares the correlation key CORE-HEATUP. A shared draw needs a parameter, so it cannot be converted.",
    ]);
  });

  it("converts IE group, quantification and data source frequencies", () => {
    const data = fixture("ie-records");
    const old = { ...asRecord(createBlankIe("IE Workbook", "ie-owner")), ...data };
    const next = converted((scope) => convertIeMef(old, scope));
    expect(ieIssue(next)).toBeUndefined();
    expect(previousIeIssue(next, "ie-owner")).toBeUndefined();
    expect(converted((scope) => convertIeMef(next, scope))).toBe(next);
    const group = (id: string): JsonRecord => byId(field(next, "initiatingEventGroups"), "uuid", id);
    expect(field(group("IEG-01"), "frequency")).toEqual({ expression: parameter("da-wb", "DA-IE-01"), basis: "per-plant-year" });
    expect(field(group("IEG-03"), "frequency")).toEqual({ expression: point("PER_YEAR", 0.03214285714285714), basis: "per-plant-year" });
    expect(field(group("IEG-08"), "frequency")).toEqual({ expression: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "LOGNORMAL", mean: 0.0145, errorFactor: 6.1, level: 0.95 } } }, basis: "per-plant-year" });
    expect(field(group("IEG-12"), "frequency")).toEqual({ expression: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "GAMMA", shape: 1.5, rate: 75 } } }, basis: "per-reactor-year" });
    expect([field(group("IEG-20"), "frequency"), field(group("IEG-20"), "meanFrequency")]).toEqual([undefined, undefined]);
    for (const entry of records(field(next, "initiatingEventGroups"))) expect(field(entry, "meanFrequency")).toBeUndefined();
    const quantification = (id: string): JsonRecord => byId(field(next, "quantifications"), "initiatorOrGroupId", id);
    const source = (id: string, sourceId: string): JsonRecord => byId(field(quantification(id), "dataSources"), "uuid", sourceId);
    expect(field(quantification("IEG-01"), "frequency")).toEqual(field(group("IEG-01"), "frequency"));
    expect(field(source("IEG-01", "DS-1"), "faultTreeTop")).toEqual(point("PER_YEAR", 2.943));
    expect(field(quantification("IEG-03"), "frequency")).toEqual(field(group("IEG-03"), "frequency"));
    expect(["distributionFamily", "distributionParameters", "estimate", "eventCount"].map((key) => field(source("IEG-03", "DS-1"), key))).toEqual([undefined, undefined, undefined, 4]);
    expect(field(source("IEG-08", "DS-1"), "estimate")).toEqual(valued("PER_YEAR", lognormalOf(0.007923640678507536, 6.1)));
    expect(field(source("IEG-08", "DS-2"), "estimate")).toEqual({ node: "VALUE", value: { unit: "PER_YEAR", law: { family: "GAMMA", shape: 1.5, rate: 210 } } });
    expect(field(quantification("IEG-12"), "frequency")).toEqual({ expression: point("PER_YEAR", 0.02), basis: "per-plant-year" });
    expect(field(source("IEG-12", "DS-1"), "estimate")).toEqual({ node: "VALUE", value: { unit: "PER_YEAR", law: { family: "BETA", alpha: 0.5, beta: 24.5, lower: 0, upper: 1 } } });
  });

  it("converts ES and hazard event tree frequencies", () => {
    const tree = fixture("es-event-tree");
    const old = { ...asRecord(createBlankEs("ES Workbook", "es-owner")), eventTrees: [tree] };
    const next = converted((scope) => convertEsMef(old, scope));
    expect(esIssue(next)).toBeUndefined();
    expect(previousEsIssue(next, "es-owner")).toBeUndefined();
    expect(converted((scope) => convertEsMef(next, scope))).toBe(next);
    expect(field(records(field(next, "eventTrees"))[0] ?? {}, "initiatingEventFrequency")).toEqual({ annualization: { basis: "PLANT_YEAR", hoursPerYear: 8760 }, expression: parameter("da-wb", "DA-IE-01") });
    const unit = (value: number, unitName: string | undefined): Json | undefined => {
      const frequency: JsonRecord = unitName === undefined ? { value } : { value, unit: unitName, annualization: { basis: "CRITICAL_YEAR", hoursPerYear: 7000 } };
      const converted0 = converted((scope) => convertEsMef({ eventTrees: [{ ...tree, initiatingEventFrequency: frequency }] }, scope));
      const first = records(field(converted0, "eventTrees"))[0] ?? {};
      expect(EventTreeSchema.safeParse(first).success).toBe(true);
      return field(record(field(first, "initiatingEventFrequency")), "expression");
    };
    expect(unit(0.01, undefined)).toEqual(point("PER_YEAR", 0.01));
    expect(unit(2e-6, "PER_HOUR")).toEqual(point("PER_HOUR", 2e-6));
    expect(unit(2e-6, "PER_SECOND")).toEqual(point("PER_HOUR", 2e-6 * 3600));
    expect(unit(3e-4, "PER_MINUTE")).toEqual(point("PER_HOUR", 3e-4 * 60));
    expect(unit(0.048, "PER_DAY")).toEqual(point("PER_HOUR", 0.048 / 24));

    const hazard = { name: "Seismic PRA Workbook", owner: "hazard-owner", hazardConditionedModels: fixture("hazard-models") };
    const nextHazard = converted((scope) => convertHazardMef(hazard, scope));
    expect(hazardIssue(nextHazard)).toBeUndefined();
    const models = record(field(nextHazard, "hazardConditionedModels"));
    expect(HazardConditionedMethodModelsSchema.safeParse(models).success).toBe(true);
    expect(field(records(field(models, "eventTrees"))[0] ?? {}, "initiatingEventFrequency")).toEqual({ expression: point("PER_YEAR", 0.001) });
  });

  it("types the stored values of editor-owned fault tree events in hazard and IE workbooks", () => {
    const models = fixture("hazard-models");
    const [first, second] = records(field(record(field(models, "faultTreeCatalogue")), "basicEvents"));
    if (first === undefined || second === undefined) throw new Error("The hazard fixture holds two basic events.");
    const rate: JsonRecord = { ...second, probability: { value: 0.0004798848184297544, quantificationBasis: { kind: "FAILURE_RATE", failureRate: { value: 2e-5, unit: "HOUR" }, missionTime: { value: 1, unit: "DAY" }, conversion: "EXPONENTIAL" } } };
    const linear: JsonRecord = { ...second, id: "5d7c7a40-2b8c-4b1e-9d64-2f6f1a0c9e11", code: "SE-LIN", probability: { value: 0.1, quantificationBasis: { kind: "FAILURE_RATE", failureRate: { value: 0.001, unit: "HOUR" }, missionTime: { value: 100, unit: "HOUR" }, conversion: "LINEAR" } } };
    const hazard = { name: "Seismic PRA Workbook", owner: "hazard-owner", hazardConditionedModels: { ...models, faultTreeCatalogue: { basicEvents: [first, rate, linear] } } };
    const next = converted((scope) => convertHazardMef(hazard, scope));
    expect(hazardIssue(next)).toBeUndefined();
    expect(converted((scope) => convertHazardMef(next, scope))).toBe(next);
    const stored = records(field(record(field(record(field(next, "hazardConditionedModels")), "faultTreeCatalogue")), "basicEvents"));
    expect(field(stored[0] ?? {}, "probability")).toEqual({ value: 0.001, expression: point("PROBABILITY", 0.001) });
    expect(field(stored[1] ?? {}, "probability")).toEqual({
      value: 0.0004798848184297544,
      expression: { node: "MODEL", model: { form: "MISSION", rate: point("PER_HOUR", 2e-5), missionTime: point("HOURS", 24) } },
    });
    expect(stored[2]).toEqual(linear);
    const nextModels = record(field(next, "hazardConditionedModels"));
    expect(hazardIssue({ ...next, hazardConditionedModels: { ...nextModels, faultTreeCatalogue: { basicEvents: [{ ...first, probability: { value: 2 } }] } } })).toContain("Fault tree catalogue.");

    const ie = { ...asRecord(createBlankIe("IE Workbook", "ie-owner")), ...fixture("ie-records") };
    const tree: Json[] = [
      { id: "TOP", label: "Top", nodeType: "GATE", gate: "OR" },
      { id: "BE-1", parentId: "TOP", label: "Pump fails", nodeType: "BASIC", probability: 0.004 },
      { id: "BE-2", parentId: "TOP", label: "Valve fails", nodeType: "BASIC" },
    ];
    const withTree = { ...ie, quantifications: records(field(ie, "quantifications")).map((quantification, index) => (index === 0
      ? { ...quantification, dataSources: records(field(quantification, "dataSources")).map((source, at) => (at === 0 ? { ...source, faultTree: tree } : source)) }
      : quantification)) };
    const nextIe = converted((scope) => convertIeMef(withTree, scope));
    expect(ieIssue(nextIe)).toBeUndefined();
    expect(converted((scope) => convertIeMef(nextIe, scope))).toBe(nextIe);
    const nodes = records(field(records(field(records(field(nextIe, "quantifications"))[0] ?? {}, "dataSources"))[0] ?? {}, "faultTree"));
    expect(nodes.map((node) => field(node, "expression"))).toEqual([undefined, point("PROBABILITY", 0.004), undefined]);
  });

  it("converts SY and ESQ HCL uncertainty settings into contract laws and Dirichlet rows", () => {
    const sy = fixture("sy-hcl");
    const configurations = records(field(sy, "dependencyHclConfigurations"));
    const configuration = configurations[0] ?? {};
    const old = { ...sy, dependencyHclConfigurations: [{ ...configuration, solverSettings: { ...record(field(configuration, "solverSettings")), uncertainty: fixture("hcl-sy-uncertainty") } }] };
    expect(syIssue(old)).toBeDefined();
    const next = convertSy(old);
    expect(syIssue(next)).toBeUndefined();
    expect(convertSy(next)).toBe(next);
    const nextConfiguration = records(field(next, "dependencyHclConfigurations"))[0] ?? {};
    expect(WorkbookHclUncertaintyConfigurationSchema.safeParse(nextConfiguration).success).toBe(true);
    const settings = record(field(record(field(nextConfiguration, "solverSettings")), "uncertainty"));
    expect(Object.keys(settings).sort()).toEqual(["basicEvents", "cptGenerators", "cptRows", "sampleCount", "sampler", "seed"]);
    expect(field(settings, "sampler")).toBe("LHS");
    const laws = records(field(settings, "basicEvents")).map((entry) => field(record(field(record(field(entry, "expression")), "value")), "law"));
    expect(laws).toEqual([
      truncatedAtOne(lognormalOf(0.0011, 3)),
      { family: "BETA", alpha: 2, beta: 1800, lower: 0, upper: 1 },
      truncatedAtOne({ family: "GAMMA", shape: 2, rate: 2000 }),
      truncatedAtOne({ family: "GAMMA", shape: 1, rate: 50 }),
      { family: "LOGIT_NORMAL", mu: -5, sigma: 0.8 },
      { family: "TRIANGULAR", lower: 0.001, mode: 0.002, upper: 0.005 },
      { family: "UNIFORM", lower: 0.01, upper: 0.03 },
      { family: "TRUNCATED", law: { family: "NORMAL", mean: 0.02, standardDeviation: 0.004 }, lower: 0, upper: 1 },
    ]);
    const rows = records(field(settings, "cptRows")).map((entry) => field(entry, "row"));
    expect(rows).toEqual([{ node: "VALUE", law: { family: "DIRICHLET", concentrations: [199, 1] } }, { node: "VALUE", law: { family: "DIRICHLET", concentrations: [95, 5] } }]);
    const generator = record(field(records(field(settings, "cptGenerators"))[0] ?? {}, "generator"));
    expect([field(generator, "kind"), field(generator, "conversion"), field(generator, "missionTime")]).toEqual(["SEISMIC_PGA_BINS", "POISSON", point("YEARS", 1)]);
    expect(records(field(generator, "bins")).map((bin) => field(bin, "frequency"))).toEqual([
      valued("PER_YEAR", lognormalOf(3e-4, 3)),
      valued("PER_YEAR", lognormalOf(1e-4, 3)),
      valued("PER_YEAR", lognormalOf(3e-5, 5)),
      valued("PER_YEAR", lognormalOf(1e-5, 5)),
      valued("PER_YEAR", lognormalOf(3e-6, 10)),
      point("PER_YEAR", 0),
    ]);

    const esq = { ...fixture("esq-hcl"), ...fixture("hcl-esq") };
    expect(esqIssue(esq)).toBeDefined();
    const nextEsq = convertEsq(esq);
    expect(esqIssue(nextEsq)).toBeUndefined();
    const esqConfiguration = records(field(nextEsq, "hclConfigurations"))[0] ?? {};
    expect(WorkbookHclUncertaintyConfigurationSchema.safeParse(esqConfiguration).success).toBe(true);
    const esqSettings = record(field(record(field(esqConfiguration, "solverSettings")), "uncertainty"));
    expect(records(field(esqSettings, "cptRows")).map((entry) => field(entry, "row"))).toEqual([
      { node: "VALUE", law: { family: "DIRICHLET", concentrations: [98, 2] } },
      { node: "VALUE", law: { family: "DIRICHLET", concentrations: [80, 20] } },
    ]);
    const fragility = record(field(records(field(esqSettings, "cptGenerators"))[0] ?? {}, "generator"));
    const z = standardQuantile();
    const median = praxisLaw(lognormalFit(null, 0.5, [{ probability: 0.95, value: 0.5 * Math.exp(z * 0.2) }]));
    expect(field(fragility, "median")).toEqual(valued("QUANTITY", median));
    expect(median).toMatchObject({ family: "LOGNORMAL", level: 0.95 });
    if (median.family === "LOGNORMAL") {
      expect(median.errorFactor).toBeCloseTo(Math.exp(1.6448536269514722 * 0.2), 9);
      expect(median.mean).toBeCloseTo(0.5 * Math.exp(0.02), 9);
    }
    expect([field(fragility, "kind"), field(fragility, "randomness"), records(field(fragility, "demands")).map((demand) => field(demand, "demand"))]).toEqual(["SEISMIC_FRAGILITY", point("FACTOR", 0.3), [0, 0.4]]);
  });

  it("converts SC mission times into hour expressions", () => {
    for (const name of ["sc-htgr", "sc-sfr"]) {
      const old = scMef(name);
      expect(scIssue(old)).toBeDefined();
      const next = converted((scope) => convertScMef(old, scope));
      expect(scIssue(next)).toBeUndefined();
      expect(previousScIssue(next, "sc-owner")).toBeUndefined();
      expect(converted((scope) => convertScMef(next, scope))).toBe(next);
      for (const entry of records(field(next, "missionTimes"))) {
        const source = byId(field(old, "missionTimes"), "uuid", String(field(entry, "uuid")));
        expect(MissionTimeDefinitionSchema.safeParse(entry).success).toBe(true);
        expect([field(entry, "missionTime"), field(entry, "missionTimeHours")]).toEqual([point("HOURS", Number(field(source, "missionTimeHours"))), undefined]);
      }
      for (const entry of records(field(next, "componentMissionTimes"))) {
        const source = byId(field(old, "componentMissionTimes"), "uuid", String(field(entry, "uuid")));
        expect(ComponentMissionTimeDefinitionSchema.safeParse(entry).success).toBe(true);
        expect([field(entry, "missionTime"), field(entry, "missionTimeHours")]).toEqual([point("HOURS", Number(field(source, "missionTimeHours"))), undefined]);
      }
    }
    expect([...scMissionTimeIds(scHtgr)]).toEqual(["MT-PLOFC", "MT-DLOFC", "MT-INGRESS", "MT-SCSL", "MT-RELIEF", "CMT-1", "CMT-2", "CMT-3", "CMT-4"]);
    const times = records(field(fixture("sc-htgr"), "missionTimes"));
    const missing = without(times[0] ?? {}, ["missionTimeHours"]);
    const zero = { ...times[1], missionTimeHours: 0 };
    const { value, issues } = settle((scope) => convertScMef({ ...scMef("sc-htgr"), missionTimes: [missing, zero] }, scope));
    expect(issues).toEqual([
      "test: SC mission time MT-PLOFC holds no mission time hours, so it cannot be converted.",
      "test: SC mission time MT-DLOFC holds 0 mission time hours, which is not a positive number, so it cannot be converted.",
    ]);
    expect(field(value, "missionTimes")).toEqual([missing, zero]);
  });

  it("links SY system mission times to the project's SC workbook or types their hours", () => {
    for (const [name, scWorkbookId] of [["sy-htgr", "sc-wb"], ["sy-sfr", "sc-sfr-wb"]] as const) {
      const old = fixture(name);
      const next = convertSy(old);
      const definitions = records(field(old, "systemDefinitions"));
      expect(definitions.filter((definition) => typeof field(definition, "missionTimeRef") === "string").length).toBeGreaterThan(4);
      for (const definition of definitions) {
        const after = byId(field(next, "systemDefinitions"), "uuid", String(field(definition, "uuid")));
        expect(SystemDefinitionSchema.safeParse(after).success).toBe(true);
        expect([field(after, "missionTimeHours"), field(after, "missionTimeRef")]).toEqual([undefined, undefined]);
        expect(field(after, "missionTime")).toEqual(expectedMissionTime(definition, scWorkbookId));
      }
    }
    const sy = fixture("sy-htgr");
    const definitionOf = (mef: JsonRecord, id: string): JsonRecord => byId(field(mef, "systemDefinitions"), "uuid", id);
    const linkedLookups: MigrationLookups = {
      ...lookups,
      scMissionTimes: new Map([...lookups.scMissionTimes, ["sc-linked", new Set(["MT-PLOFC"])]]),
      scProjects: new Map([[PROJECT_ID, ["sc-wb", "sc-sfr-wb", "sc-linked"]]]),
    };
    const linked = converted((scope) => convertSyMef({ ...sy, linkedWorkbooks: { SC: "sc-linked" } }, linkedLookups, scope, PROJECT_ID));
    expect(field(definitionOf(linked, "SYS-SCS"), "missionTime")).toEqual(parameter("sc-linked", "MT-PLOFC"));
    expect(field(definitionOf(linked, "SYS-RCCS"), "missionTime")).toEqual(point("HOURS", 72));
    const elsewhere = converted((scope) => convertSyMef(sy, lookups, scope, "another-project"));
    expect(field(definitionOf(elsewhere, "SYS-SCS"), "missionTime")).toEqual(point("HOURS", 24));

    const scs = definitionOf(sy, "SYS-SCS");
    const typed = converted((scope) => convertSyMef({ ...sy, systemDefinitions: [{ ...scs, missionTimeRef: "MT-NONE" }] }, lookups, scope, PROJECT_ID));
    expect(field(definitionOf(typed, "SYS-SCS"), "missionTime")).toEqual(point("HOURS", 24));
    const orphan = { ...without(scs, ["missionTimeHours"]), missionTimeRef: "MT-NONE" };
    const { value, issues } = settle((scope) => convertSyMef({ ...sy, systemDefinitions: [orphan] }, lookups, scope, PROJECT_ID));
    expect(issues).toEqual(["test: SY system SYS-SCS names the SC mission time MT-NONE, which no SC workbook of its project holds, and it holds no hours, so it cannot be converted."]);
    expect(definitionOf(value, "SYS-SCS")).toEqual(orphan);
  });

  it("drops DA mission hours that an estimate holds and types the rest", () => {
    const old = fixture("da-htgr");
    const parameters = records(field(old, "parameters"));
    const timed = parameters.filter((candidate) => field(candidate, "missionTimeHours") !== undefined);
    expect(timed.length).toBe(16);
    for (const entry of timed) {
      const next = byId(field(daHtgr, "parameters"), "uuid", String(field(entry, "uuid")));
      expect([field(next, "missionTimeHours"), field(next, "missionTime")]).toEqual([undefined, undefined]);
      expect(DataAnalysisParameterSchema.safeParse(next).success).toBe(true);
    }
    const recovery = parameters.find((candidate) => field(candidate, "quantificationModel") === "NON_RECOVERY");
    const mission = timed[0];
    if (recovery === undefined || mission === undefined) throw new Error("The fixture lacks the needed parameters.");
    const estimate = { node: "MODEL", model: { form: "MISSION", rate: point("PER_HOUR", 0.00001), missionTime: point("HOURS", 24) } };
    const typedRecovery = { ...recovery, uuid: "NR-MISSION", missionTimeHours: 8 };
    const estimated = { ...without(mission, ["value", "valueType", "uncertainty"]), uuid: "MISSION-TYPED", valueMode: "TYPED", estimate };
    const next = convertDa({ ...old, parameters: [...parameters, typedRecovery, estimated] }, "da-wb");
    const recoveryAfter = byId(field(next, "parameters"), "uuid", "NR-MISSION");
    expect([field(recoveryAfter, "missionTime"), field(recoveryAfter, "missionTimeHours")]).toEqual([point("HOURS", 8), undefined]);
    expect(DataAnalysisParameterSchema.safeParse(recoveryAfter).success).toBe(true);
    const estimatedAfter = byId(field(next, "parameters"), "uuid", "MISSION-TYPED");
    expect([field(estimatedAfter, "estimate"), field(estimatedAfter, "missionTime"), field(estimatedAfter, "missionTimeHours")]).toEqual([estimate, undefined, undefined]);
    expect(DataAnalysisParameterSchema.safeParse(estimatedAfter).success).toBe(true);
    expect(daIssue(next)).toBeUndefined();
  });

  it("moves ESQ tree, event and parameter mission hours onto hour expressions", () => {
    for (const old of [esqHtgrOld, fixture("esq-sfr")]) {
      const next = convertEsq(old);
      const model = record(field(next, "model"));
      const before = record(field(old, "model"));
      const hoursOf = (value: JsonRecord): JsonRecord | undefined => {
        const hours = field(value, "missionTimeHours");
        return typeof hours === "number" ? point("HOURS", hours) : undefined;
      };
      for (const tree of records(field(model, "trees"))) {
        expect(EsqTreeRecordSchema.safeParse(tree).success).toBe(true);
        expect([field(tree, "missionTime"), field(tree, "missionTimeHours")]).toEqual([hoursOf(byId(field(before, "trees"), "id", String(field(tree, "id")))), undefined]);
      }
      for (const event of records(field(model, "events"))) {
        expect(EsqEventRecordSchema.safeParse(event).success).toBe(true);
        const expected = component(event) ? undefined : hoursOf(byId(field(before, "events"), "id", String(field(event, "id"))));
        expect([field(event, "missionTime"), field(event, "missionTimeHours")]).toEqual([expected, undefined]);
      }
      expect(records(field(model, "events")).filter((event) => !component(event)).every((event) => field(event, "missionTime") !== undefined)).toBe(true);
      for (const entry of records(field(model, "parameters"))) {
        expect(EsqParameterRecordSchema.safeParse(entry).success).toBe(true);
        const quantificationModel = field(entry, "quantificationModel");
        const estimated = quantificationModel !== "FREQUENCY" && holdsEstimate(DA_ESTIMATE_MODELS.find((candidate) => candidate === quantificationModel));
        expect([field(entry, "missionTime"), field(entry, "missionTimeHours")]).toEqual([estimated ? undefined : hoursOf(byId(field(before, "parameters"), "id", String(field(entry, "id")))), undefined]);
      }
    }
    const old = fixture("esq-htgr");
    const model = record(field(old, "model"));
    const running = records(field(model, "events")).find((event) => field(event, "failureMode") === "FAILURE_TO_RUN");
    const tree = records(field(model, "trees"))[0];
    if (running === undefined || tree === undefined) throw new Error("The fixture lacks the needed records.");
    const untimed = { ...without(running, ["holderId", "missionTimeHours"]), heldBy: "TYPED", value: 0.00001, valueUnit: "PER_HOUR" };
    const zero = { ...tree, missionTimeHours: 0 };
    const { value, issues } = settle((scope) => convertEsqMef({ ...old, model: { ...model, trees: [zero], events: [untimed] } }, lookups, scope));
    expect(issues).toEqual([
      `test: ESQ tree ${String(field(tree, "id"))} holds 0 mission time hours, which is not a positive number, so it cannot be converted.`,
      `test: ESQ event ${String(field(running, "id"))} needs a mission time for its rate model and none is stored, so it cannot be converted.`,
    ]);
    expect([field(record(field(value, "model")), "trees"), field(record(field(value, "model")), "events")]).toEqual([[zero], [untimed]]);
  });

  it("keeps the DA facts that SY and ESQ read", () => {
    const parsed = facts(daHtgr);
    expect([...parsed.values()].every((value) => value.parameterType.length > 0)).toBe(true);
    expect(daParameterFacts({ parameters: [] }).size).toBe(0);
    expect([...daCcf.get("da-wb")?.values() ?? []].every((value) => value.factors !== undefined)).toBe(true);
  });
});
