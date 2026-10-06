import type { EsqSequenceRecord, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { EsqImportanceGroup, EsqSamplingLaw } from "interfaces-mef-types/esq/esq-measure-inputs";
import { sequenceFamilyOf } from "interfaces-mef-types/esq/esq-solve-inputs";
import { resolvedRecoveries } from "interfaces-mef-types/esq/esq-post-inputs";
import type {
  EsqEventTreeRunLogic,
  EsqImportanceEventRole,
  EsqImportanceFamily,
  EsqImportanceRunResult,
  EsqImportanceTarget,
  EsqImportanceTargetKind,
  EsqUncertaintyCorrelation,
  EsqUncertaintyFamily,
  EsqUncertaintyKey,
  EsqUncertaintyRunResult,
  EsqUncertaintyStatistics,
  EsqUncertaintyUnsampled,
  EventTreeSamplingMethod,
  WorkbookModelSnapshotIdentity,
} from "interfaces-shared-types/newly-developed-methods";
import type { EsqTreeRunOutcome } from "../newly-developed-methods/shared/workbook-analysis-runs.service";
import type { EsqRunBuild } from "./esq-model-run-builder";

interface EsqMeasureSummaryBase {
  esq: EventSequenceQuantification;
  logic: EsqEventTreeRunLogic;
  batchId: string;
  owner: WorkbookModelSnapshotIdentity;
  completedAt: string;
  inputs: string;
  outcomes: EsqTreeRunOutcome[];
  families: ReadonlyMap<string, Readonly<Record<string, string>>>;
}

interface EsqImportanceSummaryInput extends EsqMeasureSummaryBase {
  builds: ReadonlyMap<string, EsqRunBuild>;
  groups: readonly EsqImportanceGroup[];
  eventCodes: Record<string, string>;
}

interface EsqUncertaintySummaryInput extends EsqMeasureSummaryBase {
  trials: number;
  seed: number;
  method: EventTreeSamplingMethod;
  correlation: EsqUncertaintyCorrelation;
  keys: { key: string; label: string; source: string; law: EsqSamplingLaw; events: number }[];
  unsampled: EsqUncertaintyUnsampled[];
}

const RELEASE_END_STATE = "RADIONUCLIDE_RELEASE";

interface EsqFamilyFacts {
  endState: string | null;
  release: boolean;
}

function familyFacts(esq: EventSequenceQuantification): Map<string, EsqFamilyFacts> {
  const model = esq.model;
  const choices = esq.modelDecisions?.familyChoices ?? [];
  const members = new Map<string, EsqSequenceRecord[]>();
  for (const record of model?.sequences ?? []) {
    const familyId = sequenceFamilyOf(esq, record);
    if (familyId === undefined) continue;
    members.set(familyId, [...(members.get(familyId) ?? []), record]);
  }
  const ids = new Set([
    ...(model?.families ?? []).map((family) => family.id),
    ...choices.filter((choice) => choice.manual !== undefined).map((choice) => choice.familyId),
    ...members.keys(),
  ]);
  return new Map([...ids].map((familyId): [string, EsqFamilyFacts] => {
    const record = model?.families.find((family) => family.id === familyId);
    const choice = choices.find((entry) => entry.familyId === familyId);
    const list = members.get(familyId) ?? [];
    const ends = [...new Set(list.flatMap((member) => (member.endState === undefined ? [] : [member.endState])))];
    const endState = choice?.manual !== undefined ? choice.endState : record?.endState ?? (ends.length === 1 ? ends[0] : undefined);
    const release = endState === RELEASE_END_STATE
      || (record?.releaseCategoryIds ?? []).length > 0
      || list.some((member) => member.releaseCategoryId !== undefined)
      || (choice?.releaseCategoryId ?? "").trim().length > 0;
    return [familyId, { endState: endState ?? null, release }];
  }));
}

function trees(outcomes: readonly EsqTreeRunOutcome[]): EsqImportanceRunResult["trees"] {
  return outcomes.map((outcome) => ({
    treeId: outcome.treeId,
    runId: outcome.runId,
    status: outcome.status,
    initiatorFrequency: outcome.initiatorFrequency,
    failure: outcome.failure,
  }));
}

interface TargetSlot {
  kind: EsqImportanceTargetKind;
  role: EsqImportanceEventRole | null;
  label: string;
  ref: string | null;
  probability: number | null;
  changes: Map<string, { decrease: number; increase: number }>;
}

function summarizeEsqImportanceRun(input: EsqImportanceSummaryInput): EsqImportanceRunResult {
  const model = input.esq.model;
  const codeOf = new Map((model?.events ?? []).map((event) => [event.id, event.code]));
  const groupName = new Map((model?.ccfGroups ?? []).map((group) => [group.id, group.name]));
  const groupOf = new Map(input.groups.map((group) => [group.key, group]));
  const roles = new Map<string, { role: EsqImportanceEventRole; ref: string | null }>();
  const recoveryOf = new Map(resolvedRecoveries(input.esq).map((recovery) => [recovery.eventId, recovery.id]));
  for (const build of input.builds.values()) {
    for (const value of build.values) {
      const ref = value.role === "RECOVERY" ? value.recoveryId ?? null
        : value.role === "JOINT" ? value.combinationId ?? null
        : value.role === "INDEPENDENT_PART" ? value.baseEventId ?? null
        : value.role === "SPLIT" ? value.splitKey ?? null
        : value.id;
      roles.set(value.id, { role: value.role, ref });
      if (value.role === "RECOVERY" && value.recoveryId !== undefined) recoveryOf.set(value.id, value.recoveryId);
    }
  }
  const display = (id: string): string => {
    const recovery = recoveryOf.get(id);
    if (recovery !== undefined) return `NR-${recovery}`;
    const known = roles.get(id);
    if (known?.role === "INDEPENDENT_PART" && known.ref !== null) return `${display(known.ref)} · independent part`;
    if (known?.role === "JOINT" && known.ref !== null) return `Joint HEP ${known.ref}`;
    return codeOf.get(id) ?? input.eventCodes[id] ?? id;
  };
  const base = new Map<string, number>();
  const targets = new Map<string, TargetSlot>();
  const moved = new Set<string>();
  const add = (slot: TargetSlot, familyId: string, decrease: number, increase: number): void => {
    const entry = slot.changes.get(familyId) ?? { decrease: 0, increase: 0 };
    entry.decrease += decrease;
    entry.increase += increase;
    slot.changes.set(familyId, entry);
  };
  for (const outcome of input.outcomes) {
    const importance = outcome.status === "SUCCEEDED" ? outcome.result?.importance : undefined;
    if (importance === undefined) continue;
    const variables = new Map(importance.variables.map((variable) => [variable.id, variable]));
    for (const family of importance.families) {
      base.set(family.familyId, (base.get(family.familyId) ?? 0) + family.base);
      for (const change of family.events) {
        let slot = targets.get(`EVENT:${change.id}`);
        if (slot === undefined) {
          const variable = variables.get(change.id);
          const ccf = variable?.ccfGroupId;
          const known = roles.get(change.id);
          const label = ccf !== undefined
            ? `${groupName.get(ccf) ?? ccf}[${(variable?.ccfMembers ?? []).map((id) => codeOf.get(id) ?? id).join("+")}]`
            : display(change.id);
          slot = {
            kind: "EVENT",
            role: ccf !== undefined ? "CCF_TERM" : known?.role ?? "BASIC",
            label,
            ref: ccf ?? known?.ref ?? change.id,
            probability: variable?.probability ?? null,
            changes: new Map(),
          };
          targets.set(`EVENT:${change.id}`, slot);
        }
        add(slot, family.familyId, change.decrease, change.increase);
        if (change.decrease !== 0 || change.increase !== 0) {
          moved.add(change.id);
          for (const member of variables.get(change.id)?.ccfMembers ?? []) moved.add(member);
        }
      }
      for (const change of family.groups) {
        let slot = targets.get(change.key);
        if (slot === undefined) {
          const group = groupOf.get(change.key);
          slot = { kind: group?.kind ?? "PARAMETER", role: null, label: group?.label ?? change.key, ref: group?.ref ?? null, probability: null, changes: new Map() };
          targets.set(change.key, slot);
        }
        add(slot, family.familyId, change.decrease, change.increase);
      }
    }
  }
  const facts = familyFacts(input.esq);
  const families: EsqImportanceFamily[] = [...base].map(([familyId, value]) => ({ familyId, base: value, endState: facts.get(familyId)?.endState ?? null }));
  const rows: EsqImportanceTarget[] = [...targets].map(([id, slot]) => ({
    id,
    kind: slot.kind,
    role: slot.role,
    label: slot.label,
    ref: slot.ref,
    probability: slot.probability,
    changes: [...slot.changes].map(([familyId, change]) => ({ familyId, decrease: change.decrease, increase: change.increase })),
  }));
  return {
    schemaVersion: "1.0.0",
    kind: "ESQ_IMPORTANCE_RUN",
    runId: input.batchId,
    owner: input.owner,
    completedAt: input.completedAt,
    inputs: input.inputs,
    logic: { ...input.logic },
    trees: trees(input.outcomes),
    families,
    targets: rows,
    silentEventIds: [...new Set([...input.builds.values()].flatMap((build) => build.values.filter((value) => value.role === "BASIC").map((value) => value.id)))]
      .filter((id) => !moved.has(id))
      .sort(),
  };
}

function quantile(sorted: readonly number[], probability: number): number {
  if (sorted.length === 0) return 0;
  const position = probability * (sorted.length - 1);
  const low = Math.floor(position);
  const high = Math.min(sorted.length - 1, low + 1);
  const weight = position - low;
  return (sorted[low] ?? 0) * (1 - weight) + (sorted[high] ?? 0) * weight;
}

function statistics(values: readonly number[], point: number): EsqUncertaintyStatistics {
  const count = values.length;
  const mean = count === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / count;
  const variance = count < 2 ? 0 : values.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / (count - 1);
  const sorted = [...values].sort((a, b) => a - b);
  return { point, mean, standardDeviation: Math.sqrt(variance), p05: quantile(sorted, 0.05), p50: quantile(sorted, 0.5), p95: quantile(sorted, 0.95) };
}

function summarizeEsqUncertaintyRun(input: EsqUncertaintySummaryInput): EsqUncertaintyRunResult {
  const totals = new Map<string, number[]>();
  const points = new Map<string, number>();
  for (const outcome of input.outcomes) {
    const result = outcome.status === "SUCCEEDED" ? outcome.result : null;
    if (result === null) continue;
    const familyOf = input.families.get(outcome.treeId) ?? {};
    for (const sequence of result.sequences) {
      const final = sequence.sequenceChain?.[sequence.sequenceChain.length - 1]?.entityId ?? sequence.sequenceId;
      const familyId = familyOf[final];
      if (familyId !== undefined) points.set(familyId, (points.get(familyId) ?? 0) + sequence.annualFrequency);
    }
    for (const family of result.sampling?.families ?? []) {
      const slot = totals.get(family.familyId) ?? new Array<number>(input.trials).fill(0);
      family.values.forEach((value, trial) => { slot[trial] = (slot[trial] ?? 0) + value; });
      totals.set(family.familyId, slot);
    }
  }
  const facts = familyFacts(input.esq);
  const release = [...totals].filter(([familyId]) => facts.get(familyId)?.release === true);
  const total = release.length === 0 ? null : statistics(
    new Array<number>(input.trials).fill(0).map((_, trial) => release.reduce((sum, [, values]) => sum + (values[trial] ?? 0), 0)),
    release.reduce((sum, [familyId]) => sum + (points.get(familyId) ?? 0), 0),
  );
  const families: EsqUncertaintyFamily[] = [...totals].map(([familyId, values]) => ({
    familyId,
    endState: facts.get(familyId)?.endState ?? null,
    ...statistics(values, points.get(familyId) ?? 0),
    values: values.map((value) => Number(value.toPrecision(6))),
  }));
  const keys: EsqUncertaintyKey[] = input.keys.map((key) => ({ key: key.key, label: key.label, source: key.source, distribution: key.law, events: key.events }));
  return {
    schemaVersion: "1.0.0",
    kind: "ESQ_UNCERTAINTY_RUN",
    runId: input.batchId,
    owner: input.owner,
    completedAt: input.completedAt,
    inputs: input.inputs,
    logic: { ...input.logic },
    trials: input.trials,
    seed: input.seed,
    method: input.method,
    correlation: input.correlation,
    trees: trees(input.outcomes),
    families,
    total,
    keys,
    unsampled: input.unsampled,
  };
}

export { familyFacts, statistics, summarizeEsqImportanceRun, summarizeEsqUncertaintyRun, type EsqFamilyFacts, type EsqImportanceSummaryInput, type EsqUncertaintySummaryInput };
