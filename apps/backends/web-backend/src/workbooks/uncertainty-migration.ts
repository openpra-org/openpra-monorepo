import { DistributionType } from "interfaces-mef-types/core/events";
import { expressionReferences, type Law, type Likelihood, type UncertainExpression, type UncertainUnit } from "interfaces-mef-types/core/uncertainty";
import {
  entryHoldsLaw,
  holdsEstimate,
  type DaEstimateQuantity,
  type DaQuantificationModel,
  type DataAnalysis,
} from "interfaces-mef-types/da/data-analysis";
import { DA_SOURCE_CATALOG } from "interfaces-mef-types/da/generic-sources";
import { carriesUncertainExpression } from "interfaces-mef-types/sy/systems-analysis";
import { LawSchema } from "interfaces-mef-types/zod/core/uncertainty";
import { DataAnalysisSchema } from "interfaces-mef-types/zod/da/data-analysis";
import { EventSequenceAnalysisSchema, EventTreeSchema } from "interfaces-mef-types/zod/es/event-sequence-analysis";
import { EventSequenceQuantificationSchema } from "interfaces-mef-types/zod/esq/event-sequence-quantification";
import { InitiatingEventsAnalysisSchema } from "interfaces-mef-types/zod/ie/initiating-event-analysis";
import { SystemsAnalysisSchema } from "interfaces-mef-types/zod/sy/systems-analysis";
import { createBlankDa } from "../da-workbooks/blank-da";
import { createBlankEs } from "../es-workbooks/blank-es";
import { createBlankEsq } from "../esq-workbooks/blank-esq";
import { normalizeEsqMef } from "../esq-workbooks/esq-mef-normalize";
import { createBlankIe } from "../ie-workbooks/blank-ie";
import { healMef } from "../pos-workbooks/mef-heal";
import { stripNulls } from "../pos-workbooks/mef-normalize";
import { createBlankSy } from "../sy-workbooks/blank-sy";
import { convertBarrierWork } from "./uncertainty-migration-barriers";
import {
  convertCcfEstimations,
  convertDaCcfNeed,
  convertEsqCcfRecord,
  convertSyGroups,
  daCcfFacts,
  daCcfFactsWithOriginal,
  daHeldIds,
  relinkExampleDaReferences,
  syCcfFacts,
  syCcfFactsWithOriginal,
  type DaCcfFacts,
  type DaCcfLookup,
  type DaHeldLookup,
  type DaProjectLookup,
  type SyCcfFacts,
  type SyCcfLookup,
} from "./uncertainty-migration-ccf";
import {
  convertDaInitiatorNeed,
  convertEsMef,
  convertEsqInitiator,
  convertEsqInitiatorChoice,
  convertHazardMef,
  convertIeMef,
  hazardEventTrees,
} from "./uncertainty-migration-frequency";
import { hazardCatalogueIssue } from "./uncertainty-migration-fault-trees";
import { convertEsqHeps, convertHrMef, esqHrErrorFactors, type HrErrorFactorLookup } from "./uncertainty-migration-hr";
import { convertConfigurations, hclSettingsIssue } from "./uncertainty-migration-hcl";
import {
  arrayField,
  field,
  isRecord,
  jsonOf,
  jsonRecordOf,
  jsonTextOf,
  numberField,
  positiveField,
  present,
  rawText,
  recordField,
  textField,
  withArray,
  withRecord,
  without,
  type Json,
  type JsonRecord,
} from "./uncertainty-migration-json";
import {
  convertScMef,
  convertSyDefinitions,
  missingIssue,
  previousScIssue,
  rateModel,
  scIssue,
  scMissionTimeIds,
  storedHours,
  withHours,
  withoutHours,
  type Built,
  type RateTimes,
  type ScLinkContext,
  type ScMissionTimeLookup,
  type ScProjectLookup,
} from "./uncertainty-migration-mission";
import {
  ConversionScope,
  PraxisAnswers,
  lognormalFit,
  openQuestions,
  parameterExpression,
  pointExpression,
  questionRequest,
  recordAnswers,
  storedDistributionLaw,
  storedExpression,
  storedLaw,
  valueExpression,
  type LawOperation,
  type PraxisQuestions,
  type QuantileQuestion,
} from "./uncertainty-migration-laws";

interface DaParameterFacts {
  parameterType: string;
  quantificationModel?: DaQuantificationModel;
  estimate?: UncertainExpression;
}

type DaParameterLookup = ReadonlyMap<string, ReadonlyMap<string, DaParameterFacts>>;

interface MigrationLookups {
  daParameters: DaParameterLookup;
  daCcf: DaCcfLookup;
  syCcf: SyCcfLookup;
  scMissionTimes: ScMissionTimeLookup;
  scProjects: ScProjectLookup;
  daHeld: DaHeldLookup;
  daProjects: DaProjectLookup;
  hrErrorFactors: HrErrorFactorLookup;
}

interface DaDatasetRow {
  dataset: string;
  quantity: string;
  law: Json;
}

type DaDatasetIndex = ReadonlyMap<string, DaDatasetRow>;

interface DaConversionContext {
  workbookId: string;
  datasets: DaDatasetIndex;
}

interface RateForm {
  rate: boolean;
  standby: boolean;
}

interface RateBasis {
  ratePerHour: number;
  missionHours: number;
}

interface SyConversionContext {
  daWorkbookId?: string;
  daParameters: DaParameterLookup;
  missionTimes: ReadonlyMap<string, UncertainExpression>;
  errorFactors: ReadonlyMap<string, number>;
  leafSources: ReadonlyMap<string, string>;
}

type EntryOutcome =
  | { kind: "KEEP" }
  | { kind: "DROP_DISTRIBUTION" }
  | { kind: "LAW"; law: Law }
  | { kind: "WAIT" }
  | { kind: "NONE" };

type EstimateOutcome = { kind: "NONE" } | { kind: "VALUE"; expression: UncertainExpression } | { kind: "WAIT" };

const DA_QUANTITIES: readonly DaEstimateQuantity[] = ["PER_DEMAND", "PER_HOUR", "PER_YEAR", "FRACTION", "PROBABILITY", "HOURS", "FACTOR"];

const BINOMIAL_QUANTITIES: readonly DaEstimateQuantity[] = ["PER_DEMAND", "PROBABILITY", "FRACTION"];

const DA_QUANTIFICATION_MODELS: readonly DaQuantificationModel[] = [
  "DEMAND_PROBABILITY",
  "RUNNING_RATE",
  "MISSION_PROBABILITY",
  "STANDBY_RATE",
  "UNAVAILABILITY",
  "HUMAN_ERROR",
  "NON_RECOVERY",
  "FREQUENCY",
  "OTHER_PROBABILITY",
];

const ESTIMATE_UNITS: Partial<Record<DaQuantificationModel, UncertainUnit>> = {
  DEMAND_PROBABILITY: "PROBABILITY",
  OTHER_PROBABILITY: "PROBABILITY",
  MISSION_PROBABILITY: "PROBABILITY",
  RUNNING_RATE: "PER_HOUR",
  STANDBY_RATE: "PER_HOUR",
  UNAVAILABILITY: "FRACTION",
  HUMAN_ERROR: "PROBABILITY",
  NON_RECOVERY: "PROBABILITY",
  FREQUENCY: "PER_YEAR",
};

const NEWLY_ESTIMATED_MODELS: readonly DaQuantificationModel[] = ["HUMAN_ERROR", "NON_RECOVERY"];

const HOURS_PER_TIME_UNIT: ReadonlyMap<Json, number> = new Map<Json, number>([
  ["SECOND", 1 / 3_600],
  ["MINUTE", 1 / 60],
  ["HOUR", 1],
  ["DAY", 24],
  ["YEAR", 8_760],
]);

const SY_VALUE_FIELDS: readonly string[] = ["probability", "quantificationBasis", "controlledDataSource", "dataAnalysisBasicEventRef"];

const DA_PARAMETER_VALUE_FIELDS: readonly string[] = ["value", "valueType", "uncertainty"];

const DA_NEED_VALUE_FIELDS: readonly string[] = ["value", "valueUnit"];

const ESQ_EVENT_VALUE_FIELDS: readonly string[] = ["value", "valueUnit", "missionTimeHours"];

const ESQ_PARAMETER_LINK_FIELDS: readonly string[] = ["id", "name", "parameterType"];

const ESQ_MODEL_DA_COPIES: readonly string[] = ["vectors", "ccfFactors"];

function modelOf(value: Json | undefined): DaQuantificationModel | undefined {
  return DA_QUANTIFICATION_MODELS.find((model) => model === value);
}

function quantityOf(value: Json | undefined): DaEstimateQuantity | undefined {
  return DA_QUANTITIES.find((quantity) => quantity === value);
}

function typedRate(ratePerHour: number, times: RateTimes): Built {
  return rateModel(pointExpression("PER_HOUR", ratePerHour), false, times);
}

function typedProbability(probability: number, errorFactor?: number): UncertainExpression {
  return errorFactor !== undefined && errorFactor > 1 && probability > 0
    ? valueExpression("PROBABILITY", { family: "LOGNORMAL", mean: probability, errorFactor, level: 0.95 })
    : pointExpression("PROBABILITY", probability);
}

function linkForm(facts: DaParameterFacts | undefined, fallbackRate: boolean): RateForm {
  if (facts === undefined) return { rate: fallbackRate, standby: false };
  if (facts.quantificationModel === "STANDBY_RATE") return { rate: true, standby: true };
  if (facts.quantificationModel === "RUNNING_RATE") return { rate: true, standby: false };
  return { rate: facts.quantificationModel === undefined && facts.parameterType === "FAILURE_RATE", standby: false };
}

function linkExpression(workbookId: string, entityId: string, form: RateForm, times: RateTimes): Built {
  const parameter = parameterExpression(workbookId, entityId);
  return form.rate ? rateModel(parameter, form.standby, times) : { kind: "VALUE", expression: parameter };
}

function builtRecord(record: JsonRecord, kept: JsonRecord, built: Built, what: string, scope: ConversionScope): JsonRecord {
  switch (built.kind) {
    case "VALUE":
      return { ...kept, expression: jsonOf(built.expression) };
    case "NONE":
      return kept;
    case "MISSING":
      scope.report(missingIssue(what, built.slot));
      return record;
  }
}

function datasetOfSource(source: JsonRecord): string | undefined {
  const catalogId = textField(source, "catalogId");
  return catalogId === undefined ? undefined : DA_SOURCE_CATALOG.find((entry) => entry.id === catalogId)?.dataset;
}

function datasetRow(entry: JsonRecord, quantity: DaEstimateQuantity, dataset: string | undefined, datasets: DaDatasetIndex): DaDatasetRow | undefined {
  const keys = [textField(entry, "catalogCode"), textField(entry, "id")];
  for (const key of keys) {
    const row = key === undefined ? undefined : datasets.get(key);
    if (row !== undefined && row.quantity === quantity && (dataset === undefined || row.dataset === dataset)) return row;
  }
  return undefined;
}

function entryWhat(entry: JsonRecord): string {
  return `DA source entry ${textField(entry, "id") ?? "?"}`;
}

function figureOutcome(entry: JsonRecord, quantity: DaEstimateQuantity, scope: ConversionScope): EntryOutcome {
  const mean = numberField(entry, "mean");
  const median = numberField(entry, "median");
  const p05 = numberField(entry, "p05");
  const p95 = numberField(entry, "p95");
  const failures = numberField(entry, "failures");
  const exposure = numberField(entry, "exposure");
  const fitted = (operation: LawOperation): EntryOutcome => {
    const law = scope.law(operation, `the lognormal law of ${entryWhat(entry)}`);
    return law === undefined ? { kind: "WAIT" } : { kind: "LAW", law };
  };
  if (median !== undefined && p95 !== undefined && median > 0 && p95 > median) {
    return fitted(lognormalFit(null, median, [{ probability: 0.95, value: p95 }]));
  }
  if (mean !== undefined && p05 !== undefined && p95 !== undefined && mean > 0 && p05 > 0 && p95 > p05) {
    return fitted(lognormalFit(mean, null, [{ probability: 0.05, value: p05 }, { probability: 0.95, value: p95 }]));
  }
  if (failures !== undefined && exposure !== undefined && failures >= 0 && exposure > 0 && quantity !== "HOURS") {
    const likelihood: Likelihood = BINOMIAL_QUANTITIES.includes(quantity) ? "BINOMIAL" : "POISSON";
    if (likelihood === "POISSON" || failures <= exposure) {
      return { kind: "LAW", law: { family: "POSTERIOR", prior: null, evidence: [{ likelihood, failures, exposure }] } };
    }
  }
  if (mean !== undefined) return { kind: "LAW", law: { family: "POINT", value: mean } };
  if (median !== undefined) return { kind: "LAW", law: { family: "POINT", value: median } };
  return { kind: "NONE" };
}

function entryOutcome(entry: JsonRecord, dataset: string | undefined, datasets: DaDatasetIndex, scope: ConversionScope): EntryOutcome {
  const quantity = quantityOf(field(entry, "quantity"));
  if (quantity === undefined || !entryHoldsLaw(quantity)) return { kind: "KEEP" };
  const distributed = present(entry, "distribution");
  if (LawSchema.safeParse(field(entry, "law")).success) return distributed ? { kind: "DROP_DISTRIBUTION" } : { kind: "KEEP" };
  const row = datasetRow(entry, quantity, dataset, datasets);
  const published = row === undefined ? undefined : storedLaw(row.law);
  if (published !== undefined) return { kind: "LAW", law: published };
  if (distributed) {
    const trial = new ConversionScope(scope.answers, scope.label);
    const law = storedDistributionLaw(field(entry, "distribution"), numberField(entry, "mean"), trial, entryWhat(entry));
    if (law !== undefined) return { kind: "LAW", law };
    if (trial.issues.length === 0) {
      scope.follow(trial);
      return { kind: "WAIT" };
    }
  }
  return figureOutcome(entry, quantity, scope);
}

function entryNeedsDatasets(entry: JsonRecord): boolean {
  const quantity = quantityOf(field(entry, "quantity"));
  return quantity !== undefined && entryHoldsLaw(quantity) && !LawSchema.safeParse(field(entry, "law")).success;
}

function sourceEntries(mef: JsonRecord): JsonRecord[] {
  return (arrayField(mef, "sources") ?? []).flatMap((source) => (isRecord(source) ? (arrayField(source, "entries") ?? []).flatMap((entry) => (isRecord(entry) ? [entry] : [])) : []));
}

function daNeedsDatasets(mef: JsonRecord): boolean {
  return sourceEntries(mef).some(entryNeedsDatasets);
}

function convertDaEntry(entry: JsonRecord, dataset: string | undefined, datasets: DaDatasetIndex, scope: ConversionScope): JsonRecord {
  const outcome = entryOutcome(entry, dataset, datasets, scope);
  switch (outcome.kind) {
    case "KEEP":
    case "WAIT":
      return entry;
    case "DROP_DISTRIBUTION":
      return without(entry, ["distribution"]);
    case "LAW":
      return { ...without(entry, ["law", "distribution"]), law: jsonOf(outcome.law) };
    case "NONE":
      return present(entry, "distribution") ? without(entry, ["law", "distribution"]) : entry;
  }
}

function convertDaSource(source: JsonRecord, datasets: DaDatasetIndex, scope: ConversionScope): JsonRecord {
  const dataset = datasetOfSource(source);
  return withArray(source, "entries", (entry) => convertDaEntry(entry, dataset, datasets, scope));
}

function figureEstimate(holder: JsonRecord, distribution: JsonRecord | undefined, unit: UncertainUnit, scope: ConversionScope, what: string): EstimateOutcome {
  const value = numberField(holder, "value");
  if (distribution !== undefined && field(distribution, "type") !== DistributionType.POINT_ESTIMATE) {
    const mean = field(holder, "valueType") === "MEAN" ? value : undefined;
    const law = storedDistributionLaw(distribution, mean, scope, what);
    return law === undefined ? { kind: "WAIT" } : { kind: "VALUE", expression: valueExpression(unit, law) };
  }
  if (value !== undefined) return { kind: "VALUE", expression: pointExpression(unit, value) };
  const point = distribution === undefined ? undefined : numberField(distribution, "value");
  return point === undefined ? { kind: "NONE" } : { kind: "VALUE", expression: pointExpression(unit, point) };
}

function typedEstimate(parameter: JsonRecord, unit: UncertainUnit, scope: ConversionScope): EstimateOutcome {
  const uncertainty = recordField(parameter, "uncertainty");
  const distribution = uncertainty === undefined ? undefined : recordField(uncertainty, "distribution");
  return figureEstimate(parameter, distribution, unit, scope, `DA parameter ${textField(parameter, "uuid") ?? "?"}`);
}

function daParameterMission(parameter: JsonRecord, scope: ConversionScope): JsonRecord {
  return holdsEstimate(modelOf(field(parameter, "quantificationModel")))
    ? withoutHours(parameter, "missionTimeHours")
    : withHours(parameter, "missionTimeHours", "missionTime", `DA parameter ${textField(parameter, "uuid") ?? "?"}`, scope);
}

function convertDaParameter(parameter: JsonRecord, scope: ConversionScope): JsonRecord {
  return daParameterMission(convertDaParameterValue(parameter, scope), scope);
}

function convertDaParameterValue(parameter: JsonRecord, scope: ConversionScope): JsonRecord {
  const model = modelOf(field(parameter, "quantificationModel"));
  if (!holdsEstimate(model)) return parameter;
  if (!DA_PARAMETER_VALUE_FIELDS.some((key) => present(parameter, key))) return parameter;
  const kept = without(parameter, [...DA_PARAMETER_VALUE_FIELDS, "estimate"]);
  const stored = storedExpression(parameter, "estimate");
  if (stored !== undefined) return { ...kept, estimate: jsonOf(stored) };
  const unit = model === undefined ? undefined : ESTIMATE_UNITS[model];
  if (unit === undefined || (textField(parameter, "valueMode") === "CALCULATED" && (model === undefined || !NEWLY_ESTIMATED_MODELS.includes(model)))) return kept;
  const outcome = typedEstimate(parameter, unit, scope);
  if (outcome.kind === "WAIT") return parameter;
  return outcome.kind === "NONE" ? kept : { ...kept, estimate: jsonOf(outcome.expression) };
}

function rawParameterFacts(mef: JsonRecord): Map<string, DaParameterFacts> {
  const facts = new Map<string, DaParameterFacts>();
  for (const parameter of arrayField(mef, "parameters") ?? []) {
    if (!isRecord(parameter)) continue;
    const id = textField(parameter, "uuid");
    if (id === undefined) continue;
    facts.set(id, { parameterType: textField(parameter, "parameterType") ?? "", quantificationModel: modelOf(field(parameter, "quantificationModel")) });
  }
  return facts;
}

function needTimes(need: JsonRecord): RateTimes {
  return {
    missionTime: storedHours(need, "missionTimeHours") ?? storedHours(need, "importedMissionTimeHours") ?? storedExpression(need, "missionTime") ?? storedExpression(need, "importedMissionTime"),
    testInterval: storedHours(need, "testIntervalHours"),
  };
}

function needExpression(need: JsonRecord, own: ReadonlyMap<string, DaParameterFacts>, workbookId: string): Built {
  const stored = storedExpression(need, "expression");
  if (stored !== undefined) return { kind: "VALUE", expression: stored };
  const times = needTimes(need);
  const perHour = textField(need, "valueUnit") === "PER_HOUR";
  const holder = textField(need, "valueHolderId");
  if (textField(need, "valueHeldBy") === "DA" && holder !== undefined) {
    return linkExpression(workbookId, holder, linkForm(own.get(holder), perHour), times);
  }
  const value = numberField(need, "value");
  if (value === undefined) return { kind: "NONE" };
  return perHour ? typedRate(value, times) : { kind: "VALUE", expression: pointExpression("PROBABILITY", value) };
}

function needWhat(need: JsonRecord): string {
  return `DA basic event need ${textField(need, "id") ?? "?"}`;
}

function convertDaNeedValue(need: JsonRecord, own: ReadonlyMap<string, DaParameterFacts>, workbookId: string, scope: ConversionScope): JsonRecord {
  if (!carriesUncertainExpression(rawText(need, "failureMode"))) return need;
  if (!DA_NEED_VALUE_FIELDS.some((key) => present(need, key))) return need;
  const kept = without(need, [...DA_NEED_VALUE_FIELDS, "expression"]);
  return builtRecord(need, kept, needExpression(need, own, workbookId), needWhat(need), scope);
}

function convertDaNeed(need: JsonRecord, own: ReadonlyMap<string, DaParameterFacts>, workbookId: string, scope: ConversionScope): JsonRecord {
  const valued = convertDaNeedValue(need, own, workbookId, scope);
  const imported = withHours(valued, "importedMissionTimeHours", "importedMissionTime", needWhat(need), scope);
  return withHours(imported, "missionTimeHours", "missionTime", needWhat(need), scope);
}

function convertDaNeeds(needs: JsonRecord, own: ReadonlyMap<string, DaParameterFacts>, workbookId: string, scope: ConversionScope): JsonRecord {
  const events = withArray(needs, "basicEvents", (need) => convertDaNeed(need, own, workbookId, scope));
  const initiators = withArray(events, "initiators", (need) => convertDaInitiatorNeed(need, workbookId, scope));
  return withArray(initiators, "ccfGroups", (need) => convertDaCcfNeed(need, scope));
}

function convertDaMef(mef: JsonRecord, context: DaConversionContext, scope: ConversionScope): JsonRecord {
  const sourced = withArray(mef, "sources", (source) => convertDaSource(source, context.datasets, scope));
  const estimated = withArray(sourced, "parameters", (parameter) => convertDaParameter(parameter, scope));
  const common = convertCcfEstimations(estimated, context.workbookId, scope);
  const own = rawParameterFacts(common);
  const converted = withRecord(common, "dataNeeds", (needs) => convertDaNeeds(needs, own, context.workbookId, scope));
  return relinkExampleDaReferences(converted, { ownId: context.workbookId, projectId: "", held: new Map([[context.workbookId, daHeldIds(converted)]]), projects: new Map() });
}

function daDatasetIndex(datasets: readonly { dataset: string; rows: Json }[]): Map<string, DaDatasetRow> {
  const index = new Map<string, DaDatasetRow>();
  for (const { dataset, rows } of datasets) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!isRecord(row)) continue;
      const id = textField(row, "id");
      const quantity = textField(row, "quantity");
      const law = field(row, "law");
      if (id === undefined || quantity === undefined || law === undefined) continue;
      const entry: DaDatasetRow = { dataset, quantity, law };
      index.set(id, entry);
      const code = textField(row, "catalogCode");
      if (code !== undefined && code !== id) index.set(code, entry);
    }
  }
  return index;
}

function daParameterFacts(analysis: Pick<DataAnalysis, "parameters">): Map<string, DaParameterFacts> {
  return new Map(analysis.parameters.map((parameter) => [
    parameter.uuid,
    { parameterType: parameter.parameterType, quantificationModel: parameter.quantificationModel, estimate: parameter.estimate },
  ]));
}

function rateBasis(event: JsonRecord): RateBasis | undefined {
  const basis = recordField(event, "quantificationBasis");
  if (basis === undefined || field(basis, "kind") !== "FAILURE_RATE") return undefined;
  const rate = recordField(basis, "failureRate");
  const mission = recordField(basis, "missionTime");
  if (rate === undefined || mission === undefined) return undefined;
  const rateValue = numberField(rate, "value");
  const missionValue = numberField(mission, "value");
  const rateHours = HOURS_PER_TIME_UNIT.get(field(rate, "unit") ?? null);
  const missionUnitHours = HOURS_PER_TIME_UNIT.get(field(mission, "unit") ?? null);
  if (rateValue === undefined || missionValue === undefined || rateHours === undefined || missionUnitHours === undefined) return undefined;
  return { ratePerHour: rateValue / rateHours, missionHours: missionValue * missionUnitHours };
}

function visitLegacyLeaves(node: Json | undefined, visit: (leaf: JsonRecord) => void): void {
  if (!isRecord(node)) return;
  if (field(node, "type") === "BE") {
    visit(node);
    return;
  }
  for (const child of arrayField(node, "children") ?? []) visitLegacyLeaves(child, visit);
}

function leafEventId(leaf: JsonRecord): string | undefined {
  return textField(leaf, "basicEventId") ?? textField(leaf, "be");
}

function modelEventIds(model: JsonRecord): string[] {
  const ids: string[] = [];
  for (const leaf of arrayField(model, "leafNodes") ?? []) {
    if (!isRecord(leaf) || field(leaf, "kind") !== "BASIC_EVENT_REFERENCE") continue;
    const id = textField(leaf, "basicEventId");
    if (id !== undefined) ids.push(id);
  }
  visitLegacyLeaves(field(model, "faultTree"), (leaf) => {
    const id = leafEventId(leaf);
    if (id !== undefined) ids.push(id);
  });
  return ids;
}

function systemMissionTimes(mef: JsonRecord): Map<string, UncertainExpression> {
  const definitions = new Map<string, UncertainExpression>();
  for (const definition of arrayField(mef, "systemDefinitions") ?? []) {
    if (!isRecord(definition)) continue;
    const id = textField(definition, "uuid");
    const missionTime = storedExpression(definition, "missionTime");
    if (id !== undefined && missionTime !== undefined) definitions.set(id, missionTime);
  }
  const times = new Map<string, UncertainExpression>();
  for (const model of arrayField(mef, "systemLogicModels") ?? []) {
    if (!isRecord(model)) continue;
    const system = textField(model, "systemReference");
    const missionTime = system === undefined ? undefined : definitions.get(system);
    if (missionTime === undefined) continue;
    for (const id of modelEventIds(model)) {
      if (!times.has(id)) times.set(id, missionTime);
    }
  }
  return times;
}

function legacyErrorFactors(mef: JsonRecord): Map<string, number> {
  const factors = new Map<string, number>();
  for (const analysis of arrayField(mef, "uncertaintyAnalyses") ?? []) {
    if (!isRecord(analysis)) continue;
    for (const entry of arrayField(analysis, "parameterUncertainties") ?? []) {
      if (!isRecord(entry) || field(entry, "distributionType") !== DistributionType.LOGNORMAL) continue;
      const id = textField(entry, "parameterId");
      const parameters = recordField(entry, "distributionParameters");
      const errorFactor = parameters === undefined ? undefined : numberField(parameters, "errorFactor");
      if (id !== undefined && errorFactor !== undefined && errorFactor > 1) factors.set(id, errorFactor);
    }
  }
  return factors;
}

function legacyLeafSources(mef: JsonRecord): Map<string, string> {
  const sources = new Map<string, string>();
  for (const model of arrayField(mef, "systemLogicModels") ?? []) {
    if (!isRecord(model)) continue;
    visitLegacyLeaves(field(model, "faultTree"), (leaf) => {
      const id = leafEventId(leaf);
      const source = textField(leaf, "source");
      if (id !== undefined && source !== undefined && !sources.has(id)) sources.set(id, source);
    });
  }
  return sources;
}

function syContext(mef: JsonRecord, daParameters: DaParameterLookup): SyConversionContext {
  const links = recordField(mef, "linkedWorkbooks");
  return {
    daWorkbookId: links === undefined ? undefined : textField(links, "DA"),
    daParameters,
    missionTimes: systemMissionTimes(mef),
    errorFactors: legacyErrorFactors(mef),
    leafSources: legacyLeafSources(mef),
  };
}

function systemTimes(id: string | undefined, context: SyConversionContext): RateTimes {
  return { missionTime: id === undefined ? undefined : context.missionTimes.get(id) };
}

function legacyLink(reference: string | undefined, context: SyConversionContext, times: RateTimes, fallbackRate: boolean): Built {
  if (reference === undefined || context.daWorkbookId === undefined) return { kind: "NONE" };
  const facts = context.daParameters.get(context.daWorkbookId)?.get(reference);
  return facts === undefined ? { kind: "NONE" } : linkExpression(context.daWorkbookId, reference, linkForm(facts, fallbackRate), times);
}

function syEventExpression(event: JsonRecord, context: SyConversionContext): Built {
  const stored = storedExpression(event, "expression");
  if (stored !== undefined) return { kind: "VALUE", expression: stored };
  const id = textField(event, "uuid");
  const code = textField(event, "code");
  const basis = rateBasis(event);
  const times: RateTimes = basis === undefined ? systemTimes(id, context) : { missionTime: pointExpression("HOURS", basis.missionHours) };
  const source = recordField(event, "controlledDataSource");
  if (source !== undefined && field(source, "referenceType") === "WORKBOOK_PARAMETER") {
    const workbookId = textField(source, "workbookId");
    const entityId = textField(source, "entityId");
    if (workbookId !== undefined && entityId !== undefined) {
      return linkExpression(workbookId, entityId, linkForm(context.daParameters.get(workbookId)?.get(entityId), basis !== undefined), times);
    }
  }
  const legacy = textField(event, "dataAnalysisBasicEventRef") ?? (id === undefined ? undefined : context.leafSources.get(id));
  const linked = legacyLink(legacy, context, times, basis !== undefined);
  if (linked.kind !== "NONE") return linked;
  if (basis !== undefined) return typedRate(basis.ratePerHour, times);
  const probability = numberField(event, "probability");
  if (probability === undefined) return { kind: "NONE" };
  const errorFactor = (id === undefined ? undefined : context.errorFactors.get(id)) ?? (code === undefined ? undefined : context.errorFactors.get(code));
  return { kind: "VALUE", expression: typedProbability(probability, errorFactor) };
}

function convertSyEvent(event: JsonRecord, context: SyConversionContext, scope: ConversionScope): JsonRecord {
  if (!carriesUncertainExpression(rawText(event, "failureMode"))) return event;
  if (!SY_VALUE_FIELDS.some((key) => present(event, key))) return event;
  const kept = without(event, [...SY_VALUE_FIELDS, "expression"]);
  return builtRecord(event, kept, syEventExpression(event, context), `SY basic event ${textField(event, "uuid") ?? "?"}`, scope);
}

function catalogueIds(mef: JsonRecord): Set<string> {
  const ids = new Set<string>();
  const collect = (events: Json[] | undefined): void => {
    for (const event of events ?? []) {
      const id = isRecord(event) ? textField(event, "uuid") : undefined;
      if (id !== undefined) ids.add(id);
    }
  };
  collect(arrayField(mef, "systemBasicEvents"));
  for (const model of arrayField(mef, "systemLogicModels") ?? []) {
    if (isRecord(model)) collect(arrayField(model, "basicEvents"));
  }
  return ids;
}

function linkedLeafEvents(mef: JsonRecord, context: SyConversionContext, scope: ConversionScope): JsonRecord[] {
  const known = catalogueIds(mef);
  const events: JsonRecord[] = [];
  for (const model of arrayField(mef, "systemLogicModels") ?? []) {
    if (!isRecord(model)) continue;
    visitLegacyLeaves(field(model, "faultTree"), (leaf) => {
      const id = leafEventId(leaf);
      const name = textField(leaf, "name");
      const mode = textField(leaf, "mode");
      if (id === undefined || name === undefined || known.has(id) || !carriesUncertainExpression(mode)) return;
      const built = legacyLink(textField(leaf, "source"), context, systemTimes(id, context), false);
      if (built.kind === "MISSING") scope.report(missingIssue(`SY fault tree leaf ${id}`, built.slot));
      if (built.kind !== "VALUE") return;
      const expression = built.expression;
      known.add(id);
      events.push({
        uuid: id,
        code: id,
        name,
        eventType: "BASIC",
        ...(mode === undefined ? {} : { failureMode: mode }),
        expression: jsonOf(expression),
        repairModeled: false,
        implementsSrs: [],
      });
    });
  }
  return events;
}

function convertSyEvents(mef: JsonRecord, daParameters: DaParameterLookup, scope: ConversionScope): JsonRecord {
  const context = syContext(mef, daParameters);
  const convert = (event: JsonRecord): JsonRecord => convertSyEvent(event, context, scope);
  const rooted = withArray(mef, "systemBasicEvents", convert);
  const local = withArray(rooted, "systemLogicModels", (model) => withArray(model, "basicEvents", convert));
  const analyses = withArray(local, "uncertaintyAnalyses", (analysis) => (Object.hasOwn(analysis, "parameterUncertainties") ? without(analysis, ["parameterUncertainties"]) : analysis));
  const leaves = linkedLeafEvents(analyses, context, scope);
  if (leaves.length === 0) return analyses;
  return { ...analyses, systemBasicEvents: [...(arrayField(analyses, "systemBasicEvents") ?? []), ...leaves] };
}

function scLinkContext(mef: JsonRecord, lookups: MigrationLookups, projectId: string): ScLinkContext {
  const links = recordField(mef, "linkedWorkbooks");
  const linkedScId = links === undefined ? undefined : textField(links, "SC");
  return { ...(linkedScId === undefined ? {} : { linkedScId }), projectId, missionTimes: lookups.scMissionTimes, projects: lookups.scProjects };
}

function relinkProjectDa(mef: JsonRecord, lookups: MigrationLookups, projectId: string): JsonRecord {
  const links = recordField(mef, "linkedWorkbooks");
  const linkedDaId = links === undefined ? undefined : textField(links, "DA");
  return relinkExampleDaReferences(mef, { ...(linkedDaId === undefined ? {} : { linkedDaId }), projectId, held: lookups.daHeld, projects: lookups.daProjects });
}

function convertSyMef(mef: JsonRecord, lookups: MigrationLookups, scope: ConversionScope, projectId: string): JsonRecord {
  const defined = convertSyDefinitions(mef, scLinkContext(mef, lookups, projectId), scope);
  const events = convertSyEvents(defined, lookups.daParameters, scope);
  const groups = convertSyGroups(events, lookups.daCcf, scope);
  return relinkProjectDa(convertConfigurations(groups, "dependencyHclConfigurations", "dependencyBayesianNetworks", scope, "SY"), lookups, projectId);
}

function componentHolder(expression: UncertainExpression | undefined, parameterIds: ReadonlySet<string>): JsonRecord {
  const ids = [...new Set((expression === undefined ? [] : expressionReferences(expression)).map((reference) => reference.entityId))].filter((id) => parameterIds.has(id));
  const [only, ...others] = ids;
  return only !== undefined && others.length === 0 ? { heldBy: "DA", holderId: only } : { heldBy: "TYPED" };
}

function esqEventExpression(record: JsonRecord, daWorkbookId: string | undefined, daParameters: ReadonlyMap<string, DaParameterFacts> | undefined): Built {
  const stored = storedExpression(record, "expression");
  if (stored !== undefined) return { kind: "VALUE", expression: stored };
  const times: RateTimes = { missionTime: storedHours(record, "missionTimeHours") };
  const perHour = textField(record, "valueUnit") === "PER_HOUR";
  const holder = textField(record, "holderId");
  if (textField(record, "heldBy") === "DA" && holder !== undefined && daWorkbookId !== undefined) {
    return linkExpression(daWorkbookId, holder, linkForm(daParameters?.get(holder), perHour), times);
  }
  const value = numberField(record, "value");
  if (value === undefined) return { kind: "NONE" };
  return perHour ? typedRate(value, times) : { kind: "VALUE", expression: pointExpression("PROBABILITY", value) };
}

function esqWhat(kind: string, record: JsonRecord): string {
  return `ESQ ${kind} ${textField(record, "id") ?? "?"}`;
}

function convertEsqComponentEvent(record: JsonRecord, daWorkbookId: string | undefined, daParameters: ReadonlyMap<string, DaParameterFacts> | undefined, parameterIds: ReadonlySet<string>, scope: ConversionScope): JsonRecord {
  if (!ESQ_EVENT_VALUE_FIELDS.some((key) => present(record, key))) return record;
  const kept = without(record, [...ESQ_EVENT_VALUE_FIELDS, "expression", "heldBy", "holderId"]);
  const built = esqEventExpression(record, daWorkbookId, daParameters);
  if (built.kind === "MISSING") {
    scope.report(missingIssue(esqWhat("event", record), built.slot));
    return record;
  }
  const expression = built.kind === "VALUE" ? built.expression : undefined;
  return { ...kept, ...(expression === undefined ? {} : { expression: jsonOf(expression) }), ...componentHolder(expression, parameterIds) };
}

function convertEsqEvent(record: JsonRecord, daWorkbookId: string | undefined, daParameters: ReadonlyMap<string, DaParameterFacts> | undefined, parameterIds: ReadonlySet<string>, scope: ConversionScope): JsonRecord {
  return carriesUncertainExpression(rawText(record, "failureMode"))
    ? convertEsqComponentEvent(record, daWorkbookId, daParameters, parameterIds, scope)
    : withHours(record, "missionTimeHours", "missionTime", esqWhat("event", record), scope);
}

function withOnly(record: JsonRecord, keys: readonly string[]): JsonRecord {
  return Object.keys(record).every((key) => keys.includes(key)) ? record : Object.fromEntries(Object.entries(record).filter(([key]) => keys.includes(key)));
}

function withoutDaCopies(model: JsonRecord): JsonRecord {
  const copied = ESQ_MODEL_DA_COPIES.filter((key) => field(model, key) !== undefined);
  return copied.length === 0 ? model : without(model, copied);
}

function withStandardErrors(record: JsonRecord): JsonRecord {
  const trials = positiveField(record, "trials");
  if (trials === undefined) return record;
  const fill = (stats: JsonRecord): JsonRecord => {
    if (present(stats, "standardError")) return stats;
    const deviation = numberField(stats, "standardDeviation");
    return deviation === undefined ? stats : { ...stats, standardError: deviation / Math.sqrt(trials) };
  };
  return withRecord(withArray(record, "families", fill), "total", fill);
}

function convertEsqModel(model: JsonRecord, daWorkbookId: string | undefined, syGroups: ReadonlyMap<string, SyCcfFacts> | undefined, facts: ReadonlyMap<string, DaParameterFacts> | undefined, scope: ConversionScope): JsonRecord {
  const trees = withArray(model, "trees", (record) => withHours(record, "missionTimeHours", "missionTime", esqWhat("tree", record), scope));
  const parameters = withoutDaCopies(withArray(trees, "parameters", (record) => withOnly(record, ESQ_PARAMETER_LINK_FIELDS)));
  const parameterIds = new Set((arrayField(parameters, "parameters") ?? []).flatMap((record) => {
    const id = isRecord(record) ? textField(record, "id") : undefined;
    return id === undefined ? [] : [id];
  }));
  const events = withArray(parameters, "events", (record) => convertEsqEvent(record, daWorkbookId, facts, parameterIds, scope));
  const initiators = withArray(events, "initiators", (record) => convertEsqInitiator(record, daWorkbookId, scope));
  return withArray(initiators, "ccfGroups", (record) => convertEsqCcfRecord(record, syGroups));
}

function convertEsqMef(mef: JsonRecord, lookups: MigrationLookups, scope: ConversionScope, projectId: string): JsonRecord {
  const links = recordField(mef, "linkedWorkbooks");
  const daWorkbookId = links === undefined ? undefined : textField(links, "DA");
  const syWorkbookId = links === undefined ? undefined : textField(links, "SY");
  const facts = daWorkbookId === undefined ? undefined : lookups.daParameters.get(daWorkbookId);
  const syGroups = syWorkbookId === undefined ? undefined : lookups.syCcf.get(syWorkbookId);
  const modelled = withRecord(convertEsqHeps(mef), "model", (model) => convertEsqModel(model, daWorkbookId, syGroups, facts, scope));
  const decided = withRecord(modelled, "modelDecisions", (decisions) => withArray(decisions, "initiatorChoices", (choice) => convertEsqInitiatorChoice(choice, scope)));
  const barriers = convertBarrierWork(decided, scope);
  const configured = convertConfigurations(barriers, "hclConfigurations", "bayesianNetworks", scope, "ESQ");
  return relinkProjectDa(withRecord(configured, "uncertaintyWork", (work) => withRecord(withRecord(work, "run", withStandardErrors), "independent", withStandardErrors)), lookups, projectId);
}

interface SchemaIssues {
  issues: readonly { path: readonly PropertyKey[]; message: string }[];
}

function firstIssue(error: SchemaIssues): string {
  const issue = error.issues[0];
  return issue === undefined ? "The document does not parse." : `${issue.path.map(String).join(".")}: ${issue.message}`;
}

function outcomeIssue(outcome: { success: boolean; error?: SchemaIssues }): string | undefined {
  return outcome.success || outcome.error === undefined ? undefined : firstIssue(outcome.error);
}

function syIssue(mef: JsonRecord): string | undefined {
  const parsed = SystemsAnalysisSchema.safeParse(stripNulls(mef));
  return parsed.success ? hclSettingsIssue(mef, "dependencyHclConfigurations") : firstIssue(parsed.error);
}

function daIssue(mef: JsonRecord): string | undefined {
  const parsed = DataAnalysisSchema.safeParse(stripNulls(mef));
  return parsed.success ? undefined : firstIssue(parsed.error);
}

function daIssueAndFacts(mef: JsonRecord): { issue?: string; facts?: Map<string, DaParameterFacts> } {
  const parsed = DataAnalysisSchema.safeParse(stripNulls(mef));
  return parsed.success ? { facts: daParameterFacts(parsed.data) } : { issue: firstIssue(parsed.error) };
}

function esqIssue(mef: JsonRecord): string | undefined {
  const parsed = EventSequenceQuantificationSchema.safeParse(normalizeEsqMef(mef));
  return parsed.success ? hclSettingsIssue(mef, "hclConfigurations") : firstIssue(parsed.error);
}

function ieIssue(mef: JsonRecord): string | undefined {
  return outcomeIssue(InitiatingEventsAnalysisSchema.safeParse(stripNulls(mef)));
}

function esIssue(mef: JsonRecord): string | undefined {
  return outcomeIssue(EventSequenceAnalysisSchema.safeParse(stripNulls(mef)));
}

function hazardIssue(mef: JsonRecord): string | undefined {
  for (const tree of hazardEventTrees(mef)) {
    const issue = outcomeIssue(EventTreeSchema.safeParse(stripNulls(tree)));
    if (issue !== undefined) return `Event tree ${textField(tree, "uuid") ?? "?"}. ${issue}`;
  }
  return hazardCatalogueIssue(mef);
}

function previousName(mef: JsonRecord, fallback: string): string {
  return textField(mef, "name") ?? fallback;
}

function previousSyIssue(mef: JsonRecord, owner: string): string | undefined {
  const parsed = SystemsAnalysisSchema.safeParse(healMef(mef, createBlankSy(previousName(mef, "SY Workbook"), textField(mef, "owner") ?? owner)));
  return parsed.success ? hclSettingsIssue(mef, "dependencyHclConfigurations") : firstIssue(parsed.error);
}

function previousDaIssue(mef: JsonRecord, owner: string): string | undefined {
  const parsed = DataAnalysisSchema.safeParse(healMef(mef, createBlankDa(previousName(mef, "DA Workbook"), textField(mef, "owner") ?? owner)));
  return parsed.success ? undefined : firstIssue(parsed.error);
}

function previousEsqIssue(mef: JsonRecord, owner: string): string | undefined {
  const parsed = EventSequenceQuantificationSchema.safeParse(healMef(mef, createBlankEsq(previousName(mef, "ESQ Workbook"), textField(mef, "owner") ?? owner)));
  return parsed.success ? hclSettingsIssue(mef, "hclConfigurations") : firstIssue(parsed.error);
}

function previousIeIssue(mef: JsonRecord, owner: string): string | undefined {
  return outcomeIssue(InitiatingEventsAnalysisSchema.safeParse(healMef(mef, createBlankIe(previousName(mef, "IE Workbook"), textField(mef, "owner") ?? owner))));
}

function previousEsIssue(mef: JsonRecord, owner: string): string | undefined {
  return outcomeIssue(EventSequenceAnalysisSchema.safeParse(healMef(mef, createBlankEs(previousName(mef, "ES Workbook"), textField(mef, "owner") ?? owner))));
}

function parsedDaFacts(mef: JsonRecord): Map<string, DaParameterFacts> | undefined {
  const parsed = DataAnalysisSchema.safeParse(stripNulls(mef));
  return parsed.success ? daParameterFacts(parsed.data) : undefined;
}

export {
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
  daDatasetIndex,
  daHeldIds,
  daIssue,
  daIssueAndFacts,
  daNeedsDatasets,
  daParameterFacts,
  esIssue,
  esqHrErrorFactors,
  esqIssue,
  field,
  hazardIssue,
  ieIssue,
  isRecord,
  jsonRecordOf,
  jsonTextOf,
  lognormalFit,
  openQuestions,
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
};
export type {
  DaCcfFacts,
  DaCcfLookup,
  DaConversionContext,
  DaDatasetIndex,
  DaDatasetRow,
  DaParameterFacts,
  DaParameterLookup,
  Json,
  JsonRecord,
  LawOperation,
  MigrationLookups,
  PraxisQuestions,
  QuantileQuestion,
  ScMissionTimeLookup,
  ScProjectLookup,
  SyCcfFacts,
  SyCcfLookup,
};
