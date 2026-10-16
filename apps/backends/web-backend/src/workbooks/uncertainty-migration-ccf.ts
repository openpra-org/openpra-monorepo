import {
  canonicalJson,
  ccfFactorVector,
  expressionReferences,
  type CcfFactorModel,
  type CcfTesting,
  type UncertainExpression,
  type UncertainVector,
  type VectorLaw,
} from "interfaces-mef-types/core/uncertainty";
import { carriesUncertainExpression } from "interfaces-mef-types/sy/systems-analysis";
import { CcfFactorModelSchema, FixedVectorLawSchema, VectorLawSchema } from "interfaces-mef-types/zod/core/uncertainty";
import type { DaCcfImportRecord, DaCcfVector } from "interfaces-mef-types/da/data-analysis";
import {
  arrayField,
  field,
  isRecord,
  jsonOf,
  numberField,
  numberRecord,
  present,
  rawText,
  recordField,
  replaced,
  sortedNumbers,
  textField,
  withArray,
  without,
  type Json,
  type JsonRecord,
} from "./uncertainty-migration-json";
import { pointExpression, storedExpression, type ConversionScope } from "./uncertainty-migration-laws";

interface OldFactors {
  model: string;
  values: number[];
}

interface DaCcfFacts {
  old?: OldFactors;
  factors?: CcfFactorModel;
  workbookId?: string;
  vectorLaw?: VectorLaw;
}

interface SyCcfFacts {
  oldModel?: string;
  oldTotal?: number;
  factors: CcfFactorModel;
  total: UncertainExpression;
}

type DaCcfLookup = ReadonlyMap<string, ReadonlyMap<string, DaCcfFacts>>;

type SyCcfLookup = ReadonlyMap<string, ReadonlyMap<string, SyCcfFacts>>;

const MGL_NAMES: readonly string[] = ["beta", "gamma", "delta"];

const DA_ESTIMATE_OLD_FIELDS: readonly string[] = ["modelType", "parameters", "uncertainty"];

const DA_NEED_OLD_FIELDS: readonly string[] = ["modelType", "factors", "totalProbability"];

const SY_GROUP_OLD_FIELDS: readonly string[] = ["modelType", "modelSpecificParameters"];

const ESQ_RECORD_OLD_FIELDS: readonly string[] = ["modelType", "totalProbability"];

const SY_SUB_OBJECTS: ReadonlyMap<string, string> = new Map([
  ["BETA_FACTOR", "betaFactorParameters"],
  ["MGL", "mglParameters"],
  ["ALPHA_FACTOR", "alphaFactorParameters"],
  ["PHI_FACTOR", "phiFactorParameters"],
]);

const IMPACT_TOLERANCE = 1e-9;

function sameNumber(left: number | undefined, right: number | undefined): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left === right || Math.abs(left - right) <= 1e-12 + IMPACT_TOLERANCE * Math.max(Math.abs(left), Math.abs(right));
}

function sameFactors(left: OldFactors | undefined, right: OldFactors | undefined): boolean {
  if (left === undefined || right === undefined) return false;
  return left.model === right.model && left.values.length === right.values.length && left.values.every((value, index) => sameNumber(value, right.values[index]));
}

function fraction(value: number): UncertainExpression {
  return pointExpression("FRACTION", value);
}

function storedFactors(value: Json | undefined): CcfFactorModel | undefined {
  const parsed = CcfFactorModelSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function testingOf(value: Json | undefined): CcfTesting {
  return value === "STAGGERED" ? "STAGGERED" : "NON_STAGGERED";
}

function mglValues(values: ReadonlyMap<string, number>): number[] {
  const named = MGL_NAMES.flatMap((key) => {
    const value = values.get(key);
    return value === undefined ? [] : [value];
  });
  const rest = new Map([...values].filter(([key]) => !MGL_NAMES.includes(key)));
  return [...named, ...sortedNumbers(rest)];
}

function recordValues(model: string, values: ReadonlyMap<string, number>): number[] {
  if (model === "MGL") return mglValues(values);
  if (model === "BETA_FACTOR") {
    const beta = values.get("beta") ?? sortedNumbers(values)[0];
    return beta === undefined ? [] : [beta];
  }
  return sortedNumbers(values);
}

function inUnitRange(values: readonly number[]): boolean {
  return values.every((value) => value >= 0 && value <= 1);
}

function factorModel(old: OldFactors, testing: CcfTesting, scope: ConversionScope, what: string): CcfFactorModel | undefined {
  const { model, values } = old;
  if (values.length === 0) {
    scope.report(`${what} holds no ${model} values.`);
    return undefined;
  }
  if ((model === "BETA_FACTOR" || model === "MGL") && !inUnitRange(values)) {
    scope.report(`${what} holds ${model} factors outside 0 to 1.`);
    return undefined;
  }
  switch (model) {
    case "BETA_FACTOR":
      return { model: "BETA_FACTOR", beta: fraction(values[0] ?? 0) };
    case "MGL":
      return { model: "MGL", factors: values.map(fraction) };
    case "ALPHA_FACTOR":
    case "PHI_FACTOR": {
      const law = FixedVectorLawSchema.safeParse({ family: "FIXED", values });
      if (!law.success) {
        scope.report(`${what} holds ${model} values that are not fractions adding to 1. ${law.error.issues[0]?.message ?? ""}`.trim());
        return undefined;
      }
      return model === "ALPHA_FACTOR"
        ? { model: "ALPHA_FACTOR", testing, alphas: { node: "VALUE", law: law.data } }
        : { model: "PHI_FACTOR", phis: { node: "VALUE", law: law.data } };
    }
    default:
      scope.report(`${what} uses the ${model} model, which has no exact factor model in the contract.`);
      return undefined;
  }
}

function oldDaFactors(estimate: JsonRecord): OldFactors | undefined {
  const model = textField(estimate, "modelType");
  const values = numberRecord(field(estimate, "parameters"));
  if (model === undefined || values === undefined || values.size === 0) return undefined;
  return { model, values: recordValues(model, values) };
}

function templateEntryIds(code: string, size: number): string[] {
  return Array.from({ length: size }, (_, index) => `${code}-C${size}-A${index + 1}`);
}

function entryAlpha(entry: JsonRecord | undefined): number | undefined {
  const law = entry === undefined ? undefined : recordField(entry, "law");
  if (law === undefined || field(law, "family") !== "BETA") return undefined;
  const alpha = numberField(law, "alpha");
  const beta = numberField(law, "beta");
  return field(law, "lower") === 0 && field(law, "upper") === 1 && alpha !== undefined && beta !== undefined && alpha > 0 && beta > 0 ? alpha : undefined;
}

function templateGamma(sources: Json[] | undefined, estimate: JsonRecord, size: number): number[] | undefined {
  const sourceId = textField(estimate, "priorSourceId");
  const code = textField(estimate, "priorTemplate");
  const source = (sources ?? []).find((candidate) => isRecord(candidate) && textField(candidate, "id") === sourceId);
  if (code === undefined || source === undefined || !isRecord(source)) return undefined;
  const entries = new Map((arrayField(source, "entries") ?? []).flatMap((entry) => {
    const id = isRecord(entry) ? rawText(entry, "id") : undefined;
    return id === undefined || !isRecord(entry) ? [] : [[id, entry] as const];
  }));
  const gamma: number[] = [];
  for (const id of templateEntryIds(code, size)) {
    const alpha = entryAlpha(entries.get(id));
    if (alpha === undefined) return undefined;
    gamma.push(alpha);
  }
  return gamma;
}

function impactOf(event: JsonRecord, size: number): number[] | undefined {
  const impact = arrayField(event, "impact");
  if (impact === undefined || impact.length !== size) return undefined;
  const values = impact.flatMap((value) => (typeof value === "number" && value >= 0 && value <= 1 ? [value] : []));
  if (values.length !== size || values.reduce((total, value) => total + value, 0) > 1 + IMPACT_TOLERANCE) return undefined;
  return values;
}

function evidenceCounts(estimate: JsonRecord, size: number): number[] | undefined {
  const counts = Array.from({ length: size }, () => 0);
  for (const evidence of arrayField(estimate, "evidence") ?? []) {
    if (!isRecord(evidence) || field(evidence, "included") !== true) continue;
    const population = numberField(evidence, "population");
    const independent = numberField(evidence, "independentFailures");
    if (population === undefined || !(population > 0) || independent === undefined || !(independent >= 0)) return undefined;
    counts[0] = (counts[0] ?? 0) + (independent * size) / population;
    for (const event of arrayField(evidence, "events") ?? []) {
      if (!isRecord(event) || field(event, "included") !== true) continue;
      const impact = impactOf(event, size);
      if (impact === undefined) return undefined;
      impact.forEach((value, index) => { counts[index] = (counts[index] ?? 0) + value; });
    }
  }
  return counts;
}

interface ComputedFactors {
  factors: CcfFactorModel;
  imported: DaCcfImportRecord;
  vector?: DaCcfVector;
}

function computedFactors(sources: Json[] | undefined, estimate: JsonRecord, workbookId: string): ComputedFactors | undefined {
  const method = field(estimate, "method");
  const size = numberField(estimate, "groupSize");
  const sourceId = textField(estimate, "priorSourceId");
  const template = textField(estimate, "priorTemplate");
  if ((method !== "PRIOR" && method !== "BAYES") || size === undefined || !Number.isInteger(size) || size < 2 || sourceId === undefined || template === undefined) return undefined;
  const gamma = templateGamma(sources, estimate, size);
  if (gamma === undefined) return undefined;
  const testing = testingOf(field(estimate, "testing"));
  const rowIds = templateEntryIds(template, size);
  if (method === "BAYES") {
    const counts = evidenceCounts(estimate, size);
    if (counts === undefined) return undefined;
    const concentrations = gamma.map((value, index) => value + (counts[index] ?? 0));
    const estimateId = textField(estimate, "uuid");
    const factors: CcfFactorModel = { model: "ALPHA_FACTOR", testing, alphas: { node: "VALUE", law: { family: "DIRICHLET", concentrations } } };
    if (estimateId === undefined) return { factors, imported: { kind: "ALPHA_DIRICHLET", rowIds, groupSize: size } };
    const updatedId = `ccfv/${estimateId}/updated/C${size}`;
    return {
      factors,
      imported: { kind: "ALPHA_DIRICHLET", rowIds, groupSize: size, vectorId: updatedId },
      vector: { id: updatedId, sourceId, kind: "ALPHA_DIRICHLET", template, groupSize: size, rowIds, vector: { family: "DIRICHLET", concentrations }, estimateId },
    };
  }
  const vectorId = `ccfv/${sourceId}/${template}/ALPHA_DIRICHLET/C${size}`;
  return {
    factors: { model: "ALPHA_FACTOR", testing, alphas: { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId, entityId: vectorId } } },
    imported: { kind: "ALPHA_DIRICHLET", rowIds, groupSize: size, vectorId },
    vector: { id: vectorId, sourceId, kind: "ALPHA_DIRICHLET", template, groupSize: size, rowIds, vector: { family: "DIRICHLET", concentrations: gamma } },
  };
}

function convertCcfEstimation(estimate: JsonRecord, sources: Json[] | undefined, workbookId: string, vectors: Map<string, DaCcfVector>, scope: ConversionScope): JsonRecord {
  if (!DA_ESTIMATE_OLD_FIELDS.some((key) => present(estimate, key))) return estimate;
  const id = textField(estimate, "uuid") ?? "?";
  const what = `DA common cause estimate ${id}`;
  if (present(estimate, "uncertainty")) scope.report(`${what} holds an uncertainty distribution that names no factor, so it cannot be converted.`);
  const computed = computedFactors(sources, estimate, workbookId);
  const kept = without(estimate, [...DA_ESTIMATE_OLD_FIELDS, "factors", "imported"]);
  if (computed !== undefined) {
    if (computed.vector !== undefined) vectors.set(computed.vector.id, computed.vector);
    return { ...kept, factors: jsonOf(computed.factors), imported: jsonOf(computed.imported) };
  }
  const old = oldDaFactors(estimate);
  const factors = old === undefined ? undefined : factorModel(old, testingOf(field(estimate, "testing")), scope, what);
  return factors === undefined ? kept : { ...kept, factors: jsonOf(factors) };
}

function convertCcfEstimations(mef: JsonRecord, workbookId: string, scope: ConversionScope): JsonRecord {
  const sources = arrayField(mef, "sources");
  const vectors = new Map<string, DaCcfVector>();
  const converted = withArray(mef, "ccfParameterEstimations", (estimate) => convertCcfEstimation(estimate, sources, workbookId, vectors, scope));
  if (vectors.size === 0) return converted;
  const published = new Map<string, Json>((arrayField(converted, "ccfVectors") ?? []).flatMap((stored) => {
    const id = isRecord(stored) ? textField(stored, "id") : undefined;
    return id === undefined ? [] : [[id, stored] as const];
  }));
  vectors.forEach((vector, id) => published.set(id, jsonOf(vector)));
  return { ...converted, ccfVectors: [...published.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, vector]) => vector) };
}

function oldDaFactorsById(original: JsonRecord): Map<string, OldFactors | undefined> {
  return new Map((arrayField(original, "ccfParameterEstimations") ?? []).flatMap((estimate) => {
    const id = isRecord(estimate) ? textField(estimate, "uuid") : undefined;
    return id === undefined || !isRecord(estimate) ? [] : [[id, oldDaFactors(estimate)] as const];
  }));
}

function daCcfFactsWithOriginal(facts: ReadonlyMap<string, DaCcfFacts>, original: JsonRecord): Map<string, DaCcfFacts> {
  const oldById = oldDaFactorsById(original);
  return new Map([...facts].map(([id, fact]) => {
    const old = oldById.get(id);
    return [id, old === undefined ? fact : { ...fact, old }];
  }));
}

function storedVectorLaws(mef: JsonRecord): Map<string, VectorLaw> {
  return new Map((arrayField(mef, "ccfVectors") ?? []).flatMap((vector) => {
    if (!isRecord(vector)) return [];
    const id = textField(vector, "id");
    const law = VectorLawSchema.safeParse(field(vector, "vector"));
    return id === undefined || !law.success ? [] : [[id, law.data] as const];
  }));
}

function linkedVectorLaw(factors: CcfFactorModel | undefined, laws: ReadonlyMap<string, VectorLaw>): VectorLaw | undefined {
  const vector = factors === undefined ? undefined : ccfFactorVector(factors);
  return vector?.node === "PARAMETER" ? laws.get(vector.reference.entityId) : undefined;
}

function daCcfFacts(original: JsonRecord, converted: JsonRecord, workbookId?: string): Map<string, DaCcfFacts> {
  const oldById = oldDaFactorsById(original);
  const laws = storedVectorLaws(converted);
  const facts = new Map<string, DaCcfFacts>();
  for (const estimate of arrayField(converted, "ccfParameterEstimations") ?? []) {
    if (!isRecord(estimate)) continue;
    const id = textField(estimate, "uuid");
    if (id === undefined) continue;
    const old = oldById.get(id);
    const factors = storedFactors(field(estimate, "factors"));
    const vectorLaw = linkedVectorLaw(factors, laws);
    facts.set(id, {
      ...(old === undefined ? {} : { old }),
      ...(factors === undefined ? {} : { factors }),
      ...(workbookId === undefined ? {} : { workbookId }),
      ...(vectorLaw === undefined ? {} : { vectorLaw }),
    });
  }
  return facts;
}

function convertDaCcfNeed(need: JsonRecord, scope: ConversionScope): JsonRecord {
  const stored = storedFactors(field(need, "factors"));
  if (!present(need, "modelType") && !present(need, "totalProbability") && (stored !== undefined || !present(need, "factors"))) return need;
  const id = textField(need, "id") ?? "?";
  const what = `DA common cause group need ${id}`;
  const model = textField(need, "modelType");
  const values = numberRecord(field(need, "factors"));
  let factors: CcfFactorModel | undefined = stored;
  if (factors === undefined && values !== undefined && values.size > 0) {
    if (model === undefined) scope.report(`${what} holds factors without a model type.`);
    else factors = factorModel({ model, values: recordValues(model, values) }, "NON_STAGGERED", scope, what);
  } else if (factors === undefined && present(need, "factors") && values === undefined) {
    scope.report(`${what} holds factors that are not numbers.`);
  }
  const total = numberField(need, "totalProbability");
  return replaced(need, DA_NEED_OLD_FIELDS, {
    ...(factors === undefined ? {} : { factors: jsonOf(factors) }),
    ...(total === undefined ? {} : { total: jsonOf(pointExpression("PROBABILITY", total)) }),
  });
}

function oldSyFactors(group: JsonRecord, scope: ConversionScope, what: string): { old: OldFactors; total: number } | undefined {
  const model = textField(group, "modelType");
  const parameters = recordField(group, "modelSpecificParameters");
  const key = model === undefined ? undefined : SY_SUB_OBJECTS.get(model);
  const values = parameters === undefined || key === undefined ? undefined : recordField(parameters, key);
  if (model === undefined || values === undefined) {
    scope.report(`${what} holds no ${model ?? "model"} parameters, so it has no factors to convert.`);
    return undefined;
  }
  const total = numberField(values, "totalFailureProbability");
  if (total === undefined) {
    scope.report(`${what} has no total failure probability.`);
    return undefined;
  }
  if (model === "BETA_FACTOR") {
    const beta = numberField(values, "beta");
    if (beta === undefined) scope.report(`${what} has no beta factor.`);
    return beta === undefined ? undefined : { old: { model, values: [beta] }, total };
  }
  if (model === "MGL") {
    const named = MGL_NAMES.flatMap((name) => {
      const value = numberField(values, name);
      return value === undefined ? [] : [value];
    });
    const additional = numberRecord(field(values, "additionalFactors")) ?? new Map<string, number>();
    return { old: { model, values: [...named, ...sortedNumbers(additional)] }, total };
  }
  const record = numberRecord(field(values, model === "ALPHA_FACTOR" ? "alphaFactors" : "phiFactors"));
  if (record === undefined) {
    scope.report(`${what} holds ${model} factors that are not numbers.`);
    return undefined;
  }
  return { old: { model, values: sortedNumbers(record) }, total };
}

function eventsById(mef: JsonRecord): Map<string, JsonRecord> {
  return new Map((arrayField(mef, "systemBasicEvents") ?? []).flatMap((event) => {
    const id = isRecord(event) ? textField(event, "uuid") : undefined;
    return id === undefined || !isRecord(event) ? [] : [[id, event] as const];
  }));
}

function memberIds(group: JsonRecord): string[] {
  const members = recordField(group, "members");
  return (arrayField(members ?? {}, "basicEvents") ?? []).flatMap((member) => {
    const id = isRecord(member) ? textField(member, "id") : undefined;
    return id === undefined ? [] : [id];
  });
}

function sharedMemberExpression(group: JsonRecord, events: ReadonlyMap<string, JsonRecord>): UncertainExpression | undefined {
  const members = memberIds(group).flatMap((id) => {
    const event = events.get(id);
    return event === undefined ? [] : [event];
  });
  const expressions = members.map((event) => (carriesUncertainExpression(rawText(event, "failureMode")) ? storedExpression(event, "expression") : undefined));
  const first = expressions[0];
  if (first === undefined) return undefined;
  const key = canonicalJson(first);
  return expressions.every((expression) => expression !== undefined && canonicalJson(expression) === key) ? first : undefined;
}

function linkedDaFacts(group: JsonRecord, daWorkbookIds: readonly string[], daCcf: DaCcfLookup): DaCcfFacts | undefined {
  const reference = textField(group, "dataAnalysisCCFParameterRef");
  if (reference === undefined) return undefined;
  for (const workbookId of daWorkbookIds) {
    const facts = daCcf.get(workbookId)?.get(reference);
    if (facts !== undefined) return facts;
  }
  return undefined;
}

function memberWorkbooks(group: JsonRecord, events: ReadonlyMap<string, JsonRecord>): string[] {
  return memberIds(group).flatMap((id) => {
    const event = events.get(id);
    const expression = event === undefined ? undefined : storedExpression(event, "expression");
    return expression === undefined ? [] : expressionReferences(expression).map((reference) => reference.workbookId);
  });
}

function withVectorValue(factors: CcfFactorModel, vector: UncertainVector): CcfFactorModel {
  switch (factors.model) {
    case "ALPHA_FACTOR":
      return { ...factors, alphas: vector };
    case "PHI_FACTOR":
      return { ...factors, phis: vector };
    case "BETA_FACTOR":
    case "MGL":
    case "BINOMIAL_FAILURE_RATE":
      return factors;
  }
}

function linkedCopy(group: JsonRecord, facts: DaCcfFacts | undefined): JsonRecord {
  const linked = facts?.factors;
  const law = facts?.vectorLaw;
  const vector = linked === undefined ? undefined : ccfFactorVector(linked);
  if (linked === undefined || law === undefined || vector?.node !== "PARAMETER" || vector.reference.workbookId !== facts?.workbookId) return group;
  const copied = storedFactors(field(group, "factors"));
  if (copied === undefined || canonicalJson(copied) !== canonicalJson(withVectorValue(linked, { node: "VALUE", law }))) return group;
  return { ...group, factors: jsonOf(linked) };
}

function convertSyGroup(group: JsonRecord, events: ReadonlyMap<string, JsonRecord>, linkedDa: string | undefined, daCcf: DaCcfLookup, scope: ConversionScope): JsonRecord {
  const daWorkbookIds = [...new Set([...(linkedDa === undefined ? [] : [linkedDa]), ...memberWorkbooks(group, events)])];
  if (!SY_GROUP_OLD_FIELDS.some((key) => present(group, key))) return linkedCopy(group, linkedDaFacts(group, daWorkbookIds, daCcf));
  const what = `SY common cause group ${textField(group, "uuid") ?? "?"}`;
  const old = oldSyFactors(group, scope, what);
  if (old === undefined) return group;
  const facts = linkedDaFacts(group, daWorkbookIds, daCcf);
  const factors = facts?.factors !== undefined && sameFactors(facts.old, old.old) ? facts.factors : factorModel(old.old, "NON_STAGGERED", scope, what);
  if (factors === undefined) return group;
  const total = sharedMemberExpression(group, events) ?? pointExpression("PROBABILITY", old.total);
  return replaced(group, SY_GROUP_OLD_FIELDS, { factors: jsonOf(factors), total: jsonOf(total) });
}

function convertSyGroups(mef: JsonRecord, daCcf: DaCcfLookup, scope: ConversionScope): JsonRecord {
  const events = eventsById(mef);
  const links = recordField(mef, "linkedWorkbooks");
  const linkedDa = links === undefined ? undefined : textField(links, "DA");
  return withArray(mef, "commonCauseFailureGroups", (group) => convertSyGroup(group, events, linkedDa, daCcf, scope));
}

function oldSyGroupsById(original: JsonRecord): Map<string, { model?: string; total?: number }> {
  return new Map((arrayField(original, "commonCauseFailureGroups") ?? []).flatMap((group) => {
    if (!isRecord(group)) return [];
    const id = textField(group, "uuid");
    const model = textField(group, "modelType");
    const parameters = recordField(group, "modelSpecificParameters");
    const key = model === undefined ? undefined : SY_SUB_OBJECTS.get(model);
    const values = parameters === undefined || key === undefined ? undefined : recordField(parameters, key);
    const total = values === undefined ? undefined : numberField(values, "totalFailureProbability");
    return id === undefined ? [] : [[id, { model, total }] as const];
  }));
}

function syCcfFactsWithOriginal(facts: ReadonlyMap<string, SyCcfFacts>, original: JsonRecord): Map<string, SyCcfFacts> {
  const oldById = oldSyGroupsById(original);
  return new Map([...facts].map(([id, fact]) => {
    const old = oldById.get(id);
    return [id, { ...fact, ...(old?.model === undefined ? {} : { oldModel: old.model }), ...(old?.total === undefined ? {} : { oldTotal: old.total }) }];
  }));
}

function syCcfFacts(original: JsonRecord, converted: JsonRecord): Map<string, SyCcfFacts> {
  const oldById = oldSyGroupsById(original);
  const facts = new Map<string, SyCcfFacts>();
  for (const group of arrayField(converted, "commonCauseFailureGroups") ?? []) {
    if (!isRecord(group)) continue;
    const id = textField(group, "uuid");
    const factors = storedFactors(field(group, "factors"));
    const total = storedExpression(group, "total");
    if (id === undefined || factors === undefined || total === undefined) continue;
    const old = oldById.get(id);
    facts.set(id, {
      ...(old?.model === undefined ? {} : { oldModel: old.model }),
      ...(old?.total === undefined ? {} : { oldTotal: old.total }),
      factors,
      total,
    });
  }
  return facts;
}

function convertEsqCcfRecord(record: JsonRecord, groups: ReadonlyMap<string, SyCcfFacts> | undefined): JsonRecord {
  if (!ESQ_RECORD_OLD_FIELDS.some((key) => present(record, key))) return record;
  const id = textField(record, "id");
  const group = id === undefined ? undefined : groups?.get(id);
  const model = textField(record, "modelType");
  const total = numberField(record, "totalProbability");
  const inSync = group !== undefined && (model === undefined || model === group.oldModel) && (total === undefined || sameNumber(total, group.oldTotal));
  if (inSync) return replaced(record, ESQ_RECORD_OLD_FIELDS, { factors: jsonOf(group.factors), total: jsonOf(group.total) });
  return replaced(record, [...ESQ_RECORD_OLD_FIELDS, "factors"], total === undefined ? {} : { total: jsonOf(pointExpression("PROBABILITY", total)) });
}

const EXAMPLE_DA_PREFIX = "example-da-";

type DaHeldLookup = ReadonlyMap<string, ReadonlySet<string>>;

type DaProjectLookup = ReadonlyMap<string, readonly string[]>;

interface DaLinkContext {
  ownId?: string;
  linkedDaId?: string;
  projectId: string;
  held: DaHeldLookup;
  projects: DaProjectLookup;
}

function idsOf(mef: JsonRecord, key: string, idKey: string): string[] {
  return (arrayField(mef, key) ?? []).flatMap((item) => {
    const id = isRecord(item) ? rawText(item, idKey) : undefined;
    return id === undefined ? [] : [id];
  });
}

function daHeldIds(mef: JsonRecord): Set<string> {
  return new Set([...idsOf(mef, "parameters", "uuid"), ...idsOf(mef, "ccfVectors", "id"), ...idsOf(mef, "ccfFactors", "id")]);
}

function daTarget(entityId: string, context: DaLinkContext): string | undefined {
  const holds = (workbookId: string): boolean => context.held.get(workbookId)?.has(entityId) === true;
  if (context.ownId !== undefined) return holds(context.ownId) ? context.ownId : undefined;
  const linked = context.linkedDaId;
  if (linked !== undefined) return context.held.has(linked) && holds(linked) ? linked : undefined;
  const holders = (context.projects.get(context.projectId) ?? []).filter(holds);
  return holders.length === 1 ? holders[0] : undefined;
}

function relinkedReference(record: JsonRecord, context: DaLinkContext): JsonRecord | undefined {
  if (field(record, "referenceType") !== "WORKBOOK_PARAMETER") return undefined;
  const workbookId = rawText(record, "workbookId");
  const entityId = rawText(record, "entityId");
  if (workbookId === undefined || entityId === undefined || !workbookId.startsWith(EXAMPLE_DA_PREFIX)) return undefined;
  const target = daTarget(entityId, context);
  return target === undefined || target === workbookId ? undefined : { ...record, workbookId: target };
}

function relinkedJson(value: Json, context: DaLinkContext): Json {
  if (Array.isArray(value)) {
    const next = value.map((item) => relinkedJson(item, context));
    return next.some((item, index) => item !== value[index]) ? next : value;
  }
  if (!isRecord(value)) return value;
  const reference = relinkedReference(value, context);
  if (reference !== undefined) return reference;
  let changed = false;
  const entries = Object.entries(value).map(([key, item]) => {
    const next = relinkedJson(item, context);
    if (next !== item) changed = true;
    return [key, next] as const;
  });
  return changed ? Object.fromEntries(entries) : value;
}

function relinkExampleDaReferences(mef: JsonRecord, context: DaLinkContext): JsonRecord {
  const next = relinkedJson(mef, context);
  return isRecord(next) ? next : mef;
}

export {
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
};
export type { DaCcfFacts, DaCcfLookup, DaHeldLookup, DaLinkContext, DaProjectLookup, SyCcfFacts, SyCcfLookup };
