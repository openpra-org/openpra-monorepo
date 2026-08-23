import { type EventSequenceAnalysis, type KeySafetyFunction, type EventTreeBranch } from "interfaces-mef-types/es/event-sequence-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import {
  CONFORMANCE_ITEMS,
  ES_STEPS,
  ES_PERSONA_STEPS,
  ES_FE_SC_MAP,
  ES_POS_NAMES,
  type ConformanceItem,
  type EsPersona,
  type EsStep,
  type Stage,
} from "./esViewData";
import { type EsPosLinkStatus } from "./esWorkbookApi";

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
  percent: number;
}

interface CcSnapshotView {
  id: string;
  label: string;
}

interface NmView {
  id: string;
  name: string;
}

interface ScopeView {
  praScope: string;
  stateIds: string[];
  initiatorIds: string[];
  sources: string[];
  barriers: string[];
  keySafetyFunctions: KeySafetyFunction[];
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

function filterConformance(es: EventSequenceAnalysis, ccId: string, stage: Stage): ConformanceItem[] {
  const stageKey = stage === "operational" ? "operational" : "pre_operational";
  const statusBySr = new Map<string, string>();
  for (const entry of es.conformanceMatrix) {
    const ccUpper = ccId.replace("cc-", "").toUpperCase();
    if (entry.capabilityCategory === `CC-${ccUpper}`) statusBySr.set(entry.sr, entry.status);
  }
  return CONFORMANCE_ITEMS.filter((it) => it.requiredAt.includes(ccId)).map((it) => {
    if (!it.stages.includes(stageKey)) return { ...it, status: "na" as const };
    const matrixStatus = statusBySr.get(it.id);
    if (matrixStatus === "MET") return { ...it, status: "ok" as const };
    if (matrixStatus === "NOT_MET") return { ...it, status: "blocked" as const };
    if (matrixStatus === "NOT_APPLICABLE") return { ...it, status: "na" as const };
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

function ccScore(es: EventSequenceAnalysis, ccId: string, stage: Stage): CcScore {
  const items = filterConformance(es, ccId, stage);
  const applicable = items.filter((it) => it.status !== "na").length;
  const met = items.filter((it) => it.status === "ok").length;
  const warn = items.filter((it) => it.status === "warn").length;
  const blocked = items.filter((it) => it.status === "blocked").length;
  const na = items.filter((it) => it.status === "na").length;
  const percent = applicable === 0 ? 0 : Math.round((met / applicable) * 100);
  return { applicable, met, warn, blocked, na, percent };
}

function commentsView(es: EventSequenceAnalysis, now: Date = new Date()): CommentView[] {
  const reviewers = es.metadata.reviewers;
  return es.internalReviewComments.comments.map((c) => {
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
      section: item?.section ?? "Documentation (HLR-ES-D)",
      targetLabel: item?.text ?? "General",
      text: c.text,
      severity: c.severity ?? "OBSERVATION",
      resolved: c.resolved,
      resolution: c.resolution,
    };
  });
}

function ccSnapshotView(cc: PRAConfigurationControl): CcSnapshotView {
  return { id: cc.uuid, label: cc.name };
}

function nmViews(nms: NewlyDevelopedMethod[]): NmView[] {
  return nms.map((nm) => ({ id: nm.uuid, name: nm.name }));
}

function scopeView(es: EventSequenceAnalysis): ScopeView {
  return {
    praScope: es.praScope,
    stateIds: es.scopeDefinition.plantOperatingStateIds,
    initiatorIds: es.scopeDefinition.initiatingEventIds,
    sources: es.scopeDefinition.radioactiveMaterialSources,
    barriers: es.scopeDefinition.radionuclideBarriers,
    keySafetyFunctions: es.keySafetyFunctions,
  };
}

function stepsForPersona(persona: EsPersona): EsStep[] {
  const ids = ES_PERSONA_STEPS[persona];
  return ES_STEPS.filter((s) => ids.includes(s.id));
}

function hasDependencyModels(es: EventSequenceAnalysis): boolean {
  const d = es.dependencyModels;
  if (d === undefined) return false;
  return (d.functionalDependencies?.length ?? 0) > 0
    || (d.phenomenologicalDependencies?.length ?? 0) > 0
    || (d.operationalDependencies?.length ?? 0) > 0
    || (d.humanDependencies?.length ?? 0) > 0
    || (d.systemInterfaces?.length ?? 0) > 0;
}

function stepsFromMef(es: EventSequenceAnalysis, persona: EsPersona): EsStep[] {
  const base = stepsForPersona(persona);
  const scopeComplete = es.scopeDefinition.initiatingEventIds.length > 0 || es.scopeDefinition.plantOperatingStateIds.length > 0 || es.keySafetyFunctions.length > 0;
  const sequencesComplete = es.eventSequences.length > 0;
  const depsComplete = hasDependencyModels(es);
  const timingComplete = es.eventSequences.some((s) => (s.timing?.length ?? 0) > 0);
  const endStatesComplete = (es.releaseCategoryMappings ?? []).length > 0;
  const familiesComplete = es.eventSequenceFamilies.length > 0;
  const quantComplete = es.eventSequenceFamilies.some((f) => f.meanFrequency !== undefined);
  const draftComplete = es.workflowState !== "DRAFT" && es.workflowState !== "REVISION_REQUIRED";
  const reviewComplete = es.workflowState === "FINAL";

  function status(complete: boolean): "complete" | "idle" {
    return complete ? "complete" : "idle";
  }

  return base.map((s) => {
    switch (s.id) {
      case "scope": return { ...s, status: status(scopeComplete) };
      case "sequences": return { ...s, status: status(sequencesComplete) };
      case "deps": return { ...s, status: status(depsComplete) };
      case "timing": return { ...s, status: status(timingComplete) };
      case "endstates": return { ...s, status: status(endStatesComplete) };
      case "families": return { ...s, status: status(familiesComplete) };
      case "quant": return { ...s, status: status(quantComplete) };
      case "draft": return { ...s, status: status(draftComplete) };
      case "review": return { ...s, status: status(reviewComplete) };
      default: return { ...s, status: "idle" as const };
    }
  });
}

function freqValue(f: number | { value: number } | undefined): number | undefined {
  if (f === undefined) return undefined;
  return typeof f === "number" ? f : f.value;
}

interface SequenceView {
  id: string;
  name: string;
  initiatingEventId: string;
  plantOperatingStateId: string;
  eventTreeId?: string;
  endState: string;
  releaseCategoryId?: string;
  familyId?: string;
  meanFrequency?: number;
}

function sequencesView(es: EventSequenceAnalysis): SequenceView[] {
  return es.eventSequences.map((s) => ({
    id: s.uuid,
    name: s.name,
    initiatingEventId: s.initiatingEventId,
    plantOperatingStateId: s.plantOperatingStateId,
    eventTreeId: s.eventTreeId,
    endState: s.endState,
    releaseCategoryId: s.releaseCategoryId,
    familyId: s.sequenceFamilyId,
    meanFrequency: freqValue(s.meanFrequency),
  }));
}

interface FamilyView {
  id: string;
  name: string;
  endState: string;
  releaseCategoryIds: string[];
  members: string[];
  representativeId?: string;
  memberCount: number;
  meanFrequency?: number;
  response: string;
  similarityBasis?: string;
}

function familiesView(es: EventSequenceAnalysis): FamilyView[] {
  const freqOf = new Map(es.eventSequences.map((s) => [s.uuid, freqValue(s.meanFrequency) ?? 0]));
  return es.eventSequenceFamilies.map((f) => {
    const members = f.memberSequenceIds;
    const representativeId = members.length > 0
      ? [...members].sort((a, b) => (freqOf.get(b) ?? 0) - (freqOf.get(a) ?? 0))[0]
      : undefined;
    return {
      id: f.uuid,
      name: f.name,
      endState: f.endState,
      releaseCategoryIds: f.releaseCategoryIds ?? [],
      members,
      representativeId,
      memberCount: members.length,
      meanFrequency: freqValue(f.meanFrequency),
      response: f.representativePlantResponse,
      similarityBasis: f.similarityBasis,
    };
  });
}

type LbeClass = "AOO" | "DBE" | "BDBE";

interface LbeRowView {
  familyId: string;
  name: string;
  releaseCategoryId?: string;
  meanFrequency?: number;
  lbeClass?: LbeClass;
}

function lbeClassOf(freq: number | undefined): LbeClass | undefined {
  if (freq === undefined) return undefined;
  if (freq >= 1e-2) return "AOO";
  if (freq >= 1e-4) return "DBE";
  if (freq >= 5e-7) return "BDBE";
  return undefined;
}

function lbeView(es: EventSequenceAnalysis): LbeRowView[] {
  return es.eventSequenceFamilies
    .map((f) => {
      const freq = freqValue(f.meanFrequency);
      return {
        familyId: f.uuid,
        name: f.name,
        releaseCategoryId: (f.releaseCategoryIds ?? [])[0],
        meanFrequency: freq,
        lbeClass: lbeClassOf(freq),
      };
    })
    .sort((a, b) => (b.meanFrequency ?? 0) - (a.meanFrequency ?? 0));
}

interface ReleaseMappingView {
  uuid: string;
  releaseCategoryId: string;
  sequenceIds: string[];
  sequenceCount: number;
  meanFrequency?: number;
  mappingBasis: string;
  commonCharacteristics: string[];
  physicalReleaseCharacteristics: string[];
  processedByRiskIntegration?: boolean;
}

function releaseMappingsView(es: EventSequenceAnalysis): ReleaseMappingView[] {
  return (es.releaseCategoryMappings ?? []).map((m) => ({
    uuid: m.uuid,
    releaseCategoryId: m.releaseCategoryId,
    sequenceIds: m.eventSequenceIds,
    sequenceCount: m.eventSequenceIds.length,
    meanFrequency: freqValue(m.meanFrequency),
    mappingBasis: m.mappingBasis,
    commonCharacteristics: m.commonCharacteristics,
    physicalReleaseCharacteristics: m.physicalReleaseCharacteristics,
    processedByRiskIntegration: m.processedByRiskIntegration,
  }));
}

interface ScreeningView {
  sequenceId: string;
  retained: boolean;
  criterion?: string;
  justification: string;
}

function screeningView(es: EventSequenceAnalysis): ScreeningView[] {
  return es.screeningRecords.map((r) => ({
    sequenceId: r.sequenceId,
    retained: r.retained,
    criterion: r.criterion,
    justification: r.justification,
  }));
}

interface QuantView {
  id: string;
  name: string;
  endState: string;
  releaseCategoryIds: string[];
  meanFrequency?: number;
  memberCount: number;
  warn: boolean;
}

function quantView(es: EventSequenceAnalysis): QuantView[] {
  return es.eventSequenceFamilies.map((f) => ({
    id: f.uuid,
    name: f.name,
    endState: f.endState,
    releaseCategoryIds: f.releaseCategoryIds ?? [],
    meanFrequency: freqValue(f.meanFrequency),
    memberCount: f.memberSequenceIds.length,
    warn: f.similarityBasis !== undefined,
  }));
}

export {
  filterConformance,
  groupBySection,
  ccScore,
  commentsView,
  ccSnapshotView,
  nmViews,
  scopeView,
  sequencesView,
  familiesView,
  releaseMappingsView,
  lbeView,
  screeningView,
  quantView,
  freqValue,
  stepsForPersona,
  stepsFromMef,
  initialsOf,
  type CommentView,
  type CcScore,
  type CcSnapshotView,
  type NmView,
  type ScopeView,
  type SequenceView,
  type FamilyView,
  type ReleaseMappingView,
  type LbeRowView,
  type ScreeningView,
  type QuantView,
};

interface FeView {
  id: string;
  label: string;
  sub: string;
  scId?: string;
}

interface SeqLeafView {
  id: string;
  name?: string;
  endState: string;
  releaseCategoryId?: string;
  familyId?: string;
  meanFrequency?: number;
  importance?: string;
  path: Record<string, "SUCCESS" | "FAILURE">;
}

interface SeqLeafRef {
  seq: string;
}

interface TreeNodeView {
  fe: number;
  S: TreeNodeView | SeqLeafRef;
  F: TreeNodeView | SeqLeafRef;
}

interface EventTreeView {
  id: string;
  name: string;
  initiatingEventId: string;
  plantOperatingStateId?: string;
  missionTime?: number;
  missionTimeUnits?: string;
  description?: string;
  mitigationStrategy?: string;
  ieFreq?: number;
  applicableStates: string[];
  functionalEvents: FeView[];
  node: TreeNodeView | SeqLeafRef;
  sequences: SeqLeafView[];
}

function importanceFromRc(rc: string | undefined): string | undefined {
  if (rc === "RC-1") return "HIGH";
  if (rc === "RC-2") return "MEDIUM";
  if (rc === "RC-3") return "LOW";
  return undefined;
}

function eventTreesView(es: EventSequenceAnalysis): EventTreeView[] {
  const seqById = new Map(es.eventSequences.map((s) => [s.uuid, s]));
  return (es.eventTrees ?? []).map((tree) => {
    const fes = Object.values(tree.functionalEvents).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const feIndex = new Map(fes.map((fe, i) => [fe.uuid, i] as const));
    function childOf(target: string, targetType: string): TreeNodeView | SeqLeafRef {
      return targetType === "BRANCH" ? buildNode(target) : { seq: target };
    }
    function buildNode(branchId: string): TreeNodeView {
      const b = tree.branches[branchId];
      const s = b.paths.find((p) => p.state === "SUCCESS");
      const f = b.paths.find((p) => p.state === "FAILURE");
      return {
        fe: feIndex.get(b.functionalEventId ?? "") ?? 0,
        S: s !== undefined ? childOf(s.target, s.targetType) : { seq: "" },
        F: f !== undefined ? childOf(f.target, f.targetType) : { seq: "" },
      };
    }
    const paths = new Map<string, Record<string, "SUCCESS" | "FAILURE">>();
    function walkPaths(branchId: string, acc: Record<string, "SUCCESS" | "FAILURE">): void {
      const b = tree.branches[branchId];
      if (b === undefined) return;
      const feId = b.functionalEventId;
      for (const p of b.paths) {
        const next = feId !== undefined && feId.length > 0 ? { ...acc, [feId]: p.state } : { ...acc };
        if (p.targetType === "SEQUENCE") paths.set(p.target, next);
        else if (p.targetType === "BRANCH") walkPaths(p.target, next);
      }
    }
    if (tree.initialState.branchId.length > 0) walkPaths(tree.initialState.branchId, {});

    const sequences: SeqLeafView[] = Object.values(tree.sequences).map((s) => {
      const linked = s.eventSequenceId !== undefined ? seqById.get(s.eventSequenceId) : undefined;
      return {
        id: s.uuid,
        name: linked?.name,
        endState: String(s.endState ?? linked?.endState ?? ""),
        releaseCategoryId: linked?.releaseCategoryId,
        familyId: linked?.sequenceFamilyId,
        meanFrequency: freqValue(linked?.meanFrequency),
        importance: importanceFromRc(linked?.releaseCategoryId),
        path: paths.get(s.uuid) ?? {},
      };
    });
    const derivedIeFrequency = sequences.reduce((sum, s) => sum + (s.meanFrequency ?? 0), 0);
    const ieFreq = tree.initiatingEventFrequency?.value ?? (derivedIeFrequency > 0 ? derivedIeFrequency : undefined);
    const memberStates = new Set<string>();
    if (tree.plantOperatingStateId !== undefined) memberStates.add(tree.plantOperatingStateId);
    for (const s of Object.values(tree.sequences)) {
      const linked = s.eventSequenceId !== undefined ? seqById.get(s.eventSequenceId) : undefined;
      if (linked !== undefined) memberStates.add(linked.plantOperatingStateId);
    }
    return {
      id: tree.uuid,
      name: tree.name,
      initiatingEventId: tree.initiatingEventId,
      plantOperatingStateId: tree.plantOperatingStateId,
      missionTime: tree.missionTime,
      missionTimeUnits: tree.missionTimeUnits,
      description: tree.description,
      mitigationStrategy: tree.mitigationStrategy,
      ieFreq,
      applicableStates: Array.from(memberStates),
      functionalEvents: fes.map((fe) => ({ id: fe.uuid, label: fe.label ?? fe.name, sub: fe.description ?? "", scId: ES_FE_SC_MAP[fe.uuid] })),
      node: tree.initialState.branchId.length > 0 ? buildNode(tree.initialState.branchId) : { seq: "" },
      sequences,
    };
  });
}

function buildBranchesFromPaths(
  treeId: string,
  feOrder: string[],
  seqs: { id: string; path: Record<string, "SUCCESS" | "FAILURE"> }[],
): { branches: Record<string, EventTreeBranch>; initialBranchId: string } {
  const branches: Record<string, EventTreeBranch> = {};
  let counter = 0;
  function build(prefixFes: string[], prefixStates: Record<string, "SUCCESS" | "FAILURE">): { target: string; targetType: "BRANCH" | "SEQUENCE" } {
    const matching = seqs.filter((s) => prefixFes.every((fe) => s.path[fe] === prefixStates[fe]));
    const nextFe = feOrder.find((fe) => !prefixFes.includes(fe) && matching.some((s) => s.path[fe] !== undefined));
    if (nextFe === undefined) {
      return { target: matching[0]?.id ?? "", targetType: "SEQUENCE" };
    }
    const branchId = `${treeId}-b${counter}`;
    counter += 1;
    const sChild = build([...prefixFes, nextFe], { ...prefixStates, [nextFe]: "SUCCESS" });
    const fChild = build([...prefixFes, nextFe], { ...prefixStates, [nextFe]: "FAILURE" });
    branches[branchId] = {
      uuid: branchId,
      name: nextFe,
      functionalEventId: nextFe,
      paths: [
        { state: "SUCCESS", target: sChild.target, targetType: sChild.targetType },
        { state: "FAILURE", target: fChild.target, targetType: fChild.targetType },
      ],
    };
    return { target: branchId, targetType: "BRANCH" };
  }
  const root = build([], {});
  return { branches, initialBranchId: root.targetType === "BRANCH" ? root.target : "" };
}

interface CoverageStateView {
  id: string;
  name: string;
}

interface CoverageIeView {
  id: string;
  treeCount: number;
}

interface CoverageView {
  ies: CoverageIeView[];
  states: CoverageStateView[];
  cellTree: Record<string, string>;
}

function coverageView(es: EventSequenceAnalysis, posLink?: EsPosLinkStatus): CoverageView {
  const nameById = new Map<string, string>();
  for (const st of posLink?.states ?? []) nameById.set(st.id, st.name);
  const states: CoverageStateView[] = es.scopeDefinition.plantOperatingStateIds.map((id) => ({ id, name: nameById.get(id) ?? ES_POS_NAMES[id] ?? "" }));
  const cellTree: Record<string, string> = {};
  const ieCount = new Map<string, number>();
  for (const tree of es.eventTrees ?? []) {
    const pos = tree.plantOperatingStateId;
    if (pos === undefined || pos.length === 0) continue;
    cellTree[`${tree.initiatingEventId}|${pos}`] = tree.uuid;
    ieCount.set(tree.initiatingEventId, (ieCount.get(tree.initiatingEventId) ?? 0) + 1);
  }
  const ieIds = es.scopeDefinition.initiatingEventIds.slice();
  for (const tree of es.eventTrees ?? []) {
    if (!ieIds.includes(tree.initiatingEventId)) ieIds.push(tree.initiatingEventId);
  }
  const ies: CoverageIeView[] = ieIds.map((id) => ({ id, treeCount: ieCount.get(id) ?? 0 }));
  return { ies, states, cellTree };
}

export {
  eventTreesView,
  coverageView,
  buildBranchesFromPaths,
  type EventTreeView,
  type TreeNodeView,
  type SeqLeafRef,
  type SeqLeafView,
  type FeView,
  type CoverageView,
  type CoverageStateView,
  type CoverageIeView,
};

interface DependencyView {
  id: string;
  type: string;
  from: string;
  to: string;
  desc: string;
  importance?: string;
  timePhased: boolean;
  initiatingEvents: string[];
}

function dependenciesView(es: EventSequenceAnalysis): DependencyView[] {
  const models = es.dependencyModels?.functionalDependencies ?? [];
  return models.flatMap((m) => m.dependencies).map((d) => ({
    id: d.uuid,
    type: String(d.dependencyType),
    from: d.dependentElement,
    to: d.dependedUponElement,
    desc: d.description,
    importance: d.importanceLevel !== undefined ? String(d.importanceLevel) : undefined,
    timePhased: d.timePhased ?? false,
    initiatingEvents: d.applicableInitiatingEvents ?? [],
  }));
}

export { dependenciesView, type DependencyView };

type TimelineKind = "init" | "auto" | "cue" | "op" | "limit";

interface TimelineMilestoneView {
  t: number;
  label: string;
  kind: TimelineKind;
  basis?: string;
}

interface TimelineView {
  milestones: TimelineMilestoneView[];
  damageFrom: number | null;
  tMax: number;
}

const TIMING_KIND: Record<string, TimelineKind> = {
  INITIATOR: "init",
  AUTOMATIC: "auto",
  OPERATOR_CUE: "cue",
  OPERATOR_ACTION: "op",
  DAMAGE_LIMIT: "limit",
};

function timelineView(es: EventSequenceAnalysis, treeId: string): TimelineView {
  const seqs = es.eventSequences.filter((s) => s.eventTreeId === treeId);
  const byKey = new Map<string, TimelineMilestoneView>();
  for (const s of seqs) {
    for (const entry of s.timing ?? []) {
      const kind = TIMING_KIND[String(entry.category ?? "AUTOMATIC")] ?? "auto";
      const key = `${entry.event}|${entry.timeAfterInitiator}`;
      if (!byKey.has(key)) byKey.set(key, { t: entry.timeAfterInitiator, label: entry.event, kind, basis: entry.basis });
    }
  }
  const ie = seqs[0]?.initiatingEventId;
  for (const w of es.operatorActionWindows ?? []) {
    if (ie === undefined || !(w.applicableInitiatingEvents ?? []).includes(ie)) continue;
    if (w.cueMinutes !== undefined && w.cue !== undefined && w.cue.length > 0) {
      byKey.set(`cue|${w.uuid}`, { t: w.cueMinutes, label: w.cue, kind: "cue", basis: w.humanActionId });
    }
    byKey.set(`op|${w.uuid}`, { t: w.windowStartMinutes, label: `${w.action} window opens`, kind: "op", basis: w.humanActionId });
  }
  const milestones = Array.from(byKey.values()).sort((a, b) => a.t - b.t);
  const limits = milestones.filter((m) => m.kind === "limit").map((m) => m.t);
  const damageFrom = limits.length > 0 ? Math.min(...limits) : null;
  const tMax = milestones.reduce((mx, m) => Math.max(mx, m.t), 60) * 1.25;
  return { milestones, damageFrom, tMax };
}

export { timelineView, type TimelineView, type TimelineMilestoneView };
