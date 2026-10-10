import type {
  EsqCombination,
  EsqCombinationFinding,
  EsqDeletionFinding,
  EsqDependenceLevel,
  EsqDependencyRecord,
  EsqExclusion,
  EsqJointSource,
  EsqModel,
  EsqPostWork,
  EsqRecoveryRule,
  EsqSolveRun,
  EventSequenceQuantification,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import {
  combinationKey,
  combinationMembers,
  floorValueOf,
  hfeEventIds,
  postWorkOf,
  resolvedCombinations,
  resolvedRecoveries,
  therpJoint,
  type EsqCombinationMember,
  type EsqPoints,
  type EsqResolvedCombination,
  type EsqResolvedRecovery,
} from "interfaces-mef-types/esq/esq-post-inputs";
import { treesInScope } from "interfaces-mef-types/esq/esq-run-inputs";
import { solveInputsKey, solveWorkOf } from "interfaces-mef-types/esq/esq-solve-inputs";
import type {
  EsqEventTreeRunLogic,
  EsqModelCalculation,
  EsqModelRunResult,
  EsqPostRunResult,
  EventTreeCutSetSettings,
} from "interfaces-shared-types/newly-developed-methods/event-tree";
import { modelViewOf, type EsqFindingSeverity } from "./esqModel";
import { FEASIBILITY_LABELS } from "./esqBarriers";
import type { EsqLogicWindowKind } from "./esqLogic";
import type { EsqSolveWindowKind } from "./esqSolve";

type EsqPostWindowKind = "esqPostRecovery" | "esqPostCombination" | "esqPostFloor";

interface EsqPostFinding {
  severity: EsqFindingSeverity;
  check: string;
  item: string;
  detail: string;
  target?: { kind: EsqPostWindowKind | EsqLogicWindowKind | EsqSolveWindowKind; id: string };
}

interface EsqPostExclusionView {
  exclusion: EsqExclusion;
  codes: string[];
  checkable: boolean;
  finding?: EsqDeletionFinding;
}

interface EsqPostRecoveryView {
  recovery: EsqResolvedRecovery;
  codes: string[];
  hfeName?: string;
  active: boolean;
  assessed: boolean;
}

interface EsqPostCombinationView {
  key: string;
  eventIds: string[];
  codes: string[];
  entry?: EsqResolvedCombination;
  finding?: EsqCombinationFinding;
}

interface EsqPostResultRow {
  familyId: string;
  name: string;
  without?: number;
  withRules?: number;
}

interface EsqPostMemberOption {
  id: string;
  label: string;
}

interface EsqPostView {
  model: EsqModel;
  work: EsqPostWork;
  groups: string[];
  states: string[];
  hfeIds: string[];
  members: EsqPostMemberOption[];
  exclusions: EsqPostExclusionView[];
  recoveries: EsqPostRecoveryView[];
  combinations: EsqPostCombinationView[];
  hrFloor?: number;
  floor?: number;
  searchStale: boolean;
  deletionsStale: boolean;
  comparisonStale: boolean;
  rulesActive: boolean;
  run?: EsqSolveRun;
  runStale: boolean;
  results: EsqPostResultRow[];
  findings: EsqPostFinding[];
}

interface EsqComparisonRequest {
  logic: EsqEventTreeRunLogic;
  calculation: EsqModelCalculation;
  cutSets?: EventTreeCutSetSettings;
}

const DEFAULT_RAISED_HEP = 0.8;

const COMPARISON_KEEP = 100;

const FINDING_RANK: Record<EsqFindingSeverity, number> = { error: 0, warning: 1, note: 2 };

const DEPENDENCE_LEVELS: readonly EsqDependenceLevel[] = ["ZERO", "LOW", "MODERATE", "HIGH", "COMPLETE"];

const LEVEL_LABELS: Record<EsqDependenceLevel, string> = { ZERO: "Zero", LOW: "Low", MODERATE: "Moderate", HIGH: "High", COMPLETE: "Complete" };

const JOINT_SOURCE_LABELS: Record<EsqJointSource, string> = { HRA: "HR assessment", THERP: "THERP level", TYPED: "Typed" };

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function numberText(value: number): string {
  if (!Number.isFinite(value) || value === 0) return String(value);
  const [mantissa, exponent] = value.toExponential(2).split("e");
  const power = Number(exponent);
  const digits = String(Number(mantissa));
  return power === 0 ? digits : `${digits}E${power}`;
}

function listText(items: readonly string[], shown = 3): string {
  if (items.length <= shown) return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  return `${items.slice(0, shown).join(", ")} and ${items.length - shown} more`;
}

function nextId(prefix: string, taken: readonly string[]): string {
  let n = taken.length + 1;
  while (taken.some((id) => id.toLowerCase() === `${prefix}-${n}`.toLowerCase())) n += 1;
  return `${prefix}-${n}`;
}

function sameAtTwoFigures(left: number, right: number): boolean {
  return Number(left.toPrecision(2)) === Number(right.toPrecision(2));
}

function eventCodes(model: EsqModel, recoveries: readonly EsqResolvedRecovery[]): Map<string, string> {
  const codes = new Map(model.events.map((event) => [event.id, event.code]));
  for (const recovery of recoveries) codes.set(recovery.eventId, `NR-${recovery.id}`);
  return codes;
}

function byNominal(left: EsqPostCombinationView, right: EsqPostCombinationView): number {
  const a = left.finding?.nominalFrequency;
  const b = right.finding?.nominalFrequency;
  if (a === undefined || b === undefined) return a === undefined ? (b === undefined ? 0 : 1) : -1;
  return b - a;
}

function combinationViews(esq: EventSequenceQuantification, work: EsqPostWork, codes: ReadonlyMap<string, string>, points: EsqPoints | undefined): EsqPostCombinationView[] {
  const findings = work.search?.findings ?? [];
  const entries = resolvedCombinations(esq, points).map((entry): EsqPostCombinationView => {
    const key = combinationKey(entry.combination.eventIds);
    const view: EsqPostCombinationView = { key: entry.combination.id, eventIds: [...entry.combination.eventIds], codes: entry.members.map((member) => member.code), entry };
    const finding = findings.find((candidate) => combinationKey(candidate.eventIds) === key);
    if (finding !== undefined) view.finding = finding;
    return view;
  });
  const covered = new Set(entries.map((view) => combinationKey(view.eventIds)));
  const open = findings
    .filter((finding) => !covered.has(combinationKey(finding.eventIds)))
    .map((finding): EsqPostCombinationView => ({ key: `finding:${combinationKey(finding.eventIds)}`, eventIds: [...finding.eventIds], codes: finding.eventIds.map((id) => codes.get(id) ?? id), finding }));
  return [...entries, ...open].sort(byNominal);
}

function resultRows(esq: EventSequenceQuantification, work: EsqPostWork): EsqPostResultRow[] {
  const solve = solveWorkOf(esq);
  const families = modelViewOf(esq)?.families ?? [];
  const known = new Set(families.map((family) => family.id));
  const extra = [...(work.comparison?.families ?? []).map((family) => family.familyId), ...solve.families.filter((entry) => entry.run !== undefined).map((entry) => entry.familyId)].filter((id) => !known.has(id));
  const ids = [...families.map((family) => family.id), ...new Set(extra)];
  const names = new Map(families.map((family) => [family.id, family.name]));
  return ids.flatMap((familyId): EsqPostResultRow[] => {
    const row: EsqPostResultRow = { familyId, name: names.get(familyId) ?? "" };
    const without = work.comparison?.families.find((family) => family.familyId === familyId)?.annualFrequency;
    const withRules = solve.families.find((entry) => entry.familyId === familyId)?.run?.annualFrequency;
    if (without !== undefined) row.without = without;
    if (withRules !== undefined) row.withRules = withRules;
    return without === undefined && withRules === undefined ? [] : [row];
  });
}

function exclusionFindings(view: Omit<EsqPostView, "findings">): EsqPostFinding[] {
  const findings: EsqPostFinding[] = [];
  const deletions = view.work.deletions;
  for (const entry of view.exclusions) {
    const id = entry.exclusion.id;
    if (blank(entry.exclusion.basis)) findings.push({ severity: "error", check: "Deleted combination without a basis", item: id, detail: `Record why ${listText(entry.codes)} cannot occur together (ESQ-F1(o)).`, target: { kind: "esqExclusion", id } });
  }
  const checkable = view.exclusions.filter((entry) => entry.checkable);
  if (checkable.length > 0 && deletions === undefined) findings.push({ severity: "error", check: "Deletions not checked", item: "Exclusions", detail: "Check the deletions to list the cut sets each exclusion removes (ESQ-B7)." });
  if (deletions !== undefined && view.deletionsStale) findings.push({ severity: "warning", check: "Deletion check older than its inputs", item: "Exclusions", detail: "The model, logic or values changed after the check. Check the deletions again." });
  if (deletions !== undefined && !view.deletionsStale) {
    for (const entry of checkable) {
      if (entry.finding === undefined) findings.push({ severity: "note", check: "Exclusion removes nothing", item: entry.exclusion.id, detail: `No cut set above ${numberText(deletions.cutOff)} per year holds ${listText(entry.codes)}.`, target: { kind: "esqExclusion", id: entry.exclusion.id } });
    }
  }
  return findings;
}

function recoveryFindings(view: Omit<EsqPostView, "findings">): EsqPostFinding[] {
  const findings: EsqPostFinding[] = [];
  for (const entry of view.recoveries) {
    const recovery = entry.recovery;
    const item = recovery.id;
    const target = { kind: "esqPostRecovery" as const, id: recovery.id };
    const rule = recovery.rule;
    if (recovery.source === "TYPED" && rule?.typed !== undefined && blank(rule.typed.source)) findings.push({ severity: "error", check: "Typed HEP without a source", item, detail: "Name the document or analysis the non-recovery HEP comes from.", target });
    if (!recovery.credited) continue;
    if (recovery.missing.length > 0) findings.push({ severity: "error", check: "Recovery not feasible", item, detail: `A recovery fires only with cues, time, crew, procedure and access. Not shown: ${listText(recovery.missing.map((key) => FEASIBILITY_LABELS[key].toLowerCase()), 5)} (ESQ-A7).`, target });
    if (recovery.expression === undefined) findings.push({ severity: "error", check: "No non-recovery HEP", item, detail: "Use the HR value or type one with its source.", target });
    if (recovery.eventIds.length === 0) findings.push({ severity: "error", check: "Recovers no event", item, detail: "Choose the basic events this action recovers.", target });
    if (entry.active && !entry.assessed) {
      const hrId = recovery.record?.dependencyId;
      findings.push({ severity: "error", check: "Recovery outside the dependency assessment", item, detail: `Assess NR-${recovery.id} together with the events it recovers (ESQ-C2).${hrId === undefined ? "" : ` HR assessed it in ${hrId}.`}`, target });
    }
    if (blank(rule?.basis)) findings.push({ severity: "warning", check: "Credit without a basis", item, detail: "Record why the action is credited in these sequences.", target });
  }
  return findings;
}

function inHrOrder(members: readonly EsqCombinationMember[], record: EsqDependencyRecord | undefined): EsqCombinationMember[] {
  const position = (member: EsqCombinationMember): number => (record === undefined || member.hfeId === undefined || !record.hfeIds.includes(member.hfeId) ? Number.POSITIVE_INFINITY : record.hfeIds.indexOf(member.hfeId));
  return [...members].sort((a, b) => position(a) - position(b) || (b.probability ?? 0) - (a.probability ?? 0));
}

function hrLevelFinding(entry: EsqResolvedCombination, id: string): EsqPostFinding | undefined {
  const hr = entry.hr;
  if (entry.source !== "HRA" || hr === undefined || hr.level === "ZERO") return undefined;
  const expected = therpJoint(inHrOrder(entry.members, hr), hr.level);
  if (expected === undefined) return undefined;
  const floored = entry.floorApplies && entry.floor !== undefined ? Math.max(expected, entry.floor) : expected;
  if (sameAtTwoFigures(expected, hr.jointHep) || sameAtTwoFigures(floored, hr.jointHep)) return undefined;
  return { severity: "warning", check: "HR joint HEP disagrees with its level", item: id, detail: `HR gives ${numberText(hr.jointHep)} at ${LEVEL_LABELS[hr.level].toLowerCase()} dependence. THERP at that level gives ${numberText(floored)}.`, target: { kind: "esqPostCombination", id } };
}

function combinationFindings(view: Omit<EsqPostView, "findings">): EsqPostFinding[] {
  const findings: EsqPostFinding[] = [];
  const search = view.work.search;
  const humanCount = view.hfeIds.length + view.recoveries.filter((entry) => entry.active).length;
  if (search === undefined && humanCount >= 2) findings.push({ severity: "error", check: "HFE combinations not searched", item: "HFE combinations", detail: "Search the cut sets with every HEP raised to find those that hold several human failure events (ESQ-C1, ESQ-N-8)." });
  if (search !== undefined && view.searchStale) findings.push({ severity: "warning", check: "Search older than its inputs", item: "HFE combinations", detail: "Recovery, values or logic changed after the search. Search again." });
  for (const row of view.combinations) {
    const entry = row.entry;
    if (entry === undefined) {
      findings.push({ severity: "error", check: "Combination not assessed", item: listText(row.codes, 4), detail: `${row.finding?.cutSetCount ?? 0} cut sets hold these events together. Assess their joint HEP (ESQ-C2).` });
      continue;
    }
    const id = entry.combination.id;
    const target = { kind: "esqPostCombination" as const, id };
    if (new Set(entry.combination.eventIds).size < 2) {
      findings.push({ severity: "error", check: "Fewer than two events", item: id, detail: "A combination needs two or more human failure events.", target });
      continue;
    }
    if (entry.problem !== undefined) findings.push({ severity: "error", check: "Joint HEP not usable", item: id, detail: entry.problem, target });
    else if (entry.joint === undefined && !(entry.source === "THERP" && entry.members.some((member) => member.probability === undefined))) findings.push({ severity: "error", check: "No joint HEP of record", item: id, detail: "Link HR's assessment, set a dependence level, or type the joint HEP.", target });
    if (entry.source === "TYPED" && blank(entry.combination.typed?.source)) findings.push({ severity: "error", check: "Typed joint HEP without a source", item: id, detail: "Name the analysis the joint HEP comes from.", target });
    const contradiction = hrLevelFinding(entry, id);
    if (contradiction !== undefined) findings.push(contradiction);
    if (entry.source !== undefined && entry.source !== "HRA" && blank(entry.combination.basis)) {
      findings.push(entry.level === "ZERO" && entry.source === "THERP"
        ? { severity: "warning", check: "Independence without a basis", item: id, detail: "Record why these failures are judged independent.", target }
        : { severity: "warning", check: "Joint HEP without a basis", item: id, detail: "Record the dependence factors behind it, such as crew, timing, location and cues.", target });
    }
    if (!blank(entry.combination.floorWaiver)) findings.push({ severity: "note", check: "Floor waived", item: id, detail: entry.combination.floorWaiver?.trim() ?? "", target });
    if (search !== undefined && !view.searchStale && row.finding === undefined) findings.push({ severity: "note", check: "Not found in the search", item: id, detail: "No cut set in the search holds these events together. The joint HEP still applies wherever they meet.", target });
  }
  const typed = view.work.floor;
  const floorTarget = { kind: "esqPostFloor" as const, id: "floor" };
  if (typed !== undefined && blank(typed.source)) findings.push({ severity: "error", check: "Typed floor without a source", item: "Joint HEP floor", detail: "Name the analysis the floor comes from.", target: floorTarget });
  if (typed !== undefined && view.hrFloor !== undefined && typed.value < view.hrFloor) findings.push({ severity: "error", check: "Floor below HR's floor", item: "Joint HEP floor", detail: `HR sets ${numberText(view.hrFloor)}. A joint HEP never goes below it, so type a floor at or above it or remove the typed floor.`, target: floorTarget });
  if (view.floor === undefined && view.combinations.some((row) => row.entry !== undefined)) findings.push({ severity: "warning", check: "No joint HEP floor", item: "Joint HEP floor", detail: "HR gives no floor. Type one with its source.", target: floorTarget });
  return findings;
}

function resultFindings(view: Omit<EsqPostView, "findings">): EsqPostFinding[] {
  const findings: EsqPostFinding[] = [];
  const run = view.run;
  const runTarget = { kind: "esqSolveRun" as const, id: "run" };
  if (view.rulesActive && run === undefined) findings.push({ severity: "error", check: "Not quantified with the rules", item: "Run of record", detail: "Run the model in Step 05 with recovery and HFE dependency as set, and use the run." });
  if (run !== undefined) {
    const off = [
      run.logic.recovery === false && view.recoveries.some((entry) => entry.active) ? "recovery" : "",
      run.logic.dependency === false && view.combinations.some((row) => row.entry?.joint !== undefined) ? "HFE dependency" : "",
    ].filter((part) => part.length > 0);
    if (off.length > 0) findings.push({ severity: "error", check: "Run of record leaves rules out", item: "Run of record", detail: `The run of record has ${off.join(" and ")} off. Run the model again in Step 05 with both as set.`, target: runTarget });
    if (view.runStale) findings.push({ severity: "error", check: "Run of record older than the rules", item: "Run of record", detail: "Post-processing or other inputs changed after the run of record. Run the model again in Step 05 and use the run.", target: runTarget });
    if (view.rulesActive && view.work.comparison === undefined) findings.push({ severity: "note", check: "No comparison without the rules", item: "Results", detail: "Run the model without the rules to show what post-processing changes (ESQ-F1)." });
  }
  if (view.work.comparison !== undefined && view.comparisonStale) findings.push({ severity: "warning", check: "Comparison older than its inputs", item: "Results", detail: "The inputs changed after the comparison. Run it again." });
  return findings;
}

function postViewOf(esq: EventSequenceQuantification, points?: EsqPoints): EsqPostView | undefined {
  const model = esq.model;
  if (model?.importedAt === undefined) return undefined;
  const work = postWorkOf(esq);
  const roots = treesInScope(esq, model).filter((tree) => !tree.transferEntry);
  const recoveries = resolvedRecoveries(esq);
  const codes = eventCodes(model, recoveries);
  const codesOf = (ids: readonly string[]): string[] => ids.map((id) => codes.get(id) ?? id);
  const combinations = combinationViews(esq, work, codes, points);
  const assessed = combinations.flatMap((row) => (row.entry?.joint === undefined ? [] : [row.entry.combination.eventIds]));
  const hfeIds = hfeEventIds(esq, model);
  const names = new Map(model.events.map((event) => [event.id, event.name]));
  const recoveryViews = recoveries.map((recovery): EsqPostRecoveryView => {
    const view: EsqPostRecoveryView = {
      recovery,
      codes: codesOf(recovery.eventIds),
      active: recovery.credited && recovery.missing.length === 0 && recovery.expression !== undefined && recovery.eventIds.length > 0,
      assessed: assessed.some((eventIds) => eventIds.includes(recovery.eventId)),
    };
    const hfeId = recovery.record?.hfeId;
    const hfeName = hfeId === undefined ? undefined : model.humanEvents.find((entry) => entry.id === hfeId)?.name;
    if (hfeName !== undefined) view.hfeName = hfeName;
    return view;
  });
  const members: EsqPostMemberOption[] = [
    ...hfeIds.map((id) => ({ id, label: `${codes.get(id) ?? id}${blank(names.get(id)) ? "" : ` · ${names.get(id) ?? ""}`}` })).sort((a, b) => a.label.localeCompare(b.label)),
    ...recoveries.map((recovery) => ({ id: recovery.eventId, label: `NR-${recovery.id}${blank(recovery.name) ? "" : ` · ${recovery.name} fails`}` })),
  ];
  const deletions = work.deletions;
  const exclusions = (esq.logic?.exclusions ?? []).map((exclusion): EsqPostExclusionView => {
    const view: EsqPostExclusionView = { exclusion, codes: codesOf(exclusion.eventIds), checkable: new Set(exclusion.eventIds).size >= 2 };
    const finding = deletions?.findings.find((entry) => entry.exclusionId === exclusion.id);
    if (finding !== undefined) view.finding = finding;
    return view;
  });
  const searchKey = solveInputsKey(esq, { combinations: false });
  const fullKey = solveInputsKey(esq);
  const run = solveWorkOf(esq).run;
  const base: Omit<EsqPostView, "findings"> = {
    model,
    work,
    groups: [...new Set(roots.map((tree) => tree.initiatorId))].sort(),
    states: [...new Set(roots.flatMap((tree) => (tree.stateId === undefined ? [] : [tree.stateId])))].sort(),
    hfeIds,
    members,
    exclusions,
    recoveries: recoveryViews,
    combinations,
    searchStale: work.search !== undefined && work.search.inputs !== searchKey,
    deletionsStale: deletions !== undefined && deletions.inputs !== searchKey,
    comparisonStale: work.comparison !== undefined && work.comparison.inputs !== fullKey,
    rulesActive: recoveryViews.some((view) => view.active) || assessed.length > 0,
    runStale: run !== undefined && run.inputs !== fullKey,
    results: resultRows(esq, work),
  };
  const hrFloor = model.jointFloor?.value;
  const floor = floorValueOf(esq);
  const withFloors = { ...base, ...(hrFloor === undefined ? {} : { hrFloor }), ...(floor === undefined ? {} : { floor }) };
  const withRun = run === undefined ? withFloors : { ...withFloors, run };
  const findings = [...exclusionFindings(withRun), ...recoveryFindings(withRun), ...combinationFindings(withRun), ...resultFindings(withRun)];
  return { ...withRun, findings: findings.sort((a, b) => FINDING_RANK[a.severity] - FINDING_RANK[b.severity]) };
}

function postComplete(esq: EventSequenceQuantification): boolean {
  const view = postViewOf(esq);
  return view !== undefined && !view.findings.some((finding) => finding.severity === "error");
}

function withPostWork(esq: EventSequenceQuantification, fn: (work: EsqPostWork) => EsqPostWork): EventSequenceQuantification {
  return { ...esq, postWork: fn(postWorkOf(esq)) };
}

function replaced<T extends { id: string }>(list: readonly T[], id: string, next: T | undefined): T[] {
  if (next === undefined) return list.filter((item) => item.id !== id);
  return list.some((item) => item.id === id) ? list.map((item) => (item.id === id ? next : item)) : [...list, next];
}

function recoveryRuleOf(esq: EventSequenceQuantification, id: string): EsqRecoveryRule {
  return postWorkOf(esq).recoveries?.find((rule) => rule.id === id) ?? { id, groupIds: [], stateIds: [], credited: false, basis: "" };
}

function withRecoveryRule(esq: EventSequenceQuantification, id: string, rule: EsqRecoveryRule | undefined): EventSequenceQuantification {
  return withPostWork(esq, (work) => ({ ...work, recoveries: replaced(work.recoveries ?? [], id, rule) }));
}

function nextRecoveryId(esq: EventSequenceQuantification): string {
  return nextId("MR", [...(postWorkOf(esq).recoveries ?? []).map((rule) => rule.id), ...(esq.model?.recoveries ?? []).map((record) => record.id)]);
}

function withCombination(esq: EventSequenceQuantification, id: string, combination: EsqCombination | undefined): EventSequenceQuantification {
  return withPostWork(esq, (work) => ({ ...work, combinations: replaced(work.combinations ?? [], id, combination) }));
}

function nextCombinationId(esq: EventSequenceQuantification): string {
  return nextId("HC", (postWorkOf(esq).combinations ?? []).map((combination) => combination.id));
}

function defaultOrder(esq: EventSequenceQuantification, eventIds: readonly string[]): string[] {
  const members = combinationMembers(esq, eventIds);
  const hfeIds = members.flatMap((member) => (member.hfeId === undefined ? [] : [member.hfeId]));
  const record = hfeIds.length < 2 ? undefined : (esq.model?.dependencies ?? []).find((candidate) => hfeIds.every((hfeId) => candidate.hfeIds.includes(hfeId)));
  return inHrOrder(members, record).map((member) => member.eventId);
}

function withCombinationsFor(esq: EventSequenceQuantification, sets: readonly (readonly string[])[]): EventSequenceQuantification {
  return withPostWork(esq, (work) => {
    const existing = work.combinations ?? [];
    const covered = new Set(existing.map((entry) => combinationKey(entry.eventIds)));
    const taken = existing.map((entry) => entry.id);
    const added: EsqCombination[] = [];
    for (const eventIds of sets) {
      const key = combinationKey(eventIds);
      if (covered.has(key)) continue;
      covered.add(key);
      const id = nextId("HC", taken);
      taken.push(id);
      added.push({ id, eventIds: defaultOrder(esq, eventIds), groupIds: [], stateIds: [], basis: "" });
    }
    return { ...work, combinations: [...existing, ...added] };
  });
}

function withFloor(esq: EventSequenceQuantification, floor: { value: number; source: string } | undefined): EventSequenceQuantification {
  return withPostWork(esq, (work) => {
    const { floor: _old, ...rest } = work;
    return floor === undefined ? rest : { ...rest, floor };
  });
}

function withSearch(esq: EventSequenceQuantification, summary: EsqPostRunResult): EventSequenceQuantification {
  return withPostWork(esq, (work) => ({
    ...work,
    search: {
      runId: summary.runId,
      revision: summary.owner.workbookRevision,
      at: summary.completedAt,
      inputs: summary.inputs,
      raisedHep: summary.raisedHep ?? DEFAULT_RAISED_HEP,
      cutOff: summary.cutOff,
      findings: summary.combinations.map((finding) => ({ eventIds: [...finding.eventIds], treeIds: [...finding.treeIds], cutSetCount: finding.cutSetCount, nominalFrequency: finding.nominalFrequency })),
    },
  }));
}

function withDeletions(esq: EventSequenceQuantification, summary: EsqPostRunResult): EventSequenceQuantification {
  return withPostWork(esq, (work) => ({
    ...work,
    deletions: {
      runId: summary.runId,
      revision: summary.owner.workbookRevision,
      at: summary.completedAt,
      inputs: summary.inputs,
      cutOff: summary.cutOff,
      findings: summary.deletions.map((finding) => ({ exclusionId: finding.exclusionId, treeIds: [...finding.treeIds], cutSetCount: finding.cutSetCount, nominalFrequency: finding.nominalFrequency })),
    },
  }));
}

function withComparison(esq: EventSequenceQuantification, summary: EsqModelRunResult): EventSequenceQuantification {
  return withPostWork(esq, (work) => ({
    ...work,
    comparison: {
      runId: summary.runId,
      at: summary.completedAt,
      inputs: summary.inputs,
      families: summary.families.map((family) => ({ familyId: family.familyId, annualFrequency: family.annualFrequency })),
    },
  }));
}

function postRunProblem(summary: EsqPostRunResult, esq: EventSequenceQuantification): string | undefined {
  const failed = summary.trees.filter((tree) => tree.status === "FAILED").length;
  if (failed > 0) return `${failed} of ${summary.trees.length} event trees failed. Fix them and run again.`;
  if (summary.inputs !== solveInputsKey(esq, { combinations: false })) return "The model, logic or values changed during the run. Run again.";
  return undefined;
}

function comparisonProblem(summary: EsqModelRunResult, esq: EventSequenceQuantification): string | undefined {
  const failed = summary.trees.filter((tree) => tree.status === "FAILED").length;
  if (failed > 0) return `${failed} of ${summary.trees.length} event trees failed. Fix them and run again.`;
  if (summary.inputs !== solveInputsKey(esq)) return "The inputs changed during the run. Run again.";
  return undefined;
}

function comparisonRequest(run: EsqSolveRun): EsqComparisonRequest | undefined {
  const logic: EsqEventTreeRunLogic = { flags: run.logic.flags, loopBreaks: run.logic.loopBreaks, exclusions: run.logic.exclusions, expandCcf: run.logic.expandCcf, recovery: false, dependency: false };
  if (run.calculation === "EXACT") return { logic, calculation: "EXACT" };
  if (run.basis === undefined || run.quantifier === undefined || run.cutOffs === undefined || run.cutOffs.length === 0) return undefined;
  const cutSets: EventTreeCutSetSettings = { basis: run.basis, cutOffs: [...run.cutOffs], quantifier: run.quantifier, keep: COMPARISON_KEEP };
  if (run.limitOrder !== undefined) cutSets.limitOrder = run.limitOrder;
  return { logic, calculation: "CUT_SETS", cutSets };
}

export {
  DEFAULT_RAISED_HEP,
  DEPENDENCE_LEVELS,
  JOINT_SOURCE_LABELS,
  LEVEL_LABELS,
  comparisonProblem,
  comparisonRequest,
  nextCombinationId,
  nextRecoveryId,
  numberText,
  postComplete,
  postRunProblem,
  postViewOf,
  recoveryRuleOf,
  withCombination,
  withCombinationsFor,
  withComparison,
  withDeletions,
  withFloor,
  withRecoveryRule,
  withSearch,
  type EsqComparisonRequest,
  type EsqPostCombinationView,
  type EsqPostExclusionView,
  type EsqPostFinding,
  type EsqPostMemberOption,
  type EsqPostRecoveryView,
  type EsqPostResultRow,
  type EsqPostView,
  type EsqPostWindowKind,
};
