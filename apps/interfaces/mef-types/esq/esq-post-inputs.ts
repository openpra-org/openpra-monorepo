import type {
  EsqActionFeasibility,
  EsqCombination,
  EsqDependenceLevel,
  EsqDependencyRecord,
  EsqJointSource,
  EsqModel,
  EsqPostWork,
  EsqRecoveryRecord,
  EsqRecoveryRule,
  EsqTreeRecord,
  EventSequenceQuantification,
} from "./event-sequence-quantification";
import type { UncertainExpression } from "../core/uncertainty";
import { esqStableId, sameItem } from "./esq-run-inputs";

type EsqFeasibilityKey = keyof EsqActionFeasibility;

interface EsqResolvedRecovery {
  id: string;
  name: string;
  record?: EsqRecoveryRecord;
  rule?: EsqRecoveryRule;
  manual: boolean;
  eventIds: string[];
  groupIds: string[];
  stateIds: string[];
  credited: boolean;
  source?: "HRA" | "TYPED";
  expression?: UncertainExpression;
  feasibility?: EsqActionFeasibility;
  missing: EsqFeasibilityKey[];
  eventId: string;
}

interface EsqCombinationMember {
  eventId: string;
  code: string;
  probability?: number;
  hfeId?: string;
  recoveryId?: string;
  rank: number;
}

interface EsqResolvedCombination {
  combination: EsqCombination;
  members: EsqCombinationMember[];
  independent?: number;
  hr?: EsqDependencyRecord;
  suggested?: EsqDependencyRecord;
  level?: EsqDependenceLevel;
  therp?: number;
  typed?: number;
  source?: EsqJointSource;
  floor?: number;
  floorApplies: boolean;
  raw?: number;
  joint?: number;
  problem?: string;
}

interface EsqJointSolution {
  joints: Map<string, number>;
  independents: Map<string, number>;
  problem?: string;
}

type EsqPoints = ReadonlyMap<string, number>;

const FEASIBILITY_REQUIRED: readonly EsqFeasibilityKey[] = ["cues", "time", "crew", "procedure", "access"];

const TIMING_RANK: Record<string, number> = { PRE_INITIATOR: 0, AT_INITIATOR: 1, POST_INITIATOR: 2 };

const THERP_CONDITIONAL: Record<EsqDependenceLevel, (probability: number) => number> = {
  ZERO: (probability) => probability,
  LOW: (probability) => (1 + 19 * probability) / 20,
  MODERATE: (probability) => (1 + 6 * probability) / 7,
  HIGH: (probability) => (1 + probability) / 2,
  COMPLETE: () => 1,
};

const MAX_RELEVANT = 16;

function postWorkOf(esq: EventSequenceQuantification): EsqPostWork {
  return esq.postWork ?? {};
}

function esqPostRunId(): string {
  return esqStableId("post-run");
}

function esqRecoveryEventId(ruleId: string): string {
  return esqStableId(`recovery:${ruleId}`);
}

function esqJointEventId(combinationId: string): string {
  return esqStableId(`joint:${combinationId}`);
}

function esqIndependentEventId(eventId: string): string {
  return esqStableId(`independent:${eventId}`);
}

function combinationKey(eventIds: readonly string[]): string {
  return [...eventIds].sort().join("|");
}

function scopeApplies(groupIds: readonly string[], stateIds: readonly string[], tree: EsqTreeRecord): boolean {
  const stateId = tree.stateId;
  const groupMatch = groupIds.length === 0 || groupIds.some((id) => sameItem(id, tree.initiatorId));
  const stateMatch = stateIds.length === 0 || (stateId !== undefined && stateIds.some((id) => sameItem(id, stateId)));
  return groupMatch && stateMatch;
}

function holderOf(esq: EventSequenceQuantification, model: EsqModel, eventId: string): { heldBy?: string; holderId?: string } {
  const binding = esq.modelDecisions?.valueBindings?.find((entry) => entry.eventId === eventId);
  const record = model.events.find((event) => event.id === eventId);
  const out: { heldBy?: string; holderId?: string } = {};
  const heldBy = binding?.heldBy ?? record?.heldBy;
  const holderId = binding?.holderId ?? record?.holderId;
  if (heldBy !== undefined) out.heldBy = heldBy;
  if (holderId !== undefined) out.holderId = holderId;
  return out;
}

function eventProbabilityOf(esq: EventSequenceQuantification, model: EsqModel, eventId: string, points?: EsqPoints): number | undefined {
  const record = model.events.find((event) => event.id === eventId);
  const { heldBy, holderId } = holderOf(esq, model, eventId);
  if (heldBy === "DA" && holderId !== undefined) return points?.get(`PARAMETER:${holderId}`);
  if (heldBy === "HRA" && holderId !== undefined) return points?.get(`HFE:${holderId}`);
  if (record?.value === undefined || record.valueUnit === "PER_HOUR") return undefined;
  return record.value;
}

function hfeEventIds(esq: EventSequenceQuantification, model: EsqModel): string[] {
  return model.events.flatMap((event) => (holderOf(esq, model, event.id).heldBy === "HRA" ? [event.id] : []));
}

function feasibilityMissing(feasibility: EsqActionFeasibility | undefined): EsqFeasibilityKey[] {
  return FEASIBILITY_REQUIRED.filter((key) => feasibility?.[key] !== true);
}

function resolvedRecoveries(esq: EventSequenceQuantification): EsqResolvedRecovery[] {
  const model = esq.model;
  if (model === undefined) return [];
  const rules = postWorkOf(esq).recoveries ?? [];
  const records = model.recoveries ?? [];
  const fromHr = records.map((record): EsqResolvedRecovery => {
    const rule = rules.find((entry) => entry.id === record.id);
    const eventIds = rule?.eventIds ?? model.events.flatMap((event) => {
      const holder = holderOf(esq, model, event.id);
      return holder.heldBy === "HRA" && holder.holderId === record.hfeId ? [event.id] : [];
    });
    const source = rule?.ofRecord ?? (record.hep !== undefined ? "HRA" : rule?.typed !== undefined ? "TYPED" : undefined);
    const expression = source === "HRA" ? record.hep : source === "TYPED" ? rule?.typed?.expression : undefined;
    const feasibility = rule?.feasibility ?? record.feasibility;
    const view: EsqResolvedRecovery = {
      id: record.id,
      name: record.name,
      record,
      manual: false,
      eventIds,
      groupIds: rule?.groupIds ?? [],
      stateIds: rule?.stateIds ?? [],
      credited: rule?.credited === true,
      feasibility,
      missing: feasibilityMissing(feasibility),
      eventId: esqRecoveryEventId(record.id),
    };
    if (rule !== undefined) view.rule = rule;
    if (source !== undefined) view.source = source;
    if (expression !== undefined) view.expression = expression;
    return view;
  });
  const manual = rules.filter((rule) => rule.manual !== undefined && !records.some((record) => record.id === rule.id)).map((rule): EsqResolvedRecovery => {
    const view: EsqResolvedRecovery = {
      id: rule.id,
      name: rule.manual?.name ?? "",
      rule,
      manual: true,
      eventIds: rule.eventIds ?? [],
      groupIds: rule.groupIds,
      stateIds: rule.stateIds,
      credited: rule.credited,
      missing: feasibilityMissing(rule.feasibility),
      eventId: esqRecoveryEventId(rule.id),
    };
    if (rule.feasibility !== undefined) view.feasibility = rule.feasibility;
    if (rule.typed !== undefined) {
      view.source = "TYPED";
      view.expression = rule.typed.expression;
    }
    return view;
  });
  return [...fromHr, ...manual];
}

function activeRecoveries(esq: EventSequenceQuantification, tree: EsqTreeRecord): EsqResolvedRecovery[] {
  return resolvedRecoveries(esq).filter((recovery) => recovery.credited && recovery.missing.length === 0 && recovery.expression !== undefined && recovery.eventIds.length > 0 && scopeApplies(recovery.groupIds, recovery.stateIds, tree));
}

function memberOf(esq: EventSequenceQuantification, model: EsqModel, recoveries: readonly EsqResolvedRecovery[], eventId: string, points?: EsqPoints): EsqCombinationMember {
  const recovery = recoveries.find((entry) => entry.eventId === eventId);
  if (recovery !== undefined) {
    const recovered = recovery.eventIds.map((id) => timingRankOf(esq, model, id));
    const member: EsqCombinationMember = { eventId, code: `NR-${recovery.id}`, recoveryId: recovery.id, rank: Math.max(2, ...recovered) + 0.5 };
    const probability = points?.get(`RECOVERY:${recovery.id}`);
    if (probability !== undefined) member.probability = probability;
    return member;
  }
  const record = model.events.find((event) => event.id === eventId);
  const { heldBy, holderId } = holderOf(esq, model, eventId);
  const member: EsqCombinationMember = { eventId, code: record?.code ?? eventId, rank: timingRankOf(esq, model, eventId) };
  const probability = eventProbabilityOf(esq, model, eventId, points);
  if (probability !== undefined) member.probability = probability;
  if (heldBy === "HRA" && holderId !== undefined) member.hfeId = holderId;
  return member;
}

function timingRankOf(esq: EventSequenceQuantification, model: EsqModel, eventId: string): number {
  const { heldBy, holderId } = holderOf(esq, model, eventId);
  const timing = heldBy === "HRA" ? model.humanEvents.find((entry) => entry.id === holderId)?.timing : undefined;
  return timing === undefined ? 2 : TIMING_RANK[timing] ?? 2;
}

function tokensOf(members: readonly EsqCombinationMember[]): string[] {
  return members.map((member) => (member.recoveryId !== undefined ? `recovery:${member.recoveryId}` : member.hfeId ?? `event:${member.eventId}`));
}

function hrTokensOf(record: EsqDependencyRecord, recoveries: readonly EsqResolvedRecovery[]): string[] {
  const linked = record.includesRecovery ? recoveries.filter((recovery) => recovery.record?.dependencyId === record.id).map((recovery) => `recovery:${recovery.id}`) : [];
  return [...record.hfeIds, ...linked];
}

function sameTokens(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((token) => right.includes(token));
}

function therpJoint(members: readonly EsqCombinationMember[], level: EsqDependenceLevel): number | undefined {
  const ordered = members.map((member, index) => ({ member, index })).sort((a, b) => a.member.rank - b.member.rank || a.index - b.index).map(({ member }) => member);
  let joint: number | undefined;
  for (const member of ordered) {
    if (member.probability === undefined) return undefined;
    joint = joint === undefined ? member.probability : joint * THERP_CONDITIONAL[level](member.probability);
  }
  return joint;
}

function combinationMembers(esq: EventSequenceQuantification, eventIds: readonly string[], points?: EsqPoints): EsqCombinationMember[] {
  const model = esq.model;
  if (model === undefined) return [];
  const recoveries = resolvedRecoveries(esq);
  return eventIds.map((eventId) => memberOf(esq, model, recoveries, eventId, points));
}

function floorValueOf(esq: EventSequenceQuantification): number | undefined {
  return postWorkOf(esq).floor?.value ?? esq.model?.jointFloor?.value;
}

function resolvedCombinations(esq: EventSequenceQuantification, points?: EsqPoints): EsqResolvedCombination[] {
  const model = esq.model;
  if (model === undefined) return [];
  const recoveries = resolvedRecoveries(esq);
  const dependencies = model.dependencies ?? [];
  const floor = floorValueOf(esq);
  return (postWorkOf(esq).combinations ?? []).map((combination): EsqResolvedCombination => {
    const members = combination.eventIds.map((eventId) => memberOf(esq, model, recoveries, eventId, points));
    const tokens = tokensOf(members);
    const matches = dependencies.filter((record) => sameTokens(hrTokensOf(record, recoveries), tokens));
    const linked = combination.dependencyId === undefined ? matches.length === 1 ? matches[0] : undefined : dependencies.find((record) => record.id === combination.dependencyId);
    const containing = dependencies.find((record) => tokens.every((token) => hrTokensOf(record, recoveries).includes(token)));
    const view: EsqResolvedCombination = { combination, members, floorApplies: false };
    if (floor !== undefined) view.floor = floor;
    if (members.every((member) => member.probability !== undefined)) view.independent = members.reduce((product, member) => product * (member.probability ?? 1), 1);
    if (linked !== undefined) view.hr = linked;
    if (containing !== undefined) view.suggested = containing;
    const level = combination.level ?? linked?.level ?? containing?.level;
    if (level !== undefined) {
      view.level = level;
      const therp = therpJoint(members, level);
      if (therp !== undefined) view.therp = therp;
    }
    if (combination.typed !== undefined) view.typed = combination.typed.joint;
    const source = combination.ofRecord ?? (linked !== undefined ? "HRA" : undefined);
    if (source !== undefined) view.source = source;
    const raw = source === "HRA" ? linked?.jointHep : source === "THERP" ? view.therp : source === "TYPED" ? view.typed : undefined;
    const judgedIndependent = source === "HRA" ? linked?.level === "ZERO" : source === "THERP" ? level === "ZERO" : false;
    view.floorApplies = floor !== undefined && !judgedIndependent && (combination.floorWaiver === undefined || combination.floorWaiver.trim().length === 0);
    if (raw !== undefined) {
      view.raw = raw;
      view.joint = view.floorApplies && floor !== undefined ? Math.max(raw, floor) : raw;
    }
    const smallest = members.reduce((least, member) => Math.min(least, member.probability ?? Number.POSITIVE_INFINITY), Number.POSITIVE_INFINITY);
    if (points === undefined) return view;
    if (members.some((member) => member.probability === undefined)) view.problem = "A member has no probability.";
    else if (view.joint !== undefined && view.joint > smallest) view.problem = `The joint HEP ${view.joint.toPrecision(3)} exceeds a member HEP of ${smallest.toPrecision(3)}.`;
    else if (view.joint !== undefined && view.independent !== undefined && view.joint < view.independent * (1 - 1e-12)) view.problem = `The joint HEP ${view.joint.toPrecision(3)} is below the independent product ${view.independent.toPrecision(3)}.`;
    return view;
  });
}

function allFail(members: readonly string[], combos: readonly { id: string; members: ReadonlySet<string>; g: number }[], independents: ReadonlyMap<string, number>): number | undefined {
  const relevant = combos.filter((combo) => members.some((member) => combo.members.has(member)));
  if (relevant.length > MAX_RELEVANT) return undefined;
  let total = 0;
  for (let mask = 0; mask < 2 ** relevant.length; mask += 1) {
    let weight = 1;
    const covered = new Set<string>();
    relevant.forEach((combo, index) => {
      if (Math.floor(mask / 2 ** index) % 2 === 1) {
        weight *= combo.g;
        combo.members.forEach((member) => covered.add(member));
      } else {
        weight *= 1 - combo.g;
      }
    });
    for (const member of members) if (!covered.has(member)) weight *= independents.get(member) ?? 0;
    total += weight;
  }
  return total;
}

function solveJointEvents(probabilities: ReadonlyMap<string, number>, combinations: readonly { id: string; eventIds: readonly string[]; joint: number }[]): EsqJointSolution {
  const combos = combinations.map((combination) => ({ id: combination.id, members: new Set(combination.eventIds), list: [...combination.eventIds], joint: combination.joint, g: 0 }));
  const independents = new Map<string, number>();
  const failed = (problem: string): EsqJointSolution => ({ joints: new Map(), independents: new Map(), problem });
  const sharedOf = (eventId: string, skip: { id: string } | undefined): number => combos.filter((combo) => combo !== skip && combo.members.has(eventId)).reduce((product, combo) => product * (1 - combo.g), 1);
  const refresh = (): void => {
    for (const [eventId, probability] of probabilities) independents.set(eventId, Math.max(0, 1 - (1 - probability) / sharedOf(eventId, undefined)));
  };
  for (const combo of [...combos].sort((a, b) => b.list.length - a.list.length)) {
    const larger = combos.filter((other) => other !== combo && other.list.length > combo.list.length && combo.list.every((member) => other.members.has(member))).reduce((sum, other) => sum + other.g, 0);
    const product = combo.list.reduce((value, member) => value * (probabilities.get(member) ?? 0), 1);
    combo.g = Math.max(0, combo.joint - larger - product);
  }
  for (let sweep = 0; sweep < 200; sweep += 1) {
    let change = 0;
    for (const combo of combos) {
      const previous = combo.g;
      const upper = Math.max(0, Math.min(...combo.list.map((member) => 1 - (1 - (probabilities.get(member) ?? 0)) / sharedOf(member, combo))));
      const valueAt = (g: number): number | undefined => {
        combo.g = g;
        refresh();
        return allFail(combo.list, combos, independents);
      };
      const top = valueAt(upper);
      const bottom = valueAt(0);
      if (top === undefined || bottom === undefined) return failed(`The joint events of ${combo.id} overlap too many others.`);
      if (top < combo.joint * (1 - 1e-12)) return failed(`The joint HEP of ${combo.id} cannot be reached with its members' HEPs.`);
      if (bottom > combo.joint * (1 + 1e-12)) return failed(`The joint HEP of ${combo.id} is below what its overlapping combinations already give.`);
      let low = 0;
      let high = upper;
      for (let step = 0; step < 300 && high - low > Number.EPSILON * high; step += 1) {
        const middle = (low + high) / 2;
        const value = valueAt(middle);
        if (value === undefined) return failed(`The joint events of ${combo.id} overlap too many others.`);
        if (value < combo.joint) low = middle;
        else high = middle;
      }
      combo.g = (low + high) / 2;
      change = Math.max(change, Math.abs(combo.g - previous) / Math.max(combo.g, Number.MIN_VALUE));
    }
    refresh();
    if (change < 1e-14) break;
  }
  return { joints: new Map(combos.map((combo) => [combo.id, combo.g])), independents };
}

export {
  FEASIBILITY_REQUIRED,
  THERP_CONDITIONAL,
  activeRecoveries,
  combinationKey,
  combinationMembers,
  esqIndependentEventId,
  esqJointEventId,
  esqPostRunId,
  esqRecoveryEventId,
  eventProbabilityOf,
  floorValueOf,
  hfeEventIds,
  postWorkOf,
  resolvedCombinations,
  resolvedRecoveries,
  scopeApplies,
  solveJointEvents,
  therpJoint,
};
export type { EsqCombinationMember, EsqFeasibilityKey, EsqJointSolution, EsqPoints, EsqResolvedCombination, EsqResolvedRecovery };
