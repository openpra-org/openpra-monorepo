import {
  PUBLISHED_REPORTING_FLOORS,
  PUBLISHED_RI_CRITERIA,
  type ConsequenceMeasure,
  type ReportingThresholds,
  type RiConsequenceFloor,
  type RiskIntegration,
  type CompiledRiskInput,
  type RiskContributor,
  type RiskMetric,
  type RiApplicationContext,
  type RiCliffEdgeCheck,
  type RiCliffEdgeStatus,
  type RiConsequenceStats,
  type RiFrequencySource,
  type RiFrequencyStats,
  type RiInputConsequence,
  type RiInputFamily,
  type RiInputs,
  type RiInputSequence,
  type RiInputSource,
  type RiInputContributor,
  type RiInputImportance,
  type RiManualEntry,
  type ModelUncertaintySource,
  type ScreenedItemLedgerEntry,
  type RiResolvedAbsoluteCriteria,
  type RiResolvedCriteriaSet,
  type RiCriteriaSet,
  type RiCriterionValue,
  type RiCumulativeTarget,
  type RiCumulativeTargetId,
  type RiFcAnchor,
  type RiMeasureRole,
  type RiRelativeCriteria,
  type RiScopeAspect,
  type RiScopeExclusion,
  type RiStatistic,
} from "interfaces-mef-types/ri/risk-integration";
import { type ParameterDistribution, DistributionType } from "interfaces-mef-types/core/events";
import { type RcMetricReceptor } from "interfaces-mef-types/rc/metrics";
import { EndState } from "interfaces-mef-types/core/events";
import { type EventSequence, type EventSequenceAnalysis, type EventSequenceFamily } from "interfaces-mef-types/es/event-sequence-analysis";
import {
  type EventSequenceFamilyQuantification,
  type EventSequenceQuantification,
  type ImportanceAnalysisRecord,
  type ImportanceMeasureEntry,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import { type Workbook } from "interfaces-shared-types";
import { meanFrequencyValue } from "../workbooks/riskWorkbookConnections";
import { sciText, shareText } from "./riShared";
import { type RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { rcMetricPresets, rcMetricWindowText, rcOrdinal } from "interfaces-shared-types/rc-workbooks/metrics";
import { type RiUpstream } from "./riWorkbookContext";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import { ImportanceLevel, ScreeningStatus } from "interfaces-mef-types/core/shared-patterns";
import {
  CONFORMANCE_ITEMS,
  CUMULATIVE_TARGET_SPECS,
  ELEMENT_CODE_BY_TYPE,
  ELEMENT_NAME_BY_CODE,
  MEASURE_ROLE_SPECS,
  exampleLinkLabel,
  RELATIVE_CRITERIA_SPECS,
  RI_CRITERIA_SPECS,
  RI_HAZARD_GROUPS,
  RI_STEPS,
  RI_PERSONA_STEPS,
  RI_STATISTIC_SHORT,
  type RiAbsoluteNumberKey,
  type RiAbsoluteStatisticKey,
  type RiRelativeKey,
  type RiLinkCode,
  type AppTypeId,
  type ConformanceItem,
  type RiPersona,
  type RiStep,
} from "./riViewData";

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

function appTypeFromMef(ri: RiskIntegration): AppTypeId {
  return applicationContextOf(ri).applicationType === "BASELINE_RISK" ? "baseline_risk" : "fixed_risk_target";
}

function applicationContextOf(ri: RiskIntegration): RiApplicationContext {
  return ri.applicationContext ?? {
    applicationType: ri.riskSignificanceCriteria[0]?.applicationType ?? "FIXED_RISK_TARGET",
    linkedWorkbooks: {},
  };
}

type ScopeState = "included" | "excluded" | "unset";

interface ScopeRowView {
  key: string;
  label: string;
  detail?: string;
  inEsq?: boolean;
  state: ScopeState;
  reason: string;
}

interface ScopeCandidate {
  key: string;
  label: string;
}

function sameItem(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function rowMatches(row: ScopeCandidate, item: string): boolean {
  return sameItem(row.key, item) || sameItem(row.label, item);
}

function includedList(ri: RiskIntegration, aspect: RiScopeAspect): string[] {
  const scope = ri.scopeDefinition;
  if (aspect === "HAZARD_GROUP") return scope.hazardGroups;
  if (aspect === "OPERATING_STATE") return scope.plantOperatingStateRefs;
  if (aspect === "SOURCE") return scope.radioactiveMaterialSources;
  return scope.reactorModules ?? [];
}

function withIncludedList(scope: RiskIntegration["scopeDefinition"], aspect: RiScopeAspect, list: string[]): RiskIntegration["scopeDefinition"] {
  if (aspect === "HAZARD_GROUP") return { ...scope, hazardGroups: list };
  if (aspect === "OPERATING_STATE") return { ...scope, plantOperatingStateRefs: list };
  if (aspect === "SOURCE") return { ...scope, radioactiveMaterialSources: list };
  return { ...scope, reactorModules: list };
}

function upstreamCandidates(upstream: RiUpstream, aspect: RiScopeAspect): ScopeCandidate[] {
  const esqScope = upstream.esq?.modelIntegration?.scopeCoverage;
  const out: ScopeCandidate[] = [];
  function add(key: string, label: string): void {
    if (key.trim().length === 0) return;
    if (out.some((c) => rowMatches(c, key) || rowMatches(c, label))) return;
    out.push({ key, label });
  }
  if (aspect === "HAZARD_GROUP") {
    for (const group of RI_HAZARD_GROUPS) add(group, group);
    for (const review of upstream.pos?.hazardGroupReviews ?? []) add(review.hazardGroup, review.hazardGroup);
    for (const group of esqScope?.hazardGroups ?? []) add(group, group);
  }
  if (aspect === "OPERATING_STATE") {
    for (const state of upstream.pos?.plantOperatingStates ?? []) add(state.uuid, state.name);
    for (const ref of esqScope?.plantOperatingStates ?? []) add(ref, ref);
  }
  if (aspect === "SOURCE") {
    for (const state of upstream.pos?.plantOperatingStates ?? []) {
      for (const source of state.radioactiveMaterialSources) add(source.uuid, source.name);
    }
    for (const ref of esqScope?.radionuclideSources ?? []) add(ref, ref);
  }
  return out;
}

function esqCoverage(upstream: RiUpstream, aspect: RiScopeAspect): string[] | undefined {
  const esqScope = upstream.esq?.modelIntegration?.scopeCoverage;
  if (esqScope === undefined || aspect === "MODULE") return undefined;
  if (aspect === "HAZARD_GROUP") return esqScope.hazardGroups;
  if (aspect === "OPERATING_STATE") return esqScope.plantOperatingStates;
  return esqScope.radionuclideSources;
}

function scopeRowsView(ri: RiskIntegration, upstream: RiUpstream, aspect: RiScopeAspect): ScopeRowView[] {
  const included = includedList(ri, aspect);
  const exclusions = (ri.scopeDefinition.scopeExclusions ?? []).filter((e) => e.aspect === aspect);
  const candidates = upstreamCandidates(upstream, aspect);
  const recorded = [...included, ...exclusions.map((e) => e.item)]
    .filter((item) => !candidates.some((c) => rowMatches(c, item)));
  const extras: ScopeCandidate[] = [];
  for (const item of recorded) {
    if (!extras.some((c) => rowMatches(c, item))) extras.push({ key: item, label: item });
  }
  extras.sort((a, b) => a.label.localeCompare(b.label));
  const coverage = esqCoverage(upstream, aspect);
  return [...candidates, ...extras].map((row) => {
    const exclusion = exclusions.find((e) => rowMatches(row, e.item));
    const state: ScopeState = included.some((item) => rowMatches(row, item))
      ? "included"
      : exclusion !== undefined ? "excluded" : "unset";
    return {
      key: row.key,
      label: row.label,
      detail: sameItem(row.key, row.label) ? undefined : row.key,
      inEsq: coverage === undefined ? undefined : coverage.some((item) => rowMatches(row, item)),
      state,
      reason: exclusion?.reason ?? "",
    };
  });
}

function withScopeState(ri: RiskIntegration, aspect: RiScopeAspect, row: ScopeRowView, next: ScopeState): RiskIntegration {
  const candidate: ScopeCandidate = { key: row.key, label: row.label };
  const all = ri.scopeDefinition.scopeExclusions ?? [];
  const previous = all.find((e) => e.aspect === aspect && rowMatches(candidate, e.item));
  const included = includedList(ri, aspect).filter((item) => !rowMatches(candidate, item));
  const exclusions: RiScopeExclusion[] = all.filter((e) => e.aspect !== aspect || !rowMatches(candidate, e.item));
  if (next === "included") included.push(row.key);
  if (next === "excluded") exclusions.push({ aspect, item: row.key, reason: previous?.reason ?? "" });
  return {
    ...ri,
    scopeDefinition: { ...withIncludedList(ri.scopeDefinition, aspect, included), scopeExclusions: exclusions },
  };
}

function withScopeReason(ri: RiskIntegration, aspect: RiScopeAspect, row: ScopeRowView, reason: string): RiskIntegration {
  const candidate: ScopeCandidate = { key: row.key, label: row.label };
  return {
    ...ri,
    scopeDefinition: {
      ...ri.scopeDefinition,
      scopeExclusions: (ri.scopeDefinition.scopeExclusions ?? []).map((e) => (
        e.aspect === aspect && rowMatches(candidate, e.item) ? { ...e, reason } : e
      )),
    },
  };
}

function criteriaSetOf(ri: RiskIntegration): RiResolvedCriteriaSet {
  const set = ri.criteriaSet;
  if (set === undefined) return PUBLISHED_RI_CRITERIA;
  return { ...set, absolute: { ...PUBLISHED_RI_CRITERIA.absolute, ...set.absolute } };
}

function withAbsoluteCriteria(ri: RiskIntegration, fn: (a: RiResolvedAbsoluteCriteria) => RiResolvedAbsoluteCriteria): RiskIntegration {
  const set = criteriaSetOf(ri);
  return { ...ri, criteriaSet: { ...set, absolute: fn(set.absolute) } };
}

function withRelativeCriteria(ri: RiskIntegration, fn: (r: RiRelativeCriteria) => RiRelativeCriteria): RiskIntegration {
  const set = criteriaSetOf(ri);
  return { ...ri, criteriaSet: { ...set, relative: fn(set.relative) } };
}

function withAbsoluteField<K extends keyof RiResolvedAbsoluteCriteria>(a: RiResolvedAbsoluteCriteria, key: K, value: RiResolvedAbsoluteCriteria[K]): RiResolvedAbsoluteCriteria {
  const copy = { ...a };
  copy[key] = value;
  return copy;
}

function withRelativeField<K extends keyof RiRelativeCriteria>(r: RiRelativeCriteria, key: K, value: RiRelativeCriteria[K]): RiRelativeCriteria {
  const copy = { ...r };
  copy[key] = value;
  return copy;
}

function nextCriterion<T>(current: RiCriterionValue<T>, value: T, published: T): RiCriterionValue<T> {
  return value === published ? { value } : { value, justification: current.justification ?? "" };
}

function anchorChanged(anchor: RiFcAnchor, index: number): boolean {
  const published = PUBLISHED_RI_CRITERIA.absolute.fcAnchors[index];
  return published === undefined
    || anchor.doseRem !== published.doseRem
    || anchor.frequencyPerPlantYear !== published.frequencyPerPlantYear;
}

function nextAnchor(anchor: RiFcAnchor, index: number): RiFcAnchor {
  const base = { doseRem: anchor.doseRem, frequencyPerPlantYear: anchor.frequencyPerPlantYear };
  return anchorChanged(anchor, index) ? { ...base, justification: anchor.justification ?? "" } : base;
}

function targetChanged(target: RiCumulativeTarget): boolean {
  const published = PUBLISHED_RI_CRITERIA.absolute.cumulativeTargets.find((t) => t.id === target.id);
  return published === undefined || published.limitPerPlantYear !== target.limitPerPlantYear;
}

function nextTarget(target: RiCumulativeTarget): RiCumulativeTarget {
  const base = { id: target.id, limitPerPlantYear: target.limitPerPlantYear };
  return targetChanged(target) ? { ...base, justification: target.justification ?? "" } : base;
}

const STATISTIC_RANK: Record<RiStatistic, number> = { P05: 5, P50: 50, MEAN: 50, P95: 95 };

const PERCENT_KEYS: string[] = ["lbeTargetPercent", "sscCumulativePercent", "aggregatePercent", "individualPercent"];

interface CriteriaIssues {
  numbers: Partial<Record<RiAbsoluteNumberKey, string>>;
  statistics: Partial<Record<RiAbsoluteStatisticKey, string>>;
  anchors: (string | undefined)[];
  targets: Partial<Record<RiCumulativeTargetId, string>>;
  relative: Partial<Record<RiRelativeKey, string>>;
}

function numberIssue(key: string, value: number): string | undefined {
  if (!Number.isFinite(value) || value <= 0) return "Enter a value above zero.";
  if (PERCENT_KEYS.includes(key) && value > 100) return "Enter a share of 100% or less.";
  return undefined;
}

function criteriaIssues(set: RiResolvedCriteriaSet): CriteriaIssues {
  const a = set.absolute;
  const r = set.relative;
  const numbers: Partial<Record<RiAbsoluteNumberKey, string>> = {};
  for (const spec of Object.values(RI_CRITERIA_SPECS).flat()) {
    if (spec.kind !== "number") continue;
    const issue = numberIssue(spec.key, a[spec.key].value);
    if (issue !== undefined) numbers[spec.key] = issue;
  }
  if (numbers.dbeLowerPerPlantYear === undefined && a.dbeLowerPerPlantYear.value >= a.aooLowerPerPlantYear.value) {
    numbers.dbeLowerPerPlantYear = "Must be below the AOO lower bound.";
  }
  if (numbers.bdbeLowerPerPlantYear === undefined && a.bdbeLowerPerPlantYear.value >= a.dbeLowerPerPlantYear.value) {
    numbers.bdbeLowerPerPlantYear = "Must be below the DBE lower bound.";
  }
  const statistics: Partial<Record<RiAbsoluteStatisticKey, string>> = {};
  if (STATISTIC_RANK[a.bandLowerStatistic.value] >= STATISTIC_RANK[a.bandUpperStatistic.value]) {
    statistics.bandLowerStatistic = "Must be below the upper edge.";
  }
  const anchors = a.fcAnchors.map((anchor, index) => {
    if (!(anchor.doseRem > 0) || !(anchor.frequencyPerPlantYear > 0)) return "Enter a dose and a frequency above zero.";
    const previous = a.fcAnchors[index - 1];
    if (previous === undefined) return undefined;
    const ordered = anchor.doseRem >= previous.doseRem && anchor.frequencyPerPlantYear <= previous.frequencyPerPlantYear;
    const same = anchor.doseRem === previous.doseRem && anchor.frequencyPerPlantYear === previous.frequencyPerPlantYear;
    return ordered && !same ? undefined : "Must sit at a higher dose or a lower frequency than the anchor above.";
  });
  const targets: Partial<Record<RiCumulativeTargetId, string>> = {};
  for (const target of a.cumulativeTargets) {
    if (!(target.limitPerPlantYear > 0)) targets[target.id] = "Enter a value above zero.";
  }
  const relative: Partial<Record<RiRelativeKey, string>> = {};
  for (const spec of RELATIVE_CRITERIA_SPECS) {
    const issue = numberIssue(spec.key, r[spec.key].value);
    if (issue !== undefined) relative[spec.key] = issue;
  }
  if (relative.fussellVesely === undefined && r.fussellVesely.value >= 1) relative.fussellVesely = "Enter a value below 1.";
  if (relative.riskAchievementWorth === undefined && r.riskAchievementWorth.value <= 1) relative.riskAchievementWorth = "Enter a value above 1.";
  if (relative.individualPercent === undefined && r.individualPercent.value > r.aggregatePercent.value) {
    relative.individualPercent = "Must not exceed the aggregate share.";
  }
  return { numbers, statistics, anchors, targets, relative };
}

interface CriteriaReview {
  changed: number;
  unjustified: number;
  invalid: number;
}

function missing(justification: string | undefined): boolean {
  return justification === undefined || justification.trim().length === 0;
}

function criteriaReview(set: RiResolvedCriteriaSet, appType: AppTypeId): CriteriaReview {
  const issues = criteriaIssues(set);
  let changed = 0;
  let unjustified = 0;
  function count(isChanged: boolean, justification: string | undefined): void {
    if (!isChanged) return;
    changed += 1;
    if (missing(justification)) unjustified += 1;
  }
  if (appType === "baseline_risk") {
    for (const spec of RELATIVE_CRITERIA_SPECS) {
      const current = set.relative[spec.key];
      count(current.value !== PUBLISHED_RI_CRITERIA.relative[spec.key].value, current.justification);
    }
    return { changed, unjustified, invalid: Object.keys(issues.relative).length };
  }
  const a = set.absolute;
  for (const spec of Object.values(RI_CRITERIA_SPECS).flat()) {
    count(a[spec.key].value !== PUBLISHED_RI_CRITERIA.absolute[spec.key].value, a[spec.key].justification);
  }
  a.fcAnchors.forEach((anchor, index) => count(anchorChanged(anchor, index), anchor.justification));
  a.cumulativeTargets.forEach((target) => count(targetChanged(target), target.justification));
  const invalid = Object.keys(issues.numbers).length
    + Object.keys(issues.statistics).length
    + issues.anchors.filter((issue) => issue !== undefined).length
    + Object.keys(issues.targets).length;
  return { changed, unjustified, invalid };
}

type RiFloorKey = "backgroundMremPerYear" | "windowDays" | "sharePercent";

function consequenceFloorOf(t: ReportingThresholds): RiConsequenceFloor {
  return t.consequenceFloor ?? {
    backgroundMremPerYear: { value: PUBLISHED_REPORTING_FLOORS.backgroundMremPerYear },
    windowDays: { value: PUBLISHED_REPORTING_FLOORS.windowDays },
    sharePercent: { value: PUBLISHED_REPORTING_FLOORS.sharePercent },
  };
}

function consequenceFloorMrem(floor: RiConsequenceFloor): number {
  return (floor.sharePercent.value / 100) * floor.backgroundMremPerYear.value * (floor.windowDays.value / 365);
}

function floorChanged(floor: RiConsequenceFloor, key: RiFloorKey): boolean {
  return floor[key].value !== PUBLISHED_REPORTING_FLOORS[key];
}

function floorDescription(floor: RiConsequenceFloor): string {
  const mrem = Number(consequenceFloorMrem(floor).toPrecision(3));
  return `${mrem} mrem, ${floor.sharePercent.value}% of ${floor.backgroundMremPerYear.value} mrem per year over ${floor.windowDays.value} days`;
}

function withFloorValue(ri: RiskIntegration, key: RiFloorKey, value: number): RiskIntegration {
  const t = ri.reportingThresholds;
  const floor = { ...consequenceFloorOf(t) };
  floor[key] = nextCriterion(floor[key], value, PUBLISHED_REPORTING_FLOORS[key]);
  const published = !floorChanged(floor, "backgroundMremPerYear") && !floorChanged(floor, "windowDays") && !floorChanged(floor, "sharePercent");
  return {
    ...ri,
    reportingThresholds: {
      ...t,
      consequenceFloor: floor,
      minimumReportingConsequenceDescription: floorDescription(floor),
      consequenceBasis: published ? "STANDARD_DEFAULT" : "JUSTIFIED_ALTERNATIVE",
    },
  };
}

function withFloorJustification(ri: RiskIntegration, key: RiFloorKey, text: string): RiskIntegration {
  const t = ri.reportingThresholds;
  const floor = { ...consequenceFloorOf(t) };
  floor[key] = { ...floor[key], justification: text };
  return { ...ri, reportingThresholds: { ...t, consequenceFloor: floor } };
}

function withFrequencyFloor(ri: RiskIntegration, value: number): RiskIntegration {
  const t = ri.reportingThresholds;
  const published = value === PUBLISHED_REPORTING_FLOORS.minimumReportingFrequencyPerPlantYear;
  return {
    ...ri,
    reportingThresholds: {
      ...t,
      minimumReportingFrequencyPerPlantYear: value,
      frequencyBasis: published ? "STANDARD_DEFAULT" : "JUSTIFIED_ALTERNATIVE",
      frequencyJustification: published ? undefined : t.frequencyJustification ?? "",
    },
  };
}

function withFrequencyJustification(ri: RiskIntegration, text: string): RiskIntegration {
  return { ...ri, reportingThresholds: { ...ri.reportingThresholds, frequencyJustification: text } };
}

interface FloorsIssues {
  frequency?: string;
  backgroundMremPerYear?: string;
  windowDays?: string;
  sharePercent?: string;
}

function floorsIssues(t: ReportingThresholds): FloorsIssues {
  const floor = consequenceFloorOf(t);
  const issues: FloorsIssues = {};
  if (!(t.minimumReportingFrequencyPerPlantYear > 0)) issues.frequency = "Enter a value above zero.";
  if (!(floor.backgroundMremPerYear.value > 0)) issues.backgroundMremPerYear = "Enter a value above zero.";
  if (!(floor.windowDays.value > 0)) issues.windowDays = "Enter a value above zero.";
  if (!(floor.sharePercent.value > 0)) issues.sharePercent = "Enter a value above zero.";
  else if (floor.sharePercent.value > 100) issues.sharePercent = "Enter a share of 100% or less.";
  return issues;
}

function floorsReview(t: ReportingThresholds): CriteriaReview {
  const floor = consequenceFloorOf(t);
  let changed = 0;
  let unjustified = 0;
  if (t.minimumReportingFrequencyPerPlantYear !== PUBLISHED_REPORTING_FLOORS.minimumReportingFrequencyPerPlantYear) {
    changed += 1;
    if (missing(t.frequencyJustification)) unjustified += 1;
  }
  for (const key of ["backgroundMremPerYear", "windowDays", "sharePercent"] as const) {
    if (!floorChanged(floor, key)) continue;
    changed += 1;
    if (missing(floor[key].justification)) unjustified += 1;
  }
  return { changed, unjustified, invalid: Object.keys(floorsIssues(t)).length };
}

interface MeasureNeeds {
  mean: boolean;
  percentiles: number[];
  thresholdsSv: number[];
}

const PERCENTILE_OF: Record<RiStatistic, number | undefined> = { MEAN: undefined, P05: 5, P50: 50, P95: 95 };

const DOSE_100_MREM_SV = 0.001;

function measureNeeds(measure: ConsequenceMeasure, set: RiCriteriaSet, appType: AppTypeId): MeasureNeeds {
  if (appType === "baseline_risk" || measure.role === undefined) return { mean: true, percentiles: [], thresholdsSv: [] };
  const a = set.absolute;
  const statistics: RiStatistic[] = measure.role === "EAB_DOSE"
    ? [a.fcStatistic.value, a.lbeDoseStatistic.value, a.sscTargetStatistic.value, a.sscCumulativeStatistic.value, a.cumulativeStatistic.value]
    : [a.sscCumulativeStatistic.value, a.cumulativeStatistic.value];
  const percentiles = [...new Set(statistics.map((s) => PERCENTILE_OF[s]).filter((p): p is number => p !== undefined))].sort((x, y) => x - y);
  return {
    mean: statistics.includes("MEAN"),
    percentiles,
    thresholdsSv: measure.role === "EAB_DOSE" ? [DOSE_100_MREM_SV] : [],
  };
}

function mremText(sievert: number): string {
  return `${Number((sievert * 100000).toPrecision(6))} mrem`;
}

function measureNeedsText(needs: MeasureNeeds): string {
  const parts: string[] = [];
  if (needs.mean) parts.push("the mean");
  for (const p of needs.percentiles) parts.push(`the ${rcOrdinal(p)} percentile`);
  for (const t of needs.thresholdsSv) parts.push(`the chance above ${mremText(t)}`);
  if (parts.length <= 1) return `Needs ${parts.join("")}.`;
  return `Needs ${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}.`;
}

function measureNeedsShort(needs: MeasureNeeds): string {
  const parts: string[] = [];
  if (needs.mean) parts.push("Mean");
  for (const p of needs.percentiles) parts.push(rcOrdinal(p));
  for (const t of needs.thresholdsSv) parts.push(`>${mremText(t)}`);
  return parts.join(", ");
}

function nearlyEqual(a: number | undefined, b: number | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return Math.abs(a - b) <= 0.01 * Math.max(Math.abs(a), Math.abs(b));
}

function sameReceptor(a: RcMetricReceptor, b: RcMetricReceptor): boolean {
  if (a.kind === "AVERAGE_BEYOND_EAB" && b.kind === "AVERAGE_BEYOND_EAB") return nearlyEqual(a.distanceKm, b.distanceKm);
  if (a.kind === "WITHIN_RADIUS" && b.kind === "WITHIN_RADIUS") return nearlyEqual(a.radiusKm, b.radiusKm);
  if (a.kind === "OTHER" && b.kind === "OTHER") return a.description.trim().toLowerCase() === b.description.trim().toLowerCase();
  return a.kind === b.kind;
}

interface MeasureRcCheck {
  tone: "muted" | "ok" | "warn";
  text: string;
  detail: string;
}

function measureRcCheck(measure: ConsequenceMeasure, needs: MeasureNeeds, rc: RadiologicalConsequenceAnalysis | undefined): MeasureRcCheck {
  if (rc === undefined) return { tone: "muted", text: "No RC link", detail: "No RC workbook is linked in the Interfaces card." };
  const quantity = measure.quantity;
  const receptor = measure.receptor;
  if (quantity === undefined || receptor === undefined) {
    return { tone: "muted", text: "Incomplete", detail: "Set the quantity and receptors to compare with RC." };
  }
  const metric = (rc.scope.metrics ?? []).find((m) => m.quantity === quantity && sameReceptor(m.receptor, receptor));
  if (metric === undefined) return { tone: "warn", text: "Not in RC", detail: "The linked RC workbook has no metric with this quantity and these receptors." };
  const lacking: string[] = [];
  const lackingShort: string[] = [];
  if (needs.mean && !metric.statistics.mean) {
    lacking.push("the mean");
    lackingShort.push("mean");
  }
  for (const p of needs.percentiles) {
    if (metric.statistics.percentiles.includes(p)) continue;
    lacking.push(`the ${rcOrdinal(p)} percentile`);
    lackingShort.push(rcOrdinal(p));
  }
  for (const t of needs.thresholdsSv) {
    if (metric.statistics.exceedanceThresholds.some((v) => nearlyEqual(v, t))) continue;
    lacking.push(`the chance above ${mremText(t)}`);
    lackingShort.push(`>${mremText(t)}`);
  }
  if (lacking.length > 0) {
    return { tone: "warn", text: `${metric.id} lacks ${lackingShort.join(", ")}`, detail: `${metric.id} does not report ${lacking.join(", ")}.` };
  }
  const differences: string[] = [];
  const differencesShort: string[] = [];
  if (measure.window !== undefined && metric.window !== undefined
    && (measure.window.seconds !== metric.window.seconds || measure.window.start !== metric.window.start)) {
    differences.push(`its window is ${rcMetricWindowText(metric.window)}`);
    differencesShort.push("window");
  }
  if (measure.protectiveActionsCredited !== undefined && measure.protectiveActionsCredited !== metric.protectiveActionsCredited) {
    differences.push(metric.protectiveActionsCredited ? "it credits protective actions" : "it credits no protective actions");
    differencesShort.push("protective actions");
  }
  if (differences.length > 0) {
    return {
      tone: "warn",
      text: `${metric.id} ${differencesShort.join(" and ")} ${differencesShort.length > 1 || differencesShort[0] === "protective actions" ? "differ" : "differs"}`,
      detail: `${metric.id} matches, but ${differences.join(" and ")}.`,
    };
  }
  return { tone: "ok", text: `Provided by ${metric.id}`, detail: `${metric.name} in the linked RC workbook provides every statistic this measure needs.` };
}

function measureIssues(measure: ConsequenceMeasure): string[] {
  const issues: string[] = [];
  if (measure.name.trim().length === 0) issues.push("Name the measure.");
  if (measure.quantity === undefined) issues.push("Choose the quantity.");
  else if (measure.quantity === "CUSTOM" && (measure.customUnit ?? "").trim().length === 0) issues.push("Give the unit.");
  const receptor = measure.receptor;
  if (receptor === undefined) issues.push("Choose the receptors.");
  else if (receptor.kind === "AVERAGE_BEYOND_EAB" && receptor.distanceKm === undefined) issues.push("Set the distance.");
  else if (receptor.kind === "WITHIN_RADIUS" && receptor.radiusKm === undefined) issues.push("Set the radius.");
  else if (receptor.kind === "OTHER" && receptor.description.trim().length === 0) issues.push("Describe the receptors.");
  return issues;
}

function measureRoleIssues(measures: ConsequenceMeasure[], appType: AppTypeId): string[] {
  if (appType === "baseline_risk") return [];
  const issues: string[] = [];
  for (const role of MEASURE_ROLE_SPECS) {
    const count = measures.filter((m) => m.role === role.id).length;
    if (count === 0) issues.push(`No measure is set for ${role.phrase}.`);
    if (count > 1) issues.push(`More than one measure is set for ${role.phrase}.`);
  }
  return issues;
}

function measureFromPreset(role: (typeof MEASURE_ROLE_SPECS)[number]): ConsequenceMeasure {
  const preset = rcMetricPresets.find((p) => p.key === role.preset);
  if (preset === undefined) return { name: role.label, role: role.id };
  const metric = structuredClone(preset.metric);
  return {
    name: metric.name,
    description: metric.criterion,
    role: role.id,
    quantity: metric.quantity,
    receptor: metric.receptor,
    window: metric.window,
    protectiveActionsCredited: metric.protectiveActionsCredited,
  };
}

const Z95 = 1.6448536269514722;

function statsOf(mean: number, p05?: number, p50?: number, p95?: number): RiFrequencyStats {
  const stats: RiFrequencyStats = { mean };
  if (p05 !== undefined) stats.p05 = p05;
  if (p50 !== undefined) stats.p50 = p50;
  if (p95 !== undefined) stats.p95 = p95;
  return stats;
}

function quantificationStats(q: EventSequenceFamilyQuantification): RiFrequencyStats {
  const bounds = lognormalBounds(q.frequencyDistribution);
  return statsOf(meanFrequencyValue(q.meanFrequency), q.percentile05 ?? bounds?.p05, q.percentile50 ?? bounds?.mean, q.percentile95 ?? bounds?.p95);
}

function sigmaOf(stats: RiFrequencyStats): number {
  const { p05, p95 } = stats;
  if (p05 === undefined || p95 === undefined || !(p05 > 0) || !(p95 > p05)) return 0;
  return Math.log(p95 / p05) / (2 * Z95);
}

function combineFrequencies(parts: RiFrequencyStats[]): RiFrequencyStats {
  const mean = parts.reduce((total, s) => total + s.mean, 0);
  const variance = parts.reduce((total, s) => {
    const sigma = sigmaOf(s);
    return total + s.mean * s.mean * (Math.exp(sigma * sigma) - 1);
  }, 0);
  const total = Number(mean.toPrecision(12));
  if (!(mean > 0) || !(variance > 0)) return { mean: total };
  const s2 = Math.log(1 + variance / (mean * mean));
  const sigma = Math.sqrt(s2);
  const mu = Math.log(mean) - s2 / 2;
  const approx = (value: number): number => Number(value.toPrecision(3));
  return { mean: total, p05: approx(Math.exp(mu - Z95 * sigma)), p50: approx(Math.exp(mu)), p95: approx(Math.exp(mu + Z95 * sigma)) };
}

function familyInput(family: EventSequenceFamily, esq: EventSequenceQuantification): RiInputFamily {
  const parts = esq.familyQuantifications.filter((q) => (q.eventSequenceFamilyReference?.entityId ?? q.eventSequenceFamilyRef) === family.uuid);
  const first = parts[0];
  const frequency = parts.length > 1
    ? combineFrequencies(parts.map(quantificationStats))
    : first !== undefined
      ? quantificationStats(first)
      : family.meanFrequency !== undefined ? { mean: meanFrequencyValue(family.meanFrequency) } : undefined;
  const source: RiFrequencySource | undefined = parts.length > 0 ? "ESQ" : family.meanFrequency !== undefined ? "ES" : undefined;
  const input: RiInputFamily = {
    id: family.uuid,
    name: family.name,
    plantOperatingStateId: family.representativePlantOperatingStateId,
    initiatingEventId: family.representativeInitiatingEventId,
    releaseCategoryIds: [...(family.releaseCategoryIds ?? [])],
    endState: family.endState,
    memberSequenceIds: [...family.memberSequenceIds],
    quantificationIds: parts.map((q) => q.uuid),
    included: true,
  };
  if (source !== undefined) input.frequencySource = source;
  if (frequency !== undefined) {
    input.imported = frequency;
    input.frequency = { ...frequency };
  }
  return input;
}

function sequenceInput(sequence: EventSequence, es: EventSequenceAnalysis, esq: EventSequenceQuantification, familyOf: Map<string, string>): RiInputSequence {
  const estimate = (esq.sequenceFrequencyEstimates ?? []).find((e) => e.eventSequenceRef === sequence.uuid);
  const tree = (es.eventTrees ?? []).find((t) => t.uuid === sequence.eventTreeId);
  const frequency = estimate !== undefined
    ? statsOf(meanFrequencyValue(estimate.meanFrequency), estimate.percentile05, estimate.percentile50, estimate.percentile95)
    : sequence.meanFrequency !== undefined ? { mean: meanFrequencyValue(sequence.meanFrequency) } : undefined;
  const familyId = sequence.sequenceFamilyId ?? familyOf.get(sequence.uuid);
  const input: RiInputSequence = {
    id: sequence.uuid,
    name: sequence.name,
    plantOperatingStateId: sequence.plantOperatingStateId,
    initiatingEventId: sequence.initiatingEventId,
    topEvents: Object.entries(sequence.functionalEventStates ?? {}).map(([key, state]) => {
      const event = tree?.functionalEvents[key];
      return { event: event?.label ?? event?.name ?? key, state };
    }),
    endState: sequence.endState,
    reactorSourceCombinations: [...(sequence.affectedReactorSourceCombinations ?? [])],
  };
  if (familyId !== undefined) input.familyId = familyId;
  if (sequence.releaseCategoryId !== undefined) input.releaseCategoryId = sequence.releaseCategoryId;
  if (frequency !== undefined) {
    input.frequencySource = estimate !== undefined ? "ESQ" : "ES";
    input.imported = frequency;
    input.frequency = { ...frequency };
  }
  return input;
}

function cloneConsequenceStats(stats: RiConsequenceStats): RiConsequenceStats {
  const copy: RiConsequenceStats = {
    percentiles: stats.percentiles.map((p) => ({ percentile: p.percentile, value: p.value })),
    exceedances: stats.exceedances.map((x) => ({ threshold: x.threshold, probability: x.probability })),
  };
  if (stats.mean !== undefined) copy.mean = stats.mean;
  return copy;
}

function consequenceInputs(ri: RiskIntegration, rc: RadiologicalConsequenceAnalysis): RiInputConsequence[] {
  const measures = ri.scopeDefinition.consequenceMeasures;
  const metrics = rc.scope.metrics ?? [];
  const categories = rc.releaseCategoryToConsequence.releaseCategoryInputs;
  function measureName(metricId: string, fallback: string): string {
    const metric = metrics.find((m) => m.id === metricId);
    if (metric === undefined) return fallback;
    const measure = measures.find((m) => m.quantity === metric.quantity && m.receptor !== undefined && sameReceptor(m.receptor, metric.receptor));
    return measure?.name ?? metric.name;
  }
  function row(categoryId: string, metricId: string, fallbackName: string, unit: string, stats: RiConsequenceStats): RiInputConsequence {
    const sourceTermId = categories.find((c) => c.releaseCategory === categoryId)?.sourceTermDefinitionRef;
    const input: RiInputConsequence = {
      releaseCategoryId: categoryId,
      measure: measureName(metricId, fallbackName),
      rcMetricId: metricId,
      unit,
      imported: stats,
      statistics: cloneConsequenceStats(stats),
    };
    if (sourceTermId !== undefined) input.sourceTermId = sourceTermId;
    return input;
  }
  const results = rc.consequenceQuantification.caseRecords?.results ?? [];
  if (results.length > 0) {
    return results.map((r) => row(r.categoryId, r.metricId, r.metricId, r.unit, cloneConsequenceStats(r.statistics)));
  }
  const rows: RiInputConsequence[] = [];
  for (const entry of rc.consequenceQuantification.eventSequenceConsequences) {
    const categoryId = entry.releaseCategoryReference;
    if (categoryId === undefined) continue;
    for (const result of entry.consequenceResults) {
      const metricId = metrics.find((m) => m.name === result.metric)?.id ?? result.metric;
      if (rows.some((r) => r.releaseCategoryId === categoryId && r.rcMetricId === metricId)) continue;
      const bounds = lognormalBounds(result.uncertaintyDistribution);
      const percentiles = bounds === undefined ? [] : [
        { percentile: 5, value: bounds.p05 },
        { percentile: 50, value: bounds.mean },
        { percentile: 95, value: bounds.p95 },
      ];
      rows.push(row(categoryId, metricId, result.metric, result.unit ?? "", { mean: result.meanValue, percentiles, exceedances: [] }));
    }
  }
  return rows;
}

function riImportReady(upstream: RiUpstream): boolean {
  return upstream.es !== undefined && upstream.esq !== undefined;
}

function riImportInputs(ri: RiskIntegration, upstream: RiUpstream, now: string): RiInputs | undefined {
  const es = upstream.es;
  const esq = upstream.esq;
  if (es === undefined || esq === undefined) return undefined;
  const links = applicationContextOf(ri).linkedWorkbooks;
  const sources: RiInputSource[] = [];
  for (const element of ["ES", "ESQ", "RC"] as const) {
    const id = links[element];
    if (id === undefined || (element === "RC" && upstream.rc === undefined)) continue;
    const option = upstream.options[element].find((w) => w.id === id);
    const source: RiInputSource = { element, workbookId: id, workbookName: option?.name ?? exampleLinkLabel(id) ?? id };
    if (option !== undefined) source.updatedAt = option.updatedAt;
    sources.push(source);
  }
  const familyOf = new Map<string, string>();
  for (const family of es.eventSequenceFamilies) {
    for (const member of family.memberSequenceIds) familyOf.set(member, family.uuid);
  }
  return {
    importedAt: now,
    sources,
    families: es.eventSequenceFamilies.map((family) => familyInput(family, esq)),
    sequences: es.eventSequences.map((sequence) => sequenceInput(sequence, es, esq, familyOf)),
    consequences: upstream.rc === undefined ? [] : consequenceInputs(ri, upstream.rc),
    contributors: esq.familyQuantifications.flatMap((q) => (q.contributionBreakdown ?? []).map((c): RiInputContributor => ({
      familyId: q.eventSequenceFamilyReference?.entityId ?? q.eventSequenceFamilyRef,
      quantificationId: q.uuid,
      quantificationMean: meanFrequencyValue(q.meanFrequency),
      name: c.contributorRef,
      type: c.contributorType,
      fraction: c.fractionalContribution,
    }))),
    importance: (esq.importanceAnalyses ?? []).flatMap((analysis) => analysis.measures.map((m) => importanceInput(analysis, m))),
  };
}

function importanceInput(analysis: ImportanceAnalysisRecord, m: ImportanceMeasureEntry): RiInputImportance {
  const row: RiInputImportance = { analysisId: analysis.uuid, scope: analysis.scope, entityType: m.entityType, entity: m.entityRef };
  if (analysis.familyRef !== undefined) row.familyRef = analysis.familyRef;
  if (analysis.sequenceRef !== undefined) row.sequenceRef = analysis.sequenceRef;
  if (m.systemRef !== undefined) row.systemRef = m.systemRef;
  if (m.fussellVesely !== undefined) row.fussellVesely = m.fussellVesely;
  if (m.riskAchievementWorth !== undefined) row.riskAchievementWorth = m.riskAchievementWorth;
  if (m.riskReductionWorth !== undefined) row.riskReductionWorth = m.riskReductionWorth;
  if (m.birnbaum !== undefined) row.birnbaum = m.birnbaum;
  return row;
}

function sameFrequency(a: RiFrequencyStats | undefined, b: RiFrequencyStats | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a.mean === b.mean && a.p05 === b.p05 && a.p50 === b.p50 && a.p95 === b.p95;
}

function sameConsequence(a: RiConsequenceStats, b: RiConsequenceStats): boolean {
  return a.mean === b.mean
    && a.percentiles.length === b.percentiles.length
    && a.percentiles.every((p, i) => p.percentile === b.percentiles[i]?.percentile && p.value === b.percentiles[i]?.value)
    && a.exceedances.length === b.exceedances.length
    && a.exceedances.every((x, i) => x.threshold === b.exceedances[i]?.threshold && x.probability === b.exceedances[i]?.probability);
}

function frequencyEdited(item: { imported?: RiFrequencyStats; frequency?: RiFrequencyStats; manual?: RiManualEntry }): boolean {
  return item.manual === undefined && !sameFrequency(item.imported, item.frequency);
}

function consequenceEdited(item: RiInputConsequence): boolean {
  return item.imported !== undefined && !sameConsequence(item.imported, item.statistics);
}

function consequenceKey(item: RiInputConsequence): string {
  return item.manual !== undefined ? `manual:${item.rcMetricId}` : `${item.releaseCategoryId}|${item.rcMetricId}`;
}

function withFrequencyStat(stats: RiFrequencyStats | undefined, key: "mean" | "p05" | "p50" | "p95", value: number | undefined): RiFrequencyStats | undefined {
  if (key === "mean") return value === undefined ? undefined : statsOf(value, stats?.p05, stats?.p50, stats?.p95);
  if (stats === undefined) return undefined;
  return statsOf(
    stats.mean,
    key === "p05" ? value : stats.p05,
    key === "p50" ? value : stats.p50,
    key === "p95" ? value : stats.p95,
  );
}

function withInputs(ri: RiskIntegration, fn: (inputs: RiInputs) => RiInputs): RiskIntegration {
  return ri.inputs === undefined ? ri : { ...ri, inputs: fn(ri.inputs) };
}

type RiFindingSeverity = "error" | "warning" | "note";

interface RiInputFinding {
  severity: RiFindingSeverity;
  check: string;
  item: string;
  detail: string;
  target?: { kind: "inputFamily" | "inputSequence" | "inputConsequence" | "inputContributor" | "inputImportance"; id: string };
}

const SEVERITY_RANK: Record<RiFindingSeverity, number> = { error: 0, warning: 1, note: 2 };

function orderFindings(stats: RiFrequencyStats): { outOfOrder: boolean; meanOutside: boolean } {
  const values = [stats.p05, stats.p50, stats.p95].filter((v): v is number => v !== undefined);
  const outOfOrder = values.some((v, i) => i > 0 && v < (values[i - 1] ?? v));
  const meanOutside = stats.p05 !== undefined && stats.p95 !== undefined && (stats.mean < stats.p05 || stats.mean > stats.p95);
  return { outOfOrder, meanOutside };
}

function countedItems(items: string[], shown: number): string {
  return items.length > shown ? `${items.slice(0, shown).join(", ")} and ${items.length - shown} more` : items.join(", ");
}

function duplicateIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const id of ids) {
    const key = id.trim().toLowerCase();
    if (seen.has(key)) repeated.add(id);
    seen.add(key);
  }
  return [...repeated];
}

function unavailableReasonOf(inputs: RiInputs, measure: string): string | undefined {
  const reason = inputs.unavailable?.find((u) => u.measure === measure)?.reason;
  return reason === undefined || reason.trim().length === 0 ? undefined : reason;
}

function riInputChecks(ri: RiskIntegration, options?: Record<RiLinkCode, Workbook[]>): RiInputFinding[] {
  const inputs = ri.inputs;
  if (inputs === undefined) return [];
  const findings: RiInputFinding[] = [];
  const appType = appTypeFromMef(ri);
  const set = criteriaSetOf(ri);
  const measures = ri.scopeDefinition.consequenceMeasures;
  const roleMeasures = measures.filter((m) => m.role !== undefined);
  const sequencesById = new Map(inputs.sequences.map((s): [string, RiInputSequence] => [s.id, s]));
  const sourceNote = "Say where the hand-entered values come from.";

  for (const id of duplicateIds(inputs.families.map((f) => f.id))) {
    findings.push({ severity: "error", check: "Duplicate ID", item: id, detail: "Two families share this ID. Give each family its own ID.", target: { kind: "inputFamily", id } });
  }
  for (const id of duplicateIds(inputs.sequences.map((s) => s.id))) {
    findings.push({ severity: "error", check: "Duplicate ID", item: id, detail: "Two sequences share this ID. Give each sequence its own ID.", target: { kind: "inputSequence", id } });
  }

  for (const f of inputs.families) {
    const target = { kind: "inputFamily" as const, id: f.id };
    if (f.manual !== undefined) {
      if (f.name.trim().length === 0) findings.push({ severity: "warning", check: "No name", item: f.id, detail: "Name the family.", target });
      if (missing(f.manual.source)) findings.push({ severity: "warning", check: "Source not given", item: f.id, detail: sourceNote, target });
    }
    if (!f.included) {
      if (missing(f.exclusionReason)) findings.push({ severity: "error", check: "Excluded without a reason", item: f.id, detail: "Give the reason this family is left out of the integration.", target });
      continue;
    }
    if (f.manual === undefined && frequencyEdited(f) && missing(f.changeReason)) findings.push({ severity: "error", check: "Edited without a reason", item: f.id, detail: "The frequency differs from the imported value. Give the reason.", target });
    const frequency = f.frequency;
    if (frequency === undefined) {
      findings.push({ severity: "error", check: "Missing frequency", item: f.id, detail: f.manual === undefined ? "Neither ESQ nor ES gives a frequency for this family." : "Enter the family frequency.", target });
    } else {
      if (f.frequencySource === "ES") findings.push({ severity: "warning", check: "Screening frequency", item: f.id, detail: "ESQ does not quantify this family, so the ES screening value is used.", target });
      if (f.quantificationIds.length > 1) {
        findings.push({ severity: "note", check: "Combined quantifications", item: f.id, detail: `The mean adds ${f.quantificationIds.slice(0, -1).join(", ")} and ${f.quantificationIds[f.quantificationIds.length - 1] ?? ""}. The percentiles use a lognormal approximation of the sum.`, target });
      }
      const order = orderFindings(frequency);
      if (order.outOfOrder) findings.push({ severity: "error", check: "Percentiles out of order", item: f.id, detail: "The 5th, 50th and 95th percentiles must increase.", target });
      if (order.meanOutside) findings.push({ severity: "warning", check: "Mean outside the band", item: f.id, detail: "The mean lies outside the 5th to 95th percentile band.", target });
      const members = f.memberSequenceIds.map((id) => sequencesById.get(id)).filter((s): s is RiInputSequence => s !== undefined);
      const comparable = members.length > 0 && members.every((s) => s.frequency !== undefined && s.frequencySource === f.frequencySource);
      if (comparable) {
        const sum = members.reduce((total, s) => total + (s.frequency?.mean ?? 0), 0);
        if (Math.abs(sum - frequency.mean) > 0.01 * Math.max(sum, frequency.mean)) {
          findings.push({ severity: "warning", check: "Sequences do not add up", item: f.id, detail: `The member sequences sum to ${sciText(sum)} but the family is ${sciText(frequency.mean)} per plant-year.`, target });
        }
      }
    }
    if (f.endState === EndState.RADIONUCLIDE_RELEASE && f.releaseCategoryIds.length === 0) {
      findings.push({ severity: "error", check: "No release category", item: f.id, detail: "The family releases material but has no release category.", target });
    }
  }

  if (appType === "fixed_risk_target") {
    const releasing = inputs.families.filter((f) => f.included && f.endState === EndState.RADIONUCLIDE_RELEASE);
    for (const measure of roleMeasures) {
      const lacking: { family: RiInputFamily; category: string }[] = [];
      let found = false;
      for (const f of releasing) {
        for (const category of f.releaseCategoryIds) {
          if (inputs.consequences.some((c) => c.releaseCategoryId === category && c.measure === measure.name)) found = true;
          else lacking.push({ family: f, category });
        }
      }
      if (lacking.length === 0) continue;
      const reason = unavailableReasonOf(inputs, measure.name);
      if (reason !== undefined) {
        findings.push({ severity: "note", check: "Results not available", item: measure.name, detail: `${lacking.length} release ${lacking.length === 1 ? "family has" : "families have"} no result. ${reason}` });
        continue;
      }
      if (!found) {
        findings.push({ severity: "error", check: "No results", item: measure.name, detail: `No family has a result for this measure. Import them, add them by hand, or record why they are not available.` });
        continue;
      }
      for (const { family, category } of lacking) {
        findings.push({ severity: "error", check: "Missing consequence", item: family.id, detail: `No result for ${category} and ${measure.name}.`, target: { kind: "inputFamily", id: family.id } });
      }
    }
  }

  const modules = (ri.scopeDefinition.reactorModules ?? []).length;
  for (const s of inputs.sequences) {
    const target = { kind: "inputSequence" as const, id: s.id };
    if (s.manual !== undefined && missing(s.manual.source)) findings.push({ severity: "warning", check: "Source not given", item: s.id, detail: sourceNote, target });
    if (s.manual === undefined && frequencyEdited(s) && missing(s.changeReason)) findings.push({ severity: "error", check: "Edited without a reason", item: s.id, detail: "The frequency differs from the imported value. Give the reason.", target });
    if (s.frequency !== undefined && orderFindings(s.frequency).outOfOrder) findings.push({ severity: "error", check: "Percentiles out of order", item: s.id, detail: "The 5th, 50th and 95th percentiles must increase.", target });
    if (s.reactorSourceCombinations.length > 1 && modules <= 1) {
      findings.push({ severity: "warning", check: "Several reactors or sources", item: s.id, detail: `The sequence affects ${s.reactorSourceCombinations.join(", ")}, but the scope lists ${modules} reactor module${modules === 1 ? "" : "s"}.`, target });
    }
  }

  const lackingStats = new Map<string, { measure: string; statistic: string; items: string[]; target: { kind: "inputConsequence"; id: string } }>();
  const seenResults = new Set<string>();
  for (const c of inputs.consequences) {
    const target = { kind: "inputConsequence" as const, id: consequenceKey(c) };
    const item = `${c.releaseCategoryId.trim().length === 0 ? "No category" : c.releaseCategoryId} ${c.measure}`;
    if (c.manual !== undefined) {
      if (c.releaseCategoryId.trim().length === 0) findings.push({ severity: "error", check: "No release category", item, detail: "Give the release category this result belongs to.", target });
      if (missing(c.manual.source)) findings.push({ severity: "warning", check: "Source not given", item, detail: sourceNote, target });
    }
    const pair = `${c.releaseCategoryId.trim().toLowerCase()}|${c.measure}`;
    if (c.releaseCategoryId.trim().length > 0 && seenResults.has(pair)) findings.push({ severity: "error", check: "Duplicate result", item, detail: "Another result has the same release category and measure.", target });
    seenResults.add(pair);
    if (c.manual === undefined && consequenceEdited(c) && missing(c.changeReason)) findings.push({ severity: "error", check: "Edited without a reason", item, detail: "The values differ from the imported ones. Give the reason.", target });
    const values = [...c.statistics.percentiles].sort((a, b) => a.percentile - b.percentile).map((p) => p.value);
    if (values.some((v, i) => i > 0 && v < (values[i - 1] ?? v))) findings.push({ severity: "error", check: "Percentiles out of order", item, detail: "The percentiles must increase.", target });
    const measure = measures.find((m) => m.name === c.measure);
    if (measure === undefined) continue;
    const needs = measureNeeds(measure, set, appType);
    const lacking: string[] = [];
    if (needs.mean && c.statistics.mean === undefined) lacking.push("the mean");
    for (const p of needs.percentiles) {
      if (!c.statistics.percentiles.some((x) => x.percentile === p)) lacking.push(`the ${rcOrdinal(p)} percentile`);
    }
    for (const t of needs.thresholdsSv) {
      const factor = remPerUnit(c.unit);
      const reported = c.statistics.exceedances.some((x) => factor === undefined ? nearlyEqual(x.threshold, t) : nearlyEqual(x.threshold * factor, t * 100));
      if (!reported) lacking.push(`the chance above ${mremText(t)}`);
    }
    for (const statistic of lacking) {
      const key = `${c.measure}|${statistic}`;
      const entry = lackingStats.get(key) ?? { measure: c.measure, statistic, items: [], target };
      entry.items.push(c.releaseCategoryId);
      lackingStats.set(key, entry);
    }
  }
  for (const entry of lackingStats.values()) {
    const count = entry.items.length;
    findings.push({ severity: "warning", check: "Statistic not reported", item: entry.measure, detail: `No value for ${entry.statistic} in ${count} ${count === 1 ? "result" : "results"}: ${countedItems(entry.items, 3)}.`, target: entry.target });
  }

  for (const c of inputs.contributors ?? []) {
    if (c.manual === undefined) continue;
    const target = { kind: "inputContributor" as const, id: c.quantificationId };
    const item = c.name.trim().length === 0 ? "Unnamed contributor" : c.name;
    if (c.name.trim().length === 0) findings.push({ severity: "error", check: "No name", item, detail: "Name the contributor.", target });
    if (!inputs.families.some((f) => f.id === c.familyId)) findings.push({ severity: "error", check: "Unknown family", item, detail: "Pick the family this contributor belongs to.", target });
    if (!(c.fraction >= 0 && c.fraction <= 1)) findings.push({ severity: "error", check: "Share out of range", item, detail: "The share of the family frequency must lie between 0 and 1.", target });
    if (missing(c.manual.source)) findings.push({ severity: "warning", check: "Source not given", item, detail: sourceNote, target });
  }
  for (const m of inputs.importance ?? []) {
    if (m.manual === undefined) continue;
    const target = { kind: "inputImportance" as const, id: m.analysisId };
    const item = m.entity.trim().length === 0 ? "Unnamed entity" : m.entity;
    if (m.entity.trim().length === 0) findings.push({ severity: "error", check: "No name", item, detail: "Name the basic event or system.", target });
    if (m.scope === "PER_FAMILY" && !inputs.families.some((f) => f.id === m.familyRef)) findings.push({ severity: "error", check: "Unknown family", item, detail: "Pick the family these measures belong to.", target });
    if (missing(m.manual.source)) findings.push({ severity: "warning", check: "Source not given", item, detail: sourceNote, target });
  }

  if (options !== undefined) {
    for (const source of inputs.sources) {
      if (source.updatedAt === undefined) continue;
      const current = options[source.element].find((w) => w.id === source.workbookId);
      if (current !== undefined && current.updatedAt !== source.updatedAt) {
        findings.push({ severity: "warning", check: "Changed since import", item: source.element, detail: `${source.workbookName} changed after the import. Import again to refresh.` });
      }
    }
  }

  return findings.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

function emptyInputs(): RiInputs {
  return { sources: [], families: [], sequences: [], consequences: [] };
}

function withInputsCreated(ri: RiskIntegration, fn: (inputs: RiInputs) => RiInputs): RiskIntegration {
  return { ...ri, inputs: fn(ri.inputs ?? emptyInputs()) };
}

function withManualKept(previous: RiInputs | undefined, next: RiInputs): RiInputs {
  if (previous === undefined) return next;
  const out: RiInputs = {
    ...next,
    families: [...next.families, ...previous.families.filter((f) => f.manual !== undefined)],
    sequences: [...next.sequences, ...previous.sequences.filter((s) => s.manual !== undefined)],
    consequences: [...next.consequences, ...previous.consequences.filter((c) => c.manual !== undefined)],
  };
  const contributors = [...(next.contributors ?? []), ...(previous.contributors ?? []).filter((c) => c.manual !== undefined)];
  const importance = [...(next.importance ?? []), ...(previous.importance ?? []).filter((m) => m.manual !== undefined)];
  if (contributors.length > 0 || next.contributors !== undefined) out.contributors = contributors;
  if (importance.length > 0 || next.importance !== undefined) out.importance = importance;
  if (previous.unavailable !== undefined) out.unavailable = previous.unavailable;
  return out;
}

function manualCount(inputs: RiInputs | undefined): number {
  if (inputs === undefined) return 0;
  return inputs.families.filter((f) => f.manual !== undefined).length
    + inputs.sequences.filter((s) => s.manual !== undefined).length
    + inputs.consequences.filter((c) => c.manual !== undefined).length
    + (inputs.contributors ?? []).filter((c) => c.manual !== undefined).length
    + (inputs.importance ?? []).filter((m) => m.manual !== undefined).length;
}

function withFamilyRenamed(ri: RiskIntegration, from: string, to: string): RiskIntegration {
  const next = to.trim();
  const inputs = ri.inputs;
  if (inputs === undefined || next.length === 0 || next === from || inputs.families.some((f) => f.id !== from && sameItem(f.id, next))) return ri;
  const renamed: RiInputs = {
    ...inputs,
    families: inputs.families.map((f) => (f.id === from ? { ...f, id: next } : f)),
    sequences: inputs.sequences.map((s) => (s.familyId === from ? { ...s, familyId: next } : s)),
  };
  if (inputs.contributors !== undefined) renamed.contributors = inputs.contributors.map((c) => (c.familyId === from ? { ...c, familyId: next } : c));
  if (inputs.importance !== undefined) renamed.importance = inputs.importance.map((m) => (m.familyRef === from ? { ...m, familyRef: next } : m));
  const out: RiskIntegration = { ...ri, inputs: renamed };
  if (ri.eventCategories !== undefined) out.eventCategories = { cliffEdgeChecks: ri.eventCategories.cliffEdgeChecks.map((c) => (c.familyId === from ? { ...c, familyId: next } : c)) };
  return out;
}

function withSequenceRenamed(ri: RiskIntegration, from: string, to: string): RiskIntegration {
  const next = to.trim();
  const inputs = ri.inputs;
  if (inputs === undefined || next.length === 0 || next === from || inputs.sequences.some((s) => s.id !== from && sameItem(s.id, next))) return ri;
  const renamed: RiInputs = {
    ...inputs,
    sequences: inputs.sequences.map((s) => (s.id === from ? { ...s, id: next } : s)),
    families: inputs.families.map((f) => (f.memberSequenceIds.includes(from) ? { ...f, memberSequenceIds: f.memberSequenceIds.map((id) => (id === from ? next : id)) } : f)),
  };
  if (inputs.importance !== undefined) renamed.importance = inputs.importance.map((m) => (m.sequenceRef === from ? { ...m, sequenceRef: next } : m));
  return { ...ri, inputs: renamed };
}

function withSequenceFamily(ri: RiskIntegration, sequenceId: string, familyId: string | undefined): RiskIntegration {
  return withInputs(ri, (inputs) => ({
    ...inputs,
    sequences: inputs.sequences.map((s) => {
      if (s.id !== sequenceId) return s;
      const { familyId: _previous, ...rest } = s;
      return familyId === undefined ? rest : { ...rest, familyId };
    }),
    families: inputs.families.map((f) => {
      const members = f.memberSequenceIds.filter((id) => id !== sequenceId);
      return { ...f, memberSequenceIds: f.id === familyId ? [...members, sequenceId] : members };
    }),
  }));
}

function withUnavailableReason(ri: RiskIntegration, measure: string, reason: string): RiskIntegration {
  return withInputs(ri, (inputs) => {
    const others = (inputs.unavailable ?? []).filter((u) => u.measure !== measure);
    const unavailable = reason.trim().length === 0 ? others : [...others, { measure, reason }];
    const { unavailable: _old, ...rest } = inputs;
    return unavailable.length === 0 ? rest : { ...rest, unavailable };
  });
}

function measuresWithoutResults(ri: RiskIntegration): { measure: string; families: string[] }[] {
  const inputs = ri.inputs;
  if (inputs === undefined || appTypeFromMef(ri) !== "fixed_risk_target") return [];
  const releasing = inputs.families.filter((f) => f.included && f.endState === EndState.RADIONUCLIDE_RELEASE);
  const out: { measure: string; families: string[] }[] = [];
  for (const measure of ri.scopeDefinition.consequenceMeasures.filter((m) => m.role !== undefined)) {
    const families = releasing.filter((f) => f.releaseCategoryIds.some((category) => !inputs.consequences.some((c) => c.releaseCategoryId === category && c.measure === measure.name))).map((f) => f.id);
    const any = releasing.some((f) => f.releaseCategoryIds.some((category) => inputs.consequences.some((c) => c.releaseCategoryId === category && c.measure === measure.name)));
    if (families.length > 0 && (!any || unavailableReasonOf(inputs, measure.name) !== undefined)) out.push({ measure: measure.name, families });
  }
  return out;
}

type RiCategory = "AOO" | "DBE" | "BDBE";

interface RiCategoryBounds {
  aoo: number;
  dbe: number;
  floor: number;
}

type RiDoseState = "value" | "no-release" | "not-reported" | "no-measure";

interface RiFamilyDose {
  state: RiDoseState;
  rem?: number;
}

interface RiFamilyCategory {
  family: RiInputFamily;
  central?: number;
  lower?: number;
  upper?: number;
  floor?: number;
  category?: RiCategory;
  below: boolean;
  byFloorRule: boolean;
  floorChecked: boolean;
  bandChecked: boolean;
  also: RiCategory[];
  dose: RiFamilyDose;
  highConsequence?: boolean;
}

function frequencyAt(stats: RiFrequencyStats | undefined, statistic: RiStatistic): number | undefined {
  if (stats === undefined) return undefined;
  switch (statistic) {
    case "MEAN": return stats.mean;
    case "P05": return stats.p05;
    case "P50": return stats.p50;
    case "P95": return stats.p95;
  }
}

function consequenceAt(stats: RiConsequenceStats, statistic: RiStatistic): number | undefined {
  switch (statistic) {
    case "MEAN": return stats.mean;
    case "P05": return stats.percentiles.find((p) => p.percentile === 5)?.value;
    case "P50": return stats.percentiles.find((p) => p.percentile === 50)?.value;
    case "P95": return stats.percentiles.find((p) => p.percentile === 95)?.value;
  }
}

function remPerUnit(unit: string): number | undefined {
  switch (unit) {
    case "Sv": return 100;
    case "mSv": return 0.1;
    case "rem": return 1;
    case "mrem": return 0.001;
    default: return undefined;
  }
}

function categoryBounds(a: RiResolvedAbsoluteCriteria): RiCategoryBounds {
  return { aoo: a.aooLowerPerPlantYear.value, dbe: a.dbeLowerPerPlantYear.value, floor: a.bdbeLowerPerPlantYear.value };
}

function categoryAt(value: number, bounds: RiCategoryBounds): RiCategory | undefined {
  if (value >= bounds.aoo) return "AOO";
  if (value >= bounds.dbe) return "DBE";
  if (value >= bounds.floor) return "BDBE";
  return undefined;
}

function bandCategories(lower: number, upper: number, bounds: RiCategoryBounds): RiCategory[] {
  const ranges: [RiCategory, number, number][] = [
    ["AOO", bounds.aoo, Number.POSITIVE_INFINITY],
    ["DBE", bounds.dbe, bounds.aoo],
    ["BDBE", bounds.floor, bounds.dbe],
  ];
  return ranges.filter(([, low, high]) => upper >= low && lower < high).map(([category]) => category);
}

function familyDose(ri: RiskIntegration, family: RiInputFamily, statistic: RiStatistic): RiFamilyDose {
  if (family.endState !== EndState.RADIONUCLIDE_RELEASE) return { state: "no-release" };
  const measure = ri.scopeDefinition.consequenceMeasures.find((m) => m.role === "EAB_DOSE");
  if (measure === undefined) return { state: "no-measure" };
  const consequences = ri.inputs?.consequences ?? [];
  const values: number[] = [];
  for (const category of family.releaseCategoryIds) {
    const result = consequences.find((c) => c.releaseCategoryId === category && c.measure === measure.name);
    const value = result === undefined ? undefined : consequenceAt(result.statistics, statistic);
    const factor = result === undefined ? undefined : remPerUnit(result.unit);
    if (value === undefined || factor === undefined) return { state: "not-reported" };
    values.push(value * factor);
  }
  if (values.length === 0) return { state: "not-reported" };
  return { state: "value", rem: Math.max(...values) };
}

function familyCategories(ri: RiskIntegration): RiFamilyCategory[] {
  const inputs = ri.inputs;
  if (inputs === undefined) return [];
  const a = criteriaSetOf(ri).absolute;
  const bounds = categoryBounds(a);
  return inputs.families.filter((f) => f.included).map((family): RiFamilyCategory => {
    const stats = family.frequency;
    const central = frequencyAt(stats, a.categoryStatistic.value);
    const lower = frequencyAt(stats, a.bandLowerStatistic.value);
    const upper = frequencyAt(stats, a.bandUpperStatistic.value);
    const floorValue = frequencyAt(stats, a.bdbeFloorStatistic.value);
    const byCentral = central === undefined ? undefined : categoryAt(central, bounds);
    const byFloorRule = central !== undefined && byCentral === undefined && floorValue !== undefined && floorValue >= bounds.floor;
    const category: RiCategory | undefined = byFloorRule ? "BDBE" : byCentral;
    const also = lower !== undefined && upper !== undefined ? bandCategories(lower, upper, bounds).filter((c) => c !== category) : [];
    const dose = familyDose(ri, family, a.highConsequenceStatistic.value);
    const view: RiFamilyCategory = {
      family,
      below: central !== undefined && category === undefined,
      byFloorRule,
      floorChecked: floorValue !== undefined,
      bandChecked: lower !== undefined && upper !== undefined,
      also,
      dose,
    };
    if (central !== undefined) view.central = central;
    if (lower !== undefined) view.lower = lower;
    if (upper !== undefined) view.upper = upper;
    if (floorValue !== undefined) view.floor = floorValue;
    if (category !== undefined) view.category = category;
    if (category === "BDBE" || also.includes("BDBE")) {
      if (dose.state === "no-release") view.highConsequence = false;
      else if (dose.rem !== undefined) view.highConsequence = dose.rem > a.highConsequenceDoseRem.value;
    }
    return view;
  });
}

function inDbeRange(view: RiFamilyCategory): boolean {
  return view.category === "DBE" || view.also.includes("DBE");
}

function cliffEdgeCheckOf(ri: RiskIntegration, familyId: string): RiCliffEdgeCheck | undefined {
  return ri.eventCategories?.cliffEdgeChecks.find((c) => c.familyId === familyId);
}

function withCliffEdgeCheck(ri: RiskIntegration, familyId: string, fn: (check: RiCliffEdgeCheck) => RiCliffEdgeCheck): RiskIntegration {
  const checks = ri.eventCategories?.cliffEdgeChecks ?? [];
  const current = checks.find((c) => c.familyId === familyId);
  const next = fn(current ?? { familyId, basis: "" });
  const empty = next.status === undefined && next.basis.trim().length === 0;
  const cliffEdgeChecks = empty
    ? checks.filter((c) => c.familyId !== familyId)
    : current === undefined ? [...checks, next] : checks.map((c) => (c.familyId === familyId ? next : c));
  return { ...ri, eventCategories: { ...ri.eventCategories, cliffEdgeChecks } };
}

function withCliffEdgeStatus(ri: RiskIntegration, familyId: string, status: RiCliffEdgeStatus | undefined): RiskIntegration {
  return withCliffEdgeCheck(ri, familyId, (check) => {
    const next: RiCliffEdgeCheck = { familyId, basis: check.basis };
    if (status !== undefined) next.status = status;
    return next;
  });
}

function withCliffEdgeBasis(ri: RiskIntegration, familyId: string, basis: string): RiskIntegration {
  return withCliffEdgeCheck(ri, familyId, (check) => ({ ...check, basis }));
}

function cliffEdgeReviewed(ri: RiskIntegration, familyId: string): boolean {
  const check = cliffEdgeCheckOf(ri, familyId);
  return check !== undefined && check.status !== undefined && !missing(check.basis);
}

function lg(value: number): number {
  return Math.log(value) / Math.LN10;
}

function targetAnchors(a: RiResolvedAbsoluteCriteria): RiFcAnchor[] {
  return a.fcAnchors.filter((p) => p.doseRem > 0 && p.frequencyPerPlantYear > 0);
}

function targetFrequencyAt(anchors: RiFcAnchor[], doseRem: number): number | undefined {
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  if (first === undefined || last === undefined || !(doseRem > 0)) return undefined;
  if (doseRem <= first.doseRem) return (first.frequencyPerPlantYear * first.doseRem) / doseRem;
  for (let i = 0; i + 1 < anchors.length; i += 1) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (doseRem > b.doseRem) continue;
    if (b.doseRem === a.doseRem) return a.frequencyPerPlantYear;
    const t = (lg(doseRem) - lg(a.doseRem)) / (lg(b.doseRem) - lg(a.doseRem));
    return Math.pow(10, lg(a.frequencyPerPlantYear) + t * (lg(b.frequencyPerPlantYear) - lg(a.frequencyPerPlantYear)));
  }
  return last.frequencyPerPlantYear;
}

function targetDoseAt(anchors: RiFcAnchor[], frequency: number): number | undefined {
  const first = anchors[0];
  if (first === undefined || !(frequency > 0)) return undefined;
  if (frequency >= first.frequencyPerPlantYear) return (first.frequencyPerPlantYear * first.doseRem) / frequency;
  for (let i = 0; i + 1 < anchors.length; i += 1) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (frequency < b.frequencyPerPlantYear) continue;
    if (b.frequencyPerPlantYear === a.frequencyPerPlantYear) return a.doseRem;
    const t = (lg(frequency) - lg(a.frequencyPerPlantYear)) / (lg(b.frequencyPerPlantYear) - lg(a.frequencyPerPlantYear));
    return Math.pow(10, lg(a.doseRem) + t * (lg(b.doseRem) - lg(a.doseRem)));
  }
  return Number.POSITIVE_INFINITY;
}

interface RiMargin {
  frequency: number;
  dose: number;
}

interface RiFcFamily {
  view: RiFamilyCategory;
  release: boolean;
  freqMean?: number;
  freqLow?: number;
  freqHigh?: number;
  doseMean?: number;
  doseLow?: number;
  doseHigh?: number;
  withinTarget?: boolean;
  sigFrequency?: number;
  sigDose?: number;
  share?: number;
  significant?: boolean;
  reason: string;
  marginMean?: RiMargin;
  marginHigh?: RiMargin;
}

function fcMargin(anchors: RiFcAnchor[], frequency: number | undefined, doseRem: number | undefined): RiMargin | undefined {
  if (frequency === undefined || doseRem === undefined || !(frequency > 0)) return undefined;
  if (doseRem === 0) return { frequency: Number.POSITIVE_INFINITY, dose: Number.POSITIVE_INFINITY };
  const targetFrequency = targetFrequencyAt(anchors, doseRem);
  const targetDose = targetDoseAt(anchors, frequency);
  if (targetFrequency === undefined || targetDose === undefined) return undefined;
  return { frequency: targetFrequency / frequency, dose: targetDose / doseRem };
}

function fcFamilies(ri: RiskIntegration): RiFcFamily[] {
  const a = criteriaSetOf(ri).absolute;
  const anchors = targetAnchors(a);
  const floorRem = a.lbeDoseFloorMrem.value / 1000;
  const percent = a.lbeTargetPercent.value;
  const freqLabel = RI_STATISTIC_SHORT[a.lbeFrequencyStatistic.value];
  const doseLabel = RI_STATISTIC_SHORT[a.lbeDoseStatistic.value];
  return familyCategories(ri).filter((view) => view.category !== undefined).map((view): RiFcFamily => {
    const family = view.family;
    const release = family.endState === EndState.RADIONUCLIDE_RELEASE;
    const doseAt = (statistic: RiStatistic): number | undefined => (release ? familyDose(ri, family, statistic).rem : 0);
    const row: RiFcFamily = { view, release, reason: "" };
    const freqMean = frequencyAt(family.frequency, "MEAN");
    const freqLow = frequencyAt(family.frequency, "P05");
    const freqHigh = frequencyAt(family.frequency, "P95");
    const doseMean = doseAt("MEAN");
    const doseLow = doseAt("P05");
    const doseHigh = doseAt("P95");
    if (freqMean !== undefined) row.freqMean = freqMean;
    if (freqLow !== undefined) row.freqLow = freqLow;
    if (freqHigh !== undefined) row.freqHigh = freqHigh;
    if (doseMean !== undefined) row.doseMean = doseMean;
    if (doseLow !== undefined) row.doseLow = doseLow;
    if (doseHigh !== undefined) row.doseHigh = doseHigh;

    const fcFrequency = frequencyAt(family.frequency, a.fcStatistic.value);
    const fcDose = doseAt(a.fcStatistic.value);
    if (fcFrequency !== undefined && fcDose !== undefined) {
      const target = fcDose === 0 ? undefined : targetFrequencyAt(anchors, fcDose);
      row.withinTarget = fcDose === 0 || (target !== undefined && fcFrequency <= target);
    }

    const sigFrequency = frequencyAt(family.frequency, a.lbeFrequencyStatistic.value);
    const sigDose = doseAt(a.lbeDoseStatistic.value);
    if (sigFrequency !== undefined) row.sigFrequency = sigFrequency;
    if (sigDose !== undefined) row.sigDose = sigDose;
    if (sigDose !== undefined && sigDose <= floorRem) {
      row.significant = false;
      row.reason = release ? `${doseLabel} dose at or below the ${a.lbeDoseFloorMrem.value} mrem floor` : "No release, so below the dose floor";
    } else if (sigFrequency === undefined) {
      row.reason = `No ${freqLabel} frequency to test`;
    } else if (sigDose === undefined) {
      row.reason = `No ${doseLabel} dose to test`;
    } else {
      const target = targetFrequencyAt(anchors, sigDose);
      if (target === undefined) {
        row.reason = "No target at this dose";
      } else {
        row.share = sigFrequency / target;
        row.significant = row.share >= percent / 100;
        row.reason = row.significant
          ? `${freqLabel} point within ${percent}% of the target, dose above ${a.lbeDoseFloorMrem.value} mrem`
          : `${freqLabel} frequency below ${percent}% of the target`;
      }
    }

    const marginMean = fcMargin(anchors, freqMean, doseMean);
    const marginHigh = fcMargin(anchors, freqHigh, doseHigh);
    if (marginMean !== undefined) row.marginMean = marginMean;
    if (marginHigh !== undefined) row.marginHigh = marginHigh;
    return row;
  });
}

const CUMULATIVE_ROLES: Record<RiCumulativeTargetId, { role: RiMeasureRole; thresholdRem?: number }> = {
  DOSE_100_MREM_EXCEEDANCE: { role: "EAB_DOSE", thresholdRem: 0.1 },
  EARLY_FATALITY_RISK: { role: "EARLY_FATALITY_RISK" },
  LATENT_CANCER_RISK: { role: "LATENT_CANCER_RISK" },
};

interface RiMetricRow {
  family: RiInputFamily;
  frequency?: number;
  conditional?: number;
  category?: string;
  contribution?: number;
  missing: boolean;
}

interface RiIntegratedMetric {
  key: string;
  label: string;
  unit: string;
  measureName?: string;
  targetId?: RiCumulativeTargetId;
  limit?: number;
  rows: RiMetricRow[];
  total: number;
  missing: string[];
}

function exceedanceAt(consequence: RiInputConsequence, thresholdRem: number): number | undefined {
  const factor = remPerUnit(consequence.unit);
  if (factor === undefined) return undefined;
  return consequence.statistics.exceedances.find((x) => Math.abs(x.threshold * factor - thresholdRem) <= 1e-9 * Math.max(1, thresholdRem))?.probability;
}

function integratedMetric(
  ri: RiskIntegration,
  key: string,
  label: string,
  unit: string,
  measureName: string | undefined,
  statistic: RiStatistic,
  pick: (consequence: RiInputConsequence) => number | undefined,
): RiIntegratedMetric {
  const consequences = ri.inputs?.consequences ?? [];
  const rows: RiMetricRow[] = [];
  for (const family of ri.inputs?.families ?? []) {
    if (!family.included) continue;
    const frequency = frequencyAt(family.frequency, statistic);
    const row: RiMetricRow = { family, missing: false };
    if (frequency !== undefined) row.frequency = frequency;
    if (family.endState !== EndState.RADIONUCLIDE_RELEASE) {
      row.conditional = 0;
      row.contribution = 0;
      rows.push(row);
      continue;
    }
    let best: { value: number; category: string } | undefined;
    let missingData = measureName === undefined || family.releaseCategoryIds.length === 0 || frequency === undefined;
    for (const category of family.releaseCategoryIds) {
      const result = consequences.find((c) => c.releaseCategoryId === category && c.measure === measureName);
      const value = result === undefined ? undefined : pick(result);
      if (value === undefined) {
        missingData = true;
        continue;
      }
      if (best === undefined || value > best.value) best = { value, category };
    }
    row.missing = missingData;
    if (!missingData && best !== undefined && frequency !== undefined) {
      row.conditional = best.value;
      row.category = best.category;
      row.contribution = frequency * best.value;
    }
    rows.push(row);
  }
  const metric: RiIntegratedMetric = {
    key,
    label,
    unit,
    rows,
    total: rows.reduce((sum, r) => sum + (r.contribution ?? 0), 0),
    missing: rows.filter((r) => r.missing).map((r) => r.family.id),
  };
  if (measureName !== undefined) metric.measureName = measureName;
  return metric;
}

function cumulativeMetrics(ri: RiskIntegration, at?: RiStatistic): RiIntegratedMetric[] {
  const a = criteriaSetOf(ri).absolute;
  const statistic = at ?? a.cumulativeStatistic.value;
  const measures = ri.scopeDefinition.consequenceMeasures;
  return a.cumulativeTargets.map((target) => {
    const spec = CUMULATIVE_ROLES[target.id];
    const measure = measures.find((m) => m.role === spec.role);
    const threshold = spec.thresholdRem;
    const pick = threshold === undefined
      ? (c: RiInputConsequence): number | undefined => consequenceAt(c.statistics, statistic)
      : (c: RiInputConsequence): number | undefined => exceedanceAt(c, threshold);
    const metric = integratedMetric(ri, target.id, CUMULATIVE_TARGET_SPECS[target.id].label, "per plant-year", measure?.name, statistic, pick);
    return { ...metric, targetId: target.id, limit: target.limitPerPlantYear };
  });
}

function measureTotals(ri: RiskIntegration): RiIntegratedMetric[] {
  const statistic = criteriaSetOf(ri).absolute.cumulativeStatistic.value;
  return ri.scopeDefinition.consequenceMeasures.map((m) => {
    const unit = ri.inputs?.consequences.find((c) => c.measure === m.name)?.unit ?? "";
    return integratedMetric(ri, `measure:${m.name}`, m.name, unit.length > 0 ? `${unit} per plant-year` : "per plant-year", m.name, statistic, (c) => consequenceAt(c.statistics, statistic));
  });
}

function integratedRiskMetrics(ri: RiskIntegration): RiIntegratedMetric[] {
  if (appTypeFromMef(ri) === "baseline_risk") return measureTotals(ri);
  const targets = cumulativeMetrics(ri);
  const covered = targets.filter((t) => t.targetId !== "DOSE_100_MREM_EXCEEDANCE").map((t) => t.measureName);
  return [...targets, ...measureTotals(ri).filter((m) => !covered.includes(m.measureName))];
}

function contributionMetrics(ri: RiskIntegration): RiIntegratedMetric[] {
  return appTypeFromMef(ri) === "baseline_risk" ? measureTotals(ri) : cumulativeMetrics(ri);
}

type RiContributionDimension = "family" | "category" | "state" | "hazard" | "source" | "initiating" | "sequence";

const NOT_ATTRIBUTED = "Not attributed";
const NOT_RECORDED = "Not recorded in ES";

function hazardGroupOf(ri: RiskIntegration, initiatingEventId: string): string {
  const assigned = ri.integratedRiskResults.hazardGroupAssignments?.find((h) => sameItem(h.initiatingEventId, initiatingEventId));
  if (assigned !== undefined) return assigned.hazardGroup;
  const groups = includedList(ri, "HAZARD_GROUP");
  const only = groups[0];
  return groups.length === 1 && only !== undefined ? only : NOT_ATTRIBUTED;
}

function familyWeights(
  ri: RiskIntegration,
  family: RiInputFamily,
  dimension: RiContributionDimension,
  category: string | undefined,
  sequencesById: Map<string, RiInputSequence>,
): Map<string, number> {
  const weights = new Map<string, number>();
  const add = (key: string, weight: number): void => {
    weights.set(key, (weights.get(key) ?? 0) + weight);
  };
  if (dimension === "family") {
    add(family.id, 1);
    return weights;
  }
  if (dimension === "category") {
    add(category ?? "No release", 1);
    return weights;
  }
  let total = 0;
  for (const id of family.memberSequenceIds) {
    const sequence = sequencesById.get(id);
    const weight = sequence?.frequency?.mean ?? 0;
    if (sequence === undefined || !(weight > 0)) continue;
    total += weight;
    if (dimension === "state") add(sequence.plantOperatingStateId, weight);
    else if (dimension === "hazard") add(hazardGroupOf(ri, sequence.initiatingEventId), weight);
    else if (dimension === "initiating") add(sequence.initiatingEventId, weight);
    else if (dimension === "sequence") add(sequence.id, weight);
    else if (sequence.reactorSourceCombinations.length === 0) add(NOT_RECORDED, weight);
    else for (const combination of sequence.reactorSourceCombinations) add(combination, weight / sequence.reactorSourceCombinations.length);
  }
  if (total > 0) {
    for (const [key, weight] of weights) weights.set(key, weight / total);
    return weights;
  }
  if (dimension === "state") add(family.plantOperatingStateId, 1);
  else if (dimension === "hazard") add(hazardGroupOf(ri, family.initiatingEventId), 1);
  else if (dimension === "initiating") add(family.initiatingEventId, 1);
  else if (dimension === "sequence") add(`${family.id}, no sequence data`, 1);
  else add(NOT_RECORDED, 1);
  return weights;
}

interface RiContributionRow {
  key: string;
  values: number[];
}

function contributionsBy(ri: RiskIntegration, metrics: RiIntegratedMetric[], dimension: RiContributionDimension): RiContributionRow[] {
  const sequencesById = new Map((ri.inputs?.sequences ?? []).map((s): [string, RiInputSequence] => [s.id, s]));
  const table = new Map<string, number[]>();
  metrics.forEach((metric, index) => {
    for (const row of metric.rows) {
      const contribution = row.contribution;
      if (contribution === undefined || !(contribution > 0)) continue;
      for (const [key, weight] of familyWeights(ri, row.family, dimension, row.category, sequencesById)) {
        const values = table.get(key) ?? metrics.map(() => 0);
        values[index] = (values[index] ?? 0) + contribution * weight;
        table.set(key, values);
      }
    }
  });
  return [...table.entries()].map(([key, values]) => ({ key, values })).sort((a, b) => (b.values[0] ?? 0) - (a.values[0] ?? 0));
}

function initiatingEventGroups(ri: RiskIntegration): string[] {
  const inputs = ri.inputs;
  if (inputs === undefined) return [];
  const sequencesById = new Map(inputs.sequences.map((s): [string, RiInputSequence] => [s.id, s]));
  const ids = new Set<string>();
  for (const family of inputs.families) {
    if (!family.included) continue;
    ids.add(family.initiatingEventId);
    for (const id of family.memberSequenceIds) {
      const sequence = sequencesById.get(id);
      if (sequence !== undefined) ids.add(sequence.initiatingEventId);
    }
  }
  return [...ids].filter((id) => id.length > 0).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function withHazardAssignment(ri: RiskIntegration, initiatingEventId: string, hazardGroup: string | undefined): RiskIntegration {
  const others = (ri.integratedRiskResults.hazardGroupAssignments ?? []).filter((h) => !sameItem(h.initiatingEventId, initiatingEventId));
  const hazardGroupAssignments = hazardGroup === undefined ? others : [...others, { initiatingEventId, hazardGroup }];
  return { ...ri, integratedRiskResults: { ...ri.integratedRiskResults, hazardGroupAssignments } };
}

function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

type RiDistribution = { kind: "lognormal"; mu: number; sigma: number } | { kind: "point"; value: number };

function conditionalDistribution(stats: RiConsequenceStats): RiDistribution | undefined {
  const p05 = consequenceAt(stats, "P05");
  const p50 = consequenceAt(stats, "P50");
  const p95 = consequenceAt(stats, "P95");
  if (p05 !== undefined && p95 !== undefined && p05 > 0 && p95 > p05) {
    return { kind: "lognormal", mu: (Math.log(p05) + Math.log(p95)) / 2, sigma: (Math.log(p95) - Math.log(p05)) / (2 * Z95) };
  }
  if (p50 !== undefined && p95 !== undefined && p50 > 0 && p95 > p50) {
    return { kind: "lognormal", mu: Math.log(p50), sigma: (Math.log(p95) - Math.log(p50)) / Z95 };
  }
  const known = [p05, p50, p95].filter((v): v is number => v !== undefined);
  const single = known[0];
  if (single !== undefined && single > 0 && known.every((v) => v === single)) return { kind: "point", value: single };
  return undefined;
}

function chanceAbove(distribution: RiDistribution, value: number): number {
  if (distribution.kind === "point") return value < distribution.value ? 1 : 0;
  if (!(value > 0)) return 1;
  return 0.5 * erfc((Math.log(value) - distribution.mu) / (distribution.sigma * Math.SQRT2));
}

function distributionRange(distribution: RiDistribution): [number, number] {
  if (distribution.kind === "point") return [distribution.value / 3, distribution.value * 3];
  return [Math.exp(distribution.mu - 3 * distribution.sigma), Math.exp(distribution.mu + 3 * distribution.sigma)];
}

interface RiExceedanceCurve {
  measureName: string;
  unit: string;
  factor: number;
  points: { value: number; frequency: number }[];
  missing: string[];
}

function displayUnit(unit: string): { unit: string; factor: number } {
  const rem = remPerUnit(unit);
  if (rem !== undefined) return { unit: "rem", factor: rem };
  if (unit === "person-Sv") return { unit: "person-rem", factor: 100 };
  return { unit, factor: 1 };
}

function curveMeasures(ri: RiskIntegration): string[] {
  const consequences = ri.inputs?.consequences ?? [];
  return ri.scopeDefinition.consequenceMeasures
    .map((m) => m.name)
    .filter((name) => consequences.some((c) => c.measure === name && conditionalDistribution(c.statistics)?.kind === "lognormal"));
}

function exceedanceCurve(ri: RiskIntegration, measureName: string): RiExceedanceCurve {
  const consequences = ri.inputs?.consequences ?? [];
  const statistic = criteriaSetOf(ri).absolute.cumulativeStatistic.value;
  const display = displayUnit(consequences.find((c) => c.measure === measureName)?.unit ?? "");
  const parts: { frequency: number; fits: RiDistribution[] }[] = [];
  const missing: string[] = [];
  for (const family of ri.inputs?.families ?? []) {
    if (!family.included || family.endState !== EndState.RADIONUCLIDE_RELEASE) continue;
    const frequency = frequencyAt(family.frequency, statistic);
    const fits = family.releaseCategoryIds.map((category) => {
      const result = consequences.find((c) => c.releaseCategoryId === category && c.measure === measureName);
      return result === undefined ? undefined : conditionalDistribution(result.statistics);
    });
    const known = fits.filter((f): f is RiDistribution => f !== undefined);
    if (frequency === undefined || known.length === 0 || known.length < fits.length) {
      missing.push(family.id);
      continue;
    }
    parts.push({ frequency, fits: known });
  }
  const curve: RiExceedanceCurve = { measureName, unit: display.unit, factor: display.factor, points: [], missing };
  if (parts.length === 0) return curve;
  const lows = parts.flatMap((p) => p.fits.map((f) => distributionRange(f)[0]));
  const highs = parts.flatMap((p) => p.fits.map((f) => distributionRange(f)[1]));
  const start = Math.floor(lg(Math.min(...lows)));
  const end = Math.ceil(lg(Math.max(...highs)));
  const steps = Math.max(1, (end - start) * 16);
  for (let i = 0; i <= steps; i += 1) {
    const value = Math.pow(10, start + ((end - start) * i) / steps);
    const frequency = parts.reduce((sum, p) => sum + p.frequency * Math.max(...p.fits.map((f) => chanceAbove(f, value))), 0);
    if (frequency > 0) curve.points.push({ value: value * display.factor, frequency });
  }
  return curve;
}

type RiAggregation = RiskIntegration["integratedRiskResults"]["aggregationApproach"];

function withAggregation(ri: RiskIntegration, fn: (a: RiAggregation) => RiAggregation): RiskIntegration {
  return { ...ri, integratedRiskResults: { ...ri.integratedRiskResults, aggregationApproach: fn(ri.integratedRiskResults.aggregationApproach) } };
}

function reviewScopeItems(ri: RiskIntegration): { scope: string; kind: "Hazard group" | "Source" }[] {
  return [
    ...includedList(ri, "HAZARD_GROUP").map((scope) => ({ scope, kind: "Hazard group" as const })),
    ...includedList(ri, "SOURCE").map((scope) => ({ scope, kind: "Source" as const })),
  ];
}

function detailNoteOf(ri: RiskIntegration, scope: string): string | undefined {
  return ri.integratedRiskResults.aggregationApproach.detailConservatismDifferences?.find((d) => sameItem(d.scope, scope))?.description;
}

function withDetailNote(ri: RiskIntegration, scope: string, description: string): RiskIntegration {
  return withAggregation(ri, (a) => {
    const list = a.detailConservatismDifferences ?? [];
    const exists = list.some((d) => sameItem(d.scope, scope));
    const next = description.trim().length === 0
      ? list.filter((d) => !sameItem(d.scope, scope))
      : exists ? list.map((d) => (sameItem(d.scope, scope) ? { scope: d.scope, description } : d)) : [...list, { scope, description }];
    return { ...a, detailConservatismDifferences: next };
  });
}

function aggregationIssues(ri: RiskIntegration): string[] {
  const a = ri.integratedRiskResults.aggregationApproach;
  const issues: string[] = [];
  if (missing(a.description)) issues.push("Describe how the results are aggregated.");
  for (const item of reviewScopeItems(ri)) {
    if (missing(detailNoteOf(ri, item.scope))) issues.push(`Add the detail and conservatism note for ${item.scope}.`);
  }
  if (a.separateReviewPerformed === undefined) issues.push("Say whether a separate review was done.");
  if (a.separateReviewPerformed === true && missing(a.separateReviewFindings)) issues.push("Record the separate review findings.");
  if (missing(a.justification)) issues.push("Give the justification.");
  if (includedList(ri, "HAZARD_GROUP").length > 1 && initiatingEventGroups(ri).some((id) => hazardGroupOf(ri, id) === NOT_ATTRIBUTED)) {
    issues.push("Assign every initiating event group to a hazard group.");
  }
  return issues;
}

interface RiRanked {
  key: string;
  value: number;
  detail?: string;
}

type RiBreakdownId =
  | "state" | "hazard" | "initiating"
  | "category" | "family" | "sequence"
  | "equipment" | "ccf" | "human" | "maintenance"
  | "function" | "basicEvent" | "eventCategory"
  | "source";

interface RiBreakdownItem {
  id: RiBreakdownId;
  group: "a" | "b" | "c" | "d" | "e";
  label: string;
  ranked: RiRanked[];
  note?: string;
}

const CONTRIBUTOR_TYPE_LABELS: Record<string, string> = {
  CCF: "Common-cause failures",
  HUMAN_FAILURE_EVENT: "Human failure events",
  EQUIPMENT_FAILURE: "Equipment failures",
  BASIC_EVENT: "Basic events",
  INITIATING_EVENT: "Initiating events",
  MAINTENANCE_UNAVAILABILITY: "Maintenance unavailability",
  OTHER: "Other contributors",
  BARRIER_FAILURE_MODE: "Barrier failure modes",
};

const BASIC_EVENT_TYPES = ["CCF", "HUMAN_FAILURE_EVENT", "EQUIPMENT_FAILURE", "BASIC_EVENT", "MAINTENANCE_UNAVAILABILITY"];

const SSC_TYPES = ["CCF", "EQUIPMENT_FAILURE", "BASIC_EVENT", "MAINTENANCE_UNAVAILABILITY"];

function contributorTypeLabel(type: string): string {
  return CONTRIBUTOR_TYPE_LABELS[type] ?? type;
}

function ranked(map: Map<string, number>, detail?: Map<string, string>): RiRanked[] {
  return [...map.entries()]
    .filter(([, value]) => value > 0)
    .map(([key, value]): RiRanked => {
      const row: RiRanked = { key, value };
      const text = detail?.get(key);
      if (text !== undefined) row.detail = text;
      return row;
    })
    .sort((a, b) => b.value - a.value);
}

function contributorValues(ri: RiskIntegration, metric: RiIntegratedMetric): Map<string, { type: string; value: number }> {
  const records = ri.inputs?.contributors ?? [];
  const byFamily = new Map(metric.rows.map((row): [string, number] => [row.family.id, row.contribution ?? 0]));
  const partTotals = new Map<string, number>();
  const seen = new Set<string>();
  for (const record of records) {
    if (record.manual !== undefined || seen.has(record.quantificationId)) continue;
    seen.add(record.quantificationId);
    partTotals.set(record.familyId, (partTotals.get(record.familyId) ?? 0) + record.quantificationMean);
  }
  const values = new Map<string, { type: string; value: number }>();
  for (const record of records) {
    const familyValue = byFamily.get(record.familyId) ?? 0;
    const partTotal = partTotals.get(record.familyId) ?? 0;
    if (!(familyValue > 0) || (record.manual === undefined && !(partTotal > 0))) continue;
    const value = record.manual !== undefined ? familyValue * record.fraction : familyValue * (record.quantificationMean / partTotal) * record.fraction;
    const current = values.get(record.name);
    values.set(record.name, { type: current?.type ?? record.type, value: (current?.value ?? 0) + value });
  }
  return values;
}

function functionValues(ri: RiskIntegration, metric: RiIntegratedMetric): Map<string, number> {
  const sequencesById = new Map((ri.inputs?.sequences ?? []).map((s): [string, RiInputSequence] => [s.id, s]));
  const values = new Map<string, number>();
  for (const row of metric.rows) {
    const contribution = row.contribution ?? 0;
    if (!(contribution > 0)) continue;
    const members = row.family.memberSequenceIds.map((id) => sequencesById.get(id)).filter((s): s is RiInputSequence => s !== undefined);
    const total = members.reduce((sum, s) => sum + (s.frequency?.mean ?? 0), 0);
    if (!(total > 0)) continue;
    for (const sequence of members) {
      const share = (sequence.frequency?.mean ?? 0) / total;
      if (!(share > 0)) continue;
      for (const event of sequence.topEvents) {
        if (event.state === "FAILURE") values.set(event.event, (values.get(event.event) ?? 0) + contribution * share);
      }
    }
  }
  return values;
}

function breakdownItems(ri: RiskIntegration, metric: RiIntegratedMetric): RiBreakdownItem[] {
  const dimension = (d: RiContributionDimension): RiRanked[] => contributionsBy(ri, [metric], d).map((r) => ({ key: r.key, value: r.values[0] ?? 0 })).filter((r) => r.value > 0);
  const imported = ri.inputs?.contributors !== undefined;
  const contributors = contributorValues(ri, metric);
  const ofTypes = (types: string[]): RiRanked[] => {
    const map = new Map<string, number>();
    const detail = new Map<string, string>();
    for (const [name, entry] of contributors) {
      if (!types.includes(entry.type)) continue;
      map.set(name, entry.value);
      detail.set(name, contributorTypeLabel(entry.type));
    }
    return ranked(map, detail);
  };
  const categories = new Map<string, number>();
  for (const entry of contributors.values()) {
    const label = contributorTypeLabel(entry.type);
    categories.set(label, (categories.get(label) ?? 0) + entry.value);
  }
  const reimport = imported ? undefined : "Import ESQ's contributors in Step 02 or add them by hand there.";
  const withNote = (item: RiBreakdownItem, note: string | undefined): RiBreakdownItem => (note === undefined ? item : { ...item, note });
  const maintenance = ofTypes(["MAINTENANCE_UNAVAILABILITY"]);
  return [
    { id: "state", group: "a", label: "Plant operating state", ranked: dimension("state") },
    { id: "hazard", group: "a", label: "Hazard group", ranked: dimension("hazard") },
    { id: "initiating", group: "a", label: "Initiating event", ranked: dimension("initiating") },
    { id: "category", group: "b", label: "Release category", ranked: dimension("category") },
    { id: "family", group: "b", label: "Event sequence family", ranked: dimension("family") },
    { id: "sequence", group: "b", label: "Individual event sequence", ranked: dimension("sequence") },
    withNote({ id: "equipment", group: "c", label: "Component failures", ranked: ofTypes(["EQUIPMENT_FAILURE", "BASIC_EVENT"]) }, reimport),
    withNote({ id: "ccf", group: "c", label: "Common-cause failures", ranked: ofTypes(["CCF"]) }, reimport),
    withNote({ id: "human", group: "c", label: "Human errors", ranked: ofTypes(["HUMAN_FAILURE_EVENT"]) }, reimport),
    withNote(
      { id: "maintenance", group: "c", label: "Maintenance unavailability", ranked: maintenance },
      reimport ?? (maintenance.length === 0 ? "ESQ reports no maintenance unavailability contributor." : undefined),
    ),
    { id: "function", group: "d", label: "Functions", ranked: ranked(functionValues(ri, metric)) },
    withNote({ id: "basicEvent", group: "d", label: "Basic events", ranked: ofTypes(BASIC_EVENT_TYPES) }, reimport),
    withNote({ id: "eventCategory", group: "d", label: "Basic event categories", ranked: ranked(categories) }, reimport),
    { id: "source", group: "e", label: "Reactors and sources", ranked: dimension("source") },
  ];
}

const BASIC_EVENT_ITEMS: RiBreakdownId[] = ["equipment", "ccf", "human", "maintenance", "basicEvent"];
const SET_RULE_ITEMS: RiBreakdownId[] = ["family", "sequence", "function"];

function absoluteBar(ri: RiskIntegration, metric: RiIntegratedMetric): number | undefined {
  if (appTypeFromMef(ri) !== "fixed_risk_target" || metric.limit === undefined) return undefined;
  return (metric.limit * criteriaSetOf(ri).absolute.sscCumulativePercent.value) / 100;
}

function barMetricOf(ri: RiskIntegration, metric: RiIntegratedMetric): RiIntegratedMetric {
  const a = criteriaSetOf(ri).absolute;
  if (metric.targetId === undefined || a.sscCumulativeStatistic.value === a.cumulativeStatistic.value) return metric;
  return cumulativeMetrics(ri, a.sscCumulativeStatistic.value).find((m) => m.targetId === metric.targetId) ?? metric;
}

function significantLbes(ri: RiskIntegration): Set<string> {
  if (appTypeFromMef(ri) !== "fixed_risk_target") return new Set<string>();
  return new Set(fcFamilies(ri).filter((row) => row.significant === true).map((row) => row.view.family.id));
}

function breakdownSignificance(ri: RiskIntegration, metric: RiIntegratedMetric, item: RiBreakdownItem): (boolean | undefined)[] {
  if (appTypeFromMef(ri) === "fixed_risk_target") {
    const bar = absoluteBar(ri, metric);
    if (bar === undefined) return item.ranked.map(() => undefined);
    const barMetric = barMetricOf(ri, metric);
    if (barMetric === metric) return item.ranked.map((r) => r.value > bar);
    const values = new Map((breakdownItems(ri, barMetric).find((i) => i.id === item.id)?.ranked ?? []).map((r): [string, number] => [r.key, r.value]));
    return item.ranked.map((r) => (values.get(r.key) ?? 0) > bar);
  }
  const relative = criteriaSetOf(ri).relative;
  const total = metric.total;
  if (!(total > 0)) return item.ranked.map(() => undefined);
  if (BASIC_EVENT_ITEMS.includes(item.id)) return item.ranked.map((r) => r.value / total > relative.fussellVesely.value);
  if (!SET_RULE_ITEMS.includes(item.id)) return item.ranked.map(() => undefined);
  let cumulative = 0;
  return item.ranked.map((r) => {
    const share = r.value / total;
    const inSet = cumulative < relative.aggregatePercent.value / 100;
    cumulative += share;
    return inSet || share > relative.individualPercent.value / 100;
  });
}

function sscContributors(ri: RiskIntegration): { name: string; type: string }[] {
  const seen = new Map<string, string>();
  for (const record of ri.inputs?.contributors ?? []) {
    if (SSC_TYPES.includes(record.type) && !seen.has(record.name)) seen.set(record.name, record.type);
  }
  return [...seen.entries()].map(([name, type]) => ({ name, type }));
}

function sscOf(ri: RiskIntegration, contributor: string): string | undefined {
  const ssc = ri.sscAssignments?.find((a) => sameItem(a.contributor, contributor))?.ssc;
  return ssc === undefined || ssc.trim().length === 0 ? undefined : ssc;
}

function withSscAssignment(ri: RiskIntegration, contributor: string, ssc: string): RiskIntegration {
  const others = (ri.sscAssignments ?? []).filter((a) => !sameItem(a.contributor, contributor));
  return { ...ri, sscAssignments: ssc.trim().length === 0 ? others : [...others, { contributor, ssc }] };
}

interface RiSscGroup {
  ssc: string;
  members: string[];
  value: number;
}

const NOT_ASSIGNED = "Not assigned";

function sscGroups(ri: RiskIntegration, metric: RiIntegratedMetric): RiSscGroup[] {
  const values = contributorValues(ri, metric);
  const groups = new Map<string, RiSscGroup>();
  for (const contributor of sscContributors(ri)) {
    const ssc = sscOf(ri, contributor.name) ?? NOT_ASSIGNED;
    const group = groups.get(ssc) ?? { ssc, members: [], value: 0 };
    group.members.push(contributor.name);
    group.value += values.get(contributor.name)?.value ?? 0;
    groups.set(ssc, group);
  }
  return [...groups.values()].sort((a, b) => b.value - a.value);
}

function nextId(prefix: string, ids: string[]): string {
  let next = 1;
  for (const id of ids) {
    if (!id.startsWith(`${prefix}-`)) continue;
    const value = Number(id.slice(prefix.length + 1));
    if (Number.isInteger(value) && value >= next) next = value + 1;
  }
  return `${prefix}-${next}`;
}

function elementTypeOf(code: string): TechnicalElementTypes | undefined {
  return Object.values(TechnicalElementTypes).find((type) => ELEMENT_CODE_BY_TYPE[type] === code);
}

interface RiRegisterCandidate {
  element: TechnicalElementTypes;
  name: string;
  description: string;
  assumptions: string[];
}

function registerCandidates(upstream: RiUpstream): RiRegisterCandidate[] {
  const out: RiRegisterCandidate[] = [];
  const push = (element: TechnicalElementTypes | undefined, name: string, description: string, assumptions: string[]): void => {
    if (element !== undefined && name.trim().length > 0) out.push({ element, name, description, assumptions });
  };
  for (const a of upstream.esq?.modelUncertaintySourceAssessments ?? []) push(elementTypeOf(a.sourceElementCode), a.uncertaintySource, a.effectOnFamilyFrequencies, a.relatedAssumptions);
  for (const a of upstream.ms?.modelUncertaintyAssessments ?? []) push(TechnicalElementTypes.MECHANISTIC_SOURCE_TERM_ANALYSIS, a.uncertaintySource, a.consequenceEffect, a.relatedAssumptions);
  for (const a of upstream.rc?.consequenceQuantification.modelUncertaintyAssessments ?? []) push(TechnicalElementTypes.CONSEQUENCE_ANALYSIS, a.uncertaintySource, a.effectOnMetrics, a.relatedAssumptions);
  return out;
}

function newRegisterCandidates(ri: RiskIntegration, upstream: RiUpstream): RiRegisterCandidate[] {
  return registerCandidates(upstream).filter((c) => !ri.modelUncertaintySources.some((u) => u.originatingElement === c.element && sameItem(u.name, c.name)));
}

function withImportedRegister(ri: RiskIntegration, upstream: RiUpstream): RiskIntegration {
  const added: ModelUncertaintySource[] = [];
  const ids = ri.modelUncertaintySources.map((u) => u.uuid);
  for (const c of newRegisterCandidates(ri, upstream)) {
    const uuid = nextId("MU", [...ids, ...added.map((a) => a.uuid)]);
    const entry: ModelUncertaintySource = {
      uuid,
      name: c.name,
      description: c.description,
      originatingElement: c.element,
      affectedMetrics: [],
      impactAssessment: "",
      implementsSrs: [{ sr: "RI-C1", hlr: "C" }, { sr: "RI-C3", hlr: "C" }],
    };
    if (c.assumptions.length > 0) entry.relatedAssumptions = [...c.assumptions];
    added.push(entry);
  }
  return added.length === 0 ? ri : { ...ri, modelUncertaintySources: [...ri.modelUncertaintySources, ...added] };
}

type RiScreenedType = ScreenedItemLedgerEntry["itemType"];
type RiScreeningCode = ScreenedItemLedgerEntry["screeningElementCode"];

interface RiScreenCandidate {
  itemType: RiScreenedType;
  itemRef: string;
  code: RiScreeningCode;
  basis: string;
  impact?: string;
}

function screeningCandidates(upstream: RiUpstream): RiScreenCandidate[] {
  const out: RiScreenCandidate[] = [];
  const push = (candidate: RiScreenCandidate): void => {
    if (!out.some((c) => c.itemType === candidate.itemType && sameItem(c.itemRef, candidate.itemRef))) out.push(candidate);
  };
  for (const r of upstream.pos?.screeningRecords ?? []) {
    if (!r.retained) push({ itemType: "PLANT_OPERATING_STATE", itemRef: r.posId, code: "POS", basis: r.justification });
  }
  for (const r of upstream.es?.screeningRecords ?? []) {
    if (!r.retained) push({ itemType: "EVENT_SEQUENCE", itemRef: r.sequenceId, code: "ES", basis: r.justification });
  }
  for (const sequence of upstream.es?.eventSequences ?? []) {
    if (sequence.screeningStatus === ScreeningStatus.SCREENED_OUT) push({ itemType: "EVENT_SEQUENCE", itemRef: sequence.uuid, code: "ES", basis: sequence.screeningBasis ?? "" });
  }
  const screened = upstream.esq?.screenedEventCumulativeAssessment;
  for (const ref of screened?.screenedInitiatingEventRefs ?? []) {
    push({ itemType: "INITIATING_EVENT", itemRef: ref, code: "IE", basis: screened?.basis ?? "", impact: screened?.cumulativeImpactAssessment });
  }
  return out;
}

function newScreeningCandidates(ri: RiskIntegration, upstream: RiUpstream): RiScreenCandidate[] {
  const ledger = ri.screenedItemsLedger ?? [];
  return screeningCandidates(upstream).filter((c) => !ledger.some((s) => s.itemType === c.itemType && sameItem(s.itemRef, c.itemRef)));
}

function withImportedScreening(ri: RiskIntegration, upstream: RiUpstream): RiskIntegration {
  const ledger = ri.screenedItemsLedger ?? [];
  const added: ScreenedItemLedgerEntry[] = [];
  for (const c of newScreeningCandidates(ri, upstream)) {
    const entry: ScreenedItemLedgerEntry = {
      uuid: nextId("SL", [...ledger.map((s) => s.uuid), ...added.map((a) => a.uuid)]),
      itemType: c.itemType,
      itemRef: c.itemRef,
      screeningElementCode: c.code,
      screeningBasis: c.basis,
      implementsSrs: [{ sr: "RI-C1", hlr: "C" }],
    };
    if (c.impact !== undefined && c.impact.trim().length > 0) entry.impactOnRiskMetrics = c.impact;
    added.push(entry);
  }
  return added.length === 0 ? ri : { ...ri, screenedItemsLedger: [...ledger, ...added] };
}

function sharedReleaseCategories(ri: RiskIntegration): { category: string; families: string[] }[] {
  const byCategory = new Map<string, string[]>();
  for (const family of ri.inputs?.families ?? []) {
    if (!family.included) continue;
    for (const category of family.releaseCategoryIds) byCategory.set(category, [...(byCategory.get(category) ?? []), family.id]);
  }
  return [...byCategory.entries()].filter(([, families]) => families.length > 1).map(([category, families]) => ({ category, families }));
}

function groupingIssues(ri: RiskIntegration): string[] {
  const g = ri.groupingAdequacyReview;
  const issues: string[] = [];
  if (missing(g.variationNotSignificantJustification)) issues.push("Justify that the variations within each family are not risk-significant.");
  if (missing(g.releaseCategorySelectionSufficiency)) issues.push("Say why the release categories are sufficient.");
  if (missing(g.familyAssignmentSufficiency)) issues.push("Say why the family assignments are sufficient.");
  if (!g.groupingUncertaintyReview.performed) issues.push("Review the grouping uncertainty.");
  else if (missing(g.groupingUncertaintyReview.findings)) issues.push("Record the grouping review findings.");
  return issues;
}

function frequencyDistribution(stats: RiFrequencyStats | undefined): RiDistribution | undefined {
  if (stats === undefined) return undefined;
  const { mean, p05, p50, p95 } = stats;
  if (p05 !== undefined && p95 !== undefined && p05 > 0 && p95 > p05) {
    return { kind: "lognormal", mu: (Math.log(p05) + Math.log(p95)) / 2, sigma: (Math.log(p95) - Math.log(p05)) / (2 * Z95) };
  }
  if (p50 !== undefined && p95 !== undefined && p50 > 0 && p95 > p50) {
    return { kind: "lognormal", mu: Math.log(p50), sigma: (Math.log(p95) - Math.log(p50)) / Z95 };
  }
  return mean > 0 ? { kind: "point", value: mean } : undefined;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalSampler(random: () => number): () => number {
  return () => {
    const u = Math.max(random(), Number.MIN_VALUE);
    const v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

function draw(distribution: RiDistribution, normal: () => number): number {
  return distribution.kind === "point" ? distribution.value : Math.exp(distribution.mu + distribution.sigma * normal());
}

interface RiPropagated {
  metric: RiIntegratedMetric;
  mean: number;
  p05: number;
  p50: number;
  p95: number;
  standardError: number;
}

const PROPAGATION_SAMPLES = 10000;
const PROPAGATION_SEED = 20260930;

function propagateTotals(ri: RiskIntegration): RiPropagated[] {
  const metrics = integratedRiskMetrics(ri);
  const consequences = ri.inputs?.consequences ?? [];
  const families = (ri.inputs?.families ?? []).filter((f) => f.included);
  const frequencyOf = new Map<string, RiDistribution>();
  for (const f of families) {
    const d = frequencyDistribution(f.frequency);
    if (d !== undefined) frequencyOf.set(f.id, d);
  }
  const valueOf = new Map<string, RiDistribution>();
  const terms = metrics.map((metric) => metric.rows.flatMap((row) => {
    const frequency = frequencyOf.get(row.family.id);
    if (frequency === undefined || row.contribution === undefined || !(row.contribution > 0) || row.conditional === undefined) return [];
    const key = `${metric.key}|${row.category ?? row.family.id}`;
    if (!valueOf.has(key)) {
      const result = consequences.find((c) => c.releaseCategoryId === row.category && c.measure === metric.measureName);
      const fitted = metric.targetId === "DOSE_100_MREM_EXCEEDANCE" || result === undefined ? undefined : conditionalDistribution(result.statistics);
      valueOf.set(key, fitted ?? { kind: "point", value: row.conditional });
    }
    return [{ familyId: row.family.id, key }];
  }));
  const random = seededRandom(PROPAGATION_SEED);
  const normal = normalSampler(random);
  const totals = metrics.map(() => new Float64Array(PROPAGATION_SAMPLES));
  const freqKeys = [...frequencyOf.keys()];
  const valueKeys = [...valueOf.keys()];
  const freqSample = new Map<string, number>();
  const valueSample = new Map<string, number>();
  for (let i = 0; i < PROPAGATION_SAMPLES; i += 1) {
    for (const id of freqKeys) {
      const d = frequencyOf.get(id);
      if (d !== undefined) freqSample.set(id, draw(d, normal));
    }
    for (const key of valueKeys) {
      const d = valueOf.get(key);
      if (d !== undefined) valueSample.set(key, draw(d, normal));
    }
    terms.forEach((list, m) => {
      let total = 0;
      for (const term of list) total += (freqSample.get(term.familyId) ?? 0) * (valueSample.get(term.key) ?? 0);
      const bucket = totals[m];
      if (bucket !== undefined) bucket[i] = total;
    });
  }
  return metrics.map((metric, m) => {
    const values = totals[m] ?? new Float64Array(0);
    const sorted = Float64Array.from(values).sort();
    const at = (q: number): number => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / Math.max(1, values.length);
    const variance = values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / Math.max(1, values.length - 1);
    return { metric, mean, p05: at(0.05), p50: at(0.5), p95: at(0.95), standardError: Math.sqrt(variance / Math.max(1, values.length)) };
  });
}

function analysisTotalOf(ri: RiskIntegration, metric: string): string | undefined {
  const totals = integratedRiskMetrics(ri);
  const byLabel = totals.find((t) => sameItem(t.label, metric));
  if (byLabel !== undefined) return byLabel.label;
  const measure = ri.scopeDefinition.consequenceMeasures.find((m) => sameItem(m.name, metric) || m.quantity === metric);
  if (measure === undefined) return undefined;
  const matches = totals.filter((t) => t.measureName === measure.name);
  return (matches.find((t) => sameItem(t.label, measure.name)) ?? matches[0])?.label;
}

function registerIssues(ri: RiskIntegration): string[] {
  const issues: string[] = [];
  if (ri.modelUncertaintySources.length === 0) issues.push("Compile the model uncertainties.");
  for (const u of ri.modelUncertaintySources) {
    if (missing(u.impactAssessment) || u.affectedMetrics.length === 0) issues.push(`Assess ${u.name.trim().length > 0 ? u.name : u.uuid}.`);
  }
  for (const s of ri.screenedItemsLedger ?? []) {
    if (missing(s.screeningBasis)) issues.push(`Give the screening basis for ${s.itemRef.trim().length > 0 ? s.itemRef : s.uuid}.`);
  }
  return issues;
}

function shortMetricLabel(metric: RiIntegratedMetric): string {
  switch (metric.targetId) {
    case "DOSE_100_MREM_EXCEEDANCE": return "Above 100 mrem";
    case "EARLY_FATALITY_RISK": return "Early fatality";
    case "LATENT_CANCER_RISK": return "Latent cancer";
    default: return metric.label;
  }
}

function metricPhrase(metric: RiIntegratedMetric): string {
  switch (metric.targetId) {
    case "DOSE_100_MREM_EXCEEDANCE": return "the 100 mrem frequency";
    case "EARLY_FATALITY_RISK": return "the early fatality risk";
    case "LATENT_CANCER_RISK": return "the latent cancer risk";
    default: return `the total for ${metric.label}`;
  }
}

function targetPhrase(metric: RiIntegratedMetric): string {
  switch (metric.targetId) {
    case "DOSE_100_MREM_EXCEEDANCE": return "100 mrem";
    case "EARLY_FATALITY_RISK": return "early fatality";
    case "LATENT_CANCER_RISK": return "latent cancer";
    default: return metric.label;
  }
}

function listText(items: string[]): string {
  const last = items[items.length - 1];
  if (items.length <= 1 || last === undefined) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${last}`;
}

function countedList(items: string[], shown: number): string {
  return items.length > shown ? `${items.slice(0, shown).join(", ")} and ${items.length - shown} more` : listText(items);
}

const HANDOFF_ELEMENTS = ["POS", "IE", "ES", "SC", "SY", "HR", "DA"] as const;
const HANDOFF_RECEIVERS = ["ESQ", "MS", "RC"] as const;

type RiHandoffElementCode = (typeof HANDOFF_ELEMENTS)[number];
type RiHandoffReceiver = (typeof HANDOFF_RECEIVERS)[number];
type RiHandoffGroup = "family" | "contributor" | "category" | "sourceTerm" | "measure" | "element";

const HANDOFF_GROUPS: RiHandoffGroup[] = ["family", "contributor", "category", "sourceTerm", "measure", "element"];

interface RiHandoffTarget {
  group: RiHandoffGroup;
  key: string;
  label: string;
  derived: ImportanceLevel;
  basis: string;
  shares: string;
  insight: string;
  weight: number;
}

interface RiHandoffEntry {
  riskSignificance?: ImportanceLevel;
  significanceReason?: string;
  insights?: string[];
  recommendations?: string[];
  keyUncertainties?: string[];
  generalFeedback?: string;
}

interface RiHandoffContributor {
  type: string;
  values: Map<string, number>;
  significantIn: string[];
  importance: boolean;
}

interface RiHandoffContext {
  fixed: boolean;
  percent: number;
  metrics: RiIntegratedMetric[];
  items: Map<string, RiBreakdownItem[]>;
  flags: Map<string, Map<RiBreakdownId, Map<string, boolean>>>;
  lbes: Set<string>;
  contributors: Map<string, RiHandoffContributor>;
}

function handoffContext(ri: RiskIntegration): RiHandoffContext {
  const fixed = appTypeFromMef(ri) === "fixed_risk_target";
  const relative = criteriaSetOf(ri).relative;
  const metrics = contributionMetrics(ri);
  const items = new Map<string, RiBreakdownItem[]>();
  const flags = new Map<string, Map<RiBreakdownId, Map<string, boolean>>>();
  const contributors = new Map<string, RiHandoffContributor>();
  for (const metric of metrics) {
    const list = breakdownItems(ri, metric);
    items.set(metric.key, list);
    const byItem = new Map<RiBreakdownId, Map<string, boolean>>();
    for (const item of list) {
      const result = breakdownSignificance(ri, metric, item);
      const map = new Map<string, boolean>();
      item.ranked.forEach((r, index) => {
        const flag = result[index];
        if (flag !== undefined) map.set(r.key, flag);
      });
      byItem.set(item.id, map);
    }
    flags.set(metric.key, byItem);
    const bar = absoluteBar(ri, metric);
    const shown = contributorValues(ri, metric);
    const tested = fixed ? contributorValues(ri, barMetricOf(ri, metric)) : shown;
    for (const [name, entry] of shown) {
      const record = contributors.get(name) ?? { type: entry.type, values: new Map<string, number>(), significantIn: [], importance: false };
      record.values.set(metric.key, entry.value);
      const testValue = tested.get(name)?.value ?? 0;
      const significant = fixed
        ? bar !== undefined && testValue > bar
        : BASIC_EVENT_TYPES.includes(entry.type) && metric.total > 0 && entry.value / metric.total > relative.fussellVesely.value;
      if (significant) record.significantIn.push(metric.key);
      contributors.set(name, record);
    }
  }
  if (!fixed) {
    for (const row of importanceRows(ri)) {
      if (row.significant !== true) continue;
      const name = row.entry.entity;
      const record = contributors.get(name) ?? { type: row.entry.entityType, values: new Map<string, number>(), significantIn: [], importance: false };
      record.importance = true;
      contributors.set(name, record);
    }
  }
  return { fixed, percent: criteriaSetOf(ri).absolute.sscCumulativePercent.value, metrics, items, flags, lbes: significantLbes(ri), contributors };
}

function itemValue(ctx: RiHandoffContext, metricKey: string, itemId: RiBreakdownId, key: string): number {
  return ctx.items.get(metricKey)?.find((i) => i.id === itemId)?.ranked.find((r) => r.key === key)?.value ?? 0;
}

function flaggedIn(ctx: RiHandoffContext, itemId: RiBreakdownId, key: string): RiIntegratedMetric[] {
  return ctx.metrics.filter((m) => ctx.flags.get(m.key)?.get(itemId)?.get(key) === true);
}

function flaggedKeys(ctx: RiHandoffContext, itemId: RiBreakdownId): string[] {
  const keys: string[] = [];
  for (const metric of ctx.metrics) {
    for (const [key, flag] of ctx.flags.get(metric.key)?.get(itemId) ?? new Map<string, boolean>()) {
      if (flag && !keys.includes(key)) keys.push(key);
    }
  }
  return keys;
}

interface RiShareEntry {
  metric: RiIntegratedMetric;
  share: number;
}

function shareEntries(ctx: RiHandoffContext, valueOf: (metric: RiIntegratedMetric) => number): RiShareEntry[] {
  return ctx.metrics
    .filter((m) => m.total > 0)
    .map((m) => ({ metric: m, share: valueOf(m) / m.total }))
    .filter((e) => e.share > 0)
    .sort((a, b) => b.share - a.share);
}

function sharesText(entries: RiShareEntry[]): string {
  return entries.length === 0 ? "None" : entries.slice(0, 2).map((e) => `${shortMetricLabel(e.metric)} ${shareText(e.share)}`).join(", ");
}

function carriesText(entries: RiShareEntry[]): string {
  if (entries.length === 0) return "Adds nothing to the totals.";
  return `Carries ${listText(entries.slice(0, 3).map((e) => `${shareText(e.share)} of ${metricPhrase(e.metric)}`))}.`;
}

function targetsText(metrics: RiIntegratedMetric[]): string {
  return `the ${listText(metrics.map(targetPhrase))} target${metrics.length > 1 ? "s" : ""}`;
}

function metricCoverage(metric: RiIntegratedMetric): "none" | "partial" | "full" {
  if (metric.missing.length === 0) return "full";
  return metric.rows.some((r) => !r.missing && r.family.endState === EndState.RADIONUCLIDE_RELEASE) ? "partial" : "none";
}

function totalPhrase(metric: RiIntegratedMetric): string | undefined {
  const coverage = metricCoverage(metric);
  if (coverage === "none") return undefined;
  const value = `${metric.total === 0 ? "0" : sciText(metric.total)} ${metric.unit}`;
  return coverage === "partial" ? `at least ${value}` : value;
}

function unmeasured(ctx: RiHandoffContext, ids: string[]): boolean {
  return ctx.metrics.length > 0 && ids.length > 0 && ids.every((id) => ctx.metrics.every((m) => m.missing.includes(id)));
}

const UNMEASURED_INSIGHT = "Its results are missing, so no total includes it.";

function levelFor(significant: boolean): ImportanceLevel {
  return significant ? ImportanceLevel.HIGH : ImportanceLevel.LOW;
}

const HANDOFF_CACHE = new WeakMap<RiskIntegration, RiHandoffTarget[]>();

function handoffTargets(ri: RiskIntegration): RiHandoffTarget[] {
  const cached = HANDOFF_CACHE.get(ri);
  if (cached !== undefined) return cached;
  const targets = buildHandoffTargets(ri);
  HANDOFF_CACHE.set(ri, targets);
  return targets;
}

function buildHandoffTargets(ri: RiskIntegration): RiHandoffTarget[] {
  const inputs = ri.inputs;
  if (inputs === undefined) return [];
  const ctx = handoffContext(ri);
  const relative = criteriaSetOf(ri).relative;
  const pct = ctx.percent;
  const targets: RiHandoffTarget[] = [];

  const families = inputs.families.filter((f) => f.included);
  const significantFamilies: string[] = [];
  const familyTargets: RiHandoffTarget[] = [];
  for (const family of families) {
    const entries = shareEntries(ctx, (m) => itemValue(ctx, m.key, "family", family.id));
    const lbe = ctx.lbes.has(family.id);
    if (entries.length === 0 && !lbe) continue;
    const flagged = flaggedIn(ctx, "family", family.id);
    const significant = lbe || flagged.length > 0;
    if (significant) significantFamilies.push(family.id);
    const basis = ctx.fixed
      ? lbe ? "Risk-significant LBE" : flagged.length > 0 ? `Above ${pct}% of ${targetsText(flagged)}` : `Not a risk-significant LBE and below ${pct}% of every target`
      : flagged.length > 0 ? `Risk-significant for ${listText(flagged.map(shortMetricLabel))}` : `Outside the top ${relative.aggregatePercent.value}% and below ${relative.individualPercent.value}% of every total`;
    const missingAll = unmeasured(ctx, [family.id]);
    familyTargets.push({ group: "family", key: family.id, label: family.name, derived: levelFor(significant), basis, shares: missingAll ? "Not computed" : sharesText(entries), insight: missingAll ? UNMEASURED_INSIGHT : carriesText(entries), weight: entries[0]?.share ?? 0 });
  }
  targets.push(...familyTargets.sort((a, b) => b.weight - a.weight));

  const significantContributors: { name: string; type: string }[] = [];
  const contributorTargets: RiHandoffTarget[] = [];
  for (const [name, record] of ctx.contributors) {
    const entries = shareEntries(ctx, (m) => record.values.get(m.key) ?? 0);
    const flagged = ctx.metrics.filter((m) => record.significantIn.includes(m.key));
    const significant = flagged.length > 0 || record.importance;
    if (entries.length === 0 && !significant) continue;
    if (significant) significantContributors.push({ name, type: record.type });
    const basis = ctx.fixed
      ? flagged.length > 0 ? `Above ${pct}% of ${targetsText(flagged)}` : `Below ${pct}% of every target`
      : flagged.length > 0
        ? `Above the ${relative.fussellVesely.value} Fussell-Vesely bar for ${listText(flagged.map(shortMetricLabel))}`
        : record.importance
          ? "Above ESQ's Fussell-Vesely or RAW bar"
          : BASIC_EVENT_TYPES.includes(record.type) ? `Below the ${relative.fussellVesely.value} Fussell-Vesely and ${relative.riskAchievementWorth.value} RAW bars` : "No Table 1.9-1 rule for this kind";
    contributorTargets.push({ group: "contributor", key: name, label: record.type, derived: levelFor(significant), basis, shares: sharesText(entries), insight: carriesText(entries), weight: entries[0]?.share ?? 0 });
  }
  targets.push(...contributorTargets.sort((a, b) => b.weight - a.weight));

  const members = new Map<string, string[]>();
  for (const family of families) {
    for (const category of family.releaseCategoryIds) members.set(category, [...(members.get(category) ?? []), family.id]);
  }
  const categoryLevels = new Map<string, ImportanceLevel>();
  const categoryTargets: RiHandoffTarget[] = [];
  for (const [category, ids] of members) {
    const entries = shareEntries(ctx, (m) => itemValue(ctx, m.key, "category", category));
    const holds = ids.filter((id) => significantFamilies.includes(id));
    const flagged = flaggedIn(ctx, "category", category);
    if (entries.length === 0 && holds.length === 0) continue;
    const significant = holds.length > 0 || flagged.length > 0;
    categoryLevels.set(category, levelFor(significant));
    const basis = holds.length > 0
      ? `Holds ${listText(holds)}, risk-significant`
      : flagged.length > 0 ? `Above ${pct}% of ${targetsText(flagged)}` : ctx.fixed ? `Holds no risk-significant family, below ${pct}% of every target` : "Holds no risk-significant family";
    const missingAll = unmeasured(ctx, ids);
    categoryTargets.push({ group: "category", key: category, label: listText(ids), derived: levelFor(significant), basis, shares: missingAll ? "Not computed" : sharesText(entries), insight: `Holds ${listText(ids)}. ${missingAll ? UNMEASURED_INSIGHT : carriesText(entries)}`, weight: entries[0]?.share ?? 0 });
  }
  targets.push(...categoryTargets.sort((a, b) => b.weight - a.weight));

  const sourceTerms = new Map<string, string[]>();
  for (const consequence of inputs.consequences) {
    const sourceTerm = consequence.sourceTermId;
    if (sourceTerm === undefined || !categoryLevels.has(consequence.releaseCategoryId)) continue;
    const list = sourceTerms.get(sourceTerm) ?? [];
    if (!list.includes(consequence.releaseCategoryId)) sourceTerms.set(sourceTerm, [...list, consequence.releaseCategoryId]);
  }
  for (const [sourceTerm, categories] of sourceTerms) {
    const significant = categories.some((c) => categoryLevels.get(c) === ImportanceLevel.HIGH);
    const first = categoryTargets.find((t) => categories.includes(t.key));
    targets.push({
      group: "sourceTerm",
      key: sourceTerm,
      label: listText(categories),
      derived: levelFor(significant),
      basis: significant ? `Follows ${listText(categories)}, risk-significant` : `Follows ${listText(categories)}`,
      shares: first?.shares ?? "None",
      insight: `Source term of ${listText(categories)}.`,
      weight: first?.weight ?? 0,
    });
  }

  const reported = integratedRiskMetrics(ri);
  for (const measure of ri.scopeDefinition.consequenceMeasures) {
    const measureMetrics = ctx.metrics.filter((m) => m.measureName === measure.name);
    const found: string[] = [];
    if (ctx.fixed && measure.role === "EAB_DOSE") found.push(...ctx.lbes);
    for (const metric of measureMetrics) {
      for (const [key, flag] of ctx.flags.get(metric.key)?.get("family") ?? new Map<string, boolean>()) if (flag && !found.includes(key)) found.push(key);
      for (const [name, record] of ctx.contributors) if (record.significantIn.includes(metric.key) && !found.includes(name)) found.push(name);
    }
    const own = reported.filter((m) => m.measureName === measure.name);
    const uncomputed = measureMetrics.length > 0 && measureMetrics.every((m) => totalPhrase(m) === undefined);
    const basis = found.length > 0
      ? `${countedList(found, 3)} risk-significant here`
      : measureMetrics.length === 0 ? (ctx.fixed ? "Reported without a target" : "No total") : uncomputed ? "No results to test" : "No risk-significant item here";
    const lead = own.find((m) => m.total > 0);
    const topCategory = lead === undefined ? undefined : contributionsBy(ri, [lead], "category")[0];
    const topShare = lead === undefined || topCategory === undefined ? undefined : (topCategory.values[0] ?? 0) / lead.total;
    const totals = own.map((m) => {
      const phrase = totalPhrase(m);
      return phrase === undefined ? `${m.label} is not computed.` : `${m.label} is ${phrase}${m.limit === undefined ? "" : ` against a limit of ${sciText(m.limit)}`}.`;
    });
    targets.push({
      group: "measure",
      key: measure.name,
      label: own.map((m) => `${shortMetricLabel(m)} ${totalPhrase(m) ?? "not computed"}`).join(", ") || "No total",
      derived: levelFor(found.length > 0),
      basis,
      shares: topCategory === undefined || topShare === undefined ? "None" : `${topCategory.key} ${shareText(topShare)}`,
      insight: [...totals, ...(topCategory === undefined || topShare === undefined ? [] : [`${topCategory.key} carries ${shareText(topShare)} of it.`])].join(" "),
      weight: 0,
    });
  }

  const lead = ctx.metrics.find((m) => m.total > 0);
  const pending = lead === undefined && ctx.metrics.some((m) => m.missing.length > 0);
  const ownerItems: Record<RiHandoffElementCode, RiBreakdownId> = { POS: "state", IE: "initiating", ES: "sequence", SC: "function", SY: "equipment", HR: "human", DA: "basicEvent" };
  const contributorTypes: Partial<Record<RiHandoffElementCode, string[]>> = { SY: SSC_TYPES, HR: ["HUMAN_FAILURE_EVENT"], DA: BASIC_EVENT_TYPES };
  for (const code of HANDOFF_ELEMENTS) {
    const types = contributorTypes[code];
    let found: string[];
    if (types !== undefined) {
      found = significantContributors.filter((c) => types.includes(c.type)).map((c) => c.name);
    } else {
      const own = flaggedKeys(ctx, ownerItems[code]);
      const linked = code === "SC" ? [] : significantFamilies;
      found = [...new Set([...own, ...(code === "ES" ? flaggedKeys(ctx, "family") : []), ...linked])];
    }
    let top: { key: string; share: number } | undefined;
    if (lead !== undefined) {
      if (types !== undefined) {
        const best = [...ctx.contributors.entries()]
          .filter(([, record]) => types.includes(record.type))
          .map(([name, record]) => ({ key: name, share: (record.values.get(lead.key) ?? 0) / lead.total }))
          .filter((e) => e.share > 0)
          .sort((a, b) => b.share - a.share)[0];
        top = best;
      } else {
        const ranked = ctx.items.get(lead.key)?.find((i) => i.id === ownerItems[code])?.ranked[0];
        if (ranked !== undefined) top = { key: ranked.key, share: ranked.value / lead.total };
      }
    }
    targets.push({
      group: "element",
      key: code,
      label: ELEMENT_NAME_BY_CODE[code] ?? code,
      derived: levelFor(found.length > 0),
      basis: found.length > 0 ? `${countedList(found, 3)} risk-significant` : "No risk-significant item",
      shares: pending ? "Not computed" : top === undefined || lead === undefined ? "None" : `${top.key}, ${shortMetricLabel(lead)} ${shareText(top.share)}`,
      insight: pending ? "No total is computed yet." : top === undefined || lead === undefined ? "Adds nothing to the totals." : `${top.key} carries ${shareText(top.share)} of ${metricPhrase(lead)}.`,
      weight: 0,
    });
  }
  return targets;
}

type RiDispatch = NonNullable<RiskIntegration["riskIntegrationFeedbackDispatch"]>;

interface RiHandoffFields {
  riskSignificance?: ImportanceLevel;
  significanceReason?: string;
  insights?: string[];
  recommendations?: string[];
  keyUncertainties?: string[];
  generalFeedback?: string;
}

function pickEntry(row: RiHandoffFields): RiHandoffEntry {
  const entry: RiHandoffEntry = {};
  if (row.riskSignificance !== undefined) entry.riskSignificance = row.riskSignificance;
  if (row.significanceReason !== undefined) entry.significanceReason = row.significanceReason;
  if (row.insights !== undefined) entry.insights = row.insights;
  if (row.recommendations !== undefined) entry.recommendations = row.recommendations;
  if (row.keyUncertainties !== undefined) entry.keyUncertainties = row.keyUncertainties;
  if (row.generalFeedback !== undefined) entry.generalFeedback = row.generalFeedback;
  return entry;
}

function handoffEntryList(ri: RiskIntegration, group: RiHandoffGroup): { key: string; entry: RiHandoffEntry }[] {
  const d = ri.riskIntegrationFeedbackDispatch;
  switch (group) {
    case "family": return (d?.eventSequenceQuantificationFeedback?.familyFeedback ?? []).map((r) => ({ key: r.familyRef, entry: pickEntry(r) }));
    case "contributor": return (d?.eventSequenceQuantificationFeedback?.contributorFeedback ?? []).map((r) => ({ key: r.entityRef, entry: pickEntry(r) }));
    case "category": return (d?.mechanisticSourceTermFeedback?.releaseCategoryFeedback ?? []).map((r) => ({ key: r.releaseCategoryRef, entry: pickEntry(r) }));
    case "sourceTerm": return (d?.mechanisticSourceTermFeedback?.sourceTermFeedback ?? []).map((r) => ({ key: r.sourceTermDefinitionRef, entry: pickEntry(r) }));
    case "measure": return (d?.radiologicalConsequenceFeedback?.metricFeedback ?? []).map((r) => ({ key: r.metric, entry: pickEntry(r) }));
    case "element": return (d?.additionalElementFeedback ?? []).map((r) => ({ key: r.elementCode, entry: pickEntry(r) }));
    default: return [];
  }
}

function handoffEntryOf(ri: RiskIntegration, group: RiHandoffGroup, key: string): RiHandoffEntry | undefined {
  return handoffEntryList(ri, group).find((e) => sameItem(e.key, key))?.entry;
}

function handoffLevelOf(ri: RiskIntegration, target: RiHandoffTarget): ImportanceLevel {
  return handoffEntryOf(ri, target.group, target.key)?.riskSignificance ?? target.derived;
}

function withText<T extends object>(row: T, name: "significanceReason" | "generalFeedback", value: string | undefined): T {
  return value === undefined || value.trim().length === 0 ? row : { ...row, [name]: value };
}

function withLines<T extends object>(row: T, name: "insights" | "recommendations" | "keyUncertainties", value: string[] | undefined): T {
  return value === undefined || value.length === 0 ? row : { ...row, [name]: value };
}

function upsertByKey<T>(rows: T[], keyOf: (row: T) => string, key: string, next: T | undefined): T[] {
  const index = rows.findIndex((row) => sameItem(keyOf(row), key));
  if (next === undefined) return index < 0 ? rows : rows.filter((_, i) => i !== index);
  if (index < 0) return [...rows, next];
  return rows.map((row, i) => (i === index ? next : row));
}

function elementCodeOf(key: string): RiHandoffElementCode | undefined {
  return HANDOFF_ELEMENTS.find((code) => code === key);
}

function withHandoffEntry(ri: RiskIntegration, group: RiHandoffGroup, key: string, entry: RiHandoffEntry | undefined): RiskIntegration {
  const d: RiDispatch = ri.riskIntegrationFeedbackDispatch ?? {};
  const base = (): { riskSignificance?: ImportanceLevel } => (entry?.riskSignificance === undefined ? {} : { riskSignificance: entry.riskSignificance });
  const common = <T extends object>(row: T): T => withLines(withText(row, "significanceReason", entry?.significanceReason), "insights", entry?.insights);
  const esq = d.eventSequenceQuantificationFeedback ?? {};
  const ms = d.mechanisticSourceTermFeedback ?? {};
  const rc = d.radiologicalConsequenceFeedback ?? {};
  switch (group) {
    case "family": {
      const next = entry === undefined ? undefined : withLines(common({ familyRef: key, ...base() }), "recommendations", entry.recommendations);
      return { ...ri, riskIntegrationFeedbackDispatch: { ...d, eventSequenceQuantificationFeedback: { ...esq, familyFeedback: upsertByKey(esq.familyFeedback ?? [], (r) => r.familyRef, key, next) } } };
    }
    case "contributor": {
      const next = entry === undefined ? undefined : withLines(common({ entityRef: key, ...base() }), "recommendations", entry.recommendations);
      return { ...ri, riskIntegrationFeedbackDispatch: { ...d, eventSequenceQuantificationFeedback: { ...esq, contributorFeedback: upsertByKey(esq.contributorFeedback ?? [], (r) => r.entityRef, key, next) } } };
    }
    case "category": {
      const next = entry === undefined ? undefined : withLines(common({ releaseCategoryRef: key, ...base() }), "recommendations", entry.recommendations);
      return { ...ri, riskIntegrationFeedbackDispatch: { ...d, mechanisticSourceTermFeedback: { ...ms, releaseCategoryFeedback: upsertByKey(ms.releaseCategoryFeedback ?? [], (r) => r.releaseCategoryRef, key, next) } } };
    }
    case "sourceTerm": {
      const next = entry === undefined ? undefined : withLines(common({ sourceTermDefinitionRef: key, ...base() }), "keyUncertainties", entry.keyUncertainties);
      return { ...ri, riskIntegrationFeedbackDispatch: { ...d, mechanisticSourceTermFeedback: { ...ms, sourceTermFeedback: upsertByKey(ms.sourceTermFeedback ?? [], (r) => r.sourceTermDefinitionRef, key, next) } } };
    }
    case "measure": {
      const next = entry === undefined ? undefined : withLines(common({ metric: key, ...base() }), "recommendations", entry.recommendations);
      return { ...ri, riskIntegrationFeedbackDispatch: { ...d, radiologicalConsequenceFeedback: { ...rc, metricFeedback: upsertByKey(rc.metricFeedback ?? [], (r) => r.metric, key, next) } } };
    }
    case "element": {
      const code = elementCodeOf(key);
      if (code === undefined) return ri;
      const next = entry === undefined ? undefined : withText(withLines(common({ elementCode: code, ...base() }), "recommendations", entry.recommendations), "generalFeedback", entry.generalFeedback);
      return { ...ri, riskIntegrationFeedbackDispatch: { ...d, additionalElementFeedback: upsertByKey(d.additionalElementFeedback ?? [], (r) => r.elementCode, key, next) } };
    }
    default: return ri;
  }
}

function handoffMessageOf(ri: RiskIntegration, receiver: RiHandoffReceiver): string {
  const d = ri.riskIntegrationFeedbackDispatch;
  if (receiver === "ESQ") return d?.eventSequenceQuantificationFeedback?.generalFeedback ?? "";
  if (receiver === "MS") return d?.mechanisticSourceTermFeedback?.generalFeedback ?? "";
  return d?.radiologicalConsequenceFeedback?.generalFeedback ?? "";
}

function withHandoffMessage(ri: RiskIntegration, receiver: RiHandoffReceiver, text: string): RiskIntegration {
  const d: RiDispatch = ri.riskIntegrationFeedbackDispatch ?? {};
  if (receiver === "ESQ") return { ...ri, riskIntegrationFeedbackDispatch: { ...d, eventSequenceQuantificationFeedback: { ...(d.eventSequenceQuantificationFeedback ?? {}), generalFeedback: text } } };
  if (receiver === "MS") return { ...ri, riskIntegrationFeedbackDispatch: { ...d, mechanisticSourceTermFeedback: { ...(d.mechanisticSourceTermFeedback ?? {}), generalFeedback: text } } };
  return { ...ri, riskIntegrationFeedbackDispatch: { ...d, radiologicalConsequenceFeedback: { ...(d.radiologicalConsequenceFeedback ?? {}), generalFeedback: text } } };
}

function withHandoffSent(ri: RiskIntegration, date: string): RiskIntegration {
  return { ...ri, riskIntegrationFeedbackDispatch: { ...(ri.riskIntegrationFeedbackDispatch ?? {}), dispatchDate: date } };
}

function handoffReceiverOf(group: RiHandoffGroup): RiHandoffReceiver | undefined {
  if (group === "family" || group === "contributor") return "ESQ";
  if (group === "category" || group === "sourceTerm") return "MS";
  if (group === "measure") return "RC";
  return undefined;
}

interface RiHandoffPlan {
  add: RiHandoffTarget[];
  refresh: RiHandoffTarget[];
  stale: { group: RiHandoffGroup; key: string }[];
}

function handoffPlan(ri: RiskIntegration, targets: RiHandoffTarget[]): RiHandoffPlan {
  const plan: RiHandoffPlan = { add: [], refresh: [], stale: [] };
  for (const group of HANDOFF_GROUPS) {
    const entries = handoffEntryList(ri, group);
    const own = targets.filter((t) => t.group === group);
    for (const target of own) {
      const entry = entries.find((e) => sameItem(e.key, target.key))?.entry;
      if (entry === undefined) {
        if (target.derived === ImportanceLevel.HIGH) plan.add.push(target);
        continue;
      }
      const level = entry.riskSignificance;
      if (level !== undefined && level !== ImportanceLevel.MEDIUM && level !== target.derived && missing(entry.significanceReason)) plan.refresh.push(target);
    }
    for (const { key } of entries) {
      if (!own.some((t) => sameItem(t.key, key))) plan.stale.push({ group, key });
    }
  }
  return plan;
}

function handoffChangeCount(ri: RiskIntegration): number {
  const plan = handoffPlan(ri, handoffTargets(ri));
  return plan.add.length + plan.refresh.length + plan.stale.length;
}

function withHandoffsUpdated(ri: RiskIntegration): RiskIntegration {
  const plan = handoffPlan(ri, handoffTargets(ri));
  let next = ri;
  for (const target of plan.add) next = withHandoffEntry(next, target.group, target.key, { riskSignificance: target.derived, insights: [target.insight] });
  for (const target of plan.refresh) {
    const entry = handoffEntryOf(next, target.group, target.key) ?? {};
    next = withHandoffEntry(next, target.group, target.key, { ...entry, riskSignificance: target.derived });
  }
  for (const stale of plan.stale) next = withHandoffEntry(next, stale.group, stale.key, undefined);
  return next;
}

function handoffIssues(ri: RiskIntegration): string[] {
  if (ri.inputs === undefined) return ["Import the inputs in Step 02."];
  const targets = handoffTargets(ri);
  const plan = handoffPlan(ri, targets);
  const issues: string[] = [];
  if (plan.add.length + plan.refresh.length + plan.stale.length > 0) issues.push("Update the hand-offs from Steps 04 to 06.");
  for (const target of targets) {
    const entry = handoffEntryOf(ri, target.group, target.key);
    if (entry === undefined || plan.refresh.includes(target)) continue;
    const level = entry.riskSignificance ?? target.derived;
    if (level !== target.derived && missing(entry.significanceReason)) issues.push(`Give the reason for the level of ${target.key}.`);
    if (level === ImportanceLevel.LOW) continue;
    if (target.group === "sourceTerm") {
      if ((entry.keyUncertainties ?? []).length === 0) issues.push(`List the key uncertainties of ${target.key}.`);
    } else if ((entry.recommendations ?? []).length === 0) {
      issues.push(`Add a recommendation for ${target.key}.`);
    }
    if (target.group === "element" && missing(entry.generalFeedback)) issues.push(`Write the message to ${target.key}.`);
  }
  const links = applicationContextOf(ri).linkedWorkbooks;
  for (const receiver of HANDOFF_RECEIVERS) {
    if (links[receiver] !== undefined && missing(handoffMessageOf(ri, receiver))) issues.push(`Write the message to ${receiver}.`);
  }
  if (missing(ri.riskIntegrationFeedbackDispatch?.dispatchDate)) issues.push("Record the hand-off as sent.");
  return issues;
}

interface RiReceiptRow {
  group: RiHandoffGroup;
  key: string;
  sent?: ImportanceLevel;
  recorded?: ImportanceLevel;
  status?: string;
}

interface RiReceipt {
  receiver: RiHandoffReceiver;
  linked: boolean;
  loaded: boolean;
  recorded: boolean;
  recordedOn?: string;
  analysisRef?: string;
  message?: string;
  rows: RiReceiptRow[];
  response?: { description: string; changes: string[]; status: string };
}

interface RiRecordedRow {
  key: string;
  level?: ImportanceLevel;
  status?: string;
}

function receiptRows(ri: RiskIntegration, targets: RiHandoffTarget[], group: RiHandoffGroup, recorded: RiRecordedRow[], matches: (target: RiHandoffTarget, key: string) => boolean): RiReceiptRow[] {
  const rows: RiReceiptRow[] = [];
  const own = targets.filter((t) => t.group === group);
  for (const target of own) {
    const hit = recorded.find((r) => matches(target, r.key));
    if (hit === undefined && handoffEntryOf(ri, target.group, target.key) === undefined) continue;
    const row: RiReceiptRow = { group, key: target.key, sent: handoffLevelOf(ri, target) };
    if (hit?.level !== undefined) row.recorded = hit.level;
    if (hit?.status !== undefined) row.status = hit.status;
    rows.push(row);
  }
  for (const r of recorded) {
    if (own.some((t) => matches(t, r.key))) continue;
    const row: RiReceiptRow = { group, key: r.key };
    if (r.level !== undefined) row.recorded = r.level;
    if (r.status !== undefined) row.status = r.status;
    rows.push(row);
  }
  return rows;
}

function handoffReceipts(ri: RiskIntegration, upstream: RiUpstream): RiReceipt[] {
  const targets = handoffTargets(ri);
  const links = applicationContextOf(ri).linkedWorkbooks;
  const same = (target: RiHandoffTarget, key: string): boolean => sameItem(target.key, key);
  const receipt = (receiver: RiHandoffReceiver, loaded: boolean, record: { analysisRef: string; feedbackDate?: string; generalFeedback?: string; response?: { description: string; changes?: string[]; status: string } } | undefined, rows: RiReceiptRow[]): RiReceipt => {
    const out: RiReceipt = { receiver, linked: links[receiver] !== undefined, loaded, recorded: record !== undefined, rows: record === undefined ? [] : rows };
    if (record === undefined) return out;
    out.analysisRef = record.analysisRef;
    if (record.feedbackDate !== undefined && record.feedbackDate.length > 0) out.recordedOn = record.feedbackDate;
    if (record.generalFeedback !== undefined) out.message = record.generalFeedback;
    if (record.response !== undefined) out.response = { description: record.response.description, changes: record.response.changes ?? [], status: record.response.status };
    return out;
  };
  const esq = upstream.esq?.riskIntegrationFeedback;
  const ms = upstream.ms?.riskIntegrationFeedback;
  const rc = upstream.rc?.riskIntegrationFeedback;
  const rcMetricName = (measure: string): string | undefined => {
    const id = ri.inputs?.consequences.find((c) => c.measure === measure)?.rcMetricId;
    return id === undefined ? undefined : upstream.rc?.scope.metrics?.find((m) => m.id === id)?.name;
  };
  const measureMatches = (target: RiHandoffTarget, key: string): boolean => {
    const name = rcMetricName(target.key);
    return sameItem(target.key, key) || (name !== undefined && sameItem(name, key));
  };
  return [
    receipt("ESQ", upstream.esq !== undefined, esq, receiptRows(ri, targets, "family", (esq?.sequenceFeedback ?? []).map((r) => ({ key: r.sequenceRef, ...(r.riskSignificance === undefined ? {} : { level: r.riskSignificance }) })), same)),
    receipt("MS", upstream.ms !== undefined, ms, [
      ...receiptRows(ri, targets, "category", (ms?.releaseCategoryFeedback ?? []).map((r) => ({ key: r.releaseCategoryReference, ...(r.riskSignificance === undefined ? {} : { level: r.riskSignificance }), ...(r.status === undefined ? {} : { status: r.status }) })), same),
      ...receiptRows(ri, targets, "sourceTerm", (ms?.sourceTermFeedback ?? []).map((r) => ({ key: r.sourceTermDefinitionRef, ...(r.riskSignificance === undefined ? {} : { level: r.riskSignificance }), ...(r.status === undefined ? {} : { status: r.status }) })), same),
    ]),
    receipt("RC", upstream.rc !== undefined, rc, [
      ...receiptRows(ri, targets, "measure", (rc?.metricFeedback ?? []).map((r) => ({ key: r.metric, ...(r.riskSignificance === undefined ? {} : { level: r.riskSignificance }) })), measureMatches),
      ...receiptRows(ri, targets, "category", (rc?.releaseCategoryFeedback ?? []).map((r) => ({ key: r.releaseCategoryReference, ...(r.riskSignificance === undefined ? {} : { level: r.riskSignificance }), ...(r.status === undefined ? {} : { status: r.status }) })), same).filter((row) => row.recorded !== undefined || row.status !== undefined),
    ]),
  ];
}

interface RiImportanceRow {
  entry: RiInputImportance;
  significant?: boolean;
}

function importanceRows(ri: RiskIntegration): RiImportanceRow[] {
  const relative = criteriaSetOf(ri).relative;
  return (ri.inputs?.importance ?? []).map((entry) => {
    const row: RiImportanceRow = { entry };
    const fv = entry.fussellVesely;
    const raw = entry.riskAchievementWorth;
    if (fv !== undefined || raw !== undefined) {
      row.significant = (fv !== undefined && fv > relative.fussellVesely.value) || (raw !== undefined && raw > relative.riskAchievementWorth.value);
    }
    return row;
  });
}

function withModuleAdded(ri: RiskIntegration, name: string): RiskIntegration {
  const trimmed = name.trim();
  const modules = ri.scopeDefinition.reactorModules ?? [];
  const recorded = [...modules, ...(ri.scopeDefinition.scopeExclusions ?? []).filter((e) => e.aspect === "MODULE").map((e) => e.item)];
  if (trimmed.length === 0 || recorded.some((item) => sameItem(item, trimmed))) return ri;
  return { ...ri, scopeDefinition: { ...ri.scopeDefinition, reactorModules: [...modules, trimmed] } };
}

function countText(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function conformanceMeta(ri: RiskIntegration, code: string): string | undefined {
  const inputs = ri.inputs;
  switch (code) {
    case "RI-A1": return countText(ri.scopeDefinition.consequenceMeasures.length, "measure", "measures");
    case "RI-A4": return `${sciText(ri.reportingThresholds.minimumReportingFrequencyPerPlantYear)} per yr`;
    case "RI-B1": return inputs === undefined ? "Nothing imported" : countText(inputs.families.filter((f) => f.included).length, "family", "families");
    case "RI-B6": return inputs?.contributors === undefined ? "No contributors" : countText(new Set(inputs.contributors.map((c) => c.name)).size, "contributor", "contributors");
    case "RI-C1": return countText(ri.modelUncertaintySources.length, "source", "sources");
    default: return undefined;
  }
}

function filterConformance(ri: RiskIntegration, ccId: string, appType: AppTypeId): ConformanceItem[] {
  const statusBySr = new Map<string, string>();
  for (const entry of ri.conformanceMatrix) {
    const ccUpper = ccId.replace("cc-", "").toUpperCase();
    if (entry.capabilityCategory === `CC-${ccUpper}`) statusBySr.set(entry.sr, entry.status);
  }
  return CONFORMANCE_ITEMS.filter((it) => it.requiredAt.includes(ccId)).map((base) => {
    const meta = conformanceMeta(ri, base.id);
    const it = meta === undefined ? base : { ...base, meta };
    if (it.appOnly !== undefined && it.appOnly !== appType) {
      return { ...it, status: "na" as const, meta: "Not applicable to this application" };
    }
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

function ccScore(ri: RiskIntegration, ccId: string, appType: AppTypeId): CcScore {
  const items = filterConformance(ri, ccId, appType);
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

function commentsView(ri: RiskIntegration, now: Date = new Date()): CommentView[] {
  const reviewers = ri.metadata.reviewers;
  return ri.internalReviewComments.comments.map((c) => {
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
      section: item?.section ?? "Documentation (HLR-RI-D)",
      targetLabel: item?.text ?? "General",
      text: c.text,
      severity: c.severity ?? "OBSERVATION",
      resolved: c.resolved,
      resolution: c.resolution,
    };
  });
}

function stepsForPersona(persona: RiPersona): RiStep[] {
  const ids = RI_PERSONA_STEPS[persona];
  return RI_STEPS.filter((s) => ids.includes(s.id));
}

function stepsFromMef(ri: RiskIntegration, persona: RiPersona): RiStep[] {
  const base = stepsForPersona(persona);
  const appType = appTypeFromMef(ri);
  const criteria = criteriaReview(criteriaSetOf(ri), appType);
  const floors = floorsReview(ri.reportingThresholds);
  const measures = ri.scopeDefinition.consequenceMeasures;
  const applicationComplete = ri.praScope.trim().length > 0
    && measures.length > 0
    && measures.every((m) => measureIssues(m).length === 0)
    && measureRoleIssues(measures, appType).length === 0
    && criteria.unjustified === 0
    && criteria.invalid === 0
    && floors.unjustified === 0
    && floors.invalid === 0;
  const inputsComplete = ri.inputs !== undefined
    && ri.inputs.families.some((f) => f.included)
    && riInputChecks(ri).every((finding) => finding.severity !== "error");
  const categoriesComplete = inputsComplete
    && familyCategories(ri).filter((view) => view.below).every((view) => cliffEdgeReviewed(ri, view.family.id));
  const fcComplete = categoriesComplete
    && fcFamilies(ri).every((row) => row.significant !== undefined && row.withinTarget !== undefined);
  const integrateComplete = inputsComplete
    && contributionMetrics(ri).every((m) => m.measureName !== undefined && m.missing.length === 0)
    && aggregationIssues(ri).length === 0;
  const aggregateComplete = inputsComplete
    && ri.inputs?.contributors !== undefined
    && sscContributors(ri).every((c) => sscOf(ri, c.name) !== undefined);
  const uncertaintyComplete = inputsComplete
    && registerIssues(ri).length === 0
    && groupingIssues(ri).length === 0
    && ri.uncertaintyAnalyses.some((u) => !missing(u.uncertaintyRangeDiscussion));
  const feedbackComplete = inputsComplete && handoffIssues(ri).length === 0;
  const draftComplete = ri.workflowState !== "DRAFT" && ri.workflowState !== "REVISION_REQUIRED";
  const reviewComplete = ri.workflowState === "FINAL";

  function status(complete: boolean): "complete" | "idle" {
    return complete ? "complete" : "idle";
  }

  const shown = appType === "baseline_risk" ? base.filter((s) => s.id !== "categories" && s.id !== "fc") : base;

  return shown.map((step, index) => {
    const s = { ...step, num: String(index + 1).padStart(2, "0") };
    switch (s.id) {
      case "application": return { ...s, status: status(applicationComplete) };
      case "inputs": return { ...s, status: status(inputsComplete) };
      case "categories": return { ...s, status: status(categoriesComplete) };
      case "fc": return { ...s, status: status(fcComplete) };
      case "integrate": return { ...s, status: status(integrateComplete) };
      case "aggregate": return { ...s, status: status(aggregateComplete) };
      case "uncertainty": return { ...s, status: status(uncertaintyComplete) };
      case "feedback": return { ...s, status: status(feedbackComplete) };
      case "draft": return { ...s, status: status(draftComplete) };
      case "review": return { ...s, status: status(reviewComplete) };
      default: return { ...s, status: "idle" as const };
    }
  });
}

function familySignificance(ri: RiskIntegration, familyRef: string): "HIGH" | "MEDIUM" | "LOW" {
  const entry = ri.significantContributors.significantEventSequenceFamilies?.find((f) => f.sourceId === familyRef);
  if (entry?.importanceLevel === "HIGH") return "HIGH";
  if (entry?.importanceLevel === "MEDIUM") return "MEDIUM";
  return "LOW";
}

function compiledById(ri: RiskIntegration, familyRef: string): CompiledRiskInput | undefined {
  return ri.compiledRiskInputs.find((c) => c.eventSequenceFamilyRef === familyRef);
}

function consequenceOf(input: CompiledRiskInput, metric: string): number | undefined {
  return input.consequences.find((c) => c.metric === metric)?.meanValue;
}

type ContributorBucketKey =
  | "significantEventSequenceFamilies"
  | "significantEventSequences"
  | "significantInitiatingEvents"
  | "significantReleaseCategories"
  | "significantSystems"
  | "significantComponents"
  | "significantBasicEvents"
  | "significantHumanFailureEvents"
  | "significantPlantOperatingStates"
  | "significantHazardGroups"
  | "significantRadioactiveSources";

const CONTRIBUTOR_BUCKETS: { key: ContributorBucketKey; kind: string }[] = [
  { key: "significantEventSequenceFamilies", kind: "Event sequence family" },
  { key: "significantEventSequences", kind: "Event sequence" },
  { key: "significantInitiatingEvents", kind: "Initiating event" },
  { key: "significantReleaseCategories", kind: "Release category" },
  { key: "significantSystems", kind: "System" },
  { key: "significantComponents", kind: "Component" },
  { key: "significantBasicEvents", kind: "Basic event" },
  { key: "significantHumanFailureEvents", kind: "Human failure event" },
  { key: "significantPlantOperatingStates", kind: "Plant operating state" },
  { key: "significantHazardGroups", kind: "Hazard group" },
  { key: "significantRadioactiveSources", kind: "Radioactive source" },
];

interface ContributorRow {
  contributor: RiskContributor;
  bucket: ContributorBucketKey;
  kind: string;
}

const IMPORTANCE_RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

function contributorRollup(ri: RiskIntegration): ContributorRow[] {
  const sc = ri.significantContributors;
  const out: ContributorRow[] = [];
  for (const spec of CONTRIBUTOR_BUCKETS) {
    for (const c of sc[spec.key] ?? []) {
      out.push({ contributor: c, bucket: spec.key, kind: c.contributorType.length > 0 ? c.contributorType : spec.kind });
    }
  }
  return out.sort((a, b) => {
    const ra = IMPORTANCE_RANK[a.contributor.importanceLevel ?? "LOW"] ?? 2;
    const rb = IMPORTANCE_RANK[b.contributor.importanceLevel ?? "LOW"] ?? 2;
    return ra - rb;
  });
}

function findContributor(ri: RiskIntegration, uuid: string): ContributorRow | undefined {
  return contributorRollup(ri).find((r) => r.contributor.uuid === uuid);
}

function lognormalBounds(distribution: ParameterDistribution | undefined): { mean: number; p05: number; p95: number } | undefined {
  if (distribution === undefined || distribution.type !== DistributionType.LOGNORMAL) return undefined;
  return {
    mean: distribution.median,
    p05: distribution.median / distribution.errorFactor,
    p95: distribution.median * distribution.errorFactor,
  };
}

interface FcPointView {
  id: string;
  name: string;
  freq: number;
  consequence: number;
  sig: "HIGH" | "MEDIUM" | "LOW";
}

function fcPointsView(ri: RiskIntegration, measure: string): FcPointView[] {
  const out: FcPointView[] = [];
  for (const c of ri.compiledRiskInputs) {
    const v = consequenceOf(c, measure);
    if (v === undefined || v <= 0) continue;
    out.push({
      id: c.uuid,
      name: c.eventSequenceFamilyRef,
      freq: c.frequency,
      consequence: v,
      sig: familySignificance(ri, c.eventSequenceFamilyRef),
    });
  }
  return out;
}

function ccdfPointsView(ri: RiskIntegration, measure: string): { dose: number; exceed: number }[] {
  const pts = fcPointsView(ri, measure);
  const levels = Array.from(new Set(pts.map((p) => p.consequence))).sort((a, b) => a - b);
  return levels.map((d) => ({
    dose: d,
    exceed: pts.reduce((sum, p) => (p.consequence >= d ? sum + p.freq : sum), 0),
  }));
}

interface MetricRollup {
  computed?: number;
  matches: boolean;
  limit?: number;
  compliant: boolean;
  fraction: number;
}

function metricRollup(ri: RiskIntegration, metric: RiskMetric): MetricRollup {
  const ref = metric.consequenceMeasureRef;
  let computed: number | undefined;
  if (ref !== undefined && ref.length > 0) {
    computed = ri.compiledRiskInputs.reduce((sum, c) => {
      const v = consequenceOf(c, ref);
      return v === undefined ? sum : sum + c.frequency * v;
    }, 0);
  }
  const limit = metric.acceptanceCriteria?.limit;
  const matches = computed === undefined || metric.value === 0
    ? true
    : Math.abs(computed - metric.value) <= Math.abs(metric.value) * 0.05;
  const compliant = limit === undefined ? true : metric.value <= limit;
  const fraction = limit !== undefined && limit > 0 ? Math.min(1, metric.value / limit) : 0;
  return { computed, matches, limit, compliant, fraction };
}

export {
  filterConformance,
  groupBySection,
  ccScore,
  commentsView,
  stepsForPersona,
  stepsFromMef,
  initialsOf,
  appTypeFromMef,
  applicationContextOf,
  scopeRowsView,
  withScopeState,
  withScopeReason,
  withModuleAdded,
  criteriaSetOf,
  withAbsoluteCriteria,
  withRelativeCriteria,
  withAbsoluteField,
  withRelativeField,
  nextCriterion,
  anchorChanged,
  nextAnchor,
  targetChanged,
  nextTarget,
  criteriaIssues,
  criteriaReview,
  consequenceFloorOf,
  consequenceFloorMrem,
  floorChanged,
  withFloorValue,
  withFloorJustification,
  withFrequencyFloor,
  withFrequencyJustification,
  floorsIssues,
  floorsReview,
  measureNeeds,
  measureNeedsText,
  measureNeedsShort,
  measureRcCheck,
  measureIssues,
  measureRoleIssues,
  measureFromPreset,
  riImportReady,
  riImportInputs,
  riInputChecks,
  frequencyEdited,
  consequenceEdited,
  consequenceKey,
  withFrequencyStat,
  withInputs,
  metricCoverage,
  withInputsCreated,
  withManualKept,
  manualCount,
  withFamilyRenamed,
  withSequenceRenamed,
  withSequenceFamily,
  withUnavailableReason,
  measuresWithoutResults,
  unavailableReasonOf,
  remPerUnit,
  countedItems,
  familyCategories,
  inDbeRange,
  familyDose,
  cliffEdgeCheckOf,
  withCliffEdgeStatus,
  withCliffEdgeBasis,
  targetAnchors,
  targetFrequencyAt,
  targetDoseAt,
  fcFamilies,
  integratedRiskMetrics,
  contributionMetrics,
  contributionsBy,
  initiatingEventGroups,
  hazardGroupOf,
  withHazardAssignment,
  curveMeasures,
  exceedanceCurve,
  withAggregation,
  reviewScopeItems,
  detailNoteOf,
  withDetailNote,
  aggregationIssues,
  NOT_ATTRIBUTED,
  NOT_RECORDED,
  NOT_ASSIGNED,
  breakdownItems,
  breakdownSignificance,
  absoluteBar,
  significantLbes,
  shortMetricLabel,
  handoffTargets,
  handoffEntryOf,
  handoffLevelOf,
  withHandoffEntry,
  handoffMessageOf,
  withHandoffMessage,
  withHandoffSent,
  handoffReceiverOf,
  handoffChangeCount,
  withHandoffsUpdated,
  handoffIssues,
  handoffReceipts,
  HANDOFF_ELEMENTS,
  HANDOFF_RECEIVERS,
  contributorValues,
  contributorTypeLabel,
  sscContributors,
  sscOf,
  withSscAssignment,
  sscGroups,
  importanceRows,
  nextId,
  newRegisterCandidates,
  withImportedRegister,
  newScreeningCandidates,
  withImportedScreening,
  sharedReleaseCategories,
  groupingIssues,
  registerIssues,
  analysisTotalOf,
  propagateTotals,
  PROPAGATION_SAMPLES,
  familySignificance,
  compiledById,
  consequenceOf,
  contributorRollup,
  findContributor,
  lognormalBounds,
  fcPointsView,
  ccdfPointsView,
  metricRollup,
  type FcPointView,
  type ScopeRowView,
  type ScopeState,
  type CriteriaIssues,
  type CriteriaReview,
  type FloorsIssues,
  type RiInputFinding,
  type RiFindingSeverity,
  type RiCategory,
  type RiFamilyCategory,
  type RiFamilyDose,
  type RiFcFamily,
  type RiMargin,
  type RiIntegratedMetric,
  type RiContributionDimension,
  type RiContributionRow,
  type RiExceedanceCurve,
  type RiBreakdownItem,
  type RiBreakdownId,
  type RiRanked,
  type RiSscGroup,
  type RiImportanceRow,
  type RiPropagated,
  type RiHandoffTarget,
  type RiHandoffEntry,
  type RiHandoffGroup,
  type RiHandoffReceiver,
  type RiHandoffElementCode,
  type RiReceipt,
  type RiReceiptRow,
  type MeasureNeeds,
  type MeasureRcCheck,
  type RiFloorKey,
  type MetricRollup,
  type ContributorRow,
  type ContributorBucketKey,
  type CommentView,
  type CcScore,
};
