import { FrequencyUnit, type UncertainFrequency } from "interfaces-mef-types/core/events";
import type { Law, UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { WorkbookParameterReferenceSchema } from "interfaces-mef-types/zod/modeling/references";
import {
  arrayField,
  field,
  isRecord,
  jsonOf,
  numberField,
  numberList,
  present,
  recordField,
  replaced,
  textField,
  withArray,
  withRecord,
  without,
  type Json,
  type JsonRecord,
} from "./uncertainty-migration-json";
import {
  boundedLaw,
  figuresLaw,
  frequencyBasis,
  lognormalFromMean,
  lognormalFromMedian,
  normalLaw,
  parameterExpression,
  pointExpression,
  positiveLaw,
  storedExpression,
  uncertainFrequency,
  valueExpression,
  type ConversionScope,
} from "./uncertainty-migration-laws";
import { convertFrequencyFaultTree, convertHazardFaultTrees } from "./uncertainty-migration-fault-trees";

type TypedFrequency = { kind: "NONE" } | { kind: "FREQUENCY"; frequency: UncertainFrequency } | { kind: "INVALID" };

const SECONDS_PER_HOUR = 3_600;

const MINUTES_PER_HOUR = 60;

const HOURS_PER_DAY = 24;

const SOURCE_OLD_FIELDS: readonly string[] = ["distributionFamily", "distributionParameters", "faultTreeTopMean"];

const NEED_OLD_FIELDS: readonly string[] = ["meanFrequency", "medianFrequency", "errorFactor", "frequencyUnit"];

const CHOICE_OLD_FIELDS: readonly string[] = ["mean", "errorFactor"];

const TREE_OLD_FIELDS: readonly string[] = ["value", "unit", "controlledDataSource"];

function frequencyExpression(law: Law): UncertainExpression {
  return valueExpression("PER_YEAR", law);
}

function familyLaw(type: Json | undefined, parameters: number[], mean: number | undefined, scope: ConversionScope, what: string): Law | undefined {
  const [first, second, third] = parameters;
  const needs = (count: number): boolean => {
    if (parameters.length >= count) return true;
    scope.report(`${what} gives ${parameters.length} parameters for its ${String(type)} distribution.`);
    return false;
  };
  switch (type) {
    case "lognormal":
      if (!needs(2) || first === undefined || second === undefined) return undefined;
      return mean !== undefined && mean > 0 ? lognormalFromMean(mean, second, scope, what) : lognormalFromMedian(first, second, scope, what);
    case "gamma":
      if (!needs(2) || first === undefined || second === undefined) return undefined;
      return positiveLaw({ family: "GAMMA", shape: first, rate: second }, [first, second], scope, what);
    case "beta":
      if (!needs(2) || first === undefined || second === undefined) return undefined;
      return positiveLaw({ family: "BETA", alpha: first, beta: second, lower: 0, upper: 1 }, [first, second], scope, what);
    case "normal":
      if (!needs(2) || first === undefined || second === undefined) return undefined;
      return normalLaw(first, second, scope, what);
    case "uniform":
      if (!needs(2) || first === undefined || second === undefined) return undefined;
      return boundedLaw(first, second, scope, what);
    case "exponential":
      if (!needs(1) || first === undefined) return undefined;
      return positiveLaw({ family: "GAMMA", shape: 1, rate: first }, [first], scope, what);
    case "weibull":
      if (!needs(3) || first === undefined || second === undefined || third === undefined) return undefined;
      return positiveLaw({ family: "WEIBULL", scale: first, shape: second, location: third }, [first, second], scope, what);
    case "point_estimate":
      if (mean !== undefined) return { family: "POINT", value: mean };
      if (!needs(1) || first === undefined) return undefined;
      return { family: "POINT", value: first };
    default:
      scope.report(`${what} has a ${String(type)} distribution, which has no exact law in the contract.`);
      return undefined;
  }
}

function typedFrequency(value: Json | undefined, scope: ConversionScope, what: string): TypedFrequency {
  if (value === undefined || value === null) return { kind: "NONE" };
  if (typeof value === "number") {
    if (value === 0) return { kind: "NONE" };
    if (!(value > 0)) {
      scope.report(`${what} is ${value}, not a frequency.`);
      return { kind: "INVALID" };
    }
    return { kind: "FREQUENCY", frequency: uncertainFrequency(pointExpression("PER_YEAR", value), FrequencyUnit.PER_PLANT_YEAR) };
  }
  if (!isRecord(value)) {
    scope.report(`${what} does not hold a frequency.`);
    return { kind: "INVALID" };
  }
  const mean = numberField(value, "value");
  const distribution = recordField(value, "distribution");
  const basis = frequencyBasis(field(value, "units"), scope, what);
  if (basis === undefined) return { kind: "INVALID" };
  if (distribution === undefined) {
    if (mean === undefined || mean < 0) {
      scope.report(`${what} holds no frequency value.`);
      return { kind: "INVALID" };
    }
    return mean === 0 ? { kind: "NONE" } : { kind: "FREQUENCY", frequency: uncertainFrequency(pointExpression("PER_YEAR", mean), basis) };
  }
  const parameters = numberList(field(distribution, "parameters"));
  if (parameters === undefined) {
    scope.report(`${what} holds distribution parameters that are not numbers.`);
    return { kind: "INVALID" };
  }
  const law = familyLaw(field(distribution, "type"), parameters, mean, scope, what);
  return law === undefined ? { kind: "INVALID" } : { kind: "FREQUENCY", frequency: uncertainFrequency(frequencyExpression(law), basis) };
}

function heldFrequency(reference: Json | undefined, units: Json | undefined, scope: ConversionScope, what: string): UncertainFrequency | undefined {
  const parsed = WorkbookParameterReferenceSchema.safeParse(reference);
  if (!parsed.success) return undefined;
  const basis = frequencyBasis(units, scope, what);
  return basis === undefined ? undefined : uncertainFrequency({ node: "PARAMETER", reference: parsed.data }, basis);
}

function oldUnits(value: Json | undefined): Json | undefined {
  return isRecord(value) ? field(value, "units") : undefined;
}

function withFrequency(record: JsonRecord, removed: readonly string[], frequency: TypedFrequency | UncertainFrequency | undefined): JsonRecord {
  if (frequency === undefined) return without(record, removed);
  if ("kind" in frequency) {
    if (frequency.kind === "INVALID") return record;
    return frequency.kind === "NONE" ? without(record, [...removed, "frequency"]) : replaced(record, removed, { frequency: jsonOf(frequency.frequency) });
  }
  return replaced(record, removed, { frequency: jsonOf(frequency) });
}

function convertGroup(group: JsonRecord, scope: ConversionScope): JsonRecord {
  if (!present(group, "meanFrequency")) return group;
  const what = `IE group ${textField(group, "uuid") ?? "?"}`;
  const old = field(group, "meanFrequency");
  const held = heldFrequency(field(group, "controlledDataSource"), oldUnits(old), scope, what);
  return withFrequency(group, ["meanFrequency"], held ?? typedFrequency(old, scope, `The mean frequency of ${what}`));
}

function sourceEstimate(family: Json, parameters: readonly number[], scope: ConversionScope, what: string): Law | undefined {
  const [first, second] = parameters;
  const pair = first !== undefined && second !== undefined ? [first, second] as const : undefined;
  switch (family) {
    case "POINT":
      if (first !== undefined && first >= 0) return { family: "POINT", value: first };
      break;
    case "GAMMA":
      if (pair !== undefined) return positiveLaw({ family: "GAMMA", shape: pair[0], rate: pair[1] }, pair, scope, what);
      break;
    case "LOGNORMAL":
      if (pair !== undefined) return lognormalFromMedian(pair[0], pair[1], scope, what);
      break;
    case "BETA":
      if (pair !== undefined) return positiveLaw({ family: "BETA", alpha: pair[0], beta: pair[1], lower: 0, upper: 1 }, pair, scope, what);
      break;
    default:
      scope.report(`${what} has a ${String(family)} distribution, which has no exact law in the contract.`);
      return undefined;
  }
  scope.report(`${what} gives ${parameters.length} parameters that do not form its ${String(family).toLowerCase()} distribution.`);
  return undefined;
}

function convertSource(source: JsonRecord, scope: ConversionScope): JsonRecord {
  if (!SOURCE_OLD_FIELDS.some((key) => present(source, key))) return source;
  const what = `IE data source ${textField(source, "uuid") ?? "?"}`;
  const basis = field(source, "basis");
  if (basis === "OPERATING_DATA") return without(source, SOURCE_OLD_FIELDS);
  if (basis === "FAULT_TREE") {
    const top = numberField(source, "faultTreeTopMean");
    if (top === undefined) return without(source, SOURCE_OLD_FIELDS);
    if (top < 0) {
      scope.report(`${what} has a negative top event frequency.`);
      return source;
    }
    return replaced(source, SOURCE_OLD_FIELDS, { faultTreeTop: jsonOf(pointExpression("PER_YEAR", top)) });
  }
  if (!present(source, "distributionParameters")) return without(source, SOURCE_OLD_FIELDS);
  const parameters = numberList(field(source, "distributionParameters"));
  if (parameters === undefined) {
    scope.report(`${what} holds distribution parameters that are not numbers.`);
    return source;
  }
  if (parameters.length === 0) return without(source, SOURCE_OLD_FIELDS);
  const law = sourceEstimate(field(source, "distributionFamily") ?? "POINT", parameters, scope, what);
  return law === undefined ? source : replaced(source, SOURCE_OLD_FIELDS, { estimate: jsonOf(frequencyExpression(law)) });
}

function convertQuantification(quantification: JsonRecord, heldGroups: ReadonlyMap<string, JsonRecord>, scope: ConversionScope): JsonRecord {
  const sourced = withArray(quantification, "dataSources", (source) => convertSource(convertFrequencyFaultTree(source), scope));
  if (!present(sourced, "meanFrequency")) return sourced;
  const target = textField(sourced, "initiatorOrGroupId") ?? "?";
  const what = `The IE frequency quantification of ${target}`;
  const old = field(sourced, "meanFrequency");
  const group = heldGroups.get(target);
  const held = group === undefined ? undefined : heldFrequency(field(group, "controlledDataSource"), oldUnits(field(group, "meanFrequency") ?? old), scope, what);
  return withFrequency(sourced, ["meanFrequency"], held ?? typedFrequency(old, scope, what));
}

function convertIeMef(mef: JsonRecord, scope: ConversionScope): JsonRecord {
  const heldGroups = new Map((arrayField(mef, "initiatingEventGroups") ?? []).flatMap((group) => {
    const id = isRecord(group) ? textField(group, "uuid") : undefined;
    return id === undefined || !isRecord(group) || !present(group, "controlledDataSource") ? [] : [[id, group] as const];
  }));
  const grouped = withArray(mef, "initiatingEventGroups", (group) => convertGroup(group, scope));
  return withArray(grouped, "quantifications", (quantification) => convertQuantification(quantification, heldGroups, scope));
}

function treeValue(frequency: JsonRecord, scope: ConversionScope, what: string): UncertainExpression | undefined {
  const value = numberField(frequency, "value");
  if (value === undefined || value < 0) {
    scope.report(`${what} has no frequency value of zero or more.`);
    return undefined;
  }
  switch (field(frequency, "unit") ?? "PER_YEAR") {
    case "PER_YEAR":
      return pointExpression("PER_YEAR", value);
    case "PER_HOUR":
      return pointExpression("PER_HOUR", value);
    case "PER_MINUTE":
      return pointExpression("PER_HOUR", value * MINUTES_PER_HOUR);
    case "PER_SECOND":
      return pointExpression("PER_HOUR", value * SECONDS_PER_HOUR);
    case "PER_DAY":
      return pointExpression("PER_HOUR", value / HOURS_PER_DAY);
    default:
      scope.report(`${what} is given per ${String(field(frequency, "unit"))}, which is not a frequency unit.`);
      return undefined;
  }
}

function treeExpression(frequency: JsonRecord, scope: ConversionScope, what: string): UncertainExpression | undefined {
  const source = recordField(frequency, "controlledDataSource");
  if (source === undefined) return treeValue(frequency, scope, what);
  const workbookId = textField(source, "workbookId");
  const parameterId = textField(source, "parameterId");
  if (workbookId === undefined || parameterId === undefined) {
    scope.report(`${what} names a data source without its workbook or parameter.`);
    return undefined;
  }
  return parameterExpression(workbookId, parameterId);
}

function convertEventTree(tree: JsonRecord, scope: ConversionScope, host: string): JsonRecord {
  return withRecord(tree, "initiatingEventFrequency", (frequency) => {
    if (storedExpression(frequency, "expression") !== undefined || !TREE_OLD_FIELDS.some((key) => present(frequency, key))) return frequency;
    const expression = treeExpression(frequency, scope, `The initiating event frequency of ${host} event tree ${textField(tree, "uuid") ?? "?"}`);
    return expression === undefined ? frequency : replaced(frequency, TREE_OLD_FIELDS, { expression: jsonOf(expression) });
  });
}

function convertEsMef(mef: JsonRecord, scope: ConversionScope): JsonRecord {
  return withArray(mef, "eventTrees", (tree) => convertEventTree(tree, scope, "ES"));
}

function convertHazardMef(mef: JsonRecord, scope: ConversionScope): JsonRecord {
  const trees = withRecord(mef, "hazardConditionedModels", (models) => withArray(models, "eventTrees", (tree) => convertEventTree(tree, scope, "hazard-conditioned")));
  return convertHazardFaultTrees(trees);
}

function hazardEventTrees(mef: JsonRecord): JsonRecord[] {
  const models = recordField(mef, "hazardConditionedModels");
  return (arrayField(models ?? {}, "eventTrees") ?? []).flatMap((tree) => (isRecord(tree) ? [tree] : []));
}

function figuresFrequency(record: JsonRecord, meanKey: string, scope: ConversionScope, what: string): TypedFrequency {
  const law = figuresLaw(numberField(record, meanKey), numberField(record, "medianFrequency"), numberField(record, "errorFactor"), scope, what);
  if (law === undefined) {
    return [meanKey, "medianFrequency", "errorFactor"].some((key) => present(record, key)) ? { kind: "INVALID" } : { kind: "NONE" };
  }
  const basis = frequencyBasis(field(record, "frequencyUnit"), scope, what);
  return basis === undefined ? { kind: "INVALID" } : { kind: "FREQUENCY", frequency: uncertainFrequency(frequencyExpression(law), basis) };
}

function heldByDa(record: JsonRecord, heldKey: string, holderKey: string, workbookId: string | undefined, scope: ConversionScope, what: string): UncertainFrequency | undefined {
  const holder = textField(record, holderKey);
  if (field(record, heldKey) !== "DA" || holder === undefined || workbookId === undefined) return undefined;
  const basis = frequencyBasis(field(record, "frequencyUnit"), scope, what);
  return basis === undefined ? undefined : uncertainFrequency(parameterExpression(workbookId, holder), basis);
}

function convertDaInitiatorNeed(need: JsonRecord, workbookId: string, scope: ConversionScope): JsonRecord {
  if (!NEED_OLD_FIELDS.some((key) => present(need, key))) return need;
  const what = `DA initiator need ${textField(need, "id") ?? "?"}`;
  const held = heldByDa(need, "valueHeldBy", "valueHolderId", workbookId, scope, what);
  return withFrequency(need, NEED_OLD_FIELDS, held ?? figuresFrequency(need, "meanFrequency", scope, what));
}

function convertEsqInitiator(record: JsonRecord, daWorkbookId: string | undefined, scope: ConversionScope): JsonRecord {
  if (!NEED_OLD_FIELDS.some((key) => present(record, key))) return record;
  const what = `ESQ initiator ${textField(record, "id") ?? "?"}`;
  const held = heldByDa(record, "heldBy", "holderId", daWorkbookId, scope, what);
  return withFrequency(record, NEED_OLD_FIELDS, held ?? figuresFrequency(record, "meanFrequency", scope, what));
}

function convertEsqInitiatorChoice(choice: JsonRecord, scope: ConversionScope): JsonRecord {
  if (!CHOICE_OLD_FIELDS.some((key) => present(choice, key))) return choice;
  if (field(choice, "source") !== "TYPED") return without(choice, CHOICE_OLD_FIELDS);
  const what = `The typed frequency of ESQ initiator choice ${textField(choice, "groupId") ?? "?"}`;
  const mean = numberField(choice, "mean");
  if (mean === undefined) return without(choice, CHOICE_OLD_FIELDS);
  const law = figuresLaw(mean, undefined, numberField(choice, "errorFactor"), scope, what);
  return law === undefined ? choice : replaced(choice, CHOICE_OLD_FIELDS, { expression: jsonOf(frequencyExpression(law)) });
}

export {
  convertDaInitiatorNeed,
  convertEsMef,
  convertEsqInitiator,
  convertEsqInitiatorChoice,
  convertEventTree,
  convertHazardMef,
  convertIeMef,
  hazardEventTrees,
};
