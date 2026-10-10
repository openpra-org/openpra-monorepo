import {
  ESQ_PLAN_DEFAULTS,
  type EsqComparedPlant,
  type EsqConsistencyEntry,
  type EsqConsistencyTopic,
  type EsqCutSetList,
  type EsqCutSetReview,
  type EsqImportanceKind,
  type EsqImportanceRecord,
  type EsqImportanceSignificant,
  type EsqModel,
  type EsqPlantComparison,
  type EsqReviewWork,
  type EsqScreenedBound,
  type EsqSolveRun,
  type EsqThresholds,
  type EventSequenceQuantification,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import { ScreeningStatus } from "interfaces-mef-types/core/shared-patterns";
import { PUBLISHED_RI_CRITERIA, type RiskIntegration } from "interfaces-mef-types/ri/risk-integration";
import type { InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import { solveInputsKey, solveWorkOf } from "interfaces-mef-types/esq/esq-solve-inputs";
import { treesInScope } from "interfaces-mef-types/esq/esq-run-inputs";
import type {
  EsqEventTreeRunLogic,
  EsqImportanceRunResult,
  EsqImportanceTarget,
  EsqModelRunResult,
  EventTreeCutSetSettings,
} from "interfaces-shared-types/newly-developed-methods/event-tree";
import { importanceGroupsOf } from "interfaces-mef-types/esq/esq-measure-inputs";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { meanFrequencyValue } from "../workbooks/riskWorkbookConnections";
import { modelViewOf, type EsqFamilyView, type EsqFindingSeverity } from "./esqModel";
import { familyValueOf, type EsqSolveWindowKind } from "./esqSolve";

type EsqResultsWindowKind =
  | "esqResultsCutSet"
  | "esqResultsConsistency"
  | "esqResultsComparison"
  | "esqResultsTarget"
  | "esqResultsThresholds"
  | "esqResultsScreened"
  | "esqResultsSilent";

interface EsqResultsFinding {
  severity: EsqFindingSeverity;
  check: string;
  item: string;
  detail: string;
  target?: { kind: EsqResultsWindowKind | EsqSolveWindowKind; id: string };
}

interface EsqThresholdView {
  fussellVesely: number;
  riskAchievementWorth: number;
  aggregatePercent: number;
  individualPercent: number;
  source: string;
  typed: boolean;
}

interface EsqMeasureRow {
  target: EsqImportanceTarget;
  base: number;
  decrease: number;
  increase: number;
  fussellVesely: number;
  riskAchievementWorth: number;
  riskReductionWorth: number;
  birnbaum: number;
  significant: boolean;
}

interface EsqCutSetRow {
  key: string;
  familyId: string;
  treeId: string;
  eventIds: string[];
  codes: string[];
  annualFrequency: number;
  share: number;
  cumulative: number;
  significant: boolean;
  review?: EsqCutSetReview;
}

type EsqContributorKind = "SEQUENCE" | "STATE" | "INITIATOR" | "SOURCE" | "PARAMETER" | "CCF_GROUP" | "HFE" | "SYSTEM" | "BARRIER" | "EVENT";

interface EsqContributorRow {
  key: string;
  kind: EsqContributorKind;
  label: string;
  annualFrequency: number;
  fraction: number;
}

interface EsqScreenedRow {
  groupId: string;
  name: string;
  origin: "IE" | "SCOPE";
  criterion?: string;
  ieBasis?: string;
  ieFrequency?: number;
  ieExpression?: UncertainExpression;
  bound?: EsqScreenedBound;
  frequency?: number;
  bounding?: number;
  familyValue?: number;
  scr1?: boolean;
  scr2?: boolean;
}

interface EsqConsistencyRow {
  topic: EsqConsistencyTopic;
  entry?: EsqConsistencyEntry;
}

interface EsqResultsView {
  model: EsqModel;
  work: EsqReviewWork;
  run?: EsqSolveRun;
  runStale: boolean;
  families: EsqFamilyView[];
  releaseIds: string[];
  values: Map<string, number>;
  total: number;
  thresholds: EsqThresholdView;
  importance?: EsqImportanceRecord;
  importanceStale: boolean;
  thresholdsChanged: boolean;
  cutSetRunId?: string;
  cutSetListStale: boolean;
  consistency: EsqConsistencyRow[];
  screened: EsqScreenedRow[];
  screenedTotal: number;
  floor: number;
  findings: EsqResultsFinding[];
}

const FINDING_RANK: Record<EsqFindingSeverity, number> = { error: 0, warning: 1, note: 2 };

const CONSISTENCY_TOPICS: readonly EsqConsistencyTopic[] = ["SYSTEMS", "SUCCESS_CRITERIA", "PROCEDURES", "RULES"];

const CONSISTENCY_LABELS: Record<EsqConsistencyTopic, string> = {
  SYSTEMS: "System models",
  SUCCESS_CRITERIA: "Success criteria",
  PROCEDURES: "Procedures and operations",
  RULES: "Flags, exclusions and recovery",
};

const CONSISTENCY_SRS: Record<EsqConsistencyTopic, string> = {
  SYSTEMS: "ESQ-D2",
  SUCCESS_CRITERIA: "ESQ-D2",
  PROCEDURES: "ESQ-D2",
  RULES: "ESQ-D3",
};

const CONTRIBUTOR_LABELS: Record<EsqContributorKind, string> = {
  SEQUENCE: "Sequence",
  STATE: "Operating state",
  INITIATOR: "Initiator",
  SOURCE: "Source",
  PARAMETER: "DA parameter",
  CCF_GROUP: "Common cause group",
  HFE: "Human failure event",
  SYSTEM: "System",
  BARRIER: "Barrier failure mode",
  EVENT: "Basic event",
};

const IMPORTANCE_KIND_LABELS: Record<EsqImportanceKind, string> = {
  EVENT: "Event",
  PARAMETER: "DA parameter",
  HFE: "HFE",
  CCF_GROUP: "CCF group",
  SYSTEM: "System",
};

const CUT_SET_KEEP = 100;

const SCREENED_TOTAL_PERCENT = 5;

const NOISE_FLOOR = 1e-12;

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function reviewOf(esq: EventSequenceQuantification): EsqReviewWork {
  return esq.review ?? {};
}

function withReview(esq: EventSequenceQuantification, fn: (work: EsqReviewWork) => EsqReviewWork): EventSequenceQuantification {
  return { ...esq, review: fn(reviewOf(esq)) };
}

function fourDigits(value: number): string {
  if (!Number.isFinite(value)) return value > 0 ? "∞" : "—";
  if (value === 0) return "0";
  const size = Math.abs(value);
  if (size >= 1e-3 && size < 1e5) return String(Number(value.toPrecision(4)));
  const [mantissa, exponent] = value.toExponential(3).split("e");
  return `${String(Number(mantissa))}E${Number(exponent)}`;
}

function runLogicOf(run: EsqSolveRun): EsqEventTreeRunLogic {
  const logic: EsqEventTreeRunLogic = { flags: run.logic.flags, loopBreaks: run.logic.loopBreaks, exclusions: run.logic.exclusions, expandCcf: run.logic.expandCcf };
  if (run.logic.recovery !== undefined) logic.recovery = run.logic.recovery;
  if (run.logic.dependency !== undefined) logic.dependency = run.logic.dependency;
  return logic;
}

function targetLabel(esq: EventSequenceQuantification, id: string): string {
  const known = reviewOf(esq).importance?.significant.find((entry) => entry.id === id);
  if (known !== undefined) return known.label;
  if (id.startsWith("EVENT:")) {
    const eventId = id.slice("EVENT:".length);
    const event = esq.model?.events.find((candidate) => candidate.id === eventId);
    return event === undefined ? eventId : event.code;
  }
  return importanceGroupsOf(esq).find((group) => group.key === id)?.label ?? id;
}

function thresholdsOf(esq: EventSequenceQuantification, ri: RiskIntegration | undefined): EsqThresholdView {
  const relative = ri?.criteriaSet?.relative ?? PUBLISHED_RI_CRITERIA.relative;
  const typed = reviewOf(esq).thresholds;
  return {
    fussellVesely: typed?.fussellVesely ?? relative.fussellVesely.value,
    riskAchievementWorth: typed?.riskAchievementWorth ?? relative.riskAchievementWorth.value,
    aggregatePercent: relative.aggregatePercent.value,
    individualPercent: relative.individualPercent.value,
    source: typed?.source ?? (ri?.criteriaSet === undefined ? "NEI 18-04 Rev. 1, the published RI default" : "RI criteria set"),
    typed: typed !== undefined,
  };
}

function releaseFamilyIds(families: readonly EsqFamilyView[]): string[] {
  return families.filter((family) => family.release).map((family) => family.id);
}

function familyValues(esq: EventSequenceQuantification): Map<string, number> {
  const values = new Map<string, number>();
  for (const entry of solveWorkOf(esq).families) {
    const value = familyValueOf(entry);
    if (value !== undefined) values.set(entry.familyId, value);
  }
  return values;
}

function measureRow(target: EsqImportanceTarget, familyIds: ReadonlySet<string>, base: number, thresholds: Pick<EsqThresholdView, "fussellVesely" | "riskAchievementWorth">): EsqMeasureRow {
  let decrease = 0;
  let increase = 0;
  for (const change of target.changes) {
    if (!familyIds.has(change.familyId)) continue;
    decrease += change.decrease;
    increase += change.increase;
  }
  if (Math.abs(decrease) <= NOISE_FLOOR * base) decrease = 0;
  if (Math.abs(increase) <= NOISE_FLOOR * base) increase = 0;
  const fussellVesely = base > 0 ? decrease / base : 0;
  const riskAchievementWorth = base > 0 ? (base + increase) / base : 1;
  const remaining = base - decrease;
  const riskReductionWorth = base > 0 ? (remaining > base * 1e-15 ? base / remaining : Number.POSITIVE_INFINITY) : 1;
  return {
    target,
    base,
    decrease,
    increase,
    fussellVesely,
    riskAchievementWorth,
    riskReductionWorth,
    birnbaum: decrease + increase,
    significant: fussellVesely > thresholds.fussellVesely || riskAchievementWorth > thresholds.riskAchievementWorth,
  };
}

function measureRows(result: EsqImportanceRunResult, familyIds: readonly string[], thresholds: Pick<EsqThresholdView, "fussellVesely" | "riskAchievementWorth">): EsqMeasureRow[] {
  const ids = new Set(familyIds);
  const base = result.families.filter((family) => ids.has(family.familyId)).reduce((sum, family) => sum + family.base, 0);
  return result.targets
    .map((target) => measureRow(target, ids, base, thresholds))
    .sort((a, b) => b.fussellVesely - a.fussellVesely || b.riskAchievementWorth - a.riskAchievementWorth || a.target.label.localeCompare(b.target.label));
}

function importanceRecordOf(result: EsqImportanceRunResult, esq: EventSequenceQuantification, thresholds: Pick<EsqThresholdView, "fussellVesely" | "riskAchievementWorth">): EsqImportanceRecord {
  const families = modelViewOf(esq)?.families ?? [];
  const release = releaseFamilyIds(families);
  const scopes = [release, ...release.map((id) => [id])];
  const best = new Map<string, EsqImportanceSignificant>();
  for (const scope of scopes) {
    for (const row of measureRows(result, scope, thresholds)) {
      if (!row.significant) continue;
      const known = best.get(row.target.id);
      const entry: EsqImportanceSignificant = {
        id: row.target.id,
        kind: row.target.kind,
        label: row.target.label,
        fussellVesely: Math.max(known?.fussellVesely ?? Number.NEGATIVE_INFINITY, row.fussellVesely),
        riskAchievementWorth: Math.max(known?.riskAchievementWorth ?? Number.NEGATIVE_INFINITY, row.riskAchievementWorth),
      };
      if (row.target.ref !== null) entry.ref = row.target.ref;
      best.set(row.target.id, entry);
    }
  }
  const ids = new Set(release);
  return {
    runId: result.runId,
    revision: result.owner.workbookRevision,
    at: result.completedAt,
    inputs: result.inputs,
    logic: { ...result.logic },
    base: result.families.filter((family) => ids.has(family.familyId)).reduce((sum, family) => sum + family.base, 0),
    significant: [...best.values()],
    silentEventIds: [...result.silentEventIds],
    thresholds: { fussellVesely: thresholds.fussellVesely, riskAchievementWorth: thresholds.riskAchievementWorth },
  };
}

function cutSetKey(familyId: string, treeId: string, eventIds: readonly string[]): string {
  return `${familyId}|${treeId}|${[...eventIds].sort().join("+")}`;
}

function cutSetRows(summary: EsqModelRunResult, familyId: string, familyValue: number, work: EsqReviewWork, thresholds: Pick<EsqThresholdView, "aggregatePercent" | "individualPercent">, codeOf: (id: string) => string): EsqCutSetRow[] {
  const family = summary.families.find((entry) => entry.familyId === familyId);
  if (family === undefined) return [];
  const total = familyValue > 0 ? familyValue : family.annualFrequency;
  let running = 0;
  return family.cutSets.map((cutSet) => {
    const share = total > 0 ? cutSet.annualFrequency / total : 0;
    const before = running;
    running += share;
    const key = cutSetKey(familyId, cutSet.treeId, cutSet.basicEventIds);
    const row: EsqCutSetRow = {
      key,
      familyId,
      treeId: cutSet.treeId,
      eventIds: [...cutSet.basicEventIds],
      codes: cutSet.basicEventIds.map(codeOf),
      annualFrequency: cutSet.annualFrequency,
      share,
      cumulative: running,
      significant: 100 * share >= thresholds.individualPercent || 100 * before < thresholds.aggregatePercent,
    };
    const review = work.cutSetReviews?.find((entry) => entry.key === key);
    if (review !== undefined) row.review = review;
    return row;
  });
}

function cutSetRunIdOf(esq: EventSequenceQuantification): string | undefined {
  const run = solveWorkOf(esq).run;
  if (run?.calculation === "CUT_SETS") return run.runId;
  return reviewOf(esq).cutSetList?.runId;
}

function cutSetListRequest(run: EsqSolveRun, cutOff: number): EventTreeCutSetSettings {
  const settings: EventTreeCutSetSettings = { basis: "FREQUENCY", cutOffs: [cutOff], quantifier: run.quantifier ?? "MCUB", keep: CUT_SET_KEEP };
  if (run.limitOrder !== undefined) settings.limitOrder = run.limitOrder;
  return settings;
}

function withCutSetList(esq: EventSequenceQuantification, summary: EsqModelRunResult, cutOff: number): EventSequenceQuantification {
  const list: EsqCutSetList = { runId: summary.runId, at: summary.completedAt, inputs: summary.inputs, cutOff };
  return withReview(esq, (work) => ({ ...work, cutSetList: list }));
}

function withCutSetReview(esq: EventSequenceQuantification, row: EsqCutSetRow, change: { verdict?: "CORRECT" | "ISSUE"; note?: string }): EventSequenceQuantification {
  return withReview(esq, (work) => {
    const list = work.cutSetReviews ?? [];
    const prior = list.find((entry) => entry.key === row.key);
    const base: EsqCutSetReview = prior ?? { key: row.key, familyId: row.familyId, treeId: row.treeId, eventIds: [...row.eventIds], annualFrequency: row.annualFrequency, significant: row.significant, note: "" };
    const next: EsqCutSetReview = { ...base, annualFrequency: row.annualFrequency, significant: row.significant, note: change.note ?? base.note };
    if ("verdict" in change) {
      if (change.verdict === undefined) delete next.verdict;
      else next.verdict = change.verdict;
    }
    const index = list.findIndex((entry) => entry.key === row.key);
    return { ...work, cutSetReviews: index < 0 ? [...list, next] : list.map((entry, position) => (position === index ? next : entry)) };
  });
}

function contributorRows(input: {
  esq: EventSequenceQuantification;
  familyIds: readonly string[];
  summary?: EsqModelRunResult;
  importance?: EsqImportanceRunResult;
}): EsqContributorRow[] {
  const { esq } = input;
  const model = esq.model;
  if (model === undefined) return [];
  const ids = new Set(input.familyIds);
  const values = familyValues(esq);
  const total = input.familyIds.reduce((sum, id) => sum + (values.get(id) ?? 0), 0);
  const rows = new Map<string, EsqContributorRow>();
  const add = (kind: EsqContributorKind, id: string, label: string, frequency: number): void => {
    const key = `${kind}:${id}`;
    const row = rows.get(key) ?? { key, kind, label, annualFrequency: 0, fraction: 0 };
    row.annualFrequency += frequency;
    row.fraction = total > 0 ? row.annualFrequency / total : 0;
    rows.set(key, row);
  };
  const trees = new Map(model.trees.map((tree) => [tree.id, tree]));
  const states = new Map(model.states.map((state) => [state.id, state.name]));
  const initiators = new Map(model.initiators.map((initiator) => [initiator.id, initiator.name]));
  const records = new Map(model.sequences.map((record) => [record.id, record]));
  for (const sequence of input.summary?.sequences ?? []) {
    if (sequence.familyId === null || !ids.has(sequence.familyId) || !(sequence.annualFrequency > 0)) continue;
    const finalId = sequence.sequenceIds[sequence.sequenceIds.length - 1] ?? "";
    const record = records.get(finalId);
    const tree = trees.get(sequence.treeId);
    add("SEQUENCE", `${sequence.treeId}:${finalId}`, `${tree?.code ?? sequence.treeId} · ${record?.code ?? finalId}`, sequence.annualFrequency);
    if (tree !== undefined) add("INITIATOR", tree.initiatorId, `${initiators.get(tree.initiatorId) ?? tree.initiatorId} (${tree.initiatorId})`, sequence.annualFrequency);
    if (tree?.stateId !== undefined) add("STATE", tree.stateId, `${states.get(tree.stateId) ?? tree.stateId} (${tree.stateId})`, sequence.annualFrequency);
    for (const source of record?.sourceIds ?? []) add("SOURCE", source, source, sequence.annualFrequency);
  }
  const result = input.importance;
  if (result !== undefined) {
    const base = result.families.filter((family) => ids.has(family.familyId)).reduce((sum, family) => sum + family.base, 0);
    for (const target of result.targets) {
      const row = measureRow(target, ids, base, { fussellVesely: 1, riskAchievementWorth: Number.POSITIVE_INFINITY });
      if (!(row.fussellVesely > 0)) continue;
      const kind: EsqContributorKind = target.kind === "PARAMETER" ? "PARAMETER"
        : target.kind === "CCF_GROUP" ? "CCF_GROUP"
        : target.kind === "HFE" ? "HFE"
        : target.kind === "SYSTEM" ? "SYSTEM"
        : target.role === "SPLIT" && target.ref?.startsWith("CELL:") === true ? "BARRIER"
        : "EVENT";
      if (kind === "EVENT" && target.role === "CCF_TERM") continue;
      const key = `${kind}:${target.id}`;
      rows.set(key, { key, kind, label: target.label, annualFrequency: row.fussellVesely * total, fraction: row.fussellVesely });
    }
  }
  return [...rows.values()].sort((a, b) => b.fraction - a.fraction || a.label.localeCompare(b.label));
}

function screenedRows(esq: EventSequenceQuantification, ie: InitiatingEventsAnalysis | undefined, values: ReadonlyMap<string, number>, floor: number, total: number, individualPercent: number): EsqScreenedRow[] {
  const work = reviewOf(esq);
  const rows = new Map<string, EsqScreenedRow>();
  const model = esq.model;
  const quantified = new Set(model === undefined ? [] : treesInScope(esq, model).map((tree) => tree.initiatorId));
  for (const initiator of ie?.initiators ?? []) {
    if (initiator.screeningStatus !== ScreeningStatus.SCREENED_OUT || quantified.has(initiator.uuid)) continue;
    const row: EsqScreenedRow = { groupId: initiator.uuid, name: initiator.name, origin: "IE", ieFrequency: meanFrequencyValue(initiator.frequency) };
    const criterion = initiator.screeningCriterion ?? undefined;
    if (criterion !== undefined) row.criterion = criterion;
    if (!blank(initiator.screeningBasis)) row.ieBasis = initiator.screeningBasis;
    rows.set(initiator.uuid, row);
  }
  for (const exclusion of esq.modelIntegration.scopeExclusions ?? []) {
    if (exclusion.aspect !== "INITIATOR_GROUP" || rows.has(exclusion.item)) continue;
    const record = esq.model?.initiators.find((initiator) => initiator.id === exclusion.item);
    const group = ie?.initiatingEventGroups.find((candidate) => candidate.uuid === exclusion.item);
    const row: EsqScreenedRow = { groupId: exclusion.item, name: record?.name ?? group?.name ?? exclusion.item, origin: "SCOPE" };
    const expression = record?.frequency?.expression ?? group?.frequency?.expression;
    if (expression !== undefined) row.ieExpression = expression;
    if (!blank(exclusion.reason)) row.ieBasis = exclusion.reason;
    rows.set(exclusion.item, row);
  }
  for (const bound of work.screened ?? []) {
    const row = rows.get(bound.groupId);
    if (row === undefined) continue;
    row.bound = bound;
  }
  return [...rows.values()].map((row) => {
    const frequency = row.bound?.frequency ?? row.ieFrequency;
    const conditional = row.bound?.conditional;
    const out: EsqScreenedRow = { ...row };
    if (frequency !== undefined) out.frequency = frequency;
    if (frequency !== undefined && conditional !== undefined) {
      const bounding = frequency * conditional;
      out.bounding = bounding;
      out.scr1 = bounding < floor;
      const familyId = row.bound?.familyId;
      const familyValue = familyId === undefined ? undefined : values.get(familyId);
      if (familyValue !== undefined) out.familyValue = familyValue;
      const reference = familyValue ?? total;
      out.scr2 = reference > 0 && 100 * bounding < individualPercent * reference;
    }
    return out;
  });
}

function withScreenedBound(esq: EventSequenceQuantification, groupId: string, bound: EsqScreenedBound | undefined): EventSequenceQuantification {
  return withReview(esq, (work) => {
    const others = (work.screened ?? []).filter((entry) => entry.groupId !== groupId);
    return { ...work, screened: bound === undefined ? others : [...others, bound] };
  });
}

function withConsistency(esq: EventSequenceQuantification, topic: EsqConsistencyTopic, entry: EsqConsistencyEntry | undefined): EventSequenceQuantification {
  return withReview(esq, (work) => {
    const others = (work.consistency ?? []).filter((item) => item.topic !== topic);
    return { ...work, consistency: entry === undefined ? others : [...others, entry] };
  });
}

function withComparison(esq: EventSequenceQuantification, comparison: EsqPlantComparison | undefined): EventSequenceQuantification {
  return withReview(esq, (work) => {
    const { comparison: _old, ...rest } = work;
    return comparison === undefined ? rest : { ...rest, comparison };
  });
}

function withComparedPlant(esq: EventSequenceQuantification, plant: EsqComparedPlant, remove = false): EventSequenceQuantification {
  const comparison = reviewOf(esq).comparison ?? { possible: true, reason: "", plants: [] };
  const others = comparison.plants.filter((entry) => entry.id !== plant.id);
  const index = comparison.plants.findIndex((entry) => entry.id === plant.id);
  const plants = remove ? others : index < 0 ? [...comparison.plants, plant] : comparison.plants.map((entry) => (entry.id === plant.id ? plant : entry));
  return withComparison(esq, { ...comparison, plants });
}

function nextPlantId(esq: EventSequenceQuantification): string {
  const taken = new Set((reviewOf(esq).comparison?.plants ?? []).map((plant) => plant.id));
  let n = taken.size + 1;
  while (taken.has(`SP-${n}`)) n += 1;
  return `SP-${n}`;
}

function withThresholds(esq: EventSequenceQuantification, thresholds: EsqThresholds | undefined): EventSequenceQuantification {
  return withReview(esq, (work) => {
    const { thresholds: _old, ...rest } = work;
    return thresholds === undefined ? rest : { ...rest, thresholds };
  });
}

function withImportance(esq: EventSequenceQuantification, record: EsqImportanceRecord): EventSequenceQuantification {
  return withReview(esq, (work) => ({ ...work, importance: record }));
}

function withReconciliation(esq: EventSequenceQuantification, targetId: string, note: string): EventSequenceQuantification {
  return withReview(esq, (work) => {
    const others = (work.reconciliations ?? []).filter((entry) => entry.targetId !== targetId);
    return { ...work, reconciliations: note.trim().length === 0 ? others : [...others, { targetId, note }] };
  });
}

function withConfirmation(esq: EventSequenceQuantification, eventId: string, reason: string): EventSequenceQuantification {
  return withReview(esq, (work) => {
    const others = (work.confirmations ?? []).filter((entry) => entry.eventId !== eventId);
    return { ...work, confirmations: reason.trim().length === 0 ? others : [...others, { eventId, reason }] };
  });
}

function importanceProblem(result: EsqImportanceRunResult, esq: EventSequenceQuantification): string | undefined {
  const failed = result.trees.filter((tree) => tree.status === "FAILED").length;
  if (failed > 0) return `${failed} of ${result.trees.length} event trees failed. Fix them and run again.`;
  if (result.inputs !== solveInputsKey(esq)) return "The model, logic or values changed during the run. Run again.";
  return undefined;
}

function sameLogic(left: EsqSolveRun["logic"], right: EsqSolveRun["logic"]): boolean {
  return left.flags === right.flags
    && left.loopBreaks === right.loopBreaks
    && left.exclusions === right.exclusions
    && left.expandCcf === right.expandCcf
    && (left.recovery ?? true) === (right.recovery ?? true)
    && (left.dependency ?? true) === (right.dependency ?? true);
}

function cutSetFindings(view: Omit<EsqResultsView, "findings">): EsqResultsFinding[] {
  const findings: EsqResultsFinding[] = [];
  if (view.run === undefined) return findings;
  if (view.cutSetRunId === undefined) {
    findings.push({ severity: "error", check: "No cut sets to review", item: "Cut sets", detail: "The run of record is exact. List the cut sets of each family in the Cut sets tab to sample them (ESQ-D1)." });
    return findings;
  }
  if (view.cutSetListStale) findings.push({ severity: "error", check: "Cut set list older than its inputs", item: "Cut sets", detail: "The model, logic or values changed after the list. List the cut sets again." });
  const reviews = view.work.cutSetReviews ?? [];
  for (const familyId of view.releaseIds) {
    if (!((view.values.get(familyId) ?? 0) > 0)) continue;
    if (!reviews.some((review) => review.familyId === familyId && review.significant && review.verdict !== undefined)) {
      findings.push({ severity: "error", check: "No significant cut set reviewed", item: familyId, detail: "Review at least one significant cut set of this family and record whether its logic is correct (ESQ-D1)." });
    }
  }
  if (!reviews.some((review) => !review.significant && review.verdict !== undefined)) {
    findings.push({ severity: "warning", check: "No non-significant cut set sampled", item: "Cut sets", detail: "Review a few non-significant cut sets and confirm they are physically meaningful (ESQ-D5)." });
  }
  for (const review of reviews) {
    if (review.verdict === "ISSUE" && blank(review.note)) findings.push({ severity: "error", check: "Issue without a note", item: review.key.split("|")[2] ?? review.key, detail: "Describe what is wrong with the cut set and how it is corrected.", target: { kind: "esqResultsCutSet", id: review.key } });
    if (review.verdict === "ISSUE" && !blank(review.note)) findings.push({ severity: "warning", check: "Cut set marked wrong", item: review.key.split("|")[2] ?? review.key, detail: review.note.trim(), target: { kind: "esqResultsCutSet", id: review.key } });
  }
  return findings;
}

function consistencyFindings(view: Omit<EsqResultsView, "findings">, capabilityCategory: string | undefined): EsqResultsFinding[] {
  const findings: EsqResultsFinding[] = [];
  for (const row of view.consistency) {
    const target = { kind: "esqResultsConsistency" as const, id: row.topic };
    const label = CONSISTENCY_LABELS[row.topic];
    if (row.entry?.consistent === undefined) findings.push({ severity: "error", check: "Consistency not checked", item: label, detail: `Check the results against the ${label.toLowerCase()} and record what you found (${CONSISTENCY_SRS[row.topic]}).`, target });
    else if (!row.entry.consistent && blank(row.entry.note)) findings.push({ severity: "error", check: "Inconsistency without a note", item: label, detail: "Describe the inconsistency and how it is resolved.", target });
    else if (row.entry.consistent && blank(row.entry.note)) findings.push({ severity: "warning", check: "Consistency without a basis", item: label, detail: "Record what was compared and how.", target });
  }
  const comparison = view.work.comparison;
  const target = { kind: "esqResultsComparison" as const, id: "comparison" };
  if (comparison === undefined) findings.push({ severity: "error", check: "Similar plants not addressed", item: "Comparison", detail: "Compare the results with similar plants, or record why no comparison is possible (ESQ-D4, ESQ-N-16).", target });
  else if (!comparison.possible && blank(comparison.reason)) findings.push({ severity: "error", check: "No reason for no comparison", item: "Comparison", detail: "Record why no similar plant can be compared (ESQ-N-16).", target });
  else if (comparison.possible && comparison.plants.length === 0) findings.push({ severity: "error", check: "No plant compared", item: "Comparison", detail: "Add the plants compared with their values.", target });
  else if (comparison.possible && capabilityCategory !== "CC-I") {
    for (const plant of comparison.plants) {
      if (blank(plant.note)) findings.push({ severity: "warning", check: "Difference not explained", item: plant.name.length > 0 ? plant.name : plant.id, detail: "Explain the differences from this plant at CC-II (ESQ-D4).", target });
    }
  }
  return findings;
}

function importanceFindings(view: Omit<EsqResultsView, "findings">): EsqResultsFinding[] {
  const findings: EsqResultsFinding[] = [];
  const record = view.importance;
  if (view.run === undefined) return findings;
  if (record === undefined) {
    findings.push({ severity: "error", check: "Importance not ranked", item: "Importance", detail: "Rank the contributors with PRAXIS to find the risk-significant ones (ESQ-D6)." });
    return findings;
  }
  if (view.importanceStale) findings.push({ severity: "error", check: "Importance older than its inputs", item: "Importance", detail: "The model, logic or values changed after the ranking. Rank again." });
  if (!sameLogic(record.logic, view.run.logic)) findings.push({ severity: "warning", check: "Ranked with other logic", item: "Importance", detail: "The ranking used logic settings that differ from the run of record. Rank again." });
  if (view.thresholdsChanged) findings.push({ severity: "warning", check: "Thresholds changed", item: "Importance", detail: "The significance thresholds changed after the ranking. Apply them in the Importance tab.", target: { kind: "esqResultsThresholds", id: "thresholds" } });
  const reconciled = new Set((view.work.reconciliations ?? []).map((entry) => entry.targetId));
  const unexplained = record.significant.filter((entry) => !reconciled.has(entry.id));
  if (unexplained.length > 0) findings.push({ severity: "note", check: "Significant items without a review note", item: "Importance", detail: `${unexplained.length} of ${record.significant.length} significant items have no note. Record whether each is expected, and reconcile any that is not (ESQ-D7).` });
  const confirmed = new Set((view.work.confirmations ?? []).map((entry) => entry.eventId));
  const codes = new Map(view.model.events.map((event) => [event.id, event.code]));
  for (const eventId of record.silentEventIds) {
    if (confirmed.has(eventId)) continue;
    findings.push({ severity: "warning", check: "Event never in a retained cut set", item: codes.get(eventId) ?? eventId, detail: "The event changes no family when it fails or succeeds. Confirm that its absence is correct.", target: { kind: "esqResultsSilent", id: eventId } });
  }
  return findings;
}

function screenedFindings(view: Omit<EsqResultsView, "findings">): EsqResultsFinding[] {
  const findings: EsqResultsFinding[] = [];
  for (const row of view.screened) {
    const target = { kind: "esqResultsScreened" as const, id: row.groupId };
    const item = `${row.name} (${row.groupId})`;
    if (row.bound === undefined || row.bound.conditional === undefined) {
      findings.push({ severity: "error", check: "Screened initiator without a bound", item, detail: "Give a bounding conditional probability so its family frequency can be bounded (ESQ-D8).", target });
      continue;
    }
    if (row.frequency === undefined) findings.push({ severity: "error", check: "No initiator frequency", item, detail: row.ieExpression === undefined ? "IE gives no frequency. Type one with its source." : "IE gives the group frequency as an estimate. Type the value the bound uses, with its source.", target });
    if (blank(row.bound.basis)) findings.push({ severity: "warning", check: "Bound without a basis", item, detail: "Record where the bounding conditional probability comes from.", target });
    if (row.scr1 === false && row.scr2 === false) findings.push({ severity: "error", check: "Screening not supported", item, detail: "The bound is above the reporting floor and above 1% of the family it would join. Bring it back into the model or refine the bound.", target });
  }
  if (view.screened.length > 0 && view.total > 0 && 100 * view.screenedTotal > SCREENED_TOTAL_PERCENT * view.total) {
    findings.push({ severity: "error", check: "Screened total too large", item: "Screened scope", detail: `The screened initiators together bound ${fourDigits(view.screenedTotal)} per year, more than ${SCREENED_TOTAL_PERCENT}% of the release total (ESQ-D8, SCR-2).` });
  }
  return findings;
}

function resultsViewOf(esq: EventSequenceQuantification, ri?: RiskIntegration, ie?: InitiatingEventsAnalysis): EsqResultsView | undefined {
  const modelView = modelViewOf(esq);
  if (modelView === undefined) return undefined;
  const work = reviewOf(esq);
  const run = solveWorkOf(esq).run;
  const inputs = solveInputsKey(esq);
  const thresholds = thresholdsOf(esq, ri);
  const values = familyValues(esq);
  const releaseIds = releaseFamilyIds(modelView.families);
  const total = releaseIds.reduce((sum, id) => sum + (values.get(id) ?? 0), 0);
  const floor = esq.quantificationPlan?.reportingFloorPerYear?.value ?? ESQ_PLAN_DEFAULTS.reportingFloorPerYear;
  const screened = screenedRows(esq, ie, values, floor, total, thresholds.individualPercent);
  const record = work.importance;
  const listed = run?.calculation === "CUT_SETS" ? undefined : work.cutSetList;
  const base: Omit<EsqResultsView, "findings"> = {
    model: modelView.model,
    work,
    runStale: run !== undefined && run.inputs !== inputs,
    families: modelView.families,
    releaseIds,
    values,
    total,
    thresholds,
    importanceStale: record !== undefined && record.inputs !== inputs,
    thresholdsChanged: record?.thresholds !== undefined && (record.thresholds.fussellVesely !== thresholds.fussellVesely || record.thresholds.riskAchievementWorth !== thresholds.riskAchievementWorth),
    cutSetListStale: listed !== undefined && listed.inputs !== inputs,
    consistency: CONSISTENCY_TOPICS.map((topic) => {
      const entry = work.consistency?.find((item) => item.topic === topic);
      return entry === undefined ? { topic } : { topic, entry };
    }),
    screened,
    screenedTotal: screened.reduce((sum, row) => sum + (row.bounding ?? 0), 0),
    floor,
  };
  const withRun = run === undefined ? base : { ...base, run };
  const withRecord = record === undefined ? withRun : { ...withRun, importance: record };
  const cutSetRunId = cutSetRunIdOf(esq);
  const full = cutSetRunId === undefined ? withRecord : { ...withRecord, cutSetRunId };
  const findings: EsqResultsFinding[] = [];
  if (run === undefined) findings.push({ severity: "error", check: "No run of record", item: "Run of record", detail: "Run the model in Step 05 and use the run. Every review in this step reads it." });
  else if (full.runStale) findings.push({ severity: "error", check: "Run of record older than its inputs", item: "Run of record", detail: "The model, logic or values changed after the run of record. Run the model again in Step 05.", target: { kind: "esqSolveRun", id: "run" } });
  findings.push(...cutSetFindings(full), ...consistencyFindings(full, esq.capabilityCategory), ...importanceFindings(full), ...screenedFindings(full));
  return { ...full, findings: findings.sort((a, b) => FINDING_RANK[a.severity] - FINDING_RANK[b.severity]) };
}

function resultsComplete(esq: EventSequenceQuantification, ri?: RiskIntegration, ie?: InitiatingEventsAnalysis): boolean {
  const view = resultsViewOf(esq, ri, ie);
  return view !== undefined && view.run !== undefined && !view.findings.some((finding) => finding.severity === "error");
}

function daChangedNote(used: number | null | undefined, current: number | undefined): string | undefined {
  if (used === null || used === undefined || current === undefined || used === current) return undefined;
  return `The DA inputs changed since this run. It used DA revision ${String(used)}. Run the model again in Step 05.`;
}

export {
  CONSISTENCY_LABELS,
  CONSISTENCY_SRS,
  CONSISTENCY_TOPICS,
  CONTRIBUTOR_LABELS,
  CUT_SET_KEEP,
  IMPORTANCE_KIND_LABELS,
  SCREENED_TOTAL_PERCENT,
  contributorRows,
  cutSetKey,
  cutSetListRequest,
  cutSetRows,
  cutSetRunIdOf,
  daChangedNote,
  familyValues,
  fourDigits,
  importanceProblem,
  importanceRecordOf,
  measureRow,
  measureRows,
  nextPlantId,
  releaseFamilyIds,
  resultsComplete,
  resultsViewOf,
  reviewOf,
  runLogicOf,
  sameLogic,
  targetLabel,
  thresholdsOf,
  withComparedPlant,
  withComparison,
  withConfirmation,
  withConsistency,
  withCutSetList,
  withCutSetReview,
  withImportance,
  withReconciliation,
  withScreenedBound,
  withThresholds,
  type EsqConsistencyRow,
  type EsqContributorKind,
  type EsqContributorRow,
  type EsqCutSetRow,
  type EsqMeasureRow,
  type EsqResultsFinding,
  type EsqResultsView,
  type EsqResultsWindowKind,
  type EsqScreenedRow,
  type EsqThresholdView,
};
