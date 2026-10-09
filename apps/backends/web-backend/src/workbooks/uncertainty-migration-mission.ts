import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { SuccessCriteriaDevelopmentSchema } from "interfaces-mef-types/zod/sc/success-criteria-development";
import { healMef } from "../pos-workbooks/mef-heal";
import { stripNulls } from "../pos-workbooks/mef-normalize";
import { createBlankSc } from "../sc-workbooks/blank-sc";
import { arrayField, field, isRecord, jsonOf, positiveField, present, textField, withArray, without, type JsonRecord } from "./uncertainty-migration-json";
import { parameterExpression, pointExpression, storedExpression, type ConversionScope } from "./uncertainty-migration-laws";

type ScMissionTimeLookup = ReadonlyMap<string, ReadonlySet<string>>;

type ScProjectLookup = ReadonlyMap<string, readonly string[]>;

interface ScLinkContext {
  linkedScId?: string;
  projectId: string;
  missionTimes: ScMissionTimeLookup;
  projects: ScProjectLookup;
}

interface RateTimes {
  missionTime?: UncertainExpression;
  testInterval?: UncertainExpression;
}

type Built = { kind: "VALUE"; expression: UncertainExpression } | { kind: "NONE" } | { kind: "MISSING"; slot: string };

function hoursExpression(hours: number): UncertainExpression {
  return pointExpression("HOURS", hours);
}

function storedHours(record: JsonRecord, key: string): UncertainExpression | undefined {
  const hours = positiveField(record, key);
  return hours === undefined ? undefined : hoursExpression(hours);
}

function rateModel(rate: UncertainExpression, standby: boolean, times: RateTimes): Built {
  if (standby) {
    return times.testInterval === undefined
      ? { kind: "MISSING", slot: "test interval" }
      : { kind: "VALUE", expression: { node: "MODEL", model: { form: "STANDBY", rate, testInterval: times.testInterval } } };
  }
  return times.missionTime === undefined
    ? { kind: "MISSING", slot: "mission time" }
    : { kind: "VALUE", expression: { node: "MODEL", model: { form: "MISSION", rate, missionTime: times.missionTime } } };
}

function missingIssue(what: string, slot: string): string {
  return `${what} needs a ${slot} for its rate model and none is stored, so it cannot be converted.`;
}

function withHours(record: JsonRecord, from: string, to: string, what: string, scope: ConversionScope): JsonRecord {
  if (!present(record, from)) return record;
  const kept = without(record, [from]);
  if (storedExpression(record, to) !== undefined) return kept;
  const hours = positiveField(record, from);
  if (hours === undefined) {
    scope.report(`${what} holds ${String(field(record, from))} mission time hours, which is not a positive number, so it cannot be converted.`);
    return record;
  }
  return { ...kept, [to]: jsonOf(hoursExpression(hours)) };
}

function withoutHours(record: JsonRecord, key: string): JsonRecord {
  return present(record, key) ? without(record, [key]) : record;
}

function scMissionTime(record: JsonRecord, kind: string, scope: ConversionScope): JsonRecord {
  const what = `${kind} ${textField(record, "uuid") ?? "?"}`;
  if (!present(record, "missionTimeHours") && storedExpression(record, "missionTime") === undefined) {
    scope.report(`${what} holds no mission time hours, so it cannot be converted.`);
    return record;
  }
  return withHours(record, "missionTimeHours", "missionTime", what, scope);
}

function convertScMef(mef: JsonRecord, scope: ConversionScope): JsonRecord {
  const sequences = withArray(mef, "missionTimes", (record) => scMissionTime(record, "SC mission time", scope));
  return withArray(sequences, "componentMissionTimes", (record) => scMissionTime(record, "SC component mission time", scope));
}

function scMissionTimeIds(mef: JsonRecord): Set<string> {
  const ids = new Set<string>();
  for (const key of ["missionTimes", "componentMissionTimes"]) {
    for (const record of arrayField(mef, key) ?? []) {
      const id = isRecord(record) ? textField(record, "uuid") : undefined;
      if (id !== undefined) ids.add(id);
    }
  }
  return ids;
}

function scWorkbookOf(reference: string, context: ScLinkContext): string | undefined {
  const linked = context.linkedScId;
  if (linked !== undefined && context.missionTimes.has(linked)) {
    return context.missionTimes.get(linked)?.has(reference) === true ? linked : undefined;
  }
  const holders = (context.projects.get(context.projectId) ?? []).filter((id) => context.missionTimes.get(id)?.has(reference) === true);
  return holders.length === 1 ? holders[0] : undefined;
}

function convertSyDefinition(definition: JsonRecord, context: ScLinkContext, scope: ConversionScope): JsonRecord {
  if (!present(definition, "missionTimeHours") && !present(definition, "missionTimeRef")) return definition;
  const kept = without(definition, ["missionTimeHours", "missionTimeRef"]);
  if (storedExpression(definition, "missionTime") !== undefined) return kept;
  const reference = textField(definition, "missionTimeRef");
  const scWorkbookId = reference === undefined ? undefined : scWorkbookOf(reference, context);
  if (reference !== undefined && scWorkbookId !== undefined) return { ...kept, missionTime: jsonOf(parameterExpression(scWorkbookId, reference)) };
  const hours = storedHours(definition, "missionTimeHours");
  if (hours !== undefined) return { ...kept, missionTime: jsonOf(hours) };
  const what = `SY system ${textField(definition, "uuid") ?? "?"}`;
  scope.report(reference === undefined
    ? `${what} holds ${String(field(definition, "missionTimeHours"))} mission time hours, which is not a positive number, so it cannot be converted.`
    : `${what} names the SC mission time ${reference}, which no SC workbook of its project holds, and it holds no hours, so it cannot be converted.`);
  return definition;
}

function convertSyDefinitions(mef: JsonRecord, context: ScLinkContext, scope: ConversionScope): JsonRecord {
  return withArray(mef, "systemDefinitions", (definition) => convertSyDefinition(definition, context, scope));
}

function scIssueOf(parsed: { success: boolean; error?: { issues: readonly { path: readonly PropertyKey[]; message: string }[] } }): string | undefined {
  if (parsed.success) return undefined;
  const issue = parsed.error?.issues[0];
  return issue === undefined ? "The document does not parse." : `${issue.path.map(String).join(".")}: ${issue.message}`;
}

function scIssue(mef: JsonRecord): string | undefined {
  return scIssueOf(SuccessCriteriaDevelopmentSchema.safeParse(stripNulls(mef)));
}

function previousScIssue(mef: JsonRecord, owner: string): string | undefined {
  return scIssueOf(SuccessCriteriaDevelopmentSchema.safeParse(healMef(mef, createBlankSc(textField(mef, "name") ?? "SC Workbook", textField(mef, "owner") ?? owner))));
}

export {
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
};
export type { Built, RateTimes, ScLinkContext, ScMissionTimeLookup, ScProjectLookup };
