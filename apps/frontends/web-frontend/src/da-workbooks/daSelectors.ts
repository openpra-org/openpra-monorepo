import {
  type DaBasicEventNeed,
  type DaDataNeeds,
  type DaLinkCode,
  type DaManualEntry,
  type DaNeedChange,
  type DaNeedElement,
  type DaNeedKind,
  type DaNeedList,
  type DaQuantificationModel,
  type DaScopeDecision,
  type DaScopeKind,
  type DataAnalysis,
  type DataAnalysisParameter,
  type ParameterType,
} from "interfaces-mef-types/da/data-analysis";
import { NEED_ELEMENTS, daLinkedDetailMissing, daNeedsLinked, linkedEstimate, mappableNeeds, parameterStates, type DaMapElement, type DaMappableNeed } from "interfaces-mef-types/da/da-linked-needs";
import { canonicalJson, lawBounds, modelArguments, unitBounds, type UncertainExpression, type UncertainValue } from "interfaces-mef-types/core/uncertainty";
import { familyText } from "../newly-developed-methods/shared/uncertainText";
import { holdsEstimate } from "interfaces-mef-types/da/data-analysis";
import { FrequencyUnit } from "interfaces-mef-types/core/events";
import { componentUnit, daMissionTimes, lawParameter, parameterPoint, pointState, readyNumber } from "./daLaws";
import { type WorkbookParameterReference } from "interfaces-mef-types/modeling/references";
import { sourcesComplete } from "./daSourcing";
import { failuresComplete } from "./daFailures";
import { unavailabilityComplete } from "./daUnavailability";
import { ccfComplete } from "./daCcf";
import { frequenciesComplete, stateShares } from "./daFrequencies";
import { uncertaintyComplete } from "./daUncertainty";
import {
  CONFORMANCE_ITEMS,
  DA_SCOPE_KINDS,
  DA_STEPS,
  DA_PERSONA_STEPS,
  NEED_ELEMENT_LABELS,
  MODELS_FOR_KIND,
  QUANTIFICATION_MODELS,
  type DaModelSpec,
  type ConformanceItem,
  type DaPersona,
  type DaStep,
  type Stage,
} from "./daViewData";

interface CommentView {
  id: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  authorTitle?: string;
  when: string;
  createdAt: string;
  associatedSr?: string;
  section: string;
  targetLabel: string;
  text: string;
  severity: "MAJOR" | "MINOR" | "OBSERVATION";
  resolved: boolean;
  resolution?: string;
}

interface CcScore {
  applicable: number;
  met: number;
  warn: number;
  blocked: number;
  na: number;
  ready: number;
  total: number;
  percent: number;
}

const MS_PER_HOUR = 1000 * 60 * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;

function initialsOf(name: string): string {
  const cleaned = name.startsWith("Dr. ") ? name.slice(4) : name;
  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function relativeFrom(iso: string, now: Date): string {
  const diff = now.getTime() - new Date(iso).getTime();
  if (diff < MS_PER_HOUR) {
    const m = Math.max(1, Math.round(diff / (1000 * 60)));
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (diff < MS_PER_DAY) {
    const h = Math.round(diff / MS_PER_HOUR);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  if (diff < MS_PER_DAY * 2) return "yesterday";
  const d = Math.round(diff / MS_PER_DAY);
  return `${d} days ago`;
}

function scopeDecisionOf(da: DataAnalysis, kind: DaScopeKind): DaScopeDecision | undefined {
  return (da.scopeDecisions ?? []).find((decision) => decision.kind === kind);
}

function excludedScopeSrs(da: DataAnalysis): Map<string, string> {
  const excluded = new Map<string, string>();
  for (const spec of DA_SCOPE_KINDS) {
    const decision = scopeDecisionOf(da, spec.kind);
    if (decision === undefined || decision.included) continue;
    const reason = (decision.exclusionReason ?? "").trim();
    for (const sr of spec.srs) excluded.set(sr, reason.length > 0 ? `Out of scope · ${reason}` : "Out of scope");
  }
  return excluded;
}

function scopeItemsToComplete(da: DataAnalysis): string[] {
  const items: string[] = [];
  if (da.praScope.trim().length === 0) items.push("Write the PRA scope.");
  for (const spec of DA_SCOPE_KINDS) {
    const decision = scopeDecisionOf(da, spec.kind);
    const label = spec.label.toLowerCase();
    if (decision === undefined) items.push(`Set Included or Excluded for ${label}.`);
    else if (!decision.included && (decision.exclusionReason ?? "").trim().length === 0) items.push(`Give a reason for excluding ${label}.`);
  }
  const plan = da.dataPlan ?? {};
  if ((plan.freezeDate ?? "").length === 0) items.push("Set the data freeze date.");
  if (da.plantStage === "OPERATIONAL") {
    const start = plan.dataWindowStart ?? "";
    const end = plan.dataWindowEnd ?? "";
    if (start.length === 0 || end.length === 0) items.push("Set the start and end of the data window.");
    else if (start >= end) items.push("End the data window after it starts.");
  }
  if (plan.modulesPerPlant === undefined) items.push("Set the number of modules per plant.");
  return items;
}

const KIND_SCOPE: Partial<Record<DaNeedKind, DaScopeKind>> = {
  UNAVAILABILITY: "TEST_MAINTENANCE",
  HUMAN_ERROR: "HUMAN_ERROR",
  RECOVERY: "REPAIR_RECOVERY",
  COMMON_CAUSE: "COMMON_CAUSE",
};

function emptyNeeds(): DaDataNeeds {
  return { sources: [], basicEvents: [], initiators: [], humanErrors: [], ccfGroups: [], states: [] };
}

function withNeeds(da: DataAnalysis, fn: (needs: DaDataNeeds) => DaDataNeeds): DataAnalysis {
  return { ...da, dataNeeds: fn(da.dataNeeds ?? emptyNeeds()) };
}

function nextNeedId(prefix: string, ids: readonly string[]): string {
  const taken = new Set(ids.map((id) => id.toLowerCase()));
  let n = ids.length + 1;
  while (taken.has(`${prefix}-${String(n).padStart(2, "0")}`.toLowerCase())) n += 1;
  return `${prefix}-${String(n).padStart(2, "0")}`;
}

function missionModelTime(estimate: UncertainExpression | undefined): UncertainExpression | undefined {
  return estimate?.node === "MODEL" && estimate.model.form === "MISSION" ? estimate.model.missionTime : undefined;
}

function missionTimeText(expression: UncertainExpression, hours: number | undefined): string {
  if (expression.node === "PARAMETER") return `mission time ${expression.reference.entityId}`;
  return hours === undefined ? "another mission time" : `${Number(hours.toPrecision(6))} h`;
}

function scTimeOf(reference: WorkbookParameterReference): { component: boolean; sequence: string } | undefined {
  for (const source of daMissionTimes().sources) {
    if (source.workbookId !== reference.workbookId) continue;
    const mission = source.sc.missionTimes.find((entry) => entry.uuid === reference.entityId);
    if (mission !== undefined) return { component: false, sequence: mission.eventSequenceReference };
    const component = (source.sc.componentMissionTimes ?? []).find((entry) => entry.uuid === reference.entityId);
    if (component !== undefined) return { component: true, sequence: component.eventSequenceReference };
  }
  return undefined;
}

function justifiedComponentTime(estimate: UncertainExpression, need: UncertainExpression): boolean {
  if (estimate.node !== "PARAMETER" || need.node !== "PARAMETER") return false;
  const component = scTimeOf(estimate.reference);
  const mission = scTimeOf(need.reference);
  if (component?.component !== true || mission === undefined || mission.component) return false;
  if (component.sequence === mission.sequence) return true;
  const families = daMissionTimes().families;
  const ofComponent = families.get(component.sequence) ?? [];
  const ofMission = families.get(mission.sequence) ?? [];
  return ofComponent.includes(mission.sequence) || ofComponent.some((family) => ofMission.includes(family));
}

function missionTimeDiffers(estimate: UncertainExpression | undefined, need: UncertainExpression | undefined): { need: string; estimate: string } | undefined {
  if (estimate === undefined || need === undefined || canonicalJson(estimate) === canonicalJson(need)) return undefined;
  if (justifiedComponentTime(estimate, need)) return undefined;
  const ours = readyNumber(pointState(estimate, "HOURS"));
  const theirs = readyNumber(pointState(need, "HOURS"));
  if (estimate.node === "PARAMETER" && need.node === "PARAMETER") return { need: missionTimeText(need, theirs), estimate: missionTimeText(estimate, ours) };
  if (ours === undefined || theirs === undefined || ours === theirs) return undefined;
  return { need: missionTimeText(need, theirs), estimate: missionTimeText(estimate, ours) };
}

function sameMissionTime(left: UncertainExpression | undefined, right: UncertainExpression | undefined): boolean {
  return left === undefined || right === undefined ? left === right : canonicalJson(left) === canonicalJson(right);
}

function basicEventEdited(need: DaBasicEventNeed): boolean {
  return need.manual === undefined && (need.kind !== need.importedKind || !sameMissionTime(need.missionTime, need.importedMissionTime));
}

function needManualCount(needs: DaDataNeeds | undefined): number {
  if (needs === undefined) return 0;
  return [needs.basicEvents, needs.initiators, needs.humanErrors, needs.ccfGroups, needs.states]
    .reduce((count, rows) => count + rows.filter((row) => row.manual !== undefined).length, 0);
}

function needChangeOf(needs: DaDataNeeds, element: DaNeedElement, id: string): DaNeedChange["change"] | undefined {
  return needs.changes?.find((change) => change.element === element && change.id === id)?.change;
}

type DaFindingSeverity = "error" | "warning" | "note";

type DaNeedWindowKind = "needEvent" | "needInitiator" | "needHuman" | "needCcf" | "needState" | "daParameter" | "daBoundary" | "daFailureMode" | "daGroup" | "daOutlier" | "daSource" | "daEntry" | "daSourcing" | "daElicitation" | "daPrior" | "daEvidence" | "daEstimate" | "daRecordSet" | "daRecord" | "daRule" | "daDesignChange" | "daDemand" | "daHours" | "daMaintenance" | "daRestoration" | "daOutage" | "daCcfGroup" | "daCcfEvents" | "daCcfFactors" | "daFrequency" | "daDistribution" | "daUncertaintySource" | "daSensitivity" | "daAssumption" | "daImportance";

interface DaNeedFinding {
  severity: DaFindingSeverity;
  check: string;
  item: string;
  detail: string;
  target?: { kind: DaNeedWindowKind; id: string };
}

const FINDING_RANK: Record<DaFindingSeverity, number> = { error: 0, warning: 1, note: 2 };

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function repeatedKeys(keys: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const key of keys) {
    const normal = key.trim().toLowerCase();
    if (seen.has(normal)) repeated.add(key);
    seen.add(normal);
  }
  return [...repeated];
}

function scopeIsExcluded(da: DataAnalysis, kind: DaScopeKind): boolean {
  const decision = scopeDecisionOf(da, kind);
  return decision !== undefined && !decision.included;
}

function scopeIsIncluded(da: DataAnalysis, kind: DaScopeKind): boolean {
  return scopeDecisionOf(da, kind)?.included === true;
}

function scopeLabel(kind: DaScopeKind): string {
  return (DA_SCOPE_KINDS.find((spec) => spec.kind === kind)?.label ?? kind).toLowerCase();
}

function frequencyUnitText(unit: FrequencyUnit): string {
  return unit.split("-").join(" ");
}

function manualFindings(row: { name: string; manual?: DaManualEntry }, item: string, noun: string, target: DaNeedFinding["target"]): DaNeedFinding[] {
  if (row.manual === undefined) return [];
  const findings: DaNeedFinding[] = [];
  if (blank(row.name)) findings.push({ severity: "warning", check: "No name", item, detail: `Name the ${noun}.`, target });
  if (blank(row.manual.source)) findings.push({ severity: "warning", check: "Source not given", item, detail: "Say where this need comes from.", target });
  return findings;
}

const NEED_LIST_LABELS: Record<DaNeedList, string> = { BASIC_EVENT: "Basic event", INITIATOR: "Initiator group", HUMAN_ERROR: "Human error", CCF_GROUP: "Common cause group", STATE: "Operating state" };

function sourceFindings(da: DataAnalysis, needs: DaDataNeeds, unavailable: readonly DaLinkCode[]): DaNeedFinding[] {
  const findings: DaNeedFinding[] = [];
  const links = da.linkedWorkbooks ?? {};
  for (const element of NEED_ELEMENTS) {
    if (links[element] === undefined || !unavailable.includes(element)) continue;
    const label = NEED_ELEMENT_LABELS[element];
    findings.push({ severity: "error", check: "Linked workbook unavailable", item: label, detail: `The linked ${label} workbook could not be read. Its rows do not show until it can be read again.` });
  }
  for (const detail of daLinkedDetailMissing(needs)) {
    findings.push({ severity: "warning", check: "Linked row not found", item: `${NEED_LIST_LABELS[detail.list]} ${detail.id}`, detail: "The linked workbook no longer holds this row. DA keeps the work entered for it." });
  }
  return findings;
}

function basicEventFindings(da: DataAnalysis, needs: DaDataNeeds): DaNeedFinding[] {
  const findings: DaNeedFinding[] = [];
  const hfeIds = new Set(needs.humanErrors.map((need) => need.hfeId));
  const parameterIds = new Set(da.parameters.map((parameter) => parameter.uuid));
  for (const code of repeatedKeys(needs.basicEvents.map((need) => need.code))) {
    const id = needs.basicEvents.find((need) => need.code === code)?.id ?? code;
    findings.push({ severity: "error", check: "Duplicate ID", item: code, detail: "Two basic events share this ID. Give each its own ID.", target: { kind: "needEvent", id } });
  }
  for (const need of needs.basicEvents) {
    const target = { kind: "needEvent" as const, id: need.id };
    const item = need.code.trim().length > 0 ? need.code : need.id;
    findings.push(...manualFindings(need, item, "basic event", target));
    if (!need.included) {
      if (blank(need.exclusionReason)) findings.push({ severity: "error", check: "Excluded without a reason", item, detail: "Give the reason this event is left out.", target });
      continue;
    }
    if (basicEventEdited(need) && blank(need.changeReason)) findings.push({ severity: "error", check: "Edited without a reason", item, detail: "The event type or mission time differs from SY. Give the reason.", target });
    if (need.kind === undefined) findings.push({ severity: "error", check: "No event type", item, detail: "SY gives no failure mode that sets the event type. Set the event type.", target });
    if (need.kind === "RUNNING" && need.missionTime === undefined) findings.push({ severity: "error", check: "No mission time", item, detail: "Enter the mission time for this running failure.", target });
    if (need.kind === "STANDBY" && (need.testIntervalHours === undefined || need.testIntervalHours <= 0)) findings.push({ severity: "error", check: "No test interval", item, detail: "Enter the test interval for this standby failure.", target });
    const scope = need.kind === undefined ? undefined : KIND_SCOPE[need.kind];
    if (scope !== undefined && scopeIsExcluded(da, scope)) findings.push({ severity: "warning", check: "Out of scope", item, detail: `Step 01 leaves ${scopeLabel(scope)} out of scope, but SY models this event.`, target });
    if (need.repairCredited === true && scopeIsExcluded(da, "REPAIR_RECOVERY")) findings.push({ severity: "warning", check: "Out of scope", item, detail: "SY credits repair here, but Step 01 leaves repair and recovery out of scope.", target });
    if (need.valueHeldBy === "HRA" && need.valueHolderId !== undefined && !hfeIds.has(need.valueHolderId)) findings.push({ severity: "warning", check: "HR event missing", item, detail: `SY takes this value from HR event ${need.valueHolderId}, which is not among the human failure events.`, target });
    if (need.valueHeldBy === "DA" && need.valueHolderId !== undefined && !parameterIds.has(need.valueHolderId)) findings.push({ severity: "warning", check: "DA parameter missing", item, detail: `SY takes this value from DA parameter ${need.valueHolderId}, which this workbook does not hold.`, target });
    if (need.manual === undefined && need.valueHeldBy === "TYPED" && need.value === undefined) findings.push({ severity: "note", check: "No value yet", item, detail: "SY holds no value for this event yet.", target });
  }
  if (scopeIsIncluded(da, "TEST_MAINTENANCE") && !needs.basicEvents.some((need) => need.included && need.kind === "UNAVAILABILITY")) {
    findings.push({ severity: "note", check: "Nothing listed", item: "Basic events", detail: "Step 01 includes test and maintenance, but no basic event has that event type." });
  }
  return findings;
}

function initiatorFindings(da: DataAnalysis, needs: DaDataNeeds): DaNeedFinding[] {
  const findings: DaNeedFinding[] = [];
  const stateIds = new Set(needs.states.map((state) => state.id));
  for (const id of repeatedKeys(needs.initiators.map((need) => need.id))) {
    findings.push({ severity: "error", check: "Duplicate ID", item: id, detail: "Two initiator groups share this ID. Give each its own ID.", target: { kind: "needInitiator", id } });
  }
  for (const need of needs.initiators) {
    const target = { kind: "needInitiator" as const, id: need.id };
    findings.push(...manualFindings(need, need.id, "initiator group", target));
    if (!need.included) {
      if (blank(need.exclusionReason)) findings.push({ severity: "error", check: "Excluded without a reason", item: need.id, detail: "Give the reason this group is left out.", target });
      continue;
    }
    if (need.frequency === undefined) findings.push({ severity: "note", check: "No frequency yet", item: need.id, detail: need.manual === undefined ? "IE holds no frequency for this group yet." : "DA estimates this frequency.", target });
    if (need.frequency !== undefined && need.frequency.basis !== FrequencyUnit.PER_PLANT_YEAR) findings.push({ severity: "warning", check: "Frequency unit", item: need.id, detail: `IE gives this frequency ${frequencyUnitText(need.frequency.basis)}. DA works per plant-year.`, target });
    const strayStates = stateIds.size === 0 ? [] : need.stateIds.filter((state) => !stateIds.has(state));
    if (strayStates.length > 0) findings.push({ severity: "warning", check: "Unknown state", item: need.id, detail: `${strayStates.join(", ")} ${strayStates.length === 1 ? "is" : "are"} not among the operating states.`, target });
  }
  const listed = needs.initiators.filter((need) => need.included).length;
  if (scopeIsExcluded(da, "INITIATING_EVENT") && listed > 0) findings.push({ severity: "warning", check: "Out of scope", item: "Initiators", detail: `Step 01 leaves initiating event frequencies out of scope, but ${listed} ${listed === 1 ? "group is" : "groups are"} listed.` });
  if (scopeIsIncluded(da, "INITIATING_EVENT") && needs.initiators.length === 0) findings.push({ severity: "warning", check: "Nothing listed", item: "Initiators", detail: "Step 01 includes initiating event frequencies, but no initiator group is listed. Link IE in Step 01, or add them by hand." });
  return findings;
}

function humanErrorFindings(da: DataAnalysis, needs: DaDataNeeds): DaNeedFinding[] {
  const findings: DaNeedFinding[] = [];
  for (const id of repeatedKeys(needs.humanErrors.map((need) => need.id))) {
    findings.push({ severity: "error", check: "Duplicate ID", item: id, detail: "Two human error rows share this ID. Give each its own ID.", target: { kind: "needHuman", id } });
  }
  for (const need of needs.humanErrors) {
    const target = { kind: "needHuman" as const, id: need.id };
    findings.push(...manualFindings(need, need.hfeId, "human failure event", target));
    if (!need.included) {
      if (blank(need.exclusionReason)) findings.push({ severity: "error", check: "Excluded without a reason", item: need.hfeId, detail: "Give the reason this event is left out.", target });
      continue;
    }
    if (need.value === undefined) findings.push({ severity: "note", check: "No HEP yet", item: need.hfeId, detail: need.manual === undefined ? "HR holds no probability for this event yet." : "DA holds this probability once it is entered.", target });
    if (need.kind === "RECOVERY" && scopeIsExcluded(da, "REPAIR_RECOVERY")) findings.push({ severity: "warning", check: "Out of scope", item: need.hfeId, detail: "HR credits a recovery here, but Step 01 leaves repair and recovery out of scope.", target });
  }
  const listed = needs.humanErrors.filter((need) => need.included).length;
  if (scopeIsExcluded(da, "HUMAN_ERROR") && listed > 0) findings.push({ severity: "warning", check: "Out of scope", item: "Human errors", detail: `Step 01 leaves human error probabilities out of scope, but ${listed} ${listed === 1 ? "row is" : "rows are"} listed.` });
  if (scopeIsIncluded(da, "HUMAN_ERROR") && needs.humanErrors.length === 0) findings.push({ severity: "warning", check: "Nothing listed", item: "Human errors", detail: "Step 01 includes human error probabilities, but no human failure event is listed. Link HR in Step 01, or add them by hand." });
  if (scopeIsIncluded(da, "REPAIR_RECOVERY") && !needs.basicEvents.some((need) => need.included && (need.repairCredited === true || need.kind === "RECOVERY")) && !needs.humanErrors.some((need) => need.included && need.kind === "RECOVERY")) {
    findings.push({ severity: "note", check: "Nothing listed", item: "Repair and recovery", detail: "Step 01 includes repair and recovery, but no event credits repair or recovery." });
  }
  return findings;
}

function ccfGroupFindings(da: DataAnalysis, needs: DaDataNeeds): DaNeedFinding[] {
  const findings: DaNeedFinding[] = [];
  const eventKeys = new Set(needs.basicEvents.flatMap((need) => [need.id, need.code]));
  const estimates = new Set((da.ccfParameterEstimations ?? []).map((estimate) => estimate.uuid));
  for (const id of repeatedKeys(needs.ccfGroups.map((need) => need.id))) {
    findings.push({ severity: "error", check: "Duplicate ID", item: id, detail: "Two common cause groups share this ID. Give each its own ID.", target: { kind: "needCcf", id } });
  }
  for (const need of needs.ccfGroups) {
    const target = { kind: "needCcf" as const, id: need.id };
    findings.push(...manualFindings(need, need.id, "common cause group", target));
    if (!need.included) {
      if (blank(need.exclusionReason)) findings.push({ severity: "error", check: "Excluded without a reason", item: need.id, detail: "Give the reason this group is left out.", target });
      continue;
    }
    if (need.memberIds.length < 2) findings.push({ severity: "error", check: "Too few members", item: need.id, detail: "A common cause group needs at least two members.", target });
    const strayMembers = need.memberIds.filter((member) => !eventKeys.has(member));
    if (strayMembers.length > 0) findings.push({ severity: "error", check: "Unknown member", item: need.id, detail: `${strayMembers.join(", ")} ${strayMembers.length === 1 ? "is" : "are"} not among the basic events.`, target });
    if (need.estimateRef !== undefined && !estimates.has(need.estimateRef)) findings.push({ severity: "warning", check: "DA estimate missing", item: need.id, detail: `SY refers to DA estimate ${need.estimateRef}, which this workbook does not hold.`, target });
  }
  const listed = needs.ccfGroups.filter((need) => need.included).length;
  if (scopeIsExcluded(da, "COMMON_CAUSE") && listed > 0) findings.push({ severity: "warning", check: "Out of scope", item: "Common cause groups", detail: `Step 01 leaves common cause failures out of scope, but ${listed} ${listed === 1 ? "group is" : "groups are"} listed.` });
  if (scopeIsIncluded(da, "COMMON_CAUSE") && needs.ccfGroups.length === 0) findings.push({ severity: "warning", check: "Nothing listed", item: "Common cause groups", detail: "Step 01 includes common cause failures, but no group is listed. Link SY in Step 01, or add them by hand." });
  return findings;
}

function stateFindings(da: DataAnalysis, needs: DaDataNeeds): DaNeedFinding[] {
  const findings: DaNeedFinding[] = [];
  for (const id of repeatedKeys(needs.states.map((need) => need.id))) {
    findings.push({ severity: "error", check: "Duplicate ID", item: id, detail: "Two operating states share this ID. Give each its own ID.", target: { kind: "needState", id } });
  }
  for (const need of needs.states) {
    const target = { kind: "needState" as const, id: need.id };
    findings.push(...manualFindings(need, need.id, "operating state", target));
    if (!need.included) {
      if (blank(need.exclusionReason)) findings.push({ severity: "error", check: "Excluded without a reason", item: need.id, detail: "Give the reason this state is left out.", target });
      continue;
    }
    if (need.durationHours === undefined || need.durationHours <= 0) findings.push({ severity: "warning", check: "No duration", item: need.id, detail: "Enter the hours the plant spends in this state.", target });
  }
  if (scopeIsIncluded(da, "OUTAGE") && needs.states.length === 0) findings.push({ severity: "warning", check: "Nothing listed", item: "Operating states", detail: "Step 01 includes outage data, but no operating state is listed. Link POS in Step 01, or add them by hand." });
  return findings;
}

function isNeedElement(code: DaLinkCode): code is DaNeedElement {
  return NEED_ELEMENTS.some((element) => element === code);
}

function countTyped<T extends { manual?: DaManualEntry }>(rows: readonly T[]): number {
  return rows.filter((row) => row.manual !== undefined).length;
}

function typedNeedCount(needs: DaDataNeeds | undefined, code: DaLinkCode): number {
  if (needs === undefined) return 0;
  switch (code) {
    case "SY": return countTyped(needs.basicEvents) + countTyped(needs.ccfGroups);
    case "IE": return countTyped(needs.initiators);
    case "HRA": return countTyped(needs.humanErrors);
    case "POS": return countTyped(needs.states);
    default: return 0;
  }
}

function keptRows<T extends { manual?: DaManualEntry }>(rows: T[], dropLinked: boolean, dropTyped: boolean): T[] {
  return rows.filter((row) => (row.manual === undefined ? !dropLinked : !dropTyped));
}

function withLinkChanged(da: DataAnalysis, code: DaLinkCode, before: string | undefined): DataAnalysis {
  const needs = da.dataNeeds;
  const after = da.linkedWorkbooks?.[code];
  if (needs === undefined || !isNeedElement(code) || before === after) return da;
  const typed = after !== undefined;
  return {
    ...da,
    dataNeeds: {
      ...needs,
      basicEvents: code === "SY" ? keptRows(needs.basicEvents, true, typed) : needs.basicEvents,
      ccfGroups: code === "SY" ? keptRows(needs.ccfGroups, true, typed) : needs.ccfGroups,
      initiators: code === "IE" ? keptRows(needs.initiators, true, typed) : needs.initiators,
      humanErrors: code === "HRA" ? keptRows(needs.humanErrors, true, typed) : needs.humanErrors,
      states: code === "POS" ? keptRows(needs.states, true, typed) : needs.states,
    },
  };
}

function daNeedChecks(da: DataAnalysis, unavailable: readonly DaLinkCode[] = []): DaNeedFinding[] {
  const needs = da.dataNeeds;
  if (needs === undefined) return [];
  const findings = [
    ...sourceFindings(da, needs, unavailable),
    ...basicEventFindings(da, needs),
    ...initiatorFindings(da, needs),
    ...humanErrorFindings(da, needs),
    ...ccfGroupFindings(da, needs),
    ...stateFindings(da, needs),
  ];
  return findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => FINDING_RANK[a.finding.severity] - FINDING_RANK[b.finding.severity] || a.index - b.index)
    .map(({ finding }) => finding);
}

function needsComplete(da: DataAnalysis): boolean {
  const needs = da.dataNeeds;
  if (needs === undefined) return false;
  const listed = needs.basicEvents.length + needs.initiators.length + needs.humanErrors.length + needs.ccfGroups.length;
  return listed > 0 && !daNeedChecks(da).some((finding) => finding.severity === "error");
}

const COMPONENT_MODELS: ReadonlySet<DaQuantificationModel> = new Set(["DEMAND_PROBABILITY", "RUNNING_RATE", "MISSION_PROBABILITY", "STANDBY_RATE"]);

const PROBABILITY_MODELS_SET: ReadonlySet<DaQuantificationModel> = new Set(["DEMAND_PROBABILITY", "MISSION_PROBABILITY", "UNAVAILABILITY", "HUMAN_ERROR", "NON_RECOVERY", "OTHER_PROBABILITY"]);

function modelSpecOf(model: DaQuantificationModel | undefined): DaModelSpec | undefined {
  return model === undefined ? undefined : QUANTIFICATION_MODELS.find((spec) => spec.model === model);
}

function modelsForNeed(need: DaMappableNeed): DaQuantificationModel[] {
  if (need.element === "IE") return ["FREQUENCY"];
  return need.kind === undefined ? [] : MODELS_FOR_KIND[need.kind];
}

function defaultModelFor(need: DaMappableNeed, parameterType?: ParameterType): DaQuantificationModel | undefined {
  if (need.element === "IE") return "FREQUENCY";
  if (need.kind === "RUNNING") return parameterType === "FAILURE_RATE" || need.valueUnit === "PER_HOUR" ? "RUNNING_RATE" : "MISSION_PROBABILITY";
  return need.kind === undefined ? undefined : MODELS_FOR_KIND[need.kind][0];
}

function withNeedParameter(da: DataAnalysis, element: DaMapElement, needId: string, parameterId: string | undefined): DataAnalysis {
  const needs = da.dataNeeds;
  if (needs === undefined) return da;
  const assign = <T extends { id: string; parameterId?: string }>(rows: T[]): T[] => rows.map((row): T => {
    if (row.id !== needId) return row;
    return { ...row, parameterId };
  });
  const nextNeeds: DaDataNeeds = {
    ...needs,
    basicEvents: element === "SY" ? assign(needs.basicEvents) : needs.basicEvents,
    initiators: element === "IE" ? assign(needs.initiators) : needs.initiators,
    humanErrors: element === "HRA" ? assign(needs.humanErrors) : needs.humanErrors,
  };
  const need = mappableNeeds(nextNeeds).find((candidate) => candidate.element === element && candidate.id === needId);
  const parameters = da.parameters.map((parameter) => {
    if (parameter.uuid !== parameterId || parameter.quantificationModel !== undefined || need === undefined) return parameter;
    return withModel(parameter, defaultModelFor(need, parameter.parameterType));
  });
  return { ...da, dataNeeds: nextNeeds, parameters };
}

function withModel(parameter: DataAnalysisParameter, model: DaQuantificationModel | undefined): DataAnalysisParameter {
  const spec = modelSpecOf(model);
  if (model === undefined || spec === undefined) return parameter;
  const next: DataAnalysisParameter = { ...parameter, quantificationModel: model, parameterType: spec.parameterType };
  if (holdsEstimate(model)) {
    const unit = componentUnit(next);
    if (next.estimate === undefined && next.value !== undefined && unit !== undefined) next.estimate = { node: "VALUE", value: { unit, law: { family: "POINT", value: next.value } } };
    delete next.value;
    delete next.valueType;
    delete next.uncertainty;
  }
  return next;
}

function nextParameterId(ids: ReadonlySet<string>): string {
  let highest = 0;
  for (const id of ids) {
    if (!id.startsWith("DA-P-")) continue;
    const n = Number(id.slice(5));
    if (Number.isInteger(n) && n > highest) highest = n;
  }
  return `DA-P-${String(highest + 1).padStart(3, "0")}`;
}

function linkedParameter(id: string, need: DaMappableNeed, model: DaQuantificationModel): DataAnalysisParameter {
  const spec = modelSpecOf(model);
  const parameter: DataAnalysisParameter = {
    uuid: id,
    name: need.name.trim().length > 0 ? need.name : need.code,
    parameterType: spec?.parameterType ?? "PROBABILITY",
    quantificationModel: model,
    valueMode: "LINKED",
    valueLink: { element: need.element, needId: need.id },
    implementsSrs: [{ sr: "DA-A1", hlr: "A" }],
  };
  if (holdsEstimate(model)) {
    if (need.expression !== undefined) parameter.estimate = linkedEstimate(need.expression, componentUnit(parameter));
  } else {
    parameter.valueType = need.valueType;
    if (need.value !== undefined) parameter.value = need.value;
  }
  if (need.stateIds.length > 0) parameter.stateIds = [...need.stateIds];
  if (need.systemId !== undefined) parameter.systemReference = need.systemId;
  return parameter;
}

function sameValue(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b));
}

function parameterNeeds(da: DataAnalysis, parameterId: string): DaMappableNeed[] {
  return mappableNeeds(da.dataNeeds).filter((need) => need.parameterId === parameterId);
}

function parameterValueText(da: DataAnalysis, parameter: DataAnalysisParameter): string {
  if (parameter.valueMode === "LINKED" && parameter.valueLink !== undefined) {
    const link = parameter.valueLink;
    const need = mappableNeeds(da.dataNeeds).find((view) => view.element === link.element && view.id === link.needId);
    return `Linked · ${NEED_ELEMENT_LABELS[link.element]} ${need?.code ?? link.needId}`;
  }
  if (parameter.valueMode === "CALCULATED") return "Calculated in DA";
  const held = lawParameter(parameter) ? parameter.estimate !== undefined : parameter.value !== undefined;
  return held ? "Typed in DA" : "Not estimated";
}

function valueNodes(expression: UncertainExpression): UncertainValue[] {
  switch (expression.node) {
    case "VALUE": return [expression.value];
    case "PARAMETER": return [];
    case "OPERATION": return expression.operands.flatMap(valueNodes);
    case "MODEL": return modelArguments(expression.model).flatMap(valueNodes);
  }
}

function rangeFinding(expression: UncertainExpression): Pick<DaNeedFinding, "severity" | "check" | "detail"> | undefined {
  let crossing: Pick<DaNeedFinding, "severity" | "check" | "detail"> | undefined;
  for (const value of valueNodes(expression)) {
    const bounds = lawBounds(value.law);
    const domain = unitBounds(value.unit);
    const law = familyText(value.law.family).toLowerCase();
    if (bounds.upper < domain.lower) return { severity: "error", check: "Out of range", detail: `The ${law} law lies entirely below 0. Pick values in range.` };
    if (bounds.lower > domain.upper) return { severity: "error", check: "Out of range", detail: `The ${law} law lies entirely above 1, but it is a probability. Pick values in range.` };
    if (crossing === undefined && bounds.lower < domain.lower) crossing = { severity: "warning", check: "Can leave range", detail: `The ${law} law can go below 0. A run stops on any trial below 0. Truncate it at 0 to be safe.` };
    if (crossing === undefined && bounds.upper > domain.upper) crossing = { severity: "warning", check: "Can leave range", detail: `The ${law} law can go above 1. A run stops on any trial above 1. Truncate it at 1 to be safe.` };
  }
  return crossing;
}

function parameterFindings(da: DataAnalysis): DaNeedFinding[] {
  const findings: DaNeedFinding[] = [];
  const needs = mappableNeeds(da.dataNeeds);
  const byId = new Map(da.parameters.map((parameter) => [parameter.uuid, parameter]));
  const boundaries = new Set(da.componentBoundaries.map((boundary) => boundary.uuid));
  const modes = new Set((da.failureModes ?? []).map((mode) => mode.uuid));
  const groups = new Set((da.componentGroupings ?? []).map((group) => group.uuid));
  const stateIds = new Set((da.dataNeeds?.states ?? []).map((state) => state.id));
  for (const id of repeatedKeys(da.parameters.map((parameter) => parameter.uuid))) {
    findings.push({ severity: "error", check: "Duplicate ID", item: id, detail: "Two parameters share this ID.", target: { kind: "daParameter", id } });
  }
  for (const need of needs) {
    if (!need.included) continue;
    const item = need.code;
    if (need.parameterId === undefined) {
      if (modelsForNeed(need).length > 0 || need.element !== "SY") findings.push({ severity: "error", check: "Not mapped", item, detail: "Map this event to a parameter in the event map." });
      continue;
    }
    const parameter = byId.get(need.parameterId);
    if (parameter === undefined) {
      findings.push({ severity: "error", check: "Parameter missing", item, detail: `This event maps to ${need.parameterId}, which does not exist.` });
      continue;
    }
    const model = parameter.quantificationModel;
    if (model !== undefined && !modelsForNeed(need).includes(model)) {
      const allowed = modelsForNeed(need).map((candidate) => modelSpecOf(candidate)?.label.toLowerCase() ?? candidate);
      findings.push({ severity: "error", check: "Model does not fit", item, detail: allowed.length === 0 ? `${parameter.uuid} uses ${modelSpecOf(model)?.label.toLowerCase() ?? model}, but this event has no event type.` : `This event needs ${allowed.join(" or ")}, but ${parameter.uuid} uses ${modelSpecOf(model)?.label.toLowerCase() ?? model}.`, target: { kind: "daParameter", id: parameter.uuid } });
    }
    const differs = model === "MISSION_PROBABILITY" ? missionTimeDiffers(missionModelTime(parameter.estimate), need.missionTime) : undefined;
    if (differs !== undefined) {
      findings.push({ severity: "error", check: "Mission time differs", item, detail: `This event runs ${differs.need}, but the estimate of ${parameter.uuid} is for ${differs.estimate}. Correct the event's mission time in Step 02, link the estimate to the same mission time, or split the parameter.`, target: { kind: "daParameter", id: parameter.uuid } });
    }
    const covered = parameterStates(parameter);
    const uncovered = need.stateIds.filter((state) => !covered.includes(state));
    if (uncovered.length > 0) {
      findings.push({ severity: "error", check: "States not covered", item, detail: `This event applies in ${uncovered.join(", ")}, which ${parameter.uuid} does not cover (DA-A2).`, target: { kind: "daParameter", id: parameter.uuid } });
    }
    const comparable = need.element !== "SY" || (need.valueUnit === "PER_HOUR") === (model === "RUNNING_RATE" || model === "STANDBY_RATE");
    const unit = componentUnit(parameter);
    const theirs = lawParameter(parameter) ? (need.expression === undefined || unit === undefined ? undefined : readyNumber(pointState(linkedEstimate(need.expression, unit), unit))) : need.value;
    const ours = readyNumber(parameterPoint(parameter));
    if (need.ownerTyped && theirs !== undefined && parameter.valueMode !== "LINKED" && ours !== undefined && comparable && !sameValue(theirs, ours)) {
      findings.push({ severity: "warning", check: "Values differ", item, detail: `${NEED_ELEMENT_LABELS[need.element]} holds ${Number(theirs.toPrecision(4))}, but ${parameter.uuid} holds ${Number(ours.toPrecision(4))}. Link the parameter to the ${NEED_ELEMENT_LABELS[need.element]} value, or settle on one value.`, target: { kind: "daParameter", id: parameter.uuid } });
    }
  }
  for (const parameter of da.parameters) {
    const target = { kind: "daParameter" as const, id: parameter.uuid };
    const item = parameter.uuid;
    const mapped = needs.filter((need) => need.parameterId === parameter.uuid);
    const model = parameter.quantificationModel;
    if (model === undefined) findings.push({ severity: "error", check: "No model", item, detail: "Set the quantification model.", target });
    if (model === "MISSION_PROBABILITY" && parameter.valueMode !== "CALCULATED" && parameter.estimate !== undefined && missionModelTime(parameter.estimate) === undefined && !mapped.some((need) => need.missionTime !== undefined)) findings.push({ severity: "error", check: "No mission time", item, detail: "Enter the mission time this probability covers.", target });
    if (mapped.length === 0) findings.push({ severity: "warning", check: "Not used", item, detail: "No event maps to this parameter.", target });
    const link = parameter.valueMode === "LINKED" ? parameter.valueLink : undefined;
    const linkedNeed = link === undefined ? undefined : needs.find((need) => need.element === link.element && need.id === link.needId && need.parameterId === parameter.uuid);
    if (parameter.valueMode === "LINKED") {
      if (linkedNeed === undefined) findings.push({ severity: "error", check: "Link broken", item, detail: "The linked event no longer maps to this parameter. Link another event or type the value.", target });
      else if (linkedNeed.value === undefined && linkedNeed.expression === undefined) findings.push({ severity: "error", check: "Link broken", item, detail: "The linked event no longer holds a value. Type the value instead.", target });
    }
    const component = lawParameter(parameter);
    const value = component ? undefined : parameter.value;
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || (model !== undefined && PROBABILITY_MODELS_SET.has(model) && value > 1))) {
      findings.push({ severity: "error", check: "Out of range", item, detail: model !== undefined && PROBABILITY_MODELS_SET.has(model) ? "A probability must lie between 0 and 1." : "The value cannot be negative.", target });
    }
    const range = component && parameter.estimate !== undefined ? rangeFinding(parameter.estimate) : undefined;
    if (range !== undefined) findings.push({ ...range, item, target });
    if ((component ? parameter.estimate === undefined : value === undefined) && parameter.valueMode !== "LINKED") findings.push({ severity: "note", check: "Not estimated", item, detail: "This parameter has no value yet.", target });
    const states = parameterStates(parameter);
    const statesOwned = linkedNeed !== undefined && linkedNeed.stateIds.length > 0;
    if (!statesOwned && states.length > 1 && blank(parameter.multiPosApplicabilityJustification)) findings.push({ severity: "error", check: "States without a reason", item, detail: "Give the reason this value holds in each of its operating states (DA-C25).", target });
    const strayStates = stateIds.size === 0 ? [] : states.filter((state) => !stateIds.has(state));
    if (strayStates.length > 0) findings.push({ severity: "warning", check: "Unknown state", item, detail: `${strayStates.join(", ")} ${strayStates.length === 1 ? "is" : "are"} not among the operating states.`, target });
    if (model !== undefined && COMPONENT_MODELS.has(model) && parameter.componentBoundaryRef === undefined) findings.push({ severity: "warning", check: "No boundary", item, detail: "Set the component boundary (DA-A2).", target });
    if (parameter.componentBoundaryRef !== undefined && !boundaries.has(parameter.componentBoundaryRef)) findings.push({ severity: "error", check: "Boundary missing", item, detail: `Boundary ${parameter.componentBoundaryRef} does not exist.`, target });
    if (parameter.failureModeRef !== undefined && !modes.has(parameter.failureModeRef)) findings.push({ severity: "error", check: "Failure mode missing", item, detail: `Failure mode ${parameter.failureModeRef} does not exist.`, target });
    if (parameter.componentGroupRef !== undefined && !groups.has(parameter.componentGroupRef)) findings.push({ severity: "error", check: "Group missing", item, detail: `Group ${parameter.componentGroupRef} does not exist.`, target });
  }
  for (const boundary of da.componentBoundaries) {
    const target = { kind: "daBoundary" as const, id: boundary.uuid };
    if (boundary.includedItems.length === 0) findings.push({ severity: "warning", check: "Nothing included", item: boundary.uuid, detail: "List the parts inside the boundary.", target });
    if (blank(boundary.boundaryBasis)) findings.push({ severity: "warning", check: "No basis", item: boundary.uuid, detail: "Say why the boundary is drawn here.", target });
  }
  for (const group of da.componentGroupings ?? []) {
    const target = { kind: "daGroup" as const, id: group.uuid };
    if (da.capabilityCategory === "CC-II" && group.groupingBasis === "TYPE_ONLY") findings.push({ severity: "warning", check: "Type only", item: group.uuid, detail: "Capability Category II groups by type and service conditions (DA-B1).", target });
    if (blank(group.groupingJustification)) findings.push({ severity: "warning", check: "No justification", item: group.uuid, detail: "Say why these components form one population.", target });
    if (group.componentIds.length < 2) findings.push({ severity: "warning", check: "Too few members", item: group.uuid, detail: "A population needs at least two components.", target });
  }
  for (const outlier of da.outlierComponents ?? []) {
    const target = { kind: "daOutlier" as const, id: outlier.uuid };
    if (blank(outlier.exclusionReason)) findings.push({ severity: "error", check: "No reason", item: outlier.uuid, detail: "Give the reason this component is held out (DA-B2).", target });
    if (blank(outlier.alternativeHandling)) findings.push({ severity: "warning", check: "No handling", item: outlier.uuid, detail: "Say how the outlier is treated instead.", target });
  }
  return findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => FINDING_RANK[a.finding.severity] - FINDING_RANK[b.finding.severity] || a.index - b.index)
    .map(({ finding }) => finding);
}

function withOutlierGroup(da: DataAnalysis, outlierId: string, groupId: string | undefined): DataAnalysis {
  const groups = da.componentGroupings;
  if (groups === undefined) return da;
  let changed = false;
  const next = groups.map((group) => {
    const held = group.excludedOutliers ?? [];
    const kept = held.filter((id) => id !== outlierId);
    const wanted = group.uuid === groupId ? [...kept, outlierId] : kept;
    if (wanted.length === held.length && wanted.every((id, index) => id === held[index])) return group;
    changed = true;
    return { ...group, excludedOutliers: wanted };
  });
  return changed ? { ...da, componentGroupings: next } : da;
}

function parametersComplete(da: DataAnalysis): boolean {
  return da.parameters.length > 0 && da.dataNeeds !== undefined && !parameterFindings(da).some((finding) => finding.severity === "error");
}

function filterConformance(da: DataAnalysis, ccId: string, stage: Stage): ConformanceItem[] {
  const stageKey = stage === "operational" ? "operational" : "pre_operational";
  const statusBySr = new Map<string, string>();
  for (const entry of da.conformanceMatrix) {
    const ccUpper = ccId.replace("cc-", "").toUpperCase();
    if (entry.capabilityCategory === `CC-${ccUpper}`) statusBySr.set(entry.sr, entry.status);
  }
  const outOfScope = excludedScopeSrs(da);
  return CONFORMANCE_ITEMS.filter((it) => it.requiredAt.includes(ccId)).map((it) => {
    if (!it.stages.includes(stageKey)) return { ...it, status: "na" as const, meta: "Not applicable to current plant stage" };
    const scopeNote = outOfScope.get(it.id);
    if (scopeNote !== undefined) return { ...it, status: "na" as const, meta: scopeNote };
    const matrixStatus = statusBySr.get(it.id);
    if (matrixStatus === "MET") return { ...it, status: "ok" as const };
    if (matrixStatus === "NOT_MET") return { ...it, status: "blocked" as const };
    if (matrixStatus === "NOT_APPLICABLE") return { ...it, status: "na" as const };
    if (matrixStatus === "PARTIAL") return { ...it, status: "warn" as const };
    return { ...it, status: "warn" as const };
  });
}

function groupBySection(items: ConformanceItem[]): [string, ConformanceItem[]][] {
  const sections = new Map<string, ConformanceItem[]>();
  for (const it of items) {
    const list = sections.get(it.section) ?? [];
    list.push(it);
    sections.set(it.section, list);
  }
  return Array.from(sections.entries());
}

function ccScore(da: DataAnalysis, ccId: string, stage: Stage): CcScore {
  const items = filterConformance(da, ccId, stage);
  const total = items.length;
  const na = items.filter((it) => it.status === "na").length;
  const met = items.filter((it) => it.status === "ok").length;
  const warn = items.filter((it) => it.status === "warn").length;
  const blocked = items.filter((it) => it.status === "blocked").length;
  const applicable = total - na;
  const ready = met + na;
  const percent = total === 0 ? 0 : Math.round((ready / total) * 100);
  return { applicable, met, warn, blocked, na, ready, total, percent };
}

function commentsView(da: DataAnalysis, now: Date = new Date()): CommentView[] {
  const reviewers = da.metadata.reviewers;
  return da.internalReviewComments.comments.map((c) => {
    const author = reviewers.find((r) => r.id === c.authorId);
    const item = c.associatedSr !== undefined ? CONFORMANCE_ITEMS.find((it) => it.id === c.associatedSr) : undefined;
    return {
      id: c.uuid,
      authorId: c.authorId,
      authorName: author?.name ?? c.authorId,
      authorInitials: initialsOf(author?.name ?? c.authorId),
      authorTitle: author?.title,
      when: relativeFrom(c.createdAt, now),
      createdAt: c.createdAt,
      associatedSr: c.associatedSr,
      section: item?.section ?? "Document (HLR-E)",
      targetLabel: item?.text ?? "General",
      text: c.text,
      severity: c.severity ?? "OBSERVATION",
      resolved: c.resolved,
      resolution: c.resolution,
    };
  });
}

function stepsForPersona(persona: DaPersona): DaStep[] {
  const ids = DA_PERSONA_STEPS[persona];
  return DA_STEPS.filter((s) => ids.includes(s.id));
}

function stepsFromMef(da: DataAnalysis, persona: DaPersona, handoffDone = false): DaStep[] {
  const base = stepsForPersona(persona);
  const scopeComplete = scopeItemsToComplete(da).length === 0;
  const needsDone = needsComplete(da);
  const parametersDone = parametersComplete(da);
  const genericComplete = sourcesComplete(da);
  const countsComplete = failuresComplete(da);
  const unavailComplete = unavailabilityComplete(da);
  const commonCauseComplete = ccfComplete(da);
  const initiatorsComplete = frequenciesComplete(da);
  const uncertComplete = uncertaintyComplete(da);
  const draftComplete = da.workflowState !== "DRAFT" && da.workflowState !== "REVISION_REQUIRED";
  const reviewComplete = da.workflowState === "FINAL";

  function status(complete: boolean): "complete" | "idle" {
    return complete ? "complete" : "idle";
  }

  return base.map((s) => {
    switch (s.id) {
      case "scope": return { ...s, status: status(scopeComplete) };
      case "needs": return { ...s, status: status(needsDone) };
      case "define": return { ...s, status: status(parametersDone) };
      case "generic": return { ...s, status: status(genericComplete) };
      case "counts": return { ...s, status: status(countsComplete) };
      case "unavail": return { ...s, status: status(unavailComplete) };
      case "ccf": return { ...s, status: status(commonCauseComplete) };
      case "ie": return { ...s, status: status(initiatorsComplete) };
      case "uncert": return { ...s, status: status(uncertComplete) };
      case "handoff": return { ...s, status: status(handoffDone) };
      case "draft": return { ...s, status: status(draftComplete) };
      case "review": return { ...s, status: status(reviewComplete) };
      default: return { ...s, status: "idle" as const };
    }
  });
}

export {
  COMPONENT_MODELS,
  defaultModelFor,
  linkedEstimate,
  linkedParameter,
  mappableNeeds,
  modelSpecOf,
  modelsForNeed,
  parameterFindings,
  parameterNeeds,
  parameterStates,
  parameterValueText,
  withModel,
  withNeedParameter,
  withOutlierGroup,
  nextParameterId,
  type DaMapElement,
  type DaMappableNeed,
  NEED_ELEMENTS,
  basicEventEdited,
  daNeedChecks,
  daNeedsLinked,
  emptyNeeds,
  needChangeOf,
  needManualCount,
  nextNeedId,
  stateShares,
  typedNeedCount,
  withLinkChanged,
  withNeeds,
  type DaFindingSeverity,
  type DaNeedFinding,
  type DaNeedWindowKind,
  scopeDecisionOf,
  scopeItemsToComplete,
  filterConformance,
  groupBySection,
  ccScore,
  commentsView,
  stepsForPersona,
  stepsFromMef,
  initialsOf,
  type CommentView,
  type CcScore,
};
