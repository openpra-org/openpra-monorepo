import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import {
  arrayField,
  isRecord,
  jsonOf,
  numberField,
  present,
  recordField,
  textField,
  withArray,
  withRecord,
  without,
  type JsonRecord,
} from "./uncertainty-migration-json";
import { parameterExpression, pointExpression, storedExpression, valueExpression } from "./uncertainty-migration-laws";

type HrErrorFactorLookup = ReadonlyMap<string, ReadonlyMap<string, number>>;

interface EsqHrErrorFactors {
  hrWorkbookId?: string;
  factors: Map<string, number>;
}

const HR_VALUE_FIELDS: readonly string[] = ["meanHep", "pointEstimateHep", "controlledDataSource"];

const ESQ_HUMAN_VALUE_FIELDS: readonly string[] = ["value", "valueType"];

const SPLIT_VALUE_FIELDS: readonly string[] = ["value", "errorFactor"];

function probabilityLaw(value: number, errorFactor: number | undefined): UncertainExpression {
  return errorFactor !== undefined && errorFactor > 1 && value > 0
    ? valueExpression("PROBABILITY", { family: "LOGNORMAL", mean: value, errorFactor, level: 0.95 })
    : pointExpression("PROBABILITY", value);
}

function spreadFactors(mef: JsonRecord): Map<string, number> {
  const factors = new Map<string, number>();
  const work = recordField(mef, "uncertaintyWork");
  for (const spread of (work === undefined ? undefined : arrayField(work, "spreads")) ?? []) {
    if (!isRecord(spread)) continue;
    const key = textField(spread, "key");
    const errorFactor = numberField(spread, "errorFactor");
    if (key !== undefined && errorFactor !== undefined) factors.set(key, errorFactor);
  }
  return factors;
}

function esqHrErrorFactors(mef: JsonRecord): EsqHrErrorFactors {
  const links = recordField(mef, "linkedWorkbooks");
  const hrWorkbookId = links === undefined ? undefined : textField(links, "HRA");
  const factors = new Map([...spreadFactors(mef)].filter(([key]) => key.startsWith("HFE:") || key.startsWith("RECOVERY:")));
  return hrWorkbookId === undefined ? { factors } : { hrWorkbookId, factors };
}

function quantificationKeys(mef: JsonRecord): Map<string, string> {
  const keys = new Map<string, string>();
  for (const action of arrayField(mef, "recoveryActions") ?? []) {
    if (!isRecord(action)) continue;
    const id = textField(action, "uuid");
    const quantificationId = textField(action, "hepQuantificationId");
    if (id !== undefined && quantificationId !== undefined) keys.set(quantificationId, `RECOVERY:${id}`);
  }
  return keys;
}

function convertHrQuantification(quantification: JsonRecord, errorFactor: number | undefined): JsonRecord {
  if (!HR_VALUE_FIELDS.some((key) => present(quantification, key))) return quantification;
  const kept = without(quantification, [...HR_VALUE_FIELDS, "hep"]);
  const stored = storedExpression(quantification, "hep");
  if (stored !== undefined) return { ...kept, hep: jsonOf(stored) };
  const source = recordField(quantification, "controlledDataSource");
  const workbookId = source === undefined ? undefined : textField(source, "workbookId");
  const entityId = source === undefined ? undefined : textField(source, "entityId");
  if (workbookId !== undefined && entityId !== undefined) return { ...kept, hep: jsonOf(parameterExpression(workbookId, entityId)) };
  const value = numberField(quantification, "meanHep") ?? numberField(quantification, "pointEstimateHep");
  return value === undefined ? kept : { ...kept, hep: jsonOf(probabilityLaw(value, errorFactor)) };
}

function convertHrMef(mef: JsonRecord, workbookId: string, lookup: HrErrorFactorLookup): JsonRecord {
  const factors = lookup.get(workbookId);
  const recoveryKeys = quantificationKeys(mef);
  return withArray(mef, "hepQuantifications", (quantification) => {
    const id = textField(quantification, "uuid");
    const hfeId = textField(quantification, "hfeId");
    const key = (id === undefined ? undefined : recoveryKeys.get(id)) ?? (hfeId === undefined ? undefined : `HFE:${hfeId}`);
    return convertHrQuantification(quantification, key === undefined ? undefined : factors?.get(key));
  });
}

function convertHuman(record: JsonRecord, factors: ReadonlyMap<string, number>): JsonRecord {
  if (!ESQ_HUMAN_VALUE_FIELDS.some((key) => present(record, key))) return record;
  const kept = without(record, ESQ_HUMAN_VALUE_FIELDS);
  const value = numberField(record, "value");
  if (value === undefined || present(record, "hep")) return kept;
  return { ...kept, hep: jsonOf(probabilityLaw(value, factors.get(`HFE:${textField(record, "id") ?? ""}`))) };
}

function convertHepNumber(record: JsonRecord, errorFactor: number | undefined): JsonRecord {
  const value = numberField(record, "hep");
  return value === undefined ? record : { ...record, hep: jsonOf(probabilityLaw(value, errorFactor)) };
}

function convertRule(rule: JsonRecord, factors: ReadonlyMap<string, number>): JsonRecord {
  return withRecord(rule, "typed", (typed) => {
    const value = numberField(typed, "value");
    if (value === undefined) return typed;
    const errorFactor = numberField(typed, "errorFactor") ?? factors.get(`RECOVERY:${textField(rule, "id") ?? ""}`);
    return { ...without(typed, SPLIT_VALUE_FIELDS), expression: jsonOf(probabilityLaw(value, errorFactor)) };
  });
}

function convertTarget(target: JsonRecord, functionId: string, factors: ReadonlyMap<string, number>): JsonRecord {
  if (textField(target, "kind") !== "SPLIT_FRACTION" || !SPLIT_VALUE_FIELDS.some((key) => present(target, key))) return target;
  const kept = without(target, SPLIT_VALUE_FIELDS);
  const value = numberField(target, "value");
  if (value === undefined || present(target, "expression")) return kept;
  const errorFactor = numberField(target, "errorFactor") ?? factors.get(`SPLIT:${functionId}:${String(value)}`);
  return { ...kept, expression: jsonOf(probabilityLaw(value, errorFactor)) };
}

function convertLink(link: JsonRecord, factors: ReadonlyMap<string, number>): JsonRecord {
  const functionId = textField(link, "functionId") ?? "";
  const own = withRecord(link, "target", (target) => convertTarget(target, functionId, factors));
  return withArray(own, "rules", (rule) => withRecord(rule, "target", (target) => convertTarget(target, functionId, factors)));
}

function convertEsqHeps(mef: JsonRecord): JsonRecord {
  const factors = spreadFactors(mef);
  const model = withRecord(mef, "model", (record) => {
    const humans = withArray(record, "humanEvents", (human) => convertHuman(human, factors));
    const recoveries = withArray(humans, "recoveries", (recovery) => convertHepNumber(recovery, factors.get(`RECOVERY:${textField(recovery, "id") ?? ""}`)));
    return withArray(recoveries, "actions", (action) => convertHepNumber(action, undefined));
  });
  const post = withRecord(model, "postWork", (work) => withArray(work, "recoveries", (rule) => convertRule(rule, factors)));
  const decisions = withRecord(post, "modelDecisions", (work) => withArray(work, "functionLinks", (link) => convertLink(link, factors)));
  return withRecord(decisions, "uncertaintyWork", (work) => (present(work, "spreads") ? without(work, ["spreads"]) : work));
}

export { convertEsqHeps, convertHrMef, esqHrErrorFactors };
export type { EsqHrErrorFactors, HrErrorFactorLookup };
