import type { EsqSequenceRecord, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { EsqImportanceGroup } from "interfaces-mef-types/esq/esq-measure-inputs";
import type { UncertainExpression, UncertainUnit } from "interfaces-mef-types/core/uncertainty";
import { esqSequenceRunId } from "interfaces-mef-types/esq/esq-run-inputs";
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
  EsqUncertaintyGroup,
  EsqUncertaintyGroupKind,
  EsqUncertaintyHistogram,
  EsqUncertaintyKey,
  EsqUncertaintyRunResult,
  EsqUncertaintySequence,
  EsqUncertaintySeries,
  EsqUncertaintyStatistics,
  EsqUncertaintyUnsampled,
  EventTreeSamplingMethod,
  WorkbookModelSnapshotIdentity,
} from "interfaces-shared-types/newly-developed-methods";
import type { EsqTreeRunOutcome } from "../newly-developed-methods/shared/workbook-analysis-runs.service";
import type { EsqRunBuild } from "./esq-model-run-builder";
import { initiatorFrequencyOf } from "./esq-model-run-summary";

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
  keys: { key: string; label: string; source: string; expression: UncertainExpression; unit: UncertainUnit; events: number }[];
  unsampled: EsqUncertaintyUnsampled[];
}

const RELEASE_END_STATE = "RADIONUCLIDE_RELEASE";

interface EsqFamilyFacts {
  endState: string | null;
  release: boolean;
  releaseCategoryId: string | null;
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
    const esCategories = record?.releaseCategoryIds ?? [];
    const memberCategories = [...new Set(list.flatMap((member) => (member.releaseCategoryId === undefined ? [] : [member.releaseCategoryId])))];
    const chosen = (choice?.releaseCategoryId ?? "").trim();
    const releaseCategoryId = chosen.length > 0 ? chosen
      : esCategories.length === 1 ? esCategories[0] ?? null
      : esCategories.length === 0 && memberCategories.length === 1 ? memberCategories[0] ?? null
      : null;
    return [familyId, { endState: endState ?? null, release, releaseCategoryId }];
  }));
}

function trees(outcomes: readonly EsqTreeRunOutcome[]): EsqImportanceRunResult["trees"] {
  return outcomes.map((outcome) => ({
    treeId: outcome.treeId,
    runId: outcome.runId,
    status: outcome.status,
    initiatorFrequency: initiatorFrequencyOf(outcome),
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

function quantile(sorted: ArrayLike<number>, probability: number): number {
  if (sorted.length === 0) return 0;
  const position = probability * (sorted.length - 1);
  const low = Math.floor(position);
  const high = Math.min(sorted.length - 1, low + 1);
  const weight = position - low;
  return (sorted[low] ?? 0) * (1 - weight) + (sorted[high] ?? 0) * weight;
}

function statisticsOf(values: readonly number[], sorted: ArrayLike<number>, point: number): EsqUncertaintyStatistics {
  const count = values.length;
  const mean = count === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / count;
  const variance = count < 2 ? 0 : values.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / (count - 1);
  const standardDeviation = Math.sqrt(variance);
  return { point, mean, standardDeviation, standardError: count === 0 ? 0 : standardDeviation / Math.sqrt(count), p05: quantile(sorted, 0.05), p50: quantile(sorted, 0.5), p95: quantile(sorted, 0.95) };
}

function statistics(values: readonly number[], point: number): EsqUncertaintyStatistics {
  return statisticsOf(values, Float64Array.from(values).sort(), point);
}

const BIN_COUNT = 40;

const QUANTILE_STEPS = 100;

interface GroupSlot {
  kind: EsqUncertaintyGroupKind;
  key: string;
  values: number[];
  point: number;
}

interface FinalSequence {
  chain: string[];
  paths: number;
  point: number;
}

function rounded(value: number): number {
  return Number(value.toPrecision(6));
}

function histogramOf(sorted: Float64Array): EsqUncertaintyHistogram | null {
  const positive = sorted.filter((value) => value > 0);
  if (positive.length === 0) return null;
  const smallest = positive[0] ?? 0;
  const largest = positive[positive.length - 1] ?? 0;
  const floor = Math.floor(Math.log10(smallest));
  const ceiling = Math.ceil(Math.log10(largest));
  const low = ceiling > floor ? floor : floor - 1;
  const high = ceiling > floor ? ceiling : floor + 1;
  const width = (high - low) / BIN_COUNT;
  const counts = new Array<number>(BIN_COUNT).fill(0);
  for (const value of positive) {
    const index = Math.min(BIN_COUNT - 1, Math.max(0, Math.floor((Math.log10(value) - low) / width)));
    counts[index] = (counts[index] ?? 0) + 1;
  }
  return { low, high, counts, zeros: sorted.length - positive.length };
}

function seriesOf(values: readonly number[], point: number): EsqUncertaintySeries {
  const sorted = Float64Array.from(values).sort();
  return {
    ...statisticsOf(values, sorted, point),
    histogram: histogramOf(sorted),
    quantiles: Array.from({ length: QUANTILE_STEPS + 1 }, (_, step) => rounded(quantile(sorted, step / QUANTILE_STEPS))),
  };
}

function addGroup(slots: Map<string, GroupSlot>, kind: EsqUncertaintyGroupKind, key: string, values: readonly number[], point: number, trials: number): void {
  const id = `${kind}|${key}`;
  const slot = slots.get(id) ?? { kind, key, values: new Array<number>(trials).fill(0), point: 0 };
  for (let trial = 0; trial < trials; trial += 1) slot.values[trial] = (slot.values[trial] ?? 0) + (values[trial] ?? 0);
  slot.point += point;
  slots.set(id, slot);
}

function finalSequences(result: NonNullable<EsqTreeRunOutcome["result"]>): Map<string, FinalSequence> {
  const finals = new Map<string, FinalSequence>();
  for (const entry of result.sequences) {
    const chain = entry.sequenceChain === undefined ? [entry.sequenceId] : entry.sequenceChain.map((link) => link.entityId);
    const final = chain[chain.length - 1] ?? entry.sequenceId;
    const known = finals.get(final);
    if (known === undefined) {
      finals.set(final, { chain, paths: 1, point: entry.annualFrequency });
      continue;
    }
    known.paths += 1;
    known.point += entry.annualFrequency;
  }
  return finals;
}

function summarizeEsqUncertaintyRun(input: EsqUncertaintySummaryInput): EsqUncertaintyRunResult {
  const byRunId = new Map((input.esq.model?.sequences ?? []).map((record) => [esqSequenceRunId(record.treeId, record.id), record]));
  const facts = familyFacts(input.esq);
  const sequences: EsqUncertaintySequence[] = [];
  const groups: EsqUncertaintyGroup[] = [];
  const plant = new Map<string, GroupSlot>();
  for (const outcome of input.outcomes) {
    const result = outcome.status === "SUCCEEDED" ? outcome.result : null;
    if (result === null) continue;
    const familyOf = input.families.get(outcome.treeId) ?? {};
    const sampled = new Map((result.sampling?.families ?? []).map((entry) => [entry.familyId, entry.values]));
    const own = new Map<string, GroupSlot>();
    for (const [final, row] of finalSequences(result)) {
      const values = sampled.get(final);
      if (values === undefined) continue;
      const shown = (row.paths === 1 ? row.chain : [final]).flatMap((id) => {
        const record = byRunId.get(id);
        return record === undefined ? [] : [record.id];
      });
      const last = byRunId.get(final);
      const familyId = familyOf[final] ?? null;
      const fact = familyId === null ? undefined : facts.get(familyId);
      const releaseCategoryId = familyId === null ? last?.releaseCategoryId ?? null : fact?.releaseCategoryId ?? null;
      sequences.push({
        treeId: outcome.treeId,
        sequenceIds: shown.length === 0 ? [final] : shown,
        paths: row.paths,
        familyId,
        releaseCategoryId,
        endState: last?.endState ?? null,
        ...seriesOf(values, row.point),
      });
      for (const slots of [own, plant]) {
        addGroup(slots, "FAMILY", familyId ?? "", values, row.point, input.trials);
        addGroup(slots, "RELEASE_CATEGORY", releaseCategoryId ?? "", values, row.point, input.trials);
        if (fact?.release === true) addGroup(slots, "RELEASE_TOTAL", "", values, row.point, input.trials);
      }
    }
    for (const slot of own.values()) groups.push({ treeId: outcome.treeId, kind: slot.kind, key: slot.key, ...seriesOf(slot.values, slot.point) });
  }
  for (const slot of plant.values()) groups.push({ treeId: null, kind: slot.kind, key: slot.key, ...seriesOf(slot.values, slot.point) });
  const families: EsqUncertaintyFamily[] = [...plant.values()]
    .filter((slot) => slot.kind === "FAMILY" && slot.key !== "")
    .map((slot) => ({
      familyId: slot.key,
      endState: facts.get(slot.key)?.endState ?? null,
      ...statistics(slot.values, slot.point),
      values: slot.values.map(rounded),
    }));
  const releaseSlot = plant.get("RELEASE_TOTAL|");
  const total = releaseSlot === undefined ? null : { ...statistics(releaseSlot.values, releaseSlot.point), values: releaseSlot.values.map(rounded) };
  const keys: EsqUncertaintyKey[] = input.keys.map((key) => ({ key: key.key, label: key.label, source: key.source, expression: key.expression, unit: key.unit, events: key.events }));
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
    sequences,
    groups,
    keys,
    unsampled: input.unsampled,
  };
}

export { familyFacts, statistics, summarizeEsqImportanceRun, summarizeEsqUncertaintyRun, type EsqFamilyFacts, type EsqImportanceSummaryInput, type EsqUncertaintySummaryInput };
