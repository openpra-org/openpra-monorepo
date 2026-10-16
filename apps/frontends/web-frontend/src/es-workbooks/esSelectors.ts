import { type EventSequence, type EventSequenceAnalysis, type EventSequenceFamily, type KeySafetyFunction, type EventTreeBranch, type EventTreeOutcome, type EventTreeSequence, type EventTreeTransfer } from "interfaces-mef-types/es/event-sequence-analysis";
import { EndState } from "interfaces-mef-types/core/events";
import { endStateOfKind } from "interfaces-mef-types/es/es-end-states";
import {
  CONFORMANCE_ITEMS,
  ES_STEPS,
  ES_PERSONA_STEPS,
  ES_FE_SC_MAP,
  type ConformanceItem,
  type EsPersona,
  type EsStep,
  type Stage,
} from "./esViewData";
import { type EsIeLinkStatus, type EsPosLinkStatus } from "./esWorkbookApi";
import { distinctSequenceName } from "../newly-developed-methods/event-tree";

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

function stepsFromMef(es: EventSequenceAnalysis, persona: EsPersona): EsStep[] {
  const base = stepsForPersona(persona);
  const scopeComplete = es.scopeDefinition.initiatingEventIds.length > 0 || es.scopeDefinition.plantOperatingStateIds.length > 0 || es.keySafetyFunctions.length > 0;
  const sequencesComplete = es.eventSequences.length > 0;
  const timingComplete = es.eventSequences.some((sequence) => (sequence.timing ?? []).length > 0) || (es.operatorActionWindows ?? []).length > 0 || (es.dependencyModels?.phenomenologicalDependencies ?? []).length > 0 || (es.repairCreditRecords ?? []).length > 0;
  const dynamicComplete = (es.dynamicRuns ?? []).length > 0;
  const uncertaintyComplete = es.modelUncertainty.uncertaintySources.length > 0 || (es.preOperationalAssumptions ?? []).length > 0 || (es.sensitivityStudies ?? []).length > 0;
  const handoffComplete = (es.eventTrees ?? []).length > 0 && es.eventSequenceFamilies.length > 0;
  const draftComplete = es.workflowState !== "DRAFT" && es.workflowState !== "REVISION_REQUIRED";
  const reviewComplete = es.workflowState === "FINAL";

  function status(complete: boolean): "complete" | "idle" {
    return complete ? "complete" : "idle";
  }

  return base.map((s) => {
    switch (s.id) {
      case "scope": return { ...s, status: status(scopeComplete) };
      case "sequences": return { ...s, status: status(sequencesComplete) };
      case "timing": return { ...s, status: status(timingComplete) };
      case "dynamic": return { ...s, status: status(dynamicComplete) };
      case "uncertainty": return { ...s, status: status(uncertaintyComplete) };
      case "handoff": return { ...s, status: status(handoffComplete) };
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
  path: Record<string, EventTreeOutcome>;
}

interface SeqLeafRef {
  seq: string;
}

interface TreeNodeView {
  fe: number;
  S?: TreeNodeView | SeqLeafRef;
  F?: TreeNodeView | SeqLeafRef;
  B?: TreeNodeView | SeqLeafRef;
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
      const bypassed = b.paths.find((p) => p.state === "BYPASSED");
      return {
        fe: feIndex.get(b.functionalEventId ?? "") ?? 0,
        ...(s === undefined ? {} : { S: childOf(s.target, s.targetType) }),
        ...(f === undefined ? {} : { F: childOf(f.target, f.targetType) }),
        ...(bypassed === undefined ? {} : { B: childOf(bypassed.target, bypassed.targetType) }),
      };
    }
    const paths = new Map<string, Record<string, EventTreeOutcome>>();
    function walkPaths(branchId: string, acc: Record<string, EventTreeOutcome>): void {
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

interface CoverageAxis {
  id: string;
  name: string;
}

interface CoverageView {
  groups: CoverageAxis[];
  states: CoverageAxis[];
  cellTree: Record<string, string>;
}

function coverageView(es: EventSequenceAnalysis, posLink: EsPosLinkStatus, ieLink: EsIeLinkStatus): CoverageView {
  const stateNames = new Map(posLink.states.map((state) => [state.id, state.name]));
  const groupNames = new Map(ieLink.groups.map((group) => [group.id, group.name]));
  const stateIds = es.scopeDefinition.plantOperatingStateIds.slice();
  const groupIds = es.scopeDefinition.initiatingEventIds.slice();
  const cellTree: Record<string, string> = {};
  for (const tree of es.eventTrees ?? []) {
    const state = tree.plantOperatingStateId;
    if (state === undefined || state.length === 0) continue;
    if (!stateIds.includes(state)) stateIds.push(state);
    if (!groupIds.includes(tree.initiatingEventId)) groupIds.push(tree.initiatingEventId);
    cellTree[`${tree.initiatingEventId}|${state}`] ??= tree.uuid;
  }
  return {
    groups: groupIds.map((id) => ({ id, name: groupNames.get(id) ?? "" })),
    states: stateIds.map((id) => ({ id, name: stateNames.get(id) ?? "" })),
    cellTree,
  };
}

function releaseCategoryOptions(es: EventSequenceAnalysis): CoverageAxis[] {
  const names = new Map<string, string>();
  for (const mapping of es.releaseCategoryMappings ?? []) {
    if ((names.get(mapping.releaseCategoryId) ?? "").length === 0) names.set(mapping.releaseCategoryId, mapping.name ?? "");
  }
  for (const sequence of es.eventSequences) {
    if (sequence.releaseCategoryId !== undefined && !names.has(sequence.releaseCategoryId)) names.set(sequence.releaseCategoryId, "");
  }
  return [...names].map(([id, name]) => ({ id, name }));
}

function nextReleaseCategoryId(used: readonly string[]): string {
  let index = used.length + 1;
  while (used.includes(`RC-${String(index)}`)) index += 1;
  return `RC-${String(index)}`;
}

function withSequenceReleaseCategory(es: EventSequenceAnalysis, sequenceId: string, releaseCategoryId: string | undefined): EventSequenceAnalysis {
  return {
    ...es,
    eventSequences: es.eventSequences.map((sequence) => {
      if (sequence.uuid !== sequenceId) return sequence;
      const { releaseCategoryId: _previous, ...rest } = sequence;
      return releaseCategoryId === undefined ? rest : { ...rest, releaseCategoryId };
    }),
    ...(es.releaseCategoryMappings === undefined ? {} : {
      releaseCategoryMappings: es.releaseCategoryMappings.map((mapping) => {
        const others = mapping.eventSequenceIds.filter((id) => id !== sequenceId);
        return { ...mapping, eventSequenceIds: mapping.releaseCategoryId === releaseCategoryId ? [...others, sequenceId] : others };
      }),
    }),
  };
}

function withLinkedSequence(es: EventSequenceAnalysis, treeId: string, treeSequenceId: string): { es: EventSequenceAnalysis; id: string } | undefined {
  const tree = es.eventTrees?.find((candidate) => candidate.uuid === treeId);
  const treeSequence = tree?.sequences[treeSequenceId];
  if (tree === undefined || treeSequence === undefined) return undefined;
  const existing = treeSequence.eventSequenceId;
  if (existing !== undefined && es.eventSequences.some((sequence) => sequence.uuid === existing)) return { es, id: existing };
  const id = crypto.randomUUID();
  const record: EventSequence = {
    uuid: id,
    name: treeSequence.name,
    initiatingEventId: tree.initiatingEventId,
    plantOperatingStateId: tree.plantOperatingStateId ?? "",
    eventTreeId: tree.uuid,
    eventTreeSequenceId: treeSequenceId,
    ...(treeSequence.functionalEventStates === undefined ? {} : { functionalEventStates: treeSequence.functionalEventStates }),
    endState: treeSequence.endState ?? EndState.SUCCESSFUL_MITIGATION,
    implementsSrs: [],
  };
  return {
    id,
    es: {
      ...es,
      eventSequences: [...es.eventSequences, record],
      eventTrees: (es.eventTrees ?? []).map((candidate) => (candidate.uuid === treeId ? { ...candidate, sequences: { ...candidate.sequences, [treeSequenceId]: { ...treeSequence, eventSequenceId: id } } } : candidate)),
    },
  };
}

function withSequenceFamily(es: EventSequenceAnalysis, sequenceId: string, familyId: string | undefined): EventSequenceAnalysis {
  return {
    ...es,
    eventSequences: es.eventSequences.map((sequence) => {
      if (sequence.uuid !== sequenceId) return sequence;
      const { sequenceFamilyId: _previous, ...rest } = sequence;
      return familyId === undefined ? rest : { ...rest, sequenceFamilyId: familyId };
    }),
    eventSequenceFamilies: es.eventSequenceFamilies.map((family) => {
      const others = family.memberSequenceIds.filter((id) => id !== sequenceId);
      return { ...family, memberSequenceIds: family.uuid === familyId ? [...others, sequenceId] : others };
    }),
  };
}

function withTreeSequenceClassification(es: EventSequenceAnalysis, treeId: string, treeSequenceId: string, changes: Partial<Pick<EventSequence, "sequenceFamilyId" | "releaseCategoryId">>): EventSequenceAnalysis {
  const linked = withLinkedSequence(es, treeId, treeSequenceId);
  if (linked === undefined) return es;
  let next = linked.es;
  if ("sequenceFamilyId" in changes) next = withSequenceFamily(next, linked.id, changes.sequenceFamilyId);
  if ("releaseCategoryId" in changes) next = withSequenceReleaseCategory(next, linked.id, changes.releaseCategoryId);
  return next;
}

function withSyncedSequenceEndState(es: EventSequenceAnalysis, treeId: string, treeSequenceId: string): EventSequenceAnalysis {
  const sequence = es.eventTrees?.find((tree) => tree.uuid === treeId)?.sequences[treeSequenceId];
  const definition = sequence?.endStateId === undefined ? undefined : es.endStateDefinitions?.find((candidate) => candidate.id === sequence.endStateId);
  if (definition === undefined) return es;
  const classified = withTreeSequenceClassification(es, treeId, treeSequenceId, { releaseCategoryId: definition.kind === "RELEASE" ? definition.releaseCategoryId : undefined });
  const recordId = classified.eventTrees?.find((tree) => tree.uuid === treeId)?.sequences[treeSequenceId]?.eventSequenceId;
  return {
    ...classified,
    eventSequences: classified.eventSequences.map((record) => (record.uuid === recordId ? { ...record, endState: endStateOfKind(definition.kind), endStateId: definition.id } : record)),
  };
}

function withEndStateDefinitionApplied(es: EventSequenceAnalysis, endStateId: string): EventSequenceAnalysis {
  const definition = es.endStateDefinitions?.find((candidate) => candidate.id === endStateId);
  if (definition === undefined) return es;
  let next = es;
  for (const tree of es.eventTrees ?? []) {
    for (const [sequenceId, sequence] of Object.entries(tree.sequences)) {
      if (sequence.endStateId !== endStateId) continue;
      next = {
        ...next,
        eventTrees: (next.eventTrees ?? []).map((candidate) => (candidate.uuid === tree.uuid ? { ...candidate, sequences: { ...candidate.sequences, [sequenceId]: { ...(candidate.sequences[sequenceId] ?? sequence), endState: endStateOfKind(definition.kind) } } } : candidate)),
      };
      next = withSyncedSequenceEndState(next, tree.uuid, sequenceId);
    }
  }
  return next;
}

function endStateUseCount(es: EventSequenceAnalysis, endStateId: string): number {
  return (es.eventTrees ?? []).reduce((count, tree) => count + Object.values(tree.sequences).filter((sequence) => sequence.endStateId === endStateId).length, 0);
}

export {
  eventTreesView,
  coverageView,
  endStateUseCount,
  withEndStateDefinitionApplied,
  withSyncedSequenceEndState,
  withTreeSequenceClassification,
  nextReleaseCategoryId,
  releaseCategoryOptions,
  withSequenceReleaseCategory,
  buildBranchesFromPaths,
  type EventTreeView,
  type TreeNodeView,
  type SeqLeafRef,
  type SeqLeafView,
  type FeView,
  type CoverageView,
  type CoverageAxis,
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

interface TreeSequenceRow {
  treeId: string;
  treeName: string;
  sequenceId: string;
  name: string;
  endStateId?: string;
  transferTargetId?: string;
  familyId?: string;
}

function treeSequenceRows(es: EventSequenceAnalysis): TreeSequenceRow[] {
  const familyOf = new Map(es.eventSequences.map((record) => [record.uuid, record.sequenceFamilyId]));
  return (es.eventTrees ?? []).flatMap((tree) => Object.entries(tree.sequences).map(([sequenceId, sequence]): TreeSequenceRow => {
    const familyId = sequence.eventSequenceId === undefined ? undefined : familyOf.get(sequence.eventSequenceId);
    const transferTargetId = tree.transfers?.[sequenceId]?.targetEventTreeId;
    return {
      treeId: tree.uuid,
      treeName: tree.name,
      sequenceId,
      name: sequence.name,
      ...(sequence.endStateId === undefined ? {} : { endStateId: sequence.endStateId }),
      ...(transferTargetId === undefined ? {} : { transferTargetId }),
      ...(familyId === undefined ? {} : { familyId }),
    };
  }));
}

interface ReleaseCategoryRow {
  id: string;
  name: string;
  endStateCodes: string[];
  sequenceCount: number;
  physicalReleaseCharacteristics: string[];
  commonCharacteristics: string[];
  mappingBasis: string;
}

interface ReleaseCategoryEdit {
  id: string;
  name: string;
  physicalReleaseCharacteristics: string[];
  commonCharacteristics: string[];
  mappingBasis: string;
}

function releaseCategoryRows(es: EventSequenceAnalysis): ReleaseCategoryRow[] {
  const rows = treeSequenceRows(es);
  const definitions = es.endStateDefinitions ?? [];
  const options = releaseCategoryOptions(es);
  const known = new Set(options.map((option) => option.id));
  const extra = [...new Set(definitions.flatMap((definition) => (definition.releaseCategoryId === undefined || known.has(definition.releaseCategoryId) ? [] : [definition.releaseCategoryId])))];
  return [...options, ...extra.map((id) => ({ id, name: "" }))].map((option) => {
    const mapping = es.releaseCategoryMappings?.find((candidate) => candidate.releaseCategoryId === option.id);
    const endStates = definitions.filter((definition) => definition.releaseCategoryId === option.id);
    const endStateIds = new Set(endStates.map((definition) => definition.id));
    return {
      id: option.id,
      name: option.name,
      endStateCodes: endStates.map((definition) => definition.code),
      sequenceCount: rows.filter((row) => row.endStateId !== undefined && endStateIds.has(row.endStateId)).length,
      physicalReleaseCharacteristics: mapping?.physicalReleaseCharacteristics ?? [],
      commonCharacteristics: mapping?.commonCharacteristics ?? [],
      mappingBasis: mapping?.mappingBasis ?? "",
    };
  });
}

function releaseCategoryInUse(es: EventSequenceAnalysis, categoryId: string): boolean {
  return (es.endStateDefinitions ?? []).some((definition) => definition.releaseCategoryId === categoryId)
    || es.eventSequences.some((record) => record.releaseCategoryId === categoryId);
}

function withReleaseCategoryRenamed(es: EventSequenceAnalysis, fromId: string, toId: string): EventSequenceAnalysis {
  if (fromId === toId) return es;
  return {
    ...es,
    ...(es.endStateDefinitions === undefined ? {} : {
      endStateDefinitions: es.endStateDefinitions.map((definition) => (definition.releaseCategoryId === fromId ? { ...definition, releaseCategoryId: toId } : definition)),
    }),
    eventSequences: es.eventSequences.map((record) => (record.releaseCategoryId === fromId ? { ...record, releaseCategoryId: toId } : record)),
    eventSequenceFamilies: es.eventSequenceFamilies.map((family) => (family.releaseCategoryIds === undefined ? family : { ...family, releaseCategoryIds: [...new Set(family.releaseCategoryIds.map((id) => (id === fromId ? toId : id)))] })),
    ...(es.releaseCategoryMappings === undefined ? {} : {
      releaseCategoryMappings: es.releaseCategoryMappings.map((mapping) => (mapping.releaseCategoryId === fromId ? { ...mapping, releaseCategoryId: toId } : mapping)),
    }),
  };
}

function withReleaseCategorySaved(es: EventSequenceAnalysis, previousId: string | undefined, edit: ReleaseCategoryEdit): EventSequenceAnalysis {
  const renamed = previousId === undefined ? es : withReleaseCategoryRenamed(es, previousId, edit.id);
  const mappings = renamed.releaseCategoryMappings ?? [];
  const existing = mappings.find((mapping) => mapping.releaseCategoryId === edit.id);
  const fields = {
    name: edit.name,
    physicalReleaseCharacteristics: edit.physicalReleaseCharacteristics,
    commonCharacteristics: edit.commonCharacteristics,
    mappingBasis: edit.mappingBasis,
  };
  return {
    ...renamed,
    releaseCategoryMappings: existing === undefined
      ? [...mappings, { uuid: crypto.randomUUID(), releaseCategoryId: edit.id, eventSequenceIds: renamed.eventSequences.filter((record) => record.releaseCategoryId === edit.id).map((record) => record.uuid), implementsSrs: [], ...fields }]
      : mappings.map((mapping) => (mapping === existing ? { ...mapping, ...fields } : mapping)),
  };
}

function withReleaseCategoryMerged(es: EventSequenceAnalysis, fromId: string, intoId: string): EventSequenceAnalysis {
  if (fromId === intoId) return es;
  const mappings = es.releaseCategoryMappings ?? [];
  const source = mappings.find((mapping) => mapping.releaseCategoryId === fromId);
  const kept = mappings.filter((mapping) => mapping.releaseCategoryId !== fromId);
  const target = kept.find((mapping) => mapping.releaseCategoryId === intoId);
  const moved = source?.eventSequenceIds ?? [];
  const merged = target === undefined
    ? (source === undefined ? kept : [...kept, { ...source, releaseCategoryId: intoId }])
    : kept.map((mapping) => (mapping === target ? { ...mapping, eventSequenceIds: [...new Set([...mapping.eventSequenceIds, ...moved])] } : mapping));
  return withReleaseCategoryRenamed({ ...es, releaseCategoryMappings: merged }, fromId, intoId);
}

function withReleaseCategoryRemoved(es: EventSequenceAnalysis, categoryId: string): EventSequenceAnalysis {
  if (es.releaseCategoryMappings === undefined) return es;
  return { ...es, releaseCategoryMappings: es.releaseCategoryMappings.filter((mapping) => mapping.releaseCategoryId !== categoryId) };
}

interface FamilyRow {
  id: string;
  name: string;
  endStateIds: string[];
  memberCount: number;
  similarityBasis: string;
}

function familyRows(es: EventSequenceAnalysis): FamilyRow[] {
  const rows = treeSequenceRows(es);
  return es.eventSequenceFamilies.map((family) => {
    const members = rows.filter((row) => row.familyId === family.uuid);
    return {
      id: family.uuid,
      name: family.name,
      endStateIds: [...new Set(members.flatMap((row) => (row.endStateId === undefined ? [] : [row.endStateId])))],
      memberCount: members.length,
      similarityBasis: family.similarityBasis ?? "",
    };
  });
}

function withFamilySaved(es: EventSequenceAnalysis, family: EventSequenceFamily): EventSequenceAnalysis {
  const known = es.eventSequenceFamilies.some((candidate) => candidate.uuid === family.uuid);
  return {
    ...es,
    eventSequenceFamilies: known ? es.eventSequenceFamilies.map((candidate) => (candidate.uuid === family.uuid ? family : candidate)) : [...es.eventSequenceFamilies, family],
  };
}

function withFamilyRemoved(es: EventSequenceAnalysis, familyId: string): EventSequenceAnalysis {
  return {
    ...es,
    eventSequenceFamilies: es.eventSequenceFamilies.filter((family) => family.uuid !== familyId),
    eventSequences: es.eventSequences.map((record) => {
      if (record.sequenceFamilyId !== familyId) return record;
      const { sequenceFamilyId: _removed, ...rest } = record;
      return rest;
    }),
  };
}

function unfamiliedSequences(es: EventSequenceAnalysis): TreeSequenceRow[] {
  return treeSequenceRows(es).filter((row) => row.endStateId !== undefined && row.familyId === undefined);
}

function withFamiliesByDefinition(es: EventSequenceAnalysis): EventSequenceAnalysis {
  const definitions = new Map((es.endStateDefinitions ?? []).map((definition) => [definition.id, definition]));
  const trees = new Map((es.eventTrees ?? []).map((tree) => [tree.uuid, tree]));
  let next = es;
  for (const row of unfamiliedSequences(es)) {
    const tree = trees.get(row.treeId);
    const definition = row.endStateId === undefined ? undefined : definitions.get(row.endStateId);
    if (tree === undefined || definition === undefined) continue;
    const stateId = tree.plantOperatingStateId ?? "";
    let family: EventSequenceFamily | undefined = next.eventSequenceFamilies.find((candidate) => candidate.endStateId === definition.id
      && candidate.representativeInitiatingEventId === tree.initiatingEventId
      && candidate.representativePlantOperatingStateId === stateId);
    if (family === undefined) {
      family = {
        uuid: crypto.randomUUID(),
        name: [tree.initiatingEventId, stateId, definition.code].filter((part) => part.length > 0).join(" · "),
        groupingCriteriaId: next.groupingCriteria?.[0]?.uuid ?? "",
        representativeInitiatingEventId: tree.initiatingEventId,
        representativePlantOperatingStateId: stateId,
        representativePlantResponse: "",
        releaseCategoryIds: definition.releaseCategoryId === undefined ? [] : [definition.releaseCategoryId],
        memberSequenceIds: [],
        endState: endStateOfKind(definition.kind),
        endStateId: definition.id,
        implementsSrs: [],
      };
      next = { ...next, eventSequenceFamilies: [...next.eventSequenceFamilies, family] };
    }
    next = withTreeSequenceClassification(next, row.treeId, row.sequenceId, { sequenceFamilyId: family.uuid });
  }
  return next;
}

interface TransferRow {
  treeId: string;
  treeName: string;
  sequenceId: string;
  sequenceName: string;
  targetTreeId: string;
  targetName: string;
}

function transferRows(es: EventSequenceAnalysis): TransferRow[] {
  const trees = es.eventTrees ?? [];
  const names = new Map(trees.map((tree) => [tree.uuid, tree.name]));
  return trees.flatMap((tree) => Object.entries(tree.transfers ?? {}).map(([sequenceId, transfer]) => ({
    treeId: tree.uuid,
    treeName: tree.name,
    sequenceId,
    sequenceName: tree.sequences[sequenceId]?.name ?? sequenceId,
    targetTreeId: transfer.targetEventTreeId,
    targetName: names.get(transfer.targetEventTreeId) ?? transfer.targetEventTreeId,
  })));
}

function withTransferEdited(es: EventSequenceAnalysis, treeId: string, sequenceId: string, transfer: EventTreeTransfer): EventSequenceAnalysis {
  return {
    ...es,
    eventTrees: (es.eventTrees ?? []).map((tree) => (tree.uuid === treeId ? { ...tree, transfers: { ...(tree.transfers ?? {}), [sequenceId]: transfer } } : tree)),
  };
}

function transferLoops(es: EventSequenceAnalysis): string[] {
  const edges = new Map((es.eventTrees ?? []).map((tree) => [tree.uuid, [...new Set(Object.values(tree.transfers ?? {}).map((transfer) => transfer.targetEventTreeId))]]));
  const looping: string[] = [];
  for (const start of edges.keys()) {
    const seen = new Set<string>();
    const pending = [...(edges.get(start) ?? [])];
    while (pending.length > 0) {
      const current = pending.pop();
      if (current === undefined || seen.has(current)) continue;
      if (current === start) {
        looping.push(start);
        break;
      }
      seen.add(current);
      pending.push(...(edges.get(current) ?? []));
    }
  }
  return looping;
}

export {
  treeSequenceRows,
  releaseCategoryRows,
  releaseCategoryInUse,
  withReleaseCategorySaved,
  withReleaseCategoryMerged,
  withReleaseCategoryRemoved,
  familyRows,
  withFamilySaved,
  withFamilyRemoved,
  unfamiliedSequences,
  withFamiliesByDefinition,
  transferRows,
  withTransferEdited,
  transferLoops,
  type TreeSequenceRow,
  type ReleaseCategoryRow,
  type FamilyRow,
  type TransferRow,
};

function reservedSequenceNames(es: EventSequenceAnalysis, treeId: string): Set<string> {
  return new Set((es.eventTrees ?? []).filter((tree) => tree.uuid !== treeId).flatMap((tree) => Object.values(tree.sequences).map((sequence) => sequence.name)));
}

function copiedRecord(record: EventSequence, uuid: string, name: string, treeId: string, sequenceId: string, sequence: EventTreeSequence): EventSequence {
  return {
    uuid,
    name,
    initiatingEventId: record.initiatingEventId,
    plantOperatingStateId: record.plantOperatingStateId,
    eventTreeId: treeId,
    eventTreeSequenceId: sequenceId,
    ...(sequence.functionalEventStates === undefined ? {} : { functionalEventStates: sequence.functionalEventStates }),
    endState: record.endState,
    ...(record.endStateId === undefined ? {} : { endStateId: record.endStateId }),
    ...(record.sequenceFamilyId === undefined ? {} : { sequenceFamilyId: record.sequenceFamilyId }),
    ...(record.releaseCategoryId === undefined ? {} : { releaseCategoryId: record.releaseCategoryId }),
    ...(record.affectedReactorSourceCombinations === undefined ? {} : { affectedReactorSourceCombinations: record.affectedReactorSourceCombinations }),
    implementsSrs: [],
  };
}

function withDistinctSequences(before: EventSequenceAnalysis, after: EventSequenceAnalysis): EventSequenceAnalysis {
  const trees = after.eventTrees ?? [];
  const previous = new Map<string, EventTreeSequence>((before.eventTrees ?? []).flatMap((tree) => Object.entries(tree.sequences).map(([id, sequence]) => [`${tree.uuid}|${id}`, sequence] as const)));
  const nameOwners = new Map<string, string>();
  const recordOwners = new Map<string, string>();
  for (const tree of trees) {
    for (const [id, sequence] of Object.entries(tree.sequences)) {
      const key = `${tree.uuid}|${id}`;
      const prior = previous.get(key);
      if (sequence.name.length > 0 && prior?.name === sequence.name && !nameOwners.has(sequence.name)) nameOwners.set(sequence.name, key);
      if (sequence.eventSequenceId !== undefined && prior?.eventSequenceId === sequence.eventSequenceId && !recordOwners.has(sequence.eventSequenceId)) recordOwners.set(sequence.eventSequenceId, key);
    }
  }
  const taken = new Set(nameOwners.keys());
  const records = new Map(after.eventSequences.map((record) => [record.uuid, record]));
  const copies: EventSequence[] = [];
  let changed = false;
  const nextTrees = trees.map((tree) => {
    let treeChanged = false;
    const sequences = Object.fromEntries(Object.entries(tree.sequences).map(([id, sequence]): [string, EventTreeSequence] => {
      const key = `${tree.uuid}|${id}`;
      let next = sequence;
      if (nameOwners.get(sequence.name) !== key) {
        const name = distinctSequenceName(sequence.name, taken);
        taken.add(name);
        if (name !== sequence.name) next = { ...next, name };
      }
      const recordId = sequence.eventSequenceId;
      if (recordId !== undefined) {
        const owner = recordOwners.get(recordId);
        if (owner === undefined) recordOwners.set(recordId, key);
        else if (owner !== key) {
          const record = records.get(recordId);
          if (record === undefined) {
            const { eventSequenceId: _shared, ...rest } = next;
            next = rest;
          } else {
            const uuid = crypto.randomUUID();
            copies.push(copiedRecord(record, uuid, next.name, tree.uuid, id, next));
            next = { ...next, eventSequenceId: uuid };
          }
        }
      }
      if (next !== sequence) treeChanged = true;
      return [id, next];
    }));
    if (!treeChanged) return tree;
    changed = true;
    return { ...tree, sequences };
  });
  if (!changed) return after;
  const familyMembers = new Map<string, string[]>();
  const categoryMembers = new Map<string, string[]>();
  for (const copy of copies) {
    if (copy.sequenceFamilyId !== undefined) familyMembers.set(copy.sequenceFamilyId, [...(familyMembers.get(copy.sequenceFamilyId) ?? []), copy.uuid]);
    if (copy.releaseCategoryId !== undefined) categoryMembers.set(copy.releaseCategoryId, [...(categoryMembers.get(copy.releaseCategoryId) ?? []), copy.uuid]);
  }
  return {
    ...after,
    eventTrees: nextTrees,
    eventSequences: [...after.eventSequences, ...copies],
    eventSequenceFamilies: after.eventSequenceFamilies.map((family) => {
      const added = familyMembers.get(family.uuid);
      return added === undefined ? family : { ...family, memberSequenceIds: [...family.memberSequenceIds, ...added] };
    }),
    ...(after.releaseCategoryMappings === undefined ? {} : {
      releaseCategoryMappings: after.releaseCategoryMappings.map((mapping) => {
        const added = categoryMembers.get(mapping.releaseCategoryId);
        return added === undefined ? mapping : { ...mapping, eventSequenceIds: [...mapping.eventSequenceIds, ...added] };
      }),
    }),
  };
}

export { reservedSequenceNames, withDistinctSequences };
